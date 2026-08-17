package inhalt

import "strings"
import "testing"

func TestPruefeIBAN(t *testing.T) {
	gut := []string{
		"DE89 3704 0044 0532 0130 00",
		"DE89370400440532013000",
		"AT61 1904 3002 3457 3201",
		"CH93 0076 2011 6238 5295 7",
		"GB29 NWBK 6016 1331 9268 19",
	}
	for _, i := range gut {
		if _, err := PruefeIBAN(i); err != nil {
			t.Errorf("gueltige IBAN %q abgelehnt: %v", i, err)
		}
	}
	schlecht := map[string]string{
		"DE89370400440532013001":  "falsche Pruefsumme",
		"DE8937040044053201300":   "zu kurz fuer DE",
		"DE89 3704 0044 0532 01!": "unzulaessiges Zeichen",
		"":                        "leer",
		"1289370400440532013000":  "kein Laenderkennzeichen",
	}
	for i, warum := range schlecht {
		if _, err := PruefeIBAN(i); err == nil {
			t.Errorf("%s haette abgelehnt werden muessen: %q", warum, i)
		}
	}
	if norm, _ := PruefeIBAN("de89 3704 0044 0532 0130 00"); norm != "DE89370400440532013000" {
		t.Errorf("Normierung falsch: %q", norm)
	}
}

func TestGiroCode(t *testing.T) {
	text, err := GiroCode(Ueberweisung{
		Empfaenger: "Hannover Veranstaltungstechnik",
		IBAN:       "DE89 3704 0044 0532 0130 00",
		BetragEuro: 249.90,
		Zweck:      "Rechnung 2026-114",
	})
	if err != nil {
		t.Fatal(err)
	}
	zeilen := strings.Split(text, "\n")
	if len(zeilen) != 12 {
		t.Fatalf("EPC069-12 hat zwoelf Zeilen, hier sind es %d", len(zeilen))
	}
	if zeilen[0] != "BCD" || zeilen[1] != "002" || zeilen[3] != "SCT" {
		t.Errorf("Kopfzeilen falsch: %q %q %q", zeilen[0], zeilen[1], zeilen[3])
	}
	if zeilen[6] != "DE89370400440532013000" {
		t.Errorf("IBAN-Zeile falsch: %q", zeilen[6])
	}
	if zeilen[7] != "EUR249.90" {
		t.Errorf("Betrag muss EUR249.90 heissen, ist %q", zeilen[7])
	}
	if zeilen[10] != "Rechnung 2026-114" {
		t.Errorf("Verwendungszweck falsch: %q", zeilen[10])
	}
}

func TestGiroCodeLehntAb(t *testing.T) {
	grund := map[string]Ueberweisung{
		"falsche IBAN":       {Empfaenger: "A", IBAN: "DE00370400440532013000"},
		"ohne Empfaenger":    {IBAN: "DE89370400440532013000"},
		"Referenz und Zweck": {Empfaenger: "A", IBAN: "DE89370400440532013000", Referenz: "R1", Zweck: "Z"},
		"Betrag zu gross":    {Empfaenger: "A", IBAN: "DE89370400440532013000", BetragEuro: 1e10},
		"Zweck zu lang":      {Empfaenger: "A", IBAN: "DE89370400440532013000", Zweck: strings.Repeat("x", 141)},
	}
	for warum, u := range grund {
		if _, err := GiroCode(u); err == nil {
			t.Errorf("%s haette abgelehnt werden muessen", warum)
		}
	}
}

func TestGiroCodeOhneBetrag(t *testing.T) {
	text, err := GiroCode(Ueberweisung{Empfaenger: "Spendenverein", IBAN: "DE89370400440532013000"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Split(text, "\n")[7] != "" {
		t.Error("ohne Betrag muss die Betragszeile leer bleiben")
	}
}

func TestVCard(t *testing.T) {
	text, err := VCard(Karte{Vorname: "Tim", Nachname: "Rose", Firma: "hnvr.me",
		Mail: "tim@hnvr.me", Telefon: "+49 511 000", Ort: "Hannover", PLZ: "30159"})
	if err != nil {
		t.Fatal(err)
	}
	for _, muss := range []string{"BEGIN:VCARD", "VERSION:3.0", "N:Rose;Tim;;;", "FN:Tim Rose",
		"ORG:hnvr.me", "EMAIL;TYPE=INTERNET:tim@hnvr.me", "END:VCARD"} {
		if !strings.Contains(text, muss) {
			t.Errorf("in der Karte fehlt %q", muss)
		}
	}
	if _, err := VCard(Karte{}); err == nil {
		t.Error("eine Karte ohne Namen und Firma muss abgelehnt werden")
	}
}

func TestVCardSchuetztSonderzeichen(t *testing.T) {
	text, _ := VCard(Karte{Nachname: "Meier; Schulz, GmbH"})
	if !strings.Contains(text, `Meier\; Schulz\, GmbH`) {
		t.Errorf("Semikolon und Komma muessen geschuetzt werden: %q", text)
	}
}

func TestWLAN(t *testing.T) {
	text, err := WLAN(Netz{SSID: "Gast", Passwort: "geheim123", Art: "WPA2"})
	if err != nil {
		t.Fatal(err)
	}
	if text != "WIFI:T:WPA;S:Gast;P:geheim123;;" {
		t.Errorf("WLAN-Zeichenkette falsch: %q", text)
	}
	offen, _ := WLAN(Netz{SSID: "Frei", Art: "nopass"})
	if strings.Contains(offen, "P:") {
		t.Errorf("ein offenes Netz braucht kein Passwortfeld: %q", offen)
	}
	if _, err := WLAN(Netz{SSID: "X", Art: "WPA"}); err == nil {
		t.Error("verschluesseltes Netz ohne Passwort muss abgelehnt werden")
	}
	geschuetzt, _ := WLAN(Netz{SSID: "Cafe;Bar", Passwort: `a:b\c`, Art: "WPA"})
	if !strings.Contains(geschuetzt, `S:Cafe\;Bar;`) {
		t.Errorf("Semikolon im Netznamen muss geschuetzt werden: %q", geschuetzt)
	}
}
