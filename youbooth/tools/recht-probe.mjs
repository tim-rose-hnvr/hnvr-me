/**
 * Die Rechtstexte — was fehlt, und was nicht live gehen darf.
 *
 * Ein falsches Impressum ist abmahnfähig, ein unvollständiges auch. Beides
 * fällt beim Durchsehen nicht auf: Die Seite ist gebaut, sie sieht fertig
 * aus, und die eine Zeile mit dem Registergericht liest niemand zweimal.
 *
 * Diese Probe zählt auf, was noch offen ist — und schlägt fehl, solange
 * etwas offen ist. Nicht, weil der Zwischenstand schlimm wäre, sondern
 * damit der Livegang nicht daran vorbeirutscht.
 *
 *   node tools/recht-probe.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HIER, '..', 'dist');

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const { firma, fehlendeAngaben, offeneAngaben, nachRechtsform } =
  await import('../src/daten/firma.ts').catch(async () => {
  /* Ohne TypeScript-Laufzeit: die Datei lesen und die null-Felder zählen. */
  const text = readFileSync(path.join(HIER, '..', 'src', 'daten', 'firma.ts'), 'utf8');
  const felder = [...text.matchAll(/^\s{2}([a-zA-Z]+): (null|'[^']*') as Angabe,/gm)];
  const wahlfrei = ['registergericht', 'registernummer', 'ustId', 'datenschutzbeauftragte'];
  const leer = felder.filter((m) => m[2] === 'null').map((m) => m[1]);
  return {
    firma: Object.fromEntries(felder.map((m) => [m[1], m[2] === 'null' ? null : m[2].slice(1, -1)])),
    fehlendeAngaben: leer.filter((f) => !wahlfrei.includes(f)),
    offeneAngaben: leer,
    nachRechtsform: wahlfrei,
  };
});

console.log('\n1 · Eine Quelle für alle Rechtstexte');
for (const seite of ['impressum', 'datenschutz', 'agb']) {
  const quelle = readFileSync(path.join(HIER, '..', 'src', 'pages', `${seite}.astro`), 'utf8');
  pruefe(`${seite}.astro liest daten/firma.ts`, quelle.includes("daten/firma"));
  /* Eckige Klammern waren die alte Schreibweise für „hier fehlt etwas".
     Sie dürfen nicht zurückkommen — eine zweite Sorte Platzhalter ist eine,
     die beim Ausfüllen übersehen wird. */
  const alte = [...quelle.matchAll(/'\[[^\]]{3,60}\]/g)].map((m) => m[0]);
  pruefe(`${seite}.astro hat keine eckigen Platzhalter mehr`, alte.length === 0,
    alte.join(', '));
}

console.log('\n2 · Was noch fehlt');
const wahlfrei = offeneAngaben.filter((f) => nachRechtsform.includes(f));
if (fehlendeAngaben.length === 0) {
  pruefe('Alle Pflichtangaben sind eingetragen', true);
} else {
  console.log(`  Pflicht, noch offen (${fehlendeAngaben.length}):`);
  for (const feld of fehlendeAngaben) console.log(`    · ${feld}`);
  pruefe('Alle Pflichtangaben sind eingetragen', false,
    'bis dahin darf die Seite nicht live gehen');
}
if (wahlfrei.length) {
  console.log(`  Je nach Rechtsform, darf leer bleiben (${wahlfrei.length}):`);
  for (const feld of wahlfrei) console.log(`    · ${feld}`);
  console.log('    Leer heißt: „gibt es nicht" — der Abschnitt entfällt dann.');
}

console.log('\n3 · Nichts Unfertiges auf der gebauten Seite');
if (!existsSync(DIST)) {
  console.log('  – Kein dist/ vorhanden; erst `npm run build`.');
} else {
  for (const seite of ['impressum', 'datenschutz', 'agb']) {
    const datei = path.join(DIST, seite, 'index.html');
    if (!existsSync(datei)) continue;
    const html = readFileSync(datei, 'utf8');
    const offen = [...html.matchAll(/⟨([a-zA-Z]+) fehlt⟩/g)].map((m) => m[1]);
    const eindeutig = [...new Set(offen)];
    /* Wahlfreie Felder dürfen hier nicht auftauchen: Fehlen sie, entfällt
       der ganze Abschnitt. Steht trotzdem eine Markierung auf der Seite,
       ist die Bedingung dafür falsch gebaut. */
    pruefe(`/${seite} zeigt keine offenen Angaben`, eindeutig.length === 0,
      eindeutig.join(', '));
  }
}

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen`);
if (gefallen) {
  console.log('\nZum Ausfüllen: youbooth/src/daten/firma.ts — ein Wert je Zeile,');
  console.log('`null` ersetzen. Danach diese Probe noch einmal laufen lassen.\n');
}
process.exit(gefallen ? 1 : 0);
