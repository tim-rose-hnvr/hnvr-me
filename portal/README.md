# Portal — Marketingseite und Kundenbereich

**Steht online:** <https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com>
Die Anwendung darunter: <https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com/werkbank/>

Astro-5-Projekt mit der Marketingseite der Werkbank und dem Gerüst für den
späteren Kundenbereich, angehängt an **Wix Headless**: Wix übernimmt Hosting,
Anmeldung und Umgebungsvariablen.

Gestaltung wie die Anwendung: Akzent `#0f766e`, dunkle Navigation und dunkler
Fuß `#1d2327`, invers gesetzter Abgleich, IBM Plex in Sans, Serif und Mono,
Radius 0. Die Schriften liegen unter `public/schrift` und kommen nicht von
Google — dieselbe Regel wie in der Werkbank. Seite und Anwendung sollen wie
ein Stück wirken: wer auf „Werkbank öffnen" klickt, soll nicht das Gefühl
haben, ein anderes Haus zu betreten.

```
src/pages/index.astro       Marketingseite
src/pages/portal.astro      Kundenbereich (Schritt zwei)
src/layouts/Grundgeruest.astro
src/styles/werkbank.css     Farben und Schriften wie werkbank/app/stil.css
public/schrift/             IBM Plex, acht Schnitte (kein Google Fonts)
skripte/app-einbetten.mjs   legt ../werkbank nach public/werkbank
```

## Die Anwendung liegt mit auf der Seite

`npm run build` kopiert vorher `../werkbank` nach `public/werkbank` — damit
wird die Anwendung mit ausgeliefert und läuft unter `/werkbank/` auf demselben
Wix-Hosting wie die Marketingseite. **12,2 MB in 240 Dateien**, keine davon
über 3 MB. Mit `node skripte/app-einbetten.mjs --schlank` sind es 8,3 MB —
dann ohne CJK-Zeichentabellen und ohne englische Texterkennung.

`public/werkbank` steht in `.gitignore`: die Anwendung hat genau eine Quelle,
das Verzeichnis daneben. Wer die Werkbank ändert, baut das Portal neu.

Das Wix-Hosting liefert für Verzeichnisse kein Register aus — `/werkbank/`
allein ergäbe 404. Dafür stehen in `astro.config.mjs` zwei Umleitungen auf
`/werkbank/index.html`, damit auch eine von Hand eingegebene Adresse ankommt.

**Nachgemessen an der veröffentlichten Seite** mit
`node ../werkbank/werkzeuge/live-pruefen.mjs` (31 Prüfungen): alle 241 Dateien
erreichbar und Byte für Byte gleich der gebauten Fassung (12,18 MB verglichen),
`.wasm` als `application/wasm`, die Sprachdaten als `application/gzip`, alle
drei Wege in die Anwendung offen. Dazu wird ins verlinkte Stilblatt gesehen:
IBM Plex ist eingebunden, ein Verweis auf Google Fonts steht nirgends, der
Akzent `#0f766e` ist gesetzt, und die Schnitte kommen als `font/woff2` von
derselben Seite. Geprüft wird auch die Anmeldung: die Auskunft antwortet, sie
nennt einen Abrufer ohne Sitzung ausdrücklich nicht angemeldet, die
ausgelieferte Anwendung trägt die Schranken-Zeile, und `/api/auth/login` leitet
auf die Anmeldung von Wix und von dort zurück auf diese Seite. Damit läuft dort
dieselbe Anwendung, die `pruefen.mjs` und `vollpruefung.mjs` im Browser
durchgemessen haben — 128 + 102 Prüfungen, darunter Texterkennung,
qpdf-Verschlüsselung, die digitale Unterschrift und ein eigener Abschnitt, der
die Gestaltung gegen das Handoff nachmisst.

## Örtlich ansehen

```sh
cd portal
npm install
npm run dev      # http://localhost:4321
```

## An Wix hängen — ein Befehl

```sh
cd portal
npm run wix:veroeffentlichen
```

Das Skript `skripte/wix-veroeffentlichen.mjs` erledigt alles: anmelden,
Projekt anhängen, Werkbank einbetten, bauen, veröffentlichen. Es ist
wiederholbar — beim zweiten Lauf überspringt es Anmeldung und Anhängen und
veröffentlicht nur neu.

**Ein Browser wird gebraucht, ein Bildschirm am selben Rechner nicht.** Wo die
Anmeldung nicht selbst öffnen kann, gibt der Wix-Befehl eine Adresse und einen
achtstelligen Code aus. Der Code lässt sich an einem beliebigen Gerät
bestätigen, auch am Telefon; danach läuft das Skript von allein weiter. Er
verfällt nach zehn Minuten — dann das Skript einfach neu starten, es fragt
einen frischen an.

Ganz ohne Zutun geht es mit einem Schlüssel aus dem
[API-Keys-Manager](https://manage.wix.com/account/api-keys):

```sh
WIX_API_KEY="…" npm run wix:veroeffentlichen
```

Der Schlüssel gehört in die Umgebung, nicht ins Repository.

Beim ersten Lauf legt Wix ein Geschäft samt Site an, richtet die
Astro-Integration ein und schreibt `wix.config.json`. Dabei ersetzt der
Link-Befehl die Skripte in `package.json` durch eigene — das Skript holt
`app:einbetten` und `prebuild` danach zurück, sonst fehlte der Seite ab dem
zweiten Bau die Anwendung.

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

- **Was zuerst steht**: dass die Werkbank mitdenkt. „Läuft lokal" trägt als
  Aufmacher nicht mehr — mehrere Wettbewerber werben inzwischen wörtlich damit.
  Der Abschnitt „Und gegenüber den anderen" nennt vier Punkte, die auch gegen
  diese tragen (Mitdenken, keine Installation, Word/Excel, Barrierefreiheit)
  und sagt im selben Atemzug, was die anderen können und die Werkbank nicht.
- **Kontakt**: hnvr.me digital.
- **Preis**: keiner. Die Werkbank kostet nichts, es braucht nur eine
  Anmeldung — das steht so auf der Seite und am Knopf.
- **Der Aufmacher zeigt die Anwendung**, nicht eine Liste ihrer
  Werkzeugnamen: das Fenster aus dem Handoff mit Seitenleiste, Dokument auf
  der Bühnenfarbe (Markierung, Schwärzung, Kommentar-Nadel) und
  Kommentarspalte. Wer sich fragt, wie das aussieht, bekommt hier die Antwort
  und nicht das Inhaltsverzeichnis.
- **Ausprobieren**: der Knopf führt über `/api/auth/login` in die laufende
  Anwendung unter `/werkbank/`. Das ist die stärkste Stelle der Seite: das
  Versprechen lässt sich sofort nachprüfen, mit einer eigenen Datei und
  notfalls mit getrenntem Netz.

## Die Anmeldeschranke

Kostenlos, aber nicht anonym: die Werkbank fragt beim Start `/api/mitglied.json`
(`src/pages/api/mitglied.json.js`, liest `members.getCurrentMember()`) und legt
eine Schranke über sich, wenn niemand angemeldet ist. Eingeschaltet wird sie
durch eine Zeile im Kopf der Anwendung, die `skripte/app-einbetten.mjs` **nur in
die ausgelieferte Kopie** schreibt:

```html
<meta name="werkbank-anmeldung" content="/api/mitglied.json">
```

Ohne diese Zeile — also überall dort, wo die Werkbank ohne dieses Portal läuft —
gibt es keine Schranke. Ebenso, wenn die Auskunft nicht antwortet: dann läuft
die Anwendung. Das ist Leitprinzip 2, nicht Nachlässigkeit.

Unmissverständlich: **das ist eine Anmeldeschranke, keine Zugriffssperre.** Die
Dateien liegen offen; wer ihre Adressen kennt, kann sie laden. Wer echten
Zugriffsschutz braucht, legt ihn vor die Dateien, nicht in die Oberfläche.

Nach der Anmeldung bringt Wix den Menschen zurück: `returnToUrl` wandert in ein
Sitzungs-Plätzchen und wird vom Rückweg `/api/auth/callback` angesteuert. Nur
seitenrelative Adressen sind erlaubt — `/werkbank/index.html` ist eine.

Eine E-Mail-Adresse steht bewusst nicht darauf — sie ist nicht abgestimmt.
Sie gehört in `src/pages/index.astro` in den Abschnitt „Kontakt", sobald klar
ist, welche es sein soll.

## Die Größenfrage, geklärt

Wix nennt Grenzen nur für den **Upload-Weg** (Dateien in den Browser ziehen):
3 MB je Datei, 20 MB gesamt, und WebAssembly wird dort abgelehnt. Für den
**Terminalweg**, den wir gehen, steht in derselben Dokumentation ausdrücklich
„any build output" — keine Größen- oder Typgrenze.

Trotzdem ist die Last jetzt kleiner und aufgeräumt:

| | vorher | jetzt | schlank |
|---|---|---|---|
| gesamt | 13,6 MB | **11,8 MB** | **8,8 MB** |
| größte Datei | 3,95 MB | **2,74 MB** | 2,74 MB |

Dazwischen sind node-forge (284 kB, für die Unterschrift) und acht
Schriftschnitte (176 kB) dazugekommen.

Erreicht durch schnellere Sprachdaten (gleiche Genauigkeit, ein Drittel
schneller) und einen getrennten statt eingebetteten Texterkennungs-Kern.
`skripte/app-einbetten.mjs` zählt bei jedem Bau nach und meldet, was dem
Upload-Weg auffallen würde.

Und falls ein Hoster doch einmal `.wasm` verweigert: die schweren Teile lassen
sich verlegen, ohne die Anwendung anzufassen. Im `index.html` der Werkbank:

```html
<meta name="werkbank-fremd" content="https://anderer-ort.example/fremd/">
```

Der Server dort muss `.wasm` als `application/wasm` ausliefern.
