/**
 * Ein Bestand zum Ansehen.
 *
 * Die Oberflächen brauchen Daten, und es gibt noch keine Datenbank. Statt in
 * jede Seite ein paar erfundene Zeilen zu schreiben, steht hier **ein**
 * Bestand, durch den alle Seiten dieselben Kernfunktionen laufen lassen wie
 * später der Betrieb. Was auf den Seiten steht, ist damit gerechnet und nicht
 * gemalt — eine Zahl, die dort falsch ist, ist im Kern falsch.
 *
 * Alles hängt an `jetzt`. So liegt der Plan immer um den heutigen Tag herum,
 * ohne dass jemand Datumsangaben nachpflegen müsste.
 *
 * **Das ist Anschauungsmaterial und kein Anfangsbestand.** Wenn die Speicher
 * stehen, wird diese Datei zu einem Prüfhilfsmittel und verlässt die
 * Oberflächen.
 */

import type { Beitrag } from './beitrag.ts';
import type { Kanal } from './kanal.ts';
import type { Empfaenger } from './empfaenger.ts';
import type { Freigabelauf } from './freigabe.ts';
import { standAus } from './freigabe.ts';
import type { Newsletter } from './newsletter.ts';
import { GRUNDREGELN, type Planregeln } from './plan.ts';
import type { Vorgang } from './posteingang.ts';
import type { Sitzung } from './rollen.ts';
import type { Segment, Verteiler, Kennzahlen } from './verteiler.ts';
import type { Strecke } from './strecke.ts';
import type { Beitragszahlen, Mailzahlen, Zaehleinstellung } from './auswertung.ts';
import { ausOertlich, oertlich, tagePlus, tagesbeginn, wochenbeginn, ZONE } from './zeit.ts';

export const ORGANISATION = 'org_haus';

/** Wer gerade am Bildschirm sitzt. Später kommt das aus der Anmeldung. */
export const SITZUNG: Sitzung = { person: 'Anna Rehberg', rolle: 'leitung', organisation: ORGANISATION };

export const MITGLIEDER = [
  { person: 'Anna Rehberg', rolle: 'leitung' as const },
  { person: 'Bert Kollmann', rolle: 'freigeber' as const },
  { person: 'Carla Nowak', rolle: 'redakteur' as const },
  { person: 'Dora Feld', rolle: 'verwaltung' as const },
];

/** Ein Zeitpunkt am Tag `versatz` relativ zu heute, zur Stunde `stunde`. */
function amTag(jetzt: number, versatz: number, stunde: number, minute = 0): number {
  const tag = tagePlus(tagesbeginn(jetzt, ZONE), versatz, ZONE);
  const o = oertlich(tag, ZONE);
  return ausOertlich({ ...o, stunde, minute, sekunde: 0 }, ZONE).zeitpunkt;
}

/**
 * Ein Zeitpunkt an einem **Wochentag der laufenden Woche**.
 *
 * Termine relativ zu heute zu setzen, sieht am Mittwoch gut aus und am Samstag
 * leer: „heute plus zwei" liegt dann schon in der nachsten Woche. Der Plan
 * zeigt eine Woche, also gehoert der Bestand in eine Woche.
 *
 * `tag` ist 0 fuer Montag bis 6 fuer Sonntag.
 */
function inDerWoche(jetzt: number, tag: number, stunde: number, minute = 0): number {
  const o = oertlich(tagePlus(wochenbeginn(jetzt, ZONE), tag, ZONE), ZONE);
  return ausOertlich({ ...o, stunde, minute, sekunde: 0 }, ZONE).zeitpunkt;
}

/**
 * Ein Termin, der auf jeden Fall noch bevorsteht.
 *
 * Der Wunschtermin der laufenden Woche, sofern er noch nicht vorbei ist —
 * sonst derselbe Tageszeitpunkt morgen. Ohne das steht am Samstag ein
 * eingereichter Beitrag mit einem Termin vom Donnerstag da, und der Plan
 * meldet vollkommen zu Recht einen Fehler, den nur der Bestand verursacht hat.
 */
function kuenftig(jetzt: number, wunsch: number, stunde: number, minute = 0): number {
  if (wunsch > jetzt) return wunsch;
  const o = oertlich(tagePlus(tagesbeginn(jetzt, ZONE), 1, ZONE), ZONE);
  return ausOertlich({ ...o, stunde, minute, sekunde: 0 }, ZONE).zeitpunkt;
}

/**
 * Der Zustand eines Beitrags, abgeleitet aus seinem Termin.
 *
 * Damit der Bestand an jedem Wochentag stimmig aussieht: was hinter uns liegt,
 * ist veroeffentlicht, was vor uns liegt, ist geplant.
 */
function zustandNachTermin(termin: number, jetzt: number): 'veroeffentlicht' | 'geplant' {
  return termin < jetzt ? 'veroeffentlicht' : 'geplant';
}

export function kanaele(jetzt: number): Kanal[] {
  return [
    { kennung: 'kn_mastodon', organisation: ORGANISATION, art: 'mastodon', anzeigename: 'Haus auf Mastodon', aktiv: true, grenzeUeberschrieben: 1000 },
    { kennung: 'kn_bluesky', organisation: ORGANISATION, art: 'bluesky', anzeigename: 'Haus auf Bluesky', aktiv: true },
    { kennung: 'kn_linkedin', organisation: ORGANISATION, art: 'linkedin', anzeigename: 'Haus auf LinkedIn', aktiv: true },
    // Der Zugang, der bald abläuft — damit die Warnung im Plan zu sehen ist.
    { kennung: 'kn_instagram', organisation: ORGANISATION, art: 'instagram', anzeigename: 'Haus auf Instagram', aktiv: true, tokenLaeuftAb: jetzt + 9 * 86_400_000 },
    { kennung: 'kn_mail', organisation: ORGANISATION, art: 'mail', anzeigename: 'Newsletter', aktiv: true },
  ];
}

export function planregeln(): Planregeln {
  return { organisation: ORGANISATION, ...GRUNDREGELN };
}

export function beitraege(jetzt: number): Beitrag[] {
  /* Die Termine liegen auf Wochentagen der laufenden Woche, nicht relativ zu
     heute: sonst steht der Plan am Samstag leer, weil „heute plus zwei" schon
     in der nächsten Woche liegt. */
  const dienstag = inDerWoche(jetzt, 1, 10, 15);
  const mittwoch = inDerWoche(jetzt, 2, 9, 30);
  const donnerstag = kuenftig(jetzt, inDerWoche(jetzt, 3, 11, 0), 11, 0);
  const freitag = inDerWoche(jetzt, 4, 16, 45);

  return [
    {
      kennung: 'bt_1',
      organisation: ORGANISATION,
      titel: 'Werkstattbericht ist da',
      zustand: zustandNachTermin(dienstag, jetzt),
      geplantFuer: dienstag,
      verfasser: 'Carla Nowak',
      angelegtAm: amTag(jetzt, -8, 9),
      geaendertAm: amTag(jetzt, -5, 16),
      fassungen: [
        {
          kanal: 'kn_mastodon',
          art: 'mastodon',
          text: 'Drei Wochen Umbau, zwei Wochen Probe, ein Abend, an dem alles zusammenkommt. Wir haben aufgeschrieben, was dabei schiefging — und was daraus geworden ist.\n\nhttps://haus.de/werkstattbericht',
          medien: [{ art: 'bild', datei: '/bilder/werkstatt.jpg', alt: 'Ein leerer Saal von der Bühne aus, im Vordergrund ein Kabelbaum.' }],
        },
        {
          kanal: 'kn_linkedin',
          art: 'linkedin',
          text: 'Drei Wochen Umbau, zwei Wochen Probe, ein Abend.\n\nWir haben aufgeschrieben, was dabei schiefging — der Anschluss, der nicht passte, die Probe, die ausfiel, und die Entscheidung, die wir zweimal getroffen haben.\n\nDer ganze Bericht: https://haus.de/werkstattbericht',
          medien: [{ art: 'bild', datei: '/bilder/werkstatt.jpg', alt: 'Ein leerer Saal von der Bühne aus, im Vordergrund ein Kabelbaum.' }],
        },
      ],
    },
    {
      kennung: 'bt_2',
      organisation: ORGANISATION,
      titel: 'Karten für den Herbst',
      zustand: zustandNachTermin(mittwoch, jetzt),
      geplantFuer: mittwoch,
      verfasser: 'Carla Nowak',
      angelegtAm: amTag(jetzt, -4, 11),
      geaendertAm: amTag(jetzt, -2, 14),
      fassungen: [
        { kanal: 'kn_bluesky', art: 'bluesky', text: 'Ab Montag gibt es Karten für den Herbst. Vier Abende, jeder anders.\n\nhttps://haus.de/herbst', medien: [] },
        {
          kanal: 'kn_instagram',
          art: 'instagram',
          text: 'Ab Montag: Karten für den Herbst. Vier Abende, jeder anders. Link im Profil.',
          ersterKommentar: '#herbst #karten #haus #buehne',
          medien: [{ art: 'bild', datei: '/bilder/herbst.jpg', alt: 'Vier Plakate nebeneinander an einer Backsteinwand.' }],
        },
      ],
    },
    {
      kennung: 'bt_3',
      organisation: ORGANISATION,
      titel: 'Nachtrag zum Umbau',
      zustand: 'eingereicht',
      geplantFuer: donnerstag,
      verfasser: 'Carla Nowak',
      angelegtAm: amTag(jetzt, -1, 8, 20),
      geaendertAm: amTag(jetzt, -1, 8, 45),
      fassungen: [
        {
          kanal: 'kn_mastodon',
          art: 'mastodon',
          text: 'Der Boden ist drin. Was jetzt noch fehlt, ist die Beschriftung — und die kommt von Hand.',
          medien: [{ art: 'bild', datei: '/bilder/boden.jpg', alt: 'Frisch verlegter Hallenboden, an einer Stelle noch offen.' }],
        },
      ],
    },
    {
      /* Zwei Beiträge am selben Nachmittag auf demselben Kanal — damit die
         Abstandsregel im Plan sichtbar wird und nicht nur im Test. */
      kennung: 'bt_5',
      organisation: ORGANISATION,
      titel: 'Hinweis auf die Führung',
      zustand: zustandNachTermin(freitag, jetzt),
      geplantFuer: freitag,
      verfasser: 'Carla Nowak',
      angelegtAm: amTag(jetzt, -3, 12),
      geaendertAm: amTag(jetzt, -3, 12),
      fassungen: [
        { kanal: 'kn_mastodon', art: 'mastodon', text: 'Am Sonntag um 15 Uhr führen wir durch das Haus. Ohne Anmeldung, Treffpunkt am Vorplatz.', medien: [] },
      ],
    },
    {
      kennung: 'bt_6',
      organisation: ORGANISATION,
      titel: 'Nachklapp Führung',
      zustand: zustandNachTermin(freitag + 12 * 60_000, jetzt),
      geplantFuer: freitag + 12 * 60_000,
      verfasser: 'Anna Rehberg',
      angelegtAm: amTag(jetzt, -3, 12, 30),
      geaendertAm: amTag(jetzt, -3, 12, 30),
      fassungen: [
        { kanal: 'kn_mastodon', art: 'mastodon', text: 'Und wer am Sonntag nicht kann: im Oktober führen wir noch einmal.', medien: [] },
      ],
    },
    {
      /* Der Beitrag mit Befunden — damit die Werkstatt etwas zu zeigen hat. */
      kennung: 'bt_4',
      organisation: ORGANISATION,
      titel: 'Ankündigung Frühjahr (in Arbeit)',
      zustand: 'entwurf',
      geplantFuer: null,
      verfasser: 'Anna Rehberg',
      angelegtAm: amTag(jetzt, 0, 9, 10),
      geaendertAm: amTag(jetzt, 0, 9, 55),
      fassungen: [
        {
          kanal: 'kn_bluesky',
          art: 'bluesky',
          // Absichtlich zu lang für Bluesky (300) und knapp für Mastodon.
          text: 'Im Frühjahr wird es hier voll: vier Abende, zwei Werkstätten, eine lange Nacht, an der alle Räume offen sind, auch die, in die sonst niemand kommt. Wir fangen im März an und hören im Juni auf, dazwischen liegen elf Wochen, in denen fast jeden Abend etwas ist. Das ganze Programm steht ab kommendem Montag auf der Seite, und wer den Newsletter bekommt, hat es schon am Freitag.',
          medien: [],
        },
        {
          kanal: 'kn_instagram',
          art: 'instagram',
          // Ohne Medium und mit einem Link, der dort nicht wirkt.
          text: 'Frühjahrsprogramm ab Montag: https://haus.de/fruehjahr',
          medien: [],
        },
      ],
    },
  ];
}

export function freigabelaeufe(jetzt: number): Freigabelauf[] {
  const bt3 = beitraege(jetzt).find((b) => b.kennung === 'bt_3')!;
  return [
    {
      kennung: 'fg_1',
      organisation: ORGANISATION,
      art: 'beitrag',
      gegenstand: 'bt_3',
      verfasser: 'Carla Nowak',
      stand: standAus(bt3.fassungen.map((f) => f.text)),
      noetig: 1,
      zustimmungen: [],
      frist: amTag(jetzt, 0, 17, 0),
      eingereichtAm: amTag(jetzt, 0, 8, 45),
    },
    {
      kennung: 'fg_2',
      organisation: ORGANISATION,
      art: 'newsletter',
      gegenstand: 'nl_1',
      verfasser: 'Carla Nowak',
      stand: 'nl1stand',
      noetig: 2,
      zustimmungen: [{ person: 'Bert Kollmann', zeitpunkt: amTag(jetzt, -1, 15, 20), anmerkung: 'Zahlen im zweiten Absatz geprüft.' }],
      // Frist gerissen — damit die Übersicht das zeigt.
      frist: amTag(jetzt, -1, 18, 0),
      eingereichtAm: amTag(jetzt, -2, 10, 0),
    },
  ];
}

export function vorgaenge(jetzt: number): Vorgang[] {
  return [
    {
      kennung: 'vg_1',
      organisation: ORGANISATION,
      kanal: 'kn_mail',
      kanalart: 'mail',
      art: 'mailantwort',
      bezug: 'nl_0',
      von: 'h.brand@example.org',
      text: 'Ich bekomme den Newsletter jetzt zweimal, einmal an die alte und einmal an die neue Adresse. Können Sie die alte löschen?',
      eingegangenAm: amTag(jetzt, -1, 16, 40),
      zustand: 'neu',
      notizen: [],
      fristMinuten: 240,
    },
    {
      kennung: 'vg_2',
      organisation: ORGANISATION,
      kanal: 'kn_mastodon',
      kanalart: 'mastodon',
      art: 'kommentar',
      bezug: 'bt_1',
      von: '@ulrike@haus.social',
      text: 'Kommt der Bericht auch als PDF? Ich würde ihn gern weitergeben.',
      eingegangenAm: amTag(jetzt, 0, 9, 5),
      zustand: 'neu',
      notizen: [],
      fristMinuten: 240,
    },
    {
      kennung: 'vg_3',
      organisation: ORGANISATION,
      kanal: 'kn_linkedin',
      kanalart: 'linkedin',
      art: 'kommentar',
      bezug: 'bt_1',
      von: 'Jens Ovelgönne',
      text: 'Der Absatz zur Probe, die ausfiel — hattet ihr da eine Versicherung, die das trägt?',
      eingegangenAm: amTag(jetzt, -3, 11, 0),
      zustand: 'inArbeit',
      sperre: { person: 'Bert Kollmann', bis: jetzt + 12 * 60_000 },
      notizen: [{ person: 'Anna Rehberg', zeitpunkt: amTag(jetzt, -3, 12, 0), text: 'Antwort mit der Buchhaltung abstimmen, bevor da eine Zahl steht.' }],
      fristMinuten: 480,
    },
    {
      kennung: 'vg_4',
      organisation: ORGANISATION,
      kanal: 'kn_instagram',
      kanalart: 'instagram',
      art: 'kommentar',
      bezug: 'bt_1',
      von: '@marlene.k',
      text: 'Schön geworden!',
      eingegangenAm: amTag(jetzt, -1, 14, 0),
      zustand: 'beantwortet',
      antwort: { person: 'Carla Nowak', zeitpunkt: amTag(jetzt, -1, 14, 25), text: 'Danke! Kommen Sie vorbei, wenn Sie es in echt sehen wollen.' },
      notizen: [],
      fristMinuten: 480,
    },
  ];
}

export const VERTEILER: Verteiler[] = [
  {
    kennung: 'vt_news',
    organisation: ORGANISATION,
    name: 'Newsletter',
    wortlaut: 'Ich möchte den Newsletter des Hauses bekommen und kann mich jederzeit abmelden.',
    listenkennung: 'newsletter.haus.de',
    beschreibung: 'Einmal im Monat, dazu vor jeder Vorverkaufsphase.',
  },
  {
    kennung: 'vt_termine',
    organisation: ORGANISATION,
    name: 'Nur Termine',
    wortlaut: 'Ich möchte kurze Terminhinweise bekommen und kann mich jederzeit abmelden.',
    listenkennung: 'termine.haus.de',
    beschreibung: 'Drei Zeilen, keine Bilder, nur wenn wirklich etwas ist.',
  },
];

const VORNAMEN = ['Anna', 'Bert', 'Carla', 'Dieter', 'Elke', 'Frank', 'Gesa', 'Hanno', 'Inge', 'Jens', 'Katrin', 'Lars'];
const ORTE = ['Verden', 'Bremen', 'Achim', 'Rotenburg', 'Nienburg'];

/**
 * Der Empfängerbestand.
 *
 * Absichtlich mit den Fällen, die es wirklich gibt: Unbestätigte, Abgemeldete,
 * Gesperrte, ein Doppelter und einer, der gelöscht wurde. Ein Bestand, in dem
 * alle bestätigt sind, zeigt nichts von dem, worum es geht.
 */
export function empfaenger(jetzt: number): Empfaenger[] {
  const heraus: Empfaenger[] = [];
  for (let i = 0; i < 48; i++) {
    const vorname = VORNAMEN[i % VORNAMEN.length]!;
    const ort = ORTE[i % ORTE.length]!;
    const adresse = `${vorname.toLowerCase()}${i}@beispiel.de`;
    // Feste Verteilung statt Zufall: die Seiten sollen bei jedem Aufruf
    // dasselbe zeigen.
    const zustand =
      i % 12 === 5 ? 'eingetragen' as const
      : i % 12 === 9 ? 'abgemeldet' as const
      : i % 24 === 17 ? 'gesperrt' as const
      : 'bestaetigt' as const;
    heraus.push({
      kennung: `ep_${i}`,
      organisation: ORGANISATION,
      adresse,
      schluessel: adresse,
      zustand,
      einwilligung: {
        quelle: i % 5 === 0 ? 'kasse' : 'formular:startseite',
        eingetragenAm: jetzt - (400 - i * 7) * 86_400_000,
        bestaetigtAm: zustand === 'eingetragen' ? null : jetzt - (398 - i * 7) * 86_400_000,
        wortlaut: VERTEILER[0]!.wortlaut,
        quellStreuwert: `q${i.toString(16)}`,
      },
      merkmale: { vorname, stadt: ort },
      verteiler: i % 4 === 3 ? ['vt_termine'] : i % 7 === 2 ? ['vt_news', 'vt_termine'] : ['vt_news'],
      weicheRuecklaeufer: i % 17 === 4 ? 2 : 0,
      ...(zustand === 'abgemeldet' ? { abgemeldetAm: jetzt - 30 * 86_400_000 } : {}),
      ...(zustand === 'gesperrt' ? { gesperrtAm: jetzt - 60 * 86_400_000, gesperrtWegen: 'hart' as const } : {}),
    });
  }
  // Einer ohne Vornamen — der Fall, an dem „Hallo ," entsteht.
  heraus.push({
    kennung: 'ep_ohne',
    organisation: ORGANISATION,
    adresse: 'stiller.leser@beispiel.de',
    schluessel: 'stiller.leser@beispiel.de',
    zustand: 'bestaetigt',
    einwilligung: {
      quelle: 'formular:startseite',
      eingetragenAm: jetzt - 120 * 86_400_000,
      bestaetigtAm: jetzt - 119 * 86_400_000,
      wortlaut: VERTEILER[0]!.wortlaut,
      quellStreuwert: 'qff',
    },
    merkmale: { stadt: 'Verden' },
    verteiler: ['vt_news'],
    weicheRuecklaeufer: 0,
  });
  return heraus;
}

export function kennzahlen(jetzt: number, bestand: readonly Empfaenger[]): Map<string, Kennzahlen> {
  const karte = new Map<string, Kennzahlen>();
  bestand.forEach((e, i) => {
    const gesendet = 8 + (i % 20);
    karte.set(e.kennung, {
      gesendet,
      geoeffnet: Math.floor(gesendet * (0.2 + ((i * 7) % 50) / 100)),
      geklickt: Math.floor(gesendet * ((i % 9) / 40)),
      letzteRegung: i % 6 === 0 ? null : jetzt - ((i * 11) % 200) * 86_400_000,
    });
  });
  return karte;
}

export const SEGMENTE: Segment[] = [
  {
    kennung: 'sg_verden',
    organisation: ORGANISATION,
    name: 'Aus Verden',
    regelwerk: { verknuepfung: 'und', teile: [{ feld: 'merkmal.stadt', vergleich: 'ist', wert: 'Verden' }] },
  },
  {
    kennung: 'sg_still',
    organisation: ORGANISATION,
    name: 'Seit einem Jahr still',
    regelwerk: {
      verknuepfung: 'und',
      teile: [
        { feld: 'gesendet', vergleich: 'groesser', wert: 5 },
        { feld: 'geklickt', vergleich: 'kleiner', wert: 1 },
      ],
    },
  },
];

export function newsletter(jetzt: number): Newsletter[] {
  return [
    {
      kennung: 'nl_1',
      organisation: ORGANISATION,
      titel: 'Herbstprogramm',
      zustand: 'eingereicht',
      varianten: [
        { kennung: 'a', betreff: 'Vier Abende im Herbst', vorschau: 'Karten ab Montag, für Sie schon heute.' },
        { kennung: 'b', betreff: 'Ihre Karten für den Herbst', vorschau: 'Vier Abende, Vorverkauf ab Montag.' },
      ],
      entscheidungsmass: 'klick',
      pruefdauerMs: 4 * 3_600_000,
      probeanteil: 0.2,
      bausteine: [
        { art: 'ueberschrift', text: 'Vier Abende im Herbst', stufe: 2 },
        {
          art: 'text',
          text: 'Hallo {{vorname|zusammen}},\n\nam Montag beginnt der Vorverkauf. Weil Sie den Newsletter bekommen, steht das Programm hier schon heute — mit der Bitte, es noch nicht weiterzugeben.',
        },
        { art: 'bild', datei: '/bilder/herbst.jpg', alt: 'Vier Plakate nebeneinander an einer Backsteinwand.' },
        { art: 'text', text: 'Die vier Abende stehen in derselben Reihe, aber sie haben wenig miteinander zu tun. Das ist Absicht.' },
        { art: 'knopf', beschriftung: 'Zum Programm', ziel: 'https://haus.de/herbst' },
        { art: 'trenner' },
        { art: 'text', text: 'Sie bekommen diese Mail, weil Sie sich für „{{verteiler}}" eingetragen haben.\n\nAbmelden: {{abmeldelink}}' },
      ],
      verteiler: 'vt_news',
      absender: { name: 'Haus', adresse: 'post@haus.de', antwortAn: 'post@haus.de' },
      geplantFuer: kuenftig(jetzt, inDerWoche(jetzt, 3, 10, 0), 10, 0),
      verfasser: 'Carla Nowak',
      angelegtAm: amTag(jetzt, -4, 10),
      geaendertAm: amTag(jetzt, -2, 9, 40),
    },
    {
      kennung: 'nl_0',
      organisation: ORGANISATION,
      titel: 'Werkstattbericht',
      zustand: 'gesendet',
      varianten: [{ kennung: 'a', betreff: 'Was beim Umbau schiefging', vorschau: 'Der ganze Bericht, ohne Schönfärberei.' }],
      bausteine: [
        { art: 'ueberschrift', text: 'Was beim Umbau schiefging', stufe: 2 },
        { art: 'text', text: 'Hallo {{vorname|zusammen}},\n\nwir haben es aufgeschrieben.' },
        { art: 'knopf', beschriftung: 'Zum Bericht', ziel: 'https://haus.de/werkstattbericht' },
        { art: 'text', text: 'Abmelden: {{abmeldelink}}' },
      ],
      verteiler: 'vt_news',
      absender: { name: 'Haus', adresse: 'post@haus.de', antwortAn: 'post@haus.de' },
      geplantFuer: inDerWoche(jetzt, 0, 10, 0),
      verfasser: 'Carla Nowak',
      angelegtAm: amTag(jetzt, -14, 10),
      geaendertAm: amTag(jetzt, -10, 12),
    },
  ];
}

export const STRECKEN: Strecke[] = [
  {
    kennung: 'st_willkommen',
    organisation: ORGANISATION,
    name: 'Willkommen',
    ausloeser: { art: 'bestaetigt' },
    erster: 's1',
    aktiv: true,
    schritte: [
      { art: 'senden', kennung: 's1', newsletter: 'nl_willkommen', weiter: 's2' },
      { art: 'warten', kennung: 's2', dauerMs: 5 * 86_400_000, weiter: 's3' },
      {
        art: 'bedingung',
        kennung: 's3',
        regelwerk: { verknuepfung: 'und', teile: [{ feld: 'geklickt', vergleich: 'groesser', wert: 0 }] },
        dann: 's5',
        sonst: 's4',
      },
      { art: 'senden', kennung: 's4', newsletter: 'nl_zweiter_anlauf', weiter: 's5' },
      { art: 'ende', kennung: 's5' },
    ],
  },
];

/** Die Zahlen des letzten Versands — für die Auswertung. */
export function mailzahlen(): Mailzahlen[] {
  return [
    { gesendet: 1_240, zugestellt: 1_198, hart: 28, weich: 14, geoeffnet: 522, geklickt: 143, abgemeldet: 6, beschwerden: 1 },
    { gesendet: 1_190, zugestellt: 1_161, hart: 21, weich: 8, geoeffnet: 471, geklickt: 96, abgemeldet: 9, beschwerden: 2 },
  ];
}

export function beitragszahlen(jetzt: number): Beitragszahlen[] {
  return [
    { beitrag: 'bt_1', kanal: 'kn_mastodon', kanalart: 'mastodon', veroeffentlichtAm: amTag(jetzt, -2, 10, 15), auslieferungen: null, regungen: 64, klicks: 31, kommentare: 7 },
    { beitrag: 'bt_1', kanal: 'kn_linkedin', kanalart: 'linkedin', veroeffentlichtAm: amTag(jetzt, -2, 10, 15), auslieferungen: 3_420, regungen: 118, klicks: 74, kommentare: 9 },
    { beitrag: 'bt_0', kanal: 'kn_linkedin', kanalart: 'linkedin', veroeffentlichtAm: amTag(jetzt, -9, 9, 0), auslieferungen: 2_880, regungen: 71, klicks: 40, kommentare: 3 },
    { beitrag: 'bt_0', kanal: 'kn_instagram', kanalart: 'instagram', veroeffentlichtAm: amTag(jetzt, -9, 9, 0), auslieferungen: 1_960, regungen: 203, klicks: 12, kommentare: 14 },
  ];
}

export const ZAEHLEINSTELLUNG: Zaehleinstellung = {
  organisation: ORGANISATION,
  oeffnungen: 'anonym',
  klicks: 'personenbezogen',
  einwilligungswortlaut: VERTEILER[0]!.wortlaut,
};

/** Die DNS-Einträge, wie sie ein Auflöser zurückgäbe. */
export const DNS = {
  spf: 'v=spf1 include:_spf.haus.de include:mail.haus.de -all',
  dkim: `v=DKIM1; k=rsa; p=${'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA'.repeat(9).slice(0, 392)}`,
  dmarc: 'v=DMARC1; p=none; rua=mailto:dmarc@haus.de; pct=100',
};
