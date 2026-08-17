package seite

import (
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

func karte() *speicher.Seite {
	return &speicher.Seite{
		Vorlage: "karte", Titel: "Sommerkarte", Unter: "Täglich ab 17 Uhr",
		Bloecke: []speicher.Block{{Titel: "Kleinigkeiten", Zeilen: []speicher.Zeile{
			{Was: "Flammkuchen", Neben: "9,50 €", Dazu: "Speck & Zwiebel"},
		}}},
		Handlung: &speicher.Handlung{Text: "Ganze Karte", Ziel: "https://example.de/karte"},
		Fuss:     "Allergene auf Nachfrage",
	}
}

func zeichne(t *testing.T, s *speicher.Seite) string {
	t.Helper()
	roh, err := Zeichne(s, speicher.StandardMarke(), "/r/abc123/weiter")
	if err != nil {
		t.Fatal(err)
	}
	return string(roh)
}

func TestZeichneInhalt(t *testing.T) {
	h := zeichne(t, karte())
	for _, muss := range []string{
		"<title>Sommerkarte</title>", "Sommerkarte", "Täglich ab 17 Uhr",
		"Kleinigkeiten", "Flammkuchen", "9,50 €", "Allergene auf Nachfrage",
		`href="/r/abc123/weiter"`, "Ganze Karte",
		"/gestalt/organic.css", "/marke.svg",
	} {
		if !strings.Contains(h, muss) {
			t.Errorf("Seite ohne %q", muss)
		}
	}
	// Das kaufmaennische Und muss maskiert sein, sonst ist es eine
	// kaputte Entitaet.
	if !strings.Contains(h, "Speck &amp; Zwiebel") {
		t.Error("das Und wurde nicht maskiert")
	}
}

// Der wichtigste Test dieser Datei: fremder Text darf nicht aus seinem
// Platz ausbrechen. Die Inhalte kommen von Kunden, nicht aus dem
// Programm.
func TestFremderTextBrichtNichtAus(t *testing.T) {
	boese := `</title><script>alert('x')</script>`
	s := karte()
	s.Titel = boese
	s.Unter = boese
	s.Bloecke[0].Titel = boese
	s.Bloecke[0].Zeilen[0].Was = boese
	s.Bloecke[0].Zeilen[0].Neben = boese
	s.Bloecke[0].Zeilen[0].Dazu = boese
	s.Handlung.Text = boese
	s.Fuss = boese

	h := zeichne(t, s)
	if strings.Contains(h, "<script>") {
		t.Fatal("ein <script> steht unmaskiert in der Seite")
	}
	if strings.Contains(h, "</title><") {
		t.Error("der Titel wurde nicht maskiert")
	}
	// Und der Text ist trotzdem lesbar angekommen.
	if !strings.Contains(h, "&lt;script&gt;") && !strings.Contains(h, "\\u003cscript\\u003e") {
		t.Errorf("der Text fehlt ganz statt maskiert zu sein")
	}
}

// html/template kennt Adressen und wirft ein fremdes Schema selbst
// heraus. Das ist die zweite Schranke — die erste ist PruefeZiel beim
// Speichern. Zwei Schranken, weil eine Seite auch aus einer aelteren
// Ablage kommen kann, die noch ohne Pruefung geschrieben wurde.
func TestUnerlaubtesSchemaWirdEntschaerft(t *testing.T) {
	s := karte()
	s.Vorlage = "verweise"
	s.Bloecke[0].Zeilen[0].Ziel = "javascript:alert(1)"
	h := zeichne(t, s)
	if strings.Contains(h, "href=\"javascript:") {
		t.Error("javascript: steht als href in der Seite")
	}
	if !strings.Contains(h, "ZgotmplZ") {
		t.Logf("Ausgabe: %s", h)
		t.Error("html/template hat die Adresse nicht entschaerft")
	}
}

func TestVorlagenUnterscheidenSich(t *testing.T) {
	plan := karte()
	plan.Vorlage = "veranstaltung"
	if !strings.Contains(zeichne(t, plan), `class="block plan"`) {
		t.Error("das Programm bekommt keine eigene Anordnung")
	}
	if strings.Contains(zeichne(t, karte()), `class="block plan"`) {
		t.Error("die Karte bekommt die Anordnung des Programms")
	}

	weg := karte()
	weg.Vorlage = "verweise"
	weg.Bloecke[0].Zeilen[0].Ziel = "https://example.de/a"
	h := zeichne(t, weg)
	if !strings.Contains(h, `<div class="weg">`) || !strings.Contains(h, `href="https://example.de/a"`) {
		t.Error("der Wegweiser hat keine Verweise")
	}
	if !strings.Contains(h, `rel="noopener nofollow"`) {
		t.Error("die Verweise tragen kein rel — fremde Ziele sollen nicht mitzaehlen")
	}
}

// Ohne Knopf keine Knopfzeile: eine leere Flaeche, auf die man tippen
// kann und die nichts tut, ist schlimmer als keine.
func TestOhneHandlungKeinKnopf(t *testing.T) {
	s := karte()
	s.Handlung = nil
	h := zeichne(t, s)
	if strings.Contains(h, `class="tun"`) {
		t.Error("Knopf ohne Handlung")
	}
}

// Absaetze entstehen an Leerzeilen, nicht an jedem Umbruch: im
// Eingabefeld bricht der Text dort um, wo das Feld endet.
func TestAbsaetze(t *testing.T) {
	got := absaetze("eins\nnoch eins\n\nzwei\n\n\n  \n\ndrei")
	will := []string{"eins\nnoch eins", "zwei", "drei"}
	if len(got) != len(will) {
		t.Fatalf("%d Absaetze: %q", len(got), got)
	}
	for i := range will {
		if got[i] != will[i] {
			t.Errorf("%d: %q statt %q", i, got[i], will[i])
		}
	}
}

// Die Seite laedt nichts von aussen. Das ist die Zusage, unter der sie
// gebaut ist — und der Test, der sie haelt.
func TestNichtsVonAussen(t *testing.T) {
	h := zeichne(t, karte())
	for _, verboten := range []string{"http://", "//fonts.", "googleapis", "<script"} {
		if strings.Contains(h, verboten) {
			t.Errorf("die Seite enthaelt %q", verboten)
		}
	}
	// https:// darf nur im Ziel des Knopfes stehen, das der Kunde
	// gesetzt hat — sonst nirgends.
	ohneZiel := karte()
	ohneZiel.Handlung = nil
	if strings.Contains(zeichne(t, ohneZiel), "https://") {
		t.Error("die Seite verweist von sich aus nach draussen")
	}
}
