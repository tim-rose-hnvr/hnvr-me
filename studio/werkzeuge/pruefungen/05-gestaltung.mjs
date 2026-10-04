/* Gestaltung — gegen die vereinbarte Richtung gelegt, nicht gegen die eigene
   Meinung.

   Diese Gruppe misst gerenderte Pixel: Farben, Zeilenhöhen, Spaltenbreiten,
   Radien, Schriftschnitte. Sie ist entstanden, nachdem zweimal behauptet
   wurde, die Gestaltung stimme — und zweimal stimmte sie nicht.

   Die Richtung heißt „Vorgang": die Einheit ist nicht die Datei, sondern der
   Vorgang. Es gibt eine Leiste statt vier — kein Menüband, keine Statusleiste
   über die ganze Breite. Farbe bedeutet Zustand, nie Marke: der Akzent ist
   kein Farbton, sondern der stärkste Kontrast zum Grund. */

import { join } from 'node:path';

export default async function ({ pruefe, seite, blatt, ladeBeispiel, BASIS, ablage, WURZEL }) {
  console.log('\n== Gestaltung nach der Richtung ==');

  await pruefe('Schrift und Abstand halten sich an die Staffel', async () => {
    /* Vorher standen 21 Schriftgrößen und 15 Abstandswerte nebeneinander,
       teils px, teils rem. Keiner war falsch; zusammen waren sie keine
       Gestaltung, sondern eine Ansammlung.

       Diese Prüfung liest den Quelltext, nicht den Bildschirm — eine Größe
       schleicht sich beim Schreiben ein, nicht beim Rendern. Sie ist die
       einzige Stelle, an der eine neue Stufe verhandelt werden muss. */
    const { readFile } = await import('node:fs/promises');
    const css = await readFile(join(WURZEL, 'app', 'stil.css'), 'utf8');

    const frei = [...css.matchAll(/font-size: (?!var\()([^;]+)/g)].map((t) => t[1].trim());
    if (frei.length) throw new Error(`Schriftgröße ohne Staffel: ${[...new Set(frei)].join(', ')}`);

    /* Die Staffel selbst darf Zahlen nennen — sie ist die Staffel. Geprüft
       wird alles danach. */
    const ohneWurzel = css.slice(css.indexOf('* { box-sizing'));
    const daneben = new Set();
    for (const t of ohneWurzel.matchAll(/\b(?:padding|margin|gap)(?:-[a-z]+)?: ([^;{}]+)/g)) {
      /* `calc()` rechnet mit Umgebungswerten (Aussparung, Leistenhöhe, halbe
         Griffhöhe) und wird hier nicht zerlegt — die Zahl darin ist ein
         Zuschlag, kein Maß. Und 1 px ist die Haarlinie, keine Stufe. */
      if (t[1].includes('calc(')) continue;
      for (const zahl of t[1].matchAll(/\b([0-9.]+)px/g)) {
        if (zahl[1] !== '1') daneben.add(`${zahl[1]}px`);
      }
      /* Diese Prüfung hat lange nur px gesehen. Zwanzig Abstände standen in
         rem und kamen ungeprüft durch — das ist der Unterschied zwischen
         einer Regel und einer Behauptung. Andere Einheiten (vh, %, ch)
         beziehen sich auf das Fenster oder den Text und sind keine Stufen. */
      for (const zahl of t[1].matchAll(/\b([0-9.]+)rem/g)) daneben.add(`${zahl[1]}rem`);
    }
    if (daneben.size) throw new Error(`Abstand außerhalb der Staffel: ${[...daneben].join(', ')}`);

    /* Und die Radien im Quelltext. „Es gibt keine Radien" prüft den Bildschirm
       und kommt an das Schatten-DOM nicht heran — Bahn und Griff eines
       Schiebereglers liegen dort, und der Browser macht sie rund, wenn man
       ihn lässt. Hier zählt, was geschrieben steht. */
    const rundeWerte = [...css.matchAll(/border-radius: ([^;]+)/g)]
      .map((t) => t[1].trim())
      /* Was aus der Staffel kommt oder erbt, ist in Ordnung — die Staffel ist
         null. Übrig bleiben darf dann nur noch eine Null. */
      .filter((w) => w.replace(/var\(--radius[a-z-]*\)/g, '').replace(/\binherit\b/g, '')
        .replace(/\b0\b/g, '').trim() !== '');
    if (rundeWerte.length) throw new Error(`Radius im Quelltext: ${[...new Set(rundeWerte)].join(', ')}`);
    const ausStufe = (css.match(/var\(--raum-/g) || []).length;
    return `10 Schriftstufen an ${css.match(/font-size: var\(/g).length} Stellen, `
      + `9 Raumstufen an ${ausStufe}`;
  });

  /* Die Richtung nennt Höhen, Breiten und Farben auf den Pixel und den Hexwert
     genau. Sie hier nachzumessen ist der einzige Weg, der nicht darauf
     hinausläuft, zwei Bildschirmabzüge nebeneinanderzuhalten. */
  const REG = {
    /* Atelier-Entwurf („PDF-Editor"): Menüleiste 64, Navigation 190,
       Dokumentkopf 74, Modusleiste 54, Statuszeile 30. Die Seitenleiste ist
       breiter als im Entwurf (220 statt 158), weil sie vier Reiter trägt. */
    kopf: 64, navi: 190, dokumentkopf: 74, modusleiste: 54, fuss: 30,
    links: 220, rechts: 318,
    /* Olivgraue Leiste #2B2F2A, Bühne #E8DFD2, Kupfer #C78B5F als Fläche mit
       Tinte darauf — kein Weiß auf Kupfer. */
    chrome900: 'rgb(43, 47, 42)',
    buehne: 'rgb(232, 223, 210)',
    papier: 'rgb(255, 255, 255)',
    akzent: 'rgb(199, 139, 95)',
    akzentText: 'rgb(43, 47, 42)',
    chromeText: 'rgb(255, 254, 250)',
  };

  await pruefe('Die Höhen der Chrome stimmen auf den Pixel', async () => {
    await ladeBeispiel();
    const masse = await seite.evaluate(() => {
      const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
      const b = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
      return { kopf: h('.kopf'), navi: b('.atelier-navi'), dokumentkopf: h('.dokumentkopf'),
        modusleiste: h('.modusleiste'), fuss: h('.fuss'),
        links: b('.leiste-links'), rechts: b('.leiste-rechts') };
    });
    for (const [name, soll] of Object.entries(REG)) {
      if (typeof soll !== 'number') continue;
      if (masse[name] !== soll) throw new Error(`${name}: ${masse[name]} statt ${soll}`);
    }
    return Object.entries(masse).map(([k, v]) => `${k} ${v}`).join(' · ');
  });

  await pruefe('Die Farben sind die aus dem Handoff', async () => {
    const farben = await seite.evaluate(() => {
      const f = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
      return { kopf: f('.kopf'), buehne: f('#buehne'), blatt: f('.blatt') };
    });
    const soll = { kopf: REG.chrome900, buehne: REG.buehne, blatt: REG.papier };
    for (const [name, wert] of Object.entries(soll)) {
      if (farben[name] !== wert) throw new Error(`${name}: ${farben[name]} statt ${wert}`);
    }
    return `Chrome ${farben.kopf} · Bühne ${farben.buehne} · Papier ${farben.blatt}`;
  });

  await pruefe('Die Bühne ist zu sehen — die Seite steht darauf, füllt sie nicht', async () => {
    /* Der auffälligste Unterschied zum Mockup war nicht eine Farbe, sondern die
       Voreinstellung des Zooms: „Breite" blies die Seite auf die ganze Bühne,
       und aus dem Leuchttisch wurde ein Textfenster. Gemessen wird deshalb, was
       man sieht — wie viel Bühne links und rechts der Seite bleibt. */
    await ladeBeispiel();
    const lage = await seite.evaluate(() => {
      const blatt = document.querySelector('.blatt').getBoundingClientRect();
      const buehne = document.querySelector('#buehne').getBoundingClientRect();
      return {
        blattBreite: Math.round(blatt.width),
        buehneBreite: Math.round(buehne.width),
        randLinks: Math.round(blatt.left - buehne.left),
        zoom: String(window.studio.zustand.zoom),
      };
    });
    if (lage.zoom !== '1') throw new Error(`Voreinstellung ist „${lage.zoom}"`);
    if (Math.abs(lage.blattBreite - 720) > 6) throw new Error(`Seite ${lage.blattBreite} px statt 720`);
    if (lage.randLinks < 26) throw new Error(`nur ${lage.randLinks} px Bühne links`);
    return `Seite ${lage.blattBreite} px auf ${lage.buehneBreite} px Bühne, ${lage.randLinks} px Rand`;
  });

  await pruefe('Bei der Fensterbreite des Mockups stehen beide Leisten', async () => {
    /* Unter 1400 px geben die Leisten nach, nicht das Dokument: sonst wird
       das Blatt beschnitten, und genau das war einmal so — 24 px Bühne neben
       einer 720-px-Seite. Geprüft wird deshalb über dem Umbruchpunkt. */
    await seite.setViewportSize({ width: 1500, height: 900 });
    await seite.waitForTimeout(900);
    const lage = await seite.evaluate(() => {
      const l = document.querySelector('.leiste-links').getBoundingClientRect();
      const r = document.querySelector('.leiste-rechts').getBoundingClientRect();
      const b = document.querySelector('#buehne').getBoundingClientRect();
      return {
        links: Math.round(l.width), rechts: Math.round(r.width), buehne: Math.round(b.width),
        linksSteht: Math.round(l.left) === Math.round(document.querySelector('.atelier-navi').getBoundingClientRect().right),
        rechtsSteht: Math.round(r.right) <= 1501,
      };
    });
    await seite.setViewportSize({ width: 1500, height: 950 });
    await seite.waitForTimeout(900);
    if (lage.links !== REG.links) throw new Error(`linke Leiste ${lage.links} px`);
    if (lage.rechts !== REG.rechts) throw new Error(`rechte Leiste ${lage.rechts} px`);
    /* Links neben der Seitenleiste steht die Navigation des Ateliers. */
    if (!lage.linksSteht || !lage.rechtsSteht) throw new Error('eine Leiste liegt über der Bühne');
    return `${REG.links} + ${lage.buehne} + ${REG.rechts}`;
  });

  await pruefe('Die Werkzeuge tragen die Wörter des Entwurfs — unter ihrem Modus', async () => {
    /* Markieren, Kommentar, Text bearbeiten, Seiten ordnen — die Wörter des
       Entwurfs, nicht unsere eigenen. Jeder Modus der Modusleiste bringt seine
       Werkzeuge in den Inspektor mit; die Prüfung schaltet jeden Modus ein und
       sammelt ein, was dort steht. Signieren und Schwärzen stehen als große
       Taten im Dokumentkopf. */
    const stand = await seite.evaluate(async () => {
      const gesammelt = [];
      const modi = [...document.querySelectorAll('#modi .modus')].map((k) => k.dataset.modus);
      for (const modus of modi) {
        document.querySelector(`#modi .modus[data-modus="${modus}"]`).click();
        await new Promise((l) => setTimeout(l, 150));
        gesammelt.push(...[...document.querySelectorAll('.inspektor-werkzeug')].map((k) => k.textContent.trim()));
      }
      window.studio.fuehreAus('werkzeug:auswahl');
      const kopf = [...document.querySelectorAll('.dokument-taten .knopf')].map((k) => k.textContent.trim());
      return { modi, gesammelt, kopf };
    });
    if (stand.modi.join('|') !== 'bearbeiten|kommentieren|organisieren|exportieren') throw new Error(`Modi: ${stand.modi.join(', ')}`);
    for (const wort of ['Auswahl', 'Text bearbeiten', 'Markieren', 'Kommentar',
      'Formularfeld anlegen', 'Seiten ordnen', 'Word (.docx)']) {
      if (!stand.gesammelt.includes(wort)) throw new Error(`„${wort}" fehlt — da steht: ${stand.gesammelt.join(', ')}`);
    }
    for (const wort of ['Signieren', 'Schwärzen']) {
      if (!stand.kopf.includes(wort)) throw new Error(`„${wort}" fehlt im Dokumentkopf`);
    }
    await ladeBeispiel();
    return `${stand.gesammelt.filter((w) => w !== 'Weitere Werkzeuge …').length} Werkzeuge in 4 Modi; im Kopf ${stand.kopf.join(' · ')}`;
  });

  await pruefe('Der Empfang trägt dieselbe Sprache wie das Programm', async () => {
    /* Er war das Einzige, was nie ein Vorbild hatte: eine graue Fläche mit einer
       weißen Karte, und der Knopf, den man drücken soll, war nicht einmal
       akzentfarben. */
    await seite.goto(BASIS);
    await seite.waitForTimeout(1400);
    const stand = await seite.evaluate(() => {
      /* Der Start ist das Deckblatt des Entwurfs (Figma „PDF Studio ·
         Dokumentenatelier"): dieselbe Hülle wie der Editor, aber hell — die
         Menüzeile liegt auf dem Papier, 54 px hoch, links keine Navigation,
         die Ansichten als Reiter unter der Wortmarke. */
      const kopf = document.querySelector('.kopf');
      const oeffnen = document.querySelector('#knopf-oeffnen');
      const aktiv = document.querySelector('.start-reiter[aria-current="page"]');
      return {
        kopfGrund: kopf ? getComputedStyle(kopf).backgroundColor : null,
        grund: getComputedStyle(document.documentElement).getPropertyValue('--grund').trim(),
        kopfHoehe: kopf ? Math.round(kopf.getBoundingClientRect().height) : 0,
        navi: getComputedStyle(document.querySelector('.atelier-navi')).display,
        reiter: [...document.querySelectorAll('.start-reiter')].map((r) => r.textContent.trim()),
        aktiv: aktiv ? { text: aktiv.textContent.trim(), farbe: getComputedStyle(aktiv).color, kante: getComputedStyle(aktiv).borderBottomWidth } : null,
        einstellungen: getComputedStyle(document.querySelector('#kopf-einstellungen')).display,
        knopf: getComputedStyle(oeffnen).backgroundColor,
        rost: getComputedStyle(document.documentElement).getPropertyValue('--rost-voll').trim(),
        titelSchrift: getComputedStyle(document.querySelector('.empfang h1')).fontFamily,
        ablage: !!document.querySelector('.empfang-ablage'),
        formate: (document.querySelector('.empfang-ablage .mono')?.textContent || ''),
      };
    });
    if (stand.kopfGrund !== 'rgb(246, 241, 232)' || stand.grund.toUpperCase() !== '#F6F1E8') throw new Error(`Kopf ist ${stand.kopfGrund}`);
    if (stand.kopfHoehe !== 54) throw new Error(`Kopf ist ${stand.kopfHoehe} px`);
    if (stand.navi !== 'none') throw new Error('auf dem Deckblatt steht die Navigation links');
    if (stand.reiter.join('|') !== 'Start|Dokumente|Editor|Vertraulich teilen') throw new Error(`Reiter: ${stand.reiter.join(', ')}`);
    if (stand.aktiv?.text !== 'Start' || stand.aktiv.farbe !== 'rgb(174, 78, 45)' || stand.aktiv.kante !== '4px') throw new Error(`aktiver Reiter: ${JSON.stringify(stand.aktiv)}`);
    if (stand.einstellungen === 'none') throw new Error('die Einstellungen fehlen oben');
    /* „Datei öffnen" ist der eine rostrote Knopf der Startseite (--rost-voll). */
    if (stand.rost.toUpperCase() !== '#AE4E2D' || stand.knopf !== 'rgb(174, 78, 45)') throw new Error(`„Datei öffnen" ist ${stand.knopf}`);
    /* Der Titel steht in der Anzeigeschrift des Ateliers. */
    if (!/Bodoni Moda/.test(stand.titelSchrift)) throw new Error(`Titel in ${stand.titelSchrift}`);
    if (!stand.ablage) throw new Error('keine Ablegefläche');
    if (!/DOCX/.test(stand.formate)) throw new Error(`Formate: ${stand.formate}`);
    await ladeBeispiel();
    /* Mit offenem Dokument ist die Hülle wieder die des Editors. */
    const editor = await seite.evaluate(() => ({
      kopf: getComputedStyle(document.querySelector('.kopf')).backgroundColor,
      navi: getComputedStyle(document.querySelector('.atelier-navi')).display,
    }));
    if (editor.kopf !== REG.chrome900 || editor.navi === 'none') throw new Error(`Editor: Kopf ${editor.kopf}, Navigation ${editor.navi}`);
    return `Deckblatt hell, Kopf ${stand.kopfHoehe} px, Reiter ${stand.reiter.length}; Editor dunkel`;
  });

  await pruefe('Leere Tafeln sagen, was dort stünde — und wie es dorthin kommt', async () => {
    /* „Noch nichts geändert." allein ist eine Absage. Ein Leerzustand hat drei
       Teile: Zeichen, Satz, Weg. */
    const stand = await seite.evaluate(async () => {
      const raus = {};
      /* Das Beispiel bringt ein Formular mit — für den leeren Fall wird es
         kurz beiseitegelegt und danach zurückgegeben. */
      const felder = window.studio.zustand.formularfelder;
      window.studio.zustand.formularfelder = [];
      for (const [reiter, tafel] of [['verlauf', '#tafel-verlauf'], ['anmerkungen', '#tafel-kommentare'],
        ['felder', '#tafel-felder']]) {
        document.querySelector(`[data-rtafel="${reiter}"].reiter-knopf`).click();
        await new Promise((l) => setTimeout(l, 300));
        const bild = document.querySelector(`${tafel} .leerbild`);
        raus[reiter] = bild ? {
          zeichen: !!bild.querySelector('.leerbild-zeichen'),
          titel: bild.querySelector('.leerbild-titel')?.textContent || '',
          satz: (bild.querySelector('.leerbild-satz')?.textContent || '').length,
          tat: bild.querySelector('.leerbild-tat')?.textContent || null,
        } : null;
      }
      window.studio.zustand.formularfelder = felder;
      document.querySelector('[data-rtafel="anmerkungen"].reiter-knopf').click();
      return raus;
    });
    for (const [name, teil] of Object.entries(stand)) {
      if (!teil) throw new Error(`${name} hat kein Leerbild`);
      if (!teil.zeichen) throw new Error(`${name}: kein Zeichen`);
      if (teil.satz < 30) throw new Error(`${name}: Satz zu kurz (${teil.satz})`);
    }
    if (!stand.anmerkungen.tat) throw new Error('Kommentare nennen keinen Weg');
    if (!stand.felder.tat) throw new Error('Felder nennen keinen Weg');
    return Object.entries(stand).map(([n, t]) => `${n}: „${t.titel}"`).join(' · ');
  });

  await pruefe('In der dunklen Fassung ist die Bühne der dunkelste Grund', async () => {
    /* Sie war heller als die Tafeln daneben — dann liegt das Blatt nicht auf
       einem Tisch, sondern in einem Kasten. */
    const hell = (farbe) => farbe.match(/\d+/g).slice(0, 3).reduce((a, b) => a + Number(b), 0);
    await ladeBeispiel();
    const werte = await seite.evaluate(() => {
      document.documentElement.dataset.thema = 'dunkel';
      try {
        const g = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
        return { buehne: g('#buehne'), tafel: g('.leiste-links'), chrome: g('.kopf'), blatt: g('.blatt') };
      } finally {
        /* Ohne dieses `finally` blieb nach einem Fehlschlag die dunkle Fassung
           stehen, und jede folgende Farbmessung maß das Falsche. */
        document.documentElement.dataset.thema = 'system';
      }
    });
    if (hell(werte.buehne) >= hell(werte.tafel)) {
      throw new Error(`Bühne ${werte.buehne} ist nicht dunkler als die Tafel ${werte.tafel}`);
    }
    if (hell(werte.blatt) <= hell(werte.tafel)) throw new Error('das Blatt ist nicht das Hellste');
    return `Bühne ${werte.buehne} < Tafel ${werte.tafel} < Blatt ${werte.blatt}`;
  });

  await pruefe('Schrift auf dem Akzent ist in beiden Fassungen lesbar', async () => {
    /* Der Vollknopf trug `color: #fff`. Im Hellen liegt der Akzent dunkel und
       das stimmt; im Dunkeln liegt er hell, und weiße Schrift darauf kam auf
       1,6:1 — sichtbar erst im Bildschirmabzug, nie im Quelltext.

       Gemessen wird nach WCAG: Leuchtdichte beider Farben, Verhältnis. Alles
       unter 4,5:1 ist durchgefallen. */
    await ladeBeispiel();
    const werte = {};
    for (const thema of ['hell', 'dunkel']) {
      await seite.evaluate((t) => { document.documentElement.dataset.thema = t; }, thema);
      /* Der Knopf blendet seine Farbe in 120 ms um. Wer sofort misst, misst
         einen Zwischenstand — 2,7:1 zwischen zwei Farben, die beide gut sind.
         Das hat diese Prüfung beim ersten Lauf selbst getan. */
      await seite.waitForTimeout(300);
      werte[thema] = await seite.evaluate(() => {
        const leucht = (farbe) => {
          const [r, g, b] = farbe.match(/\d+/g).slice(0, 3).map(Number)
            .map((k) => k / 255).map((k) => (k <= .03928 ? k / 12.92 : ((k + .055) / 1.055) ** 2.4));
          return .2126 * r + .7152 * g + .0722 * b;
        };
        const verhaeltnis = (a, b) => {
          const [x, y] = [leucht(a), leucht(b)].sort((p, q) => q - p);
          return (x + .05) / (y + .05);
        };
        const raus = {};
        for (const [name, wahl] of [['sichern', '#knopf-sichern'],
          ['werkzeug', '.werkzeug.ist-aktiv'], ['marke', '.art-chip']]) {
          const k = document.querySelector(wahl);
          if (!k) continue;
          const stil = getComputedStyle(k);
          raus[name] = Math.round(verhaeltnis(stil.backgroundColor, stil.color) * 10) / 10;
        }
        return raus;
      });
    }
    await seite.evaluate(() => { document.documentElement.dataset.thema = 'system'; });
    await seite.waitForTimeout(300);
    const schwach = [];
    for (const [thema, stellen] of Object.entries(werte)) {
      for (const [name, wert] of Object.entries(stellen)) {
        if (wert < 4.5) schwach.push(`${thema}/${name}: ${wert}:1`);
      }
    }
    if (schwach.length) throw new Error(`zu schwach: ${schwach.join(', ')}`);
    return Object.entries(werte).map(([t, w]) =>
      `${t} ${Object.entries(w).map(([n, v]) => `${n} ${v}:1`).join(' · ')}`).join(' | ');
  });

  await pruefe('Was auf dem Papier liegt, folgt der Fassung nicht', async () => {
    /* Das Blatt ist in beiden Fassungen dasselbe Blatt — die Seite wird als
       Bild gezeichnet und kippt nicht mit. Alles, was darüberliegt, muss
       deshalb eigene Werte haben.

       Aufgefallen ist das erst, als derselbe Bildschirm in Figma einmal hell
       und einmal dunkel nebeneinander stand: weiße Schrift auf weißem Papier.
       Nachgemessen war der Formularfeldrahmen in der dunklen Fassung bei
       2,0:1 und die Tinte bei 1,2:1. */
    await ladeBeispiel();
    const werte = {};
    for (const thema of ['hell', 'dunkel']) {
      await seite.evaluate((t) => { document.documentElement.dataset.thema = t; }, thema);
      await seite.waitForTimeout(300);
      werte[thema] = await seite.evaluate(() => {
        const leucht = (f) => {
          const [r, g, b] = f.match(/\d+/g).slice(0, 3).map(Number).map((k) => k / 255)
            .map((k) => (k <= .03928 ? k / 12.92 : ((k + .055) / 1.055) ** 2.4));
          return .2126 * r + .7152 * g + .0722 * b;
        };
        const verh = (a, b) => {
          const [x, y] = [leucht(a), leucht(b)].sort((p, q) => q - p);
          return Math.round((x + .05) / (y + .05) * 10) / 10;
        };
        const hexZuRgb = (h) => {
          const n = parseInt(h.trim().slice(1), 16);
          return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
        };
        const w = getComputedStyle(document.documentElement);
        const papier = getComputedStyle(document.querySelector('.blatt')).backgroundColor;
        const raus = { papier };
        for (const name of ['papier-tinte', 'papier-leise', 'papier-akzent']) {
          raus[name] = verh(papier, hexZuRgb(w.getPropertyValue('--' + name)));
        }
        return raus;
      });
    }
    await seite.evaluate(() => { document.documentElement.dataset.thema = 'system'; });
    await seite.waitForTimeout(300);

    if (werte.hell.papier !== werte.dunkel.papier) {
      throw new Error(`das Blatt wechselt die Farbe: ${werte.hell.papier} / ${werte.dunkel.papier}`);
    }
    const schwach = [];
    for (const [thema, stellen] of Object.entries(werte)) {
      for (const [name, wert] of Object.entries(stellen)) {
        if (name === 'papier') continue;
        const grenze = name === 'papier-leise' ? 4.5 : 4.5;
        if (wert < grenze) schwach.push(`${thema}/${name}: ${wert}:1`);
        if (werte.hell[name] !== werte.dunkel[name]) {
          schwach.push(`${name} unterscheidet sich zwischen den Fassungen`);
        }
      }
    }
    if (schwach.length) throw new Error([...new Set(schwach)].join(', '));
    return `Papier ${werte.hell.papier} in beiden · Tinte ${werte.hell['papier-tinte']}:1 · `
      + `Randvermerk ${werte.hell['papier-leise']}:1 · Feldrahmen ${werte.hell['papier-akzent']}:1`;
  });

  await pruefe('Der Primärknopf im Dokumentkopf ist akzentfarben', async () => {
    /* Er war einmal weiß: `.knopf-voll` stand oberhalb von `.knopf` und wurde
       von dessen Grundwerten überschrieben. Gleiche Spezifität, spätere Regel
       gewinnt — im Bildschirmabzug sofort zu sehen, im Quelltext nicht. */
    const stand = await seite.evaluate(() => {
      /* Wie im Entwurf ist „Vertraulich teilen" der Hauptknopf im Dokumentkopf. */
      const voll = getComputedStyle(document.querySelector('#knopf-teilen'));
      const chrome = getComputedStyle(document.querySelector('#knopf-einstellungen'));
      return { voll: voll.backgroundColor, vollText: voll.color, chromeText: chrome.color };
    });
    if (stand.voll !== REG.akzent) throw new Error(`„Vertraulich teilen" ist ${stand.voll}`);
    /* Zwei verschiedene Schriftfarben, und das ist richtig so: auf dem
       Akzent steht --tally-text, auf der Leiste --leiste-text. Beide kippen
       mit der Fassung, deshalb kann keine zu schwach werden. */
    if (stand.vollText !== REG.akzentText) throw new Error(`Schrift auf dem Akzent ist ${stand.vollText}`);
    if (stand.chromeText !== REG.chromeText) throw new Error(`Einstellungen ist ${stand.chromeText}`);
    return `Vertraulich teilen ${stand.voll}`;
  });

  await pruefe('Rückgängig und Wiederholen stehen in der Modusleiste', async () => {
    /* Wie im Entwurf: hinter den Modi, durch einen Strich getrennt. Sie
       gehören zu keinem Modus, sondern zum Dokument.

       Die beiden sind außerdem die einzigen Knöpfe ohne Wort, die bleiben
       durften — zwei Pfeile sind das einzige Zeichenpaar, bei dem die stille
       Annahme wirklich trägt. */
    const stand = await seite.evaluate(() => {
      const feld = document.querySelector('#kopf-verlauf');
      const knoepfe = [...(feld?.querySelectorAll('button') || [])];
      const kopf = document.querySelector('.modusleiste').getBoundingClientRect();
      return {
        imKopf: knoepfe.length > 0 && knoepfe.every((k) => {
          const kasten = k.getBoundingClientRect();
          return kasten.top >= kopf.top - 1 && kasten.bottom <= kopf.bottom + 1;
        }),
        namen: knoepfe.map((k) => k.getAttribute('aria-label')),
        gesperrt: knoepfe.map((k) => k.disabled),
        inSchiene: document.querySelectorAll('#inspektor-kopf #knopf-rueckgaengig').length,
      };
    });
    if (stand.namen.join() !== 'Rückgängig,Wiederholen') throw new Error(`da steht: ${stand.namen.join(', ')}`);
    if (!stand.imKopf) throw new Error('ein Knopf steht nicht in der Modusleiste');
    if (stand.inSchiene) throw new Error('der Verlauf steht im Inspektor');
    /* Solange nichts geschehen ist, sind beide gesperrt. Ein Knopf, der nichts
       tun kann und trotzdem bedienbar aussieht, ist ein Versprechen ins Leere. */
    if (!stand.gesperrt.every(Boolean)) throw new Error('ohne Historie ist ein Knopf bedienbar');
    return `${stand.namen.join(' · ')}, beide gesperrt, solange nichts geschah`;
  });

  await pruefe('Es gibt keine Werkzeugzeile mehr — und kein Werkzeug ging verloren', async () => {
    /* Die Zeile trug fünfzehn Werkzeuge, von denen bei 944 px zwölf sichtbar
       waren. Sie ist aufgelöst. Der Beweis, dass das kein Verlust war: jedes
       Werkzeug ist über das Befehlsfeld erreichbar. */
    const stand = await seite.evaluate(async () => {
      const zeile = document.querySelector('.werkzeugzeile');
      document.querySelector('#knopf-befehle').click();
      await new Promise((l) => setTimeout(l, 300));
      const feld = document.querySelector('.dialog input');
      feld.value = 'Werkzeug:';
      feld.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((l) => setTimeout(l, 300));
      const treffer = [...document.querySelectorAll('.palette-treffer')].map((k) => k.textContent);
      return { zeile: !!zeile, treffer: treffer.length };
    });
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    if (stand.zeile) throw new Error('die Werkzeugzeile steht noch im Baum');
    if (stand.treffer < 15) throw new Error(`nur ${stand.treffer} Werkzeuge im Befehlsfeld`);
    return `keine Zeile, ${stand.treffer} Werkzeuge im Befehlsfeld`;
  });

  await pruefe('Radien nur dort, wo etwas bedienbar ist — Papier bleibt eckig', async () => {
    /* „Registratur" kannte keine Radien. Die Apple-Anmutung hat vier Stufen
       wie macOS — 8 für Knöpfe und Felder, 10 für Karten, 14 für Fenster,
       rund für Kapseln — und 6 für das Segment in seiner Rinne (8 minus die
       2 px Innenabstand, sonst stoßen die Ecken aneinander).
       Das Blatt und die Leisten bleiben eckig: ein Blatt ist ein Blatt, und
       eine Leiste, die am Fensterrand klebt, bekäme sonst einen Spalt. */
    /* Im Atelier schmale Kanten: 4 für Knöpfe, Felder, Karten und Dialoge,
       3 für Marken und Segmente — und rund für Kapseln. */
    const ERLAUBT = [0, 3, 4, 999];
    const daneben = await seite.evaluate((erlaubt) => {
      const raus = [];
      for (const k of document.querySelectorAll('#huelle *')) {
        for (const wert of getComputedStyle(k).borderRadius.split(/[\s/]+/).filter(Boolean)) {
          const px = parseFloat(wert);
          if (!Number.isFinite(px)) continue;
          if (!erlaubt.includes(Math.round(px)) && Math.round(px) < 100) {
            raus.push(`${k.className || k.tagName}:${wert}`);
            break;
          }
        }
      }
      return [...new Set(raus)].slice(0, 8);
    }, ERLAUBT);
    if (daneben.length) throw new Error(`außerhalb der Staffel: ${daneben.join(', ')}`);

    const eckig = await seite.evaluate(() => {
      const muss = ['.blatt', '.blatt canvas', '.kopf', '.leiste-links', '.leiste-rechts', '#buehne'];
      const falsch = [];
      for (const wahl of muss) {
        for (const k of document.querySelectorAll(wahl)) {
          const r = getComputedStyle(k).borderRadius;
          if (parseFloat(r) > 0) falsch.push(`${wahl}:${r}`);
        }
      }
      return falsch;
    });
    if (eckig.length) throw new Error(`sollte eckig sein: ${eckig.join(', ')}`);
    return 'Staffel 0/3/4 eingehalten, Papier und Leisten eckig';
  });

  await pruefe('Die Einstellungen sind eine Seite — und der Knopf öffnet sie richtig', async () => {
    /* Über den Knopf, nicht über den Befehl: der Knopf reichte früher das
       Klick-Ereignis als Kategorie durch, und es stand „[object PointerEvent]"
       als Titel da. Jetzt eine Seite wie im Atelier-Entwurf: Kopf mit Suche,
       links neun Bereiche, rechts Karten auf Papier. */
    await seite.click('#knopf-einstellungen');
    await seite.waitForTimeout(400);
    const stand = await seite.evaluate(() => {
      const seite_ = document.querySelector('#ansicht-einstellungen');
      const karte = seite_.querySelector('.einst-karte');
      const wurzel = getComputedStyle(document.documentElement);
      return {
        ansicht: document.querySelector('#huelle').dataset.ansicht,
        titel: seite_.querySelector('.einst-inhalt h2')?.textContent || '',
        zeilen: seite_.querySelectorAll('.einst-inhalt .einst-zeile').length,
        bereiche: seite_.querySelectorAll('.einst-kategorie').length,
        suche: !!seite_.querySelector('#einst-suche'),
        stand: seite_.querySelector('.einst-gespeichert')?.textContent || '',
        fassung: seite_.querySelector('.einst-fassung')?.textContent || '',
        kartenGrund: getComputedStyle(karte).backgroundColor,
        papier: wurzel.getPropertyValue('--flaeche-hoch').trim(),
        aktuell: document.querySelector('#knopf-einstellungen').getAttribute('aria-current'),
        breite: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:editor'));
    await seite.waitForTimeout(200);
    if (stand.ansicht !== 'einstellungen') throw new Error(`Ansicht ${stand.ansicht}`);
    if (/object/i.test(stand.titel) || !stand.zeilen) throw new Error(`Titel „${stand.titel}", ${stand.zeilen} Zeilen`);
    if (stand.bereiche !== 9) throw new Error(`${stand.bereiche} Bereiche`);
    if (!stand.suche) throw new Error('keine Suche im Kopf');
    if (!/Gilt für diese Sitzung|Automatisch gespeichert/.test(stand.stand)) throw new Error(`Stand „${stand.stand}"`);
    if (!/Fassung/.test(stand.fassung)) throw new Error('keine Fassung unter den Bereichen');
    if (stand.aktuell !== 'page') throw new Error('der Knopf zeigt nicht, dass die Seite offen ist');
    if (!stand.breite) throw new Error('die Seite scrollt waagerecht');
    return `„${stand.titel}" mit ${stand.zeilen} Zeilen, ${stand.bereiche} Bereiche, „${stand.stand}"`;
  });

  await pruefe('Die Seitenliste steht als Zeilen — und die Miniaturen bleiben erreichbar', async () => {
    /* Der Dichtegewinn der Richtung steckt genau hier: 22-px-Zeilen statt
       120-px-Karten. Das Bild ist damit nicht verboten, sondern eine Wahl —
       und diese Prüfung besteht darauf, dass die Wahl beide Wege kann. */
    const zeilen = await seite.evaluate(() => {
      const erste = document.querySelector('.miniatur');
      const zweite = document.querySelectorAll('.miniatur')[1];
      return {
        untereinander: zweite.getBoundingClientRect().top > erste.getBoundingClientRect().bottom - 2,
        hoehe: Math.round(erste.getBoundingClientRect().height),
        karte: !!erste.querySelector('.miniatur-karte'),
        kopf: (document.querySelector('#tafel-miniaturen .spaltenkopf')?.textContent || ''),
        nummer: erste.querySelector('.miniatur-nummer')?.textContent,
        titel: erste.querySelector('.miniatur-titel')?.textContent || '',
        zahlSchrift: getComputedStyle(erste.querySelector('.miniatur-nummer')).fontFamily,
      };
    });
    if (!zeilen.untereinander) throw new Error('die Zeilen stehen nebeneinander');
    if (zeilen.hoehe !== 44) throw new Error(`Zeile ${zeilen.hoehe} px statt 44`);
    if (zeilen.karte) throw new Error('in der Zeilenansicht steht noch eine Karte');
    if (!/Gliederung/.test(zeilen.kopf)) throw new Error(`kein Spaltenkopf: „${zeilen.kopf}"`);
    if (zeilen.nummer !== '1') throw new Error(`Nummer „${zeilen.nummer}"`);
    if (zeilen.titel.length < 4) throw new Error(`kein Kurztitel: „${zeilen.titel}"`);
    /* Zahlen stehen in der Schrift der Oberfläche (im Atelier Inter, in der
       Konsole Geist Mono) — mit gleich breiten Ziffern, so stehen 1 und 11
       übereinander. */
    if (!/Geist Mono|Inter/.test(zeilen.zahlSchrift)) throw new Error(`Zahl in ${zeilen.zahlSchrift}`);

    /* Und zurück: der Knopf im Fuß der Leiste holt die Karten wieder. */
    const bilder = await seite.evaluate(async () => {
      document.querySelector('#knopf-seitenansicht').click();
      await new Promise((l) => setTimeout(l, 700));
      const raus = {
        karten: document.querySelectorAll('.miniatur-karte').length,
        hoehe: Math.round(document.querySelector('.miniatur-karte').getBoundingClientRect().height),
        gemerkt: localStorage.getItem('studio-seitenansicht'),
      };
      document.querySelector('#knopf-seitenansicht').click();
      await new Promise((l) => setTimeout(l, 700));
      return { ...raus, wiederZeilen: !document.querySelector('.miniatur-karte') };
    });
    if (bilder.karten !== 5) throw new Error(`${bilder.karten} Miniaturen statt 5`);
    if (bilder.hoehe !== 112) throw new Error(`Karte ${bilder.hoehe} px statt 112`);
    if (bilder.gemerkt !== 'miniaturen') throw new Error('die Wahl wird nicht gemerkt');
    if (!bilder.wiederZeilen) throw new Error('der Weg zurück zu den Zeilen fehlt');
    return `44-px-Zeilen mit „${zeilen.nummer} ${zeilen.titel}", Miniaturen auf Wunsch (112 px)`;
  });

  await pruefe('Seitenordner und Vergleich stehen unter „Organisieren"', async () => {
    /* Sie waren die vierte Gruppe der Werkzeugzeile: Seiten, Vergleichen,
       Dokument. „Dokument" ist weggefallen — der Ordner und der Vergleich
       schließen sich selbst, mit ihrem eigenen Knopf und mit Escape. Ein
       dritter Knopf, der nur „zurück" bedeutet, war eine Zutat der Zeile. */
    await ladeBeispiel();
    const worte = await seite.evaluate(async () => {
      document.querySelector('#modi .modus[data-modus="organisieren"]').click();
      await new Promise((l) => setTimeout(l, 200));
      return [...document.querySelectorAll('.inspektor-werkzeug')].map((k) => k.textContent.trim());
    });
    for (const wort of ['Seiten ordnen', 'Mit anderer Datei vergleichen']) {
      if (!worte.includes(wort)) throw new Error(`„${wort}" fehlt — da steht: ${worte.join(', ')}`);
    }
    const offen = await seite.evaluate(async () => {
      [...document.querySelectorAll('.inspektor-werkzeug')]
        .find((k) => k.textContent.trim() === 'Seiten ordnen').click();
      await new Promise((l) => setTimeout(l, 600));
      const auf = !document.querySelector('#ordnen').hidden;
      document.querySelector('#ordnen button[title*="Zurück"]')?.click();
      await new Promise((l) => setTimeout(l, 500));
      return { auf, wiederZu: document.querySelector('#ordnen').hidden };
    });
    if (!offen.auf) throw new Error('„Seiten ordnen" öffnet den Ordner nicht');
    if (!offen.wiederZu) throw new Error('der Ordner schließt sich nicht selbst');
    return worte.join(' · ');
  });

  await pruefe('„Weitere Werkzeuge …" führt zum Befehlsfeld', async () => {
    /* Der Knopf „Mehr" der Zeile klappte eine eigene Liste auf — eine zweite
       Sammelstelle neben dem Befehlsfeld. Es gibt jetzt nur noch eine. */
    const stand = await seite.evaluate(async () => {
      [...document.querySelectorAll('.inspektor-werkzeug')]
        .find((k) => /Weitere Werkzeuge/.test(k.textContent)).click();
      await new Promise((l) => setTimeout(l, 400));
      const feld = document.querySelector('.dialog input');
      if (!feld) return { offen: false, namen: [] };
      feld.value = 'messen';
      feld.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((l) => setTimeout(l, 300));
      return { offen: true, namen: [...document.querySelectorAll('.palette-treffer')].map((k) => k.textContent) };
    });
    if (!stand.offen) throw new Error('das Befehlsfeld öffnet sich nicht');
    if (!stand.namen.some((n) => /Strecke messen/.test(n))) {
      throw new Error(`„Strecke messen" fehlt — da steht: ${stand.namen.join(', ')}`);
    }
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    return `${stand.namen.length} Treffer zu „messen"`;
  });

}
