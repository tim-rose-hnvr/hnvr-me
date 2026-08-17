package pass

import (
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

func voll() *speicher.Produktpass {
	return &speicher.Produktpass{
		GTIN: "04006381333931", Bezeichnung: "Röstkaffee 500 g", Modell: "Hausmischung",
		Hersteller: "Rösterei Klein GmbH", HerstellerAnschrift: "Marktweg 3, 30159 Hannover",
		Herstelldatum: "2026-03-04",
		Stoffe: []speicher.Stoff{
			{Name: "Papier", AnteilPro: 70, Rezykliert: 60},
			{Name: "Aluminium", AnteilPro: 25, Rezykliert: 10},
			{Name: "Polyethylen", AnteilPro: 5},
		},
		Reparatur:  "Verpackung, keine Reparatur vorgesehen.",
		Entsorgung: "Papiertonne nach Trennung der Innenschicht.",
		Belege: []speicher.Beleg{
			{Titel: "Konformitätserklärung", URL: "https://example.de/ke.pdf", Art: "konformitaet"},
		},
	}
}

func hat(u Urteil, feld, schwere string) bool {
	for _, f := range u.Befunde {
		if f.Feld == feld && f.Schwere == schwere {
			return true
		}
	}
	return false
}

func TestVollstaendigerPassTraegt(t *testing.T) {
	u := Pruefe(voll())
	if !u.Tragfaehig {
		t.Errorf("vollstaendiger Pass sollte tragen: %+v", u.Befunde)
	}
	if u.Anteil != 100 {
		t.Errorf("erwartet 100 %%, bekommen %d %%: %+v", u.Anteil, u.Befunde)
	}
}

// Eine falsche GTIN ist ein Fehler und keine Warnung: der Datentraeger
// am Produkt loest darueber auf.
func TestFalscheGTINIstEinFehler(t *testing.T) {
	p := voll()
	p.GTIN = "04006381333930" // letzte Stelle verdreht
	u := Pruefe(p)
	if u.Tragfaehig || !hat(u, "gtin", "fehler") {
		t.Errorf("falsche Pruefziffer nicht als Fehler erkannt: %+v", u.Befunde)
	}
}

func TestOhneBezeichnungUndHersteller(t *testing.T) {
	p := voll()
	p.Bezeichnung = ""
	p.Hersteller = ""
	u := Pruefe(p)
	if !hat(u, "bezeichnung", "fehler") {
		t.Error("fehlende Bezeichnung nicht gemeldet")
	}
	if !hat(u, "hersteller", "fehler") {
		t.Error("fehlender Verantwortlicher nicht gemeldet")
	}
	if u.Tragfaehig {
		t.Error("dieser Pass darf nicht tragen")
	}
}

// Mehr als hundert Prozent eines Produkts gibt es nicht. Knapp darueber
// ist Rundung und bleibt erlaubt.
func TestAnteileUeberHundert(t *testing.T) {
	p := voll()
	p.Stoffe = []speicher.Stoff{{Name: "A", AnteilPro: 60}, {Name: "B", AnteilPro: 60}}
	if u := Pruefe(p); !hat(u, "stoffe", "fehler") {
		t.Errorf("120 %% nicht beanstandet: %+v", u.Befunde)
	}

	p.Stoffe = []speicher.Stoff{{Name: "A", AnteilPro: 66.7}, {Name: "B", AnteilPro: 33.4}}
	if u := Pruefe(p); hat(u, "stoffe", "fehler") {
		t.Errorf("100,1 %% ist Rundung und haette durchgehen muessen: %+v", u.Befunde)
	}

	p.Stoffe = []speicher.Stoff{{Name: "A", AnteilPro: 140}}
	if u := Pruefe(p); !hat(u, "stoffe[0].anteilProzent", "fehler") {
		t.Errorf("einzelner Anteil ueber 100 nicht beanstandet: %+v", u.Befunde)
	}
}

// Genau diese Angabe braucht der Verwerter.
func TestSVHCOhneCASNummer(t *testing.T) {
	p := voll()
	p.Stoffe = append(p.Stoffe, speicher.Stoff{Name: "Bleiverbindung", Besorgnis: true})
	if u := Pruefe(p); !hat(u, "stoffe[3].casNummer", "warnung") {
		t.Errorf("SVHC ohne CAS-Nummer nicht gemeldet: %+v", u.Befunde)
	}

	p.Stoffe[3].CASNummer = "7439-92-1"
	if u := Pruefe(p); hat(u, "stoffe[3].casNummer", "warnung") {
		t.Error("mit CAS-Nummer darf keine Warnung mehr kommen")
	}
}

func TestBelegOhneHTTPS(t *testing.T) {
	p := voll()
	p.Belege = []speicher.Beleg{{Titel: "Anleitung", URL: "http://example.de/a.pdf"}}
	if u := Pruefe(p); !hat(u, "belege[0].url", "warnung") {
		t.Errorf("ungesicherter Beleg nicht gemeldet: %+v", u.Befunde)
	}
	p.Belege = []speicher.Beleg{{Titel: "Anleitung"}}
	if u := Pruefe(p); !hat(u, "belege[0].url", "fehler") {
		t.Errorf("Beleg ohne Verweis nicht gemeldet: %+v", u.Befunde)
	}
}

func TestHerstelldatumInFalscherForm(t *testing.T) {
	p := voll()
	p.Herstelldatum = "04.03.2026"
	if u := Pruefe(p); !hat(u, "herstelldatum", "warnung") {
		t.Errorf("deutsches Datum nicht beanstandet: %+v", u.Befunde)
	}
}

func TestFehlendeAbschnitteSenkenDenAnteil(t *testing.T) {
	p := voll()
	p.Stoffe = nil
	p.Reparatur, p.Ersatzteile, p.Entsorgung, p.Ruecknahme = "", "", "", ""
	u := Pruefe(p)
	if u.Anteil != 50 {
		t.Errorf("erwartet 50 %%, bekommen %d %%", u.Anteil)
	}
	// Fehlende Abschnitte sind Warnungen: welche Angabe Pflicht ist,
	// entscheidet der delegierte Rechtsakt der Produktgruppe.
	if !u.Tragfaehig {
		t.Error("fehlende Abschnitte duerfen den Pass nicht sperren")
	}
	for _, feld := range []string{"stoffe", "reparatur", "entsorgung"} {
		if !hat(u, feld, "warnung") {
			t.Errorf("Warnung zu %s fehlt: %+v", feld, u.Befunde)
		}
	}
}

// Die Trennung geschieht in den Daten, nicht in der Oberflaeche. Eine
// Oberflaeche, die etwas ausblendet, hat es trotzdem ausgeliefert.
func TestBeschraenkteAngabenBleibenDraussen(t *testing.T) {
	p := voll()
	p.Angaben = []speicher.Angabe{
		{Feld: "Gewicht", Wert: "500", Einheit: "g"},
		{Feld: "Lieferant", Wert: "Kooperative Nariño", Beschraenkt: true},
	}
	p.Belege = append(p.Belege, speicher.Beleg{
		Titel: "Prüfbericht", URL: "https://example.de/p.pdf", Beschraenkt: true})
	p.Stoffe = append(p.Stoffe, speicher.Stoff{Name: "Beschichtung", Beschraenkt: true})

	if n := p.Beschraenkte(); n != 3 {
		t.Errorf("erwartet 3 zurueckgehaltene Angaben, gezaehlt %d", n)
	}

	oeff := p.Oeffentlich()
	for _, a := range oeff.Angaben {
		if a.Beschraenkt {
			t.Error("beschraenkte Angabe in der oeffentlichen Fassung")
		}
	}
	for _, b := range oeff.Belege {
		if b.Beschraenkt {
			t.Error("beschraenkter Beleg in der oeffentlichen Fassung")
		}
	}
	for _, st := range oeff.Stoffe {
		if st.Beschraenkt {
			t.Error("beschraenkter Stoff in der oeffentlichen Fassung")
		}
	}
	if len(oeff.Angaben) != 1 || len(oeff.Stoffe) != 3 || len(oeff.Belege) != 1 {
		t.Errorf("die oeffentliche Fassung hat zu viel oder zu wenig: %d/%d/%d",
			len(oeff.Angaben), len(oeff.Stoffe), len(oeff.Belege))
	}

	// Das Original bleibt unangetastet — sonst waere die Kopie ein Verlust.
	if len(p.Angaben) != 2 {
		t.Error("Oeffentlich hat das Original beschnitten")
	}
}

func TestUrteilNenntDenGrund(t *testing.T) {
	p := voll()
	p.Hersteller = ""
	u := Pruefe(p)
	for _, f := range u.Befunde {
		if f.Feld == "hersteller" && !strings.Contains(f.Grund, "Marktaufsicht") {
			t.Errorf("Befund ohne brauchbaren Grund: %+v", f)
		}
	}
}
