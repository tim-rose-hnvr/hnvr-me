package main

import (
	"fmt"
	"pnkt.me/pnkt/qr"
)

func main() {
	s, err := qr.Baue("https://pnkt.me/2cnjdq", qr.M, 0)
	if err != nil {
		panic(err)
	}
	fmt.Printf("Version %d Stufe %s Maske %d Kante %d\n", s.Version, s.Stufe, s.Maske, s.Kante)
	fmt.Print(s.Text())
}
