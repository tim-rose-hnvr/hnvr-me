// Package web ist die Oberfläche für die Kundin.
package web

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"html/template"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/planer"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/speicher"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/vorlage"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/wix"
)

//go:embed vorlagen/*.html
var dateien embed.FS

//go:embed schriften.css
var schriftenCSS []byte

// Server bedient die Oberfläche.
type Server struct {
	P       *planer.Planer
	Log     *slog.Logger
	vorlage *template.Template
}

// Neu baut den Server und übersetzt die Vorlagen.
func Neu(p *planer.Planer, log *slog.Logger) (*Server, error) {
	t, err := template.New("").Funcs(template.FuncMap{
		"uhr":     func(t time.Time) string { return t.Local().Format("15:04") },
		"tag":     func(t time.Time) string { return wochentag(t) },
		"datum":   func(t time.Time) string { return t.Local().Format("02.01.") },
		"prozent": prozent,
	}).ParseFS(dateien, "vorlagen/*.html")
	if err != nil {
		return nil, fmt.Errorf("web: Vorlagen: %w", err)
	}
	return &Server{P: p, Log: log, vorlage: t}, nil
}

var wochentage = [...]string{"So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"}

func wochentag(t time.Time) string { return wochentage[int(t.Local().Weekday())] }

func prozent(teil, ganz int) int {
	if ganz <= 0 {
		return 0
	}
	p := teil * 100 / ganz
	if p > 100 {
		p = 100
	}
	return p
}

// Router liefert den fertig verdrahteten Mux.
func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /gesundheit", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		fmt.Fprintln(w, "ok")
	})

	mux.HandleFunc("GET /schriften.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		_, _ = w.Write(schriftenCSS)
	})

	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		kunden := s.P.S.Kunden()
		if len(kunden) == 0 {
			http.Error(w, "Noch kein Kunde eingerichtet. Siehe README, Abschnitt Einrichten.", http.StatusNotFound)
			return
		}
		http.Redirect(w, r, "/kunde/"+kunden[0].ID, http.StatusFound)
	})

	mux.HandleFunc("GET /kunde/{id}", s.zeigePlaner)
	mux.HandleFunc("POST /beitrag/{id}/freigeben", s.freigeben)
	mux.HandleFunc("POST /beitrag/{id}/planen", s.planen)
	mux.HandleFunc("POST /kunde/{id}/abgleichen", s.abgleichen)
	mux.HandleFunc("POST /kunde/{id}/beitrag", s.neuerBeitrag)
	mux.HandleFunc("POST /beitrag/{id}/aendern", s.aendern)

	return mux
}

// ---- Sichten ----

type sichtKanal struct {
	speicher.Kanal
	Beschriftung string
}

type sichtZustellung struct {
	speicher.Zustellung
	Kanalname string
	Plattform string
}

type sichtBeitrag struct {
	speicher.Beitrag
	Zeilen      []sichtZustellung
	Vorlagename string
	Hinweis     string
	HinweisArt  string // "bad" | "hold" | ""
}

type sicht struct {
	Kunde         speicher.Kunde
	Kanaele       []sichtKanal
	Vorlagen      []vorlage.Vorlage
	Beitraege     []sichtBeitrag
	Kontingent    wix.Kontingent
	Planbar       bool
	Kontakte      int
	Meldungen     []meldung
	WixErreichbar bool
	WixFehler     string
	Stand         time.Time
}

type meldung struct {
	Art   string // "stop" | "warn"
	Titel string
	Text  string
	Knopf string
	Ziel  string
}

func (s *Server) zeigePlaner(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	kunde, ok := s.P.S.Kunde(id)
	if !ok {
		http.Error(w, "Kunde nicht gefunden", http.StatusNotFound)
		return
	}

	ctx, abbruch := context.WithTimeout(r.Context(), 15*time.Second)
	defer abbruch()

	v := sicht{Kunde: kunde, Stand: time.Now(), WixErreichbar: true}

	// Kontingent live lesen — die Zahl entscheidet, ob überhaupt etwas rausgeht.
	if k, err := s.P.W.Kontingent(ctx, kunde.WixSiteID, "PUBLISH_POST"); err != nil {
		v.WixErreichbar = false
		v.WixFehler = err.Error()
	} else {
		v.Kontingent = k
	}
	if k, err := s.P.W.Kontingent(ctx, kunde.WixSiteID, "SCHEDULE_POST"); err == nil {
		v.Planbar = k.Erlaubt
	}

	for _, k := range s.P.S.KanaeleVon(id) {
		v.Kanaele = append(v.Kanaele, sichtKanal{Kanal: k, Beschriftung: kanalText(k)})
	}
	v.Vorlagen = s.P.S.VorlagenVon(id)

	namen := map[string]string{}
	plattform := map[string]string{}
	for _, k := range s.P.S.KanaeleVon(id) {
		namen[k.ID] = k.Anzeigename
		plattform[k.ID] = k.Plattform
	}
	vorlagenamen := map[string]string{}
	for _, vl := range v.Vorlagen {
		vorlagenamen[vl.ID] = vl.Name
	}

	for _, b := range s.P.S.Beitraege() {
		if b.KundeID != id {
			continue
		}
		sb := sichtBeitrag{Beitrag: b, Vorlagename: vorlagenamen[b.VorlageID]}
		for _, z := range b.Zustellungen {
			name := namen[z.KanalID]
			if name == "" {
				name = plattform[z.KanalID]
			}
			sb.Zeilen = append(sb.Zeilen, sichtZustellung{
				Zustellung: z, Kanalname: name, Plattform: plattform[z.KanalID],
			})
		}
		sb.Hinweis, sb.HinweisArt = hinweisZu(b, v.Planbar)
		v.Beitraege = append(v.Beitraege, sb)
	}
	sort.SliceStable(v.Beitraege, func(i, j int) bool {
		return v.Beitraege[i].GeplantFuer.Before(v.Beitraege[j].GeplantFuer)
	})

	v.Meldungen = meldungen(v)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := s.vorlage.ExecuteTemplate(w, "planer.html", v); err != nil {
		s.Log.Error("Vorlage konnte nicht gezeichnet werden", "fehler", err)
	}
}

func kanalText(k speicher.Kanal) string {
	switch k.Zustand {
	case string(wix.Verbunden):
		return "verbunden"
	case string(wix.Ungueltig):
		return "Verbindung erloschen"
	case string(wix.NieVerbunden):
		return "nicht verbunden"
	}
	return k.Zustand
}

// hinweisZu formuliert den Satz, der unter einem Beitrag steht.
// Fehlgeschlagen ist ein Zustand, kein Logeintrag — die Kundin muss den
// Grund sehen, ohne jemanden zu fragen.
func hinweisZu(b speicher.Beitrag, planbar bool) (string, string) {
	for _, z := range b.Zustellungen {
		if z.Zustand == speicher.ZFehlgeschlagen && z.Fehlergrund != "" {
			return z.Fehlergrund, "bad"
		}
	}
	switch b.Zustand {
	case speicher.Entwurf:
		if b.InhaltsHash == "" && len(b.Zustellungen) > 0 {
			return "Entwurf — noch nicht zur Freigabe gegeben.", "hold"
		}
	case speicher.Freigegeben:
		return "Freigegeben. Termin setzen, damit der Beitrag in die Warteschlange kommt.", ""
	case speicher.Geplant:
		if !planbar {
			return "Wix terminiert nicht — Kanalwerk hält die Uhr und gibt den Beitrag zum Termin selbst heraus.", ""
		}
		return "In der Warteschlange.", ""
	}
	return "", ""
}

func meldungen(v sicht) []meldung {
	var raus []meldung

	if !v.WixErreichbar {
		raus = append(raus, meldung{
			Art: "stop", Titel: "Wix antwortet nicht",
			Text: v.WixFehler,
		})
		return raus
	}

	if !v.Kontingent.Erlaubt {
		raus = append(raus, meldung{
			Art: "stop", Titel: "Veröffentlichen ist nicht freigeschaltet",
			Text: "Diese Site darf derzeit gar nichts herausgeben.",
		})
	} else if v.Kontingent.Grenze > 0 && v.Kontingent.Rest <= 0 {
		raus = append(raus, meldung{
			Art: "stop", Titel: "Kontingent aufgebraucht",
			Text: fmt.Sprintf("Alle %d Beiträge dieses Monats sind verbraucht. Der Zähler springt zum Monatsbeginn zurück.", v.Kontingent.Grenze),
		})
	}

	var verbunden int
	var erloschen []string
	for _, k := range v.Kanaele {
		switch k.Zustand {
		case string(wix.Verbunden):
			verbunden++
		case string(wix.Ungueltig):
			erloschen = append(erloschen, k.Plattform)
		}
	}
	if verbunden == 0 {
		raus = append(raus, meldung{
			Art: "stop", Titel: "Noch kein Kanal verbunden",
			Text:  "Ohne verbundenes Konto geht kein Beitrag raus.",
			Knopf: "Kanäle abgleichen", Ziel: "/kunde/" + v.Kunde.ID + "/abgleichen",
		})
	}
	for _, p := range erloschen {
		raus = append(raus, meldung{
			Art: "warn", Titel: p + ": Verbindung erloschen",
			Text:  "Der Kanal war verbunden und ist es nicht mehr. Bitte im Wix-Dashboard neu verbinden.",
			Knopf: "Erneut prüfen", Ziel: "/kunde/" + v.Kunde.ID + "/abgleichen",
		})
	}

	if !v.Planbar {
		raus = append(raus, meldung{
			Art: "warn", Titel: "Wix terminiert nicht",
			Text: "Der Wix-Plan dieser Site kann keine Beiträge auf eine Uhrzeit legen. Kanalwerk hält die Warteschlange deshalb selbst — geplante Beiträge gehen zum Termin trotzdem raus.",
		})
	}

	return raus
}

// ---- Handlungen ----

func (s *Server) freigeben(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	person := r.FormValue("person")
	if person == "" {
		person = "Kundin"
	}
	b, ok := s.P.S.Beitrag(id)
	if !ok {
		http.Error(w, "Beitrag nicht gefunden", http.StatusNotFound)
		return
	}
	if err := s.P.GibFrei(id, person, r.FormValue("begruendung")); err != nil {
		s.Log.Error("Freigabe fehlgeschlagen", "beitrag", id, "fehler", err)
		http.Error(w, "Freigabe fehlgeschlagen: "+err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/kunde/"+b.KundeID, http.StatusSeeOther)
}

func (s *Server) planen(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, ok := s.P.S.Beitrag(id)
	if !ok {
		http.Error(w, "Beitrag nicht gefunden", http.StatusNotFound)
		return
	}

	wann := time.Now()
	if roh := r.FormValue("termin"); roh != "" {
		// Eingabefeld vom Typ datetime-local liefert Ortszeit ohne Zone.
		if t, err := time.ParseInLocation("2006-01-02T15:04", roh, time.Local); err == nil {
			wann = t
		} else {
			http.Error(w, "Termin nicht lesbar: "+roh, http.StatusBadRequest)
			return
		}
	}

	err := s.P.Plane(id, wann)
	switch {
	case errors.Is(err, planer.ErrFreigabeVerfallen):
		http.Error(w, "Der Beitrag wurde nach der Freigabe geändert. Bitte erneut freigeben.", http.StatusConflict)
		return
	case errors.Is(err, planer.ErrNichtFreigegeben):
		http.Error(w, "Der Beitrag ist noch nicht freigegeben.", http.StatusConflict)
		return
	case err != nil:
		s.Log.Error("Planen fehlgeschlagen", "beitrag", id, "fehler", err)
		http.Error(w, "Planen fehlgeschlagen: "+err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/kunde/"+b.KundeID, http.StatusSeeOther)
}

func (s *Server) abgleichen(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	ctx, abbruch := context.WithTimeout(r.Context(), 60*time.Second)
	defer abbruch()
	if err := s.P.SynchronisiereKanaele(ctx, id); err != nil {
		s.Log.Warn("Kanalabgleich unvollständig", "kunde", id, "fehler", err)
	}
	http.Redirect(w, r, "/kunde/"+id, http.StatusSeeOther)
}

// neuerBeitrag legt einen Beitrag aus einer Vorlage an.
//
// Die Kundin füllt Text und Bild; Schrift, Farbe und Raster kommen aus der
// Vorlage und sind hier bewusst nicht ansprechbar.
func (s *Server) neuerBeitrag(w http.ResponseWriter, r *http.Request) {
	kundeID := r.PathValue("id")
	if _, ok := s.P.S.Kunde(kundeID); !ok {
		http.Error(w, "Kunde nicht gefunden", http.StatusNotFound)
		return
	}
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Formular nicht lesbar", http.StatusBadRequest)
		return
	}

	kanaele := r.Form["kanal"]
	if len(kanaele) == 0 {
		http.Error(w, "Mindestens ein Kanal muss ausgewählt sein.", http.StatusBadRequest)
		return
	}

	bild := strings.TrimSpace(r.FormValue("bild"))
	vorlageID := r.FormValue("vorlage")

	b := speicher.Beitrag{
		ID:         kennung(),
		KundeID:    kundeID,
		VorlageID:  vorlageID,
		BildURL:    bild,
		Zustand:    speicher.Entwurf,
		Werte:      map[string]string{},
		AngelegtAm: time.Now().UTC(),
	}

	if vorlageID != "" {
		v, ok := vorlage.Finde(s.P.S.VorlagenVon(kundeID), vorlageID)
		if !ok {
			http.Error(w, "Diese Vorlage gibt es nicht.", http.StatusBadRequest)
			return
		}
		// Nur die Felder der Vorlage werden übernommen. Was sonst im
		// Formular steht, hat hier nichts verloren.
		for _, f := range v.Felder {
			if wert := strings.TrimSpace(r.FormValue("feld_" + f.Name)); wert != "" {
				b.Werte[f.Name] = wert
			}
		}
		if err := v.Pruefe(b.Werte, bild); err != nil {
			s.zeigeBeanstandung(w, err)
			return
		}
		// Vorschau in Text ablegen; die Zustellung setzt je Kanal neu.
		b.Text = v.Setze("standard", b.Werte)
	} else {
		text := strings.TrimSpace(r.FormValue("text"))
		if text == "" {
			http.Error(w, "Ohne Text kein Beitrag.", http.StatusBadRequest)
			return
		}
		b.Text = text
	}

	for _, k := range kanaele {
		b.Zustellungen = append(b.Zustellungen, speicher.Zustellung{
			KanalID: k, Zustand: speicher.ZWartend,
		})
	}

	// Bevor der Beitrag angelegt wird: passt der gesetzte Text auf jeden
	// gewählten Kanal? Später zu scheitern hilft niemandem.
	for _, kID := range kanaele {
		k, ok := s.P.S.Kanal(kID)
		if !ok {
			continue
		}
		if err := vorlage.PasstAufKanal(k.Plattform, s.P.TextFuer(b, k.Plattform)); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	if err := s.P.S.SetzeBeitrag(b); err != nil {
		s.Log.Error("Beitrag konnte nicht gespeichert werden", "fehler", err)
		http.Error(w, "Beitrag konnte nicht gespeichert werden.", http.StatusInternalServerError)
		return
	}
	_ = s.P.S.Protokolliere(speicher.Ereignis{
		KundeID: kundeID, Art: "beitrag.angelegt",
		Nutzlast: map[string]any{"beitrag": b.ID, "kanaele": len(kanaele)},
	})
	http.Redirect(w, r, "/kunde/"+kundeID, http.StatusSeeOther)
}

// aendern übernimmt geänderten Text. Wenn dadurch eine Freigabe verfällt,
// sagt die Antwort das ausdrücklich.
func (s *Server) aendern(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	b, ok := s.P.S.Beitrag(id)
	if !ok {
		http.Error(w, "Beitrag nicht gefunden", http.StatusNotFound)
		return
	}
	neu := strings.TrimSpace(r.FormValue("text"))
	if neu == "" {
		http.Error(w, "Ohne Text kein Beitrag.", http.StatusBadRequest)
		return
	}
	if _, err := s.P.Aendere(id, func(x *speicher.Beitrag) { x.Text = neu }); err != nil {
		http.Error(w, "Änderung fehlgeschlagen: "+err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/kunde/"+b.KundeID, http.StatusSeeOther)
}

// kennung liefert eine kurze, eindeutige Kennung.
func kennung() string {
	roh := make([]byte, 8)
	if _, err := rand.Read(roh); err != nil {
		// Zufall ist nicht verfügbar — Zeitstempel ist als Rückfall eindeutig genug.
		return fmt.Sprintf("b%d", time.Now().UnixNano())
	}
	return "b" + hex.EncodeToString(roh)
}

// zeigeBeanstandung schreibt die Beanstandungen als lesbare Liste, nicht als
// eine Zeile Schnittstellenfehler.
func (s *Server) zeigeBeanstandung(w http.ResponseWriter, err error) {
	var liste vorlage.Fehlerliste
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusBadRequest)
	if errors.As(err, &liste) {
		fmt.Fprintln(w, "Der Beitrag wurde nicht angelegt:")
		for _, f := range liste {
			fmt.Fprintf(w, "  • %s\n", f.Meldung)
		}
		return
	}
	fmt.Fprintln(w, err.Error())
}
