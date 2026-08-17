/**
 * Die ganze Ausgabekette an einer echten Vorlage.
 *
 * Entwurf → HTML → Browser setzt → Glyphen ablesen → PDF/X-4 in CMYK.
 * Ohne Chromium oder Schriften überspringt sich der Test — meldet das aber.
 */

import { existsSync, readFileSync } from 'node:fs';
import {
  type Entwurf,
  erzeugeEntwurf,
  erzeugeForm,
  erzeugeText,
  festeUhr,
  formatNachSchluessel,
  type Werkzeuge,
  zaehlerId,
} from '@studio/editor-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { erzeugePdfX, pxZuPunkt } from '../src/pdfx.js';
import { lesbarerInhalt, nurFehler, pruefePdfX } from '../src/pruefung.js';
import { findeChromium, type Schrift, setzeUndVermesse } from '../src/satz.js';
import type { Messung } from '../src/vermessung.js';

const SCHRIFT = 'Pruefschrift';
const DATEIEN = [
  { datei: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', gewicht: 400 },
  { datei: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', gewicht: 700 },
];

const habenAlles = findeChromium() !== null && DATEIEN.every((d) => existsSync(d.datei));

function werkzeuge(): Werkzeuge {
  return { neueId: zaehlerId('k'), jetzt: festeUhr() };
}

/** A5 mit randabfallendem Balken, gedrehtem Text und einem langen Fließtext. */
function pruefentwurf(): Entwurf {
  const w = werkzeuge();
  const format = formatNachSchluessel('a5-hoch');
  if (format === null) throw new Error('Format fehlt');
  const basis = erzeugeEntwurf({ organisationId: 'org-1', name: 'Kette', format }, w);
  const { breite, hoehe } = basis.masse;
  const an = basis.anschnitt.links;
  const rand = basis.sicherheitsabstand;
  const erste = basis.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');

  return {
    ...basis,
    seiten: [
      {
        ...erste,
        hintergrund: '#ffffff',
        elemente: [
          erzeugeForm(
            { x: -an, y: -an, breite: breite + 2 * an, hoehe: hoehe * 0.25 },
            'rechteck',
            { name: 'Kopfbalken', fuellung: '#0a5c8a' },
            w,
          ),
          erzeugeText(
            { x: rand, y: hoehe * 0.35, breite: breite - 2 * rand, hoehe: hoehe * 0.3 },
            'Die Betriebsversammlung findet in der Hauptverwaltung statt. ' +
              'Anmeldungen nimmt die Geschäftsstellenleitung entgegen.',
            {
              name: 'Fließtext',
              schriftFamilie: SCHRIFT,
              schriftGroesse: Math.round(hoehe * 0.019),
              farbe: '#000000',
              ausrichtung: 'blocksatz',
              zeilenabstand: 1.5,
            },
            w,
          ),
          erzeugeText(
            { x: rand, y: hoehe * 0.8, breite: breite * 0.5, hoehe: hoehe * 0.06 },
            'Gedreht',
            {
              name: 'Schräg',
              schriftFamilie: SCHRIFT,
              schriftGroesse: Math.round(hoehe * 0.03),
              schriftStaerke: 700,
              farbe: '#0a5c8a',
              drehung: 15,
            },
            w,
          ),
        ],
      },
    ],
  };
}

describe.skipIf(!habenAlles)('Kette Entwurf → PDF/X-4', () => {
  const entwurf = pruefentwurf();
  let messung: Messung;
  let pdf: Uint8Array;
  let inhalt: string;

  const schriften: Schrift[] = DATEIEN.map((d) => ({
    familie: SCHRIFT,
    gewicht: d.gewicht,
    kursiv: false,
    daten: new Uint8Array(readFileSync(d.datei)),
  }));

  beforeAll(async () => {
    const ergebnis = await setzeUndVermesse(entwurf, { schriften, sprache: 'de' });
    messung = ergebnis.messung;
    pdf = await erzeugePdfX({ entwurf, messung, schriften, schnittmarken: true });
    inhalt = lesbarerInhalt(pdf);
  }, 180_000);

  it('setzt in der mitgelieferten Schrift, nicht in einer Ersatzschrift', () => {
    for (const lauf of messung.texte) expect(lauf.schriftVerfuegbar, lauf.elementId).toBe(true);
  });

  it('trennt deutsche Wörter und setzt genau einen Trennstrich je getrennter Zeile', () => {
    const fliess = messung.texte.find((t) => t.glyphen.length > 60);
    expect(fliess, 'Fließtext nicht gefunden').toBeDefined();

    const zeilen = new Map<number, { x: number; breite: number; zeichen: string }[]>();
    for (const g of fliess!.glyphen) {
      const y = Math.round(g.y);
      if (!zeilen.has(y)) zeilen.set(y, []);
      zeilen.get(y)?.push(g);
    }
    expect(zeilen.size, 'Text wurde nicht umgebrochen').toBeGreaterThan(1);

    // Chromium gibt weichen Trennstrichen auch mitten im Wort eine Restbreite.
    // Würde man die als gesetzt lesen, stünden Bindestriche über den ganzen Text.
    for (const [y, gs] of zeilen) {
      const striche = gs.filter((g) => g.zeichen === '-');
      expect(striche.length, `Zeile y=${y}`).toBeLessThanOrEqual(1);

      const rechteKante = Math.max(...gs.map((g) => g.x + g.breite));
      for (const strich of striche) {
        expect(Math.abs(strich.x - rechteKante), `Trennstrich in Zeile y=${y}`).toBeLessThan(2);
      }
    }
  });

  it('erfüllt die PDF/X-4-Struktur ohne Fehler', () => {
    const pt = (px: number): number => pxZuPunkt(px, entwurf.masse.dpi);
    const an = entwurf.anschnitt;
    const fehler = nurFehler(
      pruefePdfX(pdf, {
        trimBox: [
          pt(an.links),
          pt(an.unten),
          pt(an.links + entwurf.masse.breite),
          pt(an.unten + entwurf.masse.hoehe),
        ],
      }),
    );
    expect(fehler.map((f) => `[${f.regel}] ${f.meldung}`)).toEqual([]);
  });

  it('schreibt durchgehend CMYK, Schwarz als K-only', () => {
    expect(inhalt.match(/[\d.]+ [\d.]+ [\d.]+ (rg|RG)[\s\n]/g)).toBeNull();
    expect(inhalt).toContain('0 0 0 1 k');
  });

  it('setzt gedrehten Text über eine Transformationsmatrix', () => {
    const schraeg = messung.texte.find((t) => t.drehung !== 0);
    expect(schraeg?.drehung).toBe(15);
    // `cm` mit Sinus-/Kosinusanteil: ohne Drehung stünde da nur die Einheit.
    expect(inhalt).toMatch(/0\.9659\d* -?0\.2588\d*/);
  });

  it('ist bei gleicher Eingabe byte-gleich', async () => {
    const nochmal = await erzeugePdfX({ entwurf, messung, schriften, schnittmarken: true });
    expect(Buffer.from(nochmal).equals(Buffer.from(pdf))).toBe(true);
  }, 60_000);
});

describe.skipIf(habenAlles)('Kette', () => {
  it('wurde übersprungen — Browser oder Schriften fehlen', () => {
    expect(habenAlles).toBe(false);
  });
});
