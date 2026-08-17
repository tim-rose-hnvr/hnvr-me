# Beitrag für PUNKT

Zwei Dateien, reine Funktionen, keine Abhängigkeiten, deutsche Bezeichner
wie im übrigen Code. Sie decken das ab, was dem ausgelieferten Stand von
`punkt-954d3e9b-hnvrme.wix-site-host.com` belegbar fehlt — siehe
`doku/abgleich-studio.md`.

| Datei | Inhalt | Prüfen |
|---|---|---|
| `punkt-erweiterungen.js` | Sonderfarben, GS1 Digital Link, Augenformen | `node punkt-erweiterungen.js` — 19 Prüfungen |
| `punkt-zentrale.js` | Ordner, Suche, Löschen ohne Kürzelfreigabe | `node punkt-zentrale.js` — 25 Prüfungen |

## Zuerst: ein Befund aus den laufenden Daten

Im Ereignisprotokoll steht am 10. August ein `code.geloescht` für das
Kürzel **`maepux`**. In `PK_Codes` gibt es dazu keine Zeile mehr. Der
eindeutige Index `kuerzel-eindeutig` wirkt nur auf vorhandene Zeilen —
`maepux` ist damit **wieder frei und kann ein zweites Mal vergeben
werden.**

Das ist der eine Fehler, den ein Kurzadressdienst nicht machen darf. Das
Kürzel steht auf Papier, und Papier lässt sich nicht löschen. Wird es neu
vergeben, zeigt ein gedrucktes Plakat eines Tages auf das Ziel eines
Fremden — und niemand kann es zurückholen.

Zwei Handgriffe beheben das, beide in `punkt-zentrale.js`:

```js
import { loeschePlan, verwaisteKuerzel, sperrzeile, kuerzelFrei } from '../lib/punkt-zentrale.js';

// 1 · Löschen wird Stilllegen. Kein remove() mehr auf PK_Codes.
const { aenderung, ereignis } = loeschePlan(code);
await wixData.update('PK_Codes', aenderung);
await wixData.insert('PK_Ereignisse', { ...ereignis, kontoId, wer, zeit: new Date().toISOString() });

// 2 · Einmalig: die bereits verwaisten Kürzel zurücksperren.
for (const k of verwaisteKuerzel(alleCodes, alleEreignisse)) {
  await wixData.insert('PK_Codes', sperrzeile(k, kontoId));
}
```

Dazu muss die Liste `geloescht !== true` filtern und die Weiterleitung
den Fall abfangen: ein gelöschter Code bekommt eine lesbare Seite
(„Dieser Code wurde gelöscht"), kein „unbekannt" und niemals ein fremdes
Ziel. Statuscode **410**, nicht 404 — diesen Code gab es.

`kuerzelFrei` ist die freundliche Antwort davor; der Schutz bleibt der
Index. Zwei gleichzeitige Anfragen bestehen jede Vorabfrage und legen
trotzdem doppelt an.

## Ordner und Suche

```js
import { sucheCodes, ordnerStand, ordnerNameVon } from '../lib/punkt-zentrale.js';

const gefiltert = sucheCodes(alleCodes, { text: suchwort, ordner: gewaehlterOrdner });
const reiter    = ordnerStand(alleCodes, ordnerNachId);   // [{name, anzahl}], „ohne Ordner" zuerst
```

Gesucht wird über Name, Kürzel, **Ziel**, GTIN und Ordner. Das Ziel
gehört dazu: man erinnert sich an die Kampagnenseite, nicht an das
Kürzel. `ordner: '-'` heißt „ohne Ordner“.

`ordnerNameVon` versteht beides — `ordnerId` aus `PK_Codes` mit einer
aufgelösten Zuordnung, oder ein bereits gesetztes Feld `ordner`.

## Sonderfarben

Dort, wo heute die Füllfarbe gesetzt wird:

```js
import { pdfFuellfarbe, psFuellfarbe, pdfSonderraum, epsSonderfarbenZeile } from '../lib/punkt-erweiterungen.js';

strom += pdfFuellfarbe(farbe);           // statt `${r} ${g} ${b} rg`
// in /Resources der Seite:
`/ColorSpace << ${pdfSonderraum(farbe)} >>`
// im EPS-Kopf, vor %%EndComments:
kopf += epsSonderfarbenZeile(alleFarben);
```

Nachweisbar mit `gs -sDEVICE=tiffsep`: die Datei bekommt dann einen
eigenen Auszug mit dem Namen der Farbe, neben Cyan, Magenta, Yellow
und Black.

## GS1 Digital Link

Als weiterer Inhaltstyp:

```js
import { digitalLink, pruefeGTIN, pruefeKassentauglichkeit } from '../lib/punkt-erweiterungen.js';

const text = digitalLink({ gtin, charge, verfaellt }, 'https://pnkt.me');
const { befunde } = pruefeKassentauglichkeit({ gtin, modulMm, ruhezone, verlauf, logo });
```

Die Kassenmaße 0,396 bis 0,990 mm sind schärfer als die
Verfahrensgrenzen — ein Code, der für Offset reicht, kann für die Kasse
zu klein sein.

## Augenformen

In die vorhandene Befundliste:

```js
import { augenHinweis } from '../lib/punkt-erweiterungen.js';

const h = augenHinweis(stil.augenrahmen);
if (h) befunde.push(h);
```

## Berichtigung

In einer früheren Fassung stand hier, Mitarbeitende fehlten dem
Wix-Stand. **Das war falsch.** Die Sammlung `PK_Mitglieder` existiert und
ist gefüllt — `admin@hnvr.me` als `redakteur`. Der Irrtum kam daher, dass
ich im gebauten Bündel nach „mitarbeit" gesucht habe; das Projekt sagt
„Mitglied". Ein fehlendes Wort ist kein fehlendes Merkmal.

Was zu den Rollen noch fehlen könnte, lässt sich von außen nicht
feststellen — dafür bräuchte ich `zentrale.astro`. Der Vollständigkeit
halber: in `pnkt/speicher/marke.go` liegen drei Stufen (Inhaber,
Redakteur, Leser), Codes gehören der Organisation und nicht der Person,
und ein Schlüssel kann nie mehr dürfen als die Person, der er gehört.
