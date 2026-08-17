/**
 * Der Baustein in einer feindseligen Fremdseite.
 *
 * Die Testseite trägt globale Regeln, die alles auf Comic Sans, Magenta und
 * gestrichelte Ränder ziehen — so verhält sich eine echte fremde Seite. Geprüft
 * wird, was davon durchschlägt:
 *
 * 1. Der Schattenbaum hält die Fremdstile draußen.
 * 2. Die **Schriften kommen trotzdem an** — `@font-face` wirkt im Schattenbaum
 *    nicht, deshalb müssen die Regeln ins Dokument. Geprüft wird nicht die
 *    gewünschte, sondern die **benutzte** Schrift.
 * 3. Bindung, Kürzungsstufen und Prüfbefunde arbeiten wie im Leuchttisch.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HIER = dirname(fileURLToPath(import.meta.url));
const DATEI = join(HIER, '..', 'ausgabe', 'fremdseite.html');

const CHROMIUM = [
  process.env['CHROMIUM_PFAD'],
  '/opt/pw-browsers/chromium',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].find((p) => typeof p === 'string' && p !== '' && existsSync(p));

function ohneTrennung(text: string | null): string {
  return (text ?? '').replaceAll('­', '');
}

describe.skipIf(CHROMIUM === undefined)('Baustein in fremder Seite', () => {
  let browser: Browser;
  let seite: Page;
  const seitenfehler: string[] = [];

  beforeAll(async () => {
    if (!existsSync(DATEI)) {
      execFileSync('node', [join(HIER, '..', 'bauen.mjs')], { stdio: 'inherit' });
    }
    const { chromium } = await import('playwright-core');
    browser = await chromium.launch(CHROMIUM === undefined ? {} : { executablePath: CHROMIUM });
    seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    seite.on('pageerror', (fehler) => seitenfehler.push(String(fehler)));
    await seite.goto(`file://${DATEI}`);
    await seite.waitForFunction(
      () => document.querySelector('design-studio')?.shadowRoot?.querySelector('.andruck') !== null,
      undefined,
      { timeout: 20_000 },
    );
    // Die Messung setzt erst nach `document.fonts.ready` ein.
    await seite.waitForFunction(
      () =>
        document
          .querySelector('design-studio')
          ?.shadowRoot?.querySelector('.marke')
          ?.getAttribute('title') === 'im Satz gemessen',
      undefined,
      { timeout: 20_000 },
    );
  }, 90_000);

  afterAll(async () => {
    await browser?.close();
  });

  it('hält die Stile der Fremdseite aus dem Baustein heraus', async () => {
    // Die Seite erzwingt `* { font-family: Comic Sans MS !important }` und färbt
    // jedes `div` magenta. Im Schattenbaum darf davon nichts ankommen.
    const gemessen = await seite.evaluate(() => {
      const wurzel = document.querySelector('design-studio')?.shadowRoot;
      const karte = wurzel?.querySelector('.andruck');
      const draussen = document.querySelector('h1');
      if (karte === null || karte === undefined || draussen === null) return null;
      return {
        drinnenSchrift: getComputedStyle(karte).fontFamily,
        drinnenFarbe: getComputedStyle(karte).color,
        draussenSchrift: getComputedStyle(draussen).fontFamily,
        wirtSchrift: getComputedStyle(document.querySelector('design-studio') as HTMLElement)
          .fontFamily,
      };
    });

    expect(gemessen?.draussenSchrift).toContain('Comic Sans');
    expect(gemessen?.drinnenSchrift).not.toContain('Comic Sans');
    expect(gemessen?.drinnenFarbe).not.toBe('rgb(255, 0, 255)');
    // Das Wirtselement selbst steht im Dokumentbaum und ist gegen ein
    // !important der Fremdseite nicht zu verteidigen — geschützt wird der
    // Inhalt, nicht die Hülle. Genau deshalb stehen die vererbbaren
    // Eigenschaften noch einmal auf einem inneren Knoten.
    expect(gemessen?.wirtSchrift).toContain('Comic Sans');
  });

  it('setzt die Markenschrift wirklich — nicht nur laut Stilangabe', async () => {
    // `@font-face` im Schattenbaum wird stillschweigend ignoriert. Geprüft wird
    // deshalb `document.fonts.check`, also die *benutzte* Schrift, nicht die
    // gewünschte: der Unterschied hat hier schon einmal einen grünen Test neben
    // einem falschen Bild erzeugt.
    const geladen = await seite.evaluate(async () => {
      await document.fonts.ready;
      return {
        vorhanden: document.fonts.check('700 100px Markenschrift'),
        imKopf: document.getElementById('design-studio-schriften') !== null,
        imSchatten:
          document
            .querySelector('design-studio')
            ?.shadowRoot?.querySelector('#design-studio-schriften') !== null,
      };
    });

    expect(geladen.vorhanden).toBe(true);
    expect(geladen.imKopf).toBe(true);
    expect(geladen.imSchatten).toBe(false);
  });

  it('löst die Bindungen auf und wählt je Format eine andere Stufe', async () => {
    const stufen = await seite.evaluate(() => {
      const wurzel = document.querySelector('design-studio')?.shadowRoot;
      const je = (id: string) =>
        Array.from(wurzel?.querySelectorAll(`[data-ausspielung="${id}"] .marke`) ?? [])
          .map((m) => m.textContent ?? '')
          .find((t) => t.startsWith('Tite'));
      return { plakat: je('plakat'), story: je('story'), linkedin: je('linkedin') };
    });

    expect(stufen.plakat).toBe('Tite lang');
    expect(stufen.linkedin).toBe('Tite kurz');
    expect(stufen.story).not.toBe(stufen.plakat);
  });

  it('zieht eine Änderung durch alle Formate und meldet sie nach außen', {
    timeout: 30_000,
  }, async () => {
    await seite.fill('input[data-feld="titel"][data-stufe="lang"]', 'Herbstfest');
    // Weiche Trennstriche stehen mitten im Wort — ein roher Vergleich auf
    // `textContent` findet „Herbstfest" nie, weil dort „Herbst\u00ADfest" steht.
    await seite.waitForFunction(() =>
      document
        .querySelector('design-studio')
        ?.shadowRoot?.querySelector('[data-ausspielung="plakat"] [data-name="Titel"]')
        ?.textContent?.replaceAll('\u00AD', '')
        .includes('Herbstfest'),
    );

    const titel = ohneTrennung(
      await seite.textContent('[data-ausspielung="plakat"] [data-name="Titel"]'),
    );
    expect(titel).toBe('Herbstfest');

    // Der Einbettende bekommt das Ereignis mit — sonst könnte er nicht sichern.
    const gemeldet = await seite.evaluate(
      () => (globalThis as unknown as { protokoll: { feld: string }[] }).protokoll,
    );
    expect(gemeldet.at(-1)?.feld).toBe('titel');
  });

  it('behält den Fokus im Eingabefeld beim Tippen', { timeout: 30_000 }, async () => {
    // Würde bei jeder Änderung der ganze Baustein neu gezeichnet, verlöre das
    // Feld nach dem ersten Zeichen den Fokus und niemand könnte etwas eingeben.
    const wahl = 'input[data-feld="titel"][data-stufe="mittel"]';
    await seite.click(wahl);
    await seite.type(wahl, 'X');
    const nochAmFeld = await seite.evaluate(() => {
      const aktiv = document.querySelector('design-studio')?.shadowRoot?.activeElement;
      return aktiv instanceof HTMLInputElement ? aktiv.dataset['stufe'] : null;
    });
    expect(nochAmFeld).toBe('mittel');
  });

  it('behält den Messknoten über das Neuzeichnen hinweg', async () => {
    // Ein losgelöster Messknoten hat Höhe 0 — dann passt jede Fassung, die Wahl
    // fällt immer auf „lang", und der Text läuft über. Ohne Fehlermeldung.
    const zustand = await seite.evaluate(() => {
      const wurzel = document.querySelector('design-studio')?.shadowRoot;
      const knoten = Array.from(wurzel?.children ?? []).find(
        (k) => k.getAttribute('aria-hidden') === 'true',
      );
      return { vorhanden: knoten !== undefined, verbunden: knoten?.isConnected ?? false };
    });
    expect(zustand).toEqual({ vorhanden: true, verbunden: true });
  });

  it('misst unbeeinflusst von den Regeln der Fremdseite', async () => {
    // Die Testseite setzt `div { border: 3px dashed lime }`. Träfe das den
    // Messknoten, wäre jede gemessene Höhe sechs Pixel zu groß — genug, um eine
    // Kürzungsstufe falsch zu wählen.
    const rand = await seite.evaluate(() => {
      const wurzel = document.querySelector('design-studio')?.shadowRoot;
      const knoten = Array.from(wurzel?.children ?? []).find(
        (k) => k.getAttribute('aria-hidden') === 'true',
      );
      if (knoten === undefined) return null;
      const stil = getComputedStyle(knoten);
      return {
        oben: stil.borderTopWidth,
        unten: stil.borderBottomWidth,
        polsterOben: stil.paddingTop,
        aussenOben: stil.marginTop,
      };
    });

    expect(rand).toEqual({
      oben: '0px',
      unten: '0px',
      polsterOben: '0px',
      aussenOben: '0px',
    });
  });

  it('meldet Sperrflächen und Lesbarkeit wie der Leuchttisch', async () => {
    const regeln = await seite.evaluate(() =>
      Array.from(
        document.querySelector('design-studio')?.shadowRoot?.querySelectorAll('.befunde li') ?? [],
      ).map((li) => (li as HTMLElement).dataset['regel'] ?? ''),
    );
    expect(regeln).toContain('sperrflaeche');
  });

  it('läuft ohne einen einzigen Seitenfehler', () => {
    expect(seitenfehler).toEqual([]);
  });
});
