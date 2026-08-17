package wix

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

// Anwendungscodes der E-Mail-Schnittstellen.
const (
	CodeKeinMailBudget = "OUT_OF_QUOTA"
	CodeKontoGesperrt  = "ACCOUNT_SUSPENDED"
)

// Mailkonto ist der Zustand des E-Mail-Marketing-Kontos einer Site.
type Mailkonto struct {
	Zustand         string
	Paket           string
	MailsJeMonat    int
	Verbraucht      int
	Rest            int
	Terminierbar    bool
	MehrereAbsender bool
	WixWerbung      bool
}

// Mailkonto liest Zustand und Kontingent des E-Mail-Kontos.
func (c *Client) Mailkonto(ctx context.Context, siteID string) (Mailkonto, error) {
	var antwort struct {
		AccountDetails struct {
			Status  string `json:"status"`
			Package struct {
				ID                     string `json:"id"`
				MonthlyQuotaAllocation struct {
					Campaigns int `json:"campaigns"`
					Emails    int `json:"emails"`
				} `json:"monthlyQuotaAllocation"`
			} `json:"package"`
			QuotaPeriod struct {
				QuotaUsage struct {
					Campaigns int `json:"campaigns"`
					Emails    int `json:"emails"`
				} `json:"quotaUsage"`
			} `json:"quotaPeriod"`
			Features struct {
				MultipleSenderDetails bool `json:"multipleSenderDetails"`
				RemoveWixBranding     bool `json:"removeWixBranding"`
				Scheduling            bool `json:"scheduling"`
			} `json:"features"`
		} `json:"accountDetails"`
	}
	if err := c.Ruf(ctx, "GET", "/email-marketing/v1/account-details", siteID, nil, &antwort); err != nil {
		return Mailkonto{}, err
	}
	a := antwort.AccountDetails
	k := Mailkonto{
		Zustand:         a.Status,
		Paket:           a.Package.ID,
		MailsJeMonat:    a.Package.MonthlyQuotaAllocation.Emails,
		Verbraucht:      a.QuotaPeriod.QuotaUsage.Emails,
		Terminierbar:    a.Features.Scheduling,
		MehrereAbsender: a.Features.MultipleSenderDetails,
		WixWerbung:      !a.Features.RemoveWixBranding,
	}
	k.Rest = k.MailsJeMonat - k.Verbraucht
	if k.Rest < 0 {
		k.Rest = 0
	}
	return k, nil
}

// Kontakt ist ein Empfänger auf einer Site.
type Kontakt struct {
	ID   string
	Name string
	Mail string
}

// Kontakte liest bis zu grenze Kontakte samt Gesamtzahl.
//
// Die Gesamtzahl ist wichtiger als die Liste: sie entscheidet, ob eine
// Aussendung überhaupt ins Kontingent passt.
func (c *Client) Kontakte(ctx context.Context, siteID string, grenze int) ([]Kontakt, int, error) {
	if grenze <= 0 || grenze > 1000 {
		grenze = 1000
	}
	var antwort struct {
		Contacts []struct {
			ID   string `json:"id"`
			Info struct {
				Name struct {
					First string `json:"first"`
					Last  string `json:"last"`
				} `json:"name"`
				Emails []struct {
					Email string `json:"email"`
				} `json:"emails"`
			} `json:"info"`
		} `json:"contacts"`
		PagingMetadata struct {
			Total          int  `json:"total"`
			TooManyToCount bool `json:"tooManyToCount"`
		} `json:"pagingMetadata"`
	}
	pfad := fmt.Sprintf("/contacts/v4/contacts?paging.limit=%d", grenze)
	if err := c.Ruf(ctx, "GET", pfad, siteID, nil, &antwort); err != nil {
		return nil, 0, err
	}
	raus := make([]Kontakt, 0, len(antwort.Contacts))
	for _, k := range antwort.Contacts {
		e := Kontakt{ID: k.ID}
		e.Name = strings.TrimSpace(k.Info.Name.First + " " + k.Info.Name.Last)
		if len(k.Info.Emails) > 0 {
			e.Mail = k.Info.Emails[0].Email
		}
		raus = append(raus, e)
	}
	return raus, antwort.PagingMetadata.Total, nil
}

// Rundbrief ist eine Aussendung an eine Empfängergruppe.
type Rundbrief struct {
	Betreff              string
	HTML                 string
	AbsenderName         string
	AbsenderMail         string
	KontaktIDs           []string
	AbmeldePlatzhalter   string
	IdempotenzSchluessel string
}

// Versandt ist die Antwort auf eine angenommene Aussendung.
type Versandt struct {
	ID      string
	Zustand string
	Anzahl  int
}

// HoechsteEmpfaengerJeAufruf begrenzt eine einzelne Übergabe.
//
// Eine Liste mit tausenden Empfängern in einem Aufruf ist weder von der
// Schnittstelle gedeckt noch wiederholbar: scheitert sie in der Mitte,
// weiß niemand, wer schon Post hat.
const HoechsteEmpfaengerJeAufruf = 100

var ErrKeineEmpfaenger = errors.New("wix: keine Empfänger angegeben")

// SendeRundbrief übergibt eine Aussendung an Wix.
//
// Der Idempotenzschlüssel gehört zwingend dazu: die Schnittstelle nimmt
// ihn entgegen, damit ein Wiederholungsversuch nach Zeitüberschreitung
// niemandem zweimal Post schickt.
func (c *Client) SendeRundbrief(ctx context.Context, siteID string, r Rundbrief) (Versandt, error) {
	if len(r.KontaktIDs) == 0 {
		return Versandt{}, ErrKeineEmpfaenger
	}
	if len(r.KontaktIDs) > HoechsteEmpfaengerJeAufruf {
		return Versandt{}, fmt.Errorf("wix: %d Empfänger in einem Aufruf, erlaubt sind %d",
			len(r.KontaktIDs), HoechsteEmpfaengerJeAufruf)
	}
	if strings.TrimSpace(r.AbsenderMail) == "" {
		return Versandt{}, errors.New("wix: kein Absender gesetzt — die Adresse muss in Wix bestätigt sein")
	}

	empfaenger := make([]map[string]any, 0, len(r.KontaktIDs))
	for _, id := range r.KontaktIDs {
		empfaenger = append(empfaenger, map[string]any{"contactId": id})
	}

	sendung := map[string]any{
		"emailSubject":       r.Betreff,
		"emailHtmlContent":   r.HTML,
		"senderName":         r.AbsenderName,
		"senderEmailAddress": r.AbsenderMail,
		"replyTo":            map[string]any{"emailAddress": r.AbsenderMail},
		"toRecipients":       empfaenger,
		"type":               "MARKETING",
	}
	if r.AbmeldePlatzhalter != "" {
		sendung["marketingOptions"] = map[string]any{
			"unsubscribeUrlPlaceholder": r.AbmeldePlatzhalter,
		}
	}

	rumpf := map[string]any{"emailTransmission": sendung}
	if r.IdempotenzSchluessel != "" {
		rumpf["idempotencyKey"] = r.IdempotenzSchluessel
	}

	var antwort struct {
		EmailTransmission struct {
			ID     string `json:"id"`
			Status string `json:"status"`
		} `json:"emailTransmission"`
	}
	if err := c.Ruf(ctx, "POST", "/email-transmissions/v1/email-transmissions/send", siteID, rumpf, &antwort); err != nil {
		return Versandt{}, err
	}
	return Versandt{
		ID:      antwort.EmailTransmission.ID,
		Zustand: antwort.EmailTransmission.Status,
		Anzahl:  len(r.KontaktIDs),
	}, nil
}
