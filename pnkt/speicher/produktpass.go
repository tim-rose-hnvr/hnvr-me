package speicher

import (
	"errors"
	"strings"
	"time"
)

// Der digitale Produktpass ist die Seite hinter dem Code, nicht der Code.
// Die ESPR verlangt einen Datentraeger am Produkt und dahinter Angaben,
// die ein Mensch und eine Maschine lesen koennen. Der QR-Code ist der
// billige Teil davon; die Seite ist die Anforderung.
//
// Drei Entscheidungen stecken im Aufbau:
//
// Erstens ist der Pass an die GTIN gebunden, nicht an einen Code. Ein
// Artikel bekommt seinen Pass einmal; ob er auf zehn Etiketten gedruckt
// wird oder auf eines, aendert daran nichts.
//
// Zweitens hat jeder Pass eine Fassung, und alte Fassungen bleiben
// stehen. Ein Pass beschreibt ein Produkt, das jemand in der Hand haelt —
// wer sein Geraet von 2026 nachschlaegt, darf nicht die Angaben zum
// Nachfolger sehen.
//
// Drittens sind die Angaben getrennt in oeffentlich und beschraenkt. Die
// ESPR sieht Felder vor, die nur Behoerden, Reparaturbetriebe und
// Verwerter sehen. Wer das nachtraeglich einbaut, hat bis dahin alles
// veroeffentlicht.

// Angabe ist ein Feld des Passes: eine Bezeichnung, ein Wert, und die
// Angabe, wer es sehen darf.
type Angabe struct {
	Feld        string `json:"feld"`
	Wert        string `json:"wert"`
	Einheit     string `json:"einheit,omitempty"`
	Beschraenkt bool   `json:"beschraenkt,omitempty"` // nur mit Schluessel
}

// Beleg ist ein Dokument: Konformitaetserklaerung, Pruefbericht,
// Reparaturanleitung. Verlinkt, nicht eingebettet — ein Pass soll auch
// dann noch lesbar sein, wenn das Dokument gerade nicht erreichbar ist.
type Beleg struct {
	Titel       string `json:"titel"`
	URL         string `json:"url"`
	Art         string `json:"art,omitempty"` // konformitaet, pruefbericht, anleitung, sicherheitsdatenblatt
	Beschraenkt bool   `json:"beschraenkt,omitempty"`
}

// Stoff ist ein Bestandteil mit seinem Anteil.
type Stoff struct {
	Name        string  `json:"name"`
	AnteilPro   float64 `json:"anteilProzent,omitempty"`
	Rezykliert  float64 `json:"rezykliertProzent,omitempty"`
	Besorgnis   bool    `json:"besorgniserregend,omitempty"` // SVHC nach REACH
	CASNummer   string  `json:"casNummer,omitempty"`
	Bemerkung   string  `json:"bemerkung,omitempty"`
	Beschraenkt bool    `json:"beschraenkt,omitempty"`
}

// Produktpass ist der gesamte Eintrag zu einem Artikel.
type Produktpass struct {
	ID      string `json:"id"`
	KontoID string `json:"kontoId"`
	GTIN    string `json:"gtin"` // auf 14 Stellen normiert
	Charge  string `json:"charge,omitempty"`
	Serie   string `json:"serie,omitempty"`

	Bezeichnung  string `json:"bezeichnung"`
	Modell       string `json:"modell,omitempty"`
	Beschreibung string `json:"beschreibung,omitempty"`
	Sprache      string `json:"sprache,omitempty"` // ISO 639-1, Standard "de"

	Hersteller          string `json:"hersteller,omitempty"`
	HerstellerKennung   string `json:"herstellerKennung,omitempty"` // GLN oder EORI
	HerstellerAnschrift string `json:"herstellerAnschrift,omitempty"`
	Ursprungsland       string `json:"ursprungsland,omitempty"`
	Herstelldatum       string `json:"herstelldatum,omitempty"` // JJJJ-MM-TT

	Stoffe  []Stoff  `json:"stoffe,omitempty"`
	Angaben []Angabe `json:"angaben,omitempty"`
	Belege  []Beleg  `json:"belege,omitempty"`

	Pflege      string `json:"pflege,omitempty"`
	Ersatzteile string `json:"ersatzteile,omitempty"`
	Reparatur   string `json:"reparatur,omitempty"`
	Ruecknahme  string `json:"ruecknahme,omitempty"`
	Entsorgung  string `json:"entsorgung,omitempty"`

	Fassung        int       `json:"fassung"`
	Erstellt       time.Time `json:"erstellt"`
	Geaendert      time.Time `json:"geaendert"`
	Zurueckgezogen bool      `json:"zurueckgezogen,omitempty"`
}

// Schluessel eines Passes: GTIN, Charge und Serie zusammen. Ohne Charge
// gilt der Pass fuer den ganzen Artikel.
func passSchluessel(gtin, charge, serie string) string {
	return strings.ToLower(gtin + "|" + charge + "|" + serie)
}

// SetzeProduktpass legt einen Pass an oder schreibt eine neue Fassung.
// Die alte Fassung bleibt in der Datei stehen — ein Pass beschreibt ein
// Produkt, das jemand in der Hand haelt.
func (s *Speicher) SetzeProduktpass(p *Produktpass) error {
	if strings.TrimSpace(p.GTIN) == "" {
		return errors.New("ohne GTIN")
	}
	if strings.TrimSpace(p.Bezeichnung) == "" {
		return errors.New("ohne Bezeichnung")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	schluessel := passSchluessel(p.GTIN, p.Charge, p.Serie)
	jetzt := time.Now().UTC()
	if alt, da := s.paesse[schluessel]; da {
		if alt.KontoID != "" && p.KontoID != "" && alt.KontoID != p.KontoID {
			return errors.New("zu dieser GTIN fuehrt bereits eine andere Organisation einen Pass")
		}
		p.ID, p.Erstellt = alt.ID, alt.Erstellt
		p.Fassung = alt.Fassung + 1
	} else {
		p.ID, p.Erstellt, p.Fassung = kennung(), jetzt, 1
	}
	p.Geaendert = jetzt
	if p.Sprache == "" {
		p.Sprache = "de"
	}

	if err := s.schreibe(s.passDatei, p); err != nil {
		return err
	}
	s.paesse[schluessel] = p
	return nil
}

// Produktpass sucht den Pass zu einem Artikel. Gefragt wird von genau
// nach allgemein: erst GTIN mit Charge und Serie, dann nur mit Charge,
// dann der Pass fuer den ganzen Artikel. So bekommt eine Rueckrufcharge
// ihre eigenen Angaben, ohne dass jede Charge einen Pass braucht.
func (s *Speicher) Produktpass(gtin, charge, serie string) (*Produktpass, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, versuch := range [][2]string{{charge, serie}, {charge, ""}, {"", ""}} {
		if p, da := s.paesse[passSchluessel(gtin, versuch[0], versuch[1])]; da && !p.Zurueckgezogen {
			return p, true
		}
	}
	return nil, false
}

// ProduktpassListe nennt die Paesse einer Organisation.
func (s *Speicher) ProduktpassListe(kontoID string) []*Produktpass {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var aus []*Produktpass
	for _, p := range s.paesse {
		if p.Zurueckgezogen {
			continue
		}
		if kontoID == "" || p.KontoID == kontoID {
			aus = append(aus, p)
		}
	}
	return aus
}

// ZiehePassZurueck nimmt einen Pass aus dem Verkehr. Wie beim Code wird
// nichts geloescht: der Eintrag bleibt, die Seite sagt es.
func (s *Speicher) ZiehePassZurueck(gtin, charge, serie string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	schluessel := passSchluessel(gtin, charge, serie)
	p, da := s.paesse[schluessel]
	if !da {
		return errors.New("zu diesem Artikel gibt es keinen Pass")
	}
	neu := *p
	neu.Zurueckgezogen = true
	neu.Fassung = p.Fassung + 1
	neu.Geaendert = time.Now().UTC()
	if err := s.schreibe(s.passDatei, &neu); err != nil {
		return err
	}
	s.paesse[schluessel] = &neu
	return nil
}

// Oeffentlich liefert eine Kopie ohne die beschraenkten Angaben. Die
// Trennung geschieht hier und nicht in der Oberflaeche: eine Oberflaeche,
// die etwas ausblendet, hat es trotzdem ausgeliefert.
func (p *Produktpass) Oeffentlich() *Produktpass {
	kopie := *p
	kopie.Angaben = nil
	for _, a := range p.Angaben {
		if !a.Beschraenkt {
			kopie.Angaben = append(kopie.Angaben, a)
		}
	}
	kopie.Belege = nil
	for _, b := range p.Belege {
		if !b.Beschraenkt {
			kopie.Belege = append(kopie.Belege, b)
		}
	}
	kopie.Stoffe = nil
	for _, st := range p.Stoffe {
		if !st.Beschraenkt {
			kopie.Stoffe = append(kopie.Stoffe, st)
		}
	}
	return &kopie
}

// Beschraenkte zaehlt, wie viele Angaben zurueckgehalten werden. Die Zahl
// gehoert auf die oeffentliche Seite: dass etwas zurueckgehalten wird,
// ist selbst keine Geheimsache, und wer es braucht, weiss dann, dass es
// sich zu fragen lohnt.
func (p *Produktpass) Beschraenkte() int {
	n := 0
	for _, a := range p.Angaben {
		if a.Beschraenkt {
			n++
		}
	}
	for _, b := range p.Belege {
		if b.Beschraenkt {
			n++
		}
	}
	for _, st := range p.Stoffe {
		if st.Beschraenkt {
			n++
		}
	}
	return n
}
