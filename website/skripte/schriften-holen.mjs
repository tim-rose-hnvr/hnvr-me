// Holt Caprasimo und Figtree einmal von Google und legt sie neben die
// Seite. Danach lädt die Seite keine Schrift mehr von fremden Servern.
//
//   npm run schriften
//
// Warum überhaupt: Im Fuß der Seite steht „EU-Hosting · keine
// Tracking-Cookies". Eine Seite, die dabei ihre Schriften von
// fonts.gstatic.com holt, schickt die IP jedes Besuchers nach Amerika,
// bevor der erste Buchstabe steht. Das Landgericht München hat dafür im
// Januar 2022 Schadenersatz zugesprochen (3 O 17493/20). Die Aussage im
// Fuß und der Ladeweg müssen zusammenpassen — sonst ist eine von beiden
// falsch.
//
// Beide Schriften stehen unter der SIL Open Font License; das Mitliefern
// ist ausdrücklich erlaubt. Die Lizenz landet mit im Verzeichnis.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = join(HIER, '..', 'public', 'schrift');

// Ein Browser-Kennzeichen, sonst liefert Google die alte TTF-Fassung
// statt woff2 — dreimal so groß, ohne Gewinn.
const KENNUNG =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

const SCHNITTE = [
  { familie: 'Caprasimo', gewichte: '400' },
  { familie: 'Figtree', gewichte: '400;600;700' },
];

async function hole(url, alsText = false) {
  const antwort = await fetch(url, { headers: { 'User-Agent': KENNUNG } });
  if (!antwort.ok) throw new Error(`${antwort.status} bei ${url}`);
  return alsText ? antwort.text() : Buffer.from(await antwort.arrayBuffer());
}

await mkdir(ZIEL, { recursive: true });

const regeln = [];
for (const { familie, gewichte } of SCHNITTE) {
  const css = await hole(
    `https://fonts.googleapis.com/css2?family=${familie}:wght@${gewichte}&display=swap`, true);

  // Google liefert je Zeichensatz einen eigenen @font-face-Block. Wir
  // behalten latin und latin-ext — mehr braucht deutsche Werbesprache
  // nicht, und jeder weitere Block kostet eine Datei.
  const bloecke = css.split('/*').filter((b) => /^\s*(latin|latin-ext)\b/.test(b));
  if (!bloecke.length) throw new Error(`keine latin-Blöcke für ${familie}`);

  for (const block of bloecke) {
    const satz = block.match(/^\s*(latin-ext|latin)\b/)[1];
    const gewicht = block.match(/font-weight:\s*(\d+)/)?.[1] ?? '400';
    const quelle = block.match(/src:\s*url\((https:[^)]+\.woff2)\)/)?.[1];
    const bereich = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    if (!quelle) continue;

    const name = `${familie.toLowerCase()}-${gewicht}-${satz}.woff2`;
    await writeFile(join(ZIEL, name), await hole(quelle));
    regeln.push(
      `@font-face {\n` +
      `  font-family: '${familie}';\n` +
      `  font-style: normal;\n` +
      `  font-weight: ${gewicht};\n` +
      `  font-display: swap;\n` +
      `  src: url('/schrift/${name}') format('woff2');\n` +
      (bereich ? `  unicode-range: ${bereich};\n` : '') +
      `}`);
    console.log('  geholt', name);
  }
}

await writeFile(join(ZIEL, 'schriften.css'),
  `/* Erzeugt von skripte/schriften-holen.mjs — nicht von Hand ändern.\n` +
  `   Caprasimo und Figtree, SIL Open Font License 1.1. */\n\n` +
  regeln.join('\n\n') + '\n');

await writeFile(join(ZIEL, 'LIZENZ.txt'),
  'Caprasimo und Figtree stehen unter der SIL Open Font License 1.1.\n' +
  'Volltext: https://openfontlicense.org/\n\n' +
  'Die Lizenz erlaubt das Mitliefern der Schriftdateien mit dieser Seite.\n' +
  'Geholt mit skripte/schriften-holen.mjs.\n');

console.log(`\n${regeln.length} Schnitte in public/schrift/, dazu schriften.css und LIZENZ.txt`);
