/**
 * Das Einbindungsskript einer gedachten Fremdseite.
 *
 * Genau so würde ein Kunde den Baustein benutzen: registrieren, Aussage und
 * Ausspielungen setzen, auf Änderungen hören. Nichts hier greift in das
 * Innenleben des Elements.
 */

import {
  type Aussage,
  type Entwurf,
  erzeugeEntwurf,
  erzeugeForm,
  erzeugeText,
  type Format,
  feldwert,
  festeUhr,
  formatNachSchluessel,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';
import { SCHRIFTEN } from '../../../apps/studio/src/schriften.js';
import { type AussageGeaendert, type EingebetteteAusspielung, registriere } from '../src/index.js';

const MARKENSCHRIFT = 'Markenschrift';

const AUSSAGE: Aussage = {
  id: 'aussage-1',
  organisationId: 'org-demo',
  name: 'Sommerfest 2026',
  felder: {
    titel: feldwert('Sommerfest der Hauptverwaltung', 'Sommerfest 2026', 'Sommerfest'),
    untertitel: feldwert(
      'Alle Mitarbeitenden sind eingeladen',
      'Für alle Mitarbeitenden',
      'Für alle',
    ),
  },
  termin: '2026-09-12T00:00:00.000Z',
  erstelltAm: '2026-01-01T00:00:00.000Z',
  geaendertAm: '2026-01-01T00:00:00.000Z',
};

function werkzeuge(praefix: string): Werkzeuge {
  return { neueId: zaehlerId(praefix), jetzt: festeUhr('2026-08-17T00:00:00.000Z') };
}

function format(schluessel: string): Format {
  const f = formatNachSchluessel(schluessel);
  if (f === null) throw new Error(`Format "${schluessel}" fehlt`);
  return f;
}

function baue(
  id: string,
  name: string,
  formatSchluessel: string,
  titelAnteil: number,
  titelZeilen: number,
): EingebetteteAusspielung {
  const w = werkzeuge(id);
  const basis: Entwurf = erzeugeEntwurf(
    { organisationId: 'org-demo', name, format: format(formatSchluessel), aussageId: AUSSAGE.id },
    w,
  );
  const { breite, hoehe } = basis.masse;
  const rand = basis.sicherheitsabstand;
  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  const titelGroesse = Math.max(8, Math.round(hoehe * titelAnteil));
  const untertitelGroesse = Math.max(8, Math.round(hoehe * 0.03));

  const elemente = [
    erzeugeForm(
      { x: 0, y: 0, breite, hoehe },
      'rechteck',
      { name: 'Grund', fuellung: '#0a5c8a', gesperrt: true },
      w,
    ),
    erzeugeText(
      {
        x: rand,
        y: hoehe * 0.12,
        breite: breite - 2 * rand,
        hoehe: titelGroesse * 1.15 * titelZeilen,
      },
      '',
      {
        name: 'Titel',
        schriftFamilie: MARKENSCHRIFT,
        schriftGroesse: titelGroesse,
        schriftStaerke: 700,
        farbe: '#ffffff',
        zeilenabstand: 1.15,
        platzhalter: {
          schluessel: 'titel',
          bearbeitbar: ['text'],
          beschriftung: null,
          bindung: 'titel',
        },
      },
      w,
    ),
    erzeugeText(
      { x: rand, y: hoehe * 0.62, breite: breite - 2 * rand, hoehe: untertitelGroesse * 1.15 * 2 },
      '',
      {
        name: 'Untertitel',
        schriftFamilie: MARKENSCHRIFT,
        schriftGroesse: untertitelGroesse,
        farbe: '#ffffff',
        zeilenabstand: 1.15,
        platzhalter: {
          schluessel: 'untertitel',
          bearbeitbar: ['text'],
          beschriftung: null,
          bindung: 'untertitel',
        },
      },
      w,
    ),
  ];

  // Der Leseabstand ist keine Gestaltungsfrage, sondern eine Tatsache über das
  // Medium: ein Plakat hängt an der Wand, ein Beitrag liegt in der Hand.
  const bildschirm = formatSchluessel !== 'plakat-a1';

  return {
    id,
    name,
    medium: bildschirm ? 'Bildschirm' : 'Druck',
    leseabstandMeter: bildschirm ? 0.4 : 3,
    ...(bildschirm ? { plattform: formatSchluessel } : {}),
    entwurf: { ...basis, seiten: [{ ...erste, hintergrund: '#0a5c8a', elemente }] },
  };
}

registriere();

const element = document.querySelector('design-studio');
if (element === null) throw new Error('Baustein nicht gefunden');

// Reihenfolge wie in echt: erst Schriften, dann Daten.
Object.assign(element, {
  schriften: SCHRIFTEN,
  heute: new Date('2026-08-17T00:00:00.000Z'),
  aussage: AUSSAGE,
  ausspielungen: [
    baue('plakat', 'Plakat A1', 'plakat-a1', 0.055, 3),
    baue('story', 'Instagram Story', 'instagram-story', 0.072, 2),
    baue('linkedin', 'LinkedIn Beitrag', 'linkedin-post', 0.24, 1),
  ],
});

// Was der Einbettende mitbekommt: jede Änderung, mit dem betroffenen Feld.
const protokoll: AussageGeaendert[] = [];
element.addEventListener('aussage-geaendert', (e) => {
  protokoll.push((e as CustomEvent<AussageGeaendert>).detail);
});
Object.assign(globalThis, { protokoll });
