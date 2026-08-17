package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

func codeMitDreiZielen(t *testing.T, w *welt, k string) speicher.Code {
	t.Helper()
	c := w.legeCode(k, `{"name":"Sommerkarte","ziel":"https://x.de/sommer"}`)
	for _, ziel := range []string{"https://x.de/herbst", "https://x.de/winter"} {
		a := w.ruf("PATCH", "/api/v1/codes/"+c.ID, k, `{"ziel":"`+ziel+`"}`)
		if a.Code != http.StatusOK {
			t.Fatalf("Aendern: %d %s", a.Code, a.Body.String())
		}
	}
	return c
}

func TestFassungenUeberDieSchnittstelle(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := codeMitDreiZielen(t, w, k)

	a := w.ruf("GET", "/api/v1/codes/"+c.ID+"/fassungen", k, "")
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	var liste []speicher.Code
	if err := json.Unmarshal(a.Body.Bytes(), &liste); err != nil {
		t.Fatal(err)
	}
	if len(liste) != 3 {
		t.Fatalf("%d Fassungen statt 3", len(liste))
	}
	if liste[0].Ziel != "https://x.de/sommer" || liste[2].Ziel != "https://x.de/winter" {
		t.Errorf("Reihenfolge: %s … %s", liste[0].Ziel, liste[2].Ziel)
	}
}

// Zurueckholen aendert das Ziel wirklich — und zwar so, dass ein Scan
// dorthin geht. Das ist der Punkt: die Liste selbst waere nutzlos.
func TestZurueckholenAendertDenScan(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := codeMitDreiZielen(t, w, k)

	vor := w.ruf("GET", "/r/"+c.Kuerzel, "", "")
	if ort := vor.Header().Get("Location"); ort != "https://x.de/winter" {
		t.Fatalf("vorher fuehrt der Scan nach %q", ort)
	}

	a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/fassungen/1", k, "")
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	var neu speicher.Code
	if err := json.Unmarshal(a.Body.Bytes(), &neu); err != nil {
		t.Fatal(err)
	}
	if neu.Fassung != 4 {
		t.Errorf("Fassung %d statt 4", neu.Fassung)
	}
	nach := w.ruf("GET", "/r/"+c.Kuerzel, "", "")
	if ort := nach.Header().Get("Location"); ort != "https://x.de/sommer" {
		t.Errorf("nachher fuehrt der Scan nach %q", ort)
	}
}

// Dieselbe Fassung noch einmal ist kein Fehler des Aufrufers und kein
// Serverfehler, sondern ein Leerlauf. 409 sagt genau das.
func TestZurueckholenLeerlauf(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := codeMitDreiZielen(t, w, k)

	if a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/fassungen/3", k, ""); a.Code != http.StatusConflict {
		t.Errorf("%d statt 409: %s", a.Code, a.Body.String())
	}
	// Und es wurde nichts geschrieben.
	jetzt, _ := w.ablage.NachID(c.ID)
	if jetzt.Fassung != 3 {
		t.Errorf("Fassung %d — es wurde trotzdem geschrieben", jetzt.Fassung)
	}
}

func TestZurueckholenUnbekannteFassung(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := codeMitDreiZielen(t, w, k)

	a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/fassungen/9", k, "")
	if a.Code != http.StatusBadRequest {
		t.Errorf("%d statt 400", a.Code)
	}
	if !strings.Contains(a.Body.String(), "1, 2, 3") {
		t.Errorf("die Meldung nennt die vorhandenen Nummern nicht: %s", a.Body.String())
	}

	if a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/fassungen/keine", k, ""); a.Code != http.StatusBadRequest {
		t.Errorf("keine Zahl: %d statt 400", a.Code)
	}
}

// Dieselbe Regel wie ueberall sonst: ein fremder Code ist unerreichbar,
// und „gibt es nicht" sieht aus wie „gehoert einem anderen".
func TestFremdeFassungenBleibenUnerreichbar(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("eins@x.de")
	_, fremd := w.konto("zwei@x.de")
	c := codeMitDreiZielen(t, w, k)

	for _, fall := range []struct{ art, weg string }{
		{"GET", "/api/v1/codes/" + c.ID + "/fassungen"},
		{"POST", "/api/v1/codes/" + c.ID + "/fassungen/1"},
	} {
		a := w.ruf(fall.art, fall.weg, fremd, "")
		if a.Code != http.StatusNotFound {
			t.Errorf("%s %s: %d statt 404", fall.art, fall.weg, a.Code)
		}
	}
	// Und das Ziel ist unveraendert.
	jetzt, _ := w.ablage.NachID(c.ID)
	if jetzt.Ziel != "https://x.de/winter" {
		t.Errorf("Ziel %q — ein Fremder hat es verstellt", jetzt.Ziel)
	}
}

// Ein Leseschluessel darf die Geschichte ansehen, aber nichts holen.
func TestNurLesenDarfNichtZurueckholen(t *testing.T) {
	w := baueWelt(t)
	kontoID, k := w.konto("a@b.de")
	c := codeMitDreiZielen(t, w, k)

	_, leser, err := w.ablage.LegeSchluesselAn(kontoID, "leser", true)
	if err != nil {
		t.Fatal(err)
	}
	if a := w.ruf("GET", "/api/v1/codes/"+c.ID+"/fassungen", leser, ""); a.Code != http.StatusOK {
		t.Errorf("Lesen: %d", a.Code)
	}
	if a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/fassungen/1", leser, ""); a.Code != http.StatusForbidden {
		t.Errorf("Holen: %d statt 403", a.Code)
	}
}
