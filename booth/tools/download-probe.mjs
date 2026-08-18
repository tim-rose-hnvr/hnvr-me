/**
 * Das Downloadzentrum — kommt an, was ankommen soll?
 *
 * Diese Probe gibt es, weil genau hier zweimal etwas stillschweigend
 * auseinandergelaufen ist: Einmal zeigte die Seite auf eine Release, die es
 * nicht gab (404), einmal lagen zwei Releases zum selben Tag und die Adresse
 * wurde mehrdeutig. Beide Male sah alles grün aus — der Bau lief durch, die
 * Seite baute, und erst jemand mit einem Windows-Rechner merkte es.
 *
 * Geprüft wird die ganze Kette:
 *   1. `latest.yml` ist erreichbar und nennt die Fassung aus package.json.
 *   2. Das Downloadzentrum kennt diese Fassung.
 *   3. Die Adresse liefert ein echtes Windows-Programm (MZ), nicht eine
 *      Fehlerseite mit Status 200.
 *   4. Größe und Prüfsumme stimmen mit `latest.yml` überein — sonst lädt
 *      eine installierte Box etwas herunter, das sie danach verwirft.
 *
 * Der vierte Punkt lädt 106 MB und läuft deshalb nur auf Zuruf:
 *
 *   node tools/download-probe.mjs          (Kopf und Größe)
 *   node tools/download-probe.mjs --voll   (ganze Datei mit Prüfsumme)
 */

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BASIS = process.env.YOUBOOTH_SEITE_LIVE || 'https://youbooth.me';
const VOLL = process.argv.includes('--voll');

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const fassung = require('../package.json').version;
console.log(`\nGeprüft wird Fassung ${fassung} auf ${BASIS}\n`);

/* 1 — Der Feed, den jede installierte Box abfragt. */
console.log('1 · latest.yml');
let feed = null;
try {
  const antwort = await fetch(`${BASIS}/dl/latest.yml`, { redirect: 'follow' });
  pruefe('Erreichbar', antwort.ok, String(antwort.status));
  const text = await antwort.text();
  feed = {
    version: (text.match(/^version:\s*(.+)$/m) || [])[1]?.trim(),
    datei: (text.match(/^path:\s*(.+)$/m) || [])[1]?.trim(),
    groesse: Number((text.match(/^\s+size:\s*(\d+)$/m) || [])[1]),
    sha512: (text.match(/^sha512:\s*(.+)$/m) || [])[1]?.trim(),
  };
} catch (e) {
  pruefe('Erreichbar', false, e.message);
}

if (!feed?.version) {
  console.log('\nOhne latest.yml lässt sich der Rest nicht prüfen.\n');
  process.exit(1);
}

pruefe('Nennt dieselbe Fassung wie package.json', feed.version === fassung,
  `${feed.version} gegen ${fassung}`);
pruefe('Nennt eine Datei', !!feed.datei, feed.datei);
pruefe('Nennt eine Größe', feed.groesse > 1_000_000, String(feed.groesse));
pruefe('Nennt eine Prüfsumme', (feed.sha512 || '').length > 40);

/* 2 — Das Downloadzentrum der Website. */
console.log('\n2 · Das Downloadzentrum');
const { DOWNLOADS } = await import('../../youbooth/wix-server/downloads.mjs');
pruefe('Führt dieselbe Fassung als aktuell', DOWNLOADS.aktuell === fassung,
  `${DOWNLOADS.aktuell} gegen ${fassung}`);
const eintrag = DOWNLOADS.fassungen[fassung];
pruefe('Hat einen Eintrag dafür', !!eintrag);
pruefe('Mit derselben Größe wie der Feed', eintrag?.windows?.groesse === feed.groesse,
  `${eintrag?.windows?.groesse} gegen ${feed.groesse}`);
pruefe('Mit derselben Prüfsumme wie der Feed', eintrag?.windows?.sha512 === feed.sha512);

/* 3 — Was wirklich herauskommt. */
console.log('\n3 · Die Datei selbst');
const adresse = `${BASIS}/dl/${feed.datei}`;
try {
  const kopf = await fetch(adresse, { headers: { Range: 'bytes=0-1023' }, redirect: 'follow' });
  pruefe('Der Teilabruf wird beantwortet', kopf.status === 206 || kopf.status === 200,
    String(kopf.status));
  const anfang = Buffer.from(await kopf.arrayBuffer());
  /* „MZ" steht am Anfang jedes Windows-Programms. Ohne diese Prüfung sieht
     eine HTML-Fehlerseite mit Status 200 aus wie ein erfolgreicher Download —
     bis jemand doppelklickt. */
  pruefe('Es beginnt mit MZ, ist also ein Windows-Programm',
    anfang.slice(0, 2).toString() === 'MZ', anfang.slice(0, 16).toString('hex'));
} catch (e) {
  pruefe('Der Teilabruf wird beantwortet', false, e.message);
}

if (VOLL) {
  console.log('\n4 · Ganz herunterladen und nachrechnen');
  const antwort = await fetch(adresse, { redirect: 'follow' });
  const daten = Buffer.from(await antwort.arrayBuffer());
  pruefe('Die Größe stimmt auf das Byte', daten.length === feed.groesse,
    `${daten.length} gegen ${feed.groesse}`);
  const summe = createHash('sha512').update(daten).digest('base64');
  pruefe('Die Prüfsumme stimmt', summe === feed.sha512, summe);
  console.log('  (Ohne diese Übereinstimmung lädt eine installierte Box die Datei');
  console.log('   herunter und verwirft sie danach — sichtbar wird das erst dort.)');
} else {
  console.log('\n4 · Ganz herunterladen: übersprungen (mit --voll)');
}

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
