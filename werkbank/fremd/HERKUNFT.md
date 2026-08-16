# Fremde Bestandteile

Diese Dateien liegen absichtlich im Repository und nicht in einem Paketverzeichnis:
Die Werkbank soll ohne Netz starten — kein CDN, keine externe Schrift, kein
Nachladen zur Laufzeit (Leitprinzip 2 der Projektanweisung).

| Datei | Herkunft | Fassung | Lizenz |
|---|---|---|---|
| `pdf.mjs` | `pdfjs-dist/build/pdf.min.mjs` | 4.10.38 | Apache-2.0 |
| `pdf.worker.mjs` | `pdfjs-dist/build/pdf.worker.min.mjs` | 4.10.38 | Apache-2.0 |
| `schriften/` | `pdfjs-dist/standard_fonts/` | 4.10.38 | Apache-2.0 (enthält Foxit-Schriften) |
| `cmaps/` | `pdfjs-dist/cmaps/` | 4.10.38 | Apache-2.0 |
| `pdf-lib.mjs` | `pdf-lib/dist/pdf-lib.esm.min.js` | 1.17.1 | MIT |

`pdf.js` liest und zeichnet, `pdf-lib` schreibt. Beide Aufgaben brauchen
unterschiedliche Bibliotheken; keine der beiden kann die andere ersetzen.

## Auffrischen

```sh
npm pack pdfjs-dist@4 pdf-lib@1        # oder npm install in einem Wegwerfverzeichnis
cp node_modules/pdfjs-dist/build/pdf.min.mjs         werkbank/fremd/pdf.mjs
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs  werkbank/fremd/pdf.worker.mjs
cp -r node_modules/pdfjs-dist/standard_fonts         werkbank/fremd/schriften
cp -r node_modules/pdfjs-dist/cmaps                  werkbank/fremd/cmaps
cp node_modules/pdf-lib/dist/pdf-lib.esm.min.js      werkbank/fremd/pdf-lib.mjs
node werkbank/werkzeuge/pruefen.mjs                  # danach den Prüflauf fahren
```

Nach jedem Auffrischen gehört der Prüflauf dazu: `pdf.js` ändert zwischen
Hauptfassungen gelegentlich die Textebenen-Schnittstelle.
