package speicher

import (
	"errors"
	"strings"
	"time"
)

// White-Label heisst hier: ein Binaer, viele Marken, auseinandergehalten
// am Hostnamen. Eine Agentur kann ihren Kunden damit einen eigenen
// Dienst anbieten, ohne dass jemand eine zweite Anlage betreibt.
//
// Entscheidend ist, was eine Marke NICHT ist: kein eigener Codestand und
// keine eigene Datenhaltung. Wer je Kunde einen Zweig aufmacht, pflegt
// nach dem dritten Kunden drei Programme.

// Marke ist das Erscheinungsbild einer Organisation.
type Marke struct {
	ID          string    `json:"id"`
	OrgID       string    `json:"orgId"`
	Name        string    `json:"name"`      // steht in Titeln und Hinweisseiten
	Host        string    `json:"host"`      // eigene Kurzdomain, klein geschrieben
	Primaer     string    `json:"primaer"`   // Hausfarbe
	Grund       string    `json:"grund"`     // Flaechenfarbe
	Tinte       string    `json:"tinte"`     // Schriftfarbe
	LogoSVG     string    `json:"logoSvg"`   // eingebettet, damit nichts nachgeladen wird
	Impressum   string    `json:"impressum"` // Verweis auf der Hinweisseite
	Datenschutz string    `json:"datenschutz"`
	Erstellt    time.Time `json:"erstellt"`
	Geloescht   bool      `json:"geloescht,omitempty"`
}

// StandardMarke gilt, solange keine eigene hinterlegt ist.
func StandardMarke() *Marke {
	return &Marke{
		Name: "pnkt", Primaer: "#d1006f", Grund: "#EBEEEE", Tinte: "#141018",
	}
}

// SetzeMarke legt die Marke einer Organisation an oder ersetzt sie.
func (s *Speicher) SetzeMarke(m *Marke) error {
	if strings.TrimSpace(m.OrgID) == "" {
		return errors.New("ohne Organisation")
	}
	m.Host = strings.ToLower(strings.TrimSpace(m.Host))

	s.mu.Lock()
	defer s.mu.Unlock()

	// Ein Host gehoert genau einer Marke. Zwei Marken auf demselben
	// Hostnamen waeren nicht aufloesbar — und ein Kunde saehe die
	// Hinweisseite eines anderen.
	if m.Host != "" {
		if andere, da := s.markenHost[m.Host]; da && andere.OrgID != m.OrgID {
			return errors.New("dieser Hostname gehoert bereits einer anderen Organisation")
		}
	}
	if alt, da := s.marken[m.OrgID]; da {
		m.ID, m.Erstellt = alt.ID, alt.Erstellt
		delete(s.markenHost, alt.Host)
	} else {
		m.ID, m.Erstellt = kennung(), time.Now().UTC()
	}
	if err := s.schreibe(s.zugangDatei, satz{Art: "marke", Marke: m}); err != nil {
		return err
	}
	s.marke(m)
	return nil
}

func (s *Speicher) marke(m *Marke) {
	if m.Geloescht {
		delete(s.marken, m.OrgID)
		delete(s.markenHost, m.Host)
		return
	}
	s.marken[m.OrgID] = m
	if m.Host != "" {
		s.markenHost[m.Host] = m
	}
}

// MarkeNachHost loest die Marke aus dem Hostnamen der Anfrage auf.
// Das ist der ganze Trick am White-Label: derselbe Dienst, dieselben
// Daten, nur ein anderes Gesicht.
func (s *Speicher) MarkeNachHost(host string) *Marke {
	host = strings.ToLower(host)
	if i := strings.Index(host, ":"); i >= 0 {
		host = host[:i]
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if m, da := s.markenHost[host]; da {
		return m
	}
	return StandardMarke()
}

// MarkeNachOrg liefert die Marke einer Organisation.
func (s *Speicher) MarkeNachOrg(orgID string) *Marke {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if m, da := s.marken[orgID]; da {
		return m
	}
	return StandardMarke()
}

// --- Mitarbeitende --------------------------------------------------------

// Organisation eines Kontos: der Inhaber zeigt auf sich selbst.
func (k *Konto) Organisation() string {
	if k.GehoertZu != "" {
		return k.GehoertZu
	}
	return k.ID
}

// DarfSchreiben sagt, ob die Rolle aendern darf. Leser duerfen lesen.
func DarfSchreiben(rolle string) bool {
	return rolle == RolleInhaber || rolle == RolleRedakteur
}

// DarfVerwalten sagt, ob die Rolle loeschen, Marke setzen und
// Mitarbeitende fuehren darf. Das bleibt beim Inhaber.
func DarfVerwalten(rolle string) bool {
	return rolle == RolleInhaber
}

// NimmMitarbeitendeAuf haengt ein bestehendes Konto an eine Organisation.
// Einladungen per E-Mail gibt es nicht: die Person legt sich selbst ein
// Konto an, der Inhaber holt sie dann herein. Damit wandert kein
// Passwort durch ein Postfach.
func (s *Speicher) NimmMitarbeitendeAuf(orgID, mail, rolle string) (*Konto, error) {
	switch rolle {
	case RolleRedakteur, RolleLeser:
	default:
		return nil, errors.New("erlaubt sind redakteur und leser")
	}

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
		return nil, errors.New("zu dieser E-Mail gibt es noch kein Konto — " +
			"die Person legt sich zuerst selbst eines an")
	}
	if k.ID == orgID {
		return nil, errors.New("der Inhaber ist bereits in der Organisation")
	}
	if k.GehoertZu != "" && k.GehoertZu != orgID {
		return nil, errors.New("diese Person gehoert bereits zu einer anderen Organisation")
	}

	k.GehoertZu, k.Rolle = orgID, rolle
	if err := s.schreibe(s.zugangDatei, satz{Art: "konto", Konto: k}); err != nil {
		return nil, err
	}
	return k, nil
}

// EntlasseMitarbeitende loest die Bindung wieder. Das Konto bleibt
// bestehen — es gehoert der Person, nicht der Organisation.
func (s *Speicher) EntlasseMitarbeitende(orgID, kontoID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	k, da := s.konten[kontoID]
	if !da || k.GehoertZu != orgID {
		return errors.New("diese Person gehoert nicht zu dieser Organisation")
	}
	k.GehoertZu, k.Rolle = "", RolleInhaber
	return s.schreibe(s.zugangDatei, satz{Art: "konto", Konto: k})
}

// Mitarbeitende zaehlt die Personen einer Organisation auf, den Inhaber
// eingeschlossen. Passwortabdruecke bleiben drinnen.
func (s *Speicher) Mitarbeitende(orgID string) []map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var aus []map[string]string
	for _, k := range s.konten {
		if k.Organisation() != orgID || k.Geloescht {
			continue
		}
		aus = append(aus, map[string]string{
			"id": k.ID, "name": k.Name, "mail": k.Mail, "rolle": k.Rolle,
		})
	}
	return aus
}

// KontoNachID liefert ein Konto ohne Abdruck und Salz.
func (s *Speicher) KontoNachID(id string) (*Konto, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	k, da := s.konten[id]
	return k, da
}
