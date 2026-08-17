package main

import (
	"archive/zip"
	"encoding/csv"
	"fmt"
	"math"
	"net/http"
	"strings"
	"time"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/bogen"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/qr"
	"pnkt.me/pnkt/serie"
	"pnkt.me/pnkt/speicher"
)

// Der Serien-Assistent: eine Tabelle hinein, ein Druckbogen heraus.
//
// Es gibt zwei Wege, und die Reihenfolge ist Absicht:
//
//	GET  /api/v1/serie/vorschau  — rechnet, legt nichts an, schreibt nichts
//	POST /api/v1/serie           — legt an und liefert das Paket
//
// Der Trockenlauf ist nicht Bequemlichkeit, sondern die Stelle, an der
// ein vertipptes Muster auffaellt. Wer 400 Codes anlegt und danach
// merkt, dass in jedem woertlich „{Tsich}" steht, hat 400 tote
// Kuerzel in der Ablage — und die bleiben belegt.

// serienWunsch sammelt alles, was aus der Anfrage kommt.
type serienWunsch struct {
	zuordnung serie.Zuordnung
	gestalt   qr.Gestalt
	stufe     qr.Stufe
	verfahren string
	plan      bogen.Plan
	anlegen   bool
	kontoID   string
}

func (d *dienst) serienWunsch(r *http.Request) (serienWunsch, error) {
	f := r.URL.Query()
	stufe, err := qr.StufeAus(oder(f.Get("stufe"), "M"))
	if err != nil {
		return serienWunsch{}, err
	}

	breite := zahl(f.Get("breite"), 40)
	g := qr.StandardGestalt(breite)
	g.Modulform = oder(f.Get("form"), "quadrat")
	g.Augenrahmen = oder(f.Get("augenrahmen"), "quadrat")
	g.Augenkern = oder(f.Get("augenkern"), "quadrat")
	g.Vordergrund = oder(f.Get("vordergrund"), "#000000")
	g.Hintergrund = oder(f.Get("hintergrund"), "#ffffff")
	g.RuhezoneMod = int(zahl(f.Get("ruhezone"), 4))

	p := bogen.StandardPlan()
	p.Blatt = bogen.BlattNach(oder(f.Get("blatt"), "a4"))
	p.AnschnittMm = zahl(f.Get("anschnitt"), 3)
	p.RandMm = zahl(f.Get("rand"), 10)
	p.AbstandMm = zahl(f.Get("abstand"), 4)
	p.Schnittmarken = f.Get("marken") != "0"

	return serienWunsch{
		zuordnung: serie.Zuordnung{
			Muster:     strings.TrimSpace(f.Get("muster")),
			ZielSpalte: strings.TrimSpace(f.Get("zielspalte")),
			NameSpalte: strings.TrimSpace(f.Get("namespalte")),
			GTINSpalte: strings.TrimSpace(f.Get("gtinspalte")),
			OrdnerFest: strings.TrimSpace(f.Get("ordner")),
		},
		gestalt:   g,
		stufe:     stufe,
		verfahren: oder(f.Get("verfahren"), "offset"),
		plan:      p,
		anlegen:   f.Get("anlegen") == "1",
		kontoID:   f.Get("konto"),
	}, nil
}

// serienVorschau rechnet die Serie durch, ohne etwas anzulegen.
func (d *dienst) serienVorschau(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	wunsch, err := d.serienWunsch(r)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	tab, err := serie.Lies(http.MaxBytesReader(w, r.Body, 8<<20))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}

	// Ohne Zuordnung wird nur die Kopfzeile gemeldet: die Oberflaeche
	// braucht sie, um die Spaltenauswahl zu fuellen, bevor jemand ein
	// Muster eingeben kann.
	if wunsch.zuordnung.Muster == "" && wunsch.zuordnung.ZielSpalte == "" {
		d.jsonAus(w, http.StatusOK, map[string]any{
			"spalten": tab.Spalten, "zeilen": len(tab.Zeilen),
			"beispiel": beispielzeilen(tab, 5),
		})
		return
	}

	posten, err := tab.Umsetzen(wunsch.zuordnung)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}

	// Das Urteil haengt am laengsten Inhalt: der bestimmt die Version
	// und damit die Modulgroesse. Ein Bogen ist so druckreif wie sein
	// schlechtestes Stueck.
	var schlechteste *druck.Urteil
	var schlechtesteZeile int
	gut := 0
	var brMax, hoMax float64
	beschriftet := false
	for i := range posten {
		if posten[i].Fehler != "" {
			continue
		}
		inhalt, fehler := d.serienInhalt(posten[i], wunsch.anlegen, "")
		if fehler != "" {
			posten[i].Fehler = fehler
			continue
		}
		s, err := qr.Baue(inhalt, wunsch.stufe, 0)
		if err != nil {
			posten[i].Fehler = err.Error()
			continue
		}
		gut++
		// Das Mass kommt aus derselben Zeichnung, die spaeter gedruckt
		// wird — nicht aus einer Naeherung. Die Ruhezone ist Teil des
		// Stuecks, und bei 40 mm Code sind das noch einmal 12,8 mm.
		z := s.Formen(wunsch.gestalt)
		brMax = math.Max(brMax, z.BreiteMm)
		hoMax = math.Max(hoMax, z.HoeheMm)
		if posten[i].Name != "" {
			beschriftet = true
		}
		u := druck.Pruefe(druck.Vorgabe{
			BreiteMm: wunsch.gestalt.BreiteMm, ModuleJeKante: s.Kante,
			Fehlerkorrektur: wunsch.stufe.String(), Verfahren: wunsch.verfahren,
			RuhezoneModule: wunsch.gestalt.RuhezoneMod,
			Vordergrund:    wunsch.gestalt.Vordergrund, Hintergrund: wunsch.gestalt.Hintergrund,
			FuerKasse: posten[i].GTIN != "",
		})
		if schlechteste == nil || u.ModulMm < schlechteste.ModulMm {
			schlechteste, schlechtesteZeile = &u, posten[i].Nr
		}
	}

	fachBr, fachHo, _ := bogen.Fach(brMax, hoMax, beschriftet)
	auf, teilFehler := bogen.Teile(wunsch.plan, fachBr, fachHo, gut)

	antwort := map[string]any{
		"spalten": tab.Spalten, "zeilen": len(tab.Zeilen),
		"brauchbar": gut, "posten": posten,
		"doppelteZiele": serie.Doppelte(posten),
	}
	if teilFehler != nil {
		antwort["bogenFehler"] = teilFehler.Error()
	} else {
		antwort["bogen"] = map[string]any{
			"spalten": auf.Spalten, "reihen": auf.Reihen,
			"proBogen": auf.ProBogen, "anzahl": auf.Bogen,
			"blatt": wunsch.plan.Blatt.Name,
		}
	}
	if schlechteste != nil {
		antwort["urteil"] = map[string]any{
			"note": schlechteste.Note, "druckreif": schlechteste.Druckreif,
			"modulMm": schlechteste.ModulMm, "befunde": schlechteste.Befunde,
			"ausZeile": schlechtesteZeile,
		}
	}
	d.jsonAus(w, http.StatusOK, antwort)
}

func beispielzeilen(t *serie.Tabelle, n int) [][]string {
	if len(t.Zeilen) < n {
		n = len(t.Zeilen)
	}
	return t.Zeilen[:n]
}

// serienInhalt sagt, was in einem Code stehen soll. Bei einer GTIN ist
// das der Digital Link, sonst das Ziel selbst — oder, wenn angelegt
// wird, der eigene Kurzweg.
func (d *dienst) serienInhalt(p serie.Posten, angelegt bool, kuerzel string) (string, string) {
	if p.GTIN != "" {
		url, err := gs1.DigitalLink(gs1.Angaben{GTIN: p.GTIN}, d.host)
		if err != nil {
			return "", "GTIN: " + err.Error()
		}
		return url, ""
	}
	if angelegt {
		if kuerzel == "" {
			kuerzel = probeKuerzel
		}
		return strings.TrimRight(d.host, "/") + "/" + kuerzel, ""
	}
	return p.Ziel, ""
}

// probeKuerzel steht in der Vorschau anstelle des spaeteren Kuerzels.
//
// Es ist neun Zeichen lang und damit so lang, wie ein Kuerzel hoechstens
// wird: die Ablage faengt bei sechs an und geht auf neun hoch, wenn
// sechs vergeben sind. Die Vorschau muss den schlechteren Fall zeigen —
// ein Code, der nur mit dem kuerzeren Kuerzel druckreif waere, ist kein
// druckreifer Code.
//
// Und sie muss ueberhaupt mit einem Kuerzel rechnen: gedruckt wird bei
// angelegten Codes der Kurzweg, nicht das Ziel. Wer die Vorschau gegen
// das Ziel rechnet, misst eine Adresse, die nie in einem Code steht.
const probeKuerzel = "mmmmmmmmm"

// serienPaket legt die Serie an und liefert Bogen, Einzeldateien und
// Bericht als ZIP.
func (d *dienst) serienPaket(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	wunsch, err := d.serienWunsch(r)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	if wunsch.kontoID == "" {
		wunsch.kontoID = d.ablage.OrgVon(sch)
	}
	tab, err := serie.Lies(http.MaxBytesReader(w, r.Body, 8<<20))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	posten, err := tab.Umsetzen(wunsch.zuordnung)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}

	// Erst rechnen, dann schreiben. Passt der Bogen nicht, wird nichts
	// angelegt — sonst haette man Kuerzel verbraucht fuer einen Druck,
	// den es nie gab.
	var stuecke []bogen.Stueck
	type fertig struct {
		posten    serie.Posten
		kuerzel   string
		inhalt    string
		zeichnung qr.Zeichnung
		symbol    *qr.Symbol
		urteil    druck.Urteil
	}
	var alle []fertig

	for i := range posten {
		p := &posten[i]
		if p.Fehler != "" {
			continue
		}
		kuerzel := ""
		if wunsch.anlegen {
			code := &speicher.Code{
				Kuerzel: d.ablage.FreiesKuerzel(), KontoID: wunsch.kontoID,
				Name: oder(p.Name, p.Ziel), Ordner: p.Ordner, Ziel: p.Ziel,
				GTIN: p.GTIN, Aktiv: true, Herkunft: "serie",
			}
			if err := d.ablage.LegeAn(code); err != nil {
				p.Fehler = "nicht angelegt: " + err.Error()
				continue
			}
			kuerzel = code.Kuerzel
			_ = d.ablage.Protokolliere(speicher.Ereignis{
				KontoID: wunsch.kontoID, Wer: "serie", Was: "code.angelegt",
				Gegenstand: code.ID, Neu: p.Ziel,
			})
		}
		inhalt, fehler := d.serienInhalt(*p, wunsch.anlegen, kuerzel)
		if fehler != "" {
			p.Fehler = fehler
			continue
		}
		s, err := qr.Baue(inhalt, wunsch.stufe, 0)
		if err != nil {
			p.Fehler = err.Error()
			continue
		}
		z := s.Formen(wunsch.gestalt)
		u := druck.Pruefe(druck.Vorgabe{
			BreiteMm: wunsch.gestalt.BreiteMm, ModuleJeKante: s.Kante,
			Fehlerkorrektur: wunsch.stufe.String(), Verfahren: wunsch.verfahren,
			RuhezoneModule: wunsch.gestalt.RuhezoneMod,
			Vordergrund:    wunsch.gestalt.Vordergrund, Hintergrund: wunsch.gestalt.Hintergrund,
			FuerKasse: p.GTIN != "",
		})
		alle = append(alle, fertig{*p, kuerzel, inhalt, z, s, u})
		stuecke = append(stuecke, bogen.Stueck{Zeichnung: z, Text: p.Name})
	}

	if len(stuecke) == 0 {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{
			"fehler": "keine einzige Zeile liess sich umsetzen"})
		return
	}

	wunsch.plan.Fusszeile = fmt.Sprintf("pnkt.me · %d Stueck zu %.0f mm · %s · %s",
		len(stuecke), wunsch.gestalt.BreiteMm, wunsch.verfahren,
		time.Now().UTC().Format("2006-01-02"))
	blaetter, auf, err := bogen.Setze(wunsch.plan, stuecke)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(
		`attachment; filename="pnkt-serie-%s.zip"`, time.Now().UTC().Format("2006-01-02")))

	paket := zip.NewWriter(w)
	defer paket.Close()

	for i, blatt := range blaetter {
		name := fmt.Sprintf("bogen-%02d.pdf", i+1)
		if err := hineinlegen(paket, name, ausgabe.PDF(blatt,
			fmt.Sprintf("pnkt Bogen %d von %d", i+1, len(blaetter)))); err != nil {
			return
		}
	}

	for _, f := range alle {
		grund := "einzeln/" + dateiname(f.posten.Name, f.kuerzel, f.posten.Nr)
		if err := hineinlegen(paket, grund+".svg", []byte(f.symbol.SVG(wunsch.gestalt))); err != nil {
			return
		}
		if err := hineinlegen(paket, grund+".pdf",
			ausgabe.PDF(f.zeichnung, oder(f.posten.Name, f.kuerzel))); err != nil {
			return
		}
	}

	bericht := &strings.Builder{}
	schreiber := csv.NewWriter(bericht)
	_ = schreiber.Write([]string{"zeile", "name", "kuerzel", "ziel", "inhalt",
		"version", "modulMm", "note", "druckreif", "befunde", "fehler"})
	nach := map[int]fertig{}
	for _, f := range alle {
		nach[f.posten.Nr] = f
	}
	for _, p := range posten {
		f, da := nach[p.Nr]
		if !da {
			_ = schreiber.Write([]string{fmt.Sprint(p.Nr), p.Name, "", p.Ziel,
				"", "", "", "F", "nein", "", p.Fehler})
			continue
		}
		var texte []string
		for _, b := range f.urteil.Befunde {
			texte = append(texte, b.Schwere+": "+b.Text)
		}
		druckreif := "ja"
		if !f.urteil.Druckreif {
			druckreif = "nein"
		}
		_ = schreiber.Write([]string{
			fmt.Sprint(p.Nr), p.Name, f.kuerzel, p.Ziel, f.inhalt,
			fmt.Sprint(f.symbol.Version), fmt.Sprintf("%.3f", f.urteil.ModulMm),
			f.urteil.Note, druckreif, strings.Join(texte, " | "), "",
		})
	}
	// Doppelte Ziele stehen unten im Bericht und nicht nur in der
	// Vorschau: wer den Bogen aus einem Skript erzeugt, sieht die
	// Vorschau nie.
	for ziel, zeilen := range serie.Doppelte(posten) {
		var nummern []string
		for _, n := range zeilen {
			nummern = append(nummern, fmt.Sprint(n))
		}
		_ = schreiber.Write([]string{"", "", "", ziel, "", "", "", "", "", "",
			"dieses Ziel steht in den Zeilen " + strings.Join(nummern, ", ")})
	}
	schreiber.Flush()
	_ = hineinlegen(paket, "bericht.csv", []byte(bericht.String()))

	_ = hineinlegen(paket, "LIESMICH.txt", []byte(fmt.Sprintf(
		"pnkt.me — Serie vom %s\n\n"+
			"%d Stueck zu %.0f mm auf %s, %d je Bogen (%d × %d), %d Bogen.\n"+
			"Anschnitt %.0f mm, Schnittmarken in der Passerfarbe „All\".\n\n"+
			"bogen-*.pdf   ausgeschossen, zum Drucken und Schneiden\n"+
			"einzeln/      jedes Stueck fuer sich, SVG und PDF\n"+
			"bericht.csv   je Zeile Note, Modulgroesse und Befunde\n\n"+
			"Die Modulgroesse ist eine Druckentscheidung. Der Bogen verkleinert\n"+
			"kein Stueck, damit mehr daraufpasst — passen sie nicht, werden es\n"+
			"mehr Bogen.\n",
		time.Now().UTC().Format("2006-01-02"), len(stuecke), wunsch.gestalt.BreiteMm,
		wunsch.plan.Blatt.Name, auf.ProBogen, auf.Spalten, auf.Reihen, auf.Bogen,
		wunsch.plan.AnschnittMm)))
}
