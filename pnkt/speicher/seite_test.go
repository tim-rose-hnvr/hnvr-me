package speicher

import (
	"strings"
	"testing"
)

func gueltigeSeite() *Seite {
	return &Seite{
		Vorlage: "karte", Titel: "Sommerkarte",
		Bloecke: []Block{{Titel: "Kleinigkeiten", Zeilen: []Zeile{
			{Was: "Flammkuchen", Neben: "9,50 €"},
		}}},
		Handlung: &Handlung{Text: "Ganze Karte", Ziel: "https://example.de/karte"},
	}
}

func TestSeitePruefe(t *testing.T) {
	if f := gueltigeSeite().Pruefe(); len(f) > 0 {
		t.Errorf("gueltige Seite abgelehnt: %v", f)
	}

	ohneTitel := gueltigeSeite()
	ohneTitel.Titel = "  "
	if f := ohneTitel.Pruefe(); len(f) != 1 || !strings.Contains(f[0], "Titel") {
		t.Errorf("%v", f)
	}

	fremdeVorlage := gueltigeSeite()
	fremdeVorlage.Vorlage = "gibtsnicht"
	if f := fremdeVorlage.Pruefe(); len(f) != 1 {
		t.Errorf("%v", f)
	}
}

// Alle Fehler auf einmal: wer eine Karte eintippt und drei Fehler
// nacheinander vorgelegt bekommt, tippt beim dritten nicht mehr.
func TestSeiteMeldetAlleFehler(t *testing.T) {
	s := &Seite{Vorlage: "unbekannt", Titel: "",
		Handlung: &Handlung{Text: "", Ziel: "keine adresse"}}
	f := s.Pruefe()
	if len(f) < 4 {
		t.Errorf("nur %d Fehler: %v", len(f), f)
	}
}

// Der wichtigste Test dieser Datei. Ein Ziel landet spaeter in einem
// href; `javascript:` an dieser Stelle waere fremder Code auf der
// eigenen Domain.
func TestPruefeZielLaesstNurVierSchemataDurch(t *testing.T) {
	gut := []string{
		"https://example.de/karte",
		"http://example.de",
		"https://example.de:8443/a?b=c#d",
		"mailto:hallo@example.de",
		"tel:+4930123456",
	}
	for _, z := range gut {
		if err := PruefeZiel(z); err != nil {
			t.Errorf("%q abgelehnt: %v", z, err)
		}
	}

	schlecht := []string{
		"",
		"   ",
		"javascript:alert(1)",
		"JavaScript:alert(1)",
		"  javascript:alert(1)  ",
		"data:text/html,<script>alert(1)</script>",
		"vbscript:msgbox(1)",
		"file:///etc/passwd",
		"example.de", // ohne Schema
		"/lokal",     // ohne Schema
		"https://",   // ohne Rechnernamen
		"mailto:",    // ohne Empfaenger
		"tel:",       // ohne Nummer
		"jAvAsCrIpT:alert(1)",
	}
	for _, z := range schlecht {
		if err := PruefeZiel(z); err == nil {
			t.Errorf("%q durchgelassen", z)
		}
	}
}

func TestZeileMitBoesemZielFaelltAuf(t *testing.T) {
	s := gueltigeSeite()
	s.Vorlage = "verweise"
	s.Bloecke[0].Zeilen[0].Ziel = "javascript:alert(1)"
	f := s.Pruefe()
	if len(f) == 0 {
		t.Fatal("javascript: in einer Zeile wurde durchgelassen")
	}
	gefunden := false
	for _, e := range f {
		if strings.Contains(e, "javascript") {
			gefunden = true
		}
	}
	if !gefunden {
		t.Errorf("Meldung nennt das Schema nicht: %v", f)
	}
}

// Ein Wegweiser, dessen Zeilen nirgendwohin fuehren, ist keiner.
func TestWegweiserBrauchtZiele(t *testing.T) {
	s := &Seite{Vorlage: "verweise", Titel: "Nordwerk",
		Bloecke: []Block{{Zeilen: []Zeile{{Was: "Karte"}, {Was: "Anfahrt"}}}}}
	f := s.Pruefe()
	if len(f) != 1 || !strings.Contains(f[0], "2 Zeilen ohne Ziel") {
		t.Errorf("%v", f)
	}
}

// Die Grenzen sind kein Selbstzweck: wer vor einem Aufsteller steht,
// laedt ueber Mobilfunk.
func TestSeiteGrenzen(t *testing.T) {
	s := gueltigeSeite()
	for i := 0; i < HoechstBloecke+1; i++ {
		s.Bloecke = append(s.Bloecke, Block{Titel: "x"})
	}
	if f := s.Pruefe(); len(f) == 0 {
		t.Error("zu viele Abschnitte durchgelassen")
	}

	lang := gueltigeSeite()
	for i := 0; i < HoechstZeilen+1; i++ {
		lang.Bloecke[0].Zeilen = append(lang.Bloecke[0].Zeilen, Zeile{Was: "x"})
	}
	if f := lang.Pruefe(); len(f) == 0 {
		t.Error("zu viele Zeilen durchgelassen")
	}

	titel := gueltigeSeite()
	titel.Titel = strings.Repeat("x", HoechstTitel+1)
	if f := titel.Pruefe(); len(f) == 0 {
		t.Error("zu langer Titel durchgelassen")
	}
}

func TestSetzeSeiteUndWeg(t *testing.T) {
	s, err := Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })

	c := &Code{Kuerzel: "abc123", KontoID: "org", Ziel: "https://x.de", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}

	neu, err := s.SetzeSeite(c.ID, gueltigeSeite())
	if err != nil {
		t.Fatal(err)
	}
	if neu.Seite == nil || neu.Seite.Titel != "Sommerkarte" {
		t.Fatalf("Seite nicht gesetzt: %+v", neu.Seite)
	}
	if neu.Seite.Geaendert.IsZero() {
		t.Error("ohne Zeitstempel")
	}
	if neu.Fassung != 2 {
		t.Errorf("Fassung %d — das Setzen ist keine neue Fassung", neu.Fassung)
	}

	// Eine ungueltige Seite wird nicht gespeichert.
	kaputt := gueltigeSeite()
	kaputt.Handlung.Ziel = "javascript:alert(1)"
	if _, err := s.SetzeSeite(c.ID, kaputt); err == nil {
		t.Error("ungueltige Seite gespeichert")
	}
	jetzt, _ := s.NachID(c.ID)
	if jetzt.Seite.Handlung.Ziel != "https://example.de/karte" {
		t.Errorf("die alte Seite wurde ueberschrieben: %q", jetzt.Seite.Handlung.Ziel)
	}

	ohne, err := s.SetzeSeite(c.ID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if ohne.Seite != nil {
		t.Error("Seite nicht entfernt")
	}
}

// Die Seite muss die Neuladung ueberstehen — sie liegt im selben Satz
// wie der Code.
func TestSeiteUeberlebtNeuladen(t *testing.T) {
	verzeichnis := t.TempDir()
	s, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	c := &Code{Kuerzel: "abc123", KontoID: "org", Ziel: "https://x.de", Aktiv: true}
	if err := s.LegeAn(c); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetzeSeite(c.ID, gueltigeSeite()); err != nil {
		t.Fatal(err)
	}
	s.Schliesse()

	wieder, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	defer wieder.Schliesse()
	geladen, da := wieder.NachKuerzel("abc123")
	if !da || geladen.Seite == nil {
		t.Fatal("Seite nach dem Neuladen weg")
	}
	if geladen.Seite.Bloecke[0].Zeilen[0].Neben != "9,50 €" {
		t.Errorf("Inhalt verloren: %+v", geladen.Seite.Bloecke)
	}
}

func TestVorlagenliste(t *testing.T) {
	if len(Vorlagenliste) != 4 {
		t.Errorf("%d Vorlagen", len(Vorlagenliste))
	}
	if _, da := VorlageNach("karte"); !da {
		t.Error("karte fehlt")
	}
	if _, da := VorlageNach("gibtsnicht"); da {
		t.Error("Unbekanntes gefunden")
	}
}
