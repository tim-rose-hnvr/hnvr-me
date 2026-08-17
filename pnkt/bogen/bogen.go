// Package bogen setzt viele einzelne Codes auf einen Druckbogen.
//
// Das ist der Schritt, den die Werkzeuge des Marktes auslassen: sie
// liefern einzelne Dateien und ueberlassen das Ausschiessen der
// Druckerei. Wer 24 Tischcodes braucht, bekommt 24 PDFs und legt sie
// von Hand in InDesign — und dabei entstehen genau die Fehler, die
// hinterher die Auflage kosten.
//
// Zwei Regeln stehen hier im Code, weil sie sich nicht verhandeln
// lassen:
//
//  1. Ein Stueck wird nie verkleinert, damit mehr auf den Bogen
//     passen. Die Kantenlaenge ist eine Druckentscheidung — sie kommt
//     aus dem Leseabstand und dem Verfahren. Passen 24 Stueck nicht
//     auf ein Blatt, werden es zwei Blaetter, nicht kleinere Codes.
//
//  2. Schnittmarken liegen ausserhalb des Anschnitts. Eine Marke im
//     Anschnitt wird mitgedruckt und steht danach auf dem fertigen
//     Etikett.
//
// Die Marken stehen in der Passerfarbe „All" — einer Separation, die
// auf jeder Druckplatte erscheint. Nur so stehen sie in allen vier
// Auszügen und der Schneider sieht sie unabhaengig davon, welche
// Farbe gerade oben liegt. Schwarz allein waere falsch: es steht nur
// im K-Auszug.
package bogen

import (
	"errors"
	"fmt"
	"math"

	"pnkt.me/pnkt/qr"
)

// Passerfarbe erscheint in jedem Farbauszug.
const Passerfarbe = "sonder(All,1,1,1,1)"

// Blatt ist ein Bogenformat in Millimetern.
type Blatt struct {
	Schluessel string
	Name       string
	BreiteMm   float64
	HoeheMm    float64
}

// Die Formate, die eine Druckerei ohne Rueckfrage annimmt. A4 und A3
// laufen auf jedem Digitaldrucker, SRA3 ist das Offsetformat mit
// Anschnitt rundherum.
var Blattliste = []Blatt{
	{"a4", "A4 hoch", 210, 297},
	{"a4quer", "A4 quer", 297, 210},
	{"a3", "A3 hoch", 297, 420},
	{"a3quer", "A3 quer", 420, 297},
	{"sra3", "SRA3", 320, 450},
	{"letter", "Letter", 215.9, 279.4},
}

// BlattNach sucht ein Format. Unbekanntes ergibt A4 — ein Bogen in
// einem falschen Format ist besser als gar keiner, und A4 kann jeder
// nachschneiden.
func BlattNach(schluessel string) Blatt {
	for _, b := range Blattliste {
		if b.Schluessel == schluessel {
			return b
		}
	}
	return Blattliste[0]
}

// Plan beschreibt, wie ausgeschossen wird. Alle Masse in Millimetern.
type Plan struct {
	Blatt         Blatt
	AnschnittMm   float64 // Beschnittzugabe je Stueck, ueblich 3
	RandMm        float64 // Abstand zum Blattrand, ueblich 10
	AbstandMm     float64 // Steg zwischen zwei Stuecken
	Schnittmarken bool
	MarkeLangMm   float64 // Laenge einer Schnittmarke, ueblich 4
	MarkeDickMm   float64 // Strichstaerke, ueblich 0,25 (etwa 0,7 pt)
	Fusszeile     string  // steht unten auf jedem Bogen
}

// StandardPlan sind die Werte, mit denen eine Druckerei rechnet.
func StandardPlan() Plan {
	return Plan{
		Blatt: BlattNach("a4"), AnschnittMm: 3, RandMm: 10, AbstandMm: 4,
		Schnittmarken: true, MarkeLangMm: 4, MarkeDickMm: 0.25,
	}
}

// Stueck ist ein einzelner Code samt seiner Beschriftung.
type Stueck struct {
	Zeichnung qr.Zeichnung
	Text      string // steht unter dem Stueck, etwa „Tisch 12"
}

// Aufteilung sagt, wie der Bogen aufgeht — noch bevor gerechnet wird.
// Die Zentrale zeigt das an, damit niemand erst nach dem Erzeugen
// merkt, dass er drei Bogen bekommt.
type Aufteilung struct {
	Spalten    int
	Reihen     int
	ProBogen   int
	Bogen      int
	StueckBrMm float64 // Platzbedarf eines Stuecks samt Anschnitt
	StueckHoMm float64
	RestBrMm   float64 // ungenutzte Breite, zum Beurteilen des Formats
	RestHoMm   float64
}

// Teile rechnet die Aufteilung aus. Sie braucht das Mass eines Stuecks,
// nicht die Stuecke selbst — so kann eine Oberflaeche die Zahlen
// anzeigen, bevor irgendetwas erzeugt wird.
func Teile(p Plan, stueckBrMm, stueckHoMm float64, anzahl int) (Aufteilung, error) {
	if stueckBrMm <= 0 || stueckHoMm <= 0 {
		return Aufteilung{}, errors.New("ein Stueck ohne Mass")
	}
	brMitAnschnitt := stueckBrMm + 2*p.AnschnittMm
	hoMitAnschnitt := stueckHoMm + 2*p.AnschnittMm

	nutzbarBr := p.Blatt.BreiteMm - 2*p.RandMm
	nutzbarHo := p.Blatt.HoeheMm - 2*p.RandMm

	spalten := passtWieOft(nutzbarBr, brMitAnschnitt, p.AbstandMm)
	reihen := passtWieOft(nutzbarHo, hoMitAnschnitt, p.AbstandMm)
	if spalten < 1 || reihen < 1 {
		// Hier wird nicht verkleinert. Die Meldung nennt beide Masse,
		// damit man sieht, ob der Rand oder das Stueck zu gross ist.
		return Aufteilung{}, fmt.Errorf(
			"ein Stueck misst %.1f × %.1f mm (mit %.0f mm Anschnitt %.1f × %.1f) und passt nicht "+
				"auf %s (%.0f × %.0f mm, Rand %.0f mm) — groesseres Blatt waehlen "+
				"oder den Code kleiner setzen",
			stueckBrMm, stueckHoMm, p.AnschnittMm, brMitAnschnitt, hoMitAnschnitt,
			p.Blatt.Name, p.Blatt.BreiteMm, p.Blatt.HoeheMm, p.RandMm)
	}

	proBogen := spalten * reihen
	bogen := 0
	if anzahl > 0 {
		bogen = (anzahl + proBogen - 1) / proBogen
	}
	return Aufteilung{
		Spalten: spalten, Reihen: reihen, ProBogen: proBogen, Bogen: bogen,
		StueckBrMm: brMitAnschnitt, StueckHoMm: hoMitAnschnitt,
		RestBrMm: nutzbarBr - belegt(spalten, brMitAnschnitt, p.AbstandMm),
		RestHoMm: nutzbarHo - belegt(reihen, hoMitAnschnitt, p.AbstandMm),
	}, nil
}

// n Stuecke belegen n·Mass plus (n−1)·Steg. Der letzte Steg faellt weg
// — wer ihn mitrechnet, verliert bei kleinen Stuecken eine ganze Reihe.
func passtWieOft(platz, mass, steg float64) int {
	if mass <= 0 {
		return 0
	}
	// +1e-9 gegen die Gleitkommaluecke: 297 − 20 = 277 kann als
	// 276.99999999999994 herauskommen, und dann faellt eine Reihe weg,
	// die in Wahrheit genau aufgeht.
	n := int(math.Floor((platz + steg + 1e-9) / (mass + steg)))
	if n < 0 {
		return 0
	}
	return n
}

func belegt(n int, mass, steg float64) float64 {
	if n <= 0 {
		return 0
	}
	return float64(n)*mass + float64(n-1)*steg
}

// Fach sagt, wie gross ein Stueck samt Beschriftung wird — ohne
// Anschnitt, den rechnet Teile dazu.
//
// Die Funktion ist ausdruecklich oeffentlich, weil eine Vorschau
// dieselbe Zahl braucht wie das Erzeugen. Rechnet die Vorschau anders,
// verspricht sie zwoelf Stueck je Bogen und liefert neun — und der
// Unterschied faellt erst auf, wenn das PDF da ist.
func Fach(brMax, hoMax float64, beschriftet bool) (fachBr, fachHo, schriftMm float64) {
	if !beschriftet {
		return brMax, hoMax, 0
	}
	// Die Beschriftung liegt unter dem Stueck, im Anschnitt hat sie
	// nichts zu suchen: sie soll nach dem Schneiden noch dastehen.
	schriftMm = math.Max(2.6, brMax*0.075)
	return brMax, hoMax + schriftMm*1.9, schriftMm
}

// Setze schiesst die Stuecke aus und liefert je Bogen eine Zeichnung.
// Die Zeichnungen gehen unveraendert in ausgabe.PDF und ausgabe.SVG.
func Setze(p Plan, stuecke []Stueck) ([]qr.Zeichnung, Aufteilung, error) {
	if len(stuecke) == 0 {
		return nil, Aufteilung{}, errors.New("keine Stuecke")
	}
	// Alle Stuecke bekommen dasselbe Fach. Das groesste bestimmt es,
	// sonst ueberlappen ungleich grosse Codes. In der Praxis sind sie
	// gleich gross — aber „in der Praxis" ist keine Zusicherung.
	var brMax, hoMax float64
	beschriftet := false
	for _, s := range stuecke {
		brMax = math.Max(brMax, s.Zeichnung.BreiteMm)
		hoMax = math.Max(hoMax, s.Zeichnung.HoeheMm)
		if s.Text != "" {
			beschriftet = true
		}
	}
	brMax, hoMax, schriftMm := Fach(brMax, hoMax, beschriftet)

	auf, err := Teile(p, brMax, hoMax, len(stuecke))
	if err != nil {
		return nil, Aufteilung{}, err
	}

	// Der Block wird auf dem Blatt zentriert. Ein links oben klebender
	// Block sieht nach Versehen aus und laesst sich schlechter schneiden.
	blockBr := belegt(auf.Spalten, auf.StueckBrMm, p.AbstandMm)
	blockHo := belegt(auf.Reihen, auf.StueckHoMm, p.AbstandMm)
	linksX := (p.Blatt.BreiteMm - blockBr) / 2
	obenY := (p.Blatt.HoeheMm - blockHo) / 2
	if p.Fusszeile != "" {
		obenY = math.Max(p.RandMm, obenY-4)
	}

	var bogenliste []qr.Zeichnung
	for anfang := 0; anfang < len(stuecke); anfang += auf.ProBogen {
		ende := min(anfang+auf.ProBogen, len(stuecke))
		z := qr.Zeichnung{
			BreiteMm: p.Blatt.BreiteMm, HoeheMm: p.Blatt.HoeheMm,
			Hintergrund: "#ffffff",
		}
		for i, s := range stuecke[anfang:ende] {
			sp, re := i%auf.Spalten, i/auf.Spalten
			// Der Anschnitt liegt aussen um das Stueck: die Zeichnung
			// selbst faengt um AnschnittMm nach innen versetzt an.
			fachX := linksX + float64(sp)*(auf.StueckBrMm+p.AbstandMm)
			fachY := obenY + float64(re)*(auf.StueckHoMm+p.AbstandMm)
			x := fachX + p.AnschnittMm + (brMax-s.Zeichnung.BreiteMm)/2
			y := fachY + p.AnschnittMm

			z.Formen = append(z.Formen, versetzt(s.Zeichnung, x, y)...)
			if s.Text != "" {
				z.Formen = append(z.Formen, qr.Form{
					Art: qr.ArtText, X: fachX + auf.StueckBrMm/2,
					Y:       y + s.Zeichnung.HoeheMm + schriftMm*1.35,
					Groesse: schriftMm, Text: s.Text, Farbe: "#000000",
				})
			}
			if p.Schnittmarken {
				z.Formen = append(z.Formen, marken(p, fachX, fachY,
					auf.StueckBrMm, auf.StueckHoMm)...)
			}
		}
		if p.Fusszeile != "" {
			z.Formen = append(z.Formen, qr.Form{
				Art: qr.ArtText, X: p.Blatt.BreiteMm / 2,
				Y: p.Blatt.HoeheMm - p.RandMm/2, Groesse: 2.4,
				Text: p.Fusszeile, Farbe: "#000000",
			})
		}
		bogenliste = append(bogenliste, z)
	}
	return bogenliste, auf, nil
}

// versetzt verschiebt alle Formen einer Zeichnung an ihren Platz auf
// dem Bogen. Der Hintergrund der Einzelzeichnung wird dabei zu einer
// eigenen Flaeche — sonst faerbte das erste Stueck den ganzen Bogen.
//
// Diese Flaeche laeuft in den Anschnitt hinein: sie ist der Grund,
// weshalb es ihn gibt. Schneidet die Maschine einen halben Millimeter
// daneben, steht dort weiter die helle Flaeche und kein Papierrand.
func versetzt(z qr.Zeichnung, dx, dy float64) []qr.Form {
	var aus []qr.Form
	if z.Hintergrund != "" {
		aus = append(aus, qr.Form{Art: qr.ArtRechteck,
			X: dx - anschnittPuffer, Y: dy - anschnittPuffer,
			B: z.BreiteMm + 2*anschnittPuffer, H: z.HoeheMm + 2*anschnittPuffer,
			Farbe: z.Hintergrund})
	}
	for _, f := range z.Formen {
		aus = append(aus, schiebe(f, dx, dy))
	}
	return aus
}

// Wie weit die Hintergrundflaeche ueber das Stueck hinauslaeuft. Drei
// Millimeter sind der Anschnitt der Norm; hier reichen sie exakt aus,
// weil das Fach den Anschnitt bereits freihaelt.
const anschnittPuffer = 3

func schiebe(f qr.Form, dx, dy float64) qr.Form {
	f.X += dx
	f.Y += dy
	if len(f.Punkte) > 0 {
		neu := make([][2]float64, len(f.Punkte))
		for i, p := range f.Punkte {
			neu[i] = [2]float64{p[0] + dx, p[1] + dy}
		}
		f.Punkte = neu
	}
	if f.Loch != nil {
		l := schiebe(*f.Loch, dx, dy)
		f.Loch = &l
	}
	return f
}

// marken setzt die acht Schnittmarken eines Fachs: je zwei an jeder
// Ecke, waagerecht und senkrecht. Sie beginnen am Rand des Fachs — also
// ausserhalb des Anschnitts — und zeigen nach aussen.
func marken(p Plan, x, y, br, ho float64) []qr.Form {
	l, d := p.MarkeLangMm, p.MarkeDickMm
	if l <= 0 || d <= 0 {
		return nil
	}
	// Die Marke zeigt die Schnittkante an, nicht den Anschnittrand:
	// geschnitten wird um AnschnittMm nach innen versetzt.
	sx1, sy1 := x+p.AnschnittMm, y+p.AnschnittMm
	sx2, sy2 := x+br-p.AnschnittMm, y+ho-p.AnschnittMm

	strich := func(mx, my, mb, mh float64) qr.Form {
		return qr.Form{Art: qr.ArtRechteck, X: mx, Y: my, B: mb, H: mh, Farbe: Passerfarbe}
	}
	// Der Abstand zur Schnittkante ist der Anschnitt selbst: naeher
	// heran wuerde die Marke mitgedruckt.
	luft := p.AnschnittMm
	return []qr.Form{
		// links oben
		strich(sx1-luft-l, sy1-d/2, l, d), strich(sx1-d/2, sy1-luft-l, d, l),
		// rechts oben
		strich(sx2+luft, sy1-d/2, l, d), strich(sx2-d/2, sy1-luft-l, d, l),
		// rechts unten
		strich(sx2+luft, sy2-d/2, l, d), strich(sx2-d/2, sy2+luft, d, l),
		// links unten
		strich(sx1-luft-l, sy2-d/2, l, d), strich(sx1-d/2, sy2+luft, d, l),
	}
}
