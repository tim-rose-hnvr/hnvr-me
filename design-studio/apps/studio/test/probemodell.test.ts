/**
 * Das Probemodell im echten Browser.
 *
 * Prüft nicht die Bausteine — das tun deren eigene Tests — sondern die drei
 * Versprechen, die das Produkt ausmachen, an der fertig gebauten Datei:
 *
 * 1. Ein gesperrtes Layout lässt sich nicht verschieben.
 * 2. Eine Farbe außerhalb des Markenkits wird abgelehnt, nicht angemerkt.
 * 3. Eine Ziehbewegung geht mit einem einzigen Rückgängig vollständig zurück.
 *
 * Ohne Chromium überspringt sich der Test — meldet das aber.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATEI = join(HIER, '..', 'ausgabe', 'probemodell.html');

const CHROMIUM = [
  process.env['CHROMIUM_PFAD'],
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => typeof p === 'string' && p !== '' && existsSync(p));

describe.skipIf(CHROMIUM === undefined)('Probemodell', () => {
  let browser: Browser;
  let seite: Page;
  const seitenfehler: string[] = [];

  beforeAll(async () => {
    // Immer frisch bauen: ein Test gegen eine alte Datei prüft nichts.
    execFileSync('node', [join(HIER, '..', 'bauen.mjs')], { stdio: 'pipe' });

    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath: CHROMIUM as string });
    seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    seite.on('pageerror', (e) => seitenfehler.push(String(e)));
    seite.on('console', (m) => {
      if (m.type() === 'error') seitenfehler.push(m.text());
    });

    await seite.goto(`file://${DATEI}`);
    await seite.waitForSelector('.studio-blatt [data-typ="text"]');
    await seite.evaluate(() => document.fonts.ready.then(() => undefined));
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('baut Vorlagen, Bedienfelder und Prüfstand auf', async () => {
    expect(await seite.locator('.vorlage').count()).toBeGreaterThanOrEqual(3);
    expect(await seite.locator('.ampel').count()).toBe(2);
    expect(await seite.locator('.studio-blatt [data-element-id]').count()).toBeGreaterThan(3);
  });

  it('setzt die Markenschrift und trennt deutsche Wörter', async () => {
    const inhalt = await seite.locator('[data-platzhalter="schlagzeile"]').textContent();
    // Weiche Trennstriche sind eingesetzt — `hyphens: auto` wirkt headless nicht.
    expect(inhalt).toContain('­');
  });

  it('lässt ein gesperrtes Layoutelement nicht verschieben', async () => {
    const balken = seite.locator('[data-name="Kopfbalken"]');
    const k = (await balken.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };

    await seite.mouse.move(k.x + 20, k.y + k.height - 12);
    await seite.mouse.down();
    await seite.mouse.move(k.x + 220, k.y + k.height + 90, { steps: 6 });
    await seite.mouse.up();

    expect(await seite.locator('.meldung').textContent()).toContain('gesperrt');
  });

  it('lässt einen Platzhalter auswählen, obwohl er unbeweglich ist', async () => {
    // Ohne das wäre die Vorlage unbenutzbar: nicht auswählbar heißt nicht
    // bearbeitbar, und dann nützt der Platzhalter niemandem.
    await seite.locator('[data-platzhalter="schlagzeile"]').click();
    await seite.waitForTimeout(150);

    expect(await seite.locator('.elementname').textContent()).toContain('Schlagzeile');
    expect(await seite.locator('.studio-rahmen').getAttribute('class')).toContain(
      'studio-gesperrt',
    );
  });

  it('lehnt eine Farbe außerhalb des Markenkits ab', async () => {
    await seite.locator('.vorlage-frei').click();
    await seite.waitForTimeout(300);
    await seite.locator('[data-name="Titel"]').click();

    const vorher = await seite.locator('[data-name="Titel"]').getAttribute('data-farbe');
    await seite.locator('.farbknopf.verboten').click();

    await seite.waitForTimeout(200);
    expect(await seite.locator('.meldung').textContent()).toContain('Markenkit');
    expect(await seite.locator('[data-name="Titel"]').getAttribute('data-farbe')).toBe(vorher);
  });

  it('lässt eine Kitfarbe durch', async () => {
    await seite.locator('.farbknopf').nth(1).click();
    await seite.waitForTimeout(200);
    expect(await seite.locator('[data-name="Titel"]').getAttribute('data-farbe')).toBe('#e2a33c');
  });

  it('verschiebt genau um die Mausbewegung', async () => {
    const kreis = seite.locator('[data-name="Kreis"]');
    const k = (await kreis.boundingBox()) as {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    const startX = k.x + k.width / 2;
    const startY = k.y + k.height / 2;

    await seite.mouse.move(startX, startY);
    await seite.mouse.down();
    await seite.mouse.move(startX + 100, startY + 50, { steps: 10 });
    await seite.mouse.up();
    await seite.waitForTimeout(150);

    const n = (await kreis.boundingBox()) as { x: number; y: number };
    expect(Math.round(n.x - k.x)).toBe(100);
    expect(Math.round(n.y - k.y)).toBe(50);
  });

  it('nimmt die ganze Ziehbewegung mit einem Rückgängig zurück', async () => {
    const kreis = seite.locator('[data-name="Kreis"]');
    const vor = (await kreis.boundingBox()) as { x: number; y: number };

    await seite.keyboard.press('Control+z');
    await seite.waitForTimeout(200);

    const nach = (await kreis.boundingBox()) as { x: number; y: number };
    expect(Math.round(nach.x - vor.x)).toBe(-100);
    expect(Math.round(nach.y - vor.y)).toBe(-50);
  });

  it('läuft ohne einen einzigen Seitenfehler', () => {
    expect(seitenfehler).toEqual([]);
  });
});
