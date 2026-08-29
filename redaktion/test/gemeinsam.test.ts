/**
 * Posteingang und Auswertung.
 *
 * Die beiden Stellen, an denen soziale Kanäle und E-Mail zusammenlaufen — und
 * damit die beiden, wegen derer das Ganze ein Programm ist und nicht zwei.
 */

import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import {
  antworten,
  dienstminuten,
  DIENSTZEIT_UEBLICH,
  eingangsbild,
  fristrest,
  gesperrtVon,
  inDienstzeit,
  notieren,
  reihenfolge,
  schliessen,
  SPERRDAUER_MS,
  uebernehmen,
  zurueckgeben,
  type Vorgang,
} from '../src/kern/posteingang.ts';
import {
  alsProzent,
  entscheideVersuch,
  gesamtbild,
  kanalbild,
  pruefeZaehlweise,
  quoten,
  regungsrate,
  type Beitragszahlen,
  type Mailzahlen,
} from '../src/kern/auswertung.ts';
import type { Sitzung } from '../src/kern/rollen.ts';
import { ausOertlich } from '../src/kern/zeit.ts';

const ORG = 'org_a';
const BERLIN = 'Europe/Berlin';

/** Dienstag, 3. Februar 2026, 10:00 Berlin. */
const DIENSTAG10 = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 10, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
/** Freitag, 6. Februar 2026, 17:00 Berlin. */
const FREITAG17 = ausOertlich({ jahr: 2026, monat: 2, tag: 6, stunde: 17, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;

const anna: Sitzung = { person: 'anna', rolle: 'redakteur', organisation: ORG };
const bert: Sitzung = { person: 'bert', rolle: 'redakteur', organisation: ORG };

function vorgang(teil: Partial<Vorgang> = {}): Vorgang {
  return {
    kennung: 'vg_1',
    organisation: ORG,
    kanal: 'kn_mastodon',
    kanalart: 'mastodon',
    art: 'kommentar',
    von: '@leser',
    text: 'Kommt ihr auch nach Bremen?',
    eingegangenAm: DIENSTAG10,
    zustand: 'neu',
    notizen: [],
    fristMinuten: 240,
    ...teil,
  };
}

describe('Dienstzeiten', () => {
  it('zählt nur, was in den Zeiten liegt', () => {
    // Dienstag 10:00 bis 12:00 sind zwei Stunden Dienstzeit.
    strictEqual(dienstminuten(DIENSTAG10, DIENSTAG10 + 2 * 3_600_000, DIENSTZEIT_UEBLICH, BERLIN), 120);
  });

  /* Der Fall, für den die ganze Rechnung da ist: Freitagabend. */
  it('lässt die Nacht und das Wochenende aus', () => {
    // Freitag 17:00 bis Montag 10:00: eine Stunde am Freitag (bis 18:00),
    // Samstag und Sonntag nichts, Montag 09:00–10:00 eine Stunde. Macht 120.
    const montag10 = ausOertlich({ jahr: 2026, monat: 2, tag: 9, stunde: 10, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
    strictEqual(dienstminuten(FREITAG17, montag10, DIENSTZEIT_UEBLICH, BERLIN), 120);
  });

  it('rechnet über eine Zeitumstellung hinweg richtig', () => {
    // Freitag, 27. März 2026, 17:00 bis Montag, 30. März, 10:00 — dazwischen
    // liegt die Umstellung auf Sommerzeit. Es bleiben dieselben 120 Minuten:
    // die verlorene Stunde liegt in der Nacht zum Sonntag.
    const fr = ausOertlich({ jahr: 2026, monat: 3, tag: 27, stunde: 17, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
    const mo = ausOertlich({ jahr: 2026, monat: 3, tag: 30, stunde: 10, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
    strictEqual(dienstminuten(fr, mo, DIENSTZEIT_UEBLICH, BERLIN), 120);
  });

  it('weiß, wann Dienstzeit ist', () => {
    ok(inDienstzeit(DIENSTAG10, DIENSTZEIT_UEBLICH, BERLIN));
    ok(!inDienstzeit(FREITAG17 + 4 * 3_600_000, DIENSTZEIT_UEBLICH, BERLIN)); // Freitag 21:00
  });

  /* Eine Frist, die nachts weiterläuft, wird am Montag abgeschaltet. */
  it('lässt einen Vorgang vom Freitagabend am Samstag nicht überfällig werden', () => {
    const v = vorgang({ eingegangenAm: FREITAG17, fristMinuten: 240 });
    const samstag = FREITAG17 + 15 * 3_600_000;
    ok(fristrest(v, samstag, DIENSTZEIT_UEBLICH, BERLIN) > 0);
    // Die Frist ist am Montag um 12:00 auf die Minute aufgebraucht: eine
    // Stunde am Freitag, drei am Montag.
    const montag12 = ausOertlich({ jahr: 2026, monat: 2, tag: 9, stunde: 12, minute: 0, sekunde: 0 }, BERLIN).zeitpunkt;
    strictEqual(fristrest(v, montag12, DIENSTZEIT_UEBLICH, BERLIN), 0);
    // Und eine Stunde später gerissen.
    ok(fristrest(v, montag12 + 3_600_000, DIENSTZEIT_UEBLICH, BERLIN) < 0);
  });
});

describe('Posteingang', () => {
  it('übernimmt und sperrt', () => {
    const e = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(e.ok);
    strictEqual(e.vorgang.zustand, 'inArbeit');
    strictEqual(gesperrtVon(e.vorgang, DIENSTAG10), 'anna');
  });

  /* Zwei Antworten auf denselben Kommentar sind schlimmer als eine späte. */
  it('lässt keine zweite Person übernehmen, solange die Sperre hält', () => {
    const erst = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(erst.ok);
    const dann = uebernehmen(erst.vorgang, bert, DIENSTAG10 + 60_000);
    strictEqual(dann.ok, false);
    if (!dann.ok) {
      strictEqual(dann.befund.kennung, 'eingang.belegt');
      ok(dann.befund.text.includes('anna'));
    }
  });

  /* Wer eine Sperre nimmt und in den Feierabend geht, blockiert sonst bis Montag. */
  it('gibt die Sperre nach Ablauf frei', () => {
    const erst = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(erst.ok);
    const spaeter = DIENSTAG10 + SPERRDAUER_MS + 1000;
    strictEqual(gesperrtVon(erst.vorgang, spaeter), null);
    ok(uebernehmen(erst.vorgang, bert, spaeter).ok);
  });

  it('lässt dieselbe Person verlängern', () => {
    const erst = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(erst.ok);
    const nochmal = uebernehmen(erst.vorgang, anna, DIENSTAG10 + 20 * 60_000);
    ok(nochmal.ok);
    strictEqual(nochmal.vorgang.sperre!.bis, DIENSTAG10 + 20 * 60_000 + SPERRDAUER_MS);
  });

  it('antwortet nur mit Sperre', () => {
    const ohne = antworten(vorgang(), anna, 'Ja, am 12. März.', DIENSTAG10);
    strictEqual(ohne.ok, false);
    if (!ohne.ok) strictEqual(ohne.befund.kennung, 'eingang.ohne.sperre');

    const uebernommen = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(uebernommen.ok);
    const mit = antworten(uebernommen.vorgang, anna, 'Ja, am 12. März.', DIENSTAG10 + 60_000);
    ok(mit.ok);
    strictEqual(mit.vorgang.zustand, 'beantwortet');
    // Die Sperre fällt mit der Antwort weg.
    strictEqual(gesperrtVon(mit.vorgang, DIENSTAG10 + 60_000), null);
  });

  /* Der Fall, den keine Sperre fängt: zwei offene Fenster derselben Person. */
  it('antwortet kein zweites Mal auf einen schon beantworteten Vorgang', () => {
    const beantwortet = vorgang({
      zustand: 'beantwortet',
      antwort: { person: 'bert', zeitpunkt: DIENSTAG10, text: 'Ja.' },
      sperre: { person: 'anna', bis: DIENSTAG10 + SPERRDAUER_MS },
    });
    const e = antworten(beantwortet, anna, 'Ja, am 12. März.', DIENSTAG10 + 60_000);
    strictEqual(e.ok, false);
    if (!e.ok) {
      strictEqual(e.befund.kennung, 'eingang.schon.beantwortet');
      ok(e.befund.text.includes('bert'));
    }
  });

  it('nimmt keine leere Antwort', () => {
    const u = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(u.ok);
    strictEqual(antworten(u.vorgang, anna, '   ', DIENSTAG10).ok, false);
  });

  it('lässt eine Rolle ohne Recht weder übernehmen noch antworten', () => {
    const gast: Sitzung = { person: 'gast', rolle: 'betrachter', organisation: ORG };
    strictEqual(uebernehmen(vorgang(), gast, DIENSTAG10).ok, false);
    // Lesen darf er, notieren auch.
    ok(notieren(vorgang(), gast, 'Kenne ich, das ist ein Stammgast.', DIENSTAG10).ok);
  });

  it('geht nicht über die Organisationsgrenze', () => {
    const fremd: Sitzung = { person: 'dora', rolle: 'leitung', organisation: 'org_b' };
    strictEqual(uebernehmen(vorgang(), fremd, DIENSTAG10).ok, false);
  });

  it('gibt zurück und stellt den Zustand wieder her', () => {
    const u = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(u.ok);
    const zurueck = zurueckgeben(u.vorgang, anna, DIENSTAG10 + 60_000);
    strictEqual(zurueck.zustand, 'neu');
    strictEqual(zurueck.sperre, undefined);
  });

  it('sortiert Überfällige nach vorn, quer über die Kanäle', () => {
    const alt = vorgang({ kennung: 'vg_alt', eingegangenAm: DIENSTAG10 - 6 * 3_600_000, fristMinuten: 60 });
    const neu = vorgang({ kennung: 'vg_neu', eingegangenAm: DIENSTAG10 - 10 * 60_000, fristMinuten: 240 });
    const mail = vorgang({
      kennung: 'vg_mail',
      art: 'mailantwort',
      kanalart: 'mail',
      eingegangenAm: DIENSTAG10 - 3 * 3_600_000,
      fristMinuten: 120,
    });
    const sortiert = reihenfolge([neu, mail, alt], DIENSTAG10, DIENSTZEIT_UEBLICH, BERLIN);
    strictEqual(sortiert[0]!.kennung, 'vg_alt');
    strictEqual(sortiert.at(-1)!.kennung, 'vg_neu');
  });

  it('zeichnet ein Bild des Eingangs', () => {
    // Die Sperre wird kurz vor dem Stichtag genommen, damit sie zum
    // Zeitpunkt des Bildes noch hält — sie läuft nach SPERRDAUER_MS ab.
    const u = uebernehmen(vorgang({ kennung: 'vg_2' }), anna, DIENSTAG10 + 45 * 60_000);
    ok(u.ok);
    const bild = eingangsbild(
      [
        vorgang({ kennung: 'vg_1' }),
        u.vorgang,
        vorgang({ kennung: 'vg_3', zustand: 'beantwortet', antwort: { person: 'bert', zeitpunkt: DIENSTAG10 + 30 * 60_000, text: 'Ja.' } }),
      ],
      DIENSTAG10 + 60 * 60_000,
      DIENSTZEIT_UEBLICH,
      BERLIN,
    );
    strictEqual(bild.offen, 2);
    strictEqual(bild.inArbeit, 1);
    strictEqual(bild.heuteBeantwortet, 1);
    strictEqual(bild.mittlereAntwortzeit, 30);
  });

  it('schließt und löst dabei die Sperre', () => {
    const u = uebernehmen(vorgang(), anna, DIENSTAG10);
    ok(u.ok);
    const zu = schliessen(u.vorgang, anna);
    ok(zu.ok);
    strictEqual(zu.vorgang.zustand, 'geschlossen');
    strictEqual(zu.vorgang.sperre, undefined);
  });
});

describe('Auswertung', () => {
  const zahlen: Mailzahlen = {
    gesendet: 10_000,
    zugestellt: 9_500,
    hart: 400,
    weich: 100,
    geoeffnet: 3_800,
    geklickt: 950,
    abgemeldet: 19,
    beschwerden: 5,
  };

  /* Wer durch die Gesendeten teilt, weist einen schlechten Bestand als
     schlechte Betreffzeile aus. */
  it('bezieht die Öffnungsrate auf die Zugestellten', () => {
    const q = quoten(zahlen, true);
    strictEqual(q.oeffnungsrate, 3_800 / 9_500);
    ok(q.oeffnungsrate !== 3_800 / 10_000);
    strictEqual(q.zustellquote, 0.95);
  });

  it('rechnet Klicks je Öffnung', () => {
    strictEqual(quoten(zahlen, true).klickAufOeffnung, 950 / 3_800);
  });

  it('trägt den Vorbehalt immer mit', () => {
    strictEqual(quoten(zahlen, true).oeffnungenSindGeschaetzt, true);
    strictEqual(quoten(zahlen, false).oeffnungenSindGeschaetzt, false);
  });

  it('teilt nicht durch null', () => {
    const leer = quoten(
      { gesendet: 0, zugestellt: 0, hart: 0, weich: 0, geoeffnet: 0, geklickt: 0, abgemeldet: 0, beschwerden: 0 },
      true,
    );
    strictEqual(leer.oeffnungsrate, 0);
    strictEqual(leer.klickAufOeffnung, 0);
  });

  /* Bei 500 Zustellungen und 2 % Unterschied wird sonst eine Betreffzeile zur
     Siegerin erklärt, die keine ist. */
  it('ruft keinen Sieger aus, wo nur Rauschen ist', () => {
    const e = entscheideVersuch(
      [
        { variante: 'a', zahlen: { ...zahlen, zugestellt: 1000, geklickt: 100 } },
        { variante: 'b', zahlen: { ...zahlen, zugestellt: 1000, geklickt: 102 } },
      ],
      'klick',
    );
    strictEqual(e.entschieden, false);
  });

  it('entscheidet bei deutlichem Vorsprung', () => {
    const e = entscheideVersuch(
      [
        { variante: 'a', zahlen: { ...zahlen, zugestellt: 1000, geklickt: 100 } },
        { variante: 'b', zahlen: { ...zahlen, zugestellt: 1000, geklickt: 160 } },
      ],
      'klick',
    );
    ok(e.entschieden);
    if (e.entschieden) strictEqual(e.gewinner, 'b');
  });

  it('entscheidet nicht auf zu kleiner Grundlage', () => {
    const e = entscheideVersuch(
      [
        { variante: 'a', zahlen: { ...zahlen, zugestellt: 100, geklickt: 5 } },
        { variante: 'b', zahlen: { ...zahlen, zugestellt: 100, geklickt: 20 } },
      ],
      'klick',
    );
    strictEqual(e.entschieden, false);
    if (!e.entschieden) ok(e.grund.includes('500'));
  });

  it('warnt, wenn über Öffnungen entschieden wird', () => {
    const e = entscheideVersuch(
      [
        { variante: 'a', zahlen: { ...zahlen, zugestellt: 1000, geoeffnet: 300 } },
        { variante: 'b', zahlen: { ...zahlen, zugestellt: 1000, geoeffnet: 500 } },
      ],
      'oeffnung',
    );
    ok(e.befunde.some((b) => b.kennung === 'auswertung.ab.ueber.oeffnungen'));
  });

  /* Zwei Zahlen mit demselben Namen und verschiedener Bedeutung sind
     schlimmer als eine fehlende. */
  it('erfindet keine Regungsrate, wo das Netz keine Auslieferungen nennt', () => {
    const ohne: Beitragszahlen = {
      beitrag: 'bt_1', kanal: 'kn_1', kanalart: 'mastodon',
      veroeffentlichtAm: DIENSTAG10, auslieferungen: null, regungen: 40, klicks: 8, kommentare: 3,
    };
    strictEqual(regungsrate(ohne), null);
    strictEqual(kanalbild([ohne], 'kn_1').mittlereRegungsrate, null);
    // Die Summen gibt es trotzdem.
    strictEqual(kanalbild([ohne], 'kn_1').regungen, 40);
  });

  it('rechnet die Regungsrate, wo es Auslieferungen gibt', () => {
    const mit: Beitragszahlen = {
      beitrag: 'bt_1', kanal: 'kn_1', kanalart: 'linkedin',
      veroeffentlichtAm: DIENSTAG10, auslieferungen: 2000, regungen: 100, klicks: 30, kommentare: 5,
    };
    strictEqual(regungsrate(mit), 0.05);
  });

  it('stellt Mail und Soziales nebeneinander, ohne es zu addieren', () => {
    const bild = gesamtbild(
      { von: DIENSTAG10 - 86_400_000, bis: DIENSTAG10 + 86_400_000 },
      [zahlen],
      [{ beitrag: 'bt_1', kanal: 'kn_1', kanalart: 'linkedin', veroeffentlichtAm: DIENSTAG10, auslieferungen: 2000, regungen: 100, klicks: 30, kommentare: 5 }],
    );
    strictEqual(bild.mail.zugestellt, 9_500);
    strictEqual(bild.sozial.regungen, 100);
    // Nur die Klicks werden zusammengezählt — sie bedeuten auf beiden Seiten
    // dasselbe. Eine gemeinsame Reichweite gibt es nicht.
    strictEqual(bild.klicksZusammen, 980);
    ok(!('reichweite' in bild));
  });

  it('lässt Beiträge außerhalb des Zeitraums weg', () => {
    const bild = gesamtbild(
      { von: DIENSTAG10, bis: DIENSTAG10 + 3_600_000 },
      [],
      [{ beitrag: 'bt_alt', kanal: 'kn_1', kanalart: 'linkedin', veroeffentlichtAm: DIENSTAG10 - 86_400_000, auslieferungen: 10, regungen: 1, klicks: 1, kommentare: 0 }],
    );
    strictEqual(bild.sozial.beitraege, 0);
  });

  it('mahnt einen Wortlaut an, der die Messung nicht erwähnt', () => {
    const b = pruefeZaehlweise({
      organisation: ORG,
      oeffnungen: 'personenbezogen',
      klicks: 'personenbezogen',
      einwilligungswortlaut: 'Ich möchte den Newsletter bekommen.',
    });
    ok(b.some((x) => x.kennung === 'auswertung.wortlaut' && x.schwere === 'warnung'));
  });

  it('mahnt nichts an, wenn der Wortlaut die Messung nennt', () => {
    const b = pruefeZaehlweise({
      organisation: ORG,
      oeffnungen: 'personenbezogen',
      klicks: 'personenbezogen',
      einwilligungswortlaut: 'Ich möchte den Newsletter bekommen. Öffnungen und Klicks werden dabei ausgewertet.',
    });
    ok(!b.some((x) => x.kennung === 'auswertung.wortlaut'));
  });

  it('sagt bei anonymer Zählung, was dadurch fehlt', () => {
    const b = pruefeZaehlweise({
      organisation: ORG,
      oeffnungen: 'anonym',
      klicks: 'anonym',
      einwilligungswortlaut: 'Ich möchte den Newsletter bekommen.',
    });
    ok(b.some((x) => x.kennung === 'auswertung.anonym'));
  });

  it('schreibt Anteile deutsch', () => {
    strictEqual(alsProzent(0.4), '40,0 %');
    strictEqual(alsProzent(0.0325), '3,3 %');
  });
});
