/**
 * Kanäle, Beiträge, Freigabe, Plan.
 *
 * Der Schwerpunkt liegt auf den Regeln, die Geld kosten, wenn sie fehlen: ein
 * zu langer Text, der beim Netz abgewiesen wird; ein Bild ohne
 * Alternativtext; eine Freigabe, die nach einer Textänderung noch gilt; zwei
 * Beiträge zur selben Minute auf demselben Kanal.
 */

import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { haeltAn, nach } from '../src/kern/befund.ts';
import { grenzeVon, REGELN, tokenbefund, type Kanal } from '../src/kern/kanal.ts';
import {
  bereitZumSenden,
  darfUebergehen,
  pruefeBeitrag,
  pruefeFassung,
  type Beitrag,
  type Fassung,
} from '../src/kern/beitrag.ts';
import { ablehnen, fehlende, standAus, standVon, ueberfaellig, zustimmen, type Freigabelauf } from '../src/kern/freigabe.ts';
import {
  belegungenAus,
  GRUNDREGELN,
  inRuhezeit,
  naechsterFreierTermin,
  pruefeTermin,
  type Planregeln,
} from '../src/kern/plan.ts';
import type { Sitzung } from '../src/kern/rollen.ts';
import { ausOertlich } from '../src/kern/zeit.ts';

const ORG = 'org_a';
const JETZT = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 10, minute: 0, sekunde: 0 }).zeitpunkt;

function kanal(art: Kanal['art'], teil: Partial<Kanal> = {}): Kanal {
  return {
    kennung: `kn_${art}`,
    organisation: ORG,
    art,
    anzeigename: `Haus auf ${REGELN[art].name}`,
    aktiv: true,
    ...teil,
  };
}

function fassung(art: Kanal['art'], teil: Partial<Fassung> = {}): Fassung {
  return { kanal: `kn_${art}`, art, text: 'Ein ganz gewöhnlicher Satz.', medien: [], ...teil };
}

function beitrag(fassungen: Fassung[], teil: Partial<Beitrag> = {}): Beitrag {
  return {
    kennung: 'bt_1',
    organisation: ORG,
    titel: 'Test',
    zustand: 'entwurf',
    fassungen,
    geplantFuer: null,
    verfasser: 'p_anna',
    angelegtAm: JETZT,
    geaendertAm: JETZT,
    ...teil,
  };
}

describe('Kanäle', () => {
  it('nimmt die Grenze der Instanz, wo es eine gibt', () => {
    strictEqual(grenzeVon(kanal('mastodon')), 500);
    strictEqual(grenzeVon(kanal('mastodon', { grenzeUeberschrieben: 11_000 })), 11_000);
  });

  /* Der häufigste Grund dafür, dass ein geplanter Beitrag nicht erscheint. */
  it('warnt vor einem ablaufenden Zugang und hält bei einem abgelaufenen an', () => {
    strictEqual(tokenbefund(kanal('x'), JETZT), null);
    const bald = tokenbefund(kanal('x', { tokenLaeuftAb: JETZT + 5 * 86_400_000 }), JETZT);
    strictEqual(bald?.schwere, 'warnung');
    const hin = tokenbefund(kanal('x', { tokenLaeuftAb: JETZT - 86_400_000 }), JETZT);
    strictEqual(hin?.schwere, 'fehler');
  });
});

describe('Beitrag prüfen', () => {
  it('lässt einen sauberen Beitrag durch', () => {
    const befunde = pruefeBeitrag(beitrag([fassung('mastodon')]), [kanal('mastodon')]);
    strictEqual(haeltAn(befunde), false);
  });

  it('zählt je Kanal nach dessen eigener Weise', () => {
    // 290 schlichte Zeichen: bei X über der Grenze, bei Mastodon darunter.
    const text = 'a'.repeat(290);
    strictEqual(haeltAn(pruefeFassung(fassung('x', { text }), kanal('x'))), true);
    strictEqual(haeltAn(pruefeFassung(fassung('mastodon', { text }), kanal('mastodon'))), false);
  });

  it('rechnet eine lange Adresse bei X mit 23', () => {
    // 250 Zeichen plus eine 120 Zeichen lange Adresse: gezählt 250 + 23 = 273.
    const text = 'a'.repeat(250) + ' https://beispiel.de/' + 'b'.repeat(100);
    strictEqual(haeltAn(pruefeFassung(fassung('x', { text }), kanal('x'))), false);
  });

  /* Die Regel, die dieses Werkzeug strenger macht als die üblichen. */
  it('veröffentlicht kein Bild ohne Alternativtext', () => {
    const ohne = pruefeFassung(
      fassung('mastodon', { medien: [{ art: 'bild', datei: 'a.jpg', alt: '' }] }),
      kanal('mastodon'),
    );
    ok(ohne.some((b) => b.kennung === 'fassung.alt.fehlt' && b.schwere === 'fehler'));

    const mit = pruefeFassung(
      fassung('mastodon', { medien: [{ art: 'bild', datei: 'a.jpg', alt: 'Zwei Menschen an einem Mischpult.' }] }),
      kanal('mastodon'),
    );
    strictEqual(haeltAn(mit), false);
  });

  it('lässt ein ausdrücklich schmückendes Bild ohne Alternativtext zu', () => {
    const b = pruefeFassung(
      fassung('mastodon', { medien: [{ art: 'bild', datei: 'zier.jpg', alt: '', schmueckend: true }] }),
      kanal('mastodon'),
    );
    strictEqual(haeltAn(b), false);
  });

  it('mahnt einen zu dürftigen Alternativtext an, ohne anzuhalten', () => {
    const b = pruefeFassung(
      fassung('mastodon', { medien: [{ art: 'bild', datei: 'a.jpg', alt: 'Bild' }] }),
      kanal('mastodon'),
    );
    strictEqual(haeltAn(b), false);
    strictEqual(nach(b, 'warnung').length, 1);
  });

  it('verlangt bei Instagram ein Medium und warnt vor totem Link', () => {
    const b = pruefeFassung(
      fassung('instagram', { text: 'Alles dazu auf https://haus.de' }),
      kanal('instagram'),
    );
    ok(b.some((x) => x.kennung === 'fassung.medium.fehlt' && x.schwere === 'fehler'));
    ok(b.some((x) => x.kennung === 'fassung.link.wirkt.nicht' && x.schwere === 'warnung'));
  });

  it('zählt Hashtags aus dem ersten Kommentar mit', () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(' ');
    const b = pruefeFassung(
      fassung('instagram', {
        text: 'Schön war es.',
        ersterKommentar: tags,
        medien: [{ art: 'bild', datei: 'a.jpg', alt: 'Ein Saal von hinten fotografiert.' }],
      }),
      kanal('instagram'),
    );
    ok(b.some((x) => x.kennung === 'fassung.zu.viele.hashtags'));
  });

  it('meldet einen Kanal, den es nicht mehr gibt', () => {
    const b = pruefeBeitrag(beitrag([fassung('x')]), []);
    ok(b.some((x) => x.kennung === 'fassung.kanal.fehlt' && x.schwere === 'fehler'));
  });

  it('lässt keinen Beitrag in eine fremde Organisation', () => {
    const fremd = kanal('x', { organisation: 'org_b' });
    const b = pruefeBeitrag(beitrag([fassung('x')]), [fremd]);
    ok(b.some((x) => x.kennung === 'fassung.fremde.organisation'));
  });

  it('weist auf wortgleiche Fassungen hin, ohne anzuhalten', () => {
    const b = pruefeBeitrag(
      beitrag([fassung('x'), fassung('linkedin')]),
      [kanal('x'), kanal('linkedin')],
    );
    strictEqual(haeltAn(b), false);
    ok(b.some((x) => x.kennung === 'beitrag.wortgleich'));
  });

  it('hält vor dem Senden noch einmal an, wenn ein Kanal stillgelegt wurde', () => {
    const b = beitrag([fassung('x')], { zustand: 'geplant', geplantFuer: JETZT - 1000 });
    strictEqual(bereitZumSenden(b, [kanal('x')], JETZT).ok, true);
    const still = bereitZumSenden(b, [kanal('x', { aktiv: false })], JETZT);
    strictEqual(still.ok, false);
  });

  it('sendet nicht vor dem Termin', () => {
    const b = beitrag([fassung('x')], { zustand: 'geplant', geplantFuer: JETZT + 60_000 });
    strictEqual(bereitZumSenden(b, [kanal('x')], JETZT).ok, false);
  });
});

describe('Zustandskette', () => {
  it('kennt den Weg vom Entwurf bis zur Veröffentlichung', () => {
    ok(darfUebergehen('entwurf', 'eingereicht'));
    ok(darfUebergehen('eingereicht', 'freigegeben'));
    ok(darfUebergehen('freigegeben', 'geplant'));
    ok(darfUebergehen('geplant', 'veroeffentlicht'));
  });

  it('kennt keine Abkürzung', () => {
    ok(!darfUebergehen('entwurf', 'freigegeben'));
    ok(!darfUebergehen('entwurf', 'veroeffentlicht'));
    ok(!darfUebergehen('eingereicht', 'geplant'));
  });

  /* Was draußen ist, ist draußen. Das Zurücknehmen im Netz ist eine andere
     Handlung als das Zurückziehen im Plan. */
  it('lässt nichts aus dem Veröffentlichten zurück', () => {
    strictEqual(darfUebergehen('veroeffentlicht', 'entwurf'), false);
    strictEqual(darfUebergehen('veroeffentlicht', 'zurueckgezogen'), false);
  });

  it('lässt einen Fehlschlag noch einmal versuchen', () => {
    ok(darfUebergehen('geplant', 'fehlgeschlagen'));
    ok(darfUebergehen('fehlgeschlagen', 'geplant'));
  });
});

describe('Freigabe', () => {
  const STAND = standAus(['Ein ganz gewöhnlicher Satz.']);

  function lauf(teil: Partial<Freigabelauf> = {}): Freigabelauf {
    return {
      kennung: 'fg_1',
      organisation: ORG,
      art: 'beitrag',
      gegenstand: 'bt_1',
      verfasser: 'p_anna',
      stand: STAND,
      noetig: 1,
      zustimmungen: [],
      frist: null,
      eingereichtAm: JETZT,
      ...teil,
    };
  }

  const bert: Sitzung = { person: 'p_bert', rolle: 'freigeber', organisation: ORG };
  const anna: Sitzung = { person: 'p_anna', rolle: 'freigeber', organisation: ORG };

  it('gibt frei, wenn genug Zustimmungen vorliegen', () => {
    const e = zustimmen(lauf(), bert, STAND, JETZT);
    ok(e.ok);
    strictEqual(standVon(e.lauf, STAND), 'freigegeben');
    strictEqual(fehlende(e.lauf), 0);
  });

  /* Vier Augen. Ohne das ist eine Freigabe ein Knopf, den man selbst drückt. */
  it('lässt den Verfasser nicht selbst freigeben', () => {
    const e = zustimmen(lauf(), anna, STAND, JETZT);
    strictEqual(e.ok, false);
    if (!e.ok) strictEqual(e.befund.kennung, 'freigabe.vier.augen');
  });

  it('lässt dieselbe Person nicht zweimal zustimmen', () => {
    const einmal = zustimmen(lauf({ noetig: 2 }), bert, STAND, JETZT);
    ok(einmal.ok);
    const zweimal = zustimmen(einmal.lauf, bert, STAND, JETZT);
    strictEqual(zweimal.ok, false);
  });

  it('lässt eine Rolle ohne das Recht nicht freigeben', () => {
    const redakteur: Sitzung = { person: 'p_carla', rolle: 'redakteur', organisation: ORG };
    strictEqual(zustimmen(lauf(), redakteur, STAND, JETZT).ok, false);
  });

  it('reicht nicht über die Organisationsgrenze', () => {
    const fremd: Sitzung = { person: 'p_dora', rolle: 'leitung', organisation: 'org_b' };
    strictEqual(zustimmen(lauf(), fremd, STAND, JETZT).ok, false);
  });

  /* Die Regel, an der die meisten Werkzeuge vorbeisehen. */
  it('verliert die Freigabe, wenn der Text sich ändert', () => {
    const e = zustimmen(lauf(), bert, STAND, JETZT);
    ok(e.ok);
    strictEqual(standVon(e.lauf, STAND), 'freigegeben');
    const neuerStand = standAus(['Ein ganz gewöhnlicher Satz. Und noch einer.']);
    strictEqual(standVon(e.lauf, neuerStand), 'ueberholt');
    strictEqual(zustimmen(e.lauf, bert, neuerStand, JETZT).ok, false);
  });

  it('wiegt eine Ablehnung schwerer als eine Zustimmung', () => {
    const eins = zustimmen(lauf({ noetig: 2 }), bert, STAND, JETZT);
    ok(eins.ok);
    const carla: Sitzung = { person: 'p_carla', rolle: 'leitung', organisation: ORG };
    const zwei = ablehnen(eins.lauf, carla, STAND, 'Die Zahl im zweiten Absatz stimmt nicht.', JETZT);
    ok(zwei.ok);
    strictEqual(standVon(zwei.lauf, STAND), 'abgelehnt');
  });

  it('nimmt keine Ablehnung ohne Grund an', () => {
    const e = ablehnen(lauf(), bert, STAND, 'nö', JETZT);
    strictEqual(e.ok, false);
    if (!e.ok) strictEqual(e.befund.kennung, 'freigabe.grund.fehlt');
  });

  it('merkt eine gerissene Frist, ohne zu blockieren', () => {
    const l = lauf({ frist: JETZT - 3_600_000 });
    ok(ueberfaellig(l, JETZT));
    ok(zustimmen(l, bert, STAND, JETZT).ok);
  });

  it('unterscheidet zwei ähnliche Stände', () => {
    ok(standAus(['ab', 'c']) !== standAus(['a', 'bc']));
  });
});

describe('Plan', () => {
  const regeln: Planregeln = { organisation: ORG, ...GRUNDREGELN };

  it('kennt eine Ruhezeit über Mitternacht', () => {
    const nachts = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 3, minute: 0, sekunde: 0 }).zeitpunkt;
    const mittags = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 13, minute: 0, sekunde: 0 }).zeitpunkt;
    const spaet = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 22, minute: 30, sekunde: 0 }).zeitpunkt;
    ok(inRuhezeit(nachts, regeln));
    ok(!inRuhezeit(mittags, regeln));
    ok(inRuhezeit(spaet, regeln));
  });

  it('hält einen Termin in der Vergangenheit an', () => {
    const b = beitrag([fassung('x')]);
    const befunde = pruefeTermin(b, JETZT - 60_000, [], [kanal('x')], regeln, JETZT);
    ok(befunde.some((x) => x.kennung === 'plan.vergangenheit' && x.schwere === 'fehler'));
  });

  it('hält zwei Beiträge zur selben Minute auf demselben Kanal an', () => {
    const ziel = JETZT + 3_600_000;
    const b = beitrag([fassung('x')], { kennung: 'bt_2' });
    const befunde = pruefeTermin(b, ziel, [{ beitrag: 'bt_1', kanal: 'kn_x', zeitpunkt: ziel }], [kanal('x')], regeln, JETZT);
    ok(befunde.some((x) => x.kennung === 'plan.gleicher.termin' && x.schwere === 'fehler'));
  });

  it('warnt bei zu dichtem Abstand, ohne anzuhalten', () => {
    const ziel = JETZT + 3_600_000;
    const b = beitrag([fassung('x')], { kennung: 'bt_2' });
    const befunde = pruefeTermin(
      b, ziel, [{ beitrag: 'bt_1', kanal: 'kn_x', zeitpunkt: ziel + 10 * 60_000 }], [kanal('x')], regeln, JETZT,
    );
    ok(befunde.some((x) => x.kennung === 'plan.zu.dicht' && x.schwere === 'warnung'));
    strictEqual(haeltAn(befunde), false);
  });

  it('meldet keinen Konflikt mit sich selbst beim Verschieben', () => {
    const ziel = JETZT + 3_600_000;
    const b = beitrag([fassung('x')], { kennung: 'bt_1' });
    const befunde = pruefeTermin(b, ziel, [{ beitrag: 'bt_1', kanal: 'kn_x', zeitpunkt: ziel }], [kanal('x')], regeln, JETZT);
    strictEqual(befunde.length, 0);
  });

  it('meldet keinen Konflikt auf einem anderen Kanal', () => {
    const ziel = JETZT + 3_600_000;
    const b = beitrag([fassung('x')], { kennung: 'bt_2' });
    const befunde = pruefeTermin(
      b, ziel, [{ beitrag: 'bt_1', kanal: 'kn_linkedin', zeitpunkt: ziel }], [kanal('x'), kanal('linkedin')], regeln, JETZT,
    );
    strictEqual(befunde.length, 0);
  });

  /* Der Krisenschalter. Er erreicht alles, nicht nur die sozialen Kanäle. */
  it('hält im Ruhemodus alles an', () => {
    const still: Planregeln = { ...regeln, ruhemodus: { an: true, grund: 'Unglück in der Nachbarschaft' } };
    const b = beitrag([fassung('x')]);
    const befunde = pruefeTermin(b, JETZT + 3_600_000, [], [kanal('x')], still, JETZT);
    const treffer = befunde.find((x) => x.kennung === 'plan.ruhemodus');
    strictEqual(treffer?.schwere, 'fehler');
    ok(treffer!.text.includes('Unglück in der Nachbarschaft'));
  });

  it('prüft den Zugang zum Termin und nicht zu jetzt', () => {
    // Der Zugang läuft in zehn Tagen ab, der Termin liegt in dreißig.
    const k = kanal('x', { tokenLaeuftAb: JETZT + 10 * 86_400_000 });
    const b = beitrag([fassung('x')]);
    const befunde = pruefeTermin(b, JETZT + 30 * 86_400_000, [], [k], regeln, JETZT);
    ok(befunde.some((x) => x.kennung === 'kanal.token.abgelaufen' && x.schwere === 'fehler'));
  });

  it('findet den nächsten freien Termin außerhalb der Ruhezeit', () => {
    // 23:50 Uhr: der nächste freie Termin liegt nach der Ruhezeit, also 07:00.
    const spaet = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 23, minute: 50, sekunde: 0 }).zeitpunkt;
    const frei = naechsterFreierTermin(spaet, ['kn_x'], [], regeln);
    ok(frei !== null);
    strictEqual(inRuhezeit(frei!, regeln), false);
    ok(frei! > spaet);
  });

  it('weicht einem belegten Termin aus', () => {
    const start = ausOertlich({ jahr: 2026, monat: 2, tag: 3, stunde: 9, minute: 0, sekunde: 0 }).zeitpunkt;
    const frei = naechsterFreierTermin(start, ['kn_x'], [{ beitrag: 'bt_1', kanal: 'kn_x', zeitpunkt: start }], regeln);
    ok(frei !== null);
    ok(frei! - start >= regeln.mindestabstandMin * 60_000);
  });

  it('sammelt Belegungen nur aus Beiträgen, die wirklich stehen', () => {
    const ziel = JETZT + 3_600_000;
    const belegt = belegungenAus([
      beitrag([fassung('x')], { kennung: 'bt_1', zustand: 'geplant', geplantFuer: ziel }),
      beitrag([fassung('x')], { kennung: 'bt_2', zustand: 'entwurf', geplantFuer: ziel }),
      beitrag([fassung('x')], { kennung: 'bt_3', zustand: 'zurueckgezogen', geplantFuer: ziel }),
    ]);
    strictEqual(belegt.length, 1);
    strictEqual(belegt[0]!.beitrag, 'bt_1');
  });
});
