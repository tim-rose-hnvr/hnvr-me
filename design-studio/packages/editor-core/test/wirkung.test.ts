import { describe, expect, it } from 'vitest';
import {
  type Aussage,
  type Entwurf,
  feldwert,
  hexZuRgb,
  kontrastverhaeltnis,
  leuchtdichte,
  nurWirkungsfehler,
  pruefeWirkung,
  reichweiteMeter,
  tatsaechlicherUntergrund,
  versalhoeheMm,
} from '../src/index.js';
import { druckEntwurf, erzeugeForm, erzeugeText, mitElementen, testWerkzeuge } from './hilfen.js';

function regeln(entwurf: Entwurf, optionen = {}): string[] {
  return pruefeWirkung(entwurf, optionen).map((b) => b.regel);
}

describe('Kontrastrechnung', () => {
  it('rechnet die bekannten Eckwerte', () => {
    const weiss = hexZuRgb('#ffffff');
    const schwarz = hexZuRgb('#000000');
    if (weiss === null || schwarz === null) throw new Error('Farbe erwartet');

    expect(leuchtdichte(weiss)).toBeCloseTo(1, 6);
    expect(leuchtdichte(schwarz)).toBeCloseTo(0, 6);
    expect(kontrastverhaeltnis(weiss, schwarz)).toBeCloseTo(21, 2);
    expect(kontrastverhaeltnis(weiss, weiss)).toBeCloseTo(1, 6);
  });

  it('weist Unfarben ab, statt schwarz zu raten', () => {
    expect(hexZuRgb('rebeccapurple')).toBeNull();
  });
});

describe('Der tatsächliche Untergrund', () => {
  it('findet die Fläche, die wirklich hinter dem Text liegt', () => {
    // Der häufigste Fehler dieser Art: jemand verschiebt den farbigen Balken,
    // auf dem die weiße Schrift lag. Die Seitenfarbe sagt darüber nichts.
    const w = testWerkzeuge();
    const balken = erzeugeForm(
      { x: 0, y: 0, breite: 1000, hoehe: 400 },
      'rechteck',
      { name: 'Kopfbalken', fuellung: '#0a5c8a' },
      w,
    );
    const text = erzeugeText(
      { x: 50, y: 50, breite: 800, hoehe: 200 },
      'Titel',
      { farbe: '#ffffff' },
      w,
    );
    const entwurf = mitElementen(druckEntwurf(w), balken, text);
    const seite = entwurf.seiten[0];
    if (seite === undefined) throw new Error('Seite erwartet');

    expect(tatsaechlicherUntergrund(seite, text)?.quelle).toBe('Kopfbalken');
  });

  it('fällt auf den Seitenhintergrund zurück, wenn nichts darunter liegt', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 50, y: 900, breite: 800, hoehe: 200 }, 'Titel', {}, w);
    const entwurf = mitElementen(druckEntwurf(w), text);
    const seite = entwurf.seiten[0];
    if (seite === undefined) throw new Error('Seite erwartet');

    expect(tatsaechlicherUntergrund(seite, text)?.quelle).toBe('Seitenhintergrund');
  });

  it('übergeht Flächen, die über dem Text liegen', () => {
    const w = testWerkzeuge();
    const text = erzeugeText({ x: 50, y: 50, breite: 800, hoehe: 200 }, 'Titel', {}, w);
    const davor = erzeugeForm(
      { x: 0, y: 0, breite: 1000, hoehe: 400 },
      'rechteck',
      { name: 'Davor', fuellung: '#ff0000' },
      w,
    );
    const entwurf = mitElementen(druckEntwurf(w), text, davor);
    const seite = entwurf.seiten[0];
    if (seite === undefined) throw new Error('Seite erwartet');

    expect(tatsaechlicherUntergrund(seite, text)?.quelle).toBe('Seitenhintergrund');
  });
});

describe('Kontrastprüfung am Entwurf', () => {
  it('findet weiße Schrift auf weißem Grund', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 100, y: 900, breite: 800, hoehe: 200 },
        'unsichtbar',
        { farbe: '#ffffff' },
        w,
      ),
    );

    const befund = pruefeWirkung(entwurf).find((b) => b.regel === 'kontrast');
    expect(befund?.schwere).toBe('fehler');
    expect(befund?.messwert).toBe('1.0:1');
  });

  it('lässt schwarze Schrift auf Weiß in Ruhe', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 100, y: 900, breite: 800, hoehe: 200 }, 'lesbar', { farbe: '#000000' }, w),
    );
    expect(regeln(entwurf)).not.toContain('kontrast');
  });

  it('misst gegen den Balken, nicht gegen die Seitenfarbe', () => {
    const w = testWerkzeuge();
    const balken = erzeugeForm(
      { x: 0, y: 0, breite: 2000, hoehe: 600 },
      'rechteck',
      { name: 'Balken', fuellung: '#0a5c8a' },
      w,
    );
    // Weiß auf Blau ist in Ordnung — gegen die weiße Seite gemessen wäre es
    // ein Fehler. Genau darum wird der echte Untergrund gesucht.
    const text = erzeugeText(
      { x: 100, y: 100, breite: 800, hoehe: 200 },
      'weiß',
      { farbe: '#ffffff' },
      w,
    );
    const entwurf = mitElementen(druckEntwurf(w), balken, text);

    expect(regeln(entwurf)).not.toContain('kontrast');
  });
});

describe('Lesbarkeit auf Entfernung', () => {
  it('rechnet Versalhöhe und Reichweite', () => {
    // 100 px bei 300 dpi sind 8,47 mm; davon 70 % Versalhöhe = 5,9 mm.
    expect(versalhoeheMm(100, 300)).toBeCloseTo(5.93, 2);
    // Faustregel: lesbar auf das 250-fache der Versalhöhe.
    expect(reichweiteMeter(100, 300)).toBeCloseTo(1.48, 2);
  });

  it('meldet zu kleine Schrift für ein Plakat', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 100, y: 900, breite: 1400, hoehe: 100 },
        'zu klein',
        { schriftGroesse: 40 },
        w,
      ),
    );

    const befund = pruefeWirkung(entwurf, { leseabstandMeter: 3 }).find(
      (b) => b.regel === 'lesbarkeit',
    );
    expect(befund).toBeDefined();
    expect(befund?.meldung).toMatch(/Versalhöhe/);
  });

  it('schweigt, wenn die Schrift auf die Entfernung trägt', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 100, y: 900, breite: 1400, hoehe: 400 }, 'groß', { schriftGroesse: 300 }, w),
    );
    expect(regeln(entwurf, { leseabstandMeter: 3 })).not.toContain('lesbarkeit');
  });
});

describe('Sperrflächen der Plattformen', () => {
  it('meldet Inhalt unter den Bedienelementen einer Story', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const entwurf = mitElementen(
      basis,
      erzeugeText({ x: 100, y: 20, breite: 800, hoehe: 100 }, 'ganz oben', {}, w),
    );

    const befund = pruefeWirkung(entwurf, { plattform: 'instagram-story' }).find(
      (b) => b.regel === 'sperrflaeche',
    );
    expect(befund?.meldung).toMatch(/Instagram Story/);
  });

  it('lässt Inhalt in der Mitte in Ruhe', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const entwurf = mitElementen(
      basis,
      erzeugeText({ x: 100, y: basis.masse.hoehe * 0.45, breite: 800, hoehe: 100 }, 'Mitte', {}, w),
    );
    expect(regeln(entwurf, { plattform: 'instagram-story' })).not.toContain('sperrflaeche');
  });

  it('prüft nichts ohne Plattformangabe', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 100, y: 10, breite: 800, hoehe: 100 }, 'oben', {}, w),
    );
    expect(regeln(entwurf)).not.toContain('sperrflaeche');
  });
});

describe('Textmenge gegen Entfernung', () => {
  it('meldet ein überfrachtetes Plakat', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 100, y: 900, breite: 1400, hoehe: 800 },
        'Wort '.repeat(60),
        { schriftGroesse: 300 },
        w,
      ),
    );
    expect(regeln(entwurf, { leseabstandMeter: 3 })).toContain('textmenge');
  });

  it('lässt denselben Text aus Lesedistanz zu', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 100, y: 900, breite: 1400, hoehe: 800 }, 'Wort '.repeat(60), {}, w),
    );
    expect(regeln(entwurf, { leseabstandMeter: 0.4 })).not.toContain('textmenge');
  });
});

describe('Haltbarkeit', () => {
  const aussage: Aussage = {
    id: 'a-1',
    organisationId: 'org-1',
    name: 'Sommerfest',
    felder: { titel: feldwert('Sommerfest') },
    termin: '2026-09-12T00:00:00.000Z',
    erstelltAm: '2026-01-01T00:00:00.000Z',
    geaendertAm: '2026-01-01T00:00:00.000Z',
  };

  it('erklärt abgelaufenes Material für falsch, nicht für hässlich', () => {
    const befund = pruefeWirkung(druckEntwurf(), {
      aussage,
      heute: new Date('2026-09-20T00:00:00Z'),
    }).find((b) => b.regel === 'abgelaufen');

    expect(befund?.schwere).toBe('fehler');
    expect(befund?.messwert).toBe('-8 Tage');
  });

  it('warnt, wenn der Termin für Druck und Versand zu nah ist', () => {
    const befund = pruefeWirkung(druckEntwurf(), {
      aussage,
      heute: new Date('2026-09-10T00:00:00Z'),
    }).find((b) => b.regel === 'laeuft-ab');
    expect(befund?.schwere).toBe('warnung');
  });

  it('schweigt bei ausreichend Vorlauf', () => {
    expect(
      regeln(druckEntwurf(), { aussage, heute: new Date('2026-06-01T00:00:00Z') }),
    ).not.toContain('laeuft-ab');
  });

  it('prüft nichts ohne Aussage', () => {
    expect(regeln(druckEntwurf())).not.toContain('abgelaufen');
  });
});

describe('Was sich nicht prüfen lässt, wird gesagt', () => {
  it('meldet einen ungeprüften Kontrast, statt einen zu erfinden', () => {
    // Ohne Untergrund und ohne lesbare Farbe gibt es kein Verhältnis. Eine
    // stillschweigende Annahme wäre hier schlimmer als der Hinweis.
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const erste = basis.seiten[0];
    if (erste === undefined) throw new Error('Seite erwartet');

    const entwurf: Entwurf = {
      ...basis,
      seiten: [
        {
          ...erste,
          hintergrund: null,
          elemente: [
            erzeugeText({ x: 0, y: 0, breite: 800, hoehe: 200 }, 'Titel', { name: 'Titel' }, w),
          ],
        },
      ],
    };

    const befund = pruefeWirkung(entwurf).find((b) => b.regel === 'kontrast-unbekannt');
    expect(befund?.schwere).toBe('hinweis');
    expect(befund?.messwert).toBeNull();
  });

  it('siebt die Fehler aus den Befunden', () => {
    const w = testWerkzeuge();
    // 150 px Versalgrundlage bei 300 dpi tragen gut zwei Meter — auf drei
    // gelesen ist das eine Warnung, kein Fehler. Daneben der abgelaufene
    // Termin als Fehler: erst diese Mischung zeigt, dass gesiebt wird.
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText({ x: 0, y: 0, breite: 2000, hoehe: 300 }, 'Fest', { schriftGroesse: 150 }, w),
    );
    const befunde = pruefeWirkung(entwurf, {
      leseabstandMeter: 3,
      aussage: {
        id: 'a-1',
        organisationId: 'org-1',
        name: 'Sommerfest',
        felder: { titel: feldwert('Sommerfest') },
        termin: '2026-09-12T00:00:00.000Z',
        erstelltAm: '2026-01-01T00:00:00.000Z',
        geaendertAm: '2026-01-01T00:00:00.000Z',
      },
      heute: new Date('2026-09-20T00:00:00Z'),
    });

    expect(befunde.length).toBeGreaterThan(nurWirkungsfehler(befunde).length);
    expect(nurWirkungsfehler(befunde).every((b) => b.schwere === 'fehler')).toBe(true);
  });
});
