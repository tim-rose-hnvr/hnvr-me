---
name: hnvr-design
description: Das Designsystem von hnvr.me digital — Clash Display, DM Sans, Signalorange #FF7120 auf Schwarz und Creme. Das ist der Agentur-Auftritt: Webdesign, Branding, SEO, Social Media, Software, Web-Apps, Tools. Anwenden bei allem Sichtbaren dieser Marke: Website, Landingpage, Onepager, Kundenangebot, Präsentation, Artefakt, PDF, E-Mail-Template, Social-Grafik, Tool-Oberfläche, Dashboard. Nicht verwechseln mit dem Skill hnvr-erlebnis — der gehört zum Event- und Rental-Auftritt auf hnvr.me (hell, rot, Staatliches).
---

# hnvr.me digital — Designsystem

Alles, was hnvr.me digital nach außen zeigt, sieht gleich aus. Dieser Skill ist die Quelle dafür.
Nichts hier wird pro Projekt neu erfunden — Anpassung passiert über Inhalte und Bilder, nie über neue Farben oder Schriften.

**Zwei Auftritte, nicht einer.** Dieser hier ist der dunkle Agentur-Auftritt. Für Technik, Bühne, Licht, Ton, Veranstaltung und Vermietung gilt der Skill `hnvr-erlebnis` — hell, Rot `#E02B16`, Staatliches. Beide teilen nur den Tonfall, sonst nichts. Nie Elemente aus dem einen ins andere übernehmen.

## Vorgehen

1. **Immer** `assets/hnvr.css` + `assets/fonts.css` einbinden, nie Tokens abtippen.
   Für eine einzelne HTML-Datei (Artefakt, E-Mail, Angebot): Inhalt von `hnvr.css` in ein `<style>` kopieren und die vier Schriften als `data:font/woff2;base64` einbetten — siehe `references/tokens.md`, Abschnitt „Einbetten".
2. Seitengerüst aus `assets/vorlage.html` nehmen. Die Klassen dort sind das Vokabular.
3. Bausteine aus `references/komponenten.md` zusammensetzen. Nur wenn nichts passt, nach den Regeln unten neu bauen.
4. Texte nach `references/sprache.md` — Deutsch, Du, Stakkato.

## Neun Leitplanken

Diese neun Punkte entscheiden, ob etwas nach hnvr aussieht. Alles andere ist Geschmack.

1. **Drei Schriften, keine vierte.** Clash Display (Überschriften, Labels, Buttons), DM Sans (Fließtext), Recoleta (genau ein Riesen-Schriftzug pro Seite). Immer selbst gehostet, nie Google Fonts, nie ein CDN.
2. **Dunkel ist der Normalzustand.** `#050505` trägt die Seite, `#F1EFEB` (Creme) ist der Gegenschnitt für ein bis zwei Abschnitte. Reines Weiß als Grundfläche gibt es nicht.
3. **Ein Akzent.** `#FF7120`. Kein zweiter Akzentton, keine Ampelfarben, keine Verlaufsspielereien außer den definierten Radialverläufen für Bildflächen.
4. **Überschriften sind Clash Display 600, GROSSBUCHSTABEN**, `line-height` ≤ 1, `letter-spacing` negativ (−0.01 bis −0.02em). Große Typo trägt die Seite, nicht Bilder.
5. **Fließtext ist DM Sans**, gemischt geschrieben, `max-width: 44ch`, Farbe `--muted`, nie reines Weiß.
6. **Recoleta 900 nur einmal pro Seite.** Der eine überbreite Schriftzug (`.serif-giant`, `scaleY(1.12)`). Zweimal wirkt billig.
7. **Radien:** Karten 14–22px, Pills und Buttons 50px, Kreise 50%. Nichts dazwischen erfinden.
8. **Bewegung ist ruhig.** Eine Kurve für alles: `cubic-bezier(.16,1,.3,1)`. Einblenden 34px/0.95s. `prefers-reduced-motion` wird respektiert — die Regel steht schon in `hnvr.css`, sie darf nicht mit Inline-Styles ausgehebelt werden.
9. **Deutsch, Du, Stakkato.** „Ideen zünden. Erfolg entfachen." Kein Sie, kein Agentur-Sprech, keine englischen Füllwörter außer den etablierten (Branding, Webdesign, SEO).

## Kurzreferenz

| | |
|---|---|
| Grund | `#050505` · Creme `#F1EFEB` · Tinte `#0C0C0C` |
| Text | `#F8F8F8` · gedämpft `#8C8C8C` · auf Creme `#6A6864` |
| Akzent | `#FF7120`, Verlaufsende `#DF3E06` |
| Linien | `rgba(255,255,255,.13)` · auf Creme `rgba(0,0,0,.12)` |
| Display | Clash Display 600, uppercase |
| Text | DM Sans 400/500 |
| Riesen-Schriftzug | Recoleta 900, uppercase, `scaleY(1.12)` |
| Breite | `max-width: 1760px`, Rand `clamp(20px, 5vw, 90px)` |
| Abschnitt | `padding: clamp(80px, 10vw, 160px) 0` |

Vollständige Tabellen: `references/tokens.md`.

## Wenn etwas fehlt

Neue Komponente bauen? Erst prüfen, ob sich eine bestehende erweitern lässt. Wenn wirklich neu:
Clash-Display-Überschrift in Großbuchstaben, DM-Sans-Text, eine Linie oder ein 14–22px-Radius als Rahmen, Akzent nur als Punkt, Ziffer, Haken oder Hover-Fläche. Dann in `references/komponenten.md` nachtragen, damit sie beim nächsten Mal da ist.

Widerspruch ist erlaubt: Wenn eine Regel hier eine Anforderung technisch unmöglich macht (Kontrast, Barrierefreiheit, Druck), das sagen — nicht still umgehen.

## Verwandte Dateien

- `references/tokens.md` — alle Tokens, Typo-Skala, Abstände, Einbetten
- `references/komponenten.md` — Bausteine mit fertigem Markup
- `references/sprache.md` — Tonfall, Satzmuster, Wortliste
- `references/herkunft.md` — woher das Design stammt, Lizenzen, wie man es nachprüft
- `assets/hnvr.css`, `assets/fonts.css`, `assets/fonts/`, `assets/vorlage.html`
