package speicher

import (
	"errors"
	"testing"
)

func fuelle(t *testing.T) *Speicher {
	t.Helper()
	s, _ := neu(t)
	for _, c := range []*Code{
		{Kuerzel: "plak01", KontoID: "org1", Name: "Plakat Bahnhof", Ordner: "Fruehjahr 2026",
			Ziel: "https://example.de/aktion", Aktiv: true},
		{Kuerzel: "plak02", KontoID: "org1", Name: "Plakat Markt", Ordner: "Fruehjahr 2026",
			Ziel: "https://example.de/markt", Aktiv: true},
		{Kuerzel: "etik01", KontoID: "org1", Name: "Etikett Roestkaffee", Ordner: "Produkte",
			GTIN: "4006381333931", Ziel: "https://example.de/kaffee", Aktiv: true},
		{Kuerzel: "lose01", KontoID: "org1", Name: "Aufkleber", Ziel: "https://example.de/lose", Aktiv: true},
		{Kuerzel: "frem01", KontoID: "org2", Name: "Plakat der anderen",
			Ordner: "Fruehjahr 2026", Ziel: "https://andere.de", Aktiv: true},
	} {
		if err := s.LegeAn(c); err != nil {
			t.Fatal(err)
		}
	}
	return s
}

func kuerzelVon(codes []*Code) []string {
	aus := make([]string, 0, len(codes))
	for _, c := range codes {
		aus = append(aus, c.Kuerzel)
	}
	return aus
}

func gleich(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func enthaelt(liste []string, wert string) bool {
	for _, x := range liste {
		if x == wert {
			return true
		}
	}
	return false
}

func TestSucheUndOrdner(t *testing.T) {
	s := fuelle(t)

	faelle := []struct {
		name    string
		filter  Filter
		erwarte []string
	}{
		{"alles der Organisation", Filter{}, []string{"plak01", "plak02", "etik01", "lose01"}},
		{"ein Ordner", Filter{Ordner: "Fruehjahr 2026"}, []string{"plak01", "plak02"}},
		{"ohne Ordner", Filter{Ordner: "-"}, []string{"lose01"}},
		{"Wort im Namen", Filter{Text: "plakat"}, []string{"plak01", "plak02"}},
		{"Wort im Ziel", Filter{Text: "kaffee"}, []string{"etik01"}},
		{"GTIN", Filter{Text: "4006381333931"}, []string{"etik01"}},
		{"Kuerzel", Filter{Text: "LOSE"}, []string{"lose01"}},
		{"Ordner und Wort zusammen", Filter{Ordner: "Fruehjahr 2026", Text: "markt"}, []string{"plak02"}},
	}
	for _, f := range faelle {
		t.Run(f.name, func(t *testing.T) {
			got := kuerzelVon(s.Suche("org1", f.filter))
			if len(got) != len(f.erwarte) {
				t.Fatalf("erwartet %v, bekommen %v", f.erwarte, got)
			}
			for _, k := range f.erwarte {
				if !enthaelt(got, k) {
					t.Errorf("%s fehlt in %v", k, got)
				}
			}
		})
	}

	// Eine fremde Organisation sieht nichts von der eigenen — auch nicht
	// ueber die Suche, die sonst der bequemste Weg dorthin waere.
	if got := kuerzelVon(s.Suche("org1", Filter{Text: "anderen"})); len(got) != 0 {
		t.Errorf("fremder Code in der eigenen Suche: %v", got)
	}
}

func TestOrdnerZaehlt(t *testing.T) {
	s := fuelle(t)
	stand := s.Ordner("org1")

	// „Ohne Ordner" steht vorn, danach alphabetisch.
	erwartet := []Ordnerstand{
		{Name: "", Anzahl: 1},
		{Name: "Fruehjahr 2026", Anzahl: 2},
		{Name: "Produkte", Anzahl: 1},
	}
	if len(stand) != len(erwartet) {
		t.Fatalf("erwartet %v, bekommen %v", erwartet, stand)
	}
	for i := range erwartet {
		if stand[i] != erwartet[i] {
			t.Errorf("Platz %d: erwartet %v, bekommen %v", i, erwartet[i], stand[i])
		}
	}
}

// Der teuerste Fehler, den dieses System machen koennte: ein Kuerzel
// wieder freigeben, das auf Papier steht. Das Plakat haengt weiter.
func TestGeloeschtesKuerzelBleibtVergeben(t *testing.T) {
	s := fuelle(t)
	code, _ := s.NachKuerzel("plak01")

	if _, err := s.Loesche(code.ID); err != nil {
		t.Fatal(err)
	}

	// Aus der Liste ist er weg.
	if enthaelt(kuerzelVon(s.Liste("org1")), "plak01") {
		t.Error("geloeschter Code steht noch in der Liste")
	}
	// Das Kuerzel ist trotzdem belegt.
	if err := s.LegeAn(&Code{Kuerzel: "plak01", KontoID: "org1", Ziel: "https://neu.de"}); !errors.Is(err, ErrKuerzelVergeben) {
		t.Errorf("geloeschtes Kuerzel wurde neu vergeben: %v", err)
	}
	// Und ein Scan findet den Code noch, damit die Weiterleitung eine
	// lesbare Seite zeigen kann statt „unbekannt".
	gefunden, da := s.NachKuerzel("plak01")
	if !da {
		t.Fatal("geloeschter Code ist ueber sein Kuerzel nicht mehr auffindbar")
	}
	if !gefunden.Geloescht || gefunden.Aktiv || gefunden.Ziel != "" {
		t.Errorf("geloeschter Code haelt noch ein Ziel: %+v", gefunden)
	}
	// Zweimal loeschen ist ein Fehler, kein stiller Erfolg.
	if _, err := s.Loesche(code.ID); err == nil {
		t.Error("zweites Loeschen haette scheitern muessen")
	}

	// Nach einem Neustart gilt dasselbe — die Sperre steht in der Datei,
	// nicht nur im Arbeitsspeicher.
	verzeichnis := s.verzeichnis
	if err := s.Schliesse(); err != nil {
		t.Fatal(err)
	}
	wieder, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	defer wieder.Schliesse()
	if err := wieder.LegeAn(&Code{Kuerzel: "plak01", Ziel: "https://neu.de"}); !errors.Is(err, ErrKuerzelVergeben) {
		t.Errorf("nach Neustart war das geloeschte Kuerzel wieder frei: %v", err)
	}
	if enthaelt(kuerzelVon(wieder.Liste("org1")), "plak01") {
		t.Error("geloeschter Code kam beim Laden zurueck in die Liste")
	}
}

// Auch eine Umbenennung darf das alte Kuerzel nicht freigeben: es steht
// vielleicht schon auf Papier und muss weiter zum selben Code fuehren.
func TestUmbenanntesKuerzelBleibtGueltig(t *testing.T) {
	s := fuelle(t)
	code, _ := s.NachKuerzel("plak02")

	if _, err := s.Aendere(code.ID, func(c *Code) error {
		c.Kuerzel = "markt26"
		return nil
	}); err != nil {
		t.Fatal(err)
	}

	alt, da := s.NachKuerzel("plak02")
	if !da || alt.ID != code.ID {
		t.Error("das alte Kuerzel fuehrt nicht mehr zum Code")
	}
	neu, da := s.NachKuerzel("markt26")
	if !da || neu.ID != code.ID {
		t.Error("das neue Kuerzel fuehrt nicht zum Code")
	}
	if err := s.LegeAn(&Code{Kuerzel: "plak02", Ziel: "https://fremd.de"}); !errors.Is(err, ErrKuerzelVergeben) {
		t.Errorf("altes Kuerzel wurde nach der Umbenennung neu vergeben: %v", err)
	}
	// Und es darf nur einmal in der Liste stehen, nicht zweimal.
	if got := kuerzelVon(s.Liste("org1")); len(got) != 4 {
		t.Errorf("Umbenennung hat die Liste verdoppelt: %v", got)
	}
}

func TestSucheSortiertNeuesteZuerst(t *testing.T) {
	s := fuelle(t)
	got := kuerzelVon(s.Suche("org1", Filter{Text: "plakat"}))
	if !gleich(got, []string{"plak02", "plak01"}) {
		t.Errorf("erwartet neueste zuerst, bekommen %v", got)
	}
}
