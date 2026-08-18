/**
 * Die gezeichneten Vorlagen — zeichnen sie wirklich?
 *
 * 22 Vorlagen tragen keinen Schmuck als Bild, sondern als Namen: `deko`. Die
 * Formen entstehen erst beim Zeichnen. Das ist sparsam und scharf in jeder
 * Größe, hat aber einen Preis: Ein Tippfehler im Namen fällt nicht auf, es
 * fehlt nur der Kranz. Deshalb wird hier gemessen statt vermutet.
 *
 * Geprüft wird dreierlei:
 *   · Kennt der Server jede Dekoart, die der Katalog benutzt? Zwei Listen
 *     derselben Sache laufen sonst auseinander.
 *   · Zeichnet jede Verzierung überhaupt etwas — also unterscheidet sich das
 *     Blatt mit vom Blatt ohne?
 *   · Bleibt sie bei gleichen Daten gleich? Eine Vorschau, die anders aussieht
 *     als der Druck, wäre schlimmer als gar keine.
 *
 *   node tools/deko-probe.mjs
 */

import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { alsBetreiber, angemeldeterKontext } from './betreiber.mjs';

/* Gezeichnet wird gegen den Entwicklungsserver: Nur dort liegt `vorlage.ts`
   als Quelltext, den der Browser laden kann. Im Paket ist es ein Bündel mit
   gewürfeltem Namen — dieselbe Datei, nur nicht einzeln ansprechbar. */
const OBERFLAECHE = process.env.YOUBOOTH_DEV || 'http://localhost:4400';

const KATALOG = JSON.parse(readFileSync(new URL('../vorlagen-katalog.json', import.meta.url), 'utf8'));
const SERVERTEXT = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) {
    bestanden++;
    console.log(`  ✓ ${satz}`);
  } else {
    gefallen++;
    console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`);
  }
};

/* 1 — Die beiden Listen gegeneinander. */
console.log('\n1 · Server und Katalog kennen dieselben Dekoarten');
const serverListe = new Set(
  (SERVERTEXT.match(/const DEKOARTEN = \[([\s\S]*?)\];/)?.[1] ?? '')
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean)
);
const imKatalog = [...new Set(KATALOG.map((v) => v.deko).filter(Boolean))];
pruefe(`Der Katalog benutzt ${imKatalog.length} Dekoarten`, imKatalog.length >= 18, String(imKatalog.length));
const unbekannt = imKatalog.filter((d) => !serverListe.has(d));
pruefe('Der Server kennt jede davon', unbekannt.length === 0, unbekannt.join(', '));

const mitDeko = KATALOG.filter((v) => v.deko);
console.log(`\n2 · ${mitDeko.length} Vorlagen zeichnen`);

const sitzung = await alsBetreiber();
const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const kontext = await angemeldeterKontext(browser, sitzung, { viewport: { width: 1200, height: 800 } });
const seite = await kontext.newPage();
await seite.goto(OBERFLAECHE + '/editor.html', { waitUntil: 'networkidle' });

/* Der Editor lädt das Vorlagenmodul bereits — wir zeichnen im selben Fenster,
   damit Schriften und Farben genau die sind, die auch drucken. */
const ergebnis = await seite.evaluate(async (vorlagen) => {
  const { zeichneVorlage, werteJetzt } = await import('/src/vorlage.ts');
  const werte = werteJetzt('Anna & Ben', 'Box 1', 7);

  const summe = (leinwand) => {
    const stift = leinwand.getContext('2d');
    const d = stift.getImageData(0, 0, leinwand.width, leinwand.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 4) s = (s * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 4294967296;
    return s;
  };

  const aus = [];
  for (const v of vorlagen) {
    try {
      const mit = summe(zeichneVorlage(v, [], werte));
      const ohne = summe(zeichneVorlage({ ...v, deko: undefined }, [], werte));
      const nochmal = summe(zeichneVorlage(v, [], werte));
      aus.push({ id: v.id, deko: v.deko, mit, ohne, nochmal });
    } catch (fehler) {
      aus.push({ id: v.id, deko: v.deko, fehler: String(fehler && fehler.message) });
    }
  }
  return aus;
}, mitDeko);

const kaputt = ergebnis.filter((e) => e.fehler);
pruefe('Keine Vorlage wirft beim Zeichnen', kaputt.length === 0,
  kaputt.map((k) => k.id + ': ' + k.fehler).join(' | '));

const stumm = ergebnis.filter((e) => !e.fehler && e.mit === e.ohne);
pruefe('Jede Verzierung verändert das Blatt sichtbar', stumm.length === 0,
  stumm.map((s) => s.id + ' (' + s.deko + ')').join(', '));

const wackelig = ergebnis.filter((e) => !e.fehler && e.mit !== e.nochmal);
pruefe('Zweimal gezeichnet ergibt dasselbe Blatt', wackelig.length === 0,
  wackelig.map((w) => w.id).join(', '));

/* 3 — Jede Dekoart mindestens einmal wirklich benutzt. */
console.log('\n3 · Keine Verzierung liegt brach');
const benutzt = new Set(mitDeko.map((v) => v.deko));
const brach = [...serverListe].filter((d) => !benutzt.has(d));
pruefe('Jede Dekoart kommt in mindestens einer Vorlage vor', brach.length === 0, brach.join(', '));

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
