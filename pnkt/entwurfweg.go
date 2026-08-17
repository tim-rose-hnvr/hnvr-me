package main

import (
	"encoding/json"
	"net/http"

	"pnkt.me/pnkt/speicher"
)

// Die Wege zu den Entwuerfen eines Codes.

func (d *dienst) entwuerfeLesen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	// Eine leere Liste ist kein Fehler: ein Code ohne Entwuerfe ist der
	// Normalfall, und 404 zwaenge jede Oberflaeche zu einer Ausnahme.
	liste := c.Entwuerfe
	if liste == nil {
		liste = []speicher.Entwurf{}
	}
	d.jsonAus(w, http.StatusOK, map[string]any{
		"entwuerfe": liste, "stil": c.Stil, "hoechstens": speicher.HoechstEntwuerfe,
	})
}

func (d *dienst) entwurfSichern(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	var wunsch struct {
		Name string         `json:"name"`
		Stil map[string]any `json:"stil"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<18)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	neu, err := d.ablage.SichereEntwurf(c.ID, wunsch.Name, wunsch.Stil)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: c.KontoID, Wer: kennungKurz(sch), Was: "entwurf.gesichert",
		Gegenstand: c.ID, Neu: wunsch.Name,
	})
	d.jsonAus(w, http.StatusOK, neu)
}

func (d *dienst) entwurfWeg(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	neu, err := d.ablage.LoescheEntwurf(c.ID, r.PathValue("name"))
	if err != nil {
		d.jsonAus(w, http.StatusNotFound, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, neu)
}

// entwurfUebernehmen macht einen Entwurf zur geltenden Gestaltung.
//
// Am gedruckten Code aendert das nichts — die Module stehen auf Papier.
// Es aendert, was beim naechsten Export herauskommt, und darauf weist
// die Antwort hin.
func (d *dienst) entwurfUebernehmen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	name := r.PathValue("name")
	neu, err := d.ablage.UebernimmEntwurf(c.ID, name)
	if err != nil {
		d.jsonAus(w, http.StatusNotFound, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: c.KontoID, Wer: kennungKurz(sch), Was: "entwurf.uebernommen",
		Gegenstand: c.ID, Neu: name,
	})
	d.jsonAus(w, http.StatusOK, map[string]any{
		"code": neu,
		"hinweis": "Der gedruckte Code aendert sich dadurch nicht — die Module stehen " +
			"auf Papier. Geaendert hat sich, was beim naechsten Export herauskommt.",
	})
}
