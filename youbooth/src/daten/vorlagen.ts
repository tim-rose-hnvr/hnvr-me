/**
 * Die Vorlagen-Galerie — aus dem echten Katalog, nicht aus einem Rezept.
 *
 * Hier standen einmal sechzehn CSS-Nachbauten und die Zahl 240. Beides war
 * erfunden: Nachgebaute Blätter sagen nichts darüber, wie ein Abzug aussieht,
 * und eine Bibliothek, die es nicht gibt, fällt spätestens beim ersten Kunden
 * auf, der sie sehen will.
 *
 * Jetzt kommt beides aus `vorlagenbilder.json`. Die Datei schreibt
 * `booth/tools/vorlagen-bilder.mjs`: Es zeichnet jede mitgelieferte Vorlage
 * mit demselben Renderer, der auch druckt. Ändert sich der Katalog, wird das
 * Werkzeug erneut gefahren — und die Website stimmt wieder.
 */

import blaetter from './vorlagenbilder.json';

export type Blatt = {
  id: string;
  name: string;
  anlass: string;
  /** `foto` = ein Bild, `streifen` = eine Serie. */
  art: 'foto' | 'streifen';
  format: string;
  aufnahmen: number;
  breite: number;
  hoehe: number;
  bild: string;
};

/** Die Papierformate in der Sprache der Kundschaft, nicht in Zoll. */
const FORMATNAMEN: Record<string, string> = {
  'streifen-2x6': '5 × 15 cm',
  'postkarte-4x6': '15 × 10 cm',
  'hoch-4x6': '10 × 15 cm',
  'quadrat-4x4': '10 × 10 cm',
  'gross-5x7': '13 × 18 cm',
  magnet: '6 × 9 cm',
  lesezeichen: '5 × 18 cm',
};

export const vorlagen = blaetter as Blatt[];

export function formatname(schluessel: string): string {
  return FORMATNAMEN[schluessel] ?? schluessel;
}

const zaehle = <T extends string | number>(werte: T[]): Map<T, number> => {
  const m = new Map<T, number>();
  werte.forEach((w) => m.set(w, (m.get(w) ?? 0) + 1));
  return m;
};

/* Filter zeigen nur, was auch vorkommt. Ein Knopf, der auf eine leere Liste
   führt, ist ein Versprechen, das die Seite selbst bricht. */
export const anlaesseDerVorlagen = [...zaehle(vorlagen.map((v) => v.anlass))]
  .sort((a, b) => b[1] - a[1])
  .map(([name, zahl]) => ({ name, zahl }));

export const formateDerVorlagen = [...zaehle(vorlagen.map((v) => v.format))]
  .sort((a, b) => b[1] - a[1])
  .map(([schluessel, zahl]) => ({ schluessel, name: formatname(schluessel), zahl }));

export const bibliothek = {
  gesamt: vorlagen.length,
  einzelbild: vorlagen.filter((v) => v.art === 'foto').length,
  streifen: vorlagen.filter((v) => v.art === 'streifen').length,
  formate: formateDerVorlagen.length,
};
