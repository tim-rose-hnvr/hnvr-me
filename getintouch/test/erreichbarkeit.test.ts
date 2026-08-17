/**
 * Die Erreichbarkeit ist die Regel, an der diese Seite hängt. Sie entscheidet,
 * welche Schaltfläche oben steht — falsch gerechnet heißt: jemand ruft an,
 * wenn niemand da ist.
 *
 * Geprüft wird gegen feste Zeitpunkte in UTC. Zwei davon liegen in der
 * Sommerzeit (UTC+2) und zwei in der Winterzeit (UTC+1) — genau dort bricht
 * jede selbstgebaute Offset-Rechnung.
 */

import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { bewerteErreichbarkeit, statusText, type Erreichbarkeitsplan } from '../src/kern/erreichbarkeit.ts';
import { tagPlus, wanduhr, zuMinute, zuUhrzeit } from '../src/kern/zeit.ts';

const BUERO: Erreichbarkeitsplan = {
  zeitzone: 'Europe/Berlin',
  fenster: [
    { tag: 1, von: '09:00', bis: '18:00' },
    { tag: 2, von: '09:00', bis: '18:00' },
    { tag: 3, von: '09:00', bis: '18:00' },
    { tag: 4, von: '09:00', bis: '18:00' },
    { tag: 5, von: '09:00', bis: '16:00' },
  ],
  zusage: 'Antwort am nächsten Werktag',
};

describe('Wanduhr', () => {
  it('rechnet Sommerzeit korrekt um (UTC+2)', () => {
    // Donnerstag, 16. Juli 2026, 12:00 UTC → 14:00 in Berlin
    const w = wanduhr(new Date('2026-07-16T12:00:00Z'), 'Europe/Berlin');
    deepStrictEqual(w, { datum: '2026-07-16', wochentag: 4, minute: 14 * 60 });
  });

  it('rechnet Winterzeit korrekt um (UTC+1)', () => {
    // Mittwoch, 14. Januar 2026, 12:00 UTC → 13:00 in Berlin
    const w = wanduhr(new Date('2026-01-14T12:00:00Z'), 'Europe/Berlin');
    deepStrictEqual(w, { datum: '2026-01-14', wochentag: 3, minute: 13 * 60 });
  });

  it('schiebt über Mitternacht auch das Datum', () => {
    // 23:30 UTC im Sommer ist in Berlin schon der nächste Tag, 01:30
    const w = wanduhr(new Date('2026-07-16T23:30:00Z'), 'Europe/Berlin');
    strictEqual(w.datum, '2026-07-17');
    strictEqual(w.minute, 90);
    strictEqual(w.wochentag, 5);
  });

  it('liest Mitternacht als 0 und nicht als 1440', () => {
    const w = wanduhr(new Date('2026-07-16T22:00:00Z'), 'Europe/Berlin');
    strictEqual(w.minute, 0);
  });

  it('meldet unbekannte Zeitzonen, statt still auf UTC zu fallen', () => {
    let geworfen = false;
    try {
      wanduhr(new Date(), 'Europe/Hannover');
    } catch {
      geworfen = true;
    }
    strictEqual(geworfen, true);
  });
});

describe('Uhrzeiten', () => {
  it('liest und schreibt Minuten', () => {
    strictEqual(zuMinute('09:30'), 570);
    strictEqual(zuMinute('24:00'), 1440);
    strictEqual(zuUhrzeit(570), '09:30');
  });

  it('weist Unsinn zurück, statt zu raten', () => {
    strictEqual(zuMinute('25:00'), null);
    strictEqual(zuMinute('09:70'), null);
    strictEqual(zuMinute('neun'), null);
    strictEqual(zuMinute('24:30'), null);
  });

  it('zählt Wochentage im Kreis, auch rückwärts', () => {
    strictEqual(tagPlus(7, 1), 1);
    strictEqual(tagPlus(1, -1), 7);
    strictEqual(tagPlus(3, 14), 3);
  });
});

describe('Bürozeiten', () => {
  it('ist mittwochs um 14 Uhr offen und nennt den Feierabend', () => {
    const lage = bewerteErreichbarkeit(BUERO, new Date('2026-01-14T13:00:00Z'));
    strictEqual(lage.offen, true);
    strictEqual(lage.bis, '18:00');
    strictEqual(statusText(lage), 'Jetzt erreichbar · bis 18:00');
  });

  it('ist am Öffnungsrand exakt: 09:00 offen, 18:00 zu', () => {
    strictEqual(bewerteErreichbarkeit(BUERO, new Date('2026-01-14T08:00:00Z')).offen, true);
    strictEqual(bewerteErreichbarkeit(BUERO, new Date('2026-01-14T17:00:00Z')).offen, false);
  });

  it('nennt morgens vor neun den heutigen Beginn', () => {
    const lage = bewerteErreichbarkeit(BUERO, new Date('2026-01-14T06:30:00Z'));
    strictEqual(lage.offen, false);
    strictEqual(lage.naechste?.text, 'heute ab 9:00');
  });

  it('verweist Freitagabend auf Montag', () => {
    // Freitag, 16. Januar 2026, 17:00 UTC = 18:00 Berlin — nach Feierabend
    const lage = bewerteErreichbarkeit(BUERO, new Date('2026-01-16T17:00:00Z'));
    strictEqual(lage.offen, false);
    strictEqual(lage.naechste?.inTagen, 3);
    strictEqual(lage.naechste?.datum, '2026-01-19');
    strictEqual(lage.naechste?.text, 'Montag ab 9:00');
  });

  it('sagt am Sonntag „morgen", nicht „Montag"', () => {
    const lage = bewerteErreichbarkeit(BUERO, new Date('2026-01-18T12:00:00Z'));
    strictEqual(lage.naechste?.text, 'morgen ab 9:00');
  });
});

describe('Ausnahmen', () => {
  const mitFeiertag: Erreichbarkeitsplan = {
    ...BUERO,
    ausnahmen: [
      { datum: '2026-12-24', grund: 'Heiligabend' },
      { datum: '2026-12-31', grund: 'Silvester', zeiten: [{ von: '09:00', bis: '12:00' }] },
    ],
  };

  it('schließt ganztags und nennt den Grund', () => {
    // Donnerstag, 24. Dezember 2026, 10:00 UTC = 11:00 Berlin
    const lage = bewerteErreichbarkeit(mitFeiertag, new Date('2026-12-24T10:00:00Z'));
    strictEqual(lage.offen, false);
    strictEqual(lage.grund, 'Heiligabend');
    strictEqual(statusText(lage), 'Geschlossen · Heiligabend · morgen ab 9:00');
  });

  it('ersetzt die Regelzeiten durch die Sonderzeiten', () => {
    // Donnerstag, 31. Dezember 2026: 10:00 Berlin offen, 14:00 Berlin zu
    strictEqual(bewerteErreichbarkeit(mitFeiertag, new Date('2026-12-31T09:00:00Z')).offen, true);
    strictEqual(bewerteErreichbarkeit(mitFeiertag, new Date('2026-12-31T13:00:00Z')).offen, false);
  });
});

describe('Nachtbetrieb', () => {
  const bar: Erreichbarkeitsplan = {
    zeitzone: 'Europe/Berlin',
    fenster: [
      { tag: 5, von: '20:00', bis: '03:00' },
      { tag: 6, von: '20:00', bis: '03:00' },
    ],
  };

  it('ist samstags um 01:00 noch offen — das Fenster gehört zum Freitag', () => {
    // Samstag, 17. Januar 2026, 00:00 UTC = 01:00 Berlin
    const lage = bewerteErreichbarkeit(bar, new Date('2026-01-17T00:00:00Z'));
    strictEqual(lage.offen, true);
    strictEqual(lage.bis, '03:00');
  });

  it('ist samstags um 05:00 zu und verweist auf den Abend', () => {
    const lage = bewerteErreichbarkeit(bar, new Date('2026-01-17T04:00:00Z'));
    strictEqual(lage.offen, false);
    strictEqual(lage.naechste?.text, 'heute ab 20:00');
  });
});

describe('Zusammenhängende Fenster', () => {
  it('macht aus Vormittag und Nachmittag einen durchgehenden Tag', () => {
    const geteilt: Erreichbarkeitsplan = {
      zeitzone: 'Europe/Berlin',
      fenster: [
        { tag: 3, von: '09:00', bis: '12:00' },
        { tag: 3, von: '12:00', bis: '17:00' },
      ],
    };
    const lage = bewerteErreichbarkeit(geteilt, new Date('2026-01-14T09:00:00Z'));
    strictEqual(lage.bis, '17:00', 'zwei aneinandergrenzende Fenster sind eine Öffnungszeit');
  });

  it('nennt bei Mittagspause die Pause und nicht den Feierabend', () => {
    const pause: Erreichbarkeitsplan = {
      zeitzone: 'Europe/Berlin',
      fenster: [
        { tag: 3, von: '09:00', bis: '12:00' },
        { tag: 3, von: '13:00', bis: '17:00' },
      ],
    };
    const vormittags = bewerteErreichbarkeit(pause, new Date('2026-01-14T09:00:00Z'));
    strictEqual(vormittags.bis, '12:00');

    const inDerPause = bewerteErreichbarkeit(pause, new Date('2026-01-14T11:30:00Z'));
    strictEqual(inDerPause.offen, false);
    strictEqual(inDerPause.naechste?.text, 'heute ab 13:00');
  });

  it('zieht durchgehenden Betrieb über Mitternacht zusammen', () => {
    const durchgehend: Erreichbarkeitsplan = {
      zeitzone: 'Europe/Berlin',
      fenster: [
        { tag: 3, von: '20:00', bis: '24:00' },
        { tag: 4, von: '00:00', bis: '06:00' },
      ],
    };
    const lage = bewerteErreichbarkeit(durchgehend, new Date('2026-01-14T21:00:00Z'));
    strictEqual(lage.offen, true);
    strictEqual(lage.bis, '06:00', 'nicht „bis 00:00" — es geht ja weiter');
  });
});

describe('Leere Pläne', () => {
  it('behauptet nichts, wenn nie geöffnet ist', () => {
    const nie: Erreichbarkeitsplan = { zeitzone: 'Europe/Berlin', fenster: [] };
    const lage = bewerteErreichbarkeit(nie, new Date('2026-01-14T12:00:00Z'));
    strictEqual(lage.offen, false);
    strictEqual(lage.naechste, undefined);
    strictEqual(statusText(lage, 'Wir melden uns'), 'Gerade geschlossen · Wir melden uns');
  });

  it('übergeht unlesbare Uhrzeiten, statt die Seite zu zerlegen', () => {
    const kaputt: Erreichbarkeitsplan = {
      zeitzone: 'Europe/Berlin',
      fenster: [
        { tag: 3, von: 'neun', bis: 'sechs' },
        { tag: 3, von: '10:00', bis: '11:00' },
      ],
    };
    const lage = bewerteErreichbarkeit(kaputt, new Date('2026-01-14T09:30:00Z'));
    strictEqual(lage.offen, true);
    strictEqual(lage.bis, '11:00');
  });
});
