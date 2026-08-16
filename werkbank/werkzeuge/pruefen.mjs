/* Prüflauf — fährt die Werkbank in einem echten Browser durch die Hauptwege.

   Aufruf:  node werkzeuge/pruefen.mjs
   Nötig:   playwright mit Chromium (global oder im Projekt).

   Geprüft wird nicht die Oberfläche um ihrer selbst willen, sondern das
   Ergebnis: Was in der Datei steht, die am Ende herauskommt. */

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
  '.pfb': 'application/octet-stream', '.bcmap': 'application/octet-stream',
};

let bestanden = 0, gescheitert = 0;
function pruefe(bedingung, was, zusatz = '') {
  if (bedingung) { bestanden++; console.log(`  ✓ ${was}`); }
  else { gescheitert++; console.log(`  ✗ ${was}${zusatz ? ` — ${zusatz}` : ''}`); }
}

async function ladePlaywright() {
  for (const ort of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(ort); } catch { /* nächster Versuch */ }
  }
  throw new Error('playwright nicht gefunden — "npm i -D playwright" oder global installieren.');
}

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
const basis = `http://127.0.0.1:${server.address().port}/index.html`;
const ablage = await mkdtemp(join(tmpdir(), 'werkbank-pruefung-'));

const { chromium } = await ladePlaywright();
const browser = await chromium.launch();
const seite = await browser.newPage({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const fehler = [];
seite.on('pageerror', (e) => fehler.push(`PAGEERROR: ${e.message}`));
seite.on('console', (m) => { if (m.type() === 'error') fehler.push(m.text()); });

try {
  console.log('\nLaden und Darstellen');
  await seite.goto(basis);
  await seite.click('#knopf-beispiel');
  await seite.waitForSelector('.blatt canvas');
  await seite.waitForTimeout(2200);

  const grund = await seite.evaluate(() => ({
    seiten: window.werkbank.zustand.folge.length,
    blaetter: document.querySelectorAll('.blatt').length,
    miniaturen: document.querySelectorAll('.miniatur').length,
    textstuecke: document.querySelectorAll('.textebene span').length,
    felder: window.werkbank.zustand.formularfelder.length,
  }));
  pruefe(grund.seiten === 5, 'fünf Seiten geladen', `war ${grund.seiten}`);
  pruefe(grund.blaetter === 5, 'fünf Blätter im Fluss');
  pruefe(grund.miniaturen === 5, 'fünf Miniaturen');
  pruefe(grund.textstuecke > 5, 'Textebene liegt über der ersten Seite');
  pruefe(grund.felder === 6, 'sechs Formularfelder erkannt', `waren ${grund.felder}`);

  console.log('\nMitdenken');
  const vorschlaege = await seite.evaluate(() => [...document.querySelectorAll('.vorschlag b')].map((k) => k.textContent));
  pruefe(vorschlaege.some((v) => /Formular/.test(v)), 'offene Formularfelder werden gemeldet');
  pruefe(vorschlaege.some((v) => /personenbezogene/.test(v)), 'personenbezogene Angaben werden gefunden');
  pruefe(vorschlaege.some((v) => /Unterschriftsstelle/.test(v)), 'Unterschriftsstelle wird gefunden');

  console.log('\nAnmerkungen aus Textauswahl');
  const stelle = await seite.evaluate(() => {
    const span = [...document.querySelectorAll('.textebene span')].find((s) => s.textContent.includes('Bankverbindung'));
    const r = span.getBoundingClientRect();
    return { x: r.left, y: r.top, b: r.width, h: r.height };
  });
  await seite.mouse.move(stelle.x + 2, stelle.y + stelle.h / 2);
  await seite.mouse.down();
  await seite.mouse.move(stelle.x + stelle.b - 2, stelle.y + stelle.h / 2, { steps: 8 });
  await seite.mouse.up();
  await seite.keyboard.press('h');
  await seite.waitForTimeout(300);
  pruefe(await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.art === 'hervor')), 'Hervorhebung entsteht aus der Textauswahl');

  console.log('\nSchwärzen und sichern');
  await seite.keyboard.press('s');
  await seite.mouse.move(stelle.x - 2, stelle.y - 2);
  await seite.mouse.down();
  await seite.mouse.move(stelle.x + stelle.b + 4, stelle.y + stelle.h + 2, { steps: 8 });
  await seite.mouse.up();
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(300);

  await seite.evaluate(() => window.werkbank.fuehreAus('formular:naechstes'));
  await seite.waitForTimeout(1500);
  await seite.keyboard.type('Ada Musterfrau');
  await seite.waitForTimeout(200);

  const [ladung] = await Promise.all([
    seite.waitForEvent('download'),
    seite.evaluate(() => window.werkbank.fuehreAus('sichern')),
  ]);
  const ausgabe = join(ablage, 'ausgabe.pdf');
  await ladung.saveAs(ausgabe);

  const pdfjs = await import('../fremd/pdf.mjs');
  const dok = await pdfjs.getDocument({
    data: new Uint8Array(await readFile(ausgabe)),
    standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/'),
  }).promise;
  const textVon = async (nummer) => (await (await dok.getPage(nummer)).getTextContent()).items.map((i) => i.str).join(' ');

  pruefe(dok.numPages === 5, 'Ausgabe hat fünf Seiten', `waren ${dok.numPages}`);
  pruefe((await textVon(1)).trim() === '', 'geschwärzte Seite trägt keinen auslesbaren Text mehr');
  pruefe((await textVon(2)).includes('Mikrofone'), 'unberührte Seite behält ihren Text');
  pruefe((await textVon(3)).includes('Ada Musterfrau'), 'Formularwert steht in der Ausgabe');

  console.log('\nSeiten umbauen');
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.gewaehlteSeiten.clear();
    z.gewaehlteSeiten.add(z.folge[1].id);
    window.werkbank.fuehreAus('seiten:drehenRechts');
  });
  await seite.waitForTimeout(700);
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.gewaehlteSeiten.clear();
    z.gewaehlteSeiten.add(z.folge[3].id);
    window.werkbank.fuehreAus('seiten:loeschen');
  });
  await seite.waitForTimeout(700);
  pruefe(await seite.evaluate(() => window.werkbank.zustand.folge.length) === 4, 'Seite gelöscht');
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(600);
  pruefe(await seite.evaluate(() => window.werkbank.zustand.folge.length) === 5, 'Löschen ließ sich zurücknehmen');

  console.log('\nSuche');
  await seite.evaluate(() => window.werkbank.fuehreAus('suchen'));
  await seite.fill('#suchfeld', 'Mikrofone');
  await seite.waitForTimeout(900);
  pruefe((await seite.textContent('#such-anzahl')).includes('2'), 'zwei Treffer für „Mikrofone"');
  await seite.evaluate(() => window.werkbank.fuehreAus('suche:treffer-hervorheben'));
  await seite.waitForTimeout(2200);
  pruefe(await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => a.art === 'hervor').length) >= 2,
    'Suchtreffer lassen sich in einem Zug hervorheben');

  console.log('\nZusammenführen');
  await seite.setInputFiles('#dateiwahl-anhang', ausgabe);
  await seite.waitForTimeout(2500);
  const nachher = await seite.evaluate(() => ({ seiten: window.werkbank.zustand.folge.length, quellen: window.werkbank.zustand.quellen.size }));
  pruefe(nachher.seiten === 10 && nachher.quellen === 2, 'zweite Datei angehängt', JSON.stringify(nachher));

  console.log(`\nKonsolenfehler: ${fehler.length}`);
  pruefe(fehler.length === 0, 'kein Fehler in der Browserkonsole', fehler.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
  await rm(ablage, { recursive: true, force: true });
}

console.log(`\n${bestanden} bestanden, ${gescheitert} gescheitert\n`);
process.exit(gescheitert ? 1 : 0);
