package speicher

import (
	"strings"
	"testing"
	"time"
)

func ablageMitScans(t *testing.T) (*Speicher, string) {
	t.Helper()
	s, err := Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	org := "org-eins"
	for i, name := range []string{"Speisekarte", "Flyer", "Aufsteller"} {
		c := &Code{Kuerzel: "k" + string(rune('a'+i)), KontoID: org,
			Name: name, Ziel: "https://x.de/" + name, Aktiv: true}
		if err := s.LegeAn(c); err != nil {
			t.Fatal(err)
		}
	}
	// Ein Code einer fremden Organisation, samt Scans.
	fremd := &Code{Kuerzel: "fremd", KontoID: "org-zwei", Name: "Fremd",
		Ziel: "https://y.de", Aktiv: true}
	if err := s.LegeAn(fremd); err != nil {
		t.Fatal(err)
	}
	return s, org
}

func TestUebersichtTrenntOrganisationen(t *testing.T) {
	s, org := ablageMitScans(t)
	codes := s.Liste(org)
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)

	for _, c := range codes {
		s.Zaehle(c.ID, []string{"geraet:mobil", "stunde:12"}, jetzt)
	}
	fremd, _ := s.NachKuerzel("fremd")
	for i := 0; i < 50; i++ {
		s.Zaehle(fremd.ID, []string{"geraet:rechner", "stunde:03"}, jetzt)
	}

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -6), jetzt)
	if u.Gesamt != 3 {
		t.Errorf("%d Scans statt 3 — die fremde Organisation ist mitgezaehlt", u.Gesamt)
	}
	if u.CodesGesamt != 3 {
		t.Errorf("%d Codes statt 3", u.CodesGesamt)
	}
	for _, k := range u.Klassen["geraet"] {
		if k.Wert == "rechner" {
			t.Error("eine Klasse der fremden Organisation steht in der Uebersicht")
		}
	}
}

// Die Zeitreihe muss jeden Tag tragen, auch die leeren. Sonst zeigt der
// Verlauf eine Gerade, wo in Wahrheit Luecken sind.
func TestZeitreiheHatAlleTage(t *testing.T) {
	s, org := ablageMitScans(t)
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	c := s.Liste(org)[0]
	s.Zaehle(c.ID, []string{"geraet:mobil"}, jetzt)
	s.Zaehle(c.ID, []string{"geraet:mobil"}, jetzt.AddDate(0, 0, -5))

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -6), jetzt)
	if len(u.Tage) != 7 {
		t.Fatalf("%d Tage statt 7", len(u.Tage))
	}
	if u.Tage[0].Tag != "2026-08-11" || u.Tage[6].Tag != "2026-08-17" {
		t.Errorf("Reihe von %s bis %s", u.Tage[0].Tag, u.Tage[6].Tag)
	}
	if u.Tage[6].Scans != 1 || u.Tage[1].Scans != 1 || u.Tage[3].Scans != 0 {
		t.Errorf("Werte %v", u.Tage)
	}
}

// Scans ausserhalb des Zeitraums duerfen nicht mitzaehlen.
func TestZeitraumSchneidet(t *testing.T) {
	s, org := ablageMitScans(t)
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	c := s.Liste(org)[0]
	s.Zaehle(c.ID, []string{"geraet:mobil"}, jetzt)
	s.Zaehle(c.ID, []string{"geraet:mobil"}, jetzt.AddDate(0, 0, -40))

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -29), jetzt)
	if u.Gesamt != 1 {
		t.Errorf("%d Scans statt 1 — der alte Scan zaehlt mit", u.Gesamt)
	}
}

func TestCodesNachScansSortiert(t *testing.T) {
	s, org := ablageMitScans(t)
	jetzt := time.Date(2026, 8, 17, 12, 0, 0, 0, time.UTC)
	codes := s.Liste(org)
	for i := 0; i < 5; i++ {
		s.Zaehle(codes[1].ID, []string{"geraet:mobil"}, jetzt)
	}
	s.Zaehle(codes[0].ID, []string{"geraet:mobil"}, jetzt)

	u := s.Uebersicht(org, jetzt.AddDate(0, 0, -6), jetzt)
	if u.Codes[0].ID != codes[1].ID || u.Codes[0].Scans != 5 {
		t.Errorf("obenauf steht %+v", u.Codes[0])
	}
	if u.CodesStumm != 1 {
		t.Errorf("%d stumme Codes statt 1", u.CodesStumm)
	}
}

// Die wichtigste Regel der Aussage: aus wenigen Scans wird keine beste
// Zeit abgeleitet.
func TestKeineZeitaussageBeiKleinerZahl(t *testing.T) {
	stunden := map[time.Weekday]map[int]int{time.Saturday: {13: 8}}
	klein := Uebersicht{Gesamt: 12, CodesGesamt: 2, Tage: make([]Tagwert, 30),
		Codes: []Codewert{{Kuerzel: "a", Scans: 12}}}
	if s := Aussage(klein, stunden); strings.Contains(s, "Uhr") {
		t.Errorf("bei 12 Scans wird eine Zeit genannt: %s", s)
	}

	gross := klein
	gross.Gesamt = MindestScansFuerZeitaussage
	if s := Aussage(gross, stunden); !strings.Contains(s, "Samstag") ||
		!strings.Contains(s, "13 Uhr") {
		t.Errorf("bei %d Scans fehlt die Zeit: %s", gross.Gesamt, s)
	}
}

func TestAussageOhneScans(t *testing.T) {
	if s := Aussage(Uebersicht{CodesGesamt: 0}, nil); !strings.Contains(s, "kein Code") {
		t.Errorf("%s", s)
	}
	if s := Aussage(Uebersicht{CodesGesamt: 3, Gesamt: 0}, nil); !strings.Contains(s, "kein Code gescannt") {
		t.Errorf("%s", s)
	}
}

// Derselbe Datenstand muss immer denselben Satz ergeben — sonst wechselt
// die Aussage bei jedem Aufruf, weil Go ueber Karten zufaellig laeuft.
func TestSpitzeIstEindeutig(t *testing.T) {
	stunden := map[time.Weekday]map[int]int{
		time.Saturday: {13: 9}, time.Monday: {9: 9}, time.Friday: {17: 9},
	}
	erste := ""
	for i := 0; i < 50; i++ {
		s := Aussage(Uebersicht{Gesamt: 200, CodesGesamt: 1,
			Codes: []Codewert{{Kuerzel: "a", Scans: 200}}}, stunden)
		if erste == "" {
			erste = s
		} else if s != erste {
			t.Fatalf("zwei Saetze aus denselben Daten:\n%s\n%s", erste, s)
		}
	}
	if !strings.Contains(erste, "Montag") {
		t.Errorf("bei Gleichstand soll der fruehere Tag gewinnen: %s", erste)
	}
}

func TestZahlDeutsch(t *testing.T) {
	faelle := map[int]string{0: "0", 7: "7", 999: "999", 1000: "1.000",
		14201: "14.201", 1234567: "1.234.567"}
	for n, will := range faelle {
		if hat := zahlDeutsch(n); hat != will {
			t.Errorf("%d ergab %q statt %q", n, hat, will)
		}
	}
}
