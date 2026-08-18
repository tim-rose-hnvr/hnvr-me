/**
 * Druckformate und Druckschriften — die eine Quelle für Booth und Editor.
 *
 * Übernommen aus der laufenden Fassung 1.30 (`public/formate.js`) und in
 * unsere Sprache gebracht. Die Warnung von dort gilt hier genauso: Standen
 * die Maße an zwei Stellen, rechnete der Editor mit einem anderen Blatt als
 * der Druck — bei 41 von 78 Vorlagen lag die Bühne quer statt hoch, und jede
 * dort gezogene Position saß auf dem Papier woanders.
 *
 * Alle Maße bei 300 dpi. `rand` ist der Anschnitt in Blattpunkten.
 */

export type Formatschluessel =
  | 'streifen-2x6'
  | 'postkarte-4x6'
  | 'hoch-4x6'
  | 'quadrat-4x4'
  | 'gross-5x7'
  | 'magnet'
  | 'lesezeichen';

export type Format = {
  name: string;
  kurz: string;
  breite: number;
  hoehe: number;
  mmBreite: number;
  mmHoehe: number;
  rand: number;
};

export const FORMATE: Record<Formatschluessel, Format> = {
  'streifen-2x6': { name: 'Streifen 2×6″', kurz: '5 × 15 cm', breite: 600, hoehe: 1800, mmBreite: 50, mmHoehe: 150, rand: 15 },
  'postkarte-4x6': { name: 'Postkarte 4×6″ quer', kurz: '15 × 10 cm', breite: 1800, hoehe: 1200, mmBreite: 150, mmHoehe: 100, rand: 15 },
  'hoch-4x6': { name: 'Postkarte 4×6″ hoch', kurz: '10 × 15 cm', breite: 1200, hoehe: 1800, mmBreite: 100, mmHoehe: 150, rand: 15 },
  'quadrat-4x4': { name: 'Quadrat 4×4″', kurz: '10 × 10 cm', breite: 1200, hoehe: 1200, mmBreite: 100, mmHoehe: 100, rand: 15 },
  'gross-5x7': { name: 'Groß 5×7″', kurz: '13 × 18 cm', breite: 1500, hoehe: 2100, mmBreite: 127, mmHoehe: 178, rand: 15 },
  magnet: { name: 'Magnet 2,5×3,5″', kurz: '6 × 9 cm', breite: 750, hoehe: 1050, mmBreite: 64, mmHoehe: 89, rand: 12 },
  lesezeichen: { name: 'Lesezeichen 2×7″', kurz: '5 × 18 cm', breite: 600, hoehe: 2100, mmBreite: 50, mmHoehe: 178, rand: 15 },
};

export const FORMATLISTE = Object.keys(FORMATE) as Formatschluessel[];

export function formatVon(schluessel: string | undefined): Format {
  return FORMATE[(schluessel as Formatschluessel) ?? 'hoch-4x6'] ?? FORMATE['hoch-4x6'];
}

export function istFormat(wert: unknown): wert is Formatschluessel {
  return typeof wert === 'string' && wert in FORMATE;
}

/* ------------------------------------------------------------------ */
/* Schriften                                                           */
/* ------------------------------------------------------------------ */

/**
 * Die Druckschriften. Zwei davon sind unsere Hausschriften, die übrigen
 * gehören zum Vorlagenkatalog: Die 59 übernommenen Vorlagen sind mit Fraunces
 * (57×) und Space Grotesk (12×) gesetzt worden. Sie durch unsere zu ersetzen
 * hieße, ein gekauftes Blatt neu zu setzen — der Umbruch säße dann anders.
 *
 * Alle liegen als woff2 auf der Box (`public/schrift/`). Kein Abruf nach
 * außen: Eine Fotobox steht regelmäßig in einer Scheune ohne Netz.
 */
export type Schriftart = 'anzeige' | 'mono' | 'serif' | 'sans' | 'display' | 'klassisch';

type Schriftbau = (groesse: number, fett?: boolean) => string;

export const DRUCKSCHRIFTEN: Record<Schriftart, Schriftbau> = {
  // Unsere beiden — Vorgabe für alles, was neu entsteht.
  anzeige: (s, b) => `${b ? 800 : 600} ${s}px Archivo, 'Archivo Variable', system-ui, sans-serif`,
  mono: (s, b) => `${b ? 600 : 400} ${s}px 'IBM Plex Mono', ui-monospace, monospace`,
  // Aus dem Katalog.
  serif: (s, b) => `italic ${b ? 700 : 600} ${s}px Fraunces, Georgia, serif`,
  sans: (s, b) => `${b ? 700 : 400} ${s}px 'Space Grotesk', system-ui, sans-serif`,
  display: (s) => `400 ${s}px Anton, 'Arial Narrow', sans-serif`,
  klassisch: (s, b) => `${b ? 700 : 400} ${s}px Georgia, serif`,
};

export const SCHRIFTNAMEN: Record<Schriftart, string> = {
  anzeige: 'Anzeige (Archivo)',
  mono: 'Mono (IBM Plex)',
  serif: 'Serif (Fraunces)',
  sans: 'Grotesk (Space Grotesk)',
  display: 'Plakat (Anton)',
  klassisch: 'Klassisch (Georgia)',
};

/** Familienname zum Vorladen — ohne Größe, nur der Name. */
const FAMILIEN: Record<Schriftart, string> = {
  anzeige: 'Archivo',
  mono: 'IBM Plex Mono',
  serif: 'Fraunces',
  sans: 'Space Grotesk',
  display: 'Anton',
  klassisch: 'Georgia',
};

export function schriftbau(art: Schriftart | undefined): Schriftbau {
  return DRUCKSCHRIFTEN[art ?? 'anzeige'] ?? DRUCKSCHRIFTEN.anzeige;
}

/**
 * Vor dem Zeichnen die gebrauchten Schriften wirklich laden.
 *
 * Der stille Fehler, den das verhindert: `fillText` wartet auf nichts. Ist
 * die Schrift noch nicht da, zeichnet die Leinwand klaglos in der
 * Ersatzschrift — am Screen kaum zu sehen, auf dem Abzug sehr wohl, und
 * niemand bekommt eine Meldung.
 */
export async function schriftenBereit(arten: Iterable<Schriftart | undefined>): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const gebraucht = new Set<string>();
  for (const a of arten) {
    const familie = FAMILIEN[a ?? 'anzeige'];
    if (familie && familie !== 'Georgia') gebraucht.add(familie);
  }
  await Promise.all(
    [...gebraucht].map((f) => document.fonts.load(`40px "${f}"`).catch(() => null))
  );
}

/** Dreht um den eigenen Mittelpunkt. Ohne Winkel passiert nichts. */
export function gedreht(
  stift: CanvasRenderingContext2D,
  grad: number | undefined,
  mx: number,
  my: number
): void {
  if (!grad) return;
  stift.translate(mx, my);
  stift.rotate((grad * Math.PI) / 180);
  stift.translate(-mx, -my);
}
