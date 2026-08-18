//go:build js && wasm

// Der Kern von pnkt im Browser.
//
// Warum das hier steht: einen Code zu bauen braucht keinen Server. Der
// ganze Vorgang — kodieren, formen, beurteilen, als SVG, PDF oder EPS
// ausgeben — ist eine Rechnung ohne Zustand. Sie lief bisher auf dem
// Server, weil der Server ohnehin da war. Er ist es nicht: pnkt.me löst
// nicht auf, und die Werkstatt war deshalb eine Seite, die von einem
// Code erzählt, statt einen zu bauen.
//
// Also läuft dieselbe Rechnung jetzt im Browser. Nicht eine zweite
// Umsetzung in JavaScript — das wäre die Sorte Sonderzweig, die die
// Projektanweisung ausschließt und die spätestens beim ersten
// abweichenden Urteil teuer wird. Es ist derselbe Go-Code, nach
// WebAssembly übersetzt.
//
// Was hier NICHT geht und auch nicht hingehört: dynamische Codes,
// Konten, Weiterleitung, Zählung. Das braucht einen Server, weil ein
// gedruckter Code auf eine Adresse zeigt, die jemand beantworten muss.
//
// Bauen:
//
//	GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o pnkt.wasm ./cmd/wasm
//
// Dazu gehört `wasm_exec.js` aus der Go-Installation — es bringt das
// Laufzeitgerüst mit. Beides holt `website/skripte/wasm-bauen.sh`.
package main

import (
	"encoding/base64"
	"encoding/json"
	"strconv"
	"strings"
	"syscall/js"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/druck"
	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/inhalt"
	"pnkt.me/pnkt/qr"
)

// wunsch ist der Rumpf, den die Werkstatt schickt. Die Felder heissen
// wie in der veroeffentlichten Schnittstelle — wer die Seite liest,
// findet dieselben Namen wieder, und wer spaeter auf den Server
// umstellt, muss nichts umbenennen.
type wunsch struct {
	Text      string  `json:"text"`
	BreiteMm  float64 `json:"breiteMm"`
	Verfahren string  `json:"verfahren"`
	Stufe     string  `json:"stufe"`
	FuerKasse bool    `json:"fuerKasse"`
	Stil      struct {
		Modulform   string  `json:"modulform"`
		Augenrahmen string  `json:"augenrahmen"`
		Augenkern   string  `json:"augenkern"`
		Vordergrund string  `json:"vordergrund"`
		Hintergrund string  `json:"hintergrund"`
		AugenFarbe  string  `json:"augenfarbe"`
		Ruhezone    int     `json:"ruhezone"`
		Logo        float64 `json:"logo"`
		Rahmen      *struct {
			Art       string `json:"art"`
			Text      string `json:"text"`
			Farbe     string `json:"farbe"`
			Textfarbe string `json:"textfarbe"`
		} `json:"rahmen"`
	} `json:"stil"`
}

type antwort struct {
	Fehler   string        `json:"fehler,omitempty"`
	SVG      string        `json:"svg,omitempty"`
	PDF      string        `json:"pdf,omitempty"` // base64
	EPS      string        `json:"eps,omitempty"` // base64
	Version  int           `json:"version,omitempty"`
	Kante    int           `json:"kante,omitempty"`
	Pruefung string        `json:"pruefung,omitempty"` // gut, achtung, kritisch
	Urteil   *druck.Urteil `json:"urteil,omitempty"`
}

func oder(a, b string) string {
	if strings.TrimSpace(a) == "" {
		return b
	}
	return a
}

// pruefFarbe nimmt bei einem Verlauf den ersten Halt. Die Pruefung
// rechnet mit einer Farbe, und der erste Halt ist die, die am haeufigsten
// auf dem Papier landet.
func pruefFarbe(g qr.Gestalt) string {
	if g.Verlauf != nil && len(g.Verlauf.Haelt) > 0 {
		return g.Verlauf.Haelt[0].Farbe
	}
	return g.Vordergrund
}

// rendern ist der eine Aufruf, den die Werkstatt braucht.
func rendern(_ js.Value, args []js.Value) any {
	if len(args) == 0 {
		return heraus(antwort{Fehler: "kein Wunsch übergeben"})
	}
	var w wunsch
	if err := json.Unmarshal([]byte(args[0].String()), &w); err != nil {
		return heraus(antwort{Fehler: "Wunsch nicht lesbar: " + err.Error()})
	}
	if strings.TrimSpace(w.Text) == "" {
		return heraus(antwort{Fehler: "kein Inhalt"})
	}

	stufe, err := qr.StufeAus(oder(w.Stufe, "M"))
	if err != nil {
		return heraus(antwort{Fehler: err.Error()})
	}
	s, err := qr.Baue(w.Text, stufe, 0)
	if err != nil {
		return heraus(antwort{Fehler: err.Error()})
	}

	breite := w.BreiteMm
	if breite <= 0 {
		breite = 40
	}
	ruhezone := w.Stil.Ruhezone
	if ruhezone == 0 {
		ruhezone = 4
	}

	g := qr.StandardGestalt(breite)
	g.Modulform = oder(w.Stil.Modulform, "quadrat")
	g.Augenrahmen = oder(w.Stil.Augenrahmen, "quadrat")
	g.Augenkern = oder(w.Stil.Augenkern, "quadrat")
	g.Vordergrund = oder(w.Stil.Vordergrund, "#201e1d")
	g.Hintergrund = oder(w.Stil.Hintergrund, "#ffffff")
	g.AugenFarbe = w.Stil.AugenFarbe
	g.RuhezoneMod = ruhezone
	g.LogoAnteil = w.Stil.Logo
	if r := w.Stil.Rahmen; r != nil && r.Art != "" && r.Art != "keiner" {
		g.Rahmen = &qr.Rahmen{Art: r.Art, Text: r.Text, Farbe: r.Farbe, Textfarbe: r.Textfarbe}
	}

	urteil := druck.Pruefe(druck.Vorgabe{
		BreiteMm: breite, ModuleJeKante: s.Kante, Fehlerkorrektur: stufe.String(),
		Verfahren: oder(w.Verfahren, "offset"), RuhezoneModule: ruhezone,
		Vordergrund: pruefFarbe(g), Hintergrund: g.Hintergrund,
		Modulform: g.Modulform, Augenrahmen: g.Augenrahmen, Augenkern: g.Augenkern,
		LogoAnteil: w.Stil.Logo, FuerKasse: w.FuerKasse,
	})

	// Drei Worte statt einer Note, wie in der veroeffentlichten
	// Schnittstelle. Die Note steht daneben.
	kurz := "gut"
	if !urteil.Druckreif {
		kurz = "kritisch"
	} else if urteil.Note != "A" {
		kurz = "achtung"
	}

	zeichnung := s.Formen(g)
	titel := "pnkt-code"
	return heraus(antwort{
		SVG:      s.SVG(g),
		PDF:      base64.StdEncoding.EncodeToString(ausgabe.PDF(zeichnung, titel)),
		EPS:      base64.StdEncoding.EncodeToString(ausgabe.EPS(zeichnung, titel)),
		Version:  s.Version,
		Kante:    s.Kante,
		Pruefung: kurz,
		Urteil:   &urteil,
	})
}

// inhaltBauen macht aus Feldern die Nutzlast: vCard, WLAN, GiroCode,
// GS1 Digital Link. Dieselben Regeln wie auf dem Server — eine IBAN mit
// falscher Pruefsumme wird auch hier abgewiesen, und nicht erst, wenn
// jemand den gedruckten Code scannt.
func inhaltBauen(_ js.Value, args []js.Value) any {
	if len(args) == 0 {
		return heraus(antwort{Fehler: "kein Wunsch übergeben"})
	}
	var f struct {
		Typ    string            `json:"typ"`
		Felder map[string]string `json:"felder"`
	}
	if err := json.Unmarshal([]byte(args[0].String()), &f); err != nil {
		return heraus(antwort{Fehler: "Wunsch nicht lesbar: " + err.Error()})
	}
	feld := func(n string) string { return strings.TrimSpace(f.Felder[n]) }

	var text string
	var err error
	switch f.Typ {
	case "url", "text", "":
		text = feld("text")
	case "vcard":
		text, err = inhalt.VCard(inhalt.Karte{
			Vorname: feld("vorname"), Nachname: feld("nachname"),
			Firma: feld("firma"), Stellung: feld("stellung"),
			Telefon: feld("telefon"), Mobil: feld("mobil"),
			Mail: feld("mail"), Netz: feld("netz"),
			Strasse: feld("strasse"), PLZ: feld("plz"),
			Ort: feld("ort"), Land: feld("land"),
		})
	case "wlan":
		text, err = inhalt.WLAN(inhalt.Netz{
			SSID: feld("ssid"), Passwort: feld("passwort"),
			Art: oder(feld("art"), "WPA"), Versteckt: feld("versteckt") == "ja",
		})
	case "giro":
		text, err = inhalt.GiroCode(inhalt.Ueberweisung{
			Empfaenger: feld("empfaenger"), IBAN: feld("iban"),
			BIC: feld("bic"), BetragEuro: kommazahl(feld("betrag")),
			Zweck: feld("zweck"), Referenz: feld("referenz"),
		})
	case "gs1":
		text, err = gs1.DigitalLink(gs1.Angaben{
			GTIN: feld("gtin"), Charge: feld("charge"),
		}, oder(feld("host"), "https://pnkt.me"))
	default:
		err = errUnbekannt(f.Typ)
	}
	if err != nil {
		return heraus(antwort{Fehler: err.Error()})
	}
	roh, _ := json.Marshal(map[string]string{"text": text})
	return string(roh)
}

// kommazahl nimmt „12,50" genauso wie „12.50". Ein deutsches
// Eingabefeld liefert das Komma, und ein Betrag, der still auf 0 fällt,
// ist schlimmer als eine Fehlermeldung.
func kommazahl(s string) float64 {
	s = strings.ReplaceAll(strings.TrimSpace(s), ",", ".")
	if s == "" {
		return 0
	}
	wert, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return wert
}

type fehlerText string

func (f fehlerText) Error() string { return string(f) }

func errUnbekannt(typ string) error {
	return fehlerText("unbekannter Inhaltstyp: " + typ)
}

// verfahren nennt die Druckverfahren samt Mindestmass — damit die
// Auswahlliste in der Seite nicht abgeschrieben wird, sondern aus
// derselben Quelle kommt wie das Urteil.
func verfahren(js.Value, []js.Value) any {
	liste := make([]map[string]any, 0, len(druck.Verfahrensliste))
	for _, v := range druck.Verfahrensliste {
		liste = append(liste, map[string]any{
			"schluessel": v.Schluessel, "name": v.Name, "minModulMm": v.MinModulMm,
		})
	}
	roh, _ := json.Marshal(liste)
	return string(roh)
}

func heraus(a antwort) string {
	roh, err := json.Marshal(a)
	if err != nil {
		return `{"fehler":"Antwort nicht verpackbar"}`
	}
	return string(roh)
}

func main() {
	js.Global().Set("pnktRendern", js.FuncOf(rendern))
	js.Global().Set("pnktInhalt", js.FuncOf(inhaltBauen))
	js.Global().Set("pnktVerfahren", js.FuncOf(verfahren))
	// Die Seite wartet auf dieses Zeichen, bevor sie den ersten Code
	// rechnet — sonst ruft sie eine Funktion, die es noch nicht gibt.
	js.Global().Set("pnktBereit", true)
	if bereit := js.Global().Get("pnktGeladen"); bereit.Type() == js.TypeFunction {
		bereit.Invoke()
	}
	select {} // Go beendet sich sonst und nimmt die Funktionen mit.
}
