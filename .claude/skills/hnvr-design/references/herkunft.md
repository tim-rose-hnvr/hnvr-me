# Herkunft, Lizenzen, Nachprüfen

Stand: 16.08.2026

---

## Die Quelle

**https://hnvr5.wpcomstaging.com/** — die eigene WordPress-Installation, gehostet bei WordPress.com (Atomic).

| | |
|---|---|
| Theme | **Dreamslab** (`"wptheme":"dreamslab"`) |
| Seitenbaukasten | Elementor 4.2.0 |
| Optionsrahmen | Redux 4.5.13 |
| Shop | WooCommerce |
| Zeitzone | Europe/Berlin |

Jeder Wert in diesem Skill ist aus dem ausgelieferten HTML und CSS dieser Installation ausgelesen. Nichts ist nachempfunden.

### Was wo herkommt

**Farbtokens** — aus dem Block `<style id="pxl-style-inline-css">` der Seite, wörtlich:

```css
:root{--primary-color:#121c27;--secondary-color:#030303;--third-color:#c2c2c2;
--four-color:#fff;--body_bg-color:#030303;--link-color:#fff;--link-color-hover:#fff;}
```

Identisch auf `/`, `/home-2`, `/home-5`, `/home-6`, `/home-7`, `/our-services` und auf der Live-Seite. Das ist also das Fundament, nicht die Einstellung einer einzelnen Seite.

**Grundtypografie** — aus `wp-content/themes/dreamslab/assets/css`, wörtlich:

```css
body { background-color: var(--secondary-color); font-size: 16px; line-height: 1.625;
       color: var(--third-color); font-weight: normal; letter-spacing: 0;
       font-family: "DM Sans", sans-serif; }
h1,h2,h3,h4,h5,h6 { font-family: 'Clash Display'; color: #fff; font-weight: 600;
       margin: 0 0 15px; line-height: 1.2; }
```

samt der Grade 50 / 35 / 30 / 25 / 20 / 17 px und der Haltepunkte 1200 / 767 / 480.

**Schriften** — die Dateien der Seite selbst:

```
/wp-content/themes/dreamslab/assets/fonts/ClashDisplay/ClashDisplay-{Extralight,Light,Regular,Medium,Semibold,Bold}.woff2
/wp-content/uploads/fonts/dmsans/rP2Hp2ywxg089UriCZOIHQ.woff2      (latin)
/wp-content/uploads/fonts/dmsans/rP2Hp2ywxg089UriCZ2IHSeH.woff2    (latin-ext)
```

**Displaygrade, Akzent, Kanten** — aus den Elementor-Einstellungen der Seiten: Grade 150 / 120 / 100 / 80 / 70 / 55 px, Radien 8px (18×) und 48px (5×), `letter-spacing: 1.4px` (18×), `text-transform: uppercase` (50×), Containerbreite 1770px, Seitenrand 3.61vw, Bühnenverlauf `radial-gradient(at center center, #FF7120 0%, #DF3E06 100%)`.

**Entwurfsbreite 1920px** — belegt durch die vw-Werte im Theme-CSS: `5.208vw` = 100px, `2.8646vw` = 55px, `3.75vw` = 72px. Alle gehen bei 1920 glatt auf.

### Selbst entschieden

Diese Punkte stehen nicht in der Seite und sind Entscheidungen, keine Messungen:

- `--sec` (Abschnittshöhe) und die Staffelung `.d1 .d2 .d3`. Elementor setzt Abstände pro Element; ein einheitlicher Rhythmus ließ sich daraus nicht ableiten.
- Die Umrechnung der festen Displaygrade in `clamp()`/vw. Die Seite selbst schaltet an Haltepunkten um; stufenloses Wachsen ist die Verbesserung, die Ankerwerte bleiben.
- `.rv`-Einblendung, Korn-Textur, die Verdunkelung der Bühne. Auf der Seite macht das GSAP bzw. ein PNG; hier ist es CSS ohne Abhängigkeit.
- `--muted-cream: #5c5e5c` für Fließtext auf Creme (5.7:1). Auf Creme steht `--third-color` bei 1.9:1 und wäre unlesbar.

### Ausdrücklich nicht übernommen

- **Die Elementor-Standardwerte** `#6EC1E4`, `#54595F`, `#7A7A7A`, `#61CE70` mit Roboto und Roboto Slab aus `elementor-kit-8`. Unbenutzter Auslieferungszustand.
- **Die Gutenberg-Palette** `#87F90E` ausgenommen — die Töne `#F78DA7`, `#CF2E2E`, `#FF6900`, `#FCB900`, `#7BDCB5`, `#5FBD74` sind WordPress-Kernvorgaben, keine Markenfarben. Sie tauchen auf jeder Seite genau einmal auf, weil der Block-Editor sie mitliefert.
- **Six Caps.** Die Staging-Installation lädt die Schrift über `fonts-api.wp.com`, verwendet sie auf den geprüften Seiten aber nicht.

### Korrektur gegenüber einer früheren Fassung

Eine erste Fassung dieses Skills war aus zwei Claude-Nachbauten der Dreamslab-Demo abgeleitet, nicht aus der Seite. Daraus stammten zwei Fehler, die jetzt behoben sind:

- **Recoleta.** Der Nachbau setzte den großen Schriftzug in einer Serife. Die Seite kennt keine Serifenschrift — der Schriftzug ist Clash Display im größten Grad. Recoleta ist entfernt, die Lizenzfrage damit gegenstandslos.
- **Die Grundfarbe** war `#050505` statt `#030303`, und `--primary-color` (`#121C27`) fehlte ganz.

---

## Schriftlizenzen

| Schrift | Lizenz | Bewertung |
|---|---|---|
| **Clash Display** | Fontshare (Indian Type Foundry), kostenlos für privat und kommerziell, Webnutzung eingeschlossen | unkritisch |
| **DM Sans** | SIL Open Font License 1.1 | unkritisch |

Beide dürfen selbst gehostet und in Kundenprojekte eingebettet werden. Nichts zu klären.

---

## Nachprüfen

```bash
S=https://hnvr5.wpcomstaging.com
curl -sSL $S/ -o seite.html

# Theme bestätigen
grep -o 'wptheme[^,]*' seite.html

# Die fünf Farbtokens
grep -oE -- '--(primary|secondary|third|four|body_bg)-color: *#[0-9a-fA-F]+' seite.html | sort -u

# Grundtypografie aus dem Theme-Bündel
grep -oE 'https://[^"]*base-desktop[^"]*' seite.html   # das große Bündel, ca. 4 MB
# darin:  body {  …  }   und   h1, h2, h3, h4, h5, h6 { … }

# Displaygrade, Kanten und Sperrung der Elementor-Seiten
grep -oE 'font-size:[0-9]+px' seite.html | sort | uniq -c | sort -rn | head
grep -oE 'border-radius:[^;}]+'  seite.html | sort | uniq -c | sort -rn | head
grep -oE 'letter-spacing:[^;}]+' seite.html | sort | uniq -c | sort -rn | head
```

Wenn ein Wert abweicht: **Die Seite gewinnt**, dieser Skill wird nachgezogen — nicht umgekehrt eine Ausnahme im Projekt gebaut.

Ein Vorbehalt zur Methode: Diese Werte sind aus dem ausgelieferten Code gelesen, nicht im Browser gemessen. Was GSAP zur Laufzeit setzt (Einblendungen, Parallaxe, der Mauszeiger) und was erst nach dem Laden entsteht, ist hier nicht erfasst.

---

## Skill anderswo verfügbar machen

Der Skill liegt unter `.claude/skills/hnvr-design/` und wird in jeder Sitzung geladen, die dieses Repository als Quelle hat.

Für alle Projekte auf dem eigenen Rechner:

```bash
ln -s "$PWD/.claude/skills/hnvr-design" ~/.claude/skills/hnvr-design
```

Ein Symlink statt einer Kopie — sonst driften die beiden Stände auseinander, und genau das soll dieser Skill verhindern.
