/**
 * Layout-Renderer: setzt Aufnahmen in ein Druckbild.
 *
 * Maße in Druckpunkten bei 300 dpi:
 *   Fotoformat 10×15 cm  → 1200 × 1800
 *   Streifen    5×15 cm  → 600 × 1800
 *   Doppelstreifen       → zwei Streifen auf 10×15 mit Schnittlinie in der Mitte
 *
 * Das Layout-Modell entspricht dem der Vorlagen: Bildfeld(er), Textfelder,
 * Logo-Slot. Hier ist die Grundvorlage umgesetzt; weitere Vorlagen setzen auf
 * denselben Funktionen auf.
 */

export type Vorlagentexte = {
  titel: string;
  zeile: string;
};

export const FOTO_BREITE = 1200;
export const FOTO_HOEHE = 1800;
export const STREIFEN_BREITE = 600;

const PAPIER = '#ffffff';
const TINTE = '#17171c';
const LEISE = 'rgba(0,0,0,0.45)';

function stiftVon(flaeche: HTMLCanvasElement): CanvasRenderingContext2D {
  const stift = flaeche.getContext('2d');
  if (!stift) throw new Error('Zeichenfläche nicht verfügbar');
  return stift;
}

/** Zeichnet ein Bild formatfüllend in ein Feld, ohne es zu verzerren. */
function fuelleFeld(
  stift: CanvasRenderingContext2D,
  bild: CanvasImageSource,
  quelleBreite: number,
  quelleHoehe: number,
  x: number,
  y: number,
  breite: number,
  hoehe: number
): void {
  const skala = Math.max(breite / quelleBreite, hoehe / quelleHoehe);
  const zielBreite = quelleBreite * skala;
  const zielHoehe = quelleHoehe * skala;
  const versatzX = x + (breite - zielBreite) / 2;
  const versatzY = y + (hoehe - zielHoehe) / 2;

  stift.save();
  stift.beginPath();
  stift.rect(x, y, breite, hoehe);
  stift.clip();
  stift.drawImage(bild, versatzX, versatzY, zielBreite, zielHoehe);
  stift.restore();
}

function schreibeFuss(
  stift: CanvasRenderingContext2D,
  texte: Vorlagentexte,
  mitte: number,
  oben: number,
  massstab: number
): void {
  stift.textAlign = 'center';

  stift.fillStyle = TINTE;
  stift.font = `800 ${Math.round(46 * massstab)}px Archivo, system-ui, sans-serif`;
  stift.fillText(texte.titel, mitte, oben + Math.round(48 * massstab));

  stift.fillStyle = LEISE;
  stift.font = `500 ${Math.round(22 * massstab)}px 'IBM Plex Mono', ui-monospace, monospace`;
  stift.fillText(texte.zeile.toUpperCase(), mitte, oben + Math.round(88 * massstab));
}

/** Einzelbild im Fotoformat: großes Bildfeld, Titel und Datumszeile darunter. */
export function zeichneFoto(bild: HTMLCanvasElement, texte: Vorlagentexte): HTMLCanvasElement {
  const flaeche = document.createElement('canvas');
  flaeche.width = FOTO_BREITE;
  flaeche.height = FOTO_HOEHE;
  const stift = stiftVon(flaeche);

  stift.fillStyle = PAPIER;
  stift.fillRect(0, 0, FOTO_BREITE, FOTO_HOEHE);

  const rand = 60;
  const feldBreite = FOTO_BREITE - rand * 2;
  const feldHoehe = Math.round(feldBreite * (3 / 4)); // 4:3-Bildfeld

  fuelleFeld(stift, bild, bild.width, bild.height, rand, rand, feldBreite, feldHoehe);

  schreibeFuss(stift, texte, FOTO_BREITE / 2, rand + feldHoehe + 40, 1);
  return flaeche;
}

/** Streifen: drei Bildfelder untereinander, Fußzeile unten. */
export function zeichneStreifen(
  bilder: HTMLCanvasElement[],
  texte: Vorlagentexte
): HTMLCanvasElement {
  const flaeche = document.createElement('canvas');
  flaeche.width = STREIFEN_BREITE;
  flaeche.height = FOTO_HOEHE;
  const stift = stiftVon(flaeche);

  stift.fillStyle = PAPIER;
  stift.fillRect(0, 0, STREIFEN_BREITE, FOTO_HOEHE);

  const rand = 34;
  const abstand = 20;
  const fussHoehe = 190;
  const anzahl = Math.max(1, bilder.length);
  const feldBreite = STREIFEN_BREITE - rand * 2;
  const gesamtHoehe = FOTO_HOEHE - rand - fussHoehe;
  const feldHoehe = Math.floor((gesamtHoehe - rand - abstand * (anzahl - 1)) / anzahl);

  bilder.forEach((bild, i) => {
    const y = rand + i * (feldHoehe + abstand);
    fuelleFeld(stift, bild, bild.width, bild.height, rand, y, feldBreite, feldHoehe);
  });

  schreibeFuss(stift, texte, STREIFEN_BREITE / 2, FOTO_HOEHE - fussHoehe + 30, 0.72);
  return flaeche;
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
  const stift = stiftVon(flaeche);

  stift.fillStyle = PAPIER;
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
