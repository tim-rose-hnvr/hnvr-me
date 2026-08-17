package main

import (
	"archive/zip"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/qr"
	"pnkt.me/pnkt/speicher"
)

// charge ist die Massenanlage: eine CSV hinein, ein ZIP heraus.
//
// Der Bericht ist der eigentliche Gegenstand. Eine Agentur legt selten
// einen Code an, sondern vierhundert — und braucht danach eine Liste, in
// der steht, welcher davon nicht druckreif ist. Ohne diese Liste muss
// jemand vierhundert Dateien einzeln ansehen, und dann sieht sie niemand an.
//
//	POST /api/charge?breite=40&stufe=Q&verfahren=offset&anlegen=1
//	Rumpf: CSV mit Kopfzeile name,ziel[,gtin]
func (d *dienst) charge(w http.ResponseWriter, r *http.Request) {
	f := r.URL.Query()
	stufe, err := qr.StufeAus(oder(f.Get("stufe"), "M"))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	breite := zahl(f.Get("breite"), 40)
	verfahren := oder(f.Get("verfahren"), "offset")
	anlegen := f.Get("anlegen") == "1"
	kontoID := f.Get("konto")

	leser := csv.NewReader(http.MaxBytesReader(w, r.Body, 8<<20))
	leser.FieldsPerRecord = -1
	leser.TrimLeadingSpace = true
	zeilen, err := leser.ReadAll()
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": "CSV nicht lesbar: " + err.Error()})
		return
	}
	if len(zeilen) < 2 {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{
			"fehler": "erwartet wird eine Kopfzeile und mindestens eine Datenzeile"})
		return
	}

	spalte := map[string]int{}
	for i, kopf := range zeilen[0] {
		spalte[strings.ToLower(strings.TrimSpace(kopf))] = i
	}
	if _, da := spalte["ziel"]; !da {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{
			"fehler": "die Kopfzeile braucht mindestens eine Spalte ziel"})
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(
		`attachment; filename="pnkt-charge-%s.zip"`, time.Now().UTC().Format("2006-01-02")))

	paket := zip.NewWriter(w)
	defer paket.Close()

	bericht := &strings.Builder{}
	schreiber := csv.NewWriter(bericht)
	_ = schreiber.Write([]string{"zeile", "name", "kuerzel", "ziel", "inhalt",
		"version", "modulMm", "note", "druckreif", "befunde"})

	feld := func(zeile []string, name string) string {
		i, da := spalte[name]
		if !da || i >= len(zeile) {
			return ""
		}
		return strings.TrimSpace(zeile[i])
	}

	for nr, zeile := range zeilen[1:] {
		name := feld(zeile, "name")
		ziel := feld(zeile, "ziel")
		gtinRoh := feld(zeile, "gtin")
		ordner := feld(zeile, "ordner")

		if ziel == "" && gtinRoh == "" {
			_ = schreiber.Write([]string{fmt.Sprint(nr + 2), name, "", "", "", "", "", "F", "nein",
				"weder Ziel noch GTIN angegeben"})
			continue
		}

		// Der Inhalt des Codes: entweder der eigene Kurzweg oder,
		// bei einer GTIN, der Digital Link.
		inhalt := ziel
		kuerzel := ""
		var gs1Fehler string

		if gtinRoh != "" {
			url, err := gs1.DigitalLink(gs1.Angaben{GTIN: gtinRoh, Charge: feld(zeile, "charge")}, d.host)
			if err != nil {
				gs1Fehler = err.Error()
			} else {
				inhalt = url
			}
		}

		// Eine Zeile mit GTIN bekommt keinen Kurzweg — gedruckt wird der
		// Digital Link. Angelegt wird sie trotzdem, sonst faende
		// GET /01/{gtin} spaeter kein Ziel und der Code liefe ins Leere.
		if anlegen && gtinRoh != "" && ziel != "" && gs1Fehler == "" {
			code := &speicher.Code{
				Kuerzel: d.ablage.FreiesKuerzel(), KontoID: kontoID,
				Name: name, Ordner: ordner, Ziel: ziel, GTIN: gtinRoh,
				Aktiv: true, Herkunft: "charge",
			}
			if err := d.ablage.LegeAn(code); err == nil {
				_ = d.ablage.Protokolliere(speicher.Ereignis{
					KontoID: kontoID, Wer: "charge", Was: "code.angelegt",
					Gegenstand: code.ID, Neu: ziel,
				})
			}
		}

		if anlegen && gtinRoh == "" {
			code := &speicher.Code{
				Kuerzel: d.ablage.FreiesKuerzel(), KontoID: kontoID,
				Name: name, Ordner: ordner, Ziel: ziel, Aktiv: true, Herkunft: "charge",
			}
			if err := d.ablage.LegeAn(code); err != nil {
				_ = schreiber.Write([]string{fmt.Sprint(nr + 2), name, "", ziel, "", "", "", "F", "nein",
					"nicht angelegt: " + err.Error()})
				continue
			}
			kuerzel = code.Kuerzel
			inhalt = strings.TrimRight(d.host, "/") + "/" + kuerzel
			_ = d.ablage.Protokolliere(speicher.Ereignis{
				KontoID: kontoID, Wer: "charge", Was: "code.angelegt",
				Gegenstand: code.ID, Neu: ziel,
			})
		}

		if gs1Fehler != "" {
			_ = schreiber.Write([]string{fmt.Sprint(nr + 2), name, kuerzel, ziel, "", "", "", "F", "nein",
				"GTIN: " + gs1Fehler})
			continue
		}

		s, err := qr.Baue(inhalt, stufe, 0)
		if err != nil {
			_ = schreiber.Write([]string{fmt.Sprint(nr + 2), name, kuerzel, ziel, inhalt, "", "", "F", "nein",
				err.Error()})
			continue
		}

		urteil := druck.Pruefe(druck.Vorgabe{
			BreiteMm: breite, ModuleJeKante: s.Kante, Fehlerkorrektur: stufe.String(),
			Verfahren: verfahren, RuhezoneModule: 4,
			Vordergrund: "#000000", Hintergrund: "#ffffff",
			FuerKasse: gtinRoh != "",
		})

		var texte []string
		for _, b := range urteil.Befunde {
			texte = append(texte, b.Schwere+": "+b.Text)
		}
		druckreif := "ja"
		if !urteil.Druckreif {
			druckreif = "nein"
		}
		_ = schreiber.Write([]string{
			fmt.Sprint(nr + 2), name, kuerzel, ziel, inhalt,
			fmt.Sprint(s.Version), fmt.Sprintf("%.3f", urteil.ModulMm),
			urteil.Note, druckreif, strings.Join(texte, " | "),
		})

		g := qr.StandardGestalt(breite)
		g.Modulform = oder(f.Get("form"), "quadrat")
		g.Augenkern = oder(f.Get("augenkern"), "quadrat")
		zeichnung := s.Formen(g)

		grund := dateiname(name, kuerzel, nr+2)
		if err := hineinlegen(paket, grund+".svg", []byte(s.SVG(g))); err != nil {
			return
		}
		if err := hineinlegen(paket, grund+".pdf", ausgabe.PDF(zeichnung, name)); err != nil {
			return
		}
		if f.Get("eps") == "1" {
			if err := hineinlegen(paket, grund+".eps", ausgabe.EPS(zeichnung, name)); err != nil {
				return
			}
		}
	}

	schreiber.Flush()
	_ = hineinlegen(paket, "bericht.csv", []byte(bericht.String()))
}

func hineinlegen(paket *zip.Writer, name string, inhalt []byte) error {
	f, err := paket.Create(name)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, strings.NewReader(string(inhalt)))
	return err
}

// dateiname macht aus einer Bezeichnung etwas, das jedes Betriebssystem
// annimmt — Umlaute bleiben, Schraegstriche und Doppelpunkte nicht.
func dateiname(name, kuerzel string, zeile int) string {
	grund := name
	if grund == "" {
		grund = kuerzel
	}
	if grund == "" {
		grund = fmt.Sprintf("zeile-%d", zeile)
	}
	var b strings.Builder
	for _, r := range grund {
		switch r {
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|', 0:
			b.WriteRune('-')
		default:
			b.WriteRune(r)
		}
	}
	sauber := strings.TrimSpace(b.String())
	if len(sauber) > 60 {
		sauber = sauber[:60]
	}
	if kuerzel != "" && !strings.Contains(sauber, kuerzel) {
		sauber += "-" + kuerzel
	}
	return sauber
}
