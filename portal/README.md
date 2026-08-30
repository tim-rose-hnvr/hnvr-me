# Portal — Marketingseite und Kundenbereich

**Steht online:** <https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com>
Die Anwendung darunter: <https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com/studio/>

Astro-5-Projekt mit der Marketingseite des Studios und dem Gerüst für den
späteren Kundenbereich, angehängt an **Wix Headless**: Wix übernimmt Hosting,
Anmeldung und Umgebungsvariablen.

Gestaltung wie die Anwendung: Akzent `#0f766e`, dunkle Navigation und dunkler
Fuß `#1d2327`, invers gesetzter Abgleich, IBM Plex in Sans, Serif und Mono,
Radius 0. Die Schriften liegen unter `public/schrift` und kommen nicht von
Google — dieselbe Regel wie im Studio. Seite und Anwendung sollen wie
ein Stück wirken: wer auf „PDF Studio öffnen" klickt, soll nicht das Gefühl
haben, ein anderes Haus zu betreten.

```
src/pages/index.astro       Marketingseite
src/pages/portal.astro      Kundenbereich (Schritt zwei)
src/layouts/Grundgeruest.astro
src/styles/studio.css     Farben und Schriften wie studio/app/stil.css
public/schrift/             IBM Plex, acht Schnitte (kein Google Fonts)
skripte/app-einbetten.mjs   legt ../studio nach public/studio
```

## Die Anwendung liegt mit auf der Seite

`npm run build` kopiert vorher `../studio` nach `public/studio` — damit
wird die Anwendung mit ausgeliefert und läuft unter `/studio/` auf demselben
Wix-Hosting wie die Marketingseite. **11,9 MB in 239 Dateien**, keine davon
über 3 MB. Mit `node skripte/app-einbetten.mjs --schlank` sind es 8,3 MB —
dann ohne CJK-Zeichentabellen und ohne englische Texterkennung.

`public/studio` steht in `.gitignore`: die Anwendung hat genau eine Quelle,
das Verzeichnis daneben. Wer das Studio ändert, baut das Portal neu.

Das Wix-Hosting liefert für Verzeichnisse kein Register aus — `/studio/`
allein ergäbe 404. Dafür stehen in `astro.config.mjs` zwei Umleitungen auf
`/studio/index.html`, damit auch eine von Hand eingegebene Adresse ankommt.

**Nachgemessen an der veröffentlichten Seite** mit
`node ../studio/werkzeuge/live-pruefen.mjs` (31 Prüfungen): alle 239 Dateien
erreichbar und Byte für Byte gleich der gebauten Fassung (11,92 MB verglichen),
`.wasm` als `application/wasm`, die Sprachdaten als `application/gzip`, alle
drei Wege in die Anwendung offen. Dazu wird ins verlinkte Stilblatt gesehen:
IBM Plex ist eingebunden, ein Verweis auf Google Fonts steht nirgends, der
Akzent `#0f766e` ist gesetzt, und die Schnitte kommen als `font/woff2` von
derselben Seite. Geprüft wird auch die Anmeldung: die Auskunft antwortet, sie
nennt einen Abrufer ohne Sitzung ausdrücklich nicht angemeldet, die
ausgelieferte Anwendung trägt die Schranken-Zeile, und `/api/auth/login` leitet
auf die Anmeldung von Wix und von dort zurück auf diese Seite. Damit läuft dort
dieselbe Anwendung, die `pruefen.mjs` und `vollpruefung.mjs` im Browser
durchgemessen haben — 134 + 151 Prüfungen, darunter Texterkennung,
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
Projekt anhängen, PDF Studio einbetten, bauen, veröffentlichen. Es ist
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

**Der Aufbau ist der des Handoffs**, Abschnitt für Abschnitt und in seiner
Reihenfolge:

| # | Handoff | PDF Studio |
|---|---|---|
| 1 | Hero | Aufmacher mit dem Fenster: Seitenleiste, Dokument, Kommentare |
| 2 | Funktionen | zwölf Karten im Haarlinienraster |
| 3 | Vergleich (invers) | dunkel, Tabelle PDF Studio ↔ Suite-Standard |
| 4 | Für Teams | **Für die Arbeit**: vier Ablaufkarten am Dokument |
| 5 | Preise | **Kostenlos**: dieselbe Kartenform, 0 € statt Stufen |
| 6 | FAQ | sechs Fragen als Akkordeon, genau eine offen |
| 7 | CTA | Akzentfläche mit zwei Knöpfen |
| 8 | Footer | Marke, drei Linkspalten, untere Zeile |

Dazwischen stehen unsere eigenen Abschnitte — Abgleich mit Acrobat, Grenzen,
Prüfstand — **in denselben Mustern**, nicht daneben: Haarlinienraster für die
Karten, inverse Tafel für die Zahlen. Die Navigation trägt fünf Punkte mit
Aufklappmenü beim Überfahren, wie gezeichnet; sie kommt ohne JavaScript aus
(`:hover` und `:focus-within`), damit sie auch mit der Tastatur geht.

Zwei Abschnitte tragen bewusst andere Inhalte:

- **„Für Teams" wird „Für die Arbeit".** Vier Schritte am Dokument statt vier
  Personen — einen Server, über den sie sich abstimmen, gibt es hier nicht.
- **„Preise" wird „Kostenlos".** Die Kartenform bleibt, die Preise nicht. An
  der Stelle, an der im Handoff das Zitat einer Kundin steht, steht ein Satz
  aus unserem Quelltext: eine erfundene Kundin steht hier nirgends.

### Im Einzelnen

- **Was zuerst steht**: dass das Studio mitdenkt. „Läuft lokal" trägt als
  Aufmacher nicht mehr — mehrere Wettbewerber werben inzwischen wörtlich damit.
  Der Abschnitt „Vergleich" nennt drei Punkte, die auch gegen diese tragen, und
  sagt im selben Atemzug, was die anderen können und das Studio nicht.
- **Kontakt**: hnvr.me digital.
- **Preis**: keiner. Das Studio kostet nichts, es braucht nur eine
  Anmeldung — das steht so auf der Seite und am Knopf.
- **Der Aufmacher zeigt die Anwendung**, nicht eine Liste ihrer
  Werkzeugnamen: das Fenster aus dem Handoff mit Seitenleiste, Dokument auf
  der Bühnenfarbe (Markierung, Schwärzung, Kommentar-Nadel) und
  Kommentarspalte. Wer sich fragt, wie das aussieht, bekommt hier die Antwort
  und nicht das Inhaltsverzeichnis.
- **Ausprobieren**: der Knopf führt über `/api/auth/login` in die laufende
  Anwendung unter `/studio/`. Das ist die stärkste Stelle der Seite: das
  Versprechen lässt sich sofort nachprüfen, mit einer eigenen Datei und
  notfalls mit getrenntem Netz.

## Die Anmeldeschranke

Kostenlos, aber nicht anonym: das Studio fragt beim Start `/api/mitglied.json`
(`src/pages/api/mitglied.json.js`, liest `members.getCurrentMember()`) und legt
eine Schranke über sich, wenn niemand angemeldet ist. Eingeschaltet wird sie
durch eine Zeile im Kopf der Anwendung, die `skripte/app-einbetten.mjs` **nur in
die ausgelieferte Kopie** schreibt:

```html
<meta name="studio-anmeldung" content="/api/mitglied.json">
```

Ohne diese Zeile — also überall dort, wo das Studio ohne dieses Portal läuft —
gibt es keine Schranke. Ebenso, wenn die Auskunft nicht antwortet: dann läuft
die Anwendung. Das ist Leitprinzip 2, nicht Nachlässigkeit.

Unmissverständlich: **das ist eine Anmeldeschranke, keine Zugriffssperre.** Die
Dateien liegen offen; wer ihre Adressen kennt, kann sie laden. Wer echten
Zugriffsschutz braucht, legt ihn vor die Dateien, nicht in die Oberfläche.

Nach der Anmeldung bringt Wix den Menschen zurück: `returnToUrl` wandert in ein
Sitzungs-Plätzchen und wird vom Rückweg `/api/auth/callback` angesteuert. Nur
seitenrelative Adressen sind erlaubt — `/studio/index.html` ist eine.

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
sich verlegen, ohne die Anwendung anzufassen. Im `index.html` des Studios:

```html
<meta name="studio-fremd" content="https://anderer-ort.example/fremd/">
```

Der Server dort muss `.wasm` als `application/wasm` ausliefern.
