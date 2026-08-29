/**
 * Die Zeitrechnung ist die Stelle, an der ein Planungswerkzeug still falsch
 * wird: ein Newsletter, der eine Stunde daneben geht, sieht aus wie ein
 * Newsletter. Deshalb liegt der Schwerpunkt der Prüfungen auf den beiden
 * Nächten im Jahr, in denen die örtliche Zeit nicht eindeutig ist.
 */

import { deepStrictEqual, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import {
  alsFeldwert,
  ausFeldwert,
  ausOertlich,
  minutenAmTag,
  oertlich,
  rasterAuf,
  tagePlus,
  tagesbeginn,
  versatzMinuten,
  wochenbeginn,
  wochentag,
} from '../src/kern/zeit.ts';

const BERLIN = 'Europe/Berlin';

describe('Zeit — der Normalfall', () => {
  it('liest einen Zeitpunkt in der Zone', () => {
    // 2026-02-03T08:00:00Z ist in Berlin (Winterzeit) 09:00.
    const o = oertlich(Date.UTC(2026, 1, 3, 8, 0, 0), BERLIN);
    deepStrictEqual(o, { jahr: 2026, monat: 2, tag: 3, stunde: 9, minute: 0, sekunde: 0 });
  });

  it('rechnet eine örtliche Angabe zurück', () => {
    const { zeitpunkt, lage } = ausOertlich(
      { jahr: 2026, monat: 2, tag: 3, stunde: 9, minute: 0, sekunde: 0 },
      BERLIN,
    );
    strictEqual(lage, 'eindeutig');
    strictEqual(zeitpunkt, Date.UTC(2026, 1, 3, 8, 0, 0));
  });

  it('kennt den Versatz zu beiden Jahreszeiten', () => {
    strictEqual(versatzMinuten(Date.UTC(2026, 0, 15, 12), BERLIN), 60);
    strictEqual(versatzMinuten(Date.UTC(2026, 6, 15, 12), BERLIN), 120);
  });
});

describe('Zeit — die Nacht, in der eine Stunde fehlt', () => {
  /* Am 29. März 2026 springt Berlin um 02:00 auf 03:00. Die Angabe „02:30"
     gibt es an diesem Tag nicht. Wer sie plant, meint halb drei — und soll
     einen Beitrag bekommen und keine Ausnahme. */
  it('schiebt eine fehlende Angabe hinter die Lücke', () => {
    const { zeitpunkt, lage } = ausOertlich(
      { jahr: 2026, monat: 3, tag: 29, stunde: 2, minute: 30, sekunde: 0 },
      BERLIN,
    );
    strictEqual(lage, 'luecke');
    strictEqual(zeitpunkt, Date.UTC(2026, 2, 29, 1, 30, 0));
    strictEqual(oertlich(zeitpunkt, BERLIN).stunde, 3);
    strictEqual(oertlich(zeitpunkt, BERLIN).minute, 30);
  });

  it('lässt die Stunde davor und danach unberührt', () => {
    strictEqual(
      ausOertlich({ jahr: 2026, monat: 3, tag: 29, stunde: 1, minute: 30, sekunde: 0 }, BERLIN).lage,
      'eindeutig',
    );
    strictEqual(
      ausOertlich({ jahr: 2026, monat: 3, tag: 29, stunde: 3, minute: 30, sekunde: 0 }, BERLIN).lage,
      'eindeutig',
    );
  });
});

describe('Zeit — die Nacht, in der eine Stunde doppelt ist', () => {
  /* Am 25. Oktober 2026 springt Berlin um 03:00 auf 02:00. „02:30" gibt es
     zweimal: einmal in Sommer-, einmal in Winterzeit. Wir nehmen die erste. */
  it('nimmt bei einer doppelten Angabe die frühere', () => {
    const { zeitpunkt, lage } = ausOertlich(
      { jahr: 2026, monat: 10, tag: 25, stunde: 2, minute: 30, sekunde: 0 },
      BERLIN,
    );
    strictEqual(lage, 'doppelt');
    strictEqual(zeitpunkt, Date.UTC(2026, 9, 25, 0, 30, 0));
    strictEqual(versatzMinuten(zeitpunkt, BERLIN), 120);
  });
});

describe('Zeit — Raster und Tagesgrenzen', () => {
  it('rundet auf das Viertelstundenraster auf', () => {
    const roh = Date.UTC(2026, 1, 3, 8, 7, 12); // örtlich 09:07:12
    const gerastert = rasterAuf(roh, 15, BERLIN);
    deepStrictEqual(oertlich(gerastert, BERLIN), {
      jahr: 2026, monat: 2, tag: 3, stunde: 9, minute: 15, sekunde: 0,
    });
  });

  it('lässt einen Zeitpunkt, der schon auf dem Raster liegt, in Ruhe', () => {
    const drauf = Date.UTC(2026, 1, 3, 8, 15, 0);
    strictEqual(rasterAuf(drauf, 15, BERLIN), drauf);
  });

  it('springt über Mitternacht in den nächsten Tag', () => {
    const spaet = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 23, minute: 52, sekunde: 0 }, BERLIN).zeitpunkt;
    const naechster = rasterAuf(spaet, 15, BERLIN);
    deepStrictEqual(oertlich(naechster, BERLIN), {
      jahr: 2026, monat: 2, tag: 4, stunde: 0, minute: 0, sekunde: 0,
    });
  });

  it('findet den Wochenbeginn auch über eine Umstellung hinweg', () => {
    // Mittwoch, 1. April 2026 — die Umstellung lag am Sonntag davor.
    const mittwoch = ausOertlich({ jahr: 2026, monat: 4, tag: 1, stunde: 14, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
    const montag = wochenbeginn(mittwoch, BERLIN);
    deepStrictEqual(oertlich(montag, BERLIN), {
      jahr: 2026, monat: 3, tag: 30, stunde: 0, minute: 0, sekunde: 0,
    });
    strictEqual(wochentag(montag, BERLIN), 1);
  });

  it('schaltet Tage weiter, ohne über die Umstellung zu verrutschen', () => {
    // Von Samstag 09:00 zwei Tage weiter ist Montag 09:00 — nicht 08:00,
    // obwohl dazwischen eine Stunde verschwunden ist.
    const samstag = ausOertlich({ jahr: 2026, monat: 3, tag: 28, stunde: 9, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
    const montag = tagePlus(samstag, 2, BERLIN);
    strictEqual(oertlich(montag, BERLIN).stunde, 9);
    strictEqual(oertlich(montag, BERLIN).tag, 30);
  });

  it('kennt Mitternacht und die Minuten seit Mitternacht', () => {
    const t = Date.UTC(2026, 1, 3, 8, 7, 0);
    strictEqual(minutenAmTag(t, BERLIN), 9 * 60 + 7);
    strictEqual(oertlich(tagesbeginn(t, BERLIN), BERLIN).stunde, 0);
  });
});

describe('Zeit — Feldwerte aus dem Browser', () => {
  it('geht hin und zurück', () => {
    const t = ausOertlich({ jahr: 2026, monat: 7, tag: 9, stunde: 17, minute: 45, sekunde: 0 }, BERLIN).zeitpunkt;
    strictEqual(alsFeldwert(t, BERLIN), '2026-07-09T17:45');
    strictEqual(ausFeldwert('2026-07-09T17:45', BERLIN), t);
  });

  it('weist zurück, was keine Form hat', () => {
    strictEqual(ausFeldwert('morgen früh', BERLIN), null);
    strictEqual(ausFeldwert('2026-13-01T10:00', BERLIN), null);
    strictEqual(ausFeldwert('2026-07-09T25:00', BERLIN), null);
  });
});
