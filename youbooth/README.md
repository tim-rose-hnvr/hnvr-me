# youbooth.me

Website und Oberflächen der Fotobox-Software **youbooth** — Umsetzung der Entwürfe aus
`FotoboxSystem_UI_Mockups` (Bündel `design_handoff_youbooth`).

## Stand

**Die Website ist vollständig umgesetzt.** Offen sind nur noch die Oberflächen der Software
selbst (`/oberflaechen/*`) — die entstehen als eigenständige Anwendung, siehe unten.

| Bereich | Stand |
|---|---|
| Fundament (Tokens, Layout, Kopfleiste, Fußzeile, Bildplatz, Icons) | fertig |
| `/`, `/system`, `/module` + 14 Modulseiten | fertig |
| `/anlaesse` + sechs Landingpages | fertig |
| `/vorlagen` (Galerie) und `/vorlagen/system` (Prinzip) | fertig |
| `/vergleich`, `/rechner`, `/preise`, `/hilfe`, `/partner`, `/ratgeber` | fertig, interaktiv |
| `/team`, `/referenzen`, `/fuer-vermieter`, `/support`, `/download` | fertig |
| `/kontakt`, `/anmelden` | fertig, kein Dienst dahinter |
| `/design-system` | fertig, liest die echten Tokens |
| `/impressum`, `/datenschutz`, `/agb` | Gerüst mit Platzhaltern, rechtlich zu prüfen |
| App-Oberflächen `/oberflaechen/*` | alle sieben stehen, mit Screenshots aus der laufenden Software |

Offene Routen sind erreichbar und zeigen eine „In Arbeit"-Seite mit Verweis auf die Entwurfsdatei.

Jede im Entwurf vorgesehene Route ist erreichbar: Was noch nicht umgesetzt ist, rendert
`src/pages/[...pfad].astro` als „In Arbeit"-Seite mit Verweis auf die zugehörige Entwurfsdatei.
Sobald eine Seite als eigene `.astro`-Datei existiert, fällt sie dort automatisch heraus — die
Liste in `src/daten/navigation.ts` muss dafür nicht angefasst werden.

## Starten

```bash
npm install
npm run dev      # Entwicklung auf http://localhost:4321
npm run build    # statische Ausgabe nach dist/
npm run preview  # gebaute Seite ansehen
```

Astro, statisch generiert. Keine Laufzeit-Abhängigkeit: Die Schriften (Archivo Variable,
IBM Plex Mono) liegen selbst gehostet im Paket, Icons sind inline, es gibt keinen CDN-Abruf.

## Aufbau

```
src/
  styles/tokens.css      Farben, Maße, Radien, Schatten, Bewegung — die einzige Quelle
  styles/global.css      Typografie T1 und die Bausteine, die auf fast jeder Seite vorkommen
  layouts/Marketing.astro  Kopf, Kopfleiste, Inhalt, Fußzeile
  components/            Kopfleiste, Fusszeile, Bildplatz, Icon, BoxSchema
  daten/navigation.ts    Kopfleiste, Fußzeile, geplante Routen
  daten/module.ts        die 14 Module mit Preisen — Grundlage von Start, Module und Preise
  icons/                 26 Strich-Icons (currentColor)
  pages/                 eine Datei je Route
public/assets/           Signet, Logos, Favicons, Produkt-Screenshots
```

**Sprache:** Deutsch, auch in Klassennamen und Bezeichnern, wo es die Domäne betrifft
(`abschnitt`, `karte`, `zaehler`, `modulposten`). Etablierte technische Begriffe bleiben
englisch.

**Gestaltung:** Werte kommen aus `tokens.css`, nicht als Zahl in die Seite. Wiederkehrende
Muster (`.abschnitt`, `.karte`, `.knopf`, `.mono`, `.raster`, `.punkte`) stehen in `global.css`;
alles Seitenspezifische bleibt im `<style>`-Block der jeweiligen Seite (Astro-scoped).

**Interaktion:** Die interaktiven Seiten rendern ihren Startzustand serverseitig und werden im
Browser aktualisiert — ohne JavaScript bleibt jeweils ein vollständiger, lesbarer Zustand
stehen. Auswahl läuft über echte Radios und Checkboxen, das FAQ-Akkordeon über
`<details name>`; getoggelte Elemente stehen im Markup und werden ein- und ausgeblendet, statt
per JavaScript erzeugt zu werden.

## Abweichungen vom Handoff — bewusst

1. **Überschriften wiegen 800, nicht 900.** Die Handoff-Tabelle nennt für h1/h2 `900` und
   `letter-spacing:-.035em`. Im gerenderten Entwurf gewinnt aber die spezifischere Regel
   `[style*="Instrument Serif"]` des T1-Overrides, also **800** und **-.025em**. Umgesetzt ist
   das tatsächliche Erscheinungsbild; nachgemessen an den Entwurfsdateien (h1 der Startseite:
   drei Zeilen, 203 px hoch — identisch).
2. **„Volles Set" im Rechner kostet 205 €, nicht 195 €.** Der Entwurf beziffert das Paket mit
   195 €, die Summe der 13 Zusatzmodule ergibt 205 €. Gerechnet wird aus den echten
   Modulpreisen, damit Rechner und Preisseite nicht widersprechen.
3. **Modulzähler auf `/preise` zählt 13, nicht 12.** Der Entwurf schreibt „X VON 12 AKTIV" bei
   13 Modulen in der Liste.
4. **Icons inline statt `<img>` mit `filter:invert(1)`.** Die Icons sind auf `currentColor`
   gezeichnet; inline eingebunden erben sie die Textfarbe und brauchen den Filter-Trick auf
   dunklem Grund nicht.
5. **Instrument Serif entfällt** — wie im Handoff verlangt. Display-Zeilen ohne
   Überschriftenrang tragen die Klasse `.display` (Archivo 800, gemischte Schreibweise).
6. **Kopfleiste und Fußzeile folgen den Entwurfsdateien, nicht der Handoff-Beschreibung.**
   Die Dateien zeigen zehn Navigationspunkte (System · Module · Anlässe · Vorlagen · Vergleich ·
   Rechner · Preise · Hilfe · Über uns · Download), den CTA „14 Tage testen" und die
   Fußzeilenspalten Produkt · Für Betreiber · Kontakt. Der Handoff-Text nennt zwölf Punkte,
   „Kostenlos testen" und andere Spalten.

## Offene Punkte

- **Kontaktformular hat keinen Endpunkt.** Das Absenden wird abgefangen und zeigt die
  Bestätigung wie im Entwurf. Sobald ein Endpunkt existiert: `action` am `<form>` setzen und den
  `preventDefault`-Zweig in `src/pages/kontakt.astro` entfernen.
- **Fotos fehlen.** Jeder `<Bildplatz>` ohne `src` zeigt sein Motiv als Platzhaltertext — diese
  Angaben sind das Shooting-Briefing.
- **Produkt-Screenshots** in `public/assets/shot-*.png` stammen aus den Prototypen und sind nach
  der Umsetzung durch echte Aufnahmen zu ersetzen.
- **Hardware-Aussage geklärt:** youbooth verkauft ausschließlich Software. Die Entwürfe
  widersprachen sich hier (Startseite: „auf Wunsch die fertige Fotobox dazu", Kontaktseite:
  „Wir verkaufen keine Hardware"). Die Verkaufsaussagen sind entfernt — Hero, Abschnittsbeiwort
  auf der Startseite und die Hardware-Frage im Preis-FAQ formulieren jetzt durchgängig:
  unsere Software, eure Box.
- **Rechtstexte** (Impressum, Datenschutz, AGB) sind in den Entwürfen nur als Fußzeilenlinks
  vorhanden.
