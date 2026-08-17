/** Die Aufnahmearten, wie sie am Screen angeboten werden. */

export type Art = {
  id: string;
  name: string;
  zeilen: string[];
  /** Anzahl Einzelaufnahmen. */
  bilder: number;
  /** Sekunden zwischen zwei Aufnahmen einer Serie. */
  pause: number;
  /** Bewegtbild: wird am Screen animiert gezeigt. */
  bewegt: boolean;
};

export const ARTEN: Art[] = [
  { id: 'foto', name: 'Foto', zeilen: ['Ein Bild', 'Druck möglich'], bilder: 1, pause: 0, bewegt: false },
  {
    id: 'streifen',
    name: 'Streifen',
    zeilen: ['3 Bilder', 'Doppelstreifen'],
    bilder: 3,
    pause: 1.6,
    bewegt: false,
  },
  {
    id: 'boomerang',
    name: 'Boomerang',
    zeilen: ['Vor & zurück', 'Ohne Ton'],
    bilder: 8,
    pause: 0.12,
    bewegt: true,
  },
  { id: 'gif', name: 'GIF', zeilen: ['4 Bilder', 'Pingpong an'], bilder: 4, pause: 0.5, bewegt: true },
];

export function findeArt(id: string): Art {
  return ARTEN.find((a) => a.id === id) ?? ARTEN[0]!;
}

/** Regieanweisungen — je Aufnahme eine, damit niemand ratlos dasteht. */
export const REGIE = [
  'Alle ins Bild — Blick nach oben!',
  'Näher zusammen!',
  'Jetzt die beste Grimasse!',
  'Noch einmal groß lächeln!',
];
