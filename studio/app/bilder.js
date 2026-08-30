/* Bilder im PDF — finden, ersetzen, entfernen.

   „PDF bearbeiten" hieß im Studio bisher: Text. Bilder standen da und blieben
   stehen. Das ist die letzte große Lücke gegenüber Acrobat — und sie lässt
   sich schließen, ohne den halben PDF-Zeichner nachzubauen.

   **Der Trick ist, nichts zu verschieben.** Ein Bild wird im Seitenstrom über
   seinen Namen gezeichnet: `/Bild3 Do`, davor eine Matrix, die Lage und Größe
   festlegt. Wer den Eintrag `/Bild3` im Mittelverzeichnis auf ein anderes Bild
   zeigen lässt, tauscht das Bild aus, ohne den Strom anzufassen — Lage, Größe
   und Drehung bleiben, wie sie waren.

   **Entfernen heißt hier unsichtbar machen**, nicht löschen: der Eintrag wird
   auf ein einzelnes weißes Bildpunkt gesetzt. Den Namen aus dem Verzeichnis zu
   streichen wäre sauberer und geht schief — der Strom ruft ihn weiter auf, und
   manche Betrachter brechen dann die ganze Seite ab.

   **Was das nicht kann:** ein Bild verschieben oder anders zuschneiden. Dafür
   müsste die Matrix im Seitenstrom geändert werden, und der Strom ist ein
   Wust aus Zuständen, in den man nicht einfach hineinschreibt. Das steht im
   Dialog, damit niemand es erwartet. */

import { zustand } from './kern.js';

/** Ein weißer Bildpunkt — das Ersatzbild fürs Entfernen. */
const WEISSER_PUNKT = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
), (z) => z.charCodeAt(0));

/**
 * Sucht die Bilder je Seite.
 * @returns {Promise<Array<{seite:number, name:string, breite:number, hoehe:number,
 *   art:string, dpi:number, bytes:Uint8Array|null}>>}
 */
export async function bilderImDokument() {
  const { starteSchreiber } = await import('./ausgabe.js');
  const pdflib = await starteSchreiber();
  const { PDFName, PDFDict, PDFRawStream } = pdflib;
  const quelle = [...zustand.quellen.values()][0];
  if (!quelle?.bytes) return [];

  const roh = await pdflib.PDFDocument.load(quelle.bytes.slice(0), { ignoreEncryption: true });
  const gefunden = [];
  const alsDict = (wert) => {
    const auf = wert && roh.context.lookup(wert);
    return auf instanceof PDFDict ? auf : null;
  };
  const text = (wert) => String(wert ?? '').replace(/^\//, '');

  for (const [nummer, blatt] of roh.getPages().entries()) {
    const mittel = blatt.node.Resources?.() || alsDict(blatt.node.get(PDFName.of('Resources')));
    const gegenstaende = mittel && alsDict(mittel.get(PDFName.of('XObject')));
    if (!gegenstaende) continue;

    for (const [schluessel, ref] of gegenstaende.entries()) {
      const gegenstand = roh.context.lookup(ref);
      if (!(gegenstand instanceof PDFRawStream)) continue;
      const teil = gegenstand.dict;
      if (text(teil.get(PDFName.of('Subtype'))) !== 'Image') continue;

      const breite = teil.get(PDFName.of('Width'))?.asNumber?.() || 0;
      const hoehe = teil.get(PDFName.of('Height'))?.asNumber?.() || 0;
      if (!breite || !hoehe) continue;

      const filter = teil.get(PDFName.of('Filter'));
      const art = text(filter?.asString?.() ?? filter?.get?.(0)?.asString?.() ?? '');

      gefunden.push({
        seite: nummer + 1,
        name: text(schluessel),
        breite,
        hoehe,
        art,
        dpi: Math.round((breite / (blatt.getWidth() || 595)) * 72),
        /* Nur ein JPEG lässt sich unverändert anzeigen — sein Strom **ist**
           die Datei. Alles andere müsste erst entpackt und in ein Bild
           umgerechnet werden; dafür steht im Dialog das Maß statt einer
           Vorschau. Lieber kein Bild als ein falsches. */
        bytes: art === 'DCTDecode' ? gegenstand.contents : null,
      });
    }
  }
  return gefunden;
}

/**
 * Tauscht Bilder aus. Wird beim Sichern angewandt.
 * @param {object} ziel geladenes pdf-lib-Dokument
 * @param {object} pdflib
 * @param {Array<{seite:number, name:string, ersatz:Uint8Array|null, entfernen:boolean}>} auftraege
 */
export async function tauscheBilder(ziel, pdflib, auftraege) {
  if (!auftraege?.length) return 0;
  const { PDFName, PDFDict } = pdflib;
  const seiten = ziel.getPages();
  let getauscht = 0;

  const alsDict = (wert) => {
    const auf = wert && ziel.context.lookup(wert);
    return auf instanceof PDFDict ? auf : null;
  };

  for (const auftrag of auftraege) {
    const blatt = seiten[auftrag.seite - 1];
    if (!blatt) continue;
    const mittel = blatt.node.Resources?.() || alsDict(blatt.node.get(PDFName.of('Resources')));
    const gegenstaende = mittel && alsDict(mittel.get(PDFName.of('XObject')));
    if (!gegenstaende) continue;

    const bytes = auftrag.entfernen ? WEISSER_PUNKT : auftrag.ersatz;
    if (!bytes) continue;
    /* PNG oder JPEG: die ersten Bytes sagen es. Raten wäre hier teuer —
       ein falsch eingebettetes Bild macht die Seite unlesbar. */
    const istPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const bild = istPng ? await ziel.embedPng(bytes) : await ziel.embedJpg(bytes);
    gegenstaende.set(PDFName.of(auftrag.name), bild.ref);
    getauscht += 1;
  }
  return getauscht;
}

/** Was beim nächsten Sichern getauscht wird. */
export function bildauftraege() { return zustand.bildauftraege || []; }

export function setzeBildauftrag(auftrag) {
  const rest = bildauftraege().filter((a) => !(a.seite === auftrag.seite && a.name === auftrag.name));
  zustand.bildauftraege = auftrag.zuruecknehmen ? rest : [...rest, auftrag];
  zustand.geaendert = true;
}
