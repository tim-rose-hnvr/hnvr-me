package vorlage

import (
	"errors"
	"strings"
	"testing"
)

func kursvorlage() Vorlage {
	return Vorlage{
		ID: "kursankuendigung", KundeID: "bothe", Name: "Kursankündigung",
		Format:      "4:5",
		BildPflicht: true,
		Felder: []Feld{
			{Name: "kick", Beschriftung: "Zeile oben", Pflicht: true, Hoechstlaenge: 24},
			{Name: "titel", Beschriftung: "Überschrift", Pflicht: true, Hoechstlaenge: 60},
			{Name: "zusatz", Beschriftung: "Zusatz", Hoechstlaenge: 90, Mehrzeilig: true},
		},
		Aufbau: map[string]string{
			"standard":  "{titel}\n\n{zusatz}",
			"INSTAGRAM": "{titel}\n\n{zusatz}\n\n#tanzschulebothe",
		},
	}
}

func TestPflichtfeldFehlt(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{"titel": "Herbstkurs"}, "bild.jpg")
	if err == nil {
		t.Fatal("fehlendes Pflichtfeld wurde durchgelassen")
	}
	if !strings.Contains(err.Error(), "kick") {
		t.Fatalf("Meldung nennt das Feld nicht: %v", err)
	}
}

func TestZuLangWirdAbgewiesen(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{
		"kick":  strings.Repeat("x", 25),
		"titel": "Herbstkurs",
	}, "bild.jpg")
	if err == nil {
		t.Fatal("zu langer Wert wurde durchgelassen")
	}
	if !strings.Contains(err.Error(), "25") || !strings.Contains(err.Error(), "24") {
		t.Fatalf("Meldung sagt nicht, wie lang es ist und wie lang es sein darf: %v", err)
	}
}

// Umlaute zählen als ein Zeichen, nicht als zwei Bytes.
func TestLaengeZaehltZeichenNichtBytes(t *testing.T) {
	v := kursvorlage()
	// 24 Umlaute = 24 Zeichen, 48 Bytes. Muss durchgehen.
	err := v.Pruefe(map[string]string{
		"kick":  strings.Repeat("ä", 24),
		"titel": "Herbstkurs",
	}, "bild.jpg")
	if err != nil {
		t.Fatalf("24 Umlaute wurden abgewiesen: %v", err)
	}
}

func TestUnbekanntesFeldWirdAbgewiesen(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{
		"kick": "Kursstart", "titel": "Herbstkurs",
		"schriftfarbe": "#FF0000", // Versuch, an der Vorlage vorbeizuschreiben
	}, "bild.jpg")
	if err == nil {
		t.Fatal("ein unbekanntes Feld wurde stillschweigend angenommen")
	}
	if !strings.Contains(err.Error(), "schriftfarbe") {
		t.Fatalf("Meldung nennt das Feld nicht: %v", err)
	}
}

func TestEinzeiligesFeldNimmtKeinenUmbruch(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{
		"kick": "Kurs\nstart", "titel": "Herbstkurs",
	}, "bild.jpg")
	if err == nil {
		t.Fatal("Umbruch in einem einzeiligen Feld wurde durchgelassen")
	}
}

func TestBildPflicht(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{"kick": "Kursstart", "titel": "Herbstkurs"}, "  ")
	if err == nil {
		t.Fatal("fehlendes Pflichtbild wurde durchgelassen")
	}
	if !strings.Contains(err.Error(), "Bild") {
		t.Fatalf("Meldung spricht nicht vom Bild: %v", err)
	}
}

// Alle Beanstandungen auf einmal, nicht eine nach der anderen.
func TestAlleFehlerAufEinmal(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{"zusatz": strings.Repeat("y", 200)}, "")
	var liste Fehlerliste
	if !errors.As(err, &liste) {
		t.Fatalf("erwartet Fehlerliste, bekommen %T", err)
	}
	if len(liste) < 3 {
		t.Fatalf("nur %d Beanstandungen: %v", len(liste), liste)
	}
}

func TestGueltigGehtDurch(t *testing.T) {
	v := kursvorlage()
	err := v.Pruefe(map[string]string{
		"kick": "Kursstart", "titel": "Herbstkurs — Anmeldung offen",
		"zusatz": "Ab 8. September,\ndienstags 19:30",
	}, "https://example.invalid/saal.jpg")
	if err != nil {
		t.Fatalf("gültige Eingabe abgewiesen: %v", err)
	}
}

// ---- Textaufbau ----

func TestAufbauJeKanal(t *testing.T) {
	v := kursvorlage()
	werte := map[string]string{
		"kick": "Kursstart", "titel": "Herbstkurs — Anmeldung offen",
		"zusatz": "Ab 8. September",
	}

	fb := v.Setze("FACEBOOK", werte)
	if fb != "Herbstkurs — Anmeldung offen\n\nAb 8. September" {
		t.Fatalf("Facebook-Text unerwartet: %q", fb)
	}

	ig := v.Setze("INSTAGRAM", werte)
	if !strings.HasSuffix(ig, "#tanzschulebothe") {
		t.Fatalf("Instagram bekam nicht sein eigenes Muster: %q", ig)
	}
	if ig == fb {
		t.Fatal("beide Kanäle bekamen denselben Text")
	}
}

// Ein leeres Feld darf keine Leerzeilenwüste hinterlassen.
func TestLeeresFeldHinterlaesstKeineLuecke(t *testing.T) {
	v := kursvorlage()
	raus := v.Setze("FACEBOOK", map[string]string{
		"kick": "Kursstart", "titel": "Herbstkurs", "zusatz": "",
	})
	if strings.Contains(raus, "\n\n\n") || strings.HasSuffix(raus, "\n") {
		t.Fatalf("Leerzeilen blieben stehen: %q", raus)
	}
	if raus != "Herbstkurs" {
		t.Fatalf("unerwartet: %q", raus)
	}
}

func TestOhneMusterAlleFelderNacheinander(t *testing.T) {
	v := kursvorlage()
	v.Aufbau = nil
	raus := v.Setze("FACEBOOK", map[string]string{
		"kick": "Kursstart", "titel": "Herbstkurs", "zusatz": "Ab September",
	})
	for _, will := range []string{"Kursstart", "Herbstkurs", "Ab September"} {
		if !strings.Contains(raus, will) {
			t.Fatalf("%q fehlt in %q", will, raus)
		}
	}
}

// ---- Kanalgrenzen ----

func TestTextZuLangFuerKanal(t *testing.T) {
	lang := strings.Repeat("a", 2201)
	if err := PasstAufKanal("INSTAGRAM", lang); err == nil {
		t.Fatal("2201 Zeichen wurden für Instagram durchgelassen")
	}
	if err := PasstAufKanal("FACEBOOK", lang); err != nil {
		t.Fatalf("Facebook verträgt das, wurde aber abgewiesen: %v", err)
	}
}

func TestUnbekannterKanalOhneGrenze(t *testing.T) {
	if err := PasstAufKanal("MASTODON", strings.Repeat("a", 10000)); err != nil {
		t.Fatalf("unbekannter Kanal darf keine Grenze erfinden: %v", err)
	}
}

func TestFinde(t *testing.T) {
	alle := []Vorlage{kursvorlage()}
	if _, ok := Finde(alle, "kursankuendigung"); !ok {
		t.Fatal("vorhandene Vorlage nicht gefunden")
	}
	if _, ok := Finde(alle, "gibtsnicht"); ok {
		t.Fatal("nicht vorhandene Vorlage gefunden")
	}
}

// ---- Rundbrief ----

func briefvorlage() Vorlage {
	return Vorlage{
		ID: "monatspost", KundeID: "bothe", Name: "Monatspost", Format: "brief",
		Felder: []Feld{
			{Name: "kick", Beschriftung: "Zeile oben"},
			{Name: "titel", Beschriftung: "Überschrift", Pflicht: true},
			{Name: "zusatz", Beschriftung: "Text", Mehrzeilig: true},
		},
		Marke: Marke{Grund: "#000000", Schriftfarbe: "#FFFFFF",
			Akzent: "#9BBE00", Zweitakzent: "#D8063A"},
	}
}

// Der Platzhalter muss den Brief unverändert verlassen. html/template
// normalisiert alles in einem href — eine Marke mit geschweiften Klammern
// kam prozentkodiert an und wäre von Wix nie ersetzt worden.
func TestAbmeldeplatzhalterUeberstehtUnveraendert(t *testing.T) {
	_, html := briefvorlage().Brief(
		map[string]string{"titel": "Herbstkurs"}, "", "Tanzschule Bothe")
	if !strings.Contains(html, Abmeldeplatzhalter) {
		t.Fatalf("Platzhalter %q steht nicht im Brief", Abmeldeplatzhalter)
	}
	if strings.Contains(html, "%7b") || strings.Contains(html, "%7B") {
		t.Fatal("der Platzhalter wurde prozentkodiert")
	}
}

func TestBriefTraegtMarkenfarben(t *testing.T) {
	_, html := briefvorlage().Brief(
		map[string]string{"titel": "Herbstkurs"}, "", "Bothe")
	for _, farbe := range []string{"#000000", "#FFFFFF", "#9BBE00", "#D8063A"} {
		if !strings.Contains(html, farbe) {
			t.Fatalf("Farbe %s fehlt im Brief", farbe)
		}
	}
}

// Was die Kundin tippt, bleibt Text — auch wenn es nach Auszeichnung aussieht.
func TestBriefMaskiertEingaben(t *testing.T) {
	_, html := briefvorlage().Brief(map[string]string{
		"titel":  `<script>alert(1)</script>`,
		"zusatz": `Preis < 10 & "günstig"`,
	}, "", "Bothe")
	if strings.Contains(html, "<script>") {
		t.Fatal("eingetippte Auszeichnung landete unmaskiert im Brief")
	}
	if !strings.Contains(html, "&lt;script&gt;") {
		t.Fatal("die Eingabe fehlt ganz statt maskiert dazustehen")
	}
	if !strings.Contains(html, "&amp;") {
		t.Fatal("kaufmännisches Und wurde nicht maskiert")
	}
}

func TestBriefOhneBildBleibtHeil(t *testing.T) {
	betreff, html := briefvorlage().Brief(
		map[string]string{"titel": "Kurzmeldung"}, "", "Bothe")
	if betreff != "Kurzmeldung" {
		t.Fatalf("Betreff = %q", betreff)
	}
	if strings.Contains(html, "<img") {
		t.Fatal("ohne Bildadresse darf kein Bildelement entstehen")
	}
}

func TestBriefMehrzeiligWirdZuAbsaetzen(t *testing.T) {
	_, html := briefvorlage().Brief(map[string]string{
		"titel": "Herbstkurs", "zusatz": "Erste Zeile\nZweite Zeile",
	}, "", "Bothe")
	if n := strings.Count(html, "Erste Zeile"); n != 1 {
		t.Fatalf("erste Zeile %dmal gefunden", n)
	}
	if !strings.Contains(html, "Zweite Zeile") {
		t.Fatal("zweite Zeile fehlt")
	}
}
