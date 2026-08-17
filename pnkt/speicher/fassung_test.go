package speicher

import (
	"errors"
	"strings"
	"testing"
)

func codeMitGeschichte(t *testing.T) (*Speicher, *Code) {
	t.Helper()
	s, err := Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })

	c := &Code{Kuerzel: "abc123", KontoID: "org", Name: "Sommerkarte",
		Ziel: "https://x.de/sommer", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	for _, ziel := range []string{"https://x.de/herbst", "https://x.de/winter"} {
		if _, err := s.Aendere(c.ID, func(k *Code) error { k.Ziel = ziel; return nil }); err != nil {
			t.Fatal(err)
		}
	}
	jetzt, _ := s.NachID(c.ID)
	return s, jetzt
}

func TestFassungenStehenAufDerPlatte(t *testing.T) {
	s, c := codeMitGeschichte(t)
	f, err := s.Fassungen(c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(f) != 3 {
		t.Fatalf("%d Fassungen statt 3", len(f))
	}
	if f[0].Ziel != "https://x.de/sommer" || f[2].Ziel != "https://x.de/winter" {
		t.Errorf("Reihenfolge: %s … %s", f[0].Ziel, f[2].Ziel)
	}
	if f[0].Fassung != 1 || f[2].Fassung != 3 {
		t.Errorf("Nummern %d … %d", f[0].Fassung, f[2].Fassung)
	}
}

func TestFassungenFremderCode(t *testing.T) {
	s, _ := codeMitGeschichte(t)
	if _, err := s.Fassungen("gibtsnicht"); err == nil {
		t.Error("ein unbekannter Code hat keine Fassungen")
	}
}

// Zurueckholen schreibt eine neue Fassung. Der Zaehler laeuft nicht
// zurueck — sonst bekaeme die Geschichte ein Loch.
func TestHoleSchreibtNeueFassung(t *testing.T) {
	s, c := codeMitGeschichte(t)
	neu, err := s.Hole(c.ID, 1, "test")
	if err != nil {
		t.Fatal(err)
	}
	if neu.Ziel != "https://x.de/sommer" {
		t.Errorf("Ziel %q", neu.Ziel)
	}
	if neu.Fassung != 4 {
		t.Errorf("Fassung %d statt 4 — der Zaehler ist zurueckgelaufen", neu.Fassung)
	}
	if neu.Kuerzel != c.Kuerzel {
		t.Errorf("Kuerzel %q — es steht auf Papier und darf sich nie aendern", neu.Kuerzel)
	}

	f, _ := s.Fassungen(c.ID)
	if len(f) != 4 {
		t.Errorf("%d Fassungen statt 4", len(f))
	}

	// Und der Vorgang steht im Protokoll.
	eintraege, err := s.Protokoll(c.ID)
	if err != nil {
		t.Fatal(err)
	}
	gefunden := false
	for _, e := range eintraege {
		if e.Was == "code.zurueckgeholt" {
			gefunden = true
			if !strings.Contains(e.Neu, "Fassung 1") {
				t.Errorf("Eintrag nennt die Quelle nicht: %+v", e)
			}
			if e.Alt != "https://x.de/winter" {
				t.Errorf("Eintrag ohne den vorigen Stand: %+v", e)
			}
		}
	}
	if !gefunden {
		t.Error("kein Protokolleintrag")
	}
}

func TestHoleUnbekannteFassung(t *testing.T) {
	s, c := codeMitGeschichte(t)
	_, err := s.Hole(c.ID, 9, "test")
	if err == nil {
		t.Fatal("Fassung 9 gibt es nicht")
	}
	// Die Meldung nennt, was es gibt — sonst muss man raten.
	if !strings.Contains(err.Error(), "1, 2, 3") {
		t.Errorf("Meldung ohne die vorhandenen Nummern: %s", err)
	}
}

func TestHoleGleicheFassung(t *testing.T) {
	s, c := codeMitGeschichte(t)
	_, err := s.Hole(c.ID, 3, "test")
	if !errors.Is(err, ErrSchonAktuell) {
		t.Errorf("Fehler %v — die geltende Fassung noch einmal zu holen ist ein Leerlauf", err)
	}
	f, _ := s.Fassungen(c.ID)
	if len(f) != 3 {
		t.Errorf("%d Fassungen — es wurde trotzdem geschrieben", len(f))
	}
}

// Loeschen wird durch Abtippen des Kuerzels bestaetigt. Es darf nicht
// nebenbei durch „zurueckholen" rueckgaengig gemacht werden.
func TestGeloeschtesWirdNichtZurueckgeholt(t *testing.T) {
	s, c := codeMitGeschichte(t)
	if _, err := s.Loesche(c.ID); err != nil {
		t.Fatal(err)
	}
	_, err := s.Hole(c.ID, 1, "test")
	if err == nil {
		t.Fatal("ein geloeschter Code wurde zurueckgeholt")
	}
	if !strings.Contains(err.Error(), "geloescht") {
		t.Errorf("Meldung: %s", err)
	}
	// Und das Kuerzel bleibt gesperrt.
	if k, da := s.NachKuerzel("abc123"); !da || !k.Geloescht {
		t.Error("das Kuerzel ist nicht mehr gesperrt")
	}
}

// Ein abgeschalteter Code bleibt abgeschaltet: wer ihn stillgelegt hat,
// will ihn nicht durch ein Zurueckholen wieder anschalten.
func TestHoleSchaltetNichtAn(t *testing.T) {
	s, c := codeMitGeschichte(t)
	if _, err := s.Aendere(c.ID, func(k *Code) error { k.Aktiv = false; return nil }); err != nil {
		t.Fatal(err)
	}
	neu, err := s.Hole(c.ID, 1, "test")
	if err != nil {
		t.Fatal(err)
	}
	if neu.Aktiv {
		t.Error("das Zurueckholen hat den Code wieder angeschaltet")
	}
	if neu.Ziel != "https://x.de/sommer" {
		t.Errorf("Ziel %q", neu.Ziel)
	}
}
