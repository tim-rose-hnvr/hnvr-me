package main

import (
	"encoding/json"
	"net/http"

	"pnkt.me/pnkt/speicher"
)

// Die Wege zur Landeseite eines Codes.
//
// Sie haengen am Code und nicht an einer eigenen Kennung: eine Seite
// ohne Code waere eine Seite, die niemand findet, und ein Code mit zwei
// Seiten waere nicht entscheidbar.

// seitenVorlagen zaehlt die Vorlagen auf und liefert zu jeder ein
// ausgefuelltes Beispiel. Das Beispiel ist der eigentliche Zweck: eine
// leere Maske mit der Ueberschrift „Karte kompakt" sagt niemandem, was
// hineingehoert.
func (d *dienst) seitenVorlagen(w http.ResponseWriter, r *http.Request) {
	var aus []map[string]any
	for _, v := range speicher.Vorlagenliste {
		aus = append(aus, map[string]any{
			"schluessel": v.Schluessel,
			"name":       v.Name,
			"zweck":      v.Zweck,
			"beispiel":   beispielseite(v.Schluessel),
		})
	}
	d.jsonAus(w, http.StatusOK, aus)
}

func beispielseite(vorlage string) *speicher.Seite {
	switch vorlage {
	case "karte":
		return &speicher.Seite{
			Vorlage: "karte", Titel: "Sommerkarte",
			Unter: "Täglich ab 17 Uhr, Küche bis 22 Uhr",
			Bloecke: []speicher.Block{{
				Titel: "Kleinigkeiten",
				Zeilen: []speicher.Zeile{
					{Was: "Flammkuchen", Neben: "9,50 €", Dazu: "Speck, Zwiebel, Schmand"},
					{Was: "Ofenkartoffel", Neben: "8,00 €", Dazu: "mit Kräuterquark"},
				},
			}, {
				Titel: "Vom Grill",
				Zeilen: []speicher.Zeile{
					{Was: "Zanderfilet", Neben: "22,00 €"},
					{Was: "Rinderhüfte", Neben: "26,50 €", Dazu: "250 g, mit Ofengemüse"},
				},
			}},
			Handlung: &speicher.Handlung{Text: "Ganze Karte ansehen",
				Ziel: "https://example.de/karte"},
			Fuss: "Allergene auf Nachfrage",
		}
	case "veranstaltung":
		return &speicher.Seite{
			Vorlage: "veranstaltung", Titel: "Hoffest",
			Unter: "Samstag, 12. September",
			Bloecke: []speicher.Block{{
				Titel: "Ablauf",
				Zeilen: []speicher.Zeile{
					{Neben: "14:00", Was: "Türen auf"},
					{Neben: "15:30", Was: "Führung durch die Werkstatt"},
					{Neben: "18:00", Was: "Musik im Hof", Dazu: "bei Regen in der Scheune"},
				},
			}},
			Handlung: &speicher.Handlung{Text: "Zum Lageplan",
				Ziel: "https://example.de/anfahrt"},
		}
	case "verweise":
		return &speicher.Seite{
			Vorlage: "verweise", Titel: "Nordwerk",
			Unter: "Wohin möchten Sie?",
			Bloecke: []speicher.Block{{
				Zeilen: []speicher.Zeile{
					{Was: "Speisekarte", Ziel: "https://example.de/karte"},
					{Was: "Tisch reservieren", Ziel: "https://example.de/reservierung"},
					{Was: "Anrufen", Ziel: "tel:+4930123456", Dazu: "Mo bis Fr, 9 bis 18 Uhr"},
				},
			}},
		}
	default:
		return &speicher.Seite{
			Vorlage: "info", Titel: "Wie das hier funktioniert",
			Bloecke: []speicher.Block{{
				Text: "Der Code auf dem Tisch führt auf diese Seite. Sie kommt aus " +
					"einem Programm, lädt nichts nach und zählt keine Person.\n\n" +
					"Ändert sich das Ziel, bleibt der gedruckte Code derselbe.",
			}},
			Handlung: &speicher.Handlung{Text: "Mehr erfahren", Ziel: "https://example.de"},
		}
	}
}

// seitePruefen misst eine Seite, ohne sie zu speichern — derselbe Weg
// wie beim Produktpass. Wer wissen will, ob etwas durchgeht, soll es
// nicht durch Speichern herausfinden muessen.
func (d *dienst) seitePruefen(w http.ResponseWriter, r *http.Request) {
	var s speicher.Seite
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&s); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	fehler := s.Pruefe()
	d.jsonAus(w, http.StatusOK, map[string]any{
		"inOrdnung": len(fehler) == 0,
		"fehler":    fehler,
	})
}

func (d *dienst) seiteLesen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	if c.Seite == nil {
		d.jsonAus(w, http.StatusNotFound, map[string]string{
			"fehler": "fuer diesen Code ist keine Seite hinterlegt"})
		return
	}
	d.jsonAus(w, http.StatusOK, c.Seite)
}

func (d *dienst) seiteSetzen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	var s speicher.Seite
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&s); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	neu, err := d.ablage.SetzeSeite(c.ID, &s)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: c.KontoID, Wer: kennungKurz(sch), Was: "seite.gesetzt",
		Gegenstand: c.ID, Neu: s.Titel,
	})
	d.jsonAus(w, http.StatusOK, neu)
}

// seiteWeg nimmt die Seite weg. Der Code faellt damit auf sein Ziel
// zurueck — er bleibt gueltig, denn er ist gedruckt.
func (d *dienst) seiteWeg(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	if c.Seite == nil {
		d.jsonAus(w, http.StatusNotFound, map[string]string{
			"fehler": "fuer diesen Code ist keine Seite hinterlegt"})
		return
	}
	if c.Ziel == "" {
		// Ohne Ziel liefe der Code nach dem Entfernen ins Leere, und das
		// merkt man erst beim naechsten Scan — vor dem Aufsteller.
		d.jsonAus(w, http.StatusConflict, map[string]string{
			"fehler": "dieser Code hat kein Ziel — erst ein Ziel eintragen, " +
				"sonst fuehrt er nach dem Entfernen der Seite nirgendwohin"})
		return
	}
	neu, err := d.ablage.SetzeSeite(c.ID, nil)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: c.KontoID, Wer: kennungKurz(sch), Was: "seite.entfernt",
		Gegenstand: c.ID, Alt: c.Seite.Titel, Neu: c.Ziel,
	})
	d.jsonAus(w, http.StatusOK, neu)
}
