package gestalt

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// erlaubterName ist die einzige Stelle, an der ein Name aus einer
// Anfrage in einen Dateizugriff geht. Sie bekommt deshalb einen Test
// mit den Formen, die man dort tatsaechlich versucht.
func TestErlaubterName(t *testing.T) {
	gut := []string{
		"figtree-400-latin.woff2",
		"caprasimo-400-latin-ext.woff2",
		"a.woff2",
	}
	for _, n := range gut {
		if !erlaubterName(n) {
			t.Errorf("%q sollte erlaubt sein", n)
		}
	}

	schlecht := []string{
		"",
		".woff2",
		"../LIZENZ.txt",
		"../../etc/passwd",
		"..%2fLIZENZ.txt.woff2", // Prozentzeichen bleibt draussen
		"LIZENZ.txt",
		"schrift/figtree-400-latin.woff2",
		"Figtree-400.woff2", // Grossbuchstaben nicht
		"figtree.woff2.woff2",
		"figtree-400-latin.woff",
		"figtree_400.woff2",
	}
	for _, n := range schlecht {
		if erlaubterName(n) {
			t.Errorf("%q haette abgelehnt werden muessen", n)
		}
	}
}

// Der Weg selbst muss dasselbe leisten wie die Pruefung — auch wenn
// jemand den Namen kodiert schickt.
func TestSchriftWeg(t *testing.T) {
	weg := http.NewServeMux()
	Wege(weg)

	faelle := []struct {
		ziel  string
		stand int
	}{
		{"/gestalt/schrift/figtree-400-latin.woff2", http.StatusOK},
		{"/gestalt/schrift/caprasimo-400-latin.woff2", http.StatusOK},
		{"/gestalt/schrift/LIZENZ.txt", http.StatusNotFound},
		{"/gestalt/schrift/..%2fLIZENZ.txt", http.StatusNotFound},
		{"/gestalt/schrift/gibtsnicht.woff2", http.StatusNotFound},
		{"/gestalt/organic.css", http.StatusOK},
	}
	for _, f := range faelle {
		w := httptest.NewRecorder()
		weg.ServeHTTP(w, httptest.NewRequest(http.MethodGet, f.ziel, nil))
		if w.Code != f.stand {
			t.Errorf("%s: %d statt %d", f.ziel, w.Code, f.stand)
		}
	}
}

// Die Tokenschicht traegt die Farben des Systems. Faellt eine davon
// heraus, sieht man es auf jeder Seite gleichzeitig — deshalb hier.
func TestTokenschicht(t *testing.T) {
	fuer := []string{
		"--color-bg: #f5ead8", "--color-surface: #ebddc5",
		"--color-text: #201e1d", "--color-accent: #c67139",
		"--font-heading", "--font-body",
		".tafel", ".spur", ".werkkopf", ".marke-lockup",
		"prefers-reduced-motion",
	}
	for _, s := range fuer {
		if !strings.Contains(OrganicCSS, s) {
			t.Errorf("Tokenschicht ohne %q", s)
		}
	}
	// Keine Adresse nach draussen: die Regel des Projekts, hier
	// nachpruefbar statt nur aufgeschrieben.
	for _, verboten := range []string{"http://", "https://", "//fonts."} {
		if strings.Contains(OrganicCSS, verboten) {
			t.Errorf("Tokenschicht laedt von draussen: %q", verboten)
		}
	}
}

func TestIcon(t *testing.T) {
	if Icon("gibtsnicht", 18) != "" {
		t.Error("unbekanntes Zeichen sollte nichts ergeben")
	}
	for _, name := range []string{"punkt", "scannen", "code", "strecke", "etikett",
		"bogen", "kamera", "zahlen", "glocke", "team", "geprueft", "weiter",
		"zeitregel", "variante", "warnung"} {
		s := Icon(name, 24)
		if !strings.HasPrefix(s, "<svg") || !strings.Contains(s, `viewBox="0 0 24 24"`) {
			t.Errorf("%s: kein brauchbares SVG: %q", name, s)
		}
		if !strings.Contains(s, `aria-hidden="true"`) {
			t.Errorf("%s: Zeichen ohne aria-hidden liest der Screenreader mit", name)
		}
	}
	if n := len(zeichen); n != 15 {
		t.Errorf("%d Zeichen — der Satz hat vierzehn plus warnung", n)
	}
}

func TestMarkeSVG(t *testing.T) {
	s := MarkeSVG("#c67139", "#f5ead8")
	for _, teil := range []string{"<svg", "#c67139", "#f5ead8", `viewBox="0 0 32 32"`} {
		if !strings.Contains(s, teil) {
			t.Errorf("Zeichen ohne %q", teil)
		}
	}
}

func TestKopf(t *testing.T) {
	k := Kopf()
	for _, teil := range []string{"/gestalt/organic.css", "/marke.svg",
		"caprasimo-400-latin.woff2", "figtree-400-latin.woff2", "crossorigin"} {
		if !strings.Contains(k, teil) {
			t.Errorf("Kopf ohne %q", teil)
		}
	}
}
