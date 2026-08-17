// Package serie macht aus einer Tabelle eine Serie von Codes.
//
// Der Unterschied zur Massenanlage ist das Muster. Wer 24 Tischcodes
// braucht, hat selten eine Spalte mit 24 fertigen Adressen — er hat
// eine Spalte „Tisch" mit den Zahlen 1 bis 24 und im Kopf die Regel
// „pnkt.me/nordwerk/t{Tisch}". Genau diese Regel steht hier.
//
// Die Muehe steckt nicht im Einsetzen, sondern im Pruefen davor: ein
// vertippter Spaltenname darf nicht 24 Codes ergeben, in denen woertlich
// „{Tsich}" steht. Deshalb wird ein Muster erst zerlegt und gegen die
// Kopfzeile gehalten, bevor eine einzige Zeile umgesetzt wird.
package serie

import (
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"unicode"
)

// Tabelle ist eine eingelesene CSV samt ihrer Kopfzeile.
type Tabelle struct {
	Spalten []string
	Zeilen  [][]string
}

// Lies nimmt eine CSV entgegen. Semikolon und Komma werden beide
// erkannt: deutsche Tabellenprogramme schreiben Semikolon, und wer die
// Datei aus Excel exportiert, weiss davon nichts.
func Lies(r io.Reader) (*Tabelle, error) {
	roh, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	text := strings.TrimPrefix(string(roh), "\ufeff") // BOM aus Excel
	if strings.TrimSpace(text) == "" {
		return nil, errors.New("die Datei ist leer")
	}

	leser := csv.NewReader(strings.NewReader(text))
	leser.FieldsPerRecord = -1
	leser.TrimLeadingSpace = true
	leser.Comma = trennzeichen(text)

	zeilen, err := leser.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("CSV nicht lesbar: %w", err)
	}
	if len(zeilen) < 2 {
		return nil, errors.New("erwartet werden eine Kopfzeile und mindestens eine Datenzeile")
	}

	t := &Tabelle{}
	for _, k := range zeilen[0] {
		t.Spalten = append(t.Spalten, strings.TrimSpace(k))
	}
	for _, z := range zeilen[1:] {
		if leer(z) {
			continue // Leerzeilen am Ende sind Alltag, kein Fehler
		}
		t.Zeilen = append(t.Zeilen, z)
	}
	if len(t.Zeilen) == 0 {
		return nil, errors.New("die Tabelle hat eine Kopfzeile, aber keine Daten")
	}
	return t, nil
}

// trennzeichen entscheidet zwischen Semikolon und Komma anhand der
// ersten Zeile. Wer beides mischt, bekommt das haeufigere.
func trennzeichen(text string) rune {
	erste := text
	if i := strings.IndexAny(text, "\r\n"); i >= 0 {
		erste = text[:i]
	}
	if strings.Count(erste, ";") > strings.Count(erste, ",") {
		return ';'
	}
	return ','
}

func leer(z []string) bool {
	for _, f := range z {
		if strings.TrimSpace(f) != "" {
			return false
		}
	}
	return true
}

// Wert liest ein Feld ueber seinen Spaltennamen, unabhaengig von der
// Schreibweise.
func (t *Tabelle) Wert(zeile []string, spalte string) (string, bool) {
	for i, s := range t.Spalten {
		if strings.EqualFold(s, spalte) {
			if i >= len(zeile) {
				return "", true // Spalte gibt es, Feld fehlt in dieser Zeile
			}
			return strings.TrimSpace(zeile[i]), true
		}
	}
	return "", false
}

// Platzhalter zaehlt die {Spalten} eines Musters auf, in der
// Reihenfolge ihres Auftretens und ohne Wiederholung.
func Platzhalter(muster string) []string {
	var aus []string
	gesehen := map[string]bool{}
	rest := muster
	for {
		auf := strings.Index(rest, "{")
		if auf < 0 {
			return aus
		}
		zu := strings.Index(rest[auf:], "}")
		if zu < 0 {
			return aus
		}
		name := strings.TrimSpace(rest[auf+1 : auf+zu])
		if name != "" && !gesehen[strings.ToLower(name)] {
			gesehen[strings.ToLower(name)] = true
			aus = append(aus, name)
		}
		rest = rest[auf+zu+1:]
	}
}

// PruefeMuster haelt ein Muster gegen die Kopfzeile. Der Fehler nennt
// den falschen Namen und die vorhandenen Spalten — eine Meldung
// „unbekannte Spalte" allein zwingt zum Raten.
func (t *Tabelle) PruefeMuster(muster string) error {
	if strings.TrimSpace(muster) == "" {
		return errors.New("ohne Muster gibt es kein Ziel")
	}
	if strings.Count(muster, "{") != strings.Count(muster, "}") {
		return errors.New("eine geschweifte Klammer ist nicht geschlossen")
	}
	var fehlen []string
	for _, p := range Platzhalter(muster) {
		if _, da := t.Wert(nil, p); !da {
			fehlen = append(fehlen, p)
		}
	}
	if len(fehlen) > 0 {
		sort.Strings(fehlen)
		return fmt.Errorf("die Tabelle hat keine Spalte %s — vorhanden sind: %s",
			strings.Join(fehlen, ", "), strings.Join(t.Spalten, ", "))
	}
	return nil
}

// Setze ersetzt die Platzhalter eines Musters mit den Werten einer
// Zeile. Leere Felder sind ein Fehler, kein leerer Einsatz: aus
// „t{Tisch}" wuerde sonst „t" — und zwei leere Zeilen ergaeben zweimal
// dasselbe Ziel.
func (t *Tabelle) Setze(muster string, zeile []string) (string, error) {
	aus := muster
	for _, p := range Platzhalter(muster) {
		wert, da := t.Wert(zeile, p)
		if !da {
			return "", fmt.Errorf("die Tabelle hat keine Spalte %q", p)
		}
		if wert == "" {
			return "", fmt.Errorf("das Feld %q ist in dieser Zeile leer", p)
		}
		sauber := wegtauglich(wert)
		if sauber == "" {
			// „!!!" oder „---" bleibt nach dem Saeubern nichts uebrig.
			// Das darf nicht still zu einem kuerzeren Ziel werden — der
			// Fehler nennt deshalb den Ausgangswert.
			return "", fmt.Errorf("aus dem Feld %q (%q) bleibt kein brauchbarer Wegteil", p, wert)
		}
		aus = strings.ReplaceAll(aus, "{"+p+"}", sauber)
	}
	return aus, nil
}

// wegtauglich entschaerft einen Wert fuer den Einsatz in einer Adresse.
// Es wird nicht prozentkodiert, sondern vereinfacht: ein Tischname
// „Terrasse Süd" soll „terrasse-sued" heissen und nicht
// „Terrasse%20S%C3%BCd". Wer eine gedruckte Adresse abtippen muss, ist
// dafuer dankbar.
func wegtauglich(s string) string {
	ersatz := strings.NewReplacer(
		"ä", "ae", "ö", "oe", "ü", "ue", "ß", "ss",
		"Ä", "Ae", "Ö", "Oe", "Ü", "Ue")
	s = ersatz.Replace(strings.TrimSpace(s))

	var b strings.Builder
	strich := false
	for _, r := range s {
		switch {
		case r < 128 && (unicode.IsLetter(r) || unicode.IsDigit(r)):
			b.WriteRune(unicode.ToLower(r))
			strich = false
		case r == '-' || r == '_' || r == '.' || r == '/':
			b.WriteRune(r)
			strich = false
		default:
			// Ein Trennstrich, nicht mehrere: „a  b" wird „a-b".
			if !strich && b.Len() > 0 {
				b.WriteByte('-')
				strich = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

// Posten ist eine umgesetzte Zeile.
type Posten struct {
	Nr      int    // Zeilennummer in der Datei, Kopfzeile ist 1
	Name    string // Beschriftung unter dem Code
	Ziel    string // wohin der Code fuehrt
	GTIN    string
	Ordner  string
	Fehler  string // gesetzt, wenn diese Zeile nicht umgesetzt werden konnte
	Ausgabe []string
}

// Zuordnung sagt, welche Spalte welche Rolle hat.
type Zuordnung struct {
	Muster     string // Ziel als Muster, etwa „pnkt.me/nordwerk/t{Tisch}"
	ZielSpalte string // oder eine Spalte mit fertigen Adressen
	NameSpalte string
	GTINSpalte string
	OrdnerFest string
}

// Setze wandelt die ganze Tabelle um. Fehlerhafte Zeilen bleiben in der
// Liste und tragen ihren Grund — eine Serie, die bei Zeile 7 abbricht,
// hilft niemandem, der wissen will, welche der 400 Zeilen krumm sind.
func (t *Tabelle) Umsetzen(z Zuordnung) ([]Posten, error) {
	if strings.TrimSpace(z.Muster) == "" && strings.TrimSpace(z.ZielSpalte) == "" {
		return nil, errors.New("entweder ein Muster oder eine Zielspalte")
	}
	if z.Muster != "" {
		if err := t.PruefeMuster(z.Muster); err != nil {
			return nil, err
		}
	}
	for _, name := range []string{z.ZielSpalte, z.NameSpalte, z.GTINSpalte} {
		if name == "" {
			continue
		}
		if _, da := t.Wert(nil, name); !da {
			return nil, fmt.Errorf("die Tabelle hat keine Spalte %q — vorhanden sind: %s",
				name, strings.Join(t.Spalten, ", "))
		}
	}

	var aus []Posten
	for i, zeile := range t.Zeilen {
		p := Posten{Nr: i + 2, Ordner: z.OrdnerFest}
		if z.NameSpalte != "" {
			p.Name, _ = t.Wert(zeile, z.NameSpalte)
		}
		if z.GTINSpalte != "" {
			p.GTIN, _ = t.Wert(zeile, z.GTINSpalte)
		}
		switch {
		case z.Muster != "":
			ziel, err := t.Setze(z.Muster, zeile)
			if err != nil {
				p.Fehler = err.Error()
			} else {
				p.Ziel = ziel
			}
		default:
			ziel, _ := t.Wert(zeile, z.ZielSpalte)
			if ziel == "" {
				p.Fehler = fmt.Sprintf("die Spalte %q ist in dieser Zeile leer", z.ZielSpalte)
			} else {
				p.Ziel = ziel
			}
		}
		p.Ausgabe = zeile
		aus = append(aus, p)
	}
	return aus, nil
}

// Doppelte findet Ziele, die mehr als einmal vorkommen. Zwei Tische
// mit demselben Code sind nicht zu unterscheiden, sobald die Zahlen
// eintreffen — und das faellt erst auf, wenn die Aufsteller stehen.
func Doppelte(posten []Posten) map[string][]int {
	nach := map[string][]int{}
	for _, p := range posten {
		if p.Ziel != "" {
			nach[p.Ziel] = append(nach[p.Ziel], p.Nr)
		}
	}
	for ziel, nummern := range nach {
		if len(nummern) < 2 {
			delete(nach, ziel)
		}
	}
	return nach
}
