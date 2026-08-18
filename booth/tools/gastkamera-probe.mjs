/**
 * Die Web-Kamera — eine Fotobox auf dem Handy des Gastes.
 *
 * Die Box nahm Aufnahmen fremder Geräte längst entgegen; es fehlte die
 * Seite, auf der jemand sie macht. Geprüft wird deshalb der ganze Weg:
 * einschalten, auslösen, ansehen, senden — und ob das Bild danach wirklich
 * auf der Box liegt und als Gästeaufnahme gekennzeichnet ist.
 *
 * Zwei Regeln, die hier leicht verlorengehen und teuer sind:
 *   · Erst ansehen, dann senden. Wer ein verwackeltes Bild sofort in die
 *     Galerie des Paares schiebt, kann es nicht zurückholen.
 *   · Eine gescheiterte Sendung darf die Aufnahme nicht verwerfen.
 *
 *   node tools/gastkamera-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

/* Ein Handy, hochkant. */
const handy = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
});
const gast = await handy.newPage();

const vorher = await (await fetch(`${BASIS}/api/photos`)).json().catch(() => []);
const zahlVorher = Array.isArray(vorher) ? vorher.length : 0;

console.log('\n1 · Die Seite auf dem Handy');
await gast.goto(BASIS + '/gastkamera.html', { waitUntil: 'networkidle' });
await gast.waitForTimeout(500);

pruefe('Ohne Anmeldung erreichbar', !gast.url().includes('anmelden'), gast.url());
pruefe('Sie beginnt ausgeschaltet',
  (await gast.getAttribute('.gkflaeche', 'data-lage')) === 'start');
pruefe('Und sagt, worum es geht',
  ((await gast.textContent('.gksagt')) || '').length > 20, await gast.textContent('.gksagt'));
pruefe('Die Kamera läuft noch nicht',
  await gast.evaluate(() => !document.querySelector('video')?.srcObject));
pruefe('Nichts scrollt seitlich',
  await gast.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));

console.log('\n2 · Einschalten');
await gast.getByRole('button', { name: /kamera einschalten/i }).click();
await gast.waitForTimeout(2500);
pruefe('Das Live-Bild steht',
  (await gast.getAttribute('.gkflaeche', 'data-lage')) === 'live');
pruefe('Es gibt einen Auslöser', await gast.locator('.gkausloeser').count() === 1);
pruefe('Und einen Weg zum Wenden',
  await gast.getByRole('button', { name: /wenden/i }).count() === 1);

const ziel = await gast.evaluate(() => {
  const k = document.querySelector('.gkausloeser');
  const r = k.getBoundingClientRect();
  return Math.min(Math.round(r.width), Math.round(r.height));
});
pruefe('Der Auslöser ist mindestens 44px groß', ziel >= 44, `${ziel}px`);

console.log('\n3 · Auslösen — und erst ansehen');
await gast.locator('.gkausloeser').click();
/* Drei Sekunden Countdown, dann Blitz und Standbild. */
await gast.waitForTimeout(4200);
pruefe('Danach steht die Aufnahme zum Ansehen da',
  (await gast.getAttribute('.gkflaeche', 'data-lage')) === 'ansehen',
  await gast.getAttribute('.gkflaeche', 'data-lage'));
pruefe('Die Vorschau zeigt ein echtes Bild',
  await gast.evaluate(() => {
    const b = document.querySelector('.gkvorschau');
    return !!b && b.naturalWidth > 200 && b.naturalHeight > 200;
  }));
pruefe('Die Kamera ist dabei aus — kein Dauerleuchten',
  await gast.evaluate(() => {
    const v = document.querySelector('video');
    const s = v?.srcObject;
    return !s || s.getTracks().every((t) => t.readyState === 'ended');
  }));

const nachAusloesen = await (await fetch(`${BASIS}/api/photos`)).json().catch(() => []);
pruefe('NOCH IST NICHTS GESENDET — das ist der Sinn des Schritts',
  (Array.isArray(nachAusloesen) ? nachAusloesen.length : 0) === zahlVorher,
  `${zahlVorher} → ${nachAusloesen.length}`);

pruefe('Es gibt einen Weg zurück', await gast.getByRole('button', { name: /noch mal/i }).count() === 1);

console.log('\n4 · Senden');
await gast.getByRole('button', { name: /^senden$/i }).click();
await gast.waitForTimeout(2500);
pruefe('Der Gast bekommt eine Bestätigung',
  (await gast.getAttribute('.gkflaeche', 'data-lage')) === 'fertig',
  await gast.getAttribute('.gkflaeche', 'data-lage'));

const nachher = await (await fetch(`${BASIS}/api/photos`)).json().catch(() => []);
pruefe('Die Box hat ein Bild mehr',
  (Array.isArray(nachher) ? nachher.length : 0) === zahlVorher + 1,
  `${zahlVorher} → ${nachher.length}`);
const neu = Array.isArray(nachher) ? nachher[0] : null;
pruefe('Und es ist als Gästeaufnahme gekennzeichnet',
  /_gast_/.test(neu?.name || ''), neu?.name);

console.log('\n5 · Noch eins');
pruefe('Es geht direkt weiter',
  await gast.getByRole('button', { name: /noch eins/i }).count() === 1);

console.log('\n6 · Ohne Kamera keine Sackgasse');
const ohne = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ohne.addInitScript(() => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
  });
});
const s2 = await ohne.newPage();
await s2.goto(BASIS + '/gastkamera.html', { waitUntil: 'networkidle' });
await s2.getByRole('button', { name: /kamera einschalten/i }).click();
await s2.waitForTimeout(1500);
pruefe('Die Seite sagt, was fehlt',
  /kamera|freigabe|erlaub/i.test((await s2.textContent('.gksagt')) || ''),
  await s2.textContent('.gksagt'));
pruefe('Und bietet einen zweiten Versuch an',
  await s2.getByRole('button', { name: /noch einmal/i }).count() === 1);

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
