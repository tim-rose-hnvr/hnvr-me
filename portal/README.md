# Portal — Marketingseite und Kundenbereich

Astro-5-Projekt mit der Marketingseite der Werkbank und dem Gerüst für den
späteren Kundenbereich. Vorbereitet zum Anhängen an **Wix Headless**: Wix
übernimmt dann Hosting, Anmeldung und Umgebungsvariablen.

```
src/pages/index.astro       Marketingseite
src/pages/portal.astro      Kundenbereich (Schritt zwei)
src/layouts/Grundgeruest.astro
src/styles/werkbank.css     Farben und Schriften aus werkbank/app/stil.css
skripte/app-einbetten.mjs   legt ../werkbank nach public/werkbank
```

## Die Anwendung liegt mit auf der Seite

`npm run build` kopiert vorher `../werkbank` nach `public/werkbank` — damit
wird die Anwendung mit ausgeliefert und läuft unter `/werkbank/` auf demselben
Wix-Hosting wie die Marketingseite. Rund 13,6 MB, davon der größte Teil
WebAssembly und Sprachdaten für die Texterkennung.

`public/werkbank` steht in `.gitignore`: die Anwendung hat genau eine Quelle,
das Verzeichnis daneben. Wer die Werkbank ändert, baut das Portal neu.

Geprüft im Browser gegen die gebaute Seite: die Anwendung startet über den
Knopf auf der Startseite, lädt das Beispiel, erkennt Text (77 Wörter, 95 %
Sicherheit) und verschlüsselt mit qpdf — alles aus `/werkbank/` heraus, ohne
einen Fehler in der Konsole. WebAssembly und Web-Worker brauchen dafür nichts
weiter als einen Ort, der Dateien ausliefert.

## Örtlich ansehen

```sh
cd portal
npm install
npm run dev      # http://localhost:4321
```

## An Wix hängen — drei Befehle mit Browser

Diese Schritte brauchen eine Anmeldung im Browser und lassen sich deshalb
nicht aus einer Sitzung ohne Bildschirm erledigen. Reihenfolge einhalten:

```sh
cd portal
npx @wix/cli login                                            # 1. Konto verbinden
npm create @wix/new@latest -- headless link --business-name "Werkbank"   # 2. Projekt anhängen
npx @wix/cli build && npx @wix/cli release                    # 3. veröffentlichen
```

Schritt 2 legt in Ihrem Wix-Konto ein Geschäft samt Site an, richtet die
Astro-Integration ein und ergänzt die nötigen Abhängigkeiten. Danach steht die
Seite unter einer Wix-Adresse; eine eigene Domain lässt sich im Wix-Dashboard
verbinden.

Voraussetzung: Node ab 20.11 und **Astro 5** — Astro 6 wird vom Link-Befehl
nicht unterstützt. Dieses Projekt ist bewusst auf Astro 5 festgelegt.

## Was Wix danach übernimmt

- **Hosting** der gebauten Seite, mit Zwischenspeicher. `release` leert ihn.
- **Anmeldung**: die Astro-Integration stellt `/api/auth/login` und
  `/api/auth/logout` bereit und verwaltet die Sitzung. Auf der Seite ist beides
  schon verlinkt — vor dem Anhängen laufen die Wege ins Leere.
- **Zugangsdaten**: eine private App als OAuth-Handler, deren Schlüssel als
  Umgebungsvariablen im Projekt liegen. Nichts davon gehört ins Repository.

## Angemeldete Person auslesen (nach dem Anhängen)

In `src/pages/portal.astro` oben im Frontmatter ergänzen:

```astro
export const prerender = false;
import { members } from '@wix/members';
const mitglied = await members.getCurrentMember();
```

Damit wird die Seite bei jedem Aufruf gerechnet und kennt den angemeldeten
Menschen. Der Schnipsel steht hier und nicht als Kommentar in der Seite, weil
Astro schon beim Bauen nach dem Wort `prerender` im Quelltext sucht und die
Seite sonst als serverseitig ansieht — ohne Adapter bricht der Bau dann ab.

## Was auf der Seite steht

- **Kontakt**: hnvr.me digital.
- **Preis**: steht ausdrücklich noch nicht fest — die Seite verspricht keinen.
- **Ausprobieren**: der Knopf führt in die laufende Anwendung unter
  `/werkbank/`. Das ist die stärkste Stelle der Seite: das Versprechen lässt
  sich sofort nachprüfen, mit einer eigenen Datei und notfalls mit
  getrenntem Netz.

Eine E-Mail-Adresse steht bewusst nicht darauf — sie ist nicht abgestimmt.
Sie gehört in `src/pages/index.astro` in den Abschnitt „Kontakt", sobald klar
ist, welche es sein soll.

## Grenze, die erst beim Veröffentlichen sichtbar wird

Ob Wix' Headless-Hosting die 13,6 MB im `public`-Ordner ohne Murren annimmt,
zeigt sich erst bei `wix release`. Örtlich baut und läuft alles. Falls dort
eine Obergrenze greift, bleibt die Anwendung an einem eigenen statischen Ort
und die Seite verlinkt dorthin — die Marketingseite ändert sich dadurch nicht.
