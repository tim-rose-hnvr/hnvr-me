import { describe, expect, it } from 'vitest';
import {
  ElementAendern,
  ElementEntfernen,
  ElementHinzufuegen,
  type Entwurf,
  festeUhr,
  findeElement,
  KommandoFehler,
  KommandoStack,
  StapelReihenfolgeAendern,
  TextAendern,
} from '../src/index.js';
import {
  druckEntwurf,
  ersteSeiteId,
  erzeugeForm,
  erzeugeText,
  mitElementen,
  testWerkzeuge,
} from './hilfen.js';

function reihenfolge(entwurf: Entwurf): string[] {
  return entwurf.seiten[0]?.elemente.map((e) => e.name) ?? [];
}

function dreiFormen(): { stack: KommandoStack; ids: string[] } {
  const w = testWerkzeuge();
  const a = erzeugeForm({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'rechteck', { name: 'a' }, w);
  const b = erzeugeForm({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'rechteck', { name: 'b' }, w);
  const c = erzeugeForm({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'rechteck', { name: 'c' }, w);
  const stack = new KommandoStack(mitElementen(druckEntwurf(w), a, b, c), { jetzt: festeUhr() });
  return { stack, ids: [a.id, b.id, c.id] };
}

describe('ElementHinzufuegen und ElementEntfernen', () => {
  it('stellt beim Rückgängigmachen die genaue Stapelposition wieder her', () => {
    const { stack, ids } = dreiFormen();
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);

    stack.ausfuehren(new ElementEntfernen(ids[1]!));
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'c']);

    stack.rueckgaengig();
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);
  });

  it('lehnt eine schon vergebene Element-id ab', () => {
    const { stack, ids } = dreiFormen();
    const w = testWerkzeuge();
    const doppelt = erzeugeForm({ x: 0, y: 0, breite: 1, hoehe: 1 }, 'rechteck', {}, w);

    const kollision = { ...doppelt, id: ids[0]! };
    expect(() =>
      stack.ausfuehren(
        new ElementHinzufuegen(
          { seiteId: ersteSeiteId(stack.entwurf), gruppenId: null, index: 0 },
          kollision,
        ),
      ),
    ).toThrow(/schon vergeben/);
  });

  it('lehnt eine unbekannte Seite ab', () => {
    const { stack } = dreiFormen();
    const w = testWerkzeuge('neu');
    expect(() =>
      stack.ausfuehren(
        new ElementHinzufuegen(
          { seiteId: 'seite-gibt-es-nicht', gruppenId: null, index: 0 },
          erzeugeForm({ x: 0, y: 0, breite: 1, hoehe: 1 }, 'rechteck', {}, w),
        ),
      ),
    ).toThrow(/gibt es nicht/);
  });

  it('hängt hinten an, wenn der Index über die Länge hinausgeht', () => {
    const { stack } = dreiFormen();
    const w = testWerkzeuge('neu');
    stack.ausfuehren(
      new ElementHinzufuegen(
        { seiteId: ersteSeiteId(stack.entwurf), gruppenId: null, index: 999 },
        erzeugeForm({ x: 0, y: 0, breite: 1, hoehe: 1 }, 'rechteck', { name: 'd' }, w),
      ),
    );
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('StapelReihenfolgeAendern', () => {
  it('schiebt einen Schritt nach vorn und wieder zurück', () => {
    const { stack, ids } = dreiFormen();

    stack.ausfuehren(new StapelReihenfolgeAendern(ids[0]!, 'vor'));
    expect(reihenfolge(stack.entwurf)).toEqual(['b', 'a', 'c']);

    stack.rueckgaengig();
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);
  });

  it('schiebt ganz nach vorn und ganz nach hinten', () => {
    const { stack, ids } = dreiFormen();

    stack.ausfuehren(new StapelReihenfolgeAendern(ids[0]!, 'ganzVor'));
    expect(reihenfolge(stack.entwurf)).toEqual(['b', 'c', 'a']);

    stack.ausfuehren(new StapelReihenfolgeAendern(ids[0]!, 'ganzZurueck'));
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);
  });

  it('bleibt am Rand stehen, statt zu wandern', () => {
    const { stack, ids } = dreiFormen();

    stack.ausfuehren(new StapelReihenfolgeAendern(ids[0]!, 'zurueck'));
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);

    stack.ausfuehren(new StapelReihenfolgeAendern(ids[2]!, 'vor'));
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);
  });

  it('macht auch eine mehrstufige Umsortierung sauber rückgängig', () => {
    const { stack, ids } = dreiFormen();

    stack.ausfuehren(new StapelReihenfolgeAendern(ids[2]!, 'ganzZurueck'));
    stack.ausfuehren(new StapelReihenfolgeAendern(ids[0]!, 'vor'));
    expect(reihenfolge(stack.entwurf)).toEqual(['c', 'b', 'a']);

    stack.rueckgaengig();
    stack.rueckgaengig();
    expect(reihenfolge(stack.entwurf)).toEqual(['a', 'b', 'c']);
  });
});

describe('ElementAendern', () => {
  it('nimmt genau die geänderten Felder zurück', () => {
    const w = testWerkzeuge();
    const text = erzeugeText(
      { x: 0, y: 0, breite: 100, hoehe: 40 },
      'Titel',
      { schriftGroesse: 20 },
      w,
    );
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    stack.ausfuehren(
      new ElementAendern(text.id, { schriftGroesse: 48, farbe: '#003366' }, 'farbe'),
    );
    const geaendert = findeElement(stack.entwurf, text.id)?.element;
    if (geaendert?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(geaendert.schriftGroesse).toBe(48);
    expect(geaendert.farbe).toBe('#003366');
    expect(geaendert.inhalt).toBe('Titel');

    stack.rueckgaengig();
    const zurueck = findeElement(stack.entwurf, text.id)?.element;
    if (zurueck?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(zurueck.schriftGroesse).toBe(20);
    expect(zurueck.farbe).toBe('#000000');
  });

  it('verweigert Änderungen an id und typ', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', {}, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    const boesartig = { id: 'anders' } as unknown as ConstructorParameters<
      typeof ElementAendern
    >[1];
    expect(() => stack.ausfuehren(new ElementAendern(text.id, boesartig, 'farbe'))).toThrow(
      /darf nicht geändert werden/,
    );
  });

  it('lehnt eine leere Änderung ab', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', {}, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    expect(() => stack.ausfuehren(new ElementAendern(text.id, {}, 'farbe'))).toThrow(
      /leere Änderung/,
    );
  });
});

describe('TextAendern', () => {
  it('weigert sich, auf einem Nicht-Textelement zu arbeiten', () => {
    const w = testWerkzeuge();
    const form = erzeugeForm({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'rechteck', {}, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), form), { jetzt: festeUhr() });

    expect(() => stack.ausfuehren(new TextAendern(form.id, 'Hallo'))).toThrow(KommandoFehler);
    expect(() => stack.ausfuehren(new TextAendern(form.id, 'Hallo'))).toThrow(/nicht "text"/);
  });
});
