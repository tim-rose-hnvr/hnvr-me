package speicher

import (
	"sort"
	"strconv"
	"strings"
	"time"
)

// Die Uebersicht fasst die Tageszaehler einer Organisation zusammen.
//
// Sie rechnet nur aus, was ohnehin schon dasteht. Es entsteht keine
// neue Aufzeichnung, keine Sitzung, kein Merkmal je Person — die
// Tageszaehler halten Klassen, und mehr gibt es hier auch nicht zu
// holen. Was nicht entsteht, kann spaeter niemand verlangen.
//
// Die zweite Regel steht weiter unten in `Aussage`: aus zwoelf Scans
// wird keine beste Zeit abgeleitet. Ein Satz wie „Samstagmittag ist
// deine beste Zeit" ist bei kleiner Zahl geraten, und geraten sieht
// genauso aus wie gemessen.

// Tagwert ist ein Tag der Zeitreihe.
type Tagwert struct {
	Tag   string `json:"tag"` // 2006-01-02
	Scans int    `json:"scans"`
}

// Klassenwert ist eine Auspraegung einer Klasse, etwa geraet:mobil.
type Klassenwert struct {
	Wert  string `json:"wert"`
	Scans int    `json:"scans"`
}

// Codewert ist eine Zeile der Codetabelle.
type Codewert struct {
	ID      string `json:"id"`
	Kuerzel string `json:"kuerzel"`
	Name    string `json:"name"`
	Ordner  string `json:"ordner,omitempty"`
	Ziel    string `json:"ziel"`
	Scans   int    `json:"scans"`
	Aktiv   bool   `json:"aktiv"`
}

// Uebersicht ist das ganze Bild eines Zeitraums.
type Uebersicht struct {
	Von     string                   `json:"von"`
	Bis     string                   `json:"bis"`
	Tage    []Tagwert                `json:"tage"`
	Klassen map[string][]Klassenwert `json:"klassen"`
	Codes   []Codewert               `json:"codes"`
	Gesamt  int                      `json:"gesamt"`
	// Ohne Scans im Zeitraum: wie viele Codes es ueberhaupt gibt.
	CodesGesamt int    `json:"codesGesamt"`
	CodesStumm  int    `json:"codesStumm"`
	Aussage     string `json:"aussage"`
}

// Uebersicht rechnet den Zeitraum [von, bis] einer Organisation aus.
// Beide Tage zaehlen mit.
func (s *Speicher) Uebersicht(orgID string, von, bis time.Time) Uebersicht {
	vonTag := von.UTC().Format("2006-01-02")
	bisTag := bis.UTC().Format("2006-01-02")

	s.mu.RLock()
	defer s.mu.RUnlock()

	// Erst die eigenen Codes bestimmen. Ein Zaehler ohne zugehoerigen
	// Code der Organisation geht niemanden etwas an — sonst liesse sich
	// ueber die Uebersicht auslesen, was andere Kunden auf demselben
	// Server treiben.
	eigen := map[string]*Code{}
	for _, c := range s.codes {
		if c.KontoID == orgID && !c.Geloescht {
			eigen[c.ID] = c
		}
	}

	jeTag := map[string]int{}
	jeCode := map[string]int{}
	jeKlasse := map[string]map[string]int{}
	// stundeJeWochentag[Wochentag][Stunde] fuer die Aussage.
	stundeJeWochentag := map[time.Weekday]map[int]int{}
	gesamt := 0

	for _, z := range s.zaehler {
		if _, meins := eigen[z.CodeID]; !meins {
			continue
		}
		if z.Tag < vonTag || z.Tag > bisTag {
			continue
		}
		jeTag[z.Tag] += z.Gesamt
		jeCode[z.CodeID] += z.Gesamt
		gesamt += z.Gesamt

		tag, err := time.Parse("2006-01-02", z.Tag)
		for name, n := range z.Zaehler {
			art, wert, gut := strings.Cut(name, ":")
			if !gut {
				continue
			}
			if art == "stunde" {
				if err == nil {
					std, sErr := strconv.Atoi(wert)
					if sErr == nil {
						if stundeJeWochentag[tag.Weekday()] == nil {
							stundeJeWochentag[tag.Weekday()] = map[int]int{}
						}
						stundeJeWochentag[tag.Weekday()][std] += n
					}
				}
				continue
			}
			if jeKlasse[art] == nil {
				jeKlasse[art] = map[string]int{}
			}
			jeKlasse[art][wert] += n
		}
	}

	u := Uebersicht{
		Von: vonTag, Bis: bisTag, Gesamt: gesamt,
		Klassen: map[string][]Klassenwert{}, CodesGesamt: len(eigen),
	}

	// Die Zeitreihe traegt jeden Tag, auch die leeren. Eine Reihe, die
	// nur die Tage mit Scans enthaelt, zeigt einen Verlauf, den es nie
	// gab: aus drei Tagen mit je einem Scan wird eine gerade Linie.
	for t := von.UTC().Truncate(24 * time.Hour); !t.After(bis.UTC()); t = t.AddDate(0, 0, 1) {
		tag := t.Format("2006-01-02")
		u.Tage = append(u.Tage, Tagwert{Tag: tag, Scans: jeTag[tag]})
	}

	for art, werte := range jeKlasse {
		var liste []Klassenwert
		for wert, n := range werte {
			liste = append(liste, Klassenwert{Wert: wert, Scans: n})
		}
		sort.Slice(liste, func(i, j int) bool {
			if liste[i].Scans != liste[j].Scans {
				return liste[i].Scans > liste[j].Scans
			}
			return liste[i].Wert < liste[j].Wert
		})
		u.Klassen[art] = liste
	}

	for id, c := range eigen {
		if jeCode[id] == 0 {
			u.CodesStumm++
		}
		u.Codes = append(u.Codes, Codewert{
			ID: id, Kuerzel: c.Kuerzel, Name: c.Name, Ordner: c.Ordner,
			Ziel: c.Ziel, Scans: jeCode[id], Aktiv: c.Aktiv,
		})
	}
	sort.Slice(u.Codes, func(i, j int) bool {
		if u.Codes[i].Scans != u.Codes[j].Scans {
			return u.Codes[i].Scans > u.Codes[j].Scans
		}
		return u.Codes[i].Kuerzel < u.Codes[j].Kuerzel
	})

	u.Aussage = Aussage(u, stundeJeWochentag)
	return u
}

// MindestScansFuerZeitaussage ist die Schwelle, unter der keine beste
// Zeit genannt wird.
//
// Der Wert ist eine Setzung, kein Messergebnis: bei 60 Scans auf sieben
// Wochentage und 24 Stunden liegt der haeufigste Kasten im Mittel bei
// etwa 0,4 — jede Spitze darin ist Zufall. Lieber kein Satz als ein
// falscher: nach dem Satz „Samstagmittag ist deine beste Zeit" wird ein
// Werbebudget verschoben.
const MindestScansFuerZeitaussage = 60

var wochentage = [...]string{"Sonntag", "Montag", "Dienstag", "Mittwoch",
	"Donnerstag", "Freitag", "Samstag"}

// Aussage schreibt den Satz, der ueber dem Dashboard steht.
func Aussage(u Uebersicht, stundeJeWochentag map[time.Weekday]map[int]int) string {
	if u.CodesGesamt == 0 {
		return "Noch kein Code angelegt."
	}
	if u.Gesamt == 0 {
		return "In diesem Zeitraum wurde kein Code gescannt."
	}

	satz := zahlDeutsch(u.Gesamt) + " Scans"
	if len(u.Tage) > 1 {
		satz += " in " + strconv.Itoa(len(u.Tage)) + " Tagen"
	}
	if len(u.Codes) > 0 && u.Codes[0].Scans > 0 {
		bester := u.Codes[0].Name
		if bester == "" {
			bester = u.Codes[0].Kuerzel
		}
		anteil := u.Codes[0].Scans * 100 / u.Gesamt
		if anteil >= 25 && len(u.Codes) > 1 {
			// Hier stehen Umlaute, anders als in den Fehlermeldungen des
			// Programms: dieser Satz ist keine Meldung, sondern die
			// Ueberschrift der Seite. „traegt" in 25 Punkt Caprasimo
			// sieht nach Panne aus.
			satz += " — " + bester + " allein trägt " + strconv.Itoa(anteil) + " Prozent"
		}
	}

	if u.Gesamt >= MindestScansFuerZeitaussage {
		if tag, stunde, n := spitze(stundeJeWochentag); n > 0 {
			satz += ", am meisten " + wochentage[tag] + " gegen " +
				strconv.Itoa(stunde) + " Uhr"
		}
	}
	return satz + "."
}

// spitze findet den staerksten Kasten aus Wochentag und Stunde.
func spitze(m map[time.Weekday]map[int]int) (time.Weekday, int, int) {
	besterTag, besteStunde, best := time.Sunday, 0, 0
	for tag, stunden := range m {
		for std, n := range stunden {
			// Gleichstand geht an den frueheren Tag und die fruehere
			// Stunde, damit dieselben Daten immer denselben Satz ergeben.
			if n > best || (n == best && n > 0 && (tag < besterTag ||
				(tag == besterTag && std < besteStunde))) {
				besterTag, besteStunde, best = tag, std, n
			}
		}
	}
	return besterTag, besteStunde, best
}

// zahlDeutsch setzt den Tausenderpunkt.
func zahlDeutsch(n int) string {
	s := strconv.Itoa(n)
	if n < 0 {
		return s
	}
	var b strings.Builder
	for i, z := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteRune(z)
	}
	return b.String()
}
