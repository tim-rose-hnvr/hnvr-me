package speicher

import (
	"crypto/pbkdf2"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Zugang folgt dem, was die Zentrale von PUNKT bereits festlegt:
// Passwoerter als PBKDF2-Abdruck mit 210 000 Runden, Schluessel nur als
// SHA-256-Abdruck. Ein Schluessel laesst sich nie wieder anzeigen, nur
// ersetzen — deshalb wird beim Anlegen einmal der Klartext zurueckgegeben
// und danach nie wieder.

const pbkdf2Runden = 210_000

// Rollen. Loeschen und Verwalten bleibt beim Inhaber.
const (
	RolleInhaber   = "inhaber"
	RolleRedakteur = "redakteur"
	RolleLeser     = "leser"
)

// Konto ist ein Zugang mit Passwort.
type Konto struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Mail        string     `json:"mail"`
	Abdruck     string     `json:"abdruck"`
	Salz        string     `json:"salz"`
	Rolle       string     `json:"rolle"`
	GehoertZu   string     `json:"gehoertZu,omitempty"` // Mitarbeitende zeigen auf das Inhaberkonto
	Fehlgriffe  int        `json:"fehlgriffe"`
	GesperrtBis *time.Time `json:"gesperrtBis,omitempty"`
	Erstellt    time.Time  `json:"erstellt"`
	Geloescht   bool       `json:"geloescht,omitempty"`
}

// Schluessel ist ein Zugang fuer Maschinen.
type Schluessel struct {
	ID             string     `json:"id"`
	KontoID        string     `json:"kontoId"`
	Name           string     `json:"name"`
	Abdruck        string     `json:"abdruck"`  // SHA-256, hexadezimal
	Vorschau       string     `json:"vorschau"` // die ersten Zeichen, zum Wiedererkennen
	NurLesen       bool       `json:"nurLesen"`
	Erstellt       time.Time  `json:"erstellt"`
	LetzterZugriff *time.Time `json:"letzterZugriff,omitempty"`
	Geloescht      bool       `json:"geloescht,omitempty"`
}

var (
	ErrKeinZugang    = errors.New("kein gueltiger Schluessel")
	ErrNurLesen      = errors.New("dieser Schluessel darf nur lesen")
	ErrKontoGesperrt = errors.New("Konto ist voruebergehend gesperrt")
)

// abdruckVon rechnet den Abdruck eines Schluessels. Nur er wird gespeichert.
func abdruckVon(klartext string) string {
	summe := sha256.Sum256([]byte(klartext))
	return hex.EncodeToString(summe[:])
}

// PasswortAbdruck rechnet den PBKDF2-Abdruck.
func PasswortAbdruck(passwort, salz string) string {
	roh, err := pbkdf2.Key(sha256.New, passwort, []byte(salz), pbkdf2Runden, 32)
	if err != nil {
		return ""
	}
	return hex.EncodeToString(roh)
}

// PasswortStimmt vergleicht in gleichbleibender Zeit.
func PasswortStimmt(passwort string, k *Konto) bool {
	soll, err := hex.DecodeString(k.Abdruck)
	if err != nil {
		return false
	}
	ist, err := hex.DecodeString(PasswortAbdruck(passwort, k.Salz))
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(soll, ist) == 1
}

// LegeKontoAn speichert ein Konto. Das Passwort wird nie im Klartext abgelegt.
func (s *Speicher) LegeKontoAn(name, mail, passwort string) (*Konto, error) {
	if len([]rune(passwort)) < 10 {
		return nil, errors.New("das Passwort braucht mindestens 10 Zeichen")
	}
	mail = strings.ToLower(strings.TrimSpace(mail))
	if mail == "" {
		return nil, errors.New("ohne E-Mail")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, k := range s.konten {
		if strings.EqualFold(k.Mail, mail) {
			return nil, errors.New("diese E-Mail ist bereits vergeben")
		}
	}

	salz := hex.EncodeToString(zufallsQuelle(16))
	k := &Konto{
		ID: kennung(), Name: name, Mail: mail,
		Salz: salz, Abdruck: PasswortAbdruck(passwort, salz),
		Rolle: RolleInhaber, Erstellt: time.Now().UTC(),
	}
	if err := s.schreibe(s.zugangDatei, satz{Art: "konto", Konto: k}); err != nil {
		return nil, err
	}
	s.konten[k.ID] = k
	return k, nil
}

// Anmelden prueft Mail und Passwort. Nach fuenf Fehlversuchen ist das
// Konto kurz gesperrt — das bremst das Durchprobieren, ohne jemanden
// dauerhaft auszusperren.
func (s *Speicher) Anmelden(mail, passwort string) (*Konto, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var k *Konto
	for _, kandidat := range s.konten {
		if strings.EqualFold(kandidat.Mail, mail) {
			k = kandidat
			break
		}
	}
	if k == nil {
		// Dieselbe Meldung wie bei falschem Passwort: sonst verraet die
		// Antwort, welche Adressen ein Konto haben.
		return nil, errors.New("E-Mail oder Passwort stimmt nicht")
	}
	if k.GesperrtBis != nil && k.GesperrtBis.After(time.Now().UTC()) {
		return nil, ErrKontoGesperrt
	}
	if !PasswortStimmt(passwort, k) {
		k.Fehlgriffe++
		if k.Fehlgriffe >= 5 {
			bis := time.Now().UTC().Add(15 * time.Minute)
			k.GesperrtBis = &bis
			k.Fehlgriffe = 0
		}
		_ = s.schreibe(s.zugangDatei, satz{Art: "konto", Konto: k})
		return nil, errors.New("E-Mail oder Passwort stimmt nicht")
	}
	k.Fehlgriffe, k.GesperrtBis = 0, nil
	_ = s.schreibe(s.zugangDatei, satz{Art: "konto", Konto: k})
	return k, nil
}

// LegeSchluesselAn erzeugt einen Schluessel und gibt ihn genau einmal
// im Klartext zurueck.
func (s *Speicher) LegeSchluesselAn(kontoID, name string, nurLesen bool) (*Schluessel, string, error) {
	klartext := "pk_live_" + hex.EncodeToString(zufallsQuelle(24))

	s.mu.Lock()
	defer s.mu.Unlock()

	sch := &Schluessel{
		ID: kennung(), KontoID: kontoID, Name: name,
		Abdruck:  abdruckVon(klartext),
		Vorschau: klartext[:16] + "…",
		NurLesen: nurLesen, Erstellt: time.Now().UTC(),
	}
	if err := s.schreibe(s.zugangDatei, satz{Art: "schluessel", Schluessel: sch}); err != nil {
		return nil, "", err
	}
	s.schluessel[sch.Abdruck] = sch
	return sch, klartext, nil
}

// OrgVon liefert die Organisation, zu der ein Schluessel gehoert.
func (s *Speicher) OrgVon(sch *Schluessel) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if k, da := s.konten[sch.KontoID]; da {
		return k.Organisation()
	}
	return sch.KontoID
}

// RolleVon liefert die Rolle des Kontos hinter einem Schluessel. Ein
// Schluessel kann nie mehr duerfen als die Person, der er gehoert.
func (s *Speicher) RolleVon(sch *Schluessel) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if k, da := s.konten[sch.KontoID]; da {
		return k.Rolle
	}
	return RolleLeser
}

// PruefeSchluessel loest einen Schluessel auf. Gesucht wird ueber den
// Abdruck — der Klartext liegt nirgends.
func (s *Speicher) PruefeSchluessel(klartext string) (*Schluessel, error) {
	if klartext == "" {
		return nil, ErrKeinZugang
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	sch, da := s.schluessel[abdruckVon(klartext)]
	if !da || sch.Geloescht {
		return nil, ErrKeinZugang
	}
	jetzt := time.Now().UTC()
	sch.LetzterZugriff = &jetzt
	return sch, nil
}

// SchluesselListe gibt die Schluessel eines Kontos — ohne Klartext.
func (s *Speicher) SchluesselListe(kontoID string) []*Schluessel {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var aus []*Schluessel
	for _, sch := range s.schluessel {
		if sch.KontoID == kontoID && !sch.Geloescht {
			aus = append(aus, sch)
		}
	}
	return aus
}

// WiderrufeSchluessel legt einen Schluessel still.
func (s *Speicher) WiderrufeSchluessel(kontoID, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, sch := range s.schluessel {
		if sch.ID == id && sch.KontoID == kontoID {
			sch.Geloescht = true
			return s.schreibe(s.zugangDatei, satz{Art: "schluessel", Schluessel: sch})
		}
	}
	return fmt.Errorf("unbekannter Schluessel")
}

// satz ist die Zeile in zugang.jsonl. Konten und Schluessel teilen sich
// eine Datei, damit die Reihenfolge der Aenderungen erhalten bleibt.
type satz struct {
	Art        string      `json:"art"`
	Konto      *Konto      `json:"konto,omitempty"`
	Schluessel *Schluessel `json:"schluessel,omitempty"`
	Marke      *Marke      `json:"marke,omitempty"`
}
