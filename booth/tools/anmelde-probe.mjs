/**
 * Probe für die Anmeldung — der ganze Weg des Betreibers.
 *
 * Die Frage, die hier beantwortet wird, ist nicht „funktioniert das Formular",
 * sondern: **Kommt jemand ohne Anmeldung an die Kundendaten?** Auf einer Feier
 * hängt die Box im selben WLAN wie die Gäste. Geprüft wird deshalb aus zwei
 * Richtungen: mit Sitzung und ohne.
 *
 *   node tools/anmelde-probe.mjs
 */

import { chromium } from 'playwright-core';

const BASIS = process.env.YOUBOOTH_BASIS || 'http://localhost:3377';
const KENNWORT = 'Probekennwort2026';
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
  let daten = null;
  try { daten = text ? JSON.parse(text) : null; } catch { /* kein JSON */ }
  return { status: a.status, text, daten, keks: a.headers.get('set-cookie') || '' };
};

/* --- Vorher: die Box gehört noch niemandem -------------------------- */

const vorher = await anDieBox('/api/betreiber');
if (vorher.daten.angelegt) {
  console.error('Diese Box hat schon einen Betreiber — die Probe braucht eine frische.');
  console.error('Zum Zurücksetzen: den Block "betreiber" aus daten/config/settings.json entfernen.');
  process.exit(1);
}
sage(true, 'Frische Box: noch kein Betreiber angelegt');

const offenVorher = await anDieBox('/api/bookings');
sage(offenVorher.status === 200, 'Vor der Einrichtung ist die Box am Gerät offen — sonst käme man nie hinein');

/* --- Einrichten am Bildschirm ---------------------------------------- */

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const betreiber = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
const seite = await betreiber.newPage();
const seitenfehler = [];
seite.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 200)));

await seite.goto(BASIS + '/anmelden.html', { waitUntil: 'networkidle' });
await seite.waitForSelector('.aformular');
sage(!seitenfehler.length, 'Anmeldeseite lädt ohne Ausnahme' + (seitenfehler.length ? ': ' + seitenfehler[0] : ''));
sage(
  (await seite.locator('h1').textContent())?.includes('gehört noch niemandem'),
  'Die frische Box bietet die Einrichtung an, nicht die Anmeldung'
);

await seite.getByLabel('Euer Name').fill('Tim Probe');
await seite.getByLabel('E-Mail', { exact: true }).fill('probe@example.org');
await seite.getByLabel('Kennwort', { exact: true }).fill(KENNWORT);
await seite.getByLabel('Kennwort wiederholen').fill(KENNWORT);
await seite.getByLabel('Firma').fill('Probe Eventtechnik GmbH');
await seite.getByLabel('Straße und Hausnummer').fill('Musterweg 3');
await seite.getByLabel('PLZ').fill('44623');
await seite.getByLabel('Ort', { exact: true }).fill('Herne');
await seite.getByLabel('Telefon').fill('+49 234 555018');
await seite.getByLabel('Website').fill('https://youbooth.me');
await seite.getByLabel('Steuer- oder USt-IdNr.').fill('DE123456789');

// Ein winziges PNG als Logo — es geht um den Weg, nicht um das Bild.
await seite.setInputFiles('input[type="file"]', {
  name: 'logo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVQoU2NkYGD4z0AEYBxVSF9FAACcowMBk1mzjwAAAABJRU5ErkJggg==',
    'base64'
  ),
});
await seite.waitForSelector('.alogo__buehne img');
sage(true, 'Das Logo wird vor dem Sichern angezeigt');

await seite.getByRole('button', { name: 'Box einrichten' }).click();
await seite.waitForURL(/cockpit\.html/, { timeout: 10000 });
sage(true, 'Nach der Einrichtung steht der Betreiber im Cockpit');

const nachher = await anDieBox('/api/betreiber');
sage(nachher.daten.angelegt === true, 'Die Box hat jetzt einen Betreiber');
sage(nachher.daten.firma === 'Probe Eventtechnik GmbH', 'Die Firmendaten liegen auf der Box');

/* --- Und jetzt die eigentliche Frage --------------------------------- */

const ohne = await anDieBox('/api/bookings');
sage(ohne.status === 401, 'Ohne Anmeldung: keine Buchungen mehr (' + ohne.status + ')');

const einstellungen = await anDieBox('/api/settings');
sage(
  !/"kennwort"\s*:\s*"[a-f0-9]{32}/.test(einstellungen.text) && !/"salz"/.test(einstellungen.text),
  'Weder Prüfsumme noch Salz kommen über /api/settings heraus'
);
sage(
  /Probe Eventtechnik/.test(einstellungen.text),
  'Die Firmendaten dagegen schon — sie stehen ohnehin auf jedem Abzug'
);

const fremder = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const gast = await fremder.newPage();
await gast.goto(BASIS + '/portal.html', { waitUntil: 'networkidle' });
sage(/anmelden\.html/.test(gast.url()), 'Ein fremder Browser landet am Portal auf dem Anmeldeschirm');

await gast.goto(BASIS + '/', { waitUntil: 'domcontentloaded' });
sage(!/anmelden\.html/.test(gast.url()), 'Der Booth selbst bleibt offen — davor stehen Gäste');
await gast.goto(BASIS + '/wand.html', { waitUntil: 'domcontentloaded' });
sage(!/anmelden\.html/.test(gast.url()), 'Die Foto-Wall am Beamer ebenso');

/* --- Falsches Kennwort, richtiges Kennwort ---------------------------- */

const falsch = await anDieBox('/api/anmelden', {
  method: 'POST',
  body: JSON.stringify({ email: 'probe@example.org', kennwort: 'falschfalsch' }),
});
sage(falsch.status === 403, 'Falsches Kennwort wird abgewiesen (' + falsch.status + ')');
sage(!/E-Mail/.test(falsch.daten?.error || '') || /oder/.test(falsch.daten?.error || ''),
  'Die Auskunft verrät nicht, welches der beiden falsch war');

await new Promise((r) => setTimeout(r, 3200));   // Zwangspause abwarten

await gast.goto(BASIS + '/anmelden.html', { waitUntil: 'networkidle' });
await gast.getByLabel('E-Mail', { exact: true }).fill('probe@example.org');
await gast.getByLabel('Kennwort', { exact: true }).fill(KENNWORT);
await gast.getByRole('button', { name: 'Anmelden' }).click();
await gast.waitForURL(/cockpit\.html/, { timeout: 10000 });
sage(true, 'Mit dem richtigen Kennwort geht es ins Cockpit');

await browser.close();
console.log(meldungen.join('\n'));
console.log('\nHinweis: Die Box trägt jetzt den Probebetreiber probe@example.org.');
