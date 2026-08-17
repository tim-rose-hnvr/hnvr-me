package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

const karteJSON = `{"vorlage":"karte","titel":"Sommerkarte",
  "bloecke":[{"titel":"Kleinigkeiten","zeilen":[{"was":"Flammkuchen","neben":"9,50 €"}]}],
  "handlung":{"text":"Ganze Karte","ziel":"https://example.de/karte"}}`

// Der Scan landet auf der Seite und nicht auf einer Weiterleitung —
// das ist der ganze Unterschied.
func TestScanZeigtDieSeite(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Tisch 12","ziel":"https://example.de/karte"}`)

	// Vorher: Weiterleitung.
	vor := w.ruf("GET", "/r/"+c.Kuerzel, "", "")
	if vor.Code != http.StatusFound {
		t.Fatalf("ohne Seite: %d statt 302", vor.Code)
	}

	if a := w.ruf("PUT", "/api/v1/codes/"+c.ID+"/seite", k, karteJSON); a.Code != http.StatusOK {
		t.Fatalf("Seite setzen: %d %s", a.Code, a.Body.String())
	}

	nach := w.ruf("GET", "/r/"+c.Kuerzel, "", "")
	if nach.Code != http.StatusOK {
		t.Fatalf("mit Seite: %d statt 200", nach.Code)
	}
	koerper := nach.Body.String()
	for _, muss := range []string{"Sommerkarte", "Flammkuchen", "9,50 €",
		`href="/r/` + c.Kuerzel + `/weiter"`} {
		if !strings.Contains(koerper, muss) {
			t.Errorf("die Seite enthaelt %q nicht", muss)
		}
	}
	// Eine Landeseite laedt nichts nach und traegt kein Skript.
	regel := nach.Header().Get("Content-Security-Policy")
	if !strings.Contains(regel, "default-src 'none'") {
		t.Errorf("CSP: %s", regel)
	}
	if strings.Contains(koerper, "<script") {
		t.Error("die Landeseite traegt ein Skript")
	}
}

// Der Knopf zaehlt den zweiten Schritt und erhoeht die Scans nicht.
func TestKnopfZaehltAlsSchritt(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Tisch 12","ziel":"https://example.de/karte"}`)
	w.ruf("PUT", "/api/v1/codes/"+c.ID+"/seite", k, karteJSON)

	for i := 0; i < 3; i++ {
		w.ruf("GET", "/r/"+c.Kuerzel, "", "")
	}
	a := w.ruf("GET", "/r/"+c.Kuerzel+"/weiter", "", "")
	if a.Code != http.StatusFound {
		t.Fatalf("Knopf: %d statt 302", a.Code)
	}
	if ort := a.Header().Get("Location"); ort != "https://example.de/karte" {
		t.Errorf("Knopf fuehrt nach %q", ort)
	}

	stand := w.ablage.Zaehlerstand(c.ID)
	if len(stand) != 1 {
		t.Fatalf("%d Tage", len(stand))
	}
	if stand[0].Gesamt != 3 {
		t.Errorf("%d Scans statt 3 — der Knopf zaehlt als Scan mit", stand[0].Gesamt)
	}
	if stand[0].Zaehler["schritt:weiter"] != 1 {
		t.Errorf("der Schritt fehlt: %v", stand[0].Zaehler)
	}
}

// Ohne Seite fuehrt der Knopfweg trotzdem irgendwohin — er darf nie in
// einen Serverfehler laufen, denn er kann in einem Lesezeichen stehen.
func TestKnopfOhneSeite(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Plakat","ziel":"https://example.de/plakat"}`)

	a := w.ruf("GET", "/r/"+c.Kuerzel+"/weiter", "", "")
	if a.Code != http.StatusFound {
		t.Errorf("%d statt 302", a.Code)
	}
	if ort := a.Header().Get("Location"); ort != "https://example.de/plakat" {
		t.Errorf("fuehrt nach %q", ort)
	}
	if a := w.ruf("GET", "/r/gibtsnicht/weiter", "", ""); a.Code != http.StatusNotFound {
		t.Errorf("unbekanntes Kuerzel: %d statt 404", a.Code)
	}
}

// Eine Seite mit unerlaubtem Schema kommt nicht in die Ablage.
func TestBoesesZielWirdNichtGespeichert(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Tisch","ziel":"https://example.de"}`)

	boese := `{"vorlage":"karte","titel":"X",
	  "handlung":{"text":"Los","ziel":"javascript:alert(1)"}}`
	a := w.ruf("PUT", "/api/v1/codes/"+c.ID+"/seite", k, boese)
	if a.Code != http.StatusBadRequest {
		t.Fatalf("%d statt 400: %s", a.Code, a.Body.String())
	}
	if !strings.Contains(a.Body.String(), "javascript") {
		t.Errorf("Meldung: %s", a.Body.String())
	}
	jetzt, _ := w.ablage.NachID(c.ID)
	if jetzt.Seite != nil {
		t.Error("die Seite wurde trotzdem gesetzt")
	}
}

// Eine Seite zu entfernen, ohne dass ein Ziel dahinter steht, wuerde
// den Code ins Leere laufen lassen — und das merkt man erst beim
// naechsten Scan, vor dem Aufsteller.
func TestSeiteEntfernenBrauchtEinZiel(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")

	ohneZiel := &speicher.Code{Kuerzel: w.ablage.FreiesKuerzel(),
		KontoID: w.ablage.OrgVon(mussSchluessel(t, w, k)), Name: "Nur Seite", Aktiv: true}
	if err := w.ablage.LegeAn(ohneZiel); err != nil {
		t.Fatal(err)
	}
	if a := w.ruf("PUT", "/api/v1/codes/"+ohneZiel.ID+"/seite", k, karteJSON); a.Code != http.StatusOK {
		t.Fatalf("Seite setzen: %d %s", a.Code, a.Body.String())
	}
	a := w.ruf("DELETE", "/api/v1/codes/"+ohneZiel.ID+"/seite", k, "")
	if a.Code != http.StatusConflict {
		t.Fatalf("%d statt 409: %s", a.Code, a.Body.String())
	}
	jetzt, _ := w.ablage.NachID(ohneZiel.ID)
	if jetzt.Seite == nil {
		t.Error("die Seite wurde trotzdem entfernt")
	}
}

func mussSchluessel(t *testing.T, w *welt, klartext string) *speicher.Schluessel {
	t.Helper()
	sch, err := w.ablage.PruefeSchluessel(klartext)
	if err != nil {
		t.Fatal(err)
	}
	return sch
}

// Dieselbe Regel wie ueberall: ein fremder Code ist unerreichbar.
func TestFremdeSeiteBleibtUnerreichbar(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("eins@x.de")
	_, fremd := w.konto("zwei@x.de")
	c := w.legeCode(k, `{"name":"Meins","ziel":"https://example.de"}`)
	w.ruf("PUT", "/api/v1/codes/"+c.ID+"/seite", k, karteJSON)

	for _, fall := range []struct{ art, rumpf string }{
		{"GET", ""}, {"PUT", karteJSON}, {"DELETE", ""},
	} {
		a := w.ruf(fall.art, "/api/v1/codes/"+c.ID+"/seite", fremd, fall.rumpf)
		if a.Code != http.StatusNotFound {
			t.Errorf("%s: %d statt 404", fall.art, a.Code)
		}
	}
	jetzt, _ := w.ablage.NachID(c.ID)
	if jetzt.Seite == nil || jetzt.Seite.Titel != "Sommerkarte" {
		t.Error("ein Fremder hat die Seite veraendert")
	}
}

func TestNurLesenDarfKeineSeiteSetzen(t *testing.T) {
	w := baueWelt(t)
	kontoID, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Tisch","ziel":"https://example.de"}`)
	_, leser, err := w.ablage.LegeSchluesselAn(kontoID, "leser", true)
	if err != nil {
		t.Fatal(err)
	}
	if a := w.ruf("PUT", "/api/v1/codes/"+c.ID+"/seite", leser, karteJSON); a.Code != http.StatusForbidden {
		t.Errorf("%d statt 403", a.Code)
	}
}

// Die Vorlagen tragen ausgefuellte Beispiele — eine leere Maske mit der
// Ueberschrift „Karte kompakt" sagt niemandem, was hineingehoert.
func TestVorlagenMitBeispiel(t *testing.T) {
	w := baueWelt(t)
	a := w.ruf("GET", "/api/v1/vorlagen", "", "")
	if a.Code != http.StatusOK {
		t.Fatalf("%d", a.Code)
	}
	var liste []struct {
		Schluessel string          `json:"schluessel"`
		Name       string          `json:"name"`
		Beispiel   *speicher.Seite `json:"beispiel"`
	}
	if err := json.Unmarshal(a.Body.Bytes(), &liste); err != nil {
		t.Fatal(err)
	}
	if len(liste) != 4 {
		t.Fatalf("%d Vorlagen", len(liste))
	}
	for _, v := range liste {
		if v.Beispiel == nil {
			t.Errorf("%s ohne Beispiel", v.Schluessel)
			continue
		}
		// Jedes Beispiel muss selbst durch die Pruefung gehen — sonst
		// legt der erste Klick eine Seite an, die abgelehnt wird.
		if fehler := v.Beispiel.Pruefe(); len(fehler) > 0 {
			t.Errorf("das Beispiel zu %s ist nicht gueltig: %v", v.Schluessel, fehler)
		}
		if v.Beispiel.Vorlage != v.Schluessel {
			t.Errorf("%s: Beispiel traegt Vorlage %q", v.Schluessel, v.Beispiel.Vorlage)
		}
	}
}

func TestSeitePruefenSpeichertNicht(t *testing.T) {
	w := baueWelt(t)
	a := w.ruf("POST", "/api/v1/seite/pruefen", "",
		`{"vorlage":"karte","titel":"","handlung":{"text":"","ziel":"nope"}}`)
	if a.Code != http.StatusOK {
		t.Fatalf("%d", a.Code)
	}
	var d struct {
		InOrdnung bool     `json:"inOrdnung"`
		Fehler    []string `json:"fehler"`
	}
	if err := json.Unmarshal(a.Body.Bytes(), &d); err != nil {
		t.Fatal(err)
	}
	if d.InOrdnung || len(d.Fehler) < 2 {
		t.Errorf("%+v", d)
	}
	if n := len(w.ablage.Liste("")); n != 0 {
		t.Errorf("%d Codes angelegt", n)
	}
}

// Die Vorschau zeichnet auch eine halbfertige Seite: waehrend des
// Tippens ist sie fast immer halbfertig, und eine Vorschau, die dann
// nichts zeigt, ist keine.
func TestVorschauZeichnetAuchUnfertiges(t *testing.T) {
	w := baueWelt(t)
	a := w.ruf("POST", "/api/v1/seite/vorschau", "", `{"vorlage":"","titel":""}`)
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	if !strings.Contains(a.Body.String(), "Ohne Titel") {
		t.Errorf("Ausgabe: %s", a.Body.String()[:200])
	}
}
