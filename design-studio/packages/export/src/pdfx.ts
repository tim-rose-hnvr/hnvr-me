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
 * Deshalb wird **direkt in CMYK geschrieben** und nie nachträglich konvertiert.
 * Der ganze Stapel ist MIT: pdf-lib, fontkit, der Browser.
 *
 * ## Was PDF/X-4 verlangt
 *
 * - **OutputIntent** mit `/S /GTS_PDFX`, dazu entweder ein eingebettetes
 *   ICC-Profil in `/DestOutputProfile` oder eine registrierte Druckbedingung
 * - **TrimBox** und **BleedBox** auf jeder Seite
 * - **XMP-Metadaten** mit `pdfxid:GTS_PDFXVersion`
 * - **Alle Schriften eingebettet**, keine geräteabhängigen Fremdfarbräume
 */

import { deflateSync } from 'node:zlib';
import fontkit from '@pdf-lib/fontkit';
import type { Entwurf } from '@studio/editor-core';
import {
  cmyk,
  concatTransformationMatrix,
  degrees,
  drawObject,
  PDFArray,
  PDFDocument,
  type PDFFont,
  PDFName,
  type PDFPage,
  PDFRawStream,
  type PDFRef,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
} from 'pdf-lib';
import { hexZuCmyk, rgbZuCmyk } from './farbe.js';
import type { Bilddaten, Messung } from './vermessung.js';

/** Wandelt Dokumentpixel in PDF-Punkte. Die einzige Umrechnungsstelle. */
export function pxZuPunkt(px: number, dpi: number): number {
  return (px / dpi) * 72;
}

export interface Druckbedingung {
  kennung: string;
  beschreibung: string;
  registrierung: string;
  /** ICC-Profil als Rohdaten. Fehlt es, wird nur die Kennung eingetragen. */
  iccProfil?: Uint8Array;
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
  schnittmarken?: boolean;
  titel?: string;
}

function schriftSchluessel(familie: string, gewicht: number, kursiv: boolean): string {
  return `${familie.toLowerCase()}|${gewicht}|${kursiv ? 'i' : 'n'}`;
}

/**
 * Wandelt RGBA-Bildpunkte in einen DeviceCMYK-Bilddatenstrom.
 *
 * Der Alphakanal fällt weg: er wurde beim Zeichnen im Browser bereits gegen
 * Weiß gerechnet. Druck kennt keine Transparenz gegen nichts.
 */
export function bildpunkteNachCmyk(punkte: readonly number[]): Uint8Array {
  const anzahl = Math.floor(punkte.length / 4);
  const aus = new Uint8Array(anzahl * 4);

  for (let i = 0; i < anzahl; i += 1) {
    const c = rgbZuCmyk({
      r: punkte[i * 4] ?? 0,
      g: punkte[i * 4 + 1] ?? 0,
      b: punkte[i * 4 + 2] ?? 0,
    });
    aus[i * 4] = Math.round(c.c * 255);
    aus[i * 4 + 1] = Math.round(c.m * 255);
    aus[i * 4 + 2] = Math.round(c.y * 255);
    aus[i * 4 + 3] = Math.round(c.k * 255);
  }

  return aus;
}

/**
 * Schnittmarken liegen **im Anschnitt**, nie im Endformat — sonst druckt man
 * sie mit. Sie zeigen die Ecken des Endformats an und lassen dazwischen Luft.
 */
function zeichneSchnittmarken(
  seite: PDFPage,
  anschnittPt: number,
  trim: { x: number; y: number; breite: number; hoehe: number },
): void {
  const laenge = anschnittPt * 0.8;
  if (laenge <= 0) return;

  const abstand = laenge * 0.25;
  const farbe = cmyk(0, 0, 0, 1);
  const ecken = [
    { x: trim.x, y: trim.y, sx: -1, sy: -1 },
    { x: trim.x + trim.breite, y: trim.y, sx: 1, sy: -1 },
    { x: trim.x, y: trim.y + trim.hoehe, sx: -1, sy: 1 },
    { x: trim.x + trim.breite, y: trim.y + trim.hoehe, sx: 1, sy: 1 },
  ];

  for (const ecke of ecken) {
    seite.drawLine({
      start: { x: ecke.sx < 0 ? ecke.x - abstand - laenge : ecke.x + abstand, y: ecke.y },
      end: { x: ecke.sx < 0 ? ecke.x - abstand : ecke.x + abstand + laenge, y: ecke.y },
      thickness: 0.25,
      color: farbe,
    });
    seite.drawLine({
      start: { x: ecke.x, y: ecke.sy < 0 ? ecke.y - abstand - laenge : ecke.y + abstand },
      end: { x: ecke.x, y: ecke.sy < 0 ? ecke.y - abstand : ecke.y + abstand + laenge },
      thickness: 0.25,
      color: farbe,
    });
  }
}

/**
 * Affine Matrix für eine Drehung um einen Punkt. `grad` ist im Uhrzeigersinn
 * gemeint wie im CSS, das PDF-Koordinatensystem dreht andersherum.
 */
export function drehmatrix(
  gradImUhrzeigersinn: number,
  cx: number,
  cy: number,
): [number, number, number, number, number, number] {
  const bogen = (-gradImUhrzeigersinn * Math.PI) / 180;
  const cos = Math.cos(bogen);
  const sin = Math.sin(bogen);
  return [cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy];
}

function xmpMetadaten(titel: string): string {
  // PDF/X-4 verlangt die Kennzeichnung in XMP, nicht im Info-Wörterbuch.
  // Bewusst ohne Zeitstempel: gleiche Eingabe soll byte-gleiche Ausgabe geben.
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
      <xmp:CreatorTool>Design Studio</xmp:CreatorTool>
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
  const punkt = (px: number): number => pxZuPunkt(px, dpi);

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const eingebettet = new Map<string, PDFFont>();
  for (const schrift of optionen.schriften) {
    const font = await pdf.embedFont(schrift.daten, { subset: true });
    eingebettet.set(schriftSchluessel(schrift.familie, schrift.gewicht, schrift.kursiv), font);
  }
  if (eingebettet.size === 0) {
    throw new Error('PDF/X verlangt eingebettete Schriften — es wurde keine übergeben');
  }

  // Bilder einmal als DeviceCMYK-XObject anlegen, auch wenn sie mehrfach
  // platziert sind. Das ist der Unterschied zwischen 200 kB und 4 MB.
  const bildRefs = new Map<string, PDFRef>();
  for (const bild of messung.bilder) {
    bildRefs.set(bild.id, legeBildAn(pdf, bild));
  }

  const anschnittPt = punkt(entwurf.anschnitt.links);

  for (const seitenmass of messung.seiten) {
    const blattBreite = punkt(seitenmass.breite);
    const blattHoehe = punkt(seitenmass.hoehe);
    const seite = pdf.addPage([blattBreite, blattHoehe]);
    const nachOben = (yPx: number): number => blattHoehe - punkt(yPx);

    for (const flaeche of messung.flaechen.filter((f) => f.seiteId === seitenmass.seiteId)) {
      const x = punkt(flaeche.x);
      const breite = punkt(flaeche.breite);
      const hoehe = punkt(flaeche.hoehe);
      const y = nachOben(flaeche.y) - hoehe;

      if (flaeche.bildId !== null && bildRefs.has(flaeche.bildId)) {
        zeichneBild(seite, bildRefs.get(flaeche.bildId) as PDFRef, flaeche.bildId, {
          x,
          y,
          breite,
          hoehe,
          drehung: flaeche.drehung,
        });
        continue;
      }

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

    for (const lauf of messung.texte.filter((t) => t.seiteId === seitenmass.seiteId)) {
      const font = eingebettet.get(
        schriftSchluessel(lauf.schriftFamilie, lauf.schriftStaerke, lauf.kursiv),
      );
      if (font === undefined) {
        throw new Error(
          `Für "${lauf.schriftFamilie}" ${lauf.schriftStaerke}${lauf.kursiv ? ' kursiv' : ''} ` +
            'wurde keine Schrift eingebettet. PDF/X erlaubt keine Ersatzschriften.',
        );
      }

      const f = hexZuCmyk(lauf.farbe);
      const farbe = cmyk(f.c, f.m, f.y, f.k);
      const groesse = punkt(lauf.schriftGroesse);
      const gedreht = lauf.drehung !== 0;

      if (gedreht) {
        // Ungedreht vermessen, hier gedreht gesetzt — um den Mittelpunkt des
        // Elementrahmens, genau wie es CSS mit transform-origin:50% 50% tut.
        const cx = punkt(lauf.drehpunkt.x);
        const cy = nachOben(lauf.drehpunkt.y);
        seite.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(...drehmatrix(lauf.drehung, cx, cy)),
        );
      }

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

      if (gedreht) seite.pushOperators(popGraphicsState());
    }

    const trim = {
      x: anschnittPt,
      y: punkt(entwurf.anschnitt.unten),
      breite: punkt(entwurf.masse.breite),
      hoehe: punkt(entwurf.masse.hoehe),
    };

    if (optionen.schnittmarken === true) zeichneSchnittmarken(seite, anschnittPt, trim);

    const kasten = (x: number, y: number, b: number, h: number): PDFArray => {
      const arr = PDFArray.withContext(pdf.context);
      for (const wert of [x, y, x + b, y + h]) arr.push(pdf.context.obj(wert));
      return arr;
    };

    seite.node.set(PDFName.of('TrimBox'), kasten(trim.x, trim.y, trim.breite, trim.hoehe));
    seite.node.set(PDFName.of('BleedBox'), kasten(0, 0, blattBreite, blattHoehe));
    seite.node.set(PDFName.of('MediaBox'), kasten(0, 0, blattBreite, blattHoehe));
  }

  // --- OutputIntent, das Kennzeichen von PDF/X ------------------------------
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

  const xmp = PDFRawStream.of(
    pdf.context.obj({ Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML') }),
    new TextEncoder().encode(xmpMetadaten(titel)),
  );
  pdf.catalog.set(PDFName.of('Metadata'), pdf.context.register(xmp));

  pdf.setTitle(titel);
  pdf.setProducer('Design Studio');
  pdf.setCreator('Design Studio');
  const epoche = new Date(0);
  pdf.setCreationDate(epoche);
  pdf.setModificationDate(epoche);

  return kennzeichneAlsPdf16(await pdf.save({ useObjectStreams: false }));
}

function legeBildAn(pdf: PDFDocument, bild: Bilddaten): PDFRef {
  const cmykDaten = bildpunkteNachCmyk(bild.punkte);
  const gepackt = new Uint8Array(deflateSync(Buffer.from(cmykDaten)));

  const strom = PDFRawStream.of(
    pdf.context.obj({
      Type: PDFName.of('XObject'),
      Subtype: PDFName.of('Image'),
      Width: bild.breite,
      Height: bild.hoehe,
      ColorSpace: PDFName.of('DeviceCMYK'),
      BitsPerComponent: 8,
      Filter: PDFName.of('FlateDecode'),
    }),
    gepackt,
  );

  return pdf.context.register(strom);
}

function zeichneBild(
  seite: PDFPage,
  ref: PDFRef,
  id: string,
  lage: { x: number; y: number; breite: number; hoehe: number; drehung: number },
): void {
  const name = `Bild_${id.replace(/[^\w]/g, '_')}`;
  seite.node.setXObject(PDFName.of(name), ref);

  const operatoren = [pushGraphicsState()];
  if (lage.drehung !== 0) {
    const cx = lage.x + lage.breite / 2;
    const cy = lage.y + lage.hoehe / 2;
    operatoren.push(concatTransformationMatrix(...drehmatrix(lage.drehung, cx, cy)));
  }
  // Ein Bild-XObject ist ein Einheitsquadrat; die Matrix macht Größe und Ort.
  operatoren.push(
    concatTransformationMatrix(lage.breite, 0, 0, lage.hoehe, lage.x, lage.y),
    drawObject(name),
    popGraphicsState(),
  );

  seite.pushOperators(...operatoren);
}

/**
 * pdf-lib schreibt `%PDF-1.7`. PDF/X-4 verlangt mindestens 1.6, und manche
 * Prüfer stören sich an 1.7 ohne Erweiterungsangabe.
 */
function kennzeichneAlsPdf16(bytes: Uint8Array): Uint8Array {
  const kopf = new TextDecoder().decode(bytes.subarray(0, 9));
  if (!kopf.startsWith('%PDF-1.')) return bytes;
  const kopie = new Uint8Array(bytes);
  kopie.set(new TextEncoder().encode('%PDF-1.6'), 0);
  return kopie;
}
