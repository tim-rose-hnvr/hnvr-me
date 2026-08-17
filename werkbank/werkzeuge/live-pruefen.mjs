/* Prüft die veröffentlichte Seite, nicht den Arbeitsplatz.

   Der Unterschied ist der Punkt: örtlich liefert ein Wegwerf-Server die
   Dateien, in der Wirklichkeit ein fremdes Hosting mit eigenen Regeln für
   MIME-Typen, Verzeichnisregister und Zwischenspeicher. Genau dort scheitern
   WebAssembly und Arbeiterprozesse, wenn etwas nicht stimmt.

   Verglichen wird jede einzelne ausgelieferte Datei gegen die gebaute Fassung
   — über die Prüfsumme, nicht über die Größe. Stimmen alle 220 überein, dann
   läuft dort dieselbe Anwendung, die pruefen.mjs und vollpruefung.mjs im
   Browser durchgemessen haben. Zusätzlich geprüft: die MIME-Typen, an denen
   WebAssembly und die gepackten Sprachdaten hängen.

   Aufruf:
     node werkzeuge/live-pruefen.mjs
     node werkzeuge/live-pruefen.mjs https://andere.example
*/

import { createHash } from 'node:crypto';
import { readFile, readdir, stat, rm } from 'node:fs/promises';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const lauf = promisify(execFile);
const HIER = dirname(fileURLToPath(import.meta.url));
const GEBAUT = resolve(HIER, '..', '..', 'portal', 'public', 'werkbank');
const BASIS = (process.argv[2] || 'https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com').replace(/\/$/, '');

/* Die Typen, an denen etwas hängt. Alles andere darf der Hoster nennen, wie er
   mag — nur diese hier entscheiden, ob die Anwendung läuft. */
const NOETIGE_TYPEN = {
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.js': /javascript/,
  '.mjs': /javascript/,
  '.html': /text\/html/,
  '.css': /text\/css/,
};

let gut = 0;
let schlecht = 0;
function pruefe(bedingung, name, zusatz = '') {
  if (bedingung) { gut += 1; console.log(`  ok    ${name}${zusatz ? ` — ${zusatz}` : ''}`); }
  else { schlecht += 1; console.log(`  FEHL  ${name}${zusatz ? ` — ${zusatz}` : ''}`); }
}

/* curl statt fetch: der Weg nach draußen führt hier über einen Proxy, und curl
   ist das einzige Werkzeug in dieser Umgebung, das ihn zuverlässig nimmt. */
let zaehler = 0;
async function hole(weg) {
  /* Der Körper geht in eine Datei, der Zustand über die Standardausgabe: so
     kann kein Trennzeichen im Inhalt die Auswertung verwirren. */
  const ablage = join(tmpdir(), `live-pruefen-${process.pid}-${zaehler++}`);
  try {
    const { stdout } = await lauf('curl', [
      '-sS', '--compressed', '-L', '-o', ablage,
      '-w', '%{http_code} %{content_type}',
      `${BASIS}${weg}`,
    ], { maxBuffer: 1024 * 1024 });
    const [code, ...rest] = stdout.trim().split(' ');
    return { code: Number(code), typ: rest.join(' ').trim(), koerper: await readFile(ablage) };
  } finally {
    await rm(ablage, { force: true });
  }
}

const summe = (puffer) => createHash('sha256').update(puffer).digest('hex');

async function alleDateien(wurzel, gesammelt = []) {
  for (const eintrag of await readdir(wurzel, { withFileTypes: true })) {
    const voll = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) await alleDateien(voll, gesammelt);
    else gesammelt.push(voll);
  }
  return gesammelt;
}

/* ------------------------------------------------------------- Marketingseite */

console.log(`\n== Marketingseite (${BASIS}) ==`);
const start = await hole('/');
const startText = start.koerper.toString('utf8');
pruefe(start.code === 200, 'Startseite antwortet', `HTTP ${start.code}`);
pruefe(/<title>[^<]+<\/title>/.test(startText), 'Startseite hat einen Titel',
  startText.match(/<title>([^<]+)<\/title>/)?.[1]);
pruefe(startText.includes('Werkbank öffnen'), 'Knopf „Werkbank öffnen" steht auf der Seite');
pruefe(/href="\/werkbank\/index\.html"/.test(startText), 'der Knopf zeigt auf die Anwendung');
pruefe(/hnvr\.me/i.test(startText), 'Kontakt hnvr.me digital steht auf der Seite');
pruefe(!/\d+\s*(€|EUR|Euro)\s*(\/|pro)/i.test(startText), 'kein Preis versprochen');

console.log('\n== Wege in die Anwendung ==');
for (const weg of ['/werkbank/index.html', '/werkbank/', '/werkbank']) {
  const antwort = await hole(weg);
  pruefe(antwort.code === 200 && antwort.koerper.toString('utf8').includes('knopf-beispiel'),
    `${weg} liefert die Anwendung`, `HTTP ${antwort.code}`);
}

/* --------------------------------------------------- Jede Datei, Stück für Stück */

console.log('\n== Ausgelieferte Dateien gegen die gebaute Fassung ==');
try {
  await stat(GEBAUT);
} catch {
  console.log(`  FEHL  ${GEBAUT} fehlt — erst "node skripte/app-einbetten.mjs" im Portal laufen lassen.`);
  process.exit(1);
}

const dateien = await alleDateien(GEBAUT);
const abweichend = [];
const fehlend = [];
const falscherTyp = [];
let geprueft = 0;
let bytes = 0;

const reihen = 8;
const stapel = [...dateien];
await Promise.all(Array.from({ length: reihen }, async () => {
  while (stapel.length) {
    const pfad = stapel.pop();
    const weg = `/werkbank/${relative(GEBAUT, pfad).split('\\').join('/')}`;
    const [oertlich, draussen] = await Promise.all([readFile(pfad), hole(weg)]);
    geprueft += 1;
    if (draussen.code !== 200) { fehlend.push(`${weg} (HTTP ${draussen.code})`); continue; }
    if (summe(oertlich) !== summe(draussen.koerper)) {
      abweichend.push(`${weg} (${oertlich.length} B gebaut, ${draussen.koerper.length} B ausgeliefert)`);
      continue;
    }
    bytes += oertlich.length;
    const erwartet = NOETIGE_TYPEN[extname(pfad)];
    if (erwartet) {
      const passt = erwartet instanceof RegExp ? erwartet.test(draussen.typ) : draussen.typ.startsWith(erwartet);
      if (!passt) falscherTyp.push(`${weg} → ${draussen.typ}`);
    }
  }
}));

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
pruefe(fehlend.length === 0, `alle ${dateien.length} Dateien sind erreichbar`,
  fehlend.length ? fehlend.slice(0, 3).join(', ') : `${geprueft} geprüft`);
pruefe(abweichend.length === 0, 'jede Datei kommt Byte für Byte an',
  abweichend.length ? abweichend.slice(0, 3).join(', ') : `${mb(bytes)} verglichen`);
pruefe(falscherTyp.length === 0, 'WebAssembly, Sprachdaten und Skripte tragen den richtigen MIME-Typ',
  falscherTyp.length ? falscherTyp.slice(0, 3).join(', ') : 'application/wasm, application/gzip, javascript');

console.log(`\n${gut} bestanden, ${schlecht} gescheitert.`);
if (!schlecht) {
  console.log('Die ausgelieferten Dateien sind dieselben, die pruefen.mjs und');
  console.log('vollpruefung.mjs im Browser durchgemessen haben.');
}
process.exit(schlecht ? 1 : 0);
