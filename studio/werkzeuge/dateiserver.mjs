/* Ein kleiner Dateiserver für die Prüfläufe — und nur dafür.

   Er stand zweimal da, einmal in `pruefen.mjs` und einmal im Prüfstand. Beide
   Fassungen hatten denselben Fehler: ein Verzeichnis öffnete sich, das Lesen
   scheiterte, und die Kopfzeilen waren schon draußen — der ganze Server fiel
   um. Aufgefallen ist das erst, als der Dienst `./` in seinen Vorrat legte.

   Zweimal derselbe Fehler an zwei Stellen heißt: es gehört an eine. */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join } from 'node:path';

const ARTEN = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.pdf': 'application/pdf', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain',
  '.wasm': 'application/wasm', '.gz': 'application/gzip',
  '.pfb': 'application/octet-stream', '.bcmap': 'application/octet-stream',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

/**
 * @param {string} wurzel Verzeichnis, das ausgeliefert wird. Nichts darüber.
 * @returns {import('node:http').Server}
 */
export function macheServer(wurzel) {
  return createServer(async (anfrage, antwort) => {
    let pfad = join(wurzel, decodeURIComponent(anfrage.url.split('?')[0]));
    if (!pfad.startsWith(wurzel)) { antwort.writeHead(403).end(); return; }
    /* Ein Verzeichnis liefert sein index.html — wie jeder echte Server. */
    try {
      if ((await stat(pfad)).isDirectory()) pfad = join(pfad, 'index.html');
    } catch {
      antwort.writeHead(404).end('nicht gefunden');
      return;
    }
    const strom = createReadStream(pfad);
    strom.on('error', () => {
      if (!antwort.headersSent) antwort.writeHead(404);
      antwort.end('nicht gefunden');
    });
    strom.on('open', () => {
      antwort.writeHead(200, { 'content-type': ARTEN[extname(pfad)] || 'application/octet-stream' });
      strom.pipe(antwort);
    });
  });
}

/** Startet ihn auf einem freien Port und liefert Server und Adresse. */
export async function starteServer(wurzel) {
  const server = macheServer(wurzel);
  await new Promise((l) => server.listen(0, '127.0.0.1', l));
  return { server, basis: `http://127.0.0.1:${server.address().port}` };
}
