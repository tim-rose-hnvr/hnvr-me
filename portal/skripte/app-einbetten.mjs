/* Legt das Studio in public/studio, damit es mit der Seite ausgeliefert
   wird — auf demselben Wix-Hosting wie die Marketingseite.

   Warum kopiert und nicht doppelt im Repository: die Anwendung hat genau eine
   Quelle (../studio). Hier entsteht nur eine Arbeitskopie für den Bau;
   public/studio steht deshalb in .gitignore.

   Das Skript zählt am Ende nach und meldet, was einem Hoster auffallen könnte:
   Dateien über 3 MB und Dateiarten außerhalb der üblichen Liste. Wix nimmt auf
   dem Terminalweg beliebige Bauergebnisse; der Upload-Weg dagegen lehnt
   WebAssembly ab und begrenzt auf 3 MB je Datei und 20 MB gesamt. Wer also
   hochlädt statt zu veröffentlichen, sieht hier vorher, was klemmt.

   Aufruf: über "npm run build" (prebuild), oder von Hand:
     node skripte/app-einbetten.mjs            vollständig
     node skripte/app-einbetten.mjs --schlank  ohne CJK-Zeichentabellen und
                                               ohne englische Sprachdaten

   Für www.hnvr.me selbst (das Studio unter /pdf-studio/, angemeldet über die
   Konsole von hnvr.me statt über den OAuth-Zugang dieser Seite):
     node skripte/app-einbetten.mjs --fuer hnvr --ziel <hnvr.me>/site/public/pdf-studio */

import { cp, rm, mkdir, stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, '..', '..', 'studio');
const wert = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const FUER = wert('--fuer') || 'portal';
const ZIEL = resolve(wert('--ziel') || resolve(HIER, '..', 'public', 'studio'));
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

/* Die Anmeldeschranke wird hier eingesetzt, nicht im Studio selbst.

   Das Studio im Repository bleibt eigenständig: wer sie auf einen eigenen
   Server legt, bekommt sie ohne Anmeldung, und die Prüfläufe fahren gegen die
   ungeschrankte Fassung. Erst die Arbeitskopie bekommt die Zeilen — dort gibt
   es eine Mitgliederverwaltung, die sie beantworten kann.

   Zwei Orte, ein Studio:
   - portal: diese Seite. Angemeldet wird mit dem hnvr.me-Konto über den
     OAuth-Zugang „PDF Studio" (src/hnvr.js); die Auskunft steht hier.
   - hnvr:   www.hnvr.me/pdf-studio/. Dort fragt das Studio dieselbe Route
     wie die Konsole (/api/hub/me) und schickt zu deren Anmeldeseite, die den
     Rücksprung als `ziel` annimmt. Kein zweiter Zugang, kein Domainwechsel.
   Der Kopf „Konsole / PDF Studio" führt in beiden Fällen in die Konsole. */
const ORTE = {
  portal: {
    'studio-anmeldung': '/api/mitglied.json',
    'studio-anmeldung-weg': '/api/hnvr/anmelden',
    'studio-anmeldung-konto': 'hnvr.me',
    'studio-heimat': 'https://www.hnvr.me/konsole',
    'studio-heimat-name': 'Konsole',
  },
  hnvr: {
    'studio-anmeldung': '/api/hub/me',
    'studio-anmeldung-weg': '/konsole/anmelden',
    'studio-anmeldung-ruecksprung': 'ziel',
    'studio-anmeldung-konto': 'hnvr.me',
    'studio-heimat': 'https://www.hnvr.me/konsole',
    'studio-heimat-name': 'Konsole',
  },
};
const ZEILEN = ORTE[FUER];
if (!ZEILEN) {
  console.error(`Unbekannter Ort „${FUER}" — es gibt: ${Object.keys(ORTE).join(', ')}`);
  process.exit(1);
}
try {
  await stat(QUELLE);
} catch {
  console.error(`Das Studio liegt nicht unter ${QUELLE}. Ohne sie fehlt der Seite die Anwendung.`);
  process.exit(1);
}

await rm(ZIEL, { recursive: true, force: true });
await mkdir(dirname(ZIEL), { recursive: true });
await cp(QUELLE, ZIEL, {
  recursive: true,
  filter: (pfad) => !AUSSEN.has(pfad.split('/').pop()),
});

{
  const weg = join(ZIEL, 'index.html');
  const html = await readFile(weg, 'utf8');
  const anker = '<link rel="stylesheet" href="app/stil.css">';
  if (!html.includes(anker)) {
    console.error('index.html des Studios hat die Stilblatt-Zeile nicht mehr — die Schranke ließe sich nicht einsetzen.');
    process.exit(1);
  }
  if (!html.includes('studio-anmeldung')) {
    const meta = Object.entries(ZEILEN).map(([name, inhalt]) => `<meta name="${name}" content="${inhalt}">\n`).join('');
    await writeFile(weg, html.replace(anker, `${meta}${anker}`));
    console.log(`  Anmeldeschranke für „${FUER}" eingesetzt: fragt ${ZEILEN['studio-anmeldung']}, meldet an über ${ZEILEN['studio-anmeldung-weg']}, zurück in die ${ZEILEN['studio-heimat-name']}`);
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

console.log(`PDF Studio eingebettet${SCHLANK ? ' (schlank)' : ''}: ${mb(gesamt)} in ${dateien.length} Dateien`);
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
