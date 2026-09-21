# Figma — „PDF Studio · Registratur"

**Datei:** https://www.figma.com/design/CvhOPK3NKn28gWvlUYU3dh

Diese Datei ist kein Bild der Anwendung, sondern ihre Quelle in Figma. Jede
Farbe, jedes Maß und jede Schriftgröße trägt denselben Namen wie in
`studio/app/stil.css` und liegt als Variable mit gesetztem Code-Namen vor
(`var(--tally)`, `var(--raum-4)`, …). Wer dort einen Wert ändert, ändert ihn
für jedes Bauteil und jeden Bildschirm zugleich.

## Was drin ist

| | |
|---|---|
| 5 Sammlungen | Grundwerte (40, `scopes: []`, unsichtbar), Farbe (38, Modi Hell/Dunkel), Raum (17), Satz (10), Radius (1) |
| 16 Textstile | jeder an seine Satz-Variable gebunden; `Papier/*` ist der Satz **auf dem Blatt** |
| 0 Effektstile | Absicht: Registratur trennt mit 1-px-Linien, nicht mit Unschärfe |
| 7 Bauteile | Knopf (15 Varianten) · Knopf groß (4) · Werkzeug (6) · Reiter (3) · Spaltenkopf · Seitenzeile (4) · Feldzeile (3) · Faden (3 + 5 Eigenschaften) |
| 8 Sinnbilder | als `INSTANCE_SWAP`-Eigenschaft am Werkzeug, nicht als Variante je Symbol |
| 2 Bildschirme | Studio hell und dunkel — dieselben Knoten, ein Moduswechsel |

## Was noch fehlt

Marke, Meldung, Feld, Schalter, Schieber und Dialog sind im Programm gebaut,
aber noch nicht als Figma-Bauteil. Empfang und Portal sind noch nicht
abgebildet.

## Die Regel bei Abweichungen

`studio/app/stil.css` ist die laufende Fassung. Weicht die Figma-Datei ab, ist
die Figma-Datei veraltet — nicht umgekehrt. Dagegen halten die Prüfungen in
`studio/werkzeuge/`, die gerenderte Pixel messen: Höhen, Farben, Kontraste,
Radien und die beiden Staffeln.

## Was die Figma-Arbeit gefunden hat

Als derselbe Bildschirm einmal hell und einmal dunkel nebeneinander stand,
stand auf dem dunklen weiße Schrift auf weißem Papier. Das Blatt ist in beiden
Fassungen dasselbe Blatt — die Seite wird als Bild gezeichnet und kippt nicht
mit —, alles darüber kippte aber mit. Nachgemessen: Formularfeldrahmen 2,0:1,
Tinte 1,2:1. Behoben mit fünf `--papier-*`-Token, die in beiden Fassungen
gleich sind, und einer Prüfung, die es festhält.

## Weiterarbeiten

Zum Fortsetzen in einer neuen Sitzung: Lauf-Kennung `registratur-2026-09`,
Zustandsdatei `werkzeuge/figma-stand.json`, Anleitung `figma-generate-library`.
