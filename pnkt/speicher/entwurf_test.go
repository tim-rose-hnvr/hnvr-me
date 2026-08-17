package speicher

import (
	"strings"
	"testing"
)

func codeFuerEntwuerfe(t *testing.T) (*Speicher, *Code) {
	t.Helper()
	s, err := Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })
	c := &Code{Kuerzel: "abc123", KontoID: "org", Ziel: "https://x.de", Aktiv: true,
		Stil: map[string]any{"modulform": "quadrat"}}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	return s, c
}

func TestEntwurfSichernUndLesen(t *testing.T) {
	s, c := codeFuerEntwuerfe(t)
	neu, err := s.SichereEntwurf(c.ID, "Terrakotta", map[string]any{"modulform": "weich"})
	if err != nil {
		t.Fatal(err)
	}
	if len(neu.Entwuerfe) != 1 || neu.Entwuerfe[0].Name != "Terrakotta" {
		t.Fatalf("%+v", neu.Entwuerfe)
	}
	if neu.Entwuerfe[0].Erstellt.IsZero() {
		t.Error("ohne Zeitstempel")
	}
	// Die geltende Gestaltung bleibt, wie sie war: Sichern ist kein
	// Uebernehmen.
	if neu.Stil["modulform"] != "quadrat" {
		t.Errorf("Stil %v — das Sichern hat ihn veraendert", neu.Stil)
	}
}

// Zweimal derselbe Name waere im Streifen nicht auseinanderzuhalten.
func TestGleicherNameErsetzt(t *testing.T) {
	s, c := codeFuerEntwuerfe(t)
	if _, err := s.SichereEntwurf(c.ID, "A", map[string]any{"modulform": "weich"}); err != nil {
		t.Fatal(err)
	}
	neu, err := s.SichereEntwurf(c.ID, "a", map[string]any{"modulform": "rund"})
	if err != nil {
		t.Fatal(err)
	}
	if len(neu.Entwuerfe) != 1 {
		t.Fatalf("%d Entwuerfe statt 1", len(neu.Entwuerfe))
	}
	if neu.Entwuerfe[0].Stil["modulform"] != "rund" {
		t.Errorf("der Entwurf wurde nicht ersetzt: %v", neu.Entwuerfe[0].Stil)
	}
}

func TestEntwurfOhneNamenUndOhneStil(t *testing.T) {
	s, c := codeFuerEntwuerfe(t)
	if _, err := s.SichereEntwurf(c.ID, "  ", map[string]any{"a": "b"}); err == nil {
		t.Error("ein Entwurf ohne Namen wurde angenommen")
	}
	if _, err := s.SichereEntwurf(c.ID, "A", nil); err == nil {
		t.Error("ein Entwurf ohne Gestaltung wurde angenommen")
	}
	if _, err := s.SichereEntwurf(c.ID, strings.Repeat("x", 41),
		map[string]any{"a": "b"}); err == nil {
		t.Error("ein zu langer Name wurde angenommen")
	}
}

func TestHoechstzahlEntwuerfe(t *testing.T) {
	s, c := codeFuerEntwuerfe(t)
	for i := 0; i < HoechstEntwuerfe; i++ {
		if _, err := s.SichereEntwurf(c.ID, string(rune('a'+i)),
			map[string]any{"modulform": "weich"}); err != nil {
			t.Fatalf("beim %d.: %v", i+1, err)
		}
	}
	_, err := s.SichereEntwurf(c.ID, "zuviel", map[string]any{"modulform": "weich"})
	if err == nil {
		t.Fatal("der neunte wurde angenommen")
	}
	if !strings.Contains(err.Error(), "entfernen") {
		t.Errorf("die Meldung sagt nicht, was zu tun ist: %s", err)
	}
}

// Uebernehmen setzt die geltende Gestaltung — und laesst den Entwurf
// stehen. Sonst waere der vorige Stand nach dem ersten Klick weg.
func TestEntwurfUebernehmen(t *testing.T) {
	s, c := codeFuerEntwuerfe(t)
	if _, err := s.SichereEntwurf(c.ID, "Terrakotta",
		map[string]any{"modulform": "weich", "vordergrund": "#c67139"}); err != nil {
		t.Fatal(err)
	}
	neu, err := s.UebernimmEntwurf(c.ID, "terrakotta")
	if err != nil {
		t.Fatal(err)
	}
	if neu.Stil["modulform"] != "weich" || neu.Stil["vordergrund"] != "#c67139" {
		t.Errorf("Stil %v", neu.Stil)
	}
	if len(neu.Entwuerfe) != 1 {
		t.Errorf("der Entwurf ist beim Uebernehmen verschwunden")
	}
	if _, err := s.UebernimmEntwurf(c.ID, "gibtsnicht"); err == nil {
		t.Error("ein unbekannter Entwurf wurde uebernommen")
	}
}

func TestEntwurfLoeschen(t *testing.T) {
	s, c := codeFuerEntwuerfe(t)
	for _, n := range []string{"A", "B"} {
		if _, err := s.SichereEntwurf(c.ID, n, map[string]any{"modulform": "weich"}); err != nil {
			t.Fatal(err)
		}
	}
	neu, err := s.LoescheEntwurf(c.ID, "a")
	if err != nil {
		t.Fatal(err)
	}
	if len(neu.Entwuerfe) != 1 || neu.Entwuerfe[0].Name != "B" {
		t.Errorf("%+v", neu.Entwuerfe)
	}
	if _, err := s.LoescheEntwurf(c.ID, "gibtsnicht"); err == nil {
		t.Error("ein unbekannter Entwurf wurde geloescht")
	}
}

func TestEntwuerfeUeberlebenNeuladen(t *testing.T) {
	verzeichnis := t.TempDir()
	s, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	c := &Code{Kuerzel: "abc123", KontoID: "org", Ziel: "https://x.de", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SichereEntwurf(c.ID, "Terrakotta",
		map[string]any{"modulform": "weich"}); err != nil {
		t.Fatal(err)
	}
	s.Schliesse()

	wieder, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	defer wieder.Schliesse()
	geladen, _ := wieder.NachKuerzel("abc123")
	if len(geladen.Entwuerfe) != 1 || geladen.Entwuerfe[0].Stil["modulform"] != "weich" {
		t.Errorf("nach dem Neuladen: %+v", geladen.Entwuerfe)
	}
}
