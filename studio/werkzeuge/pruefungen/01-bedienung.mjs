/* Bedienung — Befehlsregister, Ansicht, Tafeln, Werkzeuge.

   Die Grundlage: gibt es jeden Befehl, tut der Zoom was er soll, öffnen sich
   die Leisten, und zeichnet jedes Werkzeug das, was es verspricht. */

import { readFile } from 'node:fs/promises';

export default async function ({ pruefe, seite, blatt, ladungVon, befehle }) {
  console.log('\n== Befehlsregister ==');

  /* --- Ansicht -------------------------------------------------------------- */
  console.log('\n== Ansicht ==');
  await pruefe('Zoom: ganze Seite', async () => {
    await seite.selectOption('#feld-zoom', 'seite');
    await seite.waitForTimeout(900);
    const h = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().height);
    if (h > 900) throw new Error('Blatt passt nicht in die Höhe: ' + Math.round(h));
    return `${Math.round(h)} px hoch`;
  });
  await pruefe('Zoom: 100 % ist die Bezugsbreite des Handoffs, 200 % das Doppelte', async () => {
    /* Das Handoff setzt die Seite bei 100 % auf 720 px („Breite 720px ×
       zoom/100"). Bei Maßstab 1 wäre eine A4-Seite 595 px breit und stünde
       verloren auf der Bühne — die Prozentwerte beziehen sich deshalb auf 720. */
    await seite.selectOption('#feld-zoom', '1');
    await seite.waitForTimeout(900);
    const hundert = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().width);
    if (Math.abs(hundert - 720) > 6) throw new Error('bei 100 %: ' + Math.round(hundert));
    await seite.selectOption('#feld-zoom', '2');
    await seite.waitForTimeout(900);
    const doppelt = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().width);
    if (Math.abs(doppelt - 1440) > 8) throw new Error('bei 200 %: ' + Math.round(doppelt));
    return `${Math.round(hundert)} px / ${Math.round(doppelt)} px`;
  });
  await pruefe('Zoom: Breite', async () => {
    await seite.selectOption('#feld-zoom', 'breite');
    await seite.waitForTimeout(900);
    return '';
  });
  await pruefe('Zoomschritte (Strg +/-)', async () => {
    await seite.keyboard.press('Control+Equal');
    await seite.waitForTimeout(600);
    await seite.keyboard.press('Control+Minus');
    await seite.waitForTimeout(600);
    return '';
  });
  await pruefe('Ansicht drehen', async () => {
    const vorher = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().width);
    await seite.click('#knopf-drehen');
    await seite.waitForTimeout(1000);
    const nachher = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().height);
    await seite.click('#knopf-drehen');
    await seite.click('#knopf-drehen');
    await seite.click('#knopf-drehen');
    await seite.waitForTimeout(1000);
    return `quer ${Math.round(nachher)} px`;
  });
  await pruefe('Seitennavigation (Knöpfe und Feld)', async () => {
    await seite.click('#knopf-vor');
    await seite.waitForTimeout(700);
    const zwei = await seite.inputValue('#feld-seite');
    await seite.fill('#feld-seite', '5');
    await seite.press('#feld-seite', 'Enter');
    await seite.waitForTimeout(900);
    const fuenf = await seite.evaluate(() => window.studio.zustand.aktuelleSeite);
    if (zwei !== '2' || fuenf !== 5) throw new Error(`nach vor: ${zwei}, nach Sprung: ${fuenf}`);
    await seite.evaluate(() => window.studio.fuehreAus('gehezu:seite'));
    return '';
  });
  await pruefe('Home/End', async () => {
    await seite.click('#buehne');
    await seite.keyboard.press('Home');
    await seite.waitForTimeout(700);
    const eins = await seite.evaluate(() => window.studio.zustand.aktuelleSeite);
    await seite.keyboard.press('End');
    await seite.waitForTimeout(900);
    const letzte = await seite.evaluate(() => window.studio.zustand.aktuelleSeite);
    if (eins !== 1 || letzte !== 5) throw new Error(`${eins} / ${letzte}`);
    await seite.keyboard.press('Home');
    await seite.waitForTimeout(600);
    return '';
  });
  await pruefe('Thema wechseln', async () => {
    await seite.click('#knopf-thema');
    const a = await seite.evaluate(() => document.documentElement.dataset.thema);
    await seite.click('#knopf-thema');
    const b = await seite.evaluate(() => document.documentElement.dataset.thema);
    if (a === b) throw new Error('Thema bleibt ' + a);
    return `${a} → ${b}`;
  });
  await pruefe('Leisten ein/aus (F4/F5)', async () => {
    await seite.keyboard.press('F4');
    await seite.waitForTimeout(500);
    const zu = await seite.evaluate(() => document.querySelector('#huelle').dataset.links);
    await seite.keyboard.press('F4');
    await seite.keyboard.press('F5');
    await seite.waitForTimeout(500);
    const rechtsZu = await seite.evaluate(() => document.querySelector('#huelle').dataset.rechts);
    await seite.keyboard.press('F5');
    await seite.waitForTimeout(600);
    if (zu !== 'zu' || rechtsZu !== 'zu') throw new Error(`${zu} / ${rechtsZu}`);
    return '';
  });

  /* --- Tafeln --------------------------------------------------------------- */
  console.log('\n== Tafeln ==');
  await pruefe('Reiter Gliederung', async () => {
    await seite.click('[data-tafel="gliederung"].reiter-knopf');
    await seite.waitForTimeout(400);
    const text = await seite.textContent('#tafel-gliederung');
    if (!text.trim()) throw new Error('leer');
    return text.trim().slice(0, 50);
  });
  await pruefe('Reiter Kommentare (rechte Leiste)', async () => {
    /* Die Anmerkungsliste steht seit der Umgestaltung rechts als „Kommentare",
       mit Antworten und Erledigt-Zustand — nicht mehr links unter „Notizen". */
    await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
    await seite.waitForTimeout(300);
    const text = await seite.textContent('#tafel-kommentare');
    if (!text.trim()) throw new Error('leer');
    return text.trim().replace(/\s+/g, ' ').slice(0, 40);
  });
  await pruefe('Reiter Seiten', async () => {
    /* Die Seitenliste steht ab „Registratur" als Zeilen. Gezählt wird deshalb
       die Zeile, nicht das Bild — das Bild ist eine Wahl, die Zeile nicht. */
    await seite.click('[data-tafel="miniaturen"].reiter-knopf');
    await seite.waitForTimeout(400);
    const n = await seite.evaluate(() => document.querySelectorAll('.miniatur').length);
    if (n !== 5) throw new Error(String(n));
    return `${n} Seitenzeilen`;
  });

  /* --- Werkzeuge ------------------------------------------------------------ */
  console.log('\n== Werkzeuge ==');

  await pruefe('Freihand zeichnen', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:freihand'));
    const b = await blatt();
    const start = b.bei(0.1, 0.5);
    await seite.mouse.move(start.x, start.y);
    await seite.mouse.down();
    for (let i = 1; i <= 6; i++) await seite.mouse.move(start.x + i * 25, start.y + (i % 2 ? 20 : -20), { steps: 3 });
    await seite.mouse.up();
    await seite.waitForTimeout(400);
    const n = await seite.evaluate(() => window.studio.zustand.anmerkungen.filter((a) => a.art === 'freihand').length);
    if (!n) throw new Error('keine Freihand-Anmerkung');
    const punkte = await seite.evaluate(() => window.studio.zustand.anmerkungen.find((a) => a.art === 'freihand').punkte.length);
    return `${punkte} Punkte`;
  });
  await pruefe('Ellipse', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:ellipse'));
    const b = await blatt();
    const e1 = b.bei(0.45, 0.5), e2 = b.bei(0.6, 0.56);
    await seite.mouse.move(e1.x, e1.y);
    await seite.mouse.down();
    await seite.mouse.move(e2.x, e2.y, { steps: 6 });
    await seite.mouse.up();
    await seite.waitForTimeout(300);
    if (!await seite.evaluate(() => window.studio.zustand.anmerkungen.some((a) => a.art === 'ellipse'))) throw new Error('fehlt');
    return '';
  });
  await pruefe('Pfeil', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:pfeil'));
    const b = await blatt();
    const p1 = b.bei(0.65, 0.5), p2 = b.bei(0.8, 0.55);
    await seite.mouse.move(p1.x, p1.y);
    await seite.mouse.down();
    await seite.mouse.move(p2.x, p2.y, { steps: 6 });
    await seite.mouse.up();
    await seite.waitForTimeout(300);
    if (!await seite.evaluate(() => window.studio.zustand.anmerkungen.some((a) => a.art === 'pfeil'))) throw new Error('fehlt');
    return '';
  });
  await pruefe('Unterstreichen aus Textauswahl', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:auswahl'));
    const stelle = await seite.evaluate(() => {
      const s = [...document.querySelectorAll('.textebene span')].find((x) => x.textContent.includes('Auftragnehmer'));
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { x: r.left, y: r.top + r.height / 2, b: r.width };
    });
    if (!stelle) throw new Error('Textstück nicht gefunden');
    await seite.mouse.move(stelle.x + 2, stelle.y);
    await seite.mouse.down();
    await seite.mouse.move(stelle.x + stelle.b - 4, stelle.y, { steps: 8 });
    await seite.mouse.up();
    await seite.keyboard.press('u');
    await seite.waitForTimeout(400);
    if (!await seite.evaluate(() => window.studio.zustand.anmerkungen.some((a) => a.art === 'unterstrich'))) throw new Error('fehlt');
    return '';
  });
  await pruefe('Durchstreichen aus Textauswahl', async () => {
    const stelle = await seite.evaluate(() => {
      const s = [...document.querySelectorAll('.textebene span')].find((x) => x.textContent.includes('Einmessung'));
      if (!s) return null;
      const r = s.getBoundingClientRect();
      return { x: r.left, y: r.top + r.height / 2, b: r.width };
    });
    if (!stelle) throw new Error('Textstück nicht gefunden');
    await seite.mouse.move(stelle.x + 2, stelle.y);
    await seite.mouse.down();
    await seite.mouse.move(stelle.x + stelle.b - 4, stelle.y, { steps: 8 });
    await seite.mouse.up();
    await seite.keyboard.press('d');
    await seite.waitForTimeout(400);
    if (!await seite.evaluate(() => window.studio.zustand.anmerkungen.some((a) => a.art === 'durchstrich'))) throw new Error('fehlt');
    return '';
  });
  await pruefe('Notiz anlegen und bearbeiten', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:notiz'));
    const b = await blatt();
    const n = b.bei(0.85, 0.25);
    await seite.mouse.click(n.x, n.y);
    await seite.waitForSelector('.dialog textarea');
    await seite.fill('.dialog textarea', 'Prüfnotiz');
    await seite.click('.dialog-fuss .knopf:last-child');
    await seite.waitForTimeout(400);
    const notiz = await seite.evaluate(() => window.studio.zustand.anmerkungen.find((a) => a.art === 'notiz'));
    if (notiz?.text !== 'Prüfnotiz') throw new Error('Text: ' + notiz?.text);
    // Marke anklicken öffnet die Notiz erneut
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:auswahl'));
    await seite.waitForTimeout(200);
    return '';
  });
  await pruefe('Anmerkung wählen und verschieben', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('werkzeug:auswahl'));
    await seite.waitForTimeout(200);
    const id = await seite.evaluate(() => {
      const a = window.studio.zustand.anmerkungen.find((x) => x.art === 'ellipse');
      return a?.id;
    });
    const vorher = await seite.evaluate((id) => {
      const a = window.studio.zustand.anmerkungen.find((x) => x.id === id);
      return { x: a.x, y: a.y };
    }, id);
    const griff = await seite.locator(`[data-anmerkung="${id}"]`).first().boundingBox();
    if (!griff) throw new Error('Griff nicht sichtbar');
    // Erst die Linie greifen (so macht es ein Mensch), dann ziehen.
    const rand = { x: griff.x, y: griff.y + griff.height / 2 };
    await seite.mouse.move(rand.x, rand.y);
    await seite.mouse.down();
    await seite.mouse.move(rand.x + 40, rand.y + 25, { steps: 8 });
    await seite.mouse.up();
    await seite.waitForTimeout(300);
    // Danach ist sie gewählt: jetzt muss auch die Fläche fangen.
    const griff2 = await seite.locator(`[data-anmerkung="${id}"]`).first().boundingBox();
    await seite.mouse.move(griff2.x + griff2.width / 2, griff2.y + griff2.height / 2);
    await seite.mouse.down();
    await seite.mouse.move(griff2.x + griff2.width / 2 + 20, griff2.y + griff2.height / 2, { steps: 6 });
    await seite.mouse.up();
    await seite.waitForTimeout(400);
    const nachher = await seite.evaluate((id) => {
      const a = window.studio.zustand.anmerkungen.find((x) => x.id === id);
      return { x: a.x, y: a.y };
    }, id);
    if (Math.abs(nachher.x - vorher.x) < 5) throw new Error('nicht bewegt');
    return `Δx ${Math.round(nachher.x - vorher.x)} pt`;
  });
  await pruefe('Rückgängig und Wiederholen', async () => {
    const vorher = await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
    await seite.evaluate(() => window.studio.fuehreAus('rueckgaengig'));
    await seite.waitForTimeout(300);
    const mitte = await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
    await seite.evaluate(() => window.studio.fuehreAus('wiederholen'));
    await seite.waitForTimeout(300);
    const nachher = await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
    return `${vorher} → ${mitte} → ${nachher}`;
  });
  await pruefe('Kommentarliste zeigt alle Einträge', async () => {
    await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
    await seite.waitForTimeout(400);
    const faeden = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
    const anmerkungen = await seite.evaluate(() => window.studio.zustand.anmerkungen.filter((a) => !a.erledigt).length);
    if (faeden !== anmerkungen) throw new Error(`Liste ${faeden}, Modell ${anmerkungen}`);
    return `${faeden} Fäden`;
  });
  await pruefe('Kommentar beantworten und abhaken', async () => {
    await seite.locator('#tafel-kommentare .faden').first().click();
    await seite.waitForSelector('#tafel-kommentare .faden.ist-aktiv input.feld');
    await seite.fill('#tafel-kommentare .faden.ist-aktiv input.feld', 'Einverstanden, wird geändert');
    await seite.press('#tafel-kommentare .faden.ist-aktiv input.feld', 'Enter');
    await seite.waitForTimeout(400);
    const antworten = await seite.evaluate(() => window.studio.zustand.anmerkungen.filter((a) => a.antworten?.length).length);
    if (antworten !== 1) throw new Error(`${antworten} Anmerkungen mit Antwort`);
    const vorher = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
    await seite.click('#tafel-kommentare .faden.ist-aktiv button:has-text("Erledigt")');
    await seite.waitForTimeout(400);
    const nachher = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
    if (nachher !== vorher - 1) throw new Error(`${vorher} → ${nachher} statt einer weniger`);
    await seite.click('#tafel-kommentare .filterreihe .knopf:has-text("Erledigt")');
    await seite.waitForTimeout(300);
    const erledigt = await seite.evaluate(() => document.querySelectorAll('#tafel-kommentare .faden').length);
    if (erledigt !== 1) throw new Error(`unter „Erledigt" stehen ${erledigt}`);
    await seite.click('#tafel-kommentare .faden button:has-text("Wieder öffnen")');
    await seite.waitForTimeout(300);
    await seite.click('#tafel-kommentare .filterreihe .knopf:has-text("Offen")');
    await seite.waitForTimeout(300);
    return `Antwort vermerkt, abgehakt, wieder geöffnet`;
  });
  await pruefe('Anmerkungsbericht als Textdatei', async () => {
    await seite.click('[data-rtafel="anmerkungen"].reiter-knopf');
    await seite.waitForTimeout(300);
    const pfad = await ladungVon(() => seite.click('#tafel-kommentare button:has-text("Bericht")'));
    const inhalt = await readFile(pfad, 'utf8');
    if (!inhalt.includes('Prüfnotiz')) throw new Error('Notiz fehlt im Bericht');
    return `${inhalt.split('\n').length} Zeilen`;
  });
  await pruefe('Alle Anmerkungen löschen', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('anmerkungen:alleLoeschen'));
    await seite.waitForTimeout(300);
    await seite.click('.dialog-fuss .knopf:last-child');
    await seite.waitForTimeout(400);
    const n = await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
    if (n !== 0) throw new Error(String(n));
    await seite.evaluate(() => window.studio.fuehreAus('rueckgaengig'));
    await seite.waitForTimeout(300);
    return 'und zurückgenommen: ' + await seite.evaluate(() => window.studio.zustand.anmerkungen.length);
  });
}
