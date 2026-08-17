/* ZIP — so klein wie nötig, um ein .docx zu schreiben.

   Ein Word-Dokument ist ein ZIP-Archiv mit XML darin. Statt eine Bibliothek
   dafür mitzuschleppen, schreibt die Werkbank das Archiv selbst: Das Format
   ist alt, gut dokumentiert und in achtzig Zeilen erledigt.

   Verdichtet wird mit CompressionStream('deflate-raw'), das jeder aktuelle
   Browser mitbringt. Fehlt es, werden die Einträge ungepackt abgelegt — das
   Ergebnis ist größer, aber genauso gültig. */

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
