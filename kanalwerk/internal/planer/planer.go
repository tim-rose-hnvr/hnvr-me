// Package planer trägt die Fachregeln und die Uhr.
//
// Die tragende Entscheidung steht in Zustelle: Wix' eigene Terminierung
// (SCHEDULE_POST) ist auf allen geprüften Sites abgeschaltet. Statt darauf
// zu warten, hält dieser Dienst die Warteschlange selbst und löst zum
// Termin ein Sofort-Veröffentlichen aus. Das verlangt nur PUBLISH_POST,
// und das ist überall erlaubt.
package planer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/speicher"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/vorlage"
	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/wix"
)

// Versender ist der Ausschnitt der Wix-Schnittstelle, den der Planer braucht.
// Als Schnittstelle, damit die Regeln ohne Netz prüfbar sind.
type Versender interface {
	Kontingent(ctx context.Context, siteID, merkmal string) (wix.Kontingent, error)
	Veroeffentliche(ctx context.Context, siteID string, e wix.Beitragsentwurf) (wix.Veroeffentlicht, error)
	Konten(ctx context.Context, siteID, kanal string) ([]wix.Konto, wix.Kanalzustand, error)
}

// HoechsteVersuche begrenzt das Nachbohren. Plattformen sperren die App,
// nicht nur den einzelnen Aufruf, wenn stumpf wiederholt wird.
const HoechsteVersuche = 5

// Planer verbindet Bestand, Wix und Uhr.
type Planer struct {
	S     *speicher.Speicher
	W     Versender
	Jetzt func() time.Time // für Tests austauschbar
}

func Neu(s *speicher.Speicher, w Versender) *Planer {
	return &Planer{S: s, W: w, Jetzt: func() time.Time { return time.Now().UTC() }}
}

// ---- Regel: Freigabe verfällt bei Änderung ----

// InhaltsHash bildet den Inhalt eines Beitrags auf einen Wert ab.
// Ändert sich der Wert, ist eine erteilte Freigabe hinfällig.
func InhaltsHash(b speicher.Beitrag) string {
	h := sha256.New()
	fmt.Fprintf(h, "%s\x00%s\x00%s\x00", b.VorlageID, b.Text, b.BildURL)
	schluessel := make([]string, 0, len(b.Werte))
	for k := range b.Werte {
		schluessel = append(schluessel, k)
	}
	sort.Strings(schluessel)
	for _, k := range schluessel {
		fmt.Fprintf(h, "%s=%s\x00", k, b.Werte[k])
	}
	// Die Kanalauswahl gehört zum freigegebenen Inhalt: wer nachträglich
	// einen Kanal hinzufügt, hat dafür keine Freigabe.
	kanaele := make([]string, 0, len(b.Zustellungen))
	for _, z := range b.Zustellungen {
		kanaele = append(kanaele, z.KanalID)
	}
	sort.Strings(kanaele)
	fmt.Fprintf(h, "kanaele=%s", strings.Join(kanaele, ","))
	return hex.EncodeToString(h.Sum(nil))
}

var (
	ErrNichtFreigegeben         = errors.New("planer: Beitrag ist nicht freigegeben")
	ErrFreigabeVerfallen        = errors.New("planer: Freigabe ist durch eine Änderung verfallen")
	ErrKeinKontingent           = errors.New("planer: Kontingent für diesen Monat erschöpft")
	ErrVeroeffentlichenGesperrt = errors.New("planer: Veröffentlichen ist auf dieser Site nicht erlaubt")
)

// GibFrei erteilt die Freigabe und hält fest, für welchen Inhalt sie gilt.
func (p *Planer) GibFrei(beitragID, person, begruendung string) error {
	b, ok := p.S.Beitrag(beitragID)
	if !ok {
		return fmt.Errorf("planer: Beitrag %s nicht gefunden", beitragID)
	}
	hash := InhaltsHash(b)
	b.InhaltsHash = hash
	b.Zustand = speicher.Freigegeben
	if err := p.S.SetzeBeitrag(b); err != nil {
		return err
	}
	if err := p.S.FuegeFreigabeAn(speicher.Freigabe{
		BeitragID: beitragID, Person: person, Entscheidung: "freigegeben",
		Begruendung: begruendung, InhaltsHash: hash, Zeitpunkt: p.Jetzt(),
	}); err != nil {
		return err
	}
	return p.S.Protokolliere(speicher.Ereignis{
		Zeitpunkt: p.Jetzt(), KundeID: b.KundeID, Art: "freigabe.erteilt",
		Nutzlast: map[string]any{"beitrag": beitragID, "person": person},
	})
}

// PruefeFreigabe setzt einen Beitrag zurück, wenn sein Inhalt sich seit der
// Freigabe geändert hat. Gibt true zurück, wenn die Freigabe verfallen ist.
func (p *Planer) PruefeFreigabe(b *speicher.Beitrag) bool {
	if b.Zustand != speicher.Freigegeben && b.Zustand != speicher.Geplant {
		return false
	}
	if b.InhaltsHash == "" || b.InhaltsHash == InhaltsHash(*b) {
		return false
	}
	b.Zustand = speicher.Entwurf
	b.InhaltsHash = ""
	return true
}

// Aendere übernimmt neue Werte und lässt dabei die Freigabe verfallen,
// wenn sich der Inhalt wirklich geändert hat.
func (p *Planer) Aendere(beitragID string, anwenden func(*speicher.Beitrag)) (verfallen bool, err error) {
	b, ok := p.S.Beitrag(beitragID)
	if !ok {
		return false, fmt.Errorf("planer: Beitrag %s nicht gefunden", beitragID)
	}
	anwenden(&b)
	verfallen = p.PruefeFreigabe(&b)
	if err := p.S.SetzeBeitrag(b); err != nil {
		return verfallen, err
	}
	if verfallen {
		_ = p.S.Protokolliere(speicher.Ereignis{
			Zeitpunkt: p.Jetzt(), KundeID: b.KundeID, Art: "freigabe.verfallen",
			Nutzlast: map[string]any{"beitrag": beitragID},
		})
	}
	return verfallen, nil
}

// Plane legt einen freigegebenen Beitrag auf einen Termin.
func (p *Planer) Plane(beitragID string, wann time.Time) error {
	b, ok := p.S.Beitrag(beitragID)
	if !ok {
		return fmt.Errorf("planer: Beitrag %s nicht gefunden", beitragID)
	}
	if p.PruefeFreigabe(&b) {
		_ = p.S.SetzeBeitrag(b)
		return ErrFreigabeVerfallen
	}
	if b.Zustand != speicher.Freigegeben {
		return ErrNichtFreigegeben
	}
	b.Zustand = speicher.Geplant
	b.GeplantFuer = wann.UTC()
	for i := range b.Zustellungen {
		if b.Zustellungen[i].Zustand == "" {
			b.Zustellungen[i].Zustand = speicher.ZWartend
		}
	}
	if err := p.S.SetzeBeitrag(b); err != nil {
		return err
	}
	return p.S.Protokolliere(speicher.Ereignis{
		Zeitpunkt: p.Jetzt(), KundeID: b.KundeID, Art: "beitrag.geplant",
		Nutzlast: map[string]any{"beitrag": beitragID, "termin": wann.UTC()},
	})
}

// ---- Die Uhr ----

// Tick arbeitet alle fälligen Beiträge ab. Wird regelmäßig aufgerufen.
// Der Rückgabewert ist die Zahl der versuchten Zustellungen.
func (p *Planer) Tick(ctx context.Context) (int, error) {
	jetzt := p.Jetzt()
	var versuche int
	var ersterFehler error

	for _, b := range p.S.Faellige(jetzt) {
		n, err := p.ArbeiteAb(ctx, b.ID)
		versuche += n
		if err != nil && ersterFehler == nil {
			ersterFehler = err
		}
	}
	return versuche, ersterFehler
}

// ArbeiteAb stellt einen Beitrag auf allen noch offenen Kanälen zu.
func (p *Planer) ArbeiteAb(ctx context.Context, beitragID string) (int, error) {
	b, ok := p.S.Beitrag(beitragID)
	if !ok {
		return 0, fmt.Errorf("planer: Beitrag %s nicht gefunden", beitragID)
	}

	// Eine nachträgliche Änderung nimmt den Beitrag aus der Warteschlange,
	// statt ihn ungeprüft hinauszugeben.
	if p.PruefeFreigabe(&b) {
		_ = p.S.SetzeBeitrag(b)
		_ = p.S.Protokolliere(speicher.Ereignis{
			Zeitpunkt: p.Jetzt(), KundeID: b.KundeID, Art: "freigabe.verfallen",
			Nutzlast: map[string]any{"beitrag": beitragID, "bei": "zustellung"},
		})
		return 0, ErrFreigabeVerfallen
	}

	kunde, ok := p.S.Kunde(b.KundeID)
	if !ok {
		return 0, fmt.Errorf("planer: Kunde %s nicht gefunden", b.KundeID)
	}

	jetzt := p.Jetzt()
	var versuche int

	for i := range b.Zustellungen {
		z := &b.Zustellungen[i]

		// Regel: kein Doppelversand. Liegt bereits eine Item-ID vor, ist der
		// Beitrag draußen — ein Wiederholungsversuch würde ihn verdoppeln.
		if z.WixItemID != "" || z.Zustand == speicher.ZZugestellt {
			continue
		}
		if z.Zustand == speicher.ZUebersprungen {
			continue
		}
		if z.Versuche >= HoechsteVersuche {
			continue
		}
		if !z.NaechsterVersuch.IsZero() && z.NaechsterVersuch.After(jetzt) {
			continue
		}

		versuche++
		if err := p.zustelle(ctx, kunde, &b, z); err != nil {
			p.merkeFehler(z, err, jetzt)
		}
	}

	if alleFertig(b.Zustellungen) {
		b.Zustand = speicher.Veroeffentlicht
	}
	if err := p.S.SetzeBeitrag(b); err != nil {
		return versuche, err
	}
	return versuche, nil
}

func alleFertig(zs []speicher.Zustellung) bool {
	if len(zs) == 0 {
		return false
	}
	for _, z := range zs {
		switch z.Zustand {
		case speicher.ZZugestellt, speicher.ZUebersprungen:
			continue
		case speicher.ZFehlgeschlagen:
			// Endgültig gescheitert zählt als abgeschlossen, sobald keine
			// Versuche mehr offen sind — sonst bliebe der Beitrag ewig „geplant".
			if z.Versuche >= HoechsteVersuche {
				continue
			}
			return false
		default:
			return false
		}
	}
	return true
}

// zustelle gibt eine einzelne Zustellung heraus.
func (p *Planer) zustelle(ctx context.Context, kunde speicher.Kunde, b *speicher.Beitrag, z *speicher.Zustellung) error {
	kanal, ok := p.S.Kanal(z.KanalID)
	if !ok {
		return fmt.Errorf("Kanal %s nicht gefunden", z.KanalID)
	}
	if kanal.Zustand != string(wix.Verbunden) {
		return fmt.Errorf("Kanal ist nicht verbunden (%s)", kanal.Zustand)
	}

	// Regel: Kontingent vor Versand prüfen. Sonst scheitert ein an sich
	// gültiger Aufruf spät und ohne erkennbaren Grund.
	k, err := p.W.Kontingent(ctx, kunde.WixSiteID, "PUBLISH_POST")
	if err != nil {
		return fmt.Errorf("Kontingent nicht lesbar: %w", err)
	}
	if !k.Erlaubt {
		return ErrVeroeffentlichenGesperrt
	}
	if k.Grenze > 0 && k.Rest <= 0 {
		return ErrKeinKontingent
	}

	// Der Text kommt aus der Vorlage und wird je Kanal gesetzt. Nur ohne
	// Vorlage gilt der frei getippte Text.
	text := p.TextFuer(*b, kanal.Plattform)
	if err := vorlage.PasstAufKanal(kanal.Plattform, text); err != nil {
		return err
	}

	z.Zustand = speicher.ZUebergeben
	z.Versuche++

	ergebnis, err := p.W.Veroeffentliche(ctx, kunde.WixSiteID, wix.Beitragsentwurf{
		Kanal:   kanal.Plattform,
		KontoID: kanal.WixKontoID,
		Text:    text,
		BildURL: b.BildURL,
		AutorID: kanal.WixKontoID,
	})
	if err != nil {
		// Ein erloschener Kanal ist ein Vorgang, kein Betriebsfehler: der
		// Zustand wandert in den Bestand, damit die Oberfläche zum
		// Neuverbinden auffordern kann.
		if code := wix.CodeVon(err); code == wix.CodeGetrennt {
			kanal.Zustand = string(wix.Ungueltig)
			kanal.GeprueftAm = p.Jetzt()
			_ = p.S.SetzeKanal(kanal)
		}
		return err
	}

	z.WixItemID = ergebnis.ItemID
	z.ExterneID = ergebnis.ExterneID
	z.ExterneURL = ergebnis.ExterneURL
	z.Zustand = speicher.ZZugestellt
	z.Fehlergrund = ""
	z.ZugestelltAm = p.Jetzt()

	_ = p.S.Protokolliere(speicher.Ereignis{
		Zeitpunkt: p.Jetzt(), KundeID: b.KundeID, Art: "zustellung.erfolgt",
		Nutzlast: map[string]any{
			"beitrag": b.ID, "kanal": kanal.Plattform, "wix_item": ergebnis.ItemID,
		},
	})
	return nil
}

// merkeFehler hält einen Fehlschlag als Zustand fest und setzt den nächsten
// Versuch mit wachsendem Abstand.
func (p *Planer) merkeFehler(z *speicher.Zustellung, err error, jetzt time.Time) {
	z.Zustand = speicher.ZFehlgeschlagen
	z.Fehlergrund = klartext(err)

	// Ein erschöpftes Kontingent oder ein gesperrtes Veröffentlichen bessert
	// sich nicht durch Wiederholen — der Versuch zählt, aber der nächste
	// Anlauf wartet auf den neuen Monat.
	if errors.Is(err, ErrKeinKontingent) || errors.Is(err, ErrVeroeffentlichenGesperrt) {
		z.NaechsterVersuch = jetzt.Add(24 * time.Hour)
		return
	}
	abstand := time.Duration(1<<uint(min(z.Versuche, 6))) * time.Minute
	if abstand > time.Hour {
		abstand = time.Hour
	}
	z.NaechsterVersuch = jetzt.Add(abstand)
}

func klartext(err error) string {
	switch {
	case errors.Is(err, ErrKeinKontingent):
		return "Das Kontingent für diesen Monat ist aufgebraucht."
	case errors.Is(err, ErrVeroeffentlichenGesperrt):
		return "Veröffentlichen ist für diese Site nicht freigeschaltet."
	}
	switch wix.CodeVon(err) {
	case wix.CodeGetrennt:
		return "Die Verbindung zu diesem Kanal ist erloschen. Bitte neu verbinden."
	case wix.CodeNichtDa:
		return "Für diesen Kanal ist kein Konto verbunden."
	}
	return err.Error()
}

// ---- Kanäle abgleichen ----

// SynchronisiereKanaele liest den Zustand aller bekannten Kanäle einer
// Kundin von Wix und schreibt ihn in den Bestand.
func (p *Planer) SynchronisiereKanaele(ctx context.Context, kundeID string) error {
	kunde, ok := p.S.Kunde(kundeID)
	if !ok {
		return fmt.Errorf("planer: Kunde %s nicht gefunden", kundeID)
	}
	var ersterFehler error
	for _, plattform := range wix.BekannteKanaele {
		konten, zustand, err := p.W.Konten(ctx, kunde.WixSiteID, plattform)
		if err != nil {
			if ersterFehler == nil {
				ersterFehler = err
			}
			continue
		}
		if len(konten) == 0 {
			// Kein Konto: den bekannten Kanal auf den gemeldeten Zustand
			// setzen, damit „erloschen" nicht wie „nie eingerichtet" aussieht.
			for _, k := range p.S.KanaeleVon(kundeID) {
				if k.Plattform == plattform {
					k.Zustand = string(zustand)
					k.GeprueftAm = p.Jetzt()
					_ = p.S.SetzeKanal(k)
				}
			}
			continue
		}
		for _, konto := range konten {
			_ = p.S.SetzeKanal(speicher.Kanal{
				ID:          kundeID + ":" + plattform + ":" + konto.ID,
				KundeID:     kundeID,
				Plattform:   plattform,
				WixKontoID:  konto.ID,
				Anzeigename: konto.Anzeigename,
				Zustand:     string(wix.Verbunden),
				Standard:    konto.Standard,
				GeprueftAm:  p.Jetzt(),
			})
		}
	}
	return ersterFehler
}

// TextFuer setzt den Beitragstext für einen Kanal.
//
// Liegt eine Vorlage vor, bestimmt sie den Aufbau — Instagram bekommt dann
// etwas anderes als LinkedIn, ohne dass die Kundin zweimal tippt.
func (p *Planer) TextFuer(b speicher.Beitrag, kanal string) string {
	if b.VorlageID == "" {
		return b.Text
	}
	v, ok := vorlage.Finde(p.S.VorlagenVon(b.KundeID), b.VorlageID)
	if !ok {
		// Vorlage wurde entfernt: der zuletzt gesetzte Text ist immer noch
		// besser als gar keiner.
		return b.Text
	}
	if gesetzt := v.Setze(kanal, b.Werte); gesetzt != "" {
		return gesetzt
	}
	return b.Text
}
