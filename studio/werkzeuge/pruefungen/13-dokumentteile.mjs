/* Lesezeichen, Anhänge, Bates, PowerPoint, Vorabprüfung.

   Fünf Fähigkeiten, ein gemeinsamer Prüfgedanke: es reicht nicht, dass der
   Dialog aufgeht. Was er verspricht, muss in der gesicherten Datei stehen und
   von einem fremden Leser wiedergefunden werden — für Lesezeichen und Anhänge
   liest hier pdf.js gegen, für .pptx wird das ZIP von Hand aufgemacht.

   Bei den Lesezeichen ist das nicht Vorsicht, sondern Notwendigkeit: der
   /Outlines-Baum wird von Hand gebaut, weil pdf-lib nichts dafür mitbringt.
   Das ist der Teil des Formats, der am ehesten kaputtgeht, und ein kaputter
   Baum sieht in der Datei aus wie ein heiler. */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function ({ pruefe, seite, ladeBeispiel, ladungVon, BASIS, WURZEL }) {
  console.log('\n== Lesezeichen, Anhänge, Bates, PowerPoint ==');

  const lies = async (pfad, was) => seite.evaluate(async ([daten, teil]) => {
    const pdfjs = await import('./fremd/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = './fremd/pdf.worker.mjs';
    const dok = await pdfjs.getDocument({ data: new Uint8Array(daten) }).promise;
    if (teil === 'gliederung') {
      const flach = [];
      const geh = (knoten, ebene) => {
        for (const p of knoten || []) { flach.push({ titel: p.title, ebene }); geh(p.items, ebene + 1); }
      };
      geh(await dok.getOutline(), 0);
      return flach;
    }
    if (teil === 'anhaenge') {
      const a = await dok.getAttachments();
      return Object.values(a || {}).map((x) => ({ name: x.filename, laenge: x.content?.length || 0 }));
    }
    if (teil === 'text') {
      const raus = [];
      for (let n = 1; n <= dok.numPages; n++) {
        raus.push((await (await dok.getPage(n)).getTextContent()).items.map((i) => i.str).join(' '));
      }
      return raus;
    }
    return null;
  }, [[...await readFile(pfad)], was]);

  await pruefe('Lesezeichen anlegen und in der Datei wiederfinden', async () => {
    await ladeBeispiel();
    await seite.evaluate(async () => {
      const { setzeLesezeichen } = await import('./app/dokumentteile.js');
      setzeLesezeichen([
        { titel: 'Vertragsentwurf', seite: 1, ebene: 0 },
        { titel: 'Leistungen', seite: 2, ebene: 1 },
        { titel: 'Abnahme', seite: 3, ebene: 1 },
        { titel: 'Anhang', seite: 5, ebene: 0 },
      ]);
    });
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const gefunden = await lies(pfad, 'gliederung');
    const erwartet = 'Vertragsentwurf/0, Leistungen/1, Abnahme/1, Anhang/0';
    const bekommen = gefunden.map((p) => `${p.titel}/${p.ebene}`).join(', ');
    if (bekommen !== erwartet) throw new Error(`gelesen: ${bekommen}`);
    return `${gefunden.length} Lesezeichen, Ebenen stimmen`;
  });

  await pruefe('Eine geleerte Gliederung bleibt geleert', async () => {
    await seite.evaluate(async () => {
      const { setzeLesezeichen } = await import('./app/dokumentteile.js');
      setzeLesezeichen([]);
    });
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const gefunden = await lies(pfad, 'gliederung');
    /* Das Beispiel bringt eine Gliederung mit; wer sie leert und sichert, darf
       sie nicht zurückbekommen. */
    if (gefunden.length) throw new Error(`${gefunden.length} Lesezeichen sind wieder da`);
    return 'leer geblieben';
  });

  await pruefe('Ein Anhang liegt danach wirklich im PDF', async () => {
    await ladeBeispiel();
    await seite.evaluate(async () => {
      const { fuegeAnhangAn } = await import('./app/dokumentteile.js');
      fuegeAnhangAn({
        name: 'notiz.txt',
        bytes: new TextEncoder().encode('Zur Sitzung am 14. Mai: Vergütung prüfen.'),
        art: 'text/plain',
      });
    });
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const anhaenge = await lies(pfad, 'anhaenge');
    const notiz = anhaenge.find((a) => a.name === 'notiz.txt');
    if (!notiz) throw new Error(`gefunden: ${anhaenge.map((a) => a.name).join(', ') || 'nichts'}`);
    if (notiz.laenge < 20) throw new Error(`nur ${notiz.laenge} Bytes`);
    return `notiz.txt, ${notiz.laenge} Bytes`;
  });

  await pruefe('Die Bates-Nummer läuft fortlaufend über die Seiten', async () => {
    await ladeBeispiel();
    await seite.evaluate(async () => {
      const { setzeAufdruck } = await import('./app/aufdruck.js');
      setzeAufdruck({
        wasserzeichen: null, kopf: null,
        bates: { praefix: 'AKTE-', beginn: 41, stellen: 5, suffix: '' },
        fuss: { links: '{bates}', mitte: '', rechts: '', groesse: 8, abstand: 24 },
      });
    });
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const text = await lies(pfad, 'text');
    const erwartet = ['AKTE-00041', 'AKTE-00042', 'AKTE-00043', 'AKTE-00044', 'AKTE-00045'];
    for (const [i, marke] of erwartet.entries()) {
      if (!text[i]?.includes(marke)) throw new Error(`Seite ${i + 1} trägt nicht ${marke}`);
    }
    /* Und die Stellenzahl hält: 41 wird zu 00041, nicht zu 41. */
    if (text[0].includes('AKTE-41 ')) throw new Error('die Stellen werden nicht aufgefüllt');
    return `${erwartet[0]} … ${erwartet[4]}`;
  });

  await pruefe('PowerPoint: je Seite eine Folie, mit Titel und Aufzählung', async () => {
    await ladeBeispiel();
    const pfad = await ladungVon(async () => {
      await seite.evaluate(() => window.studio.fuehreAus('powerpoint:ausgeben'));
      await seite.waitForSelector('.dialog select');
      await seite.click('.dialog-fuss .knopf:not(.knopf-still)');
    });
    const { unzipRoh } = await import('../zip-lesen.mjs');
    const dateien = unzipRoh(await readFile(pfad));
    const namen = [...dateien.keys()];
    for (const pflicht of ['[Content_Types].xml', '_rels/.rels', 'ppt/presentation.xml',
      'ppt/slideMasters/slideMaster1.xml', 'ppt/slideLayouts/slideLayout1.xml', 'ppt/theme/theme1.xml']) {
      if (!namen.includes(pflicht)) throw new Error(`${pflicht} fehlt`);
    }
    const folien = namen.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    if (folien.length !== 5) throw new Error(`${folien.length} Folien statt 5`);
    const erste = Buffer.from(dateien.get('ppt/slides/slide1.xml')).toString('utf8');
    if (!/Vertragsentwurf/.test(erste)) throw new Error('die erste Folie trägt nicht den Titel der Seite');
    if (!/type="title"/.test(erste) || !/type="body"/.test(erste)) {
      throw new Error('Titel- oder Textrahmen fehlt');
    }
    /* Und die Beziehungen: jede Folie muss von der Präsentation aus erreichbar
       sein, sonst öffnet PowerPoint eine leere Datei ohne Fehlermeldung. */
    const bez = Buffer.from(dateien.get('ppt/_rels/presentation.xml.rels')).toString('utf8');
    for (let i = 1; i <= 5; i++) {
      if (!bez.includes(`slides/slide${i}.xml`)) throw new Error(`Folie ${i} ist nicht verlinkt`);
    }
    return `5 Folien, ${namen.length} Teile im ZIP`;
  });

  await pruefe('Die Vorabprüfung nennt Befund und Folge', async () => {
    await ladeBeispiel();
    await seite.evaluate(() => window.studio.fuehreAus('vorabpruefung'));
    await seite.waitForSelector('.befund', { timeout: 60000 });
    const befunde = await seite.evaluate(() => [...document.querySelectorAll('.befund')].map((b) => ({
      art: [...b.classList].find((k) => k.startsWith('ist-')),
      was: b.querySelector('.befund-was')?.textContent || '',
      folge: b.querySelector('.befund-folge')?.textContent || '',
    })));
    if (befunde.length < 3) throw new Error(`nur ${befunde.length} Befunde`);
    /* Jeder Befund, der etwas beanstandet, muss die Folge nennen — sonst ist
       er eine Zustandsmeldung und keine Hilfe. */
    const stumm = befunde.filter((b) => b.art !== 'ist-gut' && !b.folge);
    if (stumm.length) throw new Error(`ohne Folge: ${stumm.map((b) => b.was).join(', ')}`);
    await seite.evaluate(() => { document.querySelector('#schirm').hidden = true; document.querySelector('#schirm').innerHTML = ''; });
    return befunde.map((b) => b.was).slice(0, 3).join(' · ');
  });

  await pruefe('PDF/A wird vorbereitet — und nicht behauptet', async () => {
    await ladeBeispiel();
    await seite.evaluate(() => { window.studio.zustand.pdfA = true; });
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    /* Nicht im Klartext suchen: pdf-lib packt den Katalog in einen
       Objektstrom, dort steht nichts lesbar. Also den Katalog lesen. */
    const katalog = await seite.evaluate(async (daten) => {
      const { starteSchreiber } = await import('./app/ausgabe.js');
      const pdflib = await starteSchreiber();
      const doc = await pdflib.PDFDocument.load(new Uint8Array(daten));
      const N = (n) => pdflib.PDFName.of(n);
      const absichten = doc.catalog.lookup(N('OutputIntents'));
      const erste = absichten?.get?.(0) && doc.context.lookup(absichten.get(0), pdflib.PDFDict);
      return {
        absichten: !!absichten,
        kennung: String(erste?.lookup(N('S'))?.asString?.() || ''),
        markiert: !!doc.catalog.lookup(N('MarkInfo')),
        metadaten: !!doc.catalog.lookup(N('Metadata')),
      };
    }, [...await readFile(pfad)]);
    if (!katalog.absichten) throw new Error('keine Ausgabeabsicht');
    if (katalog.kennung !== '/GTS_PDFA1') throw new Error(`Kennung ${katalog.kennung}`);
    if (!katalog.markiert) throw new Error('keine Markierung');
    if (!katalog.metadaten) throw new Error('keine XMP-Metadaten');
    /* Und der Dialog darf keine Konformität behaupten. */
    await seite.evaluate(() => window.studio.fuehreAus('vorabpruefung'));
    await seite.waitForSelector('.dialog');
    const text = await seite.evaluate(() => document.querySelector('.dialog-rumpf').textContent);
    await seite.evaluate(() => { document.querySelector('#schirm').hidden = true; document.querySelector('#schirm').innerHTML = ''; });
    if (!/veraPDF|Prüfprogramm/.test(text)) throw new Error('der Dialog sagt nicht, dass er es nicht prüft');
    await seite.evaluate(() => { window.studio.zustand.pdfA = false; });
    return 'OutputIntent, GTS_PDFA1, MarkInfo, XMP — mit Vorbehalt im Dialog';
  });

  await pruefe('Bilder im PDF: finden, ersetzen, entfernen', async () => {
    /* Ein PDF aus zwei Bildern — dafür gibt es das Werkzeug „Bilder zu PDF",
       und damit ist der Prüfling aus demselben Haus wie der Prüfer. */
    await seite.goto(`${BASIS}?werkzeug=bilder-zu-pdf`);
    await seite.waitForSelector('.einzel-karte');
    const gemacht = await seite.evaluate(async () => {
      /* Zwei winzige PNGs von Hand: rot und blau, je 2 × 2. */
      const male = (farbe) => new Promise((loese) => {
        const l = document.createElement('canvas');
        l.width = 2; l.height = 2;
        const s = l.getContext('2d');
        s.fillStyle = farbe; s.fillRect(0, 0, 2, 2);
        l.toBlob((b) => loese(new File([b], `${farbe.replace('#', '')}.png`, { type: 'image/png' })), 'image/png');
      });
      window.__proben = [await male('#c0392b'), await male('#2980b9')];
      return window.__proben.length;
    });
    if (gemacht !== 2) throw new Error('die Proben ließen sich nicht bauen');

    const pfad = await seite.evaluate(async () => {
      const { bilderZuPdfBytes } = await import('./app/einlesen.js');
      const { bytes } = await bilderZuPdfBytes(window.__proben);
      return [...bytes];
    });
    await seite.goto(BASIS);
    await seite.evaluate(async (daten) => {
      const { oeffneBytes } = await import('./app/dokument.js');
      await oeffneBytes(new Uint8Array(daten), 'bilder.pdf');
    }, pfad);
    await seite.waitForTimeout(1200);

    const gefunden = await seite.evaluate(async () => {
      const { bilderImDokument } = await import('./app/bilder.js');
      return (await bilderImDokument()).map((b) => ({ seite: b.seite, name: b.name, b: b.breite, h: b.hoehe }));
    });
    if (gefunden.length !== 2) throw new Error(`${gefunden.length} Bilder gefunden statt 2`);

    /* Das erste ersetzen, das zweite entfernen — und danach in der Datei
       nachsehen, dass beide Einträge auf etwas anderes zeigen als vorher. */
    await seite.evaluate(async ([erstes, zweites]) => {
      const { setzeBildauftrag } = await import('./app/bilder.js');
      const gruen = await new Promise((loese) => {
        const l = document.createElement('canvas');
        l.width = 8; l.height = 8;
        const s = l.getContext('2d');
        s.fillStyle = '#27ae60'; s.fillRect(0, 0, 8, 8);
        l.toBlob(async (b) => loese(new Uint8Array(await b.arrayBuffer())), 'image/png');
      });
      setzeBildauftrag({ ...erstes, ersatz: gruen, entfernen: false });
      setzeBildauftrag({ ...zweites, ersatz: null, entfernen: true });
    }, [{ seite: gefunden[0].seite, name: gefunden[0].name }, { seite: gefunden[1].seite, name: gefunden[1].name }]);

    const ausgabe = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const nachher = await seite.evaluate(async (daten) => {
      const { oeffneBytes } = await import('./app/dokument.js');
      await oeffneBytes(new Uint8Array(daten), 'geprueft.pdf');
      const { bilderImDokument } = await import('./app/bilder.js');
      return (await bilderImDokument()).map((b) => `${b.seite}:${b.breite}×${b.hoehe}`);
    }, [...await readFile(ausgabe)]);

    /* Das ersetzte ist jetzt 8 × 8, das entfernte 1 × 1 — beides eindeutig
       verschieden von den 2 × 2 des Originals. */
    if (!nachher.includes('1:8×8')) throw new Error(`Seite 1: ${nachher.join(', ')}`);
    if (!nachher.includes('2:1×1')) throw new Error(`Seite 2: ${nachher.join(', ')}`);
    return nachher.join(' · ');
  });
}
