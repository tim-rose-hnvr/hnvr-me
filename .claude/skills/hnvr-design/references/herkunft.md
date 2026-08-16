# Herkunft, Lizenzen, Nachprüfen

Stand: 16.08.2026

---

## Woher das Design stammt

**hnvr.me digital** läuft auf WordPress mit dem Theme **Dreamslab** (Elementor, WooCommerce, Hosting bei WordPress.com).
Nachweis im ausgelieferten HTML: `"wptheme":"dreamslab"`, dazu die Stylesheets `wp-content/themes/dreamslab/style.css` sowie die eigenen Ergänzungen `/assets/kontakt.css`, `/assets/mobil.css`, `/assets/korrekturen.css`.

Die Tokens in diesem Skill stammen aus zwei Quellen, die sich decken:

1. **Die Live-Seite.** Aus dem gerenderten CSS: Akzent `#FF7120` mit Verlaufsende `#DF3E06`, Creme `#F1EFEB`, Tinte `#0C0C0C`, Nebenton `#C2C2C2`, Schriften `"ClashDisplay"` und `"DM Sans"`, Containerbreite `1770px`, Seitenrand `3.61vw`, `text-transform: uppercase` an rund 50 Stellen, `letter-spacing: 1.4px` auf Labels.
2. **Der Nachbau in Claude** vom 23.07.2026 — die beiden Artefakte „Dreamslab — Home 2 (Creative Studio)" und „Dreamslab — Creative Portfolio & Agency". Dort liegt das System bereits als sauberer `:root`-Block vor. Der Home-2-Nachbau ist die Grundlage von `assets/hnvr.css`; die Schriftdateien in `assets/fonts/` sind aus diesem Artefakt extrahiert.

Abweichungen, die bewusst getroffen wurden:

- Der Portfolio-Nachbau nutzte `--accent:#F1531F`. Verworfen — die Live-Seite sagt `#FF7120`, und die gilt.
- Der Home-2-Nachbau nutzte `--bg:#050505`, die Live-Seite in einigen Blöcken `#030303`. `#050505` behalten: der Unterschied ist unsichtbar, der eine Wert ist einfacher.
- Der zweite Nachbau kannte kein Recoleta. Recoleta bleibt drin, weil der Riesen-Schriftzug ohne Serife nicht funktioniert.

**Nicht** aus der Live-Seite übernommen: die Elementor-Standardwerte (`#6EC1E4`, `#61CE70`, Roboto). Die stehen zwar im `elementor-kit-8`, sind aber unbenutzter Auslieferungszustand.

---

## Was nicht dazugehört

`hnvr.me` (die Hauptdomain, „hnvr.me mit Erlebniss") ist eine **Wix**-Seite mit einem anderen System: Staatliches als Display-Schrift, Inter Tight als Textschrift, Rot `#E02B16` als Akzent.
Das ist der Event- und Rental-Auftritt, nicht hnvr.me digital. Dieser Skill beschreibt **nicht** diese Seite. Wer für den Event-Bereich gestaltet, braucht ein eigenes Tokenset — dann bitte als zweiter Skill, nicht als Sonderzweig hier.

---

## Schriftlizenzen

| Schrift | Lizenz | Bewertung |
|---|---|---|
| **Clash Display** | Fontshare (Indian Type Foundry), kostenlos für privat und kommerziell, Webnutzung eingeschlossen | unkritisch |
| **DM Sans** | SIL Open Font License 1.1 | unkritisch |
| **Recoleta** | Latinotype, kostenpflichtig — Lizenz mit der Website erworben (Auskunft Tim, 16.08.2026) | geklärt für hnvr.me |

Recoleta ist bezahlt und wird verwendet. Die Lizenz gehört zum Website-Kauf, gilt also für hnvr.me.

Für **Kundenprojekte** ist das eine eigene Frage: Webfont-Lizenzen sind bei Latinotype üblicherweise an Domain und Seitenaufrufe gebunden, nicht an die Agentur. Wenn Recoleta in eine fremde Domain eingebettet werden soll, gehört die Lizenz dorthin — oder der Riesen-Schriftzug bekommt eine freie, hoch-kontrastige Serife (z. B. Instrument Serif, OFL). Betroffen ist dann nur `--serif`, plus eine Nachjustierung von `scaleY`.

---

## Nachprüfen

Wenn sich die Live-Seite ändert und der Skill nachziehen soll:

```bash
# Seite holen
curl -sSL https://hnvr.me/ -o seite.html

# Theme bestätigen
grep -o 'wptheme[^,]*' seite.html

# Farben zählen (die häufigsten sind die tragenden)
grep -oiE '#[0-9a-f]{6}' seite.html | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn | head -20

# Schriften
grep -oE 'font-family:[^;}]+' seite.html | sort -u

# eigene Ergänzungen der Agentur
curl -sSL https://hnvr.me/assets/korrekturen.css
```

Wenn ein Wert abweicht: **Live-Seite gewinnt**, dieser Skill wird nachgezogen — nicht umgekehrt eine Ausnahme im Projekt gebaut.

---

## Skill anderswo verfügbar machen

Der Skill liegt unter `.claude/skills/hnvr-design/` und wird in jeder Sitzung geladen, die dieses Repository als Quelle hat.

Für alle Projekte auf dem eigenen Rechner:

```bash
ln -s "$PWD/.claude/skills/hnvr-design" ~/.claude/skills/hnvr-design
```

Ein Symlink statt einer Kopie — sonst driften die beiden Stände auseinander, und genau das soll dieser Skill verhindern.
