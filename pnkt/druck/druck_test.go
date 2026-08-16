package druck

import "testing"

func vorgabe() Vorgabe {
	return Vorgabe{BreiteMm: 40, ModuleJeKante: 29, Fehlerkorrektur: "M",
		Verfahren: "offset", RuhezoneModule: 4, Vordergrund: "#000000", Hintergrund: "#ffffff"}
}

func TestDruckreif(t *testing.T) {
	u := Pruefe(vorgabe())
	if !u.Druckreif || u.Note != "A" {
		t.Errorf("40 mm im Offset sollten Note A ergeben, sind %s: %+v", u.Note, u.Befunde)
	}
}

func TestZuKleinFuerSiebdruck(t *testing.T) {
	v := vorgabe()
	v.BreiteMm, v.Verfahren = 8, "siebdruck"
	u := Pruefe(v)
	if u.Druckreif {
		t.Error("8 mm im Siebdruck duerfen nicht durchgehen")
	}
	if u.KleinsteMm < 14 {
		t.Errorf("kleinste Breite %.1f mm ist zu niedrig angesetzt", u.KleinsteMm)
	}
}

func TestUmgekehrterCode(t *testing.T) {
	v := vorgabe()
	v.Vordergrund, v.Hintergrund = "#ffffff", "#111111"
	u := Pruefe(v)
	if u.Druckreif {
		t.Error("heller Code auf dunklem Grund muss beanstandet werden")
	}
}

func TestSchwacherKontrast(t *testing.T) {
	v := vorgabe()
	v.Vordergrund, v.Hintergrund = "#777777", "#8a8a8a"
	u := Pruefe(v)
	if u.Druckreif {
		t.Errorf("Kontrast %.1f zu 1 darf nicht druckreif sein", u.Kontrast)
	}
}

func TestKasseVerlangtGroessereModule(t *testing.T) {
	v := vorgabe()
	v.BreiteMm, v.FuerKasse = 10, true
	u := Pruefe(v)
	if u.Druckreif {
		t.Errorf("0,34 mm je Modul reicht fuer die Kasse nicht: %+v", u.Befunde)
	}
	v.BreiteMm = 20
	if u := Pruefe(v); !u.Druckreif {
		t.Errorf("20 mm sollten fuer die Kasse reichen: %+v", u.Befunde)
	}
}

func TestLogoGegenReserve(t *testing.T) {
	v := vorgabe()
	v.Fehlerkorrektur, v.LogoAnteil = "L", 0.4 // 16 % Flaeche bei 7 % Reserve
	if u := Pruefe(v); u.Druckreif {
		t.Error("Logo groesser als die Reserve muss durchfallen")
	}
	v.Fehlerkorrektur, v.LogoAnteil = "H", 0.2 // 4 % bei 30 % Reserve
	if u := Pruefe(v); !u.Druckreif {
		t.Error("kleines Logo bei Stufe H ist zulaessig")
	}
}

func TestRuhezone(t *testing.T) {
	v := vorgabe()
	v.RuhezoneModule = 1
	if u := Pruefe(v); u.Druckreif {
		t.Error("Ruhezone unter 4 Modulen muss beanstandet werden")
	}
}
