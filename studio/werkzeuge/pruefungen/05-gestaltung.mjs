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
    kopf: 56,
    links: 264, rechts: 320,
    chrome900: 'rgb(250, 250, 248)',
    buehne: 'rgb(237, 237, 233)',
    papier: 'rgb(255, 255, 255)',
    akzent: 'rgb(22, 24, 26)',
    chromeText: 'rgb(22, 24, 26)',
  };

  await pruefe('Die Höhen der Chrome stimmen auf den Pixel', async () => {
    await ladeBeispiel();
    const masse = await seite.evaluate(() => {
      const h = (s) => Math.round(document.querySelector(s).getBoundingClientRect().height);
      const b = (s) => Math.round(document.querySelector(s).getBoundingClientRect().width);
      return { kopf: h('.kopf'),
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
        linksSteht: Math.round(l.left) === 0,
        rechtsSteht: Math.round(r.right) <= 1501,
      };
    });
    await seite.setViewportSize({ width: 1500, height: 950 });
    await seite.waitForTimeout(900);
    if (lage.links !== REG.links) throw new Error(`linke Leiste ${lage.links} px`);
    if (lage.rechts !== REG.rechts) throw new Error(`rechte Leiste ${lage.rechts} px`);
    if (!lage.linksSteht || !lage.rechtsSteht) throw new Error('eine Leiste liegt über der Bühne');
    return `${REG.links} + ${lage.buehne} + ${REG.rechts}`;
  });

  await pruefe('Die Werkzeuge tragen die Wörter des Mockups — jetzt in der Schiene', async () => {
    /* Markieren, Kommentar, Redigieren, Signieren — nicht unsere eigenen
       Wörter. Wer den Entwurf neben die Anwendung legt, soll dasselbe lesen.

       Sie standen in der Werkzeugzeile, solange es eine gab. Jetzt steht jedes
       Werkzeug unter dem Schritt des Vorgangs, zu dem es gehört; die Prüfung
       klappt deshalb jeden Schritt auf und sammelt ein, was darunter steht. */
    const worte = await seite.evaluate(async () => {
      const gesammelt = [];
      const kennungen = [...document.querySelectorAll('.schritt')].map((k) => k.dataset.schritt);
      for (const kennung of kennungen) {
        /* Nur aufklappen, was zu ist — ein zweiter Druck würde den Schritt
           wieder schließen, und wir bekämen seine Werkzeuge nie zu sehen. */
        const zeile = document.querySelector(`.schritt[data-schritt="${kennung}"]`);
        if (zeile.getAttribute('aria-expanded') === 'false') zeile.click();
        await new Promise((l) => setTimeout(l, 150));
        gesammelt.push(...[...document.querySelectorAll('.schritt-werkzeug')]
          .map((k) => k.textContent.trim()));
      }
      return gesammelt;
    });
    for (const wort of ['Auswahl', 'Text', 'Markieren', 'Kommentar', 'Redigieren',
      'Formularfeld anlegen', 'Signieren', 'Seiten ordnen']) {
      if (!worte.includes(wort)) throw new Error(`„${wort}" fehlt — da steht: ${worte.join(', ')}`);
    }
    await ladeBeispiel();
    return worte.filter((w) => w !== 'Weitere Werkzeuge …').join(' · ');
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
    void 0;
    if (stand.knopf !== REG.akzent) throw new Error(`„Datei öffnen" ist ${stand.knopf}`);
    if (!/Plex/.test(stand.titelSchrift)) throw new Error(`Titel in ${stand.titelSchrift}`);
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
    /* Zwei verschiedene Schriftfarben, und das ist richtig so: auf dem
       Akzent steht --tally-text, auf der Chrome --chrome-text. Beide kippen
       mit der Fassung, deshalb kann keine zu schwach werden. */
    if (stand.vollText !== 'rgb(250, 250, 248)') throw new Error(`Schrift auf dem Akzent ist ${stand.vollText}`);
    if (stand.chromeText !== REG.chromeText) throw new Error(`Einstellungen ist ${stand.chromeText}`);
    return `Sichern ${stand.voll}`;
  });

  await pruefe('Rückgängig und Wiederholen stehen im Kopf, nicht im Vorgang', async () => {
    /* Sie standen in der Werkzeugzeile. Die gibt es nicht mehr, und in die
       Vorgangsschiene gehören sie nicht: ein Fehler gehört zu keinem Schritt,
       er gehört zum Dokument. Also in den Kopf, neben „Sichern".

       Die beiden sind außerdem die einzigen Knöpfe ohne Wort, die bleiben
       durften — zwei Pfeile sind das einzige Zeichenpaar, bei dem die stille
       Annahme wirklich trägt. */
    const stand = await seite.evaluate(() => {
      const feld = document.querySelector('#kopf-verlauf');
      const knoepfe = [...(feld?.querySelectorAll('button') || [])];
      const kopf = document.querySelector('.kopf').getBoundingClientRect();
      return {
        imKopf: knoepfe.length > 0 && knoepfe.every((k) => {
          const kasten = k.getBoundingClientRect();
          return kasten.top >= kopf.top - 1 && kasten.bottom <= kopf.bottom + 1;
        }),
        namen: knoepfe.map((k) => k.getAttribute('aria-label')),
        gesperrt: knoepfe.map((k) => k.disabled),
        inSchiene: document.querySelectorAll('#vorgangsschiene #knopf-rueckgaengig').length,
      };
    });
    if (stand.namen.join() !== 'Rückgängig,Wiederholen') throw new Error(`da steht: ${stand.namen.join(', ')}`);
    if (!stand.imKopf) throw new Error('ein Knopf steht nicht im Kopf');
    if (stand.inSchiene) throw new Error('der Verlauf steht in der Schiene');
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
    /* „Registratur" kannte keine Radien. „Vorgang" ist eine Web-App und hat
       welche — aber nur drei Werte, und nur an Dingen, die man bedient.
       Das Blatt und die Leisten bleiben eckig: ein Blatt ist ein Blatt, und
       eine Leiste, die am Fensterrand klebt, bekäme sonst einen Spalt. */
    const ERLAUBT = [0, 6, 10, 999];
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
    return 'Staffel 0/6/10 eingehalten, Papier und Leisten eckig';
  });

  await pruefe('Der Dialog trägt den Kopf der Richtung', async () => {
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
    if (stand.radius !== '10px') throw new Error(`Ecken ${stand.radius} statt 10`);
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
    if (zeilen.hoehe !== 44) throw new Error(`Zeile ${zeilen.hoehe} px statt 44`);
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
    return `44-px-Zeilen mit „${zeilen.nummer} ${zeilen.titel}", Miniaturen auf Wunsch (112 px)`;
  });

  await pruefe('Seitenordner und Vergleich stehen unter „Lesen"', async () => {
    /* Sie waren die vierte Gruppe der Werkzeugzeile: Seiten, Vergleichen,
       Dokument. „Dokument" ist weggefallen — der Ordner und der Vergleich
       schließen sich selbst, mit ihrem eigenen Knopf und mit Escape. Ein
       dritter Knopf, der nur „zurück" bedeutet, war eine Zutat der Zeile. */
    await ladeBeispiel();
    const worte = await seite.evaluate(async () => {
      [...document.querySelectorAll('.schritt')].find((k) => /Lesen/.test(k.textContent)).click();
      await new Promise((l) => setTimeout(l, 200));
      return [...document.querySelectorAll('.schritt-werkzeug')].map((k) => k.textContent.trim());
    });
    for (const wort of ['Seiten ordnen', 'Mit anderer Datei vergleichen']) {
      if (!worte.includes(wort)) throw new Error(`„${wort}" fehlt — da steht: ${worte.join(', ')}`);
    }
    const offen = await seite.evaluate(async () => {
      [...document.querySelectorAll('.schritt-werkzeug')]
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
      [...document.querySelectorAll('.schritt-werkzeug')]
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
