/**
 * Der Prüfentwurf.
 *
 * Absichtlich so gebaut, dass er die vier Dinge trifft, an denen der Weg
 * scheitern könnte — nicht so, dass er hübsch aussieht:
 *
 * 1. **Randabfallende Fläche** — muss bis in den Anschnitt reichen, sonst
 *    entsteht beim Schneiden eine weiße Kante.
 * 2. **Fließtext mit Umbruch und Silbentrennung** — der eigentliche Grund für
 *    Weg B. Ein deutsches Wortungetüm ist ausdrücklich dabei.
 * 3. **Schwarzer Text** — muss im PDF als K-only ankommen, nicht als
 *    Vierfarbmischung.
 * 4. **Bunte Fläche** — muss eine echte CMYK-Mischung ergeben.
 */

import {
  type Entwurf,
  erzeugeEntwurf,
  erzeugeForm,
  erzeugeText,
  festeUhr,
  formatNachSchluessel,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';

export const PRUEF_SCHRIFT = 'PruefSchrift';

export function pruefentwurf(werkzeuge?: Werkzeuge): Entwurf {
  const w: Werkzeuge = werkzeuge ?? { neueId: zaehlerId('p'), jetzt: festeUhr() };

  const format = formatNachSchluessel('a5-hoch');
  if (format === null) throw new Error('Format a5-hoch fehlt');

  const basis = erzeugeEntwurf({ organisationId: 'org-spike', name: 'Druckspike A5', format }, w);

  const { breite, hoehe } = basis.masse;
  const anschnitt = basis.anschnitt.links;
  const rand = basis.sicherheitsabstand;

  const kopfbalken = erzeugeForm(
    // Ragt links, rechts und oben in den Anschnitt — randabfallend.
    { x: -anschnitt, y: -anschnitt, breite: breite + 2 * anschnitt, hoehe: hoehe * 0.28 },
    'rechteck',
    { name: 'Kopfbalken', fuellung: '#0a5c8a' },
    w,
  );

  const schlagzeile = erzeugeText(
    { x: rand, y: hoehe * 0.08, breite: breite - 2 * rand, hoehe: hoehe * 0.12 },
    'Sommerfest 2026',
    {
      name: 'Schlagzeile',
      schriftFamilie: PRUEF_SCHRIFT,
      schriftGroesse: Math.round(hoehe * 0.045),
      schriftStaerke: 700,
      farbe: '#ffffff',
      zeilenabstand: 1.1,
    },
    w,
  );

  const fliesstext = erzeugeText(
    { x: rand, y: hoehe * 0.36, breite: breite - 2 * rand, hoehe: hoehe * 0.3 },
    'Die Betriebsversammlung findet in der Hauptverwaltung statt. ' +
      'Anmeldungen nimmt die Geschaeftsstellenleitung entgegen. ' +
      'Bitte bringen Sie Ihre Teilnahmebestaetigung mit.',
    {
      name: 'Fliesstext',
      schriftFamilie: PRUEF_SCHRIFT,
      schriftGroesse: Math.round(hoehe * 0.018),
      schriftStaerke: 400,
      // Reines Schwarz: muss als K-only im PDF landen.
      farbe: '#000000',
      ausrichtung: 'blocksatz',
      zeilenabstand: 1.45,
    },
    w,
  );

  const akzent = erzeugeForm(
    { x: rand, y: hoehe * 0.72, breite: breite - 2 * rand, hoehe: hoehe * 0.08 },
    'rechteck',
    {
      name: 'Akzentflaeche',
      // Bunt: muss eine echte Vierfarbmischung ergeben.
      fuellung: '#e2a33c',
      kontur: { farbe: '#0a5c8a', staerke: Math.max(2, Math.round(breite * 0.004)) },
    },
    w,
  );

  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  return {
    ...basis,
    seiten: [
      {
        ...erste,
        hintergrund: '#ffffff',
        elemente: [kopfbalken, schlagzeile, fliesstext, akzent],
      },
    ],
  };
}
