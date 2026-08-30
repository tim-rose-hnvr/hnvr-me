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

export default async function ({ pruefe, seite, browser, BASIS, ladungVon, WURZEL }) {
  console.log('\n== Einzelwerkzeuge ==');

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
