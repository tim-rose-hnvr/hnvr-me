/**
 * Prüft die gebaute Seite auf tote Wege.
 *
 * Der Grund ist ein Fehler, der beim Bauen nicht auffällt: Astro setzt
 * den Basispfad NICHT vor geschriebene Wege. Unter einem
 * Unterverzeichnis kommt die Seite dann mit 200 und jeder Verweis
 * darin ist tot — sichtbar erst im Browser, und auch dort erst beim
 * Klicken.
 *
 * Geprüft wird deshalb dreierlei:
 *   1. Jeder interne Weg trägt den Basispfad.
 *   2. Er zeigt auf eine Seite oder eine Datei, die es gibt.
 *   3. Jeder Anker steht wirklich in der Zielseite.
 *
 * Aufruf:  BASIS=/hnvr-me node skripte/wege-pruefen.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';

const basis = (process.env.BASIS ?? '').replace(/\/$/, '');
const wurzel = 'dist';

function alleDateien(ordner) {
  return readdirSync(ordner).flatMap((e) => {
    const p = join(ordner, e);
    return statSync(p).isDirectory() ? alleDateien(p) : [p];
  });
}

const seiten = new Map();
for (const datei of alleDateien(wurzel).filter((d) => d.endsWith('.html'))) {
  const rel = '/' + relative(wurzel, dirname(datei)).replaceAll('\\', '/');
  seiten.set(rel === '/.' ? '/' : rel, readFileSync(datei, 'utf8'));
}

const fehler = [];
for (const [weg, inhalt] of seiten) {
  const ziele = new Set([...inhalt.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((m) => m[1]));
  for (const ziel of ziele) {
    if (basis && !ziel.startsWith(basis + '/') && ziel !== basis) {
      fehler.push(`${weg} → ${ziel} (ohne Basispfad ${basis})`);
      continue;
    }
    const rest = (basis ? ziel.slice(basis.length) : ziel) || '/';
    const [pfadRoh, anker] = rest.split('#');
    const pfad = pfadRoh.replace(/\/$/, '') || '/';

    if (seiten.has(pfad)) {
      if (anker && !seiten.get(pfad).includes(`id="${anker}"`)) {
        fehler.push(`${weg} → ${ziel} (Anker fehlt)`);
      }
      continue;
    }
    if (!existsSync(join(wurzel, pfad))) {
      fehler.push(`${weg} → ${ziel} (weder Seite noch Datei)`);
    }
  }
}

console.log(`${seiten.size} Seiten geprüft, Basispfad ${basis || '/'}`);
if (fehler.length) {
  console.error('Tote Wege:');
  for (const f of fehler) console.error('  ' + f);
  process.exit(1);
}
console.log('kein toter Weg');
