# Portal — Marketingseite und Kundenbereich

Astro-5-Projekt mit der Marketingseite der Werkbank und dem Gerüst für den
späteren Kundenbereich. Vorbereitet zum Anhängen an **Wix Headless**: Wix
übernimmt dann Hosting, Anmeldung und Umgebungsvariablen.

```
src/pages/index.astro       Marketingseite
src/pages/portal.astro      Kundenbereich (Schritt zwei)
src/layouts/Grundgeruest.astro
src/styles/werkbank.css     Farben und Schriften aus werkbank/app/stil.css
```

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

## Wohin mit der Anwendung selbst

Die Werkbank (`../werkbank`) ist rund 15 MB und braucht nur einen Ort, der
Dateien ausliefert — sie rechnet alles im Browser. Wix eignet sich für die
Marketingseite, nicht als Ablage für diese Menge statischer Dateien mit
WebAssembly und Web-Workern. Drei brauchbare Wege:

1. **Zum Selbstbetrieb ausliefern** — als Archiv, das der Kunde in sein Netz
   stellt. Passt am besten zum Versprechen, dass nichts das Gerät verlässt.
2. **Eigener Webspace** — irgendein statischer Ort, von der Wix-Seite verlinkt.
3. **Später als Anwendung** — dann mit eigenem Bezugsweg über den Kundenbereich.

## Noch offen

Auf der Seite ist absichtlich als Entwurf gekennzeichnet, was nicht entschieden
ist: **Preis und Lizenz**, **Bezugsweg** und **Kontaktadresse**. Diese drei
Stellen stehen im Abschnitt „Noch offen" in `src/pages/index.astro` und sollten
gefüllt sein, bevor die Seite beworben wird.
