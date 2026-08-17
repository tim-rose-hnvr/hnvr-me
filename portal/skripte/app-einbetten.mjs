/* Legt die Werkbank in public/werkbank, damit sie mit der Seite ausgeliefert
   wird — auf demselben Wix-Hosting wie die Marketingseite.

   Warum kopiert und nicht doppelt im Repository: die Anwendung hat genau eine
   Quelle (../werkbank). Hier entsteht nur eine Arbeitskopie für den Bau;
   public/werkbank steht deshalb in .gitignore.

   Das Skript zählt am Ende nach und meldet, was einem Hoster auffallen könnte:
   Dateien über 3 MB und Dateiarten außerhalb der üblichen Liste. Wix nimmt auf
   dem Terminalweg beliebige Bauergebnisse; der Upload-Weg dagegen lehnt
   WebAssembly ab und begrenzt auf 3 MB je Datei und 20 MB gesamt. Wer also
   hochlädt statt zu veröffentlichen, sieht hier vorher, was klemmt.

   Aufruf: über "npm run build" (prebuild), oder von Hand:
     node skripte/app-einbetten.mjs            vollständig
     node skripte/app-einbetten.mjs --schlank  ohne CJK-Zeichentabellen und
                                               ohne englische Sprachdaten */

import { cp, rm, mkdir, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, '..', '..', 'werkbank');
const ZIEL = resolve(HIER, '..', 'public', 'werkbank');
const SCHLANK = process.argv.includes('--schlank');

/* Prüfläufe und Hilfsskripte gehören zur Entwicklung, nicht auf den Server. */
const AUSSEN = new Set(['werkzeuge', 'node_modules', '.git']);

/* Was beim schlanken Bau wegbleibt — mit den Folgen, die es hat. */
const SCHLANK_WEG = [
  { pfad: 'fremd/cmaps', folge: 'PDFs mit chinesischer, japanischer oder koreanischer Schrift zeigen dann leere Stellen.' },
  { pfad: 'fremd/sprachen/eng.traineddata.gz', folge: 'Texterkennung kann dann nur Deutsch.' },
];

/* Dateiarten, die der Wix-Upload-Weg annimmt. Der Terminalweg ist großzügiger. */
const UPLOAD_ARTEN = new Set([
  '.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.jsx', '.map',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.avif', '.bmp',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.json', '.xml', '.txt', '.md',
]);
const GRENZE_DATEI = 3 * 1024 * 1024;
const GRENZE_GESAMT = 20 * 1024 * 1024;

async function alleDateien(wurzel, gesammelt = []) {
  for (const eintrag of await readdir(wurzel, { withFileTypes: true })) {
    const voll = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) await alleDateien(voll, gesammelt);
    else gesammelt.push({ pfad: voll, groesse: (await stat(voll)).size });
  }
  return gesammelt;
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

try {
  await stat(QUELLE);
} catch {
  console.error(`Die Werkbank liegt nicht unter ${QUELLE}. Ohne sie fehlt der Seite die Anwendung.`);
  process.exit(1);
}

await rm(ZIEL, { recursive: true, force: true });
await mkdir(dirname(ZIEL), { recursive: true });
await cp(QUELLE, ZIEL, {
  recursive: true,
  filter: (pfad) => !AUSSEN.has(pfad.split('/').pop()),
});

/* Die Anmeldeschranke wird hier eingesetzt, nicht in der Werkbank selbst.

   Die Werkbank im Repository bleibt eigenständig: wer sie auf einen eigenen
   Server legt, bekommt sie ohne Anmeldung, und die Prüfläufe fahren gegen die
   ungeschrankte Fassung. Erst die Arbeitskopie, die auf dieser Seite landet,
   bekommt die Zeile — dort gibt es eine Mitgliederverwaltung, die sie
   beantworten kann. */
const AUSKUNFT = '/api/mitglied.json';
{
  const weg = join(ZIEL, 'index.html');
  const html = await readFile(weg, 'utf8');
  if (!html.includes('werkbank-anmeldung')) {
    await writeFile(weg, html.replace('<link rel="stylesheet" href="app/stil.css">',
      `<meta name="werkbank-anmeldung" content="${AUSKUNFT}">\n<link rel="stylesheet" href="app/stil.css">`));
    console.log(`  Anmeldeschranke eingesetzt: fragt ${AUSKUNFT}`);
  }
}

if (SCHLANK) {
  for (const { pfad, folge } of SCHLANK_WEG) {
    await rm(join(ZIEL, pfad), { recursive: true, force: true });
    console.log(`  weggelassen: ${pfad} — ${folge}`);
  }
}

const dateien = await alleDateien(ZIEL);
const gesamt = dateien.reduce((summe, d) => summe + d.groesse, 0);
const groesste = [...dateien].sort((a, b) => b.groesse - a.groesse).slice(0, 3);

console.log(`Werkbank eingebettet${SCHLANK ? ' (schlank)' : ''}: ${mb(gesamt)} in ${dateien.length} Dateien`);
for (const d of groesste) console.log(`  größte: ${relative(ZIEL, d.pfad)} — ${mb(d.groesse)}`);

const zuGross = dateien.filter((d) => d.groesse > GRENZE_DATEI);
const fremdeArten = [...new Set(dateien.filter((d) => !UPLOAD_ARTEN.has(extname(d.pfad))).map((d) => extname(d.pfad) || '(ohne Endung)'))];

if (zuGross.length || fremdeArten.length || gesamt > GRENZE_GESAMT) {
  console.log('  Hinweis für den Wix-Upload-Weg (nicht für "wix release"):');
  if (gesamt > GRENZE_GESAMT) console.log(`    · zusammen über 20 MB (${mb(gesamt)})`);
  for (const d of zuGross) console.log(`    · über 3 MB: ${relative(ZIEL, d.pfad)} (${mb(d.groesse)})`);
  if (fremdeArten.length) console.log(`    · Dateiarten außerhalb der Upload-Liste: ${fremdeArten.join(', ')}`);
  console.log('    Über das Terminal veröffentlicht ("wix release") gilt beides nicht.');
}
