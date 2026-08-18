/**
 * Eine Modulliste, nicht zwei.
 *
 * BUILD_SPEC Teil 5.11 und Abnahmekriterium 6: „Preise, Modulnamen und
 * Bibliotheksgrößen existieren genau einmal — Website, Cockpit und
 * Preisrechner lesen dieselbe Quelle."
 *
 * Es waren zwei: Die Website kannte 14 Module mit deutschen Kennungen, die
 * Software 13 mit englischen. Die Einwegkamera fehlte in der Software ganz —
 * sie stand im Preisrechner, war aber nicht freischaltbar. Diese Probe zählt
 * nach, dass es dabei bleibt.
 *
 *   node tools/module-probe.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const quelle = JSON.parse(readFileSync(path.join(WURZEL, 'gestaltung', 'module.json'), 'utf8'));
const software = require(path.join(WURZEL, 'booth', 'server', 'produkte.js'));
const websiteText = readFileSync(path.join(WURZEL, 'youbooth', 'src', 'daten', 'module.ts'), 'utf8');

console.log('\n1 · Die gemeinsame Quelle');
/* Die vierzehn aus Teil 5.11, mit ihren Preisen. Ausgeschrieben, damit ein
   stiller Zahlendreher in der Quelle auffällt — eine Probe, die ihre Werte
   aus der geprüften Datei holt, prüft nichts. */
const SPEC = {
  fotobox: 39, 'foto-wall': 19, 'foto-finder': 15, galerie: 12, gaestebuch: 12,
  'web-kamera': 15, einwegkamera: 15, 'event-seiten': 19, slideshow: 12,
  'effekt-studio': 15, 'audio-gaestebuch': 12, 'slow-motion': 15, vermietung: 25,
  '360-booth': 19,
};
pruefe('Vierzehn Module', quelle.module.length === 14, String(quelle.module.length));
const fehlend = Object.keys(SPEC).filter((id) => !quelle.module.some((m) => m.id === id));
pruefe('Alle Kennungen aus der Spec', fehlend.length === 0, fehlend.join(', '));
const falschePreise = quelle.module.filter((m) => SPEC[m.id] !== m.preis);
pruefe('Alle Preise wie in Teil 5.11', falschePreise.length === 0,
  falschePreise.map((m) => `${m.id}: ${m.preis} statt ${SPEC[m.id]}`).join(', '));
pruefe('Bibliothek: 240 Vorlagen, Hochzeit 64, Saison 45, Firmen 26',
  quelle.bibliothek.gesamt === 240 && quelle.bibliothek.sammlungen.hochzeit === 64
  && quelle.bibliothek.sammlungen.saison === 45 && quelle.bibliothek.sammlungen.firmen === 26);

console.log('\n2 · Die Software liest sie');
pruefe('Sie kennt vierzehn Module', software.length === 14, String(software.length));
const ohneKennung = software.filter((m) => !m.kennung);
pruefe('Jedes trägt die gemeinsame Kennung', ohneKennung.length === 0,
  ohneKennung.map((m) => m.id).join(', '));
const namensfehler = software.filter((m) => {
  const q = quelle.module.find((x) => x.id === m.kennung);
  return !q || q.name !== m.name;
});
pruefe('Jeder Name kommt aus der Quelle', namensfehler.length === 0,
  namensfehler.map((m) => m.id + ': ' + m.name).join(', '));
const preisfehler = software.filter((m) => {
  const q = quelle.module.find((x) => x.id === m.kennung);
  return !q || m.price !== `ab ${q.preis} €/Monat`;
});
pruefe('Jeder Preis kommt aus der Quelle', preisfehler.length === 0,
  preisfehler.map((m) => m.id + ': ' + m.price).join(', '));
pruefe('Die Einwegkamera ist dabei', software.some((m) => m.kennung === 'einwegkamera'));
const stumm = software.filter((m) => !m.long || !m.features.length);
pruefe('Jedes Modul hat Beschreibung und Merkmale', stumm.length === 0,
  stumm.map((m) => m.id).join(', '));

console.log('\n3 · Die Website liest sie');
pruefe('module.ts importiert gestaltung/module.json',
  websiteText.includes("from '../../../gestaltung/module.json'"));
const hartkodiert = [...websiteText.matchAll(/^\s*preis: (\d+),/gm)].map((m) => m[1]);
pruefe('Kein Preis steht dort noch als Zahl', hartkodiert.length === 0, hartkodiert.join(', '));
const titelHart = [...websiteText.matchAll(/^\s*titel: '([^']+)',/gm)].map((m) => m[1]);
pruefe('Kein Name steht dort noch als Text', titelHart.length === 0, titelHart.join(', '));

console.log('\n4 · Alte Lizenzen gelten weiter');
const alteKennungen = ['booth', 'photowall', 'selfiefinder', 'gallery', 'guestbook', 'webcam',
  'microsites', 'slideshow', 'fxstudio', 'voicebook', 'slowmo', 'rental', 'spin360'];
const verloren = alteKennungen.filter((a) => !software.some((m) => m.id === a));
pruefe('Jede alte Kennung führt noch auf ihr Modul', verloren.length === 0, verloren.join(', '));

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
