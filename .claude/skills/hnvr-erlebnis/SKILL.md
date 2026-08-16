---
name: hnvr-erlebnis
description: Das Designsystem von hnvr.me — Staatliches, Inter Tight, Signalrot #E02B16 auf Weiß und Tiefschwarz. Das ist der Erlebnis- und Event-Auftritt: Eventservice, Rental, Tontechnik, Lichttechnik, Bühne, Gastronomie, dazu Marketing und Webservice. Anwenden bei allem Sichtbaren dieser Marke: Seite, Landingpage, Angebot, Technikliste, Deck, Aushang, Social-Grafik. Nicht verwechseln mit dem Skill hnvr-design — der gehört zu hnvr.me digital (dunkel, orange, Clash Display).
---

# hnvr.me — Erlebnis- und Event-Auftritt

Der zweite von zwei Auftritten. Hell, laut, kantig — das Gegenstück zum dunklen `hnvr-design`.

| | `hnvr-erlebnis` (dieser Skill) | `hnvr-design` |
|---|---|---|
| Marke | hnvr.me — Event, Rental, Marketing | hnvr.me digital — Agentur |
| Grund | Weiß, Tiefschwarz als Block | Schwarz, Creme als Block |
| Akzent | Rot `#E02B16` | Orange `#FF7120` |
| Display | Staatliches | Clash Display |
| Text | Inter Tight | DM Sans |
| Kanten | scharf, Radius 0 | rund, Radius 16–50 |

Wenn unklar ist, welcher gilt: Geht es um **Technik, Bühne, Licht, Ton, Veranstaltung, Vermietung** → dieser. Geht es um **Agentur, Branding, SEO, Web-Projekte** → `hnvr-design`.

## Vorgehen

1. `assets/fonts.css` + `assets/erlebnis.css` einbinden, nie Werte abtippen.
   Einzelne HTML-Datei ohne Server: Schriften als `data:font/woff2;base64` einbetten — siehe `references/tokens.md`.
2. Gerüst aus `assets/vorlage.html`.
3. Bausteine aus `references/komponenten.md`.
4. Texte nach `references/sprache.md`.

## Acht Leitplanken

1. **Zwei Schriften.** Staatliches für alles Große und Laute, Inter Tight für alles Lesbare. Selbst gehostet, nie über ein CDN.
2. **Weiß trägt, Schwarz schlägt zu.** `#FFFFFF` ist die Grundfläche, `#F0F0F0` der ruhige Abschnitt, `#111111` der Block, der einen Abschnitt komplett umdreht. Kein Grauverlauf dazwischen.
3. **Ein Akzent: `#E02B16` — und erst ab 24px als Textfarbe.** Auf Weiß erreicht das Rot nur 4.4:1, auf `#F0F0F0` nur 4.1:1. Für Buttons (weißer Text auf roter Fläche: 4.6:1), große Ziffern, Trennpunkte und Striche ist es richtig. Für Labels, Links und Fließtext nicht — dort trägt Tinte, und das Rot kommt als Zeichen daneben.
4. **Scharfe Kanten.** Buttons Radius 0, ohne Rahmen. Karten Radius 8. Nichts dazwischen — das ist der Wert, den die Seite selbst setzt.
5. **Staatliches steht eng.** `line-height: .9`, Großbuchstaben, keine Sperrung — außer beim bewussten Sperrsatz (`.gesperrt`, `letter-spacing: .5em`) für einzelne Wörter wie „K O N T A K T".
6. **Inter Tight in drei Schnitten:** 400 Fließtext, 500 Zwischenüberschrift, 600 Betonung. Kein 700.
7. **Der Dreiklang trägt die Seite.** „MArketing. Einfach. MAchen." · „Sichtbar. Messbar. Mehr." Drei Wörter, drei Punkte, Pointe am Schluss.
8. **Der MA-Trick** — „MArketing", „MAchen". Einmal pro Seite. Achtung: In Staatliches ist er **unsichtbar**, die Schrift kennt nur Versalien. Trotzdem so schreiben — sichtbar wird er in Inter Tight, in der Meta-Beschreibung und überall dort, wo gemischt gesetzt wird.

## Kurzreferenz

| | |
|---|---|
| Grund | `#FFFFFF` · ruhig `#F0F0F0` · Block `#111111` |
| Text | `#111111` · gedämpft `#646464` · auf Schwarz `#EFEFEF` |
| Akzent | `#E02B16` |
| Linie | `#111111`, 1px |
| Display | Staatliches, uppercase, `line-height: .9` |
| Text | Inter Tight 400 / 500 / 600 |
| Button | Rot, weißer Text, Radius 0, kein Rahmen |
| Karte | Radius 8, Rahmen 1px |
| Breite | `max-width: 1440px` (Entwurfsbreite der Seite) |

Vollständig: `references/tokens.md`.

## Verwandte Dateien

- `references/tokens.md` — alle Werte, Typo-Skala, Einbetten
- `references/komponenten.md` — Bausteine mit Markup
- `references/sprache.md` — Tonfall, Dreiklang, Wortliste
- `references/herkunft.md` — Quellen, Lizenzen, Nachprüfen
- `assets/erlebnis.css`, `assets/fonts.css`, `assets/fonts/`, `assets/vorlage.html`
