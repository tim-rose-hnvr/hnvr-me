/**
 * Slow-Motion — die Zeitlupe an der Box.
 *
 * Der Kern des Moduls ist eine Behauptung, die man leicht falsch baut:
 * Zeitlupe entsteht dadurch, dass mehr Bilder aufgenommen als gezeigt
 * werden — nicht dadurch, dass ein Abspieler langsamer läuft. Der
 * Unterschied fällt erst auf, wenn der Gast den Clip weiterschickt und er
 * beim Empfänger wieder schnell läuft.
 *
 * Gemessen wird deshalb an der Datei:
 *
 *   · Sagt die Seite, was die Kamera WIRKLICH liefert?
 *   · Ist der fertige Clip länger als die Aufnahme gedauert hat?
 *   · Trägt er Vorspann, Rahmen und Eventname — also den Look, nicht nur Bild?
 *   · Landet er als Aufnahme in der Ablage und in der Galerie?
 *
 * Der Browser läuft mit einer Scheinkamera. Die liefert eine feste Rate;
 * gemessen wird das Verhältnis, nicht die Leistung echter Hardware.
 *
 *   node tools/zeitlupe-probe.mjs
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
const bilderVorher = (await fetch(BASIS + '/api/photos').then((r) => r.json())).length;

const SAMMELN = 2;
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ zeitlupe: { enabled: true, sekunden: SAMMELN } }),
});

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const kontext = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ['camera'],
});
const seite = await kontext.newPage();
await seite.goto(BASIS + '/zeitlupe.html', { waitUntil: 'networkidle' });
await seite.waitForTimeout(800);

console.log('\n1 · Vor der Aufnahme');
pruefe('Die Seite sagt, dass Zeitlupe Dauerlicht braucht',
  /dauerlicht/i.test(await seite.locator('.zlsagt').innerText()),
  (await seite.locator('.zlsagt').innerText()).slice(0, 80));
const ziele = await seite.evaluate(() =>
  [...document.querySelectorAll('button, a')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: (e.textContent || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) }))
);
pruefe('Kein Bedienelement unter 44px', ziele.every((z) => z.h >= 44),
  ziele.filter((z) => z.h < 44).map((z) => `${z.t}:${z.h}`).join(', '));

await seite.getByRole('button', { name: /kamera einschalten/i }).click();
await seite.waitForFunction(() => document.querySelector('.zlflaeche')?.dataset.lage === 'laeuft', null, { timeout: 20000 });

const angabe = await seite.locator('.zlrate').innerText();
/* Der Text steht in Versalien (`text-transform`), deshalb ohne Rücksicht auf
   Groß- und Kleinschreibung geprüft. */
pruefe('Sie nennt die Bildrate der Kamera und den Zeitlupenfaktor',
  /\d+\s*B\/S/i.test(angabe) && /fache Zeitlupe/i.test(angabe), angabe);

/* Und die eigentliche Aussage: Der Faktor darf NIE unter eins liegen. Eine
   „Zeitlupe", die schneller läuft als die Wirklichkeit, ist kein Clip mit
   schwachem Effekt, sondern ein falsch benanntes Produkt. */
const faktor = Number((angabe.match(/([\d.,]+)-FACHE/i) || [])[1]?.replace(',', '.') || 0);
pruefe(`Der Faktor liegt über eins, auch bei einer langsamen Kamera (${faktor})`,
  faktor > 1, angabe);
pruefe('Und sagt, wie lange aufgenommen wird',
  new RegExp(`${SAMMELN} Sekunden`).test(await seite.locator('.zlsagt').innerText()),
  await seite.locator('.zlsagt').innerText());

console.log('\n2 · Sammeln und ausspielen');
const begonnen = Date.now();
await seite.getByRole('button', { name: /^aufnehmen$/i }).click();
await seite.waitForFunction(() => document.querySelector('.zlflaeche')?.dataset.lage === 'nimmt', null, { timeout: 10000 });

/* Der Bilderzähler ist das, woran ein Betreiber beim Aufbau sieht, dass die
   Kamera liefert. Steht er still, ist zu wenig Licht da. */
await seite.waitForTimeout(900);
const gezaehlt = Number((await seite.locator('.zlzaehler').innerText()).trim() || '0');
pruefe(`Der Bilderzähler läuft mit (${gezaehlt} nach einer Sekunde)`, gezaehlt > 5,
  String(gezaehlt));

await seite.waitForFunction(() => document.querySelector('.zlflaeche')?.dataset.lage === 'rechnet', null, { timeout: 20000 });
pruefe('Während gerechnet wird, läuft der Clip sichtbar durch — kein Balken',
  /was du siehst, wird aufgezeichnet/i.test(await seite.locator('.zlsagt').innerText()),
  (await seite.locator('.zlsagt').innerText()).slice(0, 70));

await seite.waitForFunction(() => document.querySelector('.zlflaeche')?.dataset.lage === 'fertig', null, { timeout: 120000 });
const gesamt = (Date.now() - begonnen) / 1000;

console.log('\n3 · Die Zeitlupe steckt in der Datei');
const clip = await seite.evaluate(async () => {
  const v = document.querySelector('.zlabspieler');
  await new Promise((f) => {
    if (v.readyState >= 1) return f();
    v.addEventListener('loadedmetadata', f, { once: true });
  });
  const blob = await fetch(v.src).then((r) => r.blob());
  return { dauer: v.duration, breite: v.videoWidth, hoehe: v.videoHeight, bytes: blob.size };
});
pruefe('Es ist ein Clip entstanden', clip.bytes > 5000, JSON.stringify(clip));
pruefe(`Er ist LÄNGER als die Aufnahme (${clip.dauer?.toFixed(1)} s aus ${SAMMELN} s gesammelt)`,
  Number.isFinite(clip.dauer) ? clip.dauer > SAMMELN * 1.4 : gesamt > SAMMELN * 2,
  `Clip ${clip.dauer} s, Vorgang ${gesamt.toFixed(1)} s`);
pruefe('Und er steht in 16:9', clip.breite === 1280 && clip.hoehe === 720,
  `${clip.breite}×${clip.hoehe}`);

console.log('\n4 · Rahmen und Eventname sind IM Bild');
/* Ein Rahmen, der nur als CSS über dem Abspieler liegt, fehlt in der Datei —
   und damit überall, wo der Clip später auftaucht. Gemessen wird deshalb an
   den Bildpunkten des Clips selbst. */
const imBild = await seite.evaluate(async () => {
  const v = document.querySelector('.zlabspieler');
  v.pause();
  v.currentTime = v.duration / 2;
  await new Promise((f) => v.addEventListener('seeked', f, { once: true }));
  const f = document.createElement('canvas');
  f.width = v.videoWidth;
  f.height = v.videoHeight;
  f.getContext('2d').drawImage(v, 0, 0);
  const stift = f.getContext('2d');
  // Die Rahmenlinie liegt bei 28px vom Rand, in Amber.
  /* Ein hoher, schmaler Streifen über die Rahmenlinie — nicht eine einzelne
     Zeile: Videokompression weicht Kanten auf, und an einer einzigen Zeile
     hinge das Ergebnis am Zufall. */
  const linie = stift.getImageData(18, Math.floor(f.height * 0.25), 24, Math.floor(f.height * 0.5)).data;
  let amber = 0;
  for (let i = 0; i < linie.length; i += 4) {
    if (linie[i] > 180 && linie[i + 1] > 120 && linie[i + 1] < 220 && linie[i + 2] < 130) amber++;
  }
  // Die Kopfzeile mit „ZEITLUPE" liegt oben links.
  const kopf = stift.getImageData(50, 50, 220, 40).data;
  let schrift = 0;
  for (let i = 0; i < kopf.length; i += 4) {
    if (kopf[i] > 180 && kopf[i + 2] < 140) schrift++;
  }
  return { amber, schrift };
});
pruefe(`Der Rahmen ist in den Bildpunkten des Clips (${imBild.amber})`, imBild.amber > 50);
pruefe(`Und die Kopfzeile steht darin (${imBild.schrift} Punkte)`, imBild.schrift > 30);

console.log('\n5 · Behalten');
await seite.getByRole('button', { name: /^behalten$/i }).click();
await seite.waitForTimeout(3000);
const ablage = await fetch(BASIS + '/api/photos').then((r) => r.json());
const gesichert = ablage.find((p) => /_zeitlupe_/.test(p.name));
pruefe('Der Clip liegt als Aufnahme in der Ablage',
  ablage.length === bilderVorher + 1 && !!gesichert,
  `vorher ${bilderVorher}, jetzt ${ablage.length}`);
pruefe('Die Box führt ihn als Video', gesichert?.type === 'video', String(gesichert?.type));

const g = await kontext.newPage();
await g.goto(BASIS + '/galerie.html', { waitUntil: 'networkidle' });
await g.waitForTimeout(1200);
const filter = await g.evaluate(() =>
  [...document.querySelectorAll('.gchip')].map((e) => e.textContent.trim())
);
pruefe('Die Galerie kennt einen Filter dafür', filter.some((f) => /zeitlupe/i.test(f)),
  filter.join(' · '));
pruefe('Und zeigt ihn als Video, nicht als leere Kachel',
  (await g.locator('.gknopfbild video').count()) >= 1);

// Aufräumen.
if (gesichert) {
  await sitzung.anDieBox('/api/photos/' + encodeURIComponent(gesichert.name), { method: 'DELETE' });
}
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ zeitlupe: { enabled: vorher.zeitlupe.enabled, sekunden: vorher.zeitlupe.sekunden } }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
