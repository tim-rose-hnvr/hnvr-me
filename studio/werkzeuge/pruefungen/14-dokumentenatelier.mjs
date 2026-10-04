/* Dokumentenatelier — Startseite, lokale Ablage, Sammlungen.

   Geprüft wird vor allem das, was schiefgehen kann, ohne dass es jemand
   sieht: dass ohne Zustimmung nichts im Browser liegen bleibt, dass dieselbe
   Datei nicht zweimal in der Liste steht, dass eine aufgelöste Sammlung keine
   Dokumente mitnimmt, und dass das Studio ohne Speicher genauso öffnet. */

export default async function ({ pruefe, seite, browser, BASIS, ladeBeispiel, ladungVon }) {
  console.log('\n== Dokumentenatelier ==');

  const ablage = (tun) => seite.evaluate(tun);
  const anzahl = () => ablage(async () => (await (await import('./app/ablage.js')).liste()).length);

  await pruefe('Ohne Zustimmung liegt nichts auf dem Gerät', async () => {
    /* Frischer Stand: die Frage steht da, und eine geöffnete Datei wird
       nicht abgelegt, solange sie nicht beantwortet ist. */
    await seite.evaluate(async () => {
      localStorage.removeItem('studio:ablage-merken');
      await (await import('./app/ablage.js')).leereAblage();
    });
    await ladeBeispiel();
    const zahl = await anzahl();
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:start'));
    await seite.waitForTimeout(400);
    const frage = await seite.evaluate(() => !!document.querySelector('#start-stapel .merken-frage #merken-ja'));
    if (zahl !== 0) throw new Error(`${zahl} Einträge abgelegt, obwohl niemand zugestimmt hat`);
    if (!frage) throw new Error('die Frage steht nicht auf der Startseite');
    return 'Frage steht, 0 Einträge';
  });

  await pruefe('„Nein" heißt: es bleibt nichts liegen', async () => {
    await seite.click('#merken-nein');
    await seite.waitForTimeout(300);
    await ladeBeispiel();
    const zahl = await anzahl();
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:start'));
    await seite.waitForTimeout(400);
    const text = await seite.textContent('#start-stapel');
    if (zahl !== 0) throw new Error(`${zahl} Einträge trotz „Nein"`);
    if (!/merkt sich keine Dateien/.test(text)) throw new Error(`Stapel sagt „${text.trim()}"`);
    return 'nichts abgelegt, und die Startseite sagt es';
  });

  await pruefe('Nach „Ja" steht die geöffnete Datei oben im Stapel — einmal', async () => {
    await seite.evaluate(async () => (await import('./app/dokumentenatelier.js')).setzeMerken('ja'));
    await seite.waitForTimeout(400);
    /* Das offene Beispiel wird beim Zustimmen gleich gemerkt. Danach noch
       zweimal öffnen: es darf trotzdem nur einmal dastehen. */
    await ladeBeispiel();
    await ladeBeispiel();
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:start'));
    await seite.waitForTimeout(600);
    const stand = await seite.evaluate(() => ({
      namen: [...document.querySelectorAll('#start-stapel .stapel-name')].map((k) => k.textContent),
      oben: document.querySelector('#start-stapel .stapel-blatt.ist-oben .stapel-name')?.textContent,
      bestand: document.querySelector('#start-bestand').textContent,
    }));
    const zahl = await anzahl();
    if (zahl !== 1) throw new Error(`${zahl} Einträge für dieselbe Datei`);
    if (stand.oben !== 'Beispiel — Vertragsentwurf.pdf') throw new Error(`oben steht „${stand.oben}"`);
    if (!/^1 Dokument auf diesem Gerät/.test(stand.bestand)) throw new Error(`Bestand: ${stand.bestand}`);
    return `${stand.namen.join(', ')} · ${stand.bestand}`;
  });

  await pruefe('Aus dem Stapel öffnen wechselt zur offenen Datei — kein zweiter Reiter', async () => {
    await seite.click('#start-stapel .stapel-karte');
    await seite.waitForTimeout(1200);
    const stand = await seite.evaluate(() => ({
      ansicht: document.querySelector('#huelle').dataset.ansicht,
      reiter: window.studio.zustand && document.querySelectorAll('#dokument-reiter .dok-reiter').length,
    }));
    if (stand.ansicht !== 'editor') throw new Error(`Ansicht ${stand.ansicht}`);
    if (stand.reiter > 1) throw new Error(`${stand.reiter} Reiter für eine Datei`);
    return `Editor, ${stand.reiter || 1} Reiter`;
  });

  await pruefe('Sammlungen: anlegen, zuordnen, zählen — Doppelte und leere Namen abgewiesen', async () => {
    const stand = await ablage(async () => {
      const a = await import('./app/ablage.js');
      const projekte = await a.legeSammlungAn('Projekte');
      const fehler = [];
      for (const name of ['projekte', '   ']) {
        try { await a.legeSammlungAn(name); fehler.push(`„${name}" angenommen`); } catch { /* richtig */ }
      }
      const [d] = await a.liste();
      await a.ordneZu(d.id, projekte.id);
      const s = await a.sammlungen();
      return { fehler, s: s.map((x) => `${x.name}:${x.anzahl}`), id: projekte.id };
    });
    await seite.waitForTimeout(500);
    const navi = await seite.evaluate(() => [...document.querySelectorAll('#navi-sammlungen .navi-sammlung')]
      .map((k) => `${k.querySelector('.navi-sammlung-name').textContent}:${k.querySelector('.navi-sammlung-zahl').textContent}`));
    if (stand.fehler.length) throw new Error(stand.fehler.join(', '));
    if (stand.s.join() !== 'Projekte:1') throw new Error(`Sammlungen: ${stand.s.join()}`);
    if (navi.join() !== 'Projekte:1') throw new Error(`Navigation zeigt ${navi.join() || 'nichts'}`);
    return `Projekte mit 1 Dokument, in der Navigation; „projekte" und leer abgewiesen`;
  });

  await pruefe('Die Ansicht „Dokumente" filtert nach Sammlung und zeichnet sich nicht doppelt', async () => {
    await seite.click('#navi-sammlungen .navi-sammlung');
    await seite.waitForTimeout(800);
    const stand = await seite.evaluate(() => ({
      titel: document.querySelector('#ansicht-dokumente h1')?.textContent,
      zeilen: document.querySelectorAll('#ansicht-dokumente .dokumente-zeile:not(.dokumente-kopf)').length,
      fuesse: document.querySelectorAll('#ansicht-dokumente .dokumente-fuss').length,
      werkzeuge: document.querySelectorAll('#ansicht-dokumente .dokumente-werkzeuge').length,
    }));
    if (stand.titel !== 'Projekte') throw new Error(`Titel „${stand.titel}"`);
    if (stand.zeilen !== 1) throw new Error(`${stand.zeilen} Zeilen`);
    if (stand.fuesse !== 1 || stand.werkzeuge !== 1) throw new Error(`${stand.fuesse} Füße, ${stand.werkzeuge} Werkzeugzeilen`);
    return `„${stand.titel}": 1 Zeile, ein Fuß`;
  });

  await pruefe('Eine aufgelöste Sammlung nimmt keine Dokumente mit', async () => {
    const stand = await ablage(async () => {
      const a = await import('./app/ablage.js');
      const [s] = await a.sammlungen();
      await a.entferneSammlung(s.id);
      const d = await a.liste();
      return { dokumente: d.length, sammlung: d[0]?.sammlung ?? null, sammlungen: (await a.sammlungen()).length };
    });
    if (stand.dokumente !== 1) throw new Error(`${stand.dokumente} Dokumente danach`);
    if (stand.sammlung !== null) throw new Error('das Dokument zeigt noch auf die Sammlung');
    if (stand.sammlungen !== 0) throw new Error('die Sammlung ist noch da');
    return 'Dokument bleibt, ohne Sammlung';
  });

  await pruefe('Nach dem Sichern liegt die gesicherte Fassung in der Ablage', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:editor'));
    await seite.evaluate(() => window.studio.fuehreAus('seiten:drehenRechts'));
    await seite.waitForTimeout(400);
    await ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    await seite.waitForTimeout(800);
    const stand = await ablage(async () => {
      const a = await import('./app/ablage.js');
      const [d] = await a.liste();
      return { status: d.status, statusText: d.statusText, zahl: (await a.liste()).length };
    });
    if (stand.zahl !== 1) throw new Error(`${stand.zahl} Einträge — die gesicherte Fassung kam als neuer dazu`);
    if (stand.status !== 'gespeichert') throw new Error(`Status ${stand.status}`);
    return `Status „${stand.statusText}", weiterhin ein Eintrag`;
  });

  await pruefe('„Was möchten Sie erledigen?" führt zu Werkzeugen, die es gibt', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:start'));
    await seite.waitForTimeout(300);
    const stand = await seite.evaluate(async () => {
      const { WERKZEUGE } = await import('./app/einzelwerkzeuge.js');
      const ids = WERKZEUGE.map((w) => w.id);
      const aufgaben = [...document.querySelectorAll('#start-aufgaben .aufgabe')];
      return {
        anzahl: aufgaben.length,
        nummern: aufgaben.map((a) => a.querySelector('.aufgabe-nummer').textContent).join(','),
        tote: aufgaben.filter((a) => a.tagName === 'A')
          .map((a) => new URLSearchParams(a.getAttribute('href').slice(1)).get('werkzeug'))
          .filter((id) => !ids.includes(id)),
      };
    });
    if (stand.anzahl !== 6) throw new Error(`${stand.anzahl} Aufgaben`);
    if (stand.nummern !== '01,02,03,04,05,06') throw new Error(`Nummern ${stand.nummern}`);
    if (stand.tote.length) throw new Error(`führt ins Leere: ${stand.tote.join(', ')}`);
    return '6 Aufgaben, jede mit Ziel';
  });

  await pruefe('Entfernen und Leeren räumen die Ablage wirklich', async () => {
    const stand = await ablage(async () => {
      const a = await import('./app/ablage.js');
      const [d] = await a.liste();
      await a.entferne(d.id);
      const nachEntfernen = (await a.liste()).length;
      await a.legeSammlungAn('Rest');
      await a.leereAblage();
      return { nachEntfernen, dokumente: (await a.liste()).length, sammlungen: (await a.sammlungen()).length };
    });
    if (stand.nachEntfernen !== 0) throw new Error('Entfernen ließ den Eintrag stehen');
    if (stand.dokumente || stand.sammlungen) throw new Error('Leeren ließ etwas stehen');
    return 'beides leer';
  });

  await pruefe('Ohne Speicher im Browser öffnet das Studio genauso', async () => {
    /* Privates Fenster, gesperrter Speicher: IndexedDB fehlt. Die Ablage
       muss schweigen, nicht das Öffnen verhindern. */
    const kontext = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    await kontext.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
    });
    const fenster = await kontext.newPage();
    const fehler = [];
    fenster.on('pageerror', (e) => fehler.push(e.message));
    try {
      await fenster.goto(BASIS);
      await fenster.click('#knopf-beispiel');
      await fenster.waitForSelector('.blatt canvas', { timeout: 20000 });
      await fenster.evaluate(() => window.studio.fuehreAus('ansicht:start'));
      await fenster.waitForTimeout(400);
      const stapel = await fenster.textContent('#start-stapel');
      if (fehler.length) throw new Error(fehler[0]);
      if (!/merkt sich keine Dateien/.test(stapel)) throw new Error(`Stapel sagt „${stapel.trim()}"`);
      return 'Datei offen, Stapel sagt: nichts gemerkt';
    } finally {
      await kontext.close();
    }
  });

  /* Zurück auf den Stand, den die übrigen Gruppen kennen. */
  await seite.evaluate(() => localStorage.removeItem('studio:ablage-merken'));
  await ladeBeispiel();
}
