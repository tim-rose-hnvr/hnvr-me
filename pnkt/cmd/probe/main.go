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
	formen := []string{"quadrat", "punkt", "rund", "weich", "mosaik", "raute",
		"kreuz", "stern", "querstriche", "laengsstriche"}
	rahmen := []string{"quadrat", "rund", "blatt", "kissen"}
	kerne := []string{"quadrat", "rund", "punkt", "weich"}

	var faelle []fall
	for _, f := range formen {
		for _, ra := range rahmen {
			for _, ke := range kerne {
				inhalt := fmt.Sprintf("https://pnkt.me/%s-%s-%s", f, ra, ke)
				s, err := qr.Baue(inhalt, qr.Q, 0)
				if err != nil {
					fmt.Fprintln(os.Stderr, err)
					continue
				}
				g := qr.StandardGestalt(60)
				g.Modulform, g.Augenrahmen, g.Augenkern = f, ra, ke
				faelle = append(faelle, fall{f + "-" + ra + "-" + ke, inhalt, s.Version, "Q", s.SVG(g)})
			}
		}
	}
	json.NewEncoder(os.Stdout).Encode(faelle)
}
