# Schriften in diesem Projekt

Beide Familien liegen als woff2 hier im Ordner und werden ausschließlich
lokal geladen. Es geht kein Aufruf an fonts.googleapis.com oder
fonts.gstatic.com, wenn die Seite läuft.

| Datei | Familie | Schnitt | Größe | Lizenz |
|---|---|---|---|---|
| `onest-var.woff2` | Onest (variabel, Achse wght) | 400–800 | 33 KB | SIL Open Font License 1.1, Text in `OFL-onest.txt` |
| `onest-zeichen.woff2` | Onest, Zusatzzeichen | 400–800 | 2,0 KB | dieselbe |
| `jetbrains-mono-var.woff2` | JetBrains Mono (variabel, Achse wght) | 400–700 | 31 KB | SIL Open Font License 1.1, Text in `OFL-jetbrains-mono.txt` |
| `jetbrains-mono-zeichen.woff2` | JetBrains Mono, Zusatzzeichen | 400–700 | 1,6 KB | dieselbe |

**Onest** trägt die Sprache, **JetBrains Mono** alles Gemessene. Beide
seit dem 24.09.2026 (Richtung „Plan"). Bezugsquelle: fonts.gstatic.com
über den `css2`-Endpunkt, Teilsatz `latin`, mit Gewichtsachse.

**Die Zusatzdateien sind kein Schmuck, sondern gemessen nötig.** Der
Teilsatz `latin` enthält Pfeil, Malzeichen, Minuszeichen, Paragraph,
Haken, Eingabezeichen, das kleine Dreieck und die Winkelzeichen NICHT.
Im Browser nachgemessen (Breitenvergleich gegen die Ersatzschrift):
ohne diese Dateien fallen 42 Stellen im Projekt mitten im Satz auf eine
Systemschrift zurück. Die beiden Dateien decken genau
`U+a7, U+d7, U+2039-203a, U+2192, U+21b5, U+2212, U+25be, U+2713` ab und
werden über `unicode-range` nur dann geladen, wenn eines dieser Zeichen
vorkommt. Wer ein weiteres Sonderzeichen in einen Text schreibt, misst
nach, ob es enthalten ist — sonst bricht die Schrift dort.

Enthalten und geprüft im Latin-Teilsatz: ä ö ü Ä Ö Ü ß „ “ – — · … € ‹ ›.

Schibsted Grotesk und IBM Plex Mono, die Schriften der Richtung
„Prüfprotokoll", werden nicht mehr benutzt und liegen nicht mehr hier.

Die OFL erlaubt Weitergabe und Einbettung; sie verlangt, dass die
Schriften nicht einzeln verkauft werden und dass abgeleitete Fassungen
nicht unter einem *reservierten* Namen laufen. Weder Onest noch
JetBrains Mono haben einen reservierten Namen: die Copyright-Zeilen in
`OFL-onest.txt` und `OFL-jetbrains-mono.txt` nennen keinen (nachgesehen
am 24.09.2026). Die Teilsätze dürfen den Namen deshalb behalten. Wird
die Seite veröffentlicht, gehören beide Lizenztexte mit ins Paket.
