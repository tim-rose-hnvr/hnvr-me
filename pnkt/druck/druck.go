// Package druck beurteilt, ob ein Code so gedruckt werden kann.
//
// Das ist die Stelle, an der sich pnkt.me von den Werkzeugen des Marktes
// unterscheidet. Bitly, Uniqode und Flowcode bauen Codes fuer Bildschirme
// und sagen vor dem Druck nichts. Ein Fehler faellt dort erst auf, wenn die
// Auflage liegt — und dann ist er nicht mehr zu beheben.
//
// Die Beurteilung ersetzt keine Messung nach ISO/IEC 15415 am gedruckten
// Bogen. Sie sagt voraus, was ein Pruefgeraet beanstanden wuerde.
package druck

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

// Verfahren mit der kleinsten Modulgroesse, bei der es noch traegt.
type Verfahren struct {
	Schluessel string
	Name       string
	MinModulMm float64
}

// Die Grenzwerte stammen aus der veroeffentlichten Lesbarkeitsseite von
// PUNKT. Sie sind die Hausregel und stehen ueber jeder allgemeinen
// Faustregel: Zwei Fassungen desselben Programms duerfen zu demselben
// Code nie zwei verschiedene Urteile faellen.
var Verfahrensliste = []Verfahren{
	{"bildschirm", "Nur Bildschirm", 0.20},
	{"laser", "Laser- oder Tintendruck, Papier", 0.40},
	{"offset", "Offsetdruck", 0.50},
	{"grossformat", "Grossformat, Plane, Folie", 0.75},
	{"gravur", "Gravur, Praegung, Textil", 1.00},
}

// Aeltere Schluessel bleiben gueltig und zeigen auf die naechstliegende
// Zeile der Tabelle — sonst brechen bestehende Aufrufe still.
var verfahrensNamen = map[string]string{
	"digital": "laser", "tintenstrahl": "laser", "thermo": "laser",
	"siebdruck": "grossformat", "flexo": "grossformat", "plane": "grossformat",
	"textil": "gravur", "praegung": "gravur",
}

func verfahrenFinden(schluessel string) Verfahren {
	if ziel, da := verfahrensNamen[schluessel]; da {
		schluessel = ziel
	}
	for _, v := range Verfahrensliste {
		if v.Schluessel == schluessel {
			return v
		}
	}
	return verfahrenFinden("offset")
}

// KantenlaengeFuerAbstandMm ist die Faustregel der Praxis: die Kante
// eines Codes sollte etwa ein Zehntel des Leseabstands betragen. Wer
// aus fuenf Metern scannen soll, braucht einen halben Meter Code.
func KantenlaengeFuerAbstandMm(abstandMm float64) float64 {
	return abstandMm / 10
}

// Vorgabe ist das, was gedruckt werden soll.
type Vorgabe struct {
	BreiteMm        float64 // Kantenlaenge ohne Ruhezone
	ModuleJeKante   int     // aus dem Symbol
	Fehlerkorrektur string  // L, M, Q oder H
	Verfahren       string
	RuhezoneModule  int
	Vordergrund     string
	Hintergrund     string
	Modulform       string  // fuer den Hinweis auf teilgefuellte Formen
	Augenrahmen     string  // quadrat, rund, blatt, kissen
	Augenkern       string  // quadrat, rund, punkt, weich
	LogoAnteil      float64 // Kantenanteil des Logos, 0 bis 1
	FuerKasse       bool    // soll nach GS1 an der Kasse gelesen werden
}

// Befund ist eine einzelne Beanstandung.
type Befund struct {
	Schwere string `json:"schwere"` // fehler oder warnung
	Text    string `json:"text"`
	Rat     string `json:"rat,omitempty"`
}

// Urteil ist das Ergebnis der Pruefung.
type Urteil struct {
	Note       string   `json:"note"` // A bis F
	Druckreif  bool     `json:"druckreif"`
	ModulMm    float64  `json:"modulMm"`
	Kontrast   float64  `json:"kontrast"`
	KleinsteMm float64  `json:"kleinsteMm"`
	Befunde    []Befund `json:"befunde"`
}

var wiederherstellbar = map[string]float64{"L": 0.07, "M": 0.15, "Q": 0.25, "H": 0.30}

// Leuchtdichte nach sRGB, wie sie auch der Kontrastrechnung zugrunde liegt.
func leuchtdichte(hex string) float64 {
	h := strings.TrimPrefix(strings.TrimSpace(hex), "#")
	if len(h) == 3 {
		h = string([]byte{h[0], h[0], h[1], h[1], h[2], h[2]})
	}
	if len(h) != 6 {
		return 0
	}
	var teile [3]float64
	for i := 0; i < 3; i++ {
		wert, err := strconv.ParseInt(h[i*2:i*2+2], 16, 32)
		if err != nil {
			return 0
		}
		k := float64(wert) / 255
		if k <= 0.03928 {
			teile[i] = k / 12.92
		} else {
			teile[i] = math.Pow((k+0.055)/1.055, 2.4)
		}
	}
	return 0.2126*teile[0] + 0.7152*teile[1] + 0.0722*teile[2]
}

// Kontrast liefert das Verhaeltnis von 1 bis 21.
func Kontrast(vordergrund, hintergrund string) float64 {
	a, b := leuchtdichte(vordergrund), leuchtdichte(hintergrund)
	hell, dunkel := math.Max(a, b), math.Min(a, b)
	return (hell + 0.05) / (dunkel + 0.05)
}

// Pruefe beurteilt die Vorgabe.
func Pruefe(v Vorgabe) Urteil {
	var befunde []Befund
	melde := func(schwere, text, rat string) {
		befunde = append(befunde, Befund{schwere, text, rat})
	}

	if v.ModuleJeKante <= 0 {
		v.ModuleJeKante = 25
	}
	modul := v.BreiteMm / float64(v.ModuleJeKante)
	verfahren := verfahrenFinden(v.Verfahren)

	// Modulgroesse gegen das Verfahren.
	if modul < verfahren.MinModulMm {
		melde("fehler",
			fmt.Sprintf("Modulgroesse %.3f mm ist zu klein fuer %s — noetig sind %.2f mm.",
				modul, verfahren.Name, verfahren.MinModulMm),
			fmt.Sprintf("Code auf mindestens %.1f mm vergroessern oder weniger Inhalt kodieren.",
				verfahren.MinModulMm*float64(v.ModuleJeKante)))
	} else if modul < verfahren.MinModulMm*1.2 {
		melde("warnung",
			fmt.Sprintf("Modulgroesse %.3f mm liegt dicht an der Grenze fuer %s.", modul, verfahren.Name),
			"Bei saugendem Papier oder Tonwertzuwachs eine Nummer groesser waehlen.")
	}

	// Kassenmasse nach GS1.
	if v.FuerKasse {
		if modul < 0.396 {
			melde("fehler",
				fmt.Sprintf("Fuer die Kasse verlangt GS1 mindestens 0,396 mm je Modul — hier %.3f mm.", modul),
				fmt.Sprintf("Mindestbreite waeren %.1f mm.", 0.396*float64(v.ModuleJeKante)))
		}
		if modul > 0.990 {
			melde("warnung",
				fmt.Sprintf("GS1 nennt 0,990 mm als Hoechstmass je Modul — hier %.3f mm.", modul), "")
		}
	}

	// Ruhezone.
	if v.RuhezoneModule < 4 {
		melde("fehler",
			fmt.Sprintf("Ruhezone %d Module. Die Norm verlangt 4.", v.RuhezoneModule),
			"Die Ruhezone ist Teil des Codes, nicht Weissraum drumherum.")
	}

	// Kontrast und Richtung.
	vg, hg := v.Vordergrund, v.Hintergrund
	if vg == "" {
		vg = "#000000"
	}
	if hg == "" {
		hg = "#ffffff"
	}
	verhaeltnis := Kontrast(vg, hg)
	switch {
	case verhaeltnis < 3:
		melde("fehler",
			fmt.Sprintf("Kontrast %.1f zu 1 — unter 3 zu 1 lesen viele Geraete nicht mehr.", verhaeltnis),
			"Dunkler drucken oder den Hintergrund aufhellen.")
	case verhaeltnis < 4:
		melde("warnung",
			fmt.Sprintf("Kontrast %.1f zu 1 traegt bei gutem Licht, bei schraegem nicht. Ziel sind 4 zu 1.",
				verhaeltnis), "Die dunkle Farbe abdunkeln oder die helle aufhellen.")
	}
	if leuchtdichte(vg) > leuchtdichte(hg) {
		melde("fehler", "Der Code ist heller als sein Hintergrund.",
			"Umgekehrte Codes lesen aeltere Geraete und Kassenscanner nicht. Dunkel auf hell drucken.")
	}

	// Logo gegen die Fehlerkorrektur.
	stufe, da := wiederherstellbar[strings.ToUpper(v.Fehlerkorrektur)]
	if !da {
		stufe = wiederherstellbar["M"]
	}
	if v.LogoAnteil > 0 {
		flaeche := v.LogoAnteil * v.LogoAnteil // Kantenanteil zu Flaechenanteil
		switch {
		case flaeche > stufe:
			melde("fehler",
				fmt.Sprintf("Das Logo verdeckt %.0f %% der Flaeche, die Stufe %s traegt %.0f %%.",
					flaeche*100, strings.ToUpper(v.Fehlerkorrektur), stufe*100),
				"Logo verkleinern oder Fehlerkorrektur auf H setzen.")
		case flaeche > stufe*0.6:
			melde("warnung",
				fmt.Sprintf("Das Logo verbraucht %.0f %% von %.0f %% Reserve.", flaeche*100, stufe*100),
				"Die Reserve ist nicht fuers Logo da, sondern fuer Kratzer, Falten, "+
					"Spiegelungen und Druckfehler. Unter 60 Prozent bleiben.")
		}
	}
	// Formen, die weniger als ein volles Modul fuellen, geben dem Scanner
	// weniger Kontrastflaeche. Auf Papier meist unkritisch, im Grossformat
	// und bei Gegenlicht nicht. Ein Hinweis, kein Verbot.
	switch v.Modulform {
	case "raute", "stern", "kreuz", "querstriche", "laengsstriche":
		schwere := "warnung"
		if verfahren.MinModulMm < 0.75 {
			schwere = "hinweis"
		}
		melde(schwere,
			fmt.Sprintf("Die Form %q fuellt weniger als ein volles Modul.", v.Modulform),
			"Der Scanner sieht weniger Kontrastflaeche. Bei Grossformat und Gegenlicht "+
				"eine volle Form waehlen.")
	}

	// Die Positionsmarken sind das, woran ein Scanner den Code ueberhaupt
	// findet: gesucht wird das Verhaeltnis 1:1:3:1:1. Wie stark eine runde
	// Ecke schadet, ist gemessen und nicht geschaetzt — 160 Kombinationen
	// aus Modul-, Rahmen- und Kernform, gegengelesen mit OpenCV:
	//
	//	quadrat  40 von 40      kissen  40 von 40
	//	blatt     0 von 40      rund     0 von 40
	//
	// Das ist keine Abstufung, das ist eine Kante. Verboten wird es
	// trotzdem nicht — Telefonkameras sind nachsichtiger als ein
	// Pruefdecoder, und die Entscheidung gehoert dem Gestalter.
	switch v.Augenrahmen {
	case "rund", "blatt":
		melde("warnung",
			fmt.Sprintf("Der Augenrahmen %q wurde in unserer Messung von einem verbreiteten "+
				"Decoder in keinem einzigen von 40 Faellen gelesen.", v.Augenrahmen),
			"Quadratische oder nur leicht gerundete Positionsmarken (kissen) waehlen — "+
				"die lasen sich in derselben Messung durchgehend.")
	}

	if strings.EqualFold(v.Fehlerkorrektur, "L") && !v.FuerKasse {
		melde("warnung", "Fehlerkorrektur L ist fuer Druck knapp bemessen.",
			"Fuer Papier ist M die untere Grenze, fuer Verpackung Q.")
	}

	fehler, warnungen := 0, 0
	for _, b := range befunde {
		switch b.Schwere {
		case "fehler":
			fehler++
		case "warnung":
			warnungen++
		}
	}
	note := "A"
	switch {
	case fehler > 1:
		note = "F"
	case fehler == 1:
		note = "D"
	case warnungen > 1:
		note = "C"
	case warnungen == 1:
		note = "B"
	}

	grenze := verfahren.MinModulMm
	if v.FuerKasse && 0.396 > grenze {
		grenze = 0.396
	}

	return Urteil{
		Note:       note,
		Druckreif:  fehler == 0,
		ModulMm:    math.Round(modul*10000) / 10000,
		Kontrast:   math.Round(verhaeltnis*100) / 100,
		KleinsteMm: math.Round(grenze*float64(v.ModuleJeKante)*10) / 10,
		Befunde:    befunde,
	}
}
