/**
 * Der Satzlauf: Entwurf im headless Browser setzen und vermessen.
 *
 * Serverseitig, nicht im Kundenbrowser. Das ist Absicht: nur so ist das
 * Ergebnis deterministisch. Liefe der Satz beim Kunden, hinge das PDF davon ab,
 * ob jemand Safari auf dem iPad oder Chrome auf Windows benutzt — zwei
 * Bestellungen desselben Entwurfs kämen unterschiedlich aus der Druckerei.
 */

import { existsSync } from 'node:fs';
import type { Entwurf } from '@studio/editor-core';
import { entwurfZuHtml, type Sprache } from '@studio/render';
import { type Messung, messeImBrowser } from './vermessung.js';

const CHROMIUM_ORTE = [
  process.env['CHROMIUM_PFAD'],
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
];

export function findeChromium(): string | null {
  return CHROMIUM_ORTE.find((p) => typeof p === 'string' && p !== '' && existsSync(p)) ?? null;
}

export class KeinBrowser extends Error {
  constructor() {
    super('Kein Chromium gefunden. Pfad über CHROMIUM_PFAD setzen.');
    this.name = 'KeinBrowser';
  }
}

/** Eine Schrift, wie sie sowohl der Browser als auch das PDF braucht. */
export interface Schrift {
  familie: string;
  gewicht: number;
  kursiv: boolean;
  daten: Uint8Array;
}

export interface SatzOptionen {
  schriften: readonly Schrift[];
  sprache?: Sprache;
  /** Zielauflösung für Bilder. 300 ist Druckstandard. */
  bildDpi?: number;
  /** Zusätzlich einen Bildschirmabzug erzeugen — die Sichtprüfung neben dem PDF. */
  abzug?: boolean;
}

export interface SatzErgebnis {
  messung: Messung;
  html: string;
  abzug: Uint8Array;
}

export class ErsatzschriftBenutzt extends Error {
  readonly betroffen: readonly string[];

  constructor(betroffen: readonly string[]) {
    super(
      `In Ersatzschrift gesetzt: ${betroffen.join(', ')}. ` +
        'Das PDF wäre falsch umbrochen und darf nicht entstehen.',
    );
    this.name = 'ErsatzschriftBenutzt';
    this.betroffen = betroffen;
  }
}

export async function setzeUndVermesse(
  entwurf: Entwurf,
  optionen: SatzOptionen,
): Promise<SatzErgebnis> {
  const pfad = findeChromium();
  if (pfad === null) throw new KeinBrowser();

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({ executablePath: pfad });

  try {
    const seite = await browser.newPage({
      // 1 CSS-Pixel = 1 Dokumentpixel. Alles andere verzerrt die Messung.
      deviceScaleFactor: 1,
      viewport: { width: 800, height: 600 },
    });

    // Schriften als data:-URI, nicht als file://-Verweis. Eine per setContent
    // gesetzte Seite hat keine Dateiherkunft, und Chromium verweigert dann
    // jeden file://-Unterabruf. Die Schrift lädt schlicht nicht, und der
    // Browser setzt lautlos in der Ersatzschrift weiter.
    const html = entwurfZuHtml(entwurf, {
      schriften: optionen.schriften.map((s) => ({
        familie: s.familie,
        gewicht: s.gewicht,
        kursiv: s.kursiv,
        quelle: `data:font/ttf;base64,${Buffer.from(s.daten).toString('base64')}`,
      })),
      ...(optionen.sprache === undefined ? {} : { sprache: optionen.sprache }),
    });

    await seite.setContent(html, { waitUntil: 'load' });
    await seite.evaluate(() => document.fonts.ready.then(() => undefined));

    // Playwright überträgt die Messfunktion als Quelltext. Wird sie vorher von
    // esbuild übersetzt, stehen darin Aufrufe des Hilfsnamens `__name` aus
    // dessen keepNames-Umsetzung — im Browser gibt es den nicht.
    await seite.evaluate(() => {
      const global = globalThis as { __name?: (wert: unknown) => unknown };
      global.__name ??= (wert) => wert;
    });

    const messung = (await seite.evaluate(messeImBrowser, {
      bildDpi: optionen.bildDpi ?? 300,
      entwurfDpi: entwurf.masse.dpi,
    })) as Messung;

    const ersatz = messung.texte.filter((t) => !t.schriftVerfuegbar).map((t) => t.elementId);
    if (ersatz.length > 0) throw new ErsatzschriftBenutzt(ersatz);

    let abzug = new Uint8Array();
    if (optionen.abzug === true) {
      abzug = new Uint8Array(await seite.locator('.seite').first().screenshot({ type: 'png' }));
    }

    return { messung, html, abzug };
  } finally {
    await browser.close();
  }
}
