// Package qr erzeugt QR-Symbole nach ISO/IEC 18004.
//
// Eigener Encoder, keine fremden Pakete. Der Grund ist nicht Stolz, sondern
// Druck: Wer einen Code drucken will, muss die Modulmatrix selbst in der Hand
// haben — Modulgroesse, Ruhezone, Maske und Fehlerkorrektur sind
// Druckentscheidungen, keine Darstellungsdetails. Bibliotheken, die nur ein
// PNG liefern, nehmen einem genau das aus der Hand.
package qr

import (
	"errors"
	"fmt"
	"strings"
)

// Stufe ist die Fehlerkorrekturstufe.
type Stufe int

const (
	L Stufe = iota // ~7 % wiederherstellbar
	M              // ~15 %
	Q              // ~25 %
	H              // ~30 %
)

func (s Stufe) String() string {
	switch s {
	case L:
		return "L"
	case M:
		return "M"
	case Q:
		return "Q"
	case H:
		return "H"
	}
	return "?"
}

// StufeAus liest die Stufe aus einem Buchstaben.
func StufeAus(s string) (Stufe, error) {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "L":
		return L, nil
	case "M":
		return M, nil
	case "Q":
		return Q, nil
	case "H":
		return H, nil
	}
	return M, fmt.Errorf("unbekannte Fehlerkorrekturstufe %q", s)
}

// Symbol ist das fertige Ergebnis: eine quadratische Modulmatrix.
type Symbol struct {
	Version int    // 1 bis 40
	Stufe   Stufe  //
	Maske   int    // 0 bis 7, gewaehlt nach den Strafregeln
	Kante   int    // Module je Kante, 17 + 4*Version
	Module  []bool // Kante*Kante, true ist dunkel
}

// Dunkel sagt, ob das Modul an der Stelle gesetzt ist.
// Ausserhalb der Matrix ist alles hell — das ist die Ruhezone.
func (s *Symbol) Dunkel(x, y int) bool {
	if x < 0 || y < 0 || x >= s.Kante || y >= s.Kante {
		return false
	}
	return s.Module[y*s.Kante+x]
}

// --- Tabellen aus der Norm ------------------------------------------------
// Nur zwei Tabellen sind wirklich noetig; alles andere laesst sich rechnen.

// Fehlerkorrekturbytes je Block, nach Stufe und Version.
var ecJeBlock = [4][41]int{
	// Index 0 bleibt leer, Versionen zaehlen ab 1.
	L: {0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},
	M: {0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28},
	Q: {0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},
	H: {0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30},
}

// Zahl der Fehlerkorrekturbloecke, nach Stufe und Version.
var bloecke = [4][41]int{
	L: {0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25},
	M: {0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49},
	Q: {0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68},
	H: {0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81},
}

// Rohe Datenmodule je Version: alles ausser Funktionsmustern und
// Formatangaben. Gerechnet statt getippt, damit sich keine Zahl einschleicht.
func roheModule(version int) int {
	kante := 17 + 4*version
	roh := kante * kante
	roh -= 3 * 8 * 8        // drei Suchmuster mit Trennlinie
	roh -= 2 * (kante - 16) // zwei Taktlinien
	roh -= 2 * 15           // Formatangaben, doppelt gefuehrt
	roh--                   // das immer dunkle Modul
	if version >= 2 {
		n := version/7 + 2 // Ausrichtungsmuster je Achse
		roh -= (n*n - 3) * 25
		roh += (n - 2) * 2 * 5 // Ueberschneidung mit den Taktlinien
	}
	if version >= 7 {
		roh -= 2 * 18 // Versionsangaben, doppelt gefuehrt
	}
	return roh
}

// Datenbytes, die in ein Symbol passen.
func Datenbytes(version int, stufe Stufe) int {
	return roheModule(version)/8 - ecJeBlock[stufe][version]*bloecke[stufe][version]
}

// --- Betriebsarten --------------------------------------------------------

type art int

const (
	artZiffern art = iota
	artAlnum
	artBytes
)

const alnumZeichen = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

func waehleArt(text string) art {
	ziffern, alnum := true, true
	for _, r := range text {
		if r < '0' || r > '9' {
			ziffern = false
		}
		if !strings.ContainsRune(alnumZeichen, r) {
			alnum = false
		}
		if !ziffern && !alnum {
			return artBytes
		}
	}
	switch {
	case ziffern:
		return artZiffern
	case alnum:
		return artAlnum
	default:
		return artBytes
	}
}

// Laenge des Zeichenzaehlers, abhaengig von Version und Betriebsart.
func zaehlerbits(a art, version int) int {
	var stufe int
	switch {
	case version <= 9:
		stufe = 0
	case version <= 26:
		stufe = 1
	default:
		stufe = 2
	}
	switch a {
	case artZiffern:
		return []int{10, 12, 14}[stufe]
	case artAlnum:
		return []int{9, 11, 13}[stufe]
	default:
		return []int{8, 16, 16}[stufe]
	}
}

// --- Bitstrom -------------------------------------------------------------

type bits struct {
	daten  []byte
	laenge int
}

func (b *bits) schreibe(wert uint32, anzahl int) {
	for i := anzahl - 1; i >= 0; i-- {
		bit := (wert >> uint(i)) & 1
		if b.laenge%8 == 0 {
			b.daten = append(b.daten, 0)
		}
		if bit == 1 {
			b.daten[b.laenge/8] |= 1 << uint(7-b.laenge%8)
		}
		b.laenge++
	}
}

func kodiereNutzdaten(text string, a art, version int) *bits {
	b := &bits{}
	switch a {
	case artZiffern:
		b.schreibe(1, 4)
	case artAlnum:
		b.schreibe(2, 4)
	default:
		b.schreibe(4, 4)
	}

	roh := []byte(text)
	anzahl := len(roh)
	if a != artBytes {
		anzahl = len([]rune(text))
	}
	b.schreibe(uint32(anzahl), zaehlerbits(a, version))

	switch a {
	case artZiffern:
		for i := 0; i < len(text); i += 3 {
			ende := i + 3
			if ende > len(text) {
				ende = len(text)
			}
			stueck := text[i:ende]
			var wert uint32
			for _, z := range stueck {
				wert = wert*10 + uint32(z-'0')
			}
			b.schreibe(wert, len(stueck)*3+1)
		}
	case artAlnum:
		zeichen := []rune(text)
		for i := 0; i < len(zeichen); i += 2 {
			if i+1 < len(zeichen) {
				wert := uint32(strings.IndexRune(alnumZeichen, zeichen[i]))*45 +
					uint32(strings.IndexRune(alnumZeichen, zeichen[i+1]))
				b.schreibe(wert, 11)
			} else {
				b.schreibe(uint32(strings.IndexRune(alnumZeichen, zeichen[i])), 6)
			}
		}
	default:
		for _, z := range roh {
			b.schreibe(uint32(z), 8)
		}
	}
	return b
}

// --- Reed-Solomon ---------------------------------------------------------
// Rechnung im Galoiskoerper GF(256) mit dem Polynom 0x11D.

var (
	gfExp [512]byte
	gfLog [256]byte
)

func init() {
	x := 1
	for i := 0; i < 255; i++ {
		gfExp[i] = byte(x)
		gfLog[x] = byte(i)
		x <<= 1
		if x&0x100 != 0 {
			x ^= 0x11D
		}
	}
	for i := 255; i < 512; i++ {
		gfExp[i] = gfExp[i-255]
	}
}

func gfMal(a, b byte) byte {
	if a == 0 || b == 0 {
		return 0
	}
	return gfExp[int(gfLog[a])+int(gfLog[b])]
}

// Generatorpolynom fuer n Fehlerkorrekturbytes.
func generator(n int) []byte {
	poly := []byte{1}
	for i := 0; i < n; i++ {
		neu := make([]byte, len(poly)+1)
		for j, k := range poly {
			neu[j] ^= k
			neu[j+1] ^= gfMal(k, gfExp[i])
		}
		poly = neu
	}
	return poly
}

// Fehlerkorrekturbytes zu einem Datenblock.
func ecBytes(daten []byte, anzahl int) []byte {
	gen := generator(anzahl)
	rest := make([]byte, anzahl)
	for _, byteWert := range daten {
		faktor := byteWert ^ rest[0]
		copy(rest, rest[1:])
		rest[anzahl-1] = 0
		for i, g := range gen[1:] {
			rest[i] ^= gfMal(g, faktor)
		}
	}
	return rest
}

// --- Aufbau ---------------------------------------------------------------

// Baue erzeugt das Symbol fuer den Text. Version 0 heisst: kleinste Version,
// in die der Text passt.
func Baue(text string, stufe Stufe, version int) (*Symbol, error) {
	if text == "" {
		return nil, errors.New("leerer Inhalt")
	}
	a := waehleArt(text)

	if version == 0 {
		for v := 1; v <= 40; v++ {
			if passt(text, a, stufe, v) {
				version = v
				break
			}
		}
		if version == 0 {
			return nil, errors.New("Inhalt passt in kein QR-Symbol — auch Version 40 reicht nicht")
		}
	} else {
		if version < 1 || version > 40 {
			return nil, fmt.Errorf("Version %d liegt ausserhalb von 1 bis 40", version)
		}
		if !passt(text, a, stufe, version) {
			return nil, fmt.Errorf("Inhalt passt nicht in Version %d bei Stufe %s", version, stufe)
		}
	}

	roh := endgueltigeDaten(text, a, stufe, version)
	verwoben := verwebe(roh, stufe, version)

	kante := 17 + 4*version
	s := &Symbol{Version: version, Stufe: stufe, Kante: kante, Module: make([]bool, kante*kante)}
	belegt := make([]bool, kante*kante)

	s.setzeFunktionsmuster(belegt)
	s.setzeDaten(verwoben, belegt)

	// Maske waehlen: die mit der kleinsten Strafe.
	beste, besteStrafe := 0, -1
	for maske := 0; maske < 8; maske++ {
		s.wendeMaskeAn(maske, belegt)
		s.setzeFormat(stufe, maske)
		strafe := s.strafe()
		if besteStrafe < 0 || strafe < besteStrafe {
			beste, besteStrafe = maske, strafe
		}
		s.wendeMaskeAn(maske, belegt) // zuruecknehmen, XOR ist selbstinvers
	}
	s.wendeMaskeAn(beste, belegt)
	s.setzeFormat(stufe, beste)
	s.Maske = beste

	return s, nil
}

func passt(text string, a art, stufe Stufe, version int) bool {
	b := kodiereNutzdaten(text, a, version)
	return b.laenge <= Datenbytes(version, stufe)*8
}

// Fuellt den Bitstrom auf die volle Kapazitaet auf.
func endgueltigeDaten(text string, a art, stufe Stufe, version int) []byte {
	kapazitaet := Datenbytes(version, stufe) * 8
	b := kodiereNutzdaten(text, a, version)

	// Abschluss, hoechstens vier Nullbits.
	rest := kapazitaet - b.laenge
	if rest > 4 {
		rest = 4
	}
	b.schreibe(0, rest)
	// Auf volle Bytes auffuellen.
	if b.laenge%8 != 0 {
		b.schreibe(0, 8-b.laenge%8)
	}
	// Fuellbytes im Wechsel, wie in der Norm.
	fuell := []byte{0xEC, 0x11}
	for i := 0; b.laenge < kapazitaet; i++ {
		b.schreibe(uint32(fuell[i%2]), 8)
	}
	return b.daten
}

// Teilt in Bloecke, rechnet die Fehlerkorrektur und verwebt beides.
func verwebe(daten []byte, stufe Stufe, version int) []byte {
	anzahlBloecke := bloecke[stufe][version]
	ecJe := ecJeBlock[stufe][version]
	gesamtDaten := len(daten)

	kurzeLaenge := gesamtDaten / anzahlBloecke
	kurze := anzahlBloecke - gesamtDaten%anzahlBloecke

	datenBloecke := make([][]byte, anzahlBloecke)
	ecBloecke := make([][]byte, anzahlBloecke)
	pos := 0
	for i := 0; i < anzahlBloecke; i++ {
		laenge := kurzeLaenge
		if i >= kurze {
			laenge++
		}
		datenBloecke[i] = daten[pos : pos+laenge]
		ecBloecke[i] = ecBytes(datenBloecke[i], ecJe)
		pos += laenge
	}

	aus := make([]byte, 0, gesamtDaten+ecJe*anzahlBloecke)
	for i := 0; i < kurzeLaenge+1; i++ {
		for b := 0; b < anzahlBloecke; b++ {
			if i < len(datenBloecke[b]) {
				aus = append(aus, datenBloecke[b][i])
			}
		}
	}
	for i := 0; i < ecJe; i++ {
		for b := 0; b < anzahlBloecke; b++ {
			aus = append(aus, ecBloecke[b][i])
		}
	}
	return aus
}

func (s *Symbol) setze(x, y int, dunkel bool, belegt []bool) {
	s.Module[y*s.Kante+x] = dunkel
	if belegt != nil {
		belegt[y*s.Kante+x] = true
	}
}

func (s *Symbol) setzeFunktionsmuster(belegt []bool) {
	k := s.Kante

	// Suchmuster in drei Ecken, samt Trennlinie.
	for _, ecke := range [][2]int{{0, 0}, {k - 7, 0}, {0, k - 7}} {
		for dy := -1; dy <= 7; dy++ {
			for dx := -1; dx <= 7; dx++ {
				x, y := ecke[0]+dx, ecke[1]+dy
				if x < 0 || y < 0 || x >= k || y >= k {
					continue
				}
				abstand := max(abs(dx-3), abs(dy-3))
				s.setze(x, y, abstand != 2 && abstand <= 3, belegt)
			}
		}
	}

	// Taktlinien.
	for i := 8; i < k-8; i++ {
		s.setze(i, 6, i%2 == 0, belegt)
		s.setze(6, i, i%2 == 0, belegt)
	}

	// Ausrichtungsmuster.
	mitten := ausrichtungsmitten(s.Version)
	for _, cy := range mitten {
		for _, cx := range mitten {
			// Nicht in die Ecken der Suchmuster.
			if (cx == 6 && cy == 6) || (cx == 6 && cy == k-7) || (cx == k-7 && cy == 6) {
				continue
			}
			for dy := -2; dy <= 2; dy++ {
				for dx := -2; dx <= 2; dx++ {
					abstand := max(abs(dx), abs(dy))
					s.setze(cx+dx, cy+dy, abstand != 1, belegt)
				}
			}
		}
	}

	// Platz der Formatangaben belegen, Inhalt kommt spaeter.
	for i := 0; i < 9; i++ {
		if i != 6 {
			s.setze(i, 8, false, belegt)
			s.setze(8, i, false, belegt)
		}
	}
	for i := 0; i < 8; i++ {
		s.setze(k-1-i, 8, false, belegt)
	}
	// Die zweite Kopie der Formatangabe reicht in dieser Spalte nur bis
	// k-7; darunter liegt das immer dunkle Modul.
	for i := 0; i < 7; i++ {
		s.setze(8, k-1-i, false, belegt)
	}

	// Immer dunkles Modul. Muss nach den Platzhaltern gesetzt werden,
	// sonst loescht die Formatspalte es wieder.
	s.setze(8, k-8, true, belegt)

	// Versionsangaben ab Version 7.
	if s.Version >= 7 {
		rest := s.Version
		for i := 0; i < 12; i++ {
			rest = (rest << 1) ^ ((rest >> 11) * 0x1F25)
		}
		wert := s.Version<<12 | rest

		for i := 0; i < 18; i++ {
			bit := (wert>>uint(i))&1 == 1
			a, b := i/3, i%3+k-11
			s.setze(a, b, bit, belegt)
			s.setze(b, a, bit, belegt)
		}
	}
}

// Mitten der Ausrichtungsmuster, gerechnet nach der Regel der Norm.
func ausrichtungsmitten(version int) []int {
	if version == 1 {
		return nil
	}
	anzahl := version/7 + 2
	schritt := (version*8 + anzahl*3 + 5) / (anzahl*4 - 4) * 2
	mitten := make([]int, 0, anzahl)
	pos := 17 + 4*version - 7
	for i := 0; i < anzahl-1; i++ {
		mitten = append([]int{pos}, mitten...)
		pos -= schritt
	}
	return append([]int{6}, mitten...)
}

func (s *Symbol) setzeFormat(stufe Stufe, maske int) {
	k := s.Kante
	// Stufenkennung nach der Norm: L=01, M=00, Q=11, H=10.
	kennung := []int{1, 0, 3, 2}[stufe]
	daten := kennung<<3 | maske

	rest := daten
	for i := 0; i < 10; i++ {
		rest = (rest << 1) ^ ((rest >> 9) * 0x537)
	}
	wert := (daten<<10 | rest) ^ 0x5412

	for i := 0; i < 15; i++ {
		bit := (wert>>uint(i))&1 == 1
		// Erste Kopie um das linke obere Suchmuster.
		switch {
		case i < 6:
			s.setze(8, i, bit, nil)
		case i == 6:
			s.setze(8, 7, bit, nil)
		case i == 7:
			s.setze(8, 8, bit, nil)
		case i == 8:
			s.setze(7, 8, bit, nil)
		default:
			s.setze(14-i, 8, bit, nil)
		}
		// Zweite Kopie, auf die beiden anderen Suchmuster verteilt.
		if i < 8 {
			s.setze(k-1-i, 8, bit, nil)
		} else {
			s.setze(8, k-15+i, bit, nil)
		}
	}
}

// Legt den Datenstrom im Zickzack von rechts unten nach links oben.
func (s *Symbol) setzeDaten(daten []byte, belegt []bool) {
	k := s.Kante
	i := 0
	hoch := true
	for rechts := k - 1; rechts >= 1; rechts -= 2 {
		if rechts == 6 {
			rechts = 5 // die senkrechte Taktlinie wird uebersprungen
		}
		for schritt := 0; schritt < k; schritt++ {
			y := schritt
			if hoch {
				y = k - 1 - schritt
			}
			for spalte := 0; spalte < 2; spalte++ {
				x := rechts - spalte
				if belegt[y*k+x] {
					continue
				}
				dunkel := false
				if i < len(daten)*8 {
					dunkel = (daten[i/8]>>uint(7-i%8))&1 == 1
				}
				s.Module[y*k+x] = dunkel
				i++
			}
		}
		hoch = !hoch
	}
}

func (s *Symbol) wendeMaskeAn(maske int, belegt []bool) {
	k := s.Kante
	for y := 0; y < k; y++ {
		for x := 0; x < k; x++ {
			if belegt[y*k+x] {
				continue
			}
			var kehren bool
			switch maske {
			case 0:
				kehren = (x+y)%2 == 0
			case 1:
				kehren = y%2 == 0
			case 2:
				kehren = x%3 == 0
			case 3:
				kehren = (x+y)%3 == 0
			case 4:
				kehren = (y/2+x/3)%2 == 0
			case 5:
				kehren = x*y%2+x*y%3 == 0
			case 6:
				kehren = (x*y%2+x*y%3)%2 == 0
			case 7:
				kehren = ((x+y)%2+x*y%3)%2 == 0
			}
			if kehren {
				s.Module[y*k+x] = !s.Module[y*k+x]
			}
		}
	}
}

// Strafpunkte nach den vier Regeln der Norm. Wer sie weglaesst, bekommt
// Symbole, die auf dem Bildschirm gut aussehen und am Scanner haengen.
func (s *Symbol) strafe() int {
	k := s.Kante
	strafe := 0

	// Regel 1: Reihen gleicher Farbe ab fuenf Modulen.
	for y := 0; y < k; y++ {
		lauf, farbe := 1, s.Dunkel(0, y)
		for x := 1; x < k; x++ {
			if s.Dunkel(x, y) == farbe {
				lauf++
			} else {
				if lauf >= 5 {
					strafe += 3 + lauf - 5
				}
				farbe, lauf = s.Dunkel(x, y), 1
			}
		}
		if lauf >= 5 {
			strafe += 3 + lauf - 5
		}
	}
	for x := 0; x < k; x++ {
		lauf, farbe := 1, s.Dunkel(x, 0)
		for y := 1; y < k; y++ {
			if s.Dunkel(x, y) == farbe {
				lauf++
			} else {
				if lauf >= 5 {
					strafe += 3 + lauf - 5
				}
				farbe, lauf = s.Dunkel(x, y), 1
			}
		}
		if lauf >= 5 {
			strafe += 3 + lauf - 5
		}
	}

	// Regel 2: gleichfarbige Bloecke aus zwei mal zwei Modulen.
	for y := 0; y < k-1; y++ {
		for x := 0; x < k-1; x++ {
			f := s.Dunkel(x, y)
			if f == s.Dunkel(x+1, y) && f == s.Dunkel(x, y+1) && f == s.Dunkel(x+1, y+1) {
				strafe += 3
			}
		}
	}

	// Regel 3: Muster, das dem Suchmuster gleicht.
	muster := []bool{true, false, true, true, true, false, true, false, false, false, false}
	umgekehrt := []bool{false, false, false, false, true, false, true, true, true, false, true}
	pruefe := func(hole func(i int) bool, laenge int) {
		for start := 0; start+11 <= laenge; start++ {
			gleichA, gleichB := true, true
			for i := 0; i < 11; i++ {
				if hole(start+i) != muster[i] {
					gleichA = false
				}
				if hole(start+i) != umgekehrt[i] {
					gleichB = false
				}
			}
			if gleichA || gleichB {
				strafe += 40
			}
		}
	}
	for y := 0; y < k; y++ {
		yy := y
		pruefe(func(i int) bool { return s.Dunkel(i, yy) }, k)
	}
	for x := 0; x < k; x++ {
		xx := x
		pruefe(func(i int) bool { return s.Dunkel(xx, i) }, k)
	}

	// Regel 4: Abweichung vom halben Dunkelanteil.
	dunkel := 0
	for _, m := range s.Module {
		if m {
			dunkel++
		}
	}
	anteil := dunkel * 100 / (k * k)
	abweichung := abs(anteil-50) / 5
	strafe += abweichung * 10

	return strafe
}

func abs(a int) int {
	if a < 0 {
		return -a
	}
	return a
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
