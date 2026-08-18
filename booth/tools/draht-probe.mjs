/**
 * Probe: eine Box, mehrere Geräte.
 *
 * Was hier geprüft wird, war der teuerste Irrtum dieses Umbaus: Aufnahmen,
 * Einstellungen und Vorlagen lagen im Browser — Foto-Wall am Beamer, Galerie
 * auf dem Handy und Cockpit am Laptop sahen deshalb je ihren eigenen Stand.
 * Auffallen kann das in keinem Einzeltest, nur zwischen zwei echten Geräten.
 * Also laufen hier zwei getrennte Browser-Kontexte gegen dieselbe Box.
 *
 * Dazu die PIN: Sie darf die Box nie verlassen — weder über `/api/settings`
 * noch über den Draht, an dem jedes Gerät im WLAN hängen kann.
 *
 * Aufruf (die Box muss laufen):
 *   node tools/draht-probe.mjs
 *   YOUBOOTH_BASIS=http://box.local:3377 node tools/draht-probe.mjs
 */

import { chromium } from 'playwright-core';

const BASIS = process.env.YOUBOOTH_BASIS || 'http://localhost:3377';
const meldungen = [];
const sage = (gut, text) => { meldungen.push((gut ? 'OK   ' : 'FEHL ') + text); if (!gut) process.exitCode = 1; };

// --- 1. PIN setzen und prüfen ------------------------------------------
await fetch(BASIS + '/api/settings', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ kiosk: { pin: '4711', enabled: true } }),
});
const stand = await (await fetch(BASIS + '/api/settings')).json();
sage(stand.kiosk.gesetzt === true && stand.kiosk.pin === undefined && stand.kiosk.salz === undefined,
  'PIN gesetzt, Prüfsumme kommt nicht über /api/settings heraus');

const falsch = await fetch(BASIS + '/api/kiosk/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '0000' }) });
sage(falsch.status === 403, 'Falsche PIN wird abgelehnt (' + falsch.status + ')');
await new Promise((r) => setTimeout(r, 3200));   // Zwangspause abwarten
const richtig = await fetch(BASIS + '/api/kiosk/pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '4711' }) });
sage(richtig.status === 200, 'Richtige PIN wird angenommen (' + richtig.status + ')');

const browser = await chromium.launch({ ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}), args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

// --- 2. Draht: kommt die Prüfsumme über den WebSocket heraus? ----------
const horcher = await browser.newContext();
const lauscher = await horcher.newPage();
await lauscher.goto(BASIS + '/cockpit.html');
const hallo = await lauscher.evaluate(() => new Promise((fertig) => {
  const w = new WebSocket(`ws://${location.host}/ws?role=fremd`);
  w.addEventListener('message', (e) => { fertig(e.data); w.close(); });
  setTimeout(() => fertig('nichts'), 4000);
}));
sage(!/"salz"|"pin":"[0-9a-f]{16,}/.test(hallo), 'Der WebSocket gibt weder Salz noch Prüfsumme heraus');
sage(/"gesetzt":true/.test(hallo), 'Der WebSocket sagt nur, DASS eine PIN gilt');

// --- 3. Zwei Geräte: Cockpit ändert, Wand zieht nach -------------------
const beamer = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const wand = await beamer.newPage();
await wand.goto(BASIS + '/wand.html');
await wand.waitForSelector('.wkopf h1');

const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const cockpit = await laptop.newPage();
await cockpit.goto(BASIS + '/cockpit.html');
await cockpit.waitForSelector('.ceingabe');

const name = 'Sommerfest ' + Date.now().toString().slice(-5);
const felder = cockpit.locator('.ceingabe');
await felder.nth(0).fill(name);
await cockpit.getByRole('button', { name: 'Sichern' }).click();

let angekommen = false;
for (let i = 0; i < 30; i++) {
  if ((await wand.locator('.wkopf h1').textContent())?.trim() === name) { angekommen = true; break; }
  await wand.waitForTimeout(200);
}
sage(angekommen, 'Eventname aus dem Cockpit steht ohne Neuladen auf der Wand am Beamer');

// --- 4. Neue Aufnahme erscheint live auf der Wand ----------------------
const vorher = await wand.locator('.wkachel').count();
await fetch(BASIS + '/api/photos', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mode: 'foto', source: 'probe', image:
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==' }),
});
let sichtbar = false;
for (let i = 0; i < 25; i++) {
  if ((await wand.locator('.wkachel').count()) > vorher) { sichtbar = true; break; }
  await wand.waitForTimeout(200);
}
sage(sichtbar, 'Neue Aufnahme erscheint auf der Wand, ohne dass jemand neu lädt');

// --- 5. PIN wieder entfernen, damit die Box offen bleibt ---------------
await fetch(BASIS + '/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kiosk: { pin: '', enabled: false } }) });

await browser.close();
console.log(meldungen.join('\n'));
