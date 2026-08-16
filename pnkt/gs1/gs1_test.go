package gs1

import "testing"

func TestPruefziffer(t *testing.T) {
	z, err := Pruefziffer("400638133393")
	if err != nil || z != 1 {
		t.Errorf("Pruefziffer %d (Fehler %v), erwartet 1", z, err)
	}
}

func TestPruefeGTIN(t *testing.T) {
	if g, err := PruefeGTIN("4006381333931"); err != nil || g != "04006381333931" {
		t.Errorf("gueltige EAN-13 abgelehnt: %q %v", g, err)
	}
	if _, err := PruefeGTIN("4006381333930"); err == nil {
		t.Error("falsche Pruefziffer nicht erkannt")
	}
	if _, err := PruefeGTIN("40063813339"); err == nil {
		t.Error("falsche Laenge nicht erkannt")
	}
	if _, err := PruefeGTIN("4006381abc931"); err == nil {
		t.Error("Buchstaben nicht erkannt")
	}
	if g, err := PruefeGTIN("4006 381-333931"); err != nil || g != "04006381333931" {
		t.Errorf("Leer- und Bindestriche muessen wegfallen: %q %v", g, err)
	}
}

func TestDigitalLinkBauenUndLesen(t *testing.T) {
	url, err := DigitalLink(Angaben{GTIN: "4006381333931", Charge: "A77", Verfaellt: "271231"}, "https://pnkt.me")
	if err != nil {
		t.Fatal(err)
	}
	soll := "https://pnkt.me/01/04006381333931/10/A77?17=271231"
	if url != soll {
		t.Errorf("URL %q statt %q", url, soll)
	}
	zurueck, err := LiesDigitalLink(url)
	if err != nil {
		t.Fatal(err)
	}
	if zurueck.GTIN != "04006381333931" || zurueck.Charge != "A77" || zurueck.Verfaellt != "271231" {
		t.Errorf("Rueckweg falsch: %+v", zurueck)
	}
}

func TestDigitalLinkLehntFalscheGTINAb(t *testing.T) {
	if _, err := DigitalLink(Angaben{GTIN: "123"}, ""); err == nil {
		t.Error("ungueltige GTIN muss abgelehnt werden, bevor etwas gedruckt wird")
	}
}
