/**
 * Druckvorstufenprüfung — der Vorabcheck vor dem PDF-Export.
 *
 * Die Regeln hier sind keine Meinungen, sondern das, was eine Druckerei
 * zurückweist: fehlender Anschnitt, Inhalte zu dicht am Schnitt, Bilder mit zu
 * wenig Auflösung, Haarlinien unter der Druckgrenze.
 *
 * Alle Prüfungen arbeiten auf dem Modell, nicht auf gerendertem Bild. Textumbruch
 * und damit echter Textüberlauf lassen sich hier nicht feststellen — das kann
 * erst die Schicht, die Schriften vermisst.
 */

import type { Entwurf, Entwurfselement } from '../modell/entwurf.js';
import {
  anschnittkasten,
  endformat,
  enthaelt,
  huelleGedreht,
  type Kasten,
  pxZuPt,
  sicherheitskasten,
  ueberschneidet,
} from '../modell/masse.js';
import { alleElemente } from '../modell/navigation.js';

export type Druckschwere = 'fehler' | 'warnung';

export interface Druckbefund {
  regel: string;
  meldung: string;
  schwere: Druckschwere;
  seiteId: string;
  elementId: string | null;
}

/** Unter 150 dpi sieht man es, unter 100 dpi nimmt es keine Druckerei an. */
export const DPI_WARNUNG = 150;
export const DPI_FEHLER = 100;

/** Konturen unter 0,25 pt fallen im Offsetdruck aus oder verstopfen. */
export const HAARLINIE_PT = 0.25;

export interface Druckoptionen {
  /** Bildauflösung prüfen. Bei Bildschirmausgabe abschalten. */
  pruefeAufloesung?: boolean;
}

function rahmenVon(element: Entwurfselement): Kasten {
  return huelleGedreht(
    { x: element.x, y: element.y, breite: element.breite, hoehe: element.hoehe },
    element.drehung,
  );
}

/** Wirksame Auflösung eines platzierten Bildes in dpi. */
export function wirksameDpi(element: Entwurfselement, entwurfDpi: number): number | null {
  if (element.typ !== 'bild') return null;
  if (element.breite <= 0 || element.hoehe <= 0) return null;

  const genutztX = element.quelle.breite * element.zuschnitt.breite;
  const genutztY = element.quelle.hoehe * element.zuschnitt.hoehe;
  const zollBreit = element.breite / entwurfDpi;
  const zollHoch = element.hoehe / entwurfDpi;
  if (zollBreit <= 0 || zollHoch <= 0) return null;

  // Die schlechtere der beiden Achsen entscheidet.
  return Math.min(genutztX / zollBreit, genutztY / zollHoch);
}

export function pruefeDruck(entwurf: Entwurf, optionen: Druckoptionen = {}): Druckbefund[] {
  const befunde: Druckbefund[] = [];
  const pruefeAufloesung = optionen.pruefeAufloesung ?? true;

  const trim = endformat(entwurf.masse);
  const bleed = anschnittkasten(entwurf.masse, entwurf.anschnitt);
  const safe = sicherheitskasten(entwurf.masse, entwurf.sicherheitsabstand);
  const hatAnschnitt =
    entwurf.anschnitt.oben > 0 ||
    entwurf.anschnitt.rechts > 0 ||
    entwurf.anschnitt.unten > 0 ||
    entwurf.anschnitt.links > 0;

  for (const seite of entwurf.seiten) {
    if (hatAnschnitt && seite.hintergrund === null) {
      befunde.push({
        regel: 'hintergrund-fehlt',
        meldung:
          'Seite hat keinen Hintergrund, das Papier bleibt weiß. Bei randabfallendem Druck fast immer ungewollt.',
        schwere: 'warnung',
        seiteId: seite.id,
        elementId: null,
      });
    }
  }

  for (const { element, seiteId } of alleElemente(entwurf)) {
    if (!element.sichtbar) continue;
    if (element.typ === 'gruppe') continue;

    const rahmen = rahmenVon(element);

    // Randabfallend gemeint, aber zu kurz: das Element ragt über das Endformat
    // hinaus, erreicht den Anschnittrand aber nicht. Beim Schneiden entsteht eine
    // weiße Blitzer-Kante. Das ist der häufigste Ablehnungsgrund überhaupt.
    if (hatAnschnitt && !enthaelt(trim, rahmen) && !erreichtAnschnitt(rahmen, trim, bleed)) {
      befunde.push({
        regel: 'anschnitt-zu-kurz',
        meldung: `"${element.name}" ragt über das Endformat, reicht aber nicht bis zum Anschnittrand — beim Schneiden entsteht eine weiße Kante.`,
        schwere: 'fehler',
        seiteId,
        elementId: element.id,
      });
    }

    // Inhalt zu dicht am Schnitt. Nur für Elemente, die nicht ohnehin
    // randabfallend sind — ein Vollflächenbild darf über den Rand.
    if (
      entwurf.sicherheitsabstand > 0 &&
      enthaelt(trim, rahmen) &&
      !enthaelt(safe, rahmen) &&
      ueberschneidet(safe, rahmen)
    ) {
      befunde.push({
        regel: 'sicherheitsabstand',
        meldung: `"${element.name}" liegt im Sicherheitsabstand — bei Schneidetoleranz kann es angeschnitten werden.`,
        schwere: 'warnung',
        seiteId,
        elementId: element.id,
      });
    }

    if (pruefeAufloesung && element.typ === 'bild') {
      const dpi = wirksameDpi(element, entwurf.masse.dpi);
      if (dpi !== null && dpi < DPI_FEHLER) {
        befunde.push({
          regel: 'aufloesung',
          meldung: `"${element.name}" hat nur ${dpi.toFixed(0)} dpi in dieser Größe (mindestens ${DPI_FEHLER} nötig).`,
          schwere: 'fehler',
          seiteId,
          elementId: element.id,
        });
      } else if (dpi !== null && dpi < DPI_WARNUNG) {
        befunde.push({
          regel: 'aufloesung',
          meldung: `"${element.name}" hat ${dpi.toFixed(0)} dpi, empfohlen sind ${DPI_WARNUNG}.`,
          schwere: 'warnung',
          seiteId,
          elementId: element.id,
        });
      }
    }

    if (element.typ === 'form' && element.kontur !== null && element.kontur.staerke > 0) {
      const staerkePt = pxZuPt(element.kontur.staerke, entwurf.masse.dpi);
      if (staerkePt < HAARLINIE_PT) {
        befunde.push({
          regel: 'haarlinie',
          meldung: `Kontur von "${element.name}" ist ${staerkePt.toFixed(2)} pt — unter ${HAARLINIE_PT} pt ist der Druck nicht verlässlich.`,
          schwere: 'fehler',
          seiteId,
          elementId: element.id,
        });
      }
    }
  }

  return befunde;
}

/**
 * Reicht ein über das Endformat hinausragender Rahmen bis an den Anschnittrand?
 * Geprüft wird nur an den Kanten, an denen er tatsächlich übersteht.
 */
function erreichtAnschnitt(rahmen: Kasten, trim: Kasten, bleed: Kasten): boolean {
  const toleranz = 0.5;
  if (rahmen.x < trim.x && rahmen.x > bleed.x + toleranz) return false;
  if (rahmen.y < trim.y && rahmen.y > bleed.y + toleranz) return false;
  if (
    rahmen.x + rahmen.breite > trim.x + trim.breite &&
    rahmen.x + rahmen.breite < bleed.x + bleed.breite - toleranz
  ) {
    return false;
  }
  if (
    rahmen.y + rahmen.hoehe > trim.y + trim.hoehe &&
    rahmen.y + rahmen.hoehe < bleed.y + bleed.hoehe - toleranz
  ) {
    return false;
  }
  return true;
}

export function nurDruckfehler(befunde: readonly Druckbefund[]): Druckbefund[] {
  return befunde.filter((b) => b.schwere === 'fehler');
}
