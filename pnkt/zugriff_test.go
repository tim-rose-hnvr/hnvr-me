package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

// Diese Pruefungen laufen ueber denselben Verteiler wie der Betrieb.
// Gepruefte Rechte, die nur im Test existieren, sind keine.

type welt struct {
	t      *testing.T
	weg    *http.ServeMux
	ablage *speicher.Speicher
}

func baueWelt(t *testing.T) *welt {
	t.Helper()
	ablage, err := speicher.Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ablage.Schliesse() })
	d := &dienst{ablage: ablage, host: "https://pnkt.me"}
	return &welt{t: t, weg: wege(d), ablage: ablage}
}

// konto legt ein Konto an und gibt einen Schluessel im Klartext zurueck.
func (w *welt) konto(mail string) (string, string) {
	w.t.Helper()
	k, err := w.ablage.LegeKontoAn(mail, mail, "ein sehr langes Passwort")
	if err != nil {
		w.t.Fatal(err)
	}
	_, klartext, err := w.ablage.LegeSchluesselAn(k.ID, "test", false)
	if err != nil {
		w.t.Fatal(err)
	}
	return k.ID, klartext
}

func (w *welt) ruf(art, weg, schluessel, rumpf string) *httptest.ResponseRecorder {
	w.t.Helper()
	var koerper *strings.Reader
	if rumpf == "" {
		koerper = strings.NewReader("")
	} else {
		koerper = strings.NewReader(rumpf)
	}
	r := httptest.NewRequest(art, weg, koerper)
	if schluessel != "" {
		r.Header.Set(kopfSchluessel, schluessel)
	}
	if rumpf != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	antwort := httptest.NewRecorder()
	w.weg.ServeHTTP(antwort, r)
	return antwort
}

// legeCode legt einen Code ueber die Schnittstelle an und liefert seine Kennung.
func (w *welt) legeCode(schluessel, rumpf string) speicher.Code {
	w.t.Helper()
	antwort := w.ruf("POST", "/api/v1/codes", schluessel, rumpf)
	if antwort.Code != http.StatusCreated {
		w.t.Fatalf("Anlegen fehlgeschlagen: %d %s", antwort.Code, antwort.Body.String())
	}
	var c speicher.Code
	if err := json.Unmarshal(antwort.Body.Bytes(), &c); err != nil {
		w.t.Fatal(err)
	}
	return c
}

// Der eigentliche Grund fuer diese Datei: ein gueltiger Schluessel darf
// nicht genuegen, um an einen fremden Code zu kommen. Wer die Kennung
// kennt, kennt sonst auch das Ziel — und koennte es umbiegen.
func TestFremderCodeBleibtUnerreichbar(t *testing.T) {
	w := baueWelt(t)
	_, meiner := w.konto("a@example.de")
	_, fremder := w.konto("b@example.de")

	code := w.legeCode(meiner, `{"name":"Plakat","ziel":"https://example.de/a"}`)

	faelle := []struct {
		art, weg, rumpf string
	}{
		{"PATCH", "/api/v1/codes/" + code.ID, `{"ziel":"https://boese.de"}`},
		{"DELETE", "/api/v1/codes/" + code.ID, ""},
		{"GET", "/api/v1/codes/" + code.ID + "/statistik", ""},
		{"GET", "/api/v1/codes/" + code.ID + "/protokoll", ""},
	}
	for _, f := range faelle {
		antwort := w.ruf(f.art, f.weg, fremder, f.rumpf)
		if antwort.Code != http.StatusNotFound {
			t.Errorf("%s %s: erwartet 404, bekommen %d %s",
				f.art, f.weg, antwort.Code, antwort.Body.String())
		}
	}

	// Und das Ziel steht unveraendert.
	da, _ := w.ablage.NachID(code.ID)
	if da.Ziel != "https://example.de/a" {
		t.Errorf("fremder Zugriff hat das Ziel geaendert: %s", da.Ziel)
	}
}

func TestSucheUndOrdnerUeberDieSchnittstelle(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")

	w.legeCode(schluessel, `{"name":"Plakat Bahnhof","ordner":"Fruehjahr","ziel":"https://example.de/a"}`)
	w.legeCode(schluessel, `{"name":"Etikett","ordner":"Produkte","ziel":"https://example.de/b"}`)
	w.legeCode(schluessel, `{"name":"Aufkleber","ziel":"https://example.de/c"}`)

	lies := func(weg string) []speicher.Code {
		t.Helper()
		antwort := w.ruf("GET", weg, schluessel, "")
		if antwort.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", weg, antwort.Code, antwort.Body.String())
		}
		var codes []speicher.Code
		if err := json.Unmarshal(antwort.Body.Bytes(), &codes); err != nil {
			t.Fatal(err)
		}
		return codes
	}

	if n := len(lies("/api/v1/codes")); n != 3 {
		t.Errorf("erwartet 3 Codes, bekommen %d", n)
	}
	if n := len(lies("/api/v1/codes?ordner=Fruehjahr")); n != 1 {
		t.Errorf("Ordnerfilter: erwartet 1, bekommen %d", n)
	}
	if n := len(lies("/api/v1/codes?ordner=-")); n != 1 {
		t.Errorf("ohne Ordner: erwartet 1, bekommen %d", n)
	}
	if n := len(lies("/api/v1/codes?suche=bahnhof")); n != 1 {
		t.Errorf("Suche: erwartet 1, bekommen %d", n)
	}

	antwort := w.ruf("GET", "/api/v1/ordner", schluessel, "")
	var stand []speicher.Ordnerstand
	if err := json.Unmarshal(antwort.Body.Bytes(), &stand); err != nil {
		t.Fatal(err)
	}
	if len(stand) != 3 || stand[0].Name != "" || stand[0].Anzahl != 1 {
		t.Errorf("Ordnerstand unerwartet: %+v", stand)
	}
}

func TestOrdnerLaesstSichLeeren(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	code := w.legeCode(schluessel, `{"name":"Plakat","ordner":"Fruehjahr","ziel":"https://example.de/a"}`)

	// Ein Aufruf ohne das Feld laesst den Ordner stehen …
	if antwort := w.ruf("PATCH", "/api/v1/codes/"+code.ID, schluessel, `{"name":"Plakat neu"}`); antwort.Code != http.StatusOK {
		t.Fatalf("%d %s", antwort.Code, antwort.Body.String())
	}
	if da, _ := w.ablage.NachID(code.ID); da.Ordner != "Fruehjahr" {
		t.Errorf("Ordner ging ohne Zutun verloren: %q", da.Ordner)
	}
	// … ein leerer Wert leert ihn ausdruecklich.
	if antwort := w.ruf("PATCH", "/api/v1/codes/"+code.ID, schluessel, `{"ordner":""}`); antwort.Code != http.StatusOK {
		t.Fatalf("%d %s", antwort.Code, antwort.Body.String())
	}
	if da, _ := w.ablage.NachID(code.ID); da.Ordner != "" {
		t.Errorf("Ordner liess sich nicht leeren: %q", da.Ordner)
	}
	// Und das Ziel steht die ganze Zeit unangetastet da.
	if da, _ := w.ablage.NachID(code.ID); da.Ziel != "https://example.de/a" {
		t.Errorf("ein knapper Aufruf hat das Ziel geloescht: %q", da.Ziel)
	}
}

// Loeschen ist der einzige Vorgang, den eine gedruckte Auflage nicht
// ueberlebt. Deshalb: nur der Inhaber, und das Kuerzel bleibt belegt.
func TestLoeschenNurDurchInhaberUndKuerzelBleibt(t *testing.T) {
	w := baueWelt(t)
	orgID, inhaber := w.konto("chef@example.de")
	code := w.legeCode(inhaber, `{"name":"Plakat","ziel":"https://example.de/a"}`)

	// Ein Redakteur derselben Organisation darf schreiben, aber nicht loeschen.
	mitarbeit, err := w.ablage.LegeKontoAn("Hilfe", "hilfe@example.de", "ein sehr langes Passwort")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.ablage.NimmMitarbeitendeAuf(orgID, mitarbeit.Mail, speicher.RolleRedakteur); err != nil {
		t.Fatal(err)
	}
	_, redakteurSchluessel, err := w.ablage.LegeSchluesselAn(mitarbeit.ID, "test", false)
	if err != nil {
		t.Fatal(err)
	}
	if antwort := w.ruf("PATCH", "/api/v1/codes/"+code.ID, redakteurSchluessel,
		`{"ziel":"https://example.de/b"}`); antwort.Code != http.StatusOK {
		t.Errorf("Redakteur darf aendern, bekam %d %s", antwort.Code, antwort.Body.String())
	}
	if antwort := w.ruf("DELETE", "/api/v1/codes/"+code.ID, redakteurSchluessel, ""); antwort.Code != http.StatusForbidden {
		t.Errorf("Redakteur darf nicht loeschen, bekam %d", antwort.Code)
	}

	// Der Inhaber darf.
	if antwort := w.ruf("DELETE", "/api/v1/codes/"+code.ID, inhaber, ""); antwort.Code != http.StatusOK {
		t.Fatalf("Inhaber konnte nicht loeschen: %d %s", antwort.Code, antwort.Body.String())
	}

	// Ein Scan laeuft danach auf eine lesbare Seite, nicht auf 404 und
	// niemals auf ein fremdes Ziel.
	scan := httptest.NewRecorder()
	w.weg.ServeHTTP(scan, httptest.NewRequest("GET", "/"+code.Kuerzel, nil))
	if scan.Code != http.StatusGone {
		t.Errorf("Scan eines geloeschten Codes: erwartet 410, bekommen %d", scan.Code)
	}
	if !strings.Contains(scan.Body.String(), "eloescht") {
		t.Error("die Hinweisseite sagt nicht, dass der Code geloescht wurde")
	}

	// Das Kuerzel bleibt vergeben.
	if err := w.ablage.LegeAn(&speicher.Code{Kuerzel: code.Kuerzel, Ziel: "https://fremd.de"}); err == nil {
		t.Error("das Kuerzel eines geloeschten Codes wurde neu vergeben")
	}
	// Und er kommt nicht zurueck.
	if antwort := w.ruf("PATCH", "/api/v1/codes/"+code.ID, inhaber,
		`{"ziel":"https://example.de/zurueck"}`); antwort.Code != http.StatusGone {
		t.Errorf("geloeschter Code liess sich wiederbeleben: %d", antwort.Code)
	}
}
