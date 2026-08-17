package main

import (
	"encoding/json"
	"fmt"
	"html"
	"net/http"
	"strings"

	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/pass"
	"pnkt.me/pnkt/speicher"
)

// Der Produktpass ist die Seite hinter dem Code. Sie ist der Grund,
// warum die ESPR ueberhaupt einen Datentraeger verlangt — der QR-Code
// selbst ist der billige Teil.
//
// Zwei Dinge entscheiden ueber die Bauart dieser Seite:
//
// Sie wird von jemandem gelesen, der im Laden steht oder das Geraet in
// der Hand haelt. Also: kein Nachladen, keine fremde Schrift, kein
// Skript, das erst etwas holen muss. Alles steht im ersten Byte.
//
// Und sie ist ein Rechtsdokument mit Fassung und Datum. Deshalb steht der
// Stand oben, nicht im Kleingedruckten.

// passseite bedient GET /p/{gtin} und /p/{gtin}/{charge}.
func (d *dienst) passseite(w http.ResponseWriter, r *http.Request) {
	gtin, err := gs1.PruefeGTIN(r.PathValue("gtin"))
	if err != nil {
		d.hinweisMitMarke(w, r, http.StatusBadRequest, "Keine gültige GTIN", err.Error())
		return
	}
	p, da := d.ablage.Produktpass(gtin, r.PathValue("charge"), r.URL.Query().Get("serie"))
	if !da {
		d.hinweisMitMarke(w, r, http.StatusNotFound, "Kein Produktpass",
			"Zu diesem Artikel ist hier kein Produktpass hinterlegt.")
		return
	}

	// Beschraenkte Angaben nur mit gueltigem Schluessel — und nur dem
	// Inhaber der Daten. Marktaufsicht, Reparaturbetrieb und Verwerter
	// bekommen einen Schluessel, das Publikum nicht.
	sichtbar := p.Oeffentlich()
	vollstaendig := false
	if sch, err := d.ablage.PruefeSchluessel(strings.TrimSpace(r.Header.Get(kopfSchluessel))); err == nil {
		if p.KontoID == "" || d.ablage.OrgVon(sch) == p.KontoID {
			sichtbar, vollstaendig = p, true
		}
	}

	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		d.jsonAus(w, http.StatusOK, sichtbar)
		return
	}

	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = w.Write([]byte(passHTML(sichtbar, p, m, vollstaendig)))
}

// digitalLinkPass ist der Weg, den ein GS1-Code wirklich nimmt. Ist zu
// der GTIN ein Ziel hinterlegt, gilt das Ziel; sonst der Pass. So bleibt
// die bisherige Weiterleitung, und der Pass springt nur ein, wo nichts
// anderes steht.
func (d *dienst) digitalLinkOderPass(w http.ResponseWriter, r *http.Request) {
	gtin, err := gs1.PruefeGTIN(r.PathValue("gtin"))
	if err == nil {
		if _, da := d.ablage.Produktpass(gtin, "", ""); da && d.zielZurGTIN(gtin, r) == "" {
			d.passseite(w, r)
			return
		}
	}
	d.digitalLink(w, r)
}

func (d *dienst) zielZurGTIN(gtin14 string, r *http.Request) string {
	for _, c := range d.ablage.Liste("") {
		if c.GTIN == "" {
			continue
		}
		if geprueft, err := gs1.PruefeGTIN(c.GTIN); err == nil && geprueft == gtin14 {
			return waehleZiel(c, r, d.landkopf)
		}
	}
	return ""
}

// --- Schnittstelle --------------------------------------------------------

func (d *dienst) passListe(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	d.jsonAus(w, http.StatusOK, d.ablage.ProduktpassListe(d.ablage.OrgVon(sch)))
}

func (d *dienst) passSetzen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	var p speicher.Produktpass
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&p); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}

	// Die GTIN wird beim Eintragen normiert. Sonst liegt derselbe Artikel
	// unter 13 und unter 14 Stellen zweimal in der Ablage, und der
	// Datentraeger findet die falsche Haelfte.
	gtin14, err := gs1.PruefeGTIN(p.GTIN)
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	p.GTIN = gtin14
	p.KontoID = d.ablage.OrgVon(sch)

	urteil := pass.Pruefe(&p)
	if !urteil.Tragfaehig {
		d.jsonAus(w, http.StatusBadRequest, map[string]any{
			"fehler": "der Pass hat Fehler und wird nicht veroeffentlicht",
			"urteil": urteil,
		})
		return
	}
	if err := d.ablage.SetzeProduktpass(&p); err != nil {
		d.jsonAus(w, http.StatusConflict, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: p.KontoID, Wer: "schnittstelle", Was: "pass.gesetzt",
		Gegenstand: p.ID, Neu: p.GTIN + " Fassung " + fmt.Sprint(p.Fassung),
	})
	d.jsonAus(w, http.StatusOK, map[string]any{"pass": p, "urteil": urteil})
}

// passPruefen misst einen Pass, ohne ihn zu speichern. Wer eine
// Produktreihe vorbereitet, will das Urteil sehen, bevor etwas online geht.
func (d *dienst) passPruefen(w http.ResponseWriter, r *http.Request) {
	var p speicher.Produktpass
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&p); err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	d.jsonAus(w, http.StatusOK, pass.Pruefe(&p))
}

func (d *dienst) passZurueckziehen(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	if !speicher.DarfVerwalten(d.ablage.RolleVon(sch)) {
		d.jsonAus(w, http.StatusForbidden, map[string]string{
			"fehler": "einen Pass zieht der Inhaber zurueck"})
		return
	}
	gtin14, err := gs1.PruefeGTIN(r.PathValue("gtin"))
	if err != nil {
		d.jsonAus(w, http.StatusBadRequest, map[string]string{"fehler": err.Error()})
		return
	}
	p, da := d.ablage.Produktpass(gtin14, r.URL.Query().Get("charge"), r.URL.Query().Get("serie"))
	if !da || p.KontoID != d.ablage.OrgVon(sch) {
		d.jsonAus(w, http.StatusNotFound, map[string]string{"fehler": "kein Pass zu diesem Artikel"})
		return
	}
	if err := d.ablage.ZiehePassZurueck(p.GTIN, p.Charge, p.Serie); err != nil {
		d.jsonAus(w, http.StatusConflict, map[string]string{"fehler": err.Error()})
		return
	}
	_ = d.ablage.Protokolliere(speicher.Ereignis{
		KontoID: p.KontoID, Wer: "schnittstelle", Was: "pass.zurueckgezogen",
		Gegenstand: p.ID, Alt: p.GTIN,
	})
	d.jsonAus(w, http.StatusOK, map[string]string{"zustand": "zurueckgezogen"})
}

// --- Die Seite -----------------------------------------------------------

func passHTML(zeig, ganz *speicher.Produktpass, m *speicher.Marke, vollstaendig bool) string {
	e := html.EscapeString
	var s strings.Builder

	logo := ""
	if m.LogoSVG != "" {
		logo = `<div class="logo">` + m.LogoSVG + `</div>`
	}

	fmt.Fprintf(&s, `<!doctype html>
<html lang="%s"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s · Produktpass</title>
<style>
:root{--grund:%s;--tinte:%s;--primaer:%s;--flaeche:#fff;--linie:#dcdee3;--leise:#5b6070}
@media(prefers-color-scheme:dark){:root{--flaeche:#191a1f;--linie:#2f3138;--leise:#9aa0ae}}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--tinte);
 font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:44rem;margin:0 auto;padding:clamp(1rem,4vw,2.5rem)}
.logo{max-width:8rem;margin-bottom:1rem}.logo svg{width:100%%;height:auto}
.marke{font-size:.7rem;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--primaer)}
h1{font-size:1.6rem;margin:.3rem 0 .2rem;letter-spacing:-.02em}
.unter{color:var(--leise);margin:0 0 .3rem}
.stand{color:var(--leise);font-size:.8rem;margin:0 0 1.6rem}
section{background:var(--flaeche);border:1px solid var(--linie);border-radius:12px;
 padding:1rem 1.1rem;margin-bottom:.9rem}
h2{font-size:.7rem;font-weight:700;letter-spacing:.11em;text-transform:uppercase;
 color:var(--leise);margin:0 0 .7rem}
dl{margin:0;display:grid;grid-template-columns:minmax(8rem,auto) 1fr;gap:.35rem .9rem}
dt{color:var(--leise);font-size:.85rem}
dd{margin:0;overflow-wrap:anywhere}
p.text{margin:0;white-space:pre-line}
table{width:100%%;border-collapse:collapse;font-size:.9rem}
th{text-align:left;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;
 color:var(--leise);font-weight:700;padding:.3rem .5rem .3rem 0}
td{padding:.3rem .5rem .3rem 0;border-top:1px solid var(--linie)}
td.zahl{text-align:right;font-variant-numeric:tabular-nums}
.svhc{color:#a82e23;font-weight:600}
ul{margin:0;padding-left:1.1rem}li{margin:.15rem 0}
a{color:var(--primaer)}
.zurueck{background:#f7e7e5;color:#a82e23;border:1px solid #a82e23;padding:.7rem .9rem;
 border-radius:10px;margin-bottom:1rem;font-size:.9rem}
@media(prefers-color-scheme:dark){.zurueck{background:#33201d;color:#f0705c}}
footer{color:var(--leise);font-size:.78rem;margin-top:1.4rem}
footer a{color:inherit}
</style>
<main>%s<div class="marke">%s</div>
<h1>%s</h1>`,
		e(oder(zeig.Sprache, "de")), e(zeig.Bezeichnung), m.Grund, m.Tinte, m.Primaer,
		logo, e(m.Name), e(zeig.Bezeichnung))

	if zeig.Modell != "" {
		fmt.Fprintf(&s, `<p class="unter">%s</p>`, e(zeig.Modell))
	}
	fmt.Fprintf(&s, `<p class="stand">Produktpass · Fassung %d · Stand %s</p>`,
		zeig.Fassung, zeig.Geaendert.Format("02.01.2006"))

	if zeig.Beschreibung != "" {
		fmt.Fprintf(&s, `<section><h2>Was das ist</h2><p class="text">%s</p></section>`,
			e(zeig.Beschreibung))
	}

	// Identitaet
	s.WriteString(`<section><h2>Artikel</h2><dl>`)
	zeile(&s, "GTIN", zeig.GTIN)
	zeile(&s, "Charge", zeig.Charge)
	zeile(&s, "Seriennummer", zeig.Serie)
	zeile(&s, "Herstelldatum", zeig.Herstelldatum)
	zeile(&s, "Ursprungsland", zeig.Ursprungsland)
	s.WriteString(`</dl></section>`)

	// Verantwortlicher
	if zeig.Hersteller != "" || zeig.HerstellerAnschrift != "" {
		s.WriteString(`<section><h2>Verantwortlich</h2><dl>`)
		zeile(&s, "Hersteller", zeig.Hersteller)
		zeile(&s, "Anschrift", zeig.HerstellerAnschrift)
		zeile(&s, "Kennung", zeig.HerstellerKennung)
		s.WriteString(`</dl></section>`)
	}

	// Stoffe
	if len(zeig.Stoffe) > 0 {
		s.WriteString(`<section><h2>Woraus es besteht</h2><table><thead><tr>` +
			`<th>Stoff</th><th>Anteil</th><th>davon Rezyklat</th></tr></thead><tbody>`)
		for _, st := range zeig.Stoffe {
			name := e(st.Name)
			if st.Besorgnis {
				name += ` <span class="svhc">besorgniserregend</span>`
				if st.CASNummer != "" {
					name += ` <span class="svhc">CAS ` + e(st.CASNummer) + `</span>`
				}
			}
			fmt.Fprintf(&s, `<tr><td>%s</td><td class="zahl">%s</td><td class="zahl">%s</td></tr>`,
				name, prozent(st.AnteilPro), prozent(st.Rezykliert))
		}
		s.WriteString(`</tbody></table></section>`)
	}

	// Weitere Angaben
	if len(zeig.Angaben) > 0 {
		s.WriteString(`<section><h2>Weitere Angaben</h2><dl>`)
		for _, a := range zeig.Angaben {
			wert := a.Wert
			if a.Einheit != "" {
				wert += " " + a.Einheit
			}
			zeile(&s, a.Feld, wert)
		}
		s.WriteString(`</dl></section>`)
	}

	// Nutzung und Ende
	if zeig.Pflege != "" || zeig.Reparatur != "" || zeig.Ersatzteile != "" {
		s.WriteString(`<section><h2>Gebrauch und Reparatur</h2><dl>`)
		zeile(&s, "Pflege", zeig.Pflege)
		zeile(&s, "Reparatur", zeig.Reparatur)
		zeile(&s, "Ersatzteile", zeig.Ersatzteile)
		s.WriteString(`</dl></section>`)
	}
	if zeig.Ruecknahme != "" || zeig.Entsorgung != "" {
		s.WriteString(`<section><h2>Wenn es zu Ende ist</h2><dl>`)
		zeile(&s, "Rücknahme", zeig.Ruecknahme)
		zeile(&s, "Entsorgung", zeig.Entsorgung)
		s.WriteString(`</dl></section>`)
	}

	// Belege
	if len(zeig.Belege) > 0 {
		s.WriteString(`<section><h2>Belege</h2><ul>`)
		for _, b := range zeig.Belege {
			titel := b.Titel
			if titel == "" {
				titel = b.URL
			}
			fmt.Fprintf(&s, `<li><a href="%s" rel="noopener noreferrer">%s</a></li>`,
				e(b.URL), e(titel))
		}
		s.WriteString(`</ul></section>`)
	}

	// Dass etwas zurueckgehalten wird, ist selbst keine Geheimsache. Wer
	// es braucht, weiss dann, dass es sich zu fragen lohnt.
	if !vollstaendig {
		if n := ganz.Beschraenkte(); n > 0 {
			fmt.Fprintf(&s, `<footer>%d weitere Angaben sind Marktaufsicht, `+
				`Reparaturbetrieben und Verwertern vorbehalten und hier nicht zu sehen.</footer>`, n)
		}
	}

	fuss := ""
	if m.Impressum != "" {
		fuss += `<a href="` + e(m.Impressum) + `">Impressum</a> `
	}
	if m.Datenschutz != "" {
		fuss += `<a href="` + e(m.Datenschutz) + `">Datenschutz</a>`
	}
	if fuss != "" {
		fmt.Fprintf(&s, `<footer>%s</footer>`, fuss)
	}

	s.WriteString(`</main></html>`)
	return s.String()
}

func zeile(s *strings.Builder, name, wert string) {
	if strings.TrimSpace(wert) == "" {
		return
	}
	fmt.Fprintf(s, `<dt>%s</dt><dd>%s</dd>`, html.EscapeString(name), html.EscapeString(wert))
}

func prozent(wert float64) string {
	if wert <= 0 {
		return "—"
	}
	return strings.Replace(fmt.Sprintf("%.1f %%", wert), ".", ",", 1)
}
