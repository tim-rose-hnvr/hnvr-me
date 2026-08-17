# Beitrag für das PUNKT-Studio

`punkt-erweiterungen.js` enthält die drei Stücke, die dem ausgelieferten
Stand von `punkt-954d3e9b-hnvrme.wix-site-host.com` belegbar fehlen —
siehe `doku/abgleich-studio.md`. Reine Funktionen, keine
Abhängigkeiten, deutsche Bezeichner wie im übrigen Code.

Prüfen: `node punkt-erweiterungen.js` — 19 Prüfungen.

## Einbauen

Datei nach `src/lib/` legen, dann drei Andockstellen:

**1 · Sonderfarben** — dort, wo heute die Füllfarbe gesetzt wird:

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

**2 · GS1 Digital Link** — als weiterer Inhaltstyp:

```js
import { digitalLink, pruefeGTIN, pruefeKassentauglichkeit } from '../lib/punkt-erweiterungen.js';

const text = digitalLink({ gtin, charge, verfaellt }, 'https://pnkt.me');
const { befunde } = pruefeKassentauglichkeit({ gtin, modulMm, ruhezone, verlauf, logo });
```

Die Kassenmaße 0,396 bis 0,990 mm sind schärfer als die
Verfahrensgrenzen — ein Code, der für Offset reicht, kann für die Kasse
zu klein sein.

**3 · Augenformen** — in die vorhandene Befundliste:

```js
import { augenHinweis } from '../lib/punkt-erweiterungen.js';

const h = augenHinweis(stil.augenrahmen);
if (h) befunde.push(h);
```

## Was hier nicht drin ist

**Mitarbeitende.** Die Rollen stehen in `pnkt/speicher/marke.go` — drei
Stufen, Codes gehören der Organisation, ein Schlüssel kann nie mehr
dürfen als seine Person. Das lässt sich nicht als reine Funktion
liefern, weil es an eurer Datenhaltung in `zentrale.astro` und den
Wix-Sammlungen hängt. Dafür brauche ich die Quelldatei.
