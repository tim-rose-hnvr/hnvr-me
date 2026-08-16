/* Mitdenken — der Teil, der die Werkbank von einem Betrachter unterscheidet.

   Das Dokument wird nach dem Laden untersucht: Text oder Scan, Formularfelder,
   Unterschriftsstellen, personenbezogene Muster, leere Seiten, Querformat.
   Daraus entstehen Vorschläge — jeder mit einem Satz Begründung und einem
   Knopf, der die Arbeit gleich erledigt.

   Regeln des Hauses:
   - Nie etwas ungefragt tun. Ein Vorschlag ist ein Angebot, kein Automatismus.
   - Jeder Vorschlag lässt sich wegklicken und kommt in dieser Sitzung nicht wieder.
   - Kein Vorschlag ohne Grund im Dokument. Keine Werbung, keine Ratschläge ins Blaue. */

import { zustand, melde, hoer, el, sage } from './kern.js';
import { seitenText, nummerVon } from './dokument.js';
import { offeneFelder, hatFormular } from './formulare.js';
import { hatUnterschrift } from './anmerkungen.js';

export const befunde = {
  gescannt: false,
  leereSeiten: [],
  querformat: [],
  unterschriftStellen: [],
  muster: [],
  untersucht: false,
  seitenGeprueft: 0,
};

const MUSTER = [
  { art: 'IBAN', regel: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}\b/g, hinweis: 'Bankverbindung' },
  { art: 'E-Mail', regel: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, hinweis: 'E-Mail-Adresse' },
  { art: 'Telefon', regel: /(?:\+49|0)\s?\d{2,5}[\s/-]?\d{3,}\d/g, hinweis: 'Rufnummer' },
  { art: 'Geburtsdatum', regel: /\bgeb(?:oren)?\.?\s*(?:am)?\s*\d{1,2}\.\d{1,2}\.\d{2,4}/gi, hinweis: 'Geburtsdatum' },
  { art: 'Steuernummer', regel: /\b(?:Steuer-?(?:nummer|ID)|USt-?IdNr\.?)\s*:?\s*[\dA-Z/ ]{8,}/gi, hinweis: 'Steuermerkmal' },
];

const UNTERSCHRIFT_MUSTER = /(unterschrift|unterzeichn|ort,\s*datum|datum,\s*ort|gez\.|rechtsverbindlich)/i;

/** Untersucht bis zu 60 Seiten. Läuft im Hintergrund, blockiert nichts. */
export async function untersuche() {
  Object.assign(befunde, { gescannt: false, leereSeiten: [], querformat: [], unterschriftStellen: [], muster: [], untersucht: false, seitenGeprueft: 0 });
  const grenze = Math.min(zustand.folge.length, 60);
  let mitText = 0;

  for (let i = 0; i < grenze; i++) {
    const eintrag = zustand.folge[i];
    let roh = '';
    try { ({ roh } = await seitenText(eintrag)); } catch { continue; }
    const sauber = roh.replace(/\s+/g, ' ').trim();
    befunde.seitenGeprueft = i + 1;

    if (sauber.length > 30) mitText++;
    else befunde.leereSeiten.push(eintrag.id);

    if (UNTERSCHRIFT_MUSTER.test(sauber)) befunde.unterschriftStellen.push(eintrag.id);

    for (const { art, regel, hinweis } of MUSTER) {
      regel.lastIndex = 0;
      let fund;
      while ((fund = regel.exec(sauber)) !== null) {
        befunde.muster.push({ art, hinweis, seiteId: eintrag.id, text: fund[0].slice(0, 60) });
        if (befunde.muster.length > 200) break;
      }
    }
    if (i % 8 === 7) await new Promise((l) => setTimeout(l, 0));   // Oberfläche atmen lassen
  }

  befunde.gescannt = mitText === 0 && grenze > 0;
  befunde.untersucht = true;
  melde('mitdenken:geaendert');
}

/* ---------- Vorschläge ---------------------------------------------------- */

function alleVorschlaege() {
  const liste = [];
  const seitenzahl = zustand.folge.length;

  if (befunde.gescannt) {
    liste.push({
      id: 'scan',
      titel: 'Das Dokument ist ein Scan',
      text: 'Auf den geprüften Seiten steht kein auswählbarer Text. Suchen, Kopieren und Hervorheben von Textstellen funktionieren deshalb nicht. Rechteck und Freihand gehen weiterhin.',
      knopf: 'Verstanden',
      befehl: null,
      gewicht: 90,
    });
  }

  if (hatFormular()) {
    const offen = offeneFelder().length;
    liste.push({
      id: 'formular',
      titel: offen ? `Formular: ${offen} Feld${offen === 1 ? '' : 'er'} offen` : 'Formular vollständig ausgefüllt',
      text: offen ? 'Ich springe zum ersten leeren Feld und setze den Schreibpunkt hinein.' : 'Alle Felder tragen einen Wert. Beim Sichern lassen sie sich fest einbrennen.',
      knopf: offen ? 'Zum ersten Feld' : 'Werte einbrennen',
      befehl: offen ? 'formular:naechstes' : 'sichern:einbrennen',
      gewicht: 85,
    });
  }

  if (befunde.unterschriftStellen.length) {
    liste.push({
      id: 'unterschrift',
      titel: `Unterschriftsstelle auf Seite ${nummerVon(befunde.unterschriftStellen[0])}`,
      text: hatUnterschrift()
        ? 'Die angelegte Unterschrift lässt sich dort mit einem Zug aufziehen.'
        : 'Der Text nennt Unterschrift, Ort oder Datum. Unterschrift anlegen und setzen?',
      knopf: hatUnterschrift() ? 'Zur Stelle springen' : 'Unterschrift anlegen',
      befehl: hatUnterschrift() ? 'springe:unterschrift' : 'unterschrift:anlegen',
      gewicht: 80,
    });
  }

  if (befunde.muster.length) {
    const arten = [...new Set(befunde.muster.map((m) => m.art))];
    liste.push({
      id: 'muster',
      titel: `${befunde.muster.length} personenbezogene Angabe${befunde.muster.length === 1 ? '' : 'n'}`,
      text: `Gefunden: ${arten.join(', ')}. Vor der Weitergabe schwärzen? Die Werkbank rastert die betroffenen Seiten, damit der Text wirklich verschwindet.`,
      knopf: 'Fundstellen zeigen',
      befehl: 'muster:zeigen',
      gewicht: 78,
    });
  }

  if (befunde.leereSeiten.length && !befunde.gescannt) {
    liste.push({
      id: 'leer',
      titel: `${befunde.leereSeiten.length} Seite${befunde.leereSeiten.length === 1 ? '' : 'n'} ohne Text`,
      text: 'Meist Trennblätter oder Rückseiten. Auswählen und ansehen, dann entscheiden.',
      knopf: 'Auswählen',
      befehl: 'leere:waehlen',
      gewicht: 45,
    });
  }

  const schwaerzungen = zustand.anmerkungen.filter((a) => a.art === 'schwaerzen');
  if (schwaerzungen.length) {
    const seiten = new Set(schwaerzungen.map((a) => a.seiteId)).size;
    liste.push({
      id: 'schwaerzung',
      titel: `${schwaerzungen.length} Schwärzung${schwaerzungen.length === 1 ? '' : 'en'} gesetzt`,
      text: `Beim Sichern ${seiten === 1 ? 'wird 1 Seite' : `werden ${seiten} Seiten`} in ein Bild umgewandelt. Der Text darunter ist danach fort — auch für Suchmaschinen und Textextraktion. Das ist gewollt und nicht umkehrbar.`,
      knopf: 'Jetzt sichern',
      befehl: 'sichern',
      gewicht: 95,
    });
  }

  if (zustand.quellen.size > 1) {
    liste.push({
      id: 'zusammengefuehrt',
      titel: `${zustand.quellen.size} Dateien zusammengeführt`,
      text: `${seitenzahl} Seiten in einer Folge. Reihenfolge in der Seitenleiste prüfen — dort lässt sie sich ziehen.`,
      knopf: 'Seiten zeigen',
      befehl: 'leiste:seiten',
      gewicht: 60,
    });
  }

  if (seitenzahl > 40) {
    liste.push({
      id: 'teilen',
      titel: `${seitenzahl} Seiten`,
      text: 'Für Versand oder Ablage lässt sich das Dokument in gleich große Teile zerlegen.',
      knopf: 'Teilen',
      befehl: 'teilen',
      gewicht: 30,
    });
  }

  const e = zustand.eigenschaften;
  if (e && (e.verfasser || e.erzeuger)) {
    liste.push({
      id: 'metadaten',
      titel: 'Metadaten im Dokument',
      text: `${[e.verfasser && `Verfasser „${e.verfasser}"`, e.erzeuger && `erzeugt mit ${e.erzeuger}`].filter(Boolean).join(', ')}. Vor der Weitergabe entfernen?`,
      knopf: 'Metadaten ansehen',
      befehl: 'eigenschaften',
      gewicht: 25,
    });
  }

  if (zustand.geaendert) {
    liste.push({
      id: 'sichern',
      titel: 'Ungesicherte Änderungen',
      text: 'Die Werkbank speichert nichts von selbst — nichts verlässt dieses Gerät, auch nicht in einen Zwischenspeicher.',
      knopf: 'Sichern',
      befehl: 'sichern',
      gewicht: 70,
    });
  }

  // Aus der Beobachtung: wer viel hervorhebt, bekommt den Kniff dazu.
  const hervor = zustand.gedaechtnis.benutzteWerkzeuge.get('hervor') || 0;
  if (hervor >= 3) {
    liste.push({
      id: 'kniff-hervor',
      titel: 'Kniff: Text markieren genügt',
      text: 'Mit H auf das Hervorheben schalten, dann reicht das Markieren mit der Maus. Mit V wieder zurück zur Auswahl.',
      knopf: 'Merken',
      befehl: null,
      gewicht: 10,
    });
  }

  return liste
    .filter((v) => !zustand.gedaechtnis.abgelehnteVorschlaege.has(v.id))
    .sort((a, b) => b.gewicht - a.gewicht);
}

/* ---------- Tafel ---------------------------------------------------------- */

export function tafelMitdenken() {
  const wurzel = el('div', {});
  const vorschlaege = alleVorschlaege();

  const abschnitt = el('div', { klasse: 'abschnitt' }, el('h2', { text: 'Mitdenken' }));
  if (!zustand.folge.length) {
    abschnitt.append(el('p', { klasse: 'hinweis', text: 'Kein Dokument geladen.' }));
  } else if (!befunde.untersucht) {
    abschnitt.append(el('p', { klasse: 'hinweis', text: `Dokument wird gelesen … (${befunde.seitenGeprueft}/${Math.min(zustand.folge.length, 60)})` }));
  } else if (!vorschlaege.length) {
    abschnitt.append(el('p', { klasse: 'hinweis', text: 'Nichts zu melden. Das Dokument sieht unauffällig aus.' }));
  }

  for (const vorschlag of vorschlaege.slice(0, 6)) {
    const knopf = el('button', {
      klasse: 'vorschlag',
      beiClick: () => {
        if (vorschlag.befehl) melde('befehl', vorschlag.befehl);
        else zustand.gedaechtnis.abgelehnteVorschlaege.add(vorschlag.id);
        melde('mitdenken:geaendert');
      },
    },
      el('svg', { viewBox: '0 0 24 24', klasse: 'sinnbild' }),
      el('div', { klasse: 'vorschlag-text' },
        el('b', { text: vorschlag.titel }),
        el('span', { text: vorschlag.text }),
        el('span', { klasse: 'marke marke-tally', text: vorschlag.knopf, stil: { marginTop: '.35rem' } })));

    knopf.querySelector('svg').innerHTML = '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>';
    const weg = el('button', {
      klasse: 'vorschlag-weg', text: '✕', title: 'Nicht mehr zeigen',
      beiClick: (e) => {
        e.stopPropagation();
        zustand.gedaechtnis.abgelehnteVorschlaege.add(vorschlag.id);
        melde('mitdenken:geaendert');
      },
    });
    const zeile = el('div', { stil: { position: 'relative' } }, knopf, weg);
    weg.style.position = 'absolute';
    weg.style.top = '.4rem';
    weg.style.right = '.4rem';
    abschnitt.append(zeile);
  }
  wurzel.append(abschnitt);
  return wurzel;
}

export function starteMitdenken() {
  hoer('dokument:geladen', () => { zustand.gedaechtnis.abgelehnteVorschlaege.clear(); untersuche(); });
  hoer('seiten:geaendert', () => melde('mitdenken:geaendert'));
  hoer('anmerkungen:geaendert', () => melde('mitdenken:geaendert'));
  hoer('formular:geaendert', () => melde('mitdenken:geaendert'));
  hoer('dokument:geaendert', () => melde('mitdenken:geaendert'));
}

/** Fundstellen als Liste — für den Befehl „Fundstellen zeigen". */
export function musterListe() {
  return befunde.muster.map((m) => ({ ...m, seite: nummerVon(m.seiteId) }));
}
