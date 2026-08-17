/* Vollprüfung — jede Fähigkeit der Oberfläche einmal anfassen.

   Aufruf:  node werkzeuge/vollpruefung.mjs
   Ergänzt pruefen.mjs: dort steht das Ergebnis in der Datei im Vordergrund,
   hier die Bedienung — Zoom, Tafeln, Werkzeuge, Dialoge, Tastatur.

   Jede Prüfung fängt ihren eigenen Fehler ab und macht bei einem Fehlschlag
   ein Bild und einen Zustandsauszug, damit man sieht, was los war. */

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
let fehlerStrom = [];

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

await ladeBeispiel();

console.log('\n== Befehlsregister ==');
const befehle = await seite.evaluate(() => window.werkbank.befehle.map((b) => ({ id: b.id, name: b.name, gruppe: b.gruppe, kuerzel: b.kuerzel })));
console.log(`${befehle.length} Befehle registriert`);


/* --- Ansicht -------------------------------------------------------------- */
console.log('\n== Ansicht ==');
await pruefe('Zoom: ganze Seite', async () => {
  await seite.selectOption('#feld-zoom', 'seite');
  await seite.waitForTimeout(900);
  const h = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().height);
  if (h > 900) throw new Error('Blatt passt nicht in die Höhe: ' + Math.round(h));
  return `${Math.round(h)} px hoch`;
});
await pruefe('Zoom: 200 %', async () => {
  await seite.selectOption('#feld-zoom', '2');
  await seite.waitForTimeout(900);
  const b = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().width);
  if (Math.abs(b - 595 * 2) > 6) throw new Error('Breite ' + Math.round(b));
  return `${Math.round(b)} px breit`;
});
await pruefe('Zoom: Breite', async () => {
  await seite.selectOption('#feld-zoom', 'breite');
  await seite.waitForTimeout(900);
  return '';
});
await pruefe('Zoomschritte (Strg +/-)', async () => {
  await seite.keyboard.press('Control+Equal');
  await seite.waitForTimeout(600);
  await seite.keyboard.press('Control+Minus');
  await seite.waitForTimeout(600);
  return '';
});
await pruefe('Ansicht drehen', async () => {
  const vorher = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().width);
  await seite.click('#knopf-drehen');
  await seite.waitForTimeout(1000);
  const nachher = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().height);
  await seite.click('#knopf-drehen');
  await seite.click('#knopf-drehen');
  await seite.click('#knopf-drehen');
  await seite.waitForTimeout(1000);
  return `quer ${Math.round(nachher)} px`;
});
await pruefe('Seitennavigation (Knöpfe und Feld)', async () => {
  await seite.click('#knopf-vor');
  await seite.waitForTimeout(700);
  const zwei = await seite.inputValue('#feld-seite');
  await seite.fill('#feld-seite', '5');
  await seite.press('#feld-seite', 'Enter');
  await seite.waitForTimeout(900);
  const fuenf = await seite.evaluate(() => window.werkbank.zustand.aktuelleSeite);
  if (zwei !== '2' || fuenf !== 5) throw new Error(`nach vor: ${zwei}, nach Sprung: ${fuenf}`);
  await seite.evaluate(() => window.werkbank.fuehreAus('gehezu:seite'));
  return '';
});
await pruefe('Home/End', async () => {
  await seite.click('#buehne');
  await seite.keyboard.press('Home');
  await seite.waitForTimeout(700);
  const eins = await seite.evaluate(() => window.werkbank.zustand.aktuelleSeite);
  await seite.keyboard.press('End');
  await seite.waitForTimeout(900);
  const letzte = await seite.evaluate(() => window.werkbank.zustand.aktuelleSeite);
  if (eins !== 1 || letzte !== 5) throw new Error(`${eins} / ${letzte}`);
  await seite.keyboard.press('Home');
  await seite.waitForTimeout(600);
  return '';
});
await pruefe('Thema wechseln', async () => {
  await seite.click('#knopf-thema');
  const a = await seite.evaluate(() => document.documentElement.dataset.thema);
  await seite.click('#knopf-thema');
  const b = await seite.evaluate(() => document.documentElement.dataset.thema);
  if (a === b) throw new Error('Thema bleibt ' + a);
  return `${a} → ${b}`;
});
await pruefe('Leisten ein/aus (F4/F5)', async () => {
  await seite.keyboard.press('F4');
  await seite.waitForTimeout(500);
  const zu = await seite.evaluate(() => document.querySelector('#huelle').dataset.links);
  await seite.keyboard.press('F4');
  await seite.keyboard.press('F5');
  await seite.waitForTimeout(500);
  const rechtsZu = await seite.evaluate(() => document.querySelector('#huelle').dataset.rechts);
  await seite.keyboard.press('F5');
  await seite.waitForTimeout(600);
  if (zu !== 'zu' || rechtsZu !== 'zu') throw new Error(`${zu} / ${rechtsZu}`);
  return '';
});

/* --- Tafeln --------------------------------------------------------------- */
console.log('\n== Tafeln ==');
await pruefe('Reiter Gliederung', async () => {
  await seite.click('[data-tafel="gliederung"].reiter-knopf');
  await seite.waitForTimeout(400);
  const text = await seite.textContent('#tafel-gliederung');
  if (!text.trim()) throw new Error('leer');
  return text.trim().slice(0, 50);
});
await pruefe('Reiter Notizen', async () => {
  await seite.click('[data-tafel="anmerkungen"].reiter-knopf');
  await seite.waitForTimeout(300);
  const text = await seite.textContent('#tafel-anmerkungen');
  if (!text.trim()) throw new Error('leer');
  return text.trim().slice(0, 40);
});
await pruefe('Reiter Seiten', async () => {
  await seite.click('[data-tafel="miniaturen"].reiter-knopf');
  await seite.waitForTimeout(400);
  const n = await seite.evaluate(() => document.querySelectorAll('.miniatur canvas').length);
  if (n !== 5) throw new Error(String(n));
  return `${n} Miniaturen`;
});

/* --- Werkzeuge ------------------------------------------------------------ */
console.log('\n== Werkzeuge ==');
const blatt = async () => {
  await seite.selectOption('#feld-zoom', 'breite');
  await seite.waitForTimeout(700);
  await seite.evaluate(() => window.werkbank.fuehreAus('gehezu:erste'));
  await seite.waitForTimeout(700);
  const kasten = await seite.locator('.blatt').first().boundingBox();
  // Anteilige Punkte, die sicher auf dem Blatt und im Fenster liegen
  kasten.bei = (ax, ay) => ({ x: kasten.x + kasten.width * ax, y: Math.min(kasten.y + kasten.height * ay, 900) });
  return kasten;
};

await pruefe('Freihand zeichnen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:freihand'));
  const b = await blatt();
  const start = b.bei(0.1, 0.5);
  await seite.mouse.move(start.x, start.y);
  await seite.mouse.down();
  for (let i = 1; i <= 6; i++) await seite.mouse.move(start.x + i * 25, start.y + (i % 2 ? 20 : -20), { steps: 3 });
  await seite.mouse.up();
  await seite.waitForTimeout(400);
  const n = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => a.art === 'freihand').length);
  if (!n) throw new Error('keine Freihand-Anmerkung');
  const punkte = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.find((a) => a.art === 'freihand').punkte.length);
  return `${punkte} Punkte`;
});
await pruefe('Ellipse', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:ellipse'));
  const b = await blatt();
  const e1 = b.bei(0.45, 0.5), e2 = b.bei(0.6, 0.56);
  await seite.mouse.move(e1.x, e1.y);
  await seite.mouse.down();
  await seite.mouse.move(e2.x, e2.y, { steps: 6 });
  await seite.mouse.up();
  await seite.waitForTimeout(300);
  if (!await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.art === 'ellipse'))) throw new Error('fehlt');
  return '';
});
await pruefe('Pfeil', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:pfeil'));
  const b = await blatt();
  const p1 = b.bei(0.65, 0.5), p2 = b.bei(0.8, 0.55);
  await seite.mouse.move(p1.x, p1.y);
  await seite.mouse.down();
  await seite.mouse.move(p2.x, p2.y, { steps: 6 });
  await seite.mouse.up();
  await seite.waitForTimeout(300);
  if (!await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.art === 'pfeil'))) throw new Error('fehlt');
  return '';
});
await pruefe('Unterstreichen aus Textauswahl', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:auswahl'));
  const stelle = await seite.evaluate(() => {
    const s = [...document.querySelectorAll('.textebene span')].find((x) => x.textContent.includes('Auftragnehmer'));
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left, y: r.top + r.height / 2, b: r.width };
  });
  if (!stelle) throw new Error('Textstück nicht gefunden');
  await seite.mouse.move(stelle.x + 2, stelle.y);
  await seite.mouse.down();
  await seite.mouse.move(stelle.x + stelle.b - 4, stelle.y, { steps: 8 });
  await seite.mouse.up();
  await seite.keyboard.press('u');
  await seite.waitForTimeout(400);
  if (!await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.art === 'unterstrich'))) throw new Error('fehlt');
  return '';
});
await pruefe('Durchstreichen aus Textauswahl', async () => {
  const stelle = await seite.evaluate(() => {
    const s = [...document.querySelectorAll('.textebene span')].find((x) => x.textContent.includes('Einmessung'));
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left, y: r.top + r.height / 2, b: r.width };
  });
  if (!stelle) throw new Error('Textstück nicht gefunden');
  await seite.mouse.move(stelle.x + 2, stelle.y);
  await seite.mouse.down();
  await seite.mouse.move(stelle.x + stelle.b - 4, stelle.y, { steps: 8 });
  await seite.mouse.up();
  await seite.keyboard.press('d');
  await seite.waitForTimeout(400);
  if (!await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.art === 'durchstrich'))) throw new Error('fehlt');
  return '';
});
await pruefe('Notiz anlegen und bearbeiten', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:notiz'));
  const b = await blatt();
  const n = b.bei(0.85, 0.25);
  await seite.mouse.click(n.x, n.y);
  await seite.waitForSelector('.dialog textarea');
  await seite.fill('.dialog textarea', 'Prüfnotiz');
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(400);
  const notiz = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.find((a) => a.art === 'notiz'));
  if (notiz?.text !== 'Prüfnotiz') throw new Error('Text: ' + notiz?.text);
  // Marke anklicken öffnet die Notiz erneut
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:auswahl'));
  await seite.waitForTimeout(200);
  return '';
});
await pruefe('Anmerkung wählen und verschieben', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:auswahl'));
  await seite.waitForTimeout(200);
  const id = await seite.evaluate(() => {
    const a = window.werkbank.zustand.anmerkungen.find((x) => x.art === 'ellipse');
    return a?.id;
  });
  const vorher = await seite.evaluate((id) => {
    const a = window.werkbank.zustand.anmerkungen.find((x) => x.id === id);
    return { x: a.x, y: a.y };
  }, id);
  const griff = await seite.locator(`[data-anmerkung="${id}"]`).first().boundingBox();
  if (!griff) throw new Error('Griff nicht sichtbar');
  // Erst die Linie greifen (so macht es ein Mensch), dann ziehen.
  const rand = { x: griff.x, y: griff.y + griff.height / 2 };
  await seite.mouse.move(rand.x, rand.y);
  await seite.mouse.down();
  await seite.mouse.move(rand.x + 40, rand.y + 25, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(300);
  // Danach ist sie gewählt: jetzt muss auch die Fläche fangen.
  const griff2 = await seite.locator(`[data-anmerkung="${id}"]`).first().boundingBox();
  await seite.mouse.move(griff2.x + griff2.width / 2, griff2.y + griff2.height / 2);
  await seite.mouse.down();
  await seite.mouse.move(griff2.x + griff2.width / 2 + 20, griff2.y + griff2.height / 2, { steps: 6 });
  await seite.mouse.up();
  await seite.waitForTimeout(400);
  const nachher = await seite.evaluate((id) => {
    const a = window.werkbank.zustand.anmerkungen.find((x) => x.id === id);
    return { x: a.x, y: a.y };
  }, id);
  if (Math.abs(nachher.x - vorher.x) < 5) throw new Error('nicht bewegt');
  return `Δx ${Math.round(nachher.x - vorher.x)} pt`;
});
await pruefe('Rückgängig und Wiederholen', async () => {
  const vorher = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(300);
  const mitte = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  await seite.evaluate(() => window.werkbank.fuehreAus('wiederholen'));
  await seite.waitForTimeout(300);
  const nachher = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  return `${vorher} → ${mitte} → ${nachher}`;
});
await pruefe('Anmerkungsliste zeigt alle Einträge', async () => {
  await seite.click('[data-tafel="anmerkungen"].reiter-knopf');
  await seite.waitForTimeout(400);
  const eintraege = await seite.evaluate(() => document.querySelectorAll('#tafel-anmerkungen .eintrag').length);
  const anmerkungen = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  if (eintraege !== anmerkungen) throw new Error(`Liste ${eintraege}, Modell ${anmerkungen}`);
  return `${eintraege} Einträge`;
});
await pruefe('Anmerkungsbericht als Textdatei', async () => {
  const pfad = await ladungVon(() => seite.click('#tafel-anmerkungen button:has-text("Bericht")'));
  const inhalt = await readFile(pfad, 'utf8');
  if (!inhalt.includes('Prüfnotiz')) throw new Error('Notiz fehlt im Bericht');
  return `${inhalt.split('\n').length} Zeilen`;
});
await pruefe('Alle Anmerkungen löschen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('anmerkungen:alleLoeschen'));
  await seite.waitForTimeout(300);
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(400);
  const n = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  if (n !== 0) throw new Error(String(n));
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(300);
  return 'und zurückgenommen: ' + await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
});

/* --- Seiten --------------------------------------------------------------- */
console.log('\n== Seiten ==');
await pruefe('Alle Seiten wählen / keine', async () => {
  await seite.click('[data-tafel="miniaturen"].reiter-knopf');
  await seite.click('.seiten-kopf button:has-text("Alle")');
  await seite.waitForTimeout(300);
  const alle = await seite.evaluate(() => window.werkbank.zustand.gewaehlteSeiten.size);
  await seite.click('.seiten-kopf button:has-text("Keine")');
  await seite.waitForTimeout(300);
  const keine = await seite.evaluate(() => window.werkbank.zustand.gewaehlteSeiten.size);
  if (alle !== 5 || keine !== 0) throw new Error(`${alle}/${keine}`);
  return '';
});
await pruefe('Seiten verdoppeln', async () => {
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.gewaehlteSeiten.clear(); z.gewaehlteSeiten.add(z.folge[0].id);
    window.werkbank.fuehreAus('seiten:verdoppeln');
  });
  await seite.waitForTimeout(900);
  const n = await seite.evaluate(() => window.werkbank.zustand.folge.length);
  if (n !== 6) throw new Error(String(n));
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(800);
  return 'zurückgenommen auf ' + await seite.evaluate(() => window.werkbank.zustand.folge.length);
});
await pruefe('Miniaturen umsortieren (Ziehen)', async () => {
  const vorher = await seite.evaluate(() => window.werkbank.zustand.folge.map((e) => e.id));
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    const quelle = document.querySelector(`.miniatur[data-seite="${z.folge[0].id}"]`);
    const ziel = document.querySelector(`.miniatur[data-seite="${z.folge[2].id}"]`);
    const daten = new DataTransfer();
    quelle.dispatchEvent(new DragEvent('dragstart', { dataTransfer: daten, bubbles: true }));
    const kasten = ziel.getBoundingClientRect();
    ziel.dispatchEvent(new DragEvent('dragover', { dataTransfer: daten, bubbles: true, clientX: kasten.right - 2, clientY: kasten.top + 5 }));
    ziel.dispatchEvent(new DragEvent('drop', { dataTransfer: daten, bubbles: true, clientX: kasten.right - 2, clientY: kasten.top + 5 }));
    quelle.dispatchEvent(new DragEvent('dragend', { dataTransfer: daten, bubbles: true }));
  });
  await seite.waitForTimeout(1000);
  const nachher = await seite.evaluate(() => window.werkbank.zustand.folge.map((e) => e.id));
  if (vorher[0] === nachher[0]) throw new Error('Reihenfolge unverändert');
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(900);
  const zurueck = await seite.evaluate(() => window.werkbank.zustand.folge.map((e) => e.id));
  if (zurueck[0] !== vorher[0]) throw new Error('Rückgängig hat nicht gegriffen');
  return 'verschoben und zurückgenommen';
});
await pruefe('Gewählte Seiten als neue Datei', async () => {
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.gewaehlteSeiten.clear();
    z.gewaehlteSeiten.add(z.folge[1].id);
    z.gewaehlteSeiten.add(z.folge[2].id);
  });
  const pfad = await ladungVon(() => seite.evaluate(() => window.werkbank.fuehreAus('seiten:ausgeben')));
  const groesse = (await readFile(pfad)).length;
  return `${groesse} Bytes`;
});

/* --- Suche ---------------------------------------------------------------- */
console.log('\n== Suche ==');
await pruefe('Treffer anklicken springt zur Stelle', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('suchen'));
  await seite.fill('#suchfeld', 'Quorum');
  await seite.waitForTimeout(1000);
  const treffer = await seite.evaluate(() => document.querySelectorAll('#suchergebnisse .eintrag').length);
  if (!treffer) throw new Error('kein Treffer');
  await seite.click('#suchergebnisse .eintrag');
  await seite.waitForTimeout(1200);
  const seitenNr = await seite.evaluate(() => window.werkbank.zustand.aktuelleSeite);
  if (seitenNr !== 2) throw new Error('Seite ' + seitenNr);
  return `${treffer} Treffer, Sprung auf Seite ${seitenNr}`;
});
await pruefe('Suchoptionen Groß/klein und ganzes Wort', async () => {
  await seite.fill('#suchfeld', 'ton');
  await seite.waitForTimeout(900);
  const ohne = await seite.textContent('#such-anzahl');
  await seite.check('#such-wort');
  await seite.waitForTimeout(900);
  const mitWort = await seite.textContent('#such-anzahl');
  await seite.check('#such-gross');
  await seite.waitForTimeout(900);
  const mitBeidem = await seite.textContent('#such-anzahl');
  await seite.uncheck('#such-wort'); await seite.uncheck('#such-gross');
  return `${ohne} / ganzes Wort ${mitWort} / +Groß-klein ${mitBeidem}`;
});
await pruefe('Suche leeren mit Escape', async () => {
  await seite.fill('#suchfeld', 'Mikro');
  await seite.waitForTimeout(700);
  await seite.press('#suchfeld', 'Escape');
  await seite.waitForTimeout(400);
  const anzahl = await seite.textContent('#such-anzahl');
  if (anzahl.trim()) throw new Error('noch: ' + anzahl);
  return '';
});

/* --- Formulare ------------------------------------------------------------ */
console.log('\n== Formulare ==');
await pruefe('Ankreuzfeld und Auswahlliste', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('formular:naechstes'));
  await seite.waitForTimeout(1600);
  await seite.check('.formularfeld[type=checkbox]');
  await seite.selectOption('select.formularfeld', 'mit Vorbehalt');
  await seite.waitForTimeout(400);
  const werte = await seite.evaluate(() => Object.fromEntries(window.werkbank.zustand.formularwerte));
  if (werte.maengel !== true || werte.lieferung !== 'mit Vorbehalt') throw new Error(JSON.stringify(werte));
  return JSON.stringify(werte);
});
await pruefe('Formularwerte landen in der Ausgabe', async () => {
  const pfad = await ladungVon(() => seite.evaluate(() => window.werkbank.fuehreAus('sichern:einbrennen')));
  const { PDFDocument } = await import('../fremd/pdf-lib.mjs');
  const dok = await PDFDocument.load(await readFile(pfad));
  const felder = dok.getForm().getFields().length;
  const pdfjs = await import('../fremd/pdf.mjs');
  const gelesen = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pfad)), standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/') }).promise;
  const text = (await (await gelesen.getPage(3)).getTextContent()).items.map((i) => i.str).join(' ');
  if (!text.includes('mit Vorbehalt')) throw new Error('Auswahlwert fehlt in der Ausgabe');
  return `eingebrannt, ${felder} Felder übrig`;
});

/* --- Ausgabewege ---------------------------------------------------------- */
console.log('\n== Ausgabe ==');
await pruefe('Sichern unter (Dialog)', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('sichern:als'));
  await seite.waitForSelector('.dialog');
  await seite.fill('.dialog input.feld', 'pruefung-sichern-unter');
  const kaesten = await seite.$$('.dialog input[type=checkbox]');
  if (kaesten.length >= 2) await kaesten[1].check();     // Metadaten entfernen
  const pfad = await ladungVon(() => seite.click('.dialog-fuss .knopf:last-child'));
  const { PDFDocument } = await import('../fremd/pdf-lib.mjs');
  const dok = await PDFDocument.load(await readFile(pfad));
  const verfasser = dok.getAuthor();
  if (verfasser) throw new Error('Verfasser noch gesetzt: ' + verfasser);
  return 'Metadaten leer';
});
await pruefe('Text ausgeben (.txt)', async () => {
  const pfad = await ladungVon(() => seite.evaluate(() => window.werkbank.fuehreAus('text:ausgeben')));
  const inhalt = await readFile(pfad, 'utf8');
  if (!inhalt.includes('Sitzungstechnik')) throw new Error('Inhalt fehlt');
  return `${inhalt.length} Zeichen`;
});
await pruefe('Seite als PNG', async () => {
  const pfad = await ladungVon(() => seite.evaluate(() => window.werkbank.fuehreAus('bild:ausgeben')));
  const daten = await readFile(pfad);
  if (daten[0] !== 0x89 || daten[1] !== 0x50) throw new Error('kein PNG');
  return `${Math.round(daten.length / 1024)} kB`;
});
await pruefe('Teilen in Einzeldateien', async () => {
  const dateien = [];
  const sammler = (d) => dateien.push(d.suggestedFilename());
  seite.on('download', sammler);
  await seite.evaluate(() => window.werkbank.fuehreAus('teilen'));
  await seite.waitForSelector('.dialog input[type=number]');
  await seite.fill('.dialog input[type=number]', '3');
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(6000);
  seite.off('download', sammler);
  if (dateien.length !== 2) throw new Error(`${dateien.length} Dateien: ${dateien.join(', ')}`);
  return dateien.join(', ');
});
await pruefe('Reparieren', async () => {
  const pfad = await ladungVon(() => seite.evaluate(() => window.werkbank.fuehreAus('reparieren')));
  const kopf = (await readFile(pfad)).subarray(0, 5).toString();
  if (kopf !== '%PDF-') throw new Error('kein PDF: ' + kopf);
  return '';
});
await pruefe('Linearisieren', async () => {
  const pfad = await ladungVon(() => seite.evaluate(() => window.werkbank.fuehreAus('linearisieren')));
  const inhalt = (await readFile(pfad)).subarray(0, 2000).toString('latin1');
  if (!inhalt.includes('/Linearized')) throw new Error('nicht linearisiert');
  return 'Linearized-Marke vorhanden';
});
await pruefe('Schutz und Rechte anzeigen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('schutz:zeigen'));
  await seite.waitForSelector('.dialog pre', { timeout: 20000 });
  const text = await seite.textContent('.dialog pre');
  await dialogSchliessen();
  if (!text.trim()) throw new Error('leer');
  return text.trim().split('\n')[0].slice(0, 60);
});
await pruefe('Verkleinern (Dialog)', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('verkleinern'));
  await seite.waitForSelector('.dialog select');
  await seite.selectOption('.dialog select', '72');
  const pfad = await ladungVon(() => seite.click('.dialog-fuss .knopf:last-child'));
  const klein = (await readFile(pfad)).length;
  return `${Math.round(klein / 1024)} kB`;
});
await pruefe('Eigenschaften', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('eigenschaften'));
  await seite.waitForSelector('.dialog');
  const text = await seite.textContent('.dialog-rumpf');
  await dialogSchliessen();
  if (!text.includes('Seitenmaß')) throw new Error('unvollständig');
  return '';
});
await pruefe('Hilfe (F1)', async () => {
  await seite.keyboard.press('F1');
  await seite.waitForSelector('.dialog');
  const text = await seite.textContent('.dialog-rumpf');
  await dialogSchliessen();
  if (!text.includes('Strg+K')) throw new Error('Kürzel Strg+K fehlt');
  if (!text.includes('Esc')) throw new Error('Esc fehlt');
  return '';
});
await pruefe('Befehlspalette führt Befehl aus', async () => {
  await seite.keyboard.press('Control+k');
  await seite.waitForSelector('.palette input');
  await seite.fill('.palette input', 'ganze seite');
  await seite.waitForTimeout(300);
  await seite.keyboard.press('Enter');
  await seite.waitForTimeout(900);
  const zoom = await seite.evaluate(() => window.werkbank.zustand.zoom);
  if (zoom !== 'seite') throw new Error('Zoom: ' + zoom);
  await seite.selectOption('#feld-zoom', 'breite');
  await seite.waitForTimeout(700);
  return '';
});
await pruefe('Muster-Fundstellen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('muster:zeigen'));
  await seite.waitForSelector('.dialog');
  const n = await seite.evaluate(() => document.querySelectorAll('.dialog .eintrag').length);
  await dialogSchliessen();
  if (n < 3) throw new Error(String(n));
  return `${n} Fundstellen`;
});
await pruefe('Seiten ohne Text wählen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('leere:waehlen'));
  await seite.waitForTimeout(600);
  const n = await seite.evaluate(() => window.werkbank.zustand.gewaehlteSeiten.size);
  await seite.evaluate(() => { window.werkbank.zustand.gewaehlteSeiten.clear(); });
  if (!n) throw new Error('nichts gewählt');
  return `${n} Seiten`;
});
await pruefe('Vergleich mit anderer Datei', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('vergleich'));
  await seite.setInputFiles('#dateiwahl-vergleich', join(WURZEL, 'beispiel', 'beispiel.pdf'));
  await seite.waitForSelector('.vergleich', { timeout: 30000 });
  const text = await seite.textContent('.dialog-rumpf .hinweis');
  await dialogSchliessen();
  return text.trim().slice(0, 60);
});

/* --- Unterschrift --------------------------------------------------------- */
console.log('\n== Unterschrift ==');
await pruefe('Unterschrift tippen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('unterschrift:anlegen'));
  await seite.waitForSelector('.unterschrift-reiter');
  await seite.click('.unterschrift-reiter button:has-text("Tippen")');
  await seite.fill('.dialog input[placeholder="Vorname Nachname"]', 'Ada Musterfrau');
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(500);
  const b = await blatt();
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:unterschrift'));
  const u1 = b.bei(0.12, 0.62), u2 = b.bei(0.45, 0.68);
  await seite.mouse.move(u1.x, u1.y);
  await seite.mouse.down();
  await seite.mouse.move(u2.x, u2.y, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(500);
  const u = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.find((a) => a.art === 'unterschrift'));
  if (!u) throw new Error('keine Unterschrift gesetzt');
  if (!u.bild?.startsWith('data:image/png')) throw new Error('kein PNG');
  return `${Math.round(u.b)}×${Math.round(u.h)} pt`;
});

await pruefe('Unterschrift aus Bilddatei', async () => {
  // Ein kleines PNG erzeugen und als Unterschrift laden.
  const bildPfad = join(HIER, 'unterschrift.png');
  const png = await seite.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 90;
    const k = c.getContext('2d');
    k.strokeStyle = '#101418'; k.lineWidth = 4; k.lineCap = 'round';
    k.beginPath(); k.moveTo(20, 60); k.bezierCurveTo(80, 10, 140, 90, 280, 30); k.stroke();
    return c.toDataURL('image/png').split(',')[1];
  });
  await (await import('node:fs/promises')).writeFile(bildPfad, Buffer.from(png, 'base64'));

  await seite.evaluate(() => window.werkbank.fuehreAus('unterschrift:anlegen'));
  await seite.waitForSelector('.unterschrift-reiter');
  await seite.click('.unterschrift-reiter button:has-text("Bild")');
  await seite.setInputFiles('.dialog input[type=file]', bildPfad);
  await seite.waitForTimeout(500);
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(400);
  const b = await blatt();
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:unterschrift'));
  const s1 = b.bei(0.5, 0.52), s2 = b.bei(0.8, 0.6);
  await seite.mouse.move(s1.x, s1.y);
  await seite.mouse.down();
  await seite.mouse.move(s2.x, s2.y, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(500);
  const anzahl = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => a.art === 'unterschrift').length);
  if (anzahl < 2) throw new Error('Bildunterschrift wurde nicht gesetzt');
  return `${anzahl} Unterschriften auf der Seite`;
});

await pruefe('Drucken reicht die erzeugte Datei an den Betrachter', async () => {
  // Geprüft wird die Zusage der Werkbank — eine fertige PDF-Datei zu öffnen.
  // Ob der eingebaute Betrachter danach von selbst druckt, ist Sache des Browsers.
  const adresse = await seite.evaluate(async () => {
    const echt = window.open;
    let gemerkt = null;
    window.open = (url) => { gemerkt = url; return { addEventListener() {}, print() {}, closed: false }; };
    try {
      await window.werkbank.fuehreAus('drucken');
      await new Promise((l) => setTimeout(l, 2500));
      return gemerkt;
    } finally { window.open = echt; }
  });
  if (!adresse?.startsWith('blob:')) throw new Error('kein Blob übergeben: ' + String(adresse).slice(0, 40));
  return 'PDF-Blob an den Betrachter übergeben';
});

/* --- Neue Wege: Word, Textauswahl, Stempel, Bilder ------------------------ */
console.log('\n== Word, Text, Stempel ==');
await seite.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

await pruefe('Word-Dialog gibt eine .docx aus', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('word:ausgeben'));
  await seite.waitForSelector('.dialog select');
  const pfad = await ladungVon(() => seite.click('.dialog-fuss .knopf:last-child'));
  const daten = await readFile(pfad);
  if (daten[0] !== 0x50 || daten[1] !== 0x4B) throw new Error('kein ZIP');
  if (!daten.includes(Buffer.from('word/document.xml'))) throw new Error('kein Word-Dokument');
  return `${Math.round(daten.length / 1024)} kB`;
});

await pruefe('Textauswahl kopieren', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:auswahl'));
  const stelle = await seite.evaluate(() => {
    const s = [...document.querySelectorAll('.textebene span')].find((x) => x.textContent.includes('Konferenzanlage'));
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: r.left, y: r.top + r.height / 2, b: r.width };
  });
  if (!stelle) throw new Error('Textstück nicht gefunden');
  await seite.mouse.move(stelle.x + 2, stelle.y);
  await seite.mouse.down();
  await seite.mouse.move(stelle.x + stelle.b - 4, stelle.y, { steps: 8 });
  await seite.mouse.up();
  await seite.evaluate(() => window.werkbank.fuehreAus('text:kopieren'));
  await seite.waitForTimeout(500);
  const inhalt = await seite.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (!/Konferenzanlage|Vertrag/.test(inhalt)) throw new Error('Zwischenablage: ' + inhalt.slice(0, 40));
  return `${inhalt.trim().split(/\s+/).length} Wörter`;
});

await pruefe('Seitentext kopieren, wenn nichts markiert ist', async () => {
  await seite.evaluate(() => window.getSelection().removeAllRanges());
  await seite.evaluate(() => window.werkbank.fuehreAus('text:kopieren'));
  await seite.waitForTimeout(600);
  const inhalt = await seite.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  if (inhalt.trim().split(/\s+/).length < 20) throw new Error('zu wenig Text: ' + inhalt.length);
  return `${inhalt.trim().split(/\s+/).length} Wörter`;
});

await pruefe('Bereich ablichten (Momentaufnahme)', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:bereich'));
  const b = await blatt();
  const a1 = b.bei(0.15, 0.2), a2 = b.bei(0.6, 0.3);
  await seite.mouse.move(a1.x, a1.y);
  await seite.mouse.down();
  await seite.mouse.move(a2.x, a2.y, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(2500);
  const meldung = await seite.evaluate(() => document.querySelector('#meldungen')?.textContent || '');
  if (!/Bereich/.test(meldung)) throw new Error('keine Rückmeldung: ' + meldung.slice(0, 60));
  const anmerkungen = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((x) => x.art === 'bereich'));
  if (anmerkungen) throw new Error('der Bereich wurde fälschlich ins Dokument geschrieben');
  return meldung.slice(-42);
});

await pruefe('Stempel setzen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:stempel'));
  const b = await blatt();
  const punkt = b.bei(0.6, 0.42);
  await seite.mouse.click(punkt.x, punkt.y);
  await seite.waitForSelector('.dialog select');
  await seite.selectOption('.dialog select', '2');            // Entwurf
  await seite.check('.dialog input[type=checkbox]');          // mit Datum
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(600);
  const stempel = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.find((a) => a.art === 'stempel'));
  if (!stempel) throw new Error('kein Stempel angelegt');
  if (!/Entwurf/.test(stempel.text)) throw new Error('Text: ' + stempel.text);
  return stempel.text;
});

await pruefe('PDF aus Bildern erstellen', async () => {
  const bildPfad = join(HIER, 'seite.png');
  const png = await seite.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 400;
    const k = c.getContext('2d');
    k.fillStyle = '#EBEEEE'; k.fillRect(0, 0, 600, 400);
    k.fillStyle = '#141A1C'; k.font = '40px sans-serif'; k.fillText('Bildseite', 40, 200);
    return c.toDataURL('image/png').split(',')[1];
  });
  await (await import('node:fs/promises')).writeFile(bildPfad, Buffer.from(png, 'base64'));
  const pfad = await ladungVon(async () => {
    await seite.evaluate(() => window.werkbank.fuehreAus('bilder:zuPdf'));
    await seite.setInputFiles('#dateiwahl-bilder', [bildPfad, bildPfad]);
  });
  const pdfjs = await import('../fremd/pdf.mjs');
  const dok = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pfad)) }).promise;
  if (dok.numPages !== 2) throw new Error(`${dok.numPages} Seiten`);
  return 'zwei Bilder, zwei Seiten';
});

console.log('\n== Menue, Ordnen, Fokus ==');

await ladeBeispiel();

await pruefe('Menueleiste traegt alle acht Menues', async () => {
  const titel = await seite.$$eval('#menueleiste .menue-knopf', (ks) => ks.map((k) => k.textContent));
  const erwartet = ['Datei', 'Bearbeiten', 'Seiten', 'Ansicht', 'Werkzeuge', 'Gehe zu', 'Schutz', 'Hilfe'];
  if (titel.join('|') !== erwartet.join('|')) throw new Error(titel.join('|'));
  return titel.join(', ');
});

await pruefe('jeder Befehl ist mit der Maus erreichbar', async () => {
  /* Der eigentliche Punkt der Menueleiste. Ein Befehl, der in keinem Menue
     steht, ist nur ueber Strg+K da — und damit fuer die meisten gar nicht. */
  const offen = await seite.evaluate(async () => (await import('./app/menue.js')).unsortierteBefehle());
  if (offen.length) throw new Error(`ohne Menueweg: ${offen.join(', ')}`);
  const anzahl = await seite.$$eval('#menueleiste .menue-eintrag', (ks) => ks.length);
  const befehle = await seite.evaluate(() => window.werkbank.befehle.length);
  return `${befehle} Befehle, ${anzahl} Menueeintraege`;
});

await pruefe('Menue klappt sichtbar auf und wird nicht beschnitten', async () => {
  await seite.click('#menueleiste .menue-knopf >> nth=2');
  const lage = await seite.evaluate(() => {
    const liste = document.querySelector('.menue.ist-offen .menue-liste');
    if (!liste || liste.hidden) return null;
    const kasten = liste.getBoundingClientRect();
    /* Nicht nur "im DOM": an einem Punkt der Liste muss die Liste auch das
       oberste Element sein. Frueher schnitt die Leiste sie auf 2rem ab. */
    const oben = document.elementFromPoint(kasten.x + 20, kasten.y + 12);
    return { hoehe: Math.round(kasten.height), traegt: !!oben?.closest('.menue-liste') };
  });
  if (!lage) throw new Error('Liste bleibt zu');
  if (!lage.traegt) throw new Error('Liste ist verdeckt oder beschnitten');
  if (lage.hoehe < 100) throw new Error(`nur ${lage.hoehe} px hoch`);
  await seite.keyboard.press('Escape');
  return `${lage.hoehe} px hoch, oben auf`;
});

await pruefe('Rueckgaengig-Knopf im Kopf folgt der Historie', async () => {
  if (!await seite.evaluate(() => document.querySelector('#knopf-rueckgaengig').disabled)) throw new Error('am Anfang nicht gesperrt');
  await seite.evaluate(() => window.werkbank.fuehreAus('seiten:drehenRechts'));
  await seite.waitForTimeout(500);
  if (await seite.evaluate(() => document.querySelector('#knopf-rueckgaengig').disabled)) throw new Error('nach einer Aenderung noch gesperrt');
  const beschriftung = await seite.$eval('#knopf-rueckgaengig', (k) => k.title);
  await seite.click('#knopf-rueckgaengig');
  await seite.waitForTimeout(400);
  if (!await seite.evaluate(() => document.querySelector('#knopf-wiederholen').disabled === false)) throw new Error('Wiederholen bleibt gesperrt');
  return beschriftung;
});

await pruefe('Seiten ordnen zeigt jede Seite gross', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('seiten:ordnen'));
  await seite.waitForSelector('.ordnen-karte');
  await seite.waitForTimeout(1200);
  const karten = await seite.$$eval('.ordnen-karte', (ks) => ks.length);
  const seitenzahl = await seite.evaluate(() => window.werkbank.zustand.folge.length);
  if (karten !== seitenzahl) throw new Error(`${karten} Karten fuer ${seitenzahl} Seiten`);
  const gemalt = await seite.$$eval('.ordnen-karte canvas', (ks) => ks.filter((c) => c.width > 100).length);
  if (!gemalt) throw new Error('keine Seite gezeichnet');
  return `${karten} Karten, ${gemalt} gezeichnet`;
});

await pruefe('Ordnen sortiert per Ziehen um', async () => {
  const vorher = await seite.evaluate(() => window.werkbank.zustand.folge.map((e) => e.id));
  const von = await seite.$('.ordnen-karte >> nth=0');
  const nach = await seite.$('.ordnen-karte >> nth=2');
  const a = await von.boundingBox(), b = await nach.boundingBox();
  await seite.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await seite.mouse.down();
  await seite.mouse.move(b.x + b.width * 0.9, b.y + b.height / 2, { steps: 12 });
  await seite.mouse.up();
  await seite.waitForTimeout(700);
  const nachher = await seite.evaluate(() => window.werkbank.zustand.folge.map((e) => e.id));
  if (vorher.join() === nachher.join()) throw new Error('Reihenfolge unveraendert');
  if (nachher[0] === vorher[0]) throw new Error('erste Seite blieb vorn');
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(500);
  return `Seite 1 steht jetzt an Stelle ${nachher.indexOf(vorher[0]) + 1}`;
});

await pruefe('Ordnen loescht die gewaehlten Seiten', async () => {
  const vorher = await seite.evaluate(() => window.werkbank.zustand.folge.length);
  await seite.click('.ordnen-karte >> nth=1');
  await seite.waitForTimeout(200);
  await seite.click('.ordnen-werkzeuge .knopf-gefahr');
  await seite.waitForTimeout(600);
  const nachher = await seite.evaluate(() => window.werkbank.zustand.folge.length);
  if (nachher !== vorher - 1) throw new Error(`${vorher} → ${nachher}`);
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  await seite.waitForTimeout(600);
  if (await seite.evaluate(() => window.werkbank.zustand.folge.length) !== vorher) throw new Error('Rueckgaengig hat nicht zurueckgeholt');
  return `${vorher} → ${nachher} → ${vorher}`;
});

await pruefe('Escape schliesst die Ordnen-Ansicht', async () => {
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(300);
  if (!await seite.evaluate(() => document.querySelector('#ordnen').hidden)) throw new Error('bleibt offen');
  return 'zu';
});

await pruefe('Fokus zeigt nur die gewaehlten Seiten', async () => {
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.gewaehlteSeiten.clear();
    z.gewaehlteSeiten.add(z.folge[2].id);
    z.gewaehlteSeiten.add(z.folge[4].id);
  });
  await seite.evaluate(() => window.werkbank.fuehreAus('seiten:nurAuswahl'));
  await seite.waitForTimeout(1200);
  const sichtbar = await seite.$$eval('.blatt:not(.ist-verborgen)', (b) => b.length);
  if (sichtbar !== 2) throw new Error(`${sichtbar} Blaetter sichtbar`);
  const nummern = await seite.$$eval('.blatt:not(.ist-verborgen) .blatt-nummer', (ks) => ks.map((k) => k.textContent));
  if (nummern.join() !== '3,5') throw new Error(`Nummern ${nummern.join()} statt 3,5`);
  if (await seite.evaluate(() => document.querySelector('#fuss-fokus').hidden)) throw new Error('Fuss meldet den Ausschnitt nicht');
  return `sichtbar: Seiten ${nummern.join(' und ')}`;
});

await pruefe('der Weg zurueck aus dem Fokus steht im Fuss', async () => {
  await seite.click('#knopf-fokus-aus');
  await seite.waitForTimeout(900);
  const sichtbar = await seite.$$eval('.blatt:not(.ist-verborgen)', (b) => b.length);
  const alle = await seite.evaluate(() => window.werkbank.zustand.folge.length);
  if (sichtbar !== alle) throw new Error(`${sichtbar} von ${alle}`);
  if (!await seite.evaluate(() => document.querySelector('#fuss-fokus').hidden)) throw new Error('Anzeige bleibt stehen');
  return `wieder ${alle} Seiten`;
});


console.log('\n== Neue Dialoge ==');

await ladeBeispiel();

for (const [befehl, ueberschrift] of [
  ['excel:ausgeben', 'Nach Excel ausgeben'],
  ['barrierefrei', 'Barrierefreiheit'],
  ['signieren', 'Digital unterschreiben'],
]) {
  await pruefe(`Dialog „${ueberschrift}" geht auf und wieder zu`, async () => {
    await seite.evaluate((b) => window.werkbank.fuehreAus(b), befehl);
    await seite.waitForTimeout(600);
    const titel = await seite.evaluate(() => document.querySelector('.dialog-kopf h2')?.textContent || '');
    if (titel !== ueberschrift) throw new Error(`Titel war „${titel}"`);
    await dialogSchliessen();
    if (await dialogOffen()) throw new Error('bleibt offen');
    return titel;
  });
}

await pruefe('Formularfeld-Werkzeug legt einen Entwurf an', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:feld'));
  const blatt = await seite.$('.blatt >> nth=0');
  const kasten = await blatt.boundingBox();
  await seite.mouse.move(kasten.x + 80, kasten.y + 140);
  await seite.mouse.down();
  await seite.mouse.move(kasten.x + 300, kasten.y + 180, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(500);
  const titel = await seite.evaluate(() => document.querySelector('.dialog-kopf h2')?.textContent || '');
  if (titel !== 'Formularfeld anlegen') throw new Error(`kein Dialog, Titel war „${titel}"`);
  await seite.click('.schirm button:has-text("Anlegen")');
  await seite.waitForTimeout(500);
  const entwuerfe = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => a.art === 'feldneu').length);
  if (entwuerfe !== 1) throw new Error(`${entwuerfe} Entwürfe`);
  const sichtbar = await seite.evaluate(() => document.querySelectorAll('.feld-entwurf').length);
  if (!sichtbar) throw new Error('der Entwurf ist auf der Seite nicht zu sehen');
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:auswahl'));
  return 'Rahmen gezogen, Feld angelegt, Platzhalter sichtbar';
});

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
