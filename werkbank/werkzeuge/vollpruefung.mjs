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
await pruefe('Reiter Kommentare (rechte Leiste)', async () => {
  /* Die Anmerkungsliste steht seit der Umgestaltung rechts als „Kommentare",
     mit Antworten und Erledigt-Zustand — nicht mehr links unter „Notizen". */
  await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
  await seite.waitForTimeout(300);
  const text = await seite.textContent('#tafel-kommentare');
  if (!text.trim()) throw new Error('leer');
  return text.trim().replace(/\s+/g, ' ').slice(0, 40);
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
await pruefe('Kommentarliste zeigt alle Einträge', async () => {
  await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
  await seite.waitForTimeout(400);
  const faeden = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
  const anmerkungen = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => !a.erledigt).length);
  if (faeden !== anmerkungen) throw new Error(`Liste ${faeden}, Modell ${anmerkungen}`);
  return `${faeden} Fäden`;
});
await pruefe('Kommentar beantworten und abhaken', async () => {
  await seite.locator('#tafel-kommentare .faden').first().click();
  await seite.waitForSelector('#tafel-kommentare .faden.ist-aktiv input.feld');
  await seite.fill('#tafel-kommentare .faden.ist-aktiv input.feld', 'Einverstanden, wird geändert');
  await seite.press('#tafel-kommentare .faden.ist-aktiv input.feld', 'Enter');
  await seite.waitForTimeout(400);
  const antworten = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => a.antworten?.length).length);
  if (antworten !== 1) throw new Error(`${antworten} Anmerkungen mit Antwort`);
  const vorher = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
  await seite.click('#tafel-kommentare .faden.ist-aktiv button:has-text("Erledigt")');
  await seite.waitForTimeout(400);
  const nachher = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
  if (nachher !== vorher - 1) throw new Error(`${vorher} → ${nachher} statt einer weniger`);
  await seite.click('#tafel-kommentare .filterreihe .knopf:has-text("Erledigt")');
  await seite.waitForTimeout(300);
  const erledigt = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
  if (erledigt !== 1) throw new Error(`unter „Erledigt" stehen ${erledigt}`);
  await seite.click('#tafel-kommentare .faden button:has-text("Wieder öffnen")');
  await seite.waitForTimeout(300);
  await seite.click('#tafel-kommentare .filterreihe .knopf:has-text("Offen")');
  await seite.waitForTimeout(300);
  return `Antwort vermerkt, abgehakt, wieder geöffnet`;
});
await pruefe('Anmerkungsbericht als Textdatei', async () => {
  await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
  await seite.waitForTimeout(300);
  const pfad = await ladungVon(() => seite.click('#tafel-kommentare button:has-text("Bericht")'));
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
  await seite.waitForSelector('.vergleich-hinweis', { timeout: 60000 });
  const text = await seite.textContent('.vergleich-hinweis');
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(400);
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
  const u1 = b.bei(0.12, 0.30), u2 = b.bei(0.45, 0.36);
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
  const s1 = b.bei(0.5, 0.44), s2 = b.bei(0.8, 0.52);
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


console.log('\n== Mappen, Einstellungen, Gestaltung ==');

/* Was im ersten Reiter schon liegt, wenn die Mappenprüfungen beginnen —
   die vorigen Abschnitte haben dort gearbeitet. */
let ersterReiterAnmerkungen = 0;

await pruefe('Titelleiste zeigt einen Reiter je Datei', async () => {
  ersterReiterAnmerkungen = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  const vorher = await seite.$$eval('#dokument-reiter .dok-reiter', (k) => k.length);
  if (vorher !== 1) throw new Error(`${vorher} Reiter zu Beginn`);
  await seite.setInputFiles('#dateiwahl', join(WURZEL, 'beispiel', 'beispiel.pdf'));
  await seite.waitForTimeout(2500);
  const nachher = await seite.$$eval('#dokument-reiter .dok-reiter', (k) => k.length);
  if (nachher !== 2) throw new Error(`${nachher} Reiter nach dem zweiten Öffnen`);
  const aktiv = await seite.$$eval('#dokument-reiter .dok-reiter.ist-aktiv', (k) => k.length);
  if (aktiv !== 1) throw new Error(`${aktiv} aktive Reiter`);
  return `${nachher} Reiter, einer aktiv`;
});

await pruefe('Reiterwechsel tauscht das Dokument, ohne es zu vermischen', async () => {
  /* Der zweite Reiter bekommt eine Anmerkung, der erste nicht. Danach muss
     jeder Reiter genau seine eigene zeigen — das ist die Stelle, an der ein
     geteilter Zustand auffliegt. */
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.anmerkungen.push({ id: 'probe-zwei', art: 'notiz', seiteId: z.folge[0].id, x: 50, y: 50, text: 'nur im zweiten Reiter', erstellt: Date.now() });
  });
  const hatProbe = () => seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.id === 'probe-zwei'));
  if (!await hatProbe()) throw new Error('die Probe kam im zweiten Reiter nicht an');

  await seite.locator('#dokument-reiter .dok-reiter').first().click();
  await seite.waitForTimeout(1200);
  /* Nicht die Anzahl vergleichen — die kann zufällig übereinstimmen. Die
     Frage ist, ob **diese** Anmerkung im anderen Reiter auftaucht. */
  if (await hatProbe()) throw new Error('die Anmerkung des zweiten Reiters steht auch im ersten');
  const imErsten = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.length);
  if (imErsten !== ersterReiterAnmerkungen) {
    throw new Error(`im ersten Reiter stehen ${imErsten} statt ${ersterReiterAnmerkungen} Anmerkungen`);
  }

  await seite.locator('#dokument-reiter .dok-reiter').nth(1).click();
  await seite.waitForTimeout(1200);
  if (!await hatProbe()) throw new Error('zurück im zweiten Reiter fehlt die Anmerkung');
  return 'die Probe steht nur im zweiten Reiter und übersteht den Wechsel';
});

await pruefe('Reiter schließen lässt die übrigen stehen', async () => {
  await seite.evaluate(() => { window.werkbank.zustand.geaendert = false; });
  await seite.locator('#dokument-reiter .dok-reiter').nth(1).locator('.dok-reiter-zu').click();
  await seite.waitForTimeout(1200);
  const uebrig = await seite.$$eval('#dokument-reiter .dok-reiter', (k) => k.length);
  if (uebrig !== 1) throw new Error(`${uebrig} Reiter übrig`);
  return 'einer übrig, aktiv';
});

await ladeBeispiel();

await pruefe('Rechte Leiste hat vier Reiter, jeder mit Inhalt', async () => {
  const namen = await seite.$$eval('#reiter-rechts .reiter-knopf', (k) => k.map((x) => x.textContent));
  if (namen.join('|') !== 'Hinweise|Kommentare|Felder|Verlauf') throw new Error(namen.join('|'));
  const inhalte = [];
  for (const [tafel, id] of [['mitdenken', '#tafel-rechts'], ['anmerkungen', '#tafel-kommentare'],
    ['felder', '#tafel-felder'], ['verlauf', '#tafel-verlauf']]) {
    await seite.click(`[data-rtafel="${tafel}"].reiter-knopf`);
    await seite.waitForTimeout(350);
    const text = (await seite.textContent(id)).trim();
    if (!text) throw new Error(`${tafel} ist leer`);
    inhalte.push(`${tafel}: ${text.replace(/\s+/g, ' ').slice(0, 22)}`);
  }
  return inhalte.join(' · ');
});

await pruefe('Feldertafel meldet offene Pflichtfelder', async () => {
  await seite.click('[data-rtafel="felder"].reiter-knopf');
  await seite.waitForTimeout(400);
  const zeilen = await seite.$$eval('#tafel-felder .feldzeile', (k) => k.length);
  const felder = await seite.evaluate(() => window.werkbank.zustand.formularfelder.length);
  if (zeilen !== felder) throw new Error(`${zeilen} Zeilen für ${felder} Felder`);
  return `${zeilen} Felder aufgeführt`;
});

await pruefe('Verlaufstafel zeigt die letzten Schritte', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('seiten:drehenRechts'));
  await seite.waitForTimeout(500);
  await seite.click('[data-rtafel="verlauf"].reiter-knopf');
  await seite.waitForTimeout(400);
  const zeilen = await seite.$$eval('#tafel-verlauf .verlauf-zeile', (k) => k.length);
  if (!zeilen) throw new Error('leer');
  await seite.evaluate(() => window.werkbank.fuehreAus('rueckgaengig'));
  return `${zeilen} Schritte`;
});

await pruefe('Einstellungen wirken sofort', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('einstellungen'));
  await seite.waitForSelector('.einstellungen');
  const kategorien = await seite.$$eval('.einst-kategorie', (k) => k.map((x) => x.textContent));
  if (kategorien.length !== 7) throw new Error(`${kategorien.length} Kategorien`);

  await seite.click('.einst-kategorie:has-text("Anzeige & Lesen")');
  await seite.waitForTimeout(300);
  /* Der Schalter für die Seitenzahlen ist der, dessen Wirkung sich sofort
     im Baum nachweisen lässt. */
  await seite.click('.einst-zeile:has-text("Seitenzahlen") .pille');
  await seite.waitForTimeout(300);
  const aus = await seite.evaluate(() => document.documentElement.classList.contains('ohne-seitenzahlen'));
  if (!aus) throw new Error('Seitenzahlen blieben an');
  await seite.click('.einst-zeile:has-text("Seitenzahlen") .pille');
  await seite.waitForTimeout(200);

  await seite.click('.einst-kategorie:has-text("Anmerkungen")');
  await seite.waitForTimeout(250);
  await seite.click('.einst-zeile:has-text("Strichstärke") .segment:has-text("Dick")');
  await seite.waitForTimeout(250);
  const staerke = await seite.evaluate(() => window.werkbank.zustand.strichstaerke);
  if (staerke !== 4) throw new Error(`Strichstärke ${staerke}`);
  await dialogSchliessen();
  return `${kategorien.length} Kategorien, Schalter und Wahl greifen`;
});

await pruefe('Die Gestaltung folgt dem Handoff', async () => {
  const werte = await seite.evaluate(() => {
    const wurzel = getComputedStyle(document.documentElement);
    return {
      akzent: wurzel.getPropertyValue('--tally').trim(),
      chrome: getComputedStyle(document.querySelector('.kopf')).backgroundColor,
      buehne: getComputedStyle(document.querySelector('#buehne')).backgroundColor,
      papier: getComputedStyle(document.querySelector('.blatt')).backgroundColor,
      radius: getComputedStyle(document.querySelector('.knopf')).borderRadius,
      schrift: getComputedStyle(document.body).fontFamily,
      plex: document.fonts.check('12px "IBM Plex Sans"') && document.fonts.check('12px "IBM Plex Mono"'),
    };
  });
  if (werte.akzent.toLowerCase() !== '#0f766e') throw new Error(`Akzent ${werte.akzent}`);
  if (werte.chrome !== 'rgb(29, 35, 39)') throw new Error(`Chrome ${werte.chrome}`);
  if (werte.buehne !== 'rgb(95, 104, 110)') throw new Error(`Bühne ${werte.buehne}`);
  if (werte.papier !== 'rgb(253, 252, 249)') throw new Error(`Papier ${werte.papier}`);
  if (werte.radius !== '0px') throw new Error(`Radius ${werte.radius}`);
  if (!werte.schrift.includes('IBM Plex Sans')) throw new Error(`Schrift ${werte.schrift}`);
  if (!werte.plex) throw new Error('IBM Plex wurde nicht geladen');
  return 'Akzent, Chrome, Bühne, Papier, Radius 0, IBM Plex geladen';
});

await pruefe('Die Schriften kommen von hier, nicht aus dem Netz', async () => {
  /* Der Kern der Sache: das Handoff nennt Google Fonts. Wenn hier eine
     fremde Adresse auftaucht, ist Leitprinzip 2 gebrochen. */
  const fremd = await seite.evaluate(() => [...document.styleSheets]
    .flatMap((b) => { try { return [...b.cssRules]; } catch { return []; } })
    .filter((r) => r.constructor.name === 'CSSFontFaceRule')
    .map((r) => r.style.getPropertyValue('src'))
    .filter((src) => !/^url\("?\.\.\/fremd\/schrift\//.test(src.trim())));
  if (fremd.length) throw new Error(`fremde Schriftquelle: ${fremd[0].slice(0, 60)}`);
  const anzahl = await seite.evaluate(() => [...document.styleSheets]
    .flatMap((b) => { try { return [...b.cssRules]; } catch { return []; } })
    .filter((r) => r.constructor.name === 'CSSFontFaceRule').length);
  return `${anzahl} Schnitte, alle aus fremd/schrift`;
});


console.log('\n== Vergleichsansicht und schmale Fenster ==');

await pruefe('Der Vergleich ist eine eigene Ansicht, kein Dialog', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('vergleich'));
  await seite.setInputFiles('#dateiwahl-vergleich', join(WURZEL, 'beispiel', 'beispiel.pdf'));
  await seite.waitForSelector('.vergleich-kopf', { timeout: 60000 });
  await seite.waitForTimeout(1000);
  if (await dialogOffen()) throw new Error('es ist trotzdem ein Dialog');
  if (!await seite.evaluate(() => document.querySelector('#buehne').hidden)) throw new Error('die Bühne steht noch');
  const legende = (await seite.textContent('.vergleich-legende')).replace(/\s+/g, ' ');
  if (!/hinzugefügt/.test(legende) || !/entfernt/.test(legende)) throw new Error(`Legende: ${legende}`);
  const spalten = await seite.$$eval('.vergleich-spalte', (k) => k.length);
  if (spalten !== 2) throw new Error(`${spalten} Spalten`);
  return legende.trim().slice(0, 46);
});

await pruefe('Im Vergleich lässt sich blättern, Escape führt zurück', async () => {
  const vorher = await seite.textContent('.vergleich-titel .mono');
  await seite.click('.vergleich-nav .knopf >> nth=1');
  await seite.waitForTimeout(500);
  const nachher = await seite.textContent('.vergleich-titel .mono');
  if (vorher === nachher) throw new Error('die Seite hat sich nicht geändert');
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(500);
  const zu = await seite.evaluate(() => document.querySelector('#vergleich-ansicht').hidden
    && !document.querySelector('#buehne').hidden);
  if (!zu) throw new Error('Escape hat nicht geschlossen');
  return `${vorher.trim()} → ${nachher.trim()}, dann zurück`;
});

await pruefe('Auf schmalen Fenstern scrollt nichts waagerecht', async () => {
  /* Der eigentliche Fehler war nicht „sieht eng aus", sondern dass die
     Menüleiste das Dokument breiter machte als das Fenster — dann wandert
     beim Wischen die ganze Anwendung zur Seite. */
  const befunde = [];
  for (const [breite, hoehe, name] of [[402, 874, 'Telefon'], [820, 1180, 'Tablet']]) {
    await seite.setViewportSize({ width: breite, height: hoehe });
    await seite.waitForTimeout(1200);
    const mass = await seite.evaluate(() => {
      window.scrollTo(600, 0);
      const x = window.scrollX;
      window.scrollTo(0, 0);
      return {
        ueberhang: document.documentElement.scrollWidth - window.innerWidth,
        gescrollt: x,
        blatt: Math.round(document.querySelector('.blatt')?.getBoundingClientRect().width || 0),
      };
    });
    if (mass.gescrollt > 0) {
      const schuld = await seite.evaluate(() => {
        const anfang = document.documentElement.scrollWidth;
        const treffer = [];
        for (const e of document.querySelectorAll('#huelle > *, .rumpf > *, body > *')) {
          const alt = e.style.display; e.style.display = 'none';
          if (document.documentElement.scrollWidth < anfang) treffer.push(e.id || e.tagName + '.' + String(e.className).split(' ')[0]);
          e.style.display = alt;
        }
        return treffer;
      });
      throw new Error(`${name}: wandert um ${mass.gescrollt} px zur Seite — Ursache: ${schuld.join(', ') || 'unklar'}`);
    }
    if (mass.ueberhang > 0) throw new Error(`${name}: ${mass.ueberhang} px Überhang`);
    if (mass.blatt < breite * 0.6) throw new Error(`${name}: das Blatt ist nur ${mass.blatt} px breit`);
    befunde.push(`${name} ${mass.blatt} px Blatt`);
  }
  await seite.setViewportSize({ width: 1500, height: 950 });
  await seite.waitForTimeout(900);
  return befunde.join(', ');
});

await pruefe('Auch auf dem Telefon klappt jedes Menü sichtbar auf', async () => {
  await seite.setViewportSize({ width: 402, height: 874 });
  await seite.waitForTimeout(900);
  const geprueft = [];
  for (const i of [0, 4, 7]) {
    await seite.locator('#menueleiste .menue-knopf').nth(i).click();
    await seite.waitForTimeout(250);
    const lage = await seite.evaluate(() => {
      const liste = document.querySelector('.menue.ist-offen .menue-liste');
      if (!liste || liste.hidden) return null;
      const k = liste.getBoundingClientRect();
      const oben = document.elementFromPoint(k.x + 10, k.y + 10);
      return { links: Math.round(k.x), rechts: Math.round(k.right), traegt: !!oben?.closest('.menue-liste') };
    });
    if (!lage) throw new Error(`Menü ${i} bleibt zu`);
    if (!lage.traegt) throw new Error(`Menü ${i} ist verdeckt`);
    if (lage.links < 0 || lage.rechts > 402) throw new Error(`Menü ${i} ragt hinaus (${lage.links}…${lage.rechts})`);
    geprueft.push(`${i}: ${lage.links}…${lage.rechts}`);
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(150);
  }
  await seite.setViewportSize({ width: 1500, height: 950 });
  await seite.waitForTimeout(900);
  return geprueft.join(' · ');
});


console.log('\n== Gestaltung nach dem Handoff ==');

/* Das Handoff nennt Höhen, Breiten und Farben auf den Pixel und den Hexwert
   genau. Sie hier nachzumessen ist der einzige Weg, der nicht darauf
   hinausläuft, zwei Bildschirmabzüge nebeneinanderzuhalten. */
const HANDOFF = {
  kopf: 38, menue: 27, werkzeuge: 46, fuss: 30,
  links: 196, rechts: 296,
  chrome900: 'rgb(29, 35, 39)',
  menueGrund: 'rgb(231, 233, 235)',
  werkzeugGrund: 'rgb(244, 245, 246)',
  buehne: 'rgb(95, 104, 110)',
  fussGrund: 'rgb(51, 59, 64)',
  papier: 'rgb(253, 252, 249)',
  akzent: 'rgb(15, 118, 110)',
};

await pruefe('Die Höhen der Chrome stimmen auf den Pixel', async () => {
  await ladeBeispiel();
  const masse = await seite.evaluate(() => {
    const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
    const b = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
    return { kopf: h('.kopf'), menue: h('.menueleiste'), werkzeuge: h('.werkzeugzeile'),
      fuss: h('.fuss'), links: b('.leiste-links'), rechts: b('.leiste-rechts') };
  });
  for (const [name, soll] of Object.entries(HANDOFF)) {
    if (typeof soll !== 'number') continue;
    if (masse[name] !== soll) throw new Error(`${name}: ${masse[name]} statt ${soll}`);
  }
  return Object.entries(masse).map(([k, v]) => `${k} ${v}`).join(' · ');
});

await pruefe('Die Farben sind die aus dem Handoff', async () => {
  const farben = await seite.evaluate(() => {
    const f = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
    return { kopf: f('.kopf'), menue: f('.menueleiste'), werkzeuge: f('.werkzeugzeile'),
      buehne: f('#buehne'), fuss: f('.fuss'), blatt: f('.blatt') };
  });
  const soll = {
    kopf: HANDOFF.chrome900, menue: HANDOFF.menueGrund, werkzeuge: HANDOFF.werkzeugGrund,
    buehne: HANDOFF.buehne, fuss: HANDOFF.fussGrund, blatt: HANDOFF.papier,
  };
  for (const [name, wert] of Object.entries(soll)) {
    if (farben[name] !== wert) throw new Error(`${name}: ${farben[name]} statt ${wert}`);
  }
  return `Chrome ${farben.kopf} · Bühne ${farben.buehne} · Papier ${farben.blatt}`;
});

await pruefe('Der Primärknopf in der Titelleiste ist akzentfarben', async () => {
  /* Er war einmal weiß: `.knopf-voll` stand oberhalb von `.knopf` und wurde
     von dessen Grundwerten überschrieben. Gleiche Spezifität, spätere Regel
     gewinnt — im Bildschirmabzug sofort zu sehen, im Quelltext nicht. */
  const stand = await seite.evaluate(() => {
    const voll = getComputedStyle(document.querySelector('#knopf-sichern'));
    const chrome = getComputedStyle(document.querySelector('#knopf-einstellungen'));
    return { voll: voll.backgroundColor, vollText: voll.color, chromeText: chrome.color };
  });
  if (stand.voll !== HANDOFF.akzent) throw new Error(`Sichern ist ${stand.voll}`);
  if (stand.vollText !== 'rgb(255, 255, 255)') throw new Error(`Schrift ist ${stand.vollText}`);
  if (stand.chromeText !== 'rgb(255, 255, 255)') throw new Error(`Einstellungen ist ${stand.chromeText}`);
  return `Sichern ${stand.voll}`;
});

await pruefe('Jeder Knopf der Werkzeugzeile trägt ein Wort', async () => {
  /* Das Handoff zeigt neun beschriftete Knöpfe. Ein Sinnbild ohne Wort ist
     die stille Annahme, jeder wisse schon, was es bedeutet.

     Ausgenommen sind Rückgängig und Wiederholen (`.werkzeug-schmal`): sie
     stehen gar nicht im Handoff, sondern sind eine Zutat — und die beiden
     Pfeile sind die zwei Zeichen, bei denen die Annahme wirklich trägt. */
  const stand = await seite.evaluate(() => {
    const knoepfe = [...document.querySelectorAll('.werkzeugzeile .werkzeug:not(.werkzeug-schmal)')];
    return {
      ohneWort: knoepfe.filter((k) => !k.querySelector('span')?.textContent.trim())
        .map((k) => k.getAttribute('aria-label') || k.title),
      hoehen: [...new Set(knoepfe.map((k) => Math.round(k.getBoundingClientRect().height)))],
      worte: knoepfe.map((k) => k.querySelector('span')?.textContent.trim()).filter(Boolean),
      trenner: document.querySelectorAll('.werkzeugzeile .werkzeug-trenner').length,
    };
  });
  if (stand.ohneWort.length) throw new Error(`ohne Wort: ${stand.ohneWort.join(', ')}`);
  if (stand.hoehen.some((h) => h !== 34)) throw new Error(`Höhen ${stand.hoehen.join('/')} statt 34`);
  if (stand.trenner < 4) throw new Error(`nur ${stand.trenner} Gruppentrenner`);
  return `${stand.worte.length} Knöpfe: ${stand.worte.join(' · ')}`;
});

await pruefe('Alles ist kantig — Radius 0 mit den vier Ausnahmen', async () => {
  /* Handoff: „Radien: 0 (alles kantig)", Ausnahmen Umschalt-Pille 10 px,
     Avatare 50 %, Kommentar-Nadel und aktive Werkzeugknöpfe 2 px. */
  const rund = await seite.evaluate(() => {
    const erlaubt = ['.pille', '.pille i', '.punkt', '.notiz-marke', '.lader-balken', '.lader-balken i'];
    return [...document.querySelectorAll('#huelle *')]
      .filter((k) => !erlaubt.some((s) => k.matches(s)))
      .map((k) => ({ k, r: getComputedStyle(k).borderRadius }))
      .filter(({ r }) => r && r !== '0px' && !/^[0-2]px$/.test(r))
      .map(({ k, r }) => `${k.className || k.tagName}:${r}`)
      .slice(0, 6);
  });
  if (rund.length) throw new Error(rund.join(', '));
  return 'kein runder Rahmen im Fenster';
});

await pruefe('Der Dialog hat den dunklen Kopf aus dem Handoff', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('einstellungen'));
  await seite.waitForTimeout(400);
  const stand = await seite.evaluate(() => {
    const kopf = document.querySelector('.dialog-kopf');
    const dialog = document.querySelector('.dialog');
    return {
      grund: getComputedStyle(kopf).backgroundColor,
      hoehe: Math.round(kopf.getBoundingClientRect().height),
      titelSchrift: getComputedStyle(kopf.querySelector('h2')).fontFamily,
      radius: getComputedStyle(dialog).borderRadius,
      hinweis: document.querySelector('.dialog-fuss-hinweis')?.textContent || '',
      fassung: document.querySelector('.einst-fassung')?.textContent || '',
    };
  });
  if (stand.grund !== HANDOFF.chrome900) throw new Error(`Kopf ist ${stand.grund}`);
  if (stand.hoehe !== 42) throw new Error(`Kopf ist ${stand.hoehe} px statt 42`);
  if (!/Plex Serif/.test(stand.titelSchrift)) throw new Error(`Titel in ${stand.titelSchrift}`);
  if (stand.radius !== '0px') throw new Error(`Ecken ${stand.radius}`);
  if (!stand.hinweis) throw new Error('kein Hinweis im Fuß');
  if (!/FASSUNG/.test(stand.fassung)) throw new Error('keine Fassung unter den Kategorien');
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(200);
  return `${stand.hoehe} px, ${stand.grund}, Fuß: „${stand.hinweis}"`;
});

await pruefe('Die Seitenliste ist einspaltig, mit Zahl und Kurztitel', async () => {
  const stand = await seite.evaluate(() => {
    const erste = document.querySelector('.miniatur');
    const zweite = document.querySelectorAll('.miniatur')[1];
    return {
      untereinander: zweite.getBoundingClientRect().top > erste.getBoundingClientRect().bottom - 2,
      karte: Math.round(erste.querySelector('.miniatur-karte').getBoundingClientRect().height),
      nummer: erste.querySelector('.miniatur-nummer')?.textContent,
      titel: erste.querySelector('.miniatur-titel')?.textContent || '',
      titelSchrift: getComputedStyle(erste.querySelector('.miniatur-nummer')).fontFamily,
    };
  });
  if (!stand.untereinander) throw new Error('die Miniaturen stehen nebeneinander');
  if (stand.karte !== 112) throw new Error(`Karte ${stand.karte} px statt 112`);
  if (stand.nummer !== '1') throw new Error(`Nummer „${stand.nummer}"`);
  if (stand.titel.length < 4) throw new Error(`kein Kurztitel: „${stand.titel}"`);
  if (!/Plex Mono/.test(stand.titelSchrift)) throw new Error(`Zahl in ${stand.titelSchrift}`);
  return `112 px, „${stand.nummer} ${stand.titel}"`;
});

await pruefe('Die drei Ansichten stehen als Gruppe in der Zeile', async () => {
  const knoepfe = await seite.evaluate(() =>
    [...document.querySelectorAll('.werkzeugzeile .werkzeug span')].map((s) => s.textContent.trim()));
  for (const wort of ['Seiten', 'Vergleichen', 'Dokument']) {
    if (!knoepfe.includes(wort)) throw new Error(`„${wort}" fehlt`);
  }
  /* Und der Knopf „Seiten" öffnet den Seitenordner. */
  const offen = await seite.evaluate(async () => {
    [...document.querySelectorAll('.werkzeugzeile .werkzeug')]
      .find((k) => k.textContent.trim() === 'Seiten').click();
    await new Promise((l) => setTimeout(l, 400));
    const auf = !document.querySelector('#ordnen').hidden;
    [...document.querySelectorAll('.werkzeugzeile .werkzeug')]
      .find((k) => k.textContent.trim() === 'Dokument').click();
    await new Promise((l) => setTimeout(l, 300));
    return { auf, wiederZu: document.querySelector('#ordnen').hidden };
  });
  if (!offen.auf) throw new Error('„Seiten" öffnet den Ordner nicht');
  if (!offen.wiederZu) throw new Error('„Dokument" schließt ihn nicht');
  return knoepfe.join(' · ');
});

await pruefe('„Mehr" führt zu den übrigen Werkzeugen', async () => {
  const stand = await seite.evaluate(async () => {
    [...document.querySelectorAll('.werkzeugzeile .werkzeug')]
      .find((k) => /Mehr|messen|Freihand|Stempel/.test(k.textContent)).click();
    await new Promise((l) => setTimeout(l, 250));
    const liste = document.querySelector('#weitere-werkzeuge');
    const namen = [...(liste?.querySelectorAll('.menue-name') || [])].map((k) => k.textContent);
    const kasten = liste?.getBoundingClientRect();
    return { namen, sichtbar: !!kasten && kasten.width > 40 && kasten.right <= window.innerWidth + 1 };
  });
  if (!stand.sichtbar) throw new Error('die Liste klappt nicht sichtbar auf');
  for (const wort of ['Freihand', 'Stempel', 'Strecke messen']) {
    if (!stand.namen.includes(wort)) throw new Error(`„${wort}" fehlt in der Liste`);
  }
  await seite.keyboard.press('Escape');
  await seite.mouse.click(700, 500);
  await seite.waitForTimeout(200);
  return `${stand.namen.length} weitere Werkzeuge`;
});


console.log('\n== Messen und Einlesen ==');

await pruefe('Eine Strecke messen zeigt die Länge auf der Seite', async () => {
  await ladeBeispiel();
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:messen'));
  const b = await blatt();
  const s1 = b.bei(0.2, 0.45), s2 = b.bei(0.7, 0.45);
  await seite.mouse.move(s1.x, s1.y);
  await seite.mouse.down();
  await seite.mouse.move(s2.x, s2.y, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(400);
  const marke = await seite.evaluate(() => document.querySelector('.messmarke')?.textContent || '');
  if (!/mm$/.test(marke)) throw new Error(`keine Maßzahl: „${marke}"`);
  const anzahl = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.filter((a) => a.art === 'messen').length);
  if (anzahl !== 1) throw new Error(`${anzahl} Messungen statt einer`);
  return marke;
});

await pruefe('Kalibrieren rechnet alle Messungen neu', async () => {
  /* Der Punkt der Kalibrierung: sie wirkt rückwirkend. Wer den Maßstab erst
     nach dem Messen setzt, will nicht noch einmal messen. */
  const vorher = await seite.evaluate(() => document.querySelector('.messmarke')?.textContent || '');
  const nachher = await seite.evaluate(async () => {
    const m = await import('./app/messen.js');
    const { melde, zustand } = await import('./app/kern.js');
    const strecke = zustand.anmerkungen.find((a) => a.art === 'messen');
    m.kalibriere(m.laengeInPunkten(strecke), 12, 'm');
    melde('anmerkungen:geaendert');
    await new Promise((l) => setTimeout(l, 400));
    return document.querySelector('.messmarke')?.textContent || '';
  });
  if (!/12 m$/.test(nachher)) throw new Error(`steht „${nachher}" statt 12 m`);
  if (vorher === nachher) throw new Error('die Marke hat sich nicht geändert');
  return `${vorher} → ${nachher}`;
});

await pruefe('Die Fläche misst in derselben Einheit', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:flaeche'));
  const b = await blatt();
  const f1 = b.bei(0.25, 0.28), f2 = b.bei(0.6, 0.4);
  await seite.mouse.move(f1.x, f1.y);
  await seite.mouse.down();
  await seite.mouse.move(f2.x, f2.y, { steps: 8 });
  await seite.mouse.up();
  await seite.waitForTimeout(400);
  const marken = await seite.evaluate(() => [...document.querySelectorAll('.messmarke')].map((k) => k.textContent));
  const flaeche = marken.find((t) => /m²/.test(t));
  if (!flaeche) throw new Error(`keine Flächenangabe unter ${marken.join(' | ')}`);
  return flaeche;
});

await pruefe('Der Messungs-Dialog listet beides mit Summen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('messen:liste'));
  await seite.waitForTimeout(300);
  const text = await seite.evaluate(() => document.querySelector('#schirm .dialog')?.textContent || '');
  if (!/Strecke/.test(text) || !/Fläche/.test(text)) throw new Error('Liste unvollständig');
  if (!/Summen/.test(text)) throw new Error('keine Summen');
  if (!/1:/.test(text)) throw new Error('kein Maßstab genannt');
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(200);
  return text.replace(/\s+/g, ' ').slice(0, 80);
});

await pruefe('Eine Word-Datei wird geöffnet, nicht abgewiesen', async () => {
  /* Der Weg, den ein Mensch geht: Datei fallen lassen. Früher kam dann
     „Keine PDF-Datei dabei" — die Umwandlung war da, aber unerreichbar. */
  await ladeBeispiel();
  const stand = await seite.evaluate(async () => {
    const { alsWord } = await import('./app/word.js');
    const { bytes } = await alsWord({});
    const datei = new File([bytes], 'vertrag.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const traeger = new DataTransfer();
    traeger.items.add(datei);
    window.dispatchEvent(new DragEvent('drop', { dataTransfer: traeger, bubbles: true, cancelable: true }));
    /* Setzen und Öffnen brauchen einen Augenblick. */
    for (let i = 0; i < 60; i++) {
      await new Promise((l) => setTimeout(l, 250));
      if (window.werkbank.zustand.name.endsWith('.pdf') && window.werkbank.zustand.name.startsWith('vertrag')) break;
    }
    return { name: window.werkbank.zustand.name, seiten: window.werkbank.zustand.folge.length };
  });
  if (!/^vertrag\.pdf$/.test(stand.name)) throw new Error(`heißt „${stand.name}"`);
  if (stand.seiten < 3) throw new Error(`nur ${stand.seiten} Seiten`);
  return `${stand.name}, ${stand.seiten} Seiten`;
});

await pruefe('Der Stapel-Dialog fragt nur, was die Schritte brauchen', async () => {
  await seite.evaluate(() => window.werkbank.fuehreAus('stapel'));
  await seite.waitForTimeout(400);
  const zuerst = await seite.evaluate(() =>
    [...document.querySelectorAll('#schirm .zeile')].filter((z) => !z.hidden).length);
  /* „Mit Kennwort schützen" anklicken — erst dann darf nach einem gefragt werden. */
  const nachher = await seite.evaluate(async () => {
    const kaesten = [...document.querySelectorAll('.stapel-schritt input')];
    kaesten[kaesten.length - 1].click();
    await new Promise((l) => setTimeout(l, 200));
    return [...document.querySelectorAll('#schirm .zeile')]
      .filter((z) => !z.hidden).map((z) => z.querySelector('label')?.textContent).join(', ');
  });
  if (!/Neues Kennwort/.test(nachher)) throw new Error(`fragt nicht nach dem Kennwort: ${nachher}`);
  await seite.keyboard.press('Escape');
  await seite.waitForTimeout(200);
  return `vorher ${zuerst} Zeilen, danach: ${nachher}`;
});


console.log('\n== Jeder Befehl, einmal ausgelöst ==');

await pruefe('Alle Befehle laufen ohne Fehler durch', async () => {
  /* Die gründlichste Antwort auf „funktioniert jeder Knopf?": jeden Befehl
     einmal auslösen und nachsehen, ob er wirft oder einen Konsolenfehler
     hinterlässt. Geprüft wird nicht, *was* er tut — das steht in den
     Abschnitten darüber —, sondern dass keiner ins Leere greift. Ein Befehl,
     der nach einer Änderung an einem anderen Modul stillschweigend kaputtgeht,
     fällt hier auf. */
  await ladeBeispiel();

  /* Dateiwahl und Druckfenster wegräumen, sonst blockiert der Lauf. */
  const wegDamit = (w) => w.setFiles([]).catch(() => {});
  const zumachen = (f) => f.close().catch(() => {});
  seite.on('filechooser', wegDamit);
  seite.on('popup', zumachen);
  const vorher = fehlerStrom.length;

  const alle = await seite.evaluate(async () => {
    const { befehle } = await import('./app/oberflaeche.js');
    return befehle.map((b) => b.id);
  });

  const geworfen = [];
  for (const id of alle) {
    const wurf = await seite.evaluate(async (i) => {
      try { window.werkbank.fuehreAus(i); } catch (f) { return String(f.message || f); }
      await new Promise((l) => setTimeout(l, 220));
      /* Aufräumen, damit der nächste Befehl freie Bahn hat. */
      document.querySelector('#weitere-werkzeuge')?.remove();
      (await import('./app/kern.js')).schliesseDialog();
      (await import('./app/ordnen.js')).schliesseOrdnen();
      (await import('./app/vergleich.js')).schliesseVergleich();
      return null;
    }, id);
    if (wurf) geworfen.push(`${id}: ${wurf}`);
  }

  seite.off('filechooser', wegDamit);
  seite.off('popup', zumachen);

  if (geworfen.length) throw new Error(geworfen.join(' | '));
  const neueFehler = fehlerStrom.length - vorher;
  if (neueFehler > 0) throw new Error(`${neueFehler} Konsolenfehler beim Durchlauf`);
  return `${alle.length} Befehle, keiner wirft, kein Konsolenfehler`;
});


console.log('\n== Die Knöpfe in den neuen Dialogen ==');

/* Einen Dialog zu öffnen ist die halbe Prüfung. Die andere Hälfte: tut der
   Knopf darin, was daraufsteht? Diese vier Fälle gehen jeden neuen Dialog
   bis zum Ergebnis durch. */

await pruefe('Stapel: der Lauf gibt ein Archiv mit Bericht heraus', async () => {
  await ladeBeispiel();
  await seite.evaluate(() => window.werkbank.fuehreAus('stapel'));
  await seite.waitForTimeout(400);

  /* Zwei echte PDF in die Dateiwahl des Dialogs legen — dieselben Bytes, die
     beim Sichern entstünden. */
  await seite.evaluate(async () => {
    const { baueDokument } = await import('./app/ausgabe.js');
    const bytes = await baueDokument({});
    const feld = document.querySelector('#schirm input[type="file"]');
    const traeger = new DataTransfer();
    traeger.items.add(new File([bytes], 'eins.pdf', { type: 'application/pdf' }));
    traeger.items.add(new File([bytes.slice(0)], 'zwei.pdf', { type: 'application/pdf' }));
    feld.files = traeger.files;
    feld.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await seite.waitForTimeout(300);
  const stand = await seite.evaluate(() =>
    [...document.querySelectorAll('#schirm .hinweis')].map((k) => k.textContent).join(' | '));
  if (!/2 Dateien gewählt/.test(stand)) throw new Error(`Dateien nicht angekommen: ${stand}`);

  /* „Metadaten entfernen" ankreuzen und starten. */
  const [ladung] = await Promise.all([
    seite.waitForEvent('download', { timeout: 60000 }),
    seite.evaluate(() => {
      const kaesten = [...document.querySelectorAll('.stapel-schritt input')];
      kaesten[1].click();   // Reparieren — braucht keine Zusatzangabe
      [...document.querySelectorAll('#schirm .dialog-fuss .knopf')]
        .find((k) => k.textContent === 'Stapel starten').click();
    }),
  ]);
  const name = ladung.suggestedFilename();
  const pfad = join(ablage, `stapel-${name}`);
  await ladung.saveAs(pfad);
  const archiv = await readFile(pfad);
  if (!(archiv[0] === 0x50 && archiv[1] === 0x4b)) throw new Error('kein ZIP');
  const { unzipRoh } = await import('./zip-lesen.mjs');
  const inhalt = unzipRoh(archiv);
  if (!inhalt.has('eins.pdf') || !inhalt.has('zwei.pdf')) {
    throw new Error(`Archiv enthält ${[...inhalt.keys()].join(', ')}`);
  }
  if (!/gelungen: 2/.test(inhalt.get('bericht.txt') || '')) throw new Error('Bericht zählt falsch');
  return `${name}, ${inhalt.size} Einträge, Bericht stimmt`;
});

await pruefe('Maßstab: „Maßstab setzen" rechnet, „zurücksetzen" nimmt zurück', async () => {
  await ladeBeispiel();
  await seite.evaluate(async () => {
    const { fuegeAn } = await import('./app/anmerkungen.js');
    const { zustand } = await import('./app/kern.js');
    /* Eine Strecke von genau 200 Punkten. */
    fuegeAn({ art: 'messen', seiteId: zustand.folge[0].id, x: 60, y: 400, x2: 260, y2: 400,
      farbe: '#1B6AC9', staerke: 1.5 });
  });
  await seite.waitForTimeout(300);

  const gesetzt = await seite.evaluate(async () => {
    window.werkbank.fuehreAus('messen:massstab');
    await new Promise((l) => setTimeout(l, 300));
    const felder = [...document.querySelectorAll('#schirm .zeile')];
    const laenge = felder.find((z) => /wirklich/.test(z.textContent))?.querySelector('input');
    const einheit = felder.find((z) => /Einheit/.test(z.textContent))?.querySelector('select');
    if (!laenge || !einheit) return { fehler: 'Felder fehlen' };
    laenge.value = '8';
    einheit.value = 'm';
    [...document.querySelectorAll('#schirm .dialog-fuss .knopf')]
      .find((k) => k.textContent === 'Maßstab setzen').click();
    await new Promise((l) => setTimeout(l, 400));
    return { marke: document.querySelector('.messmarke')?.textContent,
      meldung: [...document.querySelectorAll('.meldung')].map((k) => k.textContent).join(' ') };
  });
  if (gesetzt.fehler) throw new Error(gesetzt.fehler);
  if (gesetzt.marke !== '8 m') throw new Error(`steht „${gesetzt.marke}" statt 8 m`);
  if (!/1:/.test(gesetzt.meldung)) throw new Error(`keine Meldung mit Maßstab: ${gesetzt.meldung}`);

  const zurueck = await seite.evaluate(async () => {
    window.werkbank.fuehreAus('messen:massstab');
    await new Promise((l) => setTimeout(l, 300));
    [...document.querySelectorAll('#schirm .dialog-fuss .knopf')]
      .find((k) => /Papiermaß/.test(k.textContent)).click();
    await new Promise((l) => setTimeout(l, 400));
    return document.querySelector('.messmarke')?.textContent;
  });
  /* 200 pt sind 70,6 mm. */
  if (!/^70,6 mm$/.test(zurueck || '')) throw new Error(`nach dem Zurücksetzen „${zurueck}"`);
  return `8 m → zurückgesetzt auf ${zurueck}`;
});

await pruefe('Messungen: eine Zeile anklicken springt zur Messung', async () => {
  /* Eine zweite Messung auf Seite 3, damit das Springen etwas zu tun hat. */
  await seite.evaluate(async () => {
    const { fuegeAn } = await import('./app/anmerkungen.js');
    const { zustand } = await import('./app/kern.js');
    fuegeAn({ art: 'flaeche', seiteId: zustand.folge[2].id, x: 80, y: 300, x2: 280, y2: 400,
      farbe: '#1B6AC9', staerke: 1.5 });
    window.werkbank.fuehreAus('gehezu:erste');
    await new Promise((l) => setTimeout(l, 500));
  });
  const stand = await seite.evaluate(async () => {
    window.werkbank.fuehreAus('messen:liste');
    await new Promise((l) => setTimeout(l, 350));
    const zeilen = [...document.querySelectorAll('#schirm .liste-tafel tbody tr')];
    const anzahl = zeilen.length;
    const summen = document.querySelector('#schirm .dialog-rumpf').textContent;
    zeilen.find((z) => /Fläche/.test(z.textContent)).click();
    await new Promise((l) => setTimeout(l, 900));
    return { anzahl, summen,
      seite: window.werkbank.zustand.aktuelleSeite,
      gewaehlt: window.werkbank.zustand.gewaehlteAnmerkung,
      dialogZu: !document.querySelector('#schirm .dialog') };
  });
  if (stand.anzahl !== 2) throw new Error(`${stand.anzahl} Zeilen statt zwei`);
  if (!/Summen/.test(stand.summen)) throw new Error('keine Summen');
  if (!stand.dialogZu) throw new Error('der Dialog bleibt offen');
  if (stand.seite !== 3) throw new Error(`springt auf Seite ${stand.seite} statt 3`);
  if (!stand.gewaehlt) throw new Error('die Messung wird nicht ausgewählt');
  return `zwei Zeilen, Sprung auf Seite ${stand.seite}`;
});

await pruefe('Einlesen: aus dem Dialog heraus entsteht ein Dokument', async () => {
  await ladeBeispiel();
  const stand = await seite.evaluate(async () => {
    window.werkbank.fuehreAus('einlesen');
    await new Promise((l) => setTimeout(l, 300));
    const knopf = [...document.querySelectorAll('#schirm .dialog-fuss .knopf')]
      .find((k) => /Datei wählen/.test(k.textContent));
    if (!knopf) return { fehler: 'kein Knopf „Datei wählen"' };

    /* Statt die Dateiwahl zu öffnen (die kein Prüflauf bedienen kann), wird
       die Datei direkt in dasselbe Feld gelegt, das der Knopf anstößt. */
    const { alsWord } = await import('./app/word.js');
    const { bytes } = await alsWord({});
    const feld = document.querySelector('#dateiwahl-einlesen');
    const traeger = new DataTransfer();
    traeger.items.add(new File([bytes], 'aus-dem-dialog.docx',
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    feld.files = traeger.files;
    feld.dispatchEvent(new Event('change', { bubbles: true }));

    for (let i = 0; i < 80; i++) {
      await new Promise((l) => setTimeout(l, 250));
      if (window.werkbank.zustand.name === 'aus-dem-dialog.pdf') break;
    }
    return { name: window.werkbank.zustand.name, seiten: window.werkbank.zustand.folge.length,
      reiter: document.querySelectorAll('.dok-reiter').length };
  });
  if (stand.fehler) throw new Error(stand.fehler);
  if (stand.name !== 'aus-dem-dialog.pdf') throw new Error(`heißt „${stand.name}"`);
  if (stand.seiten < 3) throw new Error(`nur ${stand.seiten} Seiten`);
  if (stand.reiter < 2) throw new Error('kein eigener Reiter');
  return `${stand.name}, ${stand.seiten} Seiten, ${stand.reiter} Reiter`;
});


console.log('\n== Anmeldeschranke ==');

await pruefe('Ohne Auskunft läuft die Werkbank ohne Anmeldung', async () => {
  /* Der wichtigste Fall: eine Werkbank auf einem eigenen Server, ohne
     Mitgliederverwaltung. Sie muss vollständig starten — Leitprinzip 2. */
  await ladeBeispiel();
  const schranke = await seite.evaluate(() => !!document.querySelector('#anmeldeschranke'));
  if (schranke) throw new Error('es liegt eine Schranke davor, obwohl niemand danach gefragt hat');
  const meta = await seite.evaluate(() => document.querySelector('meta[name="werkbank-anmeldung"]'));
  if (meta) throw new Error('die Quellfassung trägt die Schranken-Zeile — sie gehört erst in die Arbeitskopie');
  return 'keine Schranke, kein Meta';
});

await pruefe('Sagt die Auskunft „nicht angemeldet", legt sich die Schranke davor', async () => {
  const lage = await seite.evaluate(async () => {
    const m = await import('./app/anmeldung.js');
    /* Die Auskunft wird hier vorgetäuscht, statt einen zweiten Server zu
       starten: geprüft wird das Verhalten der Werkbank, nicht das von fetch. */
    const echt = window.fetch;
    window.fetch = async () => new Response(JSON.stringify({ angemeldet: false }),
      { status: 200, headers: { 'content-type': 'application/json' } });
    const kopf = document.createElement('meta');
    kopf.name = 'werkbank-anmeldung';
    kopf.content = '/api/mitglied.json';
    document.head.append(kopf);

    const antwort = await m.frageAnmeldung();
    if (antwort.noetig && !antwort.angemeldet) m.zeigeSchranke();

    const schirm = document.querySelector('#anmeldeschranke');
    const ergebnis = {
      antwort,
      da: !!schirm,
      text: schirm?.textContent?.replace(/\s+/g, ' ').slice(0, 60),
      ziel: schirm?.querySelector('a')?.getAttribute('href'),
      deckt: schirm ? Math.round(schirm.getBoundingClientRect().width) : 0,
    };
    m.entferneSchranke();
    kopf.remove();
    window.fetch = echt;
    return ergebnis;
  });
  if (!lage.antwort.noetig) throw new Error('die Auskunft wurde nicht gelesen');
  if (!lage.da) throw new Error('keine Schranke');
  if (!/\/api\/auth\/login/.test(lage.ziel || '')) throw new Error(`Ziel des Knopfes: ${lage.ziel}`);
  if (!/returnToUrl/.test(lage.ziel || '')) throw new Error('der Weg zurück fehlt');
  if (lage.deckt < 400) throw new Error(`die Schranke ist nur ${lage.deckt} px breit`);
  return `${lage.text}… → ${lage.ziel.slice(0, 40)}`;
});

await pruefe('Antwortet die Auskunft nicht, läuft die Werkbank trotzdem', async () => {
  /* Eine Anwendung, die den Dienst verweigert, weil ein Server schweigt, wäre
     das Gegenteil dessen, wofür sie gebaut ist. */
  const antwort = await seite.evaluate(async () => {
    const m = await import('./app/anmeldung.js');
    const echt = window.fetch;
    window.fetch = async () => { throw new Error('kein Netz'); };
    const kopf = document.createElement('meta');
    kopf.name = 'werkbank-anmeldung';
    kopf.content = '/api/mitglied.json';
    document.head.append(kopf);
    const ergebnis = await m.frageAnmeldung();
    kopf.remove();
    window.fetch = echt;
    return ergebnis;
  });
  if (antwort.noetig) throw new Error('sie besteht auf einer Anmeldung, die niemand beantworten kann');
  return 'fällt auf „läuft" zurück';
});

await pruefe('Angemeldet heißt: keine Schranke', async () => {
  const antwort = await seite.evaluate(async () => {
    const m = await import('./app/anmeldung.js');
    const echt = window.fetch;
    window.fetch = async () => new Response(JSON.stringify({ angemeldet: true, name: 'Ada Musterfrau' }),
      { status: 200, headers: { 'content-type': 'application/json' } });
    const kopf = document.createElement('meta');
    kopf.name = 'werkbank-anmeldung';
    kopf.content = '/api/mitglied.json';
    document.head.append(kopf);
    const ergebnis = await m.frageAnmeldung();
    kopf.remove();
    window.fetch = echt;
    return ergebnis;
  });
  if (!antwort.noetig || !antwort.angemeldet) throw new Error(JSON.stringify(antwort));
  if (antwort.name !== 'Ada Musterfrau') throw new Error(`Name: ${antwort.name}`);
  if (await seite.evaluate(() => !!document.querySelector('#anmeldeschranke'))) throw new Error('trotzdem eine Schranke');
  return `angemeldet als ${antwort.name}`;
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
