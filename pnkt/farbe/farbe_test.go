package farbe

import "math"
import "testing"

func nah(a, b float64) bool { return math.Abs(a-b) < 0.01 }

func TestHex(t *testing.T) {
	w := Lies("#a82e23")
	if w.Art != ArtRGB || !nah(w.R, 0.659) || !nah(w.G, 0.180) || !nah(w.B, 0.137) {
		t.Errorf("Hex falsch gelesen: %+v", w)
	}
	if k := Lies("#000000").CMYK; k != [4]float64{0, 0, 0, 1} {
		t.Errorf("Schwarz muss reines K sein, ist %v", k)
	}
	if Lies("#fff").Hex() != "#ffffff" {
		t.Error("Kurzschreibweise nicht erkannt")
	}
}

func TestCMYK(t *testing.T) {
	w := Lies("cmyk(0, 1, 1, 0)")
	if w.Art != ArtCMYK {
		t.Fatalf("Art %q statt cmyk", w.Art)
	}
	if !nah(w.R, 1) || !nah(w.G, 0) || !nah(w.B, 0) {
		t.Errorf("Vollton Magenta und Gelb muessten Rot ergeben: %s", w.Hex())
	}
	// Prozentangaben sind in der Vorstufe verbreitet.
	if p := Lies("cmyk(0, 100, 100, 0)"); p.CMYK != w.CMYK {
		t.Errorf("Prozentangabe weicht ab: %v gegen %v", p.CMYK, w.CMYK)
	}
}

func TestSonderfarbe(t *testing.T) {
	w := Lies("sonder(HKS 13 K, 0, 1, 1, 0)")
	if w.Art != ArtSonder || w.Name != "HKS 13 K" {
		t.Fatalf("Sonderfarbe falsch gelesen: %+v", w)
	}
	if w.CMYK != [4]float64{0, 1, 1, 0} {
		t.Errorf("Ersatzrezept falsch: %v", w.CMYK)
	}
	// Der Name muss in PDF und EPS ohne Leerzeichen auskommen.
	if k := w.Kennung(); k != "HKS#2013#20K" {
		t.Errorf("Kennung %q enthaelt unerlaubte Zeichen oder ist falsch kodiert", k)
	}
}

func TestUnlesbaresWirdSchwarz(t *testing.T) {
	for _, s := range []string{"", "keine farbe", "cmyk(1,2)", "sonder(nur name)"} {
		w := Lies(s)
		if w.Hex() != "#000000" {
			t.Errorf("%q haette schwarz werden muessen, ist %s", s, w.Hex())
		}
	}
}

func TestSonderfarbenSammeln(t *testing.T) {
	liste := Sonderfarben([]string{
		"#000000", "sonder(HKS 13 K, 0,1,1,0)", "cmyk(0,0,0,1)",
		"sonder(HKS 13 K, 0,1,1,0)", "sonder(Pantone 286 C, 1,0.6,0,0)",
	})
	if len(liste) != 2 {
		t.Fatalf("erwartet zwei verschiedene Sonderfarben, sind %d", len(liste))
	}
	if liste[0].Name != "HKS 13 K" || liste[1].Name != "Pantone 286 C" {
		t.Errorf("Reihenfolge oder Namen falsch: %v", liste)
	}
}

func TestRundlauf(t *testing.T) {
	// Hex zu CMYK und zurueck darf nicht driften.
	for _, hex := range []string{"#000000", "#ffffff", "#a82e23", "#4f39f6"} {
		w := Lies(hex)
		zurueck := Lies(w.Hex())
		if zurueck.Hex() != hex {
			t.Errorf("%s wurde zu %s", hex, zurueck.Hex())
		}
	}
}
