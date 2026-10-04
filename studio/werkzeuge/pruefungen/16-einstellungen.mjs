/* Einstellungen — die Seite und was sie schaltet.

   Geprüft wird die Wirkung, nicht das Aussehen: eine Einstellung, die
   dasteht und nichts tut, ist schlimmer als keine. Dazu die beiden Stellen,
   an denen etwas schiefgehen kann, ohne dass es jemand sieht — dass ohne
   Zustimmung nichts im Browser liegen bleibt, und dass eine eingespielte
   Datei nur annimmt, was es gibt. */

export default async function ({ pruefe, seite, ladeBeispiel, dialogSchliessen }) {
  console.log('\n== Einstellungen ==');

  const oeffne = async (bereich) => {
    await seite.evaluate(() => window.studio.fuehreAus('einstellungen'));
    await seite.waitForSelector('#ansicht-einstellungen .einst-kategorie');
    if (bereich) {
      await seite.click(`.einst-kategorie[data-bereich="${bereich}"]`);
      await seite.waitForTimeout(250);
    }
  };
  const waehle = async (schluessel, wert) => {
    await seite.selectOption(`select[data-einstellung="${schluessel}"]`, wert);
    await seite.waitForTimeout(200);
  };
  const gemerkt = () => seite.evaluate(() => localStorage.getItem('studio:einstellungen'));
  const wurzel = () => seite.evaluate(() => {
    const w = document.documentElement;
    return {
      dichte: w.dataset.dichte, papier: w.dataset.papier,
      kontrast: w.hasAttribute('data-kontrast'), ruhig: w.hasAttribute('data-ruhig'),
      fokus: w.hasAttribute('data-fokus-stark'), ohneKuerzel: w.hasAttribute('data-ohne-kuerzel'),
    };
  });

  await pruefe('Ohne „merken" wirkt eine Einstellung — und bleibt nicht liegen', async () => {
    await seite.evaluate(() => { localStorage.removeItem('studio:ablage-merken'); localStorage.removeItem('studio:einstellungen'); });
    await oeffne(1);
    await waehle('anzeige.dichte', 'kompakt');
    const stand = await wurzel();
    const liegt = await gemerkt();
    const schild = await seite.textContent('.einst-gespeichert');
    await waehle('anzeige.dichte', 'komfortabel');
    if (stand.dichte !== 'kompakt') throw new Error(`Dichte „${stand.dichte}"`);
    if (liegt) throw new Error(`im Browser liegt: ${liegt}`);
    if (!/diese Sitzung/.test(schild)) throw new Error(`oben steht „${schild}"`);
    return `kompakt angewandt, nichts gemerkt, „${schild.trim()}"`;
  });

  await pruefe('Mit „merken" übersteht eine Einstellung das Neuladen', async () => {
    await seite.evaluate(async () => (await import('./app/dokumentenatelier.js')).setzeMerken('ja'));
    await oeffne(1);
    await waehle('anzeige.papier', 'warm');
    const schild = await seite.textContent('.einst-gespeichert');
    const liegt = JSON.parse(await gemerkt() || '{}');
    await seite.reload();
    await ladeBeispiel();
    const nachher = await wurzel();
    const filter = await seite.evaluate(() => getComputedStyle(document.querySelector('.blatt canvas')).filter);
    /* Zurück: Originalfarben, und „Nichts merken" räumt die gemerkten
       Einstellungen gleich mit ab. */
    await oeffne(1);
    await waehle('anzeige.papier', 'original');
    await seite.evaluate(async () => (await import('./app/dokumentenatelier.js')).setzeMerken('nein'));
    const danach = await gemerkt();
    if (!/Automatisch gespeichert/.test(schild)) throw new Error(`oben steht „${schild}"`);
    if (liegt['anzeige.papier'] !== 'warm') throw new Error('nicht gemerkt');
    if ('ablage.merken' in liegt) throw new Error('die Zustimmung selbst steht in den Einstellungen');
    if (nachher.papier !== 'warm') throw new Error(`nach dem Neuladen Papier „${nachher.papier}"`);
    if (!/sepia/.test(filter)) throw new Error(`Blatt ohne Wärme: ${filter}`);
    if (danach) throw new Error('„Nichts merken" ließ die Einstellungen liegen');
    return 'warm gemerkt, nach dem Neuladen angewandt; „Nichts merken" räumt ab';
  });

  await pruefe('Eine eingespielte Konfiguration nimmt nur an, was es gibt', async () => {
    await oeffne(9);
    const datei = {
      studio: 'PDF Studio',
      einstellungen: {
        'anzeige.papier': 'dunkel',          // gültig
        'anzeige.dichte': 'riesig',          // kein erlaubter Wert
        'zugang.kontrast': 'ja',             // Schalter, aber kein Wahrheitswert
        'ablage.merken': 'ja',               // die Zustimmung kommt nicht aus einer Datei
        'irgendwas.neues': true,             // unbekannt
      },
    };
    const [wahl] = await Promise.all([
      seite.waitForEvent('filechooser'),
      seite.click('.einst-zeile:has-text("Konfiguration importieren") .knopf'),
    ]);
    await wahl.setFiles({ name: 'fremd.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(datei)) });
    await seite.waitForTimeout(500);
    const stand = await wurzel();
    const merken = await seite.evaluate(() => localStorage.getItem('studio:ablage-merken'));
    const meldung = await seite.evaluate(() => document.querySelector('#meldungen, .meldung, [role="status"]')?.textContent || '');
    await oeffne(1);
    await waehle('anzeige.papier', 'original');
    if (stand.papier !== 'dunkel') throw new Error(`Papier „${stand.papier}"`);
    if (stand.dichte === 'riesig') throw new Error('„riesig" angenommen');
    if (stand.kontrast) throw new Error('„ja" als Schalter angenommen');
    if (merken !== 'nein') throw new Error(`die Datei hat die Zustimmung auf „${merken}" gesetzt`);
    return `1 von 5 übernommen${/1 Einstellung/.test(meldung) ? ', und die Meldung sagt es' : ''}`;
  });

  await pruefe('Kontrast, Bewegung, Fokus und Kürzel schalten die Oberfläche', async () => {
    await oeffne(1);
    for (const s of ['zugang.kontrast', 'zugang.bewegung', 'zugang.fokus', 'bedienung.kuerzel']) {
      await seite.click(`[data-einstellung="${s}"]`);
      await seite.waitForTimeout(100);
    }
    const stand = await wurzel();
    const wirkung = await seite.evaluate(() => {
      const st = getComputedStyle(document.documentElement);
      const probe = document.body.appendChild(Object.assign(document.createElement('span'), { className: 'menue-kuerzel', textContent: '⌘O' }));
      const versteckt = getComputedStyle(probe).display === 'none';
      probe.remove();
      return { leise: st.getPropertyValue('--tinte-leise').trim(), tinte: st.getPropertyValue('--tinte').trim(), versteckt };
    });
    const schalter = await seite.$$eval('#ansicht-einstellungen .pille[role="switch"]', (k) => k.every((x) => x.getAttribute('aria-checked') === (x.classList.contains('ist-an') ? 'true' : 'false')));
    for (const s of ['zugang.kontrast', 'zugang.bewegung', 'zugang.fokus', 'bedienung.kuerzel']) {
      await seite.click(`[data-einstellung="${s}"]`);
      await seite.waitForTimeout(100);
    }
    const zurueck = await wurzel();
    if (!stand.kontrast || !stand.ruhig || !stand.fokus || !stand.ohneKuerzel) throw new Error(JSON.stringify(stand));
    if (wirkung.leise !== wirkung.tinte) throw new Error(`leise Schrift bleibt ${wirkung.leise}`);
    if (!wirkung.versteckt) throw new Error('Kürzel in Menüs stehen noch da');
    if (!schalter) throw new Error('ein Schalter sagt der Sprachausgabe etwas anderes, als er zeigt');
    if (zurueck.kontrast || zurueck.ruhig || zurueck.fokus || zurueck.ohneKuerzel) throw new Error('nicht zurückgeschaltet');
    return 'vier Schalter, je mit Wirkung im Baum, und zurück';
  });

  await pruefe('„Hinweise zeigen" aus heißt aus — mit dem Weg zurück', async () => {
    await oeffne(1);
    await seite.click('[data-einstellung="mitdenken.an"]');
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:editor'));
    await seite.waitForTimeout(300);
    const aus = await seite.evaluate(() => ({
      vorschlaege: document.querySelectorAll('.vorschlag').length,
      satz: /Hinweise sind ausgeschaltet/.test(document.body.textContent),
    }));
    await oeffne(1);
    await seite.click('[data-einstellung="mitdenken.an"]');
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:editor'));
    await seite.waitForTimeout(300);
    const an = await seite.evaluate(() => document.querySelectorAll('.vorschlag').length);
    if (aus.vorschlaege) throw new Error(`${aus.vorschlaege} Vorschläge trotz „aus"`);
    if (!aus.satz) throw new Error('kein Satz, wo man sie wieder einschaltet');
    if (!an) throw new Error('nach dem Einschalten keine Vorschläge');
    return `aus: 0 und ein Satz; an: ${an} Vorschläge`;
  });

  await pruefe('„Metadaten entfernen" ist die Vorgabe im Sichern-Dialog', async () => {
    await oeffne(5);
    await seite.click('[data-einstellung="schutz.metadaten"]');
    await seite.evaluate(() => window.studio.fuehreAus('sichern:als'));
    await seite.waitForSelector('.dialog');
    const angekreuzt = await seite.evaluate(() =>
      [...document.querySelectorAll('.dialog label.zeile-kasten')]
        .find((l) => /Verfasser/.test(l.textContent))?.querySelector('input')?.checked);
    await dialogSchliessen();
    await oeffne(5);
    await seite.click('[data-einstellung="schutz.metadaten"]');
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:editor'));
    if (angekreuzt !== true) throw new Error(`Kasten ${angekreuzt}`);
    return 'angekreuzt, solange die Einstellung an ist';
  });

  await pruefe('Die Suche findet über alle Bereiche — und behält den Fokus', async () => {
    await oeffne(1);
    await seite.click('#einst-suche');
    await seite.keyboard.type('Metadaten');
    await seite.waitForTimeout(400);
    const stand = await seite.evaluate(() => ({
      titel: document.querySelector('#ansicht-einstellungen h2')?.textContent,
      treffer: [...document.querySelectorAll('#ansicht-einstellungen .einst-zeile')].map((z) => z.dataset.schluessel),
      fokus: document.activeElement?.id,
    }));
    await seite.fill('#einst-suche', '');
    await seite.waitForTimeout(300);
    await seite.evaluate(() => window.studio.fuehreAus('ansicht:editor'));
    if (!/Treffer/.test(stand.titel)) throw new Error(`Titel „${stand.titel}"`);
    if (!stand.treffer.includes('schutz.metadaten')) throw new Error(`Treffer: ${stand.treffer.join(', ')}`);
    if (stand.fokus !== 'einst-suche') throw new Error(`Fokus auf ${stand.fokus}`);
    return `„${stand.titel}": ${stand.treffer.join(', ')}`;
  });

  /* Zurück auf den Stand, den die übrigen Gruppen kennen. */
  await seite.evaluate(async () => {
    localStorage.removeItem('studio:ablage-merken');
    await (await import('./app/ablage.js')).leereAblage();
  });
  await ladeBeispiel();
}
