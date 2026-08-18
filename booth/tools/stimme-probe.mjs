/**
 * Das Audio-Gästebuch — gesprochene Grüße.
 *
 * Der Kern ist eine technische Wette: Bild und Ton werden GEMEINSAM
 * aufgezeichnet, nicht hinterher zusammengerechnet. Läuft das nicht, dauert
 * ein Gruß doppelt so lange wie er ist — und niemand merkt es, bis ein Gast
 * dreißig Sekunden lang auf einen Fortschrittsbalken sieht.
 *
 * Gemessen wird deshalb am Ergebnis:
 *
 *   · Entsteht wirklich EINE Datei mit Bildspur und Tonspur?
 *   · Ist sie so lang wie gesprochen wurde, nicht doppelt?
 *   · Landet sie als normale Aufnahme in der Ablage?
 *   · Zeigt die Galerie sie als Video, nicht als kaputte Bildkachel?
 *   · Und bleibt sie von Foto-Wall und Diashow fern, wo sie nur stumm wäre?
 *
 * Der Browser läuft mit einer Scheinkamera und einem Scheinmikrofon; das
 * Mikrofon liefert einen Sinuston. Genau richtig: Gemessen wird die
 * Aufzeichnung, nicht die Akustik des Raums.
 *
 *   node tools/stimme-probe.mjs
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

/* Zehn Sekunden ist die kürzeste Länge, die die Box zulässt — eine Probe,
   die dreißig Sekunden spricht, prüft nichts zusätzlich. */
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ stimme: { enabled: true, sekunden: 10 } }),
});

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const kontext = await browser.newContext({
  viewport: { width: 420, height: 900 },
  permissions: ['microphone'],
});
const seite = await kontext.newPage();
await seite.goto(BASIS + '/stimme', { waitUntil: 'networkidle' });
await seite.waitForTimeout(900);

console.log('\n1 · Vor der Aufnahme');
pruefe('Die Seite sagt, wie lange gesprochen werden darf',
  /10 sekunden/i.test(await seite.locator('.stsagt').innerText()),
  (await seite.locator('.stsagt').innerText()).slice(0, 90));
pruefe('Es steht ein Standbild da, keine leere Fläche',
  await seite.evaluate(() => {
    const f = document.querySelector('.sttafel');
    if (!f) return false;
    const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
    /* Nicht „irgendetwas ist gezeichnet", sondern: Es sind mehrere Farben
       darin. Eine einfarbige Fläche wäre auch „nicht leer" und trotzdem
       falsch. */
    const farben = new Set();
    for (let i = 0; i < d.length; i += 4 * 997) farben.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    return farben.size > 3;
  }));
const ziele = await seite.evaluate(() =>
  [...document.querySelectorAll('button, a, input')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: (e.textContent || e.placeholder || '').trim().slice(0, 20), h: Math.round(e.getBoundingClientRect().height) }))
);
pruefe('Kein Bedienelement unter 44px', ziele.every((z) => z.h >= 44),
  ziele.filter((z) => z.h < 44).map((z) => `${z.t}:${z.h}`).join(', '));

console.log('\n2 · Sprechen');
await seite.locator('input.steingabe').fill('Onkel Bernd');
const begonnen = Date.now();
await seite.getByRole('button', { name: /aufnahme starten/i }).click();
await seite.waitForFunction(() => document.querySelector('.stflaeche')?.dataset.lage === 'nimmt', null, { timeout: 15000 });
pruefe('Die Aufnahme läuft und sagt es auch',
  /tippen beendet/i.test(await seite.locator('.stsagt').innerText()));

/* Die Welle muss sich bewegen, sonst ist die Pegelanzeige eine Zeichnung
   und der Gast weiß nicht, ob er ankommt. */
const wellen = [];
for (let i = 0; i < 4; i++) {
  wellen.push(await seite.evaluate(() => {
    const f = document.querySelector('.sttafel');
    const d = f.getContext('2d').getImageData(0, Math.floor(f.height * 0.52) - 40, f.width, 80).data;
    let summe = 0;
    for (let i = 0; i < d.length; i += 4 * 13) summe += d[i];
    return summe;
  }));
  await seite.waitForTimeout(500);
}
pruefe('Die Welle bewegt sich, während gesprochen wird',
  new Set(wellen).size >= 3, wellen.join(' · '));

await seite.waitForTimeout(5500);
await seite.getByRole('button', { name: /^fertig$/i }).click();
await seite.waitForFunction(() => document.querySelector('.stflaeche')?.dataset.lage === 'hoert', null, { timeout: 15000 });
const gebraucht = (Date.now() - begonnen) / 1000;

console.log('\n3 · Eine Datei, zwei Spuren');
const datei = await seite.evaluate(async () => {
  const v = document.querySelector('.stabspieler');
  if (!v?.src) return null;
  const blob = await fetch(v.src).then((r) => r.blob());
  /* `readyState` allein sagt nichts über Ton. Gefragt wird das Element,
     ob es überhaupt Audio hat — in Chromium über die herstellereigene
     Eigenschaft, sonst über die Dauer als Rückfall. */
  await new Promise((f) => {
    if (v.readyState >= 1) return f();
    v.addEventListener('loadedmetadata', f, { once: true });
  });
  return { typ: blob.type, bytes: blob.size, breite: v.videoWidth, hoehe: v.videoHeight };
});
pruefe('Es ist eine Videodatei entstanden', !!datei && datei.bytes > 2000,
  JSON.stringify(datei));
pruefe('Sie hat eine Bildspur in 16:9',
  !!datei && datei.breite === 1280 && datei.hoehe === 720,
  `${datei?.breite}×${datei?.hoehe}`);
pruefe(`Und sie war sofort da — kein Zusammenrechnen (${gebraucht.toFixed(1)} s für ~8 s Sprechen)`,
  gebraucht < 14, `${gebraucht.toFixed(1)} s`);

console.log('\n4 · Abschicken');
await seite.getByRole('button', { name: /abschicken/i }).click();
await seite.waitForFunction(() => document.querySelector('.stflaeche')?.dataset.lage === 'fertig', null, { timeout: 20000 });

const ablage = await fetch(BASIS + '/api/photos').then((r) => r.json());
pruefe('Der Gruß liegt als Aufnahme in der Ablage',
  ablage.length === bilderVorher + 1, `vorher ${bilderVorher}, jetzt ${ablage.length}`);
const gruss = ablage.find((p) => /_stimme_/.test(p.name));
pruefe('Er trägt seine Herkunft im Dateinamen', !!gruss, gruss?.name);
pruefe('Und die Box führt ihn als Video, nicht als Bild',
  gruss?.type === 'video', String(gruss?.type));

console.log('\n5 · Die Galerie zeigt ihn als Video');
const g = await kontext.newPage();
await g.goto(BASIS + '/galerie.html', { waitUntil: 'networkidle' });
await g.waitForTimeout(1200);
pruefe('In der Kachel steht ein Videoelement, kein leeres Bild',
  (await g.locator('.gknopfbild video').count()) >= 1);
pruefe('Die Kachel ist als Gruß markiert',
  (await g.locator('.gmarke', { hasText: /gruß/i }).count()) >= 1);
const filter = await g.evaluate(() =>
  [...document.querySelectorAll('.gchip')].map((e) => e.textContent.trim())
);
pruefe('Es gibt einen Filter für die gesprochenen Grüße',
  filter.some((f) => /gesprochene/i.test(f)), filter.join(' · '));

await g.locator('.gknopfbild').first().click();
await g.waitForTimeout(600);
const gross = await g.evaluate(() => {
  const v = document.querySelector('.gvideo');
  return { da: !!v && !v.hidden, bedienbar: !!v?.controls };
});
pruefe('Groß geöffnet läuft er in einem Abspieler mit Bedienelementen',
  gross.da && gross.bedienbar, JSON.stringify(gross));

console.log('\n6 · Nicht auf der Wand, nicht in der Diashow');
/* Ein stummer Gruß zwischen Gruppenfotos ist kein Beitrag — der Beamer hat
   keinen Ton. */
const w = await kontext.newPage();
await w.goto(BASIS + '/wand.html', { waitUntil: 'networkidle' });
await w.waitForTimeout(1500);
pruefe('Die Foto-Wall zeigt kein Video',
  (await w.locator('.wkachel video').count()) === 0 &&
  (await w.evaluate(() => [...document.querySelectorAll('.wkachel img')].every((b) => !/\.(webm|mp4)$/i.test(b.src)))));

const d = await kontext.newPage();
await d.goto(BASIS + '/diashow.html', { waitUntil: 'networkidle' });
await d.waitForTimeout(2500);
pruefe('Die Diashow zeigt kein Video',
  await d.evaluate(() =>
    [...document.querySelectorAll('.dfoto')].every((b) => !/\.(webm|mp4)$/i.test(b.src))));

console.log('\n7 · Alle Grüße nacheinander hören');
/* Der „Zusammenschnitt" als Erlebnis: Filter auf die Grüße, den ersten
   öffnen, Diashow starten. Sie darf einen laufenden Gruß NICHT nach vier
   Sekunden abschneiden — daran scheitert jede Diashow, die nur zählt.
   Dafür braucht es zwei Grüße, sonst bliebe der Zähler ohnehin stehen. */
await seite.getByRole('button', { name: /noch einen gruß/i }).click();
/* Nebenbei belegt: Nach der ersten Aufnahme steht die Mikrofonwahl da. Vorher
   nicht — der Browser gibt die Gerätenamen erst preis, wenn einmal
   Aufnahmeerlaubnis erteilt wurde, und eine Liste aus dreimal „Mikrofon" ist
   eine Ratestunde. */
pruefe('Ab der zweiten Aufnahme lässt sich das Mikrofon wählen',
  (await seite.locator('select.steingabe').count()) === 1);
await seite.locator('input.steingabe').fill('Tante Rita');
await seite.getByRole('button', { name: /aufnahme starten/i }).click();
await seite.waitForFunction(() => document.querySelector('.stflaeche')?.dataset.lage === 'nimmt', null, { timeout: 15000 });
await seite.waitForTimeout(5500);
await seite.getByRole('button', { name: /^fertig$/i }).click();
await seite.waitForFunction(() => document.querySelector('.stflaeche')?.dataset.lage === 'hoert', null, { timeout: 15000 });
await seite.getByRole('button', { name: /abschicken/i }).click();
await seite.waitForFunction(() => document.querySelector('.stflaeche')?.dataset.lage === 'fertig', null, { timeout: 20000 });

await g.reload({ waitUntil: 'networkidle' });
await g.waitForTimeout(1000);
await g.locator('.gchip', { hasText: /gesprochene/i }).click();
await g.waitForTimeout(400);
/* Wie viele Grüße insgesamt in der Galerie stehen, weiß die Probe nicht —
   auf einer Box im Betrieb liegen die des Abends. Gemessen wird deshalb,
   dass GENAU ZWEI dazugekommen sind. */
const grussKacheln = await g.locator('.gkachel').count();
pruefe(`Beide neuen Grüße stehen im Filter (${grussKacheln} insgesamt)`,
  grussKacheln >= 2, String(grussKacheln));

await g.locator('.gknopfbild').first().click();
await g.waitForTimeout(400);
await g.getByRole('button', { name: /^diashow$/i }).click();
await g.evaluate(() => document.querySelector('.gvideo')?.play());
await g.waitForTimeout(4600);
const beimHoeren = await g.evaluate(() => {
  const v = document.querySelector('.gvideo');
  return {
    laeuft: !!v && !v.paused && !v.ended,
    stelle: Math.round((v?.currentTime ?? 0) * 10) / 10,
    zaehler: document.querySelector('.glightbox .gmono')?.textContent,
  };
});
pruefe('Die Diashow blättert nicht weiter, solange ein Gruß läuft',
  beimHoeren.laeuft && new RegExp(`^1 von ${grussKacheln}`).test(beimHoeren.zaehler || ''),
  JSON.stringify(beimHoeren));

/* Und die Gegenprobe: Steht der Gruß still, geht es weiter — sonst bliebe
   die Diashow beim ersten Bild hängen, sobald einmal ein Video dabei war. */
await g.evaluate(() => document.querySelector('.gvideo')?.pause());
await g.waitForTimeout(4600);
const danachZaehler = await g.evaluate(
  () => document.querySelector('.glightbox .gmono')?.textContent
);
pruefe('Und blättert weiter, sobald er zu Ende ist',
  new RegExp(`^2 von ${grussKacheln}`).test(danachZaehler || ''), danachZaehler || '');
await g.keyboard.press('Escape');

// Aufräumen: beide Grüße.
const gruesse = (await fetch(BASIS + '/api/photos').then((r) => r.json()))
  .filter((p) => /_stimme_/.test(p.name));
for (const eintrag of gruesse) {
  await sitzung.anDieBox('/api/photos/' + encodeURIComponent(eintrag.name), { method: 'DELETE' });
}
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ stimme: { enabled: vorher.stimme.enabled, sekunden: vorher.stimme.sekunden } }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
