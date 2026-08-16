package qr

import "testing"

// Die Kapazitaetstabelle ist die haeufigste Fehlerquelle in einem eigenen
// Encoder. Diese Werte stehen in der Norm und sind hier festgenagelt.
func TestDatenbytes(t *testing.T) {
	faelle := []struct {
		version int
		stufe   Stufe
		soll    int
	}{
		// Datenbytes, nicht Zeichen — die verbreiteten Kapazitaetstabellen
		// nennen Zeichen und weichen deshalb um den Kopf ab.
		{1, L, 19}, {1, M, 16}, {1, Q, 13}, {1, H, 9},
		{2, L, 34}, {5, Q, 62}, {7, H, 66},
		{10, M, 216}, {23, L, 1094}, {40, L, 2956}, {40, H, 1276},
	}
	for _, f := range faelle {
		if ist := Datenbytes(f.version, f.stufe); ist != f.soll {
			t.Errorf("Version %d Stufe %s: %d statt %d", f.version, f.stufe, ist, f.soll)
		}
	}
}

func TestKleinsteVersion(t *testing.T) {
	s, err := Baue("A", L, 0)
	if err != nil {
		t.Fatal(err)
	}
	if s.Version != 1 {
		t.Errorf("ein Zeichen sollte in Version 1 passen, nicht %d", s.Version)
	}
	if s.Kante != 21 {
		t.Errorf("Version 1 hat 21 Module je Kante, nicht %d", s.Kante)
	}
}

func TestZuVielInhalt(t *testing.T) {
	lang := make([]byte, 3000)
	for i := range lang {
		lang[i] = 'x'
	}
	if _, err := Baue(string(lang), H, 0); err == nil {
		t.Error("3000 Zeichen bei Stufe H muessten abgelehnt werden")
	}
}

func TestErzwungeneVersionZuKlein(t *testing.T) {
	if _, err := Baue("viel zu lang fuer Version 1 bei Stufe H, wirklich", H, 1); err == nil {
		t.Error("Version 1 haette nicht reichen duerfen")
	}
}

// Funktionsmuster muessen unabhaengig von Inhalt und Maske stehen.
func TestFunktionsmuster(t *testing.T) {
	s, err := Baue("https://pnkt.me/2cnjdq", M, 0)
	if err != nil {
		t.Fatal(err)
	}
	k := s.Kante

	// Suchmuster: Mitte dunkel, Ring hell.
	for _, e := range [][2]int{{3, 3}, {k - 4, 3}, {3, k - 4}} {
		if !s.Dunkel(e[0], e[1]) {
			t.Errorf("Mitte des Suchmusters bei %v ist hell", e)
		}
	}
	// Taktlinie: abwechselnd, beginnend dunkel bei Spalte 8 (gerade).
	for i := 8; i < k-8; i++ {
		if s.Dunkel(i, 6) != (i%2 == 0) {
			t.Errorf("Taktlinie bei %d falsch", i)
		}
	}
	// Das immer dunkle Modul.
	if !s.Dunkel(8, k-8) {
		t.Error("das immer dunkle Modul fehlt")
	}
}

func TestMaskeImBereich(t *testing.T) {
	for _, inhalt := range []string{"A", "12345", "https://pnkt.me/x", "Grüße"} {
		s, err := Baue(inhalt, M, 0)
		if err != nil {
			t.Fatal(err)
		}
		if s.Maske < 0 || s.Maske > 7 {
			t.Errorf("Maske %d liegt ausserhalb von 0 bis 7", s.Maske)
		}
	}
}

// Die Betriebsart bestimmt, wie viel hineinpasst. Ziffern muessen dichter
// liegen als Bytes, sonst wird still auf Byte umgeschaltet.
func TestBetriebsart(t *testing.T) {
	ziffern, err := Baue("12345678901234567890123456789012345", M, 0)
	if err != nil {
		t.Fatal(err)
	}
	bytes, err := Baue("abcdefghijklmnopqrstuvwxyzabcdefghi", M, 0)
	if err != nil {
		t.Fatal(err)
	}
	if ziffern.Version >= bytes.Version {
		t.Errorf("35 Ziffern (V%d) muessten kleiner ausfallen als 35 Buchstaben (V%d)",
			ziffern.Version, bytes.Version)
	}
}

func TestSVGIstVektor(t *testing.T) {
	s, err := Baue("https://pnkt.me/x", M, 0)
	if err != nil {
		t.Fatal(err)
	}
	svg := s.SVG(StandardGestalt(40))
	for _, muss := range []string{"<svg", "mm", "<path", "</svg>"} {
		if !contains(svg, muss) {
			t.Errorf("im SVG fehlt %q", muss)
		}
	}
	// Kein eingebettetes Rasterbild — sonst waere es kein Vektor.
	if contains(svg, "data:image") || contains(svg, "<image") {
		t.Error("das SVG enthaelt ein Rasterbild")
	}
}

func TestRuhezoneImSVG(t *testing.T) {
	s, _ := Baue("x", M, 0)
	g := StandardGestalt(21) // ein Millimeter je Modul bei Version 1
	svg := s.SVG(g)
	// 21 Module plus zweimal vier Module Ruhezone ergeben 29 mm.
	if !contains(svg, `width="29mm"`) {
		t.Errorf("Ruhezone fehlt im Gesamtmass; SVG beginnt mit %.80s", svg)
	}
}

func contains(h, n string) bool {
	return len(h) >= len(n) && (func() bool {
		for i := 0; i+len(n) <= len(h); i++ {
			if h[i:i+len(n)] == n {
				return true
			}
		}
		return false
	})()
}
