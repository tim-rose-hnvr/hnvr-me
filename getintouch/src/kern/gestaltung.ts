/**
 * Gestaltung — wenige Entscheidungen, aus denen sich der Rest ergibt.
 *
 * Das Vorbild hatte achtzehn Vorlagen, zwölf Schriften und sechs Regler. Das
 * klingt nach Freiheit und ist in Wahrheit die Garantie dafür, dass die meisten
 * Seiten schlecht aussehen: jede Kombination ist erlaubt, keine ist geprüft.
 *
 * Hier gilt: Grundfarbe, Vordergrund, Akzent, Eckenradius, Stil der Schaltfläche
 * und Schrift. Nebentext, Kachelfüllung und Linien werden daraus abgeleitet, statt
 * einzeln einstellbar zu sein. Neun Vorlagen, jede in sich stimmig — genau so
 * viele, wie auf der Verkaufsseite versprochen werden.
 *
 * Und: freie Farbwahl bekommt einen Wächter. `pruefeLesbarkeit` sagt in Worten,
 * was nicht mehr lesbar ist, statt es hinzunehmen.
 */

export type Schaltflaechenstil = 'gefuellt' | 'kontur' | 'glas';
export type Bildform = 'rund' | 'karte';

export interface Schriftart {
  id: string;
  name: string;
  /** Vollständiger CSS-Stapel inklusive Rückfallebene. */
  css: string;
  /** Selbst ausgeliefert unter /schriften — kein CDN, kein Fremdaufruf. */
  eigen: boolean;
}

export const SCHRIFTEN: Schriftart[] = [
  {
    id: 'system',
    name: 'System',
    css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    eigen: false,
  },
  {
    id: 'dm',
    name: 'DM Sans',
    css: '"DM Sans", system-ui, sans-serif',
    eigen: true,
  },
  {
    id: 'clash',
    name: 'Clash Display',
    css: '"Clash Display", "DM Sans", system-ui, sans-serif',
    eigen: true,
  },
];

export function schrift(id: string): Schriftart {
  return SCHRIFTEN.find((s) => s.id === id) ?? SCHRIFTEN[0]!;
}

export interface Gestaltung {
  /** Kennung der Vorlage, aus der die Werte stammen. Nur zur Anzeige. */
  vorlage: string;
  grund: string;
  /** Zweite Grundfarbe für den Verlauf. Leer heißt: eine Farbe. */
  grund2: string;
  winkel: number;
  vordergrund: string;
  akzent: string;
  /** Schrift auf der Akzentfläche. */
  akzentText: string;
  radius: number;
  schaltflaeche: Schaltflaechenstil;
  bildform: Bildform;
  /** Schriftkennung für Fließtext. */
  schrift: string;
  /** Schriftkennung für Überschriften. */
  anzeige: string;
}

function g(werte: Partial<Gestaltung> & Pick<Gestaltung, 'vorlage' | 'grund' | 'vordergrund' | 'akzent' | 'akzentText'>): Gestaltung {
  return {
    grund2: '',
    winkel: 160,
    radius: 16,
    schaltflaeche: 'gefuellt',
    bildform: 'rund',
    schrift: 'dm',
    anzeige: 'clash',
    ...werte,
  };
}

/**
 * Neun Vorlagen. Die erste ist das Hausdesign von hnvr.me und bleibt die
 * Vorgabe — eine neue Seite sieht sofort nach etwas aus.
 */
export const VORLAGEN: Gestaltung[] = [
  g({ vorlage: 'hnvr', grund: '#0F0F0F', grund2: '#1B1B1B', vordergrund: '#F1EFEB', akzent: '#FF7120', akzentText: '#141410' }),
  // Weiße Schrift auf dem Hausorange kommt nur auf 2,8:1 — deshalb steht hier
  // dunkle Schrift auf der Hauptschaltfläche, nicht helle.
  g({ vorlage: 'creme', grund: '#F1EFEB', grund2: '#FFFFFF', vordergrund: '#141410', akzent: '#FF7120', akzentText: '#141410' }),
  g({ vorlage: 'tinte', grund: '#F7F7F5', vordergrund: '#111111', akzent: '#1D4ED8', akzentText: '#FFFFFF', radius: 6, schaltflaeche: 'kontur' }),
  g({ vorlage: 'ozean', grund: '#04121E', grund2: '#0B3C5C', vordergrund: '#EAF6FF', akzent: '#35C7F2', akzentText: '#04121E' }),
  g({ vorlage: 'wald', grund: '#08150F', grund2: '#12402A', vordergrund: '#E9F5EE', akzent: '#4ADE80', akzentText: '#062712' }),
  g({ vorlage: 'papier', grund: '#EFE7DA', grund2: '#FBF7F0', vordergrund: '#2B2118', akzent: '#B23A0C', akzentText: '#FFFFFF', radius: 10, bildform: 'karte' }),
  g({ vorlage: 'sand', grund: '#1C1A17', grund2: '#2A251E', vordergrund: '#F3EADB', akzent: '#E0B77A', akzentText: '#231D14', radius: 22 }),
  // Rosé statt Rot: #F43F5E trägt weiße Schrift nur mit 3,7:1, #E11D48 mit 4,7:1.
  g({ vorlage: 'abend', grund: '#150406', grund2: '#4A0D16', vordergrund: '#FFE9EC', akzent: '#E11D48', akzentText: '#FFFFFF', radius: 999, schaltflaeche: 'glas' }),
  g({ vorlage: 'stein', grund: '#FFFFFF', vordergrund: '#000000', akzent: '#000000', akzentText: '#FFFFFF', radius: 0, schaltflaeche: 'kontur', schrift: 'system', anzeige: 'system' }),
];

export const GESTALTUNG_VORGABE: Gestaltung = VORLAGEN[0]!;

export function vorlage(id: string): Gestaltung {
  return VORLAGEN.find((v) => v.vorlage === id) ?? GESTALTUNG_VORGABE;
}

/* ------------------------------------------------------------------ *
 * Farbe
 * ------------------------------------------------------------------ */

const HEX_MUSTER = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function istFarbe(wert: unknown): wert is string {
  return typeof wert === 'string' && HEX_MUSTER.test(wert.trim());
}

/** Hexwert nach RGB. Gibt null zurück, wenn der Wert keine Hexfarbe ist. */
export function zuRgb(farbe: string): [number, number, number] | null {
  const treffer = HEX_MUSTER.exec(String(farbe).trim());
  if (!treffer) return null;
  let h = treffer[1]!;
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mitDeckkraft(farbe: string, deckkraft: number): string {
  const rgb = zuRgb(farbe);
  if (!rgb) return farbe;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${deckkraft})`;
}

/** Relative Helligkeit nach WCAG 2.1. */
export function helligkeit(farbe: string): number {
  const rgb = zuRgb(farbe);
  if (!rgb) return 0;
  const [r, gr, b] = rgb.map((k) => {
    const v = k / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * gr + 0.0722 * b;
}

/** Kontrastverhältnis nach WCAG 2.1, zwischen 1 und 21. */
export function kontrast(a: string, b: string): number {
  const ha = helligkeit(a);
  const hb = helligkeit(b);
  return (Math.max(ha, hb) + 0.05) / (Math.min(ha, hb) + 0.05);
}

export function istDunkel(farbe: string): boolean {
  return helligkeit(farbe) < 0.34;
}

export interface Lesbarkeitsbefund {
  /** `warnung`: schwer lesbar. `fehler`: unter dem Mindestmaß von WCAG AA. */
  schwere: 'warnung' | 'fehler';
  meldung: string;
}

/**
 * Prüft, ob eine Gestaltung lesbar bleibt.
 *
 * Klartext statt Zahlen: „Der Fließtext hebt sich kaum vom Hintergrund ab"
 * hilft weiter, „Kontrast 3,1:1" nicht. Die Zahlen stehen trotzdem hinter der
 * Regel — 4,5:1 für Text, 3:1 für große Schrift, so wie WCAG AA es verlangt.
 */
export function pruefeLesbarkeit(gestaltung: Gestaltung): Lesbarkeitsbefund[] {
  const befunde: Lesbarkeitsbefund[] = [];
  const { grund, grund2, vordergrund, akzent, akzentText, schaltflaeche } = gestaltung;

  const gruende = grund2 ? [grund, grund2] : [grund];

  for (const b of gruende) {
    const k = kontrast(vordergrund, b);
    if (k < 4.5) {
      befunde.push({
        schwere: k < 3 ? 'fehler' : 'warnung',
        meldung: 'Der Fließtext hebt sich zu wenig vom Hintergrund ab. Vordergrund heller oder Hintergrund dunkler wählen.',
      });
      break;
    }
  }

  // Die Hauptaktion ist immer gefüllt, unabhängig vom gewählten Stil — dieser
  // Kontrast muss deshalb immer stimmen, nicht nur bei „gefüllt".
  const kHaupt = kontrast(akzentText, akzent);
  if (kHaupt < 4.5) {
    befunde.push({
      schwere: kHaupt < 3 ? 'fehler' : 'warnung',
      meldung:
        'Die Beschriftung auf der Hauptschaltfläche ist zu blass. Für helle Akzentfarben dunkle Schrift wählen und umgekehrt.',
    });
  }

  if (schaltflaeche !== 'gefuellt') {
    const k = Math.min(...gruende.map((b) => kontrast(akzent, b)));
    if (k < 3) {
      befunde.push({
        schwere: 'warnung',
        meldung: 'Die Umrisse der Schaltflächen verschwinden im Hintergrund. Kräftigere Akzentfarbe oder gefüllter Stil.',
      });
    }
  }

  // Der abgeleitete Nebentext liegt bei 62 % Deckkraft; darunter wird es zäh.
  for (const b of gruende) {
    if (kontrast(vordergrund, b) * 0.62 < 3) {
      befunde.push({
        schwere: 'warnung',
        meldung: 'Unterzeilen und Nebentext werden auf diesem Grund schwer lesbar.',
      });
      break;
    }
  }

  return befunde;
}

/**
 * Die abgeleiteten Werte, die als CSS-Variablen auf die Seite gehen.
 * Ein einziger Ort, an dem aus sechs Entscheidungen ein vollständiges Bild wird.
 */
export function cssVariablen(gestaltung: Gestaltung): Record<string, string> {
  const { grund, grund2, winkel, vordergrund, akzent, akzentText, radius } = gestaltung;
  const dunkel = istDunkel(grund);

  return {
    '--grund': grund2 ? `linear-gradient(${winkel}deg, ${grund}, ${grund2})` : grund,
    '--grund-fest': grund,
    '--vg': vordergrund,
    '--vg-neben': mitDeckkraft(vordergrund, 0.62),
    '--vg-leise': mitDeckkraft(vordergrund, 0.42),
    '--akzent': akzent,
    '--akzent-text': akzentText,
    '--akzent-schleier': mitDeckkraft(akzent, 0.14),
    // Auf dunklem Grund trägt eine aufgehellte Fläche, auf hellem eine abgedunkelte.
    '--kachel': mitDeckkraft(vordergrund, dunkel ? 0.06 : 0.04),
    '--kachel-aktiv': mitDeckkraft(vordergrund, dunkel ? 0.11 : 0.08),
    '--linie': mitDeckkraft(vordergrund, dunkel ? 0.14 : 0.12),
    '--radius': `${radius}px`,
    '--radius-klein': `${Math.min(radius, 14)}px`,
    '--schrift': schrift(gestaltung.schrift).css,
    '--anzeige': schrift(gestaltung.anzeige).css,
  };
}

/** Liest eine Gestaltung aus unbekannten Daten und meldet, was nicht stimmt. */
export function lieseGestaltung(roh: unknown): { gestaltung: Gestaltung | null; fehler: string[] } {
  const fehler: string[] = [];
  if (roh === undefined || roh === null) return { gestaltung: null, fehler };
  if (typeof roh !== 'object' || Array.isArray(roh)) {
    return { gestaltung: null, fehler: ['Erwartet wird ein Objekt oder gar nichts.'] };
  }

  const daten = roh as Record<string, unknown>;
  const basis = typeof daten.vorlage === 'string' ? vorlage(daten.vorlage) : GESTALTUNG_VORGABE;
  const heraus: Gestaltung = { ...basis };

  for (const feld of ['grund', 'grund2', 'vordergrund', 'akzent', 'akzentText'] as const) {
    const wert = daten[feld];
    if (wert === undefined) continue;
    if (feld === 'grund2' && wert === '') {
      heraus.grund2 = '';
      continue;
    }
    if (!istFarbe(wert)) {
      fehler.push(`„${feld}" muss eine Hexfarbe sein, z. B. #FF7120.`);
      continue;
    }
    heraus[feld] = wert.trim();
  }

  if (typeof daten.radius === 'number' && daten.radius >= 0 && daten.radius <= 999) {
    heraus.radius = daten.radius;
  }
  if (typeof daten.winkel === 'number') heraus.winkel = ((daten.winkel % 360) + 360) % 360;
  if (daten.schaltflaeche === 'gefuellt' || daten.schaltflaeche === 'kontur' || daten.schaltflaeche === 'glas') {
    heraus.schaltflaeche = daten.schaltflaeche;
  }
  if (daten.bildform === 'rund' || daten.bildform === 'karte') heraus.bildform = daten.bildform;
  if (typeof daten.schrift === 'string') heraus.schrift = schrift(daten.schrift).id;
  if (typeof daten.anzeige === 'string') heraus.anzeige = schrift(daten.anzeige).id;

  return { gestaltung: heraus, fehler };
}
