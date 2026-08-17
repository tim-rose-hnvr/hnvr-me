package qr

import (
	"fmt"
	"math"
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
	Verlauf     *Verlauf
	Rahmen      *Rahmen
}

// Rahmen ist die Fassung um den Code, meist mit einer Aufforderung.
// Sie kostet Platz, holt aber Scans: ein Code ohne Beschriftung wird
// auf einem Plakat regelmaessig fuer Zierrat gehalten.
type Rahmen struct {
	Art       string // keiner, balken, schild
	Text      string
	Farbe     string // Flaeche des Rahmens
	Textfarbe string
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

	if z.Verlauf != nil {
		b.WriteString(svgVerlauf(z))
	}

	if z.Hintergrund != "" {
		fmt.Fprintf(&b, `<rect width="%.4g" height="%.4g" fill="%s"/>`,
			z.BreiteMm, z.HoeheMm, z.Hintergrund)
	}

	// Alle einfarbigen Vollflaechen ohne Loch in einen Pfad — das haelt
	// die Datei klein, was bei Version 40 den Unterschied macht.
	sammel := map[string]*strings.Builder{}
	var reihenfolge []string
	for _, f := range z.Formen {
		if f.Loch != nil || f.Art == ArtText {
			continue
		}
		if _, da := sammel[f.Farbe]; !da {
			sammel[f.Farbe] = &strings.Builder{}
			reihenfolge = append(reihenfolge, f.Farbe)
		}
		svgPfad(sammel[f.Farbe], f)
	}
	for _, farbe := range reihenfolge {
		fmt.Fprintf(&b, `<path fill="%s" d="%s"/>`, svgFarbe(farbe), sammel[farbe].String())
	}

	// Formen mit Aussparung brauchen die Even-odd-Regel und einen eigenen Pfad.
	for _, f := range z.Formen {
		if f.Loch == nil {
			continue
		}
		var p strings.Builder
		svgPfad(&p, f)
		svgPfad(&p, *f.Loch)
		fmt.Fprintf(&b, `<path fill="%s" fill-rule="evenodd" d="%s"/>`, svgFarbe(f.Farbe), p.String())
	}

	// Beschriftung zuletzt, damit sie ueber allem liegt.
	for _, f := range z.Formen {
		if f.Art != ArtText {
			continue
		}
		fmt.Fprintf(&b, `<text x="%.4g" y="%.4g" fill="%s" font-size="%.4g" `+
			`font-family="Helvetica,Arial,sans-serif" font-weight="700" `+
			`letter-spacing="%.4g" text-anchor="middle">%s</text>`,
			f.X, f.Y, svgFarbe(f.Farbe), f.Groesse, f.Groesse*0.08, svgSchutz(f.Text))
	}

	b.WriteString(`</svg>`)
	return b.String()
}

// svgFarbe loest die Verlaufsmarke auf.
func svgFarbe(farbe string) string {
	if farbe == VerlaufMarke {
		return "url(#verlauf)"
	}
	// CMYK und Sonderfarben bekommen eine Bildschirmnaeherung. Welches
	// Rot am Ende aus der Maschine kommt, entscheidet das Profil der
	// Druckerei — das SVG ist die Vorschau, nicht der Beleg.
	return Bildschirmfarbe(farbe)
}

// Bildschirmfarbe wird vom Programm gesetzt, damit das Paket qr nicht
// vom Farbpaket abhaengt und die Reihenfolge der Pakete klar bleibt.
var Bildschirmfarbe = func(angabe string) string { return angabe }

func svgSchutz(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// svgVerlauf spannt den Verlauf ueber die Codeflaeche, nicht ueber das
// Blatt — sonst verschiebt eine groessere Ruhezone die Farben.
func svgVerlauf(z Zeichnung) string {
	v := z.Verlauf
	var haelt strings.Builder
	for _, h := range v.Haelt {
		fmt.Fprintf(&haelt, `<stop offset="%.4g" stop-color="%s"/>`, h.Pos, h.Farbe)
	}
	if v.Art == "radial" {
		mx := (z.CodeVon[0] + z.CodeBis[0]) / 2
		my := (z.CodeVon[1] + z.CodeBis[1]) / 2
		r := (z.CodeBis[0] - z.CodeVon[0]) / 2
		return fmt.Sprintf(`<defs><radialGradient id="verlauf" gradientUnits="userSpaceOnUse" `+
			`cx="%.4g" cy="%.4g" r="%.4g">%s</radialGradient></defs>`, mx, my, r, haelt.String())
	}
	x1, y1, x2, y2 := verlaufsachse(z)
	return fmt.Sprintf(`<defs><linearGradient id="verlauf" gradientUnits="userSpaceOnUse" `+
		`x1="%.4g" y1="%.4g" x2="%.4g" y2="%.4g">%s</linearGradient></defs>`,
		x1, y1, x2, y2, haelt.String())
}

// verlaufsachse rechnet den Winkel in zwei Punkte um. 0 Grad laeuft von
// links nach rechts, 90 Grad von oben nach unten.
func verlaufsachse(z Zeichnung) (x1, y1, x2, y2 float64) {
	mx := (z.CodeVon[0] + z.CodeBis[0]) / 2
	my := (z.CodeVon[1] + z.CodeBis[1]) / 2
	halb := (z.CodeBis[0] - z.CodeVon[0]) / 2
	w := z.Verlauf.Winkel * math.Pi / 180
	dx, dy := math.Cos(w)*halb, math.Sin(w)*halb
	return mx - dx, my - dy, mx + dx, my + dy
}

func svgPfad(b *strings.Builder, f Form) {
	switch f.Art {
	case ArtKreis:
		// Zwei Halbboegen, weil ein Kreis als Pfad geschrieben werden muss.
		fmt.Fprintf(b, "M%.4g %.4ga%.4g %.4g 0 1 0 %.4g 0a%.4g %.4g 0 1 0 %.4g 0z",
			f.X-f.R, f.Y, f.R, f.R, 2*f.R, f.R, f.R, -2*f.R)
	case ArtRundRechteck:
		e := f.EckenOderR()
		lo, ro, ru, lu := e[0], e[1], e[2], e[3]
		fmt.Fprintf(b, "M%.4g %.4g", f.X+lo, f.Y)
		fmt.Fprintf(b, "h%.4g", f.B-lo-ro)
		if ro > 0 {
			fmt.Fprintf(b, "a%.4g %.4g 0 0 1 %.4g %.4g", ro, ro, ro, ro)
		}
		fmt.Fprintf(b, "v%.4g", f.H-ro-ru)
		if ru > 0 {
			fmt.Fprintf(b, "a%.4g %.4g 0 0 1 %.4g %.4g", ru, ru, -ru, ru)
		}
		fmt.Fprintf(b, "h%.4g", -(f.B - ru - lu))
		if lu > 0 {
			fmt.Fprintf(b, "a%.4g %.4g 0 0 1 %.4g %.4g", lu, lu, -lu, -lu)
		}
		fmt.Fprintf(b, "v%.4g", -(f.H - lu - lo))
		if lo > 0 {
			fmt.Fprintf(b, "a%.4g %.4g 0 0 1 %.4g %.4g", lo, lo, lo, -lo)
		}
		b.WriteString("z")
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
