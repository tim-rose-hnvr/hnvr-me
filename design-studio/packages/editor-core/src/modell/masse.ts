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
  return a.x < b.x + b.breite && b.x < a.x + a.breite && a.y < b.y + b.hoehe && b.y < a.y + a.hoehe;
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

/**
 * Ein Ausgabeformat, wie es im Bedienfeld zur Auswahl steht.
 *
 * Jedes Format wird in **seiner natürlichen Einheit** angegeben: Druck in
 * Millimetern, Bildschirm in Pixeln. Der frühere Versuch, alles über
 * Millimeter zu führen, hat Instagram Story auf 1919,99 px und LinkedIn auf
 * 1199,99 × 627,34 px gebracht — Bildschirmformate müssen aber pixelgenau
 * sein, sonst gibt es unscharfe Kanten und Ein-Pixel-Ränder im Export.
 *
 * `anschnitt` und `sicherheitsabstand` stehen in derselben Einheit wie `masse`.
 */
export type Formateinheit = 'mm' | 'px';

export interface Format {
  schluessel: string;
  name: string;
  einheit: Formateinheit;
  breite: number;
  hoehe: number;
  /** Druck 300, Bildschirm 72. Bei `einheit: 'px'` ist das die Bezugsauflösung. */
  dpi: number;
  /** Anschnitt je Kante, in `einheit`. Bei Bildschirmformaten 0. */
  anschnitt: number;
  /** Sicherheitsabstand nach innen, in `einheit`. */
  sicherheitsabstand: number;
}

/** Rechnet eine Formatangabe in Dokumentpixel um — die einzige Umrechnungsstelle. */
export function formatInPx(format: Format): {
  breite: number;
  hoehe: number;
  anschnitt: number;
  sicherheitsabstand: number;
  dpi: number;
} {
  const um = (wert: number): number => (format.einheit === 'mm' ? mmZuPx(wert, format.dpi) : wert);

  return {
    breite: um(format.breite),
    hoehe: um(format.hoehe),
    anschnitt: um(format.anschnitt),
    sicherheitsabstand: um(format.sicherheitsabstand),
    dpi: format.dpi,
  };
}

export const FORMATE: readonly Format[] = [
  // Druck in Millimetern. 3 mm Anschnitt ist europäischer Standard,
  // 5 mm bei Großformat, weil dort die Schneidetoleranz größer ist.
  {
    schluessel: 'a4-hoch',
    name: 'A4 hoch',
    einheit: 'mm',
    breite: 210,
    hoehe: 297,
    dpi: DPI_DRUCK,
    anschnitt: 3,
    sicherheitsabstand: 5,
  },
  {
    schluessel: 'a4-quer',
    name: 'A4 quer',
    einheit: 'mm',
    breite: 297,
    hoehe: 210,
    dpi: DPI_DRUCK,
    anschnitt: 3,
    sicherheitsabstand: 5,
  },
  {
    schluessel: 'a5-hoch',
    name: 'A5 hoch',
    einheit: 'mm',
    breite: 148,
    hoehe: 210,
    dpi: DPI_DRUCK,
    anschnitt: 3,
    sicherheitsabstand: 5,
  },
  {
    schluessel: 'a3-hoch',
    name: 'A3 hoch',
    einheit: 'mm',
    breite: 297,
    hoehe: 420,
    dpi: DPI_DRUCK,
    anschnitt: 3,
    sicherheitsabstand: 5,
  },
  {
    schluessel: 'din-lang',
    name: 'DIN lang',
    einheit: 'mm',
    breite: 210,
    hoehe: 99,
    dpi: DPI_DRUCK,
    anschnitt: 3,
    sicherheitsabstand: 5,
  },
  {
    schluessel: 'visitenkarte',
    name: 'Visitenkarte',
    einheit: 'mm',
    breite: 85,
    hoehe: 55,
    dpi: DPI_DRUCK,
    anschnitt: 3,
    sicherheitsabstand: 4,
  },
  {
    schluessel: 'plakat-a1',
    name: 'Plakat A1',
    einheit: 'mm',
    breite: 594,
    hoehe: 841,
    dpi: DPI_DRUCK,
    anschnitt: 5,
    sicherheitsabstand: 10,
  },

  // Bildschirm in Pixeln, exakt so wie die Plattformen sie angeben.
  {
    schluessel: 'instagram-post',
    name: 'Instagram Beitrag',
    einheit: 'px',
    breite: 1080,
    hoehe: 1080,
    dpi: DPI_BILDSCHIRM,
    anschnitt: 0,
    sicherheitsabstand: 40,
  },
  {
    schluessel: 'instagram-story',
    name: 'Instagram Story',
    einheit: 'px',
    breite: 1080,
    hoehe: 1920,
    dpi: DPI_BILDSCHIRM,
    anschnitt: 0,
    sicherheitsabstand: 100,
  },
  {
    schluessel: 'linkedin-post',
    name: 'LinkedIn Beitrag',
    einheit: 'px',
    breite: 1200,
    hoehe: 627,
    dpi: DPI_BILDSCHIRM,
    anschnitt: 0,
    sicherheitsabstand: 40,
  },
  {
    schluessel: 'facebook-post',
    name: 'Facebook Beitrag',
    einheit: 'px',
    breite: 1200,
    hoehe: 630,
    dpi: DPI_BILDSCHIRM,
    anschnitt: 0,
    sicherheitsabstand: 40,
  },
];

export function formatNachSchluessel(schluessel: string): Format | null {
  return FORMATE.find((f) => f.schluessel === schluessel) ?? null;
}
