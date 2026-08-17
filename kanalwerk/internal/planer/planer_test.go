package planer

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/speicher"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/vorlage"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/wix"
)

// ---- Doppel für die Wix-Schnittstelle ----

type fakeWix struct {
	kontingent wix.Kontingent
	kontFehler error
	rufe       []wix.Beitragsentwurf
	antwort    wix.Veroeffentlicht
	fehler     error
	konten     map[string][]wix.Konto
	zustaende  map[string]wix.Kanalzustand

	mailkonto   wix.Mailkonto
	kontakte    []wix.Kontakt
	kontakteGes int
	briefe      []wix.Rundbrief
	briefFehler error
}

func (f *fakeWix) Kontingent(_ context.Context, _, _ string) (wix.Kontingent, error) {
	return f.kontingent, f.kontFehler
}

func (f *fakeWix) Veroeffentliche(_ context.Context, _ string, e wix.Beitragsentwurf) (wix.Veroeffentlicht, error) {
	f.rufe = append(f.rufe, e)
	if f.fehler != nil {
		return wix.Veroeffentlicht{}, f.fehler
	}
	a := f.antwort
	if a.ItemID == "" {
		a.ItemID = "item-" + e.Kanal
	}
	return a, nil
}

func (f *fakeWix) Konten(_ context.Context, _, kanal string) ([]wix.Konto, wix.Kanalzustand, error) {
	z, ok := f.zustaende[kanal]
	if !ok {
		z = wix.NieVerbunden
	}
	return f.konten[kanal], z, nil
}

func (f *fakeWix) Mailkonto(context.Context, string) (wix.Mailkonto, error) {
	return f.mailkonto, nil
}

func (f *fakeWix) Kontakte(_ context.Context, _ string, _ int) ([]wix.Kontakt, int, error) {
	ges := f.kontakteGes
	if ges == 0 {
		ges = len(f.kontakte)
	}
	return f.kontakte, ges, nil
}

func (f *fakeWix) SendeRundbrief(_ context.Context, _ string, r wix.Rundbrief) (wix.Versandt, error) {
	f.briefe = append(f.briefe, r)
	if f.briefFehler != nil {
		return wix.Versandt{}, f.briefFehler
	}
	return wix.Versandt{ID: "sendung-1", Zustand: "ACCEPTED", Anzahl: len(r.KontaktIDs)}, nil
}

// ---- Gerüst ----

func aufbau(t *testing.T, w *fakeWix) (*Planer, string) {
	t.Helper()
	s, err := speicher.Oeffne("")
	if err != nil {
		t.Fatalf("Speicher: %v", err)
	}
	if err := s.SetzeKunde(speicher.Kunde{ID: "bothe", Name: "Tanzschule Bothe", WixSiteID: "site-1"}); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"FACEBOOK", "INSTAGRAM"} {
		if err := s.SetzeKanal(speicher.Kanal{
			ID: "bothe:" + p, KundeID: "bothe", Plattform: p,
			WixKontoID: "konto-" + p, Zustand: string(wix.Verbunden),
		}); err != nil {
			t.Fatal(err)
		}
	}
	p := Neu(s, w)
	p.Jetzt = func() time.Time { return time.Date(2026, 8, 20, 18, 30, 0, 0, time.UTC) }
	return p, "bothe"
}

func beitrag(id string, kanaele ...string) speicher.Beitrag {
	b := speicher.Beitrag{
		ID: id, KundeID: "bothe", VorlageID: "kursankuendigung",
		Text: "Herbstkurs — Anmeldung offen", BildURL: "https://example.invalid/saal.jpg",
		Zustand: speicher.Entwurf, Werte: map[string]string{"kick": "Kursstart"},
	}
	for _, k := range kanaele {
		b.Zustellungen = append(b.Zustellungen, speicher.Zustellung{
			KanalID: "bothe:" + k, Zustand: speicher.ZWartend,
		})
	}
	return b
}

func vollesKontingent() wix.Kontingent {
	return wix.Kontingent{Merkmal: "PUBLISH_POST", Erlaubt: true, Grenze: 10, Verbraucht: 0, Rest: 10}
}

// ---- Regel: ein Item je Kanal ----

func TestJeKanalEinAufruf(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b1", "FACEBOOK", "INSTAGRAM")
	if err := p.S.SetzeBeitrag(b); err != nil {
		t.Fatal(err)
	}
	if err := p.GibFrei("b1", "M. Bothe", ""); err != nil {
		t.Fatal(err)
	}
	if err := p.Plane("b1", p.Jetzt().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}

	n, err := p.Tick(context.Background())
	if err != nil {
		t.Fatalf("Tick: %v", err)
	}
	if n != 2 {
		t.Fatalf("Versuche = %d, erwartet 2", n)
	}
	if len(w.rufe) != 2 {
		t.Fatalf("Wix-Aufrufe = %d, erwartet 2 (je Kanal einer)", len(w.rufe))
	}
	nach, _ := p.S.Beitrag("b1")
	if nach.Zustand != speicher.Veroeffentlicht {
		t.Fatalf("Zustand = %q, erwartet %q", nach.Zustand, speicher.Veroeffentlicht)
	}
}

// ---- Regel: kein Doppelversand ----

func TestKeinDoppelversand(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b2", "FACEBOOK")
	if err := p.S.SetzeBeitrag(b); err != nil {
		t.Fatal(err)
	}
	_ = p.GibFrei("b2", "M. Bothe", "")
	_ = p.Plane("b2", p.Jetzt().Add(-time.Minute))

	if _, err := p.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(w.rufe) != 1 {
		t.Fatalf("erster Lauf: %d Aufrufe, erwartet 1", len(w.rufe))
	}

	// Zweiter Anlauf am selben Beitrag darf nichts mehr hinausgeben.
	if _, err := p.ArbeiteAb(context.Background(), "b2"); err != nil {
		t.Fatal(err)
	}
	if len(w.rufe) != 1 {
		t.Fatalf("nach Wiederholung: %d Aufrufe — der Beitrag wurde verdoppelt", len(w.rufe))
	}
}

// Auch ohne sauberen Zustand darf eine vorhandene Item-ID nie erneut senden.
func TestItemIDSperrtErneutesSenden(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b3", "FACEBOOK")
	b.Zustellungen[0].WixItemID = "schon-draussen"
	b.Zustellungen[0].Zustand = speicher.ZWartend // widersprüchlich, absichtlich
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b3", "M. Bothe", "")
	_ = p.Plane("b3", p.Jetzt().Add(-time.Minute))

	if _, err := p.ArbeiteAb(context.Background(), "b3"); err != nil {
		t.Fatal(err)
	}
	if len(w.rufe) != 0 {
		t.Fatalf("%d Aufrufe trotz vorhandener Item-ID", len(w.rufe))
	}
}

// ---- Regel: Kontingent vor Versand ----

func TestKontingentErschoepft(t *testing.T) {
	w := &fakeWix{kontingent: wix.Kontingent{Erlaubt: true, Grenze: 10, Verbraucht: 10, Rest: 0}}
	p, _ := aufbau(t, w)

	b := beitrag("b4", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b4", "M. Bothe", "")
	_ = p.Plane("b4", p.Jetzt().Add(-time.Minute))

	if _, err := p.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(w.rufe) != 0 {
		t.Fatalf("es wurde trotz erschöpftem Kontingent gesendet (%d Aufrufe)", len(w.rufe))
	}
	nach, _ := p.S.Beitrag("b4")
	z := nach.Zustellungen[0]
	if z.Zustand != speicher.ZFehlgeschlagen {
		t.Fatalf("Zustellungszustand = %q, erwartet %q", z.Zustand, speicher.ZFehlgeschlagen)
	}
	if z.Fehlergrund == "" {
		t.Fatal("Fehlgeschlagen ohne Grund — der Grund muss in der Oberfläche stehen")
	}
}

func TestVeroeffentlichenGesperrt(t *testing.T) {
	w := &fakeWix{kontingent: wix.Kontingent{Erlaubt: false}}
	p, _ := aufbau(t, w)

	b := beitrag("b5", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b5", "M. Bothe", "")
	_ = p.Plane("b5", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.rufe) != 0 {
		t.Fatal("gesendet, obwohl Veröffentlichen gesperrt ist")
	}
}

// ---- Regel: Freigabe verfällt bei Änderung ----

func TestFreigabeVerfaelltBeiTextaenderung(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b6", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	if err := p.GibFrei("b6", "M. Bothe", ""); err != nil {
		t.Fatal(err)
	}

	verfallen, err := p.Aendere("b6", func(x *speicher.Beitrag) {
		x.Text = "Herbstkurs — jetzt anmelden!"
	})
	if err != nil {
		t.Fatal(err)
	}
	if !verfallen {
		t.Fatal("Freigabe hätte verfallen müssen")
	}
	nach, _ := p.S.Beitrag("b6")
	if nach.Zustand != speicher.Entwurf {
		t.Fatalf("Zustand = %q, erwartet %q", nach.Zustand, speicher.Entwurf)
	}
	if err := p.Plane("b6", p.Jetzt()); !errors.Is(err, ErrNichtFreigegeben) {
		t.Fatalf("Plane = %v, erwartet ErrNichtFreigegeben", err)
	}
}

// Ein nachträglich hinzugefügter Kanal hat keine Freigabe.
func TestFreigabeVerfaelltBeiNeuemKanal(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b7", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b7", "M. Bothe", "")

	verfallen, err := p.Aendere("b7", func(x *speicher.Beitrag) {
		x.Zustellungen = append(x.Zustellungen, speicher.Zustellung{
			KanalID: "bothe:INSTAGRAM", Zustand: speicher.ZWartend,
		})
	})
	if err != nil {
		t.Fatal(err)
	}
	if !verfallen {
		t.Fatal("ein zusätzlicher Kanal muss die Freigabe kosten")
	}
}

// Eine Änderung, die nichts ändert, darf die Freigabe nicht kosten.
func TestGleicherInhaltBehaeltFreigabe(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b8", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b8", "M. Bothe", "")

	verfallen, err := p.Aendere("b8", func(x *speicher.Beitrag) {
		x.Werte["kick"] = "Kursstart" // derselbe Wert wie zuvor
	})
	if err != nil {
		t.Fatal(err)
	}
	if verfallen {
		t.Fatal("unveränderter Inhalt darf die Freigabe nicht kosten")
	}
}

// Wird nach dem Planen geändert, geht der Beitrag nicht raus.
func TestAenderungNachPlanenStopptZustellung(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b9", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b9", "M. Bothe", "")
	_ = p.Plane("b9", p.Jetzt().Add(-time.Minute))

	// Am Speicher vorbei ändern, wie es ein zweiter Zugang täte.
	geaendert, _ := p.S.Beitrag("b9")
	geaendert.Text = "anderer Text"
	_ = p.S.SetzeBeitrag(geaendert)

	_, err := p.ArbeiteAb(context.Background(), "b9")
	if !errors.Is(err, ErrFreigabeVerfallen) {
		t.Fatalf("Fehler = %v, erwartet ErrFreigabeVerfallen", err)
	}
	if len(w.rufe) != 0 {
		t.Fatal("es wurde trotz verfallener Freigabe gesendet")
	}
}

// ---- Regel: erloschener Kanal ist ein Vorgang ----

func TestErloschenerKanalWirdVermerkt(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		fehler:     &wix.Fehler{Status: 400, Code: wix.CodeGetrennt, Meldung: "user for this channel is disconnected"},
	}
	p, _ := aufbau(t, w)

	b := beitrag("b10", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b10", "M. Bothe", "")
	_ = p.Plane("b10", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	k, ok := p.S.Kanal("bothe:FACEBOOK")
	if !ok {
		t.Fatal("Kanal verschwunden")
	}
	if k.Zustand != string(wix.Ungueltig) {
		t.Fatalf("Kanalzustand = %q, erwartet %q", k.Zustand, wix.Ungueltig)
	}
	nach, _ := p.S.Beitrag("b10")
	grund := nach.Zustellungen[0].Fehlergrund
	if grund == "" || grund == "wix: USER_IS_DISCONNECTED (HTTP 400): user for this channel is disconnected" {
		t.Fatalf("Fehlergrund %q ist nicht für die Kundin geschrieben", grund)
	}
}

// ---- Regel: Wiederholung mit wachsendem Abstand, gedeckelt ----

func TestWiederholungWaechstUndIstGedeckelt(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		fehler:     &wix.Fehler{Status: 500, Meldung: "kaputt"},
	}
	p, _ := aufbau(t, w)

	b := beitrag("b11", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b11", "M. Bothe", "")
	_ = p.Plane("b11", p.Jetzt().Add(-time.Minute))

	jetzt := p.Jetzt()
	var abstaende []time.Duration
	for i := 0; i < HoechsteVersuche+2; i++ {
		p.Jetzt = func() time.Time { return jetzt }
		_, _ = p.ArbeiteAb(context.Background(), "b11")
		nach, _ := p.S.Beitrag("b11")
		z := nach.Zustellungen[0]
		if z.Versuche > 0 && !z.NaechsterVersuch.IsZero() {
			abstaende = append(abstaende, z.NaechsterVersuch.Sub(jetzt))
		}
		jetzt = jetzt.Add(2 * time.Hour) // Wartezeit überspringen
	}

	if len(w.rufe) > HoechsteVersuche {
		t.Fatalf("%d Aufrufe, Deckel liegt bei %d", len(w.rufe), HoechsteVersuche)
	}
	if len(abstaende) < 2 {
		t.Fatalf("zu wenige Abstände gemessen: %v", abstaende)
	}
	if abstaende[1] <= abstaende[0] {
		t.Fatalf("Abstand wächst nicht: %v", abstaende)
	}
	for _, a := range abstaende {
		if a > time.Hour {
			t.Fatalf("Abstand %v überschreitet den Deckel von einer Stunde", a)
		}
	}
}

// ---- Die Uhr ----

func TestNurFaelligesWirdGesendet(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	frueh := beitrag("faellig", "FACEBOOK")
	spaet := beitrag("spaeter", "FACEBOOK")
	_ = p.S.SetzeBeitrag(frueh)
	_ = p.S.SetzeBeitrag(spaet)
	_ = p.GibFrei("faellig", "M. Bothe", "")
	_ = p.GibFrei("spaeter", "M. Bothe", "")
	_ = p.Plane("faellig", p.Jetzt().Add(-time.Minute))
	_ = p.Plane("spaeter", p.Jetzt().Add(2*time.Hour))

	n, err := p.Tick(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("Versuche = %d, erwartet 1", n)
	}
	spaeter, _ := p.S.Beitrag("spaeter")
	if spaeter.Zustand != speicher.Geplant {
		t.Fatalf("der spätere Beitrag wurde angefasst: %q", spaeter.Zustand)
	}
}

// Es darf nie ein Termin an Wix übergeben werden — SCHEDULE_POST ist gesperrt.
func TestSendetOhneWixTermin(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("b12", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("b12", "M. Bothe", "")
	_ = p.Plane("b12", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.rufe) != 1 {
		t.Fatalf("Aufrufe = %d", len(w.rufe))
	}
	// Der Entwurf trägt kein Terminfeld — die Uhr liegt bei uns.
	if w.rufe[0].Kanal != "FACEBOOK" || w.rufe[0].Text == "" {
		t.Fatalf("Entwurf unvollständig: %+v", w.rufe[0])
	}
}

// ---- Kanalabgleich ----

func TestAbgleichUnterscheidetErloschenVonNieVerbunden(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		konten: map[string][]wix.Konto{
			"LINKEDIN": {{Kanal: "LINKEDIN", ID: "urn:li:org:1", Anzeigename: "Bothe", Standard: true}},
		},
		zustaende: map[string]wix.Kanalzustand{
			"LINKEDIN":  wix.Verbunden,
			"FACEBOOK":  wix.Ungueltig,
			"INSTAGRAM": wix.NieVerbunden,
		},
	}
	p, kunde := aufbau(t, w)

	if err := p.SynchronisiereKanaele(context.Background(), kunde); err != nil {
		t.Fatal(err)
	}

	will := map[string]string{
		"FACEBOOK":  string(wix.Ungueltig),
		"INSTAGRAM": string(wix.NieVerbunden),
	}
	for _, k := range p.S.KanaeleVon(kunde) {
		if erwartet, ok := will[k.Plattform]; ok && k.Zustand != erwartet {
			t.Fatalf("%s: Zustand = %q, erwartet %q", k.Plattform, k.Zustand, erwartet)
		}
	}
	var linkedInGefunden bool
	for _, k := range p.S.KanaeleVon(kunde) {
		if k.Plattform == "LINKEDIN" && k.Zustand == string(wix.Verbunden) {
			linkedInGefunden = true
		}
	}
	if !linkedInGefunden {
		t.Fatal("verbundener LinkedIn-Kanal wurde nicht übernommen")
	}
}

// ---- Vorlage bestimmt den Text je Kanal ----

func TestVorlageSetztTextJeKanal(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	if err := p.S.SetzeVorlage(vorlage.Vorlage{
		ID: "kurs", KundeID: "bothe", Name: "Kursankündigung", Format: "4:5",
		Felder: []vorlage.Feld{
			{Name: "titel", Beschriftung: "Überschrift", Pflicht: true, Hoechstlaenge: 60},
		},
		Aufbau: map[string]string{
			"standard":  "{titel}",
			"INSTAGRAM": "{titel}\n\n#tanzschulebothe",
		},
	}); err != nil {
		t.Fatal(err)
	}

	b := beitrag("v1", "FACEBOOK", "INSTAGRAM")
	b.VorlageID = "kurs"
	b.Werte = map[string]string{"titel": "Herbstkurs"}
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("v1", "M. Bothe", "")
	_ = p.Plane("v1", p.Jetzt().Add(-time.Minute))

	if _, err := p.Tick(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(w.rufe) != 2 {
		t.Fatalf("Aufrufe = %d, erwartet 2", len(w.rufe))
	}

	texte := map[string]string{}
	for _, r := range w.rufe {
		texte[r.Kanal] = r.Text
	}
	if texte["FACEBOOK"] != "Herbstkurs" {
		t.Fatalf("Facebook bekam %q", texte["FACEBOOK"])
	}
	if !strings.Contains(texte["INSTAGRAM"], "#tanzschulebothe") {
		t.Fatalf("Instagram bekam nicht sein eigenes Muster: %q", texte["INSTAGRAM"])
	}
	if texte["FACEBOOK"] == texte["INSTAGRAM"] {
		t.Fatal("beide Kanäle bekamen denselben Text")
	}
}

// Ist der gesetzte Text für einen Kanal zu lang, geht nichts raus.
func TestZuLangerTextGehtNichtRaus(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	_ = p.S.SetzeVorlage(vorlage.Vorlage{
		ID: "lang", KundeID: "bothe", Name: "Lang", Format: "1:1",
		Felder: []vorlage.Feld{{Name: "titel", Beschriftung: "Text"}},
		Aufbau: map[string]string{"standard": "{titel}"},
	})

	b := beitrag("v2", "INSTAGRAM")
	b.VorlageID = "lang"
	b.Werte = map[string]string{"titel": strings.Repeat("a", 2500)}
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("v2", "M. Bothe", "")
	_ = p.Plane("v2", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.rufe) != 0 {
		t.Fatal("ein für Instagram zu langer Text wurde übergeben")
	}
	nach, _ := p.S.Beitrag("v2")
	if g := nach.Zustellungen[0].Fehlergrund; !strings.Contains(g, "zu lang") {
		t.Fatalf("Fehlergrund nennt die Länge nicht: %q", g)
	}
}

// Ohne Vorlage gilt weiterhin der frei getippte Text.
func TestOhneVorlageFreierText(t *testing.T) {
	w := &fakeWix{kontingent: vollesKontingent()}
	p, _ := aufbau(t, w)

	b := beitrag("v3", "FACEBOOK")
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("v3", "M. Bothe", "")
	_ = p.Plane("v3", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.rufe) != 1 || w.rufe[0].Text != "Herbstkurs — Anmeldung offen" {
		t.Fatalf("freier Text ging verloren: %+v", w.rufe)
	}
}

// ---- Rundbrief ----

func mitRundbrief(t *testing.T, w *fakeWix) (*Planer, string) {
	t.Helper()
	p, kunde := aufbau(t, w)
	k, _ := p.S.Kunde(kunde)
	k.AbsenderName = "Tanzschule Bothe"
	k.AbsenderMail = "post@tanzschule-bothe.invalid"
	if err := p.S.SetzeKunde(k); err != nil {
		t.Fatal(err)
	}
	if err := p.S.SetzeKanal(speicher.Kanal{
		ID: "bothe:NEWSLETTER", KundeID: "bothe", Plattform: vorlage.KanalRundbrief,
		Anzeigename: "Newsletter", Zustand: string(wix.Verbunden),
	}); err != nil {
		t.Fatal(err)
	}
	return p, kunde
}

func rundbriefBeitrag(id string) speicher.Beitrag {
	b := beitrag(id)
	b.Zustellungen = []speicher.Zustellung{{KanalID: "bothe:NEWSLETTER", Zustand: speicher.ZWartend}}
	return b
}

// Das Kontingent zählt E-Mails, nicht Aussendungen. 3690 Empfänger passen
// nicht in 200 freie E-Mails — und das muss vorher auffallen.
func TestRundbriefUeberKontingentGehtNichtRaus(t *testing.T) {
	w := &fakeWix{
		kontingent:  vollesKontingent(),
		mailkonto:   wix.Mailkonto{Zustand: "ACTIVE", MailsJeMonat: 200, Verbraucht: 0, Rest: 200},
		kontakte:    []wix.Kontakt{{ID: "k1"}},
		kontakteGes: 3690,
	}
	p, _ := mitRundbrief(t, w)

	_ = p.S.SetzeBeitrag(rundbriefBeitrag("r1"))
	_ = p.GibFrei("r1", "M. Bothe", "")
	_ = p.Plane("r1", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.briefe) != 0 {
		t.Fatal("es wurde verschickt, obwohl die Liste nicht ins Kontingent passt")
	}
	nach, _ := p.S.Beitrag("r1")
	grund := nach.Zustellungen[0].Fehlergrund
	if !strings.Contains(grund, "3690") || !strings.Contains(grund, "200") {
		t.Fatalf("Grund nennt nicht beide Zahlen: %q", grund)
	}
}

func TestRundbriefOhneAbsender(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		mailkonto:  wix.Mailkonto{Zustand: "ACTIVE", MailsJeMonat: 200, Rest: 200},
		kontakte:   []wix.Kontakt{{ID: "k1"}},
	}
	p, kunde := mitRundbrief(t, w)
	k, _ := p.S.Kunde(kunde)
	k.AbsenderMail = ""
	_ = p.S.SetzeKunde(k)

	_ = p.S.SetzeBeitrag(rundbriefBeitrag("r2"))
	_ = p.GibFrei("r2", "M. Bothe", "")
	_ = p.Plane("r2", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.briefe) != 0 {
		t.Fatal("ohne bestätigten Absender wurde verschickt")
	}
}

func TestRundbriefBeiGesperrtemKonto(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		mailkonto:  wix.Mailkonto{Zustand: "SUSPENDED", MailsJeMonat: 200, Rest: 200},
		kontakte:   []wix.Kontakt{{ID: "k1"}},
	}
	p, _ := mitRundbrief(t, w)
	_ = p.S.SetzeBeitrag(rundbriefBeitrag("r3"))
	_ = p.GibFrei("r3", "M. Bothe", "")
	_ = p.Plane("r3", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.briefe) != 0 {
		t.Fatal("bei gesperrtem E-Mail-Konto wurde verschickt")
	}
}

func TestRundbriefGehtRausUndTraegtAbmeldelink(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		mailkonto:  wix.Mailkonto{Zustand: "ACTIVE", MailsJeMonat: 200, Rest: 200},
		kontakte:   []wix.Kontakt{{ID: "k1"}, {ID: "k2"}, {ID: "k3"}},
	}
	p, _ := mitRundbrief(t, w)

	_ = p.S.SetzeVorlage(vorlage.Vorlage{
		ID: "monatspost", KundeID: "bothe", Name: "Monatspost", Format: "brief",
		Felder: []vorlage.Feld{
			{Name: "kick", Beschriftung: "Zeile oben"},
			{Name: "titel", Beschriftung: "Überschrift", Pflicht: true},
			{Name: "zusatz", Beschriftung: "Text", Mehrzeilig: true},
		},
		Marke: vorlage.Marke{Grund: "#000000", Schriftfarbe: "#FFFFFF",
			Akzent: "#9BBE00", Zweitakzent: "#D8063A"},
	})

	b := rundbriefBeitrag("r4")
	b.VorlageID = "monatspost"
	b.Werte = map[string]string{"kick": "August", "titel": "Herbstkurs", "zusatz": "Ab 8. September"}
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("r4", "M. Bothe", "")
	_ = p.Plane("r4", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.briefe) != 1 {
		t.Fatalf("Aussendungen = %d, erwartet 1", len(w.briefe))
	}
	r := w.briefe[0]
	if r.Betreff != "Herbstkurs" {
		t.Fatalf("Betreff = %q", r.Betreff)
	}
	if len(r.KontaktIDs) != 3 {
		t.Fatalf("Empfänger = %d, erwartet 3", len(r.KontaktIDs))
	}
	if r.AbmeldePlatzhalter == "" || !strings.Contains(r.HTML, r.AbmeldePlatzhalter) {
		t.Fatal("der Abmeldelink fehlt im Brief — ohne ihn darf keine Werbemail raus")
	}
	if !strings.Contains(r.HTML, "#9BBE00") || !strings.Contains(r.HTML, "#D8063A") {
		t.Fatal("die Markenfarben stehen nicht im Brief")
	}
	if r.IdempotenzSchluessel == "" {
		t.Fatal("ohne Idempotenzschlüssel kann eine Wiederholung doppelt zustellen")
	}
	if r.AbsenderMail != "post@tanzschule-bothe.invalid" {
		t.Fatalf("Absender = %q", r.AbsenderMail)
	}
}

// Auch der Rundbrief darf nie zweimal rausgehen.
func TestRundbriefNichtDoppelt(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		mailkonto:  wix.Mailkonto{Zustand: "ACTIVE", MailsJeMonat: 200, Rest: 200},
		kontakte:   []wix.Kontakt{{ID: "k1"}},
	}
	p, _ := mitRundbrief(t, w)
	_ = p.S.SetzeBeitrag(rundbriefBeitrag("r5"))
	_ = p.GibFrei("r5", "M. Bothe", "")
	_ = p.Plane("r5", p.Jetzt().Add(-time.Minute))

	_, _ = p.Tick(context.Background())
	_, _ = p.ArbeiteAb(context.Background(), "r5")

	if len(w.briefe) != 1 {
		t.Fatalf("%d Aussendungen — die Kundschaft bekam zweimal Post", len(w.briefe))
	}
}

// Social und Newsletter aus einer Freigabe.
func TestEinBeitragBedientSocialUndNewsletter(t *testing.T) {
	w := &fakeWix{
		kontingent: vollesKontingent(),
		mailkonto:  wix.Mailkonto{Zustand: "ACTIVE", MailsJeMonat: 200, Rest: 200},
		kontakte:   []wix.Kontakt{{ID: "k1"}},
	}
	p, _ := mitRundbrief(t, w)

	b := beitrag("r6", "FACEBOOK")
	b.Zustellungen = append(b.Zustellungen, speicher.Zustellung{
		KanalID: "bothe:NEWSLETTER", Zustand: speicher.ZWartend,
	})
	_ = p.S.SetzeBeitrag(b)
	_ = p.GibFrei("r6", "M. Bothe", "")
	_ = p.Plane("r6", p.Jetzt().Add(-time.Minute))
	_, _ = p.Tick(context.Background())

	if len(w.rufe) != 1 {
		t.Fatalf("Social-Aufrufe = %d, erwartet 1", len(w.rufe))
	}
	if len(w.briefe) != 1 {
		t.Fatalf("Aussendungen = %d, erwartet 1", len(w.briefe))
	}
	nach, _ := p.S.Beitrag("r6")
	if nach.Zustand != speicher.Veroeffentlicht {
		t.Fatalf("Zustand = %q", nach.Zustand)
	}
}
