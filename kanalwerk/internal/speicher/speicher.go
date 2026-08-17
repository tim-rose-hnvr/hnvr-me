// Package speicher hält den Bestand: Kunden, Kanäle, Vorlagen, Beiträge.
//
// Ablage ist eine JSON-Datei, geschrieben über eine Zwischendatei und
// umbenannt. Für einen Betrieb mit einer Handvoll Kunden und einigen
// Beiträgen je Woche ist das ausreichend und spart eine Datenbank samt
// Betrieb. Wenn die Mengen wachsen, wird hier PostgreSQL untergeschoben,
// ohne dass der übrige Code es merkt.
package speicher

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/tim-rose-hnvr/hnvr-me/kanalwerk/internal/vorlage"
)

// Zustände eines Beitrags.
const (
	Entwurf         = "entwurf"
	Eingereicht     = "eingereicht"
	Freigegeben     = "freigegeben"
	Geplant         = "geplant"
	Veroeffentlicht = "veroeffentlicht"
	Abgelehnt       = "abgelehnt"
	Zurueckgezogen  = "zurueckgezogen"
)

// Zustände einer einzelnen Zustellung.
const (
	ZWartend        = "wartend"
	ZUebergeben     = "uebergeben"
	ZZugestellt     = "zugestellt"
	ZFehlgeschlagen = "fehlgeschlagen"
	ZUebersprungen  = "uebersprungen"
)

type Kunde struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	WixSiteID string `json:"wix_site_id"`
}

type Kanal struct {
	ID          string    `json:"id"`
	KundeID     string    `json:"kunde_id"`
	Plattform   string    `json:"plattform"`
	WixKontoID  string    `json:"wix_konto_id"`
	Anzeigename string    `json:"anzeigename"`
	Zustand     string    `json:"zustand"`
	Standard    bool      `json:"standard"`
	GeprueftAm  time.Time `json:"geprueft_am"`
}

// Zustellung ist ein Beitrag auf genau einem Kanal.
type Zustellung struct {
	KanalID          string    `json:"kanal_id"`
	Zustand          string    `json:"zustand"`
	WixItemID        string    `json:"wix_item_id"`
	ExterneID        string    `json:"externe_id"`
	ExterneURL       string    `json:"externe_url"`
	Fehlergrund      string    `json:"fehlergrund"`
	Versuche         int       `json:"versuche"`
	NaechsterVersuch time.Time `json:"naechster_versuch"`
	ZugestelltAm     time.Time `json:"zugestellt_am"`
}

type Beitrag struct {
	ID           string            `json:"id"`
	KundeID      string            `json:"kunde_id"`
	VorlageID    string            `json:"vorlage_id"`
	Werte        map[string]string `json:"werte"`
	Text         string            `json:"text"`
	BildURL      string            `json:"bild_url"`
	Zustand      string            `json:"zustand"`
	GeplantFuer  time.Time         `json:"geplant_fuer"`
	InhaltsHash  string            `json:"inhalts_hash"`
	Zustellungen []Zustellung      `json:"zustellungen"`
	AngelegtAm   time.Time         `json:"angelegt_am"`
}

type Freigabe struct {
	BeitragID    string    `json:"beitrag_id"`
	Person       string    `json:"person"`
	Entscheidung string    `json:"entscheidung"`
	Begruendung  string    `json:"begruendung"`
	InhaltsHash  string    `json:"inhalts_hash"`
	Zeitpunkt    time.Time `json:"zeitpunkt"`
}

// Ereignis ist ein Eintrag im nur anfügbaren Protokoll.
type Ereignis struct {
	Zeitpunkt time.Time      `json:"zeitpunkt"`
	KundeID   string         `json:"kunde_id"`
	Art       string         `json:"art"`
	Nutzlast  map[string]any `json:"nutzlast"`
}

type bestand struct {
	Kunden     []Kunde           `json:"kunden"`
	Kanaele    []Kanal           `json:"kanaele"`
	Vorlagen   []vorlage.Vorlage `json:"vorlagen"`
	Beitraege  []Beitrag         `json:"beitraege"`
	Freigaben  []Freigabe        `json:"freigaben"`
	Ereignisse []Ereignis        `json:"ereignisse"`
}

// Speicher ist der Zugang zum Bestand. Alle Methoden sind nebenläufig sicher.
type Speicher struct {
	mu   sync.RWMutex
	pfad string
	b    bestand
}

// Oeffne lädt den Bestand aus pfad. Existiert die Datei nicht, entsteht ein
// leerer Bestand — der erste Start soll nicht an einer fehlenden Datei
// scheitern.
func Oeffne(pfad string) (*Speicher, error) {
	s := &Speicher{pfad: pfad}
	roh, err := os.ReadFile(pfad)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return nil, fmt.Errorf("speicher: %s konnte nicht gelesen werden: %w", pfad, err)
	}
	if len(roh) == 0 {
		return s, nil
	}
	if err := json.Unmarshal(roh, &s.b); err != nil {
		return nil, fmt.Errorf("speicher: %s ist beschädigt: %w", pfad, err)
	}
	return s, nil
}

// sichere schreibt den Bestand. Aufrufer muss die Sperre halten.
func (s *Speicher) sichere() error {
	if s.pfad == "" {
		return nil // Speicher ohne Datei, für Tests
	}
	roh, err := json.MarshalIndent(s.b, "", "  ")
	if err != nil {
		return fmt.Errorf("speicher: Bestand konnte nicht kodiert werden: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(s.pfad), 0o755); err != nil {
		return fmt.Errorf("speicher: Verzeichnis fehlt und ließ sich nicht anlegen: %w", err)
	}
	zwischen := s.pfad + ".neu"
	if err := os.WriteFile(zwischen, roh, 0o600); err != nil {
		return fmt.Errorf("speicher: Zwischendatei konnte nicht geschrieben werden: %w", err)
	}
	if err := os.Rename(zwischen, s.pfad); err != nil {
		return fmt.Errorf("speicher: Umbenennen fehlgeschlagen: %w", err)
	}
	return nil
}

// ---- Kunden ----

func (s *Speicher) SetzeKunde(k Kunde) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.b.Kunden {
		if s.b.Kunden[i].ID == k.ID {
			s.b.Kunden[i] = k
			return s.sichere()
		}
	}
	s.b.Kunden = append(s.b.Kunden, k)
	return s.sichere()
}

func (s *Speicher) Kunden() []Kunde {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return append([]Kunde(nil), s.b.Kunden...)
}

func (s *Speicher) Kunde(id string) (Kunde, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, k := range s.b.Kunden {
		if k.ID == id {
			return k, true
		}
	}
	return Kunde{}, false
}

// ---- Kanäle ----

// SetzeKanal legt an oder ersetzt anhand von KundeID + Plattform + WixKontoID.
func (s *Speicher) SetzeKanal(k Kanal) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.b.Kanaele {
		a := s.b.Kanaele[i]
		if a.KundeID == k.KundeID && a.Plattform == k.Plattform && a.WixKontoID == k.WixKontoID {
			s.b.Kanaele[i] = k
			return s.sichere()
		}
	}
	s.b.Kanaele = append(s.b.Kanaele, k)
	return s.sichere()
}

func (s *Speicher) KanaeleVon(kundeID string) []Kanal {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var raus []Kanal
	for _, k := range s.b.Kanaele {
		if k.KundeID == kundeID {
			raus = append(raus, k)
		}
	}
	sort.Slice(raus, func(i, j int) bool { return raus[i].Plattform < raus[j].Plattform })
	return raus
}

func (s *Speicher) Kanal(id string) (Kanal, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, k := range s.b.Kanaele {
		if k.ID == id {
			return k, true
		}
	}
	return Kanal{}, false
}

// ---- Vorlagen ----

func (s *Speicher) SetzeVorlage(v vorlage.Vorlage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.b.Vorlagen {
		if s.b.Vorlagen[i].ID == v.ID {
			s.b.Vorlagen[i] = v
			return s.sichere()
		}
	}
	s.b.Vorlagen = append(s.b.Vorlagen, v)
	return s.sichere()
}

func (s *Speicher) VorlagenVon(kundeID string) []vorlage.Vorlage {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var raus []vorlage.Vorlage
	for _, v := range s.b.Vorlagen {
		if v.KundeID == kundeID {
			raus = append(raus, v)
		}
	}
	return raus
}

// ---- Beiträge ----

func (s *Speicher) SetzeBeitrag(b Beitrag) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.b.Beitraege {
		if s.b.Beitraege[i].ID == b.ID {
			s.b.Beitraege[i] = b
			return s.sichere()
		}
	}
	s.b.Beitraege = append(s.b.Beitraege, b)
	return s.sichere()
}

func (s *Speicher) Beitrag(id string) (Beitrag, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, b := range s.b.Beitraege {
		if b.ID == id {
			return b, true
		}
	}
	return Beitrag{}, false
}

func (s *Speicher) Beitraege() []Beitrag {
	s.mu.RLock()
	defer s.mu.RUnlock()
	raus := append([]Beitrag(nil), s.b.Beitraege...)
	sort.Slice(raus, func(i, j int) bool { return raus[i].GeplantFuer.Before(raus[j].GeplantFuer) })
	return raus
}

// Faellige liefert Beiträge, die im Zustand geplant sind und deren Termin
// erreicht ist.
func (s *Speicher) Faellige(jetzt time.Time) []Beitrag {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var raus []Beitrag
	for _, b := range s.b.Beitraege {
		if b.Zustand == Geplant && !b.GeplantFuer.After(jetzt) {
			raus = append(raus, b)
		}
	}
	sort.Slice(raus, func(i, j int) bool { return raus[i].GeplantFuer.Before(raus[j].GeplantFuer) })
	return raus
}

// ---- Freigaben ----

func (s *Speicher) FuegeFreigabeAn(f Freigabe) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.b.Freigaben = append(s.b.Freigaben, f)
	return s.sichere()
}

func (s *Speicher) FreigabenVon(beitragID string) []Freigabe {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var raus []Freigabe
	for _, f := range s.b.Freigaben {
		if f.BeitragID == beitragID {
			raus = append(raus, f)
		}
	}
	return raus
}

// ---- Ereignisse ----

// Protokolliere hängt einen Eintrag an. Nur anfügbar, nie ändern.
func (s *Speicher) Protokolliere(e Ereignis) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.Zeitpunkt.IsZero() {
		e.Zeitpunkt = time.Now().UTC()
	}
	s.b.Ereignisse = append(s.b.Ereignisse, e)
	return s.sichere()
}

func (s *Speicher) Ereignisse(grenze int) []Ereignis {
	s.mu.RLock()
	defer s.mu.RUnlock()
	n := len(s.b.Ereignisse)
	if grenze > 0 && n > grenze {
		return append([]Ereignis(nil), s.b.Ereignisse[n-grenze:]...)
	}
	return append([]Ereignis(nil), s.b.Ereignisse...)
}
