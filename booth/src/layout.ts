/**
 * Layout: setzt Aufnahmen in ein Druckbild.
 *
 * Das Wie steht nicht hier, sondern in der Vorlage (`vorlage.ts`). Dieses
 * Modul kennt nur das Blatt, den Doppelstreifen und die Ausgabeformate.
 */

import { FORMATE, formatVon } from './formate';
import { ladeZubehoer, zeichneVorlage, type Vorlage, type Werte } from './vorlage';
import { qrBild } from './ausgabe';

export const FOTO_BREITE = FORMATE['hoch-4x6'].breite;
export const FOTO_HOEHE = FORMATE['hoch-4x6'].hoehe;
export const STREIFEN_BREITE = FORMATE['streifen-2x6'].breite;

/**
 * Rendert eine Vorlage mit ihren Aufnahmen — der Weg, den der Booth geht.
 * Zubehör (Hintergrund, Logo, QR, Schriften) wird vorher geladen; erst
 * danach wird gezeichnet, sonst druckt die Box in der Ersatzschrift.
 */
export async function zeichneMitVorlage(
  v: Vorlage,
  bilder: HTMLCanvasElement[],
  werte: Werte
): Promise<HTMLCanvasElement> {
  const zubehoer = await ladeZubehoer(v, werte, qrBild);
  return zeichneVorlage(v, bilder, werte, zubehoer);
}

/**
 * Zwei Streifen auf ein Blatt, dazwischen die Schnittlinie. Einer für den
 * Gast, einer fürs Gästebuch — und Dye-Sub-Drucker rechnen je Blatt ab, das
 * halbiert die Papierkosten.
 *
 * Gepaart wird immer auf das doppelt so breite Blatt desselben Formats;
 * heute ist das 2×6 → 4×6 hoch.
 */
export function alsDoppelstreifen(
  streifen: HTMLCanvasElement,
  schnittlinie: boolean
): HTMLCanvasElement {
  const ziel = formatVon('hoch-4x6');
  const flaeche = document.createElement('canvas');
  flaeche.width = ziel.breite;
  flaeche.height = ziel.hoehe;
  const stift = flaeche.getContext('2d');
  if (!stift) throw new Error('Zeichenfläche nicht verfügbar');

  stift.fillStyle = '#ffffff';
  stift.fillRect(0, 0, ziel.breite, ziel.hoehe);

  const halb = ziel.breite / 2;
  stift.drawImage(streifen, 0, 0, halb, ziel.hoehe);
  stift.drawImage(streifen, halb, 0, halb, ziel.hoehe);

  if (schnittlinie) {
    stift.strokeStyle = 'rgba(0,0,0,0.35)';
    stift.lineWidth = 2;
    stift.setLineDash([14, 12]);
    stift.beginPath();
    stift.moveTo(halb, 0);
    stift.lineTo(halb, ziel.hoehe);
    stift.stroke();
    stift.setLineDash([]);
  }

  return flaeche;
}

/** Kleines Vorschaubild fürs Ergebnis am Screen. */
export function alsBilddaten(flaeche: HTMLCanvasElement): string {
  return flaeche.toDataURL('image/jpeg', 0.92);
}

export function alsBlob(flaeche: HTMLCanvasElement): Promise<Blob> {
  return new Promise((fertig, fehler) => {
    flaeche.toBlob(
      (blob) => (blob ? fertig(blob) : fehler(new Error('Bild konnte nicht erzeugt werden'))),
      'image/jpeg',
      0.92
    );
  });
}
