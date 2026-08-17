// Uebernahme holt den Bestand aus dem Wix-Datenspeicher von PUNKT in die
// eigene Ablage.
//
// Erwartet werden die Antworten der Wix-Datenschnittstelle, je Sammlung
// eine Datei, so wie sie aus einer Abfrage herausfallen:
//
//	POST https://www.wixapis.com/wix-data/v2/items/query
//	{"dataCollectionId":"PK_Codes","query":{"paging":{"limit":100}}}
//
// Der Lauf ist immer trocken, solange nicht -schreiben gesetzt ist:
//
//	go run ./cmd/uebernahme -quelle ./ausfuhr                  # Bericht
//	go run ./cmd/uebernahme -quelle ./ausfuhr -daten ./daten -schreiben
//
// Erst den Bericht lesen, dann schreiben. Wer erst beim Schreiben merkt,
// dass ein Kuerzel doppelt ist, hat den halben Bestand schon drin.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"pnkt.me/pnkt/speicher"
	"pnkt.me/pnkt/uebernahme"
)

func main() {
	quelle := flag.String("quelle", "./ausfuhr", "Verzeichnis mit den Wix-Antworten")
	daten := flag.String("daten", "./daten", "Zielverzeichnis der Ablage")
	schreiben := flag.Bool("schreiben", false, "wirklich schreiben statt nur berichten")
	konto := flag.String("konto", "", "Konto, dem verwaiste Kuerzel zugeschrieben werden")
	flag.Parse()

	q := uebernahme.Quelle{
		Codes:      lies(*quelle, "PK_Codes"),
		Ordner:     lies(*quelle, "PK_Ordner"),
		Konten:     lies(*quelle, "PK_Konten"),
		Mitglieder: lies(*quelle, "PK_Mitglieder"),
		Ereignisse: lies(*quelle, "PK_Ereignisse"),
	}

	// Auch der Trockenlauf braucht eine Ablage: er prueft gegen den
	// Bestand, der schon da ist. Ohne -schreiben wird sie nur gelesen.
	ablage, err := speicher.Oeffne(*daten)
	if err != nil {
		log.Fatalf("Ablage nicht zu oeffnen: %v", err)
	}
	defer ablage.Schliesse()

	bericht := uebernahme.Fuehre(q, ablage, !*schreiben)
	uebernahme.SperreVerwaiste(q, *konto, ablage, !*schreiben, bericht)

	fmt.Print(bericht.Text())
	if bericht.Fehler() > 0 {
		os.Exit(1)
	}
}

// lies holt eine Sammlung. Eine fehlende Datei ist kein Fehler — nicht
// jede Anlage hat jede Sammlung gefuellt.
func lies(verzeichnis, name string) []uebernahme.Zeile {
	pfad := filepath.Join(verzeichnis, name+".json")
	roh, err := os.ReadFile(pfad)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		log.Fatalf("%s: %v", pfad, err)
	}
	zeilen, err := uebernahme.Lies(roh)
	if err != nil {
		log.Fatalf("%s: %v", pfad, err)
	}
	return zeilen
}
