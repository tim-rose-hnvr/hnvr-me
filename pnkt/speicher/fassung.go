package speicher

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Fassungen und Zurueckholen.
//
// Die Ablage haengt nur an: jede Aenderung eines Codes ist ein neuer
// Satz in codes.jsonl mit derselben Kennung, und beim Laden gewinnt der
// letzte. Damit steht die ganze Geschichte eines gedruckten Codes
// ohnehin auf der Platte — sie war bloss nicht abrufbar.
//
// Genau das braucht man, wenn jemand fragt, wohin ein Code im Maerz
// gezeigt hat. Und man braucht es, wenn jemand ein Ziel verstellt hat
// und es zurueckwill, ohne es aus dem Gedaechtnis neu einzutippen.
//
// Zurueckholen schreibt eine NEUE Fassung mit dem alten Inhalt. Es wird
// nichts ueberschrieben und der Zaehler laeuft nicht zurueck: sonst
// bekaeme die Geschichte ein Loch, und die Frage „wohin zeigte der Code
// im Maerz" waere nicht mehr zu beantworten.

// Fassungen liefert alle Staende eines Codes, aelteste zuerst.
//
// Gelesen wird von der Platte, nicht aus dem Verzeichnis im
// Arbeitsspeicher — dort steht nur der letzte Stand. Das ist der
// seltene Fall, in dem ein Dateizugriff richtig ist: die Geschichte
// eines Codes wird angesehen, wenn jemand eine Frage hat, nicht bei
// jedem Scan.
func (s *Speicher) Fassungen(codeID string) ([]Code, error) {
	var aus []Code
	err := s.lade("codes.jsonl", func(zeile []byte) error {
		var c Code
		if err := json.Unmarshal(zeile, &c); err != nil {
			return err
		}
		if c.ID == codeID {
			aus = append(aus, c)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if len(aus) == 0 {
		return nil, errors.New("unbekannter Code")
	}
	return aus, nil
}

// ErrSchonAktuell meldet, dass eine Fassung bereits die geltende ist.
var ErrSchonAktuell = errors.New("diese Fassung ist bereits die geltende")

// Hole holt einen frueheren Stand zurueck. Uebernommen werden die
// Angaben, die jemand von Hand gesetzt hat — nicht die Verwaltung.
func (s *Speicher) Hole(codeID string, fassung int, wer string) (*Code, error) {
	fassungen, err := s.Fassungen(codeID)
	if err != nil {
		return nil, err
	}
	var quelle *Code
	for i := range fassungen {
		if fassungen[i].Fassung == fassung {
			quelle = &fassungen[i]
			break
		}
	}
	if quelle == nil {
		return nil, fmt.Errorf("Fassung %d gibt es nicht — vorhanden sind %s",
			fassung, spanne(fassungen))
	}

	jetzt, da := s.NachID(codeID)
	if !da {
		return nil, errors.New("unbekannter Code")
	}
	// Ein geloeschter Code bleibt geloescht. Loeschen ist der einzige
	// Vorgang, den eine gedruckte Auflage nicht ueberlebt; er wird durch
	// Abtippen des Kuerzels bestaetigt und darf nicht nebenbei durch
	// „zurueckholen" rueckgaengig gemacht werden.
	if jetzt.Geloescht {
		return nil, errors.New("dieser Code ist geloescht — Geloeschtes wird nicht " +
			"zurueckgeholt, sonst fuehrte ein stillgelegtes Kuerzel wieder irgendwohin")
	}
	if gleicherStand(jetzt, quelle) {
		return nil, ErrSchonAktuell
	}

	alt := jetzt.Ziel
	neu, err := s.Aendere(codeID, func(c *Code) error {
		c.Ziel = quelle.Ziel
		c.Name = quelle.Name
		c.Ordner = quelle.Ordner
		c.Typ = quelle.Typ
		c.Stil = quelle.Stil
		c.Inhalt = quelle.Inhalt
		c.Regeln = quelle.Regeln
		c.UTM = quelle.UTM
		c.Druck = quelle.Druck
		c.GueltigBis = quelle.GueltigBis
		// Kuerzel, GTIN, Konto, Erstellzeit und der Zustand „aktiv"
		// bleiben, wie sie sind. Das Kuerzel steht auf Papier, die GTIN
		// auf der Verpackung, und wer einen Code abgeschaltet hat, will
		// ihn nicht durch ein Zurueckholen wieder anschalten.
		return nil
	})
	if err != nil {
		return nil, err
	}
	if err := s.Protokolliere(Ereignis{
		KontoID: neu.KontoID, Wer: oderWer(wer), Was: "code.zurueckgeholt",
		Gegenstand: codeID, Alt: alt,
		Neu: fmt.Sprintf("%s (aus Fassung %d)", neu.Ziel, fassung),
	}); err != nil {
		return nil, err
	}
	return neu, nil
}

func oderWer(wer string) string {
	if strings.TrimSpace(wer) == "" {
		return "unbekannt"
	}
	return wer
}

func spanne(fassungen []Code) string {
	var teile []string
	for _, c := range fassungen {
		teile = append(teile, fmt.Sprint(c.Fassung))
	}
	return strings.Join(teile, ", ")
}

// gleicherStand vergleicht nur, was Hole uebertraegt. Zeitstempel und
// Fassungsnummer bleiben aussen vor — sonst waere nie etwas gleich.
func gleicherStand(a, b *Code) bool {
	return a.Ziel == b.Ziel && a.Name == b.Name && a.Ordner == b.Ordner &&
		a.Typ == b.Typ && gleichZeit(a.GueltigBis, b.GueltigBis) &&
		gleichJSON(a.Stil, b.Stil) && gleichJSON(a.Inhalt, b.Inhalt) &&
		gleichJSON(a.Regeln, b.Regeln) && gleichJSON(a.Druck, b.Druck) &&
		gleichText(a.UTM, b.UTM)
}

func gleichZeit(a, b *time.Time) bool {
	if a == nil || b == nil {
		return a == b
	}
	return a.Equal(*b)
}

// gleichJSON vergleicht zwei lose Karten ueber ihre JSON-Form. Das ist
// langsam und hier genau richtig: es passiert einmal beim Zurueckholen,
// und ein selbstgeschriebener Tiefenvergleich waere eine Fehlerquelle
// fuer nichts.
func gleichJSON(a, b map[string]any) bool {
	if len(a) == 0 && len(b) == 0 {
		return true
	}
	ja, err1 := json.Marshal(a)
	jb, err2 := json.Marshal(b)
	if err1 != nil || err2 != nil {
		return false
	}
	return string(ja) == string(jb)
}

func gleichText(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}
