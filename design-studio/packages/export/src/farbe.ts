/**
 * Farbumrechnung RGB → CMYK.
 *
 * ## Was das hier ist und was nicht
 *
 * Das ist eine **rechnerische Umsetzung ohne Farbmanagement**. Sie ist
 * vorhersagbar und für den Beweis der Kette ausreichend, aber sie ist nicht
 * farbverbindlich: eine echte Umrechnung geht über ICC-Profile und eine
 * Rendering-Absicht, in der Praxis über Little CMS als WASM. Solange das fehlt,
 * darf niemand erwarten, dass ein Blau am Bildschirm und im Druck gleich
 * aussieht.
 *
 * ## Die eine Regel, die trotzdem stimmen muss
 *
 * Neutrale Töne gehen **nur über Schwarz**, nicht über eine Vierfarbmischung.
 * Grund ist nicht Ästhetik, sondern Passer: kleine Schrift aus vier
 * übereinanderliegenden Druckplatten wird bei minimalem Versatz unlesbar und
 * bunt umrandet. Schwarzer Text ist im Druck immer K-only.
 */

/** Anteile jeweils 0..1. In dieser Form erwartet pdf-lib die Werte. */
export interface Cmyk {
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Toleranz, bis zu der ein Ton noch als neutral gilt (0..255 je Kanal). */
export const NEUTRAL_TOLERANZ = 2;

export function hexZuRgb(hex: string): Rgb {
  const sauber = hex.trim().toLowerCase().replace('#', '');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(sauber)) {
    throw new RangeError(`"${hex}" ist keine Farbe der Form #RRGGBB oder #RRGGBBAA`);
  }
  return {
    r: Number.parseInt(sauber.slice(0, 2), 16),
    g: Number.parseInt(sauber.slice(2, 4), 16),
    b: Number.parseInt(sauber.slice(4, 6), 16),
  };
}

export function istNeutral(rgb: Rgb): boolean {
  const groesster = Math.max(rgb.r, rgb.g, rgb.b);
  const kleinster = Math.min(rgb.r, rgb.g, rgb.b);
  return groesster - kleinster <= NEUTRAL_TOLERANZ;
}

export function rgbZuCmyk(rgb: Rgb): Cmyk {
  // Neutrale Töne ausschließlich über die Schwarzplatte, siehe Kopfkommentar.
  if (istNeutral(rgb)) {
    return { c: 0, m: 0, y: 0, k: 1 - rgb.r / 255 };
  }

  const c = 1 - rgb.r / 255;
  const m = 1 - rgb.g / 255;
  const y = 1 - rgb.b / 255;
  const k = Math.min(c, m, y);
  const rest = 1 - k;

  return {
    c: (c - k) / rest,
    m: (m - k) / rest,
    y: (y - k) / rest,
    k,
  };
}

export function hexZuCmyk(hex: string): Cmyk {
  return rgbZuCmyk(hexZuRgb(hex));
}

/**
 * Summe aller vier Anteile in Prozent. Druckereien begrenzen die
 * Farbauftragssumme, weil sonst die Farbe nicht mehr trocknet und abschmiert.
 * Für gestrichenes Papier sind 300 % ein üblicher Grenzwert.
 */
export function farbauftrag(cmyk: Cmyk): number {
  return (cmyk.c + cmyk.m + cmyk.y + cmyk.k) * 100;
}

export const FARBAUFTRAG_GRENZE = 300;
