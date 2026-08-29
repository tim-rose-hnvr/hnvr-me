/* Messen — Strecken und Flächen auf der Seite, in echten Einheiten.

   Acrobat nennt das „Objekte messen". Der Kern ist eine einzige Zahl: wie
   viele Millimeter (oder Meter, oder Fuß) ein PDF-Punkt bedeutet.

   **Ohne Maßstab wird trotzdem gemessen.** Ein PDF-Punkt ist definiert als
   1/72 Zoll, also 0,3528 mm — auf dem Papier stimmt das Ergebnis damit
   immer. Erst wenn die Zeichnung selbst maßstäblich ist (ein Grundriss 1:50,
   ein Lageplan 1:1000), muss der Maßstab gesetzt werden. Genau dafür gibt es
   das Kalibrieren: eine Strecke ziehen, deren wahre Länge man kennt, und sie
   eintragen.

   Der Maßstab gehört zum Dokument, nicht zur Sitzung: ein Grundriss in einem
   Reiter und ein Vertrag im nächsten haben nichts miteinander zu tun. */

import { zustand } from './kern.js';

/** Ein PDF-Punkt ist 1/72 Zoll. Alles hier hängt an dieser einen Zeile. */
export const MM_JE_PUNKT = 25.4 / 72;

/** Faktor von Millimetern in die jeweilige Einheit. */
export const EINHEITEN = {
  mm: { name: 'Millimeter', jeMm: 1, stellen: 1 },
  cm: { name: 'Zentimeter', jeMm: 0.1, stellen: 2 },
  m: { name: 'Meter', jeMm: 0.001, stellen: 3 },
  in: { name: 'Zoll', jeMm: 1 / 25.4, stellen: 2 },
  ft: { name: 'Fuß', jeMm: 1 / 304.8, stellen: 2 },
  pt: { name: 'Punkt', jeMm: 1 / MM_JE_PUNKT, stellen: 1 },
};

/** Der Maßstab, mit dem gerechnet wird, solange keiner gesetzt wurde. */
export function standardMassstab() {
  return { mmJePunkt: MM_JE_PUNKT, einheit: 'mm', benannt: false };
}

export function massstab() {
  return zustand.massstab || standardMassstab();
}

/**
 * Setzt den Maßstab aus einer gemessenen Strecke.
 * @param {number} punkte Länge der gezogenen Strecke in PDF-Punkten
 * @param {number} wahr Wie lang diese Strecke in Wirklichkeit ist
 * @param {string} einheit Schlüssel aus EINHEITEN
 */
export function kalibriere(punkte, wahr, einheit) {
  if (!(punkte > 0)) throw new Error('Die gezogene Strecke hat keine Länge.');
  if (!(wahr > 0)) throw new Error('Die wahre Länge muss größer als null sein.');
  const mm = wahr / EINHEITEN[einheit].jeMm;
  zustand.massstab = { mmJePunkt: mm / punkte, einheit, benannt: true };
  return zustand.massstab;
}

export function setzeEinheit(einheit) {
  const jetzt = massstab();
  zustand.massstab = { ...jetzt, einheit };
}

/** Wie oft passt die wahre Länge in die gezeichnete? „1:50" und dergleichen. */
export function verhaeltnis(m = massstab()) {
  const faktor = m.mmJePunkt / MM_JE_PUNKT;
  if (Math.abs(faktor - 1) < 0.005) return '1:1 (Papiermaß)';
  if (faktor >= 1) return `1:${runde(faktor, 2)}`;
  return `${runde(1 / faktor, 2)}:1`;
}

function runde(wert, stellen) {
  const gerundet = Number(wert.toFixed(stellen));
  return String(gerundet).replace('.', ',');
}

/* ---------- Rechnen ------------------------------------------------------- */

/** Länge einer Messstrecke in PDF-Punkten. */
export function laengeInPunkten(a) {
  return Math.hypot((a.x2 - a.x), (a.y2 - a.y));
}

/** Fläche eines Messrechtecks in Quadrat-PDF-Punkten. */
export function flaecheInPunkten(a) {
  return Math.abs(a.x2 - a.x) * Math.abs(a.y2 - a.y);
}

export function alsLaenge(punkte, m = massstab()) {
  const wert = punkte * m.mmJePunkt * EINHEITEN[m.einheit].jeMm;
  return `${runde(wert, EINHEITEN[m.einheit].stellen)} ${m.einheit}`;
}

export function alsFlaeche(quadratpunkte, m = massstab()) {
  const proSeite = m.mmJePunkt * EINHEITEN[m.einheit].jeMm;
  const wert = quadratpunkte * proSeite * proSeite;
  /* Quadratmillimeter werden schnell unleserlich groß — ab zehntausend wird
     in die nächstgrößere Einheit gewechselt, das ist auf dem Papier üblich. */
  if (m.einheit === 'mm' && wert > 10000) return `${runde(wert / 100, 2)} cm²`;
  if (m.einheit === 'cm' && wert > 10000) return `${runde(wert / 10000, 2)} m²`;
  return `${runde(wert, EINHEITEN[m.einheit].stellen)} ${m.einheit}²`;
}

/**
 * Die Beschriftung einer Messung — dieselbe auf dem Bildschirm wie im PDF.
 * @param {object} a Anmerkung der Art `messen` oder `flaeche`
 */
export function beschriftung(a, m = massstab()) {
  if (a.art === 'flaeche') {
    const breite = alsLaenge(Math.abs(a.x2 - a.x), m);
    const hoehe = alsLaenge(Math.abs(a.y2 - a.y), m);
    return `${alsFlaeche(flaecheInPunkten(a), m)}  (${breite} × ${hoehe})`;
  }
  return alsLaenge(laengeInPunkten(a), m);
}

/** Alle Messungen des Dokuments, für die Liste in der rechten Tafel. */
export function messungen() {
  return zustand.anmerkungen.filter((a) => a.art === 'messen' || a.art === 'flaeche');
}

/** Summe aller Strecken — beim Aufmaß die Zahl, auf die es ankommt. */
export function summeStrecken(m = massstab()) {
  const punkte = messungen()
    .filter((a) => a.art === 'messen')
    .reduce((summe, a) => summe + laengeInPunkten(a), 0);
  return alsLaenge(punkte, m);
}

export function summeFlaechen(m = massstab()) {
  const punkte = messungen()
    .filter((a) => a.art === 'flaeche')
    .reduce((summe, a) => summe + flaecheInPunkten(a), 0);
  return alsFlaeche(punkte, m);
}
