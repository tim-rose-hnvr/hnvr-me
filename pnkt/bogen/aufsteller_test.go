package bogen

import (
	"strings"
	"testing"

	"pnkt.me/pnkt/qr"
)

func symbol(t *testing.T) *qr.Symbol {
	t.Helper()
	s, err := qr.Baue("https://pnkt.me/abc123", qr.M, 0)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAufstellerMassUndInhalt(t *testing.T) {
	s := symbol(t)
	karte := KarteNach("a6")
	z := Aufsteller(s, qr.StandardGestalt(40), karte,
		Aufstellertext{Ueberschrift: "Speisekarte", Aufforderung: "Jetzt scannen",
			Fuss: "Tisch 12"}, "#f5ead8", "#201e1d", "#8c491a")

	if z.BreiteMm != 105 || z.HoeheMm != 148 {
		t.Errorf("Karte misst %.0f × %.0f mm", z.BreiteMm, z.HoeheMm)
	}
	var texte []qr.Form
	for _, f := range z.Formen {
		if f.Art == qr.ArtText {
			texte = append(texte, f)
		}
	}
	if len(texte) != 3 {
		t.Fatalf("%d Textzeilen statt 3", len(texte))
	}
	for _, f := range texte {
		if f.X != 52.5 {
			t.Errorf("%q steht bei %.1f statt mittig", f.Text, f.X)
		}
		if f.Y < 0 || f.Y > karte.HoeheMm {
			t.Errorf("%q steht bei %.1f — ausserhalb der Karte", f.Text, f.Y)
		}
	}
}

// Die Kantenlaenge des Codes kommt aus dem Format, nicht aus dem, was
// im Studio eingestellt war. Ein Tischaufsteller wird aus 30 cm
// gelesen; ein 100-mm-Code darauf ist Unsinn.
func TestKarteBestimmtDieKante(t *testing.T) {
	s := symbol(t)
	g := qr.StandardGestalt(100) // absichtlich viel zu gross
	z := Aufsteller(s, g, KarteNach("a7"), Aufstellertext{}, "", "", "")
	// A7 gibt 28 mm plus Ruhezone.
	if z.BreiteMm != 74 {
		t.Fatalf("Karte %.0f mm", z.BreiteMm)
	}
	breiteste := 0.0
	for _, f := range z.Formen {
		if f.X+f.B > breiteste {
			breiteste = f.X + f.B
		}
	}
	if breiteste > 74 {
		t.Errorf("etwas ragt bis %.1f mm ueber die Karte hinaus", breiteste)
	}
}

// Leere Zeilen entfallen, und die uebrigen ruecken nach — sonst klafft
// dort, wo keine Ueberschrift steht, ein Loch.
func TestLeereZeilenEntfallen(t *testing.T) {
	s := symbol(t)
	mit := Aufsteller(s, qr.StandardGestalt(40), KarteNach("a6"),
		Aufstellertext{Ueberschrift: "A", Aufforderung: "B", Fuss: "C"}, "", "", "")
	ohne := Aufsteller(s, qr.StandardGestalt(40), KarteNach("a6"),
		Aufstellertext{}, "", "", "")

	zaehle := func(z qr.Zeichnung) int {
		n := 0
		for _, f := range z.Formen {
			if f.Art == qr.ArtText {
				n++
			}
		}
		return n
	}
	if zaehle(mit) != 3 || zaehle(ohne) != 0 {
		t.Errorf("%d und %d Textzeilen", zaehle(mit), zaehle(ohne))
	}
	// Ohne Text steht der Code mittig auf der Karte — er bleibt nicht
	// unter einer Ueberschrift stehen, die es nicht gibt.
	oben, unten := senkrechteLuft(ohne)
	if diff := oben - unten; diff > 1 || diff < -1 {
		t.Errorf("oben %.1f mm, unten %.1f mm — der Code steht nicht mittig", oben, unten)
	}
}

// Die Zeilen stehen in Lesereihenfolge und nichts ueberlappt: die
// Ueberschrift ueber dem Code, die Aufforderung darunter, der Fuss
// zuunterst.
func TestReihenfolgeAufDerKarte(t *testing.T) {
	s := symbol(t)
	for _, schluessel := range []string{"a7", "a6", "a5", "quadrat10"} {
		karte := KarteNach(schluessel)
		z := Aufsteller(s, qr.StandardGestalt(40), karte,
			Aufstellertext{Ueberschrift: "Speisekarte", Aufforderung: "Jetzt scannen",
				Fuss: "Tisch 12"}, "", "", "")
		var kopf, ruf, fuss float64
		for _, f := range z.Formen {
			switch f.Text {
			case "Speisekarte":
				kopf = f.Y
			case "Jetzt scannen":
				ruf = f.Y
			case "Tisch 12":
				fuss = f.Y
			}
		}
		codeOben, codeUnten := senkrechteLuft(z)
		codeUnten = karte.HoeheMm - codeUnten

		if kopf >= codeOben {
			t.Errorf("%s: Ueberschrift bei %.1f, Code ab %.1f — sie liegt im Code",
				schluessel, kopf, codeOben)
		}
		if ruf <= codeUnten {
			t.Errorf("%s: Aufforderung bei %.1f, Code bis %.1f — sie liegt im Code",
				schluessel, ruf, codeUnten)
		}
		if fuss <= ruf {
			t.Errorf("%s: Fuss bei %.1f steht nicht unter der Aufforderung bei %.1f",
				schluessel, fuss, ruf)
		}
		if fuss > karte.HoeheMm {
			t.Errorf("%s: Fuss bei %.1f liegt unter der Kartenkante %.1f",
				schluessel, fuss, karte.HoeheMm)
		}
	}
}

// senkrechteLuft misst, wie viel Karte ueber und unter der Codeflaeche
// liegt.
func senkrechteLuft(z qr.Zeichnung) (oben, unten float64) {
	hoch, tief := 1e9, -1e9
	for _, f := range z.Formen {
		if f.Art == qr.ArtText {
			continue
		}
		if f.Y < hoch {
			hoch = f.Y
		}
		if f.Y+f.H > tief {
			tief = f.Y + f.H
		}
	}
	return hoch, z.HoeheMm - tief
}

func TestKuerze(t *testing.T) {
	if k := kuerze("kurz", 10); k != "kurz" {
		t.Errorf("%q", k)
	}
	lang := strings.Repeat("x", 50)
	k := kuerze(lang, 10)
	if len([]rune(k)) != 10 || !strings.HasSuffix(k, "…") {
		t.Errorf("%q hat %d Zeichen", k, len([]rune(k)))
	}
	if k := kuerze("  Rand  ", 20); k != "Rand" {
		t.Errorf("%q", k)
	}
}

func TestKarteNach(t *testing.T) {
	if KarteNach("a7").BreiteMm != 74 {
		t.Error("A7 ist 74 mm breit")
	}
	if KarteNach("gibtsnicht").Schluessel != "a6" {
		t.Error("Unbekanntes soll A6 ergeben")
	}
}

// Zwoelf Aufsteller im Format A7 gehen auf einen A4-Bogen: das ist der
// Fall, fuer den die Serie gebaut ist.
func TestAufstellerSerie(t *testing.T) {
	s := symbol(t)
	var karten []qr.Zeichnung
	var namen []string
	for i := 0; i < 12; i++ {
		karten = append(karten, Aufsteller(s, qr.StandardGestalt(40), KarteNach("a7"),
			Aufstellertext{Ueberschrift: "Karte", Aufforderung: "Scannen"}, "", "", ""))
		namen = append(namen, "Tisch")
	}
	p := StandardPlan()
	blaetter, auf, err := AufstellerSerie(p, KarteNach("a7"), karten, namen)
	if err != nil {
		t.Fatal(err)
	}
	if auf.ProBogen < 1 {
		t.Fatalf("nichts passt auf den Bogen: %+v", auf)
	}
	if len(blaetter) != auf.Bogen {
		t.Errorf("%d Blaetter, aber %d angekuendigt", len(blaetter), auf.Bogen)
	}
}

func TestAufstellerSerieUngleichLang(t *testing.T) {
	s := symbol(t)
	karte := Aufsteller(s, qr.StandardGestalt(40), KarteNach("a7"), Aufstellertext{}, "", "", "")
	_, _, err := AufstellerSerie(StandardPlan(), KarteNach("a7"),
		[]qr.Zeichnung{karte, karte}, []string{"nur einer"})
	if err == nil {
		t.Error("zwei Karten und eine Beschriftung gehen nicht auf")
	}
}
