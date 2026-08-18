/**
 * Stellt eine Fassung ins eigene Downloadzentrum.
 *
 * Warum eigenes Zentrum: Auf der Website soll keine fremde Adresse stehen.
 * Wer youbooth herunterlädt, lädt von youbooth.me — sonst erklärt der erste
 * Klick dem Betreiber, wo die Software eigentlich wohnt.
 *
 * Warum es nicht geradeheraus geht: Die Medienverwaltung bei Wix nimmt keine
 * `.exe` an — gemessen, nicht vermutet:
 *
 *   UNSUPPORTED_FILE_FORMAT · Unsupported file extension exe
 *
 * `.zip` nimmt sie. Und weil ein ZIP OHNE Verdichtung die Nutzdaten am Stück
 * enthält, liegt das Installationsprogramm darin unverändert ab einem festen
 * Versatz. Die Auslieferung beherrscht Bereichsanfragen (gemessen: 206 und
 * byte-gleich), also kann der Wegweiser der Website genau diesen Bereich
 * durchreichen — und liefert unter
 *
 *   https://youbooth.me/dl/youbooth-Setup-1.0.4.exe
 *
 * dieselben Bytes aus, die der Bau erzeugt hat. Kein Umpacken beim Betreiber,
 * kein Entpacken, keine fremde Adresse.
 *
 *   node tools/downloadzentrum.mjs <installer.exe> <latest.yml>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [datei, ymlDatei] = process.argv.slice(2);
if (!datei) {
  console.error('Aufruf: node tools/downloadzentrum.mjs <installer.exe> [latest.yml]');
  process.exit(1);
}

const MANIFEST = new URL('../wix-server/downloads.mjs', import.meta.url);

/* ---------------------------------------------------------------- */
/* Das ZIP ohne Verdichtung — von Hand, damit der Versatz feststeht   */
/* ---------------------------------------------------------------- */

/**
 * Ein ZIP mit genau einem gespeicherten Eintrag.
 *
 * Von Hand geschrieben statt mit einer Bibliothek: Gebraucht wird nicht das
 * Archiv, sondern die Gewissheit, an welchem Byte die Nutzdaten beginnen. Ein
 * Archivierer darf jederzeit ein Zusatzfeld einfügen und den Versatz
 * verschieben — dann lieferte der Wegweiser Müll aus.
 */
function alsGespeichertesZip(name, inhalt) {
  const namensBytes = Buffer.from(name, 'utf8');
  const pruef = pruefsumme(inhalt);
  const gr = inhalt.length;

  const kopf = Buffer.alloc(30);
  kopf.writeUInt32LE(0x04034b50, 0);   // Kennung lokaler Kopf
  kopf.writeUInt16LE(20, 4);           // benötigte Fassung
  kopf.writeUInt16LE(0, 6);            // keine Merker
  kopf.writeUInt16LE(0, 8);            // 0 = gespeichert, nicht verdichtet
  kopf.writeUInt16LE(0, 10);           // Zeit
  kopf.writeUInt16LE(0x21, 12);        // Datum (fest, damit der Bau reproduzierbar bleibt)
  kopf.writeUInt32LE(pruef, 14);
  kopf.writeUInt32LE(gr, 18);
  kopf.writeUInt32LE(gr, 22);
  kopf.writeUInt16LE(namensBytes.length, 26);
  kopf.writeUInt16LE(0, 28);           // kein Zusatzfeld — genau darum von Hand

  const versatz = kopf.length + namensBytes.length;

  const eintrag = Buffer.alloc(46);
  eintrag.writeUInt32LE(0x02014b50, 0);
  eintrag.writeUInt16LE(20, 4);
  eintrag.writeUInt16LE(20, 6);
  eintrag.writeUInt16LE(0, 8);
  eintrag.writeUInt16LE(0, 10);
  eintrag.writeUInt16LE(0, 12);
  eintrag.writeUInt16LE(0x21, 14);
  eintrag.writeUInt32LE(pruef, 16);
  eintrag.writeUInt32LE(gr, 20);
  eintrag.writeUInt32LE(gr, 24);
  eintrag.writeUInt16LE(namensBytes.length, 28);
  eintrag.writeUInt16LE(0, 30);
  eintrag.writeUInt16LE(0, 32);
  eintrag.writeUInt16LE(0, 34);
  eintrag.writeUInt16LE(0, 36);
  eintrag.writeUInt32LE(0, 38);
  eintrag.writeUInt32LE(0, 42);        // Versatz des lokalen Kopfes

  const ende = Buffer.alloc(22);
  ende.writeUInt32LE(0x06054b50, 0);
  ende.writeUInt16LE(0, 4);
  ende.writeUInt16LE(0, 6);
  ende.writeUInt16LE(1, 8);
  ende.writeUInt16LE(1, 10);
  ende.writeUInt32LE(eintrag.length + namensBytes.length, 12);
  ende.writeUInt32LE(versatz + gr, 16);
  ende.writeUInt16LE(0, 20);

  return {
    zip: Buffer.concat([kopf, namensBytes, inhalt, eintrag, namensBytes, ende]),
    versatz,
  };
}

/** CRC-32, wie das ZIP-Format ihn verlangt. */
function pruefsumme(daten) {
  let tabelle = pruefsumme.tabelle;
  if (!tabelle) {
    tabelle = pruefsumme.tabelle = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tabelle[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < daten.length; i++) c = tabelle[(c ^ daten[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* ---------------------------------------------------------------- */
/* Ablauf                                                            */
/* ---------------------------------------------------------------- */

const name = basename(datei);
const fassung = (name.match(/(\d+\.\d+\.\d+)/) || [])[1];
if (!fassung) {
  console.error(`Aus „${name}" lässt sich keine Fassung lesen.`);
  process.exit(1);
}

const inhalt = readFileSync(datei);
console.log(`${name} · ${(inhalt.length / 1048576).toFixed(1)} MB`);

const { zip, versatz } = alsGespeichertesZip(name, inhalt);
// Gegenprobe, bevor irgendetwas hochgeht: Liegen die Bytes wirklich dort?
if (!zip.subarray(versatz, versatz + inhalt.length).equals(inhalt)) {
  console.error('Der Versatz stimmt nicht — es wird nichts hochgeladen.');
  process.exit(1);
}
console.log(`ZIP ohne Verdichtung · Nutzdaten ab Byte ${versatz}`);

const zipName = name.replace(/\.exe$/, '') + '.zip';
const zipPfad = `/tmp/${zipName}`;
writeFileSync(zipPfad, zip);

console.log('\nZum Hochladen fehlt eine Adresse aus der Medienverwaltung.');
console.log('Diese Datei liegt bereit:', zipPfad);
console.log('Versatz:', versatz, '· Größe:', inhalt.length);
console.log('SHA-512:', createHash('sha512').update(inhalt).digest('base64'));

writeFileSync(
  '/tmp/downloadzentrum-stand.json',
  JSON.stringify({ name, zipName, zipPfad, versatz, groesse: inhalt.length, fassung,
    sha512: createHash('sha512').update(inhalt).digest('base64'),
    yml: ymlDatei ? readFileSync(ymlDatei, 'utf8') : null }, null, 2)
);
console.log('\nStand geschrieben: /tmp/downloadzentrum-stand.json');
