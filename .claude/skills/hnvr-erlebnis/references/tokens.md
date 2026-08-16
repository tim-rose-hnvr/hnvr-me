# Tokens

Alle Werte stehen als CSS-Variablen in `assets/erlebnis.css`. Diese Datei erklärt sie und nennt die Stellen, an denen man sich vergreifen kann.

---

## Farben

### Flächen

| Token | Wert | Wofür |
|---|---|---|
| `--bg` | `#FFFFFF` | Grundfläche |
| `--bg-still` | `#F0F0F0` | ruhiger Abschnitt, hebt sich kaum ab — genau das ist die Absicht |
| `--bg-block` | `#111111` | Umkehrblock: ein Abschnitt kippt komplett |

Der Rhythmus der Seite entsteht aus dem Wechsel Weiß → Grau → Weiß → **Schwarz**. Der schwarze Block kommt ein- bis zweimal vor und markiert das Wichtigste. Kein Verlauf dazwischen, keine Zwischentöne.

### Schrift

| Token | Wert | Kontrast |
|---|---|---|
| `--ink` | `#111111` | 18.9:1 auf Weiß |
| `--muted` | `#646464` | 5.9:1 auf Weiß, 5.2:1 auf `#F0F0F0` |
| `--on-block` | `#EFEFEF` | 16.4:1 auf `#111111` |
| (im Block) | `#B9B9B9` | 7.1:1 auf `#111111` — Fließtext im Umkehrblock |

### Akzent

`--accent: #E02B16`.

**Wichtig:** Rot ist auf hellem Grund kein Ton für Kleinschrift. Gemessen:

| Verwendung | Kontrast | Urteil |
|---|---|---|
| Weißer Text auf rotem Button | 4.6:1 | ok |
| Rot auf Weiß | 4.4:1 | nur ab 24px |
| Rot auf `#F0F0F0` | 4.1:1 | nur ab 24px |

Deshalb ist `.ey` (12px) in Tinte gesetzt und trägt den roten Strich als Marker. Für Rot als Textfarbe gibt es `.rot` — und die Regel: **erst ab 24px**. Große Ziffern (`.zeile .nr`), Trennpunkte und Flächen dürfen rot sein, Fließtext und Labels nicht.

### Linien

| Token | Wert | Wofür |
|---|---|---|
| `--line` | `#111111` | Volltonlinie, Formularunterkanten, Trennstriche |
| `--line-soft` | `#D8D8D8` | Kartenrahmen, Zeilentrenner |
| `--line-block` | `#3A3A3A` | dasselbe im Umkehrblock |

Linien sind hier volltonig, nicht transparent — anders als bei `hnvr-design`. Das gehört zum kantigen Charakter.

---

## Schrift

| Token | Familie | Wofür |
|---|---|---|
| `--disp` | Staatliches | Überschriften, Buttons, Karten-Titel, Technikliste, Ziffern |
| `--body` | Inter Tight | alles Lesbare |

**Staatliches kennt nur Versalien.** Kleinbuchstaben werden als Großbuchstaben ausgegeben. Zwei Folgen:

1. `text-transform: uppercase` ändert optisch nichts, steht aber trotzdem in der CSS — damit Auszeichnung und Darstellung übereinstimmen.
2. **Der MA-Trick ist in Staatliches unsichtbar.** „MArketing" sieht aus wie „MARKETING". Er wirkt nur dort, wo gemischt gesetzt wird: Inter Tight, Meta-Beschreibungen, Fließtext, Social-Text. In Display-Zeilen gehört er trotzdem in den Quelltext — die Schreibweise ist Teil der Marke, auch wenn man sie dort nicht sieht.

Inter Tight in drei Schnitten: **400** Fließtext, **500** Zwischenüberschrift und Navigation, **600** Betonung. Kein 700.

### Skala

Die Größen sind die der Live-Seite, gemessen bei der Entwurfsbreite **1440px** und in `vw` umgerechnet.

| Klasse | 1440px | Formel | line-height |
|---|---|---|---|
| `.st-1` | 135px | `clamp(44px, 9.375vw, 150px)` | `.9` |
| `.st-2` | 90px | `clamp(36px, 6.25vw, 100px)` | `.9` |
| `.st-3` | 72px | `clamp(30px, 5vw, 80px)` | `.9` |
| `.st-4` | 70px | `clamp(26px, 4.86vw, 78px)` | `.9` |
| `.it-lg` (600) | 46px | `clamp(24px, 3.19vw, 50px)` | `1.4` |
| `.it-md` (500) | 46px | `clamp(22px, 3.19vw, 50px)` | `1.3` |
| `.it-sm` (500) | 23px | `clamp(18px, 1.6vw, 25px)` | `1.3` |
| `.lede` | 24px | `clamp(18px, 1.67vw, 26px)` | `1.48` |
| `.copy` | 20px | `clamp(16px, 1.39vw, 22px)` | `1.5` |
| `.ey` | 12px | fest | — |

Die Seite selbst rechnet mit `calc(90 * var(--theme-spx-ratio))`, wobei das Verhältnis `Viewport / 1440` ist. `clamp()` bildet dasselbe ab, ohne registrierte Eigenschaften zu brauchen.

### Sperrsatz

`.gesperrt` setzt `letter-spacing: .5em` plus `margin-right: -.5em`. Das negative Margin ist Pflicht — ohne es schiebt der Zwischenraum hinter dem letzten Buchstaben das Wort sichtbar nach links aus der Flucht.

Einzelne Wörter, nie ganze Zeilen: `T O U C H`, `K O N T A K T`.

---

## Maß und Raum

| Token | Wert |
|---|---|
| `--maxw` | `1440px` (Entwurfsbreite der Seite) |
| `--pad` | `clamp(20px, 4vw, 60px)` |
| `--sec` | `clamp(70px, 8vw, 130px)` |

### Kanten

| Token | Wert | Herkunft |
|---|---|---|
| `--r-btn` | `0` | `--buttonsBorderRadius: 0` aus der Formularkomponente der Seite |
| `--r-card` | `8px` | `--cornerRadius: 8` aus einer Kartenkomponente der Seite |

Beide Werte sind gemessen, nicht gewählt. Buttons haben außerdem **keinen Rahmen** (`--buttonsBorderWidth: 0`).

---

## Bewegung

Eine Kurve: `--ease: cubic-bezier(.2, .7, .3, 1)` — kürzer und härter als beim digitalen Auftritt, passend zum kantigen Charakter.

| Vorgang | Dauer |
|---|---|
| Einblenden | `.7s`, Versatz 24px |
| Hover | `.25s` |
| Vollbild-Navigation | `.45s` |

`prefers-reduced-motion` ist behandelt: Animationen aus **und** `.rv` sichtbar. Wer eigene Einblendungen baut, muss den zweiten Teil mitdenken.

---

## Einbetten

Für eine einzelne HTML-Datei ohne Server:

```bash
for f in assets/fonts/*.woff2; do echo "/* $f */"; base64 -w0 "$f"; echo; done
```

```css
@font-face{font-family:'Staatliches';src:url(data:font/woff2;base64,…) format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Inter Tight';src:url(data:font/woff2;base64,…) format('woff2');font-weight:400;font-display:swap}
/* 500 und 600 nur einbetten, wenn sie vorkommen */
```

Die drei Inter-Tight-Schnitte wiegen je rund 110 KB, weil sie den vollen Zeichensatz tragen — alle vier Dateien zusammen 354 KB, base64 rund 470 KB. Für ein Artefakt oder eine E-Mail ist das zu viel. Zwei Auswege:

1. Nur Staatliches (23 KB) einbetten und für den Fließtext den Systemstapel nehmen: `-apple-system, 'Helvetica Neue', Arial, sans-serif`. Der Unterschied fällt bei Fließtext kaum auf.
2. Auf `latin` + `latin-ext` verkleinern, etwa mit `fonttools`:
   ```bash
   pyftsubset inter-tight-400.woff2 --flavor=woff2 --layout-features='*' \
     --unicodes='U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+2000-206F,U+20AC,U+2122' \
     --output-file=inter-tight-400.latin.woff2
   ```
   Bringt die Datei auf ungefähr ein Viertel.
