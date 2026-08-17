// Package uebernahme holt einen bestehenden Bestand aus dem
// Wix-Datenspeicher von PUNKT in die eigene Ablage.
//
// Zwei Regeln bestimmen den Aufbau:
//
// Erstens laeuft jede Uebernahme zuerst trocken. Der Bericht entsteht
// vollstaendig, bevor eine Zeile geschrieben wird — wer erst beim
// Schreiben merkt, dass ein Kuerzel doppelt ist, hat den halben Bestand
// schon drin. Der Trockenlauf ist deshalb nicht die Ausnahme, sondern
// der Normalfall; Schreiben ist die Ausnahme.
//
// Zweitens wird nichts erfunden. Was die Quelle nicht hergibt — eine
// Tagesverteilung der Scans, ein Passwort im Klartext, der Name eines
// geloeschten Ordners — steht als Befund im Bericht und nicht als
// hilfreiche Schaetzung in den Daten.
package uebernahme

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"pnkt.me/pnkt/speicher"
)

// Zeile ist eine Zeile aus einer Wix-Sammlung, so wie sie in der Antwort
// der Datenschnittstelle unter "data" steht.
type Zeile map[string]any

// Quelle ist der gesamte Bestand, nach Sammlungen getrennt.
type Quelle struct {
	Codes      []Zeile
	Ordner     []Zeile
	Konten     []Zeile
	Mitglieder []Zeile
	Ereignisse []Zeile
}

// Befund ist eine Auffaelligkeit an einer Zeile. Schwere ist "hinweis",
// "warnung" oder "fehler"; nur ein Fehler heisst, dass die Zeile nicht
// uebernommen wird.
type Befund struct {
	Sammlung string `json:"sammlung"`
	Kennung  string `json:"kennung"`
	Schwere  string `json:"schwere"`
	Text     string `json:"text"`
}

// Bericht ist das Ergebnis eines Laufs.
type Bericht struct {
	Trocken   bool              `json:"trocken"`
	Gezaehlt  map[string]int    `json:"gezaehlt"` // je Sammlung: gelesen
	Genommen  map[string]int    `json:"genommen"` // je Sammlung: uebernommen
	Befunde   []Befund          `json:"befunde"`
	Kuerzel   []string          `json:"kuerzel"` // die uebernommenen Kurzadressen
	Scans     int               `json:"scans"`   // Klumpenzahlen aus der Quelle
	Zeitpunkt time.Time         `json:"zeitpunkt"`
	Codes     []*speicher.Code  `json:"-"`
	Konten    []*speicher.Konto `json:"-"`
}

func (b *Bericht) melde(sammlung, kennung, schwere, text string) {
	b.Befunde = append(b.Befunde, Befund{sammlung, kennung, schwere, text})
}

// Fehler zaehlt die Befunde, die eine Zeile gekostet haben.
func (b *Bericht) Fehler() int {
	n := 0
	for _, f := range b.Befunde {
		if f.Schwere == "fehler" {
			n++
		}
	}
	return n
}

// Lies holt die Zeilen aus einer Antwort der Wix-Datenschnittstelle.
// Erwartet wird die Form {"dataItems":[{"data":{…}}]}; eine blanke Liste
// von Objekten geht ebenfalls, denn so sieht ein Ausfuhrlauf von Hand aus.
func Lies(roh []byte) ([]Zeile, error) {
	var huelle struct {
		DataItems []struct {
			ID   string `json:"id"`
			Data Zeile  `json:"data"`
		} `json:"dataItems"`
	}
	if err := json.Unmarshal(roh, &huelle); err == nil && huelle.DataItems != nil {
		aus := make([]Zeile, 0, len(huelle.DataItems))
		for _, e := range huelle.DataItems {
			z := e.Data
			if z == nil {
				z = Zeile{}
			}
			if _, da := z["_id"]; !da && e.ID != "" {
				z["_id"] = e.ID
			}
			aus = append(aus, z)
		}
		return aus, nil
	}

	var blank []Zeile
	if err := json.Unmarshal(roh, &blank); err != nil {
		return nil, fmt.Errorf("weder dataItems noch eine Liste von Objekten: %w", err)
	}
	return blank, nil
}

// --- Lesehilfen ----------------------------------------------------------

func text(z Zeile, schluessel string) string {
	wert, da := z[schluessel]
	if !da || wert == nil {
		return ""
	}
	if s, gut := wert.(string); gut {
		return strings.TrimSpace(s)
	}
	return ""
}

func wahr(z Zeile, schluessel string) bool {
	b, _ := z[schluessel].(bool)
	return b
}

func ganz(z Zeile, schluessel string) int {
	if f, gut := z[schluessel].(float64); gut {
		return int(f)
	}
	return 0
}

// zeit liest eine Zeitangabe. Wix schreibt sie mal als Zeichenkette, mal
// als {"$date": …} — beides kommt in derselben Sammlung vor.
func zeit(z Zeile, schluessel string) (time.Time, bool) {
	switch wert := z[schluessel].(type) {
	case string:
		t, err := time.Parse(time.RFC3339, wert)
		return t.UTC(), err == nil
	case map[string]any:
		if s, gut := wert["$date"].(string); gut {
			t, err := time.Parse(time.RFC3339, s)
			return t.UTC(), err == nil
		}
	}
	return time.Time{}, false
}

// jsonFeld liest ein Feld, das in Wix als Zeichenkette mit JSON darin
// liegt. Genau hier gehen Uebernahmen sonst schief: `regelnJson` ist Text,
// `regeln` ist eine Struktur, und wer das verwechselt, bekommt ein
// Regelwerk, das aus einer einzigen Zeichenkette besteht.
func jsonFeld(z Zeile, schluessel string) (map[string]any, error) {
	roh := text(z, schluessel)
	if roh == "" {
		return nil, nil
	}
	var wert map[string]any
	if err := json.Unmarshal([]byte(roh), &wert); err != nil {
		return nil, err
	}
	return wert, nil
}

// --- Der Lauf ------------------------------------------------------------

// Fuehre wandelt die Quelle um und schreibt sie, wenn trocken false ist.
// Der Bericht entsteht in beiden Faellen gleich — der Trockenlauf sagt
// also wirklich voraus, was der echte tun wird.
func Fuehre(q Quelle, ablage *speicher.Speicher, trocken bool) *Bericht {
	b := &Bericht{
		Trocken:   trocken,
		Gezaehlt:  map[string]int{},
		Genommen:  map[string]int{},
		Zeitpunkt: time.Now().UTC(),
	}

	ordnerNamen := ordnerVerzeichnis(q.Ordner, b)
	konten := nimmKonten(q.Konten, ablage, trocken, b)
	nimmMitglieder(q.Mitglieder, konten, ablage, trocken, b)
	nimmCodes(q.Codes, ordnerNamen, ablage, trocken, b)
	nimmEreignisse(q.Ereignisse, ablage, trocken, b)

	sort.Strings(b.Kuerzel)
	return b
}

// ordnerVerzeichnis macht aus den Ordnerzeilen eine Zuordnung Kennung →
// Name. Codes zeigen in Wix auf eine Ordnerkennung; hier traegt der Code
// den Namen selbst. Das ist die einzige Stelle, an der die Uebernahme die
// Form aendert und nicht nur die Ablage.
func ordnerVerzeichnis(zeilen []Zeile, b *Bericht) map[string]string {
	b.Gezaehlt["ordner"] = len(zeilen)
	aus := map[string]string{}
	for _, z := range zeilen {
		id := text(z, "_id")
		name := text(z, "name")
		if id == "" || name == "" {
			b.melde("ordner", id, "warnung", "Ordner ohne Kennung oder Namen — Codes darin bleiben ohne Ordner")
			continue
		}
		aus[id] = name
		b.Genommen["ordner"]++
	}
	return aus
}

func nimmKonten(zeilen []Zeile, ablage *speicher.Speicher, trocken bool, b *Bericht) map[string]*speicher.Konto {
	b.Gezaehlt["konten"] = len(zeilen)
	nachMail := map[string]*speicher.Konto{}

	for _, z := range zeilen {
		id := text(z, "_id")
		mail := strings.ToLower(text(z, "mail"))
		if id == "" || mail == "" {
			b.melde("konten", id, "fehler", "Konto ohne Kennung oder E-Mail")
			continue
		}

		salz, abdruck, gut := zerlegeAbdruck(text(z, "pwHash"))
		if !gut {
			b.melde("konten", mail, "fehler",
				"Passwortabdruck nicht in der Form pbkdf2$210000$salz$abdruck")
			continue
		}

		k := &speicher.Konto{
			ID: id, Name: text(z, "name"), Mail: mail,
			Salz: salz, Abdruck: abdruck,
			Rolle:      speicher.RolleInhaber,
			Fehlgriffe: ganz(z, "fehlversuche"),
		}
		if t, da := zeit(z, "erstellt"); da {
			k.Erstellt = t
		}
		if t, da := zeit(z, "gesperrtBis"); da {
			k.GesperrtBis = &t
		}

		if !trocken {
			if err := ablage.UebernimmKonto(k); err != nil {
				b.melde("konten", mail, "fehler", err.Error())
				continue
			}
		}
		nachMail[mail] = k
		b.Konten = append(b.Konten, k)
		b.Genommen["konten"]++
	}

	if len(zeilen) > 0 {
		b.melde("konten", "", "hinweis",
			"Passwoerter sind uebernommen, nicht neu gesetzt: gleiches Verfahren, "+
				"gleiche Rundenzahl, gleiches Salz. Eine einzige Anmeldung bestaetigt das; "+
				"scheitert sie, liegt es am Salz und die Passwoerter muessen neu gesetzt werden.")
	}
	return nachMail
}

// zerlegeAbdruck liest pbkdf2$210000$salz$abdruck.
func zerlegeAbdruck(roh string) (salz, abdruck string, gut bool) {
	teile := strings.Split(roh, "$")
	if len(teile) != 4 || teile[0] != "pbkdf2" || teile[1] != "210000" {
		return "", "", false
	}
	if teile[2] == "" || teile[3] == "" {
		return "", "", false
	}
	return teile[2], teile[3], true
}

// nimmMitglieder haengt Mitarbeitende an ihre Organisation. In Wix steht
// dort nur eine E-Mail; gibt es dazu kein Konto, laesst sich die Person
// nicht binden — und das ist ein Befund, keine stille Auslassung.
func nimmMitglieder(zeilen []Zeile, konten map[string]*speicher.Konto,
	ablage *speicher.Speicher, trocken bool, b *Bericht) {
	b.Gezaehlt["mitglieder"] = len(zeilen)

	for _, z := range zeilen {
		mail := strings.ToLower(text(z, "mail"))
		org := text(z, "kontoId")
		rolle := text(z, "rolle")

		k, da := konten[mail]
		if !da {
			b.melde("mitglieder", mail, "warnung",
				"zu dieser E-Mail gibt es kein Konto — die Person legt sich selbst eines an, "+
					"danach holt der Inhaber sie herein")
			continue
		}
		switch rolle {
		case speicher.RolleRedakteur, speicher.RolleLeser:
		default:
			b.melde("mitglieder", mail, "warnung",
				fmt.Sprintf("unbekannte Rolle %q — uebernommen als Leser", rolle))
			rolle = speicher.RolleLeser
		}

		k.GehoertZu, k.Rolle = org, rolle
		if !trocken {
			if err := ablage.UebernimmKonto(k); err != nil {
				b.melde("mitglieder", mail, "fehler", err.Error())
				continue
			}
		}
		b.Genommen["mitglieder"]++
	}
}

func nimmCodes(zeilen []Zeile, ordnerNamen map[string]string,
	ablage *speicher.Speicher, trocken bool, b *Bericht) {
	b.Gezaehlt["codes"] = len(zeilen)

	// Doppelte Kuerzel innerhalb der Quelle selbst faengt der Speicher
	// nur beim echten Lauf ab. Im Trockenlauf muessen sie hier auffallen,
	// sonst meldet er alles gruen und der echte Lauf bricht.
	gesehen := map[string]string{}

	for _, z := range zeilen {
		id := text(z, "_id")
		kuerzel := text(z, "kuerzel")
		if id == "" {
			b.melde("codes", kuerzel, "fehler", "Zeile ohne Kennung")
			continue
		}
		if kuerzel == "" {
			b.melde("codes", id, "fehler",
				"Zeile ohne Kuerzel — sie waere ueber keine Adresse erreichbar")
			continue
		}
		if frueher, doppelt := gesehen[strings.ToLower(kuerzel)]; doppelt {
			b.melde("codes", kuerzel, "fehler",
				"dieses Kuerzel steht schon in Zeile "+frueher+" — bei gedruckten Codes nicht reparierbar")
			continue
		}

		c := &speicher.Code{
			ID: id, Kuerzel: kuerzel,
			KontoID: text(z, "kontoId"),
			Name:    text(z, "name"),
			Typ:     text(z, "typ"),
			Ziel:    text(z, "ziel"),
			GTIN:    text(z, "gtin"),
			Aktiv:   wahr(z, "aktiv"),
			Fassung: 1,
		}
		if ordnerID := text(z, "ordnerId"); ordnerID != "" {
			name, da := ordnerNamen[ordnerID]
			if !da {
				b.melde("codes", kuerzel, "warnung",
					"der Ordner "+ordnerID+" fehlt in der Quelle — der Code kommt ohne Ordner an")
			}
			c.Ordner = name
		}
		if t, da := zeit(z, "erstellt"); da {
			c.Erstellt = t
		}
		if t, da := zeit(z, "geaendert"); da {
			c.Geaendert = t
		}

		for _, paar := range []struct {
			feld string
			ziel *map[string]any
		}{
			{"regelnJson", &c.Regeln},
			{"stilJson", &c.Stil},
			{"inhaltJson", &c.Inhalt},
		} {
			wert, err := jsonFeld(z, paar.feld)
			if err != nil {
				b.melde("codes", kuerzel, "warnung",
					paar.feld+" ist kein gueltiges JSON und bleibt leer: "+err.Error())
				continue
			}
			*paar.ziel = wert
		}
		if utm, err := jsonFeld(z, "utmJson"); err == nil && utm != nil {
			c.UTM = map[string]string{}
			for k, v := range utm {
				if s, gut := v.(string); gut {
					c.UTM[k] = s
				}
			}
		}
		c.Herkunft = "wix"

		if c.Ziel == "" && c.Regeln == nil {
			b.melde("codes", kuerzel, "warnung",
				"weder Ziel noch Regelwerk — der Code fuehrt nirgendwohin")
		}

		if !trocken {
			if err := ablage.Uebernimm(c); err != nil {
				b.melde("codes", kuerzel, "fehler", err.Error())
				continue
			}
		}
		gesehen[strings.ToLower(kuerzel)] = kuerzel
		b.Codes = append(b.Codes, c)
		b.Kuerzel = append(b.Kuerzel, kuerzel)
		b.Genommen["codes"]++

		// Die Gesamtzahl der Scans laesst sich nicht auf Tage verteilen.
		// Sie kommt als eine Zeile herein, erkennbar an ihrer Klasse.
		if scans := ganz(z, "scans"); scans > 0 {
			b.Scans += scans
			tag := c.Erstellt
			if tag.IsZero() {
				tag = b.Zeitpunkt
			}
			if !trocken {
				_ = ablage.UebernimmZaehler(&speicher.Tageszaehler{
					CodeID: c.ID, Tag: tag.UTC().Format("2006-01-02"),
					Gesamt:  scans,
					Zaehler: map[string]int{"herkunft:uebernahme": scans},
				})
			}
		}
	}

	if b.Scans > 0 {
		b.melde("codes", "", "hinweis", fmt.Sprintf(
			"%d Scans kamen als Gesamtzahl ohne Tage und Klassen. Sie stehen je Code "+
				"als eine Zeile unter „herkunft:uebernahme\" am Anlagetag — eine erfundene "+
				"Tagesverteilung waere schlimmer als eine ehrliche Klumpenzahl.", b.Scans))
	}
}

func nimmEreignisse(zeilen []Zeile, ablage *speicher.Speicher, trocken bool, b *Bericht) {
	b.Gezaehlt["ereignisse"] = len(zeilen)

	for _, z := range zeilen {
		e := speicher.Ereignis{
			KontoID:    text(z, "kontoId"),
			Wer:        text(z, "wer"),
			Was:        text(z, "was"),
			Gegenstand: text(z, "gegenstand"),
			Alt:        text(z, "altJson"),
			Neu:        text(z, "neuJson"),
		}
		if t, da := zeit(z, "zeit"); da {
			e.Zeit = t
		}
		if e.Was == "" {
			b.melde("ereignisse", e.Gegenstand, "warnung", "Eintrag ohne Vorgang — uebergangen")
			continue
		}
		if !trocken {
			if err := ablage.Protokolliere(e); err != nil {
				b.melde("ereignisse", e.Gegenstand, "fehler", err.Error())
				continue
			}
		}
		b.Genommen["ereignisse"]++
	}
}

// VerwaisteKuerzel nennt die Kurzadressen, die im Protokoll als geloescht
// stehen und in den Codes fehlen.
//
// Das ist der wichtigste Befund einer Uebernahme aus einem System, das
// beim Loeschen wirklich loescht: Diese Kuerzel sind dort wieder frei und
// koennen erneut vergeben werden — obwohl sie auf Papier stehen. Hier
// werden sie gesperrt uebernommen, damit das nicht passiert.
func VerwaisteKuerzel(q Quelle) []string {
	lebendig := map[string]bool{}
	for _, z := range q.Codes {
		if k := text(z, "kuerzel"); k != "" {
			lebendig[strings.ToLower(k)] = true
		}
	}

	gesehen := map[string]bool{}
	var aus []string
	for _, z := range q.Ereignisse {
		if text(z, "was") != "code.geloescht" {
			continue
		}
		wert, err := jsonFeld(z, "altJson")
		if err != nil || wert == nil {
			continue
		}
		k, gut := wert["kuerzel"].(string)
		if !gut || k == "" || lebendig[strings.ToLower(k)] || gesehen[strings.ToLower(k)] {
			continue
		}
		gesehen[strings.ToLower(k)] = true
		aus = append(aus, k)
	}
	sort.Strings(aus)
	return aus
}

// SperreVerwaiste traegt die verwaisten Kuerzel als geloeschte Codes ein.
// Sie tauchen in keiner Liste auf, aber ihr Kuerzel ist belegt — und ein
// Scan bekommt eine lesbare Seite statt „unbekannt".
func SperreVerwaiste(q Quelle, kontoID string, ablage *speicher.Speicher, trocken bool, b *Bericht) {
	verwaist := VerwaisteKuerzel(q)
	b.Gezaehlt["verwaist"] = len(verwaist)
	if len(verwaist) == 0 {
		return
	}

	for _, k := range verwaist {
		c := &speicher.Code{
			ID: "verwaist-" + strings.ToLower(k), Kuerzel: k, KontoID: kontoID,
			Name:      "Geloescht vor der Uebernahme",
			Aktiv:     false,
			Herkunft:  "wix",
			Geloescht: true,
			Erstellt:  b.Zeitpunkt,
		}
		if !trocken {
			if err := ablage.Uebernimm(c); err != nil {
				b.melde("verwaist", k, "fehler", err.Error())
				continue
			}
		}
		b.Genommen["verwaist"]++
	}

	b.melde("verwaist", "", "warnung", fmt.Sprintf(
		"%d Kuerzel stehen im Protokoll als geloescht und fehlen in den Codes: %s. "+
			"In der Quelle sind sie wieder frei und koennen ein zweites Mal vergeben "+
			"werden — obwohl sie auf Papier stehen. Hier sind sie dauerhaft gesperrt.",
		len(verwaist), strings.Join(verwaist, ", ")))
}

// Text schreibt den Bericht so, wie man ihn liest, bevor man den echten
// Lauf startet.
func (b *Bericht) Text() string {
	var s strings.Builder
	kopf := "Uebernahme"
	if b.Trocken {
		kopf = "Trockenlauf — es wurde nichts geschrieben"
	}
	fmt.Fprintf(&s, "%s, %s\n\n", kopf, b.Zeitpunkt.Format("02.01.2006 15:04 MST"))

	sammlungen := make([]string, 0, len(b.Gezaehlt))
	for name := range b.Gezaehlt {
		sammlungen = append(sammlungen, name)
	}
	sort.Strings(sammlungen)
	for _, name := range sammlungen {
		fmt.Fprintf(&s, "  %-12s %3d gelesen, %3d uebernommen\n",
			name, b.Gezaehlt[name], b.Genommen[name])
	}

	if len(b.Kuerzel) > 0 {
		fmt.Fprintf(&s, "\n  Kuerzel: %s\n", strings.Join(b.Kuerzel, ", "))
	}
	if len(b.Befunde) > 0 {
		s.WriteString("\nBefunde\n")
		for _, f := range b.Befunde {
			kennung := f.Kennung
			if kennung == "" {
				kennung = "—"
			}
			fmt.Fprintf(&s, "  [%s] %s %s: %s\n", f.Schwere, f.Sammlung, kennung, f.Text)
		}
	}
	fmt.Fprintf(&s, "\n%d Fehler.\n", b.Fehler())
	return s.String()
}
