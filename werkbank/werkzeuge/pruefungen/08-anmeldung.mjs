/* Anmeldeschranke — die Werkbank vor der Anmeldung, dahinter, und wenn die
   Auskunft schweigt. */

export default async function ({ pruefe, seite, ladeBeispiel }) {
  console.log('\n== Anmeldeschranke ==');

  await pruefe('Ohne Auskunft läuft die Werkbank ohne Anmeldung', async () => {
    /* Der wichtigste Fall: eine Werkbank auf einem eigenen Server, ohne
       Mitgliederverwaltung. Sie muss vollständig starten — Leitprinzip 2. */
    await ladeBeispiel();
    const schranke = await seite.evaluate(() => !!document.querySelector('#anmeldeschranke'));
    if (schranke) throw new Error('es liegt eine Schranke davor, obwohl niemand danach gefragt hat');
    const meta = await seite.evaluate(() => document.querySelector('meta[name="werkbank-anmeldung"]'));
    if (meta) throw new Error('die Quellfassung trägt die Schranken-Zeile — sie gehört erst in die Arbeitskopie');
    return 'keine Schranke, kein Meta';
  });

  await pruefe('Sagt die Auskunft „nicht angemeldet", legt sich die Schranke davor', async () => {
    const lage = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      /* Die Auskunft wird hier vorgetäuscht, statt einen zweiten Server zu
         starten: geprüft wird das Verhalten der Werkbank, nicht das von fetch. */
      const echt = window.fetch;
      window.fetch = async () => new Response(JSON.stringify({ angemeldet: false }),
        { status: 200, headers: { 'content-type': 'application/json' } });
      const kopf = document.createElement('meta');
      kopf.name = 'werkbank-anmeldung';
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

  await pruefe('Antwortet die Auskunft nicht, läuft die Werkbank trotzdem', async () => {
    /* Eine Anwendung, die den Dienst verweigert, weil ein Server schweigt, wäre
       das Gegenteil dessen, wofür sie gebaut ist. */
    const antwort = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      const echt = window.fetch;
      window.fetch = async () => { throw new Error('kein Netz'); };
      const kopf = document.createElement('meta');
      kopf.name = 'werkbank-anmeldung';
      kopf.content = '/api/mitglied.json';
      document.head.append(kopf);
      const ergebnis = await m.frageAnmeldung();
      kopf.remove();
      window.fetch = echt;
      return ergebnis;
    });
    if (antwort.noetig) throw new Error('sie besteht auf einer Anmeldung, die niemand beantworten kann');
    return 'fällt auf „läuft" zurück';
  });

  await pruefe('Angemeldet heißt: keine Schranke', async () => {
    const antwort = await seite.evaluate(async () => {
      const m = await import('./app/anmeldung.js');
      const echt = window.fetch;
      window.fetch = async () => new Response(JSON.stringify({ angemeldet: true, name: 'Ada Musterfrau' }),
        { status: 200, headers: { 'content-type': 'application/json' } });
      const kopf = document.createElement('meta');
      kopf.name = 'werkbank-anmeldung';
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
    return `angemeldet als ${antwort.name}`;
  });
}
