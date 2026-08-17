package speicher

import (
	"errors"
	"fmt"
	"strings"
	"time"
)

// Entwuerfe: mehrere Gestaltungen zu einem Code.
//
// Der Entwurf des Systems zeigt an dieser Stelle einen Streifen von
// Varianten, jede mit einer eigenen Scanrate darunter. Die Rate ist
// hier nicht dabei, und das ist keine Auslassung.
//
// Gemessen wird ueber das Kuerzel. Zwei Gestaltungen desselben Codes
// tragen dasselbe Kuerzel und fuehren auf dieselbe Adresse — beim Scan
// ist nicht zu unterscheiden, welche der beiden auf dem Papier stand.
// Eine Rate je Variante gaebe es nur, wenn jede Variante ein eigener
// Code mit eigenem Kuerzel waere; dann ist es keine Variante mehr,
// sondern eine Serie. Wer die Zahl trotzdem hinschreibt, schreibt eine
// Zufallszahl mit zwei Nachkommastellen hin.
//
// Was ein Entwurf leistet, ist das andere: eine Gestaltung aufheben,
// spaeter danebenlegen und wieder hervorholen, ohne sie aus dem
// Gedaechtnis neu einzustellen.

// Entwurf ist eine aufgehobene Gestaltung.
type Entwurf struct {
	Name     string         `json:"name"`
	Stil     map[string]any `json:"stil"`
	Erstellt time.Time      `json:"erstellt"`
}

// HoechstEntwuerfe begrenzt den Streifen. Acht sind mehr, als jemand
// nebeneinander beurteilen kann; wer den neunten braucht, hat kein
// Gestaltungsproblem mehr, sondern ein Entscheidungsproblem.
const HoechstEntwuerfe = 8

// SichereEntwurf legt eine Gestaltung unter einem Namen ab. Ein
// vorhandener Name wird ersetzt — zweimal „Terrakotta" waere im
// Streifen nicht auseinanderzuhalten.
func (s *Speicher) SichereEntwurf(codeID, name string, stil map[string]any) (*Code, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("ein Entwurf ohne Namen ist im Streifen nicht zu finden")
	}
	if len([]rune(name)) > 40 {
		return nil, errors.New("der Name ist zu lang, vierzig Zeichen reichen")
	}
	if len(stil) == 0 {
		return nil, errors.New("ohne Gestaltung")
	}

	return s.Aendere(codeID, func(c *Code) error {
		for i := range c.Entwuerfe {
			if strings.EqualFold(c.Entwuerfe[i].Name, name) {
				c.Entwuerfe[i].Stil = stil
				c.Entwuerfe[i].Erstellt = time.Now().UTC()
				return nil
			}
		}
		if len(c.Entwuerfe) >= HoechstEntwuerfe {
			return fmt.Errorf("mehr als %d Entwuerfe je Code gehen nicht — "+
				"erst einen entfernen", HoechstEntwuerfe)
		}
		c.Entwuerfe = append(c.Entwuerfe, Entwurf{
			Name: name, Stil: stil, Erstellt: time.Now().UTC()})
		return nil
	})
}

// LoescheEntwurf nimmt eine Gestaltung aus dem Streifen. Der Code
// selbst bleibt unberuehrt: was gedruckt ist, ist gedruckt.
func (s *Speicher) LoescheEntwurf(codeID, name string) (*Code, error) {
	gefunden := false
	c, err := s.Aendere(codeID, func(c *Code) error {
		var bleibt []Entwurf
		for _, e := range c.Entwuerfe {
			if strings.EqualFold(e.Name, name) {
				gefunden = true
				continue
			}
			bleibt = append(bleibt, e)
		}
		c.Entwuerfe = bleibt
		return nil
	})
	if err != nil {
		return nil, err
	}
	if !gefunden {
		return nil, fmt.Errorf("einen Entwurf %q gibt es nicht", name)
	}
	return c, nil
}

// UebernimmEntwurf macht einen Entwurf zur geltenden Gestaltung des
// Codes. Der Entwurf bleibt im Streifen stehen — sonst waere der
// vorige Stand nach dem ersten Klick weg.
func (s *Speicher) UebernimmEntwurf(codeID, name string) (*Code, error) {
	gefunden := false
	c, err := s.Aendere(codeID, func(c *Code) error {
		for _, e := range c.Entwuerfe {
			if strings.EqualFold(e.Name, name) {
				c.Stil = e.Stil
				gefunden = true
				return nil
			}
		}
		return fmt.Errorf("einen Entwurf %q gibt es nicht", name)
	})
	if err != nil {
		return nil, err
	}
	if !gefunden {
		return nil, fmt.Errorf("einen Entwurf %q gibt es nicht", name)
	}
	return c, nil
}
