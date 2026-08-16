/* ============================================================
   pruefen.mjs — die Prüfliste aus fallstricke.md, ausführbar.

     node pruefen.mjs <datei-oder-url>
     node pruefen.mjs vorlage.html
     node pruefen.mjs https://hnvr.me/

   Braucht playwright-core und einen Chromium:
     npm i playwright-core
     PW_CHROMIUM=/pfad/zu/chrome node pruefen.mjs seite.html

   Prüft die sieben Punkte, die sich automatisch prüfen lassen:
     1  Sind die Schriften wirklich geladen?  (Textbreite, nicht fonts.check)
     2  Bleibt bei „Bewegung reduzieren" alles sichtbar?
     3  Steht bei 390px jeder Block im Fenster?
     4  Erreicht jeder Text seinen Mindestkontrast?
     5  Hat jedes Formularfeld einen zugänglichen Namen?
     6  Stimmt die Überschriftenordnung? (eine h1, keine Labels als Überschrift)
     7  Sprunglink vorhanden, Kennungen eindeutig?

   Beendet sich mit Code 1, wenn etwas durchfällt.
   ============================================================ */

import { chromium } from 'playwright-core';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = process.argv[2];
if (!arg) { console.error('Aufruf: node pruefen.mjs <datei-oder-url>'); process.exit(2); }
const ziel = /^https?:\/\//.test(arg)
  ? arg
  : (existsSync(arg) ? pathToFileURL(resolve(arg)).href : (console.error(`Nicht gefunden: ${arg}`), process.exit(2)));

const PRUEFTEXT = 'HANDGLOVES PASSEND IM WIKI 0123456789 Websites & Branding';
let fehler = 0;
const sage = (ok, text) => { if (!ok) fehler++; console.log(`${ok ? '  ok  ' : ' FEHL '} ${text}`); };

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
  args: ['--no-sandbox'],
});

try {
  const seite = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const konsole = [];
  seite.on('pageerror', e => konsole.push(String(e.message)));
  seite.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
  await seite.goto(ziel, { waitUntil: 'load', timeout: 60000 });
  await seite.waitForTimeout(2000);

  /* --- 1  Schriften -------------------------------------------------
     Nicht document.fonts.check() — das meldet auch beim Rückfall true.
     Vergleich der Textbreite gegen eine garantiert fehlende Familie. */
  console.log('\n1 · Schriften');
  const breiten = await seite.evaluate(async (text) => {
    await document.fonts.ready;
    const miss = f => { const c = document.createElement('canvas').getContext('2d'); c.font = `600 35px ${f}`; return c.measureText(text).width; };
    return {
      clash:   miss("'Clash Display'"),
      nospace: miss("'ClashDisplay'"),
      dm:      miss("'DM Sans'"),
      fehlend: miss("'ZzKeineSchrift'"),
    };
  }, PRUEFTEXT);
  for (const [name, wert] of [["'Clash Display'", breiten.clash], ["'ClashDisplay'", breiten.nospace], ["'DM Sans'", breiten.dm]]) {
    const delta = Math.abs(wert - breiten.fehlend);
    sage(delta > 5, `${name.padEnd(17)} ${delta > 5 ? `geladen (Δ ${delta.toFixed(1)}px)` : 'fällt auf die Systemschrift zurück'}`);
  }

  /* --- 2  Bewegung reduzieren --------------------------------------
     Startzustände kommen oft als Inline-Style. Kurze Übergangsdauern
     helfen dann nicht — das Element wird nie sichtbar gesetzt. */
  console.log('\n2 · Bewegung reduzieren');
  const rmCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const rmSeite = await rmCtx.newPage();
  await rmSeite.goto(ziel, { waitUntil: 'load', timeout: 60000 });
  await rmSeite.waitForTimeout(1500);
  const unsichtbar = await rmSeite.evaluate(() => {
    const raus = [];
    document.querySelectorAll('body *').forEach(e => {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return;
      if (e.closest('[aria-hidden="true"]')) return;   // Schmuck zählt nicht
      if (!e.textContent.trim()) return;
      if (parseFloat(s.opacity) < .9) raus.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`);
    });
    return raus;
  });
  sage(unsichtbar.length === 0, `${unsichtbar.length} Textelement(e) bleiben unsichtbar${unsichtbar.length ? ': ' + unsichtbar.slice(0, 5).join(', ') : ''}`);
  await rmCtx.close();

  /* --- 3  Überlauf --------------------------------------------------
     scrollWidth allein reicht nicht: Inhalt kann abgeschnitten werden,
     ohne dass die Seite seitlich scrollbar wird. Bewusst beschnittene
     Bereiche (overflow:hidden, mask-image) sind ausgenommen. */
  console.log('\n3 · Überlauf');
  for (const breite of [1440, 390]) {
    await seite.setViewportSize({ width: breite, height: 900 });
    await seite.waitForTimeout(400);
    const r = await seite.evaluate(() => {
      const beschnitten = e => {
        let a = e.parentElement;
        while (a && a !== document.body) {
          const o = getComputedStyle(a);
          // hidden, mask ODER ein Scrollbehälter — alle drei sind Absicht
          if (/hidden|auto|scroll/.test(o.overflowX) || /hidden|auto|scroll/.test(o.overflow)
              || o.maskImage !== 'none') return true;
          a = a.parentElement;
        }
        return false;
      };
      // Absichtlich weit weggeparkte Elemente (Honigtopf, Nur-für-Screenreader)
      // stehen bei -9999px und sind kein Überlauf.
      const geparkt = b => b.right < -1000;
      const raus = [];
      document.querySelectorAll('body *').forEach(e => {
        const b = e.getBoundingClientRect();
        if (b.width > 0 && (b.right > innerWidth + 1 || b.left < -1) && !geparkt(b) && !beschnitten(e))
          raus.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} (${Math.round(b.left)}…${Math.round(b.right)})`);
      });
      return { sw: document.documentElement.scrollWidth, raus };
    });
    sage(r.raus.length === 0 && r.sw <= breite,
      `${breite}px: scrollWidth ${r.sw}, ${r.raus.length} Block/Blöcke außerhalb${r.raus.length ? ': ' + r.raus.slice(0, 4).join(', ') : ''}`);
  }
  await seite.setViewportSize({ width: 1440, height: 1000 });

  /* --- 4  Kontrast --------------------------------------------------
     Gegen den tatsächlich dahinterliegenden Hintergrund, nicht gegen
     die vermutete Abschnittsfarbe. */
  console.log('\n4  · Kontrast');
  await seite.evaluate(() => document.querySelectorAll('.rv').forEach(e => e.classList.add('in')));
  await seite.waitForTimeout(300);
  const schwach = await seite.evaluate(() => {
    const lum = c => {
      const m = (c.match(/[\d.]+/g) || []).map(Number);
      if (m.length < 3) return null;
      if (m[3] === 0) return null;
      const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
      return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]);
    };
    const raus = [];
    document.querySelectorAll('p, li, span, a, label, td, h1, h2, h3, h4, h5, h6, button').forEach(e => {
      if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < .5) return;
      let bg = null, a = e;
      while (a) { const v = getComputedStyle(a).backgroundColor; const l = lum(v); if (l !== null) { bg = l; break; } a = a.parentElement; }
      const fg = lum(s.color);
      if (fg === null || bg === null) return;
      const cr = (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
      const px = parseFloat(s.fontSize);
      const gross = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700);
      const soll = gross ? 3 : 4.5;
      if (cr < soll) raus.push(`${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]} ${px}px → ${cr.toFixed(2)}:1 (soll ${soll})`);
    });
    return [...new Set(raus)];
  });
  sage(schwach.length === 0, `${schwach.length} Textstelle(n) unter dem Minimum${schwach.length ? ': ' + schwach.slice(0, 5).join(' | ') : ''}`);

  /* --- 5  Formularfelder -------------------------------------------- */
  console.log('\n5 · Formularfelder');
  const namenlos = await seite.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter(e => !['hidden', 'submit', 'button'].includes(e.type))
      .filter(e => e.getAttribute('aria-hidden') !== 'true')
      .filter(e => !(e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)) && !e.closest('label')
        && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'))
      .map(e => `${e.tagName.toLowerCase()}#${e.id || '(ohne id)'}`));
  sage(namenlos.length === 0, `${namenlos.length} Feld(er) ohne verbundene Beschriftung${namenlos.length ? ': ' + namenlos.join(', ') : ''}`);

  /* --- 6  Überschriftenordnung ---------------------------------------
     Genau eine h1, und sie trägt die Aussage der Seite. Labels sind
     Absätze (.ey), keine Überschriften — sonst steht im Inhaltsverzeichnis
     der Seite „// unsere leistungen" statt der Leistungen. */
  console.log('\n6 · Überschriften');
  const ueb = await seite.evaluate(() => {
    const alle = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(e => e.textContent.trim())
      .map(e => ({ stufe: +e.tagName[1], text: e.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) }));
    const h1 = alle.filter(x => x.stufe === 1);
    const labels = alle.filter(x => /^(\/\/|·|—)/.test(x.text));
    const spruenge = [];
    for (let i = 1; i < alle.length; i++)
      if (alle[i].stufe - alle[i - 1].stufe > 1)
        spruenge.push(`h${alle[i - 1].stufe} → h${alle[i].stufe} bei „${alle[i].text.slice(0, 34)}"`);
    return { anzahl: alle.length, h1, labels, spruenge, erste: alle.slice(0, 3) };
  });
  sage(ueb.h1.length === 1, `${ueb.h1.length} h1${ueb.h1.length ? ': „' + ueb.h1.map(x => x.text).join('", „') + '"' : ''}`);
  sage(ueb.erste[0]?.stufe === 1,
    `erste Überschrift ist h${ueb.erste[0]?.stufe ?? '?'}${ueb.erste[0] ? ': „' + ueb.erste[0].text.slice(0, 40) + '"' : ''}`);
  sage(ueb.labels.length === 0, `${ueb.labels.length} Label(s) als Überschrift ausgezeichnet${ueb.labels.length ? ': „' + ueb.labels.slice(0, 3).map(x => x.text).join('", „') + '"' : ''}`);
  sage(ueb.spruenge.length === 0, `${ueb.spruenge.length} Stufensprung/-sprünge${ueb.spruenge.length ? ': ' + ueb.spruenge.slice(0, 2).join(' | ') : ''}`);

  /* --- 7  Sprunglink und doppelte Kennungen -------------------------- */
  console.log('\n7 · Navigation und Kennungen');
  const nav = await seite.evaluate(() => {
    const erste = document.querySelector('body a[href^="#"]');
    const sprung = !!(erste && /inhalt|content|main|haupt|skip/i.test(erste.getAttribute('href') + ' ' + erste.textContent));
    const zaehler = {};
    document.querySelectorAll('[id]').forEach(e => { zaehler[e.id] = (zaehler[e.id] || 0) + 1; });
    return { sprung, doppelt: Object.entries(zaehler).filter(([, n]) => n > 1).map(([k]) => k) };
  });
  sage(nav.sprung, nav.sprung ? 'Sprunglink zum Inhalt vorhanden' : 'kein Sprunglink zum Inhalt');
  sage(nav.doppelt.length === 0, `${nav.doppelt.length} doppelte id${nav.doppelt.length ? ': ' + nav.doppelt.slice(0, 5).join(', ') : ''}`);

  console.log('\n· Konsole');
  sage(konsole.length === 0, `${konsole.length} Fehlermeldung(en)${konsole.length ? ': ' + konsole.slice(0, 3).join(' | ') : ''}`);

  console.log(fehler === 0 ? '\nAlles durch.\n' : `\n${fehler} Punkt(e) durchgefallen.\n`);
} finally {
  await browser.close();
}

process.exit(fehler === 0 ? 0 : 1);
