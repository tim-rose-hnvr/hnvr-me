/* Gestaltung — gegen die vereinbarte Richtung gelegt, nicht gegen die eigene
   Meinung.

   Diese Gruppe misst gerenderte Pixel: Farben, Zeilenhöhen, Spaltenbreiten,
   Radien, Schriftschnitte. Sie ist entstanden, nachdem zweimal behauptet
   wurde, die Gestaltung stimme — und zweimal stimmte sie nicht.

   Die Richtung heißt „Registratur": keine Radien, keine Schatten, keine
   Karten. Hierarchie tragen Haarlinie, Zeilenhöhe und Versalabstand. */

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
    const STUFEN = new Set([1, 2, 4, 6, 8, 10, 12, 16, 24, 32]);
    const daneben = new Set();
    for (const t of ohneWurzel.matchAll(/\b(?:padding|margin|gap)(?:-[a-z]+)?: ([^;{}]+)/g)) {
      /* `calc()` rechnet mit Umgebungswerten (Aussparung, Leistenhöhe) und
         wird hier nicht zerlegt — die Zahl darin ist ein Zuschlag, kein Maß. */
      if (t[1].includes('calc(')) continue;
      for (const zahl of t[1].matchAll(/\b([0-9.]+)px/g)) {
        if (!STUFEN.has(Number(zahl[1]))) daneben.add(`${zahl[1]}px`);
      }
    }
    if (daneben.size) throw new Error(`Abstand außerhalb der Staffel: ${[...daneben].join(', ')}`);
    return `10 Schriftstufen, 9 Raumstufen, ${css.match(/font-size: var\(/g).length} Stellen ziehen daraus`;
  });

  /* Die Richtung nennt Höhen, Breiten und Farben auf den Pixel und den Hexwert
     genau. Sie hier nachzumessen ist der einzige Weg, der nicht darauf
     hinausläuft, zwei Bildschirmabzüge nebeneinanderzuhalten. */
  const REG = {
    kopf: 30, menue: 22, werkzeuge: 30, fuss: 24,
    links: 220, rechts: 300,
    chrome900: 'rgb(33, 39, 44)',
    menueGrund: 'rgb(234, 237, 240)',
    werkzeugGrund: 'rgb(244, 246, 248)',
    buehne: 'rgb(46, 51, 56)',
    fussGrund: 'rgb(33, 39, 44)',
    papier: 'rgb(253, 252, 249)',
    akzent: 'rgb(62, 92, 150)',
    chromeText: 'rgb(244, 246, 248)',
  };

  await pruefe('Die Höhen der Chrome stimmen auf den Pixel', async () => {
    await ladeBeispiel();
    const masse = await seite.evaluate(() => {
      const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
      const b = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
      return { kopf: h('.kopf'), menue: h('.menueleiste'), werkzeuge: h('.werkzeugzeile'),
        fuss: h('.fuss'), links: b('.leiste-links'), rechts: b('.leiste-rechts') };
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
      return { kopf: f('.kopf'), menue: f('.menueleiste'), werkzeuge: f('.werkzeugzeile'),
        buehne: f('#buehne'), fuss: f('.fuss'), blatt: f('.blatt') };
    });
    const soll = {
      kopf: REG.chrome900, menue: REG.menueGrund, werkzeuge: REG.werkzeugGrund,
      buehne: REG.buehne, fuss: REG.fussGrund, blatt: REG.papier,
    };
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
    /* Die Mockup-Aufnahme ist 924 px breit und zeigt beide Leisten. Unser
       Umbruchpunkt lag einmal darüber — bei dieser Breite klappten beide
       Leisten weg, und der Vergleich verglich zwei verschiedene Dinge.
       Registratur macht die Leisten breiter, weil dort Spalten stehen. */
    await seite.setViewportSize({ width: 944, height: 700 });
    await seite.waitForTimeout(900);
    const lage = await seite.evaluate(() => {
      const l = document.querySelector('.leiste-links').getBoundingClientRect();
      const r = document.querySelector('.leiste-rechts').getBoundingClientRect();
      const b = document.querySelector('#buehne').getBoundingClientRect();
      return {
        links: Math.round(l.width), rechts: Math.round(r.width), buehne: Math.round(b.width),
        linksSteht: Math.round(l.left) === 0,
        rechtsSteht: Math.round(r.right) <= 945,
      };
    });
    await seite.setViewportSize({ width: 1500, height: 950 });
    await seite.waitForTimeout(900);
    if (lage.links !== REG.links) throw new Error(`linke Leiste ${lage.links} px`);
    if (lage.rechts !== REG.rechts) throw new Error(`rechte Leiste ${lage.rechts} px`);
    if (!lage.linksSteht || !lage.rechtsSteht) throw new Error('eine Leiste liegt über der Bühne');
    return `${REG.links} + ${lage.buehne} + ${REG.rechts}`;
  });

  await pruefe('Die Werkzeugknöpfe tragen die Wörter des Mockups', async () => {
    /* Markieren, Kommentar, Redigieren, Signieren — nicht unsere eigenen
       Wörter. Wer den Entwurf neben die Anwendung legt, soll dasselbe lesen. */
    const worte = await seite.evaluate(() =>
      [...document.querySelectorAll('.werkzeugzeile .werkzeug span')].map((k) => k.textContent.trim()));
    for (const wort of ['Auswahl', 'Text', 'Markieren', 'Kommentar', 'Redigieren',
      'Formularfeld', 'Signieren', 'Seiten', 'Vergleichen', 'Dokument']) {
      if (!worte.includes(wort)) throw new Error(`„${wort}" fehlt — da steht: ${worte.join(', ')}`);
    }
    return worte.slice(0, 7).join(' · ');
  });

  await pruefe('Der Empfang trägt dieselbe Sprache wie das Programm', async () => {
    /* Er war das Einzige, was nie ein Vorbild hatte: eine graue Fläche mit einer
       weißen Karte, und der Knopf, den man drücken soll, war nicht einmal
       akzentfarben. */
    await seite.goto(BASIS);
    await seite.waitForTimeout(1400);
    const stand = await seite.evaluate(() => {
      const kopf = document.querySelector('.empfang-kopf');
      const oeffnen = document.querySelector('#knopf-oeffnen');
      return {
        kopfGrund: kopf ? getComputedStyle(kopf).backgroundColor : null,
        kopfHoehe: kopf ? Math.round(kopf.getBoundingClientRect().height) : 0,
        knopf: getComputedStyle(oeffnen).backgroundColor,
        titelSchrift: getComputedStyle(document.querySelector('.empfang h1')).fontFamily,
        ablage: !!document.querySelector('.empfang-ablage'),
        formate: (document.querySelector('.empfang-ablage .mono')?.textContent || ''),
      };
    });
    if (stand.kopfGrund !== REG.chrome900) throw new Error(`Kopf ist ${stand.kopfGrund}`);
    if (stand.kopfHoehe !== REG.kopf) throw new Error(`Kopf ist ${stand.kopfHoehe} px`);
    if (stand.knopf !== REG.akzent) throw new Error(`„Datei öffnen" ist ${stand.knopf}`);
    if (!/Plex Serif/.test(stand.titelSchrift)) throw new Error(`Titel in ${stand.titelSchrift}`);
    if (!stand.ablage) throw new Error('keine Ablegefläche');
    if (!/DOCX/.test(stand.formate)) throw new Error(`Formate: ${stand.formate}`);
    await ladeBeispiel();
    return `Kopf ${stand.kopfHoehe} px, Knopf ${stand.knopf}`;
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

  await pruefe('Der Primärknopf in der Titelleiste ist akzentfarben', async () => {
    /* Er war einmal weiß: `.knopf-voll` stand oberhalb von `.knopf` und wurde
       von dessen Grundwerten überschrieben. Gleiche Spezifität, spätere Regel
       gewinnt — im Bildschirmabzug sofort zu sehen, im Quelltext nicht. */
    const stand = await seite.evaluate(() => {
      const voll = getComputedStyle(document.querySelector('#knopf-sichern'));
      const chrome = getComputedStyle(document.querySelector('#knopf-einstellungen'));
      return { voll: voll.backgroundColor, vollText: voll.color, chromeText: chrome.color };
    });
    if (stand.voll !== REG.akzent) throw new Error(`Sichern ist ${stand.voll}`);
    if (stand.vollText !== REG.chromeText) throw new Error(`Schrift ist ${stand.vollText}`);
    if (stand.chromeText !== REG.chromeText) throw new Error(`Einstellungen ist ${stand.chromeText}`);
    return `Sichern ${stand.voll}`;
  });

  await pruefe('Jeder Knopf der Werkzeugzeile trägt ein Wort', async () => {
    /* Das Handoff zeigt neun beschriftete Knöpfe. Ein Sinnbild ohne Wort ist
       die stille Annahme, jeder wisse schon, was es bedeutet.

       Ausgenommen sind Rückgängig und Wiederholen (`.werkzeug-schmal`): sie
       stehen gar nicht im Handoff, sondern sind eine Zutat — und die beiden
       Pfeile sind die zwei Zeichen, bei denen die Annahme wirklich trägt. */
    const stand = await seite.evaluate(() => {
      const knoepfe = [...document.querySelectorAll('.werkzeugzeile .werkzeug:not(.werkzeug-schmal)')];
      return {
        ohneWort: knoepfe.filter((k) => !k.querySelector('span')?.textContent.trim())
          .map((k) => k.getAttribute('aria-label') || k.title),
        hoehen: [...new Set(knoepfe.map((k) => Math.round(k.getBoundingClientRect().height)))],
        worte: knoepfe.map((k) => k.querySelector('span')?.textContent.trim()).filter(Boolean),
        trenner: document.querySelectorAll('.werkzeugzeile .werkzeug-trenner').length,
      };
    });
    if (stand.ohneWort.length) throw new Error(`ohne Wort: ${stand.ohneWort.join(', ')}`);
    if (stand.hoehen.some((h) => h !== REG.werkzeuge - 1)) {
      throw new Error(`Höhen ${stand.hoehen.join('/')} statt ${REG.werkzeuge - 1}`);
    }
    if (stand.trenner < 4) throw new Error(`nur ${stand.trenner} Gruppentrenner`);
    return `${stand.worte.length} Knöpfe: ${stand.worte.join(' · ')}`;
  });

  await pruefe('Es gibt keine Radien — ausnahmslos', async () => {
    /* Registratur hat keine gerundeten Ecken. Nicht „kleine": keine. Diese
       Prüfung ist die Sperre dagegen, dass sich einer zurückschleicht — ein 4
       hier, ein 6 dort, und nach drei Runden ist die Richtung weg, ohne dass
       jemand eine Entscheidung getroffen hätte. */
    const rund = await seite.evaluate(() => {
      const raus = [];
      for (const k of document.querySelectorAll('#huelle *')) {
        const werte = getComputedStyle(k).borderRadius.split(/[\s/]+/).filter(Boolean);
        if (werte.some((w) => parseFloat(w) > 0)) {
          raus.push(`${k.className || k.tagName}:${getComputedStyle(k).borderRadius}`);
        }
      }
      return [...new Set(raus)].slice(0, 8);
    });
    if (rund.length) throw new Error(`gerundet: ${rund.join(', ')}`);
    return 'kein einziger Radius im ganzen Fenster';
  });

  await pruefe('Der Dialog hat den dunklen Kopf aus dem Handoff', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('einstellungen'));
    await seite.waitForTimeout(400);
    const stand = await seite.evaluate(() => {
      const kopf = document.querySelector('.dialog-kopf');
      const dialog = document.querySelector('.dialog');
      return {
        grund: getComputedStyle(kopf).backgroundColor,
        hoehe: Math.round(kopf.getBoundingClientRect().height),
        titelSchrift: getComputedStyle(kopf.querySelector('h2')).fontFamily,
        radius: getComputedStyle(dialog).borderRadius,
        hinweis: document.querySelector('.dialog-fuss-hinweis')?.textContent || '',
        fassung: document.querySelector('.einst-fassung')?.textContent || '',
      };
    });
    if (stand.grund !== REG.chrome900) throw new Error(`Kopf ist ${stand.grund}`);
    if (stand.hoehe !== 34) throw new Error(`Kopf ist ${stand.hoehe} px statt 34`);
    if (!/Plex Mono/.test(stand.titelSchrift)) throw new Error(`Titel in ${stand.titelSchrift}`);
    if (stand.radius !== '0px') throw new Error(`Ecken ${stand.radius} statt 0`);
    if (!stand.hinweis) throw new Error('kein Hinweis im Fuß');
    if (!/FASSUNG/.test(stand.fassung)) throw new Error('keine Fassung unter den Kategorien');
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    return `${stand.hoehe} px, ${stand.grund}, Fuß: „${stand.hinweis}"`;
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
    if (zeilen.hoehe !== 22) throw new Error(`Zeile ${zeilen.hoehe} px statt 22`);
    if (zeilen.karte) throw new Error('in der Zeilenansicht steht noch eine Karte');
    if (!/Gliederung/.test(zeilen.kopf)) throw new Error(`kein Spaltenkopf: „${zeilen.kopf}"`);
    if (zeilen.nummer !== '1') throw new Error(`Nummer „${zeilen.nummer}"`);
    if (zeilen.titel.length < 4) throw new Error(`kein Kurztitel: „${zeilen.titel}"`);
    if (!/Plex Mono/.test(zeilen.zahlSchrift)) throw new Error(`Zahl in ${zeilen.zahlSchrift}`);

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
    return `22-px-Zeilen mit „${zeilen.nummer} ${zeilen.titel}", Miniaturen auf Wunsch (112 px)`;
  });

  await pruefe('Die drei Ansichten stehen als Gruppe in der Zeile', async () => {
    const knoepfe = await seite.evaluate(() =>
      [...document.querySelectorAll('.werkzeugzeile .werkzeug span')].map((s) => s.textContent.trim()));
    for (const wort of ['Seiten', 'Vergleichen', 'Dokument']) {
      if (!knoepfe.includes(wort)) throw new Error(`„${wort}" fehlt`);
    }
    /* Und der Knopf „Seiten" öffnet den Seitenordner. */
    const offen = await seite.evaluate(async () => {
      [...document.querySelectorAll('.werkzeugzeile .werkzeug')]
        .find((k) => k.textContent.trim() === 'Seiten').click();
      await new Promise((l) => setTimeout(l, 400));
      const auf = !document.querySelector('#ordnen').hidden;
      [...document.querySelectorAll('.werkzeugzeile .werkzeug')]
        .find((k) => k.textContent.trim() === 'Dokument').click();
      await new Promise((l) => setTimeout(l, 300));
      return { auf, wiederZu: document.querySelector('#ordnen').hidden };
    });
    if (!offen.auf) throw new Error('„Seiten" öffnet den Ordner nicht');
    if (!offen.wiederZu) throw new Error('„Dokument" schließt ihn nicht');
    return knoepfe.join(' · ');
  });

  await pruefe('„Mehr" führt zu den übrigen Werkzeugen', async () => {
    const stand = await seite.evaluate(async () => {
      [...document.querySelectorAll('.werkzeugzeile .werkzeug')]
        .find((k) => /Mehr|messen|Freihand|Stempel/.test(k.textContent)).click();
      await new Promise((l) => setTimeout(l, 250));
      const liste = document.querySelector('#weitere-werkzeuge');
      const namen = [...(liste?.querySelectorAll('.menue-name') || [])].map((k) => k.textContent);
      const kasten = liste?.getBoundingClientRect();
      return { namen, sichtbar: !!kasten && kasten.width > 40 && kasten.right <= window.innerWidth + 1 };
    });
    if (!stand.sichtbar) throw new Error('die Liste klappt nicht sichtbar auf');
    for (const wort of ['Freihand', 'Stempel', 'Strecke messen']) {
      if (!stand.namen.includes(wort)) throw new Error(`„${wort}" fehlt in der Liste`);
    }
    await seite.keyboard.press('Escape');
    await seite.mouse.click(700, 500);
    await seite.waitForTimeout(200);
    return `${stand.namen.length} weitere Werkzeuge`;
  });
}
