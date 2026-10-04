/* Ablage — die Dokumente dieses Geräts.

   Der Atelier-Entwurf zeigt „Zuletzt geöffnet", Sammlungen und „12 Dokumente
   auf diesem Gerät". Das braucht einen Ort, an dem Dateien zwischen zwei
   Besuchen liegen bleiben. Dieser Ort ist IndexedDB im Browser — **auf dem
   Gerät, nicht auf einem Server**. Nichts davon verlässt das Gerät.

   Was hier liegt, ist eine Kopie der Datei, wie sie zuletzt geöffnet oder
   gesichert wurde. Das ist eine Entscheidung mit Folgen, deshalb:

   · Abschaltbar (Einstellung „Dokumente auf diesem Gerät merken"). Aus heißt:
     es wird nichts mehr abgelegt; was liegt, bleibt, bis man es löscht.
   · Jeder Eintrag lässt sich einzeln entfernen, die ganze Ablage auf einmal.
   · Ohne Speicher (privates Fenster, gesperrt, voll) arbeitet das Studio
     weiter wie bisher — nur ohne „Zuletzt geöffnet". Ein Fehler hier darf
     nie das Öffnen einer Datei verhindern.

   Dieses Modul kennt kein DOM. Es legt ab, liest, zählt und meldet
   „ablage:geaendert"; gezeichnet wird in dokumentenatelier.js. */

import { melde, kennung } from './kern.js';

const DB_NAME = 'pdf-studio';
const DB_FASSUNG = 1;
const DOKUMENTE = 'dokumente';
const SAMMLUNGEN = 'sammlungen';

/* Die Zustände, die ein Eintrag tragen kann — dieselben Wörter wie im
   Entwurf. Was zuletzt geschah, gewinnt. */
export const STATUS = {
  geoeffnet: 'Geöffnet',
  bearbeitet: 'Zuletzt bearbeitet',
  gespeichert: 'Gespeichert',
  kommentiert: 'Kommentiert',
  texterkannt: 'Text erkannt',
};

let verbindung = null;
let gesperrt = false;

/** Ob die Ablage auf diesem Gerät überhaupt geht. */
export function ablageVerfuegbar() { return !gesperrt && typeof indexedDB !== 'undefined'; }

function oeffne() {
  if (verbindung) return verbindung;
  verbindung = new Promise((loese, lehne) => {
    let anfrage;
    try { anfrage = indexedDB.open(DB_NAME, DB_FASSUNG); } catch (fehler) { lehne(fehler); return; }
    anfrage.onupgradeneeded = () => {
      const db = anfrage.result;
      if (!db.objectStoreNames.contains(DOKUMENTE)) {
        const laden = db.createObjectStore(DOKUMENTE, { keyPath: 'id' });
        laden.createIndex('zuletzt', 'zuletzt');
        laden.createIndex('schluessel', 'schluessel');
      }
      if (!db.objectStoreNames.contains(SAMMLUNGEN)) db.createObjectStore(SAMMLUNGEN, { keyPath: 'id' });
    };
    anfrage.onsuccess = () => loese(anfrage.result);
    anfrage.onerror = () => lehne(anfrage.error);
    anfrage.onblocked = () => lehne(new Error('Die Ablage ist in einem anderen Fenster blockiert.'));
  }).catch((fehler) => { gesperrt = true; verbindung = null; throw fehler; });
  return verbindung;
}

/* Eine Transaktion als Versprechen. `tun` bekommt die Lager und gibt zurück,
   was am Ende herauskommen soll (oder eine Anfrage, deren Ergebnis es ist). */
async function mit(lager, art, tun) {
  const db = await oeffne();
  return new Promise((loese, lehne) => {
    const t = db.transaction(lager, art);
    let ergebnis;
    const rueck = tun(...(Array.isArray(lager) ? lager : [lager]).map((n) => t.objectStore(n)));
    if (rueck && typeof rueck === 'object' && 'onsuccess' in rueck) rueck.onsuccess = () => { ergebnis = rueck.result; };
    else ergebnis = rueck;
    t.oncomplete = () => loese(ergebnis);
    t.onerror = () => lehne(t.error);
    t.onabort = () => lehne(t.error || new Error('Abgebrochen'));
  });
}

/* Dieselbe Datei soll nicht zehnmal in der Liste stehen, nur weil sie
   zehnmal geöffnet wurde. Erkannt wird sie am Namen und an der Größe —
   ein Hash über 50 MB wäre beim Öffnen spürbar, und Name plus Größe sind
   in der Praxis eindeutig genug. Eine geänderte Fassung (gesichert) hat eine
   andere Größe, behält aber ihre Kennung, weil sie über `ablageId` kommt. */
const schluesselVon = (name, groesse) => `${name}\u0000${groesse}`;

/**
 * Legt eine Datei ab oder frischt den vorhandenen Eintrag auf.
 * @param {{ id?: string, name: string, bytes: Uint8Array, seiten: number, status?: keyof STATUS }} angaben
 * @returns {Promise<string|null>} Kennung des Eintrags, oder null ohne Ablage
 */
export async function legeAb({ id = null, name, bytes, seiten, status = 'geoeffnet' }) {
  if (!ablageVerfuegbar()) return null;
  try {
    const groesse = bytes.byteLength;
    const schluessel = schluesselVon(name, groesse);
    const jetzt = Date.now();
    const kennungNeu = await mit(DOKUMENTE, 'readwrite', (laden) => {
      const ergebnisRef = { id: null };
      const schreibe = (alt) => {
        const eintrag = {
          id: alt?.id || id || kennung('d'),
          name, groesse, seiten, schluessel,
          sammlung: alt?.sammlung ?? null,
          status: STATUS[status] ? status : 'geoeffnet',
          zuletzt: jetzt,
          angelegt: alt?.angelegt || jetzt,
          bytes: new Blob([bytes], { type: 'application/pdf' }),
        };
        ergebnisRef.id = eintrag.id;
        laden.put(eintrag);
      };
      if (id) {
        const anfrage = laden.get(id);
        anfrage.onsuccess = () => schreibe(anfrage.result);
      } else {
        const anfrage = laden.index('schluessel').get(schluessel);
        anfrage.onsuccess = () => schreibe(anfrage.result);
      }
      return ergebnisRef;
    });
    melde('ablage:geaendert');
    return kennungNeu.id;
  } catch (fehler) {
    /* Voll, gesperrt, privat — das Öffnen der Datei geht trotzdem weiter. */
    console.warn('Ablage:', fehler);
    return null;
  }
}

/** Ändert Status und Zeit eines Eintrags, ohne die Datei neu zu schreiben. */
export async function vermerke(id, status) {
  if (!id || !ablageVerfuegbar()) return;
  try {
    await mit(DOKUMENTE, 'readwrite', (laden) => {
      const anfrage = laden.get(id);
      anfrage.onsuccess = () => {
        const eintrag = anfrage.result;
        if (!eintrag) return;
        eintrag.status = STATUS[status] ? status : eintrag.status;
        eintrag.zuletzt = Date.now();
        laden.put(eintrag);
      };
    });
    melde('ablage:geaendert');
  } catch (fehler) { console.warn('Ablage:', fehler); }
}

/**
 * Alle Einträge, jüngste zuerst — ohne die Dateien selbst.
 * @param {{ sammlung?: string|null, suche?: string }} [filter]
 */
export async function liste({ sammlung, suche = '' } = {}) {
  if (!ablageVerfuegbar()) return [];
  try {
    const alle = await mit(DOKUMENTE, 'readonly', (laden) => laden.getAll());
    const wort = suche.trim().toLowerCase();
    return (alle || [])
      .filter((e) => sammlung === undefined || e.sammlung === sammlung)
      .filter((e) => !wort || e.name.toLowerCase().includes(wort))
      .sort((a, b) => b.zuletzt - a.zuletzt)
      .map(({ bytes, ...rest }) => ({ ...rest, statusText: STATUS[rest.status] || '' }));
  } catch (fehler) { console.warn('Ablage:', fehler); return []; }
}

/** Die Datei eines Eintrags als Bytes, oder null. */
export async function hole(id) {
  if (!ablageVerfuegbar()) return null;
  const eintrag = await mit(DOKUMENTE, 'readonly', (laden) => laden.get(id));
  if (!eintrag) return null;
  return { name: eintrag.name, bytes: new Uint8Array(await eintrag.bytes.arrayBuffer()) };
}

export async function entferne(id) {
  await mit(DOKUMENTE, 'readwrite', (laden) => laden.delete(id));
  melde('ablage:geaendert');
}

/** Leert die ganze Ablage — Dokumente und Sammlungen. */
export async function leereAblage() {
  await mit([DOKUMENTE, SAMMLUNGEN], 'readwrite', (d, s) => { d.clear(); s.clear(); });
  melde('ablage:geaendert');
}

export async function ordneZu(id, sammlungId) {
  await mit(DOKUMENTE, 'readwrite', (laden) => {
    const anfrage = laden.get(id);
    anfrage.onsuccess = () => {
      const eintrag = anfrage.result;
      if (!eintrag) return;
      eintrag.sammlung = sammlungId || null;
      laden.put(eintrag);
    };
  });
  melde('ablage:geaendert');
}

/* ---------- Sammlungen ---------------------------------------------------- */

/** Sammlungen mit ihrer Zahl an Dokumenten, in der Reihenfolge des Anlegens. */
export async function sammlungen() {
  if (!ablageVerfuegbar()) return [];
  try {
    const [alle, dokumente] = await Promise.all([
      mit(SAMMLUNGEN, 'readonly', (s) => s.getAll()),
      liste(),
    ]);
    return (alle || []).sort((a, b) => a.angelegt - b.angelegt)
      .map((s) => ({ ...s, anzahl: dokumente.filter((d) => d.sammlung === s.id).length }));
  } catch (fehler) { console.warn('Ablage:', fehler); return []; }
}

/** Legt eine Sammlung an. Leere Namen und Doppelte werden abgewiesen. */
export async function legeSammlungAn(name) {
  const sauber = String(name || '').trim().slice(0, 60);
  if (!sauber) throw new Error('Die Sammlung braucht einen Namen.');
  const vorhanden = await sammlungen();
  if (vorhanden.some((s) => s.name.toLowerCase() === sauber.toLowerCase())) {
    throw new Error(`Eine Sammlung „${sauber}" gibt es schon.`);
  }
  const sammlung = { id: kennung('c'), name: sauber, angelegt: Date.now() };
  await mit(SAMMLUNGEN, 'readwrite', (s) => s.put(sammlung));
  melde('ablage:geaendert');
  return sammlung;
}

/** Entfernt eine Sammlung. Ihre Dokumente bleiben, nur ohne Sammlung. */
export async function entferneSammlung(id) {
  await mit([DOKUMENTE, SAMMLUNGEN], 'readwrite', (d, s) => {
    s.delete(id);
    const anfrage = d.getAll();
    anfrage.onsuccess = () => {
      for (const eintrag of anfrage.result) {
        if (eintrag.sammlung === id) { eintrag.sammlung = null; d.put(eintrag); }
      }
    };
  });
  melde('ablage:geaendert');
}

/** Wie viel Platz die Ablage belegt, soweit der Browser es sagt. */
export async function belegung() {
  const dokumente = await liste();
  const summe = dokumente.reduce((n, d) => n + (d.groesse || 0), 0);
  let frei = null;
  try {
    const schaetzung = await navigator.storage?.estimate?.();
    if (schaetzung?.quota) frei = schaetzung.quota - (schaetzung.usage || 0);
  } catch { /* nicht jeder Browser sagt es */ }
  return { anzahl: dokumente.length, bytes: summe, frei };
}
