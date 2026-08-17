import { describe, expect, it } from 'vitest';
import {
  anschnittkasten,
  DPI_DRUCK,
  endformat,
  enthaelt,
  erzeugeEntwurf,
  FORMATE,
  formatInPx,
  huelleGedreht,
  mmZuPx,
  ptZuPx,
  pxZuMm,
  pxZuPt,
  sicherheitskasten,
  skaliereAufDpi,
  ueberschneidet,
} from '../src/index.js';
import { druckEntwurf, erzeugeText, format, mitElementen, testWerkzeuge } from './hilfen.js';

describe('Einheiten', () => {
  it('rechnet A4 bei 300 dpi auf die bekannten Pixelmaße', () => {
    expect(Math.round(mmZuPx(210, DPI_DRUCK))).toBe(2480);
    expect(Math.round(mmZuPx(297, DPI_DRUCK))).toBe(3508);
  });

  it('ist bei 72 dpi deckungsgleich mit Punkt', () => {
    expect(pxZuPt(100, 72)).toBeCloseTo(100, 10);
    expect(ptZuPx(100, 72)).toBeCloseTo(100, 10);
  });

  it('geht verlustfrei hin und zurück', () => {
    for (const dpi of [72, 150, 300, 600]) {
      expect(pxZuMm(mmZuPx(123.45, dpi), dpi)).toBeCloseTo(123.45, 9);
    }
  });

  it('weist unsinnige dpi ab', () => {
    expect(() => mmZuPx(10, 0)).toThrow(RangeError);
    expect(() => mmZuPx(10, -300)).toThrow(RangeError);
    expect(() => mmZuPx(10, Number.NaN)).toThrow(RangeError);
  });
});

describe('Kästen der Druckvorstufe', () => {
  const masse = { breite: 1000, hoehe: 500, dpi: 300 };
  const anschnitt = { oben: 35, rechts: 35, unten: 35, links: 35 };

  it('legt den Ursprung auf die Ecke des Endformats', () => {
    expect(endformat(masse)).toEqual({ x: 0, y: 0, breite: 1000, hoehe: 500 });
  });

  it('lässt den Anschnitt ins Negative ragen', () => {
    expect(anschnittkasten(masse, anschnitt)).toEqual({
      x: -35,
      y: -35,
      breite: 1070,
      hoehe: 570,
    });
  });

  it('zieht den Sicherheitsabstand beidseitig ab', () => {
    expect(sicherheitskasten(masse, 50)).toEqual({ x: 50, y: 50, breite: 900, hoehe: 400 });
  });

  it('lässt den Sicherheitskasten nicht negativ werden', () => {
    const entartet = sicherheitskasten(masse, 900);
    expect(entartet.breite).toBe(0);
    expect(entartet.hoehe).toBe(0);
  });

  it('erkennt Enthalten und Überschneiden', () => {
    const aussen = { x: 0, y: 0, breite: 100, hoehe: 100 };
    expect(enthaelt(aussen, { x: 10, y: 10, breite: 50, hoehe: 50 })).toBe(true);
    expect(enthaelt(aussen, { x: 10, y: 10, breite: 200, hoehe: 50 })).toBe(false);
    expect(ueberschneidet(aussen, { x: 90, y: 90, breite: 50, hoehe: 50 })).toBe(true);
    expect(ueberschneidet(aussen, { x: 200, y: 0, breite: 10, hoehe: 10 })).toBe(false);
  });
});

describe('huelleGedreht', () => {
  it('lässt einen ungedrehten Kasten unverändert', () => {
    const kasten = { x: 10, y: 20, breite: 100, hoehe: 50 };
    const huelle = huelleGedreht(kasten, 0);
    expect(huelle.x).toBeCloseTo(10);
    expect(huelle.y).toBeCloseTo(20);
    expect(huelle.breite).toBeCloseTo(100);
    expect(huelle.hoehe).toBeCloseTo(50);
  });

  it('vertauscht Breite und Höhe bei 90 Grad', () => {
    const huelle = huelleGedreht({ x: 0, y: 0, breite: 100, hoehe: 50 }, 90);
    expect(huelle.breite).toBeCloseTo(50);
    expect(huelle.hoehe).toBeCloseTo(100);
  });

  it('wächst bei 45 Grad und behält den Mittelpunkt', () => {
    const huelle = huelleGedreht({ x: 0, y: 0, breite: 100, hoehe: 100 }, 45);
    expect(huelle.breite).toBeCloseTo(Math.SQRT2 * 100, 6);
    expect(huelle.x + huelle.breite / 2).toBeCloseTo(50, 9);
    expect(huelle.y + huelle.hoehe / 2).toBeCloseTo(50, 9);
  });
});

describe('Formate', () => {
  it('liefert Bildschirmformate pixelgenau', () => {
    // Der eigentliche Grund für die Einheit je Format: der frühere Umweg über
    // Millimeter ergab 1919,99 px für die Story und 1199,99 px für LinkedIn.
    const erwartet: Record<string, [number, number]> = {
      'instagram-post': [1080, 1080],
      'instagram-story': [1080, 1920],
      'linkedin-post': [1200, 627],
      'facebook-post': [1200, 630],
    };

    for (const [schluessel, [breite, hoehe]] of Object.entries(erwartet)) {
      const px = formatInPx(format(schluessel));
      expect(px.breite, `${schluessel} Breite`).toBe(breite);
      expect(px.hoehe, `${schluessel} Höhe`).toBe(hoehe);
      expect(Number.isInteger(px.breite) && Number.isInteger(px.hoehe)).toBe(true);
    }
  });

  it('rechnet Druckformate über die dpi um', () => {
    const a4 = formatInPx(format('a4-hoch'));
    expect(a4.dpi).toBe(DPI_DRUCK);
    expect(a4.breite).toBeCloseTo(mmZuPx(210, DPI_DRUCK), 9);
    expect(a4.anschnitt).toBeCloseTo(mmZuPx(3, DPI_DRUCK), 9);
    expect(pxZuMm(a4.hoehe, DPI_DRUCK)).toBeCloseTo(297, 9);
  });

  it('gibt Bildschirmformaten keinen Anschnitt', () => {
    for (const f of FORMATE.filter((f) => f.einheit === 'px')) {
      expect(f.anschnitt, f.schluessel).toBe(0);
    }
  });

  it('gibt jedem Druckformat einen Anschnitt und einen Sicherheitsabstand', () => {
    for (const f of FORMATE.filter((f) => f.einheit === 'mm')) {
      expect(f.anschnitt, f.schluessel).toBeGreaterThan(0);
      expect(f.sicherheitsabstand, f.schluessel).toBeGreaterThan(0);
    }
  });

  it('hat eindeutige Schlüssel', () => {
    const schluessel = FORMATE.map((f) => f.schluessel);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });

  it('erzeugt einen Entwurf mit genau den Formatmaßen', () => {
    const entwurf = erzeugeEntwurf(
      { organisationId: 'org-1', name: 'Story', format: format('instagram-story') },
      testWerkzeuge(),
    );
    expect(entwurf.masse).toEqual({ breite: 1080, hoehe: 1920, dpi: 72 });
    expect(entwurf.anschnitt).toEqual({ oben: 0, rechts: 0, unten: 0, links: 0 });
    expect(entwurf.sicherheitsabstand).toBe(100);
  });
});

describe('skaliereAufDpi', () => {
  it('behält das physische Format bei und skaliert Schriftgrößen mit', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 100, y: 100, breite: 400, hoehe: 100 }, 'Hallo', { schriftGroesse: 60 }, w),
    );

    const klein = skaliereAufDpi(entwurf, 72);

    expect(pxZuMm(klein.masse.breite, 72)).toBeCloseTo(pxZuMm(entwurf.masse.breite, 300), 6);
    const text = klein.seiten[0]?.elemente[0];
    if (text?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(text.schriftGroesse).toBeCloseTo(60 * (72 / 300), 9);
    expect(text.x).toBeCloseTo(100 * (72 / 300), 9);
  });

  it('gibt bei gleicher dpi denselben Entwurf zurück', () => {
    const entwurf = druckEntwurf();
    expect(skaliereAufDpi(entwurf, entwurf.masse.dpi)).toBe(entwurf);
  });
});
