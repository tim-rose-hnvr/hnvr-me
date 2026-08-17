// Package regel entscheidet, wohin ein Scan fuehrt.
//
// Die Form folgt der veroeffentlichten Schnittstelle: eine Liste, keine
// Zuordnung. Der Unterschied ist nicht kosmetisch — eine Liste hat eine
// Reihenfolge, und die erste zutreffende Regel gewinnt. Damit kann der
// Kunde selbst bestimmen, ob am Wochenende in Oesterreich die Wochenend-
// oder die Landesregel greift. Bei einer Zuordnung entschiede das
// Programm, und niemand koennte es vorhersagen.
//
//	{ "standard": "https://…",
//	  "zone": "Europe/Berlin",
//	  "regeln": [
//	    { "art": "land",    "werte": ["AT","CH"], "ziel": "…" },
//	    { "art": "zeit",    "tage": [6,7], "von": "00:00", "bis": "24:00", "ziel": "…" },
//	    { "art": "zeitraum","von": "2026-12-01", "bis": "2026-12-26", "ziel": "…" },
//	    { "art": "sprache", "werte": ["en"], "ziel": "…" },
//	    { "art": "geraet",  "werte": ["iphone","ipad"], "ziel": "…" }
//	  ] }
package regel

import (
	"strings"
	"time"
)

// Einzelregel ist ein Eintrag der Liste.
type Einzelregel struct {
	Art   string   `json:"art"`
	Werte []string `json:"werte,omitempty"`
	Tage  []int    `json:"tage,omitempty"` // 1 ist Montag, 7 ist Sonntag
	Von   string   `json:"von,omitempty"`
	Bis   string   `json:"bis,omitempty"`
	Ziel  string   `json:"ziel"`
}

// Werk ist das gesamte Regelwerk eines Codes.
type Werk struct {
	Standard string        `json:"standard"`
	Zone     string        `json:"zone,omitempty"`
	Regeln   []Einzelregel `json:"regeln,omitempty"`
}

// Umstand beschreibt den einzelnen Scan.
type Umstand struct {
	Jetzt   time.Time
	Land    string
	Sprache string
	Geraet  string
}

// Ergebnis nennt das Ziel und die Regel, die gegriffen hat. Der Grund
// gehoert in die Antwort, weil sonst niemand nachvollziehen kann, warum
// ein Scan irgendwo gelandet ist.
type Ergebnis struct {
	Ziel  string
	Grund string
	Nr    int
}

// Waehle geht die Liste von oben nach unten durch. Die erste zutreffende
// Regel gewinnt; trifft keine, gilt der Standard.
func Waehle(w Werk, u Umstand) Ergebnis {
	jetzt := u.Jetzt
	if jetzt.IsZero() {
		jetzt = time.Now()
	}
	if w.Zone != "" {
		if ort, err := time.LoadLocation(w.Zone); err == nil {
			jetzt = jetzt.In(ort)
		}
	}

	for i, r := range w.Regeln {
		if r.Ziel == "" {
			continue
		}
		if trifft(r, u, jetzt) {
			return Ergebnis{Ziel: r.Ziel, Grund: r.Art, Nr: i + 1}
		}
	}
	return Ergebnis{Ziel: w.Standard, Grund: "standard"}
}

func trifft(r Einzelregel, u Umstand, jetzt time.Time) bool {
	switch strings.ToLower(r.Art) {
	case "land":
		return enthaelt(r.Werte, u.Land)

	case "sprache":
		kurz := u.Sprache
		if len(kurz) > 2 {
			kurz = kurz[:2]
		}
		return enthaelt(r.Werte, kurz)

	case "geraet":
		return enthaelt(r.Werte, u.Geraet)

	case "zeit":
		// Wochentage und Tageszeit, in der Zone des Kunden.
		if len(r.Tage) > 0 {
			heute := int(jetzt.Weekday())
			if heute == 0 {
				heute = 7 // Sonntag zaehlt als siebter Tag, nicht als nullter
			}
			gefunden := false
			for _, t := range r.Tage {
				if t == heute {
					gefunden = true
					break
				}
			}
			if !gefunden {
				return false
			}
		}
		return inTageszeit(r.Von, r.Bis, jetzt)

	case "zeitraum":
		von, fehlerVon := time.ParseInLocation("2006-01-02", r.Von, jetzt.Location())
		bis, fehlerBis := time.ParseInLocation("2006-01-02", r.Bis, jetzt.Location())
		if r.Von != "" && fehlerVon == nil && jetzt.Before(von) {
			return false
		}
		// Der letzte Tag zaehlt ganz mit — wer bis zum 26. schaltet,
		// meint den 26. einschliesslich.
		if r.Bis != "" && fehlerBis == nil && jetzt.After(bis.AddDate(0, 0, 1)) {
			return false
		}
		return r.Von != "" || r.Bis != ""
	}
	return false
}

// inTageszeit prueft die Uhrzeit. 24:00 ist als Ende erlaubt und meint
// das Ende des Tages — sonst faellt die letzte Minute heraus.
func inTageszeit(von, bis string, jetzt time.Time) bool {
	if von == "" && bis == "" {
		return true
	}
	minute := jetzt.Hour()*60 + jetzt.Minute()
	a, gutA := minuten(von)
	b, gutB := minuten(bis)
	if gutA && minute < a {
		return false
	}
	if gutB && minute > b {
		return false
	}
	return true
}

func minuten(s string) (int, bool) {
	teile := strings.Split(strings.TrimSpace(s), ":")
	if len(teile) != 2 {
		return 0, false
	}
	h, m := zahl(teile[0]), zahl(teile[1])
	if h < 0 || m < 0 {
		return 0, false
	}
	return h*60 + m, true
}

func zahl(s string) int {
	n := 0
	for _, r := range strings.TrimSpace(s) {
		if r < '0' || r > '9' {
			return -1
		}
		n = n*10 + int(r-'0')
	}
	return n
}

func enthaelt(werte []string, gesucht string) bool {
	if gesucht == "" {
		return false
	}
	for _, w := range werte {
		if strings.EqualFold(strings.TrimSpace(w), gesucht) {
			return true
		}
	}
	return false
}

// Kampagne haengt die Kampagnenparameter an. Platzhalter werden dabei
// aus dem Scan gefuellt — {land}, {geraet}, {sprache}, {kuerzel}, {tag}.
// So kann ein einziger gedruckter Code auswerten, aus welchem Land er
// gescannt wurde, ohne dass dafuer etwas Persoenliches gespeichert wird.
func Kampagne(ziel string, utm map[string]string, u Umstand, kuerzel string) string {
	if len(utm) == 0 {
		return ziel
	}
	jetzt := u.Jetzt
	if jetzt.IsZero() {
		jetzt = time.Now()
	}
	fuellen := strings.NewReplacer(
		"{land}", oder(u.Land, "xx"),
		"{geraet}", oder(u.Geraet, "unbekannt"),
		"{sprache}", oder(u.Sprache, "xx"),
		"{kuerzel}", kuerzel,
		"{tag}", jetzt.Format("2006-01-02"),
	)

	vorhanden := ""
	if i := strings.Index(ziel, "?"); i >= 0 {
		vorhanden = ziel[i+1:]
	}
	var neu []string
	// Feste Reihenfolge, damit dieselbe Eingabe immer dieselbe Adresse
	// ergibt — sonst sind Auswertungen nicht vergleichbar.
	for _, k := range []string{"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"} {
		wert := utm[k]
		if wert == "" {
			wert = utm[strings.TrimPrefix(k, "utm_")]
		}
		if wert == "" || strings.Contains(vorhanden, k+"=") {
			continue
		}
		neu = append(neu, k+"="+beschraenke(fuellen.Replace(wert)))
	}
	if len(neu) == 0 {
		return ziel
	}
	trenner := "?"
	if vorhanden != "" {
		trenner = "&"
	}
	return ziel + trenner + strings.Join(neu, "&")
}

// beschraenke laesst nur Zeichen durch, die in einer Adresse gefahrlos
// stehen. Alles andere wird zu einem Bindestrich.
func beschraenke(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9',
			r == '-', r == '_', r == '.', r == '~':
			b.WriteRune(r)
		default:
			b.WriteByte('-')
		}
	}
	return b.String()
}

func oder(wert, ersatz string) string {
	if strings.TrimSpace(wert) == "" {
		return ersatz
	}
	return wert
}
