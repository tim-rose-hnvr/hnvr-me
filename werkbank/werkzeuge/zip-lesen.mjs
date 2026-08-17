/* Ein ZIP wieder aufmachen — nur für die Prüfläufe.

   `app/zip.js` schreibt Archive (.docx, .xlsx). Damit ein Prüflauf sagen kann,
   ob darin auch steht, was drinstehen soll, braucht er den Weg zurück. Node
   bringt keinen ZIP-Leser mit; hier steht der kleinste, der für unsere eigenen
   Archive reicht: Zentralverzeichnis lesen, jeden Eintrag entpacken.

   Bewusst nicht in `app/`: die Werkbank selbst muss kein ZIP lesen können. */

import { inflateRawSync } from 'node:zlib';

/**
 * @param {Buffer} puffer Ein ZIP-Archiv
 * @returns {Map<string, string>} Dateiname → Inhalt als UTF-8-Text
 */
export function unzipRoh(puffer) {
  const dateien = new Map();

  /* Das Ende-Verzeichnis steht hinten und trägt die Signatur PK\x05\x06. */
  let ende = -1;
  for (let i = puffer.length - 22; i >= 0; i--) {
    if (puffer.readUInt32LE(i) === 0x06054b50) { ende = i; break; }
  }
  if (ende < 0) throw new Error('Kein ZIP: das Ende-Verzeichnis fehlt.');

  const anzahl = puffer.readUInt16LE(ende + 10);
  let versatz = puffer.readUInt32LE(ende + 16);

  for (let n = 0; n < anzahl; n++) {
    if (puffer.readUInt32LE(versatz) !== 0x02014b50) throw new Error(`Eintrag ${n} hat keine gültige Kennung.`);
    const verfahren = puffer.readUInt16LE(versatz + 10);
    const gepackt = puffer.readUInt32LE(versatz + 20);
    const namensLaenge = puffer.readUInt16LE(versatz + 28);
    const zusatzLaenge = puffer.readUInt16LE(versatz + 30);
    const kommentarLaenge = puffer.readUInt16LE(versatz + 32);
    const kopfVersatz = puffer.readUInt32LE(versatz + 42);
    const name = puffer.toString('utf8', versatz + 46, versatz + 46 + namensLaenge);

    /* Im lokalen Kopf stehen die Feldlängen noch einmal — und sie dürfen von
       denen im Zentralverzeichnis abweichen. */
    const lokalNamensLaenge = puffer.readUInt16LE(kopfVersatz + 26);
    const lokalZusatzLaenge = puffer.readUInt16LE(kopfVersatz + 28);
    const datenStart = kopfVersatz + 30 + lokalNamensLaenge + lokalZusatzLaenge;
    const daten = puffer.subarray(datenStart, datenStart + gepackt);

    dateien.set(name, (verfahren === 8 ? inflateRawSync(daten) : daten).toString('utf8'));
    versatz += 46 + namensLaenge + zusatzLaenge + kommentarLaenge;
  }

  return dateien;
}
