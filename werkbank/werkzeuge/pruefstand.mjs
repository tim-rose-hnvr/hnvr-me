/* Prüfstand — der Aufbau, den alle Prüfungen teilen.

   Ein Server auf die Werkbank, ein Browser darauf, eine Seite darin, und
   `pruefe(name, fn)` als einzige Form, in der eine Prüfung geschrieben wird.
   Scheitert eine, macht der Prüfstand ein Bild und schreibt auf, in welcher
   Lage das Programm gerade war — sonst steht da nur „Fehler" und man fängt
   von vorn an.

   Das stand bis eben zusammen mit 116 Prüfungen in einer Datei mit 2124
   Zeilen. Wer eine Prüfung dazuschreiben wollte, scrollte an allen anderen
   vorbei und musste raten, welche Hilfen es schon gibt. Jetzt steht der
   Aufbau hier, die Prüfungen liegen thematisch in `pruefungen/`, und
   `vollpruefung.mjs` ist nur noch die Reihenfolge.

   Die Reihenfolge ist keine Kür: die Prüfungen teilen sich **eine** Seite und
   bauen aufeinander auf. Wer eine neue Gruppe einhängt, hängt sie dorthin, wo
   der Zustand passt, den sie erwartet. */

import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ARTEN = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.pdf': 'application/pdf', '.json': 'application/json',
  '.png': 'image/png', '.txt': 'text/plain',
  '.wasm': 'application/wasm', '.gz': 'application/gzip',
  '.pfb': 'application/octet-stream', '.bcmap': 'application/octet-stream',
};


async function ladePlaywright() {
  for (const ort of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(ort); } catch { /* nächster Versuch */ }
  }
  throw new Error('playwright nicht gefunden — "npm i -D playwright" oder global installieren.');
}

/* Startet Server, Browser und Seite und liefert alles, was eine Prüfgruppe
   braucht. Ein einziges Objekt statt fünfzehn Modulvariablen — dann steht in
   jeder Prüfdatei oben, was sie tatsächlich benutzt. */
export async function starte() {
  const server = createServer((anfrage, antwort) => {
    const pfad = join(WURZEL, decodeURIComponent(anfrage.url.split('?')[0]));
    if (!pfad.startsWith(WURZEL)) { antwort.writeHead(403).end(); return; }
    const strom = createReadStream(pfad);
    strom.on('error', () => antwort.writeHead(404).end('nicht gefunden'));
    strom.on('open', () => {
      antwort.writeHead(200, { 'content-type': ARTEN[extname(pfad)] || 'application/octet-stream' });
      strom.pipe(antwort);
    });
  });
  await new Promise((l) => server.listen(0, '127.0.0.1', l));
  const BASIS = `http://127.0.0.1:${server.address().port}/index.html`;
  const HIER = await mkdtemp(join(tmpdir(), 'werkbank-vollpruefung-'));

  const { chromium } = await ladePlaywright();
  const ergebnisse = [];
  const fehlerStrom = [];

  function melde(name, ok, zusatz = '') {
    ergebnisse.push({ name, ok, zusatz });
    console.log(`${ok ? '  ✓' : '  ✗'} ${name}${zusatz ? ' — ' + zusatz : ''}`);
  }

  async function pruefe(name, fn) {
    const vorher = fehlerStrom.length;
    try {
      const zusatz = await fn();
      const neueFehler = fehlerStrom.slice(vorher);
      if (neueFehler.length) melde(name, false, 'Konsolenfehler: ' + neueFehler[0].slice(0, 120));
      else melde(name, true, typeof zusatz === 'string' ? zusatz : '');
    } catch (fehler) {
      melde(name, false, String(fehler.message).split('\n')[0].slice(0, 160));
      try {
        const marke = name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        await seite.screenshot({ path: `${HIER}/fehl-${marke}.png` });
        const lage = await seite.evaluate(() => ({
          schirm: !document.querySelector('#schirm').hidden,
          dialog: document.querySelector('.dialog-kopf h2')?.textContent || null,
          werkzeug: window.werkbank.zustand.werkzeug,
          seite: window.werkbank.zustand.aktuelleSeite,
          zoom: String(window.werkbank.zustand.zoom),
          anmerkungen: window.werkbank.zustand.anmerkungen.map((a) => a.art),
        }));
        console.log('     Lage:', JSON.stringify(lage).slice(0, 300), `· Bild: ${HIER}/fehl-${marke}.png`);
      } catch { /* egal */ }
    }
  }

  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
  /* Ablage für Dateien, die ein Dialog herausgibt — der Stapel etwa. */
  const ablage = await mkdtemp(join(tmpdir(), 'werkbank-knoepfe-'));
  seite.on('pageerror', (e) => fehlerStrom.push('PAGEERROR ' + e.message));
  seite.on('console', (m) => { if (m.type() === 'error') fehlerStrom.push(m.text()); });

  const ladeBeispiel = async () => {
    await seite.goto(BASIS);
    await seite.click('#knopf-beispiel');
    await seite.waitForSelector('.blatt canvas');
    await seite.waitForTimeout(2000);
  };

  const ladungVon = async (tun) => {
    const [dl] = await Promise.all([seite.waitForEvent('download', { timeout: 45000 }), tun()]);
    const pfad = `${HIER}/audit-${dl.suggestedFilename()}`;
    await dl.saveAs(pfad);
    return pfad;
  };

  const dialogOffen = () => seite.evaluate(() => !document.querySelector('#schirm').hidden);
  const dialogSchliessen = () => seite.evaluate(() => { document.querySelector('#schirm').hidden = true; document.querySelector('#schirm').innerHTML = ''; });

  /* Der sichtbare Ausschnitt der ersten Seite, mit `bei(ax, ay)` für anteilige
     Punkte darauf. Fast jede Werkzeugprüfung zieht damit ihre Maus. */
  const blatt = async () => {
    await seite.selectOption('#feld-zoom', 'breite');
    await seite.waitForTimeout(700);
    await seite.evaluate(() => window.werkbank.fuehreAus('gehezu:erste'));
    await seite.waitForTimeout(700);
    const kasten = await seite.locator('.blatt').first().boundingBox();
    const buehne = await seite.locator('#buehne').boundingBox();
    /* Anteilige Punkte, die sicher auf dem Blatt **und** in der sichtbaren
       Bühne liegen. Frueher wurde hart auf y=900 geklemmt; als die Chrome um
       27 px wuchs, fielen zwei verschiedene Anteile auf denselben Punkt und
       jedes Ziehen hatte die Hoehe null. Der Fehler sah aus wie „Werkzeug
       kaputt", war aber der Pruefstand. */
    const unten = buehne.y + buehne.height - 8;
    kasten.bei = (ax, ay) => {
      const y = kasten.y + kasten.height * ay;
      if (y > unten) throw new Error(`Anteil ${ay} liegt unterhalb der sichtbaren Bühne — kleineren Wert nehmen`);
      return { x: kasten.x + kasten.width * ax, y };
    };
    return kasten;
  };

  await ladeBeispiel();
  const befehle = await seite.evaluate(() => window.werkbank.befehle.map((b) => ({ id: b.id, name: b.name, gruppe: b.gruppe, kuerzel: b.kuerzel })));

  return {
    pruefe, melde, seite, browser, server, blatt, ladeBeispiel, ladungVon,
    dialogOffen, dialogSchliessen, BASIS, HIER, WURZEL, ablage, ergebnisse, fehlerStrom, befehle,
  };
}

/* Zählt zusammen, räumt auf und setzt den Rückgabewert des Prozesses. */
export async function abschluss(stand) {
  const { ergebnisse, fehlerStrom, browser, server, HIER } = stand;
  console.log('\n== Zusammenfassung ==');
  const fehlgeschlagen = ergebnisse.filter((e) => !e.ok);
  console.log(`${ergebnisse.length - fehlgeschlagen.length} von ${ergebnisse.length} in Ordnung`);
  for (const f of fehlgeschlagen) console.log(`  FEHL: ${f.name} — ${f.zusatz}`);
  console.log('\nKonsolenfehler gesamt:', fehlerStrom.length);
  for (const f of [...new Set(fehlerStrom)].slice(0, 10)) console.log('  ', f.slice(0, 160));

  await browser.close();
  server.close();
  if (!fehlgeschlagen.length) await rm(HIER, { recursive: true, force: true });
  process.exit(fehlgeschlagen.length ? 1 : 0);
}
