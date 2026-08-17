package speicher

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// Die kleine Seite hinter einem Code.
//
// Ein QR-Code auf einem Tisch fuehrt fast nie dorthin, wo er hinfuehren
// sollte. Er fuehrt auf eine Startseite, die auf dem Telefon vier
// Sekunden laedt, oder auf ein PDF, das man aufziehen muss. Wer eine
// Speisekarte sucht, sieht zuerst ein Cookie-Banner.
//
// Deshalb kann ein Code hier statt einer fremden Adresse eine eigene
// kleine Seite tragen: Titel, ein paar Zeilen, ein Knopf. Sie kommt aus
// demselben Binaer wie alles andere, laedt nichts nach und misst
// niemanden.
//
// Der Knopf ist der zweite Schritt und die einzige Stelle, an der
// gemessen wird: wer scannt, wird gezaehlt, und wer den Knopf drueckt,
// noch einmal. Aus diesen zwei Zahlen entsteht eine ehrliche Strecke —
// zwei Schritte, eine Rate. Mehr behauptet das System nicht.

// Vorlage ist eine der fertigen Formen.
type Vorlage struct {
	Schluessel string
	Name       string
	Zweck      string
}

// Die Vorlagen der Entwurfsseite, soweit sie ohne fremden Dienst und
// ohne personenbezogene Daten auskommen. Was fehlt und warum, steht im
// README — eine Vorlage, die E-Mail-Adressen einsammelt, braucht
// Doppelbestaetigung per Post, und dieses System verschickt bewusst
// keine Post.
var Vorlagenliste = []Vorlage{
	{"karte", "Karte kompakt", "Speisekarte, Preisliste, Angebot — Zeile und Preis"},
	{"veranstaltung", "Event-Programm", "Ablauf mit Uhrzeiten"},
	{"info", "Kurz erklärt", "ein paar Absätze und ein Knopf"},
	{"verweise", "Wegweiser", "eine Liste von Zielen zur Auswahl"},
}

// VorlageNach sucht eine Vorlage.
func VorlageNach(schluessel string) (Vorlage, bool) {
	for _, v := range Vorlagenliste {
		if v.Schluessel == schluessel {
			return v, true
		}
	}
	return Vorlage{}, false
}

// Zeile ist ein Eintrag in einem Block.
type Zeile struct {
	Was   string `json:"was"`
	Neben string `json:"neben,omitempty"` // Preis oder Uhrzeit
	Dazu  string `json:"dazu,omitempty"`  // kleine Anmerkung darunter
	Ziel  string `json:"ziel,omitempty"`  // nur bei der Vorlage „verweise"
}

// Block ist ein Abschnitt der Seite.
type Block struct {
	Titel  string  `json:"titel,omitempty"`
	Text   string  `json:"text,omitempty"`
	Zeilen []Zeile `json:"zeilen,omitempty"`
}

// Handlung ist der eine Knopf.
type Handlung struct {
	Text string `json:"text"`
	Ziel string `json:"ziel"`
}

// Seite ist die Landeseite eines Codes.
type Seite struct {
	Vorlage   string    `json:"vorlage"`
	Titel     string    `json:"titel"`
	Unter     string    `json:"unter,omitempty"`
	Bloecke   []Block   `json:"bloecke,omitempty"`
	Handlung  *Handlung `json:"handlung,omitempty"`
	Fuss      string    `json:"fuss,omitempty"`
	Geaendert time.Time `json:"geaendert,omitempty"`
}

// Die Grenzen sind keine Willkuer. Wer vor einem Aufsteller steht, laedt
// ueber Mobilfunk, oft in einem Keller mit zwei Balken. Eine Seite mit
// dreihundert Zeilen laedt dort nicht mehr, und sie ist auch nicht mehr
// zu lesen — so etwas gehoert hinter den Knopf.
const (
	HoechstBloecke = 12
	HoechstZeilen  = 40
	HoechstText    = 1200
	HoechstTitel   = 90
)

// Pruefe sagt, was an einer Seite nicht stimmt. Sie meldet alles auf
// einmal: wer eine Karte eintippt und drei Fehler nacheinander vorgelegt
// bekommt, tippt beim dritten nicht mehr.
func (s *Seite) Pruefe() []string {
	var fehler []string
	if s == nil {
		return []string{"keine Seite"}
	}
	if _, da := VorlageNach(s.Vorlage); !da {
		fehler = append(fehler, fmt.Sprintf("unbekannte Vorlage %q", s.Vorlage))
	}
	if strings.TrimSpace(s.Titel) == "" {
		fehler = append(fehler, "ohne Titel — er steht als Erstes auf dem Telefon")
	}
	if len([]rune(s.Titel)) > HoechstTitel {
		fehler = append(fehler, fmt.Sprintf("der Titel hat %d Zeichen, erlaubt sind %d",
			len([]rune(s.Titel)), HoechstTitel))
	}
	if len(s.Bloecke) > HoechstBloecke {
		fehler = append(fehler, fmt.Sprintf("%d Abschnitte — mehr als %d gehoeren hinter den Knopf",
			len(s.Bloecke), HoechstBloecke))
	}
	for i, b := range s.Bloecke {
		if len(b.Zeilen) > HoechstZeilen {
			fehler = append(fehler, fmt.Sprintf("Abschnitt %d hat %d Zeilen, erlaubt sind %d",
				i+1, len(b.Zeilen), HoechstZeilen))
		}
		if len([]rune(b.Text)) > HoechstText {
			fehler = append(fehler, fmt.Sprintf("der Text in Abschnitt %d ist zu lang", i+1))
		}
		for j, z := range b.Zeilen {
			if strings.TrimSpace(z.Was) == "" && strings.TrimSpace(z.Neben) == "" {
				fehler = append(fehler, fmt.Sprintf("Abschnitt %d, Zeile %d ist leer", i+1, j+1))
			}
			if z.Ziel != "" {
				if err := PruefeZiel(z.Ziel); err != nil {
					fehler = append(fehler, fmt.Sprintf("Abschnitt %d, Zeile %d: %s", i+1, j+1, err))
				}
			}
		}
	}
	if s.Vorlage == "verweise" {
		leer := 0
		for _, b := range s.Bloecke {
			for _, z := range b.Zeilen {
				if z.Ziel == "" {
					leer++
				}
			}
		}
		if leer > 0 {
			fehler = append(fehler, fmt.Sprintf(
				"%d Zeilen ohne Ziel — bei einem Wegweiser ist jede Zeile ein Weg", leer))
		}
	}
	if s.Handlung != nil {
		if strings.TrimSpace(s.Handlung.Text) == "" {
			fehler = append(fehler, "der Knopf hat keine Beschriftung")
		}
		if err := PruefeZiel(s.Handlung.Ziel); err != nil {
			fehler = append(fehler, "der Knopf: "+err.Error())
		}
	}
	return fehler
}

// PruefeZiel laesst nur Adressen durch, die ein Telefon oeffnen darf.
//
// Das ist keine Formsache. Ein Ziel wird spaeter in ein href
// geschrieben, und `javascript:` an dieser Stelle ist fremder Code auf
// der eigenen Domain — mit allem, was dort im Speicher des Browsers
// liegt. Erlaubt sind deshalb nur die vier Schemata, die eine Landeseite
// braucht, und nichts sonst.
func PruefeZiel(ziel string) error {
	ziel = strings.TrimSpace(ziel)
	if ziel == "" {
		return errors.New("ohne Ziel")
	}
	u, err := url.Parse(ziel)
	if err != nil {
		return fmt.Errorf("keine lesbare Adresse: %w", err)
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		if u.Host == "" {
			return errors.New("Adresse ohne Rechnernamen")
		}
		return nil
	case "mailto", "tel":
		if u.Opaque == "" {
			return errors.New("Adresse ohne Ziel hinter dem Doppelpunkt")
		}
		return nil
	case "":
		return errors.New("die Adresse braucht ein https:// davor")
	default:
		return fmt.Errorf("das Schema %q ist hier nicht erlaubt — "+
			"nur http, https, mailto und tel", u.Scheme)
	}
}

// SetzeSeite haengt eine Seite an einen Code oder nimmt sie weg.
func (s *Speicher) SetzeSeite(codeID string, seite *Seite) (*Code, error) {
	if seite != nil {
		if fehler := seite.Pruefe(); len(fehler) > 0 {
			return nil, errors.New(strings.Join(fehler, "; "))
		}
		seite.Geaendert = time.Now().UTC()
	}
	return s.Aendere(codeID, func(c *Code) error {
		c.Seite = seite
		return nil
	})
}
