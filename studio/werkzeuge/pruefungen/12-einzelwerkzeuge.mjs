/* Einzelwerkzeuge — ein Werkzeug, eine Adresse, eine Aufgabe.

   Zwei Dinge werden hier geprüft, und das zweite ist das wichtigere:

   1. Dass der kurze Weg funktioniert: Adresse aufrufen, Dateien hinlegen,
      Knopf drücken, fertige Datei.
   2. Dass er **dasselbe** tut wie der lange. Ein Zusammenfügen, das über den
      kurzen Weg anders zusammenfügt als über das Studio, wäre eine Falle —
      und genau die Art Falle, die niemand bemerkt, bis ein Kunde eine Datei
      abgibt, die anders aussieht als erwartet. */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function ({ pruefe, seite, browser, BASIS, ladungVon, WURZEL, ladeBeispiel }) {
  console.log('\n== Einzelwerkzeuge ==');

  await pruefe('Die Vorgangsschiene rechnet mit dem Dokument, nicht mit Vorräten', async () => {
    /* Sie beantwortet nicht „was kann ich tun", sondern „was steht noch an".
       Deshalb müssen die Zahlen aus dem Dokument kommen: Seitenzahl,
       gefundene personenbezogene Angaben, Stand der Formularfelder. Eine
       erfundene Zahl wäre schlimmer als keine. */
    await ladeBeispiel();
    await seite.waitForTimeout(1400);
    const stand = await seite.evaluate(() => {
      const zeilen = [...document.querySelectorAll('.schritt')].map((k) => ({
        wort: k.querySelector('.schritt-wort').textContent,
        stand: k.querySelector('.schritt-stand')?.textContent || '',
        art: [...k.classList].find((c) => c.startsWith('ist-') && c !== 'ist-aktiv') || '',
      }));
      return {
        zeilen,
        seiten: window.studio.zustand.folge.length,
        felder: window.studio.zustand.formularfelder.length,
      };
    });
    const worte = stand.zeilen.map((z) => z.wort);
    for (const soll of ['Lesen', 'Prüfen', 'Schwärzen', 'Ausfüllen', 'Unterschreiben', 'Ausgeben']) {
      if (!worte.includes(soll)) throw new Error(`Schritt „${soll}" fehlt — da steht: ${worte.join(', ')}`);
    }
    const lesen = stand.zeilen.find((z) => z.wort === 'Lesen');
    if (lesen.stand !== `${stand.seiten} S.`) {
      throw new Error(`„Lesen" sagt „${lesen.stand}", das Dokument hat ${stand.seiten} Seiten`);
    }
    const ausfuellen = stand.zeilen.find((z) => z.wort === 'Ausfüllen');
    if (stand.felder && !new RegExp(`von ${stand.felder}$`).test(ausfuellen.stand)) {
      throw new Error(`„Ausfüllen" sagt „${ausfuellen.stand}", es gibt ${stand.felder} Felder`);
    }
    /* Und das Gegenstück: ein Schritt ohne Grund im Dokument zeigt keine Zahl. */
    const warten = stand.zeilen.filter((z) => z.art === 'ist-wartet' || z.art === 'ist-nichts');
    if (warten.some((z) => z.stand)) throw new Error('ein wartender Schritt zeigt eine Zahl');
    return stand.zeilen.map((z) => `${z.wort}${z.stand ? ' ' + z.stand : ''}`).join(' · ');
  });

  await pruefe('Die Werkzeugblase erscheint an der Auswahl — und nur dort', async () => {
    /* Der Unterschied zur Werkzeugzeile: die bot fünfzehn Werkzeuge auf
       Vorrat an, ohne zu wissen, ob eines davon gerade passt. Die Blase
       erscheint erst, wenn es etwas gibt, worauf sie sich bezieht. */
    const vorher = await seite.evaluate(() => {
      const b = document.querySelector('#werkzeugblase');
      return b ? b.hidden : null;
    });
    if (vorher === null) throw new Error('es gibt keine Werkzeugblase');
    if (vorher !== true) throw new Error('die Blase steht da, ohne dass etwas gewählt ist');

    const lage = await seite.evaluate(() => {
      const spans = [...document.querySelectorAll('.blatt .textebene span')];
      const a = spans[6], b = spans[9];
      if (!a || !b) return { fehler: `nur ${spans.length} Textstellen` };
      const r = document.createRange();
      r.setStart(a.firstChild || a, 0);
      r.setEnd(b.firstChild || b, (b.textContent || '').length);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      document.dispatchEvent(new Event('selectionchange'));
      const blase = document.querySelector('#werkzeugblase');
      const k = blase.getBoundingClientRect();
      const aus = r.getBoundingClientRect();
      return {
        versteckt: blase.hidden,
        knoepfe: [...blase.children].map((x) => x.textContent),
        imFenster: k.left >= 0 && k.right <= window.innerWidth,
        ueberDerAuswahl: k.bottom <= aus.top + 1 || k.top >= aus.bottom - 1,
      };
    });
    if (lage.fehler) throw new Error(lage.fehler);
    if (lage.versteckt) throw new Error('die Blase bleibt verborgen, obwohl Text gewählt ist');
    if (!lage.imFenster) throw new Error('die Blase ragt aus dem Fenster');
    if (!lage.ueberDerAuswahl) throw new Error('die Blase liegt auf der Auswahl statt daneben');
    for (const soll of ['Markieren', 'Schwärzen']) {
      if (!lage.knoepfe.includes(soll)) throw new Error(`„${soll}" fehlt — da steht: ${lage.knoepfe.join(', ')}`);
    }
    /* Escape räumt sie weg, ohne etwas anzustellen. */
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    const danach = await seite.evaluate(() => document.querySelector('#werkzeugblase').hidden);
    if (!danach) throw new Error('Escape schließt die Blase nicht');
    await seite.evaluate(() => window.getSelection().removeAllRanges());
    return `${lage.knoepfe.length} Taten: ${lage.knoepfe.join(' · ')}`;
  });

  const beispiel = join(WURZEL, 'beispiel', 'beispiel.pdf');
  const flach = join(WURZEL, 'beispiel', 'flachformular.pdf');

  await pruefe('Der Empfang zeigt jedes Werkzeug als Kachel mit eigener Adresse', async () => {
    await seite.goto(BASIS);
    await seite.waitForSelector('.werkzeugkachel');
    const kacheln = await seite.evaluate(() => [...document.querySelectorAll('.werkzeugkachel')]
      .map((k) => ({ weg: k.getAttribute('href'), name: k.textContent.trim() })));
    const bekannt = await seite.evaluate(async () =>
      (await import('./app/einzelwerkzeuge.js')).WERKZEUGE.map((w) => w.id));
    if (kacheln.length !== bekannt.length) throw new Error(`${kacheln.length} Kacheln, ${bekannt.length} Werkzeuge`);
    const ohneAdresse = kacheln.filter((k) => !/^\?werkzeug=/.test(k.weg));
    if (ohneAdresse.length) throw new Error(`ohne eigene Adresse: ${ohneAdresse.map((k) => k.name).join(', ')}`);
    return `${kacheln.length} Werkzeuge, jedes verlinkbar`;
  });

  await pruefe('Eine Werkzeug-Adresse öffnet das Werkzeug, nicht das Studio', async () => {
    await seite.goto(`${BASIS}?werkzeug=verkleinern`);
    await seite.waitForSelector('.einzel-karte');
    const stand = await seite.evaluate(() => ({
      titel: document.title,
      ueberschrift: document.querySelector('.einzel-karte h1')?.textContent,
      kopfBleibt: !!document.querySelector('.empfang-kopf'),
      studioZu: document.querySelector('#huelle')?.hidden !== false,
      wahl: document.querySelector('.einzel-zusatz select')?.value,
    }));
    if (!/verkleinern/i.test(stand.titel)) throw new Error(`Titel: ${stand.titel}`);
    if (stand.ueberschrift !== 'PDF verkleinern') throw new Error(`Überschrift: ${stand.ueberschrift}`);
    if (!stand.kopfBleibt) throw new Error('die Wortmarke ist fort — es sieht aus wie ein anderes Programm');
    if (!stand.studioZu) throw new Error('das Studio steht trotzdem offen');
    if (stand.wahl !== '110') throw new Error(`Vorgabe der Auflösung: ${stand.wahl}`);
    return `${stand.ueberschrift}, ${stand.titel}`;
  });

  await pruefe('Eine erfundene Adresse führt nicht ins Leere', async () => {
    await seite.goto(`${BASIS}?werkzeug=gibtesnicht`);
    await seite.waitForTimeout(1800);
    const stand = await seite.evaluate(() => ({
      einzel: !!document.querySelector('.einzel-karte'),
      empfang: !!document.querySelector('.empfang-karte'),
      meldung: document.querySelector('#meldungen')?.textContent || '',
    }));
    if (stand.einzel) throw new Error('sie zeigt ein Werkzeug, das es nicht gibt');
    if (!stand.empfang) throw new Error('und auch keinen Empfang');
    if (!/gibtesnicht/.test(stand.meldung)) throw new Error('ohne ein Wort dazu');
    return 'Empfang plus Hinweis';
  });

  await pruefe('Zusammenfügen: zwei Dateien hinein, eine heraus', async () => {
    await seite.goto(`${BASIS}?werkzeug=zusammenfuegen`);
    await seite.waitForSelector('.einzel-karte');
    const gesperrt = await seite.evaluate(() => document.querySelector('.einzel-karte .knopf-voll').disabled);
    if (!gesperrt) throw new Error('der Knopf ist offen, obwohl keine Datei da ist');

    await seite.setInputFiles('.einzel-karte input[type=file]', [beispiel, flach]);
    await seite.waitForTimeout(400);
    const bereit = await seite.evaluate(() => ({
      dateien: document.querySelectorAll('.einzel-datei').length,
      offen: !document.querySelector('.einzel-karte .knopf-voll').disabled,
    }));
    if (bereit.dateien !== 2) throw new Error(`${bereit.dateien} Dateien in der Liste`);
    if (!bereit.offen) throw new Error('der Knopf bleibt gesperrt');

    const pfad = await ladungVon(() => seite.click('.einzel-karte .knopf-voll'));
    const seitenzahl = await seite.evaluate(async (daten) => {
      const pdfjs = await import('./fremd/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = './fremd/pdf.worker.mjs';
      return (await pdfjs.getDocument({ data: new Uint8Array(daten) }).promise).numPages;
    }, [...await readFile(pfad)]);
    /* Fünf Seiten Beispiel plus eine Seite Formular. */
    if (seitenzahl !== 6) throw new Error(`${seitenzahl} Seiten statt 6`);
    return `6 Seiten aus 2 Dateien`;
  });

  await pruefe('Der kurze Weg liefert dasselbe wie der lange', async () => {
    /* Die eigentliche Zusage. Beide Wege rufen `baueDokument` — wenn sie
       auseinanderlaufen, gibt es zwei Programme mit einem Namen. */
    const kurz = await ladungVon(async () => {
      await seite.goto(`${BASIS}?werkzeug=nach-word`);
      await seite.waitForSelector('.einzel-karte');
      await seite.setInputFiles('.einzel-karte input[type=file]', [beispiel]);
      await seite.waitForTimeout(300);
      await seite.click('.einzel-karte .knopf-voll');
    });
    const lang = await ladungVon(async () => {
      await seite.goto(BASIS);
      await seite.setInputFiles('#dateiwahl', beispiel);
      await seite.waitForSelector('.blatt canvas');
      await seite.waitForTimeout(2500);
      await seite.evaluate(async () => {
        const { alsWord } = await import('./app/word.js');
        const { sichereBytes } = await import('./app/kern.js');
        const { bytes } = await alsWord({});
        sichereBytes(bytes, 'lang.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      });
    });
    /* Verglichen wird der Text, nicht das Byte: eine .docx trägt einen
       Zeitstempel, der sich zwischen zwei Läufen unterscheidet. */
    const { unzipRoh } = await import('../zip-lesen.mjs');
    const textVon = async (pfad) => {
      /* `unzipRoh` liefert eine Map von Name auf Bytes. */
      const dokument = unzipRoh(await readFile(pfad)).get('word/document.xml');
      if (!dokument) throw new Error(`${pfad} enthält kein word/document.xml`);
      return Buffer.from(dokument).toString('utf8')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const [a, b] = [await textVon(kurz), await textVon(lang)];
    if (a !== b) {
      throw new Error(`kurz ${a.length} Zeichen, lang ${b.length} — sie laufen auseinander`);
    }
    return `${a.length} Zeichen, Byte für Byte derselbe Text`;
  });

  await pruefe('Ein Werkzeug ohne Angabe sagt, was fehlt — statt zu scheitern', async () => {
    await seite.goto(`${BASIS}?werkzeug=schuetzen`);
    await seite.waitForSelector('.einzel-karte');
    await seite.setInputFiles('.einzel-karte input[type=file]', [beispiel]);
    await seite.waitForTimeout(300);
    /* Kennwortfeld leer lassen. */
    await seite.click('.einzel-karte .knopf-voll');
    await seite.waitForTimeout(1200);
    const stand = await seite.evaluate(() => document.querySelector('.einzel-stand')?.textContent || '');
    if (!/Kennwort/i.test(stand)) throw new Error(`meldet: „${stand}"`);
    return stand.slice(0, 48);
  });

  await pruefe('Vom Werkzeug führt ein Weg ins volle Studio', async () => {
    const weg = await seite.evaluate(() =>
      document.querySelector('.einzel-fuss a')?.getAttribute('href'));
    if (weg !== './') throw new Error(`der Weg zeigt auf ${weg}`);
    const zurueck = await seite.evaluate(() =>
      document.querySelector('.einzel-zurueck')?.getAttribute('href'));
    if (zurueck !== './') throw new Error(`„Alle Werkzeuge" zeigt auf ${zurueck}`);
    return 'zweimal zurück ins Studio';
  });
}
