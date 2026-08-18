/**
 * Das Downloadzentrum, gegen den Wegweiser selbst gemessen.
 *
 * Die Datei liegt als ZIP ohne Verdichtung in der Medienverwaltung, und der
 * Wegweiser schneidet das Installationsprogramm daraus heraus. Das ist ein
 * Kunstgriff, und Kunstgriffe gehören geprüft: Ein Byte Versatz daneben, und
 * der Betreiber lädt 101 MB Unsinn herunter, den Windows nicht startet.
 *
 * Geprüft wird deshalb gegen dieselbe Quelle, die später ausliefert:
 *   · Die ersten zwei Bytes sind `MZ` — sonst ist es kein Windows-Programm.
 *   · Ein Stück aus der Mitte stimmt mit derselben Stelle im ZIP überein.
 *   · Das Ende ist wirklich das Ende und nicht der ZIP-Abspann.
 *   · `latest.yml` nennt genau die Fassung, die auch wirklich daliegt.
 *
 *   node tools/dl-probe.mjs            (gegen den Wegweiser hier)
 *   node tools/dl-probe.mjs --live     (gegen https://youbooth.me)
 */

import wegweiser from '../wix-server/entry.mjs';
import { DOWNLOADS } from '../wix-server/downloads.mjs';

const live = process.argv.includes('--live');
const BASIS = 'https://youbooth.me';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

async function hole(pfad, kopf = {}) {
  if (live) return fetch(BASIS + pfad, { headers: kopf });
  return wegweiser.fetch(new Request(BASIS + pfad, { headers: kopf }));
}

const fassung = DOWNLOADS.aktuell;
const w = DOWNLOADS.fassungen[fassung].windows;
console.log(`\nDownloadzentrum · Fassung ${fassung} · ${live ? 'youbooth.me' : 'Wegweiser hier'}\n`);

/* 1 — Der Anfang der Datei. */
console.log('1 · Was ausgeliefert wird, ist ein Windows-Programm');
const anfang = await hole(`/dl/${w.datei}`, { range: 'bytes=0-1023' });
pruefe('Bereichsanfrage wird mit 206 beantwortet', anfang.status === 206, String(anfang.status));
const kopfBytes = Buffer.from(await anfang.arrayBuffer());
pruefe('Die Datei beginnt mit der Kennung MZ', kopfBytes.subarray(0, 2).toString('latin1') === 'MZ',
  kopfBytes.subarray(0, 2).toString('latin1'));
pruefe('Der Ausschnitt ist so lang wie angefordert', kopfBytes.length === 1024, String(kopfBytes.length));
pruefe('Die Gesamtlänge wird richtig genannt',
  anfang.headers.get('content-range') === `bytes 0-1023/${w.groesse}`,
  String(anfang.headers.get('content-range')));

/* 2 — Ein Stück aus der Mitte, gegen die Quelle gehalten. */
console.log('\n2 · Der Versatz stimmt auch mitten in der Datei');
const mitte = Math.floor(w.groesse / 2);
const ausZentrum = Buffer.from(
  await (await hole(`/dl/${w.datei}`, { range: `bytes=${mitte}-${mitte + 4095}` })).arrayBuffer()
);
const ausQuelle = Buffer.from(
  await (
    await fetch(w.quelle, { headers: { range: `bytes=${w.versatz + mitte}-${w.versatz + mitte + 4095}` } })
  ).arrayBuffer()
);
pruefe('4 KB aus der Mitte stimmen mit der Quelle überein', ausZentrum.equals(ausQuelle),
  `${ausZentrum.length} vs ${ausQuelle.length}`);

/* 3 — Das Ende ist das Ende, nicht der ZIP-Abspann. */
console.log('\n3 · Am Ende hängt kein ZIP-Abspann');
const schluss = Buffer.from(
  await (await hole(`/dl/${w.datei}`, { range: `bytes=${w.groesse - 64}-` })).arrayBuffer()
);
pruefe('Die letzten 64 Bytes kommen an', schluss.length === 64, String(schluss.length));
pruefe('Darin steht keine ZIP-Endkennung (PK\\x05\\x06)',
  !schluss.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])));

/* 4 — Die Auskunft für die installierte Box. */
console.log('\n4 · latest.yml zeigt auf das, was daliegt');
const yml = await (await hole('/dl/latest.yml')).text();
pruefe('Nennt die aktuelle Fassung', yml.includes(`version: ${fassung}`), yml.split('\n')[0]);
pruefe('Nennt die Datei', yml.includes(w.datei));
pruefe('Nennt die Prüfsumme', yml.includes(w.sha512));
pruefe('Nennt die Größe', yml.includes(String(w.groesse)));

/* 5 — Was es nicht gibt, gibt es nicht. */
console.log('\n5 · Unbekanntes wird abgewiesen');
const nichts = await hole('/dl/youbooth-Setup-9.9.9.exe');
pruefe('Eine unbekannte Fassung antwortet mit 404', nichts.status === 404, String(nichts.status));

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
