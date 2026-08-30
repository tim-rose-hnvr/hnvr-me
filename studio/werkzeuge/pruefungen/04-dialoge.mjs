/* Dialoge — die neuen Fenster, Mappen, Einstellungen und der Vergleich.

   Was sich über das Studio legt: öffnet es sich, trägt es den richtigen
   Titel, und schließt es sich wieder. */

import { join } from 'node:path';

export default async function ({ pruefe, seite, blatt, ladeBeispiel, dialogOffen, dialogSchliessen, WURZEL }) {
  console.log('\n== Neue Dialoge ==');

  await ladeBeispiel();

  for (const [befehl, ueberschrift] of [
    ['excel:ausgeben', 'Nach Excel ausgeben'],
    ['barrierefrei', 'Barrierefreiheit'],
    ['signieren', 'Digital unterschreiben'],
  ]) {
    await pruefe(`Dialog „${ueberschrift}" geht auf und wieder zu`, async () => {
      await seite.evaluate((b) => window.studio.fuehreAus(b), befehl);
      await seite.waitForTimeout(600);
      const titel = await seite.evaluate(() => document.querySelector('.dialog-kopf h2')?.textContent || '');
      if (titel !== ueberschrift) throw new Error(`Titel war „${titel}"`);
      await dialogSchliessen();
      if (await dialogOffen()) throw new Error('bleibt offen');
      return titel;
    });
  }

  await pruefe('Formularfeld-Werkzeug legt einen Entwurf an', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:feld'));
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
    const entwuerfe = await seite.evaluate(() => window.studio.zustand.anmerkungen.filter((a) => a.art === 'feldneu').length);
    if (entwuerfe !== 1) throw new Error(`${entwuerfe} Entwürfe`);
    const sichtbar = await seite.evaluate(() => document.querySelectorAll('.feld-entwurf').length);
    if (!sichtbar) throw new Error('der Entwurf ist auf der Seite nicht zu sehen');
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:auswahl'));
    return 'Rahmen gezogen, Feld angelegt, Platzhalter sichtbar';
  });


  console.log('\n== Mappen, Einstellungen, Gestaltung ==');

  /* Was im ersten Reiter schon liegt, wenn die Mappenprüfungen beginnen —
     die vorigen Abschnitte haben dort gearbeitet. */
  let ersterReiterAnmerkungen = 0;

  await pruefe('Titelleiste zeigt einen Reiter je Datei', async () => {
    ersterReiterAnmerkungen = await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
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
      const z = window.studio.zustand;
      z.anmerkungen.push({ id: 'probe-zwei', art: 'notiz', seiteId: z.folge[0].id, x: 50, y: 50, text: 'nur im zweiten Reiter', erstellt: Date.now() });
    });
    const hatProbe = () => seite.evaluate(() => window.studio.zustand.anmerkungen.some((a) => a.id === 'probe-zwei'));
    if (!await hatProbe()) throw new Error('die Probe kam im zweiten Reiter nicht an');

    await seite.locator('#dokument-reiter .dok-reiter').first().click();
    await seite.waitForTimeout(1200);
    /* Nicht die Anzahl vergleichen — die kann zufällig übereinstimmen. Die
       Frage ist, ob **diese** Anmerkung im anderen Reiter auftaucht. */
    if (await hatProbe()) throw new Error('die Anmerkung des zweiten Reiters steht auch im ersten');
    const imErsten = await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
    if (imErsten !== ersterReiterAnmerkungen) {
      throw new Error(`im ersten Reiter stehen ${imErsten} statt ${ersterReiterAnmerkungen} Anmerkungen`);
    }

    await seite.locator('#dokument-reiter .dok-reiter').nth(1).click();
    await seite.waitForTimeout(1200);
    if (!await hatProbe()) throw new Error('zurück im zweiten Reiter fehlt die Anmerkung');
    return 'die Probe steht nur im zweiten Reiter und übersteht den Wechsel';
  });

  await pruefe('Reiter schließen lässt die übrigen stehen', async () => {
    await seite.evaluate(() => { window.studio.zustand.geaendert = false; });
    await seite.locator('#dokument-reiter .dok-reiter').nth(1).locator('.dok-reiter-zu').click();
    await seite.waitForTimeout(1200);
    const uebrig = await seite.$$eval('#dokument-reiter .dok-reiter', (k) => k.length);
    if (uebrig !== 1) throw new Error(`${uebrig} Reiter übrig`);
    return 'einer übrig, aktiv';
  });

  await ladeBeispiel();

  await pruefe('Rechte Leiste hat vier Reiter, jeder mit Inhalt', async () => {
    /* Die drei Reiter des Handoffs zuerst, unser vierter dahinter. */
    const namen = await seite.$$eval('#reiter-rechts .reiter-knopf', (k) => k.map((x) => x.textContent));
    if (namen.join('|') !== 'Kommentare|Felder|Verlauf|Hinweise') throw new Error(namen.join('|'));
    const inhalte = [];
    for (const [tafel, id] of [['anmerkungen', '#tafel-kommentare'], ['felder', '#tafel-felder'],
      ['verlauf', '#tafel-verlauf'], ['mitdenken', '#tafel-rechts']]) {
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
    const felder = await seite.evaluate(() => window.studio.zustand.formularfelder.length);
    if (zeilen !== felder) throw new Error(`${zeilen} Zeilen für ${felder} Felder`);
    return `${zeilen} Felder aufgeführt`;
  });

  await pruefe('Verlaufstafel zeigt die letzten Schritte', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('seiten:drehenRechts'));
    await seite.waitForTimeout(500);
    await seite.click('[data-rtafel="verlauf"].reiter-knopf');
    await seite.waitForTimeout(400);
    const zeilen = await seite.$$eval('#tafel-verlauf .verlauf-zeile', (k) => k.length);
    if (!zeilen) throw new Error('leer');
    await seite.evaluate(() => window.studio.fuehreAus('rueckgaengig'));
    return `${zeilen} Schritte`;
  });

  await pruefe('Einstellungen wirken sofort', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('einstellungen'));
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
    const staerke = await seite.evaluate(() => window.studio.zustand.strichstaerke);
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
    /* Farben, Höhen und Schrift folgen weiter dem Handoff; die Radien nicht
       mehr — davon wurde auf Wunsch abgewichen, und die Staffel wird in
       „Die Radien folgen der Staffel" geprüft. Hier steht nur, dass ein Knopf
       den kleinsten Wert der Staffel trägt und nicht irgendeinen. */
    if (werte.radius !== '4px') throw new Error(`Knopfradius ${werte.radius} statt 4px`);
    if (!werte.schrift.includes('IBM Plex Sans')) throw new Error(`Schrift ${werte.schrift}`);
    if (!werte.plex) throw new Error('IBM Plex wurde nicht geladen');
    return 'Akzent, Chrome, Bühne, Papier, Knopfradius 4, IBM Plex geladen';
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
    await seite.evaluate(() => window.studio.fuehreAus('vergleich'));
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
}
