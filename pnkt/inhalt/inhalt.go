// Package inhalt baut die Nutzlast eines Codes aus Feldern.
//
// Ein QR-Code traegt Text. Welcher Text daraus wird, entscheidet der Typ —
// und bei den bezahlten Typen entscheidet er auch ueber Geld. Ein GiroCode
// mit falscher IBAN wird gedruckt, verteilt und gescannt, und erst die
// Bank sagt Nein. Deshalb wird hier geprueft, bevor gerendert wird.
package inhalt

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// --- IBAN -----------------------------------------------------------------

// Laenge der IBAN je Land. Ohne diese Tabelle faellt eine zu kurze IBAN
// nur dann auf, wenn zufaellig auch die Pruefsumme nicht stimmt.
var ibanLaenge = map[string]int{
	"AD": 24, "AT": 20, "BE": 16, "BG": 22, "CH": 21, "CY": 28, "CZ": 24,
	"DE": 22, "DK": 18, "EE": 20, "ES": 24, "FI": 18, "FR": 27, "GB": 22,
	"GR": 27, "HR": 21, "HU": 28, "IE": 22, "IS": 26, "IT": 27, "LI": 21,
	"LT": 20, "LU": 20, "LV": 21, "MC": 27, "MT": 31, "NL": 18, "NO": 15,
	"PL": 28, "PT": 25, "RO": 24, "SE": 24, "SI": 19, "SK": 24, "SM": 27,
}

// PruefeIBAN prueft Laenge, Zeichen und Pruefsumme nach ISO 13616 und
// gibt die IBAN ohne Leerzeichen zurueck.
func PruefeIBAN(roh string) (string, error) {
	iban := strings.ToUpper(strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) || r == '-' {
			return -1
		}
		return r
	}, roh))

	if iban == "" {
		return "", fmt.Errorf("keine IBAN angegeben")
	}
	if len(iban) < 15 || len(iban) > 34 {
		return "", fmt.Errorf("eine IBAN hat 15 bis 34 Stellen — diese hat %d", len(iban))
	}
	for _, r := range iban {
		if !(r >= '0' && r <= '9') && !(r >= 'A' && r <= 'Z') {
			return "", fmt.Errorf("die IBAN enthaelt ein unzulaessiges Zeichen: %q", string(r))
		}
	}
	land := iban[:2]
	if iban[0] < 'A' || iban[1] < 'A' {
		return "", fmt.Errorf("die IBAN beginnt nicht mit einem Laenderkennzeichen")
	}
	if soll, da := ibanLaenge[land]; da && len(iban) != soll {
		return "", fmt.Errorf("eine IBAN aus %s hat %d Stellen — diese hat %d", land, soll, len(iban))
	}

	// Die ersten vier Zeichen ans Ende, Buchstaben zu Zahlen, Rest modulo 97.
	umgestellt := iban[4:] + iban[:4]
	var rest int
	for _, r := range umgestellt {
		var stueck string
		if r >= 'A' && r <= 'Z' {
			stueck = strconv.Itoa(int(r-'A') + 10)
		} else {
			stueck = string(r)
		}
		for _, z := range stueck {
			rest = (rest*10 + int(z-'0')) % 97
		}
	}
	if rest != 1 {
		return "", fmt.Errorf("die Pruefsumme der IBAN stimmt nicht")
	}
	return iban, nil
}

// --- GiroCode -------------------------------------------------------------

// Ueberweisung sind die Felder eines GiroCodes nach EPC069-12.
type Ueberweisung struct {
	Empfaenger string  // bis 70 Zeichen
	IBAN       string  //
	BIC        string  // im Euroraum entbehrlich
	BetragEuro float64 // 0 heisst: der Zahlende traegt ihn selbst ein
	Zweck      string  // Verwendungszweck, bis 140 Zeichen
	Referenz   string  // strukturierte Referenz, bis 35 Zeichen
	Zweckcode  string  // bis 4 Zeichen
	Hinweis    string  // bis 70 Zeichen
}

// GiroCode baut die zwoelf Zeilen nach EPC069-12.
//
// Die Reihenfolge ist vorgeschrieben, nicht gestalterisch. Referenz und
// Verwendungszweck schliessen einander aus — beides zugleich lehnen
// Bankanwendungen ab.
func GiroCode(u Ueberweisung) (string, error) {
	iban, err := PruefeIBAN(u.IBAN)
	if err != nil {
		return "", err
	}
	empfaenger := strings.TrimSpace(u.Empfaenger)
	if empfaenger == "" {
		return "", fmt.Errorf("ohne Empfaenger")
	}
	if len([]rune(empfaenger)) > 70 {
		return "", fmt.Errorf("der Empfaenger darf hoechstens 70 Zeichen haben")
	}
	if u.Referenz != "" && u.Zweck != "" {
		return "", fmt.Errorf("entweder strukturierte Referenz oder Verwendungszweck, nicht beides")
	}
	if len([]rune(u.Zweck)) > 140 {
		return "", fmt.Errorf("der Verwendungszweck darf hoechstens 140 Zeichen haben")
	}
	if len([]rune(u.Referenz)) > 35 {
		return "", fmt.Errorf("die Referenz darf hoechstens 35 Zeichen haben")
	}
	if len([]rune(u.Hinweis)) > 70 {
		return "", fmt.Errorf("der Hinweis darf hoechstens 70 Zeichen haben")
	}

	betrag := ""
	if u.BetragEuro > 0 {
		if u.BetragEuro < 0.01 || u.BetragEuro > 999999999.99 {
			return "", fmt.Errorf("der Betrag muss zwischen 0,01 und 999999999,99 Euro liegen")
		}
		betrag = fmt.Sprintf("EUR%.2f", u.BetragEuro)
	}

	zeilen := []string{
		"BCD",                        // Dienstkennung
		"002",                        // Fassung
		"1",                          // Zeichensatz 1 ist UTF-8
		"SCT",                        // SEPA-Ueberweisung
		strings.ToUpper(u.BIC),       //
		empfaenger,                   //
		iban,                         //
		betrag,                       //
		strings.ToUpper(u.Zweckcode), //
		u.Referenz,                   //
		u.Zweck,                      //
		u.Hinweis,                    //
	}
	text := strings.Join(zeilen, "\n")

	// Die Norm setzt 331 Byte als Obergrenze. Wer sie reisst, bekommt
	// einen Code, den Bankanwendungen stillschweigend verweigern.
	if len(text) > 331 {
		return "", fmt.Errorf("der GiroCode waere %d Byte lang — EPC069-12 erlaubt 331", len(text))
	}
	return text, nil
}

// --- Visitenkarte ---------------------------------------------------------

// Karte sind die Felder einer Visitenkarte.
type Karte struct {
	Vorname, Nachname, Firma, Stellung string
	Telefon, Mobil, Mail, Netz         string
	Strasse, Ort, PLZ, Land            string
}

func vcardSchutz(s string) string {
	return strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, "\n", `\n`).Replace(s)
}

// VCard baut eine Visitenkarte nach vCard 3.0 — die Fassung, die
// Android und iOS beide ohne Nachfrage annehmen.
func VCard(k Karte) (string, error) {
	if strings.TrimSpace(k.Nachname+k.Vorname+k.Firma) == "" {
		return "", fmt.Errorf("ohne Namen oder Firma")
	}
	zeilen := []string{"BEGIN:VCARD", "VERSION:3.0"}
	zeilen = append(zeilen, fmt.Sprintf("N:%s;%s;;;", vcardSchutz(k.Nachname), vcardSchutz(k.Vorname)))
	name := strings.TrimSpace(k.Vorname + " " + k.Nachname)
	if name == "" {
		name = k.Firma
	}
	zeilen = append(zeilen, "FN:"+vcardSchutz(name))

	fuege := func(feld, wert string) {
		if strings.TrimSpace(wert) != "" {
			zeilen = append(zeilen, feld+":"+vcardSchutz(wert))
		}
	}
	fuege("ORG", k.Firma)
	fuege("TITLE", k.Stellung)
	fuege("TEL;TYPE=WORK,VOICE", k.Telefon)
	fuege("TEL;TYPE=CELL", k.Mobil)
	fuege("EMAIL;TYPE=INTERNET", k.Mail)
	fuege("URL", k.Netz)
	if strings.TrimSpace(k.Strasse+k.Ort+k.PLZ) != "" {
		zeilen = append(zeilen, fmt.Sprintf("ADR;TYPE=WORK:;;%s;%s;;%s;%s",
			vcardSchutz(k.Strasse), vcardSchutz(k.Ort), vcardSchutz(k.PLZ), vcardSchutz(k.Land)))
	}
	zeilen = append(zeilen, "END:VCARD")
	return strings.Join(zeilen, "\n"), nil
}

// --- WLAN -----------------------------------------------------------------

// Netz sind die Felder eines WLAN-Codes.
type Netz struct {
	SSID      string
	Passwort  string
	Art       string // WPA, WEP oder nopass
	Versteckt bool
}

func wlanSchutz(s string) string {
	return strings.NewReplacer(`\`, `\\`, ";", `\;`, ",", `\,`, ":", `\:`, `"`, `\"`).Replace(s)
}

// WLAN baut die Zeichenkette, die Android und iOS als Netzzugang lesen.
func WLAN(n Netz) (string, error) {
	if strings.TrimSpace(n.SSID) == "" {
		return "", fmt.Errorf("ohne Netznamen")
	}
	art := strings.ToUpper(strings.TrimSpace(n.Art))
	switch art {
	case "WPA", "WPA2", "WPA3":
		art = "WPA"
	case "WEP":
	case "", "NOPASS", "OFFEN":
		art = "nopass"
	default:
		return "", fmt.Errorf("unbekannte Verschluesselung %q — erwartet WPA, WEP oder nopass", n.Art)
	}
	if art != "nopass" && n.Passwort == "" {
		return "", fmt.Errorf("ein verschluesseltes Netz braucht ein Passwort")
	}

	teile := []string{"WIFI:", "T:" + art + ";", "S:" + wlanSchutz(n.SSID) + ";"}
	if art != "nopass" {
		teile = append(teile, "P:"+wlanSchutz(n.Passwort)+";")
	}
	if n.Versteckt {
		teile = append(teile, "H:true;")
	}
	return strings.Join(teile, "") + ";", nil
}
