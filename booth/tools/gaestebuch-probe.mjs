/**
 * Das Gästebuch — Schreiben und die Zettelwand.
 *
 * Die Box nahm Einträge seit Langem entgegen, es gab nur nichts, worin man
 * schreiben konnte. Genau das ist der Unterschied zwischen „die Box kann es"
 * und „der Gast kann es" — und deshalb wird hier der ganze Weg gemessen:
 * schreiben, ankommen, auf der Wand erscheinen, und zwar ohne Neuladen.
 *
 *   node tools/gaestebuch-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS, alsBetreiber } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});

/* Das Handy eines Gastes — schmal, wie es wirklich ist. */
const handy = await browser.newContext({ viewport: { width: 390, height: 844 } });
const gast = await handy.newPage();

/* Der Beamer im Saal. */
const saal = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const wand = await saal.newPage();

console.log('\n1 · Die Schreibseite auf dem Handy');
await gast.goto(BASIS + '/gaestebuch.html', { waitUntil: 'networkidle' });
await gast.waitForTimeout(600);

pruefe('Sie ist ohne Anmeldung erreichbar', !gast.url().includes('anmelden'), gast.url());
pruefe('Es gibt ein Feld für den Namen', await gast.locator('.gbeingabe').count() === 1);
pruefe('Und eines für die Nachricht', await gast.locator('.gbtext').count() === 1);

const masse = await gast.evaluate(() => {
  const el = [...document.querySelectorAll('input, textarea, button')].filter((e) => e.offsetParent);
  return el.map((e) => ({ t: e.tagName, h: Math.round(e.getBoundingClientRect().height) }));
});
const klein = masse.filter((m) => m.h < 44);
pruefe('Alle Felder und Knöpfe sind mindestens 44px hoch', klein.length === 0,
  klein.map((k) => `${k.t}:${k.h}`).join(', '));

pruefe('Die Seite scrollt nicht seitlich',
  await gast.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

console.log('\n2 · Ein leerer Zettel wird abgewiesen');
await gast.click('.gbsenden');
await gast.waitForTimeout(400);
pruefe('Es kommt eine Meldung', await gast.locator('.gbmeldung:visible').count() === 1);
pruefe('Und sie sagt, was fehlt',
  /schreib|leer/i.test((await gast.textContent('.gbmeldung')) || ''),
  await gast.textContent('.gbmeldung'));

console.log('\n3 · Die Wand steht bereit');
await wand.goto(BASIS + '/zettelwand.html', { waitUntil: 'networkidle' });
await wand.waitForTimeout(800);
const vorher = await wand.locator('.gbzettel').count();
pruefe('Sie zeigt keine Bedienelemente', await wand.locator('button:visible, a:visible').count() === 0,
  String(await wand.locator('button:visible, a:visible').count()));

console.log('\n4 · Schreiben und ankommen');
const spruch = 'Schöner Abend, danke euch! ' + Date.now();
await gast.fill('.gbeingabe', 'Lena');
await gast.fill('.gbtext', spruch);
await gast.click('.gbsenden');
await gast.waitForTimeout(900);

pruefe('Der Gast bekommt eine Bestätigung',
  /danke|hängt/i.test((await gast.textContent('.gbmeldung')) || ''),
  await gast.textContent('.gbmeldung'));
pruefe('Das Feld ist danach leer, für den nächsten Gast',
  (await gast.inputValue('.gbtext')) === '');
pruefe('Der eigene Zettel steht auf der Seite',
  (await gast.textContent('.gbliste')) ?.includes(spruch) === true);

/* Ohne Neuladen: Der Draht meldet den Zettel, die Wand zeichnet nach. */
await wand.waitForTimeout(1800);
const nachher = await wand.locator('.gbzettel').count();
pruefe('Die Wand hat einen Zettel mehr — ohne Neuladen', nachher > vorher,
  `${vorher} → ${nachher}`);
pruefe('Und es ist genau dieser',
  ((await wand.textContent('.zwflaeche')) || '').includes(spruch));
pruefe('Er wird einmal groß gezeigt', await wand.locator('.zwbuehne:visible').count() === 1);

console.log('\n5 · Der Name steht dabei');
pruefe('Auf der Wand steht, von wem er ist',
  ((await wand.textContent('.zwflaeche')) || '').includes('Lena'));

console.log('\n6 · Die Box hat ihn wirklich');
const abgelegt = await gast.evaluate(async () => {
  const r = await fetch('/api/guestbook');
  return r.ok ? await r.json() : null;
});
pruefe('Er liegt in der Ablage der Box',
  Array.isArray(abgelegt) && abgelegt.some((e) => e.message === spruch.replace(/[<>]/g, '')),
  Array.isArray(abgelegt) ? `${abgelegt.length} Einträge` : 'keine Antwort');
/* Der Server vergibt eine Farbnummer, keinen Hexwert — welche Farbe das ist,
   entscheidet das Gestaltungssystem. */
pruefe('Mit Farbnummer und Zeitpunkt',
  Array.isArray(abgelegt) && typeof abgelegt[0]?.farbe === 'number' && !!abgelegt[0]?.time,
  JSON.stringify(abgelegt?.[0] ?? null).slice(0, 90));
pruefe('Und die Nummer liegt im Bereich der Palette',
  Array.isArray(abgelegt) && abgelegt.every((e) => e.farbe === undefined || (e.farbe >= 0 && e.farbe < 5)));

/* Aufräumen. Eine Probe, die bei jedem Lauf einen Gruß mehr an die Wand
   hängt, macht die Zettelwand des Betreibers nach zehn Läufen unbrauchbar —
   und die Wand hängt im Saal. */
const sitzung = await alsBetreiber();
const meiner = (abgelegt || []).find((e) => e.message === spruch.replace(/[<>]/g, ''));
if (meiner) {
  const weg = await sitzung.anDieBox('/api/guestbook/' + encodeURIComponent(meiner.id), {
    method: 'DELETE',
  });
  pruefe('Die Probe räumt ihren Gruß wieder weg', weg.status === 200, String(weg.status));
}

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
