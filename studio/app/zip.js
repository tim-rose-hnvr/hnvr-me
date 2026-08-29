/* ZIP — so klein wie nötig, um ein .docx zu schreiben und wieder zu lesen.

   Ein Word-Dokument ist ein ZIP-Archiv mit XML darin. Statt eine Bibliothek
   dafür mitzuschleppen, schreibt das Studio das Archiv selbst: Das Format
   ist alt, gut dokumentiert und in achtzig Zeilen erledigt. Seit das Studio
   auch Word- und Excel-Dateien *einliest*, steht der Weg zurück daneben.

   Verdichtet wird mit CompressionStream('deflate-raw'), gelesen mit
   DecompressionStream('deflate-raw') — beides bringt jeder aktuelle Browser
   mit. Fehlt das Verdichten, werden die Einträge ungepackt abgelegt; das
   Ergebnis ist größer, aber genauso gültig. Fehlt das Entpacken, lässt sich
   ein gepacktes Archiv nicht lesen, und das sagt das Studio dann auch. */

const TEXT = new TextEncoder();

/* CRC-32, Tabelle einmalig aufgebaut. */
const TAFEL = (() => {
  const tafel = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let wert = i;
    for (let k = 0; k < 8; k++) wert = wert & 1 ? 0xEDB88320 ^ (wert >>> 1) : wert >>> 1;
    tafel[i] = wert >>> 0;
  }
  return tafel;
})();

export function crc32(daten) {
  let wert = 0xFFFFFFFF;
  for (let i = 0; i < daten.length; i++) wert = TAFEL[(wert ^ daten[i]) & 0xFF] ^ (wert >>> 8);
  return (wert ^ 0xFFFFFFFF) >>> 0;
}

async function verdichte(daten) {
  if (typeof CompressionStream !== 'function') return null;
  try {
    const strom = new Blob([daten]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(strom).arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Schreibt ein ZIP-Archiv.
 * @param {{name: string, daten: string|Uint8Array}[]} eintraege
 * @returns {Promise<Uint8Array>}
 */
export async function schreibeZip(eintraege) {
  const stuecke = [];
  const verzeichnis = [];
  let versatz = 0;

  for (const eintrag of eintraege) {
    const roh = typeof eintrag.daten === 'string' ? TEXT.encode(eintrag.daten) : eintrag.daten;
    const name = TEXT.encode(eintrag.name);
    const gepackt = await verdichte(roh);
    const inhalt = gepackt && gepackt.length < roh.length ? gepackt : roh;
    const verfahren = inhalt === gepackt ? 8 : 0;     // 8 = deflate, 0 = ungepackt
    const pruefsumme = crc32(roh);

    const kopf = new DataView(new ArrayBuffer(30));
    kopf.setUint32(0, 0x04034B50, true);   // Signatur
    kopf.setUint16(4, 20, true);           // benötigte Fassung
    kopf.setUint16(6, 0x0800, true);       // Kennzeichen: Name ist UTF-8
    kopf.setUint16(8, verfahren, true);
    kopf.setUint16(10, 0, true);           // Uhrzeit — bewusst fest
    kopf.setUint16(12, 0x21, true);        // Datum: 1. Januar 1980
    kopf.setUint32(14, pruefsumme, true);
    kopf.setUint32(18, inhalt.length, true);
    kopf.setUint32(22, roh.length, true);
    kopf.setUint16(26, name.length, true);
    kopf.setUint16(28, 0, true);

    stuecke.push(new Uint8Array(kopf.buffer), name, inhalt);

    const eintragImVerzeichnis = new DataView(new ArrayBuffer(46));
    eintragImVerzeichnis.setUint32(0, 0x02014B50, true);
    eintragImVerzeichnis.setUint16(4, 20, true);
    eintragImVerzeichnis.setUint16(6, 20, true);
    eintragImVerzeichnis.setUint16(8, 0x0800, true);
    eintragImVerzeichnis.setUint16(10, verfahren, true);
    eintragImVerzeichnis.setUint16(12, 0, true);
    eintragImVerzeichnis.setUint16(14, 0x21, true);
    eintragImVerzeichnis.setUint32(16, pruefsumme, true);
    eintragImVerzeichnis.setUint32(20, inhalt.length, true);
    eintragImVerzeichnis.setUint32(24, roh.length, true);
    eintragImVerzeichnis.setUint16(28, name.length, true);
    eintragImVerzeichnis.setUint32(42, versatz, true);
    verzeichnis.push(new Uint8Array(eintragImVerzeichnis.buffer), name);

    versatz += 30 + name.length + inhalt.length;
  }

  const verzeichnisLaenge = verzeichnis.reduce((summe, teil) => summe + teil.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054B50, true);
  ende.setUint16(8, eintraege.length, true);
  ende.setUint16(10, eintraege.length, true);
  ende.setUint32(12, verzeichnisLaenge, true);
  ende.setUint32(16, versatz, true);

  const alle = [...stuecke, ...verzeichnis, new Uint8Array(ende.buffer)];
  const gesamt = alle.reduce((summe, teil) => summe + teil.length, 0);
  const ergebnis = new Uint8Array(gesamt);
  let stelle = 0;
  for (const teil of alle) { ergebnis.set(teil, stelle); stelle += teil.length; }
  return ergebnis;
}

/* ---------- Lesen ---------------------------------------------------------- */

async function entpacke(daten) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Dieser Browser kann gepackte Archive nicht entpacken.');
  }
  const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(strom).arrayBuffer());
}

/**
 * Liest ein ZIP-Archiv über sein Zentralverzeichnis.
 *
 * Gelesen wird von hinten: das Ende-Verzeichnis (Signatur PK\x05\x06) nennt,
 * wo die Einträge stehen. Der Weg über die lokalen Köpfe wäre kürzer, aber
 * unzuverlässig — bei gestreamt geschriebenen Archiven stehen dort Nullen und
 * die wahren Längen erst hinter den Daten.
 *
 * @param {Uint8Array} bytes
 * @returns {Promise<Map<string, Uint8Array>>} Pfad im Archiv → Inhalt
 */
export async function liesZip(bytes) {
  const sicht = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let ende = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (sicht.getUint32(i, true) === 0x06054B50) { ende = i; break; }
  }
  if (ende < 0) throw new Error('Das ist kein ZIP-Archiv — das Ende-Verzeichnis fehlt.');

  const anzahl = sicht.getUint16(ende + 10, true);
  let versatz = sicht.getUint32(ende + 16, true);
  const dateien = new Map();

  for (let n = 0; n < anzahl; n++) {
    if (versatz + 46 > bytes.length || sicht.getUint32(versatz, true) !== 0x02014B50) {
      throw new Error(`Eintrag ${n + 1} im Archiv ist beschädigt.`);
    }
    const verfahren = sicht.getUint16(versatz + 10, true);
    const gepackteLaenge = sicht.getUint32(versatz + 20, true);
    const namensLaenge = sicht.getUint16(versatz + 28, true);
    const zusatzLaenge = sicht.getUint16(versatz + 30, true);
    const kommentarLaenge = sicht.getUint16(versatz + 32, true);
    const kopfVersatz = sicht.getUint32(versatz + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(versatz + 46, versatz + 46 + namensLaenge));

    /* Im lokalen Kopf stehen die Feldlängen noch einmal — und sie dürfen von
       denen im Zentralverzeichnis abweichen. */
    const lokalName = sicht.getUint16(kopfVersatz + 26, true);
    const lokalZusatz = sicht.getUint16(kopfVersatz + 28, true);
    const start = kopfVersatz + 30 + lokalName + lokalZusatz;
    const roh = bytes.subarray(start, start + gepackteLaenge);

    if (!name.endsWith('/')) {
      dateien.set(name, verfahren === 8 ? await entpacke(roh) : roh.slice(0));
    }
    versatz += 46 + namensLaenge + zusatzLaenge + kommentarLaenge;
  }
  return dateien;
}

/** Ein Eintrag als Text. Fehlt er, kommt eine leere Zeichenkette zurück. */
export function alsText(dateien, name) {
  const daten = dateien.get(name);
  return daten ? new TextDecoder().decode(daten) : '';
}
