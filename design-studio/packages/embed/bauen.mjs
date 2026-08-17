/**
 * Baut eine Testseite, die den Baustein wie ein fremdes Projekt einbindet:
 * über ein `<script>`-Tag, nicht über den Bundler des Einbettenden.
 *
 * Die Seite trägt bewusst **eigene, aggressive Stilregeln** — so verhält sich
 * eine echte Fremdseite. Bricht die Kapselung, sieht man es hier sofort.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const hier = dirname(fileURLToPath(import.meta.url));
const ausgabe = join(hier, 'ausgabe');
mkdirSync(ausgabe, { recursive: true });

const ergebnis = await build({
  entryPoints: [join(hier, 'test/seite.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
});

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Fremdseite mit eingebettetem Baustein</title>
<style>
  /* So sieht eine echte Fremdseite aus: globale Regeln, die alles umfärben. */
  * { font-family: "Comic Sans MS", cursive !important; }
  div { color: magenta; background: yellow; border: 3px dashed lime; }
  input { text-transform: uppercase; }
</style>
</head>
<body>
<h1>Fremdseite</h1>
<design-studio></design-studio>
<script>${ergebnis.outputFiles[0].text}</script>
</body>
</html>`;

const ziel = join(ausgabe, 'fremdseite.html');
writeFileSync(ziel, html);
console.log(`${(html.length / 1024 / 1024).toFixed(2)} MB -> ${ziel}`);
