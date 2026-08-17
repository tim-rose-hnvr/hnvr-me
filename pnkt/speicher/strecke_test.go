package speicher

import (
	"strings"
	"testing"
	"time"
)

// Der Knopf auf einer Landeseite ist ein zweiter Schritt desselben
// Scans, kein zweiter Scan. Zaehlte er mit, haette eine Seite mit Knopf
// ploetzlich mehr Scans als der gedruckte Code hergibt — und die Rate
// waere nicht mehr auszurechnen, weil der Nenner den Zaehler enthielte.
func TestSchrittErhoehtNichtDieScans(t *testing.T) {
	s, err := Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })

	c := &Code{Kuerzel: "abc123", KontoID: "org", Ziel: "https://x.de", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)

	s.Zaehle(c.ID, []string{"geraet:iphone"}, jetzt)
	s.Zaehle(c.ID, []string{"geraet:iphone"}, jetzt)
	stand := s.ZaehleSchritt(c.ID, []string{"schritt:weiter"}, jetzt)
	if stand != 2 {
		t.Errorf("nach dem Schritt stehen %d Scans statt 2", stand)
	}

	z := s.Zaehlerstand(c.ID)
	if len(z) != 1 {
		t.Fatalf("%d Tage", len(z))
	}
	if z[0].Gesamt != 2 {
		t.Errorf("Gesamt %d statt 2", z[0].Gesamt)
	}
	if z[0].Zaehler["schritt:weiter"] != 1 {
		t.Errorf("der Schritt wurde nicht gezaehlt: %v", z[0].Zaehler)
	}
}

// Der Schritt darf nicht in der Klassenliste auftauchen: dort stuenden
// Prozentwerte ueber hundert, weil er dieselben Leute ein zweites Mal
// zaehlt.
func TestSchrittStehtNichtBeiDenKlassen(t *testing.T) {
	s, org, c := ablageMitSeite(t)
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 40; i++ {
		s.Zaehle(c.ID, []string{"geraet:iphone", "stunde:12"}, jetzt)
	}
	for i := 0; i < 10; i++ {
		s.ZaehleSchritt(c.ID, []string{"schritt:weiter"}, jetzt)
	}

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -6), jetzt)
	if _, da := u.Klassen["schritt"]; da {
		t.Error("der Schritt steht in der Klassenliste")
	}
	if u.Gesamt != 40 {
		t.Errorf("%d Scans statt 40", u.Gesamt)
	}
	if u.SeitenScans != 40 || u.Weiter != 10 {
		t.Errorf("Strecke: %d Scans, %d weiter", u.SeitenScans, u.Weiter)
	}
	if u.Codes[0].Weiter != 10 || !u.Codes[0].MitSeite {
		t.Errorf("Codezeile: %+v", u.Codes[0])
	}
	if !strings.Contains(u.Aussage, "25 Prozent") {
		t.Errorf("die Rate fehlt im Satz: %s", u.Aussage)
	}
}

// Ein Code ohne Landeseite hat keinen Knopf und gehoert nicht in den
// Nenner der Rate.
func TestNurSeitenZaehlenInDieRate(t *testing.T) {
	s, org, mit := ablageMitSeite(t)
	ohne := &Code{Kuerzel: "ohne", KontoID: org, Ziel: "https://x.de", Aktiv: true}
	if err := s.LegeAn(ohne); err != nil {
		t.Fatal(err)
	}
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 30; i++ {
		s.Zaehle(mit.ID, []string{"geraet:iphone"}, jetzt)
		s.Zaehle(ohne.ID, []string{"geraet:iphone"}, jetzt)
	}
	for i := 0; i < 15; i++ {
		s.ZaehleSchritt(mit.ID, []string{"schritt:weiter"}, jetzt)
	}

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -6), jetzt)
	if u.Gesamt != 60 {
		t.Errorf("%d Scans statt 60", u.Gesamt)
	}
	if u.SeitenScans != 30 {
		t.Errorf("%d Scans im Nenner statt 30 — der Code ohne Seite zaehlt mit", u.SeitenScans)
	}
	if !strings.Contains(u.Aussage, "50 Prozent") {
		t.Errorf("Satz: %s", u.Aussage)
	}
}

// Aus vier Scans und einem Knopfdruck wird keine Rate.
func TestKeineRateBeiKleinerZahl(t *testing.T) {
	s, org, c := ablageMitSeite(t)
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	for i := 0; i < 4; i++ {
		s.Zaehle(c.ID, []string{"geraet:iphone"}, jetzt)
	}
	s.ZaehleSchritt(c.ID, []string{"schritt:weiter"}, jetzt)

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -6), jetzt)
	if strings.Contains(u.Aussage, "Prozent weiter") {
		t.Errorf("bei vier Scans steht eine Rate im Satz: %s", u.Aussage)
	}
	// Die Zahlen selbst stehen trotzdem da — nur der Satz behauptet nichts.
	if u.SeitenScans != 4 || u.Weiter != 1 {
		t.Errorf("Strecke: %d / %d", u.SeitenScans, u.Weiter)
	}
}

func ablageMitSeite(t *testing.T) (*Speicher, string, *Code) {
	t.Helper()
	s, err := Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })
	org := "org-eins"
	c := &Code{Kuerzel: "mitseite", KontoID: org, Name: "Sommerkarte",
		Ziel: "https://x.de", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetzeSeite(c.ID, gueltigeSeite()); err != nil {
		t.Fatal(err)
	}
	jetzt, _ := s.NachID(c.ID)
	return s, org, jetzt
}
