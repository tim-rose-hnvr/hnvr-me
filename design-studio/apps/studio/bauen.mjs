/**
 * Baut das Probemodell zu **einer** HTML-Datei.
 *
 * Alles eingebettet: Skript, Stil, Schriften. Kein Netzabruf, keine
 * Fremdherkunft — die Datei läuft per Doppelklick, in einem Wix Custom Element
 * und in einer abgeschotteten Umgebung gleichermaßen.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const hier = dirname(fileURLToPath(import.meta.url));
const ausgabe = join(hier, 'ausgabe');
mkdirSync(ausgabe, { recursive: true });

const ergebnis = await build({
  entryPoints: [join(hier, 'src/main.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
});

const skript = ergebnis.outputFiles[0].text;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design Studio — Probemodell</title>
</head>
<body>
<div id="app"></div>
<script>${skript}</script>
</body>
</html>`;

const ziel = join(ausgabe, 'probemodell.html');
writeFileSync(ziel, html);
console.log(`${(html.length / 1024 / 1024).toFixed(2)} MB -> ${ziel}`);

// Zweite Fassung ohne Dokumenthülle: Einbettungen wie ein Wix Custom Element
// oder eine Artefaktseite setzen head und body selbst; eine zweite Hülle würde
// dort verworfen oder verschachtelt.
const fragment = `<title>Design Studio</title>\n<div id="app"></div>\n<script>${skript}</script>`;
const zielFragment = join(ausgabe, 'probemodell-fragment.html');
writeFileSync(zielFragment, fragment);
console.log(`${(fragment.length / 1024 / 1024).toFixed(2)} MB -> ${zielFragment}`);
