/* Bedienbarkeit — Fokus, Bewegung, Trefferflächen, Sprachausgabe.

   Diese Gruppe ist aus einem Befund entstanden, nicht aus einer Meinung.
   Gemessen wurde am fertigen Programm, und es kam heraus:

     47 von 52 bedienbaren Dingen zeigten beim Tastaturfokus nichts an
     der Fokus verließ jeden Dialog nach 13 Sprüngen nach hinten
     acht Reiter trugen `role="tab"`, aber keiner sagte, welcher offen ist
     die Meldung kam animiert und verschwand schlagartig
     keine einzige Regel für Menschen, die Bewegung abgestellt haben
     kein Abstand zur Aussparung, obwohl die Seite bis darunter reicht

   Jeder dieser sechs Punkte steht hier als Prüfung. Sie sind billig zu
   halten und teuer zu verlieren: alle sechs fallen niemandem auf, der mit
   Maus und ohne Einschränkung arbeitet — und machen das Programm für alle
   anderen unbrauchbar. */

export default async function ({ pruefe, seite, browser, BASIS, ladeBeispiel }) {
  console.log('\n== Bedienbarkeit ==');

  await pruefe('Jedes bedienbare Ding zeigt den Tastaturfokus', async () => {
    await ladeBeispiel();
    /* Wirklich tabben, nicht `focus()` rufen: `:focus-visible` greift bei
       einem Knopf nur, wenn der Fokus von der Tastatur kommt. Ein Prüflauf,
       der das übersieht, meldet Mängel, die es nicht gibt — und übersieht
       die, die es gibt. */
    await seite.evaluate(() => document.body.focus());
    const ohne = [];
    const gesehen = new Set();
    for (let i = 0; i < 70; i++) {
      await seite.keyboard.press('Tab');
      const k = await seite.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body || !a.closest('#huelle')) return null;
        const s = getComputedStyle(a);
        const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
        return { name: a.id || a.className || a.tagName, ring, sichtbar: a.matches(':focus-visible') };
      });
      if (!k) continue;
      if (gesehen.has(k.name)) continue;
      gesehen.add(k.name);
      if (!k.ring || !k.sichtbar) ohne.push(k.name);
    }
    if (!gesehen.size) throw new Error('die Tabulatortaste kommt nirgends an');
    if (ohne.length) throw new Error(`${ohne.length} ohne Ring: ${ohne.slice(0, 6).join(', ')}`);
    return `${gesehen.size} Stationen ertabbt, jede mit Ring`;
  });

  await pruefe('Der Fokus bleibt im Dialog, statt dahinterzufallen', async () => {
    await seite.evaluate(() => window.studio.fuehreAus('eigenschaften'));
    await seite.waitForSelector('.dialog');
    /* Zweimal um die Kette herum. Bricht er aus, steht der Mensch plötzlich
       auf der gesperrten Anwendung dahinter und weiß nicht, wie er zurück
       in den Dialog kommt. */
    for (let i = 0; i < 60; i++) {
      await seite.keyboard.press('Tab');
      const drin = await seite.evaluate(() => !!document.activeElement?.closest('.dialog'));
      if (!drin) throw new Error(`nach ${i + 1} Sprüngen draußen`);
    }
    return '60 Sprünge, immer noch drin';
  });

  await pruefe('Nach dem Schließen steht der Fokus wieder, wo er herkam', async () => {
    await seite.evaluate(() => { document.querySelector('#schirm').hidden = true; document.querySelector('#schirm').innerHTML = ''; });
    const stand = await seite.evaluate(async () => {
      const kern = await import('./app/kern.js');
      const knopf = document.querySelector('#knopf-einstellungen') || document.querySelector('.werkzeug');
      knopf.focus();
      const vorher = document.activeElement;
      window.studio.fuehreAus('eigenschaften');
      await new Promise((l) => setTimeout(l, 300));
      const imDialog = !!document.activeElement?.closest('.dialog');
      kern.schliesseDialog();
      await new Promise((l) => setTimeout(l, 200));
      return { imDialog, zurueck: document.activeElement === vorher, wo: document.activeElement?.id || document.activeElement?.tagName };
    });
    if (!stand.imDialog) throw new Error('der Fokus ging gar nicht erst in den Dialog');
    if (!stand.zurueck) throw new Error(`er steht jetzt auf ${stand.wo}`);
    return `zurück auf ${stand.wo}`;
  });

  await pruefe('Die Reiter sagen der Sprachausgabe, welcher offen ist', async () => {
    const stand = await seite.evaluate(() => {
      const reiter = [...document.querySelectorAll('.reiter-knopf')];
      return {
        gesamt: reiter.length,
        ohne: reiter.filter((k) => !k.hasAttribute('aria-selected')).length,
        /* Genau einer je Leiste ist ausgewählt — zwei wären so falsch wie keiner. */
        gewaehlt: reiter.filter((k) => k.getAttribute('aria-selected') === 'true').length,
        stimmtMitKlasse: reiter.every((k) =>
          k.classList.contains('ist-aktiv') === (k.getAttribute('aria-selected') === 'true')),
      };
    });
    if (stand.ohne) throw new Error(`${stand.ohne} Reiter ohne aria-selected`);
    if (stand.gewaehlt !== 2) throw new Error(`${stand.gewaehlt} ausgewählt statt 2 (links und rechts je einer)`);
    if (!stand.stimmtMitKlasse) throw new Error('Klasse und aria-selected sagen Verschiedenes');
    return `${stand.gesamt} Reiter, ${stand.gewaehlt} offen, Auge und Sprachausgabe einig`;
  });

  await pruefe('Der Reiterwechsel zieht die Ansage mit', async () => {
    await seite.evaluate(() => document.querySelector('.reiter-knopf[data-tafel="dateien"]').click());
    await seite.waitForTimeout(400);
    const stand = await seite.evaluate(() => {
      const knoepfe = [...document.querySelectorAll('#reiter-links .reiter-knopf')];
      return {
        an: knoepfe.filter((k) => k.getAttribute('aria-selected') === 'true').map((k) => k.dataset.tafel),
      };
    });
    if (stand.an.join() !== 'dateien') throw new Error(`ausgewählt: ${stand.an.join(', ') || 'nichts'}`);
    return 'dateien';
  });

  await pruefe('Die Modusleiste ist eine Tab-Liste — ein Halt, Pfeile wechseln', async () => {
    /* Vier Modi, genau einer gewählt, und die Tastatur geht damit um wie mit
       jeder Tab-Liste: Tab führt hinein, die Pfeile wechseln den Modus, Pos1
       und Ende springen an die Ränder. Die Werkzeuge im Inspektor sagen über
       aria-pressed, ob sie an sind. */
    const vorher = await seite.evaluate(() => {
      const liste = document.querySelector('#modi');
      const tabs = [...liste.querySelectorAll('[role="tab"]')];
      const gewaehlt = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
      gewaehlt[0]?.focus();
      return {
        rolle: liste.getAttribute('role'),
        anzahl: tabs.length,
        gewaehlt: gewaehlt.map((t) => t.dataset.modus),
        halte: tabs.filter((t) => t.tabIndex === 0).length,
      };
    });
    await seite.keyboard.press('ArrowRight');
    await seite.waitForTimeout(150);
    const nachRechts = await seite.evaluate(() => ({
      fokus: document.activeElement?.dataset?.modus,
      gewaehlt: document.querySelector('#modi [aria-selected="true"]')?.dataset.modus,
    }));
    await seite.keyboard.press('End');
    await seite.waitForTimeout(150);
    const amEnde = await seite.evaluate(() => document.querySelector('#modi [aria-selected="true"]')?.dataset.modus);
    await seite.keyboard.press('Home');
    await seite.waitForTimeout(150);
    const amAnfang = await seite.evaluate(() => document.querySelector('#modi [aria-selected="true"]')?.dataset.modus);
    const gedrueckt = await seite.evaluate(() => {
      const knopf = document.querySelector('.inspektor-werkzeug[data-befehl="werkzeug:ersetzen"]');
      return knopf?.getAttribute('aria-pressed');
    });
    await seite.evaluate(() => { window.studio.fuehreAus('werkzeug:auswahl'); window.studio.fuehreAus('modus:kommentieren'); });

    if (vorher.rolle !== 'tablist') throw new Error(`Rolle ${vorher.rolle}`);
    if (vorher.anzahl !== 4) throw new Error(`${vorher.anzahl} Modi`);
    if (vorher.gewaehlt.length !== 1) throw new Error(`${vorher.gewaehlt.length} gewählt`);
    if (vorher.halte !== 1) throw new Error(`${vorher.halte} Tabulatorhalte statt einem`);
    if (!nachRechts.fokus || nachRechts.fokus !== nachRechts.gewaehlt || nachRechts.gewaehlt === vorher.gewaehlt[0]) {
      throw new Error(`Pfeil rechts: Fokus ${nachRechts.fokus}, gewählt ${nachRechts.gewaehlt}`);
    }
    if (amEnde !== 'exportieren') throw new Error(`Ende führt zu ${amEnde}`);
    if (amAnfang !== 'bearbeiten') throw new Error(`Pos1 führt zu ${amAnfang}`);
    if (gedrueckt !== 'true') throw new Error(`„Text bearbeiten" meldet aria-pressed=${gedrueckt}`);
    return `${vorher.gewaehlt[0]} → ${nachRechts.gewaehlt}, Ende → ${amEnde}, Pos1 → ${amAnfang}; Werkzeug meldet sich gedrückt`;
  });

  await pruefe('Die Meldung kommt und geht mit derselben Sorgfalt', async () => {
    const stand = await seite.evaluate(async () => {
      const kern = await import('./app/kern.js');
      const weg = kern.sage('Probe', { dauer: 0 });
      /* Die letzte, nicht die erste: aus einer früheren Prüfung kann noch eine
         Meldung stehen, und dann wurde die falsche gemessen. */
      const alle = document.querySelectorAll('#meldungen .meldung');
      const knoten = alle[alle.length - 1];
      const beimKommen = getComputedStyle(knoten).animationName;
      const uebergang = getComputedStyle(knoten).transitionDuration;
      weg();
      await new Promise((l) => setTimeout(l, 60));
      const beimGehen = getComputedStyle(knoten).opacity;
      knoten.remove();
      return { beimKommen, uebergang, beimGehen: Number(beimGehen) };
    });
    if (stand.beimKommen === 'none') throw new Error('sie erscheint ohne Bewegung');
    if (parseFloat(stand.uebergang) === 0) throw new Error('sie verschwindet ohne Übergang — ein Sprung');
    if (stand.beimGehen >= 1) throw new Error(`beim Gehen noch bei Deckung ${stand.beimGehen}`);
    return `${stand.beimKommen} herein, ${stand.uebergang} hinaus`;
  });

  await pruefe('Wer Bewegung abgestellt hat, bekommt keine', async () => {
    /* Nicht nur „kürzer": abgeräumt. Eine Animation, die in 200 statt 400 ms
       läuft, ist für jemanden mit Migräne dieselbe Animation. */
    const rahmen = await browser.newContext({ reducedMotion: 'reduce' });
    const eigene = await rahmen.newPage();
    await eigene.goto(BASIS);
    await eigene.click('#knopf-beispiel');
    await eigene.waitForSelector('.blatt canvas');
    await eigene.waitForTimeout(1200);
    const laufend = await eigene.evaluate(() => {
      const lang = [...document.querySelectorAll('#huelle *')].filter((k) => {
        const s = getComputedStyle(k);
        return parseFloat(s.animationDuration) > 0.01 || parseFloat(s.transitionDuration) > 0.01;
      });
      return lang.map((k) => k.className || k.tagName).slice(0, 5);
    });
    await eigene.close();
    await rahmen.close();
    if (laufend.length) throw new Error(`noch in Bewegung: ${laufend.join(', ')}`);
    return 'alle Übergänge und Animationen abgeräumt';
  });

  await pruefe('Auf einem Gerät mit Aussparung bleibt der Rand frei', async () => {
    /* `viewport-fit=cover` steht im Kopf der Seite — die Anwendung reicht bis
       unter Kamera und Gestenstreifen. Die Regeln dafür stehen im Stilblatt;
       geprüft wird, dass sie da sind und den Rasterplatz mitrechnen. */
    const stil = await seite.evaluate(async () => (await fetch('app/stil.css')).text());
    const stellen = (stil.match(/env\(safe-area-inset-/g) || []).length;
    if (stellen < 3) throw new Error(`nur ${stellen} Stellen mit safe-area`);
    /* Die Fußzeile ist keine Rasterzeile mehr, sondern ein schwebendes
       Bedienteil über der Bühne. Den Gestenstreifen muss sie trotzdem
       mitrechnen — jetzt in ihrem Abstand nach unten, nicht in der Zeile. */
    if (!/\.fuss\s*\{[^}]*bottom:[^;]*safe-area-inset-bottom/s.test(stil)) {
      throw new Error('das schwebende Bedienteil rechnet den Gestenstreifen nicht mit');
    }
    return `${stellen} Stellen, Fußzeile rechnet ihn mit`;
  });

  await pruefe('Auf dem Touchscreen ist jede Trefferfläche mindestens 44 px', async () => {
    const rahmen = await browser.newContext({ viewport: { width: 900, height: 700 }, hasTouch: true });
    const eigene = await rahmen.newPage();
    await eigene.goto(BASIS);
    await eigene.click('#knopf-beispiel');
    await eigene.waitForSelector('.blatt canvas');
    await eigene.waitForTimeout(1200);
    /* Der grobe Zeiger lässt sich nicht emulieren, also wird die Regel selbst
       gelesen und ihre Wirkung an einem Knopf nachgerechnet. */
    const stand = await eigene.evaluate(() => {
      const stil = [...document.styleSheets].flatMap((b) => { try { return [...b.cssRules]; } catch { return []; } });
      const grob = stil.find((r) => r.media && /pointer:\s*coarse/.test(r.media.mediaText));
      if (!grob) return { regel: false };
      const text = [...grob.cssRules].map((r) => r.cssText).join(' ');
      return {
        regel: true,
        mit44: /min-width:\s*44px/.test(text) && /min-height:\s*44px/.test(text),
        gilt: /\.werkzeug::after|\.reiter-knopf::after/.test(text),
      };
    });
    await eigene.close();
    await rahmen.close();
    if (!stand.regel) throw new Error('keine Regel für grobe Zeiger');
    if (!stand.mit44) throw new Error('die Fläche wird nicht auf 44 px gebracht');
    if (!stand.gilt) throw new Error('sie gilt nicht für Werkzeuge und Reiter');
    return 'Pseudo-Element auf 44 px, Bild unverändert';
  });
}
