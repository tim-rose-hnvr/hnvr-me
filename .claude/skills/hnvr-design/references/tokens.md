# Tokens

Alle Werte stehen als CSS-Variablen in `assets/hnvr.css`. Diese Datei erklärt sie und nennt die Fälle, in denen man sich vergreifen kann.

---

## Farben

### Flächen

| Token | Wert | Wofür |
|---|---|---|
| `--bg` | `#050505` | Grundfläche. Trägt die Seite. |
| `--bg-raise` | `#0D0D0D` | Karte im Hover, leicht abgesetzter Kasten. |
| `--cream` | `#F1EFEB` | Gegenschnitt-Abschnitt. Ein bis zwei pro Seite, nicht mehr. |
| `--ink` | `#0C0C0C` | Text auf Creme. Nicht `#000` — das wirkt hart. |

Reines Weiß als Seitenhintergrund gibt es nicht. Ausnahme: das weiße Innenfeld einer Leistungskarte (`.srv-card .info`), dort ist es Absicht — die Karte soll aus der Creme-Fläche herausstechen.

### Schrift

| Token | Wert | Wofür |
|---|---|---|
| `--fg` | `#F8F8F8` | Überschriften und starker Text auf Dunkel. |
| `--muted` | `#8C8C8C` | Fließtext, Bildunterschriften, Labels. |
| `--muted-cream` | `#6A6864` | dasselbe auf Creme. |
| `--label` | `#C8C8C8` | Kleinschrift, die noch lesbar bleiben muss. |

`#8C8C8C` auf `#050505` ergibt Kontrast 5.4:1 — genug für Fließtext ab 16px. Für Text unter 14px auf Dunkel `--label` nehmen.

### Linien

| Token | Wert |
|---|---|
| `--line` | `rgba(255,255,255,.13)` |
| `--line-strong` | `rgba(255,255,255,.22)` |
| `--line-ink` | `rgba(0,0,0,.12)` |

Rahmen sind immer 1px und immer aus diesen drei. Keine grauen Volltonlinien.

### Akzent

| Token | Wert | Wofür |
|---|---|---|
| `--accent` | `#FF7120` | Der eine Akzent. |
| `--accent-deep` | `#DF3E06` | Nur als Ende eines Verlaufs. |

`--accent` gehört auf: Punkte, Ziffern, Haken, Unterstreichungen, ein hervorgehobenes Wort, Hover-Flächen, den Cursor. Nicht auf: ganze Textblöcke, mehrere Elemente in einer Reihe, Fließtext.

Orange auf Schwarz liefert 6.2:1 — für Text ab 14px in Ordnung. **Text auf oranger Fläche muss schwarz sein** (`#000`), nie weiß: weiß auf `#FF7120` sind 2.4:1 und damit unlesbar. Der `.btn:hover` macht das schon richtig.

### Farbflächen statt Fotos

Wenn kein Bild vorliegt, tragen Radialverläufe die Fläche — nie ein Platzhalter-Grau.

| Token | Stimmung |
|---|---|
| `--grad-hero` | Bühne, Feuer |
| `--grad-warm` | orange, Standard |
| `--grad-cool` | blau |
| `--grad-sun` | gelb |

Immer ein `<i class="grain"></i>` darüberlegen, sonst wirkt der Verlauf digital.

---

## Schrift

### Familien

| Token | Familie | Wofür |
|---|---|---|
| `--disp` | Clash Display | Überschriften, Buttons, Labels, Navigation, Zahlen |
| `--body` | DM Sans | Fließtext, Listen, Formulare |
| `--serif` | Recoleta | genau ein Riesen-Schriftzug pro Seite |

Clash Display ist variabel (200–700), verwendet werden **500** (Labels) und **600** (Überschriften, Buttons). 700 nicht — wird klobig.
DM Sans ist variabel (100–1000), verwendet werden **400** und **500**.

### Skala

| Klasse | Größe | line-height | letter-spacing |
|---|---|---|---|
| `.serif-giant` | `clamp(58px, 15.5vw, 260px)` | `.86` | `-.01em` + `scaleY(1.12)` |
| Bühnen-H1 | `clamp(38px, 7.3vw, 116px)` | `1` | `-.02em` |
| `.clash-big` | `clamp(34px, 5vw, 86px)` | `.98` | `-.015em` |
| `.philo` | `clamp(26px, 4vw, 64px)` | `1.08` | `-.005em` |
| `.clash-mid` | `clamp(26px, 3.2vw, 52px)` | `1` | `-.01em` |
| `.clash-sm` | `clamp(20px, 2vw, 30px)` | `1.05` | `-.005em` |
| `.lede` | `clamp(16px, 1.2vw, 19px)` | `1.55` | normal |
| `.copy` | `clamp(15px, 1.05vw, 17px)` | `1.55` | normal |
| `.ey` (Label) | `12.5px` | — | `+.14em` |
| `.btn` | `12.5px` | — | `+.04em` |
| `.pill` | `11px` | — | `+.05em` |

Die Regel dahinter: **je größer, desto enger.** Display-Größen bekommen negatives `letter-spacing`, Kleinschrift in Großbuchstaben bekommt positives. Wer das vertauscht, zerstört den Look sofort.

### Zeilenlänge

Fließtext `max-width: 44ch`. Vorspann `52ch`. Karten-Text `38ch`. Fußzeilen-Text `32ch`.
Nie eine Textspalte über die volle Seitenbreite laufen lassen.

---

## Maß und Raum

| Token | Wert |
|---|---|
| `--maxw` | `1760px` |
| `--pad` | `clamp(20px, 5vw, 90px)` |
| `--sec` | `clamp(80px, 10vw, 160px)` |

Abstände innerhalb eines Abschnitts: `18 · 26 · 34 · 40 · 60` px. Dazwischen nichts erfinden.
Karten-Innenabstand: `clamp(28px, 3vw, 48px)`.

### Radien

| Token | Wert | Wofür |
|---|---|---|
| `--r-card` | `16px` | Karten, Kacheln, Zitate |
| `--r-box` | `22px` | großer Kasten (Preisblock) |
| `--r-pill` | `50px` | Buttons |
| — | `30px` | Schlagwort-Pillen |
| — | `50%` | Kreise, Avatare, Icon-Flächen |

`14px` und `18px` kommen bei zwei Bausteinen vor (Schritt-Karte, Stapelkarte) — historisch, beibehalten.

---

## Bewegung

Eine Kurve: `--ease: cubic-bezier(.16, 1, .3, 1)`.

| Vorgang | Dauer |
|---|---|
| Einblenden beim Scrollen | `.95s`, Versatz 34px |
| Hover auf Button/Karte | `.4s` |
| Hover auf Linie/Farbe | `.3s` – `.35s` |
| Vollbild-Navigation | `.6s` mit `cubic-bezier(.76, 0, .24, 1)` |
| Laufband | 30s linear, endlos |

Gestaffelte Einblendungen über `.d1 .d2 .d3` (80/160/240ms). Mehr als drei Stufen wirken zäh.

`prefers-reduced-motion` ist in `hnvr.css` behandelt: Animationen aus, **und** `.rv` wird sichtbar gesetzt. Wer Einblendungen per Inline-Style oder eigenem JS baut, muss diesen zweiten Teil selbst mitdenken — sonst bleibt die Seite für Betroffene leer.

---

## Einbetten

Für eine einzelne HTML-Datei (Artefakt, E-Mail-Vorlage, Angebot, alles ohne eigenen Server) gehören Schriften und CSS in die Datei:

```bash
# Aus dem Skill-Verzeichnis, erzeugt eine fertige @font-face-Regel
for f in assets/fonts/*.woff2; do
  echo "/* $f */"
  base64 -w0 "$f"
  echo
done
```

Aufbau im `<style>`:

```css
@font-face{font-family:'Clash Display';src:url(data:font/woff2;base64,…) format('woff2');font-weight:200 700;font-display:swap}
@font-face{font-family:'DM Sans';src:url(data:font/woff2;base64,…) format('woff2');font-weight:100 1000;font-display:swap}
@font-face{font-family:'Recoleta';src:url(data:font/woff2;base64,…) format('woff2');font-weight:900;font-display:swap}
/* danach der Inhalt von hnvr.css */
```

Recoleta 600 nur einbetten, wenn es gebraucht wird — spart 32 KB.
Zusammen sind alle vier Dateien 111 KB, base64 rund 148 KB. Das ist vertretbar; ein CDN-Aufruf ist es nicht.
