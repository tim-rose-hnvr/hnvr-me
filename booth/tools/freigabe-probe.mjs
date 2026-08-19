/**
 * Die geteilte Galerie — was der Link zeigt.
 *
 * Am Ende einer Feier gibt der Betreiber einen Link heraus. Was dahinter
 * steht, ist keine Kleinigkeit: Bei „Alle Bilder" gibt er mit dem Link die
 * Aufnahmen ALLER Gäste weiter, an jeden, der ihn bekommt. Bei „Nur die
 * eigenen" nicht.
 *
 * Geprüft wird deshalb vor allem, was NICHT herauskommt:
 *
 *   · Zeigt die Finder-Galerie wirklich kein einziges Bild?
 *   · Hält das Kennwort, und zwar bevor irgendein Bild geladen wird?
 *   · Verschwindet die Seite nach dem Ablaufdatum?
 *   · Und behalten bestehende Freigaben ihre Einstellung, wenn die Box
 *     ein Update bekommt?
 *
 *   node tools/freigabe-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS, alsBetreiber } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const sitzung = await alsBetreiber();
const vorher = await fetch(BASIS + '/api/settings').then((r) => r.json());
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ faceFinder: { enabled: true } }),
});

/* Damit „zeigt keine Bilder" etwas bedeutet, muss es Bilder GEBEN. */
const EINPUNKT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const bilderDa = (await fetch(BASIS + '/api/photos').then((r) => r.json())).length;
let angelegt = null;
if (bilderDa === 0) {
  angelegt = (await fetch(BASIS + '/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: EINPUNKT, mode: 'foto', source: 'booth' }),
  }).then((r) => r.json())).photo.name;
}

console.log('\n1 · Eine Freigabe anlegen');
const neu = await sitzung.anDieBox('/api/microsites', {
  method: 'POST',
  body: JSON.stringify({ title: 'Probe Freigabe', slug: 'probe-freigabe', boxUrl: '' }),
});
pruefe('Die Box legt eine Event-Seite an', neu.status === 200, String(neu.status));
const slug = neu.daten?.microsite?.slug;
pruefe('Sie beginnt mit „alle Bilder" — so war es bisher auch',
  neu.daten?.microsite?.galerieart === 'alle', neu.daten?.microsite?.galerieart);

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const kontext = await browser.newContext({ viewport: { width: 900, height: 1000 } });
const seite = await kontext.newPage();

const oeffne = async () => {
  await seite.goto(`${BASIS}/m/${slug}`, { waitUntil: 'networkidle' });
  await seite.waitForTimeout(1200);
};

console.log('\n2 · „Alle Bilder" zeigt die Galerie');
await oeffne();
pruefe('Es stehen Bilder auf der Seite',
  (await seite.locator('.egalerie img, .ebild img, img').count()) > 0,
  String(await seite.locator('img').count()));

console.log('\n3 · „Nur die eigenen" zeigt KEIN einziges Bild');
await sitzung.anDieBox(`/api/microsites/${slug}`, {
  method: 'PUT',
  body: JSON.stringify({ title: 'Probe Freigabe', galerieart: 'finder', boxUrl: '' }),
});
await oeffne();
const bilderSichtbar = await seite.evaluate(() =>
  [...document.querySelectorAll('img')]
    .filter((b) => /\/photos\//.test(b.currentSrc || b.src || ''))
    .map((b) => (b.currentSrc || b.src).slice(-40))
);
pruefe('Keine einzige Aufnahme steht auf der Seite', bilderSichtbar.length === 0,
  bilderSichtbar.join(', '));
pruefe('Stattdessen führt ein Weg zur Gesichtssuche',
  (await seite.locator('a[href$="/finder"]').count()) === 1,
  await seite.locator('.ebereich a').first().getAttribute('href').catch(() => ''));
pruefe('Und es steht da, warum hier nichts zu sehen ist',
  /nur die bilder, auf denen er selbst/i.test(await seite.locator('.ebereich').innerText()));

/* Auch nicht in den Daten, die die Seite bekommt: Ein Bild, das im Aufruf
   steckt und nur nicht angezeigt wird, wäre trotzdem herausgegeben. */
const oeffentlich = await fetch(`${BASIS}/api/microsites/public/${slug}`).then((r) => r.json());
pruefe('Auch die Auskunft der Box enthält keine Bildliste',
  !JSON.stringify(oeffentlich).includes('/photos/'),
  Object.keys(oeffentlich).join(', '));

console.log('\n4 · Das Kennwort hält, bevor irgendetwas geladen wird');
await sitzung.anDieBox(`/api/microsites/${slug}`, {
  method: 'PUT',
  body: JSON.stringify({ title: 'Probe Freigabe', galerieart: 'alle', password: 'geheim', boxUrl: '' }),
});
const gesperrt = await fetch(`${BASIS}/api/microsites/public/${slug}`).then((r) => r.json());
pruefe('Ohne Kennwort gibt die Box nur den Titel heraus',
  gesperrt.locked === true && !gesperrt.boxUrl && !gesperrt.headline,
  Object.keys(gesperrt).join(', '));
pruefe('Und das Kennwort selbst steht in keiner Antwort',
  !JSON.stringify(gesperrt).includes('geheim'));

await oeffne();
pruefe('Die Seite fragt danach, statt Bilder zu zeigen',
  (await seite.locator('input[type="password"], .ekennwort input').count()) >= 1 &&
  (await seite.evaluate(() =>
    [...document.querySelectorAll('img')].every((b) => !/\/photos\//.test(b.currentSrc || b.src || ''))
  )));

const mitKennwort = await fetch(`${BASIS}/api/microsites/public/${slug}?pw=geheim`).then((r) => r.json());
pruefe('Mit Kennwort kommt die Seite', mitKennwort.locked !== true && !!mitKennwort.title);

console.log('\n5 · Abgelaufen heißt abgelaufen');
await sitzung.anDieBox(`/api/microsites/${slug}`, {
  method: 'PUT',
  body: JSON.stringify({ title: 'Probe Freigabe', galerieart: 'alle', password: '', expires: '2020-01-01', boxUrl: '' }),
});
const abgelaufen = await fetch(`${BASIS}/api/microsites/public/${slug}`).then((r) => r.json());
pruefe('Nach dem Stichtag gibt die Box nichts mehr heraus',
  abgelaufen.expired === true && !abgelaufen.boxUrl,
  Object.keys(abgelaufen).join(', '));

console.log('\n6 · Ein Update ändert bestehende Freigaben nicht');
/* Der Fall, der im Betrieb weh tut: Eine Feier läuft, der Betreiber hat
   „keine Bilder" eingestellt, die Box bekommt ein Update — und plötzlich
   steht alles offen. Deshalb erbt eine Freigabe ohne `galerieart` ihre
   frühere Einstellung. */
await sitzung.anDieBox(`/api/microsites/${slug}`, {
  method: 'PUT',
  body: JSON.stringify({ title: 'Probe Freigabe', galerieart: 'keine', expires: '', boxUrl: '' }),
});
const ohneAngabe = await sitzung.anDieBox(`/api/microsites/${slug}`, {
  method: 'PUT',
  body: JSON.stringify({ title: 'Probe Freigabe umbenannt', boxUrl: '' }),
});
pruefe('Wer nur den Titel ändert, ändert die Galerie-Art nicht mit',
  ohneAngabe.daten?.microsite?.galerieart === 'keine',
  ohneAngabe.daten?.microsite?.galerieart);
await oeffne();
pruefe('Und die Seite zeigt weiterhin keine Bilder',
  await seite.evaluate(() =>
    [...document.querySelectorAll('img')].every((b) => !/\/photos\//.test(b.currentSrc || b.src || ''))
  ));

// Aufräumen.
await sitzung.anDieBox(`/api/microsites/${slug}`, { method: 'DELETE' });
if (angelegt) {
  await sitzung.anDieBox('/api/photos/' + encodeURIComponent(angelegt), { method: 'DELETE' });
}
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ faceFinder: { enabled: vorher.faceFinder.enabled } }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
