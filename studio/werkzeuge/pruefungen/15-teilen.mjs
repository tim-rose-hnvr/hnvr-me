/* Vertraulich teilen — die sichere Kopie.

   Hier wird geprüft, was beim Teilen schiefgehen kann, ohne dass man es
   sieht: ein Balken, der ein Zeichen zu kurz ist; ein Muster, das in den
   nächsten Satz läuft; erkannter Text, der unter einer Schwärzung wieder
   auftaucht; Metadaten, die in der Kopie stehen bleiben. */

import { readFile } from 'node:fs/promises';

export default async function ({ pruefe, seite, ladeBeispiel, ladungVon }) {
  console.log('\n== Vertraulich teilen ==');

  const lesePdf = (pfad) => readFile(pfad).then((b) => [...b]);
  /* Eine Datei mit pdf.js in der Seite lesen: Text, Metadaten, Anhänge, Anmerkungen. */
  const untersuche = (zahlen) => seite.evaluate(async (z) => {
    const pdfjs = await import('./fremd/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(z), isEvalSupported: false }).promise;
    let text = '';
    let anmerkungen = 0;
    for (let i = 1; i <= doc.numPages; i++) {
      const s = await doc.getPage(i);
      text += (await s.getTextContent()).items.map((t) => t.str).join('') + '\n';
      anmerkungen += (await s.getAnnotations()).length;
    }
    const { info, metadata } = await doc.getMetadata();
    const anhaenge = Object.keys((await doc.getAttachments()) || {}).length;
    const gliederung = ((await doc.getOutline()) || []).length;
    await doc.destroy();
    return { text, info, xmp: !!metadata, anhaenge, anmerkungen, gliederung };
  }, zahlen);

  await pruefe('Der Ablauf öffnet sich über dem Editor und lässt sich verlassen', async () => {
    await ladeBeispiel();
    await seite.click('#knopf-teilen');
    await seite.waitForTimeout(1500);
    const auf = await seite.evaluate(() => ({
      ablauf: document.querySelector('#huelle').dataset.ablauf,
      schritte: [...document.querySelectorAll('.ablauf-schritt strong')].map((k) => k.textContent),
      modusleiste: getComputedStyle(document.querySelector('.modusleiste')).display,
      navi: document.querySelector('#atelier-navi .navi-punkt[aria-current="page"]')?.dataset.ansicht,
      pfad: document.querySelector('#titel-zusatz').textContent,
    }));
    await seite.click('#knopf-ablauf-verlassen');
    await seite.waitForTimeout(400);
    const zu = await seite.evaluate(() => ({
      ablauf: document.querySelector('#huelle').dataset.ablauf || '',
      modusleiste: getComputedStyle(document.querySelector('.modusleiste')).display,
      ansicht: document.querySelector('#huelle').dataset.ansicht,
    }));
    if (auf.ablauf !== 'teilen') throw new Error('kein Ablauf');
    if (auf.schritte.join('|') !== 'Schwärzen|Metadaten prüfen|Prüfen & exportieren') throw new Error(`Schritte: ${auf.schritte.join(', ')}`);
    if (auf.modusleiste !== 'none') throw new Error('die Modusleiste steht im Ablauf');
    if (auf.navi !== 'teilen') throw new Error(`Navigation zeigt ${auf.navi}`);
    if (!/Original bleibt unverändert/.test(auf.pfad)) throw new Error(`Pfad: ${auf.pfad}`);
    if (zu.ablauf || zu.modusleiste === 'none' || zu.ansicht !== 'editor') throw new Error(JSON.stringify(zu));
    return `${auf.schritte.join(' → ')}; verlassen führt in den Editor`;
  });

  await pruefe('Die Muster treffen genau: ganze IBAN, Steuermerkmal ohne den nächsten Satz', async () => {
    await seite.click('#knopf-teilen');
    await seite.waitForTimeout(1500);
    const funde = await seite.evaluate(async () => (await import('./app/teilen.js')).ablaufStand().funde
      .map((f) => ({ art: f.art, text: f.text, n: f.rechtecke.length })));
    const nach = Object.fromEntries(funde.map((f) => [f.art, f]));
    if (nach.IBAN?.text !== 'DE02 1203 0000 0000 2020 51') throw new Error(`IBAN „${nach.IBAN?.text}"`);
    if (nach.Steuernummer?.text !== 'USt-IdNr.: DE123456789') throw new Error(`Steuermerkmal „${nach.Steuernummer?.text}"`);
    for (const art of ['E-Mail', 'Telefon', 'Geburtsdatum']) if (!nach[art]) throw new Error(`${art} fehlt`);
    if (funde.length !== 5) throw new Error(`${funde.length} Funde: ${funde.map((f) => `${f.art}:${f.text}`).join(' | ')}`);
    return funde.map((f) => f.art).join(', ');
  });

  await pruefe('Jeder Balken deckt seinen Text ganz — gemessen an der Textebene', async () => {
    /* Gegenprobe mit dem, was der Browser beim Markieren auswählen würde:
       die Textebene von pdf.js. Der Balken muss die Auswahl ganz umschließen. */
    const stand = await seite.evaluate(async () => {
      const t = await import('./app/teilen.js');
      const funde = t.ablaufStand().funde;
      for (const f of funde) t.bestaetige(f.id);
      await new Promise((l) => setTimeout(l, 600));
      const ergebnisse = [];
      for (const f of funde) {
        const balken = f.anmerkungen.map((id) => document.querySelector(`[data-anmerkung="${id}"]`)?.getBoundingClientRect()).filter(Boolean);
        if (!balken.length) { ergebnisse.push(`${f.art}: kein Balken gezeichnet`); continue; }
        const blatt = document.querySelector(`.blatt[data-seite="${f.seiteId}"] .textebene`);
        /* Den Text der Ebene zusammensetzen und die Fundstelle darin finden. */
        const knoten = [];
        const gang = document.createTreeWalker(blatt, NodeFilter.SHOW_TEXT);
        let alles = '';
        while (gang.nextNode()) { knoten.push({ n: gang.currentNode, ab: alles.length }); alles += gang.currentNode.data; }
        const stelle = alles.indexOf(f.text);
        if (stelle < 0) { ergebnisse.push(`${f.art}: nicht in der Textebene`); continue; }
        const ende = stelle + f.text.length;
        const finde = (pos) => { const k = [...knoten].reverse().find((x) => x.ab <= pos); return [k.n, Math.min(pos - k.ab, k.n.data.length)]; };
        const r = document.createRange();
        r.setStart(...finde(stelle));
        r.setEnd(...finde(ende));
        for (const teil of [...r.getClientRects()].filter((q) => q.width > 0.5)) {
          const gedeckt = balken.some((b) => b.left <= teil.left + 0.5 && b.right >= teil.right - 0.5
            && b.top <= teil.top + teil.height * 0.35 && b.bottom >= teil.bottom - teil.height * 0.35);
          if (!gedeckt) ergebnisse.push(`${f.art}: ${Math.round(teil.left)}–${Math.round(teil.right)} nicht gedeckt`);
        }
      }
      return { ergebnisse, anzahl: funde.length };
    });
    if (stand.ergebnisse.length) throw new Error(stand.ergebnisse.join('; '));
    return `${stand.anzahl} Fundstellen, jede ganz unter ihrem Balken`;
  });

  await pruefe('Verwerfen nimmt den Balken wieder weg', async () => {
    const stand = await seite.evaluate(async () => {
      const t = await import('./app/teilen.js');
      const iban = t.ablaufStand().funde.find((f) => f.art === 'IBAN');
      const vorher = window.studio.zustand.anmerkungen.filter((a) => a.art === 'schwaerzen').length;
      t.verwirf(iban.id);
      const nachher = window.studio.zustand.anmerkungen.filter((a) => a.art === 'schwaerzen').length;
      return { vorher, nachher, entscheidung: iban.entscheidung };
    });
    if (stand.nachher !== stand.vorher - 1) throw new Error(`${stand.vorher} → ${stand.nachher} Schwärzungen`);
    if (stand.entscheidung !== 'verworfen') throw new Error(stand.entscheidung);
    return `${stand.vorher} → ${stand.nachher} Schwärzungen, IBAN bleibt sichtbar`;
  });

  await pruefe('Die sichere Kopie ist bereinigt — und nachgeprüft', async () => {
    await seite.evaluate(() => document.querySelectorAll('.ablauf-schritt-knopf')[2].click());
    await seite.waitForTimeout(400);
    const pfad = await ladungVon(() => seite.click('#teilen-exportieren'));
    const kopie = await untersuche(await lesePdf(pfad));
    const flach = kopie.text.replace(/\s+/g, '');
    for (const geheim of ['ada.musterfrau@muster-partner.example', '+495114567890', '14.03.1979', 'DE123456789']) {
      if (flach.includes(geheim.replace(/\s+/g, ''))) throw new Error(`„${geheim}" steht noch im Text der Kopie`);
    }
    if (kopie.info.Author || kopie.info.Subject || kopie.info.Keywords || kopie.info.Creator) throw new Error(`Metadaten: ${JSON.stringify(kopie.info)}`);
    if (kopie.xmp) throw new Error('XMP-Block steht noch');
    if (kopie.anhaenge) throw new Error(`${kopie.anhaenge} Anhänge`);
    if (kopie.anmerkungen) throw new Error(`${kopie.anmerkungen} Anmerkungen (Kommentare, Felder, Verknüpfungen)`);
    if (kopie.gliederung) throw new Error(`${kopie.gliederung} Lesezeichen`);
    const protokoll = await seite.evaluate(async () => (await import('./app/teilen.js')).protokollText());
    if (!/keine gefunden/.test(protokoll) || !/Verworfen, bleibt sichtbar: IBAN/.test(protokoll)) throw new Error(`Protokoll:\n${protokoll}`);
    return 'kein Geheimnis im Text, keine Metadaten, keine Anmerkungen, Protokoll vollständig';
  });

  await pruefe('Steht eine bestätigte Stelle noch in der Kopie, gibt es keine Kopie', async () => {
    /* Die Nachprüfung muss greifen, nicht nur grün melden: eine bestätigte
       Fundstelle ohne Balken (hier mit Gewalt entfernt) muss den Export
       verhindern. */
    const stand = await seite.evaluate(async () => {
      const t = await import('./app/teilen.js');
      const { entferne } = await import('./app/anmerkungen.js');
      const mail = t.ablaufStand().funde.find((f) => f.art === 'E-Mail');
      for (const id of mail.anmerkungen) entferne(id);
      /* Ohne jede Schwärzung wird die Seite nicht gerastert, der Text bleibt. */
      for (const a of window.studio.zustand.anmerkungen.filter((x) => x.art === 'schwaerzen')) entferne(a.id);
      try { await t.baueSichereKopie({ dateiname: 'probe.pdf' }); return { geworfen: false }; } catch (fehler) { return { geworfen: true, meldung: fehler.message }; }
    });
    if (!stand.geworfen) throw new Error('die Kopie wurde trotzdem gebaut');
    if (!/nichts herausgegeben/.test(stand.meldung)) throw new Error(stand.meldung);
    return stand.meldung.slice(0, 80);
  });

  await pruefe('Erkannter Text unter einer Schwärzung kommt nicht zurück — auch beim normalen Sichern', async () => {
    /* Der Fehler, der beim Bau gefunden wurde: die OCR-Textebene wurde auf
       gerasterten Seiten wieder eingeschrieben, samt der geschwärzten
       Wörter. Probe mit einer erkannten Seite aus zwei Wörtern, von denen
       eines geschwärzt ist. */
    await ladeBeispiel();
    const pfad = await (async () => {
      await seite.evaluate(async () => {
        const z = window.studio.zustand;
        const id = z.folge[1].id;
        z.ocr.set(id, {
          woerter: [{ text: 'GEHEIMWORT', x: 100, y: 500, b: 90, h: 12 }, { text: 'SICHTBAR', x: 300, y: 500, b: 80, h: 12 }],
          zeilen: [{ text: 'GEHEIMWORT SICHTBAR' }], sprache: 'deu', konfidenz: 90,
        });
        const { fuegeAn } = await import('./app/anmerkungen.js');
        fuegeAn({ art: 'schwaerzen', seiteId: id, x: 95, y: 495, x2: 195, y2: 515, farbe: '#000000' });
      });
      return ladungVon(() => seite.evaluate(() => window.studio.fuehreAus('sichern')));
    })();
    const ausgabe = await untersuche(await lesePdf(pfad));
    if (ausgabe.text.includes('GEHEIMWORT')) throw new Error('das geschwärzte Wort steht im Text der gesicherten Datei');
    if (!ausgabe.text.includes('SICHTBAR')) throw new Error('auch das ungeschwärzte Wort fehlt — die Textebene ist ganz weg');
    return 'GEHEIMWORT fehlt, SICHTBAR bleibt durchsuchbar';
  });

  await ladeBeispiel();
}
