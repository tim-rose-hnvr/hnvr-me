/* Anmeldeschranke — das Studio vor der Anmeldung, dahinter, und wenn die
   Auskunft schweigt. */

export default async function ({ pruefe, seite, ladeBeispiel }) {
  console.log('\n== Anmeldeschranke ==');

  await pruefe('Ohne Auskunft läuft das Studio ohne Anmeldung', async () => {
    /* Der wichtigste Fall: ein Studio auf einem eigenen Server, ohne
       Mitgliederverwaltung. Sie muss vollständig starten — Leitprinzip 2. */
    await ladeBeispiel();
    const schranke = await seite.evaluate(() => !!document.querySelector('#anmeldeschranke'));
    if (schranke) throw new Error('es liegt eine Schranke davor, obwohl niemand danach gefragt hat');
    const meta = await seite.evaluate(() => document.querySelector('meta[name="studio-anmeldung"]'));
    if (meta) throw new Error('die Quellfassung trägt die Schranken-Zeile — sie gehört erst in die Arbeitskopie');
    return 'keine Schranke, kein Meta';
  });

  await pruefe('Sagt die Auskunft „nicht angemeldet", legt sich die Schranke davor', async () => {
    const lage = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      /* Die Auskunft wird hier vorgetäuscht, statt einen zweiten Server zu
         starten: geprüft wird das Verhalten des Studios, nicht das von fetch. */
      const echt = window.fetch;
      window.fetch = async () => new Response(JSON.stringify({ angemeldet: false }),
        { status: 200, headers: { 'content-type': 'application/json' } });
      const kopf = document.createElement('meta');
      kopf.name = 'studio-anmeldung';
      kopf.content = '/api/mitglied.json';
      document.head.append(kopf);

      const antwort = await m.frageAnmeldung();
      if (antwort.noetig && !antwort.angemeldet) m.zeigeSchranke();

      const schirm = document.querySelector('#anmeldeschranke');
      const ergebnis = {
        antwort,
        da: !!schirm,
        text: schirm?.textContent?.replace(/\s+/g, ' ').slice(0, 60),
        ziel: schirm?.querySelector('a')?.getAttribute('href'),
        deckt: schirm ? Math.round(schirm.getBoundingClientRect().width) : 0,
      };
      m.entferneSchranke();
      kopf.remove();
      window.fetch = echt;
      return ergebnis;
    });
    if (!lage.antwort.noetig) throw new Error('die Auskunft wurde nicht gelesen');
    if (!lage.da) throw new Error('keine Schranke');
    if (!/\/api\/auth\/login/.test(lage.ziel || '')) throw new Error(`Ziel des Knopfes: ${lage.ziel}`);
    if (!/returnToUrl/.test(lage.ziel || '')) throw new Error('der Weg zurück fehlt');
    if (lage.deckt < 400) throw new Error(`die Schranke ist nur ${lage.deckt} px breit`);
    return `${lage.text}… → ${lage.ziel.slice(0, 40)}`;
  });

  /* Ohne Netz entscheidet der Merkzettel. Zwei Fälle, und der Unterschied ist
     der ganze Punkt: wer nie angemeldet war, kommt nicht hinein; wer es war,
     arbeitet weiter. Sonst wäre die installierte Fassung beim ersten Funkloch
     wertlos — oder die Anmeldung ohne Sinn. */
  await pruefe('Ohne Netz und ohne Merkzettel: Schranke, und sie sagt warum', async () => {
    const lage = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      localStorage.removeItem('studio:anmeldung');
      const echt = window.fetch;
      window.fetch = async () => { throw new Error('kein Netz'); };
      const kopf = document.createElement('meta');
      kopf.name = 'studio-anmeldung';
      kopf.content = '/api/mitglied.json';
      document.head.append(kopf);

      const antwort = await m.frageAnmeldung();
      if (antwort.noetig && !antwort.angemeldet) m.zeigeSchranke({ ohneNetz: antwort.ausDemGedaechtnis });
      const schirm = document.querySelector('#anmeldeschranke');
      const ergebnis = {
        antwort,
        ueberschrift: schirm?.querySelector('h1')?.textContent || '',
        knopf: schirm?.querySelector('a')?.textContent || '',
      };
      m.entferneSchranke();
      kopf.remove();
      window.fetch = echt;
      return ergebnis;
    });
    if (lage.antwort.angemeldet) throw new Error('sie lässt ohne jede Anmeldung durch');
    if (!lage.antwort.ausDemGedaechtnis) throw new Error('sie merkt nicht, dass das Netz fehlt');
    if (!/Ohne Netz/.test(lage.ueberschrift)) throw new Error(`Überschrift: „${lage.ueberschrift}"`);
    /* Ein Knopf mit „Anmelden" wäre hier eine Lüge — es fehlt das Netz, nicht der Wille. */
    if (lage.knopf !== 'Erneut versuchen') throw new Error(`Knopf sagt „${lage.knopf}"`);
    return `„${lage.ueberschrift}" → ${lage.knopf}`;
  });

  await pruefe('Ohne Netz, aber mit frischem Merkzettel: sie arbeitet weiter', async () => {
    const antwort = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      localStorage.setItem('studio:anmeldung', JSON.stringify({ zeit: Date.now(), name: 'Ada Musterfrau' }));
      const echt = window.fetch;
      window.fetch = async () => { throw new Error('kein Netz'); };
      const kopf = document.createElement('meta');
      kopf.name = 'studio-anmeldung';
      kopf.content = '/api/mitglied.json';
      document.head.append(kopf);
      const ergebnis = await m.frageAnmeldung();
      const tage = m.verbleibendeTage();
      localStorage.removeItem('studio:anmeldung');
      kopf.remove();
      window.fetch = echt;
      return { ...ergebnis, tage };
    });
    if (!antwort.angemeldet) throw new Error('der Merkzettel wird nicht gelesen');
    if (!antwort.ausDemGedaechtnis) throw new Error('sie tut, als käme das vom Server');
    if (antwort.tage !== 30) throw new Error(`Frist: ${antwort.tage} Tage statt 30`);
    return `hält noch ${antwort.tage} Tage`;
  });

  await pruefe('Ein abgelaufener Merkzettel zählt nicht mehr', async () => {
    const antwort = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      const vor40Tagen = Date.now() - 40 * 24 * 60 * 60 * 1000;
      localStorage.setItem('studio:anmeldung', JSON.stringify({ zeit: vor40Tagen, name: 'Ada' }));
      const echt = window.fetch;
      window.fetch = async () => { throw new Error('kein Netz'); };
      const kopf = document.createElement('meta');
      kopf.name = 'studio-anmeldung';
      kopf.content = '/api/mitglied.json';
      document.head.append(kopf);
      const ergebnis = await m.frageAnmeldung();
      const tage = m.verbleibendeTage();
      localStorage.removeItem('studio:anmeldung');
      kopf.remove();
      window.fetch = echt;
      return { ...ergebnis, tage };
    });
    if (antwort.angemeldet) throw new Error('40 Tage alt und trotzdem gültig');
    if (antwort.tage !== 0) throw new Error(`noch ${antwort.tage} Tage übrig`);
    return 'nach 40 Tagen ist Schluss';
  });

  await pruefe('Angemeldet heißt: keine Schranke', async () => {
    const antwort = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      const echt = window.fetch;
      window.fetch = async () => new Response(JSON.stringify({ angemeldet: true, name: 'Ada Musterfrau' }),
        { status: 200, headers: { 'content-type': 'application/json' } });
      const kopf = document.createElement('meta');
      kopf.name = 'studio-anmeldung';
      kopf.content = '/api/mitglied.json';
      document.head.append(kopf);
      const ergebnis = await m.frageAnmeldung();
      kopf.remove();
      window.fetch = echt;
      return ergebnis;
    });
    if (!antwort.noetig || !antwort.angemeldet) throw new Error(JSON.stringify(antwort));
    if (antwort.name !== 'Ada Musterfrau') throw new Error(`Name: ${antwort.name}`);
    if (await seite.evaluate(() => !!document.querySelector('#anmeldeschranke'))) throw new Error('trotzdem eine Schranke');
    /* Eine bestätigte Anmeldung schreibt den Merkzettel — sonst trägt sie
       nichts in den Offline-Betrieb hinüber. */
    const gemerkt = await seite.evaluate(() => {
      const zettel = JSON.parse(localStorage.getItem('studio:anmeldung') || 'null');
      localStorage.removeItem('studio:anmeldung');
      return zettel;
    });
    if (!gemerkt?.zeit) throw new Error('kein Merkzettel geschrieben');
    if (gemerkt.name !== 'Ada Musterfrau') throw new Error(`Merkzettel nennt „${gemerkt.name}"`);
    return `angemeldet als ${antwort.name}, gemerkt`;
  });
}
