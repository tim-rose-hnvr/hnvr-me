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
| `tesseract.mjs` | `tesseract.js/dist/tesseract.esm.min.js` | 7.0.0 | Apache-2.0 |
| `tesseract-arbeiter.js` | `tesseract.js/dist/worker.min.js` | 7.0.0 | Apache-2.0 |
| `tesseract-kern.js` | `tesseract.js-core/tesseract-core-simd-lstm.wasm.js` | 6.1.2 | Apache-2.0 |
| `sprachen/deu.traineddata.gz` | `@tesseract.js-data/deu` (4.0.0_best_int) | 1.0.0 | Apache-2.0 |
| `sprachen/eng.traineddata.gz` | `@tesseract.js-data/eng` (4.0.0_best_int) | 1.0.0 | Apache-2.0 |
| `qpdf.wasm`, `qpdf.js`, `qpdf.mjs`, `browser.js` | `@jspawn/qpdf-wasm` | 0.0.2 | Apache-2.0 |

Arbeitsteilung: `pdf.js` liest und zeichnet, `pdf-lib` schreibt, `tesseract.js`
erkennt Text in Bildern, `qpdf` verschlüsselt, entschlüsselt, repariert und
linearisiert. Keines der vier kann die Aufgabe eines anderen übernehmen.

Zusammen rund 14 MB. Das ist der Preis dafür, dass die Werkbank ohne Netz
arbeitet — Texterkennung und Verschlüsselung sind sonst genau die Stellen, an
denen andere Anbieter die Datei auf einen fremden Server laden.

Nur die SIMD-Fassung des Tesseract-Kerns liegt bei; jeder Browser der letzten
Jahre kann SIMD. Weitere Sprachen sind nachrüstbar: die passende
`<sprache>.traineddata.gz` nach `fremd/sprachen/` legen und in
`app/texterkennung.js` in `SPRACHEN` eintragen.

## Auffrischen

```sh
npm pack pdfjs-dist@4 pdf-lib@1        # oder npm install in einem Wegwerfverzeichnis
cp node_modules/pdfjs-dist/build/pdf.min.mjs         werkbank/fremd/pdf.mjs
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs  werkbank/fremd/pdf.worker.mjs
cp -r node_modules/pdfjs-dist/standard_fonts         werkbank/fremd/schriften
cp -r node_modules/pdfjs-dist/cmaps                  werkbank/fremd/cmaps
cp node_modules/pdf-lib/dist/pdf-lib.esm.min.js      werkbank/fremd/pdf-lib.mjs
cp node_modules/tesseract.js/dist/tesseract.esm.min.js   werkbank/fremd/tesseract.mjs
cp node_modules/tesseract.js/dist/worker.min.js          werkbank/fremd/tesseract-arbeiter.js
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js werkbank/fremd/tesseract-kern.js
cp node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz werkbank/fremd/sprachen/
cp node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz werkbank/fremd/sprachen/
cp node_modules/@jspawn/qpdf-wasm/{qpdf.wasm,qpdf.js,qpdf.mjs,browser.js} werkbank/fremd/
node werkbank/werkzeuge/pruefen.mjs                  # danach den Prüflauf fahren
```

Nach jedem Auffrischen gehört der Prüflauf dazu: `pdf.js` ändert zwischen
Hauptfassungen gelegentlich die Textebenen-Schnittstelle.
