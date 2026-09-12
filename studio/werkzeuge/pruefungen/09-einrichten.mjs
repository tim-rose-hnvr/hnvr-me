/* Einrichten — das Manifest, der Dienst und die Kernliste.

   Die Kernliste in `dienst.js` ist von Hand geschrieben. Das geht genau so
   lange gut, wie jemand sie pflegt — und niemand pflegt eine Liste, an die er
   nicht erinnert wird. Also erinnert diese Gruppe daran: fehlt ein Modul aus
   `app/`, scheitert der Lauf. Ohne diese Prüfung wäre die installierte Fassung
   nach dem nächsten neuen Modul offline kaputt, und zwar unbemerkt. */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export default async function ({ pruefe, seite, ladeBeispiel, WURZEL, BASIS }) {
  console.log('\n== Einrichten und Offline ==');

  await pruefe('Das Manifest sagt, was der Browser braucht', async () => {
    const roh = await readFile(join(WURZEL, 'manifest.json'), 'utf8');
    const m = JSON.parse(roh);
    for (const feld of ['name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
      if (!m[feld]) throw new Error(`${feld} fehlt`);
    }
    if (m.display !== 'standalone') throw new Error(`display: ${m.display}`);
    if (m.theme_color !== '#21272C') throw new Error(`theme_color: ${m.theme_color}`);
    const groessen = m.icons.map((s) => s.sizes);
    if (!groessen.includes('192x192') || !groessen.includes('512x512')) {
      throw new Error(`Symbolgrößen: ${groessen.join(', ')}`);
    }
    if (!m.icons.some((s) => s.purpose === 'maskable')) throw new Error('kein maskierbares Symbol');
    return `${m.short_name}, ${m.icons.length} Symbole, ${m.shortcuts?.length || 0} Verknüpfungen`;
  });

  await pruefe('Jedes Symbol aus dem Manifest liegt auch da', async () => {
    const m = JSON.parse(await readFile(join(WURZEL, 'manifest.json'), 'utf8'));
    const wege = [...m.icons.map((s) => s.src), 'symbole/symbol.svg'];
    const fehlen = [];
    for (const weg of wege) {
      const antwort = await seite.request.get(new URL(weg, BASIS).href);
      if (!antwort.ok()) fehlen.push(`${weg} (${antwort.status()})`);
    }
    if (fehlen.length) throw new Error(fehlen.join(', '));
    return `${wege.length} Dateien erreichbar`;
  });

  await pruefe('Die Kernliste des Dienstes kennt jedes Modul in app/', async () => {
    const dienst = await readFile(join(WURZEL, 'dienst.js'), 'utf8');
    const dateien = (await readdir(join(WURZEL, 'app'))).filter((n) => /\.(js|css)$/.test(n));
    const fehlen = dateien.filter((n) => !dienst.includes(`app/${n}`));
    if (fehlen.length) {
      throw new Error(`nicht in KERN: ${fehlen.join(', ')} — dienst.js ergänzen, sonst fehlen sie offline`);
    }
    return `${dateien.length} Module, alle in der Liste`;
  });

  await pruefe('Kern und Nachschub greifen auf nichts Erfundenes zu', async () => {
    const dienst = await readFile(join(WURZEL, 'dienst.js'), 'utf8');
    const wege = [...dienst.matchAll(/'((?:app|fremd|symbole)\/[^']+)'/g)].map((t) => t[1]);
    const fehlen = [];
    for (const weg of [...new Set(wege)]) {
      const antwort = await seite.request.get(new URL(weg, BASIS).href);
      if (!antwort.ok()) fehlen.push(weg);
    }
    if (fehlen.length) throw new Error(`gibt es nicht: ${fehlen.slice(0, 5).join(', ')}`);
    return `${new Set(wege).size} Wege, alle erreichbar`;
  });

  await pruefe('Der Dienst lässt die Anmeldung nie aus dem Zwischenspeicher', async () => {
    const dienst = await readFile(join(WURZEL, 'dienst.js'), 'utf8');
    if (!/istApi\(url\)\) return;/.test(dienst)) throw new Error('keine Ausnahme für /api/');
    /* Eine zwischengespeicherte Anmeldeauskunft wäre eine Lüge, die niemand
       mehr los wird — der Merkzettel ist der einzige erlaubte Weg dorthin. */
    return 'alles unter /api/ geht am Zwischenspeicher vorbei';
  });

  await pruefe('Der Dienst meldet sich an und trägt das Studio offline', async () => {
    await ladeBeispiel();
    const stand = await seite.evaluate(async () => {
      const anmeldung = await navigator.serviceWorker?.getRegistration();
      return {
        angemeldet: !!anmeldung,
        umfang: anmeldung?.scope || '',
        anzeige: document.querySelector('#fuss-stand')?.textContent || '',
      };
    });
    if (!stand.angemeldet) throw new Error('kein Dienst angemeldet');
    if (!stand.umfang.endsWith('/')) throw new Error(`Umfang: ${stand.umfang}`);
    if (!/offline|Netz/.test(stand.anzeige)) throw new Error(`Fußzeile sagt „${stand.anzeige}"`);
    return `Umfang ${stand.umfang.replace(/^https?:\/\/[^/]+/, '')} · Fuß: „${stand.anzeige.trim()}"`;
  });

  await pruefe('Der Kern liegt danach wirklich im Zwischenspeicher', async () => {
    /* Der Dienst richtet sich beim ersten Besuch ein; das braucht einen
       Augenblick, in dem 4 MB über die Leitung gehen. */
    const gelegt = await seite.evaluate(async () => {
      for (let versuch = 0; versuch < 40; versuch++) {
        const namen = await caches.keys();
        const kern = namen.find((n) => n.endsWith('-kern'));
        if (kern) {
          const lager = await caches.open(kern);
          const liegt = await lager.keys();
          if (liegt.length > 40) return liegt.length;
        }
        await new Promise((l) => setTimeout(l, 250));
      }
      return 0;
    });
    if (!gelegt) throw new Error('nichts im Zwischenspeicher');
    return `${gelegt} Dateien liegen bereit`;
  });

  await pruefe('Der Einrichten-Dialog sagt die Wahrheit über diesen Browser', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('installieren'));
    await seite.waitForSelector('.dialog');
    const stand = await seite.evaluate(() => ({
      titel: document.querySelector('.dialog-kopf h2')?.textContent,
      text: document.querySelector('.dialog-rumpf')?.textContent || '',
      knoepfe: [...document.querySelectorAll('.dialog-fuss .knopf')].map((k) => k.textContent),
    }));
    await seite.evaluate(() => { document.querySelector('#schirm').hidden = true; document.querySelector('#schirm').innerHTML = ''; });
    if (stand.titel !== 'Auf diesem Gerät einrichten') throw new Error(`Titel: ${stand.titel}`);
    if (!/Vorrat/.test(stand.text)) throw new Error('kein Vorratsknopf');
    /* Kopfloses Chromium bietet kein `beforeinstallprompt` an. Dann darf dort
       auch kein „Einrichten" stehen — ein Knopf, der nichts tut, ist schlimmer
       als kein Knopf. */
    if (stand.knoepfe.includes('Einrichten')) throw new Error('Einrichten-Knopf ohne Angebot des Browsers');
    if (!/Safari|Adresszeile/.test(stand.text)) throw new Error('kein Weg von Hand genannt');
    return stand.knoepfe.join(' · ');
  });

  await pruefe('Startbefehle aus der Adresse greifen', async () => {
    await seite.goto(`${BASIS}?tun=beispiel`);
    await seite.waitForSelector('.blatt canvas', { timeout: 30000 });
    const name = await seite.evaluate(() => window.studio.zustand.name);
    if (!name) throw new Error('nichts geladen');
    return `?tun=beispiel öffnet „${name}"`;
  });
}
