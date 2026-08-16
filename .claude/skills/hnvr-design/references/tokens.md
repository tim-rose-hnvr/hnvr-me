# Tokens

Alle Werte stehen als CSS-Variablen in `assets/hnvr.css` und stammen aus der eigenen WordPress-Seite. Diese Datei erklärt sie und nennt die Fälle, in denen man sich vergreifen kann.

---

## Farben

### Theme-Variablen

Diese fünf kommen wörtlich aus dem Block `pxl-style-inline-css` der Seite. Namen unverändert lassen — dann läuft Code aus diesem System auch in der WordPress-Seite.

| Variable | Wert | Wofür |
|---|---|---|
| `--secondary-color` | `#030303` | Grundfläche der ganzen Seite (`body`) |
| `--primary-color` | `#121C27` | Tiefblau. Abgesetzte Fläche, Karteninneres, Hover |
| `--third-color` | `#C2C2C2` | Fließtextfarbe (`body`-Farbe des Themes) |
| `--four-color` | `#FFF` | Überschriften und starker Text |
| `--link-color` | `#FFF` | Links, auch im Hover |

Zusätzlich liegen `--primary-color-rgb`, `--secondary-color-rgb` usw. bereit, weil das Theme sie für `rgba()`-Berechnungen braucht.

### Ergänzungen aus den Elementor-Seiten

Diese stehen nicht im Theme, sondern in den Seiteneinstellungen — sie tragen den gestalteten Teil.

| Variable | Wert | Wofür |
|---|---|---|
| `--cream` | `#F1EFEB` | heller Gegenschnitt-Abschnitt |
| `--ink` | `#0C0C0C` | Text auf Creme |
| `--muted-cream` | `#5C5E5C` | Fließtext auf Creme |
| `--raise` | `#444444` | Rahmen, abgesetzte Kante |
| `--accent` | `#FF7120` | der eine Akzent |
| `--accent-deep` | `#DF3E06` | nur als Verlaufsende |
| `--signal` | `#87F90E` | Grün. Selten, für Status und Zahlen |
| `--line` | `rgba(255,255,255,.15)` | Linienfarbe des Themes |

### Was hier zählt

`#C2C2C2` auf `#030303` ergibt 11.6:1 — der Fließtext der Seite ist bewusst hell. Auf Creme wären es 1.9:1, deshalb kippt `section.cream` alle Textklassen auf `--ink` und `--muted-cream`. Wer eine eigene Textklasse baut, muss sie dort mit eintragen.

`--accent` gehört auf: Punkte, Ziffern, Haken, Unterstreichungen, ein hervorgehobenes Wort, Hover-Flächen. Nicht auf: ganze Textblöcke, mehrere Elemente in einer Reihe, Fließtext.
Orange auf Schwarz liefert 6.5:1. **Text auf oranger Fläche muss schwarz sein** — weiß auf `#FF7120` sind 2.4:1. `.btn:hover` macht das schon richtig.

### Farbflächen statt Fotos

Liegt kein Bild vor, tragen Radialverläufe die Fläche — nie ein Platzhaltergrau.

| Variable | Stimmung |
|---|---|
| `--grad-hero` | Bühne, Feuer — der Verlauf der Startseite |
| `--grad-warm` | orange, Standard |
| `--grad-cool` | blau |
| `--grad-sun` | gelb |

Immer ein `<i class="grain"></i>` darüberlegen.

---

## Schrift

| Variable | Familie | Wofür |
|---|---|---|
| `--disp` | Clash Display | Überschriften, Buttons, Labels, Navigation, Zahlen |
| `--body` | DM Sans | Fließtext, Listen, Formulare |

Clash Display liegt als **sechs feste Schnitte** vor (200 / 300 / 400 / 500 / 600 / 700), so wie das Theme sie ausliefert. Verwendet werden **500** (Labels) und **600** (Überschriften, Buttons). 700 nicht — wird klobig.
DM Sans ist variabel (100–1000), verwendet werden **400** und **500**.

Auf der Seite gibt es **keine Serifenschrift**. Der große Schriftzug wird mit `.disp-2` gesetzt, nicht mit einer zweiten Familie.

### Ebene 1 — Theme-Grade

Das ist die Regel aus `dreamslab/assets/css`, wörtlich:

```css
h1,h2,h3,h4,h5,h6 { font-family:'Clash Display'; color:#fff; font-weight:600; line-height:1.2; margin:0 0 15px; }
```

| Element | ≥1201 | ≤1200 | ≤767 | ≤480 | Besonderheit |
|---|---|---|---|---|---|
| `h1` | 50px | 38px | 32px | 24px | |
| `h2` | 35px | 28px | 24px | 20px | |
| `h3` | 30px | 28px | 20px | 18px | |
| `h4` | 25px | — | 20px | — | `line-height: 1.28` |
| `h5` | 20px | — | 18px | — | `line-height: 1.6`, ≤767 dann `1.2` |
| `h6` | 17px | — | — | — | |

Fließtext, ebenfalls wörtlich: `16px`, `line-height: 1.625`, `letter-spacing: 0`, Farbe `--third-color`.

### Ebene 2 — Displaygrade

Die großen Grade stehen auf der Seite als feste px-Werte in den Elementor-Einstellungen. Die Seite ist auf **1920px** entworfen — erkennbar daran, dass im Theme-CSS `2.8646vw` steht, also genau 55px bei 1920. Deshalb sind sie hier in vw umgerechnet und wachsen mit.

| Klasse | px @1920 | Formel |
|---|---|---|
| `.disp-1` | 150 | `clamp(40px, 7.8125vw, 150px)` |
| `.disp-2` | 120 | `clamp(36px, 6.25vw, 120px)` |
| `.disp-3` | 100 | `clamp(32px, 5.208vw, 100px)` |
| `.disp-4` | 80 | `clamp(28px, 4.1667vw, 80px)` |
| `.disp-5` | 55 | `clamp(24px, 2.8646vw, 55px)` |

Alle mit `line-height: .98`, `letter-spacing: -.015em`, `text-transform: uppercase`.

Die Regel dahinter: **je größer, desto enger.** Displaygrade bekommen negatives `letter-spacing`, Kleinschrift in Großbuchstaben bekommt `+1.4px`. Wer das vertauscht, zerstört den Look sofort.

### Weitere Textklassen

| Klasse | Größe | Farbe |
|---|---|---|
| `.philo` | `clamp(26px, 3.3vw, 64px)` | weiß, ein Wort im Akzent |
| `.lede` | `clamp(18px, 1.25vw, 24px)` | `--third-color`, `52ch` |
| `.copy` | `clamp(16px, 1.04vw, 20px)` | `--third-color`, `44ch` |
| `.ey` | `14px`, `letter-spacing: 1.4px` | `--third-color`, Schrägstriche im Akzent |
| `.pill` | `11px`, `letter-spacing: 1.4px` | geerbt |

### Zeilenlänge

Fließtext `44ch`. Vorspann `52ch`. Karten-Text `38ch`. Fußzeilen-Text `32ch`.
Nie eine Textspalte über die volle Seitenbreite laufen lassen.

---

## Maß und Raum

| Variable | Wert | Herkunft |
|---|---|---|
| `--maxw` | `1770px` | Elementor-Containerbreite der Seite |
| `--maxw-text` | `1140px` | Bootstrap-Container des Themes (≥1200) |
| `--pad` | `clamp(20px, 3.61vw, 70px)` | Seitenrand der Seite: `3.61vw` |
| `--sec` | `clamp(70px, 8vw, 150px)` | abgeleitet |

Abstände innerhalb eines Abschnitts: `15 · 18 · 26 · 34 · 40 · 60` px. Die `15px` sind der Absatzabstand des Themes (`p { margin: 0 0 15px }`).
Karten-Innenabstand: `clamp(28px, 3vw, 48px)`.

### Radien

| Variable | Wert | Herkunft |
|---|---|---|
| `--r-card` | `8px` | häufigster Elementor-Wert der Seite (18×) |
| `--r-box` | `48px` | großer Kasten (5×) |
| `--r-pill` | `9999px` | Buttons und Pillen |
| — | `50%` | Kreise, Avatare, Icon-Flächen |

`14px` und `18px` kommen bei zwei Bausteinen vor (Schritt-Karte, Stapelkarte) — historisch, beibehalten.

### Haltepunkte

`1600 · 1200 · 992 · 767 · 575 · 480` — die des Themes. Eigene Haltepunkte nur, wenn ein Baustein sie wirklich braucht; die Bausteine hier nutzen zusätzlich `860 · 820 · 800 · 760`.

---

## Bewegung

Eine Kurve: `--ease: cubic-bezier(.645, .045, .355, 1)` — die des Themes.

| Vorgang | Dauer |
|---|---|
| Einblenden beim Scrollen | `.95s`, Versatz 34px |
| Hover auf Button/Karte | `.4s` |
| Hover auf Linie/Farbe | `.3s` – `.35s` |
| Vollbild-Navigation | `.6s` mit `cubic-bezier(.76, 0, .24, 1)` |
| Laufband | 30s linear, endlos |

Gestaffelte Einblendungen über `.d1 .d2 .d3` (80/160/240ms). Mehr als drei Stufen wirken zäh.

`prefers-reduced-motion` ist in `hnvr.css` behandelt: Animationen aus **und** `.rv` wird sichtbar gesetzt. Wer Einblendungen per Inline-Style oder eigenem JS baut, muss den zweiten Teil selbst mitdenken — sonst bleibt die Seite für Betroffene leer.

---

## Einbetten

Für eine einzelne HTML-Datei ohne Server:

```bash
for f in assets/fonts/*.woff2; do echo "/* $f */"; base64 -w0 "$f"; echo; done
```

```css
@font-face{font-family:'Clash Display';src:url(data:font/woff2;base64,…) format('woff2');font-weight:600;font-display:swap}
@font-face{font-family:'DM Sans';src:url(data:font/woff2;base64,…) format('woff2');font-weight:100 1000;font-display:swap}
/* danach der Inhalt von hnvr.css */
```

**Nicht alle acht Dateien einbetten.** Für ein Artefakt reichen zwei:

| Datei | Größe | wann nötig |
|---|---|---|
| `ClashDisplay-Semibold.woff2` | 15 KB | immer — trägt alle Überschriften |
| `DMSans-Variable-latin.woff2` | 61 KB | immer — trägt den Fließtext |
| `ClashDisplay-Medium.woff2` | 15 KB | wenn `.ey` oder Navigation vorkommen |
| `DMSans-Variable-latin-ext.woff2` | 31 KB | nur bei osteuropäischen Zeichen |
| übrige Clash-Schnitte | je ~15 KB | selten |

Zwei Dateien sind 76 KB, base64 rund 101 KB. Das ist vertretbar; ein CDN-Aufruf ist es nicht.

Wird nur `ClashDisplay-Semibold` eingebettet, muss `.ey` von `font-weight: 500` auf `600` — sonst rechnet der Browser einen synthetischen Schnitt und die Sperrung wirkt schmutzig.
