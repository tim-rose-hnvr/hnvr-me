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
	"pnkt.me/pnkt/gestalt"
	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/qr"
	"pnkt.me/pnkt/regel"
	"pnkt.me/pnkt/speicher"
)

type dienst struct {
	ablage *speicher.Speicher
	host   string
	// landkopf ist der Kopf, aus dem das Land eines Scans kommt. Er wird
	// von einem vorgelagerten Server gesetzt; eine eigene
	// Standortbestimmung findet nicht statt. Welcher Kopf das ist, haengt
	// vom Betrieb ab — Cloudflare setzt CF-IPCountry, ein eigener nginx
	// vielleicht X-Land. Fest verdrahtet waere er bei jedem, der nicht
	// hinter Cloudflare sitzt, still wirkungslos.
	landkopf string
}

func main() {
	adresse := flag.String("adresse", ":8080", "Adresse, auf der gelauscht wird")
	daten := flag.String("daten", "./daten", "Verzeichnis der Ablage")
	host := flag.String("host", "https://pnkt.me", "eigener Kurzhost fuer Digital Link")
	landkopf := flag.String("landkopf", "CF-IPCountry",
		"Kopf, aus dem das Land eines Scans kommt; leer schaltet die Landregel ab")
	flag.Parse()

	// Das Paket qr kennt nur Zeichenketten als Farben; die Deutung von
	// CMYK und Sonderfarben fuer die Bildschirmvorschau kommt von hier.
	qr.Bildschirmfarbe = func(angabe string) string { return farbe.Lies(angabe).Hex() }

	ablage, err := speicher.Oeffne(*daten)
	if err != nil {
		log.Fatalf("Ablage nicht zu oeffnen: %v", err)
	}
	defer ablage.Schliesse()

	d := &dienst{ablage: ablage, host: *host, landkopf: *landkopf}

	server := &http.Server{
		Addr:              *adresse,
		Handler:           wege(d),
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

// wege haengt alle Pfade an einen Verteiler. Getrennt von main, damit
// ein Test denselben Verteiler benutzen kann wie der Betrieb — sonst
// prueft der Test etwas anderes als das, was laeuft.
func wege(d *dienst) *http.ServeMux {
	weg := http.NewServeMux()
	weg.HandleFunc("GET /gesundheit", d.gesundheit)

	// Erscheinungsbild: Tokenschicht und Schriften kommen aus dem Binaer.
	gestalt.Wege(weg)
	weg.HandleFunc("GET /marke.svg", d.markeZeichen)

	// Offen — kein Schluessel noetig. Codes erzeugen und Ziele ansehen
	// geht ohne Konto, so wie es die Schnittstellenseite zusagt.
	weg.HandleFunc("GET /api/v1/typen", d.typen)
	weg.HandleFunc("POST /api/v1/rendern", d.rendern)
	weg.HandleFunc("GET /api/v1/vorlage.csv", d.vorlageCSV)
	weg.HandleFunc("POST /api/v1/inhalt", d.inhaltBauen)
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
	weg.HandleFunc("GET /api/v1/codes", d.mitSchluessel(false, d.listeCodesFuer))
	weg.HandleFunc("GET /api/v1/ordner", d.mitSchluessel(false, d.ordnerListe))
	weg.HandleFunc("POST /api/v1/codes", d.mitSchluessel(true, d.legeCodeAnFuer))
	weg.HandleFunc("PATCH /api/v1/codes/{id}", d.mitSchluessel(true, d.aendereCode))
	weg.HandleFunc("DELETE /api/v1/codes/{id}", d.mitSchluessel(true, d.loescheCode))
	weg.HandleFunc("GET /api/v1/codes/{id}/statistik", d.mitSchluessel(false, d.statistik))
	weg.HandleFunc("GET /api/v1/codes/{id}/protokoll", d.mitSchluessel(false, d.protokoll))
	weg.HandleFunc("GET /api/v1/codes/{id}/fassungen", d.mitSchluessel(false, d.fassungen))
	weg.HandleFunc("POST /api/v1/codes/{id}/fassungen/{fassung}",
		d.mitSchluessel(true, d.zurueckholen))
	weg.HandleFunc("POST /api/v1/massenanlage", d.mitSchluessel(true,
		func(w http.ResponseWriter, r *http.Request, s *speicher.Schluessel) { d.charge(w, r) }))
	weg.HandleFunc("POST /api/v1/serie/vorschau", d.mitSchluessel(false, d.serienVorschau))
	weg.HandleFunc("POST /api/v1/serie", d.mitSchluessel(true, d.serienPaket))
	weg.HandleFunc("GET /zentrale", d.zentrale)
	weg.HandleFunc("GET /serie", d.serienseite)
	weg.HandleFunc("GET /api/v1/zahlen", d.mitSchluessel(false, d.zahlenDaten))
	weg.HandleFunc("GET /zahlen", d.zahlenseite)

	// Produktpass. Die oeffentliche Seite ist die Anforderung der ESPR;
	// der Code davor ist nur der Datentraeger.
	weg.HandleFunc("GET /p/{gtin}", d.passseite)
	weg.HandleFunc("GET /p/{gtin}/{charge}", d.passseite)
	weg.HandleFunc("POST /api/v1/pass/pruefen", d.passPruefen)
	weg.HandleFunc("GET /api/v1/pass", d.mitSchluessel(false, d.passListe))
	weg.HandleFunc("PUT /api/v1/pass", d.mitSchluessel(true, d.passSetzen))
	weg.HandleFunc("DELETE /api/v1/pass/{gtin}", d.mitSchluessel(true, d.passZurueckziehen))

	// Weiterleitung. /r/ ist der veroeffentlichte Weg, die Wurzel der
	// kurze — auf einer eigenen Kurzdomain zaehlt jedes Zeichen.
	weg.HandleFunc("GET /r/{kuerzel}", d.weiterleiten)
	weg.HandleFunc("GET /r/{kuerzel}/vorschau", d.vorschau)
	weg.HandleFunc("GET /01/{gtin}/", d.digitalLinkOderPass)
	weg.HandleFunc("GET /01/{gtin}", d.digitalLinkOderPass)

	weg.HandleFunc("GET /qr.svg", d.qrSVG)
	weg.HandleFunc("GET /qr.pdf", d.qrPDF)
	weg.HandleFunc("GET /qr.eps", d.qrEPS)
	weg.HandleFunc("GET /{$}", d.studio)
	weg.HandleFunc("GET /{kuerzel}", d.weiterleiten)

	return weg
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
	if code.Geloescht {
		// Nicht „unbekannt": diesen Code gab es, und sein Kuerzel bleibt
		// belegt. Wer ihn scannt, hat etwas Gedrucktes in der Hand und
		// soll das erfahren, statt an einen Tippfehler zu glauben.
		d.hinweisMitMarke(w, r, http.StatusGone, "Geloescht",
			"Dieser Code wurde geloescht. Ein Ziel gibt es nicht mehr.")
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

	ziel := waehleZiel(code, r, d.landkopf)
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
func waehleZiel(c *speicher.Code, r *http.Request, landkopf string) string {
	u := umstand(r, landkopf)
	e := regel.Waehle(regelwerkAus(c), u)
	if e.Ziel == "" {
		e.Ziel = c.Ziel
	}
	return regel.Kampagne(e.Ziel, c.UTM, u, c.Kuerzel)
}

// umstand liest aus der Anfrage, was das Regelwerk braucht. Das Land
// kommt aus einem Kopf, den ein vorgelagerter Server setzt — eine eigene
// Standortbestimmung findet nicht statt.
func umstand(r *http.Request, landkopf string) regel.Umstand {
	sprache := ""
	if s := r.Header.Get("Accept-Language"); len(s) >= 2 {
		sprache = strings.ToLower(s[:2])
	}
	land := ""
	if landkopf != "" {
		land = r.Header.Get(landkopf)
	}
	return regel.Umstand{
		Jetzt:   time.Now(),
		Land:    land,
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
				http.Redirect(w, r, waehleZiel(c, r, d.landkopf), http.StatusFound)
				return
			}
		}
	}
	d.hinweisMitMarke(w, r, http.StatusNotFound, "Artikel unbekannt",
		"Zu dieser GTIN ist hier kein Ziel hinterlegt.")
}

// markeZeichen liefert das Favicon in den Farben der Marke des Hosts.
func (d *dienst) markeZeichen(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "image/svg+xml")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	_, _ = w.Write([]byte(gestalt.MarkeSVG(m.Primaer, m.Grund)))
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

func (d *dienst) aendereCode(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	// Ordner kommt als Zeiger herein, damit er sich auch leeren laesst.
	// Bei den uebrigen Feldern heisst „leer" weiterhin „nicht
	// mitgeschickt" — sonst loeschte ein knapper Aufruf versehentlich das
	// Ziel eines gedruckten Codes.
	var wunsch struct {
		Name     string         `json:"name"`
		Ziel     string         `json:"ziel"`
		Ordner   *string        `json:"ordner"`
		Regeln   map[string]any `json:"regeln"`
		Gesperrt string         `json:"gesperrt"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&wunsch); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	alt, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	if alt.Geloescht {
		d.jsonAus(w, http.StatusGone, map[string]string{
			"fehler": "dieser Code ist geloescht und wird nicht wieder in Betrieb genommen"})
		return
	}
	altesZiel := alt.Ziel

	neu, err := d.ablage.Aendere(alt.ID, func(c *speicher.Code) error {
		if wunsch.Ziel != "" {
			c.Ziel = wunsch.Ziel
		}
		if wunsch.Name != "" {
			c.Name = wunsch.Name
		}
		if wunsch.Ordner != nil {
			c.Ordner = strings.TrimSpace(*wunsch.Ordner)
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

func (d *dienst) statistik(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	d.jsonAus(w, http.StatusOK, d.ablage.Zaehlerstand(c.ID))
}

func (d *dienst) protokoll(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	eintraege, err := d.ablage.Protokoll(c.ID)
	if err != nil {
		d.jsonAus(w, http.StatusInternalServerError, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, eintraege)
}

// fassungen zeigt die Geschichte eines Codes, aelteste zuerst.
func (d *dienst) fassungen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	liste, err := d.ablage.Fassungen(c.ID)
	if err != nil {
		d.jsonAus(w, http.StatusInternalServerError, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, liste)
}

// zurueckholen setzt einen frueheren Stand wieder ein — als neue
// Fassung, nicht durch Ueberschreiben.
func (d *dienst) zurueckholen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	c, gut := d.eigenerCode(w, r, sch)
	if !gut {
		return
	}
	nummer, err := strconv.Atoi(r.PathValue("fassung"))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{
			"fehler": "die Fassung ist eine Zahl"})
		return
	}
	neu, err := d.ablage.Hole(c.ID, nummer, kennungKurz(sch))
	if err != nil {
		// Dass eine Fassung schon gilt, ist kein Serverfehler und kein
		// Bedienfehler — es ist ein Leerlauf. 409 sagt genau das.
		lage := http.StatusBadRequest
		if errors.Is(err, speicher.ErrSchonAktuell) {
			lage = http.StatusConflict
		}
		d.jsonAus(w, lage, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, neu)
}

// kennungKurz nennt den Schluessel im Protokoll, ohne ihn zu verraten.
func kennungKurz(sch *speicher.Schluessel) string {
	return "schluessel:" + sch.Name
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

	// Das Zeichen der Marke steht ueber dem Namen. Bei der Hausmarke ist
	// das der Terrakotta-Punkt aus dem Designsystem; ein Kunde mit
	// eigenem Logo bekommt seines.
	zeichen := gestalt.MarkeLockup(m.Name, "", false)
	if m.LogoSVG != "" {
		zeichen = `<div class="logo">` + m.LogoSVG + `</div>`
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// 'self' muss mit dabei stehen: die Tokenschicht kommt als eigene
	// Datei, und 'unsafe-inline' allein erlaubt nur den Stil im Dokument.
	// Ohne das bleibt die Seite unformatiert — lautlos, mit 200 im Log.
	w.Header().Set("Content-Security-Policy",
		"default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:")
	w.WriteHeader(lage)
	fmt.Fprintf(w, `<!doctype html><html lang="de"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s · %s</title>
%s
<style>
:root{--color-bg:%s;--color-text:%s;--color-accent:%s}
body{display:grid;place-items:center;min-height:100vh;padding:1.5rem;
 background:var(--color-bg);color:var(--color-text);
 font-family:var(--font-body);font-size:17px;line-height:1.55}
main{max-width:30rem}
.zeichen{margin-bottom:1.4rem}
.logo{margin-bottom:1.4rem;max-width:9rem}.logo svg{width:100%%;height:auto}
h1{font-family:var(--font-heading);font-size:2rem;line-height:1.1;
 letter-spacing:-.02em;margin:0 0 .6rem}
p{margin:0;color:color-mix(in srgb,var(--color-text) 72%%,transparent)}
.fuss{margin-top:2rem;font-size:.82rem;
 color:color-mix(in srgb,var(--color-text) 55%%,transparent)}
.fuss a{color:inherit}
</style>
<main><div class="zeichen">%s</div><h1>%s</h1><p>%s</p>%s</main></html>`,
		titel, m.Name, gestalt.Kopf(), m.Grund, m.Tinte, m.Primaer,
		zeichen, titel, text, fuss)
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
