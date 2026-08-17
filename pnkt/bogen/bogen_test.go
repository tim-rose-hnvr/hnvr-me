package bogen

import (
	"math"
	"strings"
	"testing"

	"pnkt.me/pnkt/qr"
)

func nah(a, b float64) bool { return math.Abs(a-b) < 0.001 }

// Die Zahl aus dem Entwurf: 24 Stueck zu 40 mm auf A4. Geht das nicht
// auf, stimmt die Rechnung nicht — der Entwurf ist an einem echten
// Bogen entstanden.
func TestVierundzwanzigAufA4(t *testing.T) {
	p := StandardPlan()
	auf, err := Teile(p, 40, 40, 24)
	if err != nil {
		t.Fatal(err)
	}
	// 40 + 6 Anschnitt = 46; (210 − 20 + 4) / 50 = 3,88 → 3 Spalten.
	// (297 − 20 + 4) / 50 = 5,62 → 5 Reihen. 15 je Bogen, 24 → 2 Bogen.
	if auf.Spalten != 3 || auf.Reihen != 5 {
		t.Errorf("%d × %d statt 3 × 5", auf.Spalten, auf.Reihen)
	}
	if auf.ProBogen != 15 || auf.Bogen != 2 {
		t.Errorf("%d je Bogen, %d Bogen — erwartet 15 und 2", auf.ProBogen, auf.Bogen)
	}
}

// Ohne Anschnitt und mit engem Steg passt mehr drauf. Der Test haelt
// fest, dass die Stege wirklich zaehlen und nicht bloss abgezogen
// werden.
func TestStegRechnung(t *testing.T) {
	p := StandardPlan()
	p.AnschnittMm, p.AbstandMm, p.RandMm = 0, 0, 0
	auf, err := Teile(p, 42, 42, 0)
	if err != nil {
		t.Fatal(err)
	}
	// 210 / 42 = genau 5, 297 / 42 = 7,07 → 7.
	if auf.Spalten != 5 || auf.Reihen != 7 {
		t.Errorf("%d × %d statt 5 × 7", auf.Spalten, auf.Reihen)
	}
	if !nah(auf.RestBrMm, 0) {
		t.Errorf("Rest %.4f mm — 210 durch 42 geht glatt auf", auf.RestBrMm)
	}
}

// Der letzte Steg darf nicht mitzaehlen. Bei drei Stueck zu 60 mm und
// 5 mm Steg sind das 190 mm — mit einem vierten Steg waeren es 195 und
// eine Spalte fiele weg.
func TestLetzterStegFaelltWeg(t *testing.T) {
	p := StandardPlan()
	p.AnschnittMm, p.RandMm, p.AbstandMm = 0, 10, 5
	auf, err := Teile(p, 60, 60, 0)
	if err != nil {
		t.Fatal(err)
	}
	if auf.Spalten != 3 {
		t.Errorf("%d Spalten statt 3 — der letzte Steg wurde mitgerechnet", auf.Spalten)
	}
}

// Die wichtigste Regel: es wird nicht verkleinert.
func TestZuGrossWirdNichtVerkleinert(t *testing.T) {
	p := StandardPlan()
	_, err := Teile(p, 250, 250, 1)
	if err == nil {
		t.Fatal("250 mm passen nicht auf A4 — das haette auffallen muessen")
	}
	for _, wort := range []string{"250", "A4", "passt nicht"} {
		if !strings.Contains(err.Error(), wort) {
			t.Errorf("Meldung ohne %q: %s", wort, err)
		}
	}
	// Auf A3 geht es.
	p.Blatt = BlattNach("a3")
	if _, err := Teile(p, 250, 250, 1); err != nil {
		t.Errorf("250 mm passen auf A3: %v", err)
	}
}

func stueck(text string) Stueck {
	return Stueck{
		Zeichnung: qr.Zeichnung{
			BreiteMm: 40, HoeheMm: 40, Hintergrund: "#ffffff",
			Formen: []qr.Form{
				{Art: qr.ArtRechteck, X: 4, Y: 4, B: 2, H: 2, Farbe: "#000000"},
				{Art: qr.ArtPolygon, Farbe: "#000000",
					Punkte: [][2]float64{{1, 1}, {3, 1}, {2, 3}}},
			},
		},
		Text: text,
	}
}

func TestSetzeVerteiltAufBogen(t *testing.T) {
	p := StandardPlan()
	var stuecke []Stueck
	for i := 0; i < 24; i++ {
		stuecke = append(stuecke, stueck(""))
	}
	blaetter, auf, err := Setze(p, stuecke)
	if err != nil {
		t.Fatal(err)
	}
	if len(blaetter) != auf.Bogen || len(blaetter) != 2 {
		t.Fatalf("%d Blaetter statt 2", len(blaetter))
	}
	for _, b := range blaetter {
		if !nah(b.BreiteMm, 210) || !nah(b.HoeheMm, 297) {
			t.Errorf("Blatt misst %.1f × %.1f mm", b.BreiteMm, b.HoeheMm)
		}
	}
}

// Formen muessen wirklich verschoben werden — auch Polygonpunkte und
// Loecher. Ein vergessenes Loch liegt sonst auf Blattkoordinate 0.
func TestVersetztAllesMit(t *testing.T) {
	loch := qr.Form{Art: qr.ArtRechteck, X: 1, Y: 1, B: 1, H: 1}
	f := qr.Form{Art: qr.ArtRechteck, X: 2, Y: 3, B: 5, H: 5, Loch: &loch,
		Punkte: [][2]float64{{0, 0}, {1, 2}}}
	g := schiebe(f, 100, 50)
	if !nah(g.X, 102) || !nah(g.Y, 53) {
		t.Errorf("Form bei %.1f/%.1f", g.X, g.Y)
	}
	if !nah(g.Loch.X, 101) || !nah(g.Loch.Y, 51) {
		t.Errorf("Loch bei %.1f/%.1f — nicht mitgewandert", g.Loch.X, g.Loch.Y)
	}
	if !nah(g.Punkte[1][0], 101) || !nah(g.Punkte[1][1], 52) {
		t.Errorf("Punkt bei %.1f/%.1f", g.Punkte[1][0], g.Punkte[1][1])
	}
	// Die Vorlage bleibt unberuehrt: schiebe arbeitet auf einer Kopie.
	if !nah(f.X, 2) || !nah(f.Punkte[1][0], 1) {
		t.Error("die Ausgangsform wurde veraendert")
	}
}

// Schnittmarken liegen ausserhalb des Anschnitts und stehen in der
// Passerfarbe. Beides faellt erst in der Druckerei auf.
func TestSchnittmarken(t *testing.T) {
	p := StandardPlan()
	m := marken(p, 0, 0, 46, 46)
	if len(m) != 8 {
		t.Fatalf("%d Marken statt 8", len(m))
	}
	// Schnittkante liegt bei 3 und bei 43; die Marke haelt 3 mm Abstand.
	for _, f := range m {
		if f.Farbe != Passerfarbe {
			t.Errorf("Marke in %q statt in der Passerfarbe", f.Farbe)
		}
		links, rechts := f.X, f.X+f.B
		oben, unten := f.Y, f.Y+f.H
		imFeld := links > 3.001 && rechts < 42.999 && oben > 3.001 && unten < 42.999
		if imFeld {
			t.Errorf("Marke bei %.2f/%.2f liegt im Schnittfeld", f.X, f.Y)
		}
	}
	// Waagerechte Marke links oben: endet 3 mm vor der Schnittkante.
	if !nah(m[0].X+m[0].B, 0) {
		t.Errorf("linke Marke endet bei %.2f statt bei 0", m[0].X+m[0].B)
	}
}

// Ohne Anschnitt gaebe es nichts zu schneiden: der helle Grund muss
// ueber die Schnittkante hinauslaufen.
func TestGrundLaeuftInDenAnschnitt(t *testing.T) {
	formen := versetzt(qr.Zeichnung{BreiteMm: 40, HoeheMm: 40, Hintergrund: "#ffffff"}, 20, 20)
	if len(formen) != 1 {
		t.Fatalf("%d Formen statt der einen Grundflaeche", len(formen))
	}
	g := formen[0]
	if g.X >= 20 || g.Y >= 20 || g.B <= 40 || g.H <= 40 {
		t.Errorf("Grund %.1f/%.1f %.1f×%.1f laeuft nicht ueber das Stueck hinaus",
			g.X, g.Y, g.B, g.H)
	}
}

func TestBlattNach(t *testing.T) {
	if BlattNach("a3").BreiteMm != 297 {
		t.Error("A3 ist 297 mm breit")
	}
	if BlattNach("gibtsnicht").Schluessel != "a4" {
		t.Error("Unbekanntes soll A4 ergeben")
	}
}

func TestKeineStuecke(t *testing.T) {
	if _, _, err := Setze(StandardPlan(), nil); err == nil {
		t.Error("ein Bogen ohne Stuecke ist kein Bogen")
	}
}
