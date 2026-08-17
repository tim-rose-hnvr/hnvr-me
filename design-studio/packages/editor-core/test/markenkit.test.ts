import { describe, expect, it } from 'vitest';
import {
  ElementAendern,
  KommandoStack,
  festeUhr,
  mitMarkenkit,
  neueVerstoesse,
  nurFehler,
  pruefeMarkenkonform,
  type Markenkit,
} from '../src/index.js';
import { druckEntwurf, erzeugeForm, erzeugeText, mitElementen, testMarkenkit, testWerkzeuge } from './hilfen.js';

const locker: Markenkit = { ...testMarkenkit, strikt: false };

describe('pruefeMarkenkonform', () => {
  it('nimmt einen markenkonformen Entwurf ohne Befund ab', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      { ...druckEntwurf(w), markenkitId: testMarkenkit.id },
      erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 40 }, 'Titel', { farbe: '#003366' }, w),
    );
    expect(pruefeMarkenkonform(entwurf, testMarkenkit)).toEqual([]);
  });

  it('findet fremde Farben in Text, Füllung und Kontur', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', { farbe: '#ff0000' }, w),
      erzeugeForm({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'rechteck', {
        fuellung: '#00ff00',
        kontur: { farbe: '#0000ff', staerke: 4 },
      }, w),
    );

    const farbverstoesse = pruefeMarkenkonform(entwurf, testMarkenkit).filter((v) => v.regel === 'farbe');
    expect(farbverstoesse).toHaveLength(3);
  });

  it('ignoriert die Transparenz beim Farbvergleich', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', { farbe: '#00336680' }, w),
    );
    expect(pruefeMarkenkonform(entwurf, testMarkenkit).filter((v) => v.regel === 'farbe')).toEqual([]);
  });

  it('findet einen Schriftschnitt, den es gar nicht gibt', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', {
        farbe: '#003366',
        schriftStaerke: 300,
      }, w),
    );

    const verstoss = pruefeMarkenkonform(entwurf, testMarkenkit).find((v) => v.regel === 'schriftstaerke');
    expect(verstoss?.meldung).toMatch(/verfügbar: 400, 700/);
  });

  it('warnt vor künstlicher Kursivierung', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', { farbe: '#003366', kursiv: true }, w),
    );
    expect(pruefeMarkenkonform(entwurf, testMarkenkit).some((v) => v.regel === 'schriftschnitt')).toBe(true);
  });

  it('erkennt ein Markenkit aus einer fremden Organisation', () => {
    const entwurf = { ...druckEntwurf(), organisationId: 'org-2' };
    const verstoss = pruefeMarkenkonform(entwurf, testMarkenkit).find((v) => v.regel === 'mandant');
    expect(verstoss?.schwere).toBe('fehler');
  });

  it('stuft Verstöße bei nicht striktem Kit zu Warnungen herab', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', { farbe: '#ff0000' }, w),
    );
    expect(nurFehler(pruefeMarkenkonform(entwurf, locker))).toEqual([]);
  });
});

describe('mitMarkenkit', () => {
  it('lehnt ein Kommando ab, das einen neuen Verstoß einführt', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 40 }, 'Titel', { farbe: '#003366' }, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    expect(() =>
      stack.ausfuehren(mitMarkenkit(new ElementAendern(text.id, { farbe: '#ff0000' }, 'farbe'), testMarkenkit)),
    ).toThrow(/verletzt das Markenkit/);

    const unveraendert = stack.entwurf.seiten[0]?.elemente[0];
    if (unveraendert?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(unveraendert.farbe).toBe('#003366');
  });

  it('lässt einen bestehenden Verstoß weiterbearbeiten, statt den Entwurf einzufrieren', () => {
    const w = testWerkzeuge();
    // Dieser Entwurf verletzt das Kit schon vor jedem Kommando.
    const text = erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 40 }, 'Titel', { farbe: '#ff0000' }, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    // Eine unbeteiligte Änderung muss durchgehen …
    expect(() =>
      stack.ausfuehren(mitMarkenkit(new ElementAendern(text.id, { schriftGroesse: 30 }, 'farbe'), testMarkenkit)),
    ).not.toThrow();

    // … und die Reparatur erst recht.
    expect(() =>
      stack.ausfuehren(mitMarkenkit(new ElementAendern(text.id, { farbe: '#003366' }, 'farbe'), testMarkenkit)),
    ).not.toThrow();
    expect(pruefeMarkenkonform(stack.entwurf, testMarkenkit)).toEqual([]);
  });

  it('bewacht auch die Umkehrung, damit Wiederholen nichts einschleust', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 40 }, 'Titel', { farbe: '#003366' }, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    stack.ausfuehren(mitMarkenkit(new ElementAendern(text.id, { schriftGroesse: 30 }, 'farbe'), testMarkenkit));
    stack.rueckgaengig();
    stack.wiederholen();

    const jetzt = stack.entwurf.seiten[0]?.elemente[0];
    if (jetzt?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(jetzt.schriftGroesse).toBe(30);
    expect(pruefeMarkenkonform(stack.entwurf, testMarkenkit)).toEqual([]);
  });

  it('reicht bei nicht striktem Kit einfach durch', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 40 }, 'Titel', { farbe: '#003366' }, w);
    const stack = new KommandoStack(mitElementen(druckEntwurf(w), text), { jetzt: festeUhr() });

    expect(() =>
      stack.ausfuehren(mitMarkenkit(new ElementAendern(text.id, { farbe: '#ff0000' }, 'farbe'), locker)),
    ).not.toThrow();
  });
});

describe('neueVerstoesse', () => {
  it('meldet nur das, was vorher nicht schon dastand', () => {
    const alt = [
      { regel: 'farbe', meldung: 'a', schwere: 'fehler' as const, seiteId: 's', elementId: 'e' },
    ];
    const neu = [
      { regel: 'farbe', meldung: 'a', schwere: 'fehler' as const, seiteId: 's', elementId: 'e' },
      { regel: 'schrift', meldung: 'b', schwere: 'fehler' as const, seiteId: 's', elementId: 'e' },
    ];
    expect(neueVerstoesse(alt, neu).map((v) => v.regel)).toEqual(['schrift']);
  });
});
