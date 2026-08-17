package qr

import (
	"math"
	"strings"
)

// Die Geometrie liegt an einer Stelle, nicht in jedem Ausgabeformat neu.
// Sonst zeigt die Vorschau etwas anderes als die Druckdatei — und das
// merkt niemand, bevor die Auflage liegt.
//
// Alle Masse in Millimetern, Nullpunkt links oben. Die Ausgabeformate
// rechnen um, wenn sie anders zaehlen: PDF und EPS zaehlen von unten.

// Art einer Grundform.
const (
	ArtRechteck     = "rechteck"
	ArtRundRechteck = "rundrechteck"
	ArtKreis        = "kreis"
	ArtPolygon      = "polygon"
	ArtText         = "text"
)

// VerlaufMarke steht als Farbe an jeder Form, die den Verlauf der
// Zeichnung traegt. Die Ausgabeformate loesen sie je nach ihren Mitteln
// auf — SVG mit einer Verlaufsdefinition, PDF und EPS mit einer
// Schattierung innerhalb einer Beschneidung.
const VerlaufMarke = "$verlauf"

// Halt ist eine Farbe an einer Stelle des Verlaufs, 0 bis 1.
type Halt struct {
	Pos   float64
	Farbe string
}

// Verlauf beschreibt einen Farbverlauf ueber die gesamte Codeflaeche.
type Verlauf struct {
	Art    string // linear oder radial
	Winkel float64
	Haelt  []Halt
}

// Form ist eine einzelne Flaeche. Ist Loch gesetzt, wird sie mit der
// Even-odd-Regel gefuellt — so entsteht der Rahmen eines Auges.
type Form struct {
	Art     string
	X, Y    float64
	B, H    float64
	R       float64      // Eckradius oder Kreisradius
	Ecken   [4]float64   // Eckradien einzeln: links oben, rechts oben, rechts unten, links unten
	Punkte  [][2]float64 // fuer ArtPolygon
	Farbe   string       // Hexfarbe oder VerlaufMarke
	Text    string       // fuer ArtText
	Groesse float64      // Schriftgroesse in Millimetern
	Loch    *Form
}

// EckenOderR liefert die vier Eckradien; ist keiner gesetzt, gilt R.
func (f Form) EckenOderR() [4]float64 {
	if f.Ecken != [4]float64{} {
		return f.Ecken
	}
	return [4]float64{f.R, f.R, f.R, f.R}
}

// Zeichnung ist alles, was gedruckt wird.
type Zeichnung struct {
	BreiteMm, HoeheMm float64
	Hintergrund       string // leer heisst durchsichtig
	Verlauf           *Verlauf
	Formen            []Form
	// CodeVon und CodeBis umschliessen die Codeflaeche ohne Ruhezone.
	// Der Verlauf spannt sich darueber, nicht ueber das ganze Blatt —
	// sonst verschiebt eine groessere Ruhezone die Farben.
	CodeVon, CodeBis [2]float64
}

// Formen rechnet das Symbol in Grundformen um.
func (s *Symbol) Formen(g Gestalt) Zeichnung {
	// Der Verlauf ersetzt die Vordergrundfarbe an jeder Form.
	if g.BreiteMm <= 0 {
		g.BreiteMm = 40
	}
	if g.Modulform == "" {
		g.Modulform = "quadrat"
	}
	if g.Vordergrund == "" {
		g.Vordergrund = "#000000"
	}
	vordergrund := g.Vordergrund
	if g.Verlauf != nil && len(g.Verlauf.Haelt) >= 2 {
		vordergrund = VerlaufMarke
	}
	augenFarbe := g.AugenFarbe
	if augenFarbe == "" {
		augenFarbe = vordergrund
	}

	m := g.BreiteMm / float64(s.Kante)
	rand := float64(g.RuhezoneMod) * m
	gesamt := g.BreiteMm + 2*rand

	z := Zeichnung{
		BreiteMm: gesamt, HoeheMm: gesamt, Hintergrund: g.Hintergrund,
		CodeVon: [2]float64{rand, rand},
		CodeBis: [2]float64{rand + g.BreiteMm, rand + g.BreiteMm},
	}
	if g.Verlauf != nil && len(g.Verlauf.Haelt) >= 2 {
		z.Verlauf = g.Verlauf
	}

	for y := 0; y < s.Kante; y++ {
		for x := 0; x < s.Kante; x++ {
			if !s.Dunkel(x, y) || s.istAuge(x, y) || s.istAusgespart(x, y, g.LogoAnteil) {
				continue
			}
			form := modulform(g.Modulform, rand+float64(x)*m, rand+float64(y)*m, m, vordergrund)
			if g.Modulform == "fliessend" {
				// Fliessend verbindet Nachbarn: eine Ecke wird nur dort
				// gerundet, wo kein gesetztes Modul anschliesst.
				form = fliessend(s, x, y, rand+float64(x)*m, rand+float64(y)*m, m, vordergrund, g.LogoAnteil)
			}
			z.Formen = append(z.Formen, form)
		}
	}

	k := s.Kante
	for _, ecke := range [][2]int{{0, 0}, {k - 7, 0}, {0, k - 7}} {
		x := rand + float64(ecke[0])*m
		y := rand + float64(ecke[1])*m
		z.Formen = append(z.Formen, augenformen(x, y, m, g.Augenrahmen, g.Augenkern, augenFarbe)...)
	}

	if g.Rahmen != nil && g.Rahmen.Art != "" && g.Rahmen.Art != "keiner" {
		z = mitRahmen(z, *g.Rahmen, m)
	}
	return z
}

// mitRahmen legt eine Flaeche unter den Code und schreibt die
// Aufforderung darunter. Der Code selbst wird dabei nicht verkleinert —
// die Modulgroesse ist eine Druckentscheidung und darf nicht still
// dadurch sinken, dass jemand eine Beschriftung dazunimmt.
func mitRahmen(z Zeichnung, r Rahmen, modul float64) Zeichnung {
	text := strings.TrimSpace(r.Text)
	if text == "" {
		text = "JETZT SCANNEN"
	}
	farbe := r.Farbe
	if farbe == "" {
		farbe = "#141018"
	}
	textfarbe := r.Textfarbe
	if textfarbe == "" {
		textfarbe = "#ffffff"
	}

	balken := modul * 4
	luft := modul * 1.5
	hoehe := z.HoeheMm + balken

	unten := []Form{}
	if r.Art == "schild" {
		// Der Code sitzt auf einer Platte mit gerundeten Ecken.
		unten = append(unten, Form{Art: ArtRundRechteck, X: 0, Y: 0,
			B: z.BreiteMm, H: hoehe, R: modul * 2, Farbe: farbe})
		// Helle Flaeche unter dem Code, damit der Kontrast bleibt.
		unten = append(unten, Form{Art: ArtRundRechteck,
			X: z.CodeVon[0] - modul, Y: z.CodeVon[1] - modul,
			B: z.CodeBis[0] - z.CodeVon[0] + 2*modul,
			H: z.CodeBis[1] - z.CodeVon[1] + 2*modul,
			R: modul, Farbe: oderFarbe(z.Hintergrund, "#ffffff")})
	} else {
		unten = append(unten, Form{Art: ArtRechteck, X: 0, Y: z.HoeheMm,
			B: z.BreiteMm, H: balken, Farbe: farbe})
	}

	beschriftung := Form{Art: ArtText, X: z.BreiteMm / 2, Y: hoehe - balken/2 + luft/3,
		Groesse: balken * 0.42, Text: text, Farbe: textfarbe}

	z.HoeheMm = hoehe
	z.Formen = append(unten, append(z.Formen, beschriftung)...)
	if r.Art == "schild" {
		z.Hintergrund = ""
	}
	return z
}

func oderFarbe(wert, ersatz string) string {
	if strings.TrimSpace(wert) == "" {
		return ersatz
	}
	return wert
}

func modulform(form string, x, y, m float64, farbe string) Form {
	switch form {
	case "punkt":
		r := m * 0.42
		return Form{Art: ArtKreis, X: x + m/2, Y: y + m/2, R: r, Farbe: farbe}
	case "rund", "abgerundet":
		return Form{Art: ArtRundRechteck, X: x, Y: y, B: m, H: m, R: m * 0.28, Farbe: farbe}
	case "weich":
		return Form{Art: ArtRundRechteck, X: x, Y: y, B: m, H: m, R: m * 0.45, Farbe: farbe}
	case "querstriche":
		h := m * 0.62
		return Form{Art: ArtRechteck, X: x, Y: y + (m-h)/2, B: m, H: h, Farbe: farbe}
	case "laengsstriche":
		b := m * 0.62
		return Form{Art: ArtRechteck, X: x + (m-b)/2, Y: y, B: b, H: m, Farbe: farbe}
	case "stern":
		// Acht Zacken, abwechselnd aussen und innen.
		mx, my := x+m/2, y+m/2
		aussen, innen := m*0.5, m*0.22
		var punkte [][2]float64
		for i := 0; i < 8; i++ {
			r := aussen
			if i%2 == 1 {
				r = innen
			}
			w := float64(i) * math.Pi / 4
			punkte = append(punkte, [2]float64{mx + r*math.Sin(w), my - r*math.Cos(w)})
		}
		return Form{Art: ArtPolygon, Farbe: farbe, Punkte: punkte}
	case "mosaik":
		e := m * 0.08
		return Form{Art: ArtRechteck, X: x + e, Y: y + e, B: m - 2*e, H: m - 2*e, Farbe: farbe}
	case "raute":
		return Form{Art: ArtPolygon, Farbe: farbe, Punkte: [][2]float64{
			{x + m/2, y}, {x + m, y + m/2}, {x + m/2, y + m}, {x, y + m/2}}}
	case "kreuz":
		d := m * 0.3
		return Form{Art: ArtPolygon, Farbe: farbe, Punkte: [][2]float64{
			{x + d, y}, {x + m - d, y}, {x + m - d, y + d}, {x + m, y + d},
			{x + m, y + m - d}, {x + m - d, y + m - d}, {x + m - d, y + m},
			{x + d, y + m}, {x + d, y + m - d}, {x, y + m - d},
			{x, y + d}, {x + d, y + d}}}
	default:
		return Form{Art: ArtRechteck, X: x, Y: y, B: m, H: m, Farbe: farbe}
	}
}

// Ein Auge ist sieben mal sieben Module: Rahmen aussen, ein Ring hell,
// Kern drei mal drei. Diese Masse sind nicht frei waehlbar — hier endet
// die Gestaltung und beginnt die Norm.
func augenformen(x, y, m float64, rahmen, kern, farbe string) []Form {
	sieben := 7 * m
	var aussen, innen Form

	switch rahmen {
	case "rund":
		aussen = Form{Art: ArtKreis, X: x + sieben/2, Y: y + sieben/2, R: sieben / 2, Farbe: farbe}
		innen = Form{Art: ArtKreis, X: x + sieben/2, Y: y + sieben/2, R: sieben/2 - m}
	case "blatt", "kissen":
		ecke := 2 * m
		if rahmen == "kissen" {
			ecke = m
		}
		aussen = Form{Art: ArtRundRechteck, X: x, Y: y, B: sieben, H: sieben, R: ecke, Farbe: farbe}
		innen = Form{Art: ArtRundRechteck, X: x + m, Y: y + m, B: sieben - 2*m, H: sieben - 2*m,
			R: ecke * 0.6}
	default:
		aussen = Form{Art: ArtRechteck, X: x, Y: y, B: sieben, H: sieben, Farbe: farbe}
		innen = Form{Art: ArtRechteck, X: x + m, Y: y + m, B: sieben - 2*m, H: sieben - 2*m}
	}
	aussen.Loch = &innen

	kx, ky, drei := x+2*m, y+2*m, 3*m
	var mitte Form
	switch kern {
	case "rund":
		mitte = Form{Art: ArtKreis, X: kx + drei/2, Y: ky + drei/2, R: drei / 2, Farbe: farbe}
	case "punkt":
		mitte = Form{Art: ArtKreis, X: kx + drei/2, Y: ky + drei/2, R: drei * 0.44, Farbe: farbe}
	case "weich", "kissen":
		mitte = Form{Art: ArtRundRechteck, X: kx, Y: ky, B: drei, H: drei, R: drei * 0.3, Farbe: farbe}
	default:
		mitte = Form{Art: ArtRechteck, X: kx, Y: ky, B: drei, H: drei, Farbe: farbe}
	}

	return []Form{aussen, mitte}
}

// gesetztUndSichtbar sagt, ob das Nachbarmodul dunkel und nicht ausgespart ist.
func gesetztUndSichtbar(s *Symbol, x, y int, logo float64) bool {
	if x < 0 || y < 0 || x >= s.Kante || y >= s.Kante {
		return false
	}
	return s.Dunkel(x, y) && !s.istAuge(x, y) && !s.istAusgespart(x, y, logo)
}

// fliessend rundet nur die Ecken, an denen kein Nachbar anschliesst.
// Dadurch wachsen benachbarte Module zu einer Flaeche zusammen — der
// Scanner sieht mehr zusammenhaengenden Kontrast als bei runden Punkten.
func fliessend(s *Symbol, x, y int, px, py, m float64, farbe string, logo float64) Form {
	oben := gesetztUndSichtbar(s, x, y-1, logo)
	unten := gesetztUndSichtbar(s, x, y+1, logo)
	links := gesetztUndSichtbar(s, x-1, y, logo)
	rechts := gesetztUndSichtbar(s, x+1, y, logo)

	r := m * 0.5
	ecken := [4]float64{r, r, r, r} // links oben, rechts oben, rechts unten, links unten
	if oben || links {
		ecken[0] = 0
	}
	if oben || rechts {
		ecken[1] = 0
	}
	if unten || rechts {
		ecken[2] = 0
	}
	if unten || links {
		ecken[3] = 0
	}
	return Form{Art: ArtRundRechteck, X: px, Y: py, B: m, H: m, Ecken: ecken, Farbe: farbe}
}
