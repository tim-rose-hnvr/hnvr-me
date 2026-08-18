/**
 * Ganzseitige Aufnahmen der Hauptseiten — zum Ansehen, ohne die Seite zu starten.
 *
 *   npm run build && npx astro preview --port 4321   (in einem zweiten Fenster)
 *   node tools/seitenschuesse.mjs [ordner]
 *
 * Warum ein Werkzeug und keine abgelegten Bilder: Ganzseitige Aufnahmen einer
 * 50-Seiten-Site wiegen mehrere Megabyte und sind am Tag nach der nächsten
 * Änderung falsch. Abgeleitetes gehört nicht in die Versionsverwaltung — der
 * Weg dorthin schon.
 *
 * Vor dem Auslösen wird einmal durchgescrollt: Was erst beim Scrollen
 * eingeblendet wird, fehlt sonst im Bild.
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const ORDNER = process.argv[2] || path.join('..', 'doku', 'seite');
const ADRESSE = process.env.YOUBOOTH_SEITE || 'http://localhost:4321';
const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';

const SEITEN = [
  ['startseite', '/'],
  ['module', '/module/'],
  ['preise', '/preise/'],
  ['vorlagen-galerie', '/vorlagen/'],
  ['vorlagen-prinzip', '/vorlagen/system/'],
  ['system', '/system/'],
  ['ueber-uns', '/team/'],
  ['referenzen', '/referenzen/'],
  ['download', '/download/'],
];

mkdirSync(ORDNER, { recursive: true });

const browser = await chromium.launch({ executablePath: BROWSER });
const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const [name, pfad] of SEITEN) {
  await seite.goto(ADRESSE + pfad, { waitUntil: 'networkidle' });
  await seite.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 80));
    }
    window.scrollTo(0, 0);
  });
  await seite.waitForTimeout(500);

  const datei = path.join(ORDNER, name + '.png');
  await seite.screenshot({ path: datei, fullPage: true });

  // Waagerechtes Scrollen ist auf jeder Seite ein Fehler — hier fällt es auf,
  // weil ohnehin jede Seite einmal geladen wird.
  const quer = await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  console.log(`${quer ? '✗' : '·'} ${name.padEnd(18)} ${datei}${quer ? '  (scrollt waagerecht!)' : ''}`);
}

await browser.close();
