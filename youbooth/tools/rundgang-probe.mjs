/**
 * Der Rundgang über die Website — alle Seiten einmal von vorn.
 *
 * Die anderen Proben messen je einen Bereich in der Tiefe: die Hülle, die
 * Bausteine, die Startseite, die Rechtstexte. Diese hier geht in die Breite
 * und öffnet JEDE gebaute Seite. Gesucht wird, was einzelne Proben
 * systematisch übersehen:
 *
 *   · eine Seite, die beim Laden einen Fehler wirft
 *   · ein Bild, das im Quelltext steht und am Bildschirm fehlt
 *   · ein Verweis ins Leere — die häufigste Panne einer 50-Seiten-Site
 *   · eine Seite ohne Titel, ohne H1 oder ohne Beschreibung
 *   · ein Knopf oder Aufklapper, der beim Drücken die Seite zerlegt
 *
 * Gemessen wird gegen die GEBAUTE Site (`npm run build && npm run preview`),
 * nicht gegen den Entwicklungsserver: Dort fehlen Minimierung und
 * Seitenerzeugung, und genau darin steckt die Hälfte der Fehler.
 *
 *   node tools/rundgang-probe.mjs
 */

import { chromium } from 'playwright-core';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BASIS = process.env.YOUBOOTH_SITE || 'http://localhost:4321';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

/** Alle Wege aus dem gebauten Verzeichnis — nicht aus einer gepflegten Liste.
    Eine Liste vergisst genau die Seite, die neu dazugekommen ist. */
function wege(ordner = 'dist', vorsatz = '') {
  const gefunden = [];
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag.startsWith('_') || eintrag === 'assets') continue;
    const voll = join(ordner, eintrag);
    if (statSync(voll).isDirectory()) {
      gefunden.push(...wege(voll, `${vorsatz}/${eintrag}`));
    } else if (eintrag === 'index.html') {
      gefunden.push(vorsatz || '/');
    }
  }
  return gefunden;
}

const seiten = wege().sort();
console.log(`\n${seiten.length} Seiten gefunden.\n`);

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const kontext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const s = await kontext.newPage();

const alleFehler = [];
const alleBilder = [];
const alleVerweise = [];
const ohneKopf = [];
const geprueft = new Map();

for (const weg of seiten) {
  const fehler = [];
  s.removeAllListeners('pageerror');
  s.removeAllListeners('console');
  s.on('pageerror', (e) => fehler.push(String(e).split('\n')[0].slice(0, 110)));
  s.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/i.test(m.text())) return;
    fehler.push(m.text().slice(0, 110));
  });

  await s.goto(BASIS + weg, { waitUntil: 'networkidle' }).catch(() => undefined);

  /* Durchscrollen, damit alles lädt, was erst beim Sichtbarwerden lädt —
     und damit Animationen, die beim Scrollen auslösen, einmal gelaufen sind. */
  await s.evaluate(async () => {
    const hoehe = document.documentElement.scrollHeight;
    for (let y = 0; y < hoehe; y += window.innerHeight * 0.8) {
      window.scrollTo(0, y);
      await new Promise((f) => setTimeout(f, 90));
    }
    window.scrollTo(0, 0);
  });
  await s.waitForTimeout(500);

  const kopf = await s.evaluate(() => ({
    titel: document.title,
    beschreibung: document.querySelector('meta[name="description"]')?.content || '',
    /* Nur Überschriften, die zur Gliederung gehören. Das Typo-Musterstück
       im Design-System zeigt ein echtes H1, ist aber keins — es trägt
       `role="presentation"` und zählt hier zu Recht nicht mit. */
    h1: [...document.querySelectorAll('h1:not([role="presentation"])')].map((h) =>
      h.textContent.trim()
    ),
    text: document.body.innerText.trim().length,
  }));

  const bilder = await s.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ({
        quelle: (b.currentSrc || b.src || '').slice(0, 80),
        breit: b.naturalWidth,
        fertig: b.complete,
        alt: b.getAttribute('alt'),
      }))
  );
  const kaputt = bilder.filter((b) => b.quelle && b.fertig && b.breit === 0);
  const ohneAlt = bilder.filter((b) => b.alt === null);

  const ziele = await s.evaluate(() =>
    [...document.querySelectorAll('a[href]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && !/^(https?:|mailto:|tel:|#|data:)/.test(h))
  );
  const tot = [];
  for (const ziel of new Set(ziele)) {
    /* `/dl/…` liefert im Betrieb Wix aus, nicht diese Site: Der Installer
       ist eine 120-MB-Datei, die nicht in ein statisches Verzeichnis gehört.
       Auf der Vorschau gibt es sie deshalb nicht — ein 404 hier ist kein
       toter Verweis, sondern ein Weg, der woanders endet. Geprüft wird er
       von `dl-probe.mjs` gegen den echten Host. */
    if (ziel.startsWith('/dl/')) continue;
    const adresse = new URL(ziel, BASIS + weg).toString();
    if (geprueft.has(adresse)) {
      if (geprueft.get(adresse) >= 400) tot.push(`${ziel} (${geprueft.get(adresse)})`);
      continue;
    }
    const antwort = await fetch(adresse).catch(() => null);
    const stand = antwort?.status ?? 0;
    geprueft.set(adresse, stand);
    if (stand >= 400 || stand === 0) tot.push(`${ziel} (${stand || 'weg'})`);
  }

  /* Aufklapper und Knöpfe einmal betätigen. Auf dieser Site sind das vor
     allem `<details>` in Hilfe und Ratgeber sowie der Rechner — genau dort
     steckt das Javascript, das ohne Klick nie läuft. */
  const knoepfe = await s.locator('button:visible').count();
  for (let i = 0; i < Math.min(knoepfe, 25); i++) {
    await s.locator('button:visible').nth(i).click({ timeout: 1500 }).catch(() => undefined);
    await s.waitForTimeout(90);
  }
  const klappen = await s.locator('summary:visible').count();
  for (let i = 0; i < Math.min(klappen, 25); i++) {
    await s.locator('summary:visible').nth(i).click({ timeout: 1500 }).catch(() => undefined);
    await s.waitForTimeout(60);
  }
  await s.waitForTimeout(300);

  const gut =
    fehler.length === 0 && kaputt.length === 0 && tot.length === 0 &&
    kopf.titel.length > 3 && kopf.beschreibung.length > 20 && kopf.h1.length === 1 &&
    kopf.text > 200 && ohneAlt.length === 0;

  pruefe(
    `${weg}  ·  ${bilder.length} Bilder, ${new Set(ziele).size} Verweise, ` +
      `${knoepfe} Knöpfe, ${klappen} Klappen`,
    gut,
    [
      fehler.length ? `Fehler: ${fehler[0]}` : '',
      kaputt.length ? `Bild kaputt: ${kaputt[0].quelle}` : '',
      tot.length ? `tot: ${tot.join(', ')}` : '',
      kopf.h1.length !== 1 ? `H1-Zahl ${kopf.h1.length}` : '',
      kopf.beschreibung.length <= 20 ? 'ohne Beschreibung' : '',
      ohneAlt.length ? `${ohneAlt.length} Bilder ohne alt` : '',
      kopf.text <= 200 ? `nur ${kopf.text} Zeichen` : '',
    ].filter(Boolean).join(' · ')
  );

  if (fehler.length) alleFehler.push(`${weg}: ${fehler[0]}`);
  if (kaputt.length) alleBilder.push(`${weg}: ${kaputt.map((b) => b.quelle).join(', ')}`);
  if (tot.length) alleVerweise.push(`${weg}: ${tot.join(', ')}`);
  if (kopf.h1.length !== 1 || kopf.beschreibung.length <= 20) {
    ohneKopf.push(`${weg}: ${kopf.h1.length} H1, Beschreibung ${kopf.beschreibung.length} Zeichen`);
  }
}

await browser.close();

console.log('\n── Rundgang ──────────────────────────────────────────');
if (alleFehler.length) console.log('Fehler:\n  ' + alleFehler.join('\n  '));
if (alleBilder.length) console.log('Bilder:\n  ' + alleBilder.join('\n  '));
if (alleVerweise.length) console.log('Verweise:\n  ' + alleVerweise.join('\n  '));
if (ohneKopf.length) console.log('Kopfdaten:\n  ' + ohneKopf.join('\n  '));
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
