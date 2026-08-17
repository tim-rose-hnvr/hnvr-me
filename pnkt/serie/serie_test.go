package serie

import (
	"strings"
	"testing"
)

const tischeKomma = `Tisch,Bereich,Notiz
1,Innen,am Fenster
2,Innen,
12,Terrasse Süd,
`

const tischeSemikolon = `Tisch;Bereich
1;Innen
2;Terrasse
`

func TestLiestKommaUndSemikolon(t *testing.T) {
	for name, roh := range map[string]string{"komma": tischeKomma, "semikolon": tischeSemikolon} {
		tab, err := Lies(strings.NewReader(roh))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if tab.Spalten[0] != "Tisch" || tab.Spalten[1] != "Bereich" {
			t.Errorf("%s: Kopfzeile %v", name, tab.Spalten)
		}
	}
}

// Excel schreibt eine Byte-Order-Mark an den Anfang. Ohne sie zu
// entfernen traegt die erste Spalte drei unsichtbare Zeichen vor
// ihrem Namen — und kein Muster findet sie je.
func TestBOMWirdEntfernt(t *testing.T) {
	tab, err := Lies(strings.NewReader("\ufeffTisch,Ziel\n1,https://a.de\n"))
	if err != nil {
		t.Fatal(err)
	}
	if tab.Spalten[0] != "Tisch" {
		t.Errorf("erste Spalte heisst %q", tab.Spalten[0])
	}
}

func TestLeereZeilenAmEnde(t *testing.T) {
	tab, err := Lies(strings.NewReader("Tisch,Ziel\n1,https://a.de\n\n\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(tab.Zeilen) != 1 {
		t.Errorf("%d Zeilen statt 1", len(tab.Zeilen))
	}
}

func TestOhneDatenzeile(t *testing.T) {
	if _, err := Lies(strings.NewReader("Tisch,Ziel\n")); err == nil {
		t.Error("eine Kopfzeile allein ist keine Tabelle")
	}
}

func TestPlatzhalter(t *testing.T) {
	faelle := map[string][]string{
		"pnkt.me/nordwerk/t{Tisch}":          {"Tisch"},
		"{a}/{b}/{a}":                        {"a", "b"},
		"ohne":                               nil,
		"{ Tisch }":                          {"Tisch"},
		"{offen":                             nil,
		"https://x.de/{Bereich}/{Tisch}.htm": {"Bereich", "Tisch"},
	}
	for muster, will := range faelle {
		hat := Platzhalter(muster)
		if len(hat) != len(will) {
			t.Errorf("%q: %v statt %v", muster, hat, will)
			continue
		}
		for i := range will {
			if hat[i] != will[i] {
				t.Errorf("%q: %v statt %v", muster, hat, will)
				break
			}
		}
	}
}

// Der eigentliche Zweck: ein Tippfehler im Muster darf nicht 24 Codes
// mit dem Wort „{Tsich}" ergeben.
func TestTippfehlerImMuster(t *testing.T) {
	tab, _ := Lies(strings.NewReader(tischeKomma))
	err := tab.PruefeMuster("pnkt.me/t{Tsich}")
	if err == nil {
		t.Fatal("der Tippfehler haette auffallen muessen")
	}
	for _, wort := range []string{"Tsich", "Tisch", "Bereich"} {
		if !strings.Contains(err.Error(), wort) {
			t.Errorf("Meldung ohne %q: %s", wort, err)
		}
	}
	if err := tab.PruefeMuster("pnkt.me/t{Tisch}"); err != nil {
		t.Errorf("richtiges Muster abgelehnt: %v", err)
	}
	// Schreibweise egal.
	if err := tab.PruefeMuster("pnkt.me/t{tisch}"); err != nil {
		t.Errorf("Kleinschreibung abgelehnt: %v", err)
	}
	if err := tab.PruefeMuster("pnkt.me/{Tisch"); err == nil {
		t.Error("offene Klammer haette auffallen muessen")
	}
}

func TestSetzeUndWegtauglich(t *testing.T) {
	tab, _ := Lies(strings.NewReader(tischeKomma))
	ziel, err := tab.Setze("pnkt.me/nordwerk/{Bereich}/t{Tisch}", tab.Zeilen[2])
	if err != nil {
		t.Fatal(err)
	}
	if ziel != "pnkt.me/nordwerk/terrasse-sued/t12" {
		t.Errorf("Ziel %q", ziel)
	}
}

func TestWegtauglich(t *testing.T) {
	faelle := map[string]string{
		"Terrasse Süd": "terrasse-sued",
		"Tisch  12":    "tisch-12",
		"Müller & Co.": "mueller-co.",
		"ÄÖÜß":         "aeoeuess",
		"a/b":          "a/b",
		"--":           "",
		"!!!":          "",
		"  x  ":        "x",
	}
	for ein, will := range faelle {
		if hat := wegtauglich(ein); hat != will {
			t.Errorf("%q ergab %q statt %q", ein, hat, will)
		}
	}
}

// Bleibt nach dem Saeubern nichts uebrig, ist das ein Fehler und kein
// kuerzeres Ziel: „t{Tisch}" mit dem Feld „!!!" duerfte sonst „t"
// ergeben — und die naechste solche Zeile ebenfalls.
func TestFeldOhneBrauchbaresZeichen(t *testing.T) {
	tab, _ := Lies(strings.NewReader("Tisch\n!!!\n"))
	_, err := tab.Setze("pnkt.me/t{Tisch}", tab.Zeilen[0])
	if err == nil {
		t.Fatal("„!!!" + `" haette auffallen muessen`)
	}
	if !strings.Contains(err.Error(), "!!!") {
		t.Errorf("Meldung ohne den Ausgangswert: %s", err)
	}
}

// Ein leeres Feld darf nicht still zu einem kuerzeren Ziel werden:
// aus „t{Tisch}" wuerde sonst „t", und zwei leere Zeilen zeigten auf
// dieselbe Seite.
func TestLeeresFeldIstEinFehler(t *testing.T) {
	tab, _ := Lies(strings.NewReader("Tisch,Bereich\n1,Innen\n,Innen\n"))
	posten, err := tab.Umsetzen(Zuordnung{Muster: "pnkt.me/t{Tisch}"})
	if err != nil {
		t.Fatal(err)
	}
	if posten[0].Fehler != "" {
		t.Errorf("Zeile 2 sollte gehen: %s", posten[0].Fehler)
	}
	if posten[1].Fehler == "" {
		t.Error("die leere Zeile haette einen Fehler tragen muessen")
	}
	if posten[1].Ziel != "" {
		t.Errorf("trotz Fehler ein Ziel: %q", posten[1].Ziel)
	}
}

func TestUmsetzenMitMuster(t *testing.T) {
	tab, _ := Lies(strings.NewReader(tischeKomma))
	posten, err := tab.Umsetzen(Zuordnung{
		Muster: "pnkt.me/nordwerk/t{Tisch}", NameSpalte: "Bereich", OrdnerFest: "Sommer",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(posten) != 3 {
		t.Fatalf("%d Posten statt 3", len(posten))
	}
	if posten[0].Ziel != "pnkt.me/nordwerk/t1" || posten[0].Name != "Innen" {
		t.Errorf("%+v", posten[0])
	}
	if posten[0].Nr != 2 {
		t.Errorf("Zeilennummer %d — die Kopfzeile ist 1", posten[0].Nr)
	}
	if posten[2].Ordner != "Sommer" {
		t.Errorf("Ordner %q", posten[2].Ordner)
	}
}

func TestUmsetzenMitZielspalte(t *testing.T) {
	tab, _ := Lies(strings.NewReader("Name,Ziel\nA,https://a.de\nB,\n"))
	posten, err := tab.Umsetzen(Zuordnung{ZielSpalte: "Ziel", NameSpalte: "Name"})
	if err != nil {
		t.Fatal(err)
	}
	if posten[0].Ziel != "https://a.de" {
		t.Errorf("Ziel %q", posten[0].Ziel)
	}
	if posten[1].Fehler == "" {
		t.Error("leeres Ziel haette einen Fehler tragen muessen")
	}
}

func TestUnbekannteSpalteInZuordnung(t *testing.T) {
	tab, _ := Lies(strings.NewReader(tischeKomma))
	_, err := tab.Umsetzen(Zuordnung{Muster: "x/{Tisch}", NameSpalte: "Gibtsnicht"})
	if err == nil || !strings.Contains(err.Error(), "Gibtsnicht") {
		t.Errorf("Fehler %v", err)
	}
}

func TestOhneMusterUndOhneSpalte(t *testing.T) {
	tab, _ := Lies(strings.NewReader(tischeKomma))
	if _, err := tab.Umsetzen(Zuordnung{}); err == nil {
		t.Error("ohne Ziel gibt es keine Serie")
	}
}

// Zwei Tische mit demselben Ziel sind nicht zu unterscheiden, sobald
// die Zahlen eintreffen.
func TestDoppelteZiele(t *testing.T) {
	tab, _ := Lies(strings.NewReader("Tisch,Bereich\n1,Innen\n1,Aussen\n2,Innen\n"))
	posten, _ := tab.Umsetzen(Zuordnung{Muster: "pnkt.me/t{Tisch}"})
	dopp := Doppelte(posten)
	if len(dopp) != 1 {
		t.Fatalf("%d doppelte Ziele statt 1: %v", len(dopp), dopp)
	}
	nummern := dopp["pnkt.me/t1"]
	if len(nummern) != 2 || nummern[0] != 2 || nummern[1] != 3 {
		t.Errorf("Zeilen %v", nummern)
	}
}
