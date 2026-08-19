/**
 * Ein Gestaltungssystem, nicht zwei.
 *
 * BUILD_SPEC Teil 1 verlangt genau ein Token-Modul für Website, Cockpit und
 * Booth; Abnahmekriterium 2 verbietet Farben, Größen und Schriften außerhalb
 * davon. Beides ist nur zu halten, wenn es jemand nachzählt — sonst schleicht
 * sich die zweite Liste über Monate wieder ein, so wie beim ersten Mal.
 *
 *   node tools/gestaltung-probe.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const quelle = readFileSync(path.join(WURZEL, 'gestaltung', 'tokens.css'), 'utf8');

console.log('\n1 · Die gemeinsame Quelle');
const NOETIG = ['--ink', '--ink-soft', '--amber', '--amber-ink', '--paper', '--weiss', '--deep',
  '--linie', '--linie-dunkel', '--text', '--text-leise', '--text-hell', '--text-hell-leise',
  '--text-hell-fein', '--link', '--link-hover', '--ok', '--warn', '--rand', '--breite',
  '--spalte-text', '--r-pille', '--r-knopf', '--r-chip', '--r-karte', '--r-karte-gross',
  '--schatten-karte', '--schatten-hoch', '--schatten-cta', '--schatten-kopf',
  '--t-farbe', '--t-transform', '--t-klapp', '--schrift', '--mono'];
const fehlend = NOETIG.filter((t) => !quelle.includes(t + ':'));
pruefe(`Alle ${NOETIG.length} Werte aus Teil 2 stehen darin`, fehlend.length === 0, fehlend.join(', '));

/* Die Werte, bei denen die beiden Sätze auseinandergelaufen waren. */
const SOLL = {
  '--amber': '#f2b23e', '--ink': '#0b0b0d', '--paper': '#f6f4f1', '--text': '#0b0b0d',
  '--r-knopf': '10px', '--r-karte': '14px', '--r-karte-gross': '16px', '--r-chip': '12px',
  '--text-hell-fein': 'rgba(244, 242, 238, 0.42)',
};
for (const [name, wert] of Object.entries(SOLL)) {
  const treffer = quelle.match(new RegExp(`${name}:\\s*([^;]+);`));
  pruefe(`${name} ist ${wert}`, treffer && treffer[1].trim() === wert, treffer && treffer[1].trim());
}

console.log('\n2 · Keine zweite Liste');
/* Gesucht wird nach Stellen, die eigene Farbwerte definieren statt die
   gemeinsamen zu benutzen. Ein `--eigenerName: #abc` in einer Oberfläche ist
   genau der Anfang, aus dem beim letzten Mal ein zweiter Satz wurde. */
function alleDateien(ordner, endung, gesammelt = []) {
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag === 'node_modules' || eintrag === 'dist' || eintrag.startsWith('.')) continue;
    const voll = path.join(ordner, eintrag);
    if (statSync(voll).isDirectory()) alleDateien(voll, endung, gesammelt);
    else if (eintrag.endsWith(endung)) gesammelt.push(voll);
  }
  return gesammelt;
}

const stellen = [];
for (const ordner of [path.join(WURZEL, 'booth', 'src'), path.join(WURZEL, 'youbooth', 'src')]) {
  for (const datei of [...alleDateien(ordner, '.css'), ...alleDateien(ordner, '.astro')]) {
    if (datei.endsWith(path.join('styles', 'tokens.css'))) continue;
    const text = readFileSync(datei, 'utf8');
    // Eigene Token-Definitionen mit hartem Farbwert
    for (const t of text.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
      stellen.push(`${path.relative(WURZEL, datei)}: ${t[1]}: ${t[2]}`);
    }
    /* Und der zweite Weg, auf dem ein zweites System entsteht: nicht ein
       eigener Token, sondern ein Hexwert direkt an der Eigenschaft. Davon
       lagen 96 in den sechs Stilblättern der Software — die dunklen
       Zustandsfarben allein in neun verschiedenen Tönen. */
    for (const t of text.matchAll(
      /\b(background|background-color|color|border-color|fill|stroke|outline-color):\s*(#[0-9a-fA-F]{3,8})\b/g
    )) {
      stellen.push(`${path.relative(WURZEL, datei)}: ${t[1]}: ${t[2]}`);
    }
  }
}
pruefe('Keine Oberfläche definiert eigene Farbwerte als Token',
  stellen.length === 0, stellen.slice(0, 8).join(' | ') + (stellen.length > 8 ? ` … (${stellen.length})` : ''));

console.log('\n3 · Beide Projekte lesen dieselbe Datei');
const website = readFileSync(path.join(WURZEL, 'youbooth', 'src', 'styles', 'tokens.css'), 'utf8');
const software = readFileSync(path.join(WURZEL, 'booth', 'src', 'stil.css'), 'utf8');
pruefe('Die Website importiert gestaltung/tokens.css', website.includes('gestaltung/tokens.css'));
pruefe('Die Software importiert gestaltung/tokens.css', software.includes('gestaltung/tokens.css'));
pruefe('Die Software hält keinen eigenen Farbsatz mehr',
  !/--amber:\s*#/.test(software), 'im :root der Software steht noch --amber');

console.log('\n4 · Kein Tokenwert steht ein zweites Mal irgendwo');
/* Der Hexwert war nur der offensichtliche Weg. Zwei weitere sind uns durch
   die Finger gegangen:
     · `rgba(242, 178, 62, 0.12)` in einem Stilblatt — dasselbe Amber, nur
       als Zahlen. Wer `--amber` ändert, ändert das nicht mit.
     · `stift.fillStyle = '#f2b23e'` in einer Zeichenfläche. Canvas kennt
       keine CSS-Variablen, also stand der Wert dort abgeschrieben — im
       fertigen Video eines gesprochenen Grußes.
   Gesucht wird deshalb nach dem WERT, nicht nach der Schreibweise, und in
   TypeScript ebenso wie in CSS. Echtes Schwarz und echtes Weiß bleiben
   erlaubt: Ein Schattenwurf ist Physik, keine Hausfarbe. */
const tokenwerte = new Map();
/* Reines Schwarz und reines Weiß gehören keiner Palette. Ein Schattenwurf,
   der Rand eines Blitzes, das Papier eines Abzugs — das sind Naturgesetze
   und Material, nicht Hausfarben, und sie blieben dieselben, wenn das ganze
   System morgen grün wäre. Sie hier mitzuzählen ergäbe hundert Funde, in
   denen die drei echten untergingen. */
const NEUTRAL = new Set(['#ffffff', '#000000', '255, 255, 255', '0, 0, 0']);
for (const t of quelle.matchAll(/(--[a-z0-9-]+):\s*#([0-9a-fA-F]{6})\s*;/g)) {
  const [, name, hex] = t;
  const zahlen = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
  if (NEUTRAL.has('#' + hex.toLowerCase())) continue;
  if (!tokenwerte.has(zahlen)) tokenwerte.set(zahlen, name);
  if (!tokenwerte.has('#' + hex.toLowerCase())) tokenwerte.set('#' + hex.toLowerCase(), name);
}

/* Es gibt echte Ausnahmen, und sie sollen sichtbar bleiben statt in einer
   Liste in dieser Probe zu verschwinden: Eine Datei darf `gestaltung: eigene
   Palette` samt Grund im Kopf tragen, dann wird sie übersprungen — und hier
   trotzdem AUFGEZÄHLT. Eine Ausnahme, die niemand mehr sieht, ist keine
   Ausnahme, sondern ein Leck. */
const AUSNAHME = /gestaltung:\s*eigene Palette\s*—\s*([^\n*]+)/;
const ausnahmen = [];

const doppelt = [];
for (const ordner of [path.join(WURZEL, 'booth', 'src'), path.join(WURZEL, 'youbooth', 'src')]) {
  const dateien = [
    ...alleDateien(ordner, '.css'),
    ...alleDateien(ordner, '.astro'),
    ...alleDateien(ordner, '.ts'),
  ];
  for (const datei of dateien) {
    if (datei.endsWith(path.join('styles', 'tokens.css'))) continue;
    const text = readFileSync(datei, 'utf8');
    const kurz = path.relative(WURZEL, datei);
    const erlaubt = text.match(AUSNAHME);
    if (erlaubt) {
      ausnahmen.push(`${kurz} — ${erlaubt[1].trim()}`);
      continue;
    }

    for (const t of text.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
      const zahlen = `${Number(t[1])}, ${Number(t[2])}, ${Number(t[3])}`;
      const name = tokenwerte.get(zahlen);
      if (name) doppelt.push(`${kurz}: rgba(${zahlen}…) ist ${name}`);
    }
    /* Hexwerte in TypeScript. In CSS fängt sie schon Abschnitt 2 ab. */
    if (datei.endsWith('.ts')) {
      for (const t of text.matchAll(/['"`](#[0-9a-fA-F]{6})['"`]/g)) {
        const name = tokenwerte.get(t[1].toLowerCase());
        if (name) doppelt.push(`${kurz}: ${t[1]} ist ${name}`);
      }
    }
  }
}
pruefe(`Kein Gestaltungswert ist irgendwo abgeschrieben (${doppelt.length} Funde)`,
  doppelt.length === 0, doppelt.slice(0, 6).join(' | '));
console.log(`  · ${ausnahmen.length} Dateien mit erklärter eigener Palette:`);
ausnahmen.forEach((a) => console.log(`      ${a}`));

console.log('\n5 · Schrift kommt auch auf der Zeichenfläche aus der Quelle');
/* Ein `stift.font = '500 22px "IBM Plex Mono"…'` überlebt jeden
   Schriftwechsel — und niemand sieht es, weil es nur in einem Video steht. */
const schriftfunde = [];
for (const ordner of [path.join(WURZEL, 'booth', 'src'), path.join(WURZEL, 'youbooth', 'src')]) {
  for (const datei of alleDateien(ordner, '.ts')) {
    const text = readFileSync(datei, 'utf8');
    for (const t of text.matchAll(/\.font\s*=\s*[^;\n]*(Archivo|IBM Plex|system-ui|ui-monospace)/g)) {
      schriftfunde.push(`${path.relative(WURZEL, datei)}: ${t[0].slice(0, 60)}`);
    }
  }
}
pruefe(`Keine Schriftfamilie steht in einer Zeichenfläche fest (${schriftfunde.length})`,
  schriftfunde.length === 0, schriftfunde.slice(0, 4).join(' | '));

console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
