import {
  type Entwurf,
  erzeugeEntwurf,
  erzeugeForm,
  erzeugeText,
  festeUhr,
  findeElement,
  formatNachSchluessel,
  KommandoStack,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';
import { describe, expect, it, vi } from 'vitest';
import { Auswahlsteuerung, GRIFFE, grifflagen, rahmenNachGriff } from '../src/auswahl.js';

function werkzeuge(praefix = 'a'): Werkzeuge {
  return { neueId: zaehlerId(praefix), jetzt: festeUhr() };
}

function aufbau() {
  const w = werkzeuge();
  const format = formatNachSchluessel('a5-hoch');
  if (format === null) throw new Error('Format fehlt');

  const basis = erzeugeEntwurf({ organisationId: 'org-1', name: 'Test', format }, w);
  const frei = erzeugeText({ x: 100, y: 100, breite: 400, hoehe: 80 }, 'frei', {}, w);
  const gesperrt = erzeugeForm(
    { x: 0, y: 0, breite: 200, hoehe: 200 },
    'rechteck',
    { name: 'Balken', gesperrt: true },
    w,
  );
  const platzhalter = erzeugeText(
    { x: 100, y: 400, breite: 400, hoehe: 80 },
    'Vorbelegung',
    {
      name: 'Schlagzeile',
      platzhalter: {
        schluessel: 'schlagzeile',
        bearbeitbar: ['text'],
        beschriftung: null,
        bindung: null,
      },
    },
    w,
  );

  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');
  const entwurf: Entwurf = {
    ...basis,
    seiten: [{ ...erste, elemente: [gesperrt, frei, platzhalter] }],
  };

  const melde = vi.fn();
  const stack = new KommandoStack(entwurf, { jetzt: festeUhr() });
  return {
    stack,
    steuerung: new Auswahlsteuerung(stack, melde),
    melde,
    frei,
    gesperrt,
    platzhalter,
  };
}

describe('Auswahl', () => {
  it('wählt ein vorhandenes Element', () => {
    const { steuerung, frei } = aufbau();
    steuerung.waehle(frei.id);
    expect(steuerung.ausgewaehlt).toBe(frei.id);
    expect(steuerung.ausgewaehltesElement?.name).toBe(frei.name);
  });

  it('vergisst eine unbekannte id, statt sie zu behalten', () => {
    const { steuerung } = aufbau();
    steuerung.waehle('gibt-es-nicht');
    expect(steuerung.ausgewaehlt).toBeNull();
  });

  it('meldet, ob das Gewählte überhaupt beweglich ist', () => {
    const { steuerung, frei, gesperrt, platzhalter } = aufbau();

    steuerung.waehle(frei.id);
    expect(steuerung.istBeweglich).toBe(true);

    steuerung.waehle(gesperrt.id);
    expect(steuerung.istBeweglich).toBe(false);

    // Ein Platzhalter, der nur Text freigibt, ist nicht verschiebbar.
    steuerung.waehle(platzhalter.id);
    expect(steuerung.istBeweglich).toBe(false);
  });
});

describe('Ziehen', () => {
  it('verschiebt um die Differenz und verschmilzt zu einem Rückgängig-Schritt', () => {
    const { steuerung, stack, frei } = aufbau();

    expect(steuerung.beginneZiehen(frei.id, { x: 0, y: 0 })).toBe(true);
    for (let i = 1; i <= 10; i += 1) steuerung.zieheWeiter({ x: i * 5, y: i * 3 });
    steuerung.beendeZiehen();

    expect(findeElement(stack.entwurf, frei.id)?.element.x).toBe(150);
    expect(findeElement(stack.entwurf, frei.id)?.element.y).toBe(130);
    expect(stack.verlauf).toHaveLength(1);

    // Der Kern der Regel über absolute Umkehrungen: ein Rückgängig nimmt die
    // ganze Ziehbewegung zurück, nicht nur den letzten Schritt.
    stack.rueckgaengig();
    expect(findeElement(stack.entwurf, frei.id)?.element.x).toBe(100);
    expect(findeElement(stack.entwurf, frei.id)?.element.y).toBe(100);
  });

  it('verweigert das Ziehen eines gesperrten Elements und sagt warum', () => {
    const { steuerung, melde, gesperrt } = aufbau();

    expect(steuerung.beginneZiehen(gesperrt.id, { x: 0, y: 0 })).toBe(false);
    expect(steuerung.ziehtGerade).toBe(false);
    expect(melde).toHaveBeenCalledWith(expect.stringContaining('gesperrt'));
  });

  it('nennt bei einem Platzhalter den Platzhalter, nicht die Sperre', () => {
    const { steuerung, melde, platzhalter } = aufbau();

    steuerung.beginneZiehen(platzhalter.id, { x: 0, y: 0 });
    expect(melde).toHaveBeenCalledWith(expect.stringContaining('Platzhalter'));
  });

  it('ignoriert Bewegung ohne vorheriges Aufsetzen', () => {
    const { steuerung, stack, frei } = aufbau();
    steuerung.zieheWeiter({ x: 50, y: 50 });
    expect(findeElement(stack.entwurf, frei.id)?.element.x).toBe(100);
  });

  it('setzt beim Abbrechen auf die Ausgangslage zurück', () => {
    const { steuerung, stack, frei } = aufbau();

    steuerung.beginneZiehen(frei.id, { x: 0, y: 0 });
    steuerung.zieheWeiter({ x: 200, y: 200 });
    steuerung.brichZiehenAb();

    expect(findeElement(stack.entwurf, frei.id)?.element.x).toBe(100);
    expect(findeElement(stack.entwurf, frei.id)?.element.y).toBe(100);
  });

  it('verschiebt mit Tastaturschritten', () => {
    const { steuerung, stack, frei } = aufbau();
    steuerung.waehle(frei.id);
    steuerung.verschiebeUmSchritt(-10, 5);
    expect(findeElement(stack.entwurf, frei.id)?.element.x).toBe(90);
    expect(findeElement(stack.entwurf, frei.id)?.element.y).toBe(105);
  });

  it('meldet abgelehnte Tastaturschritte, statt still zu bleiben', () => {
    const { steuerung, melde, gesperrt } = aufbau();
    steuerung.waehle(gesperrt.id);
    steuerung.verschiebeUmSchritt(5, 0);
    expect(melde).toHaveBeenCalled();
  });
});

describe('Griffe', () => {
  it('legt acht Griffe an die Rahmenkanten', () => {
    const lagen = grifflagen();
    expect(lagen).toHaveLength(GRIFFE.length);
    expect(lagen.every((g) => g.ax >= 0 && g.ax <= 1 && g.ay >= 0 && g.ay <= 1)).toBe(true);
    expect(lagen.find((g) => g.art === 'se')).toEqual({ art: 'se', ax: 1, ay: 1 });
  });

  it('zieht die rechte Kante nach außen', () => {
    const neu = rahmenNachGriff({ x: 10, y: 10, breite: 100, hoehe: 50 }, 'e', 40, 0);
    expect(neu).toEqual({ x: 10, y: 10, breite: 140, hoehe: 50 });
  });

  it('verschiebt beim Ziehen an der linken Kante auch den Ursprung', () => {
    const neu = rahmenNachGriff({ x: 100, y: 10, breite: 100, hoehe: 50 }, 'w', 30, 0);
    expect(neu.breite).toBe(70);
    expect(neu.x).toBe(130);
  });

  it('lässt ein Element nicht durch Überziehen spiegeln', () => {
    // Ohne Mindestgröße würde die Breite negativ und das Element klappte um.
    const neu = rahmenNachGriff({ x: 0, y: 0, breite: 100, hoehe: 50 }, 'e', -500, 0);
    expect(neu.breite).toBeGreaterThan(0);
  });

  it('verkleinert an der Ecke in beiden Achsen', () => {
    const neu = rahmenNachGriff({ x: 0, y: 0, breite: 100, hoehe: 100 }, 'se', -40, -60);
    expect(neu).toEqual({ x: 0, y: 0, breite: 60, hoehe: 40 });
  });
});
