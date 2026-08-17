import { describe, expect, it } from 'vitest';
import { ladeEntwurf, migriere, pruefeEntwurf, SchemaFehler } from '../src/index.js';
import { druckEntwurf, erzeugeText, mitElementen, testWerkzeuge } from './hilfen.js';

/** Der Weg, den ein Entwurf beim Speichern und Laden tatsächlich nimmt. */
function ueberJson(wert: unknown): unknown {
  return JSON.parse(JSON.stringify(wert));
}

describe('pruefeEntwurf', () => {
  it('lässt einen erzeugten Entwurf unverändert durch', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 10, y: 10, breite: 200, hoehe: 60 }, 'Hallo', {}, w),
    );
    expect(pruefeEntwurf(ueberJson(entwurf))).toEqual(entwurf);
  });

  it('sammelt alle Verstöße statt beim ersten abzubrechen', () => {
    let fehler: SchemaFehler | null = null;
    try {
      pruefeEntwurf({ id: '', organisationId: '', seiten: [] });
    } catch (e) {
      fehler = e as SchemaFehler;
    }

    expect(fehler).toBeInstanceOf(SchemaFehler);
    expect(fehler!.verstoesse.length).toBeGreaterThan(4);
    const pfade = fehler!.verstoesse.map((v) => v.pfad);
    expect(pfade).toContain('$.id');
    expect(pfade).toContain('$.seiten');
    expect(pfade).toContain('$.masse');
  });

  it('normalisiert Farben auf Kleinschreibung', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', { farbe: '#00FF7B' }, w),
    );
    const geprueft = pruefeEntwurf(ueberJson(entwurf));
    const text = geprueft.seiten[0]?.elemente[0];
    if (text?.typ !== 'text') throw new Error('Textelement erwartet');
    expect(text.farbe).toBe('#00ff7b');
  });

  it('weist ungültige Farbwerte ab', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', {}, w),
    );
    const roh = ueberJson(entwurf) as { seiten: { elemente: { farbe: string }[] }[] };
    roh.seiten[0]!.elemente[0]!.farbe = 'rebeccapurple';

    expect(() => pruefeEntwurf(roh)).toThrow(/muss #RRGGBB/);
  });

  it('weist doppelte Element-ids ab, weil jede Kommando-Adressierung daran hängt', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'a', {}, w);
    const entwurf = mitElementen(druckEntwurf(w), text, { ...text });

    expect(() => pruefeEntwurf(ueberJson(entwurf))).toThrow(/kommt mehrfach vor/);
  });

  it('weist einen Entwurf ohne Seite ab', () => {
    const roh = ueberJson({ ...druckEntwurf(), seiten: [] });
    expect(() => pruefeEntwurf(roh)).toThrow(/mindestens eine Seite/);
  });

  it('weist eine neuere Schemafassung ab, statt sie halb zu verstehen', () => {
    const roh = ueberJson({ ...druckEntwurf(), schemaVersion: 99 });
    expect(() => pruefeEntwurf(roh)).toThrow(/neueren Fassung/);
  });

  it('meldet den Pfad bis ins Element hinein', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'x', {}, w),
    );
    const roh = ueberJson(entwurf) as { seiten: { elemente: { deckkraft: number }[] }[] };
    roh.seiten[0]!.elemente[0]!.deckkraft = 4;

    expect(() => pruefeEntwurf(roh)).toThrow(/\$\.seiten\[0\]\.elemente\[0\]\.deckkraft/);
  });

  it('erkennt einen Zuschnitt, der über die Quelldatei hinausragt', () => {
    const w = testWerkzeuge();
    const entwurf = druckEntwurf(w);
    const roh = ueberJson(entwurf) as { seiten: { elemente: unknown[] }[] };
    roh.seiten[0]!.elemente.push({
      id: 'b1',
      name: 'Bild',
      typ: 'bild',
      x: 0,
      y: 0,
      breite: 100,
      hoehe: 100,
      drehung: 0,
      deckkraft: 1,
      sichtbar: true,
      gesperrt: false,
      platzhalter: null,
      quelle: { id: 'a1', url: '/a.jpg', breite: 800, hoehe: 600, mimeTyp: 'image/jpeg' },
      zuschnitt: { x: 0.8, y: 0, breite: 0.5, hoehe: 1 },
      passform: 'fuellen',
    });

    expect(() => pruefeEntwurf(roh)).toThrow(/ragt rechts über die Quelldatei/);
  });
});

describe('migriere', () => {
  it('ergänzt eine fehlende Schemafassung', () => {
    const roh = ueberJson(druckEntwurf()) as Record<string, unknown>;
    delete roh['schemaVersion'];
    expect(ladeEntwurf(roh).schemaVersion).toBe(1);
  });

  it('lässt Nicht-Objekte unangetastet durch', () => {
    expect(migriere(null)).toBeNull();
    expect(migriere(42)).toBe(42);
  });
});
