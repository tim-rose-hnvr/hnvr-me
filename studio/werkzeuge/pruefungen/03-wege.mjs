/* Wege — Word, Textauswahl, Stempel, Bilder, Menü, Ordnen, Fokus.

   Die Zugänge, die später dazukamen und je einen eigenen Weg durch das
   Programm nehmen. */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function ({ pruefe, seite, blatt, ladeBeispiel, ladungVon, HIER, befehle }) {
  /* --- Neue Wege: Word, Textauswahl, Stempel, Bilder ------------------------ */
  console.log('\n== Word, Text, Stempel ==');
  await seite.context().grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

  await pruefe('Word-Dialog gibt eine .docx aus', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('word:ausgeben'));
    await seite.waitForSelector('.dialog select');
    const pfad = await ladungVon(() => seite.click('.dialog-fuss .knopf:last-child'));
    const daten = await readFile(pfad);
    if (daten[0] !== 0x50 || daten[1] !== 0x4B) throw new Error('kein ZIP');
    if (!daten.includes(Buffer.from('word/document.xml'))) throw new Error('kein Word-Dokument');
    return `${Math.round(daten.length / 1024)} kB`;
  });

  await pruefe('Textauswahl kopieren', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:auswahl'));
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
    await seite.evaluate(() => window.studio.fuehreAus('text:kopieren'));
    await seite.waitForTimeout(500);
    const inhalt = await seite.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    if (!/Konferenzanlage|Vertrag/.test(inhalt)) throw new Error('Zwischenablage: ' + inhalt.slice(0, 40));
    return `${inhalt.trim().split(/\s+/).length} Wörter`;
  });

  await pruefe('Seitentext kopieren, wenn nichts markiert ist', async () => {
    await seite.evaluate(() => window.getSelection().removeAllRanges());
    await seite.evaluate(() => window.studio.fuehreAus('text:kopieren'));
    await seite.waitForTimeout(600);
    const inhalt = await seite.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    if (inhalt.trim().split(/\s+/).length < 20) throw new Error('zu wenig Text: ' + inhalt.length);
    return `${inhalt.trim().split(/\s+/).length} Wörter`;
  });

  await pruefe('Bereich ablichten (Momentaufnahme)', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:bereich'));
    const b = await blatt();
    const a1 = b.bei(0.15, 0.2), a2 = b.bei(0.6, 0.3);
    await seite.mouse.move(a1.x, a1.y);
    await seite.mouse.down();
    await seite.mouse.move(a2.x, a2.y, { steps: 8 });
    await seite.mouse.up();
    await seite.waitForTimeout(2500);
    const meldung = await seite.evaluate(() => document.querySelector('#meldungen')?.textContent || '');
    if (!/Bereich/.test(meldung)) throw new Error('keine Rückmeldung: ' + meldung.slice(0, 60));
    const anmerkungen = await seite.evaluate(() => window.studio.zustand.anmerkungen.some((x) => x.art === 'bereich'));
    if (anmerkungen) throw new Error('der Bereich wurde fälschlich ins Dokument geschrieben');
    return meldung.slice(-42);
  });

  await pruefe('Stempel setzen', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:stempel'));
    const b = await blatt();
    const punkt = b.bei(0.6, 0.42);
    await seite.mouse.click(punkt.x, punkt.y);
    await seite.waitForSelector('.dialog select');
    await seite.selectOption('.dialog select', '2');            // Entwurf
    await seite.check('.dialog input[type=checkbox]');          // mit Datum
    await seite.click('.dialog-fuss .knopf:last-child');
    await seite.waitForTimeout(600);
    const stempel = await seite.evaluate(() => window.studio.zustand.anmerkungen.find((a) => a.art === 'stempel'));
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
      await seite.evaluate(() => window.studio.fuehreAus('bilder:zuPdf'));
      await seite.setInputFiles('#dateiwahl-bilder', [bildPfad, bildPfad]);
    });
    const pdfjs = await import('../../fremd/pdf.mjs');
    const dok = await pdfjs.getDocument({ data: new Uint8Array(await readFile(pfad)) }).promise;
    if (dok.numPages !== 2) throw new Error(`${dok.numPages} Seiten`);
    return 'zwei Bilder, zwei Seiten';
  });

  console.log('\n== Menue, Ordnen, Fokus ==');

  await ladeBeispiel();

  await pruefe('Menueleiste traegt alle acht Menues in der Reihenfolge des Handoffs', async () => {
    /* Das Handoff zeigt Datei, Bearbeiten, Ansicht, Werkzeuge, …, Hilfe. Unsere
       zusätzlichen Menüs stehen dazwischen, nicht davor — das Muster wird
       erweitert, nicht gebrochen. */
    const titel = await seite.$$eval('#menueleiste .menue-knopf', (ks) => ks.map((k) => k.textContent));
    const erwartet = ['Datei', 'Bearbeiten', 'Ansicht', 'Seiten', 'Werkzeuge', 'Gehe zu', 'Schutz', 'Hilfe'];
    if (titel.join('|') !== erwartet.join('|')) throw new Error(titel.join('|'));
    return titel.join(', ');
  });

  await pruefe('jeder Befehl ist mit der Maus erreichbar', async () => {
    /* Der eigentliche Punkt der Menueleiste. Ein Befehl, der in keinem Menue
       steht, ist nur ueber Strg+K da — und damit fuer die meisten gar nicht. */
    const offen = await seite.evaluate(async () => (await import('./app/menue.js')).unsortierteBefehle());
    if (offen.length) throw new Error(`ohne Menueweg: ${offen.join(', ')}`);
    const anzahl = await seite.$$eval('#menueleiste .menue-eintrag', (ks) => ks.length);
    const befehle = await seite.evaluate(() => window.studio.befehle.length);
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
    await seite.evaluate(() => window.studio.fuehreAus('seiten:drehenRechts'));
    await seite.waitForTimeout(500);
    if (await seite.evaluate(() => document.querySelector('#knopf-rueckgaengig').disabled)) throw new Error('nach einer Aenderung noch gesperrt');
    const beschriftung = await seite.$eval('#knopf-rueckgaengig', (k) => k.title);
    await seite.click('#knopf-rueckgaengig');
    await seite.waitForTimeout(400);
    if (!await seite.evaluate(() => document.querySelector('#knopf-wiederholen').disabled === false)) throw new Error('Wiederholen bleibt gesperrt');
    return beschriftung;
  });

  await pruefe('Seiten ordnen zeigt jede Seite gross', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('seiten:ordnen'));
    await seite.waitForSelector('.ordnen-karte');
    await seite.waitForTimeout(1200);
    const karten = await seite.$$eval('.ordnen-karte', (ks) => ks.length);
    const seitenzahl = await seite.evaluate(() => window.studio.zustand.folge.length);
    if (karten !== seitenzahl) throw new Error(`${karten} Karten fuer ${seitenzahl} Seiten`);
    const gemalt = await seite.$$eval('.ordnen-karte canvas', (ks) => ks.filter((c) => c.width > 100).length);
    if (!gemalt) throw new Error('keine Seite gezeichnet');
    return `${karten} Karten, ${gemalt} gezeichnet`;
  });

  await pruefe('Ordnen sortiert per Ziehen um', async () => {
    const vorher = await seite.evaluate(() => window.studio.zustand.folge.map((e) => e.id));
    const von = await seite.$('.ordnen-karte >> nth=0');
    const nach = await seite.$('.ordnen-karte >> nth=2');
    const a = await von.boundingBox(), b = await nach.boundingBox();
    await seite.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await seite.mouse.down();
    await seite.mouse.move(b.x + b.width * 0.9, b.y + b.height / 2, { steps: 12 });
    await seite.mouse.up();
    await seite.waitForTimeout(700);
    const nachher = await seite.evaluate(() => window.studio.zustand.folge.map((e) => e.id));
    if (vorher.join() === nachher.join()) throw new Error('Reihenfolge unveraendert');
    if (nachher[0] === vorher[0]) throw new Error('erste Seite blieb vorn');
    await seite.evaluate(() => window.studio.fuehreAus('rueckgaengig'));
    await seite.waitForTimeout(500);
    return `Seite 1 steht jetzt an Stelle ${nachher.indexOf(vorher[0]) + 1}`;
  });

  await pruefe('Ordnen loescht die gewaehlten Seiten', async () => {
    const vorher = await seite.evaluate(() => window.studio.zustand.folge.length);
    await seite.click('.ordnen-karte >> nth=1');
    await seite.waitForTimeout(200);
    /* Die Aktionsleiste heißt seit dem Abgleich mit dem Mockup .ordnen-kopf und
       trägt vier beschriftete Knöpfe statt sieben. */
    await seite.click('.ordnen-kopf .ordnen-knopf:has-text("Löschen")');
    await seite.waitForTimeout(600);
    const nachher = await seite.evaluate(() => window.studio.zustand.folge.length);
    if (nachher !== vorher - 1) throw new Error(`${vorher} → ${nachher}`);
    await seite.evaluate(() => window.studio.fuehreAus('rueckgaengig'));
    await seite.waitForTimeout(600);
    if (await seite.evaluate(() => window.studio.zustand.folge.length) !== vorher) throw new Error('Rueckgaengig hat nicht zurueckgeholt');
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
      const z = window.studio.zustand;
      z.gewaehlteSeiten.clear();
      z.gewaehlteSeiten.add(z.folge[2].id);
      z.gewaehlteSeiten.add(z.folge[4].id);
    });
    await seite.evaluate(() => window.studio.fuehreAus('seiten:nurAuswahl'));
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
    const alle = await seite.evaluate(() => window.studio.zustand.folge.length);
    if (sichtbar !== alle) throw new Error(`${sichtbar} von ${alle}`);
    if (!await seite.evaluate(() => document.querySelector('#fuss-fokus').hidden)) throw new Error('Anzeige bleibt stehen');
    return `wieder ${alle} Seiten`;
  });
}
