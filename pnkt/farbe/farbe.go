// Package farbe kennt die drei Farbwelten, die im Druck vorkommen.
//
// Auf dem Bildschirm ist eine Farbe drei Zahlen. In der Druckerei sind es
// vier — oder ein Topf mit einer Nummer darauf. Wer eine PDF mit
// Bildschirmfarben in den Offsetdruck gibt, bekommt eine Wandlung
// geschenkt, die er nicht kontrolliert: aus dem satten Hausrot wird ein
// stumpfes Ziegelrot, und niemand kann hinterher sagen, wo es passiert ist.
//
// Deshalb tragen Farben hier ihre Herkunft mit:
//
//	#0d0d12                        Bildschirmfarbe
//	cmyk(0, 0.9, 0.8, 0.1)         vier Kanaele, wie die Maschine sie druckt
//	sonder(HKS 13 K, 0, 1, 1, 0)   ein Topf, mit Ersatzrezept fuer alles andere
package farbe

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Art einer Farbe.
const (
	ArtRGB    = "rgb"
	ArtCMYK   = "cmyk"
	ArtSonder = "sonder"
)

// Wert ist eine Farbe samt ihrer Herkunft.
type Wert struct {
	Art     string
	R, G, B float64    // 0 bis 1
	CMYK    [4]float64 // 0 bis 1
	Name    string     // nur bei Sonderfarben
}

// Lies zerlegt eine Farbangabe. Unlesbares wird schwarz — ein Code in
// Schwarz ist immer noch ein Code, ein Code in Nichts waere keiner.
func Lies(angabe string) Wert {
	s := strings.TrimSpace(angabe)

	switch {
	case strings.HasPrefix(s, "sonder(") && strings.HasSuffix(s, ")"):
		teile := strings.Split(s[7:len(s)-1], ",")
		if len(teile) != 5 {
			return schwarz()
		}
		w := Wert{Art: ArtSonder, Name: strings.TrimSpace(teile[0])}
		for i := 0; i < 4; i++ {
			w.CMYK[i] = zahl(teile[i+1])
		}
		w.R, w.G, w.B = cmykZuRGB(w.CMYK)
		return w

	case strings.HasPrefix(s, "cmyk(") && strings.HasSuffix(s, ")"):
		teile := strings.Split(s[5:len(s)-1], ",")
		if len(teile) != 4 {
			return schwarz()
		}
		w := Wert{Art: ArtCMYK}
		for i := 0; i < 4; i++ {
			w.CMYK[i] = zahl(teile[i])
		}
		w.R, w.G, w.B = cmykZuRGB(w.CMYK)
		return w

	default:
		h := strings.TrimPrefix(s, "#")
		if len(h) == 3 {
			h = string([]byte{h[0], h[0], h[1], h[1], h[2], h[2]})
		}
		if len(h) != 6 {
			return schwarz()
		}
		w := Wert{Art: ArtRGB}
		w.R, w.G, w.B = anteil(h[0:2]), anteil(h[2:4]), anteil(h[4:6])
		w.CMYK = rgbZuCMYK(w.R, w.G, w.B)
		return w
	}
}

func schwarz() Wert {
	return Wert{Art: ArtRGB, CMYK: [4]float64{0, 0, 0, 1}}
}

func zahl(s string) float64 {
	f, err := strconv.ParseFloat(strings.TrimSpace(s), 64)
	if err != nil {
		return 0
	}
	if f > 1 { // Prozentangaben sind verbreitet
		f /= 100
	}
	return math.Max(0, math.Min(1, f))
}

func anteil(hex string) float64 {
	z, err := strconv.ParseInt(hex, 16, 32)
	if err != nil {
		return 0
	}
	return float64(z) / 255
}

// cmykZuRGB ist die einfache Umrechnung ohne Farbprofil. Sie taugt fuer
// die Bildschirmvorschau und fuer nichts anderes — welches Rot am Ende
// aus der Maschine kommt, entscheidet das Profil der Druckerei.
func cmykZuRGB(c [4]float64) (r, g, b float64) {
	return (1 - c[0]) * (1 - c[3]), (1 - c[1]) * (1 - c[3]), (1 - c[2]) * (1 - c[3])
}

// rgbZuCMYK rechnet zurueck, mit voller Schwarzanteilbildung.
func rgbZuCMYK(r, g, b float64) [4]float64 {
	k := 1 - math.Max(r, math.Max(g, b))
	if k >= 1 {
		return [4]float64{0, 0, 0, 1}
	}
	return [4]float64{
		(1 - r - k) / (1 - k),
		(1 - g - k) / (1 - k),
		(1 - b - k) / (1 - k),
		k,
	}
}

// Hex gibt die Bildschirmfassung, wie SVG sie braucht.
func (w Wert) Hex() string {
	acht := func(f float64) int { return int(math.Round(math.Max(0, math.Min(1, f)) * 255)) }
	return fmt.Sprintf("#%02x%02x%02x", acht(w.R), acht(w.G), acht(w.B))
}

// Kennung ist der Name, unter dem eine Sonderfarbe in PDF und EPS steht.
// Leerzeichen und Sonderzeichen sind dort nicht erlaubt.
func (w Wert) Kennung() string {
	var b strings.Builder
	for _, r := range w.Name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteByte('#')
			fmt.Fprintf(&b, "%02X", r)
		}
	}
	if b.Len() == 0 {
		return "Sonderfarbe"
	}
	return b.String()
}

// Sonderfarben sammelt die Sonderfarben einer Zeichnung in der
// Reihenfolge ihres ersten Auftretens — Druckdateien brauchen sie
// einmal deklariert, nicht bei jeder Verwendung.
func Sonderfarben(angaben []string) []Wert {
	var aus []Wert
	gesehen := map[string]bool{}
	for _, a := range angaben {
		w := Lies(a)
		if w.Art != ArtSonder || gesehen[w.Name] {
			continue
		}
		gesehen[w.Name] = true
		aus = append(aus, w)
	}
	return aus
}
