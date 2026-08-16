// Probe schreibt Testsymbole als SVG, damit ein fremder Decoder sie
// gegenlesen kann. Der eigene Encoder darf sich nicht selbst bestaetigen.
package main

import (
	"encoding/json"
	"fmt"
	"os"
	"pnkt.me/pnkt/qr"
)

type fall struct {
	Name    string `json:"name"`
	Inhalt  string `json:"inhalt"`
	Version int    `json:"version"`
	Stufe   string `json:"stufe"`
	SVG     string `json:"svg"`
}

func main() {
	stufen := []qr.Stufe{qr.L, qr.M, qr.Q, qr.H}
	var faelle []fall

	inhalte := map[string]string{
		"kurz":        "https://pnkt.me/2cnjdq",
		"ziffern":     "1234567890123456789012345678901234567890",
		"alnum":       "HELLO WORLD 123 $%*+-./:",
		"umlaute":     "Grüße aus Hannover — Straßenfest & Röstkaffee",
		"digitallink": "https://pnkt.me/01/04006381333931/10/A77?17=271231",
		"lang":        "https://pnkt.me/p/" + string(make([]byte, 0)) + "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
	}

	// Alle Stufen bei kleiner Version, dazu ein Querschnitt durch die Versionen.
	for name, inhalt := range inhalte {
		for _, st := range stufen {
			s, err := qr.Baue(inhalt, st, 0)
			if err != nil {
				continue
			}
			faelle = append(faelle, fall{name, inhalt, s.Version, st.String(),
				s.SVG(qr.StandardGestalt(60))})
		}
	}

	// Erzwungene Versionen quer durch die Tabelle, damit jede Zeile
	// der Block- und Fehlerkorrekturtabellen einmal angefasst wird.
	for v := 1; v <= 40; v++ {
		for _, st := range stufen {
			inhalt := fmt.Sprintf("V%d-%s-", v, st)
			for len(inhalt) < qr.Datenbytes(v, st)-3 {
				inhalt += "x"
			}
			s, err := qr.Baue(inhalt, st, v)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Version %d Stufe %s: %v\n", v, st, err)
				continue
			}
			faelle = append(faelle, fall{fmt.Sprintf("voll-v%d", v), inhalt, s.Version, st.String(),
				s.SVG(qr.StandardGestalt(120))})
		}
	}

	json.NewEncoder(os.Stdout).Encode(faelle)
}
