package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

func TestEntwuerfeUeberDieSchnittstelle(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Plakat","ziel":"https://example.de"}`)

	// Leer ist kein Fehler: ein Code ohne Entwuerfe ist der Normalfall.
	a := w.ruf("GET", "/api/v1/codes/"+c.ID+"/entwuerfe", k, "")
	if a.Code != http.StatusOK {
		t.Fatalf("%d %s", a.Code, a.Body.String())
	}
	var leer struct {
		Entwuerfe  []speicher.Entwurf `json:"entwuerfe"`
		Hoechstens int                `json:"hoechstens"`
	}
	if err := json.Unmarshal(a.Body.Bytes(), &leer); err != nil {
		t.Fatal(err)
	}
	if len(leer.Entwuerfe) != 0 || leer.Hoechstens != speicher.HoechstEntwuerfe {
		t.Errorf("%+v", leer)
	}

	b := w.ruf("POST", "/api/v1/codes/"+c.ID+"/entwuerfe", k,
		`{"name":"Terrakotta","stil":{"modulform":"weich","vordergrund":"#c67139"}}`)
	if b.Code != http.StatusOK {
		t.Fatalf("Sichern: %d %s", b.Code, b.Body.String())
	}

	jetzt, _ := w.ablage.NachID(c.ID)
	if len(jetzt.Entwuerfe) != 1 {
		t.Fatalf("%d Entwuerfe", len(jetzt.Entwuerfe))
	}
	// Die geltende Gestaltung ist unveraendert: Sichern ist kein
	// Uebernehmen.
	if jetzt.Stil != nil {
		t.Errorf("Stil %v — das Sichern hat ihn gesetzt", jetzt.Stil)
	}

	u := w.ruf("POST", "/api/v1/codes/"+c.ID+"/entwuerfe/Terrakotta/uebernehmen", k, "")
	if u.Code != http.StatusOK {
		t.Fatalf("Uebernehmen: %d %s", u.Code, u.Body.String())
	}
	// Die Antwort sagt, was sich dadurch NICHT aendert.
	if !strings.Contains(u.Body.String(), "Papier") {
		t.Errorf("die Antwort weist nicht auf den gedruckten Code hin: %s", u.Body.String())
	}
	jetzt, _ = w.ablage.NachID(c.ID)
	if jetzt.Stil["modulform"] != "weich" {
		t.Errorf("Stil %v", jetzt.Stil)
	}

	d := w.ruf("DELETE", "/api/v1/codes/"+c.ID+"/entwuerfe/Terrakotta", k, "")
	if d.Code != http.StatusOK {
		t.Fatalf("Loeschen: %d %s", d.Code, d.Body.String())
	}
	jetzt, _ = w.ablage.NachID(c.ID)
	if len(jetzt.Entwuerfe) != 0 {
		t.Errorf("%d Entwuerfe uebrig", len(jetzt.Entwuerfe))
	}
	// Die geltende Gestaltung bleibt: was gedruckt ist, ist gedruckt.
	if jetzt.Stil["modulform"] != "weich" {
		t.Errorf("das Loeschen hat die Gestaltung mitgenommen: %v", jetzt.Stil)
	}
}

func TestFremdeEntwuerfeBleibenUnerreichbar(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("eins@x.de")
	_, fremd := w.konto("zwei@x.de")
	c := w.legeCode(k, `{"name":"Meins","ziel":"https://example.de"}`)
	w.ruf("POST", "/api/v1/codes/"+c.ID+"/entwuerfe", k,
		`{"name":"A","stil":{"modulform":"weich"}}`)

	faelle := []struct{ art, weg, rumpf string }{
		{"GET", "/api/v1/codes/" + c.ID + "/entwuerfe", ""},
		{"POST", "/api/v1/codes/" + c.ID + "/entwuerfe", `{"name":"B","stil":{"a":"b"}}`},
		{"DELETE", "/api/v1/codes/" + c.ID + "/entwuerfe/A", ""},
		{"POST", "/api/v1/codes/" + c.ID + "/entwuerfe/A/uebernehmen", ""},
	}
	for _, f := range faelle {
		if a := w.ruf(f.art, f.weg, fremd, f.rumpf); a.Code != http.StatusNotFound {
			t.Errorf("%s %s: %d statt 404", f.art, f.weg, a.Code)
		}
	}
	jetzt, _ := w.ablage.NachID(c.ID)
	if len(jetzt.Entwuerfe) != 1 {
		t.Error("ein Fremder hat die Entwuerfe veraendert")
	}
}

func TestNurLesenDarfKeinenEntwurfSichern(t *testing.T) {
	w := baueWelt(t)
	kontoID, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Plakat","ziel":"https://example.de"}`)
	_, leser, err := w.ablage.LegeSchluesselAn(kontoID, "leser", true)
	if err != nil {
		t.Fatal(err)
	}
	if a := w.ruf("GET", "/api/v1/codes/"+c.ID+"/entwuerfe", leser, ""); a.Code != http.StatusOK {
		t.Errorf("Lesen: %d", a.Code)
	}
	if a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/entwuerfe", leser,
		`{"name":"A","stil":{"a":"b"}}`); a.Code != http.StatusForbidden {
		t.Errorf("Sichern: %d statt 403", a.Code)
	}
}

func TestUnbekannterEntwurf(t *testing.T) {
	w := baueWelt(t)
	_, k := w.konto("a@b.de")
	c := w.legeCode(k, `{"name":"Plakat","ziel":"https://example.de"}`)
	if a := w.ruf("DELETE", "/api/v1/codes/"+c.ID+"/entwuerfe/gibtsnicht", k, ""); a.Code != http.StatusNotFound {
		t.Errorf("%d statt 404", a.Code)
	}
	if a := w.ruf("POST", "/api/v1/codes/"+c.ID+"/entwuerfe/gibtsnicht/uebernehmen", k, ""); a.Code != http.StatusNotFound {
		t.Errorf("%d statt 404", a.Code)
	}
}
