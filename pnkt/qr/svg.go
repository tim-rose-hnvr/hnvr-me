package qr

import (
	"fmt"
	"strings"
)

// Gestalt beschreibt das Aussehen. Alle Masse in Millimetern, weil der Code
// gedruckt wird. Pixel sind eine Bildschirmgroesse und hier ohne Bedeutung.
type Gestalt struct {
	BreiteMm    float64 // Kantenlaenge des Symbols ohne Ruhezone
	RuhezoneMod int     // in Modulen, Norm ist 4
	Modulform   string  // quadrat, punkt, rund, mosaik, raute, kreuz
	Augenrahmen string  // quadrat, rund, blatt
	Augenkern   string  // quadrat, rund, punkt
	Vordergrund string  // Hexfarbe
	Hintergrund string  // Hexfarbe, leer heisst durchsichtig
	AugenFarbe  string  // leer heisst wie Vordergrund
	LogoAnteil  float64 // 0 bis 1, Kantenanteil der Aussparung
}

// StandardGestalt ist die Fassung, die immer scannt: schwarz auf weiss,
// quadratische Module, volle Ruhezone.
func StandardGestalt(breiteMm float64) Gestalt {
	return Gestalt{
		BreiteMm:    breiteMm,
		RuhezoneMod: 4,
		Modulform:   "quadrat",
		Augenrahmen: "quadrat",
		Augenkern:   "quadrat",
		Vordergrund: "#000000",
		Hintergrund: "#ffffff",
	}
}

// istAuge sagt, ob das Modul zu einem der drei Suchmuster gehoert.
func (s *Symbol) istAuge(x, y int) bool {
	k := s.Kante
	return (x < 7 && y < 7) || (x >= k-7 && y < 7) || (x < 7 && y >= k-7)
}

// istAusgespart sagt, ob das Modul unter der Logoaussparung liegt.
func (s *Symbol) istAusgespart(x, y int, anteil float64) bool {
	if anteil <= 0 {
		return false
	}
	fenster := float64(s.Kante) * anteil
	von := (float64(s.Kante) - fenster) / 2
	bis := von + fenster
	fx, fy := float64(x), float64(y)
	return fx+1 > von && fx < bis && fy+1 > von && fy < bis
}

// SVG erzeugt echten Vektor: Pfade in Millimetern, keine eingebettete Rastergrafik.
// Das ist der Unterschied zu jedem Werkzeug, das ein PNG hochskaliert.
func (s *Symbol) SVG(g Gestalt) string {
	if g.BreiteMm <= 0 {
		g.BreiteMm = 40
	}
	if g.Modulform == "" {
		g.Modulform = "quadrat"
	}
	if g.Vordergrund == "" {
		g.Vordergrund = "#000000"
	}

	modul := g.BreiteMm / float64(s.Kante)
	rand := float64(g.RuhezoneMod) * modul
	gesamt := g.BreiteMm + 2*rand

	augenFarbe := g.AugenFarbe
	if augenFarbe == "" {
		augenFarbe = g.Vordergrund
	}

	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" `+
		`width="%.4gmm" height="%.4gmm" viewBox="0 0 %.4g %.4g" `+
		`shape-rendering="crispEdges">`, gesamt, gesamt, gesamt, gesamt)

	fmt.Fprintf(&b, `<desc>pnkt.me QR Version %d Stufe %s Maske %d, Modul %.4g mm</desc>`,
		s.Version, s.Stufe, s.Maske, modul)

	if g.Hintergrund != "" {
		fmt.Fprintf(&b, `<rect width="%.4g" height="%.4g" fill="%s"/>`, gesamt, gesamt, g.Hintergrund)
	}

	// Datenmodule.
	var pfad strings.Builder
	for y := 0; y < s.Kante; y++ {
		for x := 0; x < s.Kante; x++ {
			if !s.Dunkel(x, y) || s.istAuge(x, y) {
				continue
			}
			if s.istAusgespart(x, y, g.LogoAnteil) {
				continue
			}
			px := rand + float64(x)*modul
			py := rand + float64(y)*modul
			schreibeModul(&pfad, g.Modulform, px, py, modul)
		}
	}
	fmt.Fprintf(&b, `<path fill="%s" d="%s"/>`, g.Vordergrund, pfad.String())

	// Die drei Augen einzeln, damit Rahmen und Kern eigene Formen bekommen.
	k := s.Kante
	for _, ecke := range [][2]int{{0, 0}, {k - 7, 0}, {0, k - 7}} {
		x := rand + float64(ecke[0])*modul
		y := rand + float64(ecke[1])*modul
		b.WriteString(zeichneAuge(x, y, modul, g.Augenrahmen, g.Augenkern, augenFarbe))
	}

	b.WriteString(`</svg>`)
	return b.String()
}

func schreibeModul(b *strings.Builder, form string, x, y, m float64) {
	switch form {
	case "punkt":
		r := m * 0.42
		fmt.Fprintf(b, "M%.4g %.4ga%.4g %.4g 0 1 0 %.4g 0a%.4g %.4g 0 1 0 %.4g 0",
			x+m/2-r, y+m/2, r, r, 2*r, r, r, -2*r)
	case "rund":
		r := m * 0.28
		g := m - 2*r
		fmt.Fprintf(b,
			"M%.4g %.4g"+
				"h%.4ga%.4g %.4g 0 0 1 %.4g %.4g"+
				"v%.4ga%.4g %.4g 0 0 1 %.4g %.4g"+
				"h%.4ga%.4g %.4g 0 0 1 %.4g %.4g"+
				"v%.4ga%.4g %.4g 0 0 1 %.4g %.4gz",
			x+r, y,
			g, r, r, r, r,
			g, r, r, -r, r,
			-g, r, r, -r, -r,
			-g, r, r, r, -r)
	case "mosaik":
		e := m * 0.08
		fmt.Fprintf(b, "M%.4g %.4gh%.4gv%.4gh%.4gz", x+e, y+e, m-2*e, m-2*e, -(m - 2*e))
	case "raute":
		fmt.Fprintf(b, "M%.4g %.4gl%.4g %.4gl%.4g %.4gl%.4g %.4gz",
			x+m/2, y, m/2, m/2, -m/2, m/2, -m/2, -m/2)
	case "kreuz":
		d := m * 0.3
		g := m - 2*d
		fmt.Fprintf(b, "M%.4g %.4g"+"h%.4gv%.4gh%.4gv%.4g"+"h%.4gv%.4gh%.4gv%.4g"+"h%.4gv%.4gh%.4gz",
			x+d, y, g, d, d, g, -d, d, -g, -d, -d, -g, d)
	default: // quadrat
		fmt.Fprintf(b, "M%.4g %.4gh%.4gv%.4gh%.4gz", x, y, m, m, -m)
	}
}

// Ein Auge ist sieben mal sieben Module: Rahmen aussen, ein Ring hell,
// Kern drei mal drei. Die Masse sind nicht frei waehlbar — hier endet
// die Gestaltung und beginnt die Norm.
func zeichneAuge(x, y, m float64, rahmenform, kernform, farbe string) string {
	var b strings.Builder
	sieben := 7 * m

	switch rahmenform {
	case "rund":
		r := sieben / 2
		fmt.Fprintf(&b, `<path fill="%s" fill-rule="evenodd" `+
			`d="M%.4g %.4ga%.4g %.4g 0 1 0 %.4g 0a%.4g %.4g 0 1 0 %.4g 0z`+
			`M%.4g %.4ga%.4g %.4g 0 1 1 %.4g 0a%.4g %.4g 0 1 1 %.4g 0z"/>`,
			farbe, x, y+r, r, r, sieben, r, r, -sieben,
			x+m, y+r, r-m, r-m, sieben-2*m, r-m, r-m, -(sieben - 2*m))
	case "blatt":
		e := m * 2
		fmt.Fprintf(&b, `<path fill="%s" fill-rule="evenodd" `+
			`d="M%.4g %.4gh%.4ga%.4g %.4g 0 0 1 %.4g %.4gv%.4gh%.4ga%.4g %.4g 0 0 1 %.4g %.4gz`+
			`M%.4g %.4gh%.4gv%.4gh%.4gz"/>`,
			farbe, x+e, y, sieben-e, e, e, e, e, sieben-e, -(sieben - e), e, e, -e, -e,
			x+m, y+m, sieben-2*m, sieben-2*m, -(sieben - 2*m))
	default: // quadrat
		fmt.Fprintf(&b, `<path fill="%s" fill-rule="evenodd" `+
			`d="M%.4g %.4gh%.4gv%.4gh%.4gz M%.4g %.4gh%.4gv%.4gh%.4gz"/>`,
			farbe, x, y, sieben, sieben, -sieben,
			x+m, y+m, sieben-2*m, sieben-2*m, -(sieben - 2*m))
	}

	kx, ky, drei := x+2*m, y+2*m, 3*m
	switch kernform {
	case "rund":
		r := drei / 2
		fmt.Fprintf(&b, `<path fill="%s" d="M%.4g %.4ga%.4g %.4g 0 1 0 %.4g 0a%.4g %.4g 0 1 0 %.4g 0z"/>`,
			farbe, kx, ky+r, r, r, drei, r, r, -drei)
	case "punkt":
		r := drei * 0.38
		fmt.Fprintf(&b, `<path fill="%s" d="M%.4g %.4ga%.4g %.4g 0 1 0 %.4g 0a%.4g %.4g 0 1 0 %.4g 0z"/>`,
			farbe, kx+drei/2-r, ky+drei/2, r, r, 2*r, r, r, -2*r)
	default:
		fmt.Fprintf(&b, `<path fill="%s" d="M%.4g %.4gh%.4gv%.4gh%.4gz"/>`, farbe, kx, ky, drei, drei, -drei)
	}

	return b.String()
}

// Text gibt das Symbol als Zeichenbild aus — fuer die Fehlersuche
// und fuer Prueflaeufe ohne Bildbetrachter.
func (s *Symbol) Text() string {
	var b strings.Builder
	for y := -1; y <= s.Kante; y++ {
		for x := -1; x <= s.Kante; x++ {
			if s.Dunkel(x, y) {
				b.WriteString("██")
			} else {
				b.WriteString("  ")
			}
		}
		b.WriteString("\n")
	}
	return b.String()
}
