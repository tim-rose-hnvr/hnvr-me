package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/qr"
	"pnkt.me/pnkt/speicher"
)

// Die Schnittstelle folgt dem, was pnkt.me veroeffentlicht hat. Der
// Vertrag steht dort, nicht hier — wer einmal etwas dagegen geschrieben
// hat, darf nicht dadurch brechen, dass eine zweite Fassung des Programms
// eigene Pfade erfindet.
//
//	Kopf x-punkt-schluessel traegt den Schluessel.
//	Vier Wege brauchen keinen: typen, rendern, pruefen, vorlage.csv.

const kopfSchluessel = "x-punkt-schluessel"
const kopfPruefung = "x-punkt-pruefung"

// mitSchluessel verlangt einen gueltigen Schluessel. schreibend sagt, ob
// der Zugriff aendert — ein Schluessel mit „nur lesen" wird dann abgewiesen.
func (d *dienst) mitSchluessel(schreibend bool, weiter func(http.ResponseWriter, *http.Request, *speicher.Schluessel)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sch, err := d.ablage.PruefeSchluessel(strings.TrimSpace(r.Header.Get(kopfSchluessel)))
		if err != nil {
			w.Header().Set("WWW-Authenticate", kopfSchluessel)
			d.jsonAus(w, http.StatusUnauthorized, map[string]string{
				"fehler": "kein gueltiger Schluessel — der Kopf " + kopfSchluessel + " fehlt oder stimmt nicht"})
			return
		}
		if schreibend && sch.NurLesen {
			d.jsonAus(w, http.StatusForbidden, map[string]string{
				"fehler": "dieser Schluessel darf nur lesen"})
			return
		}
		weiter(w, r, sch)
	}
}

// --- offen: keine Anmeldung noetig ---------------------------------------

// typen nennt die Inhaltstypen samt Formularaufbau, damit eine fremde
// Oberflaeche dieselben Felder anbieten kann wie das Studio.
func (d *dienst) typen(w http.ResponseWriter, r *http.Request) {
	d.jsonAus(w, http.StatusOK, []map[string]any{
		{"typ": "url", "name": "Adresse", "felder": []map[string]string{
			{"schluessel": "url", "name": "Adresse", "art": "url", "pflicht": "ja"}}},
		{"typ": "text", "name": "Freier Text", "felder": []map[string]string{
			{"schluessel": "text", "name": "Text", "art": "text", "pflicht": "ja"}}},
		{"typ": "vcard", "name": "Visitenkarte", "felder": []map[string]string{
			{"schluessel": "name", "name": "Name", "art": "text", "pflicht": "ja"},
			{"schluessel": "firma", "name": "Firma", "art": "text"},
			{"schluessel": "telefon", "name": "Telefon", "art": "tel"},
			{"schluessel": "mail", "name": "E-Mail", "art": "email"}}},
		{"typ": "wlan", "name": "WLAN", "felder": []map[string]string{
			{"schluessel": "ssid", "name": "Netzname", "art": "text", "pflicht": "ja"},
			{"schluessel": "schluessel", "name": "Passwort", "art": "text"},
			{"schluessel": "art", "name": "Verschluesselung", "art": "auswahl"}}},
		{"typ": "girocode", "name": "GiroCode", "felder": []map[string]string{
			{"schluessel": "empfaenger", "name": "Empfaenger", "art": "text", "pflicht": "ja"},
			{"schluessel": "iban", "name": "IBAN", "art": "text", "pflicht": "ja"},
			{"schluessel": "betrag", "name": "Betrag in Euro", "art": "zahl"},
			{"schluessel": "zweck", "name": "Verwendungszweck", "art": "text"}}},
		{"typ": "gs1", "name": "GS1 Digital Link", "felder": []map[string]string{
			{"schluessel": "gtin", "name": "GTIN", "art": "text", "pflicht": "ja"},
			{"schluessel": "charge", "name": "Charge", "art": "text"},
			{"schluessel": "verfaellt", "name": "Verfaellt (JJMMTT)", "art": "text"}}},
	})
}

// vorlageCSV ist die Beispieltabelle fuer die Massenanlage.
func (d *dienst) vorlageCSV(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="pnkt-vorlage.csv"`)
	_, _ = w.Write([]byte("name,typ,ziel,gtin,ordner,utm_source\n" +
		"Plakat Bahnhof,url,https://example.de/aktion,,Fruehjahr 2026,plakat\n" +
		"Etikett Roestkaffee,gs1,,4006381333931,Produkte,\n"))
}

// rendernWunsch ist der Rumpf von POST /api/v1/rendern.
type rendernWunsch struct {
	Text      string  `json:"text"`
	Format    string  `json:"format"` // svg, pdf, eps
	BreiteMm  float64 `json:"breiteMm"`
	Verfahren string  `json:"verfahren"`
	Stufe     string  `json:"stufe"`
	AlsJson   bool    `json:"alsJson"`
	Stil      struct {
		Modulform   string `json:"modulform"`
		Augenrahmen string `json:"augenrahmen"`
		Augenkern   string `json:"augenkern"`
		Vordergrund string `json:"vordergrund"`
		Hintergrund string `json:"hintergrund"`
		Ruhezone    int    `json:"ruhezone"`
	} `json:"stil"`
}

// rendern erzeugt einen Code. Ohne Konto, ohne Schluessel — und traegt
// das Urteil der Lesbarkeitspruefung im Antwortkopf mit, auch beim
// Binaerabruf. Wer eine Datei bekommt, soll nicht raten muessen, ob sie
// druckreif ist.
func (d *dienst) rendern(w http.ResponseWriter, r *http.Request) {
	var wunsch rendernWunsch
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	if strings.TrimSpace(wunsch.Text) == "" {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": "kein Text"})
		return
	}

	stufe, err := qr.StufeAus(oder(wunsch.Stufe, "M"))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	s, err := qr.Baue(wunsch.Text, stufe, 0)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}

	breite := wunsch.BreiteMm
	if breite <= 0 {
		breite = 40
	}
	ruhezone := wunsch.Stil.Ruhezone
	if ruhezone == 0 {
		ruhezone = 4
	}

	g := qr.StandardGestalt(breite)
	g.Modulform = oder(wunsch.Stil.Modulform, "quadrat")
	g.Augenrahmen = oder(wunsch.Stil.Augenrahmen, "quadrat")
	g.Augenkern = oder(wunsch.Stil.Augenkern, "quadrat")
	g.Vordergrund = oder(wunsch.Stil.Vordergrund, "#000000")
	g.Hintergrund = oder(wunsch.Stil.Hintergrund, "#ffffff")
	g.RuhezoneMod = ruhezone

	urteil := druck.Pruefe(druck.Vorgabe{
		BreiteMm: breite, ModuleJeKante: s.Kante, Fehlerkorrektur: stufe.String(),
		Verfahren: oder(wunsch.Verfahren, "offset"), RuhezoneModule: ruhezone,
		Vordergrund: g.Vordergrund, Hintergrund: g.Hintergrund,
		Modulform: g.Modulform,
	})

	// Drei Worte statt einer Note, wie in der veroeffentlichten Schnittstelle.
	kurz := "gut"
	if !urteil.Druckreif {
		kurz = "kritisch"
	} else if urteil.Note != "A" {
		kurz = "achtung"
	}
	w.Header().Set(kopfPruefung, kurz)

	if wunsch.AlsJson {
		d.jsonAus(w, http.StatusOK, map[string]any{
			"version": s.Version, "kante": s.Kante, "maske": s.Maske,
			"pruefung": kurz, "urteil": urteil,
		})
		return
	}

	switch strings.ToLower(wunsch.Format) {
	case "pdf":
		w.Header().Set("Content-Type", "application/pdf")
		_, _ = w.Write(ausgabe.PDF(s.Formen(g), "pnkt"))
	case "eps":
		w.Header().Set("Content-Type", "application/postscript")
		_, _ = w.Write(ausgabe.EPS(s.Formen(g), "pnkt"))
	default:
		w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
		_, _ = w.Write([]byte(s.SVG(g)))
	}
}

// vorschau zeigt das Ziel, ohne hinzugehen und ohne zu zaehlen. Wer einen
// fremden Code scannt, soll vorher sehen duerfen, wohin er fuehrt.
func (d *dienst) vorschau(w http.ResponseWriter, r *http.Request) {
	code, da := d.ablage.NachKuerzel(r.PathValue("kuerzel"))
	if !da {
		d.jsonAus(w, http.StatusNotFound, map[string]string{"fehler": "unbekannter Code"})
		return
	}
	d.jsonAus(w, http.StatusOK, map[string]any{
		"kuerzel":  code.Kuerzel,
		"name":     code.Name,
		"ziel":     waehleZiel(code, r),
		"aktiv":    code.Aktiv && code.Gesperrt == "",
		"gesperrt": code.Gesperrt,
		"fassung":  code.Fassung,
	})
}

// --- Zugang ---------------------------------------------------------------

func (d *dienst) kontoAnlegen(w http.ResponseWriter, r *http.Request) {
	var wunsch struct {
		Name, Mail, Passwort string
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	k, err := d.ablage.LegeKontoAn(wunsch.Name, wunsch.Mail, wunsch.Passwort)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusCreated, map[string]string{"id": k.ID, "mail": k.Mail, "rolle": k.Rolle})
}

func (d *dienst) anmelden(w http.ResponseWriter, r *http.Request) {
	var wunsch struct{ Mail, Passwort string }
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	k, err := d.ablage.Anmelden(wunsch.Mail, wunsch.Passwort)
	if err != nil {
		d.jsonAus(w, http.StatusUnauthorized, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, map[string]string{"id": k.ID, "name": k.Name, "rolle": k.Rolle})
}

// schluesselAnlegen gibt den Schluessel genau einmal im Klartext zurueck.
func (d *dienst) schluesselAnlegen(w http.ResponseWriter, r *http.Request) {
	var wunsch struct {
		Mail, Passwort, Name string
		NurLesen             bool `json:"nurLesen"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	k, err := d.ablage.Anmelden(wunsch.Mail, wunsch.Passwort)
	if err != nil {
		d.jsonAus(w, http.StatusUnauthorized, map[string]string{"fehler": err.Error()})
		return
	}
	sch, klartext, err := d.ablage.LegeSchluesselAn(k.ID, wunsch.Name, wunsch.NurLesen)
	if err != nil {
		d.jsonAus(w, http.StatusInternalServerError, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusCreated, map[string]any{
		"id": sch.ID, "name": sch.Name, "nurLesen": sch.NurLesen,
		"schluessel": klartext,
		"hinweis":    "Gespeichert wird nur der SHA-256-Abdruck. Dieser Schluessel wird nie wieder angezeigt.",
	})
}

// listeCodesFuer zeigt nur die Codes des Kontos, zu dem der Schluessel gehoert.
func (d *dienst) listeCodesFuer(w http.ResponseWriter, sch *speicher.Schluessel) {
	d.jsonAus(w, http.StatusOK, d.ablage.Liste(sch.KontoID))
}

// legeCodeAnFuer bindet den neuen Code an das Konto des Schluessels —
// der Aufrufer kann sich kein fremdes Konto aussuchen.
func (d *dienst) legeCodeAnFuer(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	r.Header.Set("x-punkt-konto", sch.KontoID)
	d.legeCodeAn(w, r)
}
