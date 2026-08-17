/**
 * Der Leuchttisch im echten Browser.
 *
 * Prüft die drei Versprechen, die dieses Werkzeug von jedem anderen
 * unterscheiden — an der fertig gebauten Datei:
 *
 * 1. **Bindung statt Kopie.** Eine Änderung an der Aussage zieht durch alle
 *    Formate. Bei „Magic Resize" wären das unabhängige Dateien.
 * 2. **Kürzungsstufen.** Dieselbe Aussage, verschiedene Längen je Format —
 *    ohne dass jemand zweimal tippt.
 * 3. **Wirkungsprüfung.** Lesbarkeit auf Entfernung, Sperrflächen der
 *    Plattform, Haltbarkeit nach dem Termin.
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

/** Weiche Trennstriche stören den Textvergleich, nicht die Anzeige. */
function ohneTrennung(text: string | null): string {
  return (text ?? '').replaceAll('­', '');
}

describe.skipIf(CHROMIUM === undefined)('Leuchttisch', () => {
  let browser: Browser;
  let seite: Page;
  const seitenfehler: string[] = [];

  beforeAll(async () => {
    execFileSync('node', [join(HIER, '..', 'bauen.mjs')], { stdio: 'pipe' });

    const { chromium } = await import('playwright-core');
    browser = await chromium.launch({ executablePath: CHROMIUM as string });
    seite = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    seite.on('pageerror', (e) => seitenfehler.push(String(e)));
    seite.on('console', (m) => {
      if (m.type() === 'error') seitenfehler.push(m.text());
    });

    await seite.goto(`file://${DATEI}`);
    await seite.waitForSelector('.andruck');
    await seite.evaluate(() => document.fonts.ready.then(() => undefined));
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
  });

  it('zeigt alle Ausspielungen gleichzeitig', async () => {
    expect(await seite.locator('.andruck').count()).toBe(5);
    expect(await seite.locator('.chip').count()).toBe(5);
  });

  it('wählt je Format eine andere Kürzungsstufe — ohne zweites Tippen', async () => {
    // Das ist die Pointe: derselbe Titel, drei Längen, jedes Format nimmt die
    // längste, die in seinen Rahmen passt.
    const plakat = ohneTrennung(
      await seite.locator('[data-ausspielung="plakat"] [data-name="Titel"]').textContent(),
    );
    const story = ohneTrennung(
      await seite.locator('[data-ausspielung="story"] [data-name="Titel"]').textContent(),
    );
    const linkedin = ohneTrennung(
      await seite.locator('[data-ausspielung="linkedin"] [data-name="Titel"]').textContent(),
    );

    expect(plakat).toBe('Sommerfest der Hauptverwaltung');
    expect(story).toBe('Sommerfest 2026');
    expect(linkedin).toBe('Sommerfest');

    expect(
      await seite.locator('[data-ausspielung="linkedin"] .stufenmarke').first().textContent(),
    ).toContain('kurz');
  });

  it('zieht eine Änderung der Aussage durch alle Formate', async () => {
    // Bewusst wieder eine lange Fassung: wäre sie kurz, würde die Story sie
    // übernehmen — und zwar zu Recht, weil dann die längste passende Fassung
    // eben die lange ist.
    await seite
      .locator('input[data-feld="titel"][data-stufe="lang"]')
      .fill('Winterfest der Hauptverwaltung');
    await seite.waitForTimeout(250);

    expect(
      ohneTrennung(
        await seite.locator('[data-ausspielung="plakat"] [data-name="Titel"]').textContent(),
      ),
    ).toBe('Winterfest der Hauptverwaltung');

    // Die Story steht auf „mittel" und bleibt deshalb unberührt — richtig so:
    // geändert wurde nur die lange Fassung.
    expect(
      ohneTrennung(
        await seite.locator('[data-ausspielung="story"] [data-name="Titel"]').textContent(),
      ),
    ).toBe('Sommerfest 2026');

    await seite.locator('input[data-feld="titel"][data-stufe="mittel"]').fill('Winterfest 27');
    await seite.waitForTimeout(250);
    expect(
      ohneTrennung(
        await seite.locator('[data-ausspielung="story"] [data-name="Titel"]').textContent(),
      ),
    ).toBe('Winterfest 27');
  });

  it('meldet Inhalt unter den Bedienelementen der Story', async () => {
    await seite.locator('[data-ausspielung="story"]').click();
    await seite.waitForTimeout(200);

    // Die Großschreibung kommt aus dem Stil, nicht aus dem Text.
    const regeln = await seite.locator('.protokoll .regel').allTextContents();
    expect(regeln).toContain('sperrflaeche');
    expect(await seite.locator('.sperre').count()).toBeGreaterThan(0);
  });

  it('meldet zu kleine Schrift für den Leseabstand des Plakats', async () => {
    await seite.locator('[data-ausspielung="plakat"]').click();
    await seite.waitForTimeout(200);

    const regeln = await seite.locator('.protokoll .regel').allTextContents();
    expect(regeln).toContain('lesbarkeit');
  });

  it('erklärt Material nach dem Termin für falsch, nicht für hässlich', async () => {
    await seite.locator('input[type="date"]').fill('2026-07-01');
    await seite.waitForTimeout(300);

    const meldungen = await seite.locator('.protokoll .meldung').allTextContents();
    expect(meldungen.join(' ')).toMatch(/nicht hässlich, sondern falsch/);
    expect(await seite.locator('.frist-zahl').textContent()).toBe('-47');
  });

  it('entscheidet gemessen, nicht geschätzt — und kein Text läuft aus seinem Rahmen', async () => {
    // Die Schätzung über Zeichenzahl war zu großzügig: der Instagram-Beitrag
    // nahm die lange Fassung, setzte sie eine Zeile zu hoch und schob sie über
    // den Untertitel — gemeldet als „passt". Seither misst der Browser.
    const marken = await seite.locator('.stufenmarke').first().getAttribute('title');
    expect(marken).toContain('gemessen');

    // Gemessen wird gegen die halbe Zeilenhöhe: `scrollHeight` und
    // `clientHeight` sind ganzzahlig, Rahmenhöhen dagegen krumm (388,36 px),
    // also stehen ein bis zwei Pixel Differenz immer im Raum. Der Fehler, um
    // den es geht, ist eine ganze Zeile zu viel — nicht ein Rundungsrest.
    const ueberlauf = await seite.evaluate(() =>
      [...document.querySelectorAll('[data-typ="text"]')]
        .map((knoten) => {
          const el = knoten as HTMLElement;
          const zeile = Number.parseFloat(getComputedStyle(el).lineHeight);
          return {
            name: el.getAttribute('data-name') ?? '',
            ueber: el.scrollHeight - el.clientHeight,
            halbeZeile: Number.isNaN(zeile) ? 8 : zeile / 2,
          };
        })
        .filter((t) => t.ueber > t.halbeZeile),
    );
    expect(ueberlauf).toEqual([]);
  });

  it('läuft ohne einen einzigen Seitenfehler', () => {
    expect(seitenfehler).toEqual([]);
  });
});
