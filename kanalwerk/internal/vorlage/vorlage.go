// Package vorlage trägt die Gestaltungsvorlagen.
//
// Der Gedanke: die Agentur gestaltet, die Kundin füllt. Schrift, Farbe,
// Raster und Logo liegen in der Vorlage und sind über die Oberfläche nicht
// erreichbar. Die Kundin kann den Beitrag nicht hässlich machen — sie kann
// ihn nur falsch befüllen, und auch das fängt die Prüfung ab.
//
// Bewusst kein Gestaltungswerkzeug. Ein Editor, in dem man Schriften wählen
// und Ebenen schieben kann, ist ein anderes, viel größeres Produkt — und für
// eine Tanzschule das falsche.
package vorlage

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"unicode/utf8"
)

// Feld ist ein von der Kundin zu füllendes Feld.
type Feld struct {
	Name          string `json:"name"`
	Beschriftung  string `json:"beschriftung"`
	Hinweis       string `json:"hinweis,omitempty"`
	Pflicht       bool   `json:"pflicht"`
	Hoechstlaenge int    `json:"hoechstlaenge"`
	Mehrzeilig    bool   `json:"mehrzeilig,omitempty"`
}

// Marke sind die festgelegten Gestaltungswerte. Sie stehen hier, damit die
// Vorschau sie zeichnen kann — nicht, damit jemand sie ändert.
type Marke struct {
	Grund        string `json:"grund"`
	Schriftfarbe string `json:"schriftfarbe"`
	Akzent       string `json:"akzent"`
	Zweitakzent  string `json:"zweitakzent"`
	Displayfont  string `json:"displayfont"`
	Textfont     string `json:"textfont"`
}

// Vorlage ist eine Gestaltungsvorlage für einen Kunden.
type Vorlage struct {
	ID      string `json:"id"`
	KundeID string `json:"kunde_id"`
	Name    string `json:"name"`
	Zweck   string `json:"zweck,omitempty"`
	Format  string `json:"format"` // "4:5", "1:1", "brief"
	Felder  []Feld `json:"felder"`
	Marke   Marke  `json:"marke"`
	// Aufbau setzt den Beitragstext je Kanal zusammen. Platzhalter sind die
	// Feldnamen in geschweiften Klammern. Fehlt ein Kanal, greift "standard".
	Aufbau      map[string]string `json:"aufbau"`
	BildPflicht bool              `json:"bild_pflicht,omitempty"`
}

// Hoechstlaengen je Kanal. Werte aus den Plattformdokumentationen; sie
// ändern sich selten, aber sie ändern sich. Zu lang abgeschnitten zu
// bekommen ist schlimmer als hier zu scheitern.
var Hoechstlaengen = map[string]int{
	"INSTAGRAM": 2200,
	"FACEBOOK":  63206,
	"LINKEDIN":  3000,
	"PINTEREST": 500,
	"GBP":       1500,
	"TIKTOK":    2200,
	"YOUTUBE":   5000,
}

// Fehler sammelt alle Beanstandungen auf einmal. Wer ein Formular ausfüllt,
// will nicht fünfmal hintereinander einen einzelnen Fehler vorgesetzt
// bekommen.
type Fehler struct {
	Feld    string
	Meldung string
}

func (f Fehler) Error() string { return f.Feld + ": " + f.Meldung }

// Fehlerliste ist die Sammlung.
type Fehlerliste []Fehler

func (l Fehlerliste) Error() string {
	teile := make([]string, len(l))
	for i, f := range l {
		teile[i] = f.Error()
	}
	return strings.Join(teile, "; ")
}

// ErrUnbekanntesFeld meldet ein Feld, das die Vorlage nicht kennt.
var ErrUnbekanntesFeld = errors.New("vorlage: unbekanntes Feld")

// Pruefe kontrolliert die Werte gegen die Vorlage.
//
// Unbekannte Felder werden abgewiesen, nicht ignoriert: wer etwas
// mitschickt, das die Vorlage nicht kennt, hat entweder einen Fehler
// gemacht oder versucht, an der Vorlage vorbeizuschreiben. Beides soll
// auffallen.
func (v Vorlage) Pruefe(werte map[string]string, bild string) error {
	var raus Fehlerliste

	bekannt := map[string]Feld{}
	for _, f := range v.Felder {
		bekannt[f.Name] = f
	}

	// Reihenfolge festhalten, damit Meldungen stabil sind.
	namen := make([]string, 0, len(werte))
	for n := range werte {
		namen = append(namen, n)
	}
	sort.Strings(namen)

	for _, n := range namen {
		if _, ok := bekannt[n]; !ok {
			raus = append(raus, Fehler{Feld: n, Meldung: "kennt diese Vorlage nicht"})
		}
	}

	for _, f := range v.Felder {
		wert := strings.TrimSpace(werte[f.Name])
		if f.Pflicht && wert == "" {
			raus = append(raus, Fehler{Feld: f.Name, Meldung: f.Beschriftung + " darf nicht leer bleiben"})
			continue
		}
		if f.Hoechstlaenge > 0 {
			if n := utf8.RuneCountInString(wert); n > f.Hoechstlaenge {
				raus = append(raus, Fehler{
					Feld:    f.Name,
					Meldung: fmt.Sprintf("%s ist %d Zeichen lang, erlaubt sind %d", f.Beschriftung, n, f.Hoechstlaenge),
				})
			}
		}
		if !f.Mehrzeilig && strings.ContainsAny(wert, "\r\n") {
			raus = append(raus, Fehler{Feld: f.Name, Meldung: f.Beschriftung + " ist einzeilig"})
		}
	}

	if v.BildPflicht && strings.TrimSpace(bild) == "" {
		raus = append(raus, Fehler{Feld: "bild", Meldung: "Diese Vorlage braucht ein Bild"})
	}

	if len(raus) == 0 {
		return nil
	}
	return raus
}

// Setze baut den Beitragstext für einen Kanal.
func (v Vorlage) Setze(kanal string, werte map[string]string) string {
	muster, ok := v.Aufbau[strings.ToUpper(kanal)]
	if !ok {
		muster = v.Aufbau["standard"]
	}
	if muster == "" {
		// Ohne Muster: Felder in ihrer Reihenfolge, leere übersprungen.
		var teile []string
		for _, f := range v.Felder {
			if w := strings.TrimSpace(werte[f.Name]); w != "" {
				teile = append(teile, w)
			}
		}
		return strings.Join(teile, "\n\n")
	}

	raus := muster
	for _, f := range v.Felder {
		raus = strings.ReplaceAll(raus, "{"+f.Name+"}", strings.TrimSpace(werte[f.Name]))
	}
	// Leere Platzhalter hinterlassen sonst Reihen aus Leerzeilen.
	return aufraeumen(raus)
}

// aufraeumen entfernt Leerzeilenketten und Rand.
func aufraeumen(s string) string {
	zeilen := strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n")
	var raus []string
	leerDavor := false
	for _, z := range zeilen {
		z = strings.TrimRight(z, " \t")
		if z == "" {
			if leerDavor || len(raus) == 0 {
				continue
			}
			leerDavor = true
			raus = append(raus, "")
			continue
		}
		leerDavor = false
		raus = append(raus, z)
	}
	for len(raus) > 0 && raus[len(raus)-1] == "" {
		raus = raus[:len(raus)-1]
	}
	return strings.Join(raus, "\n")
}

// PasstAufKanal prüft, ob der gesetzte Text auf einem Kanal zulässig ist.
func PasstAufKanal(kanal, text string) error {
	grenze, ok := Hoechstlaengen[strings.ToUpper(kanal)]
	if !ok {
		return nil
	}
	if n := utf8.RuneCountInString(text); n > grenze {
		return fmt.Errorf("der Text ist für %s zu lang: %d Zeichen, erlaubt sind %d", kanal, n, grenze)
	}
	return nil
}

// Finde sucht eine Vorlage in einer Liste.
func Finde(alle []Vorlage, id string) (Vorlage, bool) {
	for _, v := range alle {
		if v.ID == id {
			return v, true
		}
	}
	return Vorlage{}, false
}
