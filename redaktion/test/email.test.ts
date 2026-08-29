/**
 * E-Mail: Empfänger, Segmente, Newsletter, Versand, Zustellbarkeit, Strecken.
 *
 * Die Prüfungen hier decken die Fälle ab, die im Betrieb Geld oder Ruf kosten:
 * eine Mail an jemanden, der nie bestätigt hat; „Hallo ," im Betreff; ein
 * zweiter Versand nach einem Neustart; eine Willkommensfolge, die nach der
 * Abmeldung weiterläuft.
 */

import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { haeltAn, nach } from '../src/kern/befund.ts';
import {
  abmelden,
  bestaetigen,
  doppelte,
  empfaengtPost,
  faellig,
  loeschen,
  pruefeAdresse,
  sperren,
  WEICHE_GRENZE,
  weicherRuecklaeufer,
  wiederAnmelden,
  zugestellt,
  type Empfaenger,
} from '../src/kern/empfaenger.ts';
import {
  empfaengerFuer,
  LEERE_KENNZAHLEN,
  passt,
  pruefeRegelwerk,
  segmentbild,
  type Kennzahlen,
  type Regelwerk,
  type Segment,
  type Verteiler,
} from '../src/kern/verteiler.ts';
import {
  alsText,
  fertige,
  maskiere,
  pruefeNewsletter,
  setzeFelder,
  variantenwahl,
  verlangteFelder,
  type Newsletter,
} from '../src/kern/newsletter.ts';
import {
  abbrechen,
  alsEndgueltig,
  alsGesendet,
  alsWeich,
  beschwerdequote,
  durch,
  fortschritt,
  HOECHSTVERSUCHE,
  kontingent,
  legeLaufAn,
  naechsteCharge,
  pausieren,
  postenkennung,
  quotenbefund,
  starten,
} from '../src/kern/versand.ts';
import { aufwaermplan, kopfzeilen, mengeAmTag, pruefeEinrichtung } from '../src/kern/zustellung.ts';
import { loestAus, naechsterSchritt, pruefeStrecke, starteLauf, type Strecke } from '../src/kern/strecke.ts';

const ORG = 'org_a';
const JETZT = 1_800_000_000_000;

function empf(teil: Partial<Empfaenger> = {}): Empfaenger {
  const adresse = teil.adresse ?? 'anna@beispiel.de';
  return {
    kennung: 'ep_1',
    organisation: ORG,
    adresse,
    schluessel: adresse?.toLowerCase() ?? null,
    zustand: 'bestaetigt',
    einwilligung: {
      quelle: 'formular:startseite',
      eingetragenAm: JETZT - 86_400_000,
      bestaetigtAm: JETZT - 86_000_000,
      wortlaut: 'Ich möchte den Newsletter bekommen und kann mich jederzeit abmelden.',
      quellStreuwert: 'ab12',
    },
    merkmale: { vorname: 'Anna', stadt: 'Verden' },
    verteiler: ['vt_news'],
    weicheRuecklaeufer: 0,
    ...teil,
  };
}

const VERTEILER: Verteiler = {
  kennung: 'vt_news',
  organisation: ORG,
  name: 'Newsletter',
  wortlaut: 'Ich möchte den Newsletter bekommen.',
  listenkennung: 'news.haus.de',
  beschreibung: 'Einmal im Monat.',
};

describe('Adressen', () => {
  it('nimmt eine gewöhnliche Adresse an', () => {
    const a = pruefeAdresse('  Anna.Meier@Beispiel.DE ');
    ok(a.ok);
    // Der Rechnername wird kleingeschrieben, der Teil davor bleibt.
    strictEqual(a.adresse, 'Anna.Meier@beispiel.de');
    strictEqual(a.schluessel, 'anna.meier@beispiel.de');
  });

  it('weist zurück, was keine Adresse ist', () => {
    for (const unsinn of ['', 'anna', 'anna@', '@beispiel.de', 'anna@beispiel', 'a b@c.de', 'anna@@b.de', '.a@b.de', 'a..b@c.de']) {
      strictEqual(pruefeAdresse(unsinn).ok, false, `${unsinn} sollte durchfallen`);
    }
  });

  it('schreibt eine Umlautdomain in Punycode um', () => {
    const a = pruefeAdresse('post@körbchen.de');
    ok(a.ok);
    ok(a.adresse.includes('xn--'), a.adresse);
  });

  it('erkennt den Vertipper, ohne anzuhalten', () => {
    const a = pruefeAdresse('anna@gmail.con');
    ok(a.ok);
    const w = nach(a.befunde, 'warnung');
    strictEqual(w.length, 1);
    ok(w[0]!.text.includes('gmail.com'));
  });

  it('merkt eine Rollenadresse an', () => {
    const a = pruefeAdresse('info@haus.de');
    ok(a.ok);
    ok(a.befunde.some((b) => b.kennung === 'adresse.rolle'));
  });

  it('merkt eine Beispieldomain an', () => {
    ok(pruefeAdresse('a@example.com').befunde.some((b) => b.kennung === 'adresse.beispiel'));
  });
});

describe('Einwilligung und Zustand', () => {
  it('lässt nur Bestätigte Post bekommen', () => {
    ok(empfaengtPost(empf()));
    ok(!empfaengtPost(empf({ zustand: 'eingetragen' })));
    ok(!empfaengtPost(empf({ zustand: 'abgemeldet' })));
    ok(!empfaengtPost(empf({ zustand: 'gesperrt' })));
  });

  it('bestätigt und hält den Zeitpunkt fest', () => {
    const e = bestaetigen(empf({ zustand: 'eingetragen', einwilligung: { ...empf().einwilligung, bestaetigtAm: null } }), JETZT);
    ok(e.ok);
    strictEqual(e.empfaenger.zustand, 'bestaetigt');
    strictEqual(e.empfaenger.einwilligung.bestaetigtAm, JETZT);
  });

  /* Mailprogramme rufen Links zur Prüfung selbst auf. Der zweite Klick auf
     denselben Bestätigungslink ist der Normalfall, nicht der Fehler. */
  it('nimmt einen zweiten Klick auf den Bestätigungslink hin', () => {
    strictEqual(bestaetigen(empf(), JETZT).ok, true);
  });

  it('lässt eine Sperre nicht durch Bestätigen aufheben', () => {
    strictEqual(bestaetigen(empf({ zustand: 'gesperrt' }), JETZT).ok, false);
  });

  it('meldet immer ab, auch mehrfach', () => {
    const einmal = abmelden(empf(), JETZT);
    strictEqual(einmal.zustand, 'abgemeldet');
    strictEqual(abmelden(einmal, JETZT + 1000).abgemeldetAm, JETZT);
    // Auch aus „eingetragen" heraus: eine Abmeldung, die eine Anmeldung
    // verlangt, ist keine.
    strictEqual(abmelden(empf({ zustand: 'eingetragen' }), JETZT).zustand, 'abgemeldet');
  });

  it('verlangt bei der Wiederanmeldung eine neue Bestätigung', () => {
    const wieder = wiederAnmelden(abmelden(empf(), JETZT), JETZT + 1000, 'Neuer Wortlaut.');
    ok(wieder.ok);
    strictEqual(wieder.empfaenger.zustand, 'eingetragen');
    strictEqual(wieder.empfaenger.einwilligung.bestaetigtAm, null);
    ok(!empfaengtPost(wieder.empfaenger));
  });

  it('lässt einen Gesperrten sich nicht wieder anmelden', () => {
    strictEqual(wiederAnmelden(sperren(empf(), 'beschwerde', JETZT), JETZT, 'x').ok, false);
  });

  it('sperrt nach genug weichen Rückläufern', () => {
    let e = empf();
    for (let i = 1; i < WEICHE_GRENZE; i++) {
      e = weicherRuecklaeufer(e, JETZT);
      strictEqual(e.zustand, 'bestaetigt', `nach ${i} sollte noch nicht gesperrt sein`);
    }
    e = weicherRuecklaeufer(e, JETZT);
    strictEqual(e.zustand, 'gesperrt');
    strictEqual(e.gesperrtWegen, 'hart');
  });

  it('setzt den Zähler bei erfolgreicher Zustellung zurück', () => {
    const e = zugestellt(weicherRuecklaeufer(weicherRuecklaeufer(empf(), JETZT), JETZT));
    strictEqual(e.weicheRuecklaeufer, 0);
  });

  /* Die Adresse geht, die Kennung bleibt — sonst wäre das Ereignisprotokoll
     zu brechen, um eine Löschung auszuführen. */
  it('löscht Adresse und Merkmale, behält die Kennung', () => {
    const e = loeschen(empf(), JETZT);
    strictEqual(e.kennung, 'ep_1');
    strictEqual(e.adresse, null);
    strictEqual(e.schluessel, null);
    deepStrictEqual(e.merkmale, {});
    deepStrictEqual(e.verteiler, []);
    strictEqual(e.einwilligung.wortlaut, '');
    ok(!empfaengtPost(e));
  });

  it('räumt Unbestätigte nach Ablauf der Frist auf', () => {
    const jung = empf({ kennung: 'ep_jung', zustand: 'eingetragen' });
    const alt = empf({
      kennung: 'ep_alt',
      zustand: 'eingetragen',
      einwilligung: { ...empf().einwilligung, eingetragenAm: JETZT - 40 * 86_400_000, bestaetigtAm: null },
    });
    const raus = faellig([jung, alt, empf()], JETZT);
    strictEqual(raus.length, 1);
    strictEqual(raus[0]!.kennung, 'ep_alt');
  });

  it('findet Doppelte über den kleingeschriebenen Schlüssel', () => {
    const a = empf({ kennung: 'ep_1', adresse: 'Anna@haus.de', schluessel: 'anna@haus.de' });
    const b = empf({ kennung: 'ep_2', adresse: 'anna@haus.de', schluessel: 'anna@haus.de' });
    const c = empf({ kennung: 'ep_3', adresse: 'bert@haus.de', schluessel: 'bert@haus.de' });
    const d = doppelte([a, b, c]);
    strictEqual(d.size, 1);
    strictEqual(d.get('anna@haus.de')!.length, 2);
  });
});

describe('Segmente', () => {
  const kennzahlen = new Map<string, Kennzahlen>([['ep_1', { gesendet: 40, geoeffnet: 12, geklickt: 3, letzteRegung: JETZT - 1000 }]]);

  it('vergleicht ohne Rücksicht auf Groß- und Kleinschreibung', () => {
    const werk: Regelwerk = { verknuepfung: 'und', teile: [{ feld: 'merkmal.stadt', vergleich: 'ist', wert: 'verden' }] };
    ok(passt(empf(), LEERE_KENNZAHLEN, werk));
  });

  it('verknüpft und und oder', () => {
    const werk: Regelwerk = {
      verknuepfung: 'und',
      teile: [
        { feld: 'merkmal.stadt', vergleich: 'ist', wert: 'Verden' },
        { verknuepfung: 'oder', teile: [
          { feld: 'geklickt', vergleich: 'groesser', wert: 10 },
          { feld: 'geoeffnet', vergleich: 'groesser', wert: 10 },
        ] },
      ],
    };
    ok(passt(empf(), kennzahlen.get('ep_1')!, werk));
    ok(!passt(empf(), LEERE_KENNZAHLEN, werk));
  });

  /* Die vorsichtige Richtung: ein leeres Segment trifft niemanden. Andersherum
     ginge ein versehentlich leeres Segment an den ganzen Bestand. */
  it('trifft mit einem leeren Regelwerk niemanden', () => {
    ok(!passt(empf(), LEERE_KENNZAHLEN, { verknuepfung: 'und', teile: [] }));
    ok(!passt(empf(), LEERE_KENNZAHLEN, { verknuepfung: 'oder', teile: [] }));
  });

  it('kennt vorhanden und fehlt', () => {
    ok(passt(empf(), LEERE_KENNZAHLEN, { verknuepfung: 'und', teile: [{ feld: 'merkmal.vorname', vergleich: 'vorhanden' }] }));
    ok(passt(empf(), LEERE_KENNZAHLEN, { verknuepfung: 'und', teile: [{ feld: 'merkmal.firma', vergleich: 'fehlt' }] }));
  });

  /* Die Zusage, die nicht von der Sorgfalt dessen abhängt, der die Filter
     zusammenklickt. */
  it('kann kein Segment bauen, das an Unbestätigte geht', () => {
    const segment: Segment = {
      kennung: 'sg_1',
      organisation: ORG,
      name: 'Alle Unbestätigten',
      regelwerk: { verknuepfung: 'und', teile: [{ feld: 'zustand', vergleich: 'ist', wert: 'eingetragen' }] },
    };
    const bestand = [empf({ kennung: 'ep_1', zustand: 'eingetragen' }), empf({ kennung: 'ep_2', zustand: 'bestaetigt' })];
    strictEqual(empfaengerFuer(bestand, new Map(), { segment, organisation: ORG }).length, 0);
  });

  it('geht nicht über die Organisationsgrenze', () => {
    const bestand = [empf({ kennung: 'ep_1' }), empf({ kennung: 'ep_2', organisation: 'org_b' })];
    strictEqual(empfaengerFuer(bestand, new Map(), { organisation: ORG }).length, 1);
  });

  it('schneidet auf einen Verteiler zu', () => {
    const bestand = [empf({ kennung: 'ep_1', verteiler: ['vt_news'] }), empf({ kennung: 'ep_2', verteiler: ['vt_termine'] })];
    strictEqual(empfaengerFuer(bestand, new Map(), { verteiler: 'vt_news', organisation: ORG }).length, 1);
  });

  it('zeigt vor dem Versand, wen es nicht trifft', () => {
    const bestand = [
      empf({ kennung: 'ep_1', zustand: 'bestaetigt' }),
      empf({ kennung: 'ep_2', zustand: 'eingetragen' }),
      empf({ kennung: 'ep_3', zustand: 'abgemeldet' }),
      empf({ kennung: 'ep_4', zustand: 'gesperrt' }),
    ];
    const bild = segmentbild(bestand, new Map(), { organisation: ORG });
    strictEqual(bild.trifft, 1);
    strictEqual(bild.imBestand, 4);
    strictEqual(bild.nichtBestaetigt, 1);
    strictEqual(bild.abgemeldet, 1);
    strictEqual(bild.gesperrt, 1);
  });

  it('meldet einen Zahlenvergleich mit einem Text', () => {
    const b = pruefeRegelwerk({ verknuepfung: 'und', teile: [{ feld: 'geoeffnet', vergleich: 'groesser', wert: 'viele' }] });
    ok(b.some((x) => x.kennung === 'segment.zahl.erwartet' && x.schwere === 'fehler'));
  });

  it('meldet ein leeres Regelwerk', () => {
    ok(pruefeRegelwerk({ verknuepfung: 'und', teile: [] }).some((x) => x.kennung === 'segment.leer'));
  });
});

describe('Newsletter', () => {
  function brief(teil: Partial<Newsletter> = {}): Newsletter {
    return {
      kennung: 'nl_1',
      organisation: ORG,
      titel: 'Februar',
      zustand: 'entwurf',
      varianten: [{ kennung: 'a', betreff: 'Was im Februar ansteht', vorschau: 'Drei Termine und ein Rückblick.' }],
      bausteine: [
        { art: 'ueberschrift', text: 'Im Februar', stufe: 2 },
        { art: 'text', text: 'Hallo {{vorname|zusammen}},\n\nhier ist, was ansteht.' },
        { art: 'knopf', beschriftung: 'Zum Kalender', ziel: 'https://haus.de/kalender' },
      ],
      verteiler: 'vt_news',
      absender: { name: 'Haus', adresse: 'post@haus.de' },
      geplantFuer: null,
      verfasser: 'p_anna',
      angelegtAm: JETZT,
      geaendertAm: JETZT,
      ...teil,
    };
  }

  it('setzt Felder ein und nimmt den Ersatz, wenn nichts da ist', () => {
    const mit = setzeFelder('Hallo {{vorname|zusammen}}', { merkmale: { vorname: 'Anna' }, abmeldelink: 'x', verteilername: 'N' });
    ok(mit.ok);
    strictEqual(mit.text, 'Hallo Anna');
    const ohne = setzeFelder('Hallo {{vorname|zusammen}}', { merkmale: {}, abmeldelink: 'x', verteilername: 'N' });
    ok(ohne.ok);
    strictEqual(ohne.text, 'Hallo zusammen');
  });

  /* Der Grund für die ganze Strenge: „Hallo ,". */
  it('hält an, wenn ein Feld ohne Ersatz fehlt', () => {
    const e = setzeFelder('Hallo {{vorname}},', { merkmale: {}, abmeldelink: 'x', verteilername: 'N' });
    strictEqual(e.ok, false);
    if (!e.ok) deepStrictEqual(e.fehlend, ['vorname']);
  });

  it('zeigt im Editor, welche Felder eine Vorlage verlangt', () => {
    deepStrictEqual(verlangteFelder('Hallo {{vorname|du}}, aus {{stadt}}'), [
      { feld: 'vorname', hatErsatz: true },
      { feld: 'stadt', hatErsatz: false },
    ]);
  });

  /* Jemand trägt sich mit dem Vornamen `<script>` ein. */
  it('maskiert eingesetzte Merkmale', () => {
    const boese = empf({ merkmale: { vorname: '<script>alert(1)</script>' } });
    const e = fertige(brief(), boese, VERTEILER, 'https://haus.de/ab/xyz');
    ok(e.ok);
    ok(!e.mail.html.includes('<script>'));
    ok(e.mail.html.includes('&lt;script&gt;'));
  });

  it('maskiert auch Anführungszeichen', () => {
    strictEqual(maskiere('a"b\'c&d<e>'), 'a&quot;b&#39;c&amp;d&lt;e&gt;');
  });

  it('baut die Textfassung aus den Bausteinen und nicht aus dem HTML', () => {
    const text = alsText([
      { art: 'ueberschrift', text: 'Im Februar', stufe: 2 },
      { art: 'bild', datei: 'a.jpg', alt: 'Ein Saal von hinten.' },
      { art: 'knopf', beschriftung: 'Zum Kalender', ziel: 'https://haus.de/k' },
    ]);
    ok(text.includes('Im Februar'));
    // Der Alternativtext ist in der Textfassung der ganze Inhalt des Bildes.
    ok(text.includes('[Bild: Ein Saal von hinten.]'));
    // Und der Knopf braucht seine Adresse, sonst führt er nirgendwohin.
    ok(text.includes('https://haus.de/k'));
  });

  it('hängt den Abmeldeweg an die Textfassung', () => {
    const e = fertige(brief(), empf(), VERTEILER, 'https://haus.de/ab/xyz');
    ok(e.ok);
    ok(e.mail.text.includes('https://haus.de/ab/xyz'));
  });

  it('teilt A/B gleichbleibend auf', () => {
    const ab = brief({
      varianten: [
        { kennung: 'a', betreff: 'Erster', vorschau: 'x' },
        { kennung: 'b', betreff: 'Zweiter', vorschau: 'y' },
      ],
    });
    const e = empf();
    strictEqual(variantenwahl(ab, e).kennung, variantenwahl(ab, e).kennung);
    const verteilt = new Set(
      Array.from({ length: 200 }, (_, i) => variantenwahl(ab, empf({ kennung: `ep_${i}` })).kennung),
    );
    strictEqual(verteilt.size, 2);
  });

  it('lässt einen sauberen Newsletter durch', () => {
    strictEqual(haeltAn(pruefeNewsletter(brief())), false);
  });

  /* Ohne Text ist die Mail bei abgeschalteten Bildern weiß und für jeden
     Filter Werbung. */
  it('hält einen Newsletter an, der nur aus Bildern besteht', () => {
    const nur = brief({ bausteine: [{ art: 'bild', datei: 'a.jpg', alt: 'Ein Plakat.' }] });
    ok(pruefeNewsletter(nur).some((b) => b.kennung === 'newsletter.nur.bild' && b.schwere === 'fehler'));
  });

  it('hält eine relative Adresse im Knopf an', () => {
    const b = brief({ bausteine: [{ art: 'text', text: 'x' }, { art: 'knopf', beschriftung: 'Hin', ziel: '/kalender' }] });
    ok(pruefeNewsletter(b).some((x) => x.kennung === 'newsletter.ziel.relativ' && x.schwere === 'fehler'));
  });

  it('verlangt bei zwei Varianten ein Entscheidungsmaß', () => {
    const ab = brief({
      varianten: [
        { kennung: 'a', betreff: 'Erster', vorschau: 'x' },
        { kennung: 'b', betreff: 'Zweiter', vorschau: 'y' },
      ],
    });
    ok(pruefeNewsletter(ab).some((x) => x.kennung === 'newsletter.ab.ohne.mass'));
  });

  it('meldet zwei gleiche Betreffe im A/B-Versuch', () => {
    const ab = brief({
      varianten: [
        { kennung: 'a', betreff: 'Gleich', vorschau: 'x' },
        { kennung: 'b', betreff: 'Gleich', vorschau: 'y' },
      ],
      entscheidungsmass: 'oeffnung',
      pruefdauerMs: 4 * 3_600_000,
    });
    ok(pruefeNewsletter(ab).some((x) => x.kennung === 'newsletter.ab.gleich'));
  });

  it('warnt vor einem Nicht-Antworten-Absender ohne Antwortadresse', () => {
    const b = brief({ absender: { name: 'Haus', adresse: 'noreply@haus.de' } });
    ok(pruefeNewsletter(b).some((x) => x.kennung === 'newsletter.noreply'));
  });

  it('merkt einen zu langen Betreff an, ohne anzuhalten', () => {
    const b = brief({ varianten: [{ kennung: 'a', betreff: 'W'.repeat(80), vorschau: 'x' }] });
    const befunde = pruefeNewsletter(b);
    strictEqual(haeltAn(befunde), false);
    ok(befunde.some((x) => x.kennung === 'newsletter.betreff.lang'));
  });
});

describe('Versand', () => {
  const leute = Array.from({ length: 300 }, (_, i) => ({ kennung: `ep_${i}`, variante: 'a' }));

  /** Legt an und startet in einem Zug — sonst steht in jedem Test dasselbe. */
  function gestartet(anzahl: number, proStunde = 1000, kennung = 'vl_1') {
    const e = starten(legeLaufAn(kennung, ORG, 'nl_1', leute.slice(0, anzahl), proStunde), JETZT);
    if (!e.ok) throw new Error('Der Lauf startet nicht');
    return e.lauf;
  }

  it('errechnet die Postenkennung, statt sie zu ziehen', () => {
    strictEqual(postenkennung('vl_1', 'ep_7'), postenkennung('vl_1', 'ep_7'));
    ok(postenkennung('vl_1', 'ep_7') !== postenkennung('vl_2', 'ep_7'));
  });

  /* Der eigentliche Doppelversandschutz: derselbe Lauf, dieselbe Liste,
     dieselben Kennungen — auch nach einem Neustart mitten im Versand. */
  it('erzeugt nach einem Neustart dieselben Posten', () => {
    const eins = legeLaufAn('vl_1', ORG, 'nl_1', leute, 1000);
    const zwei = legeLaufAn('vl_1', ORG, 'nl_1', leute, 1000);
    deepStrictEqual(eins.posten.map((p) => p.kennung), zwei.posten.map((p) => p.kennung));
  });

  it('sendet einen bereits gesendeten Posten nicht noch einmal', () => {
    const lauf = gestartet(300);
    const posten = lauf.posten[0]!.kennung;
    const einmal = alsGesendet(lauf, posten, JETZT);
    const zweimal = alsGesendet(einmal, posten, JETZT + 60_000);
    strictEqual(zweimal.posten[0]!.gesendetAm, JETZT);
    strictEqual(zweimal.posten[0]!.versuche, 1);
  });

  it('drosselt nach dem Stundenkontingent', () => {
    const lauf = gestartet(300, 100);
    // Zu Beginn: das Anfangskontingent, hier auf 100 je Stunde gedeckelt.
    strictEqual(kontingent(lauf, JETZT), 50);
    // Nach einer Stunde: 50 + 100.
    strictEqual(kontingent(lauf, JETZT + 3_600_000), 150);
  });

  it('gibt aus einem nicht laufenden Lauf keine Charge heraus', () => {
    const vorbereitet = legeLaufAn('vl_1', ORG, 'nl_1', leute, 1000);
    strictEqual(naechsteCharge(vorbereitet, JETZT).length, 0);
    const lauf = gestartet(300);
    ok(naechsteCharge(lauf, JETZT).length > 0);
    strictEqual(naechsteCharge(pausieren(lauf), JETZT).length, 0);
  });

  it('setzt einen abgebrochenen Lauf nicht fort', () => {
    const tot = abbrechen(gestartet(300), 'Zahl im zweiten Absatz falsch', JETZT);
    strictEqual(naechsteCharge(tot, JETZT).length, 0);
    strictEqual(starten(tot, JETZT).ok, false);
  });

  it('versucht einen weichen Rückläufer später noch einmal und gibt dann auf', () => {
    let lauf = gestartet(1);
    const posten = lauf.posten[0]!.kennung;
    for (let i = 0; i < HOECHSTVERSUCHE - 1; i++) {
      lauf = alsWeich(lauf, posten, '452 Postfach voll', JETZT);
      strictEqual(lauf.posten[0]!.zustand, 'weich');
      ok(lauf.posten[0]!.naechsterVersuch! > JETZT);
    }
    lauf = alsWeich(lauf, posten, '452 Postfach voll', JETZT);
    strictEqual(lauf.posten[0]!.zustand, 'aufgegeben');
  });

  it('wartet vor dem zweiten Versuch', () => {
    const lauf = gestartet(1);
    const weich = alsWeich(lauf, lauf.posten[0]!.kennung, '452', JETZT);
    strictEqual(naechsteCharge(weich, JETZT).length, 0);
    ok(naechsteCharge(weich, JETZT + 20 * 60_000).length > 0);
  });

  it('zählt den Fortschritt und weiß, wann es durch ist', () => {
    let lauf = gestartet(3);
    strictEqual(durch(lauf, JETZT), false);
    lauf = alsGesendet(lauf, lauf.posten[0]!.kennung, JETZT);
    lauf = alsEndgueltig(lauf, lauf.posten[1]!.kennung, 'hart', '550 unbekannt');
    lauf = alsEndgueltig(lauf, lauf.posten[2]!.kennung, 'beschwerde', 'FBL');
    const f = fortschritt(lauf);
    strictEqual(f.gesendet, 1);
    strictEqual(f.hart, 1);
    strictEqual(f.beschwerden, 1);
    strictEqual(f.anteil, 1);
    ok(durch(lauf, JETZT));
  });

  it('hält die Beschwerdequote erst ab genug Zustellungen für aussagekräftig', () => {
    let klein = gestartet(100, 100_000);
    for (const p of klein.posten.slice(0, 99)) klein = alsGesendet(klein, p.kennung, JETZT);
    klein = alsEndgueltig(klein, klein.posten[99]!.kennung, 'beschwerde', 'FBL');
    // 1 % — aber bei 99 Zustellungen ist das Rauschen und kein Befund.
    ok(beschwerdequote(klein) > 0.009);
    strictEqual(quotenbefund(klein), null);
  });

  it('warnt ab erhöhter und hält ab hoher Beschwerdequote an', () => {
    const viele = Array.from({ length: 1000 }, (_, i) => ({ kennung: `ep_${i}`, variante: 'a' }));
    const angelegt = starten(legeLaufAn('vl_2', ORG, 'nl_1', viele, 100_000), JETZT);
    ok(angelegt.ok);
    let lauf = angelegt.lauf;
    for (const p of lauf.posten) lauf = alsGesendet(lauf, p.kennung, JETZT);
    for (const p of lauf.posten.slice(0, 4)) lauf = alsEndgueltig(lauf, p.kennung, 'beschwerde', 'FBL');
    strictEqual(quotenbefund(lauf)?.schwere, 'fehler');
  });
});

describe('Zustellbarkeit', () => {
  it('baut die Kopfzeilen mit Ein-Klick-Abmeldung', () => {
    const k = kopfzeilen(
      { name: 'Haus', adresse: 'post@haus.de', domain: 'haus.de' },
      'news.haus.de',
      'Newsletter',
      { einKlick: 'https://haus.de/ab/xyz', perMail: 'mailto:ab@haus.de?subject=xyz' },
      'abc123',
    );
    strictEqual(k['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
    ok(k['List-Unsubscribe']!.includes('https://haus.de/ab/xyz'));
    ok(k['List-Unsubscribe']!.includes('mailto:'));
    strictEqual(k['Auto-Submitted'], 'auto-generated');
    strictEqual(k['Message-ID'], '<abc123@haus.de>');
  });

  it('nimmt eine vollständige Einrichtung an', () => {
    const b = pruefeEinrichtung(
      {
        spf: 'v=spf1 include:_spf.haus.de -all',
        dkim: `v=DKIM1; k=rsa; p=${'M'.repeat(392)}`,
        dmarc: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@haus.de',
      },
      20_000,
    );
    strictEqual(haeltAn(b), false);
  });

  it('hält „+all" für schlechter als gar kein SPF', () => {
    const b = pruefeEinrichtung({ spf: 'v=spf1 +all', dkim: `v=DKIM1; p=${'M'.repeat(392)}`, dmarc: 'v=DMARC1; p=none; rua=mailto:a@b.de' }, 100);
    ok(b.some((x) => x.kennung === 'dns.spf.offen' && x.schwere === 'fehler'));
  });

  it('erkennt einen zurückgezogenen DKIM-Schlüssel', () => {
    const b = pruefeEinrichtung({ spf: 'v=spf1 -all', dkim: 'v=DKIM1; k=rsa; p=', dmarc: 'v=DMARC1; p=none; rua=mailto:a@b.de' }, 100);
    ok(b.some((x) => x.kennung === 'dns.dkim.leer' && x.schwere === 'fehler'));
  });

  /* Ab 5 000 am Tag ist fehlendes DMARC ein Fehler, darunter eine Warnung. */
  it('gewichtet fehlendes DMARC nach der Menge', () => {
    const klein = pruefeEinrichtung({ spf: 'v=spf1 -all', dkim: `v=DKIM1; p=${'M'.repeat(392)}`, dmarc: null }, 100);
    strictEqual(klein.find((x) => x.kennung === 'dns.dmarc.fehlt')?.schwere, 'warnung');
    const gross = pruefeEinrichtung({ spf: 'v=spf1 -all', dkim: `v=DKIM1; p=${'M'.repeat(392)}`, dmarc: null }, 40_000);
    strictEqual(gross.find((x) => x.kennung === 'dns.dmarc.fehlt')?.schwere, 'fehler');
  });

  it('nennt „p=none" beim Namen, ohne anzuhalten', () => {
    const b = pruefeEinrichtung(
      { spf: 'v=spf1 -all', dkim: `v=DKIM1; p=${'M'.repeat(392)}`, dmarc: 'v=DMARC1; p=none; rua=mailto:a@b.de' },
      100,
    );
    strictEqual(haeltAn(b), false);
    ok(b.some((x) => x.kennung === 'dns.dmarc.none' && x.schwere === 'hinweis'));
  });

  it('steigert den Aufwärmplan bis zur Zielmenge', () => {
    const plan = aufwaermplan(40_000);
    strictEqual(plan[0]!.hoechstmenge, 50);
    strictEqual(plan.at(-1)!.hoechstmenge, 40_000);
    for (let i = 1; i < plan.length; i++) ok(plan[i]!.hoechstmenge >= plan[i - 1]!.hoechstmenge);
    strictEqual(mengeAmTag(plan, 1), 50);
    strictEqual(mengeAmTag(plan, 999), 40_000);
  });
});

describe('Strecken', () => {
  const willkommen: Strecke = {
    kennung: 'st_1',
    organisation: ORG,
    name: 'Willkommen',
    ausloeser: { art: 'bestaetigt' },
    erster: 's1',
    aktiv: true,
    schritte: [
      { art: 'senden', kennung: 's1', newsletter: 'nl_willkommen', weiter: 's2' },
      { art: 'warten', kennung: 's2', dauerMs: 3 * 86_400_000, weiter: 's3' },
      {
        art: 'bedingung',
        kennung: 's3',
        regelwerk: { verknuepfung: 'und', teile: [{ feld: 'geoeffnet', vergleich: 'groesser', wert: 0 }] },
        dann: 's4',
        sonst: 's5',
      },
      { art: 'senden', kennung: 's4', newsletter: 'nl_vertiefung', weiter: 's6' },
      { art: 'senden', kennung: 's5', newsletter: 'nl_erinnerung', weiter: 's6' },
      { art: 'ende', kennung: 's6' },
    ],
  };

  it('läuft die Folge ab', () => {
    let lauf = starteLauf('sl_1', willkommen, 'ep_1', JETZT);
    const eins = naechsterSchritt(willkommen, lauf, empf(), LEERE_KENNZAHLEN, JETZT);
    strictEqual(eins.art, 'senden');
    if (eins.art === 'senden') {
      strictEqual(eins.newsletter, 'nl_willkommen');
      lauf = eins.lauf;
    }
    const zwei = naechsterSchritt(willkommen, lauf, empf(), LEERE_KENNZAHLEN, JETZT);
    strictEqual(zwei.art, 'warten');
    if (zwei.art === 'warten') {
      strictEqual(zwei.bis, JETZT + 3 * 86_400_000);
      lauf = zwei.lauf;
    }
    // Vor der Zeit passiert nichts.
    strictEqual(naechsterSchritt(willkommen, lauf, empf(), LEERE_KENNZAHLEN, JETZT + 86_400_000).art, 'warten');
  });

  it('verzweigt an der Bedingung, ohne einen Tag zu verlieren', () => {
    const spaeter = JETZT + 4 * 86_400_000;
    const lauf = { ...starteLauf('sl_1', willkommen, 'ep_1', JETZT), beiSchritt: 's3', faelligAm: spaeter };
    const geoeffnet = naechsterSchritt(willkommen, lauf, empf(), { gesendet: 1, geoeffnet: 1, geklickt: 0, letzteRegung: spaeter }, spaeter);
    strictEqual(geoeffnet.art, 'senden');
    if (geoeffnet.art === 'senden') strictEqual(geoeffnet.newsletter, 'nl_vertiefung');

    const nicht = naechsterSchritt(willkommen, lauf, empf(), LEERE_KENNZAHLEN, spaeter);
    strictEqual(nicht.art, 'senden');
    if (nicht.art === 'senden') strictEqual(nicht.newsletter, 'nl_erinnerung');
  });

  /* Die Regel, ohne die so etwas gefährlich ist. */
  it('bricht bei einer Abmeldung sofort ab — auch mitten im Warten', () => {
    const wartend = { ...starteLauf('sl_1', willkommen, 'ep_1', JETZT), beiSchritt: 's2', faelligAm: JETZT + 3 * 86_400_000 };
    const a = naechsterSchritt(willkommen, wartend, abmelden(empf(), JETZT), LEERE_KENNZAHLEN, JETZT);
    strictEqual(a.art, 'abgebrochen');
    if (a.art === 'abgebrochen') strictEqual(a.lauf.zustand, 'abgebrochen');
  });

  it('bricht ab, wenn die Strecke stillgelegt wird', () => {
    const lauf = starteLauf('sl_1', willkommen, 'ep_1', JETZT);
    strictEqual(naechsterSchritt({ ...willkommen, aktiv: false }, lauf, empf(), LEERE_KENNZAHLEN, JETZT).art, 'abgebrochen');
  });

  it('erreicht das Ende', () => {
    const lauf = { ...starteLauf('sl_1', willkommen, 'ep_1', JETZT), beiSchritt: 's6' };
    const e = naechsterSchritt(willkommen, lauf, empf(), LEERE_KENNZAHLEN, JETZT);
    strictEqual(e.art, 'fertig');
  });

  it('lässt eine saubere Strecke durch', () => {
    strictEqual(haeltAn(pruefeStrecke(willkommen)), false);
  });

  /* Zwei Bedingungen, die aufeinander zeigen: die einzige Art, auf die eine
     Strecke Schaden anrichtet, ohne dass jemand einen Fehler macht. */
  it('hält einen Kreis ohne Warteschritt an', () => {
    const kreis: Strecke = {
      ...willkommen,
      erster: 'a',
      schritte: [
        { art: 'senden', kennung: 'a', newsletter: 'nl_1', weiter: 'b' },
        { art: 'senden', kennung: 'b', newsletter: 'nl_2', weiter: 'a' },
      ],
    };
    const b = pruefeStrecke(kreis);
    ok(b.some((x) => x.kennung === 'strecke.kreis.ohne.warten' && x.schwere === 'fehler'));
  });

  it('lässt einen Kreis mit Warteschritt zu', () => {
    const kreis: Strecke = {
      ...willkommen,
      erster: 'a',
      schritte: [
        { art: 'senden', kennung: 'a', newsletter: 'nl_1', weiter: 'w' },
        { art: 'warten', kennung: 'w', dauerMs: 30 * 86_400_000, weiter: 'a' },
      ],
    };
    strictEqual(haeltAn(pruefeStrecke(kreis)), false);
  });

  it('meldet ein Ziel, das es nicht gibt', () => {
    const kaputt: Strecke = {
      ...willkommen,
      erster: 'a',
      schritte: [{ art: 'senden', kennung: 'a', newsletter: 'nl_1', weiter: 'gibtsnicht' }],
    };
    ok(pruefeStrecke(kaputt).some((x) => x.kennung === 'strecke.ziel.fehlt'));
  });

  it('meldet einen Schritt, den nichts anspringt', () => {
    const einsam: Strecke = {
      ...willkommen,
      erster: 'a',
      schritte: [
        { art: 'ende', kennung: 'a' },
        { art: 'senden', kennung: 'verwaist', newsletter: 'nl_1', weiter: 'a' },
      ],
    };
    ok(pruefeStrecke(einsam).some((x) => x.kennung === 'strecke.unerreichbar'));
  });

  it('löst nur beim passenden Ereignis aus', () => {
    ok(loestAus(willkommen, empf(), { art: 'bestaetigt' }));
    ok(!loestAus(willkommen, empf(), { art: 'in_verteiler', verteiler: 'vt_news' }));
    ok(!loestAus({ ...willkommen, aktiv: false }, empf(), { art: 'bestaetigt' }));
    ok(!loestAus(willkommen, empf({ organisation: 'org_b' }), { art: 'bestaetigt' }));
  });
});
