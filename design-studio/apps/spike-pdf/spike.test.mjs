/**
 * Selbsttest des Spikes.
 *
 * Ein Messwerkzeug, das immer dasselbe meldet, misst nichts. Dieser Test fährt
 * die Spike-Seite gegen zwei Content-Security-Policies und verlangt, dass sie
 * unterschiedlich ausgeht:
 *
 * - ohne CSP                → alle kritischen Prüfungen bestanden
 * - ohne `wasm-unsafe-eval` → beide WebAssembly-Prüfungen fallen aus
 *
 * Läuft mit `node --test` und braucht `playwright-core` plus einen Chromium.
 * Ist keiner da, überspringt der Test sich selbst, statt die Werkzeugkette
 * scheitern zu lassen — auf einem CI-Läufer ohne Browser ist das kein Fehler.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const SEITE = join(HIER, 'index.html');

/** Wix setzt keine cross-origin isolation, deshalb ist SharedArrayBuffer nie kritisch. */
const KRITISCH = [
  'WebAssembly.compile',
  'WebAssembly.instantiate',
  'OffscreenCanvas',
  'Canvas in Druckgröße',
  'Schrift aus data:-URI',
];

const STRENGE_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline'; font-src 'self' data:";

async function ladeChromium() {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    return null;
  }

  const kandidaten = [
    process.env['CHROMIUM_PFAD'],
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter((p) => typeof p === 'string' && p !== '');

  const gefunden = kandidaten.find((p) => existsSync(p));
  if (gefunden === undefined) return null;

  return await chromium.launch({ executablePath: gefunden });
}

/** Fährt die Spike-Seite und gibt den Bericht zurück. `csp` optional. */
async function messe(browser, csp) {
  const seite = await browser.newPage();
  try {
    if (csp === undefined) {
      await seite.goto(`file://${SEITE}`);
    } else {
      const html = readFileSync(SEITE, 'utf8');
      await seite.route('https://spike.test/**', (weg) =>
        weg.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: html,
          headers: { 'Content-Security-Policy': csp },
        }),
      );
      await seite.goto('https://spike.test/messung');
    }

    await seite.waitForFunction(() => globalThis.spikeErgebnis !== undefined, null, {
      timeout: 20_000,
    });
    return await seite.evaluate(() => globalThis.spikeErgebnis);
  } finally {
    await seite.close();
  }
}

const browser = await ladeChromium();

test('Spike', { skip: browser === null ? 'kein Chromium verfügbar' : false }, async (t) => {
  t.after(async () => {
    await browser?.close();
  });

  await t.test('meldet ohne CSP alle kritischen Fähigkeiten als vorhanden', async () => {
    const bericht = await messe(browser);

    const gescheitert = bericht.pruefungen.filter((p) => p.kritisch && !p.bestanden);
    assert.deepEqual(
      gescheitert.map((p) => p.name),
      [],
      `unerwarteter Ausfall: ${gescheitert.map((p) => `${p.name} (${p.ausgabe})`).join(', ')}`,
    );
  });

  await t.test('prüft genau die Fähigkeiten, auf die es ankommt', async () => {
    const bericht = await messe(browser);
    const kritisch = bericht.pruefungen.filter((p) => p.kritisch).map((p) => p.name);

    assert.deepEqual(kritisch.sort(), [...KRITISCH].sort());
  });

  await t.test('schlägt ohne wasm-unsafe-eval aus', async () => {
    const bericht = await messe(browser, STRENGE_CSP);
    const gescheitert = bericht.pruefungen.filter((p) => p.kritisch && !p.bestanden);

    assert.deepEqual(
      gescheitert.map((p) => p.name).sort(),
      ['WebAssembly.compile', 'WebAssembly.instantiate'],
      'Der Spike hat eine blockierende CSP nicht bemerkt — dann misst er nichts.',
    );
    assert.match(gescheitert[0].ausgabe, /Refused to compile/i);
  });

  await t.test('erkennt, dass es im Rahmen läuft', async () => {
    const bericht = await messe(browser, STRENGE_CSP);
    assert.equal(bericht.umgebung.imRahmen, false);
    assert.equal(bericht.umgebung.herkunft, 'https://spike.test');
  });
});
