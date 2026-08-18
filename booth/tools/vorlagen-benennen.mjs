/**
 * Anzeigenamen für den Katalog — einmal, nicht 51-mal von Hand.
 *
 * Die übernommenen Vorlagen brachten ihre Dateinamen als Namen mit:
 * „Birth Day Party Photo Booth 019 · 1240x1844 2up center". Das ist keine
 * Bezeichnung, das ist ein Pfad. Auf der Vorlagenliste der Box steht es
 * genauso wie in der Galerie auf der Website — beide Male vor Kundschaft.
 *
 * Der Name wird deshalb aus dem gebaut, was den Betreiber unterscheidet:
 * Familie, Aufnahmezahl, Ausrichtung. Die Kennung (`id`) bleibt unberührt —
 * an ihr hängen eingestellte Vorlagen auf laufenden Boxen.
 *
 *   node tools/vorlagen-benennen.mjs [--schreiben]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const KATALOG = path.join(HIER, '..', 'vorlagen-katalog.json');
const schreiben = process.argv.includes('--schreiben');

/* Familien, wie sie heißen sollen. Was hier nicht steht, bekommt seinen
   Kennungsteil in Großschreibung — sichtbar unfertig statt still falsch. */
const FAMILIEN = [
  [/^v-after-party/, 'After Party'],
  [/^v-birth-day-party/, 'Birthday Party'],
  [/^v-birthday-pastel/, 'Birthday Pastell'],
  [/^v-brush-uptown/, 'Brush Uptown'],
  [/^v-brushed-chic/, 'Brushed Chic'],
  [/^v-colorful-baby-birthday/, 'Baby Birthday'],
  [/^v-cream-wedding/, 'Cream Wedding'],
  [/^v-elegant-deco-party/, 'Elegant Déco'],
  [/^v-gold-art-deco-wedding/, 'Gold Art Déco'],
  [/^v-gold-line-wedding/, 'Gold Line'],
  [/^v-graduation-photo-booth-template-v1/, 'Abschluss I'],
  [/^v-graduation-photo-booth-template-v2/, 'Abschluss II'],
  [/^v-pink-blue-marble-wedding/, 'Marmor Rosé'],
  [/^v-pink-gold-wedding/, 'Pink Gold'],
  [/^v-purple-gold/, 'Purple Gold'],
  [/^v-rustic-floral/, 'Rustic Floral'],
  [/^v-summer-party/, 'Summer Party'],
  [/^v-together-forever/, 'Together Forever'],
  [/^v-woven-blue/, 'Woven Blue'],
];

/* Quer oder hoch steht dabei, weil es die Frage ist, die der Betreiber vor
   dem Drucken hat: Passt das Blatt so, wie das Papier eingelegt ist? */
const AUSRICHTUNG = {
  'postkarte-4x6': 'quer',
  'hoch-4x6': 'hoch',
  'quadrat-4x4': 'quadratisch',
  'gross-5x7': 'hoch',
  magnet: 'Magnet',
  lesezeichen: 'Lesezeichen',
  'streifen-2x6': 'Streifen',
};

const katalog = JSON.parse(readFileSync(KATALOG, 'utf8'));

function familie(v) {
  const treffer = FAMILIEN.find(([r]) => r.test(v.id));
  if (treffer) return treffer[1];
  if (!v.id.startsWith('v-')) return v.name; // unsere eigenen behalten ihren
  return v.id.replace(/^v-/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function zusatz(v) {
  const lage = AUSRICHTUNG[v.format] ?? v.format;
  if (v.art === 'foto') return `Einzelbild ${lage}`;
  return `${v.aufnahmen ?? 1}er Serie ${lage}`;
}

const gezaehlt = new Map();
const neu = katalog.map((v) => {
  if (!v.id.startsWith('v-')) return v;          // unsere vier heißen schon gut
  let name = `${familie(v)} · ${zusatz(v)}`;
  const wieoft = (gezaehlt.get(name) ?? 0) + 1;
  gezaehlt.set(name, wieoft);
  // Zwei Blätter derselben Familie, Serie und Lage gibt es wirklich — dann
  // zählt eine römische Ziffer sie durch, statt sie ununterscheidbar zu lassen.
  if (wieoft > 1) name += ` ${['', 'II', 'III', 'IV', 'V'][wieoft] ?? wieoft}`;
  return { ...v, name };
});

neu.forEach((v, i) => {
  if (v.name !== katalog[i].name) console.log(`${katalog[i].name}\n  → ${v.name}`);
});

const doppelt = neu.map((v) => v.name).filter((n, i, a) => a.indexOf(n) !== i);
if (doppelt.length) {
  console.error('Doppelte Namen: ' + [...new Set(doppelt)].join(', '));
  process.exitCode = 1;
}

if (schreiben) {
  writeFileSync(KATALOG, JSON.stringify(neu, null, 2) + '\n', 'utf8');
  console.log(`\n${neu.length} Einträge geschrieben.`);
} else {
  console.log('\nProbelauf — mit --schreiben übernehmen.');
}
