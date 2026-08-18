//go:build js && wasm

// Der Serien-Assistent im Browser — Bildschirm 3b aus dem Handoff:
// „Spalte wählen, Ziel-Muster setzen, fertig. Jeder Code behält sein
// eigenes Ziel — das Design bleibt eins."
//
// Auch das läuft ohne Server. Eine Tabelle mit 24 Tischnummern wird zu
// 24 Codes und einem ausgeschossenen Druckbogen, und nichts davon
// verlässt den Rechner: die CSV wird nicht hochgeladen, das Archiv
// entsteht im Browser.
//
// Zwei Regeln aus dem Kern gelten hier unverändert, und beide sind
// teuer erarbeitet:
//
//   – Das Muster wird gegen die Kopfzeile geprüft, BEVOR eine Zeile
//     umgesetzt wird. Ein vertippter Spaltenname darf nicht 24 Codes
//     ergeben, in denen wörtlich „{Tsich}" steht.
//   – Der Bogen verkleinert kein Stück, damit mehr daraufpasst. Passen
//     sie nicht, werden es mehr Bogen.
//
// Was hier NICHT geht: dynamische Codes anlegen. Dafür braucht es eine
// Adresse, die jemand beantwortet. Die Serie erzeugt statische Codes,
// und die tragen ihr Ziel im Muster.

package main

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"strings"
	"syscall/js"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/bogen"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/qr"
	"pnkt.me/pnkt/serie"
)

type serienwunsch struct {
	CSV         string  `json:"csv"`
	Muster      string  `json:"muster"`
	ZielSpalte  string  `json:"zielspalte"`
	NameSpalte  string  `json:"namespalte"`
	GTINSpalte  string  `json:"gtinspalte"`
	BreiteMm    float64 `json:"breiteMm"`
	Stufe       string  `json:"stufe"`
	Verfahren   string  `json:"verfahren"`
	Blatt       string  `json:"blatt"`
	AnschnittMm float64 `json:"anschnittMm"`
	AbstandMm   float64 `json:"abstandMm"`
	Marken      bool    `json:"marken"`
	Stil        struct {
		Modulform   string `json:"modulform"`
		Augenrahmen string `json:"augenrahmen"`
		Augenkern   string `json:"augenkern"`
		Vordergrund string `json:"vordergrund"`
		Hintergrund string `json:"hintergrund"`
	} `json:"stil"`
}

type postenAus struct {
	Nr     int    `json:"nr"`
	Name   string `json:"name"`
	Ziel   string `json:"ziel"`
	Fehler string `json:"fehler,omitempty"`
}

type serienantwort struct {
	Fehler     string      `json:"fehler,omitempty"`
	Spalten    []string    `json:"spalten,omitempty"`
	Zeilen     int         `json:"zeilen,omitempty"`
	Brauchbar  int         `json:"brauchbar,omitempty"`
	Posten     []postenAus `json:"posten,omitempty"`
	Doppelte   [][]any     `json:"doppelte,omitempty"`
	Aufteilung *struct {
		Spalten  int `json:"spalten"`
		Reihen   int `json:"reihen"`
		ProBogen int `json:"proBogen"`
		Bogen    int `json:"bogen"`
	} `json:"aufteilung,omitempty"`
	Zip string `json:"zip,omitempty"` // base64
}

func serienheraus(a serienantwort) string {
	roh, err := json.Marshal(a)
	if err != nil {
		return `{"fehler":"Antwort nicht verpackbar"}`
	}
	return string(roh)
}

// lese baut aus dem Wunsch die Tabelle und die Posten. Sie ist beiden
// Aufrufen gemeinsam, damit Vorschau und Erzeugen nie auseinanderlaufen
// — der Fehler, bei dem die Vorschau zwölf Stueck je Bogen verspricht
// und das Paket neun liefert, ist in diesem Haus schon einmal passiert.
func lese(w serienwunsch) (*serie.Tabelle, []serie.Posten, error) {
	t, err := serie.Lies(strings.NewReader(w.CSV))
	if err != nil {
		return nil, nil, err
	}
	posten, err := t.Umsetzen(serie.Zuordnung{
		Muster:     w.Muster,
		ZielSpalte: w.ZielSpalte,
		NameSpalte: w.NameSpalte,
		GTINSpalte: w.GTINSpalte,
	})
	if err != nil {
		return nil, nil, err
	}
	return t, posten, nil
}

func gestaltAus(w serienwunsch) qr.Gestalt {
	breite := w.BreiteMm
	if breite <= 0 {
		breite = 40
	}
	g := qr.StandardGestalt(breite)
	g.Modulform = oder(w.Stil.Modulform, "quadrat")
	g.Augenrahmen = oder(w.Stil.Augenrahmen, "quadrat")
	g.Augenkern = oder(w.Stil.Augenkern, "quadrat")
	g.Vordergrund = oder(w.Stil.Vordergrund, "#201e1d")
	g.Hintergrund = oder(w.Stil.Hintergrund, "#ffffff")
	return g
}

func planAus(w serienwunsch) bogen.Plan {
	p := bogen.StandardPlan()
	p.Blatt = bogen.BlattNach(oder(w.Blatt, "a4"))
	if w.AnschnittMm > 0 {
		p.AnschnittMm = w.AnschnittMm
	}
	if w.AbstandMm > 0 {
		p.AbstandMm = w.AbstandMm
	}
	p.Schnittmarken = w.Marken
	return p
}

// serienVorschau sagt vorher, was entstehen wuerde: welche Zeilen
// durchgehen, welche nicht und warum, welche Ziele doppelt sind, und
// wie der Bogen aufgeht.
func serienVorschau(_ js.Value, args []js.Value) any {
	if len(args) == 0 {
		return serienheraus(serienantwort{Fehler: "kein Wunsch übergeben"})
	}
	var w serienwunsch
	if err := json.Unmarshal([]byte(args[0].String()), &w); err != nil {
		return serienheraus(serienantwort{Fehler: "Wunsch nicht lesbar: " + err.Error()})
	}

	t, posten, err := lese(w)
	if err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}

	aus := serienantwort{Spalten: t.Spalten, Zeilen: len(t.Zeilen)}
	for _, p := range posten {
		if p.Fehler == "" {
			aus.Brauchbar++
		}
		aus.Posten = append(aus.Posten, postenAus{Nr: p.Nr, Name: p.Name, Ziel: p.Ziel, Fehler: p.Fehler})
	}
	for ziel, nummern := range serie.Doppelte(posten) {
		aus.Doppelte = append(aus.Doppelte, []any{ziel, nummern})
	}

	if aus.Brauchbar > 0 {
		g := gestaltAus(w)
		// Das Fach wird aus einer WIRKLICHEN Zeichnung gerechnet, nicht
		// aus der eingestellten Breite. Der Unterschied ist die
		// Ruhezone: ein 40-mm-Code belegt mit vier Modulen ringsum
		// deutlich mehr Platz.
		//
		// Der erste Versuch nahm hier g.BreiteMm, und die Vorschau
		// versprach 15 Stueck je Bogen, waehrend das Paket 12 lieferte.
		// Genau dieser Fehler ist in diesem Haus schon einmal passiert;
		// deshalb rechnen beide jetzt mit derselben Groesse.
		stufe, _ := qr.StufeAus(oder(w.Stufe, "M"))
		var fachBr, fachHo float64
		for _, p := range posten {
			if p.Fehler != "" {
				continue
			}
			s, err := qr.Baue(p.Ziel, stufe, 0)
			if err != nil {
				continue
			}
			z := s.Formen(g)
			fachBr, fachHo, _ = bogen.Fach(z.BreiteMm, z.HoeheMm, w.NameSpalte != "")
			break
		}
		auf, err := bogen.Teile(planAus(w), fachBr, fachHo, aus.Brauchbar)
		if err == nil && fachBr > 0 {
			aus.Aufteilung = &struct {
				Spalten  int `json:"spalten"`
				Reihen   int `json:"reihen"`
				ProBogen int `json:"proBogen"`
				Bogen    int `json:"bogen"`
			}{auf.Spalten, auf.Reihen, auf.ProBogen, auf.Bogen}
		}
	}
	return serienheraus(aus)
}

// serienPaket erzeugt das Archiv: ausgeschossene Bogen, jedes Stueck
// einzeln, ein Bericht und eine Liesmich fuer die Druckerei.
func serienPaket(_ js.Value, args []js.Value) any {
	if len(args) == 0 {
		return serienheraus(serienantwort{Fehler: "kein Wunsch übergeben"})
	}
	var w serienwunsch
	if err := json.Unmarshal([]byte(args[0].String()), &w); err != nil {
		return serienheraus(serienantwort{Fehler: "Wunsch nicht lesbar: " + err.Error()})
	}

	_, posten, err := lese(w)
	if err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}

	g := gestaltAus(w)
	stufe, err := qr.StufeAus(oder(w.Stufe, "M"))
	if err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}
	verfahren := oder(w.Verfahren, "offset")

	type fertig struct {
		posten    serie.Posten
		symbol    *qr.Symbol
		zeichnung qr.Zeichnung
		urteil    druck.Urteil
	}
	var alle []fertig
	var stuecke []bogen.Stueck

	for i := range posten {
		p := &posten[i]
		if p.Fehler != "" {
			continue
		}
		s, err := qr.Baue(p.Ziel, stufe, 0)
		if err != nil {
			p.Fehler = err.Error()
			continue
		}
		z := s.Formen(g)
		u := druck.Pruefe(druck.Vorgabe{
			BreiteMm: g.BreiteMm, ModuleJeKante: s.Kante, Fehlerkorrektur: stufe.String(),
			Verfahren: verfahren, RuhezoneModule: g.RuhezoneMod,
			Vordergrund: g.Vordergrund, Hintergrund: g.Hintergrund,
			Modulform: g.Modulform, Augenrahmen: g.Augenrahmen, Augenkern: g.Augenkern,
		})
		alle = append(alle, fertig{*p, s, z, u})
		stuecke = append(stuecke, bogen.Stueck{Zeichnung: z, Text: p.Name})
	}
	if len(stuecke) == 0 {
		return serienheraus(serienantwort{Fehler: "keine einzige Zeile ließ sich umsetzen"})
	}

	plan := planAus(w)
	plan.Fusszeile = fmt.Sprintf("pnkt.me · %d Stück zu %.0f mm · %s",
		len(stuecke), g.BreiteMm, verfahren)
	blaetter, auf, err := bogen.Setze(plan, stuecke)
	if err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}

	var puffer bytes.Buffer
	paket := zip.NewWriter(&puffer)

	hinein := func(name string, inhalt []byte) error {
		f, err := paket.Create(name)
		if err != nil {
			return err
		}
		_, err = f.Write(inhalt)
		return err
	}

	for i, blatt := range blaetter {
		if err := hinein(fmt.Sprintf("bogen-%02d.pdf", i+1),
			ausgabe.PDF(blatt, fmt.Sprintf("pnkt Bogen %d von %d", i+1, len(blaetter)))); err != nil {
			return serienheraus(serienantwort{Fehler: err.Error()})
		}
	}

	for _, f := range alle {
		grund := fmt.Sprintf("einzeln/%03d-%s", f.posten.Nr, dateiname(f.posten.Name))
		if err := hinein(grund+".svg", []byte(f.symbol.SVG(g))); err != nil {
			return serienheraus(serienantwort{Fehler: err.Error()})
		}
		if err := hinein(grund+".pdf", ausgabe.PDF(f.zeichnung, f.posten.Name)); err != nil {
			return serienheraus(serienantwort{Fehler: err.Error()})
		}
	}

	// Der Bericht ist der eigentliche Gegenstand: wer vierhundert Codes
	// anlegt, sieht sich keine vierhundert Dateien einzeln an.
	var bericht bytes.Buffer
	schreiber := csv.NewWriter(&bericht)
	_ = schreiber.Write([]string{"zeile", "name", "ziel", "note", "druckreif", "modulMm", "befunde"})
	for _, f := range alle {
		var texte []string
		for _, b := range f.urteil.Befunde {
			texte = append(texte, b.Schwere+": "+b.Text)
		}
		_ = schreiber.Write([]string{
			fmt.Sprint(f.posten.Nr), f.posten.Name, f.posten.Ziel, f.urteil.Note,
			map[bool]string{true: "ja", false: "nein"}[f.urteil.Druckreif],
			fmt.Sprintf("%.3f", f.urteil.ModulMm), strings.Join(texte, " | "),
		})
	}
	for _, p := range posten {
		if p.Fehler != "" {
			_ = schreiber.Write([]string{fmt.Sprint(p.Nr), p.Name, p.Ziel, "—", "nein", "—", p.Fehler})
		}
	}
	schreiber.Flush()
	if err := hinein("bericht.csv", bericht.Bytes()); err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}

	liesmich := fmt.Sprintf(
		"pnkt.me — Serie\n\n"+
			"%d Stueck zu %.0f mm auf %s, %d je Bogen (%d x %d), %d Bogen.\n"+
			"Anschnitt %.0f mm, Schnittmarken in der Passerfarbe \"All\".\n\n"+
			"bogen-*.pdf   ausgeschossen, zum Drucken und Schneiden\n"+
			"einzeln/      jedes Stueck fuer sich, SVG und PDF\n"+
			"bericht.csv   je Zeile Note, Modulgroesse und Befunde\n\n"+
			"Die Modulgroesse ist eine Druckentscheidung. Der Bogen verkleinert\n"+
			"kein Stueck, damit mehr daraufpasst — passen sie nicht, werden es\n"+
			"mehr Bogen.\n\n"+
			"Diese Codes sind statisch: das Ziel steht im Muster und laesst sich\n"+
			"nicht mehr aendern. Dafuer funktionieren sie ohne jeden Server.\n",
		len(stuecke), g.BreiteMm, plan.Blatt.Name, auf.ProBogen, auf.Spalten, auf.Reihen,
		auf.Bogen, plan.AnschnittMm)
	if err := hinein("LIESMICH.txt", []byte(liesmich)); err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}

	if err := paket.Close(); err != nil {
		return serienheraus(serienantwort{Fehler: err.Error()})
	}

	return serienheraus(serienantwort{
		Brauchbar: len(stuecke),
		Zip:       base64.StdEncoding.EncodeToString(puffer.Bytes()),
		Aufteilung: &struct {
			Spalten  int `json:"spalten"`
			Reihen   int `json:"reihen"`
			ProBogen int `json:"proBogen"`
			Bogen    int `json:"bogen"`
		}{auf.Spalten, auf.Reihen, auf.ProBogen, auf.Bogen},
	})
}

// dateiname macht aus einer Beschriftung etwas, das jedes Dateisystem
// annimmt — und behaelt Umlaute nicht bei, weil ein ZIP zwischen
// Windows und macOS sonst zwei verschiedene Namen zeigt.
func dateiname(s string) string {
	ersatz := strings.NewReplacer("ä", "ae", "ö", "oe", "ü", "ue", "ß", "ss",
		"Ä", "Ae", "Ö", "Oe", "Ü", "Ue")
	s = ersatz.Replace(strings.ToLower(strings.TrimSpace(s)))
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_':
			b.WriteRune('-')
		}
	}
	name := strings.Trim(b.String(), "-")
	if name == "" {
		name = "code"
	}
	if len(name) > 40 {
		name = name[:40]
	}
	return name
}
