// Package gestalt traegt das Erscheinungsbild von pnkt.me: die
// Tokenschicht des Organic-Systems, die Schriften und den Icon-Satz.
//
// Alles liegt im Binaer. Das ist keine Sparsamkeit, sondern dieselbe
// Regel wie beim Rest: ein Programm, ein Verzeichnis, nichts von
// draussen. Eine Seite, die ihre Schriften von einem fremden Server
// holt, funktioniert nicht mehr, sobald jemand anderes einen Fehler hat
// — und sie schickt die Adresse jedes Besuchers dorthin.
//
// Bei pnkt kommt ein zweiter Grund dazu: Im Fuss der Marketingseite
// steht „EU-Hosting, keine Tracking-Cookies". Wer das schreibt und die
// Schriften bei Google holt, hat eine der beiden Aussagen falsch. Das
// Landgericht Muenchen I hat dafuer im Januar 2022 Schadenersatz
// zugesprochen (3 O 17493/20).
//
// Caprasimo und Figtree stehen unter der SIL Open Font License; das
// Mitliefern ist ausdruecklich erlaubt, die Lizenz liegt daneben.
package gestalt

import (
	"embed"
	"net/http"
	"strings"
)

//go:embed schrift
var dateien embed.FS

// Wege haengt die Gestaltdateien an einen Verteiler: die Tokenschicht
// unter /gestalt/organic.css, die Schriften unter /gestalt/schrift/.
func Wege(weg *http.ServeMux) {
	weg.HandleFunc("GET /gestalt/organic.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		// Ein Jahr: der Inhalt aendert sich nur mit dem Binaer, und dann
		// aendert sich auch der Pfad nicht — deshalb kein unveraenderlich.
		w.Header().Set("Cache-Control", "public, max-age=3600")
		_, _ = w.Write([]byte(OrganicCSS))
	})

	weg.HandleFunc("GET /gestalt/schrift/{datei}", func(w http.ResponseWriter, r *http.Request) {
		name := r.PathValue("datei")
		// Kein Name aus der Anfrage geht ungeprueft in einen
		// Dateizugriff. Erlaubt sind Kleinbuchstaben, Ziffern und
		// Bindestrich, dann genau ".woff2" — kein Punkt, kein
		// Schraegstrich, kein Rueckwaerts.
		if !erlaubterName(name) {
			http.NotFound(w, r)
			return
		}
		roh, err := dateien.ReadFile("schrift/" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "font/woff2")
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		_, _ = w.Write(roh)
	})
}

func erlaubterName(name string) bool {
	stamm, gut := strings.CutSuffix(name, ".woff2")
	if !gut || stamm == "" {
		return false
	}
	for _, z := range stamm {
		if (z < 'a' || z > 'z') && (z < '0' || z > '9') && z != '-' {
			return false
		}
	}
	return true
}

// Kopf liefert die Zeilen, die jede Seite im <head> braucht: die
// Tokenschicht und die beiden Schnitte, die im ersten Bild stehen.
func Kopf() string {
	return `<link rel="icon" href="/marke.svg" type="image/svg+xml">
<link rel="stylesheet" href="/gestalt/organic.css">
<link rel="preload" href="/gestalt/schrift/caprasimo-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/gestalt/schrift/figtree-400-latin.woff2" as="font" type="font/woff2" crossorigin>`
}
