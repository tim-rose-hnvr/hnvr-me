package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

const passRumpf = `{
  "gtin":"4006381333931",
  "bezeichnung":"Röstkaffee 500 g",
  "modell":"Hausmischung",
  "hersteller":"Rösterei Klein GmbH",
  "herstellerAnschrift":"Marktweg 3, 30159 Hannover",
  "stoffe":[
    {"name":"Papier","anteilProzent":70,"rezykliertProzent":60},
    {"name":"Beschichtung","anteilProzent":5,"beschraenkt":true}],
  "angaben":[
    {"feld":"Gewicht","wert":"500","einheit":"g"},
    {"feld":"Lieferant","wert":"Kooperative Nariño","beschraenkt":true}],
  "belege":[{"titel":"Konformitätserklärung","url":"https://example.de/ke.pdf"}],
  "reparatur":"Verpackung, keine Reparatur vorgesehen.",
  "entsorgung":"Papiertonne nach Trennung der Innenschicht."
}`

func (w *welt) hole(weg, schluessel, accept string) *httptest.ResponseRecorder {
	w.t.Helper()
	r := httptest.NewRequest("GET", weg, nil)
	if schluessel != "" {
		r.Header.Set(kopfSchluessel, schluessel)
	}
	if accept != "" {
		r.Header.Set("Accept", accept)
	}
	antwort := httptest.NewRecorder()
	w.weg.ServeHTTP(antwort, r)
	return antwort
}

func TestPassWirdNormiertUndGefunden(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")

	if antwort := w.ruf("PUT", "/api/v1/pass", schluessel, passRumpf); antwort.Code != http.StatusOK {
		t.Fatalf("Pass nicht angenommen: %d %s", antwort.Code, antwort.Body.String())
	}

	// Angelegt mit 13 Stellen, gefunden ueber 14 — und umgekehrt. Ohne
	// Normierung laege derselbe Artikel zweimal in der Ablage.
	for _, gtin := range []string{"4006381333931", "04006381333931"} {
		if antwort := w.hole("/p/"+gtin, "", ""); antwort.Code != http.StatusOK {
			t.Errorf("/p/%s: %d", gtin, antwort.Code)
		}
	}
	if antwort := w.hole("/p/4006381333930", "", ""); antwort.Code != http.StatusBadRequest {
		t.Errorf("falsche Pruefziffer haette 400 geben muessen, gab %d", antwort.Code)
	}
	if antwort := w.hole("/p/4260000000004", "", ""); antwort.Code != http.StatusNotFound {
		t.Errorf("unbekannter Artikel haette 404 geben muessen, gab %d", antwort.Code)
	}
}

// Der Kern der Zugriffstrennung: was beschraenkt ist, darf gar nicht
// erst ueber die Leitung gehen. Eine Seite, die es ausblendet, hat es
// trotzdem ausgeliefert.
func TestBeschraenktesStehtNichtInDerAntwort(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	w.ruf("PUT", "/api/v1/pass", schluessel, passRumpf)

	oeffentlich := w.hole("/p/4006381333931", "", "").Body.String()
	for _, geheim := range []string{"Nariño", "Beschichtung", "Lieferant"} {
		if strings.Contains(oeffentlich, geheim) {
			t.Errorf("%q steht auf der oeffentlichen Seite", geheim)
		}
	}
	for _, offen := range []string{"Röstkaffee", "Papier", "Gewicht", "Konformitätserklärung"} {
		if !strings.Contains(oeffentlich, offen) {
			t.Errorf("%q fehlt auf der oeffentlichen Seite", offen)
		}
	}
	// Dass etwas zurueckgehalten wird, steht dagegen sehr wohl da.
	if !strings.Contains(oeffentlich, "vorbehalten") {
		t.Error("die Seite verschweigt, dass sie etwas verschweigt")
	}

	// Mit Schluessel des Inhabers ist alles zu sehen.
	mitSchluessel := w.hole("/p/4006381333931", schluessel, "").Body.String()
	for _, geheim := range []string{"Nariño", "Beschichtung"} {
		if !strings.Contains(mitSchluessel, geheim) {
			t.Errorf("%q fehlt trotz Schluessel", geheim)
		}
	}

	// Ein fremder Schluessel bekommt nur die oeffentliche Fassung.
	_, fremder := w.konto("b@example.de")
	fremd := w.hole("/p/4006381333931", fremder, "").Body.String()
	if strings.Contains(fremd, "Nariño") {
		t.Error("ein fremder Schluessel sieht die beschraenkten Angaben")
	}
}

func TestPassAlsJSON(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	w.ruf("PUT", "/api/v1/pass", schluessel, passRumpf)

	antwort := w.hole("/p/4006381333931", "", "application/json")
	var p speicher.Produktpass
	if err := json.Unmarshal(antwort.Body.Bytes(), &p); err != nil {
		t.Fatalf("keine JSON-Antwort: %v — %s", err, antwort.Body.String())
	}
	if p.GTIN != "04006381333931" || p.Bezeichnung == "" {
		t.Errorf("unerwarteter Pass: %+v", p)
	}
	for _, a := range p.Angaben {
		if a.Beschraenkt {
			t.Error("beschraenkte Angabe in der JSON-Antwort")
		}
	}
}

// Von genau nach allgemein: eine Rueckrufcharge bekommt ihre eigenen
// Angaben, ohne dass jede Charge einen Pass braucht.
func TestChargeSchlaegtArtikel(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	w.ruf("PUT", "/api/v1/pass", schluessel, passRumpf)

	mitCharge := strings.Replace(passRumpf,
		`"bezeichnung":"Röstkaffee 500 g"`,
		`"bezeichnung":"Röstkaffee 500 g","charge":"L2026-11"`, 1)
	mitCharge = strings.Replace(mitCharge, "Hausmischung", "Rueckruf November", 1)
	if antwort := w.ruf("PUT", "/api/v1/pass", schluessel, mitCharge); antwort.Code != http.StatusOK {
		t.Fatalf("Chargenpass nicht angenommen: %d %s", antwort.Code, antwort.Body.String())
	}

	genau := w.hole("/p/4006381333931/L2026-11", "", "").Body.String()
	if !strings.Contains(genau, "Rueckruf November") {
		t.Error("die Charge bekommt nicht ihren eigenen Pass")
	}
	allgemein := w.hole("/p/4006381333931", "", "").Body.String()
	if !strings.Contains(allgemein, "Hausmischung") {
		t.Error("der Artikelpass ist durch den Chargenpass verlorengegangen")
	}
	// Eine Charge ohne eigenen Pass faellt auf den Artikel zurueck.
	andere := w.hole("/p/4006381333931/L2026-12", "", "").Body.String()
	if !strings.Contains(andere, "Hausmischung") {
		t.Error("fremde Charge faellt nicht auf den Artikelpass zurueck")
	}
}

func TestPassMitFehlernWirdNichtVeroeffentlicht(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")

	ohneHersteller := strings.Replace(passRumpf, `"hersteller":"Rösterei Klein GmbH",`, "", 1)
	antwort := w.ruf("PUT", "/api/v1/pass", schluessel, ohneHersteller)
	if antwort.Code != http.StatusBadRequest {
		t.Fatalf("Pass ohne Verantwortlichen haette 400 geben muessen, gab %d", antwort.Code)
	}
	if !strings.Contains(antwort.Body.String(), "urteil") {
		t.Error("die Ablehnung nennt das Urteil nicht")
	}
	if antwort := w.hole("/p/4006381333931", "", ""); antwort.Code != http.StatusNotFound {
		t.Error("ein abgelehnter Pass ist trotzdem online")
	}
}

func TestPassPruefenSpeichertNicht(t *testing.T) {
	w := baueWelt(t)
	antwort := w.ruf("POST", "/api/v1/pass/pruefen", "", passRumpf)
	if antwort.Code != http.StatusOK {
		t.Fatalf("%d %s", antwort.Code, antwort.Body.String())
	}
	if !strings.Contains(antwort.Body.String(), "tragfaehig") {
		t.Error("kein Urteil in der Antwort")
	}
	if antwort := w.hole("/p/4006381333931", "", ""); antwort.Code != http.StatusNotFound {
		t.Error("Pruefen hat den Pass veroeffentlicht")
	}
}

func TestNeueFassungZaehltHoch(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	w.ruf("PUT", "/api/v1/pass", schluessel, passRumpf)
	w.ruf("PUT", "/api/v1/pass", schluessel, strings.Replace(passRumpf, "Hausmischung", "Hausmischung II", 1))

	seite := w.hole("/p/4006381333931", "", "").Body.String()
	if !strings.Contains(seite, "Fassung 2") {
		t.Error("die Fassung zaehlt nicht hoch")
	}
	if !strings.Contains(seite, "Hausmischung II") {
		t.Error("die neue Fassung ist nicht zu sehen")
	}
}

func TestPassZurueckziehenNurDurchInhaber(t *testing.T) {
	w := baueWelt(t)
	orgID, inhaber := w.konto("chef@example.de")
	w.ruf("PUT", "/api/v1/pass", inhaber, passRumpf)

	mitarbeit, err := w.ablage.LegeKontoAn("Hilfe", "hilfe@example.de", "ein sehr langes Passwort")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.ablage.NimmMitarbeitendeAuf(orgID, mitarbeit.Mail, speicher.RolleRedakteur); err != nil {
		t.Fatal(err)
	}
	_, redakteur, err := w.ablage.LegeSchluesselAn(mitarbeit.ID, "test", false)
	if err != nil {
		t.Fatal(err)
	}

	if antwort := w.ruf("DELETE", "/api/v1/pass/4006381333931", redakteur, ""); antwort.Code != http.StatusForbidden {
		t.Errorf("Redakteur darf nicht zurueckziehen, bekam %d", antwort.Code)
	}
	if antwort := w.ruf("DELETE", "/api/v1/pass/4006381333931", inhaber, ""); antwort.Code != http.StatusOK {
		t.Fatalf("Inhaber konnte nicht zurueckziehen: %d %s", antwort.Code, antwort.Body.String())
	}
	if antwort := w.hole("/p/4006381333931", "", ""); antwort.Code != http.StatusNotFound {
		t.Error("zurueckgezogener Pass ist noch online")
	}
}

// Ein GS1-Code fuehrt weiter zum hinterlegten Ziel, wenn es eines gibt.
// Der Pass springt nur ein, wo nichts anderes steht — sonst haetten
// bestehende Etiketten ueber Nacht ein anderes Verhalten.
func TestDigitalLinkZielSchlaegtPass(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	w.ruf("PUT", "/api/v1/pass", schluessel, passRumpf)

	// Ohne Code mit dieser GTIN: der Pass.
	antwort := w.hole("/01/04006381333931", "", "")
	if antwort.Code != http.StatusOK || !strings.Contains(antwort.Body.String(), "Röstkaffee") {
		t.Errorf("ohne Ziel haette der Pass kommen muessen: %d", antwort.Code)
	}

	// Mit Code und Ziel: die Weiterleitung, wie bisher.
	w.legeCode(schluessel, `{"name":"Kaffee","gtin":"4006381333931","ziel":"https://example.de/kaffee"}`)
	antwort = w.hole("/01/04006381333931", "", "")
	if antwort.Code != http.StatusFound {
		t.Errorf("mit Ziel haette weitergeleitet werden muessen, kam %d", antwort.Code)
	}
	if ort := antwort.Header().Get("Location"); ort != "https://example.de/kaffee" {
		t.Errorf("falsches Ziel: %s", ort)
	}
}

// Die Seite ist ein Rechtsdokument und wird von fremden Feldern
// zusammengesetzt. Ein Winkelklammerpaar darf sie nicht aufbrechen.
func TestFremdeFelderWerdenMaskiert(t *testing.T) {
	w := baueWelt(t)
	_, schluessel := w.konto("a@example.de")
	boese := strings.Replace(passRumpf, "Hausmischung",
		`<script>alert(1)</script>`, 1)
	if antwort := w.ruf("PUT", "/api/v1/pass", schluessel, boese); antwort.Code != http.StatusOK {
		t.Fatalf("%d %s", antwort.Code, antwort.Body.String())
	}
	seite := w.hole("/p/4006381333931", "", "").Body.String()
	if strings.Contains(seite, "<script>alert(1)</script>") {
		t.Error("fremder Text steht unmaskiert in der Seite")
	}
	if !strings.Contains(seite, "&lt;script&gt;") {
		t.Error("der Text fehlt ganz — maskiert waere richtig, verschluckt nicht")
	}
}
