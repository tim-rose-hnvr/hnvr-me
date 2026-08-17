package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/inhalt"
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
		// Ein Schluessel kann nie mehr duerfen als die Person, der er
		// gehoert. Wird jemand zum Leser herabgestuft, verlieren seine
		// Schluessel im selben Augenblick das Schreibrecht.
		if schreibend && !speicher.DarfSchreiben(d.ablage.RolleVon(sch)) {
			d.jsonAus(w, http.StatusForbidden, map[string]string{
				"fehler": "die Rolle dieses Kontos darf nur lesen"})
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
		Modulform   string          `json:"modulform"`
		Augenrahmen string          `json:"augenrahmen"`
		Augenkern   string          `json:"augenkern"`
		Vordergrund json.RawMessage `json:"vordergrund"` // Hexfarbe oder Verlauf
		Hintergrund string          `json:"hintergrund"`
		Ruhezone    int             `json:"ruhezone"`
		Logo        float64         `json:"logo"`
		Rahmen      *struct {
			Art       string `json:"art"`
			Text      string `json:"text"`
			Farbe     string `json:"farbe"`
			Textfarbe string `json:"textfarbe"`
		} `json:"rahmen"`
	} `json:"stil"`
}

// vordergrund liest entweder eine Hexfarbe oder einen Verlauf, wie das
// veroeffentlichte Beispiel es zeigt:
//
//	"vordergrund": "#0d0d12"
//	"vordergrund": { "art": "linear", "winkel": 45,
//	                 "stops": [{"pos":0,"farbe":"#4f39f6"}, …] }
func vordergrundLesen(roh json.RawMessage) (string, *qr.Verlauf) {
	if len(roh) == 0 {
		return "", nil
	}
	var hex string
	if err := json.Unmarshal(roh, &hex); err == nil {
		return hex, nil
	}
	var v struct {
		Art    string  `json:"art"`
		Winkel float64 `json:"winkel"`
		Stops  []struct {
			Pos   float64 `json:"pos"`
			Farbe string  `json:"farbe"`
		} `json:"stops"`
	}
	if err := json.Unmarshal(roh, &v); err != nil || len(v.Stops) < 2 {
		return "", nil
	}
	verlauf := &qr.Verlauf{Art: v.Art, Winkel: v.Winkel}
	for _, s := range v.Stops {
		verlauf.Haelt = append(verlauf.Haelt, qr.Halt{Pos: s.Pos, Farbe: s.Farbe})
	}
	return "", verlauf
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
	hexVorn, verlauf := vordergrundLesen(wunsch.Stil.Vordergrund)
	g.Vordergrund = oder(hexVorn, "#000000")
	g.Verlauf = verlauf
	g.Hintergrund = oder(wunsch.Stil.Hintergrund, "#ffffff")
	g.RuhezoneMod = ruhezone
	g.LogoAnteil = wunsch.Stil.Logo
	if r := wunsch.Stil.Rahmen; r != nil {
		g.Rahmen = &qr.Rahmen{Art: r.Art, Text: r.Text, Farbe: r.Farbe, Textfarbe: r.Textfarbe}
	}

	urteil := druck.Pruefe(druck.Vorgabe{
		BreiteMm: breite, ModuleJeKante: s.Kante, Fehlerkorrektur: stufe.String(),
		Verfahren: oder(wunsch.Verfahren, "offset"), RuhezoneModule: ruhezone,
		Vordergrund: pruefFarbe(g), Hintergrund: g.Hintergrund,
		Modulform: g.Modulform, Augenrahmen: g.Augenrahmen, Augenkern: g.Augenkern,
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

// listeCodesFuer zeigt die Codes der Organisation. Mitarbeitende sehen
// dieselben Codes wie der Inhaber — sonst waere gemeinsame Arbeit an
// einer Kampagne nicht moeglich.
func (d *dienst) listeCodesFuer(w http.ResponseWriter, sch *speicher.Schluessel) {
	d.jsonAus(w, http.StatusOK, d.ablage.Liste(d.ablage.OrgVon(sch)))
}

// legeCodeAnFuer bindet den neuen Code an das Konto des Schluessels —
// der Aufrufer kann sich kein fremdes Konto aussuchen.
func (d *dienst) legeCodeAnFuer(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	r.Header.Set("x-punkt-konto", d.ablage.OrgVon(sch))
	d.legeCodeAn(w, r)
}

// pruefFarbe liefert die Farbe, gegen die der Kontrast gerechnet wird.
// Bei einem Verlauf ist das die hellste Marke — sie entscheidet, ob der
// Code an seiner schwaechsten Stelle noch traegt. Wer nur die dunkelste
// prueft, gibt Verlaeufe frei, die oben auslaufen.
func pruefFarbe(g qr.Gestalt) string {
	if g.Verlauf == nil || len(g.Verlauf.Haelt) == 0 {
		return g.Vordergrund
	}
	hellste, hoechste := g.Verlauf.Haelt[0].Farbe, -1.0
	for _, h := range g.Verlauf.Haelt {
		if l := druck.Kontrast(h.Farbe, "#000000"); l > hoechste {
			hoechste, hellste = l, h.Farbe
		}
	}
	return hellste
}

// --- Marke und Mitarbeitende ---------------------------------------------

// marke liefert das Erscheinungsbild. Ohne Schluessel wird die Marke des
// aufgerufenen Hostnamens gezeigt — das braucht die Hinweisseite, und es
// verraet nichts, was nicht ohnehin auf dem Bildschirm steht.
func (d *dienst) markeLesen(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	d.jsonAus(w, http.StatusOK, map[string]string{
		"name": m.Name, "host": m.Host, "primaer": m.Primaer,
		"grund": m.Grund, "tinte": m.Tinte, "logoSvg": m.LogoSVG,
		"impressum": m.Impressum, "datenschutz": m.Datenschutz,
	})
}

func (d *dienst) markeSetzen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	if !speicher.DarfVerwalten(d.ablage.RolleVon(sch)) {
		d.jsonAus(w, http.StatusForbidden, map[string]string{
			"fehler": "die Marke setzt der Inhaber"})
		return
	}
	var m speicher.Marke
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&m); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	m.OrgID = d.ablage.OrgVon(sch)
	if err := d.ablage.SetzeMarke(&m); err != nil {
		d.jsonAus(w, http.StatusConflict, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: m.OrgID, Wer: "schnittstelle", Was: "marke.gesetzt",
		Gegenstand: m.ID, Neu: m.Name + " auf " + m.Host,
	})
	d.jsonAus(w, http.StatusOK, m)
}

func (d *dienst) mitarbeitendeListe(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	d.jsonAus(w, http.StatusOK, d.ablage.Mitarbeitende(d.ablage.OrgVon(sch)))
}

func (d *dienst) mitarbeitendeAufnehmen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	if !speicher.DarfVerwalten(d.ablage.RolleVon(sch)) {
		d.jsonAus(w, http.StatusForbidden, map[string]string{
			"fehler": "Mitarbeitende fuehrt der Inhaber"})
		return
	}
	var wunsch struct{ Mail, Rolle string }
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	org := d.ablage.OrgVon(sch)
	k, err := d.ablage.NimmMitarbeitendeAuf(org, wunsch.Mail, wunsch.Rolle)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: org, Wer: "schnittstelle", Was: "mitarbeit.aufgenommen",
		Gegenstand: k.ID, Neu: k.Mail + " als " + k.Rolle,
	})
	d.jsonAus(w, http.StatusOK, map[string]string{"id": k.ID, "mail": k.Mail, "rolle": k.Rolle})
}

func (d *dienst) mitarbeitendeEntlassen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	if !speicher.DarfVerwalten(d.ablage.RolleVon(sch)) {
		d.jsonAus(w, http.StatusForbidden, map[string]string{
			"fehler": "Mitarbeitende fuehrt der Inhaber"})
		return
	}
	org := d.ablage.OrgVon(sch)
	if err := d.ablage.EntlasseMitarbeitende(org, r.PathValue("id")); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: org, Wer: "schnittstelle", Was: "mitarbeit.beendet",
		Gegenstand: r.PathValue("id"),
	})
	d.jsonAus(w, http.StatusOK, map[string]string{"zustand": "beendet"})
}

// --- Inhalt bauen ---------------------------------------------------------

// inhaltBauen macht aus Feldern die Nutzlast eines Codes. Das geschieht
// hier und nicht im Browser, weil hier die Pruefungen liegen: eine IBAN
// mit falscher Pruefsumme oder eine GTIN mit falscher Pruefziffer darf
// gar nicht erst zu einem Code werden.
func (d *dienst) inhaltBauen(w http.ResponseWriter, r *http.Request) {
	var wunsch struct {
		Typ    string            `json:"typ"`
		Felder map[string]string `json:"felder"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<18)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	f := func(k string) string { return strings.TrimSpace(wunsch.Felder[k]) }

	var text string
	var err error

	switch strings.ToLower(wunsch.Typ) {
	case "", "url":
		text = f("url")
		if text != "" && !strings.Contains(text, ":") {
			// Ohne Verfahren oeffnet kein Telefon die Adresse.
			text = "https://" + text
		}
	case "text":
		text = f("text")
	case "vcard":
		text, err = inhalt.VCard(inhalt.Karte{
			Vorname: f("vorname"), Nachname: f("nachname"), Firma: f("firma"),
			Stellung: f("stellung"), Telefon: f("telefon"), Mobil: f("mobil"),
			Mail: f("mail"), Netz: f("netz"), Strasse: f("strasse"),
			Ort: f("ort"), PLZ: f("plz"), Land: f("land"),
		})
	case "wlan":
		text, err = inhalt.WLAN(inhalt.Netz{
			SSID: f("ssid"), Passwort: f("schluessel"), Art: f("art"),
			Versteckt: f("versteckt") == "ja",
		})
	case "girocode":
		var betrag float64
		if b := strings.Replace(f("betrag"), ",", ".", 1); b != "" {
			betrag = zahl(b, 0)
		}
		text, err = inhalt.GiroCode(inhalt.Ueberweisung{
			Empfaenger: f("empfaenger"), IBAN: f("iban"), BIC: f("bic"),
			BetragEuro: betrag, Zweck: f("zweck"), Referenz: f("referenz"),
		})
	case "gs1":
		text, err = gs1.DigitalLink(gs1.Angaben{
			GTIN: f("gtin"), Charge: f("charge"),
			Serie: f("serie"), Verfaellt: f("verfaellt"),
		}, d.host)
	default:
		err = fmt.Errorf("unbekannter Typ %q", wunsch.Typ)
	}

	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	if strings.TrimSpace(text) == "" {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": "noch nichts eingetragen"})
		return
	}

	// Die Laenge entscheidet ueber die Version und damit ueber die
	// Groesse im Druck — sie gehoert in die Antwort.
	d.jsonAus(w, http.StatusOK, map[string]any{
		"text": text, "zeichen": len([]rune(text)), "bytes": len(text),
	})
}
