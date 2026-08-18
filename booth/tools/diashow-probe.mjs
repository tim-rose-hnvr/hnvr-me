/**
 * Die Vollbild-Diashow für Beamer und Fernseher.
 *
 * Eine Diashow läuft einen ganzen Abend, und niemand steht daneben. Was hier
 * schiefgeht, merkt der Betreiber erst, wenn ein Gast fragt, warum die
 * Leinwand schwarz ist. Deshalb misst diese Probe am laufenden Bild:
 *
 *   · Läuft sie überhaupt weiter, oder bleibt sie beim ersten Bild stehen?
 *   · Ist da wirklich nichts zum Antippen? (Regel: keine Bedienelemente)
 *   · Kommen die Zwischenbilder im eingestellten Rhythmus?
 *   · Steht zwischen zwei Bildern nie ein schwarzes Loch?
 *   · Wird ein hochkantes Foto vollständig gezeigt statt beschnitten?
 *   · Kommt eine frische Aufnahme bald dran und nicht erst nach vierzig?
 *
 * Voraussetzung: die Box läuft (npm run build && npm run server).
 *
 *   node tools/diashow-probe.mjs
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

/* Kurze Standzeiten, damit die Probe nicht eine Minute lang zusieht. Die
   Werte sind gültig (die Box lässt ab drei Sekunden zu) — gemessen wird der
   Rhythmus, nicht die Geduld. */
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    diashow: { dauer: 3, bewegung: true, jedesTafel: 2 },
    playlist: {
      enabled: true,
      slides: [
        { id: 'p1', type: 'text', duration: 3, title: 'Das Buffet ist eröffnet', subtitle: 'Hinten rechts, neben der Bar' },
        { id: 'p2', type: 'text', duration: 3, title: 'Danke fürs Kommen', subtitle: '' },
      ],
    },
  }),
});

/* Genug Aufnahmen, damit ein Rhythmus überhaupt sichtbar wird. Es muss
   mindestens eine hochkante dabei sein: Genau die wird auf einer
   querformatigen Leinwand beschnitten, wenn `object-fit` falsch steht. */
const angelegt = [];
for (const [breite, hoehe] of [[600, 900], [900, 600], [600, 900], [900, 600], [600, 900]]) {
  const bild =
    'data:image/png;base64,' +
    Buffer.from(await machPng(breite, hoehe)).toString('base64');
  const a = await fetch(BASIS + '/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: bild, mode: 'foto', source: 'booth' }),
  }).then((r) => r.json());
  angelegt.push(a.photo.name);
}

async function machPng(breite, hoehe) {
  /* Ein winziges PNG von Hand zu bauen ist mehr Arbeit als es wert ist —
     der Browser kann es. Er läuft ohnehin gleich. */
  const b = await chromium.launch({
    ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  });
  const s = await b.newPage();
  const daten = await s.evaluate(
    ([w, h]) => {
      const f = document.createElement('canvas');
      f.width = w;
      f.height = h;
      const stift = f.getContext('2d');
      stift.fillStyle = w > h ? '#2b6cb0' : '#b02b6c';
      stift.fillRect(0, 0, w, h);
      return f.toDataURL('image/png').split(',')[1];
    },
    [breite, hoehe]
  );
  await b.close();
  return Buffer.from(daten, 'base64');
}

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
/* Ein Beamer ist 16:9. Auf einem anderen Seitenverhältnis zu messen hieße,
   die Frage nach dem Beschnitt gar nicht zu stellen. */
const kontext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const seite = await kontext.newPage();
await seite.goto(BASIS + '/diashow.html', { waitUntil: 'networkidle' });
await seite.waitForTimeout(1200);

console.log('\n1 · Nichts zum Antippen');
const bedienbar = await seite.evaluate(() =>
  [...document.querySelectorAll('button, a, input, [role="button"]')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => (e.textContent || e.tagName).trim().slice(0, 20))
);
pruefe('Auf der Leinwand steht kein einziges Bedienelement',
  bedienbar.length === 0, bedienbar.join(', '));
pruefe('Und kein Mauszeiger, der den Abend über im Bild steht',
  (await seite.evaluate(() => getComputedStyle(document.body).cursor)) === 'none');

console.log('\n2 · Sie läuft weiter');
const gesehen = new Set();
const proben = [];
for (let i = 0; i < 14; i++) {
  proben.push(
    await seite.evaluate(() => {
      const platte = document.querySelector('.dplatte:last-child');
      if (!platte) return { art: 'nichts' };
      const foto = platte.querySelector('.dfoto');
      if (foto) return { art: 'foto', quelle: foto.getAttribute('src') };
      const tafel = platte.querySelector('.dtafel__titel');
      return { art: 'tafel', quelle: (tafel?.textContent || '').trim() };
    })
  );
  await seite.waitForTimeout(1000);
}
proben.forEach((p) => gesehen.add(`${p.art}:${p.quelle}`));

pruefe(`In 14 Sekunden wechselt das Bild mehrfach (${gesehen.size} verschiedene)`,
  gesehen.size >= 4, [...gesehen].map((g) => g.split('/').pop()).join(' · '));
pruefe('Zu keinem Zeitpunkt war die Leinwand leer',
  proben.every((p) => p.art !== 'nichts'));

console.log('\n3 · Die Zwischenbilder kommen dazwischen');
const tafeln = proben.filter((p) => p.art === 'tafel');
const fotos = proben.filter((p) => p.art === 'foto');
pruefe(`Tafeln laufen mit (${tafeln.length} von 14 Blicken)`, tafeln.length > 0,
  [...new Set(tafeln.map((t) => t.quelle))].join(' · '));
pruefe(`Und Fotos auch (${fotos.length} von 14 Blicken)`, fotos.length > 0);
pruefe('Es ist nicht NUR eine Tafel, die stehen bleibt',
  new Set(fotos.map((f) => f.quelle)).size >= 2,
  String(new Set(fotos.map((f) => f.quelle)).size));

console.log('\n4 · Kein Loch zwischen zwei Bildern');
/* Beim Wechsel liegen kurz zwei Platten übereinander. Fehlte die untere,
   sähe man auf drei Metern Leinwand für einen Moment schwarz. */
const ebenen = [];
for (let i = 0; i < 10; i++) {
  ebenen.push(await seite.locator('.dplatte').count());
  await seite.waitForTimeout(320);
}
pruefe('Immer mindestens eine Ebene auf der Bühne', Math.min(...ebenen) >= 1,
  ebenen.join(','));
pruefe('Und nie mehr als zwei — sonst wächst die Seite über den Abend an',
  Math.max(...ebenen) <= 2, ebenen.join(','));

console.log('\n5 · Ein hochkantes Foto wird nicht beschnitten');
const passung = await seite.evaluate(() => {
  const foto = document.querySelector('.dfoto');
  return foto ? getComputedStyle(foto).objectFit : null;
});
pruefe('Das Foto wird eingepasst, nicht formatfüllend beschnitten',
  passung === 'contain', String(passung));
const grund = await seite.evaluate(() => {
  const g = document.querySelector('.dgrund');
  if (!g) return null;
  const stil = getComputedStyle(g);
  return { groesse: stil.backgroundSize, filter: stil.filter };
});
pruefe('Dahinter füllt derselbe, unscharfe Ausschnitt die Fläche',
  grund?.groesse === 'cover' && /blur/.test(grund?.filter || ''),
  JSON.stringify(grund));

console.log('\n6 · Wer neu ist, kommt bald dran');
/* Der Grund für die ganze Einfügelogik: Ein Gast dreht sich zur Leinwand um.
   Er darf nicht warten, bis die Schleife einmal ganz herum ist. */
const frisch =
  'data:image/png;base64,' + Buffer.from(await machPng(640, 640)).toString('base64');
const neu = await fetch(BASIS + '/api/photos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: frisch, mode: 'foto', source: 'booth' }),
}).then((r) => r.json());
angelegt.push(neu.photo.name);

let gezeigt = false;
for (let i = 0; i < 12 && !gezeigt; i++) {
  await seite.waitForTimeout(1000);
  gezeigt = await seite.evaluate(
    (pfad) => !!document.querySelector(`.dfoto[src="${pfad}"]`),
    neu.photo.url
  );
}
pruefe('Die frische Aufnahme steht binnen zwölf Sekunden auf der Leinwand', gezeigt,
  neu.photo.name);

console.log('\n7 · Ohne Box bleibt das Bild stehen');
/* Der wichtigste Fall im Betrieb: Server weg, Beamer läuft weiter. Hier wird
   die Box für die Seite unerreichbar gemacht, ohne sie anzuhalten. */
await seite.route('**/api/photos', (weg) => weg.abort());
const vorAusfall = await seite.evaluate(() => document.querySelectorAll('.dplatte').length);
await seite.waitForTimeout(5000);
const nachAusfall = await seite.evaluate(() => ({
  ebenen: document.querySelectorAll('.dplatte').length,
  hatBild: !!document.querySelector('.dfoto, .dtafel'),
}));
pruefe('Die Diashow läuft ohne Box weiter, statt schwarz zu werden',
  nachAusfall.hatBild && nachAusfall.ebenen >= 1,
  `vorher ${vorAusfall}, nachher ${JSON.stringify(nachAusfall)}`);

// Aufräumen: Die Probe hinterlässt weder Testfotos noch geänderte Werte.
for (const name of angelegt) {
  await sitzung.anDieBox('/api/photos/' + encodeURIComponent(name), { method: 'DELETE' });
}
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    diashow: vorher.diashow,
    playlist: vorher.playlist,
  }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
