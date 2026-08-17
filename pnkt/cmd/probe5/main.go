// Probe5 prueft die Modulform "tropfen" gegen. Geschrieben werden PDF und
// SVG in 32 Kombinationen — zwei Augenrahmen, vier Kernformen, vier
// Fehlerkorrekturstufen — jeweils zweimal: einmal als Tropfen und einmal,
// mit derselben Nutzlast, als Quadrat.
//
// Die Gegenprobe ist der Punkt. Ohne sie waere nicht zu trennen, ob eine
// neue Form schlecht liest oder ob Rasterer und Decoder an ihre Grenze
// kommen. Gerastert wird mit Ghostscript, gelesen mit OpenCV:
//
//	go run ./cmd/probe5 /tmp/tropfen
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

	rahmen := []string{"quadrat", "kissen"}
	kerne := []string{"quadrat", "rund", "punkt", "weich"}
	stufen := []struct {
		name string
		s    qr.Stufe
	}{{"L", qr.L}, {"M", qr.M}, {"Q", qr.Q}, {"H", qr.H}}

	for _, ra := range rahmen {
		for _, ke := range kerne {
			for _, st := range stufen {
				inhalt := fmt.Sprintf("https://pnkt.me/tropfen-%s-%s-%s", ra, ke, st.name)
				s, err := qr.Baue(inhalt, st.s, 0)
				if err != nil {
					fmt.Fprintln(os.Stderr, err)
					continue
				}
				name := fmt.Sprintf("tropfen-%s-%s-%s", ra, ke, st.name)
				// Dieselbe Nutzlast einmal als Tropfen und einmal als
				// Quadrat. Ohne diese Gegenprobe waere nicht zu trennen,
				// ob die Form oder der Decoder scheitert.
				for _, form := range []string{"tropfen", "quadrat"} {
					g := qr.StandardGestalt(60)
					g.Modulform, g.Augenrahmen, g.Augenkern = form, ra, ke
					datei := filepath.Join(ziel, form+"__"+name)
					os.WriteFile(datei+".pdf", ausgabe.PDF(s.Formen(g), name), 0o644)
					os.WriteFile(datei+".svg", []byte(s.SVG(g)), 0o644)
				}
				fmt.Println(name, inhalt)
			}
		}
	}
}
