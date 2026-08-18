/**
 * Probe für die Event-Seite — was der Kunde nach der Feier bekommt.
 *
 * Zwei Versprechen stehen auf dieser Seite, und beide muss die Box halten,
 * nicht die Oberfläche: Ein Kennwort hält Fremde draußen, und eine abgelaufene
 * Frist bedeutet, dass die Bilder wirklich weg sind. Geprüft wird deshalb
 * beides — und dass das Kennwort selbst nie über die Leitung geht.
 *
 *   node tools/event-probe.mjs
 */

import { chromium } from 'playwright-core';

const BASIS = process.env.YOUBOOTH_BASIS || 'http://localhost:3377';
const meldungen = [];
const sage = (gut, text) => {
  meldungen.push((gut ? 'OK   ' : 'FEHL ') + text);
  if (!gut) process.exitCode = 1;
};

const anDieBox = async (pfad, wunsch) => {
  const a = await fetch(BASIS + pfad, {
    ...wunsch,
    headers: { 'Content-Type': 'application/json', ...(wunsch?.headers ?? {}) },
  });
  const text = await a.text();
  return { status: a.status, text, daten: text ? JSON.parse(text) : null };
};

/* --- Drei Seiten anlegen: offen, mit Kennwort, abgelaufen ------------ */

const offen = await anDieBox('/api/microsites', {
  method: 'POST',
  body: JSON.stringify({ title: 'Probe offen', headline: 'Lena & Jonas', subtitle: 'Gut Hügelhof, 15. August', enabled: true }),
});
const zu = await anDieBox('/api/microsites', {
  method: 'POST',
  body: JSON.stringify({ title: 'Probe mit Kennwort', headline: 'Nicht für alle', password: 'geheim', enabled: true }),
});
const alt = await anDieBox('/api/microsites', {
  method: 'POST',
  body: JSON.stringify({ title: 'Probe abgelaufen', expires: '2020-01-01', enabled: true }),
});
sage(offen.status === 200 && zu.status === 200 && alt.status === 200, 'Drei Event-Seiten angelegt');

const wegOffen = offen.daten.microsite.slug;
const wegZu = zu.daten.microsite.slug;
const wegAlt = alt.daten.microsite.slug;

/* --- Das Kennwort darf die Box nie verlassen ------------------------- */

const oeffentlich = await anDieBox(`/api/microsites/public/${wegZu}`);
sage(!/geheim/.test(oeffentlich.text), 'Das Kennwort steht nicht in der öffentlichen Antwort');
sage(oeffentlich.daten.locked === true, 'Ohne Kennwort meldet die Box: verschlossen');

const mitFalschem = await anDieBox(`/api/microsites/public/${wegZu}?pw=falsch`);
sage(mitFalschem.daten.locked === true, 'Ein falsches Kennwort öffnet nicht');

const mitRichtigem = await anDieBox(`/api/microsites/public/${wegZu}?pw=geheim`);
sage(!mitRichtigem.daten.locked, 'Das richtige Kennwort öffnet');

/* --- Und am Bildschirm ----------------------------------------------- */

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
const seitenfehler = [];
seite.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 200)));

await seite.goto(`${BASIS}/m/${wegOffen}`, { waitUntil: 'networkidle' });
await seite.waitForSelector('.ekopf h1');
sage(!seitenfehler.length, 'Event-Seite lädt ohne Ausnahme' + (seitenfehler.length ? ': ' + seitenfehler[0] : ''));
sage((await seite.locator('.ekopf h1').textContent()) === 'Lena & Jonas', 'Die Überschrift steht da');
sage(await seite.locator('.eraster, .ekarte').first().isVisible(), 'Galerie oder Hinweis ist da');
sage(
  !(await seite.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)),
  'Kein waagerechtes Scrollen auf dem Handy'
);

await seite.goto(`${BASIS}/m/${wegZu}`, { waitUntil: 'networkidle' });
await seite.waitForSelector('.eeingabe');
sage(true, 'Die verschlossene Seite fragt nach dem Kennwort');
await seite.locator('.eeingabe').fill('geheim');
await seite.getByRole('button', { name: 'Öffnen' }).click();
await seite.waitForSelector('.eraster, .ekarte h2:not(:has-text("Kennwort"))', { timeout: 5000 }).catch(() => null);
sage(!(await seite.locator('.eeingabe').count()), 'Nach dem richtigen Kennwort ist die Abfrage weg');

await seite.goto(`${BASIS}/m/${wegAlt}`, { waitUntil: 'networkidle' });
await seite.waitForSelector('.ekarte h2');
sage(
  (await seite.locator('.ekarte h2').textContent())?.includes('weg'),
  'Die abgelaufene Seite sagt, dass die Bilder weg sind'
);
sage(!(await seite.locator('.eraster').count()), 'Und zeigt kein einziges Bild mehr');

/* --- Aufräumen -------------------------------------------------------- */

for (const weg of [wegOffen, wegZu, wegAlt]) {
  await anDieBox('/api/microsites/' + weg, { method: 'DELETE' });
}

await browser.close();
console.log(meldungen.join('\n'));
