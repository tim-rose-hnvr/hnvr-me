// Probe3 schreibt dieselbe Zeichnung in allen drei Ausgabeformaten,
// damit ein fremder Betrachter jedes einzeln gegenlesen kann.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/qr"
)

func main() {
	ziel := os.Args[1]
	os.MkdirAll(ziel, 0o755)

	faelle := map[string]func() qr.Gestalt{
		"einfarbig": func() qr.Gestalt { return qr.StandardGestalt(60) },
		"verlauf-linear": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Verlauf = &qr.Verlauf{Art: "linear", Winkel: 45, Haelt: []qr.Halt{
				{Pos: 0, Farbe: "#4f39f6"}, {Pos: 1, Farbe: "#0d0d12"}}}
			return g
		},
		"verlauf-drei": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Verlauf = &qr.Verlauf{Art: "linear", Winkel: 90, Haelt: []qr.Halt{
				{Pos: 0, Farbe: "#d1006f"}, {Pos: 0.5, Farbe: "#4f39f6"}, {Pos: 1, Farbe: "#0d0d12"}}}
			return g
		},
		"verlauf-radial": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Verlauf = &qr.Verlauf{Art: "radial", Haelt: []qr.Halt{
				{Pos: 0, Farbe: "#141018"}, {Pos: 1, Farbe: "#5b1030"}}}
			return g
		},
		"fliessend": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Modulform = "fliessend"
			return g
		},
		"fliessend-verlauf": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Modulform = "fliessend"
			g.Verlauf = &qr.Verlauf{Art: "linear", Winkel: 30, Haelt: []qr.Halt{
				{Pos: 0, Farbe: "#0d0d12"}, {Pos: 1, Farbe: "#7a1d3f"}}}
			return g
		},
		"rahmen-balken": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Rahmen = &qr.Rahmen{Art: "balken", Text: "JETZT SCANNEN"}
			return g
		},
		"rahmen-schild": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Rahmen = &qr.Rahmen{Art: "schild", Text: "SPEISEKARTE", Farbe: "#141018", Textfarbe: "#ffffff"}
			return g
		},
		"rahmen-verlauf": func() qr.Gestalt {
			g := qr.StandardGestalt(60)
			g.Modulform = "fliessend"
			g.Rahmen = &qr.Rahmen{Art: "schild", Text: "Grüße & Straße"}
			g.Verlauf = &qr.Verlauf{Art: "linear", Winkel: 60, Haelt: []qr.Halt{
				{Pos: 0, Farbe: "#0d0d12"}, {Pos: 1, Farbe: "#4f39f6"}}}
			return g
		},
	}

	for name, mach := range faelle {
		inhalt := "https://pnkt.me/" + name
		s, err := qr.Baue(inhalt, qr.Q, 0)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			continue
		}
		g := mach()
		z := s.Formen(g)
		os.WriteFile(filepath.Join(ziel, name+".svg"), []byte(s.SVG(g)), 0o644)
		os.WriteFile(filepath.Join(ziel, name+".pdf"), ausgabe.PDF(z, name), 0o644)
		os.WriteFile(filepath.Join(ziel, name+".eps"), ausgabe.EPS(z, name), 0o644)
		os.WriteFile(filepath.Join(ziel, name+".txt"), []byte(inhalt), 0o644)
	}
	fmt.Println(len(faelle), "Faelle in drei Formaten")
}
