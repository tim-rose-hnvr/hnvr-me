/* Gestaltung — gegen das Handoff gelegt, nicht gegen die eigene Meinung.

   Diese Gruppe misst gerenderte Pixel: Farben, Zeilenhöhen, Spaltenbreiten,
   Radien, Schriftschnitte. Sie ist entstanden, nachdem zweimal behauptet
   wurde, die Gestaltung stimme — und zweimal stimmte sie nicht. */

import { join } from 'node:path';

export default async function ({ pruefe, seite, blatt, ladeBeispiel, BASIS, ablage }) {
  console.log('\n== Gestaltung nach dem Handoff ==');

  /* Das Handoff nennt Höhen, Breiten und Farben auf den Pixel und den Hexwert
     genau. Sie hier nachzumessen ist der einzige Weg, der nicht darauf
     hinausläuft, zwei Bildschirmabzüge nebeneinanderzuhalten. */
  const HANDOFF = {
    kopf: 38, menue: 27, werkzeuge: 46, fuss: 30,
    links: 196, rechts: 296,
    chrome900: 'rgb(29, 35, 39)',
    menueGrund: 'rgb(231, 233, 235)',
    werkzeugGrund: 'rgb(244, 245, 246)',
    buehne: 'rgb(95, 104, 110)',
    fussGrund: 'rgb(51, 59, 64)',
    papier: 'rgb(253, 252, 249)',
    akzent: 'rgb(15, 118, 110)',
  };

  await pruefe('Die Höhen der Chrome stimmen auf den Pixel', async () => {
    await ladeBeispiel();
    const masse = await seite.evaluate(() => {
      const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
      const b = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
      return { kopf: h('.kopf'), menue: h('.menueleiste'), werkzeuge: h('.werkzeugzeile'),
        fuss: h('.fuss'), links: b('.leiste-links'), rechts: b('.leiste-rechts') };
    });
    for (const [name, soll] of Object.entries(HANDOFF)) {
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
      kopf: HANDOFF.chrome900, menue: HANDOFF.menueGrund, werkzeuge: HANDOFF.werkzeugGrund,
      buehne: HANDOFF.buehne, fuss: HANDOFF.fussGrund, blatt: HANDOFF.papier,
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
    /* Die Mockup-Aufnahme ist 924 px breit und zeigt beide Leisten: links 196,
       rechts 296. Unser Umbruchpunkt lag darüber — bei dieser Breite klappten
       beide Leisten weg, und der Vergleich verglich zwei verschiedene Dinge. */
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
    if (lage.links !== 196) throw new Error(`linke Leiste ${lage.links} px`);
    if (lage.rechts !== 296) throw new Error(`rechte Leiste ${lage.rechts} px`);
    if (!lage.linksSteht || !lage.rechtsSteht) throw new Error('eine Leiste liegt über der Bühne');
    return `196 + ${lage.buehne} + 296`;
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
    if (stand.kopfGrund !== HANDOFF.chrome900) throw new Error(`Kopf ist ${stand.kopfGrund}`);
    if (stand.kopfHoehe !== 38) throw new Error(`Kopf ist ${stand.kopfHoehe} px`);
    if (stand.knopf !== HANDOFF.akzent) throw new Error(`„Datei öffnen" ist ${stand.knopf}`);
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
    const werte = await seite.evaluate(() => {
      document.documentElement.dataset.thema = 'dunkel';
      const g = (s) => getComputedStyle(document.querySelector(s)).backgroundColor;
      const raus = { buehne: g('#buehne'), tafel: g('.leiste-links'), chrome: g('.kopf'), blatt: g('.blatt') };
      document.documentElement.dataset.thema = 'system';
      return raus;
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
    if (stand.voll !== HANDOFF.akzent) throw new Error(`Sichern ist ${stand.voll}`);
    if (stand.vollText !== 'rgb(255, 255, 255)') throw new Error(`Schrift ist ${stand.vollText}`);
    if (stand.chromeText !== 'rgb(255, 255, 255)') throw new Error(`Einstellungen ist ${stand.chromeText}`);
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
    if (stand.hoehen.some((h) => h !== 34)) throw new Error(`Höhen ${stand.hoehen.join('/')} statt 34`);
    if (stand.trenner < 4) throw new Error(`nur ${stand.trenner} Gruppentrenner`);
    return `${stand.worte.length} Knöpfe: ${stand.worte.join(' · ')}`;
  });

  await pruefe('Alles ist kantig — Radius 0 mit den vier Ausnahmen', async () => {
    /* Handoff: „Radien: 0 (alles kantig)", Ausnahmen Umschalt-Pille 10 px,
       Avatare 50 %, Kommentar-Nadel und aktive Werkzeugknöpfe 2 px. */
    const rund = await seite.evaluate(() => {
      const erlaubt = ['.pille', '.pille i', '.punkt', '.notiz-marke', '.lader-balken', '.lader-balken i'];
      return [...document.querySelectorAll('#huelle *')]
        .filter((k) => !erlaubt.some((s) => k.matches(s)))
        .map((k) => ({ k, r: getComputedStyle(k).borderRadius }))
        .filter(({ r }) => r && r !== '0px' && !/^[0-2]px$/.test(r))
        .map(({ k, r }) => `${k.className || k.tagName}:${r}`)
        .slice(0, 6);
    });
    if (rund.length) throw new Error(rund.join(', '));
    return 'kein runder Rahmen im Fenster';
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
    if (stand.grund !== HANDOFF.chrome900) throw new Error(`Kopf ist ${stand.grund}`);
    if (stand.hoehe !== 42) throw new Error(`Kopf ist ${stand.hoehe} px statt 42`);
    if (!/Plex Serif/.test(stand.titelSchrift)) throw new Error(`Titel in ${stand.titelSchrift}`);
    if (stand.radius !== '0px') throw new Error(`Ecken ${stand.radius}`);
    if (!stand.hinweis) throw new Error('kein Hinweis im Fuß');
    if (!/FASSUNG/.test(stand.fassung)) throw new Error('keine Fassung unter den Kategorien');
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    return `${stand.hoehe} px, ${stand.grund}, Fuß: „${stand.hinweis}"`;
  });

  await pruefe('Die Seitenliste ist einspaltig, mit Zahl und Kurztitel', async () => {
    const stand = await seite.evaluate(() => {
      const erste = document.querySelector('.miniatur');
      const zweite = document.querySelectorAll('.miniatur')[1];
      return {
        untereinander: zweite.getBoundingClientRect().top > erste.getBoundingClientRect().bottom - 2,
        karte: Math.round(erste.querySelector('.miniatur-karte').getBoundingClientRect().height),
        nummer: erste.querySelector('.miniatur-nummer')?.textContent,
        titel: erste.querySelector('.miniatur-titel')?.textContent || '',
        titelSchrift: getComputedStyle(erste.querySelector('.miniatur-nummer')).fontFamily,
      };
    });
    if (!stand.untereinander) throw new Error('die Miniaturen stehen nebeneinander');
    if (stand.karte !== 112) throw new Error(`Karte ${stand.karte} px statt 112`);
    if (stand.nummer !== '1') throw new Error(`Nummer „${stand.nummer}"`);
    if (stand.titel.length < 4) throw new Error(`kein Kurztitel: „${stand.titel}"`);
    if (!/Plex Mono/.test(stand.titelSchrift)) throw new Error(`Zahl in ${stand.titelSchrift}`);
    return `112 px, „${stand.nummer} ${stand.titel}"`;
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
