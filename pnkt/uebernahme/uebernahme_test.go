package uebernahme

import (
	"strings"
	"testing"

	"pnkt.me/pnkt/speicher"
)

// Die Zeilen in diesen Pruefungen sind der echte Bestand aus dem
// Wix-Projekt PUNKT, gekuerzt um das, was hier nichts zur Sache tut.
// Erfundene Beispieldaten haetten die beiden Fallen nicht enthalten, an
// denen eine Uebernahme wirklich scheitert: Zeiten in zwei Schreibweisen
// und JSON, das als Zeichenkette in einem Feld liegt.
const codeAntwort = `{"dataItems":[
 {"id":"2acbf6a9","dataCollectionId":"PK_Codes","data":{
   "_id":"2acbf6a9","name":"Ohne Bezeichnung","kuerzel":"2cnjdq","typ":"url",
   "kontoId":"konto1","aktiv":true,"scans":7,"ordnerId":null,
   "erstellt":"2026-08-12T19:00:50.516Z","geaendert":"2026-08-12T19:00:50.516Z",
   "_createdDate":{"$date":"2026-08-12T19:00:50.622Z"},
   "ziel":"https://pnkt.me",
   "regelnJson":"{\"standard\":\"https://pnkt.me\"}",
   "inhaltJson":"{\"url\":\"https://pnkt.me\"}",
   "stilJson":"{\"modulform\":\"quadrat\",\"ruhezone\":4}"}},
 {"id":"9eb4508c","dataCollectionId":"PK_Codes","data":{
   "_id":"9eb4508c","name":"Altzeile","kuerzel":"alt9eb450","aktiv":false,
   "ziel":"https://example.com/zwei","regelnJson":"{\"standard\":\"https://example.com/zwei\"}"}}
]}`

func quelleAusTest(t *testing.T) Quelle {
	t.Helper()
	codes, err := Lies([]byte(codeAntwort))
	if err != nil {
		t.Fatal(err)
	}
	return Quelle{Codes: codes}
}

func ablage(t *testing.T) *speicher.Speicher {
	t.Helper()
	s, err := speicher.Oeffne(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Schliesse() })
	return s
}

func TestLiestBeideFormen(t *testing.T) {
	mitHuelle, err := Lies([]byte(`{"dataItems":[{"id":"a","data":{"kuerzel":"eins"}}]}`))
	if err != nil || len(mitHuelle) != 1 || text(mitHuelle[0], "kuerzel") != "eins" {
		t.Fatalf("Huellenform nicht gelesen: %v %v", mitHuelle, err)
	}
	// Die Kennung wandert aus der Huelle ins Feld, wenn sie dort fehlt.
	if text(mitHuelle[0], "_id") != "a" {
		t.Error("Kennung aus der Huelle nicht uebernommen")
	}

	blank, err := Lies([]byte(`[{"kuerzel":"zwei"}]`))
	if err != nil || len(blank) != 1 || text(blank[0], "kuerzel") != "zwei" {
		t.Fatalf("blanke Liste nicht gelesen: %v %v", blank, err)
	}

	if _, err := Lies([]byte(`kein json`)); err == nil {
		t.Error("Unsinn haette einen Fehler geben muessen")
	}
}

// Zeiten kommen in derselben Sammlung in zwei Schreibweisen vor.
func TestZeitInBeidenSchreibweisen(t *testing.T) {
	z := Zeile{
		"a": "2026-08-12T19:00:50.516Z",
		"b": map[string]any{"$date": "2026-08-12T19:00:50.622Z"},
		"c": nil,
	}
	for _, feld := range []string{"a", "b"} {
		if _, da := zeit(z, feld); !da {
			t.Errorf("Feld %s nicht als Zeit gelesen", feld)
		}
	}
	if _, da := zeit(z, "c"); da {
		t.Error("null darf keine Zeit ergeben")
	}
}

// Der wichtigste Umbau: regelnJson ist Text, Regeln ist eine Struktur.
func TestJsonInEinerZeichenketteWirdStruktur(t *testing.T) {
	b := Fuehre(quelleAusTest(t), ablage(t), true)

	if len(b.Codes) != 2 {
		t.Fatalf("erwartet 2 Codes, bekommen %d", len(b.Codes))
	}
	c := b.Codes[0]
	if c.Regeln == nil || c.Regeln["standard"] != "https://pnkt.me" {
		t.Errorf("Regelwerk nicht als Struktur angekommen: %#v", c.Regeln)
	}
	if c.Stil == nil || c.Stil["modulform"] != "quadrat" {
		t.Errorf("Stil nicht angekommen: %#v", c.Stil)
	}
	if c.Inhalt == nil || c.Inhalt["url"] != "https://pnkt.me" {
		t.Errorf("Inhalt nicht angekommen: %#v", c.Inhalt)
	}
	if c.Herkunft != "wix" {
		t.Errorf("Herkunft fehlt: %q", c.Herkunft)
	}
	if c.Erstellt.IsZero() || c.Erstellt.Year() != 2026 {
		t.Errorf("Erstellzeit nicht uebernommen: %v", c.Erstellt)
	}
}

// Der Trockenlauf muss dasselbe berichten wie der echte Lauf — sonst
// taugt er nicht als Vorhersage.
func TestTrockenlaufSagtDenEchtenVoraus(t *testing.T) {
	q := quelleAusTest(t)
	trocken := Fuehre(q, ablage(t), true)

	echt := ablage(t)
	nass := Fuehre(q, echt, false)

	if trocken.Genommen["codes"] != nass.Genommen["codes"] {
		t.Errorf("Trockenlauf sagt %d Codes voraus, der echte nahm %d",
			trocken.Genommen["codes"], nass.Genommen["codes"])
	}
	if trocken.Fehler() != nass.Fehler() {
		t.Errorf("Fehlerzahl weicht ab: trocken %d, echt %d", trocken.Fehler(), nass.Fehler())
	}

	// Und der Trockenlauf darf wirklich nichts geschrieben haben.
	leer := ablage(t)
	Fuehre(q, leer, true)
	if n := len(leer.Liste("")); n != 0 {
		t.Errorf("der Trockenlauf hat %d Codes geschrieben", n)
	}

	// Der echte dagegen schon, und die Weiterleitung findet sie.
	if _, da := echt.NachKuerzel("2cnjdq"); !da {
		t.Error("uebernommener Code nicht ueber sein Kuerzel auffindbar")
	}
}

// Ein doppeltes Kuerzel innerhalb der Quelle muss schon im Trockenlauf
// auffallen. Sonst meldet er alles gruen und der echte Lauf bricht auf
// halber Strecke ab.
func TestDoppeltesKuerzelInDerQuelle(t *testing.T) {
	codes, err := Lies([]byte(`[
	  {"_id":"a","kuerzel":"gleich","ziel":"https://a.de"},
	  {"_id":"b","kuerzel":"GLEICH","ziel":"https://b.de"}]`))
	if err != nil {
		t.Fatal(err)
	}
	b := Fuehre(Quelle{Codes: codes}, ablage(t), true)
	if b.Fehler() != 1 {
		t.Fatalf("erwartet ein Fehler, bekommen %d: %+v", b.Fehler(), b.Befunde)
	}
	if b.Genommen["codes"] != 1 {
		t.Errorf("erwartet 1 uebernommener Code, bekommen %d", b.Genommen["codes"])
	}
}

func TestZeileOhneKuerzelWirdAbgelehnt(t *testing.T) {
	codes, _ := Lies([]byte(`[{"_id":"a","ziel":"https://a.de"}]`))
	b := Fuehre(Quelle{Codes: codes}, ablage(t), true)
	if b.Fehler() != 1 || b.Genommen["codes"] != 0 {
		t.Errorf("Zeile ohne Kuerzel muesste abgelehnt werden: %+v", b.Befunde)
	}
}

func TestPasswortabdruckWandertUnveraendert(t *testing.T) {
	konten, _ := Lies([]byte(`[{"_id":"k1","mail":"a@example.de","name":"A",
	  "pwHash":"pbkdf2$210000$abcdef$0123456789"}]`))
	s := ablage(t)
	b := Fuehre(Quelle{Konten: konten}, s, false)

	if b.Genommen["konten"] != 1 {
		t.Fatalf("Konto nicht uebernommen: %+v", b.Befunde)
	}
	k, da := s.KontoNachMail("a@example.de")
	if !da {
		t.Fatal("Konto nicht wiedergefunden")
	}
	if k.Salz != "abcdef" || k.Abdruck != "0123456789" {
		t.Errorf("Abdruck verändert: Salz %q, Abdruck %q", k.Salz, k.Abdruck)
	}
	if k.Rolle != speicher.RolleInhaber {
		t.Errorf("Rolle sollte Inhaber sein, ist %q", k.Rolle)
	}

	// Ein Abdruck in fremder Form wird nicht geraten.
	schief, _ := Lies([]byte(`[{"_id":"k2","mail":"b@example.de","pwHash":"bcrypt$12$xyz"}]`))
	if b := Fuehre(Quelle{Konten: schief}, ablage(t), true); b.Fehler() != 1 {
		t.Errorf("fremdes Abdruckverfahren muesste ein Fehler sein: %+v", b.Befunde)
	}
}

// Mitarbeitende haengen in Wix nur an einer E-Mail. Ohne passendes Konto
// laesst sich niemand binden — und das gehoert in den Bericht, nicht
// stillschweigend uebergangen.
func TestMitgliedOhneKonto(t *testing.T) {
	mitglieder, _ := Lies([]byte(`[{"_id":"m1","mail":"fremd@example.de","rolle":"redakteur","kontoId":"k1"}]`))
	b := Fuehre(Quelle{Mitglieder: mitglieder}, ablage(t), true)

	if b.Genommen["mitglieder"] != 0 {
		t.Error("Mitglied ohne Konto haette nicht gebunden werden duerfen")
	}
	if len(b.Befunde) == 0 || !strings.Contains(b.Befunde[0].Text, "kein Konto") {
		t.Errorf("Befund fehlt: %+v", b.Befunde)
	}
}

func TestMitgliedMitKontoWirdGebunden(t *testing.T) {
	konten, _ := Lies([]byte(`[{"_id":"k1","mail":"chef@example.de","pwHash":"pbkdf2$210000$s$a"},
	                           {"_id":"k2","mail":"hilfe@example.de","pwHash":"pbkdf2$210000$s2$a2"}]`))
	mitglieder, _ := Lies([]byte(`[{"_id":"m1","mail":"hilfe@example.de","rolle":"redakteur","kontoId":"k1"}]`))

	s := ablage(t)
	b := Fuehre(Quelle{Konten: konten, Mitglieder: mitglieder}, s, false)
	if b.Genommen["mitglieder"] != 1 {
		t.Fatalf("Mitglied nicht gebunden: %+v", b.Befunde)
	}
	// Mitarbeitende zaehlt den Inhaber mit; gesucht ist der Zugang, der
	// dazugekommen ist.
	var gefunden map[string]string
	for _, p := range s.Mitarbeitende("k1") {
		if p["mail"] == "hilfe@example.de" {
			gefunden = p
		}
	}
	if gefunden == nil || gefunden["rolle"] != "redakteur" {
		t.Errorf("Mitarbeitende unerwartet: %+v", s.Mitarbeitende("k1"))
	}
}

func TestUnbekannteRolleWirdLeser(t *testing.T) {
	konten, _ := Lies([]byte(`[{"_id":"k1","mail":"a@example.de","pwHash":"pbkdf2$210000$s$a"}]`))
	mitglieder, _ := Lies([]byte(`[{"_id":"m1","mail":"a@example.de","rolle":"hauptmann","kontoId":"k9"}]`))
	s := ablage(t)
	Fuehre(Quelle{Konten: konten, Mitglieder: mitglieder}, s, false)

	k, _ := s.KontoNachMail("a@example.de")
	if k.Rolle != speicher.RolleLeser {
		t.Errorf("unbekannte Rolle muesste Leser werden, ist %q", k.Rolle)
	}
}

// Der teuerste Befund einer Uebernahme: Kuerzel, die im Protokoll als
// geloescht stehen und in den Codes fehlen. In der Quelle sind sie wieder
// frei — obwohl sie auf Papier stehen.
func TestVerwaisteKuerzelWerdenGesperrt(t *testing.T) {
	codes, _ := Lies([]byte(`[{"_id":"a","kuerzel":"lebt","ziel":"https://a.de"}]`))
	ereignisse, _ := Lies([]byte(`[
	  {"_id":"e1","was":"code.geloescht","gegenstand":"x","altJson":"{\"kuerzel\":\"weg1\"}"},
	  {"_id":"e2","was":"code.geloescht","gegenstand":"x","altJson":"{\"kuerzel\":\"weg1\"}"},
	  {"_id":"e3","was":"code.geloescht","gegenstand":"y","altJson":"{\"kuerzel\":\"lebt\"}"},
	  {"_id":"e4","was":"code.angelegt","gegenstand":"a","neuJson":"{\"kuerzel\":\"lebt\"}"}]`))
	q := Quelle{Codes: codes, Ereignisse: ereignisse}

	// weg1 einmal, obwohl es zweimal im Protokoll steht. "lebt" gehoert
	// nicht dazu: das Kuerzel wurde neu vergeben und lebt wieder.
	verwaist := VerwaisteKuerzel(q)
	if len(verwaist) != 1 || verwaist[0] != "weg1" {
		t.Fatalf("erwartet [weg1], bekommen %v", verwaist)
	}

	s := ablage(t)
	b := Fuehre(q, s, false)
	SperreVerwaiste(q, "konto1", s, false, b)

	// In keiner Liste …
	for _, c := range s.Liste("") {
		if c.Kuerzel == "weg1" {
			t.Error("verwaistes Kuerzel steht in der Liste")
		}
	}
	// … aber belegt, und ein Scan findet eine lesbare Seite.
	if err := s.LegeAn(&speicher.Code{Kuerzel: "weg1", Ziel: "https://neu.de"}); err == nil {
		t.Error("verwaistes Kuerzel liess sich neu vergeben")
	}
	c, da := s.NachKuerzel("weg1")
	if !da || !c.Geloescht {
		t.Error("verwaistes Kuerzel ist nicht als geloescht hinterlegt")
	}
}

// Eine Gesamtzahl ohne Tage laesst sich nicht aufteilen. Sie kommt als
// eine Zeile herein und bleibt als solche erkennbar.
func TestScansKommenAlsKlumpen(t *testing.T) {
	s := ablage(t)
	b := Fuehre(quelleAusTest(t), s, false)

	if b.Scans != 7 {
		t.Errorf("erwartet 7 Scans, bekommen %d", b.Scans)
	}
	stand := s.Zaehlerstand("2acbf6a9")
	if len(stand) != 1 {
		t.Fatalf("erwartet eine Zaehlerzeile, bekommen %d", len(stand))
	}
	if stand[0].Gesamt != 7 || stand[0].Zaehler["herkunft:uebernahme"] != 7 {
		t.Errorf("Klumpenzahl nicht erkennbar abgelegt: %+v", stand[0])
	}
	if stand[0].Tag != "2026-08-12" {
		t.Errorf("Klumpen sollte am Anlagetag liegen, liegt am %s", stand[0].Tag)
	}
}

func TestZweimalUebernehmenLegtNichtDoppeltAn(t *testing.T) {
	q := quelleAusTest(t)
	s := ablage(t)

	Fuehre(q, s, false)
	zweiter := Fuehre(q, s, false)

	if zweiter.Genommen["codes"] != 0 {
		t.Errorf("der zweite Lauf hat %d Codes noch einmal angelegt", zweiter.Genommen["codes"])
	}
	if n := len(s.Liste("")); n != 2 {
		t.Errorf("erwartet 2 Codes nach zwei Laeufen, bekommen %d", n)
	}
}

func TestBerichtNenntWasErTat(t *testing.T) {
	b := Fuehre(quelleAusTest(t), ablage(t), true)
	text := b.Text()
	for _, wort := range []string{"Trockenlauf", "codes", "2cnjdq", "0 Fehler"} {
		if !strings.Contains(text, wort) {
			t.Errorf("im Bericht fehlt %q:\n%s", wort, text)
		}
	}
}
