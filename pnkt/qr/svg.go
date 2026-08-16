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

// SVG erzeugt echten Vektor: Pfade in Millimetern, keine eingebettete
// Rastergrafik. Das ist der Unterschied zu jedem Werkzeug, das ein PNG
// hochskaliert.
func (s *Symbol) SVG(g Gestalt) string {
	z := s.Formen(g)

	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" `+
		`width="%.4gmm" height="%.4gmm" viewBox="0 0 %.4g %.4g" `+
		`shape-rendering="crispEdges">`, z.BreiteMm, z.HoeheMm, z.BreiteMm, z.HoeheMm)
	fmt.Fprintf(&b, `<desc>pnkt.me QR Version %d Stufe %s Maske %d, Modul %.4g mm</desc>`,
		s.Version, s.Stufe, s.Maske, g.BreiteMm/float64(s.Kante))

	if z.Hintergrund != "" {
		fmt.Fprintf(&b, `<rect width="%.4g" height="%.4g" fill="%s"/>`,
			z.BreiteMm, z.HoeheMm, z.Hintergrund)
	}

	// Alle einfarbigen Vollflaechen ohne Loch in einen Pfad — das haelt
	// die Datei klein, was bei Version 40 den Unterschied macht.
	sammel := map[string]*strings.Builder{}
	var reihenfolge []string
	for _, f := range z.Formen {
		if f.Loch != nil {
			continue
		}
		if _, da := sammel[f.Farbe]; !da {
			sammel[f.Farbe] = &strings.Builder{}
			reihenfolge = append(reihenfolge, f.Farbe)
		}
		svgPfad(sammel[f.Farbe], f)
	}
	for _, farbe := range reihenfolge {
		fmt.Fprintf(&b, `<path fill="%s" d="%s"/>`, farbe, sammel[farbe].String())
	}

	// Formen mit Aussparung brauchen die Even-odd-Regel und einen eigenen Pfad.
	for _, f := range z.Formen {
		if f.Loch == nil {
			continue
		}
		var p strings.Builder
		svgPfad(&p, f)
		svgPfad(&p, *f.Loch)
		fmt.Fprintf(&b, `<path fill="%s" fill-rule="evenodd" d="%s"/>`, f.Farbe, p.String())
	}

	b.WriteString(`</svg>`)
	return b.String()
}

func svgPfad(b *strings.Builder, f Form) {
	switch f.Art {
	case ArtKreis:
		// Zwei Halbboegen, weil ein Kreis als Pfad geschrieben werden muss.
		fmt.Fprintf(b, "M%.4g %.4ga%.4g %.4g 0 1 0 %.4g 0a%.4g %.4g 0 1 0 %.4g 0z",
			f.X-f.R, f.Y, f.R, f.R, 2*f.R, f.R, f.R, -2*f.R)
	case ArtRundRechteck:
		g := f.B - 2*f.R
		h := f.H - 2*f.R
		fmt.Fprintf(b,
			"M%.4g %.4g"+
				"h%.4ga%.4g %.4g 0 0 1 %.4g %.4g"+
				"v%.4ga%.4g %.4g 0 0 1 %.4g %.4g"+
				"h%.4ga%.4g %.4g 0 0 1 %.4g %.4g"+
				"v%.4ga%.4g %.4g 0 0 1 %.4g %.4gz",
			f.X+f.R, f.Y,
			g, f.R, f.R, f.R, f.R,
			h, f.R, f.R, -f.R, f.R,
			-g, f.R, f.R, -f.R, -f.R,
			-h, f.R, f.R, f.R, -f.R)
	case ArtPolygon:
		for i, p := range f.Punkte {
			if i == 0 {
				fmt.Fprintf(b, "M%.4g %.4g", p[0], p[1])
			} else {
				fmt.Fprintf(b, "L%.4g %.4g", p[0], p[1])
			}
		}
		b.WriteString("z")
	default:
		fmt.Fprintf(b, "M%.4g %.4gh%.4gv%.4gh%.4gz", f.X, f.Y, f.B, f.H, -f.B)
	}
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
