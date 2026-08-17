package bogen

import (
	"fmt"
	"math"
	"strings"

	"pnkt.me/pnkt/qr"
)

// Der Aufsteller ist die haeufigste gedruckte Form ueberhaupt: eine
// kleine Karte, die auf einem Tisch steht, mit einem Code darauf und
// zwei Zeilen Text.
//
// Er ist hier und nicht im Studio, weil die Rechnung dieselbe ist wie
// beim Bogen: ein Blatt in Millimetern, etwas darauf, Anschnitt und
// Schnittmarken darum. Und weil derselbe Aufsteller in einer Serie
// vierundzwanzigmal gebraucht wird — dann geht er durch Setze und
// landet ausgeschossen auf A4.
//
// Zwei Dinge stehen fest, nicht als Vorschlag:
//
//  1. Die Kantenlaenge des Codes waechst nicht mit der Karte mit. Sie
//     kommt aus dem Leseabstand — bei einem Tischaufsteller sind das
//     etwa 30 cm, also 30 mm Kante. Wer die Karte groesser macht,
//     bekommt mehr Weissraum, keinen groesseren Code.
//  2. Der Text steht nicht im Anschnitt. Was dort steht, wird
//     abgeschnitten, wenn die Maschine einen halben Millimeter
//     danebenliegt.

// Karte ist ein Kartenformat in Millimetern.
type Karte struct {
	Schluessel string
	Name       string
	BreiteMm   float64
	HoeheMm    float64
	CodeMm     float64 // empfohlene Kantenlaenge des Codes auf dieser Karte
}

// Die Formate, die als Aufsteller vorkommen. A7 ist die
// Tischnummernkarte, A6 die Postkarte, A5 der Tresenaufsteller.
var Kartenliste = []Karte{
	{"a7", "A7 — Tischkarte", 74, 105, 28},
	{"a6", "A6 — Postkarte", 105, 148, 40},
	{"a5", "A5 — Tresen", 148, 210, 55},
	{"quadrat10", "10 × 10 cm", 100, 100, 40},
}

// KarteNach sucht ein Format; Unbekanntes ergibt A6.
func KarteNach(schluessel string) Karte {
	for _, k := range Kartenliste {
		if k.Schluessel == schluessel {
			return k
		}
	}
	return Kartenliste[1]
}

// Aufstellertext ist, was auf der Karte steht. Leere Zeilen entfallen,
// die uebrigen ruecken nach.
type Aufstellertext struct {
	Ueberschrift string // gross, ueber dem Code
	Aufforderung string // unter dem Code, etwa „Karte scannen"
	Fuss         string // klein, ganz unten, etwa „Tisch 12"
}

// Aufsteller setzt einen Code samt Text auf eine Karte.
//
// `symbol` ist das fertige QR-Symbol, `g` die Gestaltung. Die Breite in
// `g` wird auf das Mass der Karte gesetzt: sie ist eine
// Druckentscheidung dieses Formats, keine Uebernahme aus dem Studio.
func Aufsteller(symbol *qr.Symbol, g qr.Gestalt, karte Karte, text Aufstellertext,
	grund, tinte, akzent string) qr.Zeichnung {

	if grund == "" {
		grund = "#ffffff"
	}
	if tinte == "" {
		tinte = "#201e1d"
	}
	if akzent == "" {
		akzent = tinte
	}

	g.BreiteMm = karte.CodeMm
	code := symbol.Formen(g)

	z := qr.Zeichnung{
		BreiteMm: karte.BreiteMm, HoeheMm: karte.HoeheMm, Hintergrund: grund,
	}

	// Die Masse folgen der Kartenbreite, damit A7 und A5 gleich
	// aussehen und nicht nur gleich gross sind.
	rand := karte.BreiteMm * 0.11
	schriftGross := math.Max(4, karte.BreiteMm*0.072)
	schriftMittel := math.Max(3, karte.BreiteMm*0.045)
	schriftKlein := math.Max(2.4, karte.BreiteMm*0.032)

	// Der Block aus Ueberschrift, Code und Aufforderung wird als Ganzes
	// mittig gesetzt. Der Fuss haengt am unteren Rand und gehoert nicht
	// zum Block — er verkleinert nur den Platz, den der Block hat.
	//
	// Der Platz wird abgezogen und nicht nachtraeglich verschoben: wer
	// den Block mittig setzt und danach nach oben rueckt, hat ihn nicht
	// mehr mittig, sondern nur nicht mehr im Weg.
	hoch := code.HoeheMm
	if text.Ueberschrift != "" {
		hoch += schriftGross * 2.1
	}
	if text.Aufforderung != "" {
		hoch += schriftMittel * 2.4
	}
	unterkante := karte.HoeheMm - rand
	if text.Fuss != "" {
		unterkante = karte.HoeheMm - rand*0.55 - schriftKlein*1.6
	}
	oben := rand + (unterkante-rand-hoch)/2
	oben = math.Max(rand, oben)

	y := oben
	if text.Ueberschrift != "" {
		// Y ist bei Text die Grundlinie, nicht die Oberkante.
		z.Formen = append(z.Formen, qr.Form{Art: qr.ArtText,
			X: karte.BreiteMm / 2, Y: y + schriftGross,
			Groesse: schriftGross, Text: kuerze(text.Ueberschrift, 30), Farbe: tinte})
		y += schriftGross * 2.1
	}

	// Der Code sitzt waagerecht in der Mitte. Hat er einen eigenen
	// Grund, bekommt er ihn als Flaeche darunter — sonst faellt die
	// Farbe des Codegrunds still unter den Tisch, und mit ihr der
	// Kontrast, gegen den geprueft wurde.
	links := (karte.BreiteMm - code.BreiteMm) / 2
	if code.Hintergrund != "" && !strings.EqualFold(code.Hintergrund, grund) {
		z.Formen = append(z.Formen, qr.Form{Art: qr.ArtRundRechteck,
			X: links, Y: y, B: code.BreiteMm, H: code.HoeheMm,
			R: code.BreiteMm * 0.06, Farbe: code.Hintergrund})
	}
	for _, f := range code.Formen {
		z.Formen = append(z.Formen, schiebe(f, links, y))
	}
	y += code.HoeheMm

	if text.Aufforderung != "" {
		z.Formen = append(z.Formen, qr.Form{Art: qr.ArtText,
			X: karte.BreiteMm / 2, Y: y + schriftMittel*1.5,
			Groesse: schriftMittel, Text: kuerze(text.Aufforderung, 40), Farbe: akzent})
	}

	if text.Fuss != "" {
		z.Formen = append(z.Formen, qr.Form{Art: qr.ArtText,
			X: karte.BreiteMm / 2, Y: karte.HoeheMm - rand*0.55,
			Groesse: schriftKlein, Text: kuerze(text.Fuss, 48), Farbe: tinte})
	}

	// CodeVon und CodeBis zeigen auf die Codeflaeche der Karte, damit
	// ein Verlauf sich darueber spannt und nicht ueber die ganze Karte.
	von := [2]float64{(karte.BreiteMm - code.BreiteMm) / 2, oben}
	if text.Ueberschrift != "" {
		von[1] += schriftGross * 2.1
	}
	z.CodeVon = [2]float64{von[0] + code.CodeVon[0], von[1] + code.CodeVon[1]}
	z.CodeBis = [2]float64{von[0] + code.CodeBis[0], von[1] + code.CodeBis[1]}
	z.Verlauf = code.Verlauf

	return z
}

// kuerze schneidet zu langen Text ab, statt ihn ueber den Kartenrand
// laufen zu lassen. Die Breitenrechnung der Ausgabe ist eine Naeherung
// ueber Helvetica-Bold; genauer ginge es nur mit den Breitentabellen der
// Schrift, und dafuer ist eine Aufforderung von vierzig Zeichen der
// falsche Anlass.
func kuerze(s string, hoechstens int) string {
	s = strings.TrimSpace(s)
	zeichen := []rune(s)
	if len(zeichen) <= hoechstens {
		return s
	}
	return strings.TrimSpace(string(zeichen[:hoechstens-1])) + "…"
}

// AufstellerSerie macht aus vielen Codes ebenso viele Aufsteller und
// schiesst sie auf Bogen aus.
func AufstellerSerie(p Plan, karte Karte, stuecke []qr.Zeichnung,
	beschriftungen []string) ([]qr.Zeichnung, Aufteilung, error) {

	if len(stuecke) != len(beschriftungen) && len(beschriftungen) != 0 {
		return nil, Aufteilung{}, fmt.Errorf(
			"%d Karten und %d Beschriftungen — das geht nicht auf",
			len(stuecke), len(beschriftungen))
	}
	var liste []Stueck
	for i, z := range stuecke {
		s := Stueck{Zeichnung: z}
		if i < len(beschriftungen) {
			s.Text = beschriftungen[i]
		}
		liste = append(liste, s)
	}
	return Setze(p, liste)
}
