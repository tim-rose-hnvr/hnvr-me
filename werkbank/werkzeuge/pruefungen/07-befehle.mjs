/* Jeder Befehl einmal, und jeder Knopf in den neuen Dialogen.

   Die Fangprüfung: kein Befehl darf beim bloßen Auslösen einen Fehler in die
   Konsole schreiben, und kein Knopf darf ins Leere greifen. */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export default async function ({ pruefe, seite, ladeBeispiel, dialogSchliessen, ablage, fehlerStrom, befehle }) {
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
    const { unzipRoh } = await import('../zip-lesen.mjs');
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

  /* --- Der Formularhelfer --------------------------------------------------- */
  /* Sechs Dialoge bauen ihre Zeilen nicht mehr selbst, sondern beschreiben sie:
     `zeigeFormular` macht daraus Zeilen, Hinweise und die zwei Knöpfe unten.
     Geprüft wird nicht die Abkürzung, sondern was am Ende dasteht — und die
     eine Regel, die eine Abkürzung leicht verschluckt: `false` aus `tun` hält
     den Dialog offen. */
  console.log('\n== Der Formularhelfer ==');

  await pruefe('Ein Formulardialog baut Zeilen, Kästen und zwei Knoepfe', async () => {
    await ladeBeispiel();
    await seite.evaluate(() => window.werkbank.fuehreAus('word:ausgeben'));
    await seite.waitForSelector('.dialog select');
    const bau = await seite.evaluate(() => ({
      zeilen: [...document.querySelectorAll('.dialog .zeile')].map((z) => z.querySelector('label')?.textContent),
      auswahl: document.querySelectorAll('.dialog .zeile select').length,
      kaesten: document.querySelectorAll('.dialog .zeile input[type=checkbox]').length,
      knoepfe: [...document.querySelectorAll('.dialog-fuss .knopf')].map((k) => k.textContent),
    }));
    await dialogSchliessen();
    const erwartet = 'Umfang|Überschriften|Seiten';
    if (bau.zeilen.join('|') !== erwartet) throw new Error(`Zeilen: ${bau.zeilen.join(', ')}`);
    if (bau.auswahl !== 1 || bau.kaesten !== 2) throw new Error(`${bau.auswahl} Auswahl, ${bau.kaesten} Kästen`);
    if (bau.knoepfe.join('|') !== 'Abbrechen|Ausgeben') throw new Error(`Knöpfe: ${bau.knoepfe.join(', ')}`);
    return `${bau.zeilen.length} Zeilen, ${bau.knoepfe.join(' · ')}`;
  });

  await pruefe('Ankreuzfelder stehen in der Zeile, ohne eingebauten Stil', async () => {
    await seite.evaluate(() => window.werkbank.fuehreAus('word:ausgeben'));
    await seite.waitForSelector('.dialog .zeile-kasten');
    const stand = await seite.evaluate(() => {
      const stil = getComputedStyle(document.querySelector('.dialog .zeile-kasten'));
      return {
        mitStilangabe: document.querySelectorAll('.dialog label[style]').length,
        anzeige: stil.display,
        mindestbreite: stil.minWidth,
      };
    });
    await dialogSchliessen();
    if (stand.mitStilangabe) throw new Error(`${stand.mitStilangabe} Beschriftungen tragen noch einen eingebauten Stil`);
    if (stand.anzeige !== 'flex') throw new Error(`display: ${stand.anzeige}`);
    if (parseFloat(stand.mindestbreite) > 0) throw new Error(`min-width: ${stand.mindestbreite}`);
    return 'aus der Klasse, nicht aus dem Attribut';
  });

  await pruefe('Sagt der Dialog nein, bleibt er offen', async () => {
    await seite.evaluate(() => window.werkbank.fuehreAus('schutz:setzen'));
    await seite.waitForSelector('.dialog input[type=password]');
    /* Beide Kennwörter leer: ein Dokument ohne Kennwort wäre unverschlüsselt,
       also darf der Knopf nicht einfach schließen. */
    await seite.click('.dialog-fuss .knopf:not(.knopf-still)');
    await seite.waitForTimeout(400);
    const stand = await seite.evaluate(() => ({
      offen: !document.querySelector('#schirm').hidden,
      titel: document.querySelector('.dialog-kopf h2')?.textContent,
      meldung: document.querySelector('#meldungen')?.textContent || '',
    }));
    await dialogSchliessen();
    if (!stand.offen) throw new Error('Dialog hat trotzdem geschlossen');
    if (stand.titel !== 'Mit Kennwort schützen') throw new Error(`Titel: ${stand.titel}`);
    if (!/Kennwort/i.test(stand.meldung)) throw new Error(`keine Begründung: „${stand.meldung}"`);
    return stand.meldung.trim().slice(0, 48);
  });
}
