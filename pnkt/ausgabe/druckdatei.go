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
	"math"
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
		// In Punkt gerechnet, danach gegen den Uhrzeigersinn auf dem Blatt.
		// Die Eckradien kommen aus der Zeichnung: bei fliessenden Modulen
		// ist nur die Ecke gerundet, an der kein Nachbar anschliesst.
		x0, y0 := z.punkt(f.X, f.Y+f.H) // links unten
		br, ho := mmZuPunkt(f.B), mmZuPunkt(f.H)
		x1, y1 := x0+br, y0+ho

		e := f.EckenOderR()
		// Reihenfolge der Zeichnung ist links oben, rechts oben, rechts
		// unten, links unten; auf dem Blatt zaehlt Y von unten.
		lu, ru := mmZuPunkt(e[3]), mmZuPunkt(e[2])
		ro, lo := mmZuPunkt(e[1]), mmZuPunkt(e[0])

		z.zu2(x0+lu, y0, z.anfang)
		z.zu2(x1-ru, y0, z.linie)
		if ru > 0 {
			k := ru * bogen
			fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x1-ru+k, y0, x1, y0+ru-k, x1, y0+ru, z.kurve)
		}
		z.zu2(x1, y1-ro, z.linie)
		if ro > 0 {
			k := ro * bogen
			fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x1, y1-ro+k, x1-ro+k, y1, x1-ro, y1, z.kurve)
		}
		z.zu2(x0+lo, y1, z.linie)
		if lo > 0 {
			k := lo * bogen
			fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x0+lo-k, y1, x0, y1-lo+k, x0, y1-lo, z.kurve)
		}
		z.zu2(x0, y0+lu, z.linie)
		if lu > 0 {
			k := lu * bogen
			fmt.Fprintf(&z.b, "%.4f %.4f %.4f %.4f %.4f %.4f %s\n", x0, y0+lu-k, x0+lu-k, y0, x0+lu, y0, z.kurve)
		}
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

// verlaufsachsePt liefert die beiden Endpunkte des Verlaufs in Punkt,
// bezogen auf die Codeflaeche und mit umgedrehter Y-Achse.
func verlaufsachsePt(z qr.Zeichnung, hoehe float64) (x1, y1, x2, y2 float64) {
	mx := (z.CodeVon[0] + z.CodeBis[0]) / 2
	my := (z.CodeVon[1] + z.CodeBis[1]) / 2
	halb := (z.CodeBis[0] - z.CodeVon[0]) / 2
	w := z.Verlauf.Winkel * math.Pi / 180
	dx, dy := math.Cos(w)*halb, math.Sin(w)*halb
	return mmZuPunkt(mx - dx), hoehe - mmZuPunkt(my-dy),
		mmZuPunkt(mx + dx), hoehe - mmZuPunkt(my+dy)
}

// pdfUebergang baut die Funktion, die einen Wert von 0 bis 1 auf eine
// Farbe abbildet. Zwei Haltepunkte sind eine Funktion vom Typ 2, mehr
// werden mit Typ 3 aneinandergenaeht.
func pdfUebergang(haelt []qr.Halt) string {
	teil := func(a, b qr.Halt) string {
		r1, g1, b1 := farbe(a.Farbe)
		r2, g2, b2 := farbe(b.Farbe)
		return fmt.Sprintf("<< /FunctionType 2 /Domain [0 1] /C0 [%.4f %.4f %.4f] "+
			"/C1 [%.4f %.4f %.4f] /N 1 >>", r1, g1, b1, r2, g2, b2)
	}
	if len(haelt) == 2 {
		return teil(haelt[0], haelt[1])
	}
	var teile, grenzen, bereiche []string
	for i := 0; i+1 < len(haelt); i++ {
		teile = append(teile, teil(haelt[i], haelt[i+1]))
		bereiche = append(bereiche, "0 1")
		if i > 0 {
			grenzen = append(grenzen, fmt.Sprintf("%.4f", haelt[i].Pos))
		}
	}
	return fmt.Sprintf("<< /FunctionType 3 /Domain [0 1] /Functions [%s] "+
		"/Bounds [%s] /Encode [%s] >>",
		strings.Join(teile, " "), strings.Join(grenzen, " "), strings.Join(bereiche, " "))
}

// PDF schreibt die Zeichnung als PDF 1.4.
func PDF(z qr.Zeichnung, titel string) []byte {
	breite, hoehe := mmZuPunkt(z.BreiteMm), mmZuPunkt(z.HoeheMm)

	inhalt := &zeichner{hoehe: hoehe, kurve: "c", linie: "l", anfang: "m", zu: "h"}

	if z.Hintergrund != "" {
		r, g, b := farbe(z.Hintergrund)
		fmt.Fprintf(&inhalt.b, "%.4f %.4f %.4f rg\n0 0 %.4f %.4f re\nf\n", r, g, b, breite, hoehe)
	}

	nachFarbe := map[string][]qr.Form{}
	var reihenfolge []string
	var texte []qr.Form
	for _, f := range z.Formen {
		if f.Art == qr.ArtText {
			texte = append(texte, f)
			continue
		}
		if _, da := nachFarbe[f.Farbe]; !da {
			reihenfolge = append(reihenfolge, f.Farbe)
		}
		nachFarbe[f.Farbe] = append(nachFarbe[f.Farbe], f)
	}

	for _, hex := range reihenfolge {
		var voll, mitLoch []qr.Form
		for _, f := range nachFarbe[hex] {
			if f.Loch == nil {
				voll = append(voll, f)
			} else {
				mitLoch = append(mitLoch, f)
			}
		}

		if hex == qr.VerlaufMarke && z.Verlauf != nil {
			// Der Verlauf wird nicht je Modul gemalt, sondern einmal ueber
			// die gesamte Flaeche — beschnitten auf die Module. Sonst
			// bekaeme jedes Modul denselben Ausschnitt und der Verlauf
			// waere keiner.
			inhalt.b.WriteString("q\n")
			for _, f := range voll {
				inhalt.form(f)
			}
			for _, f := range mitLoch {
				inhalt.form(f)
				inhalt.form(*f.Loch)
			}
			inhalt.b.WriteString("W* n\n/Sh0 sh\nQ\n")
			continue
		}

		r, g, b := farbe(hex)
		fmt.Fprintf(&inhalt.b, "%.4f %.4f %.4f rg\n", r, g, b)
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

	for _, t := range texte {
		r, g, b := farbe(t.Farbe)
		groesse := mmZuPunkt(t.Groesse)
		// Helvetica-Bold ist im Mittel gut halb so breit wie hoch. Genauer
		// ginge es nur mit den Breitentabellen der Schrift; fuer eine
		// mittige Aufforderung reicht die Naeherung.
		breiteText := float64(len(t.Text)) * groesse * 0.58
		x, y := mmZuPunkt(t.X)-breiteText/2, hoehe-mmZuPunkt(t.Y)
		fmt.Fprintf(&inhalt.b, "BT\n%.4f %.4f %.4f rg\n/F1 %.4f Tf\n%.4f %.4f Td\n(%s) Tj\nET\n",
			r, g, b, groesse, x, y, pdfText(t.Text))
	}

	strom := inhalt.b.Bytes()

	mittel := ""
	if z.Verlauf != nil {
		x1, y1, x2, y2 := verlaufsachsePt(z, hoehe)
		art := "/ShadingType 2 /Coords [%.4f %.4f %.4f %.4f]"
		koord := fmt.Sprintf(art, x1, y1, x2, y2)
		if z.Verlauf.Art == "radial" {
			mx := mmZuPunkt((z.CodeVon[0] + z.CodeBis[0]) / 2)
			my := hoehe - mmZuPunkt((z.CodeVon[1]+z.CodeBis[1])/2)
			r := mmZuPunkt((z.CodeBis[0] - z.CodeVon[0]) / 2)
			koord = fmt.Sprintf("/ShadingType 3 /Coords [%.4f %.4f 0 %.4f %.4f %.4f]", mx, my, mx, my, r)
		}
		mittel = fmt.Sprintf("/Shading << /Sh0 << %s /ColorSpace /DeviceRGB /Function %s "+
			"/Extend [true true] >> >>", koord, pdfUebergang(z.Verlauf.Haelt))
	}
	schrift := ""
	if len(texte) > 0 {
		schrift = "/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold " +
			"/Encoding /WinAnsiEncoding >> >>"
	}

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
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.4f %.4f] /Contents 4 0 R "+
			"/Resources << %s %s >> >>", breite, hoehe, mittel, schrift))

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
	return ersetzer.Replace(latin1(s))
}

// latin1 wandelt Text in die Kodierung, die die eingebauten Schriften von
// PDF und PostScript erwarten. Go haelt Zeichenketten als UTF-8; ein
// Umlaut sind dort zwei Byte, und genau die zeigt eine Latin-1-Schrift
// als zwei falsche Zeichen. Ohne diese Wandlung wird aus "Gruesse" mit
// Umlaut im Druck ein Buchstabensalat — auf dem Bildschirm faellt es
// niemandem auf, weil SVG UTF-8 kann.
func latin1(s string) string {
	// Typografische Zeichen, die es in Latin-1 nicht gibt, werden zu
	// ihrer naechsten Entsprechung — lieber ein gerader Strich als ein
	// Fragezeichen mitten in der Aufforderung.
	s = strings.NewReplacer(
		"\u2013", "-", "\u2014", "-", "\u2018", "'", "\u2019", "'",
		"\u201a", ",", "\u201c", `"`, "\u201d", `"`, "\u201e", `"`,
		"\u2026", "...", "\u00a0", " ", "\u20ac", "EUR",
	).Replace(s)

	var b strings.Builder
	for _, r := range s {
		if r < 0x100 {
			b.WriteByte(byte(r))
		} else {
			b.WriteByte('?')
		}
	}
	return b.String()
}

// --- EPS ------------------------------------------------------------------

// EPS schreibt die Zeichnung als Encapsulated PostScript — das Format,
// das Druckereien fuer Fremddaten noch immer am liebsten annehmen.
func EPS(z qr.Zeichnung, titel string) []byte {
	breite, hoehe := mmZuPunkt(z.BreiteMm), mmZuPunkt(z.HoeheMm)

	stufe := "2"
	if z.Verlauf != nil {
		// Verlaeufe brauchen shfill, und das gibt es erst ab Stufe 3.
		stufe = "3"
	}

	var b bytes.Buffer
	b.WriteString("%!PS-Adobe-3.0 EPSF-3.0\n")
	fmt.Fprintf(&b, "%%%%BoundingBox: 0 0 %d %d\n", int(breite+0.999), int(hoehe+0.999))
	fmt.Fprintf(&b, "%%%%HiResBoundingBox: 0 0 %.4f %.4f\n", breite, hoehe)
	fmt.Fprintf(&b, "%%%%Title: %s\n", einzeilig(titel))
	fmt.Fprintf(&b, "%%%%Creator: pnkt\n%%%%LanguageLevel: %s\n%%%%EndComments\n", stufe)

	if z.Hintergrund != "" {
		r, g, gr := farbe(z.Hintergrund)
		fmt.Fprintf(&b, "%.4f %.4f %.4f setrgbcolor\n0 0 %.4f %.4f rectfill\n", r, g, gr, breite, hoehe)
	}

	nachFarbe := map[string][]qr.Form{}
	var reihenfolge []string
	var texte []qr.Form
	for _, f := range z.Formen {
		if f.Art == qr.ArtText {
			texte = append(texte, f)
			continue
		}
		if _, da := nachFarbe[f.Farbe]; !da {
			reihenfolge = append(reihenfolge, f.Farbe)
		}
		nachFarbe[f.Farbe] = append(nachFarbe[f.Farbe], f)
	}

	neuerZeichner := func() *zeichner {
		return &zeichner{hoehe: hoehe, kurve: "curveto", linie: "lineto",
			anfang: "moveto", zu: "closepath"}
	}

	for _, hex := range reihenfolge {
		if hex == qr.VerlaufMarke && z.Verlauf != nil {
			// Erst alle Module zu einem Pfad, daraus die Beschneidung,
			// dann der Verlauf einmal darueber.
			b.WriteString("gsave\nnewpath\n")
			for _, f := range nachFarbe[hex] {
				zz := neuerZeichner()
				psForm(zz, f)
				b.Write(zz.b.Bytes())
				if f.Loch != nil {
					z2 := neuerZeichner()
					psForm(z2, *f.Loch)
					b.Write(z2.b.Bytes())
				}
			}
			b.WriteString("eoclip\n")
			b.WriteString(psVerlauf(z, hoehe))
			b.WriteString("grestore\n")
			continue
		}

		r, g, gr := farbe(hex)
		fmt.Fprintf(&b, "%.4f %.4f %.4f setrgbcolor\n", r, g, gr)
		for _, f := range nachFarbe[hex] {
			zz := neuerZeichner()
			b.WriteString("newpath\n")
			psForm(zz, f)
			b.Write(zz.b.Bytes())
			if f.Loch != nil {
				z2 := neuerZeichner()
				psForm(z2, *f.Loch)
				b.Write(z2.b.Bytes())
				b.WriteString("eofill\n")
			} else {
				b.WriteString("fill\n")
			}
		}
	}

	for _, t := range texte {
		r, g, gr := farbe(t.Farbe)
		groesse := mmZuPunkt(t.Groesse)
		x, y := mmZuPunkt(t.X), hoehe-mmZuPunkt(t.Y)
		// PostScript kann die Breite selbst messen — hier wird nichts
		// geschaetzt, anders als im PDF.
		fmt.Fprintf(&b, "%.4f %.4f %.4f setrgbcolor\n", r, g, gr)
		// Die eingebaute Schrift traegt ab Werk StandardEncoding und kennt
		// dort keine Umlaute. Erst die Umkodierung macht sie brauchbar.
		b.WriteString("/Helvetica-Bold findfont dup length dict begin\n" +
			"  { 1 index /FID ne { def } { pop pop } ifelse } forall\n" +
			"  /Encoding ISOLatin1Encoding def currentdict end\n" +
			"/pnkt-Beschriftung exch definefont pop\n")
		fmt.Fprintf(&b, "/pnkt-Beschriftung findfont %.4f scalefont setfont\n", groesse)
		fmt.Fprintf(&b, "(%s) dup stringwidth pop 2 div %.4f exch sub %.4f moveto show\n",
			psText(t.Text), x, y)
	}

	b.WriteString("showpage\n%%EOF\n")
	return b.Bytes()
}

// psVerlauf schreibt die Schattierung. Stufe 3 kennt shfill; aeltere
// Belichter koennen das nicht, deshalb steht die Stufe im Kopf.
func psVerlauf(z qr.Zeichnung, hoehe float64) string {
	v := z.Verlauf
	teil := func(a, b qr.Halt) string {
		r1, g1, b1 := farbe(a.Farbe)
		r2, g2, b2 := farbe(b.Farbe)
		return fmt.Sprintf("<< /FunctionType 2 /Domain [0 1] /C0 [%.4f %.4f %.4f] "+
			"/C1 [%.4f %.4f %.4f] /N 1 >>", r1, g1, b1, r2, g2, b2)
	}
	funktion := teil(v.Haelt[0], v.Haelt[1])
	if len(v.Haelt) > 2 {
		var teile, grenzen, bereiche []string
		for i := 0; i+1 < len(v.Haelt); i++ {
			teile = append(teile, teil(v.Haelt[i], v.Haelt[i+1]))
			bereiche = append(bereiche, "0 1")
			if i > 0 {
				grenzen = append(grenzen, fmt.Sprintf("%.4f", v.Haelt[i].Pos))
			}
		}
		funktion = fmt.Sprintf("<< /FunctionType 3 /Domain [0 1] /Functions [%s] "+
			"/Bounds [%s] /Encode [%s] >>",
			strings.Join(teile, " "), strings.Join(grenzen, " "), strings.Join(bereiche, " "))
	}

	if v.Art == "radial" {
		mx := mmZuPunkt((z.CodeVon[0] + z.CodeBis[0]) / 2)
		my := hoehe - mmZuPunkt((z.CodeVon[1]+z.CodeBis[1])/2)
		r := mmZuPunkt((z.CodeBis[0] - z.CodeVon[0]) / 2)
		return fmt.Sprintf("<< /ShadingType 3 /ColorSpace /DeviceRGB "+
			"/Coords [%.4f %.4f 0 %.4f %.4f %.4f] /Function %s /Extend [true true] >> shfill\n",
			mx, my, mx, my, r, funktion)
	}
	x1, y1, x2, y2 := verlaufsachsePt(z, hoehe)
	return fmt.Sprintf("<< /ShadingType 2 /ColorSpace /DeviceRGB "+
		"/Coords [%.4f %.4f %.4f %.4f] /Function %s /Extend [true true] >> shfill\n",
		x1, y1, x2, y2, funktion)
}

// psText schuetzt Klammern und Schraegstriche in einer PostScript-Zeichenkette.
func psText(s string) string {
	return strings.NewReplacer(`\`, `\\`, `(`, `\(`, `)`, `\)`).Replace(latin1(s))
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
