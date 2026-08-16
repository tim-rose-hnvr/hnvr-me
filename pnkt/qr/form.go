package qr

// Die Geometrie liegt an einer Stelle, nicht in jedem Ausgabeformat neu.
// Sonst zeigt die Vorschau etwas anderes als die Druckdatei — und das
// merkt niemand, bevor die Auflage liegt.
//
// Alle Masse in Millimetern, Nullpunkt links oben. Die Ausgabeformate
// rechnen um, wenn sie anders zaehlen: PDF und EPS zaehlen von unten.

// Art einer Grundform.
const (
	ArtRechteck     = "rechteck"
	ArtRundRechteck = "rundrechteck"
	ArtKreis        = "kreis"
	ArtPolygon      = "polygon"
)

// Form ist eine einzelne Flaeche. Ist Loch gesetzt, wird sie mit der
// Even-odd-Regel gefuellt — so entsteht der Rahmen eines Auges.
type Form struct {
	Art    string
	X, Y   float64
	B, H   float64
	R      float64      // Eckradius oder Kreisradius
	Punkte [][2]float64 // fuer ArtPolygon
	Farbe  string       // Hexfarbe
	Loch   *Form
}

// Zeichnung ist alles, was gedruckt wird.
type Zeichnung struct {
	BreiteMm, HoeheMm float64
	Hintergrund       string // leer heisst durchsichtig
	Formen            []Form
}

// Formen rechnet das Symbol in Grundformen um.
func (s *Symbol) Formen(g Gestalt) Zeichnung {
	if g.BreiteMm <= 0 {
		g.BreiteMm = 40
	}
	if g.Modulform == "" {
		g.Modulform = "quadrat"
	}
	if g.Vordergrund == "" {
		g.Vordergrund = "#000000"
	}
	augenFarbe := g.AugenFarbe
	if augenFarbe == "" {
		augenFarbe = g.Vordergrund
	}

	m := g.BreiteMm / float64(s.Kante)
	rand := float64(g.RuhezoneMod) * m
	gesamt := g.BreiteMm + 2*rand

	z := Zeichnung{BreiteMm: gesamt, HoeheMm: gesamt, Hintergrund: g.Hintergrund}

	for y := 0; y < s.Kante; y++ {
		for x := 0; x < s.Kante; x++ {
			if !s.Dunkel(x, y) || s.istAuge(x, y) || s.istAusgespart(x, y, g.LogoAnteil) {
				continue
			}
			z.Formen = append(z.Formen, modulform(g.Modulform,
				rand+float64(x)*m, rand+float64(y)*m, m, g.Vordergrund))
		}
	}

	k := s.Kante
	for _, ecke := range [][2]int{{0, 0}, {k - 7, 0}, {0, k - 7}} {
		x := rand + float64(ecke[0])*m
		y := rand + float64(ecke[1])*m
		z.Formen = append(z.Formen, augenformen(x, y, m, g.Augenrahmen, g.Augenkern, augenFarbe)...)
	}
	return z
}

func modulform(form string, x, y, m float64, farbe string) Form {
	switch form {
	case "punkt":
		r := m * 0.42
		return Form{Art: ArtKreis, X: x + m/2, Y: y + m/2, R: r, Farbe: farbe}
	case "rund":
		return Form{Art: ArtRundRechteck, X: x, Y: y, B: m, H: m, R: m * 0.28, Farbe: farbe}
	case "mosaik":
		e := m * 0.08
		return Form{Art: ArtRechteck, X: x + e, Y: y + e, B: m - 2*e, H: m - 2*e, Farbe: farbe}
	case "raute":
		return Form{Art: ArtPolygon, Farbe: farbe, Punkte: [][2]float64{
			{x + m/2, y}, {x + m, y + m/2}, {x + m/2, y + m}, {x, y + m/2}}}
	case "kreuz":
		d := m * 0.3
		return Form{Art: ArtPolygon, Farbe: farbe, Punkte: [][2]float64{
			{x + d, y}, {x + m - d, y}, {x + m - d, y + d}, {x + m, y + d},
			{x + m, y + m - d}, {x + m - d, y + m - d}, {x + m - d, y + m},
			{x + d, y + m}, {x + d, y + m - d}, {x, y + m - d},
			{x, y + d}, {x + d, y + d}}}
	default:
		return Form{Art: ArtRechteck, X: x, Y: y, B: m, H: m, Farbe: farbe}
	}
}

// Ein Auge ist sieben mal sieben Module: Rahmen aussen, ein Ring hell,
// Kern drei mal drei. Diese Masse sind nicht frei waehlbar — hier endet
// die Gestaltung und beginnt die Norm.
func augenformen(x, y, m float64, rahmen, kern, farbe string) []Form {
	sieben := 7 * m
	var aussen, innen Form

	switch rahmen {
	case "rund":
		aussen = Form{Art: ArtKreis, X: x + sieben/2, Y: y + sieben/2, R: sieben / 2, Farbe: farbe}
		innen = Form{Art: ArtKreis, X: x + sieben/2, Y: y + sieben/2, R: sieben/2 - m}
	case "blatt":
		aussen = Form{Art: ArtRundRechteck, X: x, Y: y, B: sieben, H: sieben, R: 2 * m, Farbe: farbe}
		innen = Form{Art: ArtRechteck, X: x + m, Y: y + m, B: sieben - 2*m, H: sieben - 2*m}
	default:
		aussen = Form{Art: ArtRechteck, X: x, Y: y, B: sieben, H: sieben, Farbe: farbe}
		innen = Form{Art: ArtRechteck, X: x + m, Y: y + m, B: sieben - 2*m, H: sieben - 2*m}
	}
	aussen.Loch = &innen

	kx, ky, drei := x+2*m, y+2*m, 3*m
	var mitte Form
	switch kern {
	case "rund":
		mitte = Form{Art: ArtKreis, X: kx + drei/2, Y: ky + drei/2, R: drei / 2, Farbe: farbe}
	case "punkt":
		mitte = Form{Art: ArtKreis, X: kx + drei/2, Y: ky + drei/2, R: drei * 0.38, Farbe: farbe}
	default:
		mitte = Form{Art: ArtRechteck, X: kx, Y: ky, B: drei, H: drei, Farbe: farbe}
	}

	return []Form{aussen, mitte}
}
