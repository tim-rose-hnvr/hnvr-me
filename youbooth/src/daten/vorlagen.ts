/**
 * Sechzehn Beispiel-Layouts aus der Bibliothek (240 Designs).
 * Jedes Beispiel wird aus einem „Rezept" gezeichnet — siehe Vorlagenblatt.astro.
 * Vorlagen sind Teil der Lizenz: kein Preis, kein Warenkorb.
 */

export type Rezept =
  | 'rahmen'
  | 'bleed'
  | 'kranz'
  | 'split'
  | 'deco'
  | 'kirmes'
  | 'neon'
  | 'girlande'
  | 'ringe'
  | 'winter'
  | 'karo'
  | 'film'
  | 'xxl'
  | 'marmor'
  | 'ticket'
  | 'bogen';

export type Vorlage = {
  name: string;
  anlass: string;
  merkmal: string;
  formate: string[];
  /** Farbe der Ablage hinter dem Blatt. */
  ablage: string;
  /** Farbe des Blattes selbst. */
  blatt: string;
  akzent: string;
  titel: string;
  unterzeile: string;
  rezept: Rezept;
};

export const formate = ['10×15', '13×18', '15×20', 'Streifen', '4er', 'Screen'];

export const vorlagen: Vorlage[] = [
  {
    name: 'Goldrahmen mit Medaillon',
    anlass: 'Hochzeit',
    merkmal: 'Doppellinie, Monogramm',
    formate: ['10×15', 'Streifen', '4er', 'Screen'],
    ablage: '#efe7d8',
    blatt: '#fff',
    akzent: '#b99b58',
    titel: 'Lena & Jonas',
    unterzeile: '15 · 08 · 2026',
    rezept: 'rahmen',
  },
  {
    name: 'Gold Bokeh randlos',
    anlass: 'Hochzeit',
    merkmal: 'Lichtflecken, Verlauf',
    formate: ['10×15', '13×18', 'Streifen'],
    ablage: '#e8ded0',
    blatt: '#dcd6cb',
    akzent: '#8a7440',
    titel: 'Für die Ewigkeit',
    unterzeile: 'Gut Hügelhof',
    rezept: 'bleed',
  },
  {
    name: 'Botanik-Kränze',
    anlass: 'Hochzeit',
    merkmal: 'Ringe, Salbeigrün',
    formate: ['10×15', 'Streifen', 'Screen'],
    ablage: '#dfe6df',
    blatt: '#f7f5ef',
    akzent: '#3c5240',
    titel: 'Eukalyptus',
    unterzeile: 'Herne · 2026',
    rezept: 'kranz',
  },
  {
    name: 'Farbfeld-Split',
    anlass: 'Hochzeit',
    merkmal: 'Fläche statt Rahmen',
    formate: ['10×15', '13×18', '4er', 'Screen'],
    ablage: '#efe9de',
    blatt: '#fff',
    akzent: '#8e2b26',
    titel: 'Danke, dass ihr da wart',
    unterzeile: '15.08.2026',
    rezept: 'split',
  },
  {
    name: 'Art-Déco Ecken',
    anlass: 'Party',
    merkmal: 'Goldkante, Winkel',
    formate: ['10×15', 'Streifen', '4er'],
    ablage: '#141419',
    blatt: '#0b0b0d',
    akzent: '#F2B23E',
    titel: 'Roaring Night',
    unterzeile: '2026',
    rezept: 'deco',
  },
  {
    name: 'Kirmes-Kante',
    anlass: 'Party',
    merkmal: 'Jahrmarkt-Streifen',
    formate: ['Streifen', '10×15', 'Screen'],
    ablage: '#8e2b26',
    blatt: '#f3ece0',
    akzent: '#8e2b26',
    titel: 'Photo Automat',
    unterzeile: 'Seit 1962',
    rezept: 'kirmes',
  },
  {
    name: 'Neon-Nebel',
    anlass: 'Party',
    merkmal: 'Weiche Farbwolken',
    formate: ['10×15', 'Streifen', '4er'],
    ablage: '#e9e3f0',
    blatt: '#fbf9ff',
    akzent: '#6b4a86',
    titel: 'Tanz bis 4 Uhr',
    unterzeile: 'Club Nacht',
    rezept: 'neon',
  },
  {
    name: 'Girlandenband',
    anlass: 'Geburtstag',
    merkmal: 'Diagonalstreifen',
    formate: ['10×15', 'Streifen', '4er', 'Screen'],
    ablage: '#f0e2c4',
    blatt: '#fffdf7',
    akzent: '#e0483c',
    titel: 'Happy Birthday',
    unterzeile: '40 Jahre',
    rezept: 'girlande',
  },
  {
    name: 'Feuerwerk-Ringe',
    anlass: 'Saison',
    merkmal: 'Lichtkreise, Nachtblau',
    formate: ['10×15', 'Streifen', 'Screen'],
    ablage: '#1b1b22',
    blatt: '#101015',
    akzent: '#F2B23E',
    titel: 'Prost 2027',
    unterzeile: 'Silvester',
    rezept: 'ringe',
  },
  {
    name: 'Winterlicht',
    anlass: 'Saison',
    merkmal: 'Schneepunkte, Kaltweiß',
    formate: ['10×15', 'Streifen', '4er'],
    ablage: '#e4eaee',
    blatt: '#f7fafb',
    akzent: '#5d7b8a',
    titel: 'Frohe Feiertage',
    unterzeile: 'Weihnachtsfeier',
    rezept: 'winter',
  },
  {
    name: 'Terrazzo-Karo',
    anlass: 'Sweet 16',
    merkmal: 'Mustergrund',
    formate: ['10×15', '4er', 'Screen'],
    ablage: '#eae6df',
    blatt: '#fff',
    akzent: '#17171c',
    titel: 'Sweet Sixteen',
    unterzeile: '2026',
    rezept: 'karo',
  },
  {
    name: 'Filmrolle mit Perforation',
    anlass: 'Abschluss',
    merkmal: 'Kleinbild-Anmutung',
    formate: ['10×15', 'Streifen', '4er'],
    ablage: '#101014',
    blatt: '#0b0b0d',
    akzent: '#F2B23E',
    titel: 'Abi 2026',
    unterzeile: 'Rolle 36',
    rezept: 'film',
  },
  {
    name: 'Zahl XXL im Bild',
    anlass: 'Abschluss',
    merkmal: 'Typo über Foto',
    formate: ['10×15', '13×18', '4er'],
    ablage: '#eceae5',
    blatt: '#dcd6cb',
    akzent: '#17171c',
    titel: '26',
    unterzeile: 'Jahrgang',
    rezept: 'xxl',
  },
  {
    name: 'Marmor-Streifen',
    anlass: 'Firmen',
    merkmal: 'Logo-Slot',
    formate: ['10×15', '15×20', '4er', 'Screen'],
    ablage: '#dcd8d2',
    blatt: '#f4f2ee',
    akzent: '#17171c',
    titel: 'Jahrestagung',
    unterzeile: 'Halle 3',
    rezept: 'marmor',
  },
  {
    name: 'Ticket-Perforation',
    anlass: 'Firmen',
    merkmal: 'Abrisskante',
    formate: ['10×15', 'Streifen', 'Screen'],
    ablage: '#ece7dd',
    blatt: '#fff',
    akzent: '#17171c',
    titel: 'Eintritt frei',
    unterzeile: 'Foto-Ticket',
    rezept: 'ticket',
  },
  {
    name: 'Bogen & Sonne',
    anlass: 'Party',
    merkmal: 'Arch-Ausschnitt',
    formate: ['10×15', 'Streifen', 'Screen'],
    ablage: '#f2e6cf',
    blatt: '#fffaf0',
    akzent: '#e0973c',
    titel: 'Sommerfest',
    unterzeile: 'Auf der Wiese',
    rezept: 'bogen',
  },
];

export const anlaesseDerVorlagen = [...new Set(vorlagen.map((v) => v.anlass))];

/** Umfang der vollstaendigen Bibliothek im Konto. */
export const bibliothek = {
  gesamt: 240,
  sammlungen: [
    { titel: 'Hochzeit · 64', text: 'Goldrahmen, Botanik, Farbfeld, Monogramm, randlos.' },
    { titel: 'Saison · 45', text: 'Weihnachten, Silvester, Karneval, Oktoberfest, Sommer.' },
    { titel: 'Firmen · 26', text: 'Logo-Slot, Marmor, Ticket-Kante, Raster — White-Label-fähig.' },
  ],
};
