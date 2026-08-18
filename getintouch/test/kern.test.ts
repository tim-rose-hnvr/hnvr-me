/**
 * Die übrigen Regeln, die nicht schiefgehen dürfen:
 * Adressen (Sicherheit), vCard (Norm), Kontrast (Lesbarkeit), Profil (Prüfung).
 */

import { deepStrictEqual, match, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { adresseFuer, adresseFuerNetzwerk, istSichereAdresse, normalisiereNummer, zuWhatsappNummer } from '../src/kern/ziele.ts';
import { baueVcard, vcardDateiname } from '../src/kern/vcard.ts';
import { alsDatenadresse } from '../src/kern/bild.ts';
import { herkunft } from '../src/kern/ausgabe.ts';
import { MARKENFARBEN } from '../src/kern/marke.ts';
import {
  abweichung,
  AUFBAUTEN,
  FLIESSTEXTSCHRIFTEN,
  GESTALTUNG_VORGABE,
  hintergrund,
  kontrast,
  lieseGestaltung,
  pruefeLesbarkeit,
  SCHRIFTEN,
  vorlage,
  vorlagenart,
  vorlagenfaecher,
  vorlagenName,
  VORLAGEN,
} from '../src/kern/gestaltung.ts';
import { darstellungFuer, hauptaktionFuer, lieseProfil, pruefeSlug } from '../src/kern/profil.ts';
import type { Aktionsblock, Visitenkarte } from '../src/kern/profil.ts';

describe('Adressen', () => {
  it('macht aus einer Nummer eine wählbare Adresse', () => {
    strictEqual(adresseFuer('telefon', '+49 511 12282286'), 'tel:+4951112282286');
    strictEqual(adresseFuer('telefon', '(0511) 122 822-86'), 'tel:051112282286');
  });

  it('entfernt Leerzeichen und Klammern, behält nur ein führendes Plus', () => {
    strictEqual(normalisiereNummer('+49 (0) 511 / 122 822-86'), '+49051112282286');
    strictEqual(normalisiereNummer('0176+49'), '017649');
  });

  it('rechnet deutsche Schreibweisen für WhatsApp um', () => {
    strictEqual(zuWhatsappNummer('0176 83025781'), '4917683025781');
    strictEqual(zuWhatsappNummer('+49 176 83025781'), '4917683025781');
    strictEqual(zuWhatsappNummer('0049 176 83025781'), '4917683025781');
    strictEqual(adresseFuer('whatsapp', '0176 83025781'), 'https://wa.me/4917683025781');
  });

  it('ergänzt fehlende Schemata, lässt die Schreibweise aber sonst in Ruhe', () => {
    strictEqual(adresseFuer('link', 'hnvr.me'), 'https://hnvr.me');
    strictEqual(adresseFuer('link', 'https://hnvr.me/tools'), 'https://hnvr.me/tools');
  });

  it('lässt gefährliche Schemata nicht durch', () => {
    // Der klassische Weg, wie aus einem gepflegten Feld eine Lücke wird.
    strictEqual(istSichereAdresse('javascript:alert(1)'), false);
    strictEqual(istSichereAdresse('data:text/html,<script>'), false);
    strictEqual(adresseFuer('link', 'javascript:alert(1)'), null);
    strictEqual(adresseFuer('link', 'data:text/html;base64,PHNjcmlwdD4='), null);
    strictEqual(adresseFuerNetzwerk('website', 'javascript:alert(1)'), null);
  });

  it('weist unbrauchbare Werte ab, statt tote Schaltflächen zu bauen', () => {
    strictEqual(adresseFuer('telefon', '123'), null);
    strictEqual(adresseFuer('mail', 'kein-postfach'), null);
    strictEqual(adresseFuer('link', ''), null);
    strictEqual(adresseFuer('mail', 'tim@hnvr.me'), 'mailto:tim@hnvr.me');
  });

  it('ergänzt Nutzernamen zur vollen Netzwerkadresse', () => {
    strictEqual(adresseFuerNetzwerk('instagram', 'hnvr.me'), 'https://instagram.com/hnvr.me');
    strictEqual(adresseFuerNetzwerk('instagram', '@hnvr.me'), 'https://instagram.com/hnvr.me');
    strictEqual(
      adresseFuerNetzwerk('linkedin', 'https://linkedin.com/company/hnvr'),
      'https://linkedin.com/company/hnvr',
    );
  });
});

describe('vCard', () => {
  const karte: Visitenkarte = {
    vorname: 'Tim',
    nachname: 'Rose',
    firma: 'hnvr.me · viel Liebe Media UG',
    funktion: 'Inhaber',
    telefon: '+49 511 12282286',
    mobil: '0176 83025781',
    mail: 'tim@hnvr.me',
    strasse: 'Am Bahnhof 8',
    plz: '30926',
    ort: 'Seelze',
    land: 'Deutschland',
  };

  it('benutzt CRLF — mit reinem LF zeigt Outlook eine leere Karte', () => {
    const vcard = baueVcard(karte);
    ok(vcard.startsWith('BEGIN:VCARD\r\nVERSION:3.0\r\n'));
    ok(vcard.endsWith('END:VCARD\r\n'));
    strictEqual(/(?<!\r)\n/.test(vcard), false, 'kein nacktes LF in der Ausgabe');
  });

  it('maskiert Komma und Semikolon, statt Felder zu zerlegen', () => {
    const vcard = baueVcard({ vorname: 'Anna', nachname: 'Meier', firma: 'Meier, Schulze & Co.; GmbH' });
    ok(vcard.includes('ORG:Meier\\, Schulze & Co.\\; GmbH'));
  });

  it('maskiert Backslashes und Zeilenumbrüche in Notizen', () => {
    const vcard = baueVcard({ vorname: 'A', nachname: 'B', notiz: 'Zeile 1\nZeile 2\\Ende' });
    ok(vcard.includes('NOTE:Zeile 1\\nZeile 2\\\\Ende'));
  });

  it('schreibt N und ADR in der vorgeschriebenen Reihenfolge', () => {
    const vcard = baueVcard(karte);
    ok(vcard.includes('N:Rose;Tim;;;'));
    // Postfach;Zusatz;Straße;Ort;Region;PLZ;Land
    ok(vcard.includes('ADR;TYPE=WORK:;;Am Bahnhof 8;Seelze;;30926;Deutschland'));
  });

  it('normalisiert Telefonnummern für das Adressbuch', () => {
    const vcard = baueVcard(karte);
    ok(vcard.includes('TEL;TYPE=WORK,VOICE:+4951112282286'));
    ok(vcard.includes('TEL;TYPE=CELL,VOICE:017683025781'));
  });

  it('faltet lange Zeilen auf 75 Oktett, ohne Umlaute zu zerschneiden', () => {
    const vcard = baueVcard({
      vorname: 'Ötzi',
      nachname: 'Müller-Lüdenscheidt',
      notiz: 'Ü'.repeat(120),
    });
    for (const zeile of vcard.split('\r\n')) {
      ok(Buffer.byteLength(zeile, 'utf8') <= 75, `Zeile zu lang: ${zeile.slice(0, 30)}…`);
    }
    // Zusammengesetzt muss der Text wieder vollständig sein.
    const entfaltet = vcard.replace(/\r\n /g, '');
    ok(entfaltet.includes('Ü'.repeat(120)));
    ok(entfaltet.includes('N:Müller-Lüdenscheidt;Ötzi;;;'));
  });

  it('bettet nur eingebettete Bilder ein, keine verlinkten', () => {
    const mitDaten = baueVcard(karte, { bild: 'data:image/png;base64,iVBORw0KGgo=' });
    ok(mitDaten.includes('PHOTO;ENCODING=b;TYPE=PNG:'));

    // Ein verlinktes Bild würde beim Öffnen der Karte nachladen und verraten,
    // wann jemand den Kontakt anschaut.
    const mitLink = baueVcard(karte, { bild: 'https://hnvr.me/bild.png' });
    strictEqual(mitLink.includes('PHOTO'), false);
  });

  it('baut einen Dateinamen, der überall ankommt', () => {
    strictEqual(vcardDateiname({ vorname: 'Ötzi', nachname: 'Müller' }), 'oetzi-mueller.vcf');
    strictEqual(vcardDateiname({ vorname: '', nachname: '', firma: 'hnvr.me · UG' }), 'hnvr-me-ug.vcf');
  });
});

describe('Kontrast', () => {
  it('rechnet nach WCAG — Schwarz auf Weiß ist 21:1', () => {
    ok(Math.abs(kontrast('#000000', '#ffffff') - 21) < 0.01);
    strictEqual(kontrast('#777777', '#777777'), 1);
  });

  it('lässt jede mitgelieferte Vorlage ohne Fehler durch', () => {
    for (const v of VORLAGEN) {
      const fehler = pruefeLesbarkeit(v).filter((b) => b.schwere === 'fehler');
      deepStrictEqual(fehler, [], `Vorlage „${v.vorlage}" ist nicht lesbar`);
    }
  });

  it('erkennt eine unlesbare freie Farbwahl', () => {
    const grau = { ...vorlage('feuer'), grund: '#7a7a7a', grund2: '', vordergrund: '#8a8a8a' };
    const befunde = pruefeLesbarkeit(grau);
    ok(befunde.some((b) => b.schwere === 'fehler'));
    match(befunde[0]!.meldung, /Fließtext/);
  });

  it('warnt vor blasser Schrift auf der Hauptschaltfläche', () => {
    const blass = { ...vorlage('feuer'), akzent: '#FFD166', akzentText: '#FFFFFF' };
    ok(pruefeLesbarkeit(blass).some((b) => /Hauptschaltfläche/.test(b.meldung)));
  });
});

describe('Adressen der Seiten', () => {
  it('nimmt brauchbare Namen an', () => {
    strictEqual(pruefeSlug('hnvr').ok, true);
    strictEqual(pruefeSlug('tim-rose').ok, true);
    strictEqual(pruefeSlug('HNVR').ok, true, 'Großschreibung wird geglättet');
  });

  it('weist ab, was am Telefon oder im Druck schiefgeht', () => {
    strictEqual(pruefeSlug('ab').ok, false, 'zu kurz');
    strictEqual(pruefeSlug('tim müller').ok, false, 'Leerzeichen und Umlaut');
    strictEqual(pruefeSlug('-tim').ok, false, 'Sonderzeichen am Anfang');
    strictEqual(pruefeSlug('tim--rose').ok, false, 'zwei Sonderzeichen hintereinander');
    strictEqual(pruefeSlug('konto').ok, false, 'reserviert');
  });
});

describe('Profil einlesen', () => {
  const gueltig = {
    slug: 'muster',
    kopf: { name: 'Muster GmbH' },
    bloecke: [
      { id: 'a', art: 'aktion', kanal: 'telefon', beschriftung: 'Anrufen', ziel: '+4951112282286' },
      { id: 'b', art: 'aktion', kanal: 'whatsapp', beschriftung: 'WhatsApp', ziel: '+4917683025781' },
    ],
    erreichbarkeit: {
      zeitzone: 'Europe/Berlin',
      fenster: [{ tag: 1, von: '09:00', bis: '17:00' }],
    },
    hauptaktion: { offen: 'a', zu: 'b' },
  };

  it('liest ein vollständiges Profil', () => {
    const ergebnis = lieseProfil(gueltig);
    ok(ergebnis.ok);
    strictEqual(ergebnis.profil.slug, 'muster');
    strictEqual(ergebnis.profil.bloecke.length, 2);
    // Bewusst gegen die Vorgabe geprüft und nicht gegen einen Namen: welche
    // Vorlage die Vorgabe ist, darf sich mit der Marke ändern, dass es eine
    // gibt, nicht.
    strictEqual(ergebnis.profil.gestaltung.vorlage, GESTALTUNG_VORGABE.vorlage, 'ohne Angabe gilt die Vorgabe');
  });

  it('sammelt alle Fehler auf einmal, statt beim ersten abzubrechen', () => {
    const ergebnis = lieseProfil({ slug: 'x', kopf: {}, bloecke: [{ id: 'a', art: 'aktion', kanal: 'faxen' }] });
    ok(!ergebnis.ok);
    ok(ergebnis.fehler.length >= 3, `nur ${ergebnis.fehler.length} Fehler gemeldet`);
    ok(ergebnis.fehler.some((f) => f.stelle === 'slug'));
    ok(ergebnis.fehler.some((f) => f.stelle === 'kopf.name'));
    ok(ergebnis.fehler.some((f) => f.stelle === 'bloecke[0].kanal'));
  });

  it('erkennt doppelte Blockkennungen', () => {
    const ergebnis = lieseProfil({
      ...gueltig,
      bloecke: [...gueltig.bloecke, { id: 'a', art: 'trenner' }],
    });
    ok(!ergebnis.ok);
    ok(ergebnis.fehler.some((f) => /doppelt/.test(f.meldung)));
  });

  it('lässt keine Hauptaktion auf einen Block zeigen, den es nicht gibt', () => {
    const ergebnis = lieseProfil({ ...gueltig, hauptaktion: { offen: 'gibtsnicht' } });
    ok(!ergebnis.ok);
    ok(ergebnis.fehler.some((f) => f.stelle === 'hauptaktion.offen'));
  });

  it('verlangt Öffnungszeiten für eine Aktion außerhalb der Zeiten', () => {
    const { erreichbarkeit, ...ohneZeiten } = gueltig;
    const ergebnis = lieseProfil(ohneZeiten);
    ok(!ergebnis.ok);
    ok(ergebnis.fehler.some((f) => f.stelle === 'hauptaktion.zu'));
  });

  it('lehnt eine unbekannte Zeitzone ab, statt still auf UTC zu rechnen', () => {
    const ergebnis = lieseProfil({
      ...gueltig,
      erreichbarkeit: { ...gueltig.erreichbarkeit, zeitzone: 'Europe/Hannover' },
    });
    ok(!ergebnis.ok);
    ok(ergebnis.fehler.some((f) => f.stelle === 'erreichbarkeit.zeitzone'));
  });
});

describe('Hauptaktion', () => {
  const profil = lieseProfil({
    slug: 'muster',
    kopf: { name: 'Muster' },
    bloecke: [
      { id: 'a', art: 'aktion', kanal: 'telefon', beschriftung: 'Anrufen', ziel: '+4951112282286' },
      { id: 'b', art: 'aktion', kanal: 'whatsapp', beschriftung: 'WhatsApp', ziel: '+4917683025781' },
    ],
    erreichbarkeit: { zeitzone: 'Europe/Berlin', fenster: [{ tag: 1, von: '09:00', bis: '17:00' }] },
    hauptaktion: { offen: 'a', zu: 'b' },
  });

  it('wechselt mit der Erreichbarkeit', () => {
    ok(profil.ok);
    strictEqual(hauptaktionFuer(profil.profil, true)?.id, 'a');
    strictEqual(hauptaktionFuer(profil.profil, false)?.id, 'b');
  });

  it('nimmt ohne Verweis den betonten, sonst den ersten Block', () => {
    const ohneVerweis = lieseProfil({
      slug: 'muster',
      kopf: { name: 'Muster' },
      bloecke: [
        { id: 'a', art: 'aktion', kanal: 'link', beschriftung: 'Website', ziel: 'https://hnvr.me' },
        { id: 'b', art: 'aktion', kanal: 'telefon', beschriftung: 'Anrufen', ziel: '+4951112282286', betont: true },
      ],
    });
    ok(ohneVerweis.ok);
    strictEqual(hauptaktionFuer(ohneVerweis.profil, true)?.id, 'b');
  });

  it('übergeht abgeschaltete Blöcke', () => {
    const abgeschaltet = lieseProfil({
      slug: 'muster',
      kopf: { name: 'Muster' },
      bloecke: [
        { id: 'a', art: 'aktion', kanal: 'link', beschriftung: 'Website', ziel: 'https://hnvr.me', aktiv: false },
        { id: 'b', art: 'aktion', kanal: 'telefon', beschriftung: 'Anrufen', ziel: '+4951112282286' },
      ],
    });
    ok(abgeschaltet.ok);
    strictEqual(hauptaktionFuer(abgeschaltet.profil, true)?.id, 'b');
  });
});

describe('Bilder für die Visitenkarte', () => {
  const basis = new URL('https://hnvr.me/t/hnvr');

  it('reicht eine fertige Datenadresse unverändert durch', async () => {
    const daten = 'data:image/png;base64,iVBORw0KGgo=';
    strictEqual(await alsDatenadresse(daten, basis), daten);
  });

  it('lässt fremde Hosts nicht zu — der Server soll nicht für andere ins Netz greifen', async () => {
    strictEqual(await alsDatenadresse('https://example.com/bild.png', basis), undefined);
    strictEqual(await alsDatenadresse('http://169.254.169.254/latest/meta-data/', basis), undefined);
    strictEqual(await alsDatenadresse('http://127.0.0.1:8080/geheim.png', basis), undefined);
    strictEqual(await alsDatenadresse('file:///etc/passwd', basis), undefined);
  });

  it('nimmt nichts, wo nichts ist', async () => {
    strictEqual(await alsDatenadresse(undefined, basis), undefined);
    strictEqual(await alsDatenadresse('nicht mal eine Adresse ::', basis), undefined);
  });
});

describe('Darstellung', () => {
  const block = (kanal: string, form?: string) => {
    const ergebnis = lieseProfil({
      slug: 'muster',
      kopf: { name: 'Muster' },
      bloecke: [{ id: 'a', art: 'aktion', kanal, beschriftung: 'X', ziel: 'https://hnvr.me', form }],
    });
    ok(ergebnis.ok, 'Profil sollte lesbar sein');
    return ergebnis.profil.bloecke[0] as Aktionsblock;
  };

  it('macht aus kurzen, dringenden Wegen Kacheln', () => {
    for (const kanal of ['telefon', 'mobil', 'whatsapp', 'mail', 'route', 'termin']) {
      strictEqual(darstellungFuer(block(kanal)), 'kachel', kanal);
    }
  });

  it('macht aus allem zum Lesen ruhige Zeilen', () => {
    for (const kanal of ['link', 'shop', 'datei', 'video']) {
      strictEqual(darstellungFuer(block(kanal)), 'zeile', kanal);
    }
  });

  it('lässt sich übersteuern', () => {
    strictEqual(darstellungFuer(block('telefon', 'zeile')), 'zeile');
    strictEqual(darstellungFuer(block('link', 'kachel')), 'kachel');
  });

  it('weist eine unbekannte Darstellung ab', () => {
    const ergebnis = lieseProfil({
      slug: 'muster',
      kopf: { name: 'Muster' },
      bloecke: [{ id: 'a', art: 'aktion', kanal: 'link', beschriftung: 'X', ziel: 'https://hnvr.me', form: 'kreis' }],
    });
    ok(!ergebnis.ok);
    ok(ergebnis.fehler.some((f) => f.stelle === 'bloecke[0].form'));
  });
});

describe('Hintergrundbild', () => {
  it('bleibt ohne Bild eine reine Farbe oder ein Verlauf', () => {
    // „Beton" hat nur eine Grundfarbe, „Feuer" zwei — der eine Fall ohne Verlauf, der andere mit.
    strictEqual(hintergrund({ ...vorlage('beton') }), '#EAE9E9');
    ok(hintergrund({ ...vorlage('feuer') }).startsWith('linear-gradient(160deg,'));
  });

  it('legt den Schleier über das Bild, nicht darunter', () => {
    const mitBild = { ...vorlage('feuer'), bild: '/bilder/halle.jpg', schleier: 0.6 };
    const wert = hintergrund(mitBild);
    // Der Belag steht zuerst — in CSS liegt die erste Schicht oben.
    ok(wert.startsWith('linear-gradient(rgba(15,15,15,0.6), rgba(15,15,15,0.6))'), wert);
    ok(wert.includes('url("/bilder/halle.jpg") center / cover no-repeat'));
    // Die Grundfarbe bleibt als letzte Schicht stehen, falls das Bild fehlt.
    ok(wert.endsWith('#0F0F0F'));
  });

  it('warnt, wenn der Schleier zu dünn für ein Foto ist', () => {
    const duenn = { ...vorlage('feuer'), bild: '/bilder/halle.jpg', schleier: 0.2 };
    const befunde = pruefeLesbarkeit(duenn);
    ok(befunde.some((b) => b.schwere === 'fehler' && /Schleier/.test(b.meldung)));

    const dicht = { ...vorlage('feuer'), bild: '/bilder/halle.jpg', schleier: 0.7 };
    deepStrictEqual(pruefeLesbarkeit(dicht), []);
  });

  it('lässt kein fremdes Schema als Hintergrundbild durch', () => {
    const gut = lieseGestaltung({ vorlage: 'feuer', bild: '/bilder/halle.jpg' });
    strictEqual(gut.gestaltung?.bild, '/bilder/halle.jpg');

    const schlecht = lieseGestaltung({ vorlage: 'feuer', bild: 'http://fremd.example/verfolger.gif' });
    ok(schlecht.fehler.length > 0);
    strictEqual(schlecht.gestaltung?.bild, '');
  });
});

describe('Schriftangebot', () => {
  it('liefert dreizehn Familien, alle bis auf System selbst ausgeliefert', () => {
    strictEqual(SCHRIFTEN.length, 13, 'Archivo ist als Hausschrift dazugekommen');
    strictEqual(SCHRIFTEN.filter((s) => !s.eigen).length, 1, 'nur „System" lädt nichts nach');
  });

  it('hält Plakatschriften aus dem Fließtext heraus', () => {
    const nurAnzeige = SCHRIFTEN.filter((s) => s.zweck === 'anzeige').map((s) => s.id);
    deepStrictEqual(nurAnzeige.sort(), ['anton', 'bebas', 'clash']);
    ok(!FLIESSTEXTSCHRIFTEN.some((s) => nurAnzeige.includes(s.id)));
  });

  it('gibt jeder Schrift eine Rückfallebene', () => {
    for (const s of SCHRIFTEN) {
      ok(s.css.includes(','), `„${s.name}" hat keinen Ersatz, wenn die Datei fehlt`);
    }
  });
});

describe('Vorlagen', () => {
  it('sind elf und haben eindeutige Kennungen', () => {
    strictEqual(VORLAGEN.length, 11, 'die Zahl steht auch auf der Verkaufsseite');
    strictEqual(new Set(VORLAGEN.map((v) => v.vorlage)).size, 11);
  });

  /* Die erste Vorlage ist die Vorgabe. Sie trägt die Farben des Produkts und
     nicht die seines Herstellers — daran hing der ganze Umbau zur eigenen
     Marke, und es soll nicht unbemerkt zurückfallen. */
  it('beginnt mit der Marke des Produkts', () => {
    strictEqual(VORLAGEN[0]!.vorlage, GESTALTUNG_VORGABE.vorlage);
    strictEqual(GESTALTUNG_VORGABE.akzent, MARKENFARBEN.akzent);
    strictEqual(GESTALTUNG_VORGABE.grund, MARKENFARBEN.grund);
  });

  /* Der eigentliche Vorwurf an die Konkurrenz — „n Designs, die alle gleich
     aufgebaut sind" — muss auch für die eigenen Vorlagen widerlegbar sein.
     Farbe und Schrift allein reichen dafür nicht. */
  it('benutzen mehr als eine Anordnung — sonst wäre es ein Layout mit elf Anstrichen', () => {
    const anordnungen = new Set(VORLAGEN.map((v) => v.aufbau));
    strictEqual(anordnungen.size, AUFBAUTEN.length, `nur ${anordnungen.size} von ${AUFBAUTEN.length} Anordnungen`);
    for (const a of AUFBAUTEN) {
      ok(
        VORLAGEN.filter((v) => v.aufbau === a.kennung).length >= 2,
        `„${a.name}" kommt in weniger als zwei Vorlagen vor`,
      );
    }
  });

  it('benutzen mehr als eine Schriftmischung — sonst wäre es ein Design mit zwölf Anstrichen', () => {
    const paare = new Set(VORLAGEN.map((v) => `${v.anzeige}/${v.schrift}`));
    ok(paare.size >= 9, `nur ${paare.size} verschiedene Schriftpaare`);
  });

  it('haben für jede Kennung einen Anzeigenamen', () => {
    for (const v of VORLAGEN) {
      ok(vorlagenName(v.vorlage) !== v.vorlage, `„${v.vorlage}" ohne Namen`);
    }
  });

  /* `vorlagenart` fällt bei einer unbekannten Kennung auf „Marke" zurück, damit
     die Galerie nicht wegen einer fehlenden Zeile abstürzt. Genau dieser
     Rückfall verschluckt aber auch das Versehen: eine neue Vorlage ohne
     Zuordnung landete stillschweigend im falschen Fach. Deshalb hier geprüft. */
  it('haben Fach und Charakter — und nicht nur den Rückfall', () => {
    for (const v of VORLAGEN) {
      const art = vorlagenart(v.vorlage);
      ok(art.charakter !== '', `„${v.vorlage}" ohne Charakter`);
      ok(vorlagenfaecher().includes(art.fach), `„${v.vorlage}" mit unbekanntem Fach`);
    }
  });

  it('verteilen sich auf mehrere Fächer — sonst wäre die Filterleiste Zierde', () => {
    ok(vorlagenfaecher().length >= 5, `nur ${vorlagenfaecher().length} Fächer`);
  });
});

describe('Abweichung von der Vorlage', () => {
  it('behält nur, was wirklich anders ist', () => {
    const unveraendert = abweichung(vorlage('nachtschicht'));
    deepStrictEqual(unveraendert, { vorlage: 'nachtschicht' }, 'ohne Änderung bleibt nur die Kennung');

    const eigen = abweichung({ ...vorlage('nachtschicht'), akzent: '#FF7120', radius: 30 });
    deepStrictEqual(eigen, { vorlage: 'nachtschicht', akzent: '#FF7120', radius: 30 });
  });

  it('ist umkehrbar — was herauskommt, ergibt wieder dasselbe Design', () => {
    const eigen = { ...vorlage('papier'), akzent: '#123456', schrift: 'mono', bild: '/bilder/x.jpg', schleier: 0.8 };
    const zurueck = lieseGestaltung(abweichung(eigen)).gestaltung;
    deepStrictEqual(zurueck, eigen);
  });

  it('lässt spätere Korrekturen an einer Vorlage durchschlagen', () => {
    // Wer nichts Eigenes eingestellt hat, erbt die Korrektur — genau dafür
    // wird der Unterschied gespeichert und nicht der volle Satz Werte.
    const gespeichert = abweichung(vorlage('creme'));
    strictEqual('akzentText' in gespeichert, false);
    strictEqual(lieseGestaltung(gespeichert).gestaltung?.akzentText, vorlage('creme').akzentText);
  });
});

describe('Herkunft des Aufrufs', () => {
  it('nimmt Name und Port aus dem Host-Kopf', () => {
    // Der gebaute Node-Server liefert in `Astro.url` „http://localhost/" ohne
    // Port. Ein relativer Bildpfad landete daraufhin auf Port 80, und das Foto
    // fehlte stillschweigend in jeder Visitenkarte.
    const ersatz = new URL('http://localhost/t/hnvr/karte.vcf');
    const anfrage = new Request('http://localhost/t/hnvr/karte.vcf', { headers: { host: '127.0.0.1:4321' } });
    strictEqual(herkunft(anfrage, ersatz).origin, 'http://127.0.0.1:4321');
    strictEqual(herkunft(anfrage, ersatz).pathname, '/t/hnvr/karte.vcf');
  });

  it('behält das Schema des Aufrufs', () => {
    const ersatz = new URL('https://localhost/t/hnvr/qr.svg');
    const anfrage = new Request('https://hnvr.me/t/hnvr/qr.svg', { headers: { host: 'hnvr.me' } });
    strictEqual(herkunft(anfrage, ersatz).origin, 'https://hnvr.me');
  });

  it('fällt ohne Host-Kopf auf die übergebene Adresse zurück', () => {
    const ersatz = new URL('http://beispiel.test/x');
    const anfrage = new Request('http://beispiel.test/x');
    // Fetch setzt den Host-Kopf selbst; hier zählt nur, dass nichts kaputtgeht.
    ok(herkunft(anfrage, ersatz).href.startsWith('http://'));
  });
});
