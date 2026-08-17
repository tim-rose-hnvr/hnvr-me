/**
 * Eine Aussage, fünf Ausspielungen.
 *
 * Die Ausspielungen enthalten **keinen Text**. Ihre Platzhalter binden auf
 * Felder der Aussage; der Inhalt wird beim Anzeigen aufgelöst. Das ist der
 * ganze Unterschied zu jedem Werkzeug am Markt: dort wären das fünf Kopien,
 * die ab dem ersten Umformatieren auseinanderlaufen.
 *
 * Die Formate widersprechen sich bewusst: auf das A1-Plakat passt der lange
 * Titel, in die Story nur der kurze. Genau daran zeigt sich, wozu
 * Kürzungsstufen da sind.
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
  type Markenkit,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';

export const MARKENSCHRIFT = 'Markenschrift';

export const MARKENKIT: Markenkit = {
  id: 'kit-demo',
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

/** Die Quelle. Ein Termin, ein Ort, ein Titel — jeweils in bis zu drei Längen. */
export const AUSSAGE: Aussage = {
  id: 'aussage-sommerfest',
  organisationId: 'org-demo',
  name: 'Sommerfest 2026',
  felder: {
    titel: feldwert('Sommerfest der Hauptverwaltung', 'Sommerfest 2026', 'Sommerfest'),
    untertitel: feldwert(
      'Alle Mitarbeitenden und ihre Familien sind herzlich eingeladen',
      'Für alle Mitarbeitenden und Familien',
      'Für alle',
    ),
    ort: feldwert('Hauptverwaltung, Innenhof Gebäude C', 'Innenhof Gebäude C', 'Gebäude C'),
    handlung: feldwert(
      'Anmeldung bis zum 5. September bei der Geschäftsstellenleitung',
      'Anmeldung bis 5. September',
      'Jetzt anmelden',
    ),
  },
  termin: '2026-09-12T00:00:00.000Z',
  erstelltAm: '2026-08-01T00:00:00.000Z',
  geaendertAm: '2026-08-01T00:00:00.000Z',
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
 * Eine Ausspielung: ein Entwurf plus das, was das Format über seine Nutzung
 * weiß. Der Leseabstand ist keine Gestaltungsfrage, sondern eine Tatsache über
 * das Medium — ein Plakat hängt an der Wand, eine Story liegt in der Hand.
 */
export interface Ausspielung {
  id: string;
  name: string;
  medium: 'Druck' | 'Bildschirm';
  leseabstandMeter: number;
  plattform?: string;
  entwurf: Entwurf;
}

/**
 * Größen als Anteil der Formathöhe **plus die vorgesehene Zeilenzahl**.
 *
 * Die Zeilenzahl ist der Punkt: ein Rahmen, der beliebig viele Zeilen zulässt,
 * nimmt jeden Text an — und dann wählt jedes Format dieselbe lange Fassung.
 * Eine echte Vorlage sieht für die Schlagzeile eine, zwei oder drei Zeilen vor,
 * und genau daraus ergibt sich, welche Kürzungsstufe hineinpasst. Ein
 * LinkedIn-Banner hat eine Zeile, ein A1-Plakat drei.
 */
interface Groessen {
  titel: number;
  titelZeilen: number;
  untertitel: number;
  untertitelZeilen: number;
  termin: number;
  dunkel: boolean;
}

/** Baut aus einem Format ein gebundenes Layout. Nirgends steht hier Text. */
function baue(
  id: string,
  name: string,
  formatSchluessel: string,
  medium: Ausspielung['medium'],
  leseabstandMeter: number,
  g: Groessen,
  plattform?: string,
): Ausspielung {
  const w = werkzeuge(id);
  const basis = erzeugeEntwurf(
    { organisationId: 'org-demo', name, format: format(formatSchluessel) },
    w,
  );
  const { breite, hoehe } = basis.masse;
  const an = basis.anschnitt.links;
  const rand = basis.sicherheitsabstand;
  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  const grund = g.dunkel ? '#0a5c8a' : '#ffffff';
  const fliess = g.dunkel ? '#ffffff' : '#000000';
  const hervor = g.dunkel ? '#e2a33c' : '#0a5c8a';

  const platz = (bindung: string) => ({
    schluessel: bindung,
    bearbeitbar: ['text'] as const,
    beschriftung: null,
    bindung,
  });

  const ZEILENABSTAND = 1.15;

  /** Rahmen aus Schriftgröße und Zeilenzahl — nicht umgekehrt. */
  const text = (
    elementName: string,
    bindung: string,
    y: number,
    anteil: number,
    zeilen: number,
    farbe: string,
    staerke: number,
    einzug = rand,
  ) => {
    const groesse = Math.max(8, Math.round(hoehe * anteil));
    return erzeugeText(
      { x: einzug, y, breite: breite - 2 * einzug, hoehe: groesse * ZEILENABSTAND * zeilen },
      '',
      {
        name: elementName,
        schriftFamilie: MARKENSCHRIFT,
        schriftGroesse: groesse,
        schriftStaerke: staerke,
        farbe,
        zeilenabstand: ZEILENABSTAND,
        platzhalter: platz(bindung),
      },
      w,
    );
  };

  const elemente = [
    ...(g.dunkel
      ? []
      : [
          erzeugeForm(
            { x: -an, y: -an, breite: breite + 2 * an, hoehe: hoehe * 0.36 + an },
            'rechteck',
            { name: 'Kopfbalken', fuellung: '#0a5c8a', gesperrt: true },
            w,
          ),
        ]),
    text('Titel', 'titel', hoehe * 0.07, g.titel, g.titelZeilen, '#ffffff', 700),
    text('Untertitel', 'untertitel', hoehe * 0.44, g.untertitel, g.untertitelZeilen, fliess, 400),
    text('Termin', 'termin', hoehe * 0.62, g.termin, 1, hervor, 700),
    text('Ort', 'ort', hoehe * 0.72, g.termin * 0.58, 1, fliess, 400),
    erzeugeForm(
      { x: rand, y: hoehe * 0.84, breite: breite - 2 * rand, hoehe: hoehe * 0.085 },
      'rechteck',
      { name: 'Handlungsfeld', fuellung: '#e2a33c', gesperrt: true },
      w,
    ),
    text('Handlung', 'handlung', hoehe * 0.858, g.termin * 0.5, 1, '#000000', 700, rand * 1.6),
  ];

  return {
    id,
    name,
    medium,
    leseabstandMeter,
    ...(plattform === undefined ? {} : { plattform }),
    entwurf: {
      ...basis,
      markenkitId: MARKENKIT.id,
      seiten: [{ ...erste, hintergrund: grund, elemente }],
    },
  };
}

/**
 * Die fünf Ausspielungen. Ihre Rahmen sind so bemessen, wie die Formate
 * tatsächlich gebaut werden — und deshalb wählen sie unterschiedliche
 * Kürzungsstufen: das Plakat nimmt die lange Fassung, die Story die mittlere,
 * der LinkedIn-Banner mit seiner einen breiten Zeile die kurze.
 */
export const AUSSPIELUNGEN: readonly Ausspielung[] = [
  baue('plakat', 'Plakat A1', 'plakat-a1', 'Druck', 3, {
    titel: 0.055,
    titelZeilen: 3,
    untertitel: 0.021,
    untertitelZeilen: 2,
    termin: 0.034,
    dunkel: false,
  }),
  baue('aushang', 'Aushang A5', 'a5-hoch', 'Druck', 0.5, {
    titel: 0.055,
    titelZeilen: 3,
    untertitel: 0.021,
    untertitelZeilen: 2,
    termin: 0.032,
    dunkel: false,
  }),
  baue(
    'story',
    'Instagram Story',
    'instagram-story',
    'Bildschirm',
    0.35,
    {
      // 0,09 wäre die schönere Schlagzeile — aber dann bricht schon
      // „Sommerfest" mit Trennstrich um, die Story fällt auf die kurze Fassung
      // zurück und unterscheidet sich nicht mehr vom LinkedIn-Banner. Die
      // Größe folgt hier dem, was der Satz hergibt, nicht dem Wunsch.
      titel: 0.072,
      titelZeilen: 2,
      untertitel: 0.024,
      untertitelZeilen: 2,
      termin: 0.032,
      dunkel: true,
    },
    'instagram-story',
  ),
  baue(
    'beitrag',
    'Instagram Beitrag',
    'instagram-post',
    'Bildschirm',
    0.35,
    {
      titel: 0.12,
      titelZeilen: 2,
      untertitel: 0.033,
      untertitelZeilen: 2,
      termin: 0.046,
      dunkel: true,
    },
    'instagram-post',
  ),
  baue(
    'linkedin',
    'LinkedIn Beitrag',
    'linkedin-post',
    'Bildschirm',
    0.4,
    {
      titel: 0.24,
      titelZeilen: 1,
      untertitel: 0.06,
      untertitelZeilen: 1,
      termin: 0.075,
      dunkel: true,
    },
    'linkedin-post',
  ),
];
