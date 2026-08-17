/**
 * Einheiten und Kästen der Druckvorstufe.
 *
 * Im Dokument gibt es genau eine Einheit: Pixel bei der `dpi` des Entwurfs.
 * Millimeter und Punkt sind reine Anzeigeeinheiten und existieren nur hier.
 */

import type { Anschnitt, Entwurf, Entwurfselement, Masse } from './entwurf.js';

const MM_JE_ZOLL = 25.4;
const PT_JE_ZOLL = 72;

export const DPI_BILDSCHIRM = 72;
export const DPI_DRUCK = 300;

export function mmZuPx(mm: number, dpi: number): number {
  pruefeDpi(dpi);
  return (mm / MM_JE_ZOLL) * dpi;
}

export function pxZuMm(px: number, dpi: number): number {
  pruefeDpi(dpi);
  return (px / dpi) * MM_JE_ZOLL;
}

export function ptZuPx(pt: number, dpi: number): number {
  pruefeDpi(dpi);
  return (pt / PT_JE_ZOLL) * dpi;
}

export function pxZuPt(px: number, dpi: number): number {
  pruefeDpi(dpi);
  return (px / dpi) * PT_JE_ZOLL;
}

function pruefeDpi(dpi: number): void {
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError(`dpi muss positiv und endlich sein, war ${String(dpi)}`);
  }
}

/** Ein achsenparalleles Rechteck in px bei der dpi des Entwurfs. */
export interface Kasten {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

/** Das Endformat — der Beschnitt liegt genau hier. Ursprung des Koordinatensystems. */
export function endformat(masse: Masse): Kasten {
  return { x: 0, y: 0, breite: masse.breite, hoehe: masse.hoehe };
}

/** Endformat plus Anschnitt. Ragt links und oben ins Negative. */
export function anschnittkasten(masse: Masse, anschnitt: Anschnitt): Kasten {
  return {
    x: -anschnitt.links,
    y: -anschnitt.oben,
    breite: masse.breite + anschnitt.links + anschnitt.rechts,
    hoehe: masse.hoehe + anschnitt.oben + anschnitt.unten,
  };
}

/** Endformat abzüglich Sicherheitsabstand. Inhalte sollten hier hineinpassen. */
export function sicherheitskasten(masse: Masse, sicherheitsabstand: number): Kasten {
  const breite = Math.max(0, masse.breite - 2 * sicherheitsabstand);
  const hoehe = Math.max(0, masse.hoehe - 2 * sicherheitsabstand);
  return { x: sicherheitsabstand, y: sicherheitsabstand, breite, hoehe };
}

export function enthaelt(aussen: Kasten, innen: Kasten): boolean {
  return (
    innen.x >= aussen.x &&
    innen.y >= aussen.y &&
    innen.x + innen.breite <= aussen.x + aussen.breite &&
    innen.y + innen.hoehe <= aussen.y + aussen.hoehe
  );
}

export function ueberschneidet(a: Kasten, b: Kasten): boolean {
  return (
    a.x < b.x + b.breite &&
    b.x < a.x + a.breite &&
    a.y < b.y + b.hoehe &&
    b.y < a.y + a.hoehe
  );
}

/**
 * Achsenparallele Hülle eines um `drehung` Grad gedrehten Kastens.
 * Wird für Sicherheitsabstand- und Anschnittprüfungen gebraucht, weil ein
 * gedrehter Titel sonst scheinbar im Sicherheitsbereich liegt und trotzdem
 * angeschnitten wird.
 */
export function huelleGedreht(kasten: Kasten, drehung: number): Kasten {
  const bogen = (drehung * Math.PI) / 180;
  const cos = Math.abs(Math.cos(bogen));
  const sin = Math.abs(Math.sin(bogen));
  const breite = kasten.breite * cos + kasten.hoehe * sin;
  const hoehe = kasten.breite * sin + kasten.hoehe * cos;
  const mx = kasten.x + kasten.breite / 2;
  const my = kasten.y + kasten.hoehe / 2;
  return { x: mx - breite / 2, y: my - hoehe / 2, breite, hoehe };
}

/**
 * Rechnet einen Entwurf auf eine andere dpi um. Alle Maße skalieren mit, das
 * physische Format bleibt gleich. Das ist der Weg von der Bildschirmvorschau
 * zur Druckdatei.
 */
export function skaliereAufDpi(entwurf: Entwurf, zielDpi: number): Entwurf {
  pruefeDpi(zielDpi);
  const faktor = zielDpi / entwurf.masse.dpi;
  if (faktor === 1) return entwurf;
  return skaliereEntwurf(entwurf, faktor, zielDpi);
}

function skaliereEntwurf(entwurf: Entwurf, faktor: number, zielDpi: number): Entwurf {
  return {
    ...entwurf,
    masse: {
      breite: entwurf.masse.breite * faktor,
      hoehe: entwurf.masse.hoehe * faktor,
      dpi: zielDpi,
    },
    anschnitt: {
      oben: entwurf.anschnitt.oben * faktor,
      rechts: entwurf.anschnitt.rechts * faktor,
      unten: entwurf.anschnitt.unten * faktor,
      links: entwurf.anschnitt.links * faktor,
    },
    sicherheitsabstand: entwurf.sicherheitsabstand * faktor,
    seiten: entwurf.seiten.map((seite) => ({
      ...seite,
      elemente: seite.elemente.map((element) => skaliereElement(element, faktor)),
    })),
  };
}

function skaliereElement(element: Entwurfselement, faktor: number): Entwurfselement {
  const rahmen = {
    x: element.x * faktor,
    y: element.y * faktor,
    breite: element.breite * faktor,
    hoehe: element.hoehe * faktor,
  };

  switch (element.typ) {
    case 'text':
      return {
        ...element,
        ...rahmen,
        schriftGroesse: element.schriftGroesse * faktor,
        laufweite: element.laufweite * faktor,
      };
    case 'form':
      return {
        ...element,
        ...rahmen,
        eckenradius: element.eckenradius * faktor,
        kontur:
          element.kontur === null
            ? null
            : { ...element.kontur, staerke: element.kontur.staerke * faktor },
      };
    case 'gruppe':
      return {
        ...element,
        ...rahmen,
        kinder: element.kinder.map((kind) => skaliereElement(kind, faktor)),
      };
    case 'bild':
      // Der Zuschnitt ist relativ und skaliert deshalb nicht mit.
      return { ...element, ...rahmen };
  }
}

/** Ein Ausgabeformat, wie es im Bedienfeld zur Auswahl steht. */
export interface Format {
  schluessel: string;
  name: string;
  /** Breite und Höhe in mm — die kanonische, dpi-unabhängige Angabe. */
  breiteMm: number;
  hoeheMm: number;
  /** Empfohlene dpi. Druckformate 300, Bildschirmformate 72. */
  dpi: number;
  /** Empfohlener Anschnitt in mm, je Kante gleich. 0 bei Bildschirmformaten. */
  anschnittMm: number;
  /** Empfohlener Sicherheitsabstand in mm. */
  sicherheitsabstandMm: number;
}

export const FORMATE: readonly Format[] = [
  // Druck — 3 mm Anschnitt ist europäischer Standard, 5 mm bei Großformat.
  { schluessel: 'a4-hoch', name: 'A4 hoch', breiteMm: 210, hoeheMm: 297, dpi: DPI_DRUCK, anschnittMm: 3, sicherheitsabstandMm: 5 },
  { schluessel: 'a4-quer', name: 'A4 quer', breiteMm: 297, hoeheMm: 210, dpi: DPI_DRUCK, anschnittMm: 3, sicherheitsabstandMm: 5 },
  { schluessel: 'a5-hoch', name: 'A5 hoch', breiteMm: 148, hoeheMm: 210, dpi: DPI_DRUCK, anschnittMm: 3, sicherheitsabstandMm: 5 },
  { schluessel: 'a3-hoch', name: 'A3 hoch', breiteMm: 297, hoeheMm: 420, dpi: DPI_DRUCK, anschnittMm: 3, sicherheitsabstandMm: 5 },
  { schluessel: 'din-lang', name: 'DIN lang', breiteMm: 210, hoeheMm: 99, dpi: DPI_DRUCK, anschnittMm: 3, sicherheitsabstandMm: 5 },
  { schluessel: 'visitenkarte', name: 'Visitenkarte', breiteMm: 85, hoeheMm: 55, dpi: DPI_DRUCK, anschnittMm: 3, sicherheitsabstandMm: 4 },
  { schluessel: 'plakat-a1', name: 'Plakat A1', breiteMm: 594, hoeheMm: 841, dpi: DPI_DRUCK, anschnittMm: 5, sicherheitsabstandMm: 10 },

  // Bildschirm — mm ergeben sich aus px bei 72 dpi, damit eine Einheit reicht.
  { schluessel: 'instagram-post', name: 'Instagram Beitrag', breiteMm: 381, hoeheMm: 381, dpi: DPI_BILDSCHIRM, anschnittMm: 0, sicherheitsabstandMm: 14 },
  { schluessel: 'instagram-story', name: 'Instagram Story', breiteMm: 381, hoeheMm: 677.33, dpi: DPI_BILDSCHIRM, anschnittMm: 0, sicherheitsabstandMm: 35 },
  { schluessel: 'linkedin-post', name: 'LinkedIn Beitrag', breiteMm: 423.33, hoeheMm: 221.31, dpi: DPI_BILDSCHIRM, anschnittMm: 0, sicherheitsabstandMm: 14 },
];

export function formatNachSchluessel(schluessel: string): Format | null {
  return FORMATE.find((f) => f.schluessel === schluessel) ?? null;
}
