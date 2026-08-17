/**
 * Die ganze Kette in einem Durchlauf.
 *
 * Entwurf → HTML → Browser setzt → Glyphen ablesen → PDF/X-4 in CMYK → Prüfung.
 * Das ist der Test, um den es beim ganzen Spike geht.
 *
 * Ohne Chromium überspringt er sich selbst. Das ist Absicht: auf einem Läufer
 * ohne Browser soll die Werkzeugkette nicht scheitern — aber es soll auch
 * niemand glauben, die Kette sei geprüft worden.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { PRUEF_SCHRIFT, pruefentwurf } from '../src/beispiel.js';
import { findeChromium, setzeUndVermesse } from '../src/browser.js';
import { erzeugePdfX, pxZuPunkt } from '../src/pdfx.js';
import { lesbarerInhalt, nurFehler, pruefePdfX } from '../src/pruefung.js';
import type { Messung } from '../src/vermessung.js';

const HIER = dirname(fileURLToPath(import.meta.url));
const AUSGABE = join(HIER, '..', 'ausgabe');

const SCHRIFTDATEIEN = [
  { datei: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', gewicht: 400 },
  { datei: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', gewicht: 700 },
];

const schriften = habenSchriftdateien()
  ? SCHRIFTDATEIEN.map((s) => ({
      familie: PRUEF_SCHRIFT,
      gewicht: s.gewicht,
      kursiv: false,
      daten: new Uint8Array(readFileSync(s.datei)),
    }))
  : [];

function habenSchriftdateien(): boolean {
  return SCHRIFTDATEIEN.every((s) => existsSync(s.datei));
}

const habenBrowser = findeChromium() !== null;
const habenSchriften = SCHRIFTDATEIEN.every((s) => existsSync(s.datei));
const ueberspringen = !habenBrowser || !habenSchriften;

describe.skipIf(ueberspringen)('Kette Entwurf → PDF/X-4', () => {
  const entwurf = pruefentwurf();
  let messung: Messung;
  let pdf: Uint8Array;
  let inhalt: string;

  beforeAll(async () => {
    const ergebnis = await setzeUndVermesse(entwurf, { schriften, abzug: true });
    messung = ergebnis.messung;

    pdf = await erzeugePdfX({ entwurf, messung, schriften, schnittmarken: true });
    inhalt = lesbarerInhalt(pdf);

    mkdirSync(AUSGABE, { recursive: true });
    writeFileSync(join(AUSGABE, 'spike.pdf'), pdf);
    writeFileSync(join(AUSGABE, 'abzug.png'), ergebnis.abzug);
    writeFileSync(join(AUSGABE, 'entwurf.html'), ergebnis.html);
  }, 120_000);

  describe('Der Browser hat wirklich gesetzt', () => {
    it('benutzt die mitgelieferte Schrift und keine Ersatzschrift', () => {
      // Der stillste Fehler dieser Bauart, und er ist hier wirklich passiert:
      // das @font-face greift nicht, alles wird in einer Serifenschrift gesetzt
      // und fällt erst der Druckerei auf. Der Elementname allein verrät das
      // nicht — der gibt nur den Wunsch wieder. `schriftVerfuegbar` fragt den
      // Browser, ob er die Schrift tatsächlich hat.
      for (const lauf of messung.texte) {
        expect(lauf.schriftFamilie, lauf.elementId).toBe(PRUEF_SCHRIFT);
        expect(lauf.schriftVerfuegbar, `${lauf.elementId} in Ersatzschrift gesetzt`).toBe(true);
      }
    });

    it('bricht den Fließtext um, statt ihn überlaufen zu lassen', () => {
      const fliess = messung.texte.find((t) => t.glyphen.length > 60);
      expect(fliess, 'Fließtext nicht gefunden').toBeDefined();

      const zeilen = new Set(fliess!.glyphen.map((g) => Math.round(g.y)));
      expect(zeilen.size, 'Text wurde nicht umgebrochen').toBeGreaterThan(1);
    });

    it('setzt Blocksatz bis an die Rahmenkante', () => {
      const fliess = messung.texte.find((t) => t.glyphen.length > 60);
      const nachZeile = new Map<number, number>();
      for (const g of fliess!.glyphen) {
        const y = Math.round(g.y);
        nachZeile.set(y, Math.max(nachZeile.get(y) ?? 0, g.x + g.breite));
      }

      const zeilen = [...nachZeile.entries()].sort((a, b) => a[0] - b[0]);
      const rand = entwurf.anschnitt.links + entwurf.sicherheitsabstand;
      const kante = rand + (entwurf.masse.breite - 2 * entwurf.sicherheitsabstand);

      // Alle Zeilen außer der letzten enden im Blocksatz an der Kante.
      for (const [y, rechts] of zeilen.slice(0, -1)) {
        expect(Math.abs(rechts - kante), `Zeile y=${y}`).toBeLessThan(15);
      }
    });

    it('liefert für jede Glyphe eine Grundlinie innerhalb des Blattes', () => {
      for (const lauf of messung.texte) {
        for (const g of lauf.glyphen) {
          expect(g.y).toBeGreaterThan(0);
          expect(g.y).toBeLessThan(messung.blattHoehe);
          expect(g.x).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('Das PDF ist druckfähig', () => {
    it('erfüllt die PDF/X-4-Struktur ohne Fehler', () => {
      const dpi = entwurf.masse.dpi;
      const pt = (px: number): number => pxZuPunkt(px, dpi);
      const an = entwurf.anschnitt;
      const trimBox: [number, number, number, number] = [
        pt(an.links),
        pt(an.unten),
        pt(an.links + entwurf.masse.breite),
        pt(an.unten + entwurf.masse.hoehe),
      ];

      const fehler = nurFehler(pruefePdfX(pdf, { trimBox }));
      expect(fehler.map((f) => `[${f.regel}] ${f.meldung}`)).toEqual([]);
    });

    it('enthält keinen einzigen RGB-Farboperator', () => {
      expect(inhalt.match(/[\d.]+ [\d.]+ [\d.]+ (rg|RG)[\s\n]/g)).toBeNull();
    });

    it('schreibt reines Schwarz als K-only', () => {
      // Vierfarbschwarz wird bei kleiner Schrift durch Passerdifferenzen bunt
      // umrandet. Der Fließtext ist #000000 und muss als "0 0 0 1 k" ankommen.
      expect(inhalt).toContain('0 0 0 1 k');
    });

    it('schreibt Buntfarben als echte Vierfarbmischung', () => {
      const mischungen = (inhalt.match(/[\d.]+ [\d.]+ [\d.]+ [\d.]+ k[\s\n]/g) ?? []).filter(
        (m) => !/^0 0 0 [01] k/.test(m),
      );
      expect(mischungen.length).toBeGreaterThan(0);
    });

    it('bettet die Schrift ein', () => {
      expect(inhalt).toMatch(/\/FontFile\d?/);
    });

    it('setzt die TrimBox auf das Endformat, nicht auf das Blatt', () => {
      const trim = /\/TrimBox\s*\[([^\]]+)\]/.exec(inhalt)?.[1]?.trim().split(/\s+/).map(Number);
      expect(trim).toBeDefined();

      const dpi = entwurf.masse.dpi;
      expect(trim![2]! - trim![0]!).toBeCloseTo(pxZuPunkt(entwurf.masse.breite, dpi), 1);
      expect(trim![3]! - trim![1]!).toBeCloseTo(pxZuPunkt(entwurf.masse.hoehe, dpi), 1);
      // 3 mm Anschnitt sind 8,504 pt — die TrimBox beginnt genau dort.
      expect(trim![0]!).toBeCloseTo(8.504, 2);
    });

    it('ist bei gleicher Eingabe byte-gleich', async () => {
      // Ohne feste Zeitstempel lässt sich kein Ergebnis vergleichen und keine
      // Abweichung einem Codewechsel zuordnen.
      const nochmal = await erzeugePdfX({ entwurf, messung, schriften, schnittmarken: true });

      expect(Buffer.from(nochmal).equals(Buffer.from(pdf))).toBe(true);
    }, 60_000);
  });

  describe('Schutzregeln', () => {
    it('verweigert das PDF, wenn eine benutzte Schrift fehlt', async () => {
      await expect(
        erzeugePdfX({
          entwurf,
          messung,
          schriften: [{ ...schriften[0]!, familie: 'GanzAndereSchrift' }],
        }),
      ).rejects.toThrow(/keine Schrift eingebettet/);
    }, 60_000);

    it('verweigert das PDF ganz ohne Schriften', async () => {
      await expect(erzeugePdfX({ entwurf, messung, schriften: [] })).rejects.toThrow(
        /verlangt eingebettete Schriften/,
      );
    });
  });
});

describe.skipIf(!ueberspringen)('Kette', () => {
  it('wurde übersprungen — Browser oder Schriften fehlen', () => {
    expect(habenBrowser && habenSchriften).toBe(false);
  });
});
