---
name: hnvr-design
description: Das Designsystem von hnvr.me, abgeleitet aus der eigenen WordPress-Seite (Theme Dreamslab + Elementor) — Clash Display, DM Sans, Signalorange #FF7120 auf Schwarz #030303 und Creme. Anwenden bei allem Sichtbaren für hnvr.me: Seite, Landingpage, Onepager, Kundenangebot, Präsentation, Artefakt, PDF, E-Mail-Vorlage, Social-Grafik, Tool-Oberfläche, Dashboard, neue Abschnitte für die WordPress-Seite selbst. Trigger: hnvr, hnvr.me, "unser Design", "im Stil unserer Seite", Seite/Landingpage/Deck für hnvr.
---

# hnvr.me — Designsystem

Die Quelle ist die eigene WordPress-Installation: **hnvr5.wpcomstaging.com**, Theme **Dreamslab** mit Elementor.
Alle Werte hier sind von dort ausgelesen, nicht nachempfunden. Die Variablennamen sind die des Themes — was mit diesem System gebaut wird, lässt sich unverändert in die Seite übernehmen.

Nichts wird pro Projekt neu erfunden. Anpassung passiert über Inhalte und Bilder, nie über neue Farben oder Schriften.

## Vorgehen

1. **Immer** `assets/fonts.css` + `assets/hnvr.css` einbinden, nie Tokens abtippen.
   Einzelne HTML-Datei ohne Server (Artefakt, E-Mail, Angebot): Schriften als `data:font/woff2;base64` einbetten — siehe `references/tokens.md`, Abschnitt „Einbetten".
2. Seitengerüst aus `assets/vorlage.html`.
3. **Zuerst klären, welcher Seitentyp gebaut wird** — `references/seitentypen.md`. Blog und Shop laufen auf der Theme-Typografie, nicht auf den Displaygraden. Wer das verwechselt, baut einen Fremdkörper.
4. Bausteine aus `references/komponenten.md`, Bewegung aus `references/bewegung.md`.
5. Texte nach `references/sprache.md` — Deutsch, Du, Stakkato.

## Acht Leitplanken

1. **Zwei Schriften, keine dritte.** Clash Display für Überschriften, Buttons, Labels, Zahlen. DM Sans für alles Lesbare. Beide selbst gehostet, wie auf der Seite — nie Google Fonts, nie ein CDN.
2. **Schwarz ist der Normalzustand.** `#030303` trägt die Seite, `#F1EFEB` (Creme) ist der Gegenschnitt für ein bis zwei Abschnitte, `#121C27` die abgesetzte Fläche. Reines Weiß als Grundfläche gibt es nicht.
3. **Ein Akzent: `#FF7120`.** Kein zweiter Akzentton. `#87F90E` gibt es auf der Seite, aber nur als seltenes Signal — nicht als zweite Hausfarbe verwenden.
4. **Überschriften sind Clash Display 600 in Weiß**, `line-height: 1.2` bei den Textgraden, `.98` bei den Displaygraden, `letter-spacing` negativ. Große Typo trägt die Seite, nicht Bilder.
5. **Fließtext ist DM Sans 16px/1.625 in `#C2C2C2`** — das ist die Body-Regel des Themes. Nie reines Weiß für Fließtext, nie breiter als 44ch.
6. **Kleinschrift in Großbuchstaben bekommt `letter-spacing: 1.4px`.** Das ist der Wert der Seite, er gilt für Labels, Buttons, Pillen, Tabellenköpfe.
7. **Kanten:** Karten 8px, große Kästen 48px, Buttons und Pillen rund. Das sind die Elementor-Werte der Seite; nichts dazwischen erfinden.
8. **Deutsch, Du, Stakkato.** „Ideen zünden. Erfolg entfachen." Kein Sie, kein Agentur-Sprech.

## Kurzreferenz

| | |
|---|---|
| Grund | `--secondary-color` `#030303` · Fläche `--primary-color` `#121C27` · Creme `#F1EFEB` |
| Text | `--third-color` `#C2C2C2` · Überschrift `--four-color` `#FFF` · auf Creme `#0C0C0C` / `#5C5E5C` |
| Akzent | `#FF7120`, Verlaufsende `#DF3E06` |
| Linie | `rgba(255,255,255,.15)` |
| Display | Clash Display 600, uppercase |
| Text | DM Sans 16px / 1.625 |
| Breite | `1770px` (Elementor), Rand `3.61vw` |
| Entwurfsbreite | `1920px` — daher die vw-Werte der Displaygrade |

Vollständige Tabellen: `references/tokens.md`.

## Drei Bauweisen, zwei Typo-Ebenen

Der Seitenbestand kommt aus drei Quellen — **Elementor** (Startseite, Über uns, Leistungen, Team, FAQ, Karriere, Kontakt, Portfolio), **Theme-Vorlage** (Blog, Beitrag, Kategorie) und **WooCommerce** (Shop, Produkt, Warenkorb, Kasse). Details in `references/seitentypen.md`.

Daraus folgen zwei Typo-Ebenen:

- **Theme-Ebene** — `h1`–`h6`, feste px-Grade (50 / 35 / 30 / 25 / 20 / 17) mit den Haltepunkten 1200 / 767 / 480. Das ist der Fließ- und Fallback-Zustand, gilt für Blog, Shop, Formulare.
- **Seiten-Ebene** — `.disp-1` bis `.disp-5`, die großen Grade aus den Elementor-Einstellungen (150 / 120 / 100 / 80 / 70 / 55 px bei 1920). Das ist der gestaltete Zustand für Landingpages und Bühnen.

Für eine gebaute Landingpage `.disp-*` nehmen. Für **Blog und Shop** die Theme-Grade — dort ist `h2` 35px, nicht 80.

## Vor dem Abliefern

`node assets/pruefen.mjs <datei-oder-url>` laufen lassen — das prüft Schriftladung, Bewegungsreduktion, Überlauf, Kontrast und Formularbeschriftungen und gibt 1 zurück, wenn etwas durchfällt.

Dazu `references/fallstricke.md` durchgehen. Dort stehen zehn Befunde aus der Design-Durchsicht vom 10.08.2026 — jeder einmal teuer gefunden, jeder mit Messwert. Die drei, die am häufigsten wiederkommen:

- **Die Schrift ist nicht geladen, obwohl sie geladen aussieht.** `"ClashDisplay"` ohne Leerzeichen trifft nichts. Nachweis über die Textbreite, nicht über `document.fonts.check` — das meldet auch beim Rückfall `true`.
- **`prefers-reduced-motion` braucht `!important`.** Startzustände kommen als Inline-Style; kurze Übergangsdauern machen das Verschwinden nur schneller. 29 Textblöcke blieben so unsichtbar.
- **Waagerechter Überlauf ohne Scrollleiste.** `scrollWidth` blieb bei 390, der Text war trotzdem abgeschnitten. Einzelne Blockbreiten mitmessen.

## Wenn etwas fehlt

Erst prüfen, ob sich ein bestehender Baustein erweitern lässt. Wenn wirklich neu:
Clash-Display-Überschrift in Großbuchstaben, DM-Sans-Text, eine 1px-Linie oder 8px-Radius als Rahmen, Akzent nur als Punkt, Ziffer, Haken oder Hover-Fläche. Dann in `references/komponenten.md` nachtragen.

Widerspruch ist erlaubt: Wenn eine Regel eine Anforderung technisch unmöglich macht (Kontrast, Barrierefreiheit, Druck), das sagen — nicht still umgehen.

## Verwandte Dateien

- `references/tokens.md` — alle Werte, beide Typo-Ebenen, Einbetten
- `references/seitentypen.md` — wie Startseite, Blog, Shop, Portfolio, FAQ aufgebaut sind
- `references/bewegung.md` — das Bewegungssystem mit den Werten der Seite
- `references/komponenten.md` — Bausteine mit fertigem Markup
- `references/sprache.md` — Tonfall, Satzmuster, Wortliste
- `references/fallstricke.md` — zehn Befunde aus der Durchsicht, mit Messwerten
- `assets/pruefen.mjs` — die Prüfliste als ausführbares Skript
- `references/herkunft.md` — Quelle, Lizenzen, Nachprüfen
- `assets/hnvr.css`, `assets/fonts.css`, `assets/fonts/`, `assets/vorlage.html`
