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

import { MARKENFARBEN } from './marke.ts';

export type Schaltflaechenstil = 'gefuellt' | 'kontur' | 'glas';
export type Bildform = 'rund' | 'karte';

/**
 * Der Aufbau — wie die Seite angeordnet ist, nicht wie sie eingefärbt ist.
 *
 * Das ist die Achse, an der sich entscheidet, ob ein Baukasten wirklich
 * verschiedene Designs hat oder nur verschiedene Anstriche. Vorlagen, die sich
 * bloß in Farbe und Schrift unterscheiden, sind ein Design mit n Lackierungen —
 * genau der Vorwurf, den dieses Programm der Konkurrenz macht, und den es sich
 * eine Zeit lang selbst hat gefallen lassen müssen.
 *
 *  - `liste`  Untereinander, links ausgerichtet. Ruhig, schnell zu erfassen,
 *             richtig für reine Kontaktseiten.
 *  - `bento`  Ein Gitter aus verschieden großen Karten. Was ein Besucher als
 *             „modern" liest, und die Anordnung, die viele Wege verträgt,
 *             ohne zur Liste zu werden.
 *  - `held`   Ein Titelbild über die volle Breite, Name und Status darauf.
 *             Für alle, deren Arbeit man sehen muss, bevor man anruft:
 *             Handwerk, Gastronomie, Salon.
 */
export type Aufbau = 'liste' | 'bento' | 'held';

export const AUFBAUTEN: { kennung: Aufbau; name: string; beschreibung: string }[] = [
  { kennung: 'liste', name: 'Liste', beschreibung: 'Untereinander, links ausgerichtet. Ruhig und schnell zu erfassen.' },
  { kennung: 'bento', name: 'Bento', beschreibung: 'Ein Gitter aus verschieden großen Karten. Verträgt viele Wege.' },
  { kennung: 'held', name: 'Held', beschreibung: 'Titelbild über die volle Breite, Name und Status darauf.' },
];

export interface Schriftart {
  id: string;
  name: string;
  /** Vollständiger CSS-Stapel inklusive Rückfallebene. */
  css: string;
  /** Selbst ausgeliefert unter /schriften — kein CDN, kein Fremdaufruf. */
  eigen: boolean;
  /** `anzeige` taugt nur für Überschriften, `beides` auch als Fließtext. */
  zweck: 'anzeige' | 'beides';
}

/**
 * Dreizehn Familien, alle selbst ausgeliefert. Deklariert sind sie alle, geladen
 * wird nur, was eine Seite tatsächlich benutzt — so verlangt es die Norm für
 * `@font-face`. Das Angebot kostet eine Profilseite deshalb kein einziges Byte.
 *
 * `zweck` sagt, wofür eine Familie taugt. Plakatschriften wie Anton oder Bebas
 * sind als Fließtext unlesbar; der Editor soll sie später gar nicht erst zur
 * Auswahl stellen, wo sie schaden.
 */
export const SCHRIFTEN: Schriftart[] = [
  { id: 'archivo', name: 'Archivo', css: '"Archivo", system-ui, sans-serif', eigen: true, zweck: 'beides' },
  { id: 'system', name: 'System', css: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', eigen: false, zweck: 'beides' },
  { id: 'dm', name: 'DM Sans', css: '"DM Sans", system-ui, sans-serif', eigen: true, zweck: 'beides' },
  { id: 'inter', name: 'Inter', css: '"Inter", system-ui, sans-serif', eigen: true, zweck: 'beides' },
  { id: 'poppins', name: 'Poppins', css: '"Poppins", system-ui, sans-serif', eigen: true, zweck: 'beides' },
  { id: 'space', name: 'Space Grotesk', css: '"Space Grotesk", system-ui, sans-serif', eigen: true, zweck: 'beides' },
  { id: 'syne', name: 'Syne', css: '"Syne", system-ui, sans-serif', eigen: true, zweck: 'beides' },
  { id: 'playfair', name: 'Playfair Display', css: '"Playfair Display", Georgia, serif', eigen: true, zweck: 'beides' },
  { id: 'fraunces', name: 'Fraunces', css: '"Fraunces", Georgia, serif', eigen: true, zweck: 'beides' },
  { id: 'mono', name: 'JetBrains Mono', css: '"JetBrains Mono", ui-monospace, monospace', eigen: true, zweck: 'beides' },
  { id: 'clash', name: 'Clash Display', css: '"Clash Display", "DM Sans", system-ui, sans-serif', eigen: true, zweck: 'anzeige' },
  { id: 'anton', name: 'Anton', css: '"Anton", Impact, system-ui, sans-serif', eigen: true, zweck: 'anzeige' },
  { id: 'bebas', name: 'Bebas Neue', css: '"Bebas Neue", Impact, system-ui, sans-serif', eigen: true, zweck: 'anzeige' },
];

/** Familien, die als Fließtext taugen. */
export const FLIESSTEXTSCHRIFTEN = SCHRIFTEN.filter((s) => s.zweck === 'beides');

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
  aufbau: Aufbau;
  /** Schriftkennung für Fließtext. */
  schrift: string;
  /** Schriftkennung für Überschriften. */
  anzeige: string;
  /**
   * Hintergrundbild. Leer heißt: nur Farbe.
   *
   * Über einem Foto ist kein Kontrast berechenbar — ein heller Himmel und ein
   * dunkler Baum stehen in derselben Fläche. Deshalb liegt zwischen Bild und
   * Text immer ein Schleier aus der Grundfarbe, und der Wächter rechnet gegen
   * diese Grundfarbe. Nur so bleibt die Aussage über die Lesbarkeit wahr.
   */
  bild: string;
  /** Deckkraft des Schleiers über dem Bild, 0 bis 1. */
  schleier: number;
}

/**
 * Unterhalb dieses Schleiers ist über einem beliebigen Foto keine Lesbarkeit
 * mehr zuzusichern. Der Wert stammt nicht aus einer Norm, sondern aus dem
 * Umstand, dass ein Foto in derselben Fläche nahezu Weiß und nahezu Schwarz
 * zeigen kann: erst ab etwa der Hälfte dominiert die Grundfarbe so weit, dass
 * der gerechnete Kontrast trägt.
 */
export const SCHLEIER_MINDESTENS = 0.5;

function g(werte: Partial<Gestaltung> & Pick<Gestaltung, 'vorlage' | 'grund' | 'vordergrund' | 'akzent' | 'akzentText'>): Gestaltung {
  return {
    grund2: '',
    winkel: 160,
    radius: 16,
    schaltflaeche: 'gefuellt',
    bildform: 'rund',
    aufbau: 'liste',
    schrift: 'dm',
    anzeige: 'clash',
    bild: '',
    schleier: 0.68,
    ...werte,
  };
}

/**
 * Elf Vorlagen. Die erste ist die des Produkts und bleibt die Vorgabe —
 * eine neue Seite sieht sofort nach etwas aus.
 *
 * Sie hieß einmal `hnvr` und trug das Hausorange des Herstellers. Für ein
 * Produkt, das verkauft werden soll, ist das die falsche Vorgabe: wer es
 * kauft, bekommt sonst eine Seite, die nach jemand anderem aussieht. Das alte
 * Hausdesign steht deshalb weiter zur Wahl, aber als `feuer` unter seinesgleichen.
 *
 * Jede Vorlage bringt ein eigenes Schriftpaar mit, nicht bloß andere Farben.
 * Genau daran scheitern die Baukästen: zwanzig „Designs", die sich nur im
 * Farbton unterscheiden, sind ein Design mit zwanzig Anstrichen.
 */
export const VORLAGEN: Gestaltung[] = [
  g({ vorlage: 'signal', ...MARKENFARBEN, radius: 22, schrift: 'archivo', anzeige: 'archivo' }),

  /* Die neun aus dem Design-Handoff. Jede hat dort einen Charakter und eine
     Formensprache — „warm, rund, freundlich" ist keine Farbangabe, sondern eine
     Anweisung an Radius, Schriftmischung und Anordnung zugleich. Deshalb
     unterscheiden sie sich in allen dreien und nicht bloß im Farbton. */
  g({ vorlage: 'kirsche', grund: '#FFF2EF', grund2: '#FFE0D9', vordergrund: '#201E1D', akzent: '#EC3013', akzentText: '#FFFFFF', radius: 26, schrift: 'archivo', anzeige: 'archivo' }),
  g({ vorlage: 'nachtschicht', aufbau: 'bento', grund: '#201E1D', grund2: '#2D2B2B', vordergrund: '#F3F2F2', akzent: '#FF563C', akzentText: '#201E1D', radius: 8, schrift: 'inter', anzeige: 'anton' }),
  g({ vorlage: 'beton', grund: '#EAE9E9', vordergrund: '#201E1D', akzent: '#201E1D', akzentText: '#F3F2F2', radius: 0, schaltflaeche: 'kontur', bildform: 'karte', schrift: 'space', anzeige: 'space' }),
  g({ vorlage: 'sticker', aufbau: 'bento', grund: '#EC3013', grund2: '#FF563C', vordergrund: '#FFF2EF', akzent: '#FFF2EF', akzentText: '#7C1405', radius: 999, schrift: 'dm', anzeige: 'clash' }),
  g({ vorlage: 'papier', aufbau: 'held', grund: '#F8F4F4', grund2: '#FFFFFF', vordergrund: '#2B2118', akzent: '#AE1800', akzentText: '#FFFFFF', radius: 14, schaltflaeche: 'kontur', bildform: 'karte', schrift: 'fraunces', anzeige: 'fraunces' }),
  g({ vorlage: 'tresen', grund: '#FFFFFF', grund2: '#F3F2F2', vordergrund: '#201E1D', akzent: '#EC3013', akzentText: '#FFFFFF', radius: 18, schrift: 'poppins', anzeige: 'poppins' }),
  g({ vorlage: 'werkbank', aufbau: 'bento', grund: '#2D2B2B', grund2: '#444141', vordergrund: '#F3F2F2', akzent: '#EC3013', akzentText: '#FFFFFF', radius: 0, schrift: 'inter', anzeige: 'bebas' }),
  g({ vorlage: 'sprechstunde', grund: '#F8F4F4', grund2: '#FFFFFF', vordergrund: '#2D2B2B', akzent: '#AE1800', akzentText: '#FFFFFF', radius: 10, schrift: 'dm', anzeige: 'dm' }),
  g({ vorlage: 'riso', aufbau: 'held', grund: '#AE1800', grund2: '#7C1405', vordergrund: '#FFF2EF', akzent: '#FFE0D9', akzentText: '#4D170E', radius: 4, schaltflaeche: 'kontur', schrift: 'syne', anzeige: 'syne' }),

  /* Das Hausdesign des Herstellers — kein Angebot an Kunden, aber hnvr.me
     selbst läuft damit. */
  g({ vorlage: 'feuer', grund: '#0F0F0F', grund2: '#1B1B1B', vordergrund: '#F1EFEB', akzent: '#FF7120', akzentText: '#141410' }),
];

/** Namen für die Anzeige. Die Kennung bleibt technisch, der Name darf schön sein. */
const VORLAGENNAMEN: Record<string, string> = {
  signal: 'Signal',
  kirsche: 'Kirsche',
  nachtschicht: 'Nachtschicht',
  beton: 'Beton',
  sticker: 'Sticker',
  papier: 'Papier',
  tresen: 'Tresen',
  werkbank: 'Werkbank',
  sprechstunde: 'Sprechstunde',
  riso: 'Riso',
  feuer: 'Feuer',
};

export function vorlagenName(id: string): string {
  return VORLAGENNAMEN[id] ?? id;
}

/**
 * Charakter und Fach je Vorlage.
 *
 * Der Design-Handoff beschreibt jede Vorlage in einer Zeile und ordnet sie
 * einem Gewerbe zu — „warm, rund, freundlich (Creator)". Das ist keine
 * Verzierung: wer eine Vorlage sucht, sucht nach seinem Fach, nicht nach einem
 * Farbwert. Das Fach trägt die Filterleiste der Galerie, der Charakter steht
 * im Fuß jeder Kachel.
 *
 * Steht hier und nicht in der Seite, weil beide Seiten der Galerie und die
 * Werkstatt dieselbe Zuordnung brauchen.
 */
export interface Vorlagenart {
  /** Fach für die Filterleiste. */
  fach: string;
  /** Ein Satz, der den Charakter benennt. */
  charakter: string;
}

const VORLAGENARTEN: Record<string, Vorlagenart> = {
  signal: { fach: 'Marke', charakter: 'sachlich, rot, unser eigenes' },
  kirsche: { fach: 'Creator', charakter: 'warm, rund, freundlich' },
  nachtschicht: { fach: 'Musik', charakter: 'dunkel und laut' },
  beton: { fach: 'Studio & Atelier', charakter: 'streng, sachlich, kantig' },
  sticker: { fach: 'Creator', charakter: 'verspielt und schief' },
  papier: { fach: 'Studio & Atelier', charakter: 'skizzenhaft und leicht' },
  tresen: { fach: 'Café & Laden', charakter: 'Ansprache zuerst' },
  werkbank: { fach: 'Handwerk & Team', charakter: 'robust, für mehrere' },
  sprechstunde: { fach: 'Praxis', charakter: 'ruhig, Termin zuerst' },
  riso: { fach: 'Kollektiv', charakter: 'Druck-Look, Linien statt Flächen' },
  feuer: { fach: 'Marke', charakter: 'das Hausdesign von hnvr.me' },
};

export function vorlagenart(id: string): Vorlagenart {
  return VORLAGENARTEN[id] ?? { fach: 'Marke', charakter: '' };
}

/** Alle vorkommenden Fächer in der Reihenfolge der Vorlagen, ohne Wiederholung. */
export function vorlagenfaecher(): string[] {
  const gesehen: string[] = [];
  for (const v of VORLAGEN) {
    const f = vorlagenart(v.vorlage).fach;
    if (!gesehen.includes(f)) gesehen.push(f);
  }
  return gesehen;
}

/**
 * Nur die Werte, die von der Vorlage abweichen.
 *
 * So bleibt ein gespeichertes Profil klein und lesbar, und — wichtiger — es
 * wandert mit: wird eine Vorlage später nachgeschärft, erben alle Profile die
 * Korrektur, die an dieser Stelle nichts Eigenes eingestellt haben.
 */
export function abweichung(gestaltung: Gestaltung): Partial<Gestaltung> & { vorlage: string } {
  const basis = vorlage(gestaltung.vorlage);
  const heraus: Partial<Gestaltung> & { vorlage: string } = { vorlage: gestaltung.vorlage };

  for (const schluessel of Object.keys(basis) as (keyof Gestaltung)[]) {
    if (schluessel === 'vorlage') continue;
    if (gestaltung[schluessel] !== basis[schluessel]) {
      // Der Umweg über `unknown` ist nötig, weil TypeScript hier nicht sieht,
      // dass Schlüssel und Wert aus demselben Objekt stammen.
      (heraus as Record<string, unknown>)[schluessel] = gestaltung[schluessel];
    }
  }

  return heraus;
}

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

  // Über einem Foto ist kein Kontrast berechenbar: ein heller Himmel und ein
  // dunkler Baum liegen in derselben Fläche. Nur der Schleier macht die
  // Rechnung oben überhaupt gültig.
  if (gestaltung.bild && gestaltung.schleier < SCHLEIER_MINDESTENS) {
    befunde.push({
      schwere: gestaltung.schleier < 0.3 ? 'fehler' : 'warnung',
      meldung:
        'Der Schleier über dem Hintergrundbild ist zu dünn. Auf hellen Stellen des Bildes wird der Text unlesbar — entweder den Schleier kräftiger stellen oder das Bild weglassen.',
    });
  }

  return befunde;
}

/**
 * Die abgeleiteten Werte, die als CSS-Variablen auf die Seite gehen.
 * Ein einziger Ort, an dem aus sechs Entscheidungen ein vollständiges Bild wird.
 */
/**
 * Der fertige Wert für den Seitenhintergrund.
 *
 * Mit Bild liegt der Schleier aus der Grundfarbe *über* dem Foto — als
 * Verlauf aus zwei gleichen Farbstopps, weil CSS keinen einfarbigen Belag über
 * einem Bild kennt. Der Schleier ist keine Verzierung, sondern die Bedingung
 * dafür, dass die Kontrastrechnung überhaupt gilt.
 */
export function hintergrund(gestaltung: Gestaltung): string {
  const { grund, grund2, winkel, bild, schleier } = gestaltung;
  const flaeche = grund2 ? `linear-gradient(${winkel}deg, ${grund}, ${grund2})` : grund;

  if (!bild) return flaeche;

  const belag = mitDeckkraft(grund, Math.min(Math.max(schleier, 0), 1));
  return `linear-gradient(${belag}, ${belag}), url(${JSON.stringify(bild)}) center / cover no-repeat, ${grund}`;
}

export function cssVariablen(gestaltung: Gestaltung): Record<string, string> {
  const { grund, vordergrund, akzent, akzentText, radius } = gestaltung;
  const dunkel = istDunkel(grund);

  return {
    '--grund': hintergrund(gestaltung),
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

  if (typeof daten.bild === 'string') {
    const wert = daten.bild.trim();
    // Nur eigene Pfade und https — ein `javascript:` im url() wäre zwar
    // wirkungslos, ein fremder Host aber ein stiller Aufruf bei jedem Besuch.
    if (wert === '' || wert.startsWith('/') || wert.startsWith('https://') || wert.startsWith('data:image/')) {
      heraus.bild = wert;
    } else {
      fehler.push('„bild" muss ein eigener Pfad, eine https-Adresse oder eine Datenadresse sein.');
    }
  }
  if (typeof daten.schleier === 'number' && daten.schleier >= 0 && daten.schleier <= 1) {
    heraus.schleier = daten.schleier;
  }
  if (daten.schaltflaeche === 'gefuellt' || daten.schaltflaeche === 'kontur' || daten.schaltflaeche === 'glas') {
    heraus.schaltflaeche = daten.schaltflaeche;
  }
  if (daten.bildform === 'rund' || daten.bildform === 'karte') heraus.bildform = daten.bildform;
  if (AUFBAUTEN.some((a) => a.kennung === daten.aufbau)) heraus.aufbau = daten.aufbau as Aufbau;
  if (typeof daten.schrift === 'string') heraus.schrift = schrift(daten.schrift).id;
  if (typeof daten.anzeige === 'string') heraus.anzeige = schrift(daten.anzeige).id;

  return { gestaltung: heraus, fehler };
}
