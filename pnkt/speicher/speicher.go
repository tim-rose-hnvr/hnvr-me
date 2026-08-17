// Package speicher haelt die Daten von pnkt.me.
//
// Kein Datenbankserver, keine fremden Pakete: eine anhaengende Datei je
// Sammlung, dazu ein Verzeichnis im Arbeitsspeicher. Das ist keine Sparsamkeit,
// sondern die Bedingung fuer „selbstaendig" — ein Binaer, ein Verzeichnis,
// fertig. Kopieren ist Sichern, und wer die Datei liest, sieht alles.
//
// Die Datei wird nur angehaengt. Eine Aenderung ist ein neuer Satz mit
// derselben Kennung; der letzte gilt. Damit ist die Geschichte eines
// gedruckten Codes vollstaendig — und genau die braucht man, wenn jemand
// fragt, wohin ein Code im Maerz gezeigt hat.
package speicher

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Code ist ein QR-Code mit allem, was ihn ausmacht.
type Code struct {
	ID         string            `json:"id"`
	Kuerzel    string            `json:"kuerzel"`
	KontoID    string            `json:"kontoId"`
	Name       string            `json:"name"`
	Ziel       string            `json:"ziel"`
	Regeln     map[string]any    `json:"regeln,omitempty"`
	UTM        map[string]string `json:"utm,omitempty"`
	GTIN       string            `json:"gtin,omitempty"`
	Druck      map[string]any    `json:"druck,omitempty"`
	Aktiv      bool              `json:"aktiv"`
	Gesperrt   string            `json:"gesperrt,omitempty"`
	GueltigBis *time.Time        `json:"gueltigBis,omitempty"`
	Herkunft   string            `json:"herkunft,omitempty"`
	Fassung    int               `json:"fassung"`
	Erstellt   time.Time         `json:"erstellt"`
	Geaendert  time.Time         `json:"geaendert"`
	Geloescht  bool              `json:"geloescht,omitempty"`
}

// Ereignis ist ein Eintrag im Protokoll. Nur anhaengen, nie aendern.
type Ereignis struct {
	Zeit       time.Time `json:"zeit"`
	KontoID    string    `json:"kontoId"`
	Wer        string    `json:"wer"`
	Was        string    `json:"was"`
	Gegenstand string    `json:"gegenstand"`
	Alt        string    `json:"alt,omitempty"`
	Neu        string    `json:"neu,omitempty"`
}

// Tageszaehler haelt die Scans eines Codes an einem Tag — in Klassen,
// nie je Scan. Was hier nicht entsteht, kann spaeter niemand verlangen.
type Tageszaehler struct {
	CodeID  string         `json:"codeId"`
	Tag     string         `json:"tag"`
	Gesamt  int            `json:"gesamt"`
	Zaehler map[string]int `json:"zaehler"`
}

// Speicher ist die gesamte Ablage.
type Speicher struct {
	verzeichnis string

	mu         sync.RWMutex
	codes      map[string]*Code         // nach ID
	nachKurz   map[string]*Code         // nach Kuerzel, klein geschrieben
	zaehler    map[string]*Tageszaehler // nach CodeID + Tag
	konten     map[string]*Konto        // nach ID
	schluessel map[string]*Schluessel   // nach Abdruck
	marken     map[string]*Marke        // nach Organisation
	markenHost map[string]*Marke        // nach Hostname

	codeDatei     *os.File
	ereignisDatei *os.File
	zaehlerDatei  *os.File
	zugangDatei   *os.File
}

// ErrKuerzelVergeben meldet die Kollision, die bei gedruckten Codes
// nicht mehr reparierbar waere.
var ErrKuerzelVergeben = errors.New("Kuerzel ist bereits vergeben")

// Oeffne laedt eine bestehende Ablage oder legt eine neue an.
func Oeffne(verzeichnis string) (*Speicher, error) {
	if err := os.MkdirAll(verzeichnis, 0o750); err != nil {
		return nil, err
	}
	s := &Speicher{
		verzeichnis: verzeichnis,
		codes:       map[string]*Code{},
		nachKurz:    map[string]*Code{},
		zaehler:     map[string]*Tageszaehler{},
		konten:      map[string]*Konto{},
		schluessel:  map[string]*Schluessel{},
		marken:      map[string]*Marke{},
		markenHost:  map[string]*Marke{},
	}

	if err := s.lade("codes.jsonl", func(zeile []byte) error {
		var c Code
		if err := json.Unmarshal(zeile, &c); err != nil {
			return err
		}
		s.merke(&c)
		return nil
	}); err != nil {
		return nil, err
	}

	if err := s.lade("zaehler.jsonl", func(zeile []byte) error {
		var z Tageszaehler
		if err := json.Unmarshal(zeile, &z); err != nil {
			return err
		}
		s.zaehler[z.CodeID+"_"+z.Tag] = &z
		return nil
	}); err != nil {
		return nil, err
	}

	if err := s.lade("zugang.jsonl", func(zeile []byte) error {
		var z satz
		if err := json.Unmarshal(zeile, &z); err != nil {
			return err
		}
		switch {
		case z.Konto != nil:
			s.konten[z.Konto.ID] = z.Konto
		case z.Schluessel != nil:
			s.schluessel[z.Schluessel.Abdruck] = z.Schluessel
		case z.Marke != nil:
			s.marke(z.Marke)
		}
		return nil
	}); err != nil {
		return nil, err
	}

	var err error
	if s.zugangDatei, err = s.anhaengen("zugang.jsonl"); err != nil {
		return nil, err
	}
	if s.codeDatei, err = s.anhaengen("codes.jsonl"); err != nil {
		return nil, err
	}
	if s.ereignisDatei, err = s.anhaengen("ereignisse.jsonl"); err != nil {
		return nil, err
	}
	if s.zaehlerDatei, err = s.anhaengen("zaehler.jsonl"); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Speicher) anhaengen(name string) (*os.File, error) {
	return os.OpenFile(filepath.Join(s.verzeichnis, name),
		os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o640)
}

// lade liest eine Sammlung ein. Eine abgeschnittene letzte Zeile — etwa
// nach einem Stromausfall mitten im Schreiben — wird uebergangen, nicht
// als Fehler behandelt. Der Satz davor ist vollstaendig.
func (s *Speicher) lade(name string, je func([]byte) error) error {
	f, err := os.Open(filepath.Join(s.verzeichnis, name))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	defer f.Close()

	leser := bufio.NewScanner(f)
	leser.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for leser.Scan() {
		zeile := leser.Bytes()
		if len(zeile) == 0 {
			continue
		}
		if err := je(zeile); err != nil {
			continue // unvollstaendiger Satz am Ende
		}
	}
	return leser.Err()
}

func (s *Speicher) merke(c *Code) {
	if c.Geloescht {
		if alt, da := s.codes[c.ID]; da {
			delete(s.nachKurz, strings.ToLower(alt.Kuerzel))
			delete(s.codes, c.ID)
		}
		return
	}
	if alt, da := s.codes[c.ID]; da && !strings.EqualFold(alt.Kuerzel, c.Kuerzel) {
		delete(s.nachKurz, strings.ToLower(alt.Kuerzel))
	}
	s.codes[c.ID] = c
	s.nachKurz[strings.ToLower(c.Kuerzel)] = c
}

func (s *Speicher) schreibe(f *os.File, satz any) error {
	roh, err := json.Marshal(satz)
	if err != nil {
		return err
	}
	if _, err := f.Write(append(roh, '\n')); err != nil {
		return err
	}
	// Erst nach dem Durchschreiben gilt ein Satz als angenommen.
	return f.Sync()
}

// LegeAn speichert einen neuen Code. Das Kuerzel wird hier auf
// Eindeutigkeit geprueft — unter derselben Sperre, unter der es
// eingetragen wird. Eine Vorabfrage waere ein Wettlauf.
func (s *Speicher) LegeAn(c *Code) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if c.Kuerzel == "" {
		return errors.New("ohne Kuerzel")
	}
	if _, da := s.nachKurz[strings.ToLower(c.Kuerzel)]; da {
		return ErrKuerzelVergeben
	}
	jetzt := time.Now().UTC()
	c.Erstellt, c.Geaendert, c.Fassung = jetzt, jetzt, 1
	if c.ID == "" {
		c.ID = kennung()
	}
	if err := s.schreibe(s.codeDatei, c); err != nil {
		return err
	}
	s.merke(c)
	return nil
}

// Aendere schreibt eine neue Fassung. Die alte bleibt in der Datei stehen.
func (s *Speicher) Aendere(id string, wandle func(*Code) error) (*Code, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	alt, da := s.codes[id]
	if !da {
		return nil, errors.New("unbekannter Code")
	}
	neu := *alt
	if err := wandle(&neu); err != nil {
		return nil, err
	}
	if !strings.EqualFold(neu.Kuerzel, alt.Kuerzel) {
		if _, belegt := s.nachKurz[strings.ToLower(neu.Kuerzel)]; belegt {
			return nil, ErrKuerzelVergeben
		}
	}
	neu.Geaendert = time.Now().UTC()
	neu.Fassung = alt.Fassung + 1
	if err := s.schreibe(s.codeDatei, &neu); err != nil {
		return nil, err
	}
	s.merke(&neu)
	return &neu, nil
}

// NachKuerzel loest die Kurzadresse auf. Das ist der heisseste Pfad des
// Systems: eine Suche im Verzeichnis, kein Dateizugriff.
func (s *Speicher) NachKuerzel(kuerzel string) (*Code, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, da := s.nachKurz[strings.ToLower(kuerzel)]
	return c, da
}

// NachID liefert einen Code.
func (s *Speicher) NachID(id string) (*Code, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, da := s.codes[id]
	return c, da
}

// Liste gibt die Codes eines Kontos, neueste zuerst.
func (s *Speicher) Liste(kontoID string) []*Code {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var aus []*Code
	for _, c := range s.codes {
		if kontoID == "" || c.KontoID == kontoID {
			aus = append(aus, c)
		}
	}
	for i := 0; i < len(aus); i++ {
		for j := i + 1; j < len(aus); j++ {
			if aus[j].Erstellt.After(aus[i].Erstellt) {
				aus[i], aus[j] = aus[j], aus[i]
			}
		}
	}
	return aus
}

// FreiesKuerzel sucht ein unbenutztes Kuerzel.
func (s *Speicher) FreiesKuerzel() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for laenge := 6; laenge <= 9; laenge++ {
		for versuch := 0; versuch < 40; versuch++ {
			k := BaueKuerzel(laenge)
			if _, da := s.nachKurz[strings.ToLower(k)]; !da {
				return k
			}
		}
	}
	return ""
}

// Zaehle erhoeht die Zaehler eines Codes fuer den heutigen Tag.
func (s *Speicher) Zaehle(codeID string, klassen []string, jetzt time.Time) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	tag := jetzt.UTC().Format("2006-01-02")
	schluessel := codeID + "_" + tag
	z, da := s.zaehler[schluessel]
	if !da {
		z = &Tageszaehler{CodeID: codeID, Tag: tag, Zaehler: map[string]int{}}
		s.zaehler[schluessel] = z
	}
	z.Gesamt++
	for _, k := range klassen {
		z.Zaehler[k]++
	}
	// Der Zaehlerstand darf einen Absturz ueberleben; ein verlorener
	// Scan waere hinnehmbar, eine langsame Weiterleitung nicht.
	_ = s.schreibe(s.zaehlerDatei, z)
	return z.Gesamt
}

// Zaehlerstand liefert die Tageszeilen eines Codes.
func (s *Speicher) Zaehlerstand(codeID string) []*Tageszaehler {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var aus []*Tageszaehler
	for _, z := range s.zaehler {
		if z.CodeID == codeID {
			aus = append(aus, z)
		}
	}
	return aus
}

// Protokolliere haengt einen Eintrag an. Jede Zieländerung eines
// gedruckten Codes gehoert hierher.
func (s *Speicher) Protokolliere(e Ereignis) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e.Zeit.IsZero() {
		e.Zeit = time.Now().UTC()
	}
	return s.schreibe(s.ereignisDatei, e)
}

// Protokoll liest das Ereignisprotokoll zu einem Gegenstand.
func (s *Speicher) Protokoll(gegenstand string) ([]Ereignis, error) {
	var aus []Ereignis
	err := s.lade("ereignisse.jsonl", func(zeile []byte) error {
		var e Ereignis
		if err := json.Unmarshal(zeile, &e); err != nil {
			return err
		}
		if gegenstand == "" || e.Gegenstand == gegenstand {
			aus = append(aus, e)
		}
		return nil
	})
	return aus, err
}

// Schliesse gibt die Dateien frei.
func (s *Speicher) Schliesse() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	var erster error
	for _, f := range []*os.File{s.codeDatei, s.ereignisDatei, s.zaehlerDatei, s.zugangDatei} {
		if f == nil {
			continue
		}
		if err := f.Close(); err != nil && erster == nil {
			erster = err
		}
	}
	return erster
}

// --- Kuerzel --------------------------------------------------------------

// Alphabet ohne Zeichen, die auf Papier verwechselt werden: kein 0/O,
// kein 1/l/I, kein 5/S, kein 8/B. Kuerzel werden von Plakaten abgetippt.
const Alphabet = "234679acdefghjkmnpqrtuvwxyz"

var zufallsQuelle = func(n int) []byte {
	b := make([]byte, n)
	f, err := os.Open("/dev/urandom")
	if err == nil {
		defer f.Close()
		if _, err := f.Read(b); err == nil {
			return b
		}
	}
	// Rueckfall: Zeit als Quelle. Nur fuer den Fall, dass /dev/urandom fehlt.
	n64 := time.Now().UnixNano()
	for i := range b {
		b[i] = byte(n64 >> (uint(i%8) * 8))
	}
	return b
}

// BaueKuerzel erzeugt ein Kuerzel der gewuenschten Laenge.
func BaueKuerzel(laenge int) string {
	roh := zufallsQuelle(laenge)
	aus := make([]byte, laenge)
	for i, b := range roh {
		aus[i] = Alphabet[int(b)%len(Alphabet)]
	}
	return string(aus)
}

func kennung() string {
	roh := zufallsQuelle(16)
	return fmt.Sprintf("%x-%x-%x-%x", roh[0:4], roh[4:6], roh[6:8], roh[8:16])
}
