/**
 * Der Browser als Textsatzmaschine.
 *
 * Serverseitig und headless — nicht im Kundenbrowser. Das ist Absicht: nur so
 * ist das Ergebnis deterministisch. Liefe der Satz beim Kunden, hinge das PDF
 * davon ab, ob jemand Safari auf dem iPad oder Chrome auf Windows benutzt, und
 * zwei Bestellungen desselben Entwurfs kämen unterschiedlich aus der Druckerei.
 */

import { existsSync } from 'node:fs';
import type { Entwurf } from '@studio/editor-core';
import { entwurfZuHtml } from './html.js';
import { type Messung, messeImBrowser } from './vermessung.js';

/** Eine Schrift, wie sie sowohl der Browser als auch das PDF braucht. */
export interface Schrift {
  familie: string;
  gewicht: number;
  kursiv: boolean;
  daten: Uint8Array;
}

/** Reihenfolge der Suche nach einem brauchbaren Chromium. */
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
    super(
      'Kein Chromium gefunden. Pfad über CHROMIUM_PFAD setzen oder einen der ' +
        'üblichen Orte bereitstellen.',
    );
    this.name = 'KeinBrowser';
  }
}

export interface SatzErgebnis {
  messung: Messung;
  html: string;
  /** Bildschirmabzug als PNG — die Sichtprüfung neben dem PDF. */
  abzug: Uint8Array;
}

export interface SatzOptionen {
  schriften: readonly Schrift[];
  /** Zusätzlich einen Bildschirmabzug erzeugen. Kostet Zeit, hilft beim Prüfen. */
  abzug?: boolean;
}

/**
 * Setzt den Entwurf im Browser und liest die Glyphenpositionen ab.
 * Wirft `KeinBrowser`, wenn kein Chromium zur Verfügung steht.
 */
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
      // 1 CSS-Pixel = 1 Dokumentpixel. Alles andere würde die Messung verzerren.
      deviceScaleFactor: 1,
      viewport: { width: 800, height: 600 },
    });

    // Als data:-URI, nicht als file://-Verweis. Eine per setContent gesetzte
    // Seite hat keine Dateiherkunft, und Chromium verweigert dann jeden
    // file://-Unterabruf. Die Schrift laedt schlicht nicht — und der Browser
    // setzt lautlos in der Ersatzschrift weiter. Das faellt erst im Druck auf.
    const html = entwurfZuHtml(entwurf, {
      schriften: optionen.schriften.map((s) => ({
        familie: s.familie,
        gewicht: s.gewicht,
        kursiv: s.kursiv,
        quelle: `data:font/ttf;base64,${Buffer.from(s.daten).toString('base64')}`,
      })),
    });
    await seite.setContent(html, { waitUntil: 'load' });

    // Ohne dieses Warten misst man die Ersatzschrift. Der häufigste Fehler in
    // dieser Art Werkzeug, und er fällt erst im Druck auf.
    await seite.evaluate(() => document.fonts.ready.then(() => undefined));

    // Playwright überträgt die Messfunktion als Quelltext. Wird sie vorher von
    // esbuild übersetzt (vitest, tsx), stehen darin Aufrufe des Hilfsnamens
    // `__name` aus dessen keepNames-Umsetzung — im Browser gibt es den nicht.
    // Eine Kennzeichnungshilfe durch die Identität zu ersetzen ist harmlos und
    // billiger, als die Messfunktion in eine untypisierte Datei auszulagern.
    await seite.evaluate(() => {
      const global = globalThis as { __name?: (wert: unknown) => unknown };
      global.__name ??= (wert) => wert;
    });

    const messung = (await seite.evaluate(messeImBrowser)) as Messung;

    let abzug = new Uint8Array();
    if (optionen.abzug === true) {
      const blatt = seite.locator('.seite').first();
      abzug = new Uint8Array(await blatt.screenshot({ type: 'png' }));
    }

    return { messung, html, abzug };
  } finally {
    await browser.close();
  }
}
