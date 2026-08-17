import { describe, expect, it } from 'vitest';
import {
  type AssetReferenz,
  erzeugeAusVorlage,
  erzeugeBild,
  sammlePlatzhalter,
  type Vorlage,
  VorlagenFehler,
  type VorlagenWert,
} from '../src/index.js';
import { druckEntwurf, erzeugeForm, erzeugeText, mitElementen, testWerkzeuge } from './hilfen.js';

const logo: AssetReferenz = {
  id: 'logo-1',
  url: '/logo.png',
  breite: 800,
  hoehe: 200,
  mimeTyp: 'image/png',
};
const kundenlogo: AssetReferenz = {
  id: 'logo-2',
  url: '/kunde.png',
  breite: 900,
  hoehe: 300,
  mimeTyp: 'image/png',
};

function vorlage(): Vorlage {
  const w = testWerkzeuge('bau');
  const bauplan = mitElementen(
    druckEntwurf(w),
    erzeugeText(
      { x: 200, y: 200, breite: 2000, hoehe: 300 },
      'Ihre Schlagzeile',
      {
        name: 'Schlagzeile',
        platzhalter: {
          schluessel: 'schlagzeile',
          bearbeitbar: ['text'],
          beschriftung: 'Schlagzeile',
          bindung: null,
        },
      },
      w,
    ),
    erzeugeBild(
      { x: 200, y: 600, breite: 800, hoehe: 200 },
      logo,
      {
        name: 'Logo',
        platzhalter: {
          schluessel: 'logo',
          bearbeitbar: ['bild'],
          beschriftung: 'Kundenlogo',
          bindung: null,
        },
      },
      w,
    ),
    erzeugeForm(
      { x: 0, y: 0, breite: 2480, hoehe: 100 },
      'rechteck',
      {
        name: 'Zierbalken',
        gesperrt: true,
      },
      w,
    ),
  );

  return {
    id: 'vorlage-1',
    organisationId: 'org-1',
    name: 'Aushang A4',
    beschreibung: 'Standardaushang',
    markenkitId: 'kit-1',
    bauplan,
  };
}

const werte: Record<string, VorlagenWert> = {
  schlagzeile: { typ: 'text', wert: 'Sommerfest 2026' },
  logo: { typ: 'bild', wert: kundenlogo },
};

describe('sammlePlatzhalter', () => {
  it('listet die Platzhalter mit Beschriftung und Vorbelegung', () => {
    const infos = sammlePlatzhalter(vorlage());

    expect(infos.map((i) => i.schluessel)).toEqual(['schlagzeile', 'logo']);
    expect(infos[0]?.beschriftung).toBe('Schlagzeile');
    expect(infos[0]?.vorbelegung).toBe('Ihre Schlagzeile');
    expect(infos[1]?.elementTyp).toBe('bild');
  });
});

describe('erzeugeAusVorlage', () => {
  it('befüllt die Platzhalter und lässt den Rest stehen', () => {
    const entwurf = erzeugeAusVorlage(vorlage(), werte, {}, testWerkzeuge('neu'));

    const [schlagzeile, logoElement, balken] = entwurf.seiten[0]!.elemente;
    if (schlagzeile?.typ !== 'text') throw new Error('Textelement erwartet');
    if (logoElement?.typ !== 'bild') throw new Error('Bildelement erwartet');

    expect(schlagzeile.inhalt).toBe('Sommerfest 2026');
    expect(logoElement.quelle.id).toBe('logo-2');
    expect(balken?.name).toBe('Zierbalken');
    expect(balken?.gesperrt).toBe(true);
  });

  it('vergibt frische ids, damit zwei Ausgaben derselben Vorlage nicht kollidieren', () => {
    const v = vorlage();
    const a = erzeugeAusVorlage(v, werte, {}, testWerkzeuge('a'));
    const b = erzeugeAusVorlage(v, werte, {}, testWerkzeuge('b'));

    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(v.bauplan.id);
    expect(a.seiten[0]!.id).not.toBe(v.bauplan.seiten[0]!.id);

    const idsA = a.seiten[0]!.elemente.map((e) => e.id);
    const idsB = b.seiten[0]!.elemente.map((e) => e.id);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });

  it('vermerkt Herkunft und Markenkit am Ergebnis', () => {
    const entwurf = erzeugeAusVorlage(
      vorlage(),
      werte,
      { name: 'Aushang Juli' },
      testWerkzeuge('neu'),
    );

    expect(entwurf.vorlageId).toBe('vorlage-1');
    expect(entwurf.markenkitId).toBe('kit-1');
    expect(entwurf.name).toBe('Aushang Juli');
    expect(entwurf.organisationId).toBe('org-1');
  });

  it('setzt den Zuschnitt zurück, wenn ein Bild getauscht wird', () => {
    const v = vorlage();
    const mitZuschnitt: Vorlage = {
      ...v,
      bauplan: {
        ...v.bauplan,
        seiten: v.bauplan.seiten.map((s) => ({
          ...s,
          elemente: s.elemente.map((e) =>
            e.typ === 'bild' ? { ...e, zuschnitt: { x: 0.2, y: 0.2, breite: 0.5, hoehe: 0.5 } } : e,
          ),
        })),
      },
    };

    const entwurf = erzeugeAusVorlage(mitZuschnitt, werte, {}, testWerkzeuge('neu'));
    const bild = entwurf.seiten[0]!.elemente[1];
    if (bild?.typ !== 'bild') throw new Error('Bildelement erwartet');
    expect(bild.zuschnitt).toEqual({ x: 0, y: 0, breite: 1, hoehe: 1 });
  });

  it('setzt eine Farbe auf Text und auf Form', () => {
    const v = vorlage();
    const w = testWerkzeuge('farb');
    const mitFarbfeld: Vorlage = {
      ...v,
      bauplan: mitElementen(
        v.bauplan,
        erzeugeForm(
          { x: 0, y: 900, breite: 100, hoehe: 100 },
          'rechteck',
          {
            name: 'Akzent',
            platzhalter: {
              schluessel: 'akzent',
              bearbeitbar: ['farbe'],
              beschriftung: null,
              bindung: null,
            },
          },
          w,
        ),
      ),
    };

    const entwurf = erzeugeAusVorlage(
      mitFarbfeld,
      { ...werte, akzent: { typ: 'farbe', wert: '#003366' } },
      {},
      testWerkzeuge('neu'),
    );

    const akzent = entwurf.seiten[0]!.elemente.at(-1);
    if (akzent?.typ !== 'form') throw new Error('Formelement erwartet');
    expect(akzent.fuellung).toBe('#003366');
  });

  it('weist eine Farbe auf einem Element ohne Farbe ab', () => {
    const v = vorlage();
    const w = testWerkzeuge('grp');
    const mitGruppe: Vorlage = {
      ...v,
      bauplan: mitElementen(v.bauplan, {
        ...erzeugeForm(
          { x: 0, y: 900, breite: 10, hoehe: 10 },
          'rechteck',
          {
            name: 'Block',
            platzhalter: {
              schluessel: 'block',
              bearbeitbar: ['farbe'],
              beschriftung: null,
              bindung: null,
            },
          },
          w,
        ),
        typ: 'gruppe',
        kinder: [],
      } as never),
    };

    expect(() =>
      erzeugeAusVorlage(
        mitGruppe,
        { ...werte, block: { typ: 'farbe', wert: '#003366' } },
        {},
        testWerkzeuge('neu'),
      ),
    ).toThrow(/keine Farbe hat/);
  });

  it('vergibt auch Kindern einer Gruppe frische ids', () => {
    const v = vorlage();
    const w = testWerkzeuge('grp');
    const kind = erzeugeText({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'Kind', {}, w);
    const mitGruppe: Vorlage = {
      ...v,
      bauplan: mitElementen(v.bauplan, {
        ...erzeugeForm({ x: 0, y: 900, breite: 10, hoehe: 10 }, 'rechteck', { name: 'G' }, w),
        typ: 'gruppe',
        kinder: [kind],
      } as never),
    };

    const entwurf = erzeugeAusVorlage(mitGruppe, werte, {}, testWerkzeuge('neu'));
    const gruppe = entwurf.seiten[0]!.elemente.at(-1);
    if (gruppe?.typ !== 'gruppe') throw new Error('Gruppe erwartet');
    expect(gruppe.kinder[0]?.id).not.toBe(kind.id);
  });

  it('meldet fehlende und unbekannte Platzhalter gesammelt', () => {
    let fehler: VorlagenFehler | null = null;
    try {
      erzeugeAusVorlage(
        vorlage(),
        { schlagzeile: { typ: 'text', wert: 'x' }, fussnote: { typ: 'text', wert: 'y' } },
        {},
        testWerkzeuge('neu'),
      );
    } catch (e) {
      fehler = e as VorlagenFehler;
    }

    expect(fehler).toBeInstanceOf(VorlagenFehler);
    expect(fehler!.gruende).toContain('Platzhalter "fussnote" gibt es in dieser Vorlage nicht');
    expect(fehler!.gruende).toContain('Platzhalter "logo" fehlt');
  });

  it('lässt Lücken zu, wenn ausdrücklich erlaubt', () => {
    const entwurf = erzeugeAusVorlage(
      vorlage(),
      { schlagzeile: { typ: 'text', wert: 'Nur der Titel' } },
      { luecken: true },
      testWerkzeuge('neu'),
    );

    const bild = entwurf.seiten[0]!.elemente[1];
    if (bild?.typ !== 'bild') throw new Error('Bildelement erwartet');
    expect(bild.quelle.id).toBe('logo-1');
  });

  it('weist einen Wert ab, für den der Platzhalter nicht offen ist', () => {
    expect(() =>
      erzeugeAusVorlage(
        vorlage(),
        { ...werte, schlagzeile: { typ: 'farbe', wert: '#003366' } },
        {},
        testWerkzeuge('neu'),
      ),
    ).toThrow(/nicht als Farbe bearbeitbar/);
  });

  it('weist einen Wert ab, der nicht zum Elementtyp passt', () => {
    const v = vorlage();
    const falschTypisiert: Vorlage = {
      ...v,
      bauplan: {
        ...v.bauplan,
        seiten: v.bauplan.seiten.map((s) => ({
          ...s,
          elemente: s.elemente.map((e) =>
            e.typ === 'bild'
              ? {
                  ...e,
                  platzhalter: {
                    schluessel: 'logo',
                    bearbeitbar: ['text' as const],
                    beschriftung: null,
                    bindung: null,
                  },
                }
              : e,
          ),
        })),
      },
    };

    expect(() =>
      erzeugeAusVorlage(
        falschTypisiert,
        { ...werte, logo: { typ: 'text', wert: 'kein Bild' } },
        {},
        testWerkzeuge('neu'),
      ),
    ).toThrow(/vom Typ "bild", nicht "text"/);
  });
});
