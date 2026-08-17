/**
 * Markenkit und Vorlagen für das Probemodell.
 *
 * Bewusst ein strenges Kit: nur vier Farben, eine Schrift, zwei Schnitte. Genau
 * so sieht ein echtes Kundenkit aus, und genau daran zeigt sich der Unterschied
 * zu einer freien Leinwand — der Editor lässt gar nicht erst zu, was die Marke
 * verbietet.
 */

import {
  type Entwurf,
  erzeugeEntwurf,
  erzeugeForm,
  erzeugeText,
  type Format,
  festeUhr,
  formatNachSchluessel,
  type Markenkit,
  type Vorlage,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';

export const MARKENSCHRIFT = 'Markenschrift';

export const MARKENKIT: Markenkit = {
  id: 'kit-hnvr',
  organisationId: 'org-demo',
  name: 'Beispielmarke',
  farben: [
    { id: 'f-primaer', name: 'Primär', hex: '#0a5c8a', cmyk: null, sonderfarbe: null },
    { id: 'f-akzent', name: 'Akzent', hex: '#e2a33c', cmyk: null, sonderfarbe: null },
    { id: 'f-weiss', name: 'Weiß', hex: '#ffffff', cmyk: null, sonderfarbe: null },
    { id: 'f-schwarz', name: 'Schwarz', hex: '#000000', cmyk: null, sonderfarbe: null },
  ],
  schriften: [
    {
      id: 's-marke',
      name: MARKENSCHRIFT,
      familie: MARKENSCHRIFT,
      staerken: [400, 700],
      kursivVerfuegbar: false,
      quelleUrl: 'eingebettet',
      lizenz: 'ofl',
    },
  ],
  logos: [],
  strikt: true,
};

function werkzeuge(praefix: string): Werkzeuge {
  return { neueId: zaehlerId(praefix), jetzt: festeUhr('2026-08-17T00:00:00.000Z') };
}

function format(schluessel: string): Format {
  const f = formatNachSchluessel(schluessel);
  if (f === null) throw new Error(`Format "${schluessel}" fehlt`);
  return f;
}

/**
 * Aushang A5 — der Druckfall. Gesperrter Zierbalken, zwei Platzhalter.
 * Der Kunde füllt aus, das Layout bleibt.
 */
function aushang(): Vorlage {
  const w = werkzeuge('v1');
  const basis = erzeugeEntwurf(
    { organisationId: 'org-demo', name: 'Aushang A5', format: format('a5-hoch') },
    w,
  );
  const { breite, hoehe } = basis.masse;
  const an = basis.anschnitt.links;
  const rand = basis.sicherheitsabstand;
  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  return {
    id: 'vorlage-aushang',
    organisationId: 'org-demo',
    name: 'Aushang A5',
    beschreibung: 'Randabfallender Kopfbalken, Schlagzeile und Fließtext',
    markenkitId: MARKENKIT.id,
    bauplan: {
      ...basis,
      markenkitId: MARKENKIT.id,
      seiten: [
        {
          ...erste,
          hintergrund: '#ffffff',
          elemente: [
            erzeugeForm(
              // Randabfallend: ragt in den Anschnitt, sonst weiße Blitzer.
              { x: -an, y: -an, breite: breite + 2 * an, hoehe: hoehe * 0.3 },
              'rechteck',
              { name: 'Kopfbalken', fuellung: '#0a5c8a', gesperrt: true },
              w,
            ),
            erzeugeText(
              { x: rand, y: hoehe * 0.09, breite: breite - 2 * rand, hoehe: hoehe * 0.14 },
              'Sommerfest 2026',
              {
                name: 'Schlagzeile',
                schriftFamilie: MARKENSCHRIFT,
                schriftGroesse: Math.round(hoehe * 0.05),
                schriftStaerke: 700,
                farbe: '#ffffff',
                zeilenabstand: 1.1,
                platzhalter: {
                  schluessel: 'schlagzeile',
                  bearbeitbar: ['text'],
                  beschriftung: 'Schlagzeile',
                },
              },
              w,
            ),
            erzeugeText(
              { x: rand, y: hoehe * 0.4, breite: breite - 2 * rand, hoehe: hoehe * 0.3 },
              'Die Betriebsversammlung findet in der Hauptverwaltung statt. ' +
                'Anmeldungen nimmt die Geschäftsstellenleitung entgegen. ' +
                'Bitte bringen Sie Ihre Teilnahmebestätigung mit.',
              {
                name: 'Fließtext',
                schriftFamilie: MARKENSCHRIFT,
                schriftGroesse: Math.round(hoehe * 0.019),
                schriftStaerke: 400,
                farbe: '#000000',
                ausrichtung: 'blocksatz',
                zeilenabstand: 1.5,
                platzhalter: {
                  schluessel: 'fliesstext',
                  bearbeitbar: ['text'],
                  beschriftung: 'Fließtext',
                },
              },
              w,
            ),
            erzeugeForm(
              { x: rand, y: hoehe * 0.78, breite: breite - 2 * rand, hoehe: hoehe * 0.07 },
              'rechteck',
              {
                name: 'Akzentfläche',
                fuellung: '#e2a33c',
                kontur: { farbe: '#0a5c8a', staerke: Math.max(2, Math.round(breite * 0.004)) },
              },
              w,
            ),
          ],
        },
      ],
    },
  };
}

/** Instagram-Beitrag — der Bildschirmfall, pixelgenau 1080 × 1080. */
function beitrag(): Vorlage {
  const w = werkzeuge('v2');
  const basis = erzeugeEntwurf(
    { organisationId: 'org-demo', name: 'Beitrag 1080', format: format('instagram-post') },
    w,
  );
  const { breite, hoehe } = basis.masse;
  const rand = basis.sicherheitsabstand;
  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  return {
    id: 'vorlage-beitrag',
    organisationId: 'org-demo',
    name: 'Beitrag 1080',
    beschreibung: 'Quadratischer Social-Beitrag',
    markenkitId: MARKENKIT.id,
    bauplan: {
      ...basis,
      markenkitId: MARKENKIT.id,
      seiten: [
        {
          ...erste,
          hintergrund: '#0a5c8a',
          elemente: [
            erzeugeForm(
              { x: rand, y: hoehe * 0.62, breite: breite - 2 * rand, hoehe: 8 },
              'rechteck',
              { name: 'Trennstrich', fuellung: '#e2a33c', gesperrt: true },
              w,
            ),
            erzeugeText(
              { x: rand, y: hoehe * 0.24, breite: breite - 2 * rand, hoehe: hoehe * 0.34 },
              'Jetzt anmelden',
              {
                name: 'Schlagzeile',
                schriftFamilie: MARKENSCHRIFT,
                schriftGroesse: Math.round(hoehe * 0.11),
                schriftStaerke: 700,
                farbe: '#ffffff',
                zeilenabstand: 1.05,
                platzhalter: {
                  schluessel: 'schlagzeile',
                  bearbeitbar: ['text'],
                  beschriftung: 'Schlagzeile',
                },
              },
              w,
            ),
            erzeugeText(
              { x: rand, y: hoehe * 0.68, breite: breite - 2 * rand, hoehe: hoehe * 0.16 },
              'Betriebsversammlung am 12. September, Hauptverwaltung.',
              {
                name: 'Zusatz',
                schriftFamilie: MARKENSCHRIFT,
                schriftGroesse: Math.round(hoehe * 0.038),
                schriftStaerke: 400,
                farbe: '#ffffff',
                zeilenabstand: 1.35,
                platzhalter: {
                  schluessel: 'zusatz',
                  bearbeitbar: ['text'],
                  beschriftung: 'Zusatz',
                },
              },
              w,
            ),
          ],
        },
      ],
    },
  };
}

export const VORLAGEN: readonly Vorlage[] = [aushang(), beitrag()];

/** Freier Entwurf ohne Platzhalter — für den Vergleich mit dem gesperrten Fall. */
export function freierEntwurf(): Entwurf {
  const w = werkzeuge('frei');
  const basis = erzeugeEntwurf(
    { organisationId: 'org-demo', name: 'Freier Entwurf', format: format('a5-hoch') },
    w,
  );
  const { breite, hoehe } = basis.masse;
  const rand = basis.sicherheitsabstand;
  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  return {
    ...basis,
    markenkitId: MARKENKIT.id,
    seiten: [
      {
        ...erste,
        hintergrund: '#ffffff',
        elemente: [
          erzeugeText(
            { x: rand, y: rand, breite: breite - 2 * rand, hoehe: hoehe * 0.12 },
            'Frei gestalten',
            {
              name: 'Titel',
              schriftFamilie: MARKENSCHRIFT,
              schriftGroesse: Math.round(hoehe * 0.045),
              schriftStaerke: 700,
              farbe: '#0a5c8a',
            },
            w,
          ),
          erzeugeForm(
            { x: rand, y: hoehe * 0.25, breite: breite * 0.4, hoehe: breite * 0.4 },
            'ellipse',
            { name: 'Kreis', fuellung: '#e2a33c' },
            w,
          ),
        ],
      },
    ],
  };
}
