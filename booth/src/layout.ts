/**
 * Layout: setzt Aufnahmen in ein Druckbild.
 *
 * Das Wie steht nicht mehr hier, sondern in der Vorlage (`vorlage.ts`). Dieses
 * Modul kennt nur noch das Blatt, den Doppelstreifen und die Ausgabeformate.
 * Damit druckt der Booth genau das, was im Editor zu sehen war.
 */

import { BLATT, zeichneVorlage, type Vorlage, type Werte } from './vorlage';

export const FOTO_BREITE = BLATT.foto.breite;
export const FOTO_HOEHE = BLATT.foto.hoehe;
export const STREIFEN_BREITE = BLATT.streifen.breite;

/** Lädt das Logo einer Vorlage. Fehlt es oder ist es kaputt, wird ohne gedruckt. */
export function ladeLogo(v: Vorlage): Promise<HTMLImageElement | null> {
  if (!v.logo) return Promise.resolve(null);
  return new Promise((fertig) => {
    const bild = new Image();
    bild.onload = () => fertig(bild);
    bild.onerror = () => fertig(null);
    bild.src = v.logo!;
  });
}

/** Rendert eine Vorlage mit ihren Aufnahmen — der Weg, den der Booth geht. */
export async function zeichneMitVorlage(
  v: Vorlage,
  bilder: HTMLCanvasElement[],
  werte: Werte
): Promise<HTMLCanvasElement> {
  const logo = await ladeLogo(v);
  return zeichneVorlage(v, bilder, werte, logo);
}

/**
 * Doppelstreifen auf 10×15: derselbe Streifen zweimal, dazwischen die
 * Schnittlinie. Einer für den Gast, einer fürs Gästebuch.
 */
export function alsDoppelstreifen(
  streifen: HTMLCanvasElement,
  schnittlinie: boolean
): HTMLCanvasElement {
  const flaeche = document.createElement('canvas');
  flaeche.width = FOTO_BREITE;
  flaeche.height = FOTO_HOEHE;
  const stift = flaeche.getContext('2d');
  if (!stift) throw new Error('Zeichenfläche nicht verfügbar');

  stift.fillStyle = '#ffffff';
  stift.fillRect(0, 0, FOTO_BREITE, FOTO_HOEHE);

  stift.drawImage(streifen, 0, 0, STREIFEN_BREITE, FOTO_HOEHE);
  stift.drawImage(streifen, STREIFEN_BREITE, 0, STREIFEN_BREITE, FOTO_HOEHE);

  if (schnittlinie) {
    stift.strokeStyle = 'rgba(0,0,0,0.35)';
    stift.lineWidth = 2;
    stift.setLineDash([14, 12]);
    stift.beginPath();
    stift.moveTo(FOTO_BREITE / 2, 0);
    stift.lineTo(FOTO_BREITE / 2, FOTO_HOEHE);
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
