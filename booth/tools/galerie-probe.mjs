/**
 * Die Kunden-Galerie — BUILD_SPEC 6.3.
 *
 * Sie ist die einzige Fläche, die der Gast NACH dem Abend noch sieht — meist
 * am Tag darauf, zu zweit vor einem Rechner. Was dort fehlt, fällt niemandem
 * auf einer Feier auf und dafür umso mehr am Sonntagvormittag.
 *
 * Geprüft wird, was die Spec nennt: eine Datenquelle für alle Zahlen, Filter
 * nach Aufnahmeart, Leuchtkasten mit Vor und Zurück und Miniaturenstreifen,
 * Diashow mit Fortschrittsbalken — und die offen genannte Löschfrist.
 *
 *   node tools/galerie-probe.mjs
 */

import { chromium } from 'playwright-core';
import { alsBetreiber, BASIS } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

/* Ohne Aufnahmen gibt es nichts zu prüfen. Also welche anlegen — als Gast,
   denn genau so entstehen sie im Betrieb. */
const sitzung = await alsBetreiber();
const vorhanden = (await sitzung.anDieBox('/api/photos')).daten;
const zahl = Array.isArray(vorhanden?.photos ?? vorhanden) ? (vorhanden.photos ?? vorhanden).length : 0;

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const kontext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ['camera'],
});
const seite = await kontext.newPage();

if (zahl < 3) {
  console.log(`\n0 · Erst ein paar Aufnahmen machen (${zahl} vorhanden)`);
  const booth = await kontext.newPage();
  await booth.goto(BASIS + '/', { waitUntil: 'networkidle' });
  for (let n = 0; n < 3; n++) {
    await booth.waitForTimeout(700);
    const start = booth.getByRole('button', { name: /jetzt starten/i });
    if (await start.count()) await start.click();
    await booth.waitForTimeout(500);
    /* Erst die Aufnahmeart wählen, DANN „Los geht's" — die Kachel wählt nur
       aus. Ohne den zweiten Schritt passiert nichts, und die Probe hätte
       gegen eine leere Galerie gemessen. */
    const art = booth.locator('.art').first();
    if (await art.count()) await art.click();
    const los = booth.getByRole('button', { name: /los geht/i });
    if (await los.count()) await los.click();
    /* Countdown, Aufnahme, Sichern — großzügig warten, das läuft über die
       echte Kette inklusive Schreiben auf die Platte. */
    await booth.waitForTimeout(14000);
    const nochmal = booth.getByRole('button', { name: /noch (ein|mal)|fertig|weiter/i }).first();
    if (await nochmal.count()) await nochmal.click().catch(() => {});
  }
  await booth.close();
}

console.log('\n1 · Die Galerie');
await seite.goto(BASIS + '/galerie.html', { waitUntil: 'networkidle' });
await seite.waitForTimeout(900);

const kacheln = await seite.locator('.gkachel, [data-aufnahme], .gitter > *').count();
pruefe(`Es liegen Aufnahmen da (${kacheln})`, kacheln > 0);

const zeile = await seite.evaluate(() => document.body.innerText.slice(0, 400));
pruefe('Die Löschfrist steht offen da', /löschung nach \d+ tag/i.test(zeile),
  (zeile.match(/Löschung[^\n]*/) || [''])[0]);
pruefe('Und die Trefferzahl stammt aus derselben Zählung',
  /\d+ von \d+ aufnahmen/i.test(zeile), (zeile.match(/\d+ von \d+[^\n]*/) || [''])[0]);

console.log('\n2 · Der Leuchtkasten');
await seite.locator('.gkachel, [data-aufnahme], .gitter > *').first().click();
await seite.waitForTimeout(500);
pruefe('Er öffnet sich', await seite.locator('.glightbox').count() === 1);
pruefe('Mit Zähler', /^\d+ von \d+$/.test(((await seite.textContent('.glightbox .gmono')) || '').trim()),
  await seite.textContent('.glightbox .gmono'));
pruefe('Mit Vor und Zurück', await seite.locator('.gpfeil').count() === 2);
pruefe('Mit Miniaturenstreifen', await seite.locator('.gminiatur').count() > 0,
  String(await seite.locator('.gminiatur').count()));

const vorher = await seite.textContent('.glightbox .gmono');
await seite.locator('.gpfeil').nth(1).click();
await seite.waitForTimeout(250);
pruefe('Weiterblättern ändert das Bild', (await seite.textContent('.glightbox .gmono')) !== vorher,
  `${vorher} → ${await seite.textContent('.glightbox .gmono')}`);

console.log('\n3 · Die Diashow');
const diashow = seite.locator('.gdiashow');
pruefe('Es gibt einen Knopf dafür', await diashow.count() === 1);
/* Ein Knopf ohne Beschriftung ist kein Knopf. Genau so stand er hier: leer,
   weil die Aufschrift erst beim Anhalten gesetzt wurde. */
pruefe('Und er ist beschriftet', ((await diashow.textContent()) || '').trim().length > 3,
  await diashow.textContent());
await diashow.click();
await seite.waitForTimeout(300);
pruefe('Der Fortschrittsbalken läuft',
  await seite.evaluate(() => document.querySelector('.gbalken')?.hasAttribute('data-an') === true));
pruefe('Der Miniaturenstreifen tritt zurück',
  await seite.evaluate(() => {
    const s = document.querySelector('.gstreifen');
    return s ? getComputedStyle(s).opacity === '0' : false;
  }));
const standVorher = await seite.textContent('.glightbox .gmono');
await seite.waitForTimeout(4600);
pruefe('Nach vier Sekunden steht das nächste Bild',
  (await seite.textContent('.glightbox .gmono')) !== standVorher,
  `${standVorher} → ${await seite.textContent('.glightbox .gmono')}`);

await seite.locator('.gpfeil').nth(0).click();
await seite.waitForTimeout(200);
pruefe('Wer selbst blättert, hält die Diashow an',
  await seite.evaluate(() => !document.querySelector('.glightbox')?.hasAttribute('data-diashow')));

console.log('\n4 · Wieder zu');
await seite.keyboard.press('Escape');
await seite.waitForTimeout(250);
pruefe('Escape schließt den Leuchtkasten', await seite.locator('.glightbox').count() === 0);

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
