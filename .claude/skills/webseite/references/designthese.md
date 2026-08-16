# Designthese

Ziel dieser Phase: eine Entscheidung, die die naheliegende Lösung ausschließt.

## Ablauf

**1. Drei Richtungen skizzieren, nicht eine.** Je 3–4 Sätze, bewusst weit auseinander. Wer eine Richtung entwirft, entwirft die naheliegendste. Wer drei entwirft, muss zwei davon anders denken. Die zweite und dritte Skizze sind der eigentliche Gewinn.

**2. Eine wählen und begründen** — am Publikum und an der Konkurrenz, nicht am Geschmack. Wenn alle Wettbewerber blau und rund sind, ist blau und rund eine Entscheidung gegen Sichtbarkeit.

**3. Die anderen beiden ausschlachten.** Meist trägt eine Verliererskizze das beste Einzelelement bei.

**4. Ausschlussliste schreiben.** Drei bis fünf Standardlösungen, die diese Seite nicht verwendet.

## Richtungskatalog

Kein Menü zum Abhaken, sondern Startpunkte. Jede Richtung ist eine Behauptung mit gestalterischen Folgen.

| Richtung | Behauptung | Folgen im Code |
|---|---|---|
| **Redaktionell** | Die Seite ist ein Magazin | Serifen-Display, mehrspaltiger Satz, Initialen, Bildunterschriften, Marginalien, Hurenkinder vermeiden |
| **Technische Zeichnung** | Das Produkt ist Gerät, kein App-Bild | Millimeterraster sichtbar, Maßlinien, Monospace-Labels, Beschriftungspfeile, 1px-Linien statt Flächen |
| **Schweizer Strenge** | Ordnung ist die Botschaft | Grotesk, hartes Spaltenraster, links bündig, nur Schwarz/Weiß/ein Rot, Größe erzeugt Hierarchie |
| **Brutalismus** | Aufmerksamkeit vor Freundlichkeit | Extreme Größen, keine Radien, Systemgrenzen sichtbar, harte Farbflächen, unhöfliche Zeilenumbrüche |
| **Terminal** | Für Leute, die tippen | Monospace durchgehend, Cursor, Prompt-Zeilen, gedämpftes Phosphorgrün/Bernstein, Rasterhintergrund |
| **Archiv / Akte** | Dieses Ding ist ernst und alt | Papierton, Stempel, Aktenzeichen, Tabellen, gescannte Anmutung, Korn |
| **Werkstatt** | Handwerk statt Software | Materialfarben, Vermaßung, Bauteilnummern, Explosionszeichnung, Fotos von Dingen |
| **Bühne / Dunkelraum** | Ein Objekt im Scheinwerfer | Sehr dunkler Grund, ein Lichtkegel, langsame Bewegung, Rest fast unsichtbar |
| **Datenlandschaft** | Die Zahlen sind das Bild | Echte Diagramme als Gestaltungselement, Achsen als Raster, Legende als Navigation |
| **Karte** | Ort ist die Struktur | Grundriss, Saalplan, Isometrie als Navigationsebene |
| **Zeitachse** | Ablauf ist die Struktur | Waagerechtes Scrollen, Zeitmarken, Ereignisse in Millisekunden |
| **Kartei** | Vieles Gleichartiges, unterscheidbar | Karteikarten mit Reitern, Handschriftmarkierungen, Stapel statt Raster |

Zwei Richtungen zu kreuzen ergibt oft die eigenständigste Seite — „Schweizer Strenge mit Werkstattvermaßung". Drei zu kreuzen ergibt Matsch.

## Signature Moment

Genau eine Stelle, die aufwendig ist. Regeln:

- Sie erklärt den Inhalt. Ein Partikelfeld auf einer Steuerberaterseite ist Dekoration, ein rechnender Kostenschieber ist ein Signature Moment.
- Sie funktioniert ohne Bewegung noch als Bild — sonst ist der erste Screenshot leer.
- Sie überlebt Tastaturbedienung und `prefers-reduced-motion` als statische Fassung.
- Sie kostet Rechenzeit nur, solange sie sichtbar ist (`IntersectionObserver` pausiert sie).

Kandidaten:

- **Live-Simulation der eigenen Sache.** Der Saalplan, in dem Mikrofone angehen und die Kamera nachfährt. Schlägt jedes Video.
- **Rechner mit Sofortwirkung.** Eingabe verändert sichtbar eine Zeichnung, nicht nur eine Zahl.
- **Scrollgetriebene Erklärzeichnung.** Ein SVG, dessen Pfade sich beim Scrollen aufbauen (`stroke-dasharray` + `scroll-timeline` oder `IntersectionObserver`).
- **Vorher/Nachher mit Zieher.** Nur mit echtem Material, nie mit Stockfotos.
- **Typografischer Auftritt.** Eine Überschrift, die in Schnittstärke, Breite oder Achse variiert (Variable Font, `font-variation-settings`) — technisch billig, optisch teuer.
- **Generatives Feld mit festem Startwert.** Canvas oder SVG, aus einem Seed reproduzierbar, an die Marke gekoppelt (siehe `bilder.md`).
- **Physik in klein.** Ein Element mit echter Trägheit statt Easing — spürbar anders als jede CSS-Transition.
- **Zustandsmaschine als Bild.** Für Software mit Zuständen: die Kette selbst zeigen, anklickbar.

## Beispielthesen

**Gut**
> Werkstattprotokoll. Papierton `#f2ede3`, Tinte `#14110f`, ein Rostrot `#9a3b1b`. Display „Fraunces" in 96–140 px, Beschriftungen in „IBM Plex Mono" 12 px mit 0.12 em Laufweite. Sichtbares 8-px-Raster, Maßlinien zwischen den Abschnitten, jedes Bauteil nummeriert. Signature: der Saalplan als isometrische Zeichnung, Mikrofone schaltbar, Kamerakegel folgt. Ausgeschlossen: Karten mit Schatten, Icon-Reihen, zentrierter Hero, jede Form von Verlauf.

**Schlecht** (beschreibt nichts, führt zum Durchschnitt)
> Modernes, cleanes Design mit klarer Struktur, viel Weißraum und einer frischen Farbpalette, das Vertrauen und Professionalität ausstrahlt.

Prüffrage: Könnte diese These auch für ein Zahnarztportal, eine SaaS-Startseite und eine Bäckerei gelten? Dann ist sie keine These.
