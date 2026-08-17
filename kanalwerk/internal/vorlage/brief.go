package vorlage

import (
	"bytes"
	"html/template"
	"strings"
)

// KanalRundbrief ist der Name des Kanals, über den E-Mail läuft.
// Er steht neben FACEBOOK und INSTAGRAM, damit ein Beitrag Social und
// Newsletter aus derselben Freigabe bedienen kann.
const KanalRundbrief = "NEWSLETTER"

// Abmeldeplatzhalter ist die Zeichenfolge, die Wix vor dem Versand durch
// den echten Abmeldelink ersetzt. Ohne sie darf keine Werbemail raus.
//
// Bewusst in Form einer Adresse: html/template normalisiert alles, was in
// einem href steht, und hätte aus einer Marke wie {{ABMELDELINK}} ein
// prozentkodiertes %7b%7b… gemacht — das hätte Wix nie wiedergefunden.
// Die Endung .invalid führt garantiert ins Leere, falls die Ersetzung
// einmal ausbleibt.
const Abmeldeplatzhalter = "https://abmelden.kanalwerk.invalid/"

// briefVorlage ist bewusst Tabellen-HTML mit Formatierung an den Elementen.
// E-Mail-Programme sind bei Stilblöcken und neuerem Satz unzuverlässig;
// was im Browser gut aussieht, zerfällt in Outlook.
var briefVorlage = template.Must(template.New("brief").Parse(`<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{.Betreff}}</title></head>
<body style="margin:0;padding:0;background:#F3EFE6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background:#F3EFE6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="max-width:560px;background:{{.Grund}};border-radius:10px;overflow:hidden;">

  {{if .BildURL}}
  <tr><td style="padding:0;">
    <img src="{{.BildURL}}" alt="" width="560"
         style="display:block;width:100%;max-width:560px;height:auto;border:0;">
  </td></tr>
  {{end}}

  <tr><td style="padding:28px 28px 8px 28px;">
    {{if .Kick}}
    <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
              font-weight:bold;letter-spacing:3px;text-transform:uppercase;
              color:{{.Akzent}};">{{.Kick}}</p>
    {{end}}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:{{.Zweitakzent}};width:48px;height:6px;
                     font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
    <h1 style="margin:16px 0 0 0;font-family:Arial Black,Arial,Helvetica,sans-serif;
               font-size:28px;line-height:1.1;text-transform:uppercase;
               color:{{.Schriftfarbe}};">{{.Titel}}</h1>
  </td></tr>

  {{if .Absaetze}}
  <tr><td style="padding:12px 28px 24px 28px;">
    {{range .Absaetze}}
    <p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;
              line-height:1.55;color:{{$.Schriftfarbe}};">{{.}}</p>
    {{end}}
  </td></tr>
  {{end}}

  <tr><td style="padding:0 28px 28px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:{{.Zweitakzent}};width:100%;height:2px;
                     font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>
    <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;
              line-height:1.6;color:{{.Schriftfarbe}};opacity:.75;">
      {{.Absender}}<br>
      <a href="{{.Abmelde}}" style="color:{{.Akzent}};">Newsletter abbestellen</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body></html>`))

type briefdaten struct {
	Betreff      string
	Kick         string
	Titel        string
	Absaetze     []string
	BildURL      string
	Absender     string
	Abmelde      template.URL
	Grund        string
	Schriftfarbe string
	Akzent       string
	Zweitakzent  string
}

// Brief setzt den Rundbrief als HTML.
//
// Die Werte werden von html/template maskiert — ein Kunde, der spitze
// Klammern eintippt, bekommt spitze Klammern und keine Schadwirkung.
func (v Vorlage) Brief(werte map[string]string, bildURL, absender string) (betreff, inhalt string) {
	hol := func(n string) string { return strings.TrimSpace(werte[n]) }

	titel := hol("titel")
	if titel == "" {
		titel = v.Name
	}

	// Alles außer kick, titel und bild wird zum Fließtext des Briefs.
	var absaetze []string
	for _, f := range v.Felder {
		if f.Name == "kick" || f.Name == "titel" {
			continue
		}
		if w := hol(f.Name); w != "" {
			for _, teil := range strings.Split(w, "\n") {
				if teil = strings.TrimSpace(teil); teil != "" {
					absaetze = append(absaetze, teil)
				}
			}
		}
	}

	d := briefdaten{
		Betreff:      titel,
		Kick:         hol("kick"),
		Titel:        titel,
		Absaetze:     absaetze,
		BildURL:      bildURL,
		Absender:     absender,
		Abmelde:      template.URL(Abmeldeplatzhalter),
		Grund:        oder(v.Marke.Grund, "#000000"),
		Schriftfarbe: oder(v.Marke.Schriftfarbe, "#FFFFFF"),
		Akzent:       oder(v.Marke.Akzent, "#9BBE00"),
		Zweitakzent:  oder(v.Marke.Zweitakzent, "#D8063A"),
	}

	var puffer bytes.Buffer
	if err := briefVorlage.Execute(&puffer, d); err != nil {
		// Kann nur bei einer kaputten Vorlage passieren; dann lieber
		// schlichter Text als gar nichts.
		return titel, "<p>" + template.HTMLEscapeString(v.Setze("standard", werte)) + "</p>"
	}
	return titel, puffer.String()
}

func oder(a, b string) string {
	if strings.TrimSpace(a) == "" {
		return b
	}
	return a
}
