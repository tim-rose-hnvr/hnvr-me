package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Diese Pruefungen laufen ueber denselben Verteiler wie der Betrieb.

func (w *welt) csv(art, weg, schluessel, tabelle string) *httptest.ResponseRecorder {
	w.t.Helper()
	r := httptest.NewRequest(art, weg, strings.NewReader(tabelle))
	r.Header.Set("Content-Type", "text/csv")
	if schluessel != "" {
		r.Header.Set(kopfSchluessel, schluessel)
	}
	antwort := httptest.NewRecorder()
	w.weg.ServeHTTP(antwort, r)
	return antwort
}

const tische = "Tisch,Bereich\n1,Innen\n2,Innen\n3,Terrasse Süd\n"

// Der Trockenlauf ist der Grund fuer die Trennung der beiden Wege: er
// darf unter keinen Umstaenden etwas anlegen. Wer das aufweicht,
// verbraucht Kuerzel fuer Serien, die nie gedruckt werden.
func TestVorschauLegtNichtsAn(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")

	a := w.csv("POST", "/api/v1/serie/vorschau?anlegen=1&muster=https://x.de/t{Tisch}", k, tische)
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	var d struct {
		Brauchbar int `json:"brauchbar"`
		Bogen     struct {
			Anzahl int `json:"anzahl"`
		} `json:"bogen"`
	}
	if err := json.Unmarshal(a.Body.Bytes(), &d); err != nil {
		t.Fatal(err)
	}
	if d.Brauchbar != 3 {
		t.Errorf("%d brauchbare Zeilen statt 3", d.Brauchbar)
	}
	if d.Bogen.Anzahl != 1 {
		t.Errorf("%d Bogen statt 1", d.Bogen.Anzahl)
	}
	if n := len(w.ablage.Liste("")); n != 0 {
		t.Errorf("die Vorschau hat %d Codes angelegt", n)
	}
}

// Ein vertipptes Muster muss vor dem Anlegen auffallen — und zwar auch
// dann, wenn jemand den Trockenlauf ueberspringt und gleich erzeugt.
func TestTippfehlerLegtNichtsAn(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")

	a := w.csv("POST", "/api/v1/serie?anlegen=1&muster=https://x.de/t{Tsich}", k, tische)
	if a.Code != http.StatusBadRequest {
		t.Fatalf("%d statt 400: %s", a.Code, a.Body.String())
	}
	if !strings.Contains(a.Body.String(), "Tsich") {
		t.Errorf("die Meldung nennt den Tippfehler nicht: %s", a.Body.String())
	}
	if n := len(w.ablage.Liste("")); n != 0 {
		t.Errorf("trotz Fehler wurden %d Codes angelegt", n)
	}
}

func TestSeriePaket(t *testing.T) {
	w := baueWelt(t)
	org, k := w.konto("a@b.de")

	a := w.csv("POST",
		"/api/v1/serie?anlegen=1&muster=https://x.de/{Bereich}/t{Tisch}&namespalte=Bereich&ordner=Sommer",
		k, tische)
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	if art := a.Header().Get("Content-Type"); art != "application/zip" {
		t.Errorf("Content-Type %q", art)
	}

	roh := a.Body.Bytes()
	paket, err := zip.NewReader(bytes.NewReader(roh), int64(len(roh)))
	if err != nil {
		t.Fatal(err)
	}
	namen := map[string]bool{}
	for _, f := range paket.File {
		namen[f.Name] = true
	}
	for _, muss := range []string{"bogen-01.pdf", "bericht.csv", "LIESMICH.txt"} {
		if !namen[muss] {
			t.Errorf("%s fehlt im Paket", muss)
		}
	}
	einzeln := 0
	for name := range namen {
		if strings.HasPrefix(name, "einzeln/") && strings.HasSuffix(name, ".pdf") {
			einzeln++
		}
	}
	if einzeln != 3 {
		t.Errorf("%d Einzel-PDFs statt 3", einzeln)
	}

	codes := w.ablage.Liste(org)
	if len(codes) != 3 {
		t.Fatalf("%d Codes angelegt statt 3", len(codes))
	}
	gefunden := map[string]bool{}
	for _, c := range codes {
		gefunden[c.Ziel] = true
		if c.Ordner != "Sommer" {
			t.Errorf("Ordner %q", c.Ordner)
		}
		if c.Herkunft != "serie" {
			t.Errorf("Herkunft %q", c.Herkunft)
		}
	}
	// Der Umlaut muss im Ziel vereinfacht sein, nicht prozentkodiert.
	if !gefunden["https://x.de/terrasse-sued/t3"] {
		t.Errorf("Ziele: %v", gefunden)
	}
}

// Ein Schluessel, der nur lesen darf, darf eine Vorschau rechnen, aber
// keine Serie anlegen.
func TestNurLesenDarfKeineSerieAnlegen(t *testing.T) {
	w := baueWelt(t)
	konto, err := w.ablage.LegeKontoAn("c@d.de", "c", "ein sehr langes Passwort")
	if err != nil {
		t.Fatal(err)
	}
	_, leser, err := w.ablage.LegeSchluesselAn(konto.ID, "leser", true)
	if err != nil {
		t.Fatal(err)
	}

	if a := w.csv("POST", "/api/v1/serie/vorschau?muster=https://x.de/t{Tisch}", leser, tische); a.Code != http.StatusOK {
		t.Errorf("Vorschau: %d %s", a.Code, a.Body.String())
	}
	if a := w.csv("POST", "/api/v1/serie?anlegen=1&muster=https://x.de/t{Tisch}", leser, tische); a.Code != http.StatusForbidden {
		t.Errorf("Anlegen: %d statt 403", a.Code)
	}
	if n := len(w.ablage.Liste("")); n != 0 {
		t.Errorf("%d Codes angelegt", n)
	}
}

func TestSerieOhneSchluessel(t *testing.T) {
	w := baueWelt(t)
	for _, weg := range []string{"/api/v1/serie/vorschau", "/api/v1/serie", "/api/v1/zahlen"} {
		if a := w.csv("POST", weg, "", tische); a.Code != http.StatusUnauthorized &&
			a.Code != http.StatusMethodNotAllowed {
			t.Errorf("%s: %d statt 401", weg, a.Code)
		}
	}
}

// Die Zahlen einer Organisation duerfen keine fremden Codes enthalten.
// Dasselbe Loch wie bei den Einzelcodes, nur eine Ebene hoeher.
func TestZahlenZeigenNurEigenes(t *testing.T) {
	w := baueWelt(t)
	_, k1 := w.konto("eins@x.de")
	_, k2 := w.konto("zwei@x.de")

	w.legeCode(k1, `{"name":"Meins","ziel":"https://meins.de"}`)
	w.legeCode(k2, `{"name":"Deins","ziel":"https://deins.de"}`)

	a := w.ruf("GET", "/api/v1/zahlen?tage=30", k1, "")
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	var u struct {
		CodesGesamt int `json:"codesGesamt"`
		Codes       []struct {
			Name string `json:"name"`
		} `json:"codes"`
	}
	if err := json.Unmarshal(a.Body.Bytes(), &u); err != nil {
		t.Fatal(err)
	}
	if u.CodesGesamt != 1 {
		t.Errorf("%d Codes statt 1", u.CodesGesamt)
	}
	for _, c := range u.Codes {
		if c.Name == "Deins" {
			t.Error("der fremde Code steht in den Zahlen")
		}
	}
}

// Die Seiten muessen ohne Schluessel ausliefern — sie holen ihre Daten
// erst im Browser. Und sie muessen die Tokenschicht laden duerfen: ein
// style-src ohne 'self' laesst die Seite lautlos ungestylt.
func TestSeitenLiefernUndDuerfenGestaltLaden(t *testing.T) {
	w := baueWelt(t)
	for _, weg := range []string{"/", "/zentrale", "/serie", "/zahlen"} {
		a := w.ruf("GET", weg, "", "")
		if a.Code != http.StatusOK {
			t.Errorf("%s: %d", weg, a.Code)
			continue
		}
		regel := a.Header().Get("Content-Security-Policy")
		if !strings.Contains(regel, "style-src 'self'") {
			t.Errorf("%s: style-src ohne 'self' — die Tokenschicht bliebe draussen: %s", weg, regel)
		}
		if !strings.Contains(regel, "font-src 'self'") {
			t.Errorf("%s: font-src ohne 'self' — die Schriften blieben draussen: %s", weg, regel)
		}
		if !strings.Contains(a.Body.String(), "/gestalt/organic.css") {
			t.Errorf("%s: ohne Tokenschicht im Kopf", weg)
		}
		if !strings.Contains(a.Body.String(), `href="/marke.svg"`) {
			t.Errorf("%s: ohne Favicon — der Browser holt /favicon.ico und bekommt 404", weg)
		}
	}
}
