#!/usr/bin/env node
// Legt Entwürfe zur blinden Bewertung nebeneinander.
//
//   node blindvergleich.mjs varianten/*.png --out .blind
//   node blindvergleich.mjs a.png b.png c.png --seed 7 --titel "Kopfbereich Saalwerk"
//
// Erzeugt: <out>/A.png, B.png … (umbenannte Kopien, ohne verräterische Namen)
//          <out>/blatt.html    — alle nebeneinander, zum Ansehen
//          <out>/schluessel.txt — Zuordnung, erst NACH der Bewertung öffnen
//
// Sinn der Sache: Wer weiß, welcher Entwurf der eigene dritte Versuch war,
// bewertet ihn nicht mehr. Auch der Kritiker-Subagent nicht — er sieht sonst
// an Dateinamen und Reihenfolge, was er sehen soll. Die Umbenennung ist kein
// Zierrat, sie ist der ganze Zweck.

import fs from 'node:fs';
import path from 'node:path';

// Kleiner deterministischer Generator: gleicher Startwert, gleiche Reihenfolge.
const mischer = (startwert) => () => {
  startwert |= 0; startwert = (startwert + 0x6D2B79F5) | 0;
  let t = Math.imul(startwert ^ (startwert >>> 15), 1 | startwert);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function mischen(liste, startwert) {
  const zufall = mischer(startwert);
  const kopie = liste.slice();
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

const argumente = process.argv.slice(2);
const wert = (name, ersatz) => {
  const i = argumente.indexOf(name);
  return i >= 0 ? argumente[i + 1] : ersatz;
};
const ausgabe = path.resolve(wert('--out', '.blind'));
const titel = wert('--titel', 'Blindvergleich');
const startwert = Number(wert('--seed', '')) || null;
const dateien = argumente.filter((a, i) => {
  if (a.startsWith('--')) return false;
  return !['--out', '--titel', '--seed'].some((flagge) => argumente[i - 1] === flagge);
});

if (dateien.length < 2) {
  console.log('Aufruf: node blindvergleich.mjs <bild> <bild> [...] [--out .blind] [--titel "…"] [--seed 7]');
  process.exit(2);
}
for (const datei of dateien) {
  if (!fs.existsSync(datei)) { console.error(`Nicht gefunden: ${datei}`); process.exit(2); }
}

// Ohne ausdrücklichen Startwert einen aus den Dateinamen ableiten — damit
// derselbe Satz Entwürfe immer gleich gemischt wird und ein zweiter Aufruf
// nicht heimlich eine neue Reihenfolge erzeugt.
const abgeleitet = dateien.slice().sort().join('|')
  .split('').reduce((h, z) => (Math.imul(h ^ z.charCodeAt(0), 16777619) | 0), 2166136261);
const gemischt = mischen(dateien, startwert ?? abgeleitet);
const buchstaben = gemischt.map((_, i) => String.fromCharCode(65 + i));

fs.rmSync(ausgabe, { recursive: true, force: true });
fs.mkdirSync(ausgabe, { recursive: true });
gemischt.forEach((datei, i) => {
  fs.copyFileSync(datei, path.join(ausgabe, `${buchstaben[i]}${path.extname(datei)}`));
});

const bilder = gemischt.map((datei, i) => `
  <figure>
    <figcaption>${buchstaben[i]}</figcaption>
    <img src="${buchstaben[i]}${path.extname(datei)}" alt="Entwurf ${buchstaben[i]}">
  </figure>`).join('');

fs.writeFileSync(path.join(ausgabe, 'blatt.html'), `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${titel}</title>
<style>
  body{margin:0;padding:2rem;background:#1a1a1a;color:#e8e4dd;
       font:16px/1.5 ui-monospace,monospace}
  h1{font-size:1rem;letter-spacing:.12em;text-transform:uppercase;font-weight:400;opacity:.6;margin:0 0 2rem}
  .reihe{display:flex;gap:1.5rem;align-items:flex-start;overflow-x:auto;padding-bottom:2rem}
  figure{margin:0;flex:0 0 auto;width:min(46vw,640px)}
  figcaption{font-size:2rem;line-height:1;margin-bottom:.75rem;opacity:.9}
  img{width:100%;height:auto;display:block;background:#fff;border:1px solid #333}
  p{opacity:.5;max-width:70ch}
</style></head>
<body>
  <h1>${titel} — ${gemischt.length} Entwürfe</h1>
  <div class="reihe">${bilder}</div>
  <p>Reihenfolge bewerten, dann erst schluessel.txt öffnen.</p>
</body></html>
`);

fs.writeFileSync(path.join(ausgabe, 'schluessel.txt'),
  `${titel}\nErst nach der Bewertung lesen.\n\n` +
  gemischt.map((datei, i) => `${buchstaben[i]} = ${path.resolve(datei)}`).join('\n') + '\n');

console.log(`${gemischt.length} Entwürfe anonymisiert → ${ausgabe}`);
console.log(`Ansehen:  ${path.join(ausgabe, 'blatt.html')}`);
console.log(`Einzeln:  ${buchstaben.map((b) => path.join(ausgabe, b + '.png')).join(', ')}`);
console.log(`Schlüssel liegt in schluessel.txt — nicht vor der Bewertung öffnen.`);
