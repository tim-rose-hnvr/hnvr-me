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
  pruefe(grund.felder === 10, 'zehn Formularfelder erkannt (Text, mehrzeilig, Kasten, Auswahl, zwei Optionen, Unterschrift)', `waren ${grund.felder}`);

  console.log('\nLesezeichen');
  await seite.evaluate(() => window.werkbank.fuehreAus('leiste:seiten'));
  await seite.evaluate(() => document.querySelector('[data-tafel="gliederung"].reiter-knopf').click());
  await seite.waitForTimeout(500);
  const lesezeichen = await seite.evaluate(() => [...document.querySelectorAll('#tafel-gliederung .eintrag')].map((k) => k.textContent));
  pruefe(lesezeichen.length === 4, 'vier Lesezeichen in der Gliederung', lesezeichen.join(' | '));
  await seite.evaluate(() => [...document.querySelectorAll('#tafel-gliederung .eintrag')][1].click());
  await seite.waitForTimeout(1400);
  pruefe(await seite.evaluate(() => window.werkbank.zustand.aktuelleSeite) === 2, 'Lesezeichen springt auf die richtige Seite');
  await seite.evaluate(() => document.querySelector('[data-tafel="miniaturen"].reiter-knopf').click());
  await seite.evaluate(() => window.werkbank.fuehreAus('gehezu:erste'));
  await seite.waitForTimeout(1400);

  console.log('\nMitdenken');
  const vorschlaege = await seite.evaluate(() => [...document.querySelectorAll('.vorschlag b')].map((k) => k.textContent));
  pruefe(vorschlaege.some((v) => /Formular/.test(v)), 'offene Formularfelder werden gemeldet');
  pruefe(vorschlaege.some((v) => /personenbezogene/.test(v)), 'personenbezogene Angaben werden gefunden');
  pruefe(vorschlaege.some((v) => /Unterschriftsstelle/.test(v)), 'Unterschriftsstelle wird gefunden');

  console.log('\nAnmerkungen aus Textauswahl');
  const stelle = await seite.evaluate(() => {
    const span = [...document.querySelectorAll('.textebene span')].find((s) => s.textContent.includes('Bankverbindung'));
    if (!span) return null;
    const r = span.getBoundingClientRect();
    return { x: r.left, y: r.top, b: r.width, h: r.height };
  });
  if (!stelle) throw new Error('Textstück „Bankverbindung" nicht gefunden — steht Seite 1 im Bild?');
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

  console.log('\nVerkleinern und Texterkennung');
  const scan = join(ablage, 'scan.pdf');
  const [scanLadung] = await Promise.all([
    seite.waitForEvent('download'),
    seite.evaluate(async () => {
      const { verkleinere } = await import('./app/ausgabe.js');
      const { sichereBytes } = await import('./app/kern.js');
      sichereBytes(await verkleinere({ dichte: 200, guete: 0.9 }), 'scan.pdf');
    }),
  ]);
  await scanLadung.saveAs(scan);

  await seite.setInputFiles('#dateiwahl', scan);
  await seite.waitForSelector('.blatt canvas');
  await seite.waitForTimeout(2000);
  const scanDok = await pdfjs.getDocument({ data: new Uint8Array(await readFile(scan)), standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/') }).promise;
  const scanText = (await (await scanDok.getPage(1)).getTextContent()).items.map((i) => i.str).join('');
  pruefe(scanText.trim() === '', 'verkleinerte Datei ist ein Bild ohne Textebene');
  pruefe((await seite.evaluate(() => [...document.querySelectorAll('.vorschlag b')].map((k) => k.textContent)))
    .some((v) => /Scan|ohne auswählbaren Text/.test(v)), 'der fehlende Text wird gemeldet');

  const erkennung = await seite.evaluate(async () => {
    const ocr = await import('./app/texterkennung.js');
    const z = window.werkbank.zustand;
    const ids = await ocr.erkenneSeiten({ seiten: z.folge.slice(0, 1), sprache: 'deu', dichte: 200 });
    const treffer = z.ocr.get(ids[0]);
    return { woerter: treffer.woerter.length, konfidenz: Math.round(treffer.konfidenz), text: treffer.zeilen.map((l) => l.text).join(' ') };
  });
  pruefe(erkennung.woerter > 50, `Texterkennung findet Wörter (${erkennung.woerter})`);
  pruefe(erkennung.konfidenz > 80, `Erkennung ist sicher (${erkennung.konfidenz} %)`);
  pruefe(/Sitzungstechnik/.test(erkennung.text), 'erkannter Text stimmt inhaltlich');

  await seite.waitForTimeout(800);
  await seite.evaluate(() => window.werkbank.fuehreAus('suchen'));
  await seite.fill('#suchfeld', 'Konferenzanlage');
  await seite.waitForTimeout(1200);
  pruefe(/[1-9]/.test(await seite.textContent('#such-anzahl')), 'im Scan lässt sich nach der Erkennung suchen');

  const durchsuchbar = join(ablage, 'scan-durchsuchbar.pdf');
  const [ladungOcr] = await Promise.all([
    seite.waitForEvent('download'),
    seite.evaluate(() => window.werkbank.fuehreAus('sichern')),
  ]);
  await ladungOcr.saveAs(durchsuchbar);
  const ocrDok = await pdfjs.getDocument({ data: new Uint8Array(await readFile(durchsuchbar)), standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/') }).promise;
  const ocrText = (await (await ocrDok.getPage(1)).getTextContent()).items.map((i) => i.str).join(' ');
  pruefe(/Sitzungstechnik/.test(ocrText), 'gesicherter Scan trägt unsichtbaren, auslesbaren Text');

  console.log('\nKennwortschutz');
  const geschuetzt = join(ablage, 'geschuetzt.pdf');
  const [ladungSchutz] = await Promise.all([
    seite.waitForEvent('download'),
    seite.evaluate(async () => {
      const { baueDokument } = await import('./app/ausgabe.js');
      const { sichereBytes } = await import('./app/kern.js');
      const bytes = await baueDokument({ schutz: { benutzer: 'geheim', besitzer: 'chef', drucken: 'none' } });
      sichereBytes(bytes, 'geschuetzt.pdf');
    }),
  ]);
  await ladungSchutz.saveAs(geschuetzt);
  let verschlossen = false;
  try { await pdfjs.getDocument({ data: new Uint8Array(await readFile(geschuetzt)), standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/') }).promise; }
  catch (fehler) { verschlossen = fehler?.name === 'PasswordException'; }
  pruefe(verschlossen, 'geschützte Datei lässt sich ohne Kennwort nicht öffnen');
  const mitKennwort = await pdfjs.getDocument({ data: new Uint8Array(await readFile(geschuetzt)), password: 'geheim', standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/') }).promise;
  pruefe(mitKennwort.numPages === 5, 'mit Kennwort geht sie auf');

  console.log('\nText ersetzen');
  // Frisches Beispiel: in der geschwärzten Ausgabe ist Seite 1 ein Bild.
  await seite.setInputFiles('#dateiwahl', join(WURZEL, 'beispiel', 'beispiel.pdf'));
  await seite.waitForSelector('.blatt canvas');
  await seite.waitForTimeout(2000);
  await seite.evaluate(() => window.werkbank.fuehreAus('werkzeug:ersetzen'));
  await seite.waitForTimeout(300);
  const ersatzStelle = await seite.evaluate(() => {
    const span = [...document.querySelectorAll('.textebene span')].find((x) => x.textContent.includes('84.500'));
    if (!span) return null;
    const r = span.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (ersatzStelle) {
    await seite.mouse.click(ersatzStelle.x, ersatzStelle.y);
    await seite.waitForSelector('.dialog input.feld');
    await seite.fill('.dialog input.feld', 'Die Verguetung betraegt 79.900 EUR netto.');
    await seite.click('.dialog-fuss .knopf:last-child');
    await seite.waitForTimeout(500);
    pruefe(await seite.evaluate(() => window.werkbank.zustand.anmerkungen.some((a) => a.art === 'ersatz')),
      'Textstück lässt sich anklicken und ersetzen');
  } else {
    pruefe(false, 'Textstück zum Ersetzen gefunden');
  }

  console.log('\nZusammenführen');
  await seite.setInputFiles('#dateiwahl-anhang', scan);
  await seite.waitForTimeout(2500);
  const nachher = await seite.evaluate(() => ({ seiten: window.werkbank.zustand.folge.length, quellen: window.werkbank.zustand.quellen.size }));
  pruefe(nachher.seiten === 10 && nachher.quellen === 2, 'zweite Datei angehängt', JSON.stringify(nachher));

  console.log('\nFormularfelder aller Arten');
  await seite.setInputFiles('#dateiwahl', join(WURZEL, 'beispiel', 'beispiel.pdf'));
  await seite.waitForSelector('.blatt canvas');
  await seite.waitForTimeout(2000);
  await seite.fill('#feld-seite', '3');
  await seite.press('#feld-seite', 'Enter');
  await seite.waitForTimeout(2200);
  await seite.fill('[data-feld="bemerkungen"]', 'Zwei Zeilen\nzweite Zeile');
  await seite.check('input[type=radio][data-feld="abnahme"]');
  await seite.waitForTimeout(400);
  const felderWerte = await seite.evaluate(() => Object.fromEntries(window.werkbank.zustand.formularwerte));
  pruefe(/zweite Zeile/.test(felderWerte.bemerkungen || ''), 'mehrzeiliges Feld nimmt Zeilenumbrüche');
  pruefe(!!felderWerte.abnahme, 'Optionsfeld lässt sich setzen', JSON.stringify(felderWerte.abnahme));

  console.log('\nUnterschriftsfeld');
  await seite.click('[data-feld="unterschrift_abnahme"]');
  await seite.waitForSelector('.unterschrift-reiter', { timeout: 15000 });
  await seite.click('.unterschrift-reiter button:has-text("Tippen")');
  await seite.fill('.dialog input[placeholder="Vorname Nachname"]', 'Ada Musterfrau');
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(900);
  const gesetzt = await seite.evaluate(() => window.werkbank.zustand.anmerkungen.find((a) => a.art === 'unterschrift'));
  pruefe(!!gesetzt && Math.abs(gesetzt.x - 56) < 2 && gesetzt.b > 200,
    'Klick ins Unterschriftsfeld setzt die Unterschrift passend hinein',
    gesetzt ? `${Math.round(gesetzt.x)}/${Math.round(gesetzt.y)} ${Math.round(gesetzt.b)}×${Math.round(gesetzt.h)} pt` : 'nichts gesetzt');

  console.log('\nMitdenken: jede Regel einmal auslösen');
  const vorschlaegeJetzt = () => seite.evaluate(() => [...document.querySelectorAll('.vorschlag b')].map((k) => k.textContent));
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.gedaechtnis.abgelehnteVorschlaege.clear();
    z.eigenschaften.dateigroesse = 9 * 1024 * 1024;          // groß genug fürs Verkleinern
    z.gedaechtnis.benutzteWerkzeuge.set('hervor', 3);        // Kniff-Regel
    z.anmerkungen.push({ id: 'test-schwaerzung', art: 'schwaerzen', seiteId: z.folge[0].id, x: 0, y: 0, x2: 10, y2: 10 });
  });
  await seite.evaluate(() => window.werkbank.zustand.geaendert = true);
  await seite.evaluate(() => window.dispatchEvent(new Event('resize')));
  await seite.evaluate(async () => { const m = await import('./app/mitdenken.js'); await m.untersuche(); });
  await seite.waitForTimeout(1200);
  // Die Tafel zeigt nur die wichtigsten; geprüft wird die vollständige Liste.
  const regeln = await seite.evaluate(async () => {
    const m = await import('./app/mitdenken.js');
    return m.vorschlaege().map((v) => v.titel);
  });
  const angezeigt = await vorschlaegeJetzt();
  pruefe(angezeigt.length <= 6, 'die Tafel bleibt auf sechs Vorschläge begrenzt', `zeigt ${angezeigt.length}`);
  pruefe(regeln.length > angezeigt.length
    ? await seite.evaluate(() => [...document.querySelectorAll('#tafel-rechts button')].some((k) => /weitere zeigen/.test(k.textContent)))
    : true, 'verdeckte Vorschläge werden angeboten statt verschwiegen');
  for (const [name, muster] of [
    ['Formular', /Formular/],
    ['Unterschriftsstelle', /Unterschriftsstelle/],
    ['personenbezogene Angaben', /personenbezogene/],
    ['Schwärzung gesetzt', /Schwärzung/],
    ['Datei zu groß', /MB groß/],
    ['Metadaten', /Metadaten/],
    ['ungesicherte Änderungen', /Ungesicherte/],
  ]) pruefe(regeln.some((r) => muster.test(r)), `Vorschlag: ${name}`, regeln.join(' · ').slice(0, 90));
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    z.anmerkungen = z.anmerkungen.filter((a) => a.id !== 'test-schwaerzung');
  });

  console.log('\nWord-Ausgabe');
  const wordDatei = join(ablage, 'ausgabe.docx');
  const [wordLadung] = await Promise.all([
    seite.waitForEvent('download'),
    seite.evaluate(async () => {
      const { alsWord } = await import('./app/word.js');
      const { sichereBytes } = await import('./app/kern.js');
      const { bytes } = await alsWord({});
      sichereBytes(bytes, 'ausgabe.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }),
  ]);
  await wordLadung.saveAs(wordDatei);

  // .docx ist ein ZIP. Wir packen es hier von Hand aus — ohne fremde Hilfe.
  const { inflateRawSync } = await import('node:zlib');
  const rohDaten = await readFile(wordDatei);
  const teile = new Map();
  let leseStelle = 0;
  const signatur = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  while ((leseStelle = rohDaten.indexOf(signatur, leseStelle)) !== -1) {
    const verfahren = rohDaten.readUInt16LE(leseStelle + 8);
    const gepackt = rohDaten.readUInt32LE(leseStelle + 18);
    const nameLaenge = rohDaten.readUInt16LE(leseStelle + 26);
    const zusatz = rohDaten.readUInt16LE(leseStelle + 28);
    const name = rohDaten.subarray(leseStelle + 30, leseStelle + 30 + nameLaenge).toString();
    const beginn = leseStelle + 30 + nameLaenge + zusatz;
    const inhalt = rohDaten.subarray(beginn, beginn + gepackt);
    teile.set(name, verfahren === 8 ? inflateRawSync(inhalt) : inhalt);
    leseStelle = beginn + gepackt;
  }
  pruefe(teile.has('word/document.xml') && teile.has('[Content_Types].xml') && teile.has('word/styles.xml'),
    'die .docx enthält alle Pflichtteile', [...teile.keys()].join(', '));

  const dokumentXml = (teile.get('word/document.xml') || Buffer.alloc(0)).toString('utf8');
  const absaetze = (dokumentXml.match(/<w:p>/g) || []).length;
  pruefe(absaetze > 20, `Absätze im Word-Dokument (${absaetze})`);
  pruefe(/Ueberschrift1/.test(dokumentXml), 'Überschriften werden als Word-Formatvorlage gesetzt');
  pruefe(/<w:b\/>/.test(dokumentXml), 'fette Stellen bleiben fett');
  pruefe(/w:type="page"/.test(dokumentXml), 'Seitenumbrüche stehen drin');
  pruefe(dokumentXml.includes('Konferenzanlage') && dokumentXml.includes('Kamerapreset'),
    'Text der ersten und der letzten Seite ist enthalten');
  pruefe(!/[\x00-\x08]/.test(dokumentXml) && dokumentXml.includes('&amp;'),
    'Sonderzeichen sind sauber geschützt');

  console.log('\nStempel und Bilder');
  await seite.evaluate(() => {
    const z = window.werkbank.zustand;
    window.dispatchEvent(new Event('resize'));
    return import('./app/anmerkungen.js').then((m) => m.fuegeAn({
      art: 'stempel', seiteId: z.folge[0].id, x: 60, y: 700, b: 160, h: 34,
      text: 'Genehmigt', groesse: 13, farbe: '#0D5A4D',
    }));
  });
  await seite.waitForTimeout(600);
  pruefe(await seite.evaluate(() => !!document.querySelector('.stempel')), 'Stempel erscheint auf der Seite');

  const mitStempel = join(ablage, 'mit-stempel.pdf');
  const [stempelLadung] = await Promise.all([
    seite.waitForEvent('download'),
    seite.evaluate(() => window.werkbank.fuehreAus('sichern')),
  ]);
  await stempelLadung.saveAs(mitStempel);
  const stempelDok = await pdfjs.getDocument({ data: new Uint8Array(await readFile(mitStempel)), standardFontDataUrl: join(WURZEL, 'fremd', 'schriften/') }).promise;
  const stempelText = (await (await stempelDok.getPage(1)).getTextContent()).items.map((i) => i.str).join(' ');
  pruefe(/GENEHMIGT/.test(stempelText), 'Stempel steht in der gesicherten Datei');

  console.log('\nAnsicht und Zoom');
  await seite.selectOption('#feld-zoom', 'breite');
  await seite.waitForTimeout(800);
  await seite.keyboard.press('Control+Equal');
  await seite.waitForTimeout(800);
  const zoomLage = await seite.evaluate(() => ({
    zustand: String(window.werkbank.zustand.zoom),
    feld: document.querySelector('#feld-zoom').value,
  }));
  pruefe(zoomLage.zustand === zoomLage.feld, 'Zoomanzeige folgt dem tatsächlichen Zoom', JSON.stringify(zoomLage));

  await seite.evaluate(() => {
    // Vier Aufträge in Folge: keiner darf unter den Tisch fallen.
    window.werkbank.fuehreAus('ansicht:drehen');
    window.werkbank.fuehreAus('ansicht:drehen');
    window.werkbank.fuehreAus('ansicht:drehen');
    window.werkbank.fuehreAus('ansicht:drehen');
  });
  await seite.waitForTimeout(2500);
  const nachDrehung = await seite.evaluate(() => ({
    drehung: window.werkbank.zustand.ansichtDrehung,
    hochkant: document.querySelector('.blatt').getBoundingClientRect().height > document.querySelector('.blatt').getBoundingClientRect().width,
  }));
  pruefe(nachDrehung.drehung === 0 && nachDrehung.hochkant, 'vier Drehungen führen zurück zum Ausgangsbild', JSON.stringify(nachDrehung));

  console.log('\nHilfe');
  await seite.evaluate(() => window.werkbank.fuehreAus('hilfe'));
  await seite.waitForSelector('.dialog');
  const hilfe = await seite.textContent('.dialog-rumpf');
  await seite.evaluate(() => { const s = document.querySelector('#schirm'); s.hidden = true; s.innerHTML = ''; });
  pruefe(hilfe.includes('Strg+K') && hilfe.includes('Esc'), 'Hilfe listet auch Palette und Escape');

  console.log('\nGeschützte Datei öffnen');
  await seite.goto(basis);
  await seite.waitForTimeout(800);
  await seite.setInputFiles('#dateiwahl', geschuetzt);
  await seite.waitForSelector('.dialog input[type=password]', { timeout: 20000 });
  await seite.fill('.dialog input[type=password]', 'falsch');
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForTimeout(2000);
  const zweiterTitel = await seite.textContent('.dialog-kopf h2');
  pruefe(/stimmt nicht/.test(zweiterTitel), 'falsches Kennwort wird erkannt', zweiterTitel);
  await seite.fill('.dialog input[type=password]', 'geheim');
  await seite.click('.dialog-fuss .knopf:last-child');
  await seite.waitForSelector('.blatt canvas', { timeout: 25000 });
  await seite.waitForTimeout(2000);
  const entsperrt = await seite.evaluate(() => ({
    seiten: window.werkbank.zustand.folge.length,
    war: [...window.werkbank.zustand.quellen.values()].some((q) => q.warGeschuetzt),
    vorschlag: [...document.querySelectorAll('.vorschlag b')].some((k) => /kennwortgeschützt/i.test(k.textContent)),
  }));
  pruefe(entsperrt.seiten === 5 && entsperrt.war, 'mit richtigem Kennwort geht die Datei auf', JSON.stringify(entsperrt));
  pruefe(entsperrt.vorschlag, 'die Werkbank bietet an, den Schutz wiederherzustellen');

  console.log(`\nKonsolenfehler: ${fehler.length}`);
  pruefe(fehler.length === 0, 'kein Fehler in der Browserkonsole', fehler.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  server.close();
  await rm(ablage, { recursive: true, force: true });
}

console.log(`\n${bestanden} bestanden, ${gescheitert} gescheitert\n`);
process.exit(gescheitert ? 1 : 0);
