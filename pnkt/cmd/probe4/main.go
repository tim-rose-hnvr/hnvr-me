// Probe4 schreibt Druckdateien in allen drei Farbwelten.
package main

import (
	"fmt"
	"os"
	"path/filepath"

	"pnkt.me/pnkt/ausgabe"
	"pnkt.me/pnkt/farbe"
	"pnkt.me/pnkt/qr"
)

func main() {
	ziel := os.Args[1]
	os.MkdirAll(ziel, 0o755)
	qr.Bildschirmfarbe = func(a string) string { return farbe.Lies(a).Hex() }

	faelle := map[string]string{
		"rgb":    "#a82e23",
		"cmyk":   "cmyk(0.05, 0.92, 0.86, 0.12)",
		"sonder": "sonder(HKS 13 K, 0, 1, 1, 0)",
	}
	for name, f := range faelle {
		inhalt := "https://pnkt.me/farbe-" + name
		s, _ := qr.Baue(inhalt, qr.Q, 0)
		g := qr.StandardGestalt(50)
		g.Vordergrund = f
		g.Rahmen = &qr.Rahmen{Art: "balken", Text: "JETZT SCANNEN", Farbe: f}
		z := s.Formen(g)
		os.WriteFile(filepath.Join(ziel, name+".pdf"), ausgabe.PDF(z, name), 0o644)
		os.WriteFile(filepath.Join(ziel, name+".eps"), ausgabe.EPS(z, name), 0o644)
		os.WriteFile(filepath.Join(ziel, name+".svg"), []byte(s.SVG(g)), 0o644)
		os.WriteFile(filepath.Join(ziel, name+".txt"), []byte(inhalt), 0o644)
	}
	fmt.Println("drei Farbwelten geschrieben")
}
