/* Felderkennung — aus einem flachen Formular ausfüllbare Felder machen.

   Geprüft wird an `beispiel/flachformular.pdf`: eine Seite mit vier
   Ausfülllinien, drei Ankreuzkästchen, einem Rahmen für Fließtext, einer
   Tabelle **mit Inhalt** und zwei kurzen Linien für Ort/Datum und
   Unterschrift.

   Die Tabelle ist der eigentliche Prüfstein. Sie sieht aus wie ein Formular
   und ist keines — wer sie mitnimmt, schlägt auf jedem Geschäftsbericht
   hunderte Felder vor. */

import { join } from 'node:path';

export default async function ({ pruefe, seite, ladeBeispiel, ladungVon, WURZEL }) {
  console.log('\n== Felderkennung ==');

  const ladeFormular = async () => {
    await ladeBeispiel();
    await seite.setInputFiles('#dateiwahl', join(WURZEL, 'beispiel', 'flachformular.pdf'));
    await seite.waitForTimeout(2500);
  };

  await pruefe('Ein flaches Formular bringt keine Felder mit', async () => {
    await ladeFormular();
    const stand = await seite.evaluate(() => ({
      name: window.studio.zustand.name,
      felder: window.studio.zustand.formularfelder.length,
    }));
    if (!/flachformular/.test(stand.name)) throw new Error(`geladen: ${stand.name}`);
    if (stand.felder) throw new Error(`${stand.felder} Felder — dann ist es nicht flach`);
    return `${stand.name}, 0 Felder`;
  });

  await pruefe('Die Erkennung findet Linien, Kästchen und den Rahmen', async () => {
    const funde = await seite.evaluate(async () => {
      const m = await import('./app/felderkennen.js');
      const gefunden = await m.erkenneFelder(window.studio.zustand.folge);
      return gefunden.map((f) => ({ art: f.feldArt, grund: f.grund, name: f.name, b: Math.round(f.b), h: Math.round(f.h) }));
    });
    const nachGrund = (g) => funde.filter((f) => f.grund === g).length;
    if (nachGrund('Ausfülllinie') < 4) throw new Error(`nur ${nachGrund('Ausfülllinie')} Ausfülllinien`);
    if (nachGrund('Kästchen') !== 3) throw new Error(`${nachGrund('Kästchen')} Kästchen statt 3`);
    if (!funde.some((f) => f.grund === 'Rahmen' && f.art === 'mehrzeilig')) {
      throw new Error('der große Rahmen wurde nicht als mehrzeiliges Feld erkannt');
    }
    return `${funde.length} Funde: ${nachGrund('Ausfülllinie')} Linien, ${nachGrund('Kästchen')} Kästchen, ${nachGrund('Rahmen')} Rahmen`;
  });

  await pruefe('Die Namen kommen aus dem Text daneben', async () => {
    const namen = await seite.evaluate(async () => {
      const m = await import('./app/felderkennen.js');
      return (await m.erkenneFelder(window.studio.zustand.folge)).map((f) => f.name);
    });
    /* Nicht jeder Fund bekommt einen brauchbaren Namen — aber die vier
       beschrifteten Zeilen oben müssen ihre Beschriftung tragen, ohne
       Doppelpunkt. */
    for (const erwartet of ['Name', 'Vorname', 'Gremium', 'E-Mail']) {
      if (!namen.includes(erwartet)) throw new Error(`„${erwartet}" fehlt in: ${namen.join(', ')}`);
    }
    if (namen.some((n) => n.endsWith(':'))) throw new Error('ein Name trägt noch den Doppelpunkt');
    return namen.filter(Boolean).slice(0, 6).join(', ');
  });

  await pruefe('„Unterschrift:" wird zum Unterschriftsfeld', async () => {
    const art = await seite.evaluate(async () => {
      const m = await import('./app/felderkennen.js');
      const funde = await m.erkenneFelder(window.studio.zustand.folge);
      return funde.find((f) => /Unterschrift/i.test(f.name))?.feldArt || null;
    });
    if (art !== 'unterschrift') throw new Error(`erkannt als ${art}`);
    return 'unterschrift';
  });

  await pruefe('Die Tabelle mit Inhalt gilt nicht als Formular', async () => {
    /* Der wichtigste Fall. Die drei Tabellenzeilen sind Rechtecke wie der
       Anmerkungsrahmen — nur stehen sie voll Text. */
    const inTabelle = await seite.evaluate(async () => {
      const m = await import('./app/felderkennen.js');
      const funde = await m.erkenneFelder(window.studio.zustand.folge);
      /* Die Tabelle liegt zwischen y = 320 und y = 400 in PDF-Punkten. */
      return funde.filter((f) => f.y > 315 && f.y < 400).map((f) => `${f.grund} bei y=${Math.round(f.y)}`);
    });
    if (inTabelle.length) throw new Error(`${inTabelle.length} Funde in der Tabelle: ${inTabelle.join(', ')}`);
    return 'keine Zelle vorgeschlagen';
  });

  await pruefe('Der Dialog legt an, was angehakt ist — und schreibt es in die Datei', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('formular:erkennen'));
    await seite.waitForSelector('.fundzeile', { timeout: 60000 });
    const zeilen = await seite.evaluate(() => document.querySelectorAll('.fundzeile').length);
    if (zeilen < 8) throw new Error(`nur ${zeilen} Zeilen im Dialog`);

    /* Alles bis auf die erste Zeile abwählen — dann muss genau eines entstehen. */
    await seite.evaluate(() => {
      const haken = [...document.querySelectorAll('.fundzeile input[type=checkbox]')];
      haken.slice(1).forEach((k) => { k.checked = false; k.dispatchEvent(new Event('change')); });
    });
    await seite.click('.dialog-fuss .knopf:not(.knopf-still)');
    await seite.waitForTimeout(600);

    const entwuerfe = await seite.evaluate(() =>
      window.studio.zustand.anmerkungen.filter((a) => a.art === 'feldneu')
        .map((a) => ({ name: a.name, art: a.feldArt })));
    if (entwuerfe.length !== 1) throw new Error(`${entwuerfe.length} Entwürfe statt 1`);

    /* Und in der gesicherten Datei muss es ein echtes Formularfeld sein. */
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const felder = await seite.evaluate(async (daten) => {
      const pdfjs = await import('./fremd/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = './fremd/pdf.worker.mjs';
      const dok = await pdfjs.getDocument({ data: new Uint8Array(daten) }).promise;
      const anm = await (await dok.getPage(1)).getAnnotations();
      return anm.filter((a) => a.subtype === 'Widget').map((a) => a.fieldName);
    }, [...await (await import('node:fs/promises')).readFile(pfad)]);
    if (!felder.includes(entwuerfe[0].name)) {
      throw new Error(`„${entwuerfe[0].name}" steht nicht in der Datei: ${felder.join(', ')}`);
    }
    return `„${entwuerfe[0].name}" (${entwuerfe[0].art}) steht als Widget in der Datei`;
  });
}
