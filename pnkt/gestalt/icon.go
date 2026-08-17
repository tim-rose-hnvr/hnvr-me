package gestalt

import "fmt"

// Der Icon-Satz aus dem Handoff: vierzehn Zeichen, 24×24, nur Kreise,
// gerundete Rechtecke, Linien und Polylinien.
//
// Zwei Regeln stehen hier im Code und nicht nur im Dokument: keine
// gefuellte Flaeche ausser `punkt`, und nie zwei Glyphen zusammengesetzt
// — ein Zeichen plus ein Wort.
//
// Die Strichstaerke 2,75 ist Teil des Systems und waechst nicht mit der
// Groesse mit: bei 16 px wirkt der Strich dadurch kraeftiger, und genau
// das ist gewollt.
var zeichen = map[string]string{
	"punkt":     `<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>`,
	"scannen":   `<polyline points="3,8 3,4.5 7,4.5"/><polyline points="17,4.5 21,4.5 21,8"/><polyline points="21,16 21,19.5 17,19.5"/><polyline points="7,19.5 3,19.5 3,16"/>`,
	"code":      `<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="3.5"/><circle cx="17" cy="17" r="2"/>`,
	"strecke":   `<circle cx="6" cy="5.5" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="7" cy="18.5" r="2.5"/><line x1="8.4" x2="15.6" y1="6.8" y2="10.7"/><line x1="15.7" x2="9.3" y1="13.4" y2="17.2"/>`,
	"etikett":   `<rect x="3" y="5" width="18" height="14" rx="4"/><circle cx="8" cy="12" r="1.6" fill="currentColor" stroke="none"/><line x1="12.5" x2="17.5" y1="12" y2="12"/>`,
	"bogen":     `<rect x="3" y="7" width="18" height="12" rx="4"/><line x1="7" x2="17" y1="4" y2="4"/>`,
	"kamera":    `<rect x="3" y="7" width="18" height="13" rx="4"/><circle cx="12" cy="13.5" r="3.4"/><line x1="9" x2="15" y1="4" y2="4"/>`,
	"zahlen":    `<line x1="5.5" x2="5.5" y1="20" y2="13"/><line x1="12" x2="12" y1="20" y2="8"/><line x1="18.5" x2="18.5" y1="20" y2="4.5"/>`,
	"glocke":    `<circle cx="12" cy="10.5" r="6"/><line x1="5" x2="19" y1="18.5" y2="18.5"/>`,
	"team":      `<circle cx="12" cy="8" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>`,
	"geprueft":  `<polyline points="4.5,12.5 9.5,17.5 19.5,6.5"/>`,
	"weiter":    `<line x1="4" x2="17" y1="12" y2="12"/><polyline points="12.5,7 17.5,12 12.5,17"/>`,
	"zeitregel": `<circle cx="12" cy="12" r="8.5"/><polyline points="12,7 12,12 15.5,14"/>`,
	"variante":  `<circle cx="6.5" cy="6.5" r="3"/><circle cx="17.5" cy="17.5" r="3"/><path d="M6.5 9.5v5a3 3 0 0 0 3 3h5"/>`,
	"warnung":   `<line x1="12" x2="12" y1="6" y2="13.5"/><circle cx="12" cy="17.8" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="9"/>`,
}

// Icon liefert ein Zeichen des Satzes. Ein unbekannter Name ergibt
// nichts — lieber eine Luecke als ein falsches Zeichen.
func Icon(name string, groesse int) string {
	inhalt, da := zeichen[name]
	if !da {
		return ""
	}
	return fmt.Sprintf(
		`<svg width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" `+
			`stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" `+
			`aria-hidden="true" focusable="false">%s</svg>`,
		groesse, groesse, inhalt)
}

// IconJS gibt den Satz als JavaScript-Objekt aus, damit eine Seite ihre
// Zeichen auch dann setzen kann, wenn sie ihre Liste erst im Browser
// aufbaut. Dieselbe Quelle, kein zweiter Satz zum Auseinanderlaufen.
func IconJS() string {
	aus := "const ZEICHEN={"
	for name, inhalt := range zeichen {
		aus += fmt.Sprintf("%q:%q,", name, inhalt)
	}
	return aus + `};
function icon(name, groesse = 18) {
  const inhalt = ZEICHEN[name];
  if (!inhalt) return "";
  return '<svg width="' + groesse + '" height="' + groesse + '" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true" focusable="false">' + inhalt + '</svg>';
}`
}

// MarkeSVG ist dasselbe Zeichen als eigenstaendige Datei: ein Kreis in
// der Hausfarbe, darin ein Punkt in der Grundfarbe. Es dient als
// Favicon.
//
// Ohne Favicon holt sich jeder Browser /favicon.ico, bekommt 404 und
// schreibt es in die Konsole. Das ist harmlos, verdeckt aber echte
// Fehler — und auf einer Kurzdomain sieht ein leerer Tab nach
// Baustelle aus. Die Farben kommen aus der Marke des Hosts, damit auch
// das Lesezeichen beim White-Label stimmt.
func MarkeSVG(hausfarbe, grundfarbe string) string {
	return fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">`+
			`<circle cx="16" cy="16" r="16" fill="%s"/>`+
			`<circle cx="16" cy="16" r="5" fill="%s"/></svg>`,
		hausfarbe, grundfarbe)
}

// MarkeLockup ist das Zeichen samt Wortmarke, wie es Kopf und Fuss
// tragen. `dunkel` schaltet auf die Fassung fuer dunklen Grund.
func MarkeLockup(name, weg string, dunkel bool) string {
	klasse := "marke-lockup"
	if dunkel {
		klasse += " auf-dunkel"
	}
	wort := name
	if name == "" || name == "pnkt" {
		wort = `pnkt<span class="marke-trenner">.</span>me`
	}
	if weg == "" {
		return fmt.Sprintf(`<span class="%s"><span class="marke-zeichen">`+
			`<span class="marke-punkt"></span></span><span class="marke-wort">%s</span></span>`,
			klasse, wort)
	}
	return fmt.Sprintf(`<a href="%s" class="%s"><span class="marke-zeichen">`+
		`<span class="marke-punkt"></span></span><span class="marke-wort">%s</span></a>`,
		weg, klasse, wort)
}
