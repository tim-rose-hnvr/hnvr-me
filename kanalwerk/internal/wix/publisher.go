package wix

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// Kanalzustand ist der Zustand einer Kanalverbindung auf einer Site.
//
// Die drei Werte entsprechen genau den drei Antworten, die die
// Publisher-Schnittstelle liefert. Gemessen am 17.08.2026.
type Kanalzustand string

const (
	Verbunden     Kanalzustand = "verbunden"     // HTTP 200 mit accounts[]
	Ungueltig     Kanalzustand = "ungueltig"     // USER_IS_DISCONNECTED — war verbunden
	NieVerbunden  Kanalzustand = "nie_verbunden" // USER_NOT_EXIST_FOR_CHANNEL
	ZustandUnklar Kanalzustand = "unklar"        // alles andere
)

// Anwendungscodes der Publisher-Schnittstelle.
const (
	CodeGetrennt   = "USER_IS_DISCONNECTED"
	CodeNichtDa    = "USER_NOT_EXIST_FOR_CHANNEL"
	CodeKeinBudget = "QUOTA_EXCEEDED"
)

// Kanäle, die Wix trägt. X ist von Wix als überholt geführt und fehlt hier
// bewusst.
var BekannteKanaele = []string{
	"FACEBOOK", "INSTAGRAM", "LINKEDIN", "YOUTUBE", "PINTEREST", "GBP", "TIKTOK",
}

// Konto ist ein verbundenes Konto auf einem Kanal.
type Konto struct {
	Kanal       string
	ID          string
	Anzeigename string
	BildURL     string
	Standard    bool
}

type kontoRoh struct {
	ChannelName string     `json:"channelName"`
	Facebook    *kontoFeld `json:"facebook"`
	Instagram   *kontoFeld `json:"instagram"`
	Linkedin    *kontoFeld `json:"linkedin"`
	Youtube     *kontoFeld `json:"youtube"`
	Pinterest   *kontoFeld `json:"pinterest"`
	Gbp         *kontoFeld `json:"gbp"`
	Tiktok      *kontoFeld `json:"tiktok"`
}

type kontoFeld struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	PictureURL  string `json:"pictureUrl"`
	Settings    struct {
		Default bool `json:"default"`
	} `json:"settings"`
}

func (k kontoRoh) feld() *kontoFeld {
	for _, f := range []*kontoFeld{k.Facebook, k.Instagram, k.Linkedin, k.Youtube, k.Pinterest, k.Gbp, k.Tiktok} {
		if f != nil {
			return f
		}
	}
	return nil
}

// Konten liest die verbundenen Konten eines Kanals.
//
// Der zweite Rückgabewert ist der Kanalzustand. Er wird auch dann gesetzt,
// wenn ein Fehler zurückkommt — „nie verbunden" ist kein Betriebsfehler,
// sondern eine Tatsache über den Kanal.
func (c *Client) Konten(ctx context.Context, siteID, kanal string) ([]Konto, Kanalzustand, error) {
	var antwort struct {
		Accounts []kontoRoh `json:"accounts"`
	}
	pfad := "/social-publisher/v1/accounts?channelName=" + url.QueryEscape(kanal)
	err := c.Ruf(ctx, "GET", pfad, siteID, nil, &antwort)
	if err != nil {
		switch CodeVon(err) {
		case CodeGetrennt:
			return nil, Ungueltig, nil
		case CodeNichtDa:
			return nil, NieVerbunden, nil
		}
		return nil, ZustandUnklar, err
	}

	var konten []Konto
	for _, r := range antwort.Accounts {
		f := r.feld()
		if f == nil {
			continue
		}
		name := r.ChannelName
		if name == "" {
			name = kanal
		}
		konten = append(konten, Konto{
			Kanal:       name,
			ID:          f.ID,
			Anzeigename: f.DisplayName,
			BildURL:     f.PictureURL,
			Standard:    f.Settings.Default,
		})
	}
	if len(konten) == 0 {
		return nil, NieVerbunden, nil
	}
	return konten, Verbunden, nil
}

// Kontingent ist das Kontingent einer Fähigkeit auf einer Site.
type Kontingent struct {
	Merkmal    string
	Erlaubt    bool
	Grenze     int
	Verbraucht int
	Rest       int
	Zeitraum   string
}

// Kontingent liest Erlaubnis und Rest für ein Merkmal, etwa PUBLISH_POST
// oder SCHEDULE_POST.
func (c *Client) Kontingent(ctx context.Context, siteID, merkmal string) (Kontingent, error) {
	var antwort struct {
		FeatureData struct {
			Type      string `json:"type"`
			Enabled   bool   `json:"enabled"`
			QuotaInfo *struct {
				Limit          int    `json:"limit"`
				CurrentUsage   int    `json:"currentUsage"`
				RemainingUsage int    `json:"remainingUsage"`
				Period         string `json:"period"`
			} `json:"quotaInfo"`
		} `json:"featureData"`
	}
	pfad := "/social-publisher/v1/features/" + url.PathEscape(merkmal)
	if err := c.Ruf(ctx, "GET", pfad, siteID, nil, &antwort); err != nil {
		return Kontingent{}, err
	}
	k := Kontingent{Merkmal: merkmal, Erlaubt: antwort.FeatureData.Enabled}
	if q := antwort.FeatureData.QuotaInfo; q != nil {
		k.Grenze, k.Verbraucht, k.Rest, k.Zeitraum = q.Limit, q.CurrentUsage, q.RemainingUsage, q.Period
	}
	return k, nil
}

// Beitragsentwurf ist ein fertig gefüllter Beitrag für genau einen Kanal.
//
// Die Publisher-Schnittstelle nimmt je Aufruf einen Kanal. Ein Beitrag, der
// auf drei Kanälen erscheinen soll, sind drei Aufrufe und drei Einheiten
// Kontingent.
type Beitragsentwurf struct {
	Kanal   string // FACEBOOK, INSTAGRAM, LINKEDIN, …
	KontoID string
	Text    string
	BildURL string
	LinkURL string
	AutorID string // LinkedIn: authorId, Facebook: pageId
}

// Veroeffentlicht ist die Antwort auf ein erfolgreiches Veröffentlichen.
type Veroeffentlicht struct {
	ItemID     string
	Zustand    string
	ExterneID  string
	ExterneURL string
}

// Veroeffentliche gibt einen Beitrag sofort auf einem Kanal heraus.
//
// Bewusst OHNE schedulingInfo.scheduledDate: das Setzen eines Termins
// verlangt das Merkmal SCHEDULE_POST, das auf allen geprüften Sites
// abgeschaltet ist. Sofort-Veröffentlichen verlangt nur PUBLISH_POST, und
// das ist überall erlaubt. Die Uhr liegt deshalb bei uns, nicht bei Wix.
func (c *Client) Veroeffentliche(ctx context.Context, siteID string, e Beitragsentwurf) (Veroeffentlicht, error) {
	item := map[string]any{
		"channel": map[string]any{
			"name":      e.Kanal,
			"accountId": e.KontoID,
		},
		"type": "POST",
	}

	inhalt := map[string]any{"caption": e.Text}
	if e.BildURL != "" {
		inhalt["imageUrl"] = e.BildURL
	} else if e.LinkURL != "" {
		inhalt["link"] = e.LinkURL
	}

	switch strings.ToUpper(e.Kanal) {
	case "FACEBOOK":
		if e.AutorID != "" {
			inhalt["pageId"] = e.AutorID
		} else {
			inhalt["pageId"] = e.KontoID
		}
		item["facebookPost"] = inhalt
	case "INSTAGRAM":
		// Instagram verlangt Bildmaterial — ein reiner Textbeitrag ist dort
		// nicht möglich. Lieber hier scheitern als mit einem unklaren
		// Schnittstellenfehler.
		if e.BildURL == "" {
			return Veroeffentlicht{}, fmt.Errorf("wix: Instagram verlangt ein Bild")
		}
		delete(inhalt, "link")
		item["instagramPost"] = inhalt
	case "LINKEDIN":
		if e.AutorID != "" {
			inhalt["authorId"] = e.AutorID
		} else {
			inhalt["authorId"] = e.KontoID
		}
		item["linkedinPost"] = inhalt
	default:
		return Veroeffentlicht{}, fmt.Errorf("wix: Kanal %q wird noch nicht bedient", e.Kanal)
	}

	var antwort struct {
		Item struct {
			ID      string `json:"id"`
			Status  string `json:"status"`
			Channel struct {
				ExternalItemID  string `json:"externalItemId"`
				ExternalItemURL string `json:"externalItemUrl"`
			} `json:"channel"`
		} `json:"item"`
	}

	rumpf := map[string]any{"item": item}
	if err := c.Ruf(ctx, "POST", "/social-publisher/v1/publish", siteID, rumpf, &antwort); err != nil {
		return Veroeffentlicht{}, err
	}
	return Veroeffentlicht{
		ItemID:     antwort.Item.ID,
		Zustand:    antwort.Item.Status,
		ExterneID:  antwort.Item.Channel.ExternalItemID,
		ExterneURL: antwort.Item.Channel.ExternalItemURL,
	}, nil
}
