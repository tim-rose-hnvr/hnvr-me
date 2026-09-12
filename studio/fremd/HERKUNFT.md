# Fremde Bestandteile

Diese Dateien liegen absichtlich im Repository und nicht in einem Paketverzeichnis:
Das Studio soll ohne Netz starten — kein CDN, keine externe Schrift, kein
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
| `tesseract-core-simd-lstm.js` | `tesseract.js-core` (Glue-Code) | 6.1.2 | Apache-2.0 |
| `tesseract-core-simd-lstm.wasm` | `tesseract.js-core` (Programm) | 6.1.2 | Apache-2.0 |
| `sprachen/deu.traineddata.gz` | `tessdata_fast` (deu) | 4.0.0 | Apache-2.0 |
| `sprachen/eng.traineddata.gz` | `tessdata_fast` (eng) | 4.0.0 | Apache-2.0 |
| `qpdf.wasm`, `qpdf.js`, `qpdf.mjs`, `browser.js` | `@jspawn/qpdf-wasm` | 0.0.2 | Apache-2.0 |
| `forge.mjs` | `node-forge/dist/forge.min.js` | 1.4.0 | BSD-3-Clause (oder GPL-2.0) |
| `schrift/plex-*.woff2` | `@fontsource/ibm-plex-sans`, `-condensed`, `-serif`, `-mono` (Teilmenge `latin`) | 5.2.5 | OFL-1.1 |

Arbeitsteilung: `pdf.js` liest und zeichnet, `pdf-lib` schreibt, `tesseract.js`
erkennt Text in Bildern, `qpdf` verschlüsselt, entschlüsselt, repariert und
linearisiert, `node-forge` liest PKCS#12-Ausweisdateien und rechnet die
Signatur. Keines der fünf kann die Aufgabe eines anderen übernehmen.

`forge.mjs` ist das unveränderte `dist/forge.min.js`, nur in ein ES-Modul
gewickelt (das Studio lädt ausschließlich ES-Module, das Bündel ist UMD).
Gebraucht wird es an genau einer Stelle: `app/signieren.js`. Eine `.p12` zu
öffnen heißt, ASN.1 zu lesen und mit 3DES oder AES zu entschlüsseln — die
Web-Crypto-Schnittstelle des Browsers kann kein 3DES, und eigene Kryptografie
ist in diesem Projekt ausgeschlossen. Die CMS-Struktur baut `app/signieren.js`
selbst zusammen; das ist Kodierung nach RFC 5652, keine Kryptografie.

Zusammen rund 12 MB. Das ist der Preis dafür, dass das Studio ohne Netz
arbeitet — Texterkennung und Verschlüsselung sind sonst genau die Stellen, an
denen andere Anbieter die Datei auf einen fremden Server laden.

Nur die SIMD-Fassung des Tesseract-Kerns liegt bei; jeder Browser der letzten
Jahre kann SIMD. Weitere Sprachen sind nachrüstbar: die passende
`<sprache>.traineddata.gz` nach `fremd/sprachen/` legen und in
`app/texterkennung.js` in `SPRACHEN` eintragen.

## Zwei Entscheidungen, die Messungen zugrunde liegen

**Sprachdaten: `tessdata_fast` statt `best_int`.** Am gerasterten Beispiel
gemessen (200 dpi, deutsche Seite): gleiche Wortgenauigkeit (94 %), einen
Punkt höhere Sicherheit, ein Drittel schneller (1,9 s statt 2,9 s) — bei
853 kB statt 1333 kB. Eine Messung an einem Dokument, kein Allgemeinurteil;
wer sehr schlechte Vorlagen hat, kann `best_int` zurücklegen.

**Tesseract-Kern getrennt statt eingebettet.** Die Fassung `…wasm.js` trägt
das Programm als Text in sich (3,95 MB). Getrennt sind es 124 kB Glue-Code
und 2,74 MB WebAssembly — knapp 1 MB weniger, und der Browser kann die
WebAssembly-Datei richtig zwischenspeichern. Dafür ist eine Kleinigkeit
nötig: der Kern holt seine `.wasm` mit einem **relativen** Pfad, und ein aus
einem Blob gestarteter Arbeiter hat keinen Bezugspunkt dafür. Deshalb steht
in `app/texterkennung.js` `workerBlobURL: false` — der Arbeiter läuft von
seiner echten Adresse. Der Server muss `.wasm` außerdem als
`application/wasm` ausliefern.

## Auffrischen

```sh
npm pack pdfjs-dist@4 pdf-lib@1        # oder npm install in einem Wegwerfverzeichnis
cp node_modules/pdfjs-dist/build/pdf.min.mjs         studio/fremd/pdf.mjs
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs  studio/fremd/pdf.worker.mjs
cp -r node_modules/pdfjs-dist/standard_fonts         studio/fremd/schriften
cp -r node_modules/pdfjs-dist/cmaps                  studio/fremd/cmaps
cp node_modules/pdf-lib/dist/pdf-lib.esm.min.js      studio/fremd/pdf-lib.mjs
cp node_modules/tesseract.js/dist/tesseract.esm.min.js   studio/fremd/tesseract.mjs
cp node_modules/tesseract.js/dist/worker.min.js          studio/fremd/tesseract-arbeiter.js
cp node_modules/tesseract.js-core/tesseract-core-simd-lstm.{js,wasm}  studio/fremd/
# Sprachdaten aus tessdata_fast, gepackt:
#   gzip -9 -c deu.traineddata > studio/fremd/sprachen/deu.traineddata.gz
#   gzip -9 -c eng.traineddata > studio/fremd/sprachen/eng.traineddata.gz
cp node_modules/@jspawn/qpdf-wasm/{qpdf.wasm,qpdf.js,qpdf.mjs,browser.js} studio/fremd/
# node-forge: UMD in ein ES-Modul wickeln (Kopf mit module/exports, Fuss mit export default)
#   siehe Kopfkommentar in studio/fremd/forge.mjs
node studio/werkzeuge/pruefen.mjs                  # danach den Prüflauf fahren
```

Nach jedem Auffrischen gehört der Prüflauf dazu: `pdf.js` ändert zwischen
Hauptfassungen gelegentlich die Textebenen-Schnittstelle.
