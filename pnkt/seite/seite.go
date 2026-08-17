// Package seite zeichnet die kleine Landeseite hinter einem Code.
//
// Sie ist das Gegenteil dessen, was heute hinter den meisten Codes
// steht: kein Nachladen, kein Banner, keine Schriftart von einem fremden
// Server, kein Zaehlpixel. Was ankommt, ist ein Dokument aus einem
// Stueck — der erste Bildschirm ist der fertige Bildschirm.
//
// Das ist auch eine Rechnung: wer vor einem Aufsteller steht, laedt
// ueber Mobilfunk. Eine Seite, die drei weitere Dateien holt, braucht
// drei weitere Umlaeufe, und bei 300 ms Umlaufzeit ist das die Sekunde,
// nach der die Haelfte wieder weglegt.
//
// Gezeichnet wird mit html/template und nicht mit fmt.Fprintf. Hier
// kommt zum ersten Mal fremder Text in die Ausgabe — Speisekarten,
// Preise, Anmerkungen, die jemand eingetippt hat. html/template kennt
// den Unterschied zwischen Text, Attribut und Adresse und maskiert
// jeweils richtig; von Hand wird das frueher oder spaeter falsch.
package seite

import (
	"bytes"
	"html/template"
	"strings"

	"pnkt.me/pnkt/gestalt"
	"pnkt.me/pnkt/speicher"
)

// Ansicht ist alles, was die Vorlage braucht.
type Ansicht struct {
	Seite  *speicher.Seite
	Marke  *speicher.Marke
	Weiter string // Adresse des Knopfes, ueber die gezaehlt wird
	Kopf   template.HTML
	Lockup template.HTML
}

// Zeichne schreibt die Seite.
func Zeichne(s *speicher.Seite, m *speicher.Marke, weiter string) ([]byte, error) {
	a := Ansicht{
		Seite: s, Marke: m, Weiter: weiter,
		Kopf:   template.HTML(gestalt.Kopf()),
		Lockup: template.HTML(gestalt.MarkeLockup(m.Name, "", false)),
	}
	var b bytes.Buffer
	if err := vorlage.Execute(&b, a); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

var hilfen = template.FuncMap{
	// istKarte und Geschwister entscheiden ueber die Anordnung einer
	// Zeile: bei einer Karte steht der Preis rechts und bricht nicht um,
	// bei einem Programm die Uhrzeit links und in gleicher Breite,
	// damit die Spalte steht.
	"istKarte":  func(v string) bool { return v == "karte" },
	"istPlan":   func(v string) bool { return v == "veranstaltung" },
	"istWeg":    func(v string) bool { return v == "verweise" },
	"absaetze":  absaetze,
	"nichtLeer": func(s string) bool { return strings.TrimSpace(s) != "" },
}

// absaetze zerlegt einen Text an Leerzeilen. Zeilenumbrueche einfach
// stehen zu lassen waere falsch: im Eingabefeld bricht der Text dort um,
// wo das Feld endet, nicht dort, wo ein Absatz endet.
func absaetze(text string) []string {
	var aus []string
	for _, teil := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n\n") {
		teil = strings.TrimSpace(teil)
		if teil != "" {
			aus = append(aus, teil)
		}
	}
	return aus
}

var vorlage = template.Must(template.New("seite").Funcs(hilfen).Parse(`<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{.Seite.Titel}}</title>
{{.Kopf}}
<style>
:root{--color-bg:{{.Marke.Grund}};--color-text:{{.Marke.Tinte}};--color-accent:{{.Marke.Primaer}};
 --leise:color-mix(in srgb,var(--color-text) 62%,transparent);
 --linie:color-mix(in srgb,var(--color-text) 12%,transparent)}
body{background:var(--color-bg);color:var(--color-text);
 font-family:var(--font-body);font-size:17px;line-height:1.5}
/* 34 rem ist die Breite einer Spalte, die auf dem Telefon voll und auf
   dem Rechner nicht laecherlich breit ist. Eine Landeseite wird zu neun
   Zehnteln stehend gelesen. */
.blatt{max-width:34rem;margin:0 auto;padding:2rem 1.25rem 3.5rem}
h1{font-family:var(--font-heading);font-size:2rem;line-height:1.12;
 letter-spacing:-.02em;margin:0}
@media(max-width:400px){h1{font-size:1.65rem}}
.unter{color:var(--leise);margin:.5rem 0 0;font-size:1.02rem}
.block{background:var(--color-surface);border-radius:calc(var(--radius-lg) * 1.15);
 padding:1.15rem 1.25rem;margin-top:1.1rem}
.block h2{font-family:var(--font-heading);font-size:1.15rem;margin:0 0 .7rem;
 letter-spacing:-.01em}
.block p{margin:0 0 .7rem}
.block p:last-child{margin-bottom:0}
.zeile{display:flex;gap:1rem;align-items:baseline;padding:.5rem 0;
 border-bottom:1px solid var(--linie)}
.zeile:last-child{border-bottom:none;padding-bottom:0}
.zeile:first-of-type{padding-top:0}
.was{flex:1;min-width:0}
.dazu{display:block;color:var(--leise);font-size:.88rem;margin-top:.1rem}
.neben{white-space:nowrap;font-variant-numeric:tabular-nums;font-weight:600}
/* Beim Programm steht die Uhrzeit vorn und in fester Breite: eine
   Spalte, die springt, liest sich nicht als Spalte. */
.plan .neben{order:-1;flex:none;width:4.2rem;color:var(--color-accent-700);font-weight:700}
.weg{display:flex;flex-direction:column;gap:.5rem}
.weg a{display:flex;justify-content:space-between;align-items:center;gap:.8rem;
 text-decoration:none;color:var(--color-text);background:var(--color-bg);
 border-radius:var(--radius-md);padding:.85rem 1rem;font-weight:600}
.weg a:hover{color:var(--color-accent-700)}
.weg .pfeil{color:var(--color-accent);flex:none}
/* Der Knopf ist mindestens 48 px hoch. Darunter trifft ihn niemand
   zuverlaessig mit dem Daumen, und getroffen werden ist sein ganzer
   Zweck. */
.tun{display:block;margin-top:1.4rem;background:var(--color-accent);color:var(--color-bg);
 text-decoration:none;text-align:center;font-weight:700;font-size:1.05rem;
 padding:1rem 1.25rem;border-radius:999px;min-height:48px;box-sizing:border-box}
.tun:hover{background:var(--color-accent-600)}
.fuss{margin-top:2rem;padding-top:1.1rem;border-top:1px solid var(--linie);
 color:var(--leise);font-size:.85rem;display:flex;flex-wrap:wrap;gap:.6rem 1rem;
 align-items:center;justify-content:space-between}
.fuss .marke-lockup{font-size:.85rem}
.fuss .marke-zeichen{width:20px;height:20px}
.fuss .marke-punkt{width:6px;height:6px}
.fuss .marke-wort{font-size:15px}
</style>
<div class="blatt">
  <h1>{{.Seite.Titel}}</h1>
  {{if nichtLeer .Seite.Unter}}<p class="unter">{{.Seite.Unter}}</p>{{end}}

  {{range .Seite.Bloecke}}
  <section class="block{{if istPlan $.Seite.Vorlage}} plan{{end}}">
    {{if nichtLeer .Titel}}<h2>{{.Titel}}</h2>{{end}}
    {{range absaetze .Text}}<p>{{.}}</p>{{end}}
    {{if istWeg $.Seite.Vorlage}}
      <div class="weg">
      {{range .Zeilen}}
        <a href="{{.Ziel}}" rel="noopener nofollow">
          <span class="was">{{.Was}}{{if nichtLeer .Dazu}}<span class="dazu">{{.Dazu}}</span>{{end}}</span>
          <span class="pfeil" aria-hidden="true">→</span>
        </a>
      {{end}}
      </div>
    {{else}}
      {{range .Zeilen}}
      <div class="zeile">
        <span class="was">{{.Was}}{{if nichtLeer .Dazu}}<span class="dazu">{{.Dazu}}</span>{{end}}</span>
        {{if nichtLeer .Neben}}<span class="neben">{{.Neben}}</span>{{end}}
      </div>
      {{end}}
    {{end}}
  </section>
  {{end}}

  {{if .Seite.Handlung}}
  <a class="tun" href="{{.Weiter}}" rel="noopener">{{.Seite.Handlung.Text}}</a>
  {{end}}

  <div class="fuss">
    <span>{{if nichtLeer .Seite.Fuss}}{{.Seite.Fuss}}{{end}}</span>
    <span>{{.Lockup}}</span>
  </div>
</div>
`))
