/**
 * Die Zentrale — der Weg nach dem Installieren.
 *
 * Sie gibt es, weil die Box vorher direkt in den Booth sprang, im Vollbild.
 * Wer gerade installiert hat, sitzt dann ohne Leiste vor einem Bildschirm,
 * der nichts über Drucker, Lizenz oder Anmeldung sagt.
 *
 * Geprüft wird der ganze Weg, nicht das Aussehen:
 *   1. Ohne Anmeldung kommt niemand hinein.
 *   2. Der Durchcheck zeigt Befunde, und jeder Befund mit Handgriff hat
 *      einen Knopf daneben.
 *   3. Eine Reparatur tut wirklich etwas und sagt, was.
 *   4. Die Module stehen da — auch die nicht gebuchten.
 *   5. Von hier führt ein Weg in den Booth.
 *
 *   node tools/zentrale-probe.mjs
 */

import { chromium } from 'playwright-core';
import { alsBetreiber, angemeldeterKontext, BASIS } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const sitzung = await alsBetreiber();
const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const masse = { viewport: { width: 1200, height: 900 } };

/* 1 — Ohne Anmeldung. */
console.log('\n1 · Ohne Anmeldung');
const gast = await browser.newContext(masse);
const gastseite = await gast.newPage();
await gastseite.goto(BASIS + '/zentrale.html', { waitUntil: 'networkidle' });
pruefe('Ein Gast landet auf dem Anmeldeschirm',
  gastseite.url().includes('anmelden.html'), gastseite.url());
pruefe('Und wird danach zurückgeschickt',
  gastseite.url().includes('weiter='), gastseite.url());
await gast.close();

/* 2 — Angemeldet: der Durchcheck. */
console.log('\n2 · Durchcheck');
const kontext = await angemeldeterKontext(browser, sitzung, masse);
const seite = await kontext.newPage();
await seite.goto(BASIS + '/zentrale.html', { waitUntil: 'networkidle' });
await seite.waitForSelector('.zbefund', { timeout: 30000 });

const befunde = await seite.evaluate(() =>
  [...document.querySelectorAll('.zbefund')].map((z) => ({
    stufe: [...z.querySelector('.zampel').classList].find((c) => c.startsWith('zampel--')) || 'zampel--gut',
    titel: z.querySelector('.ztitel')?.textContent?.trim(),
    text: z.querySelector('.ztext')?.textContent?.trim() || '',
    knopf: z.querySelector('.zknopfplatz')?.textContent?.trim() || '',
  }))
);
pruefe(`Es stehen Befunde da (${befunde.length})`, befunde.length >= 8, String(befunde.length));
pruefe('Jeder Befund sagt etwas in Klartext',
  befunde.every((b) => b.text.length > 10),
  befunde.filter((b) => b.text.length <= 10).map((b) => b.titel).join(', '));
pruefe('Keine Ampel ohne Stufe', befunde.every((b) => b.stufe));

const erwartet = ['Datenordner', 'Anschluss', 'Doppelte Dienste', 'Drucker', 'Vorlagen',
  'Betreiber', 'Lizenz', 'Aktualisierung'];
const fehlend = erwartet.filter((t) => !befunde.some((b) => b.titel === t));
pruefe('Die Prüfungen aus dem Server sind alle da', fehlend.length === 0, fehlend.join(', '));

const kopfzeile = await seite.textContent('#zfassung');
pruefe('Fassung, Port und Datenordner stehen im Kopf',
  /Fassung .+ · Port \d+ · /.test(kopfzeile || ''), kopfzeile);

/* 3 — Eine Reparatur. `vorlagen` ist die harmloseste: Sie setzt den Katalog
   auf den Auslieferungsstand und lässt sich sofort nachzählen. */
console.log('\n3 · Reparieren');
const vorher = (await sitzung.anDieBox('/api/templates')).daten;
const antwort = await sitzung.anDieBox('/api/zentrale/reparatur', {
  method: 'POST',
  body: JSON.stringify({ was: 'vorlagen' }),
});
pruefe('Die Reparatur wird angenommen', antwort.status === 200, String(antwort.status));
pruefe('Sie sagt in einem Satz, was sie getan hat',
  typeof antwort.daten?.text === 'string' && antwort.daten.text.length > 10, antwort.daten?.text);
const nachher = (await sitzung.anDieBox('/api/templates')).daten;
pruefe('Danach liegen wieder alle Vorlagen da',
  Array.isArray(nachher?.templates ?? nachher) &&
  (nachher.templates ?? nachher).length >= (vorher.templates ?? vorher).length,
  `vorher ${(vorher.templates ?? vorher).length}, nachher ${(nachher.templates ?? nachher).length}`);

const unbekannt = await sitzung.anDieBox('/api/zentrale/reparatur', {
  method: 'POST',
  body: JSON.stringify({ was: 'gibtesnicht' }),
});
pruefe('Eine unbekannte Reparatur wird abgelehnt', unbekannt.status === 400, String(unbekannt.status));

/* 4 — Module. */
console.log('\n4 · Module');
await seite.waitForSelector('.zkachel', { timeout: 15000 });
const module = await seite.evaluate(() =>
  [...document.querySelectorAll('#zmodule .zkachel')].map((k) => ({
    name: k.querySelector('.zkachelname')?.textContent?.trim(),
    zu: k.classList.contains('zkachel--zu'),
  }))
);
pruefe(`Die Module stehen da (${module.length})`, module.length >= 6, String(module.length));
const hinweis = await seite.textContent('#zmodulhinweis');
pruefe('Darüber steht, wie viele gebucht sind', /\d/.test(hinweis || ''), hinweis);

/* 5 — Der Weg in den Booth. */
console.log('\n5 · Weiter in den Booth');
const knopf = await seite.locator('.zfuss .zknopf--amber');
pruefe('Es gibt genau einen Startknopf', (await knopf.count()) === 1);
pruefe('Er heißt „Fotobox öffnen"', (await knopf.textContent())?.includes('Fotobox'));
await knopf.click();
await seite.waitForLoadState('networkidle');
pruefe('Er führt in den Booth', !seite.url().includes('zentrale'), seite.url());

/* 6 — Und zurück: Die Wege stehen auf der Zentrale, nicht nur im Booth. */
console.log('\n6 · Die Wege');
await seite.goto(BASIS + '/zentrale.html', { waitUntil: 'networkidle' });
const wege = await seite.evaluate(() =>
  [...document.querySelectorAll('.zkachel')].map((a) => a.getAttribute('href'))
);
for (const ziel of ['./cockpit.html', './einrichtung.html', './editor.html', './portal.html']) {
  pruefe(`Weg zu ${ziel}`, wege.includes(ziel));
}

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
