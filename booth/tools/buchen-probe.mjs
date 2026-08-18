/**
 * Probe für die Buchungsseite — der Weg des Kunden, im Browser.
 *
 * Geprüft wird, was zwischen zwei Menschen steht: Der Kunde wählt Paket und
 * Tag und schickt ab; danach muss die Anfrage im Portal des Betreibers liegen.
 * Und der wichtigste Fall überhaupt: Ein bereits vergebener Samstag darf gar
 * nicht erst anklickbar sein — eine Doppelbuchung merkt man sonst erst, wenn
 * zwei Paare vor derselben Box stehen.
 *
 *   node tools/buchen-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS, alsBetreiber } from './betreiber.mjs';

const meldungen = [];
const sage = (gut, text) => {
  meldungen.push((gut ? 'OK   ' : 'FEHL ') + text);
  if (!gut) process.exitCode = 1;
};

/* Vorbereiten und Nachsehen tut hier der Betreiber — die Buchungsseite
   selbst bleibt bewusst ohne Anmeldung, sie ist für Kunden. */
const sitzung = await alsBetreiber();
const anDieBox = sitzung.anDieBox;

const alsSchluessel = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* --- Vorbereitung ---------------------------------------------------- */

const angeboten = await anDieBox('/api/packages', {
  method: 'POST',
  body: JSON.stringify({ name: 'Probe buchbar', price: '490 €', hours: 4, features: ['Sofortdruck'], active: true }),
});
const geheim = await anDieBox('/api/packages', {
  method: 'POST',
  body: JSON.stringify({ name: 'Probe abgeschaltet', price: '999 €', hours: 9, features: [], active: false }),
});
const idOffen = angeboten.daten?.package?.id ?? angeboten.daten?.id;
const idAus = geheim.daten?.package?.id ?? geheim.daten?.id;

// Einen Tag sperren, damit die Seite ihn verstecken muss.
const gesperrterTag = new Date();
gesperrterTag.setDate(gesperrterTag.getDate() + 3);
const gesperrt = alsSchluessel(gesperrterTag);
await anDieBox('/api/blocked', { method: 'POST', body: JSON.stringify({ date: gesperrt }) });

/* --- Der Kunde am Bildschirm ----------------------------------------- */

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
// Handyformat: So wird diese Seite tatsächlich gelesen.
const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
const seitenfehler = [];
seite.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 200)));

await seite.goto(BASIS + '/buchen.html', { waitUntil: 'networkidle' });
await seite.waitForSelector('.bpaket');

sage(!seitenfehler.length, 'Buchungsseite lädt ohne Ausnahme' + (seitenfehler.length ? ': ' + seitenfehler[0] : ''));

const namen = await seite.locator('.bpaket__name').allTextContents();
sage(namen.includes('Probe buchbar'), 'Das buchbare Paket steht da');
sage(!namen.includes('Probe abgeschaltet'), 'Das abgeschaltete Paket steht NICHT da');

sage(
  !(await seite.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  )),
  'Kein waagerechtes Scrollen auf dem Handy'
);

// Zum Monat des gesperrten Tages blättern und nachsehen, dass er tot ist.
const heute = new Date();
const monateVor =
  (gesperrterTag.getFullYear() - heute.getFullYear()) * 12 + gesperrterTag.getMonth() - heute.getMonth();
for (let i = 0; i < monateVor; i++) await seite.getByLabel('Nächster Monat').click();
const gesperrterKnopf = seite.locator('.btag', { hasText: new RegExp(`^${gesperrterTag.getDate()}$`) }).first();
sage(await gesperrterKnopf.isDisabled(), 'Der gesperrte Tag ist nicht anklickbar');

// Einen freien Tag wählen und abschicken.
await seite.locator('.bpaket', { hasText: 'Probe buchbar' }).click();
const freierTag = seite.locator('.btag:not(.btag--weg)').first();
const tagsnummer = await freierTag.textContent();
await freierTag.click();

await seite.getByLabel(/^Name/).fill('Probe Kundin');
await seite.getByLabel(/^E-Mail/).fill('kundin@example.org');
await seite.getByLabel('Ort der Feier').fill('Scheune ohne Netz');
await seite.locator('textarea.beingabe').fill('80 Gäste, Streifen bitte.');
await seite.getByRole('button', { name: 'Anfrage schicken' }).click();
await seite.waitForSelector('.bbereich--dank');
sage(true, 'Nach dem Abschicken steht die Bestätigung');

/* --- Und im Portal? --------------------------------------------------- */

const buchungen = await anDieBox('/api/bookings');
const unsere = buchungen.daten.find((b) => b.name === 'Probe Kundin');
sage(!!unsere, `Die Anfrage vom ${tagsnummer}. liegt beim Betreiber`);
sage(unsere?.status === 'angefragt', 'Sie steht auf „angefragt", nicht auf bestätigt');
sage(unsere?.packageName === 'Probe buchbar', 'Das gewählte Paket ist vermerkt');

/* --- Aufräumen -------------------------------------------------------- */

if (unsere) await anDieBox('/api/bookings/' + unsere.id, { method: 'DELETE' });
if (idOffen) await anDieBox('/api/packages/' + idOffen, { method: 'DELETE' });
if (idAus) await anDieBox('/api/packages/' + idAus, { method: 'DELETE' });
await anDieBox('/api/blocked', { method: 'POST', body: JSON.stringify({ date: gesperrt }) });

await browser.close();
console.log(meldungen.join('\n'));
