/**
 * Vermessung → PDF/X-4.
 *
 * ## Warum nicht Ghostscript
 *
 * Der übliche Weg wäre: RGB-PDF erzeugen und mit Ghostscript nach PDF/X-CMYK
 * wandeln. Ghostscript steht unter AGPL — für ein Produkt, das verkauft wird,
 * braucht das eine kommerzielle Lizenz. Dasselbe gilt für MuPDF. Damit wäre die
 * Lizenz nur verschoben, nicht abgeschafft.
 *
 * Deshalb wird hier **direkt in CMYK geschrieben** und nie nachträglich
 * konvertiert. Der ganze Stapel ist MIT: pdf-lib, fontkit, und der Browser.
 *
 * ## Was PDF/X-4 verlangt
 *
 * - **OutputIntent** mit `/S /GTS_PDFX`, dazu entweder ein eingebettetes
 *   ICC-Profil in `/DestOutputProfile` oder eine registrierte Druckbedingung
 * - **TrimBox** und **BleedBox** auf jeder Seite, damit die Druckerei weiß, wo
 *   geschnitten wird
 * - **XMP-Metadaten** mit `pdfxid:GTS_PDFXVersion`
 * - **Alle Schriften eingebettet**
 * - Keine geräteabhängigen Farben außerhalb des Ausgabefarbraums
 */

import fontkit from '@pdf-lib/fontkit';
import type { Entwurf } from '@studio/editor-core';
import {
  cmyk,
  degrees,
  PDFArray,
  PDFDocument,
  type PDFFont,
  PDFHexString,
  PDFName,
  type PDFPage,
  PDFRawStream,
  PDFString,
} from 'pdf-lib';
import { hexZuCmyk } from './farbe.js';
import type { Messung } from './vermessung.js';

/** Wandelt Dokumentpixel in PDF-Punkte. Die einzige Umrechnungsstelle. */
export function pxZuPunkt(px: number, dpi: number): number {
  return (px / dpi) * 72;
}

export interface Druckbedingung {
  /** Registrierte Kennung, etwa `FOGRA39` oder `CGATS TR 001`. */
  kennung: string;
  /** Klartext für die Druckerei. */
  beschreibung: string;
  registrierung: string;
  /** ICC-Profil als Rohdaten. Fehlt es, wird nur die Kennung eingetragen. */
  iccProfil?: Uint8Array;
  /** Farbkanäle des Profils. 4 für CMYK. */
  kanaele?: number;
}

/** Übliche europäische Druckbedingung für gestrichenes Papier. */
export const FOGRA39: Druckbedingung = {
  kennung: 'FOGRA39',
  beschreibung: 'Offset commercial and specialty printing, ISO 12647-2:2004/Amd 1, paper type 1/2',
  registrierung: 'http://www.color.org',
};

export interface SchriftEinbettung {
  familie: string;
  gewicht: number;
  kursiv: boolean;
  daten: Uint8Array;
}

export interface PdfOptionen {
  entwurf: Entwurf;
  messung: Messung;
  schriften: readonly SchriftEinbettung[];
  druckbedingung?: Druckbedingung;
  /** Schnittmarken an den Ecken zeichnen. */
  schnittmarken?: boolean;
  titel?: string;
}

function schriftSchluessel(familie: string, gewicht: number, kursiv: boolean): string {
  return `${familie.toLowerCase()}|${gewicht}|${kursiv ? 'i' : 'n'}`;
}

/**
 * Schnittmarken liegen **im Anschnitt**, nie im Endformat — sonst druckt man
 * sie mit. Sie zeigen die Ecken des Endformats an und lassen dazwischen Luft.
 */
function zeichneSchnittmarken(
  seite: PDFPage,
  anschnitt: { oben: number; rechts: number; unten: number; links: number },
  trim: { x: number; y: number; breite: number; hoehe: number },
): void {
  const laenge = Math.min(anschnitt.links, anschnitt.oben, anschnitt.rechts, anschnitt.unten) * 0.8;
  if (laenge <= 0) return;

  const abstand = laenge * 0.25;
  const farbe = cmyk(0, 0, 0, 1);
  const staerke = 0.25;

  const striche: { x: number; y: number; b: number; h: number }[] = [];
  const ecken = [
    { x: trim.x, y: trim.y, sx: -1, sy: -1 },
    { x: trim.x + trim.breite, y: trim.y, sx: 1, sy: -1 },
    { x: trim.x, y: trim.y + trim.hoehe, sx: -1, sy: 1 },
    { x: trim.x + trim.breite, y: trim.y + trim.hoehe, sx: 1, sy: 1 },
  ];

  for (const ecke of ecken) {
    // Waagerecht nach außen …
    striche.push({
      x: ecke.sx < 0 ? ecke.x - abstand - laenge : ecke.x + abstand,
      y: ecke.y,
      b: laenge,
      h: 0,
    });
    // … und senkrecht nach außen.
    striche.push({
      x: ecke.x,
      y: ecke.sy < 0 ? ecke.y - abstand - laenge : ecke.y + abstand,
      b: 0,
      h: laenge,
    });
  }

  for (const s of striche) {
    seite.drawLine({
      start: { x: s.x, y: s.y },
      end: { x: s.x + s.b, y: s.y + s.h },
      thickness: staerke,
      color: farbe,
    });
  }
}

function xmpMetadaten(titel: string): string {
  // PDF/X-4 verlangt die Kennzeichnung in XMP, nicht im Info-Wörterbuch.
  // Bewusst ohne Zeitstempel: das Ergebnis soll bei gleicher Eingabe
  // byte-gleich sein, sonst lässt es sich nicht vergleichen.
  return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:pdf="http://ns.adobe.com/pdf/1.3/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/"
        xmlns:pdfxid="http://www.npes.org/pdfx/ns/id/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${titel}</rdf:li></rdf:Alt></dc:title>
      <pdf:Trapped>False</pdf:Trapped>
      <xmp:CreatorTool>Design Studio Spike</xmp:CreatorTool>
      <pdfxid:GTS_PDFXVersion>PDF/X-4</pdfxid:GTS_PDFXVersion>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function erzeugePdfX(optionen: PdfOptionen): Promise<Uint8Array> {
  const { entwurf, messung } = optionen;
  const dpi = entwurf.masse.dpi;
  const bedingung = optionen.druckbedingung ?? FOGRA39;
  const titel = optionen.titel ?? entwurf.name;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // PDF/X-4 setzt PDF 1.6 voraus.
  const punkt = (px: number): number => pxZuPunkt(px, dpi);

  const eingebettet = new Map<string, PDFFont>();
  for (const schrift of optionen.schriften) {
    const font = await pdf.embedFont(schrift.daten, { subset: true });
    eingebettet.set(schriftSchluessel(schrift.familie, schrift.gewicht, schrift.kursiv), font);
  }
  if (eingebettet.size === 0) {
    throw new Error('PDF/X verlangt eingebettete Schriften — es wurde keine übergeben');
  }

  const blattBreite = punkt(messung.blattBreite);
  const blattHoehe = punkt(messung.blattHoehe);
  const seite = pdf.addPage([blattBreite, blattHoehe]);

  /** HTML-Koordinate (y nach unten) → PDF-Koordinate (y nach oben). */
  const nachOben = (yPx: number): number => blattHoehe - punkt(yPx);

  for (const flaeche of messung.flaechen) {
    const x = punkt(flaeche.x);
    const breite = punkt(flaeche.breite);
    const hoehe = punkt(flaeche.hoehe);
    const y = nachOben(flaeche.y) - hoehe;

    if (flaeche.fuellung !== null) {
      const f = hexZuCmyk(flaeche.fuellung);
      seite.drawRectangle({
        x,
        y,
        width: breite,
        height: hoehe,
        color: cmyk(f.c, f.m, f.y, f.k),
        rotate: degrees(-flaeche.drehung),
      });
    }

    if (flaeche.kontur !== null && flaeche.kontur.staerke > 0) {
      const k = hexZuCmyk(flaeche.kontur.farbe);
      const staerke = punkt(flaeche.kontur.staerke);
      seite.drawRectangle({
        x: x + staerke / 2,
        y: y + staerke / 2,
        width: breite - staerke,
        height: hoehe - staerke,
        borderColor: cmyk(k.c, k.m, k.y, k.k),
        borderWidth: staerke,
        rotate: degrees(-flaeche.drehung),
      });
    }
  }

  for (const lauf of messung.texte) {
    const font = eingebettet.get(
      schriftSchluessel(lauf.schriftFamilie, lauf.schriftStaerke, lauf.kursiv),
    );
    if (font === undefined) {
      throw new Error(
        `Für "${lauf.schriftFamilie}" ${lauf.schriftStaerke}${lauf.kursiv ? ' kursiv' : ''} wurde keine Schrift eingebettet. ` +
          'PDF/X erlaubt keine Ersatzschriften.',
      );
    }

    const f = hexZuCmyk(lauf.farbe);
    const farbe = cmyk(f.c, f.m, f.y, f.k);
    const groesse = punkt(lauf.schriftGroesse);

    for (const glyphe of lauf.glyphen) {
      if (glyphe.zeichen.trim() === '') continue;
      seite.drawText(glyphe.zeichen, {
        x: punkt(glyphe.x),
        y: nachOben(glyphe.y),
        size: groesse,
        font,
        color: farbe,
      });
    }
  }

  const trim = {
    x: punkt(entwurf.anschnitt.links),
    y: punkt(entwurf.anschnitt.unten),
    breite: punkt(entwurf.masse.breite),
    hoehe: punkt(entwurf.masse.hoehe),
  };

  if (optionen.schnittmarken === true) {
    zeichneSchnittmarken(seite, entwurf.anschnitt, trim);
  }

  // TrimBox und BleedBox: ohne sie weiß die Druckerei nicht, wo geschnitten
  // wird, und PDF/X ist ungültig. Die MediaBox umfasst den Anschnitt.
  const kasten = (x: number, y: number, b: number, h: number): PDFArray => {
    const arr = PDFArray.withContext(pdf.context);
    for (const wert of [x, y, x + b, y + h]) arr.push(pdf.context.obj(wert));
    return arr;
  };

  seite.node.set(PDFName.of('TrimBox'), kasten(trim.x, trim.y, trim.breite, trim.hoehe));
  seite.node.set(PDFName.of('BleedBox'), kasten(0, 0, blattBreite, blattHoehe));
  seite.node.set(PDFName.of('MediaBox'), kasten(0, 0, blattBreite, blattHoehe));

  // OutputIntent — das Kennzeichen von PDF/X.
  const absicht = pdf.context.obj({
    Type: PDFName.of('OutputIntent'),
    S: PDFName.of('GTS_PDFX'),
    OutputConditionIdentifier: PDFString.of(bedingung.kennung),
    OutputCondition: PDFString.of(bedingung.beschreibung),
    Info: PDFString.of(bedingung.beschreibung),
    RegistryName: PDFString.of(bedingung.registrierung),
  });

  if (bedingung.iccProfil !== undefined) {
    const profil = PDFRawStream.of(
      pdf.context.obj({ N: bedingung.kanaele ?? 4 }),
      bedingung.iccProfil,
    );
    absicht.set(PDFName.of('DestOutputProfile'), pdf.context.register(profil));
  }

  const absichten = PDFArray.withContext(pdf.context);
  absichten.push(pdf.context.register(absicht));
  pdf.catalog.set(PDFName.of('OutputIntents'), absichten);

  // XMP mit der PDF/X-Kennzeichnung.
  const xmp = PDFRawStream.of(
    pdf.context.obj({ Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') }),
    new TextEncoder().encode(xmpMetadaten(titel)),
  );
  pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(xmp));

  pdf.setTitle(titel);
  pdf.setProducer('Design Studio Spike');
  pdf.setCreator('Design Studio Spike');
  // Feste Zeitstempel, damit gleiche Eingabe zu gleicher Ausgabe führt.
  const epoche = new Date(0);
  pdf.setCreationDate(epoche);
  pdf.setModificationDate(epoche);

  const bytes = await pdf.save({ useObjectStreams: false });
  return kennzeichneAlsPdf16(bytes);
}

/**
 * pdf-lib schreibt `%PDF-1.7`. PDF/X-4 verlangt mindestens 1.6, und manche
 * Prüfer stören sich an 1.7 ohne Erweiterungsangabe. Der Kopf wird deshalb auf
 * 1.6 gesetzt — die benutzten Merkmale sind alle darin enthalten.
 */
function kennzeichneAlsPdf16(bytes: Uint8Array): Uint8Array {
  const kopf = new TextDecoder().decode(bytes.subarray(0, 9));
  if (!kopf.startsWith('%PDF-1.')) return bytes;
  const ersetzt = new TextEncoder().encode('%PDF-1.6');
  const kopie = new Uint8Array(bytes);
  kopie.set(ersetzt, 0);
  return kopie;
}

export { PDFHexString };
