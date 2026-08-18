/**
 * Probe für das Betreiber-Portal.
 *
 * Geprüft wird der Weg, den eine Anfrage im Betrieb wirklich nimmt: Der Kunde
 * schickt sie über die öffentliche Schnittstelle, der Betreiber sieht sie am
 * Bildschirm und entscheidet dort. Ein Test, der nur die Schnittstelle
 * anspricht, hätte gesagt „geht" — obwohl auf der Seite kein Knopf steht.
 *
 *   node tools/portal-probe.mjs
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
  return { status: a.status, daten: text ? JSON.parse(text) : null };
};

/* --- Vorbereitung: ein buchbares Paket ------------------------------ */

const paket = await anDieBox('/api/packages', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Probepaket',
    price: '590 €',
    hours: 4,
    features: ['Sofortdruck', 'Galerie'],
    active: true,
  }),
});
sage(paket.status === 200, 'Paket angelegt (' + paket.status + ')');
const paketId = paket.daten?.package?.id ?? paket.daten?.id;

/* --- Der Kunde fragt an — über den öffentlichen Weg ----------------- */

const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const anfrage = await anDieBox('/api/bookings', {
  method: 'POST',
  body: JSON.stringify({
    packageId: paketId,
    date: morgen,
    startTime: '18:00',
    endTime: '23:00',
    name: 'Probekunde',
    email: 'probe@example.org',
    location: 'Gut Hügelhof',
    message: 'Wir hätten gern den Streifen mit Monogramm.',
  }),
});
sage(anfrage.status === 200, 'Buchungsanfrage angenommen (' + anfrage.status + ')');

/* --- Und der Betreiber sieht sie am Bildschirm ---------------------- */

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const seite = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const seitenfehler = [];
seite.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 200)));

await seite.goto(BASIS + '/portal.html', { waitUntil: 'networkidle' });
await seite.waitForSelector('.pkarte');

sage(!seitenfehler.length, 'Portal lädt ohne Ausnahme' + (seitenfehler.length ? ': ' + seitenfehler[0] : ''));
sage(
  (await seite.locator('.pkarte__titel').first().textContent())?.includes('Probekunde'),
  'Die Anfrage steht im Portal'
);

// Bestätigen — und nachsehen, ob der Server sie wirklich umgestellt hat.
await seite.getByRole('button', { name: 'Bestätigen' }).first().click();
await seite.waitForSelector('.pmeldung--gut');
const nachher = await anDieBox('/api/bookings');
const gebucht = nachher.daten.find((b) => b.name === 'Probekunde');
sage(gebucht?.status === 'bestätigt', 'Bestätigen wirkt bis in die Ablage der Box');

// Ein bestätigter Tag muss auf der Buchungsseite als belegt erscheinen.
const frei = await anDieBox('/api/availability');
sage(frei.daten.booked.includes(morgen), 'Der bestätigte Tag gilt als belegt');

/* --- Kalender: einen Tag sperren ------------------------------------ */

await seite.getByRole('button', { name: 'Kalender' }).click();
await seite.waitForSelector('.ptag');
const freierTag = seite.locator('.ptag:not(.ptag--vorbei):not(.ptag--belegt):not(.ptag--gesperrt)').first();
const tagsnummer = await freierTag.textContent();
await freierTag.click();
await seite.waitForSelector('.pmeldung--gut');
const gesperrt = await anDieBox('/api/blocked');
sage(gesperrt.daten.length > 0, `Tag ${tagsnummer} gesperrt, die Box weiß es`);

/* --- Ticket: Kunde fragt, Betreiber antwortet ----------------------- */

const ticket = await anDieBox('/api/tickets', {
  method: 'POST',
  body: JSON.stringify({
    subject: 'Drucker klemmt',
    name: 'Probekunde',
    contact: 'probe@example.org',
    message: 'Nach dem zwanzigsten Abzug kommt nichts mehr.',
  }),
});
sage(ticket.status === 200, 'Ticket angelegt (' + ticket.status + ')');

await seite.getByRole('button', { name: 'Tickets' }).click();
await seite.waitForSelector('.pantwort');
await seite.locator('.pantwort').first().fill('Papierfach prüfen, dann Deckel zweimal schließen.');
await seite.getByRole('button', { name: 'Antworten' }).first().click();
await seite.waitForSelector('.pmeldung--gut');

const ticketsNachher = await anDieBox('/api/tickets');
const unseres = ticketsNachher.daten.find((t) => t.subject === 'Drucker klemmt');
sage(unseres?.messages.length === 2, 'Die Antwort steht im Verlauf');

/* --- Aufräumen ------------------------------------------------------ */

if (gebucht) await anDieBox('/api/bookings/' + gebucht.id, { method: 'DELETE' });
if (paketId) await anDieBox('/api/packages/' + paketId, { method: 'DELETE' });
for (const tag of gesperrt.daten) await anDieBox('/api/blocked', { method: 'POST', body: JSON.stringify({ date: tag }) });

await browser.close();
console.log(meldungen.join('\n'));
