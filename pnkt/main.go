// pnkt — ein selbstaendiges System fuer gedruckte QR-Codes.
//
// Ein Binaer, ein Verzeichnis, kein Dienst von aussen. Keine Datenbank,
// kein Rechenzentrum, keine fremden Pakete — die Abhaengigkeitsliste dieses
// Programms ist die Go-Standardbibliothek und sonst nichts.
//
//	go build -o pnkt .
//	./pnkt -daten ./daten -adresse :8080
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/farbe"
	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/qr"
	"pnkt.me/pnkt/regel"
	"pnkt.me/pnkt/speicher"
)

type dienst struct {
	ablage *speicher.Speicher
	host   string
}

func main() {
	adresse := flag.String("adresse", ":8080", "Adresse, auf der gelauscht wird")
	daten := flag.String("daten", "./daten", "Verzeichnis der Ablage")
	host := flag.String("host", "https://pnkt.me", "eigener Kurzhost fuer Digital Link")
	flag.Parse()

	// Das Paket qr kennt nur Zeichenketten als Farben; die Deutung von
	// CMYK und Sonderfarben fuer die Bildschirmvorschau kommt von hier.
	qr.Bildschirmfarbe = func(angabe string) string { return farbe.Lies(angabe).Hex() }

	ablage, err := speicher.Oeffne(*daten)
	if err != nil {
		log.Fatalf("Ablage nicht zu oeffnen: %v", err)
	}
	defer ablage.Schliesse()

	d := &dienst{ablage: ablage, host: *host}

	weg := http.NewServeMux()
	weg.HandleFunc("GET /gesundheit", d.gesundheit)

	// Offen — kein Schluessel noetig. Codes erzeugen und Ziele ansehen
	// geht ohne Konto, so wie es die Schnittstellenseite zusagt.
	weg.HandleFunc("GET /api/v1/typen", d.typen)
	weg.HandleFunc("POST /api/v1/rendern", d.rendern)
	weg.HandleFunc("GET /api/v1/vorlage.csv", d.vorlageCSV)
	weg.HandleFunc("GET /api/v1/druckpruefung", d.druckpruefung)
	weg.HandleFunc("GET /api/v1/gs1", d.gs1Bauen)
	weg.HandleFunc("POST /api/v1/konten", d.kontoAnlegen)
	weg.HandleFunc("POST /api/v1/anmelden", d.anmelden)
	weg.HandleFunc("POST /api/v1/schluessel", d.schluesselAnlegen)
	weg.HandleFunc("GET /api/v1/marke", d.markeLesen)
	weg.HandleFunc("PUT /api/v1/marke", d.mitSchluessel(true, d.markeSetzen))
	weg.HandleFunc("GET /api/v1/mitarbeitende", d.mitSchluessel(false, d.mitarbeitendeListe))
	weg.HandleFunc("POST /api/v1/mitarbeitende", d.mitSchluessel(true, d.mitarbeitendeAufnehmen))
	weg.HandleFunc("DELETE /api/v1/mitarbeitende/{id}", d.mitSchluessel(true, d.mitarbeitendeEntlassen))

	// Mit Schluessel im Kopf x-punkt-schluessel.
	weg.HandleFunc("GET /api/v1/codes", d.mitSchluessel(false,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.listeCodesFuer(w, s) }))
	weg.HandleFunc("POST /api/v1/codes", d.mitSchluessel(true,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.legeCodeAnFuer(w, r, s) }))
	weg.HandleFunc("PATCH /api/v1/codes/{id}", d.mitSchluessel(true,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.aendereCode(w, r) }))
	weg.HandleFunc("GET /api/v1/codes/{id}/statistik", d.mitSchluessel(false,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.statistik(w, r) }))
	weg.HandleFunc("GET /api/v1/codes/{id}/protokoll", d.mitSchluessel(false,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.protokoll(w, r) }))
	weg.HandleFunc("POST /api/v1/massenanlage", d.mitSchluessel(true,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.charge(w, r) }))

	// Weiterleitung. /r/ ist der veroeffentlichte Weg, die Wurzel der
	// kurze — auf einer eigenen Kurzdomain zaehlt jedes Zeichen.
	weg.HandleFunc("GET /r/{kuerzel}", d.weiterleiten)
	weg.HandleFunc("GET /r/{kuerzel}/vorschau", d.vorschau)
	weg.HandleFunc("GET /01/{gtin}/", d.digitalLink)
	weg.HandleFunc("GET /01/{gtin}", d.digitalLink)

	weg.HandleFunc("GET /qr.svg", d.qrSVG)
	weg.HandleFunc("GET /qr.pdf", d.qrPDF)
	weg.HandleFunc("GET /qr.eps", d.qrEPS)
	weg.HandleFunc("GET /{$}", d.studio)
	weg.HandleFunc("GET /{kuerzel}", d.weiterleiten)

	server := &http.Server{
		Addr:              *adresse,
		Handler:           weg,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	beenden := make(chan os.Signal, 1)
	signal.Notify(beenden, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-beenden
		log.Println("halte an, laufende Anfragen werden noch bedient")
		frist, ab := context.WithTimeout(context.Background(), 10*time.Second)
		defer ab()
		_ = server.Shutdown(frist)
	}()

	log.Printf("pnkt laeuft auf %s, Ablage %s", *adresse, *daten)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	log.Println("angehalten")
}

// --- Weiterleitung: der heisseste Pfad ------------------------------------

func (d *dienst) weiterleiten(w http.ResponseWriter, r *http.Request) {
	kuerzel := r.PathValue("kuerzel")
	if kuerzel == "favicon.ico" {
		http.NotFound(w, r)
		return
	}

	code, da := d.ablage.NachKuerzel(kuerzel)
	if !da {
		d.hinweisMitMarke(w, r, http.StatusNotFound, "Unbekannter Code",
			"Diese Kurzadresse gibt es nicht. Vertippt beim Abschreiben?")
		return
	}
	if code.Gesperrt != "" {
		d.hinweisMitMarke(w, r, http.StatusGone, "Gesperrt", "Dieser Code wurde gesperrt: "+code.Gesperrt)
		return
	}
	if !code.Aktiv {
		d.hinweisMitMarke(w, r, http.StatusGone, "Stillgelegt", "Dieser Code ist zur Zeit nicht in Betrieb.")
		return
	}
	if code.GueltigBis != nil && code.GueltigBis.Before(time.Now()) {
		d.hinweisMitMarke(w, r, http.StatusGone, "Abgelaufen", "Dieser Code war bis "+
			code.GueltigBis.Format("02.01.2006")+" gueltig.")
		return
	}

	ziel := waehleZiel(code, r)
	if ziel == "" {
		d.hinweisMitMarke(w, r, http.StatusNotFound, "Ohne Ziel", "Fuer diesen Code ist kein Ziel hinterlegt.")
		return
	}

	d.ablage.Zaehle(code.ID, klassen(r), time.Now())

	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(w, r, ziel, http.StatusFound)
}

// waehleZiel wendet das Regelwerk an. Die Entscheidung selbst liegt im
// Paket regel; hier wird nur der Scan in Umstaende uebersetzt.
func waehleZiel(c *speicher.Code, r *http.Request) string {
	u := umstand(r)
	e := regel.Waehle(regelwerkAus(c), u)
	if e.Ziel == "" {
		e.Ziel = c.Ziel
	}
	return regel.Kampagne(e.Ziel, c.UTM, u, c.Kuerzel)
}

// umstand liest aus der Anfrage, was das Regelwerk braucht. Das Land
// kommt aus einem Kopf, den ein vorgelagerter Server setzt — eine eigene
// Standortbestimmung findet nicht statt.
func umstand(r *http.Request) regel.Umstand {
	sprache := ""
	if s := r.Header.Get("Accept-Language"); len(s) >= 2 {
		sprache = strings.ToLower(s[:2])
	}
	return regel.Umstand{
		Jetzt:   time.Now(),
		Land:    r.Header.Get("CF-IPCountry"),
		Sprache: sprache,
		Geraet:  geraet(r),
	}
}

// regelwerkAus liest das Regelwerk eines Codes. Es versteht die Form der
// veroeffentlichten Schnittstelle — eine Liste — und die aeltere Form mit
// Zuordnungen, damit bestehende Codes weiterlaufen.
func regelwerkAus(c *speicher.Code) regel.Werk {
	roh, err := json.Marshal(c.Regeln)
	if err != nil {
		return regel.Werk{Standard: c.Ziel}
	}
	var w regel.Werk
	if err := json.Unmarshal(roh, &w); err == nil && len(w.Regeln) > 0 {
		if w.Standard == "" {
			w.Standard = c.Ziel
		}
		return w
	}

	// Aeltere Form: Zuordnungen je Art. Die Reihenfolge wird hier
	// festgelegt und entspricht der bisherigen: Zeit, Land, Sprache, Geraet.
	var alt struct {
		Standard string `json:"standard"`
		Zeit     []struct {
			Von  string `json:"von"`
			Bis  string `json:"bis"`
			Ziel string `json:"ziel"`
		} `json:"zeit"`
		Land    map[string]string `json:"land"`
		Sprache map[string]string `json:"sprache"`
		Geraet  map[string]string `json:"geraet"`
	}
	if err := json.Unmarshal(roh, &alt); err != nil {
		return regel.Werk{Standard: c.Ziel}
	}
	w = regel.Werk{Standard: oder(alt.Standard, c.Ziel)}
	for _, z := range alt.Zeit {
		w.Regeln = append(w.Regeln, regel.Einzelregel{
			Art: "zeitraum", Von: z.Von, Bis: z.Bis, Ziel: z.Ziel})
	}
	for _, paar := range []struct {
		art  string
		zuor map[string]string
	}{{"land", alt.Land}, {"sprache", alt.Sprache}, {"geraet", alt.Geraet}} {
		for wert, ziel := range paar.zuor {
			w.Regeln = append(w.Regeln, regel.Einzelregel{
				Art: paar.art, Werte: []string{wert}, Ziel: ziel})
		}
	}
	return w
}

func geraet(r *http.Request) string {
	k := strings.ToLower(r.UserAgent())
	switch {
	case strings.Contains(k, "iphone"):
		return "iphone"
	case strings.Contains(k, "ipad"):
		return "ipad"
	case strings.Contains(k, "android"):
		return "android"
	}
	return "rechner"
}

// klassen ordnet den Scan ein. Keine IP-Adresse, kein Kennzeichen im Geraet,
// keine Zeile je Scan — nur Zaehler in Klassen. Was hier nicht entsteht,
// kann spaeter niemand verlangen, stehlen oder herausgeben muessen.
func klassen(r *http.Request) []string {
	k := strings.ToLower(r.UserAgent())
	system := "sonstige"
	switch {
	case strings.Contains(k, "iphone"), strings.Contains(k, "ipad"), strings.Contains(k, "mac os"):
		system = "apple"
	case strings.Contains(k, "android"):
		system = "android"
	case strings.Contains(k, "windows"):
		system = "windows"
	}
	sprache := "*"
	if s := r.Header.Get("Accept-Language"); len(s) >= 2 {
		sprache = strings.ToLower(s[:2])
	}
	quelle := "direkt"
	if r.Referer() != "" {
		quelle = "verweis"
	}
	return []string{
		"geraet:" + geraet(r),
		"system:" + system,
		"sprache:" + sprache,
		"quelle:" + quelle,
		"stunde:" + fmt.Sprintf("%02d", time.Now().UTC().Hour()),
	}
}

// --- GS1 Digital Link -----------------------------------------------------

func (d *dienst) digitalLink(w http.ResponseWriter, r *http.Request) {
	gtin14, err := gs1.PruefeGTIN(r.PathValue("gtin"))
	if err != nil {
		d.hinweisMitMarke(w, r, http.StatusBadRequest, "Keine gueltige GTIN", err.Error())
		return
	}
	for _, c := range d.ablage.Liste("") {
		if c.GTIN != "" {
			if geprueft, err := gs1.PruefeGTIN(c.GTIN); err == nil && geprueft == gtin14 {
				d.ablage.Zaehle(c.ID, klassen(r), time.Now())
				http.Redirect(w, r, waehleZiel(c, r), http.StatusFound)
				return
			}
		}
	}
	d.hinweisMitMarke(w, r, http.StatusNotFound, "Artikel unbekannt",
		"Zu dieser GTIN ist hier kein Ziel hinterlegt.")
}

// --- Schnittstelle --------------------------------------------------------

func (d *dienst) gesundheit(w http.ResponseWriter, r *http.Request) {
	d.jsonAus(w, http.StatusOK, map[string]any{"zustand": "laeuft", "zeit": time.Now().UTC()})
}

func (d *dienst) listeCodes(w http.ResponseWriter, r *http.Request) {
	d.jsonAus(w, http.StatusOK, d.ablage.Liste(r.URL.Query().Get("konto")))
}

func (d *dienst) legeCodeAn(w http.ResponseWriter, r *http.Request) {
	var c speicher.Code
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&c); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	if c.Ziel == "" && c.Regeln == nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": "kein Ziel angegeben"})
		return
	}
	if c.Kuerzel == "" {
		c.Kuerzel = d.ablage.FreiesKuerzel()
	}
	if konto := r.Header.Get("x-punkt-konto"); konto != "" {
		c.KontoID = konto
	}
	c.Aktiv = true

	if err := d.ablage.LegeAn(&c); err != nil {
		lage := http.StatusInternalServerError
		if errors.Is(err, speicher.ErrKuerzelVergeben) {
			lage = http.StatusConflict
		}
		d.jsonAus(w, lage, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: c.KontoID, Wer: "schnittstelle", Was: "code.angelegt",
		Gegenstand: c.ID, Neu: c.Ziel,
	})
	d.jsonAus(w, http.StatusCreated, c)
}

func (d *dienst) aendereCode(w http.ResponseWriter, r *http.Request) {
	var wunsch speicher.Code
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	id := r.PathValue("id")
	alt, da := d.ablage.NachID(id)
	if !da {
		d.jsonAus(w, http.StatusNotFound, map[string]string{"fehler": "unbekannter Code"})
		return
	}
	altesZiel := alt.Ziel

	neu, err := d.ablage.Aendere(id, func(c *speicher.Code) error {
		if wunsch.Ziel != "" {
			c.Ziel = wunsch.Ziel
		}
		if wunsch.Name != "" {
			c.Name = wunsch.Name
		}
		if wunsch.Regeln != nil {
			c.Regeln = wunsch.Regeln
		}
		if wunsch.Gesperrt != "" {
			c.Gesperrt = wunsch.Gesperrt
		}
		return nil
	})
	if err != nil {
		d.jsonAus(w, http.StatusConflict, map[string]string{"fehler": err.Error()})
		return
	}

	// Eine Zieländerung an einem gedruckten Code ist der einzige Vorgang,
	// den niemand mehr zurueckholen kann. Er gehoert ins Protokoll.
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: neu.KontoID, Wer: "schnittstelle", Was: "ziel.geaendert",
		Gegenstand: neu.ID, Alt: altesZiel, Neu: neu.Ziel,
	})
	d.jsonAus(w, http.StatusOK, neu)
}

func (d *dienst) statistik(w http.ResponseWriter, r *http.Request) {
	d.jsonAus(w, http.StatusOK, d.ablage.Zaehlerstand(r.PathValue("id")))
}

func (d *dienst) protokoll(w http.ResponseWriter, r *http.Request) {
	eintraege, err := d.ablage.Protokoll(r.PathValue("id"))
	if err != nil {
		d.jsonAus(w, http.StatusInternalServerError, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, eintraege)
}

func (d *dienst) druckpruefung(w http.ResponseWriter, r *http.Request) {
	f := r.URL.Query()
	inhalt := f.Get("inhalt")
	if inhalt == "" {
		inhalt = "https://pnkt.me/beispiel"
	}
	stufe, err := qr.StufeAus(oder(f.Get("stufe"), "M"))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	s, err := qr.Baue(inhalt, stufe, 0)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	urteil := druck.Pruefe(druck.Vorgabe{
		BreiteMm:        zahl(f.Get("breite"), 40),
		ModuleJeKante:   s.Kante,
		Fehlerkorrektur: stufe.String(),
		Verfahren:       oder(f.Get("verfahren"), "offset"),
		RuhezoneModule:  int(zahl(f.Get("ruhezone"), 4)),
		Vordergrund:     oder(f.Get("vordergrund"), "#000000"),
		Hintergrund:     oder(f.Get("hintergrund"), "#ffffff"),
		LogoAnteil:      zahl(f.Get("logo"), 0),
		FuerKasse:       f.Get("kasse") == "1",
	})
	d.jsonAus(w, http.StatusOK, map[string]any{
		"version": s.Version, "kante": s.Kante, "maske": s.Maske, "urteil": urteil,
	})
}

func (d *dienst) gs1Bauen(w http.ResponseWriter, r *http.Request) {
	f := r.URL.Query()
	url, err := gs1.DigitalLink(gs1.Angaben{
		GTIN: f.Get("gtin"), Charge: f.Get("charge"),
		Serie: f.Get("serie"), Verfaellt: f.Get("verfaellt"),
	}, d.host)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, map[string]string{"url": url})
}

// ausWunsch baut Symbol und Gestalt aus der Abfrage. Alle drei
// Ausgabeformate gehen durch dieselbe Stelle — sonst zeigt die Vorschau
// etwas anderes als die Druckdatei.
func (d *dienst) ausWunsch(w http.ResponseWriter, r *http.Request) (*qr.Symbol, qr.Gestalt, bool) {
	f := r.URL.Query()
	inhalt := f.Get("inhalt")
	if inhalt == "" {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": "kein Inhalt"})
		return nil, qr.Gestalt{}, false
	}
	stufe, err := qr.StufeAus(oder(f.Get("stufe"), "M"))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return nil, qr.Gestalt{}, false
	}
	s, err := qr.Baue(inhalt, stufe, int(zahl(f.Get("version"), 0)))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return nil, qr.Gestalt{}, false
	}
	g := qr.StandardGestalt(zahl(f.Get("breite"), 40))
	g.Modulform = oder(f.Get("form"), "quadrat")
	g.Augenrahmen = oder(f.Get("augenrahmen"), "quadrat")
	g.Augenkern = oder(f.Get("augenkern"), "quadrat")
	g.Vordergrund = oder(f.Get("vordergrund"), "#000000")
	g.Hintergrund = oder(f.Get("hintergrund"), "#ffffff")
	g.AugenFarbe = f.Get("augenfarbe")
	g.RuhezoneMod = int(zahl(f.Get("ruhezone"), 4))
	g.LogoAnteil = zahl(f.Get("logo"), 0)
	return s, g, true
}

func (d *dienst) qrSVG(w http.ResponseWriter, r *http.Request) {
	s, g, gut := d.ausWunsch(w, r)
	if !gut {
		return
	}
	w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	fmt.Fprint(w, s.SVG(g))
}

func (d *dienst) qrPDF(w http.ResponseWriter, r *http.Request) {
	s, g, gut := d.ausWunsch(w, r)
	if !gut {
		return
	}
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="pnkt.pdf"`)
	_, _ = w.Write(ausgabe.PDF(s.Formen(g), "pnkt QR"))
}

func (d *dienst) qrEPS(w http.ResponseWriter, r *http.Request) {
	s, g, gut := d.ausWunsch(w, r)
	if !gut {
		return
	}
	w.Header().Set("Content-Type", "application/postscript")
	w.Header().Set("Content-Disposition", `attachment; filename="pnkt.eps"`)
	_, _ = w.Write(ausgabe.EPS(s.Formen(g), "pnkt QR"))
}

// --- Hilfen ---------------------------------------------------------------

func (d *dienst) jsonAus(w http.ResponseWriter, lage int, wert any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(lage)
	_ = json.NewEncoder(w).Encode(wert)
}

// hinweis ist die Seite, die ein Scan sieht, wenn es nicht weitergeht.
// Ein gedruckter Code darf nie in einem Serverfehler enden — dahinter
// steht ein Mensch mit einem Telefon vor einem Plakat.
func (d *dienst) hinweis(w http.ResponseWriter, lage int, titel, text string) {
	d.hinweisMitMarke(w, nil, lage, titel, text)
}

// hinweisMitMarke zeigt die Seite im Gesicht des Hostnamens, ueber den
// gescannt wurde. Wer den Code eines Kunden scannt, sieht dessen Marke —
// das ist der sichtbare Teil des White-Label.
func (d *dienst) hinweisMitMarke(w http.ResponseWriter, r *http.Request, lage int, titel, text string) {
	m := speicher.StandardMarke()
	if r != nil {
		m = d.ablage.MarkeNachHost(r.Host)
	}
	logo := ""
	if m.LogoSVG != "" {
		logo = `<div class="logo">` + m.LogoSVG + `</div>`
	}
	fuss := ""
	if m.Impressum != "" || m.Datenschutz != "" {
		fuss = `<p class="fuss">`
		if m.Impressum != "" {
			fuss += `<a href="` + m.Impressum + `">Impressum</a> `
		}
		if m.Datenschutz != "" {
			fuss += `<a href="` + m.Datenschutz + `">Datenschutz</a>`
		}
		fuss += `</p>`
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(lage)
	fmt.Fprintf(w, `<!doctype html><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s · %s</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100vh;
font:17px/1.5 ui-sans-serif,system-ui,sans-serif;background:%s;color:%s}
main{max-width:26rem;padding:2rem}h1{font-size:1.4rem;margin:0 0 .6rem}
p{margin:0;opacity:.75}.logo{margin-bottom:1.2rem;max-width:9rem}
.logo svg{width:100%%;height:auto}.marke{font-size:.72rem;font-weight:700;
letter-spacing:.12em;text-transform:uppercase;color:%s;margin-bottom:.5rem}
.fuss{margin-top:1.5rem;font-size:.8rem}.fuss a{color:inherit}</style>
<main>%s<div class="marke">%s</div><h1>%s</h1><p>%s</p>%s</main>`,
		titel, m.Name, m.Grund, m.Tinte, m.Primaer, logo, m.Name, titel, text, fuss)
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

func oder(wert, ersatz string) string {
	if strings.TrimSpace(wert) == "" {
		return ersatz
	}
	return wert
}

func zahl(wert string, ersatz float64) float64 {
	if wert == "" {
		return ersatz
	}
	z, err := strconv.ParseFloat(wert, 64)
	if err != nil {
		return ersatz
	}
	return z
}
