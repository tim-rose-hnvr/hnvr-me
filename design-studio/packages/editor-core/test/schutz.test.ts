import { describe, expect, it } from 'vitest';
import {
  darfAendern,
  ElementAendern,
  ElementEntfernen,
  ElementVerschieben,
  festeUhr,
  findeElement,
  KommandoStack,
  type Platzhalter,
  StapelReihenfolgeAendern,
  TextAendern,
} from '../src/index.js';
import { druckEntwurf, erzeugeText, mitElementen, testWerkzeuge } from './hilfen.js';

function platzhalter(bearbeitbar: Platzhalter['bearbeitbar']): Platzhalter {
  return { schluessel: 'schlagzeile', bearbeitbar, beschriftung: 'Schlagzeile', bindung: null };
}

describe('gesperrte Elemente', () => {
  it('lassen sich weder verschieben noch löschen', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 40 }, 'fix', { gesperrt: true }, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    expect(() => stack.ausfuehren(new ElementVerschieben(text.id, 10, 0))).toThrow(/ist gesperrt/);
    expect(() => stack.ausfuehren(new ElementEntfernen(text.id))).toThrow(/ist gesperrt/);
    expect(() => stack.ausfuehren(new TextAendern(text.id, 'anders'))).toThrow(/ist gesperrt/);
  });
});

describe('Platzhalter', () => {
  it('erlauben genau das Benannte und sonst nichts', () => {
    const w = testWerkzeuge();
    const text = erzeugeText(
      { x: 0, y: 0, breite: 100, hoehe: 40 },
      'Vorbelegung',
      { platzhalter: platzhalter(['text']) },
      w,
    );
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    stack.ausfuehren(new TextAendern(text.id, 'Neue Schlagzeile'));
    const geaendert = findeElement(stack.entwurf, text.id)?.element;
    if (geaendert?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(geaendert.inhalt).toBe('Neue Schlagzeile');

    expect(() => stack.ausfuehren(new ElementVerschieben(text.id, 10, 0))).toThrow(
      /erlaubt nur \[text\], nicht "position"/,
    );
    expect(() =>
      stack.ausfuehren(new ElementAendern(text.id, { farbe: '#ff0000' }, 'farbe')),
    ).toThrow(/erlaubt nur \[text\]/);
  });

  it('verbieten strukturelle Eingriffe grundsätzlich, auch bei weiten Rechten', () => {
    const w = testWerkzeuge();
    const text = erzeugeText(
      { x: 0, y: 0, breite: 100, hoehe: 40 },
      'x',
      { platzhalter: platzhalter(['text', 'bild', 'farbe', 'position']) },
      w,
    );
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    expect(() => stack.ausfuehren(new ElementEntfernen(text.id))).toThrow(/nicht "struktur"/);
    expect(() => stack.ausfuehren(new StapelReihenfolgeAendern(text.id, 'vor'))).toThrow(
      /nicht "struktur"/,
    );
  });

  it('gewinnen gegen die Layoutsperre, weil sie die feinere Aussage sind', () => {
    const w = testWerkzeuge();
    const text = erzeugeText(
      { x: 0, y: 0, breite: 100, hoehe: 40 },
      'x',
      { gesperrt: true, platzhalter: platzhalter(['text']) },
      w,
    );
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    expect(() => stack.ausfuehren(new TextAendern(text.id, 'geht'))).not.toThrow();
  });
});

describe('darfAendern', () => {
  it('bildet die Regeln ohne Kommandoschicht ab', () => {
    const w = testWerkzeuge();
    const frei = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', {}, w);
    const gesperrt = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', { gesperrt: true }, w);
    const mitPlatzhalter = erzeugeText(
      { x: 0, y: 0, breite: 10, hoehe: 10 },
      'x',
      { platzhalter: platzhalter(['bild']) },
      w,
    );

    expect(darfAendern(frei, 'position')).toBe(true);
    expect(darfAendern(frei, 'struktur')).toBe(true);
    expect(darfAendern(gesperrt, 'position')).toBe(false);
    expect(darfAendern(mitPlatzhalter, 'bild')).toBe(true);
    expect(darfAendern(mitPlatzhalter, 'text')).toBe(false);
    expect(darfAendern(mitPlatzhalter, 'struktur')).toBe(false);
  });
});
