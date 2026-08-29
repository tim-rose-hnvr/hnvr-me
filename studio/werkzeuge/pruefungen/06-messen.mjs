/* Messen und Einlesen — Maßstab, Strecke, Fläche, und Fremdformate zu PDF. */

import { join } from 'node:path';

import { readFile } from 'node:fs/promises';

export default async function ({ pruefe, melde, seite, blatt, ladeBeispiel, ladungVon, ablage }) {
  console.log('\n== Messen und Einlesen ==');

  await pruefe('Eine Strecke messen zeigt die Länge auf der Seite', async () => {
    await ladeBeispiel();
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:messen'));
    const b = await blatt();
    const s1 = b.bei(0.2, 0.45), s2 = b.bei(0.7, 0.45);
    await seite.mouse.move(s1.x, s1.y);
    await seite.mouse.down();
    await seite.mouse.move(s2.x, s2.y, { steps: 8 });
    await seite.mouse.up();
    await seite.waitForTimeout(400);
    const marke = await seite.evaluate(() => document.querySelector('.messmarke')?.textContent || '');
    if (!/mm$/.test(marke)) throw new Error(`keine Maßzahl: „${marke}"`);
    const anzahl = await seite.evaluate(() => window.studio.zustand.anmerkungen.filter((a) => a.art === 'messen').length);
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
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:flaeche'));
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
    await seite.evaluate(() => window.studio.fuehreAus('messen:liste'));
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
        if (window.studio.zustand.name.endsWith('.pdf') && window.studio.zustand.name.startsWith('vertrag')) break;
      }
      return { name: window.studio.zustand.name, seiten: window.studio.zustand.folge.length };
    });
    if (!/^vertrag\.pdf$/.test(stand.name)) throw new Error(`heißt „${stand.name}"`);
    if (stand.seiten < 3) throw new Error(`nur ${stand.seiten} Seiten`);
    return `${stand.name}, ${stand.seiten} Seiten`;
  });

  await pruefe('Der Stapel-Dialog fragt nur, was die Schritte brauchen', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('stapel'));
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


  await pruefe('Linke Leiste: vier Reiter, „Dateien" nennt die Quellen', async () => {
    await ladeBeispiel();
    const namen = await seite.$$eval('#reiter-links .reiter-knopf', (k) => k.map((x) => x.textContent));
    if (namen.join('|') !== 'Seiten|Marken|Dateien|Suche') throw new Error(namen.join('|'));
    await seite.click('[data-tafel="dateien"].reiter-knopf');
    await seite.waitForTimeout(350);
    const stand = await seite.evaluate(() => ({
      karten: document.querySelectorAll('#tafel-dateien .dateikarte').length,
      text: (document.querySelector('#tafel-dateien .dateikarte')?.textContent || '').replace(/\s+/g, ' '),
      ablage: !!document.querySelector('#tafel-dateien .ablegeflaeche'),
    }));
    if (stand.karten !== 1) throw new Error(`${stand.karten} Karten`);
    if (!/5 von 5 Seiten/.test(stand.text)) throw new Error(`Karte sagt: ${stand.text}`);
    if (!stand.ablage) throw new Error('keine Ablegefläche');
    await seite.click('[data-tafel="miniaturen"].reiter-knopf');
    await seite.waitForTimeout(250);
    return stand.text.slice(0, 60);
  });

  await pruefe('Kommentarkarte trägt das Zitat aus dem Dokument', async () => {
    /* Handoff: Art-Chip, Mono-Stelle, darunter das Zitat in Serif-Kursiv mit
       goldener Kante. Das Zitat ist der markierte Seitentext, nicht der
       Kommentar — beides sind verschiedene Dinge. */
    await ladeBeispiel();
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:auswahl'));
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
    await seite.keyboard.press('h');
    await seite.waitForTimeout(500);

    await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
    await seite.waitForTimeout(400);
    const karte = await seite.evaluate(() => {
      const k = document.querySelector('#tafel-kommentare .faden');
      const zitat = k?.querySelector('.faden-zitat');
      const chip = k?.querySelector('.art-chip');
      return {
        zitat: zitat?.textContent || '',
        schrift: zitat ? getComputedStyle(zitat).fontFamily : '',
        neigung: zitat ? getComputedStyle(zitat).fontStyle : '',
        kante: zitat ? getComputedStyle(zitat).borderLeftColor : '',
        chip: chip?.textContent || '',
        chipSchrift: chip ? getComputedStyle(chip).fontFamily : '',
      };
    });
    if (!/Auftragnehmer/.test(karte.zitat)) throw new Error(`Zitat fehlt: „${karte.zitat}"`);
    if (!/Plex Serif/.test(karte.schrift)) throw new Error(`Zitat in ${karte.schrift}`);
    if (karte.neigung !== 'italic') throw new Error(`Zitat ist ${karte.neigung}`);
    if (!/212, 175, 55/.test(karte.kante)) throw new Error(`Kante ist ${karte.kante}`);
    if (karte.chip !== 'Markieren') throw new Error(`Chip sagt „${karte.chip}"`);
    if (!/Plex Mono/.test(karte.chipSchrift)) throw new Error(`Chip in ${karte.chipSchrift}`);
    return `„${karte.zitat.slice(0, 40)}…", Chip ${karte.chip}`;
  });

  await pruefe('Einstellungen: Abzeichen zeigen, was offen ist', async () => {
    /* Im Handoff tragen zwei Kategorien eine Zahl. Hier wird sie gerechnet —
       ein Abzeichen, das immer dieselbe Zahl zeigt, ist Zierrat. */
    const stand = await seite.evaluate(async () => {
      window.studio.fuehreAus('einstellungen');
      await new Promise((l) => setTimeout(l, 400));
      const zeilen = [...document.querySelectorAll('.einst-kategorie')];
      return zeilen.map((k) => ({
        name: k.querySelector('span')?.textContent,
        zahl: k.querySelector('.einst-abzeichen')?.textContent || null,
      }));
    });
    const anmerkungen = stand.find((k) => k.name === 'Anmerkungen');
    if (anmerkungen?.zahl !== '1') throw new Error(`Anmerkungen zeigt ${anmerkungen?.zahl}`);
    const ohne = stand.find((k) => k.name === 'Tastenkürzel');
    if (ohne?.zahl) throw new Error(`Tastenkürzel trägt ein Abzeichen: ${ohne.zahl}`);
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    return stand.filter((k) => k.zahl).map((k) => `${k.name} ${k.zahl}`).join(' · ');
  });

  /* --- Aufdruck: Wasserzeichen, Kopf- und Fußzeile ------------------------- */
  /* Der Aufdruck wird zweimal aus derselben Beschreibung gerechnet — einmal
     für die Bühne, einmal für die Datei. Genau das wird hier geprüft: dass
     beide dasselbe zeigen. Ein Wasserzeichen, das man sieht, aber nicht
     bekommt, wäre schlimmer als keines. */
  console.log('\n== Aufdruck ==');

  await pruefe('Der Aufdruck steht sofort auf der Bühne', async () => {
    await ladeBeispiel();
    const stand = await seite.evaluate(async () => {
      const a = await import('./app/aufdruck.js');
      a.setzeAufdruck({
        wasserzeichen: { text: 'ENTWURF', groesse: 64, winkel: 45, deckung: 0.12, farbe: '#1D2327' },
        fuss: { links: '', mitte: '', rechts: 'Seite {seite} von {seiten}', groesse: 9, farbe: '#5F686E', abstand: 28 },
        kopf: null,
      });
      return null;
    });
    await seite.waitForTimeout(1200);
    const gezeigt = await seite.evaluate(() => [...document.querySelectorAll('.blatt .aufdruckebene text')]
      .map((t) => t.textContent).slice(0, 4));
    if (!gezeigt.includes('ENTWURF')) throw new Error(`auf der Bühne: ${gezeigt.join(', ')}`);
    if (!gezeigt.some((t) => /Seite 1 von 5/.test(t))) throw new Error(`keine Seitenzahl: ${gezeigt.join(', ')}`);
    return gezeigt.join(' · ');
  });

  await pruefe('Die Felder werden je Seite neu gerechnet', async () => {
    const zeilen = await seite.evaluate(() => {
      const raus = [];
      for (const blatt of document.querySelectorAll('.blatt')) {
        const t = [...blatt.querySelectorAll('.aufdruckebene text')].map((k) => k.textContent);
        const nummer = blatt.querySelector('.blatt-nummer')?.textContent;
        const seitenzahl = t.find((x) => /^Seite /.test(x));
        if (seitenzahl) raus.push(`${nummer}:${seitenzahl}`);
      }
      return raus;
    });
    /* Nicht jede Seite ist gezeichnet — nur die im Blick. Was da ist, muss
       aber stimmen: die Nummer der Seite und die im Aufdruck gehören zusammen. */
    if (!zeilen.length) throw new Error('keine Seite mit Aufdruck gezeichnet');
    for (const z of zeilen) {
      const [nummer, text] = z.split(':');
      if (!text.startsWith(`Seite ${nummer} von 5`)) throw new Error(`Seite ${nummer} trägt „${text}"`);
    }
    return zeilen.join(' · ');
  });

  await pruefe('Und er steht danach wirklich in der Datei', async () => {
    const pfad = await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    const text = await seite.evaluate(async (daten) => {
      const pdfjs = await import('./fremd/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = './fremd/pdf.worker.mjs';
      const dok = await pdfjs.getDocument({ data: new Uint8Array(daten) }).promise;
      const raus = [];
      for (let n = 1; n <= dok.numPages; n++) {
        const inhalt = await (await dok.getPage(n)).getTextContent();
        raus.push(inhalt.items.map((i) => i.str).join(' '));
      }
      return raus;
    }, [...await readFile(pfad)]);
    if (!/ENTWURF/.test(text[0])) throw new Error('kein Wasserzeichen auf Seite 1');
    if (!/Seite 1 von 5/.test(text[0])) throw new Error('keine Fußzeile auf Seite 1');
    if (!/Seite 5 von 5/.test(text[4])) throw new Error('Seite 5 trägt die falsche Zahl');
    /* Und auf jeder Seite, nicht nur der ersten — das ist der ganze Unterschied
       zu einer Anmerkung. */
    const ohne = text.map((t, i) => (/ENTWURF/.test(t) ? null : i + 1)).filter(Boolean);
    if (ohne.length) throw new Error(`ohne Wasserzeichen: Seiten ${ohne.join(', ')}`);
    return `5 Seiten, jede mit Wasserzeichen und Zählung`;
  });

  await pruefe('„Ab Seite 3, Zählung beginnt bei 1" trägt auf Seite 3 die Eins', async () => {
    const gerechnet = await seite.evaluate(async () => {
      const a = await import('./app/aufdruck.js');
      a.setzeAufdruck({
        wasserzeichen: null, kopf: null,
        fuss: { rechts: '{seite} / {seiten}', links: '', mitte: '', groesse: 9, abstand: 28,
          ersteSeite: 3, beginntBei: 1 },
      });
      const raus = [];
      for (let n = 1; n <= 5; n++) {
        raus.push(a.befehleFuerSeite({ nummer: n, seitenzahl: 5, breitePt: 595, hoehePt: 842 })
          .map((b) => b.text).join('') || '—');
      }
      return raus;
    });
    /* Deckblatt und Inhaltsverzeichnis zählen nicht mit: Seite 1 und 2 bleiben
       leer, Seite 3 trägt die Eins, und die Gesamtzahl ist 3, nicht 5. */
    if (gerechnet.join('|') !== '—|—|1 / 3|2 / 3|3 / 3') throw new Error(gerechnet.join(' | '));
    return gerechnet.join(' · ');
  });

  await pruefe('Der Aufdruck-Dialog zeigt mit und nimmt zurück', async () => {
    await ladeBeispiel();
    await seite.evaluate(() => window.studio.fuehreAus('aufdruck'));
    await seite.waitForSelector('.dialog .aufdruck-drei');
    await seite.fill('.dialog input[type=checkbox] ~ .feld, .dialog .zeile:first-child .feld', 'VERTRAULICH');
    await seite.check('.dialog .zeile-kasten input[type=checkbox]');
    await seite.waitForTimeout(900);
    const inVorschau = await seite.evaluate(() => [...document.querySelectorAll('.blatt .aufdruckebene text')]
      .some((t) => t.textContent === 'VERTRAULICH'));
    if (!inVorschau) throw new Error('die Bühne zeigt nichts');
    /* Wegklicken heißt: nicht übernommen. Die Vorschau darf nicht stehen bleiben. */
    await seite.evaluate(() => document.querySelector('.dialog-kopf button').click());
    await seite.waitForTimeout(700);
    const bleibt = await seite.evaluate(() => ({
      aufdruck: !!window.studio.zustand.aufdruck,
      sichtbar: document.querySelectorAll('.blatt .aufdruckebene text').length,
    }));
    if (bleibt.aufdruck || bleibt.sichtbar) throw new Error('die Vorschau blieb nach dem Abbrechen stehen');
    return 'gezeigt, dann zurückgenommen';
  });
}
