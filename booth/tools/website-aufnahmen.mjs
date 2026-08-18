/**
 * Echte Aufnahmen der Software für die Website.
 *
 * Auf der Website standen an mehreren Stellen gestrichelte Kästen mit „Bild
 * fehlt". Bei den Screenshots war das unnötig: Die Software gibt es, sie
 * läuft, und ein Bild davon ist einen Befehl entfernt. Ein gezeichneter
 * Ersatz wäre hier schlechter als das Original.
 *
 * Für die Hardware bleibt es beim Zeichnen — eine Fotobox lässt sich nicht
 * aus dem Quelltext heraus fotografieren.
 *
 *   node tools/website-aufnahmen.mjs
 */

import { chromium } from 'playwright-core';
import { alsBetreiber, angemeldeterKontext, BASIS } from './betreiber.mjs';

const ZIEL = '/home/user/hnvr-me/youbooth/public/assets/';
const tag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const sitzung = await alsBetreiber();
const post = (pfad, koerper) =>
  sitzung.anDieBox(pfad, { method: 'POST', body: JSON.stringify(koerper) });

/* Ein leeres Portal zeigt nichts. Zwei Anfragen, damit die Aufnahme das
   zeigt, worum es geht — und beide erfunden erkennbar, mit example.org. */
const pakete = (await sitzung.anDieBox('/api/packages')).daten;
const paket = pakete.find((p) => p.active) || pakete[0];
const buchungen = (await sitzung.anDieBox('/api/bookings')).daten;

if (paket && buchungen.length < 2) {
  await post('/api/bookings', {
    packageId: paket.id,
    date: tag(21),
    startTime: '18:00',
    endTime: '23:00',
    name: 'Lena Brandt',
    email: 'lena@example.org',
    phone: '0170 1234567',
    location: 'Gut Hügelhof, Herne',
    message: 'Hochzeit, 140 Gäste. Streifen mit Monogramm wäre schön.',
  });
  await post('/api/bookings', {
    packageId: paket.id,
    date: tag(40),
    startTime: '19:00',
    endTime: '03:00',
    name: 'Kanzlei Ahrend',
    email: 'feier@example.org',
    location: 'Festhalle Ahrend',
    message: 'Firmenfeier, bitte White-Label ohne unser Logo.',
  });
}

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});

/* Doppelte Auflösung: Die Bilder stehen auf der Website in Rahmen von etwa
   640 px Breite, und auf einem Retina-Bildschirm sieht ein 1:1-Screenshot
   matschig aus. */
const masse = { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 };
const bereich = { x: 0, y: 0, width: 1280, height: 860 };

const betreiber = await angemeldeterKontext(browser, sitzung, masse);
const seite = await betreiber.newPage();

await seite.goto(BASIS + '/portal.html', { waitUntil: 'networkidle' });
await seite.waitForSelector('.pkarte');
await seite.screenshot({ path: ZIEL + 'shot-portal-buchungen.png', clip: bereich });

await seite.getByRole('button', { name: 'Kalender' }).click();
await seite.waitForTimeout(500);
await seite.screenshot({ path: ZIEL + 'shot-portal-kalender.png', clip: bereich });

// Die Buchungsseite als Gast: ohne Anmeldung, wie ein Kunde sie sieht.
const gast = await browser.newContext(masse);
const kunde = await gast.newPage();
await kunde.goto(BASIS + '/buchen.html', { waitUntil: 'networkidle' });
await kunde.evaluate(() => {
  const frei = document.querySelectorAll('.bpaket');
  frei[0]?.click();
  const tage = document.querySelectorAll('.btag:not(.btag--weg)');
  tage[Math.min(8, tage.length - 1)]?.click();
});
await kunde.waitForTimeout(400);
await kunde.screenshot({ path: ZIEL + 'shot-buchen.png', clip: bereich });

await browser.close();
console.log('Drei Aufnahmen in ' + ZIEL);
