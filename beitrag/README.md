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

**Der erste Teil ist erledigt.** `maepux` liegt seit dem 17. August als
stillgelegte Zeile in `PK_Codes` und ist damit dauerhaft belegt:
`/r/maepux` antwortet jetzt **410** statt 404, und der Versuch, das Kürzel
erneut zu vergeben, scheitert am Index (`WDE0123`). Dafür war keine
Codeänderung nötig — der laufende Stand behandelt stillgelegte Codes
bereits richtig. `PK_Codes` hat außerdem ein neues Feld `geloescht`.

Was noch fehlt, ist das **künftige** Löschen: es entfernt die Zeile weiter,
statt sie stillzulegen. Zwei Handgriffe in `punkt-zentrale.js`:

```js
import { loeschePlan, verwaisteKuerzel, sperrzeile, kuerzelFrei } from '../lib/punkt-zentrale.js';

// 1 · Löschen wird Stilllegen. Kein remove() mehr auf PK_Codes.
const { aenderung, ereignis } = loeschePlan(code);
await wixData.update('PK_Codes', aenderung);
await wixData.insert('PK_Ereignisse', { ...ereignis, kontoId, wer, zeit: new Date().toISOString() });

// 2 · Einmalig: die bereits verwaisten Kürzel zurücksperren.
//     Für maepux ist das erledigt; die Funktion findet künftige.
for (const k of verwaisteKuerzel(alleCodes, alleEreignisse)) {
  await wixData.insert('PK_Codes', sperrzeile(k, kontoId));
}
```

Dazu muss die Liste `geloescht !== true` filtern. Die Weiterleitung
braucht nichts weiter: sie liefert für einen Code mit `aktiv: false`
bereits **410**. Nur der Satz auf der Seite passt nicht ganz — dort steht
„vorübergehend deaktiviert", und für ein Löschen wäre „dauerhaft gelöscht,
das Kürzel bleibt gesperrt" richtiger.

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
