import { describe, expect, it } from 'vitest';
import {
  FARBAUFTRAG_GRENZE,
  farbauftrag,
  hexZuCmyk,
  hexZuRgb,
  istNeutral,
  rgbZuCmyk,
} from '../src/farbe.js';

describe('hexZuRgb', () => {
  it('liest sechsstellige und achtstellige Angaben', () => {
    expect(hexZuRgb('#0a5c8a')).toEqual({ r: 10, g: 92, b: 138 });
    expect(hexZuRgb('#0a5c8aff')).toEqual({ r: 10, g: 92, b: 138 });
  });

  it('weist Unsinn ab, statt schwarz zu raten', () => {
    expect(() => hexZuRgb('rebeccapurple')).toThrow(RangeError);
    expect(() => hexZuRgb('#abc')).toThrow(RangeError);
  });
});

describe('Neutrale Töne gehen nur über Schwarz', () => {
  it('macht reines Schwarz zu K-only', () => {
    // Die wichtigste Regel dieser Datei: vierfarbiges Schwarz wird bei kleiner
    // Schrift durch Passerdifferenzen bunt umrandet und unlesbar.
    expect(hexZuCmyk('#000000')).toEqual({ c: 0, m: 0, y: 0, k: 1 });
  });

  it('macht Weiß zu einer leeren Platte', () => {
    expect(hexZuCmyk('#ffffff')).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it('behandelt Grau als reines K', () => {
    const grau = hexZuCmyk('#808080');
    expect(grau.c).toBe(0);
    expect(grau.m).toBe(0);
    expect(grau.y).toBe(0);
    expect(grau.k).toBeCloseTo(0.498, 3);
  });

  it('erkennt leichte Abweichungen noch als neutral', () => {
    expect(istNeutral({ r: 128, g: 129, b: 127 })).toBe(true);
    expect(istNeutral({ r: 128, g: 140, b: 127 })).toBe(false);
  });

  it('behandelt einen fast neutralen Ton nicht mehr als neutral', () => {
    const fast = hexZuCmyk('#80808c');
    expect(fast.c + fast.m + fast.y).toBeGreaterThan(0);
  });
});

describe('Buntfarben', () => {
  it('zerlegt ein Blau in eine echte Vierfarbmischung', () => {
    const blau = hexZuCmyk('#0a5c8a');
    expect(blau.c).toBeGreaterThan(0.9);
    expect(blau.m).toBeGreaterThan(0.3);
    expect(blau.y).toBe(0);
    expect(blau.k).toBeGreaterThan(0.4);
  });

  it('bleibt in allen Kanälen zwischen 0 und 1', () => {
    for (const hex of ['#0a5c8a', '#e2a33c', '#ff0000', '#00ff00', '#0000ff', '#123456']) {
      const c = hexZuCmyk(hex);
      for (const [kanal, wert] of Object.entries(c)) {
        expect(wert, `${hex}.${kanal}`).toBeGreaterThanOrEqual(0);
        expect(wert, `${hex}.${kanal}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gibt für Grundfarben die erwartete Platte aus', () => {
    expect(rgbZuCmyk({ r: 255, g: 0, b: 0 })).toEqual({ c: 0, m: 1, y: 1, k: 0 });
    expect(rgbZuCmyk({ r: 0, g: 255, b: 255 })).toEqual({ c: 1, m: 0, y: 0, k: 0 });
  });
});

describe('Farbauftrag', () => {
  it('bleibt bei dieser Umrechnung immer unter der Grenze', () => {
    // Die naive Umrechnung kann rechnerisch nicht über 300 % kommen, weil K
    // aus dem Minimum gebildet und aus den Buntkanälen herausgerechnet wird.
    for (const hex of ['#000000', '#0a5c8a', '#e2a33c', '#1a1b1c', '#102030']) {
      expect(farbauftrag(hexZuCmyk(hex)), hex).toBeLessThanOrEqual(FARBAUFTRAG_GRENZE);
    }
  });

  it('rechnet die Summe in Prozent', () => {
    expect(farbauftrag({ c: 0.5, m: 0.25, y: 0, k: 0.25 })).toBeCloseTo(100, 9);
  });
});
