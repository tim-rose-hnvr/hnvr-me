// Package ausgabe schreibt Druckdateien: PDF und EPS, beides echter Vektor.
//
// Beide Formate werden hier von Hand erzeugt. Das ist weniger Aufwand als
// es klingt — ein PDF mit Vektorpfaden ist ein kurzer, gut beschriebener
// Dateiaufbau — und es haelt das Programm frei von fremden Paketen.
//
// Beide Formate rechnen in Punkt (1/72 Zoll) und zaehlen von unten links.
// Die Zeichnung zaehlt in Millimetern von oben links; die Umrechnung
// geschieht an genau einer Stelle je Format.
package ausgabe

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"

	"pnkt.me/pnkt/qr"
)

// mmZuPunkt rechnet Millimeter in die Einheit beider Formate um.
func mmZuPunkt(mm float64) float64 { return mm * 72 / 25.4 }

// Der Kreisbogen wird aus vier Bezierstuecken gebaut. Der Faktor ist die
// uebliche Naeherung; der Fehler liegt unter einem Promille des Radius —
// bei einem Modul von 0,4 mm sind das Bruchteile eines Mikrometers.
const bogen = 0.5522847498307936

// farbe zerlegt eine Hexangabe in die drei Anteile von 0 bis 1.
func farbe(hex string) (r, g, b float64) {
	h := strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if len(h) == 3 {
		h = string([]byte{h[0], h[0], h[1], h[1], h[2], h[2]})
	}
	if len(h) != 6 {
		return 0, 0, 0
	}
	wert := func(s string) float64 {
		z, err := strconv.ParseInt(s, 16, 32)
		if err != nil {
			return 0
		}
		return float64(z) / 255
	}
	return wert(h[0:2]), wert(h[2:4]), wert(h[4:6])
}

// zeichner schreibt Pfadbefehle. PDF und PostScript teilen sich die
// Operatoren m, l und c; nur das Fuellen heisst anders.
type zeichner struct {
	b      bytes.Buffer
	hoehe  float64 // Gesamthoehe in Punkt, zum Umdrehen der Y-Achse
	kurve  string  // "c" in PDF, "curveto" in PostScript
	linie  string
	anfang string
	zu     string
}

func (z *zeichner) punkt(xMm, yMm float64) (float64, float64) {
	return mmZuPunkt(xMm), z.hoehe - mmZuPunkt(yMm)
}

func (z *zeichner) zu2(x, y float64, befehl string) {
	fmt.Fprintf(&z.b, "%.4f %.4f %s\n", x, y, befehl)
}

func (z *zeichner) form(f qr.Form) {
	switch f.Art {
	case qr.ArtKreis:
		x, y := z.punkt(f.X, f.Y)
		r := mmZuPunkt(f.R)
		k := r * bogen
		z.zu2(x+r, y, z.anfang)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x+r, y+k, x+k, y+r, x, y+r, z.kurve)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x-k, y+r, x-r, y+k, x-r, y, z.kurve)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x-r, y-k, x-k, y-r, x, y-r, z.kurve)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x+k, y-r, x+r, y-k, x+r, y, z.kurve)
		z.b.WriteString(z.zu + "\n")

	case qr.ArtRundRechteck:
		// In Punkt gerechnet, danach im Uhrzeigersinn auf dem Blatt.
		x0, y0 := z.punkt(f.X, f.Y+f.H) // links unten
		br, ho := mmZuPunkt(f.B), mmZuPunkt(f.H)
		r := mmZuPunkt(f.R)
		k := r * bogen
		x1, y1 := x0+br, y0+ho

		z.zu2(x0+r, y0, z.anfang)
		z.zu2(x1-r, y0, z.linie)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x1-r+k, y0, x1, y0+r-k, x1, y0+r, z.kurve)
		z.zu2(x1, y1-r, z.linie)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x1, y1-r+k, x1-r+k, y1, x1-r, y1, z.kurve)
		z.zu2(x0+r, y1, z.linie)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x0+r-k, y1, x0, y1-r+k, x0, y1-r, z.kurve)
		z.zu2(x0, y0+r, z.linie)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x0, y0+r-k, x0+r-k, y0, x0+r, y0, z.kurve)
		z.b.WriteString(z.zu + "\n")

	case qr.ArtPolygon:
		for i, p := range f.Punkte {
			x, y := z.punkt(p[0], p[1])
			if i == 0 {
				z.zu2(x, y, z.anfang)
			} else {
				z.zu2(x, y, z.linie)
			}
		}
		z.b.WriteString(z.zu + "\n")

	default:
		x, y := z.punkt(f.X, f.Y+f.H)
		fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f re\n", x, y, mmZuPunkt(f.B), mmZuPunkt(f.H))
	}
}

// --- PDF ------------------------------------------------------------------

// PDF schreibt die Zeichnung als PDF 1.4.
func PDF(z qr.Zeichnung, titel string) []byte {
	breite, hoehe := mmZuPunkt(z.BreiteMm), mmZuPunkt(z.HoeheMm)

	inhalt := &zeichner{hoehe: hoehe, kurve: "c", linie: "l", anfang: "m", zu: "h"}

	if z.Hintergrund != "" {
		r, g, b := farbe(z.Hintergrund)
		fmt.Fprintf(&inhalt.b, "%.4f %.4f %.4f rg\n0 0 %.4f %.4f re\nf\n", r, g, b, breite, hoehe)
	}

	// Nach Farbe gruppiert, damit nicht vor jedem Modul die Farbe neu gesetzt wird.
	nachFarbe := map[string][]qr.Form{}
	var reihenfolge []string
	for _, f := range z.Formen {
		if _, da := nachFarbe[f.Farbe]; !da {
			reihenfolge = append(reihenfolge, f.Farbe)
		}
		nachFarbe[f.Farbe] = append(nachFarbe[f.Farbe], f)
	}

	for _, hex := range reihenfolge {
		r, g, b := farbe(hex)
		fmt.Fprintf(&inhalt.b, "%.4f %.4f %.4f rg\n", r, g, b)
		// Erst alles ohne Aussparung in einem Zug fuellen.
		var voll []qr.Form
		var mitLoch []qr.Form
		for _, f := range nachFarbe[hex] {
			if f.Loch == nil {
				voll = append(voll, f)
			} else {
				mitLoch = append(mitLoch, f)
			}
		}
		if len(voll) > 0 {
			for _, f := range voll {
				inhalt.form(f)
			}
			inhalt.b.WriteString("f\n")
		}
		for _, f := range mitLoch {
			inhalt.form(f)
			inhalt.form(*f.Loch)
			inhalt.b.WriteString("f*\n") // Even-odd: der Ring bleibt offen
		}
	}

	strom := inhalt.b.Bytes()

	var pdf bytes.Buffer
	var stellen []int
	objekt := func(nummer int, koerper string) {
		stellen = append(stellen, pdf.Len())
		fmt.Fprintf(&pdf, "%d 0 obj\n%s\nendobj\n", nummer, koerper)
	}

	pdf.WriteString("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
	objekt(1, "<< /Type /Catalog /Pages 2 0 R >>")
	objekt(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
	objekt(3, fmt.Sprintf(
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.4f %.4f] /Contents 4 0 R /Resources << >> >>",
		breite, hoehe))

	stellen = append(stellen, pdf.Len())
	fmt.Fprintf(&pdf, "4 0 obj\n<< /Length %d >>\nstream\n", len(strom))
	pdf.Write(strom)
	pdf.WriteString("endstream\nendobj\n")

	objekt(5, fmt.Sprintf("<< /Title (%s) /Producer (pnkt) >>", pdfText(titel)))

	xref := pdf.Len()
	fmt.Fprintf(&pdf, "xref\n0 %d\n0000000000 65535 f \n", len(stellen)+1)
	for _, s := range stellen {
		fmt.Fprintf(&pdf, "%010d 00000 n \n", s)
	}
	fmt.Fprintf(&pdf, "trailer\n<< /Size %d /Root 1 0 R /Info 5 0 R >>\nstartxref\n%d\n%%%%EOF\n",
		len(stellen)+1, xref)

	return pdf.Bytes()
}

// pdfText entschaerft Zeichen, die in einer PDF-Zeichenkette stoeren.
func pdfText(s string) string {
	ersetzer := strings.NewReplacer(`\`, `\\`, `(`, `\(`, `)`, `\)`)
	return ersetzer.Replace(s)
}

// --- EPS ------------------------------------------------------------------

// EPS schreibt die Zeichnung als Encapsulated PostScript — das Format,
// das Druckereien fuer Fremddaten noch immer am liebsten annehmen.
func EPS(z qr.Zeichnung, titel string) []byte {
	breite, hoehe := mmZuPunkt(z.BreiteMm), mmZuPunkt(z.HoeheMm)

	var b bytes.Buffer
	b.WriteString("%!PS-Adobe-3.0 EPSF-3.0\n")
	fmt.Fprintf(&b, "%%%%BoundingBox: 0 0 %d %d\n", int(breite+0.999), int(hoehe+0.999))
	fmt.Fprintf(&b, "%%%%HiResBoundingBox: 0 0 %.4f %.4f\n", breite, hoehe)
	fmt.Fprintf(&b, "%%%%Title: %s\n", einzeilig(titel))
	b.WriteString("%%Creator: pnkt\n%%LanguageLevel: 2\n%%EndComments\n")

	if z.Hintergrund != "" {
		r, g, gr := farbe(z.Hintergrund)
		fmt.Fprintf(&b, "%.4f %.4f %.4f setrgbcolor\n0 0 %.4f %.4f rectfill\n", r, g, gr, breite, hoehe)
	}

	nachFarbe := map[string][]qr.Form{}
	var reihenfolge []string
	for _, f := range z.Formen {
		if _, da := nachFarbe[f.Farbe]; !da {
			reihenfolge = append(reihenfolge, f.Farbe)
		}
		nachFarbe[f.Farbe] = append(nachFarbe[f.Farbe], f)
	}

	for _, hex := range reihenfolge {
		r, g, gr := farbe(hex)
		fmt.Fprintf(&b, "%.4f %.4f %.4f setrgbcolor\n", r, g, gr)
		for _, f := range nachFarbe[hex] {
			z := &zeichner{hoehe: hoehe, kurve: "curveto", linie: "lineto", anfang: "moveto", zu: "closepath"}
			b.WriteString("newpath\n")
			psForm(z, f)
			b.Write(z.b.Bytes())
			if f.Loch != nil {
				z2 := &zeichner{hoehe: hoehe, kurve: "curveto", linie: "lineto", anfang: "moveto", zu: "closepath"}
				psForm(z2, *f.Loch)
				b.Write(z2.b.Bytes())
				b.WriteString("eofill\n")
			} else {
				b.WriteString("fill\n")
			}
		}
	}

	b.WriteString("showpage\n%%EOF\n")
	return b.Bytes()
}

// psForm schreibt eine Form in PostScript. Rechtecke haben dort keinen
// eigenen Pfadbefehl wie in PDF, deshalb werden sie als Viereck gezogen.
func psForm(z *zeichner, f qr.Form) {
	if f.Art == qr.ArtRechteck {
		z.form(qr.Form{Art: qr.ArtPolygon, Farbe: f.Farbe, Punkte: [][2]float64{
			{f.X, f.Y}, {f.X + f.B, f.Y}, {f.X + f.B, f.Y + f.H}, {f.X, f.Y + f.H}}})
		return
	}
	z.form(f)
}

func einzeilig(s string) string {
	return strings.NewReplacer("\n", " ", "\r", " ").Replace(s)
}
