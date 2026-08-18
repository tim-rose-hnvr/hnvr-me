/**
 * Die Einwegkamera — der Film je Gast.
 *
 * Dieses Modul verkauft eine Verneinung: kein Nachschauen, kein Löschen,
 * kein zweiter Versuch. Eine Probe, die nur prüft, ob ein Bild ankommt,
 * prüft deshalb das Falsche. Gemessen wird vor allem, was NICHT passiert:
 *
 *   · Steht nirgends eine Vorschau des gerade gemachten Bildes?
 *   · Geht das Zählwerk nur nach unten, auch über ein Neuladen hinweg?
 *   · Bleiben unentwickelte Bilder aus Galerie, Wand und Ablage heraus?
 *   · Ist der Film wirklich voll, wenn er voll ist?
 *   · Und kommen beim Entwickeln alle Bilder auf einmal?
 *
 * Voraussetzung: die Box läuft (npm run build && npm run server).
 *
 *   node tools/film-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS, alsBetreiber } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

/* Ein 1×1-PNG. Reicht überall dort, wo nur zählt, DASS ein Bild ankommt. */
const EINPUNKT =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const sitzung = await alsBetreiber();
const vorher = await fetch(BASIS + '/api/settings').then((r) => r.json());
const bilderVorher = (await fetch(BASIS + '/api/photos').then((r) => r.json())).length;
/* Im Labor koennen Bilder eines laufenden Abends liegen. Die Probe raeumt sie
   NICHT weg — sie gehoeren Gaesten, die sie noch nicht gesehen haben. Also
   wird mit Differenzen gemessen statt mit absoluten Zahlen. */
const laborVorher = (await (await alsBetreiber()).anDieBox('/api/filme')).daten?.imLabor ?? 0;

/* Ein kurzer Film, damit die Probe ihn wirklich vollknipst — genau der Fall
   ist interessant, und mit vierundzwanzig Bildern dauert er zu lange. Die
   Box lässt nur 12, 24 und 36 zu; zwölf ist der kürzeste echte Film. */
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    einweg: { enabled: true, bilder: 12, entwicklung: 'hand', look: 'stempel', nachladen: true },
  }),
});

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
/* Ein Handy, hochkant. Auf einem Laptopfenster gemessen wäre die Frage nach
   dem Daumen gar nicht gestellt. */
const kontext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['camera'],
  isMobile: true,
  hasTouch: true,
});
const seite = await kontext.newPage();
await seite.goto(BASIS + '/film', { waitUntil: 'networkidle' });
await seite.waitForTimeout(800);

console.log('\n1 · Einen Film holen');
pruefe('Es steht ein Namensfeld da und sonst nichts',
  (await seite.locator('.fmholen input').count()) === 1 &&
  (await seite.locator('.fmleiste button:visible').count()) === 1);
pruefe('Der Satz erklärt die Regel, bevor jemand drückt',
  /kein nachschauen|kein löschen/i.test(await seite.locator('.fmsagt').innerText()),
  (await seite.locator('.fmsagt').innerText()).slice(0, 80));

await seite.locator('.fmholen input').fill('Probe-Gast');
await seite.locator('.fmholen button').click();
await seite.locator('.fmwerk').waitFor({ state: 'visible', timeout: 8000 });
pruefe('Das Zählwerk steht auf der vollen Filmlänge',
  (await seite.locator('.fmwerk').innerText()).trim() === '12',
  await seite.locator('.fmwerk').innerText());

console.log('\n2 · Knipsen, ohne zu schauen');
await seite.getByRole('button', { name: /kamera einschalten/i }).click();
await seite.locator('.fmausloeser').waitFor({ state: 'visible', timeout: 15000 });

/* Antippziele: Das hier hält jemand mit einer Hand, im Halbdunkeln, nach
   dem dritten Glas. */
const ziele = await seite.evaluate(() =>
  [...document.querySelectorAll('button, a')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => ({ t: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18), h: Math.round(e.getBoundingClientRect().height) }))
);
pruefe('Kein Bedienelement unter 44px', ziele.every((z) => z.h >= 44),
  ziele.filter((z) => z.h < 44).map((z) => `${z.t}:${z.h}`).join(', '));

await seite.locator('.fmausloeser').click();
await seite.waitForFunction(() => document.querySelector('.fmwerk')?.textContent?.trim() === '11', null, { timeout: 15000 });
pruefe('Ein Druck, ein Bild weniger', true);

/* DIE Prüfung des Moduls. Ein Bildelement mit einer Quelle, das nach der
   Aufnahme sichtbar ist, wäre die Vorschau, die es nicht geben darf —
   auch nicht für einen Moment. */
const nachschau = await seite.evaluate(() => {
  const bilder = [...document.querySelectorAll('img, canvas')]
    .filter((e) => e.offsetParent !== null);
  return bilder.map((e) => e.tagName + ':' + (e.getAttribute('src') || '').slice(0, 30));
});
pruefe('Es gibt keine Vorschau des eben gemachten Bildes',
  nachschau.length === 0, nachschau.join(', '));

const hintergrund = await seite.evaluate(() =>
  document.body.innerHTML.includes('data:image') ? 'Bilddaten im Dokument' : ''
);
pruefe('Auch nicht versteckt im Dokument', hintergrund === '', hintergrund);

console.log('\n3 · Das Zählwerk gehört der Box');
/* Läge der Zähler im Browser, wäre der Film mit einem Neuladen wieder voll —
   und die einzige Regel des Moduls hinfällig. */
await seite.reload({ waitUntil: 'networkidle' });
await seite.locator('.fmwerk').waitFor({ state: 'visible', timeout: 8000 });
pruefe('Nach dem Neuladen steht der Zähler weiter auf 11',
  (await seite.locator('.fmwerk').innerText()).trim() === '11',
  await seite.locator('.fmwerk').innerText());

console.log('\n4 · Unentwickelt sieht sie niemand');
const ablage = await fetch(BASIS + '/api/photos').then((r) => r.json());
pruefe('Das Bild liegt NICHT in der Ablage, aus der Galerie und Wand lesen',
  ablage.length === bilderVorher, `vorher ${bilderVorher}, jetzt ${ablage.length}`);

const uebersicht = await sitzung.anDieBox('/api/filme');
pruefe('Der Betreiber sieht den Film und den Zählerstand',
  uebersicht.daten?.filme?.[0]?.geknipst === 1, JSON.stringify(uebersicht.daten?.filme?.[0]));
pruefe('Aber auch er bekommt keine Bilder — nur die Zahl im Labor',
  uebersicht.daten?.imLabor === laborVorher + 1 &&
  !JSON.stringify(uebersicht.daten).includes('data:image'),
  `${uebersicht.daten?.imLabor} (vorher ${laborVorher})`);

console.log('\n5 · Ist der Film voll, ist er voll');
await seite.getByRole('button', { name: /kamera einschalten/i }).click();
await seite.locator('.fmausloeser').waitFor({ state: 'visible', timeout: 15000 });
for (let i = 11; i > 0; i--) {
  await seite.locator('.fmausloeser').click();
  await seite.waitForFunction(
    (rest) => {
      const werk = document.querySelector('.fmwerk')?.textContent?.trim();
      return werk === String(rest);
    },
    i - 1,
    { timeout: 15000 }
  );
}
pruefe('Das Zählwerk steht auf null', (await seite.locator('.fmwerk').innerText()).trim() === '0');
pruefe('Der Auslöser ist weg — nicht nur gesperrt',
  (await seite.locator('.fmausloeser').count()) === 0);
const schluss = await seite.locator('.fmsagt').innerText();
pruefe('Und es steht da, wann entwickelt wird', /von hand|entwickelt/i.test(schluss),
  schluss.slice(0, 90));

/* Ein dreizehntes Bild darf die Box nicht annehmen — auch nicht, wenn es
   jemand an der Oberfläche vorbei schickt. Die Regel gehört in den Kern. */
const filmId = uebersicht.daten.filme[0].id;
const zuviel = await fetch(`${BASIS}/api/film/${filmId}/bild`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: EINPUNKT }),
});
pruefe('Die Box weist das dreizehnte Bild ab, nicht erst die Oberfläche',
  zuviel.status === 409, String(zuviel.status));

console.log('\n6 · Entwickeln bringt alle Bilder auf einmal');
const entwickelt = await sitzung.anDieBox('/api/film/entwickeln', { method: 'POST' });
pruefe('Der Betreiber kann von Hand entwickeln', entwickelt.status === 200,
  String(entwickelt.status));
pruefe(`Alle zwölf Bilder sind auf einmal da (${entwickelt.daten?.entwickelt} inkl. ${laborVorher} aus dem Labor)`,
  entwickelt.daten?.entwickelt === 12 + laborVorher, JSON.stringify(entwickelt.daten));

const danach = await fetch(BASIS + '/api/photos').then((r) => r.json());
pruefe('Und liegen jetzt dort, wo Galerie und Wand lesen',
  danach.length === bilderVorher + 12 + laborVorher,
  `vorher ${bilderVorher}, jetzt ${danach.length}`);
pruefe('Sie tragen die Aufnahmeart im Dateinamen, wie jede andere Aufnahme',
  danach.filter((p) => /_einweg_/.test(p.name)).length >= 12,
  String(danach.filter((p) => /_einweg_/.test(p.name)).length));

console.log('\n7 · Der Datumsstempel steht im Bild');
/* Der Look wird auf dem Gerät des Gastes gerechnet. Er muss also wirklich
   IM Bild sein und nicht als Überlagerung darüber liegen — sonst fehlt er
   auf dem Abzug. */
const stempel = await seite.evaluate(async (pfad) => {
  const bild = await new Promise((fertig) => {
    const b = new Image();
    b.onload = () => fertig(b);
    b.src = pfad;
  });
  const f = document.createElement('canvas');
  f.width = bild.naturalWidth;
  f.height = bild.naturalHeight;
  const stift = f.getContext('2d');
  stift.drawImage(bild, 0, 0);
  /* Unten rechts, dort steht der Stempel des Labors. Gesucht wird sein
     Orange — eine Farbe, die im grünen Testbild der Scheinkamera sonst
     nirgends vorkommt. */
  const ecke = stift.getImageData(
    Math.floor(f.width * 0.55), Math.floor(f.height * 0.9),
    Math.floor(f.width * 0.44), Math.floor(f.height * 0.09)
  ).data;
  let orange = 0;
  for (let i = 0; i < ecke.length; i += 4) {
    if (ecke[i] > 180 && ecke[i + 1] > 80 && ecke[i + 1] < 190 && ecke[i + 2] < 110) orange++;
  }
  return orange;
}, danach.find((p) => /_einweg_/.test(p.name)).url);
pruefe(`Unten rechts steht etwas in Laborschrift-Orange (${stempel} Punkte)`, stempel > 40);

console.log('\n8 · Für die nächste Veranstaltung zurücksetzen');
/* Der Betreiber muss die Filme des letzten Abends loswerden — aber erst,
   wenn alles entwickelt ist. Sonst verlöre er Bilder, die Gäste noch nicht
   gesehen haben. */
const zurueck = await sitzung.anDieBox('/api/filme/zuruecksetzen', { method: 'POST' });
pruefe('Nach dem Entwickeln lassen sich die Filme verwerfen', zurueck.status === 200,
  String(zurueck.status));
pruefe('Danach ist die Liste leer',
  (await sitzung.anDieBox('/api/filme')).daten?.filme?.length === 0);

/* Und die Gegenprobe: Mit Bildern im Labor darf es NICHT gehen. */
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ einweg: { enabled: true, bilder: 12, entwicklung: 'hand' } }),
});
const zweiter = await fetch(BASIS + '/api/film', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Nachzügler' }),
}).then((r) => r.json());
await fetch(`${BASIS}/api/film/${zweiter.film.id}/bild`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: EINPUNKT }),
});
const gesperrt = await sitzung.anDieBox('/api/filme/zuruecksetzen', { method: 'POST' });
pruefe('Mit unentwickelten Bildern im Labor wird das Zurücksetzen verweigert',
  gesperrt.status === 409, `${gesperrt.status} ${gesperrt.daten?.error || ''}`);

// Aufräumen: weder Testbilder noch geänderte Einstellungen bleiben zurück.
await sitzung.anDieBox('/api/film/entwickeln', { method: 'POST' });
await sitzung.anDieBox('/api/filme/zuruecksetzen', { method: 'POST' });
const reste = await fetch(BASIS + '/api/photos').then((r) => r.json());
for (const bild of reste.filter((p) => /_einweg_/.test(p.name))) {
  await sitzung.anDieBox('/api/photos/' + encodeURIComponent(bild.name), { method: 'DELETE' });
}
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    einweg: {
      enabled: vorher.einweg.enabled,
      bilder: vorher.einweg.bilder,
      entwicklung: vorher.einweg.entwicklung,
      look: vorher.einweg.look,
      nachladen: vorher.einweg.nachladen,
    },
  }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
