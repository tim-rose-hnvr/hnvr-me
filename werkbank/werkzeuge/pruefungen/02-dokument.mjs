/* Dokument — Seiten, Suche, Formulare, Ausgabewege, Unterschrift.

   Alles, was am Dokument selbst arbeitet: drehen, löschen, finden, ausfüllen,
   herausgeben, unterschreiben. */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function ({ pruefe, melde, seite, blatt, ladungVon, dialogSchliessen, HIER, WURZEL }) {
  /* --- Seiten --------------------------------------------------------------- */
  console.log('\n== Seiten ==');
  await pruefe('Alle Seiten wählen / keine', async () => {
    /* Über das Menü, nicht über Knöpfe in der Seitenleiste: die trägt seit dem
       Abgleich mit dem Mockup nur noch die Liste. */
    await seite.click('[data-tafel="miniaturen"].reiter-knopf');
    await seite.evaluate(() => window.werkbank.fuehreAus('seiten:alleWaehlen'));
    await seite.waitForTimeout(300);
    const alle = await seite.evaluate(() => window.werkbank.zustand.gewaehlteSeiten.size);
    await seite.evaluate(async () => {
      const { melde } = await import('./app/kern.js');
      window.werkbank.zustand.gewaehlteSeiten.clear();
      melde('auswahl:geaendert');
    });
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
    const { PDFDocument } = await import('../../fremd/pdf-lib.mjs');
    const dok = await PDFDocument.load(await readFile(pfad));
    const felder = dok.getForm().getFields().length;
    const pdfjs = await import('../../fremd/pdf.mjs');
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
    const { PDFDocument } = await import('../../fremd/pdf-lib.mjs');
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
}
