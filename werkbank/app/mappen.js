/* Mappen — mehrere Dateien gleichzeitig offen, als Reiter in der Titelleiste.

   Der Zustand der Werkbank war auf genau ein Arbeitsdokument gebaut: eine
   Seitenfolge, eine Anmerkungsliste, eine Rückgängig-Kette. Das ist keine
   Schwäche, sondern eine Vereinfachung, die überall durchschlägt — jedes
   Modul liest `zustand.folge`.

   Statt das aufzubrechen (und damit vierzehn Module anzufassen), hält diese
   Datei mehrere **Ablagen** desselben Zustandsausschnitts und tauscht ihn
   beim Reiterwechsel aus. Für alle anderen Module ändert sich nichts: es gibt
   weiterhin genau ein Arbeitsdokument, es wechselt nur.

   Was zum Dokument gehört und was zur Sitzung, steht in DOKUMENT_FELDER.
   Werkzeugwahl, Zoom, Thema und Leistenzustand bleiben absichtlich draußen —
   wer das Werkzeug wechselt, will es in allen Reitern haben. */

import { zustand, melde, kennung } from './kern.js';

/* Alles, was ein Dokument ausmacht. Kommt ein Feld dazu, gehört es hierhin —
   sonst blutet es beim Wechsel von einem Reiter in den anderen. */
const DOKUMENT_FELDER = [
  'quellen', 'folge', 'anmerkungen', 'formularwerte', 'ocr', 'textLaenge',
  'formularfelder', 'name', 'geaendert', 'gliederung', 'eigenschaften',
  'aktuelleSeite', 'gewaehlteSeiten', 'gewaehlteAnmerkung',
  'historie', 'historieZeiger', 'zugang', 'nurAuswahl', 'massstab',
];

/** Frische, leere Ablage — dieselben Werte wie beim Start. */
function leererStand() {
  return {
    quellen: new Map(), folge: [], anmerkungen: [], formularwerte: new Map(),
    ocr: new Map(), textLaenge: new Map(), formularfelder: [],
    name: 'Ohne Titel', geaendert: false, gliederung: null, eigenschaften: null,
    aktuelleSeite: 1, gewaehlteSeiten: new Set(), gewaehlteAnmerkung: null,
    historie: [], historieZeiger: -1, zugang: null, nurAuswahl: false,
    massstab: null,
  };
}

export const mappen = [];
let aktiv = null;

export function aktiveMappe() { return mappen.find((m) => m.id === aktiv) || null; }
export function mappenListe() {
  return mappen.map((m) => ({
    id: m.id,
    aktiv: m.id === aktiv,
    name: m.id === aktiv ? zustand.name : m.stand.name,
    seiten: m.id === aktiv ? zustand.folge.length : m.stand.folge.length,
    geaendert: m.id === aktiv ? zustand.geaendert : m.stand.geaendert,
  }));
}

export function starteMappen() {
  if (mappen.length) return;
  /* Die erste Mappe ist die, die beim Start ohnehin im Zustand liegt. */
  const erste = { id: kennung('m'), stand: leererStand() };
  mappen.push(erste);
  aktiv = erste.id;
}

function sichereAktive() {
  const mappe = aktiveMappe();
  if (!mappe) return;
  for (const feld of DOKUMENT_FELDER) {
    const wert = zustand[feld];
    mappe.stand[feld] = FESTE_BEHAELTER.includes(feld)
      ? (wert instanceof Set ? new Set(wert) : new Map(wert))
      : wert;
  }
}

/* Behälter, die der übrige Code nur füllt und leert, aber nie ersetzt. Ihre
   Objektgleichheit muss den Reiterwechsel überleben: ein Modul, das sich die
   Map einmal gemerkt hat, schriebe sonst in die des vorigen Reiters. Genau
   das ist bei der Texterkennung passiert — sie lief, und das Ergebnis kam
   nirgends an. */
const FESTE_BEHAELTER = ['quellen', 'formularwerte', 'ocr', 'textLaenge', 'gewaehlteSeiten'];

function ladeInZustand(stand) {
  for (const feld of DOKUMENT_FELDER) {
    if (FESTE_BEHAELTER.includes(feld)) {
      const ziel = zustand[feld];
      ziel.clear();
      if (ziel instanceof Set) for (const wert of stand[feld]) ziel.add(wert);
      else for (const [k, v] of stand[feld]) ziel.set(k, v);
      /* Die Ablage zeigt danach auf denselben Inhalt wie der Zustand, aber
         als eigene Kopie — sonst schriebe der nächste Reiter hier mit. */
      stand[feld] = ziel instanceof Set ? new Set(ziel) : new Map(ziel);
    } else {
      zustand[feld] = stand[feld];
    }
  }
}

/**
 * Legt eine neue, leere Mappe an und macht sie zur aktiven.
 * Die aufrufende Stelle lädt danach die Datei wie bisher.
 */
export function neueMappe() {
  sichereAktive();
  const mappe = { id: kennung('m'), stand: leererStand() };
  mappen.push(mappe);
  aktiv = mappe.id;
  ladeInZustand(mappe.stand);
  melde('mappen:geaendert');
  return mappe;
}

export function wechsleZu(id) {
  if (id === aktiv) return;
  const ziel = mappen.find((m) => m.id === id);
  if (!ziel) return;
  sichereAktive();
  aktiv = id;
  ladeInZustand(ziel.stand);
  melde('mappen:geaendert');
  /* Dieselben Meldungen wie beim Laden einer Datei: die Ansicht, die
     Miniaturen und alle Tafeln bauen sich daraufhin neu auf. */
  melde('dokument:geladen');
  melde('dokument:geaendert');
}

/**
 * Schließt eine Mappe. Die letzte bleibt stehen — nur leer, wie beim Start.
 * @returns {boolean} ob geschlossen wurde
 */
export function schliesse(id) {
  const index = mappen.findIndex((m) => m.id === id);
  if (index < 0) return false;

  if (mappen.length === 1) {
    /* Die letzte Mappe wird geleert statt entfernt: eine Werkbank ohne
       einzigen Reiter hätte keinen Ort mehr, an dem etwas geöffnet wird. */
    freigeben(id === aktiv ? { stand: null } : mappen[index]);
    if (id === aktiv) freigebenZustand();
    mappen[index].stand = leererStand();
    if (id === aktiv) ladeInZustand(mappen[index].stand);
    melde('mappen:geaendert');
    melde('dokument:geladen');
    return true;
  }

  if (id === aktiv) {
    freigebenZustand();
    mappen.splice(index, 1);
    const naechste = mappen[Math.min(index, mappen.length - 1)];
    aktiv = naechste.id;
    ladeInZustand(naechste.stand);
    melde('mappen:geaendert');
    melde('dokument:geladen');
    melde('dokument:geaendert');
  } else {
    freigeben(mappen[index]);
    mappen.splice(index, 1);
    melde('mappen:geaendert');
  }
  return true;
}

/* pdf.js hält je Dokument einen Arbeiter und dessen Speicher. Ohne destroy
   bliebe er bis zum Neuladen der Seite liegen. */
function freigeben(mappe) {
  if (!mappe?.stand?.quellen) return;
  for (const quelle of mappe.stand.quellen.values()) {
    try { quelle.pdf.destroy?.(); } catch { /* schon fort */ }
  }
}
function freigebenZustand() {
  for (const quelle of zustand.quellen.values()) {
    try { quelle.pdf.destroy?.(); } catch { /* schon fort */ }
  }
}

/** Merkt sich den Namen der aktiven Mappe, wenn eine Datei geladen wurde. */
export function frischeAuf() { melde('mappen:geaendert'); }
