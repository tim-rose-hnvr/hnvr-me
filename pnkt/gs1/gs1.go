// Package gs1 baut und liest GS1 Digital Link.
//
// Ab Sunrise 2027 sollen Kassen zweidimensionale Codes mit GS1-Daten lesen.
// Ein QR-Code an der Kasse muss dafuer eine korrekt kodierte GTIN tragen —
// sonst ist er fuer das Kassensystem kein Artikel, sondern nur ein Link.
package gs1

import (
	"fmt"
	"net/url"
	"strings"
)

// Angaben sind die Anwendungsbezeichner, die pnkt.me fuehrt.
type Angaben struct {
	GTIN      string // AI 01
	Charge    string // AI 10
	Serie     string // AI 21
	Verfaellt string // AI 17, Form JJMMTT
}

// Pruefziffer nach GS1, Modulo 10. Gilt fuer GTIN-8, -12, -13 und -14.
func Pruefziffer(ziffern string) (int, error) {
	summe := 0
	for i := len(ziffern) - 1; i >= 0; i-- {
		z := ziffern[i]
		if z < '0' || z > '9' {
			return 0, fmt.Errorf("keine Ziffer: %q", string(z))
		}
		gewicht := 1
		if (len(ziffern)-1-i)%2 == 0 {
			gewicht = 3
		}
		summe += int(z-'0') * gewicht
	}
	return (10 - summe%10) % 10, nil
}

// PruefeGTIN prueft Laenge, Ziffern und Pruefziffer und liefert die
// auf vierzehn Stellen aufgefuellte Fassung.
func PruefeGTIN(gtin string) (string, error) {
	roh := strings.NewReplacer(" ", "", "-", "").Replace(gtin)
	if roh == "" {
		return "", fmt.Errorf("keine GTIN angegeben")
	}
	for _, z := range roh {
		if z < '0' || z > '9' {
			return "", fmt.Errorf("die GTIN enthaelt Zeichen, die keine Ziffern sind")
		}
	}
	switch len(roh) {
	case 8, 12, 13, 14:
	default:
		return "", fmt.Errorf("eine GTIN hat 8, 12, 13 oder 14 Stellen — diese hat %d", len(roh))
	}
	soll, err := Pruefziffer(roh[:len(roh)-1])
	if err != nil {
		return "", err
	}
	ist := int(roh[len(roh)-1] - '0')
	if soll != ist {
		return "", fmt.Errorf("die Pruefziffer stimmt nicht: erwartet %d, angegeben %d", soll, ist)
	}
	return strings.Repeat("0", 14-len(roh)) + roh, nil
}

// DigitalLink baut die URL. Die Reihenfolge der Bezeichner im Pfad ist
// festgelegt: erst 01, dann 10, dann 21.
func DigitalLink(a Angaben, host string) (string, error) {
	gtin14, err := PruefeGTIN(a.GTIN)
	if err != nil {
		return "", err
	}
	if host == "" {
		host = "https://pnkt.me"
	}
	b := strings.TrimRight(host, "/") + "/01/" + gtin14
	if a.Charge != "" {
		b += "/10/" + url.PathEscape(a.Charge)
	}
	if a.Serie != "" {
		b += "/21/" + url.PathEscape(a.Serie)
	}
	if a.Verfaellt != "" {
		b += "?17=" + url.QueryEscape(a.Verfaellt)
	}
	return b, nil
}

// LiesDigitalLink zerlegt eine Digital-Link-URL wieder in ihre Bestandteile.
func LiesDigitalLink(roh string) (Angaben, error) {
	var a Angaben
	zerlegt, err := url.Parse(roh)
	if err != nil {
		return a, err
	}
	teile := strings.Split(strings.Trim(zerlegt.Path, "/"), "/")
	for i := 0; i+1 < len(teile); i += 2 {
		wert, _ := url.PathUnescape(teile[i+1])
		switch teile[i] {
		case "01":
			a.GTIN = wert
		case "10":
			a.Charge = wert
		case "21":
			a.Serie = wert
		}
	}
	if v := zerlegt.Query().Get("17"); v != "" {
		a.Verfaellt = v
	}
	return a, nil
}

// Grenzen der Modulgroesse fuer den Handel, in Millimetern.
const (
	MinModulMm = 0.396
	MaxModulMm = 0.990
)
