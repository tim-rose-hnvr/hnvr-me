# Herkunft, Lizenzen, Nachprüfen

Stand: 16.08.2026

---

## Woher das Design stammt

**hnvr.me** — Titel „hnvr.me mit Erlebniss | Webagentur Hannover" — läuft auf **Wix**
(`<meta name="generator" content="Wix.com Website Builder">`). Kein WordPress, kein eigenes Theme.

Wix legt sein Designsystem als CSS-Variablen offen. Alle Werte hier stammen aus dem ausgelieferten HTML der Startseite, keiner ist geschätzt:

| Wix-Variable | Wert | wird hier zu |
|---|---|---|
| `--color_11` / `--wst-color-fill-background-primary` | `#FFFFFF` | `--bg` |
| `--color_12` / `--wst-color-fill-background-secondary` | `#F0F0F0` | `--bg-still` |
| `--color_37` / `--wst-color-fill-base-2` | `#111111` | `--bg-block`, `--ink`, `--line` |
| `--color_15` / `--wst-color-text-primary` | `#111111` | `--ink` |
| `--color_14` / `--wst-color-text-secondary` | `#EFEFEF` | `--on-block` |
| `--color_18` / `--wst-color-action` | `#E02B16` | `--accent` |
| `--color_48/49/50` (Button primär) | Füllung + Rahmen `#E02B16`, Text `#FFFFFF` | `.btn` |
| `--color_57/58/59` (Button sekundär) | Füllung `#FFFFFF`, Rahmen + Text `#E02B16` | `.btn.zweit` |
| `--font_0` … `--font_4` | Staatliches, 135/90/72/70px, `line-height: .9em` | `.st-1` … `.st-4` |
| `--font_5` … `--font_9` | Inter Tight 600/500/400, 46/24/23/20px | `.it-*`, `.lede`, `.copy` |
| `--buttonsBorderRadius`, `--buttonsBorderWidth` | `0`, `0` | `--r-btn` |
| `--cornerRadius` (Kartenkomponente) | `8` | `--r-card` |
| `--theme-spx-ratio` | `Viewport / 1440` | Entwurfsbreite, Basis der `clamp()`-Werte |

Selbst getroffene Entscheidungen — nicht aus der Seite ableitbar, deshalb hier offengelegt:

- `--muted: #646464` für Fließtext auf Hell. Wix führt keinen solchen Ton; `#646464` kommt auf der Seite vor und erreicht 5.9:1.
- `#B9B9B9` für Fließtext im Umkehrblock (7.1:1 auf `#111111`).
- `--line-soft: #D8D8D8` für Kartenrahmen.
- `.ey` in Tinte statt in Rot. **Grund:** `#E02B16` erreicht auf Weiß nur 4.4:1 und auf `#F0F0F0` nur 4.1:1 — für 12px unter der Schwelle. Das Rot trägt stattdessen der Strich davor. Wenn die Live-Seite kleine rote Labels verwendet, ist das ein Barrierefreiheitsfehler der Seite, kein Vorbild.
- `--ease: cubic-bezier(.2,.7,.3,1)`. Wix liefert keine Bewegungskurve mit.

Nicht übernommen: die Wix-Standardpalette `--color_3` bis `--color_10` (`#ED1C24`, `#0088CB`, `#FFCB05`, Grautöne). Das ist Auslieferungszustand, nicht das Design der Seite. Ebenso ungenutzt: die Themenpaletten `--color_19` bis `--color_35` (Blau, Grün, Braun, Orange) — sie liegen im Theme, kommen auf der Startseite aber nicht vor.

---

## Verhältnis zum zweiten Skill

`hnvr-design` beschreibt **hnvr.me digital** — WordPress mit dem Dreamslab-Theme, dunkler Grund, Orange `#FF7120`, Clash Display und DM Sans.

Beide Auftritte gehören zur selben Firma, teilen aber **nur den Tonfall** (Deutsch, Du, Dreiklang, MA-Trick). Farben, Schriften und Kanten sind gegensätzlich, und das ist Absicht. Nichts aus dem einen System in das andere übernehmen.

---

## Schriftlizenzen

| Schrift | Lizenz | Bewertung |
|---|---|---|
| **Staatliches** | SIL Open Font License 1.1 | unkritisch, auch in Kundenprojekten |
| **Inter Tight** | SIL Open Font License 1.1 | unkritisch, auch in Kundenprojekten |

Beide dürfen selbst gehostet, verändert und weitergegeben werden, solange die OFL-Bedingungen eingehalten werden (Namensregel bei Änderungen, kein Verkauf der Schrift selbst).
Anders als beim digitalen Auftritt ist hier nichts zu klären.

Die Dateien in `assets/fonts/` stammen aus der Auslieferung der Live-Seite (`static.wixstatic.com/ufonts/…/woff2/file.woff2`).

---

## Nachprüfen

```bash
curl -sSL https://hnvr.me/ -o seite.html

# Bestätigen, dass es Wix ist
grep -o '<meta name="generator"[^>]*>' seite.html

# Themenfarben (color_11, _12, _15, _18, _37 sind die tragenden)
grep -oE -- '--color_[0-9]+:[0-9, ]+' seite.html | sort -u | head -50

# Schriftstile
grep -oE -- '--font_[0-9]+:[^;]+' seite.html | sort -u

# Kanten der Komponenten
grep -oE -- '--(buttonsBorderRadius|buttonsBorderWidth|cornerRadius): *[0-9]+' seite.html | sort -u
```

Wenn ein Wert abweicht: **Live-Seite gewinnt**, dieser Skill wird nachgezogen.

Ein Vorbehalt zur Methode: Wix rendert viele Bausteine erst im Browser. Abstände zwischen Abschnitten und einzelne Hover-Zustände ließen sich aus dem ausgelieferten HTML nicht ablesen — die Werte für `--sec`, `--pad` und die Hover-Übergänge sind deshalb aus dem Gesamtbild abgeleitet, nicht gemessen. Wer Zugriff auf den Wix-Editor hat, kann sie dort bestätigen.

---

## Skill anderswo verfügbar machen

```bash
ln -s "$PWD/.claude/skills/hnvr-erlebnis" ~/.claude/skills/hnvr-erlebnis
```

Symlink statt Kopie, sonst driften die Stände auseinander.
