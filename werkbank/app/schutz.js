/* Schutz — Kennwörter, Rechte, Reparatur. Getragen von qpdf als WebAssembly.

   Warum nicht selbst gebaut: PDF-Verschlüsselung ist AES-256 mit einem
   festgelegten Schlüsselaufbau. Eigene Kryptografie ist im Haus verboten und
   wäre hier auch fahrlässig. qpdf ist das Werkzeug, das die Fachwelt dafür
   benutzt — es läuft hier vollständig im Browser.

   Was das kann:
   - kennwortgeschützte Dateien öffnen (mit Kennwort) und den Schutz entfernen
   - Schutz setzen: Benutzer- und Besitzerkennwort, AES-256
   - Rechte begrenzen: Drucken, Ändern, Kopieren, Anmerken
   - beschädigte Dateien reparieren, Dateien fürs Web linearisieren

   Was das nicht kann: ein unbekanntes Kennwort erraten. */

import { sage } from './kern.js';

let bauen = null;

async function neuesModul() {
  if (!bauen) bauen = (await import('../fremd/qpdf.mjs')).default;
  const wurzel = new URL('../fremd/', import.meta.url).toString();
  const ausgaben = [];
  const modul = await bauen({
    noInitialRun: true,
    locateFile: (datei) => `${wurzel}${datei}`,
    print: (zeile) => ausgaben.push(zeile),
    printErr: (zeile) => ausgaben.push(zeile),
  });
  modul.__ausgaben = ausgaben;
  return modul;
}

/**
 * Führt qpdf einmal aus.
 * @param {Uint8Array} bytes Eingabedatei
 * @param {string[]} argumente qpdf-Argumente; /ein.pdf und /aus.pdf sind gesetzt
 * @returns {Promise<Uint8Array>}
 */
export async function laufe(bytes, argumente) {
  const modul = await neuesModul();
  modul.FS.writeFile('/ein.pdf', bytes);
  let code = 0;
  try {
    code = modul.callMain(argumente);
  } catch (fehler) {
    if (typeof fehler?.status === 'number') code = fehler.status;
    else throw new Error(`qpdf brach ab: ${fehler?.message || fehler}`);
  }
  const meldung = (modul.__ausgaben || []).join('\n').trim();
  // 0 = fehlerfrei, 3 = Warnungen (Datei ist trotzdem geschrieben)
  if (code !== 0 && code !== 3) throw new Error(meldung || `qpdf endete mit Code ${code}`);
  if (meldung && code === 3) console.warn('qpdf:', meldung);
  let ergebnis;
  try { ergebnis = modul.FS.readFile('/aus.pdf'); }
  catch { throw new Error(meldung || 'qpdf hat keine Datei geschrieben'); }
  return new Uint8Array(ergebnis);
}

/** Nimmt den Schutz heraus — braucht das Kennwort. */
export async function entschluessle(bytes, kennwort = '') {
  return laufe(bytes, ['--decrypt', `--password=${kennwort}`, '/ein.pdf', '/aus.pdf']);
}

/** Prüft, ob eine Datei verschlüsselt ist, ohne sie zu verändern. */
export async function istGeschuetzt(bytes) {
  const modul = await neuesModul();
  modul.FS.writeFile('/ein.pdf', bytes);
  try { modul.callMain(['--is-encrypted', '/ein.pdf']); return true; }
  catch (fehler) { return fehler?.status === 0; }
}

/**
 * Setzt Kennwort und Rechte.
 * @param {Uint8Array} bytes
 * @param {{benutzer?: string, besitzer?: string, drucken?: 'full'|'low'|'none',
 *          aendern?: 'all'|'annotate'|'form'|'assembly'|'none', kopieren?: boolean,
 *          anmerken?: boolean}} regeln
 */
export async function verschluessle(bytes, regeln = {}) {
  const {
    benutzer = '', besitzer = '', drucken = 'full', aendern = 'all',
    kopieren = true, anmerken = true,
  } = regeln;
  if (!benutzer && !besitzer) throw new Error('Mindestens ein Kennwort angeben.');

  const argumente = ['/ein.pdf', '/aus.pdf', '--encrypt', benutzer, besitzer || benutzer, '256'];
  if (drucken !== 'full') argumente.push(`--print=${drucken}`);
  if (aendern !== 'all') argumente.push(`--modify=${aendern}`);
  if (!kopieren) argumente.push('--extract=n');
  if (!anmerken) argumente.push('--annotate=n');
  argumente.push('--');
  return laufe(bytes, argumente);
}

/** Repariert Aufbaufehler, indem qpdf die Datei neu schreibt. */
export async function repariere(bytes) {
  return laufe(bytes, ['/ein.pdf', '/aus.pdf']);
}

/** Linearisiert für schnelles Öffnen im Browser („fast web view"). */
export async function linearisiere(bytes) {
  return laufe(bytes, ['--linearize', '/ein.pdf', '/aus.pdf']);
}

/** Rechte einer Datei auslesen — für die Anzeige in den Eigenschaften. */
export async function rechte(bytes, kennwort = '') {
  const modul = await neuesModul();
  modul.FS.writeFile('/ein.pdf', bytes);
  try { modul.callMain([`--password=${kennwort}`, '--show-encryption', '/ein.pdf']); }
  catch { /* Ausgabe steht trotzdem bereit */ }
  return (modul.__ausgaben || []).join('\n').trim();
}

export function meldeUnbekanntesKennwort() {
  sage('Falsches Kennwort', { art: 'fehler' });
}
