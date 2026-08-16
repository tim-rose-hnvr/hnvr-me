package speicher

import (
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

func neu(t *testing.T) (*Speicher, string) {
	t.Helper()
	verzeichnis := t.TempDir()
	s, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })
	return s, verzeichnis
}

func TestAnlegenUndFinden(t *testing.T) {
	s, _ := neu(t)
	c := &Code{Kuerzel: "abcdef", Ziel: "https://hnvr.me", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	if c.ID == "" {
		t.Error("keine Kennung vergeben")
	}
	if c.Fassung != 1 {
		t.Errorf("erste Fassung sollte 1 sein, ist %d", c.Fassung)
	}
	gefunden, da := s.NachKuerzel("abcdef")
	if !da || gefunden.Ziel != "https://hnvr.me" {
		t.Error("Code nicht ueber das Kuerzel gefunden")
	}
	// Gross- und Kleinschreibung darf nicht trennen: Kuerzel werden
	// von Plakaten abgetippt.
	if _, da := s.NachKuerzel("ABCDEF"); !da {
		t.Error("Kuerzel muss unabhaengig von der Schreibweise finden")
	}
}

// Der wichtigste Test des ganzen Speichers. Ein doppeltes Kuerzel ist bei
// einem gedruckten Code nicht mehr reparierbar.
func TestKuerzelKollision(t *testing.T) {
	s, _ := neu(t)
	if err := s.LegeAn(&Code{Kuerzel: "gleich", Ziel: "https://a.de"}); err != nil {
		t.Fatal(err)
	}
	err := s.LegeAn(&Code{Kuerzel: "gleich", Ziel: "https://b.de"})
	if !errors.Is(err, ErrKuerzelVergeben) {
		t.Errorf("doppeltes Kuerzel muss abgelehnt werden, bekam: %v", err)
	}
	// Auch in anderer Schreibweise.
	err = s.LegeAn(&Code{Kuerzel: "GLEICH", Ziel: "https://c.de"})
	if !errors.Is(err, ErrKuerzelVergeben) {
		t.Errorf("Kollision in anderer Schreibweise nicht erkannt: %v", err)
	}
}

func TestAendernZaehltFassung(t *testing.T) {
	s, _ := neu(t)
	c := &Code{Kuerzel: "aendern", Ziel: "https://alt.de"}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	neuC, err := s.Aendere(c.ID, func(x *Code) error {
		x.Ziel = "https://neu.de"
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if neuC.Fassung != 2 {
		t.Errorf("Fassung sollte 2 sein, ist %d", neuC.Fassung)
	}
	gefunden, _ := s.NachKuerzel("aendern")
	if gefunden.Ziel != "https://neu.de" {
		t.Error("Aenderung nicht wirksam")
	}
}

// Die Ablage muss einen Neustart ueberstehen — sie ist die einzige Wahrheit.
func TestNeustart(t *testing.T) {
	verzeichnis := t.TempDir()
	s, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	c := &Code{Kuerzel: "bleibt", Ziel: "https://erst.de"}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Aendere(c.ID, func(x *Code) error { x.Ziel = "https://dann.de"; return nil }); err != nil {
		t.Fatal(err)
	}
	s.Zaehle(c.ID, []string{"geraet:iphone"}, time.Now())
	s.Schliesse()

	wieder, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	defer wieder.Schliesse()

	gefunden, da := wieder.NachKuerzel("bleibt")
	if !da {
		t.Fatal("Code nach Neustart verschwunden")
	}
	if gefunden.Ziel != "https://dann.de" {
		t.Errorf("nach Neustart gilt %q statt der letzten Fassung", gefunden.Ziel)
	}
	if gefunden.Fassung != 2 {
		t.Errorf("Fassung nach Neustart %d statt 2", gefunden.Fassung)
	}
	if stand := wieder.Zaehlerstand(c.ID); len(stand) != 1 || stand[0].Gesamt != 1 {
		t.Error("Zaehlerstand hat den Neustart nicht ueberlebt")
	}
}

// Ein Stromausfall mitten im Schreiben darf die Ablage nicht unlesbar machen.
func TestAbgeschnitteneZeile(t *testing.T) {
	verzeichnis := t.TempDir()
	s, _ := Oeffne(verzeichnis)
	if err := s.LegeAn(&Code{Kuerzel: "heil", Ziel: "https://heil.de"}); err != nil {
		t.Fatal(err)
	}
	s.Schliesse()

	f, err := os.OpenFile(verzeichnis+"/codes.jsonl", os.O_APPEND|os.O_WRONLY, 0o640)
	if err != nil {
		t.Fatal(err)
	}
	f.WriteString(`{"id":"halb","kuerzel":"kaputt","zi`)
	f.Close()

	wieder, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatalf("abgeschnittene Zeile darf das Oeffnen nicht verhindern: %v", err)
	}
	defer wieder.Schliesse()
	if _, da := wieder.NachKuerzel("heil"); !da {
		t.Error("der vollstaendige Satz davor fehlt")
	}
	if _, da := wieder.NachKuerzel("kaputt"); da {
		t.Error("der unvollstaendige Satz wurde uebernommen")
	}
}

func TestZaehlerInKlassen(t *testing.T) {
	s, _ := neu(t)
	c := &Code{Kuerzel: "zaehlen", Ziel: "https://z.de"}
	s.LegeAn(c)
	jetzt := time.Now()
	s.Zaehle(c.ID, []string{"geraet:iphone", "system:apple"}, jetzt)
	s.Zaehle(c.ID, []string{"geraet:android", "system:android"}, jetzt)

	stand := s.Zaehlerstand(c.ID)
	if len(stand) != 1 {
		t.Fatalf("erwartet eine Tageszeile, sind %d", len(stand))
	}
	if stand[0].Gesamt != 2 {
		t.Errorf("Gesamt %d statt 2", stand[0].Gesamt)
	}
	if stand[0].Zaehler["geraet:iphone"] != 1 {
		t.Error("Klasse nicht gezaehlt")
	}
	// Nichts im Zaehler darf eine Person kennzeichnen.
	for schluessel := range stand[0].Zaehler {
		if strings.Contains(schluessel, ".") {
			t.Errorf("verdaechtiger Schluessel im Zaehler: %q", schluessel)
		}
	}
}

func TestKuerzelAlphabet(t *testing.T) {
	for i := 0; i < 200; i++ {
		k := BaueKuerzel(6)
		if len(k) != 6 {
			t.Fatalf("Laenge %d statt 6", len(k))
		}
		if strings.ContainsAny(k, "01lIoO5S8B") {
			t.Fatalf("verwechselbares Zeichen in %q", k)
		}
	}
}

func TestFreiesKuerzelWeichtAus(t *testing.T) {
	s, _ := neu(t)
	k := s.FreiesKuerzel()
	if err := s.LegeAn(&Code{Kuerzel: k, Ziel: "https://a.de"}); err != nil {
		t.Fatal(err)
	}
	if zweites := s.FreiesKuerzel(); zweites == k {
		t.Error("dasselbe Kuerzel zweimal vergeben")
	}
}
