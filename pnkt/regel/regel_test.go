package regel

import (
	"testing"
	"time"
)

func zeit(s string) time.Time {
	t, _ := time.Parse(time.RFC3339, s)
	return t
}

func werk() Werk {
	return Werk{
		Standard: "https://a.de", Zone: "Europe/Berlin",
		Regeln: []Einzelregel{
			{Art: "zeitraum", Von: "2026-12-01", Bis: "2026-12-26", Ziel: "https://advent.de"},
			{Art: "land", Werte: []string{"AT", "CH"}, Ziel: "https://at.de"},
			{Art: "zeit", Tage: []int{6, 7}, Von: "00:00", Bis: "24:00", Ziel: "https://wochenende.de"},
			{Art: "sprache", Werte: []string{"en"}, Ziel: "https://en.de"},
			{Art: "geraet", Werte: []string{"iphone", "ipad"}, Ziel: "https://apple.de"},
		},
	}
}

func TestReihenfolgeEntscheidet(t *testing.T) {
	// Der 5. Dezember 2026 ist ein Samstag und faellt in den Zeitraum.
	// Die Liste gibt dem Zeitraum den Vorrang, weil er oben steht.
	e := Waehle(werk(), Umstand{Jetzt: zeit("2026-12-05T12:00:00Z"), Land: "AT"})
	if e.Ziel != "https://advent.de" || e.Nr != 1 {
		t.Errorf("erste zutreffende Regel muss gewinnen, war %+v", e)
	}
}

func TestJedeArt(t *testing.T) {
	faelle := []struct {
		name string
		u    Umstand
		soll string
	}{
		{"Land", Umstand{Jetzt: zeit("2026-08-19T12:00:00Z"), Land: "CH"}, "https://at.de"},
		{"Wochenende", Umstand{Jetzt: zeit("2026-08-22T12:00:00Z")}, "https://wochenende.de"},
		{"Sprache", Umstand{Jetzt: zeit("2026-08-19T12:00:00Z"), Sprache: "en-GB"}, "https://en.de"},
		{"Geraet", Umstand{Jetzt: zeit("2026-08-19T12:00:00Z"), Geraet: "ipad"}, "https://apple.de"},
		{"Standard", Umstand{Jetzt: zeit("2026-08-19T12:00:00Z")}, "https://a.de"},
	}
	for _, f := range faelle {
		if e := Waehle(werk(), f.u); e.Ziel != f.soll {
			t.Errorf("%s: %q statt %q (Grund %s)", f.name, e.Ziel, f.soll, e.Grund)
		}
	}
}

func TestSonntagIstDerSiebteTag(t *testing.T) {
	// Go zaehlt Sonntag als 0, die Schnittstelle als 7.
	w := Werk{Standard: "https://a.de", Regeln: []Einzelregel{
		{Art: "zeit", Tage: []int{7}, Ziel: "https://sonntag.de"}}}
	if e := Waehle(w, Umstand{Jetzt: zeit("2026-08-23T12:00:00Z")}); e.Ziel != "https://sonntag.de" {
		t.Errorf("Sonntag nicht erkannt: %+v", e)
	}
}

func TestZeitzoneGiltFuerDenKunden(t *testing.T) {
	// 23:30 Uhr in London ist 00:30 des Folgetags in Berlin.
	w := Werk{Standard: "https://tag.de", Zone: "Europe/Berlin", Regeln: []Einzelregel{
		{Art: "zeit", Von: "00:00", Bis: "06:00", Ziel: "https://nacht.de"}}}
	if e := Waehle(w, Umstand{Jetzt: zeit("2026-08-19T22:30:00Z")}); e.Ziel != "https://nacht.de" {
		t.Errorf("Zeitzone nicht angewandt: %+v", e)
	}
}

func TestLetzterTagZaehltMit(t *testing.T) {
	w := Werk{Standard: "https://a.de", Regeln: []Einzelregel{
		{Art: "zeitraum", Von: "2026-12-01", Bis: "2026-12-26", Ziel: "https://advent.de"}}}
	if e := Waehle(w, Umstand{Jetzt: zeit("2026-12-26T18:00:00Z")}); e.Ziel != "https://advent.de" {
		t.Error("der letzte Tag eines Zeitraums muss ganz mitzaehlen")
	}
	if e := Waehle(w, Umstand{Jetzt: zeit("2026-12-28T12:00:00Z")}); e.Ziel != "https://a.de" {
		t.Error("nach dem Zeitraum gilt der Standard")
	}
}

func TestKampagneMitPlatzhaltern(t *testing.T) {
	utm := map[string]string{"utm_source": "plakat", "utm_medium": "print",
		"utm_term": "{land}-{geraet}"}
	got := Kampagne("https://a.de", utm,
		Umstand{Jetzt: zeit("2026-08-19T12:00:00Z"), Land: "DE", Geraet: "iphone"}, "abc123")
	soll := "https://a.de?utm_source=plakat&utm_medium=print&utm_term=DE-iphone"
	if got != soll {
		t.Errorf("Kampagne falsch:\n  ist  %s\n  soll %s", got, soll)
	}
}

func TestKampagneBleibtStabil(t *testing.T) {
	utm := map[string]string{"utm_campaign": "c", "utm_source": "s", "utm_medium": "m"}
	erste := Kampagne("https://a.de", utm, Umstand{}, "k")
	for i := 0; i < 20; i++ {
		if Kampagne("https://a.de", utm, Umstand{}, "k") != erste {
			t.Fatal("die Reihenfolge der Parameter muss gleich bleiben, sonst sind Auswertungen unvergleichbar")
		}
	}
}

func TestKampagneUeberschreibtNicht(t *testing.T) {
	got := Kampagne("https://a.de?utm_source=alt", map[string]string{"utm_source": "neu"}, Umstand{}, "k")
	if got != "https://a.de?utm_source=alt" {
		t.Errorf("vorhandener Parameter wurde ueberschrieben: %s", got)
	}
}

func TestPlatzhalterOhneAngabe(t *testing.T) {
	got := Kampagne("https://a.de", map[string]string{"utm_term": "{land}"}, Umstand{}, "k")
	if got != "https://a.de?utm_term=xx" {
		t.Errorf("fehlendes Land muss zu xx werden, ist %s", got)
	}
}
