/**
 * Packung — ein ganzes Profil in eine Adresse.
 *
 * Die Werkstatt zeigt die Vorschau in einem Rahmen, der die echte Seite lädt.
 * Damit dort der ungespeicherte Entwurf steht und nicht das veröffentlichte
 * Profil, muss der Entwurf mit — und zwar durch eine Adresszeile.
 *
 * Roh als JSON wären das rund 3 kB, nach dem Kodieren gut 4 kB. Das
 * funktioniert meistens und scheitert genau dann, wenn ein Zwischenserver bei
 * 8 kB abschneidet. Deshalb wird gepresst: aus 3 kB werden etwa 900 Byte.
 *
 * Zwei Nebenwirkungen, die beide erwünscht sind:
 *
 *  - Ein Entwurf ist verschickbar. „Schau mal, so sähe deine Seite aus" ist
 *    ein Link, kein Konto.
 *  - Es geht nichts an einen Server, was nicht ohnehin in der Adresse steht.
 *
 * `CompressionStream` gibt es in Node ab 18 und in Safari ab 16.4. Wo es fehlt,
 * wird ungepresst gepackt statt zu scheitern — das Kennzeichen am Anfang sagt,
 * was vorliegt.
 */

const GEPRESST = 'z';
const ROH = 'r';

const kodierer = new TextEncoder();
const dekodierer = new TextDecoder();

function kannPressen(): boolean {
  return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
}

async function durch(daten: Uint8Array, strom: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const antwort = new Response(new Blob([daten as BlobPart]).stream().pipeThrough(strom as ReadableWritablePair));
  return new Uint8Array(await antwort.arrayBuffer());
}

/** Bytes → base64url, ohne Füllzeichen. In Node und im Browser gleichermaßen. */
function alsText(bytes: Uint8Array): string {
  let roh = '';
  // Blockweise, weil `String.fromCharCode(...tausende)` den Stapel sprengt.
  for (let i = 0; i < bytes.length; i += 8192) {
    roh += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(roh).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function alsBytes(text: string): Uint8Array {
  const roh = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

/** Packt einen beliebigen Datensatz in eine Zeichenkette für die Adresszeile. */
export async function packe(wert: unknown): Promise<string> {
  const bytes = kodierer.encode(JSON.stringify(wert));
  if (!kannPressen()) return ROH + alsText(bytes);
  return GEPRESST + alsText(await durch(bytes, new CompressionStream('deflate-raw')));
}

/**
 * Packt wieder aus. Gibt `null` zurück, wenn die Zeichenkette beschädigt ist —
 * eine halb geladene Adresse darf die Werkstatt nicht zerlegen.
 */
export async function entpacke(text: string): Promise<unknown> {
  if (!text) return null;
  const kennzeichen = text[0];
  const rest = text.slice(1);

  try {
    if (kennzeichen === ROH) return JSON.parse(dekodierer.decode(alsBytes(rest)));
    if (kennzeichen === GEPRESST) {
      if (!kannPressen()) return null;
      const bytes = await durch(alsBytes(rest), new DecompressionStream('deflate-raw'));
      return JSON.parse(dekodierer.decode(bytes));
    }
    return null;
  } catch {
    return null;
  }
}
