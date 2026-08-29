/**
 * Kennungen, Zeichenzählung, Rechte, Ereigniskette.
 *
 * Vier Bausteine, auf denen alles andere steht. Fehler hier fallen nirgends
 * auf und überall an.
 */

import { deepStrictEqual, notStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import {
  gleichInGleicherZeit,
  neueKennung,
  streuwert,
  tokenBauen,
  tokenPruefen,
  zufallszeichen,
} from '../src/kern/kennung.ts';
import { codepunkte, erwaehnungen, findeAdressen, graphemzahl, hashtags, zaehle } from '../src/kern/zeichen.ts';
import { darf, darfHier, rechteVon, type Sitzung } from '../src/kern/rollen.ts';
import { anhaengen, KETTENANFANG, pruefeInhalt, pruefeKette, schliesseTagAb, type Ereignis } from '../src/kern/ereignis.ts';

describe('Kennungen', () => {
  it('sortiert nach Entstehungszeit', () => {
    const frueh = neueKennung('bt', Date.UTC(2026, 0, 1));
    const spaet = neueKennung('bt', Date.UTC(2026, 5, 1));
    ok(frueh < spaet, `${frueh} sollte vor ${spaet} stehen`);
  });

  it('kollidiert nicht in derselben Millisekunde', () => {
    const jetzt = Date.now();
    const menge = new Set(Array.from({ length: 2000 }, () => neueKennung('bt', jetzt)));
    strictEqual(menge.size, 2000);
  });

  /* Der Grund für die Verwerfungsschleife: `byte % 62` bevorzugt die ersten
     acht Zeichen des Alphabets um rund 3 %. Bei 200 000 Ziehungen ist das
     sicher messbar — die Prüfung ist bewusst großzügig, damit sie nicht
     gelegentlich grundlos fehlschlägt. */
  it('zieht ohne Schieflage', () => {
    const text = zufallszeichen(200_000);
    const zaehler = new Map<string, number>();
    for (const z of text) zaehler.set(z, (zaehler.get(z) ?? 0) + 1);
    strictEqual(zaehler.size, 62);
    const erwartet = 200_000 / 62;
    for (const [zeichen, anzahl] of zaehler) {
      const abweichung = Math.abs(anzahl - erwartet) / erwartet;
      ok(abweichung < 0.08, `${zeichen} weicht um ${(abweichung * 100).toFixed(1)} % ab`);
    }
  });

  it('vergleicht in gleichbleibender Zeit und trotzdem richtig', () => {
    ok(gleichInGleicherZeit('abc', 'abc'));
    ok(!gleichInGleicherZeit('abc', 'abd'));
    ok(!gleichInGleicherZeit('abc', 'abcd'));
  });

  it('teilt A/B-Gruppen gleichmäßig und immer gleich', () => {
    strictEqual(streuwert('ep_123'), streuwert('ep_123'));
    const werte = Array.from({ length: 5000 }, (_, i) => streuwert(`ep_${i}`));
    const inA = werte.filter((w) => w < 0.5).length;
    ok(Math.abs(inA - 2500) < 150, `A bekam ${inA} von 5000`);
  });

  /* Diese Prüfung fehlte, und das hat gekostet: mit 5000 Schlüsseln mittelt
     sich jede Schieflage weg. Ein Verteiler hat aber 49 Empfänger, nicht 5000,
     und die Schlüssel sehen einander dann sehr ähnlich. Ohne den Nachlauf im
     Streuwert fielen hier 2 von 49 in die erste Gruppe statt 24. */
  it('teilt auch wenige, einander ähnliche Schlüssel noch gleichmäßig', () => {
    for (const anzahl of [20, 49, 120]) {
      const inA = Array.from({ length: anzahl }, (_, i) => streuwert(`nl_1:ep_${i}`)).filter((w) => w < 0.5).length;
      const abweichung = Math.abs(inA - anzahl / 2) / anzahl;
      ok(abweichung < 0.2, `bei ${anzahl} Schlüsseln bekam A ${inA} — ${(abweichung * 100).toFixed(0)} % daneben`);
    }
  });

  it('streut auch über verschiedene Versuche hinweg', () => {
    // Derselbe Empfänger darf bei zwei Newslettern nicht zwangsläufig in
    // derselben Gruppe landen — sonst sieht ein Teil des Bestands nie eine B.
    const gleich = Array.from({ length: 200 }, (_, i) =>
      streuwert(`nl_1:ep_${i}`) < 0.5 === streuwert(`nl_2:ep_${i}`) < 0.5,
    ).filter(Boolean).length;
    ok(gleich > 60 && gleich < 140, `${gleich} von 200 landeten beide Male gleich`);
  });
});

describe('Token', () => {
  const GEHEIM = 'nur-für-den-test-nicht-in-betrieb';

  it('geht hin und zurück', async () => {
    const t = await tokenBauen(GEHEIM, { zweck: 'abmelden', bezug: 'ep_7', verfall: 0 });
    const p = await tokenPruefen(GEHEIM, t, 'abmelden');
    ok(p.ok);
    strictEqual(p.nutzlast.bezug, 'ep_7');
  });

  /* Der wichtigste Fall: ein Bestätigungslink darf nicht abmelden. Ohne die
     Zweckprüfung wäre jeder Doppel-Opt-in-Link zugleich ein Abmeldelink. */
  it('gilt nur für seinen Zweck', async () => {
    const t = await tokenBauen(GEHEIM, { zweck: 'bestaetigen', bezug: 'ep_7', verfall: 0 });
    const p = await tokenPruefen(GEHEIM, t, 'abmelden');
    strictEqual(p.ok, false);
    if (!p.ok) strictEqual(p.grund, 'zweck');
  });

  it('erkennt eine verstellte Nutzlast', async () => {
    const t = await tokenBauen(GEHEIM, { zweck: 'abmelden', bezug: 'ep_7', verfall: 0 });
    const gefaelscht = (await tokenBauen(GEHEIM, { zweck: 'abmelden', bezug: 'ep_8', verfall: 0 })).split('.')[0]
      + '.' + t.split('.')[1];
    const p = await tokenPruefen(GEHEIM, gefaelscht, 'abmelden');
    strictEqual(p.ok, false);
    if (!p.ok) strictEqual(p.grund, 'signatur');
  });

  it('gilt nicht mit einem anderen Schlüssel', async () => {
    const t = await tokenBauen(GEHEIM, { zweck: 'abmelden', bezug: 'ep_7', verfall: 0 });
    const p = await tokenPruefen(GEHEIM + 'x', t, 'abmelden');
    strictEqual(p.ok, false);
  });

  it('verfällt', async () => {
    const t = await tokenBauen(GEHEIM, { zweck: 'bestaetigen', bezug: 'ep_7', verfall: 1000 });
    strictEqual((await tokenPruefen(GEHEIM, t, 'bestaetigen', 999)).ok, true);
    const p = await tokenPruefen(GEHEIM, t, 'bestaetigen', 1001);
    strictEqual(p.ok, false);
    if (!p.ok) strictEqual(p.grund, 'abgelaufen');
  });

  it('nimmt keinen Unsinn an', async () => {
    for (const unsinn of ['', '.', 'abc', 'abc.', '.abc']) {
      strictEqual((await tokenPruefen(GEHEIM, unsinn, 'abmelden')).ok, false);
    }
  });
});

describe('Zeichen zählen', () => {
  it('zählt Emoji als eine Graphemgruppe, nicht als vier', () => {
    const familie = '👩‍👩‍👧';
    strictEqual(familie.length, 8); // UTF-16-Einheiten — die Zahl, die niemand meint
    strictEqual(codepunkte(familie), 5);
    strictEqual(graphemzahl(familie), 1);
  });

  it('zählt bei X gewichtet: Umlaute einfach, Emoji doppelt', () => {
    strictEqual(zaehle('Grüße', 'gewichtet'), 5);
    strictEqual(zaehle('😀', 'gewichtet'), 2);
    // Kyrillisch liegt außerhalb des einfachen Bereichs nicht — bis 4351 zählt einfach.
    strictEqual(zaehle('привет', 'gewichtet'), 6);
    // Japanisch liegt darüber und wiegt doppelt.
    strictEqual(zaehle('こんにちは', 'gewichtet'), 10);
  });

  it('rechnet eine Adresse pauschal mit 23', () => {
    const kurz = 'Mehr: https://a.de';
    const lang = 'Mehr: https://a.de/ein/sehr/langer/pfad?mit=vielen&parametern=drin';
    strictEqual(zaehle(kurz, 'gewichtet'), zaehle(lang, 'gewichtet'));
    strictEqual(zaehle(kurz, 'gewichtet'), 6 + 23);
  });

  it('lässt bei LinkedIn Adressen normal zählen', () => {
    const t = 'Mehr: https://a.de';
    strictEqual(zaehle(t, 'codepunkt'), t.length);
  });

  it('nimmt den Satzpunkt nicht in die Adresse', () => {
    const treffer = findeAdressen('Siehe https://beispiel.de/seite.');
    strictEqual(treffer.length, 1);
    strictEqual(treffer[0]!.text, 'https://beispiel.de/seite');
  });

  it('behält die Klammer, wenn sie zum Pfad gehört', () => {
    const treffer = findeAdressen('https://de.wikipedia.org/wiki/Kanal_(Technik)');
    strictEqual(treffer[0]!.text, 'https://de.wikipedia.org/wiki/Kanal_(Technik)');
  });

  it('findet Hashtags, aber keine Aufzählungen', () => {
    deepStrictEqual(hashtags('Wir sind #dabei — Platz #1 von #10 #teil_zwei'), ['dabei', 'teil_zwei']);
  });

  it('findet Erwähnungen samt Fediverse-Form', () => {
    deepStrictEqual(erwaehnungen('Danke @anna und @bert@haus.social'), ['anna', 'bert@haus.social']);
  });
});

describe('Rollen und Rechte', () => {
  it('erbt aufsteigend', () => {
    ok(darf('betrachter', 'beitrag.lesen'));
    ok(darf('leitung', 'beitrag.lesen'));
    ok(!darf('betrachter', 'beitrag.schreiben'));
    ok(darf('redakteur', 'beitrag.schreiben'));
  });

  /* Der Freigeber gibt frei, sendet aber nicht — sonst wären Freigabe und
     Auslösung derselbe Handgriff. */
  it('trennt Freigabe von Auslösung', () => {
    ok(darf('freigeber', 'beitrag.freigeben'));
    ok(!darf('freigeber', 'newsletter.senden'));
    ok(darf('leitung', 'newsletter.senden'));
  });

  it('lässt Personendaten nur die Verwaltung löschen', () => {
    ok(!darf('leitung', 'empfaenger.loeschen'));
    ok(darf('verwaltung', 'empfaenger.loeschen'));
  });

  it('gilt nur in der eigenen Organisation', () => {
    const sitzung: Sitzung = { person: 'p1', rolle: 'leitung', organisation: 'org_a' };
    ok(darfHier(sitzung, 'newsletter.senden', 'org_a'));
    ok(!darfHier(sitzung, 'beitrag.lesen', 'org_b'));
  });

  it('zählt die Rechte einer Rolle vollständig auf', () => {
    ok(rechteVon('verwaltung').length > rechteVon('betrachter').length);
    ok(rechteVon('betrachter').every((r) => rechteVon('verwaltung').includes(r)));
  });
});

describe('Ereigniskette', () => {
  async function baueKette(anzahl: number): Promise<Ereignis[]> {
    const kette: Ereignis[] = [];
    for (let i = 0; i < anzahl; i++) {
      kette.push(
        await anhaengen(kette.at(-1) ?? null, {
          organisation: 'org_a',
          art: 'beitrag.angelegt',
          urheber: 'p1',
          bezug: `bt_${i}`,
          zeitpunkt: 1_800_000_000_000 + i * 1000,
          inhalt: { kanal: 'mastodon', laenge: 120 },
        }),
      );
    }
    return kette;
  }

  it('verkettet lückenlos', async () => {
    const kette = await baueKette(5);
    strictEqual(kette[0]!.vorher, KETTENANFANG);
    strictEqual(kette[1]!.vorher, kette[0]!.hash);
    strictEqual(kette[4]!.folge, 5);
    const befund = await pruefeKette(kette);
    ok(befund.ok);
    strictEqual(befund.laenge, 5);
  });

  it('merkt, wenn eine Zeile nachträglich geändert wurde', async () => {
    const kette = await baueKette(5);
    kette[2] = { ...kette[2]!, inhalt: { kanal: 'x', laenge: 120 } };
    const befund = await pruefeKette(kette);
    strictEqual(befund.ok, false);
    if (!befund.ok) {
      strictEqual(befund.grund, 'hash');
      strictEqual(befund.beiFolge, 3);
    }
  });

  it('merkt, wenn eine Zeile entfernt wurde', async () => {
    const kette = await baueKette(5);
    kette.splice(2, 1);
    const befund = await pruefeKette(kette);
    strictEqual(befund.ok, false);
    if (!befund.ok) strictEqual(befund.grund, 'folge');
  });

  it('mischt keine Organisationen', async () => {
    const kette = await baueKette(3);
    kette[1] = { ...kette[1]!, organisation: 'org_b' };
    const befund = await pruefeKette(kette);
    strictEqual(befund.ok, false);
  });

  it('schließt den Tag mit einer Signatur ab', async () => {
    const kette = await baueKette(3);
    const a = await schliesseTagAb('geheim', 'org_a', '2026-08-29', kette);
    strictEqual(a.bisFolge, 3);
    strictEqual(a.kopf, kette[2]!.hash);
    const b = await schliesseTagAb('anderes', 'org_a', '2026-08-29', kette);
    notStrictEqual(a.signatur, b.signatur);
  });

  /* Eine Mailadresse im Protokoll macht die Löschung nach Artikel 17
     unmöglich, ohne die Kette zu brechen. Der Wächter greift beim Anlegen. */
  it('hält Personendaten aus dem Protokoll heraus', () => {
    strictEqual(pruefeInhalt({ kennung: 'ep_7', anzahl: 3 }).ok, true);
    const schlecht = pruefeInhalt({ adresse: 'anna@example.org' });
    strictEqual(schlecht.ok, false);
    if (!schlecht.ok) strictEqual(schlecht.feld, 'adresse');
    strictEqual(pruefeInhalt({ telefon: '+49 170 1234567' }).ok, false);
  });
});
