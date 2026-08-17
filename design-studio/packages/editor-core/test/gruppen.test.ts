import { describe, expect, it } from 'vitest';
import {
  alleElemente,
  ElementEntfernen,
  ElementHinzufuegen,
  ElementVerschieben,
  entnimmElement,
  festeUhr,
  findeElement,
  fuegeElementEin,
  type GruppenElement,
  KommandoStack,
  pruefeEntwurf,
  skaliereAufDpi,
} from '../src/index.js';
import {
  druckEntwurf,
  ersteSeiteId,
  erzeugeForm,
  erzeugeText,
  mitElementen,
  testWerkzeuge,
} from './hilfen.js';

/** Gruppe mit zwei Kindern, eines davon selbst eine Gruppe. */
function verschachtelt() {
  const w = testWerkzeuge('g');
  const enkel = erzeugeText({ x: 10, y: 10, breite: 100, hoehe: 20 }, 'Enkel', {}, w);
  const innen: GruppenElement = {
    ...erzeugeForm({ x: 5, y: 5, breite: 200, hoehe: 60 }, 'rechteck', { name: 'innen' }, w),
    typ: 'gruppe',
    kinder: [enkel],
  } as unknown as GruppenElement;
  const geschwister = erzeugeText({ x: 0, y: 0, breite: 50, hoehe: 20 }, 'Kind', {}, w);
  const aussen: GruppenElement = {
    ...erzeugeForm({ x: 0, y: 0, breite: 400, hoehe: 300 }, 'rechteck', { name: 'aussen' }, w),
    typ: 'gruppe',
    kinder: [geschwister, innen],
  } as unknown as GruppenElement;

  return { entwurf: mitElementen(druckEntwurf(w), aussen), aussen, innen, enkel, geschwister, w };
}

describe('Navigation in Gruppen', () => {
  it('findet ein Element bis in die zweite Verschachtelungsebene', () => {
    const { entwurf, aussen, innen, enkel } = verschachtelt();

    const fund = findeElement(entwurf, enkel.id);
    expect(fund?.element.id).toBe(enkel.id);
    expect(fund?.gruppenId).toBe(innen.id);
    expect(fund?.index).toBe(0);

    expect(findeElement(entwurf, innen.id)?.gruppenId).toBe(aussen.id);
    expect(findeElement(entwurf, aussen.id)?.gruppenId).toBeNull();
  });

  it('durchläuft alle Elemente in Dokumentreihenfolge', () => {
    const { entwurf, aussen, innen, enkel, geschwister } = verschachtelt();

    const ids = [...alleElemente(entwurf)].map((e) => e.element.id);
    expect(ids).toEqual([aussen.id, geschwister.id, innen.id, enkel.id]);
  });

  it('fügt ein Element gezielt in eine Gruppe ein', () => {
    const { entwurf, innen, w } = verschachtelt();
    const neu = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'neu', {}, w);

    const danach = fuegeElementEin(
      entwurf,
      { seiteId: ersteSeiteId(entwurf), gruppenId: innen.id, index: 0 },
      neu,
    );

    const fund = findeElement(danach!, neu.id);
    expect(fund?.gruppenId).toBe(innen.id);
    expect(fund?.index).toBe(0);
  });

  it('meldet eine unbekannte Gruppe, statt still auf der Seite abzulegen', () => {
    const { entwurf, w } = verschachtelt();
    const neu = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'neu', {}, w);

    expect(
      fuegeElementEin(
        entwurf,
        { seiteId: ersteSeiteId(entwurf), gruppenId: 'gibt-es-nicht', index: 0 },
        neu,
      ),
    ).toBeNull();
  });

  it('entnimmt ein Kind, ohne die Gruppe anzutasten', () => {
    const { entwurf, innen, enkel } = verschachtelt();

    const entnahme = entnimmElement(entwurf, enkel.id);
    expect(entnahme?.fundstelle.gruppenId).toBe(innen.id);
    expect(findeElement(entnahme!.entwurf, enkel.id)).toBeNull();
    expect(findeElement(entnahme!.entwurf, innen.id)).not.toBeNull();
  });

  it('nimmt beim Entfernen einer Gruppe deren Kinder mit', () => {
    const { entwurf, innen, enkel } = verschachtelt();

    const entnahme = entnimmElement(entwurf, innen.id);
    expect(findeElement(entnahme!.entwurf, enkel.id)).toBeNull();
  });

  it('stellt eine gelöschte Gruppe samt Kindern an ihrer Stelle wieder her', () => {
    const { entwurf, innen, enkel } = verschachtelt();
    const stack = new KommandoStack(entwurf, { jetzt: festeUhr() });

    stack.ausfuehren(new ElementEntfernen(innen.id));
    expect(findeElement(stack.entwurf, enkel.id)).toBeNull();

    stack.rueckgaengig();
    expect(findeElement(stack.entwurf, enkel.id)?.gruppenId).toBe(innen.id);
    expect(findeElement(stack.entwurf, innen.id)?.index).toBe(1);
  });

  it('verschiebt ein Kind, ohne Geschwister zu bewegen', () => {
    const { entwurf, enkel, geschwister } = verschachtelt();
    const stack = new KommandoStack(entwurf, { jetzt: festeUhr() });

    stack.ausfuehren(new ElementVerschieben(enkel.id, 25, -5));

    expect(findeElement(stack.entwurf, enkel.id)?.element.x).toBe(35);
    expect(findeElement(stack.entwurf, geschwister.id)?.element.x).toBe(0);
  });

  it('lehnt ein Kommando ab, das eine id doppelt in eine Gruppe legt', () => {
    const { entwurf, innen, enkel } = verschachtelt();
    const stack = new KommandoStack(entwurf, { jetzt: festeUhr() });

    expect(() =>
      stack.ausfuehren(
        new ElementHinzufuegen(
          { seiteId: ersteSeiteId(entwurf), gruppenId: innen.id, index: 0 },
          enkel,
        ),
      ),
    ).toThrow(/schon vergeben/);
  });

  it('erkennt doppelte ids auch quer über Gruppengrenzen', () => {
    const { entwurf, enkel } = verschachtelt();
    const kaputt = mitElementen(entwurf, { ...enkel });

    expect(() => pruefeEntwurf(JSON.parse(JSON.stringify(kaputt)))).toThrow(/kommt mehrfach vor/);
  });
});

describe('skaliereAufDpi über alle Elementarten', () => {
  it('skaliert Kontur und Eckenradius einer Form mit', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeForm(
        { x: 100, y: 100, breite: 400, hoehe: 200 },
        'rechteck',
        {
          eckenradius: 30,
          kontur: { farbe: '#003366', staerke: 12 },
        },
        w,
      ),
    );

    const klein = skaliereAufDpi(entwurf, 150);
    const form = klein.seiten[0]?.elemente[0];
    if (form?.typ !== 'form') throw new Error('Formelement erwartet');

    expect(form.eckenradius).toBeCloseTo(15, 9);
    expect(form.kontur?.staerke).toBeCloseTo(6, 9);
    expect(form.breite).toBeCloseTo(200, 9);
  });

  it('lässt eine Form ohne Kontur unangetastet', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeForm({ x: 0, y: 0, breite: 100, hoehe: 100 }, 'ellipse', { kontur: null }, w),
    );

    const klein = skaliereAufDpi(entwurf, 150);
    const form = klein.seiten[0]?.elemente[0];
    if (form?.typ !== 'form') throw new Error('Formelement erwartet');
    expect(form.kontur).toBeNull();
  });

  it('lässt den relativen Zuschnitt eines Bildes unverändert', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(druckEntwurf(w), {
      ...erzeugeForm({ x: 0, y: 0, breite: 600, hoehe: 400 }, 'rechteck', {}, w),
      typ: 'bild',
      quelle: { id: 'a', url: '/a.jpg', breite: 1200, hoehe: 800, mimeTyp: 'image/jpeg' },
      zuschnitt: { x: 0.1, y: 0.2, breite: 0.5, hoehe: 0.5 },
      passform: 'fuellen',
    } as never);

    const klein = skaliereAufDpi(entwurf, 150);
    const bild = klein.seiten[0]?.elemente[0];
    if (bild?.typ !== 'bild') throw new Error('Bildelement erwartet');

    expect(bild.zuschnitt).toEqual({ x: 0.1, y: 0.2, breite: 0.5, hoehe: 0.5 });
    expect(bild.breite).toBeCloseTo(300, 9);
  });

  it('skaliert verschachtelte Gruppenkinder bis in die Tiefe', () => {
    const { entwurf, enkel } = verschachtelt();

    const klein = skaliereAufDpi(entwurf, 150);
    const skalierterEnkel = findeElement(klein, enkel.id)?.element;

    expect(skalierterEnkel?.x).toBeCloseTo(5, 9);
    expect(skalierterEnkel?.breite).toBeCloseTo(50, 9);
  });
});
