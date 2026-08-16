#!/usr/bin/env node
// Abnahmeprüfung für Websites.
//
// Aufruf:
//   node pruefen.mjs ./dist                 # Verzeichnis wird statisch ausgeliefert
//   node pruefen.mjs http://localhost:3000  # laufender Dev-Server
//   node pruefen.mjs ./dist / /preise /kontakt
//   node pruefen.mjs http://localhost:3000 --out .pruefung
//
// Ergebnis: <out>/bericht.md, <out>/bericht.json, <out>/screenshots/*.png
// Exit 0 = keine Fehler. Exit 1 = mindestens ein Fehler. Warnungen ändern den Exit-Code nicht.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const VIEWPORTS = [
  { name: 'mobil', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

// Akzentfarben der Tailwind-Standardpalette. Kommen sie vor, ist die Farbwahl
// mit hoher Wahrscheinlichkeit keine Entscheidung gewesen, sondern ein Default.
const TAILWIND_AKZENTE = new Set([
  '#3b82f6', '#2563eb', '#6366f1', '#4f46e5', '#8b5cf6', '#7c3aed',
  '#a855f7', '#9333ea', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
  '#f43f5e', '#ec4899', '#f59e0b',
]);

const SYSTEMSCHRIFTEN = /^(system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica|helvetica neue|arial|sans-serif|serif|ui-sans-serif|ui-serif|times|times new roman|georgia|inter)$/i;

// Klassiker, die auf Besuchergeräten vorhanden sind, auf einem nackten
// Prüf-Container aber fehlen. Ihr Fehlen hier sagt nichts über die Seite aus.
const WEBSICHER = new Set([
  'arial', 'helvetica', 'helvetica neue', 'times', 'times new roman', 'georgia',
  'verdana', 'tahoma', 'trebuchet ms', 'courier new', 'palatino', 'palatino linotype',
  'garamond', 'segoe ui', 'roboto', 'cambria', 'calibri', 'consolas', 'menlo', 'monaco',
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};

// ---------------------------------------------------------------- Infrastruktur

async function ladePlaywright() {
  const require_ = createRequire(import.meta.url);
  const versuche = [
    () => require_.resolve('playwright'),
    () => require_.resolve('playwright-core'),
    () => path.join(process.cwd(), 'node_modules', 'playwright', 'index.js'),
    () => path.join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright', 'index.js'),
  ];
  for (const versuch of versuche) {
    try {
      const ziel = versuch();
      if (!fs.existsSync(ziel)) continue;
      const modul = await import(pathToFileURL(ziel).href);
      // CommonJS-Auflösung: benannte Exporte landen ggf. unter .default
      const aufgeloest = modul.chromium ? modul : modul.default;
      if (aufgeloest?.chromium) return aufgeloest;
    } catch { /* nächster Versuch */ }
  }
  throw new Error('playwright nicht gefunden. Installieren mit: npm i -D playwright');
}

function starteStatischenServer(wurzel) {
  const server = http.createServer(async (req, res) => {
    try {
      const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let ziel = path.join(wurzel, path.normalize(pfad).replace(/^(\.\.[/\\])+/, ''));
      if (!ziel.startsWith(path.resolve(wurzel))) { res.writeHead(403).end(); return; }
      let stat = await fsp.stat(ziel).catch(() => null);
      if (stat?.isDirectory()) {
        const index = path.join(ziel, 'index.html');
        if (fs.existsSync(index)) { ziel = index; stat = await fsp.stat(ziel); }
      }
      if (!stat?.isFile() && !path.extname(ziel) && fs.existsSync(ziel + '.html')) {
        ziel = ziel + '.html';
        stat = await fsp.stat(ziel);
      }
      if (!stat?.isFile()) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(ziel).toLowerCase()] ?? 'application/octet-stream' });
      fs.createReadStream(ziel).pipe(res);
    } catch (fehler) {
      res.writeHead(500, { 'content-type': 'text/plain' }).end(String(fehler));
    }
  });
  return new Promise((auf) => {
    server.listen(0, '127.0.0.1', () => auf({ server, basis: `http://127.0.0.1:${server.address().port}` }));
  });
}

// ---------------------------------------------------------------- Prüfungen im Browser

// Läuft im Seitenkontext. Sammelt alles, was nur dort messbar ist.
function messungImBrowser() {
  const rgbLesen = (wert) => {
    const treffer = String(wert).match(/rgba?\(([^)]+)\)/);
    if (!treffer) return null;
    const teile = treffer[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (teile.length < 3 || teile.slice(0, 3).some(Number.isNaN)) return null;
    return { r: teile[0], g: teile[1], b: teile[2], a: teile.length > 3 ? teile[3] : 1 };
  };
  const hex = (f) => '#' + [f.r, f.g, f.b].map((k) => Math.round(k).toString(16).padStart(2, '0')).join('');
  const leuchtdichte = (f) => {
    const k = [f.r, f.g, f.b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  };
  const kontrast = (a, b) => {
    const [h, n] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x);
    return (h + 0.05) / (n + 0.05);
  };
  const sichtbar = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.1) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // Effektiver Hintergrund: erster Vorfahr mit ausreichend deckender Farbe.
  const hintergrund = (el) => {
    let knoten = el;
    while (knoten && knoten !== document.documentElement.parentNode) {
      const s = getComputedStyle(knoten);
      if (s.backgroundImage && s.backgroundImage !== 'none') return { farbe: null, grund: 'bild' };
      const f = rgbLesen(s.backgroundColor);
      if (f && f.a >= 0.9) return { farbe: f, grund: 'farbe' };
      knoten = knoten.parentElement;
    }
    return { farbe: { r: 255, g: 255, b: 255, a: 1 }, grund: 'annahme-weiss' };
  };

  const alle = Array.from(document.querySelectorAll('body *'));

  // --- Text und Kontrast
  const kontrastMaengel = [];
  let geprüfteTexte = 0;
  let ungeprüfteTexte = 0;
  const schriftgroessen = new Map();
  const schriftfamilien = new Map();
  const radien = new Set();

  for (const el of alle) {
    const s = getComputedStyle(el);
    radien.add(s.borderTopLeftRadius);

    const eigenerText = Array.from(el.childNodes)
      .filter((k) => k.nodeType === 3 && k.textContent.trim().length > 1)
      .map((k) => k.textContent.trim())
      .join(' ');
    if (!eigenerText || !sichtbar(el)) continue;

    const groesse = Math.round(parseFloat(s.fontSize));
    schriftgroessen.set(groesse, (schriftgroessen.get(groesse) ?? 0) + eigenerText.length);
    const familie = s.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
    schriftfamilien.set(familie, (schriftfamilien.get(familie) ?? 0) + eigenerText.length);

    if (geprüfteTexte + ungeprüfteTexte > 600) continue;
    const vorne = rgbLesen(s.color);
    const hinten = hintergrund(el);
    if (!vorne || !hinten.farbe) { ungeprüfteTexte++; continue; }
    geprüfteTexte++;
    const fett = parseInt(s.fontWeight, 10) >= 700;
    const grossText = groesse >= 24 || (groesse >= 18.66 && fett);
    const soll = grossText ? 3 : 4.5;
    const ist = kontrast(vorne, hinten.farbe);
    if (ist < soll) {
      kontrastMaengel.push({
        auswahl: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
        text: eigenerText.slice(0, 60),
        vordergrund: hex(vorne), hintergrund: hex(hinten.farbe),
        verhaeltnis: Math.round(ist * 100) / 100, soll,
      });
    }
  }

  // --- Farbwerte: Verdacht auf ungewählte Standardpalette
  const farbwerte = new Set();
  for (const el of alle.slice(0, 1500)) {
    const s = getComputedStyle(el);
    for (const wert of [s.color, s.backgroundColor, s.borderTopColor, s.backgroundImage]) {
      const treffer = String(wert).matchAll(/rgba?\([^)]+\)/g);
      for (const t of treffer) {
        const f = rgbLesen(t[0]);
        if (f && f.a > 0.2) farbwerte.add(hex(f));
      }
    }
  }

  // --- Bilder
  const bilder = Array.from(document.images).map((bild) => ({
    quelle: bild.currentSrc || bild.src,
    kaputt: bild.complete && bild.naturalWidth === 0,
    ohneAlt: !bild.hasAttribute('alt'),
    breiteAttribut: bild.hasAttribute('width') || getComputedStyle(bild).aspectRatio !== 'auto',
  }));

  // --- Tippziele
  const kleineZiele = [];
  for (const el of document.querySelectorAll('a[href], button, input, select, [role="button"]')) {
    if (!sichtbar(el)) continue;
    // Fließtext-Links sind naturgemäß klein — das ist kein Mangel.
    const imFliesstext = el.tagName === 'A'
      && getComputedStyle(el).display === 'inline'
      && (el.parentElement?.textContent.trim().length ?? 0) > (el.textContent.trim().length + 20);
    if (imFliesstext) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 24) {
      kleineZiele.push({
        auswahl: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        breite: Math.round(r.width), hoehe: Math.round(r.height),
      });
    }
  }

  // --- Links
  const links = Array.from(document.querySelectorAll('a[href]')).map((a) => ({
    href: a.href, roh: a.getAttribute('href'),
    beschriftung: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 60),
  }));

  // --- Struktur
  const struktur = {
    titel: document.title,
    beschreibung: document.querySelector('meta[name="description"]')?.content ?? null,
    sprache: document.documentElement.lang || null,
    h1: Array.from(document.querySelectorAll('h1')).map((h) => h.textContent.trim().slice(0, 80)),
    ueberschriftenfolge: Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h) => Number(h.tagName[1])),
    knotenzahl: document.querySelectorAll('*').length,
    platzhaltertext: /lorem ipsum|dolor sit amet|placeholder text|TODO|FIXME|xxx-/i.test(document.body.innerText),
  };

  // --- Überlauf
  const ueberlauf = {
    scrollbreite: document.documentElement.scrollWidth,
    fensterbreite: window.innerWidth,
    verursacher: alle
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
      })
      .slice(0, 8)
      .map((el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '')),
  };

  // --- Schriften: rendert die gewählte Schrift wirklich, oder fällt sie still zurück?
  const generisch = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|inherit|initial|revert|unset|emoji|math|fangsong)$/i;
  const ausFontFace = new Set();
  for (const bogen of Array.from(document.styleSheets)) {
    let regeln;
    try { regeln = Array.from(bogen.cssRules ?? []); } catch { continue; } // fremde Herkunft
    for (const regel of regeln) {
      if (regel.type === 5 || regel.constructor?.name === 'CSSFontFaceRule') {
        const familie = regel.style?.getPropertyValue('font-family')?.replace(/["']/g, '').trim();
        if (familie) ausFontFace.add(familie.toLowerCase());
      }
    }
  }
  // `document.fonts.check` meldet nur fehlgeschlagene @font-face-Ladungen: eine nie
  // installierte Familie ohne @font-face gilt ihm als „verfügbar". Deshalb wird
  // gemessen — eine wirklich vorhandene Familie ändert die Textbreite gegenüber
  // mindestens einer der generischen Ersatzfamilien.
  const istVorhanden = (familie) => {
    const probe = document.createElement('span');
    probe.textContent = 'mmmmmmmmmmlliWWWWQÄß';
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-99999px;top:0;font-size:96px;white-space:nowrap;';
    document.body.appendChild(probe);
    let abweichung = false;
    for (const ersatz of ['monospace', 'serif', 'sans-serif']) {
      probe.style.fontFamily = ersatz;
      const nurErsatz = probe.getBoundingClientRect().width;
      probe.style.fontFamily = `"${familie}", ${ersatz}`;
      if (Math.abs(probe.getBoundingClientRect().width - nurErsatz) > 1) { abweichung = true; break; }
    }
    probe.remove();
    return abweichung;
  };
  const schriftRueckfall = [];
  for (const [familie] of schriftfamilien) {
    if (generisch.test(familie)) continue;
    if (!istVorhanden(familie)) schriftRueckfall.push({ familie, ausFontFace: ausFontFace.has(familie) });
  }

  // --- Abschnitte: Rhythmus und tatsächlicher Trennabstand
  const abschnitte = Array.from(document.querySelectorAll('section, article, header, footer, main > div, body > div, body > main > *'))
    .filter((el) => sichtbar(el) && el.getBoundingClientRect().height > 120)
    .filter((el, i, alle) => !alle.some((anderer) => anderer !== el && anderer.contains(el)))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const abschnittsabstaende = [];
  for (let i = 1; i < abschnitte.length; i++) {
    const oben = abschnitte[i - 1].getBoundingClientRect();
    const unten = abschnitte[i].getBoundingClientRect();
    const sOben = getComputedStyle(abschnitte[i - 1]);
    const sUnten = getComputedStyle(abschnitte[i]);
    // Sichtbare Trennung = Lücke zwischen den Kästen plus die Innenabstände, die aneinanderstoßen.
    const lücke = unten.top - oben.bottom;
    abschnittsabstaende.push(Math.round(Math.max(0, lücke) + parseFloat(sOben.paddingBottom) + parseFloat(sUnten.paddingTop)));
  }

  // --- Standardmuster: der Bausatz, der auf jeder zweiten Seite steht
  const ersterAbschnitt = abschnitte[0];
  const held = ersterAbschnitt
    ? {
        zentriert: getComputedStyle(ersterAbschnitt).textAlign === 'center',
        knöpfe: ersterAbschnitt.querySelectorAll('a[class], button').length,
      }
    : null;
  let dreierKarten = 0;
  for (const el of alle) {
    const s = getComputedStyle(el);
    if (s.display !== 'grid' && s.display !== 'flex') continue;
    const kinder = Array.from(el.children).filter((k) => sichtbar(k));
    if (kinder.length !== 3) continue;
    const höhen = kinder.map((k) => k.getBoundingClientRect().height);
    const gleich = Math.max(...höhen) - Math.min(...höhen) < 24 && Math.min(...höhen) > 80;
    const inhaltGleich = kinder.every((k) => k.querySelector('h2,h3,h4,strong,b') && k.querySelector('p'));
    if (gleich && inhaltGleich) dreierKarten++;
  }

  // --- Formularfelder ohne zugänglichen Namen
  const felderOhneNamen = [];
  for (const feld of document.querySelectorAll('input:not([type="hidden"]), select, textarea')) {
    if (!sichtbar(feld)) continue;
    if (['submit', 'button', 'image', 'reset'].includes(feld.type)) continue;
    const beschriftet = (feld.id && document.querySelector(`label[for="${CSS.escape(feld.id)}"]`)) || feld.closest('label');
    const name = feld.getAttribute('aria-label') || feld.getAttribute('aria-labelledby') || feld.getAttribute('title');
    if (!beschriftet && !name) {
      felderOhneNamen.push({
        marke: feld.tagName.toLowerCase() + (feld.type ? `[${feld.type}]` : ''),
        platzhalter: feld.getAttribute('placeholder') ?? null,
      });
    }
  }

  const laufendeAnimationen = (document.getAnimations ? document.getAnimations() : [])
    .filter((a) => a.playState === 'running')
    .map((a) => a.animationName || a.transitionProperty || 'unbenannt');

  return {
    kontrastMaengel, geprüfteTexte, ungeprüfteTexte,
    schriftgroessen: Array.from(schriftgroessen.entries()).sort((a, b) => b[0] - a[0]),
    schriftfamilien: Array.from(schriftfamilien.entries()).sort((a, b) => b[1] - a[1]),
    radien: Array.from(radien),
    farbwerte: Array.from(farbwerte),
    bilder, kleineZiele, links, struktur, ueberlauf, laufendeAnimationen,
    schriftRueckfall, abschnittsabstaende, abschnittszahl: abschnitte.length,
    held, dreierKarten, felderOhneNamen,
    verschiebung: window.__cls ?? null,
    schriftstatus: document.fonts ? document.fonts.status : 'unbekannt',
  };
}

// ---------------------------------------------------------------- Ablauf

// Tabbt durch die Seite und prüft, ob der Fokus jedes Mal sichtbar ist.
// Vergleichsmaßstab ist ein unfokussierter Klon desselben Elements — so wird
// gemessen, was sich durch den Fokus tatsächlich ändert, ohne den Fokus zu stören.
async function pruefeTastatur(seite) {
  const schritte = [];
  await seite.evaluate(() => window.scrollTo(0, 0));
  await seite.mouse.move(1, 1);
  for (let i = 0; i < 30; i++) {
    await seite.keyboard.press('Tab');
    const schritt = await seite.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();

      let ohneFokus = null;
      try {
        const klon = el.cloneNode(true);
        klon.setAttribute('aria-hidden', 'true');
        klon.style.position = 'absolute';
        klon.style.left = '-99999px';
        klon.style.top = '0';
        (el.parentElement ?? document.body).appendChild(klon);
        const k = getComputedStyle(klon);
        ohneFokus = {
          umriss: `${k.outlineStyle} ${k.outlineWidth} ${k.outlineColor}`,
          schatten: k.boxShadow, rand: k.borderColor + k.borderWidth,
          grund: k.backgroundColor, farbe: k.color,
        };
        klon.remove();
      } catch { /* Klon nicht möglich — dann nur Umriss bewerten */ }

      const mitFokus = {
        umriss: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`,
        schatten: s.boxShadow, rand: s.borderColor + s.borderWidth,
        grund: s.backgroundColor, farbe: s.color,
      };
      const umrissSichtbar = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const unterschied = ohneFokus
        ? Object.keys(mitFokus).some((k) => mitFokus[k] !== ohneFokus[k])
        : umrissSichtbar;

      return {
        marke: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
        text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40),
        fokusSichtbar: umrissSichtbar || unterschied,
        imBild: r.height > 0 && r.top > -4 && r.top < window.innerHeight + 4,
      };
    });
    if (!schritt) break;
    schritte.push(schritt);
    const letzte = schritte.slice(-3);
    if (letzte.length === 3 && letzte.every((s) => s.marke === letzte[0].marke && s.text === letzte[0].text)) {
      schritte.push({ marke: letzte[0].marke, text: letzte[0].text, falle: true, fokusSichtbar: true, imBild: true });
      break;
    }
  }
  return schritte;
}

async function pruefeSeite(browser, basis, pfad, ausgabe, befunde) {
  const url = new URL(pfad, basis).href;
  const marke = pfad === '/' ? 'start' : pfad.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'seite';
  const seitenbefund = { pfad, url, viewports: {}, konsole: [], netz: [] };

  for (const viewport of VIEWPORTS) {
    const kontext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
    });
    const seite = await kontext.newPage();

    await seite.addInitScript(() => {
      window.__cls = 0;
      try {
        new PerformanceObserver((liste) => {
          for (const eintrag of liste.getEntries()) if (!eintrag.hadRecentInput) window.__cls += eintrag.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch { /* Browser ohne layout-shift */ }
    });

    seite.on('console', (nachricht) => {
      if (nachricht.type() === 'error' || nachricht.type() === 'warning') {
        seitenbefund.konsole.push({ art: nachricht.type(), text: nachricht.text().slice(0, 300), viewport: viewport.name });
      }
    });
    seite.on('pageerror', (fehler) => {
      seitenbefund.konsole.push({ art: 'ausnahme', text: String(fehler).slice(0, 300), viewport: viewport.name });
    });
    seite.on('requestfailed', (anfrage) => {
      seitenbefund.netz.push({ url: anfrage.url(), grund: anfrage.failure()?.errorText ?? 'unbekannt', viewport: viewport.name });
    });
    seite.on('response', (antwort) => {
      if (antwort.status() >= 400) seitenbefund.netz.push({ url: antwort.url(), grund: `HTTP ${antwort.status()}`, viewport: viewport.name });
    });

    const antwort = await seite.goto(url, { waitUntil: 'load', timeout: 30000 }).catch((f) => ({ fehler: String(f) }));
    if (antwort?.fehler) {
      befunde.push({ stufe: 'fehler', bereich: 'laden', pfad, text: `Seite nicht ladbar: ${antwort.fehler}` });
      await kontext.close();
      continue;
    }
    if (typeof antwort?.status === 'function' && antwort.status() >= 400) {
      befunde.push({ stufe: 'fehler', bereich: 'laden', pfad, text: `HTTP ${antwort.status()} für ${url}` });
    }

    await seite.waitForTimeout(1200); // Schriften, verzögerte Animationen, Scroll-Auslöser
    await seite.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await seite.waitForTimeout(800);
    await seite.evaluate(() => window.scrollTo(0, 0));
    await seite.waitForTimeout(400);

    const messung = await seite.evaluate(messungImBrowser);
    seitenbefund.viewports[viewport.name] = messung;


    const datei = path.join(ausgabe, 'screenshots', `${marke}-${viewport.name}.png`);
    await seite.screenshot({ path: datei, fullPage: true });
    seitenbefund.viewports[viewport.name].screenshot = path.relative(ausgabe, datei);

    // Nach dem Screenshot, damit keine Fokusringe im Bild landen.
    if (viewport.name === 'desktop') seitenbefund.tastatur = await pruefeTastatur(seite);

    await kontext.close();
  }

  // Zweiter Durchgang: Bewegung reduziert
  const ruhig = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const ruhigeSeite = await ruhig.newPage();
  await ruhigeSeite.goto(url, { waitUntil: 'load', timeout: 30000 }).catch(() => {});
  await ruhigeSeite.waitForTimeout(1500);
  const bewegtTrotzdem = await ruhigeSeite.evaluate(() =>
    (document.getAnimations ? document.getAnimations() : [])
      .filter((a) => a.playState === 'running' && a.effect?.getTiming?.().duration > 0)
      .map((a) => a.animationName || a.transitionProperty || 'unbenannt')
      .slice(0, 10),
  );
  await ruhigeSeite.screenshot({ path: path.join(ausgabe, 'screenshots', `${marke}-reduzierte-bewegung.png`), fullPage: true });
  await ruhig.close();
  seitenbefund.bewegtTrotzReduktion = bewegtTrotzdem;

  bewerteSeite(seitenbefund, befunde);
  return seitenbefund;
}

function bewerteSeite(s, befunde) {
  const melde = (stufe, bereich, text) => befunde.push({ stufe, bereich, pfad: s.pfad, text });
  const desktop = s.viewports.desktop ?? Object.values(s.viewports)[0];
  if (!desktop) return;

  // Fehler: Dinge, die objektiv kaputt sind.
  const echteFehler = s.konsole.filter((k) => k.art === 'error' || k.art === 'ausnahme');
  for (const k of dedupe(echteFehler, (x) => x.text)) melde('fehler', 'konsole', `${k.art}: ${k.text}`);
  for (const k of dedupe(s.konsole.filter((k) => k.art === 'warning'), (x) => x.text).slice(0, 5)) {
    melde('warnung', 'konsole', `warnung: ${k.text}`);
  }
  for (const n of dedupe(s.netz, (x) => x.url)) melde('fehler', 'netz', `${n.grund}: ${n.url}`);

  for (const [name, v] of Object.entries(s.viewports)) {
    if (v.ueberlauf.scrollbreite > v.ueberlauf.fensterbreite + 1) {
      melde('fehler', 'layout', `Waagerechter Überlauf bei ${name}: ${v.ueberlauf.scrollbreite}px in ${v.ueberlauf.fensterbreite}px. Verursacher: ${v.ueberlauf.verursacher.join(', ') || 'unklar'}`);
    }
  }

  const kaputteBilder = dedupe(desktop.bilder.filter((b) => b.kaputt), (b) => b.quelle);
  for (const b of kaputteBilder) melde('fehler', 'bilder', `Bild lädt nicht: ${b.quelle}`);

  if (desktop.struktur.platzhaltertext) melde('fehler', 'inhalt', 'Platzhaltertext (Lorem ipsum / TODO) noch in der Seite.');
  if (desktop.struktur.h1.length === 0) melde('fehler', 'struktur', 'Keine h1 vorhanden.');
  if (desktop.struktur.h1.length > 1) melde('warnung', 'struktur', `${desktop.struktur.h1.length} h1-Elemente: ${desktop.struktur.h1.join(' | ')}`);
  if (!desktop.struktur.sprache) melde('fehler', 'struktur', 'lang-Attribut auf <html> fehlt.');
  if (!desktop.struktur.titel || desktop.struktur.titel.length < 3) melde('fehler', 'struktur', 'Kein sinnvoller <title>.');
  if (!desktop.struktur.beschreibung) melde('warnung', 'struktur', 'meta description fehlt.');

  let letzte = 0;
  for (const stufe of desktop.struktur.ueberschriftenfolge) {
    if (letzte && stufe > letzte + 1) { melde('warnung', 'struktur', `Überschriftenebene übersprungen (h${letzte} → h${stufe}).`); break; }
    letzte = stufe;
  }

  const kontraste = dedupe(desktop.kontrastMaengel, (k) => k.vordergrund + k.hintergrund);
  for (const k of kontraste.slice(0, 10)) {
    melde('fehler', 'kontrast', `Kontrast ${k.verhaeltnis}:1 (nötig ${k.soll}:1) — ${k.vordergrund} auf ${k.hintergrund} — „${k.text}“`);
  }

  const mobil = s.viewports.mobil;
  if (mobil) {
    for (const z of dedupe(mobil.kleineZiele, (x) => x.auswahl + x.text).slice(0, 6)) {
      melde('warnung', 'bedienbarkeit', `Tippziel zu klein auf Mobil (${z.breite}×${z.hoehe}px): ${z.auswahl} „${z.text}“`);
    }
  }

  if (s.bewegtTrotzReduktion?.length) {
    melde('fehler', 'bewegung', `Animation läuft trotz prefers-reduced-motion: ${s.bewegtTrotzReduktion.join(', ')}`);
  }

  const cls = Math.max(...Object.values(s.viewports).map((v) => v.verschiebung ?? 0));
  if (cls > 0.1) melde('warnung', 'layout', `Layoutverschiebung (CLS) ${cls.toFixed(3)} — Bilder und Schriften brauchen reservierten Platz.`);

  for (const b of dedupe(desktop.bilder.filter((b) => b.ohneAlt), (b) => b.quelle).slice(0, 5)) {
    melde('warnung', 'bilder', `alt-Attribut fehlt: ${b.quelle}`);
  }

  for (const f of desktop.schriftRueckfall) {
    if (f.ausFontFace) {
      melde('fehler', 'schrift', `„${f.familie}" ist per @font-face eingebunden, rendert aber nicht — die Seite fällt still auf die Ersatzschrift zurück.`);
    } else if (!WEBSICHER.has(f.familie)) {
      melde('warnung', 'schrift', `„${f.familie}" steht in font-family, ist aber nicht verfügbar. Ohne @font-face hängt die Gestaltung davon ab, ob der Besucher die Schrift zufällig installiert hat.`);
    }
  }

  for (const feld of desktop.felderOhneNamen.slice(0, 6)) {
    melde('fehler', 'formular', `Feld ohne zugänglichen Namen: ${feld.marke}${feld.platzhalter ? ` (nur placeholder „${feld.platzhalter}“ — der ersetzt kein Label)` : ''}`);
  }

  const tastatur = s.tastatur ?? [];
  if (tastatur.some((t) => t.falle)) {
    const falle = tastatur.find((t) => t.falle);
    melde('fehler', 'tastatur', `Fokusfalle: bleibt bei ${falle.marke} „${falle.text}“ hängen.`);
  }
  for (const t of dedupe(tastatur.filter((t) => !t.fokusSichtbar), (t) => t.marke + t.text).slice(0, 6)) {
    melde('fehler', 'tastatur', `Kein sichtbarer Fokus: ${t.marke} „${t.text}“`);
  }
  for (const t of dedupe(tastatur.filter((t) => !t.imBild), (t) => t.marke + t.text).slice(0, 4)) {
    melde('warnung', 'tastatur', `Fokus landet außerhalb des Sichtfelds: ${t.marke} „${t.text}“ — verstecktes, aber tabbares Element?`);
  }
  if (tastatur.length === 0) melde('warnung', 'tastatur', 'Kein einziges fokussierbares Element gefunden.');

  // Standardverdacht — kein Fehler, aber ein Hinweis auf ungewählte Gestaltung.
  const groessen = desktop.schriftgroessen.map(([g]) => g);
  const body = desktop.schriftgroessen.slice().sort((a, b) => b[1] - a[1])[0]?.[0] ?? 16;
  const groesste = Math.max(...groessen, 0);
  if (groesste && groesste / body < 2.5) {
    melde('verdacht', 'typografie', `Zu wenig Größenkontrast: größte Schrift ${groesste}px, Fließtext ${body}px (Faktor ${(groesste / body).toFixed(1)}). Displaygröße wirkt erst ab Faktor 3.`);
  }
  if (new Set(groessen).size < 4) {
    melde('verdacht', 'typografie', `Nur ${new Set(groessen).size} verschiedene Schriftgrößen — keine erkennbare Skala.`);
  }
  const familien = desktop.schriftfamilien.map(([f]) => f);
  if (familien.length && familien.every((f) => SYSTEMSCHRIFTEN.test(f))) {
    melde('verdacht', 'typografie', `Nur Systemschriften im Einsatz (${familien.slice(0, 3).join(', ')}). Schriftwahl ist die billigste Eigenständigkeit.`);
  }
  const defaults = desktop.farbwerte.filter((f) => TAILWIND_AKZENTE.has(f));
  if (defaults.length) {
    melde('verdacht', 'farbe', `Akzentfarben aus der Standardpalette: ${defaults.join(', ')}. Vermutlich nicht gewählt, sondern übernommen.`);
  }

  if (desktop.abschnittsabstaende.length >= 2) {
    const sortiert = desktop.abschnittsabstaende.slice().sort((a, b) => a - b);
    const median = sortiert[Math.floor(sortiert.length / 2)];
    if (median < 64) {
      melde('verdacht', 'raum', `Abschnittsabstand im Mittel ${median}px (${desktop.abschnittsabstaende.join(', ')}). Am Desktop trägt erst ab etwa 128px; zu wenig Weißraum ist die häufigste Ursache für einen billigen Gesamteindruck.`);
    }
  }

  if (desktop.held?.zentriert && desktop.held.knöpfe >= 2 && desktop.dreierKarten >= 1) {
    melde('verdacht', 'muster', 'Zentrierter Kopfbereich mit zwei Schaltflächen plus Dreierkarten — das ist der Bausatz, den jede zweite Seite trägt. Wurde Phase 1 wirklich durchlaufen?');
  } else if (desktop.dreierKarten >= 2) {
    melde('verdacht', 'muster', `${desktop.dreierKarten} Dreierkarten-Blöcke mit gleicher Form. Karten sind meist ein Ersatz für fehlenden Rhythmus, kein Gestaltungsmittel.`);
  } else if (desktop.held?.zentriert && desktop.held.knöpfe >= 2) {
    melde('verdacht', 'muster', 'Zentrierter Kopfbereich mit zwei Schaltflächen — die naheliegendste aller Lösungen. Nur behalten, wenn sie in der Designthese steht.');
  }
}

const dedupe = (liste, schluessel) => {
  const gesehen = new Set();
  return liste.filter((e) => {
    const k = schluessel(e);
    if (gesehen.has(k)) return false;
    gesehen.add(k);
    return true;
  });
};

async function pruefeLinks(basis, seiten, befunde) {
  const gesehen = new Map();
  for (const seite of seiten) {
    const desktop = seite.viewports.desktop ?? Object.values(seite.viewports)[0];
    for (const link of desktop?.links ?? []) {
      if (link.roh?.startsWith('#') || /^(mailto|tel|javascript):/i.test(link.roh ?? '')) continue;
      if (!link.href.startsWith(basis)) continue; // externe Ziele nicht anfassen
      if (!gesehen.has(link.href)) gesehen.set(link.href, { link, quelle: seite.pfad });
    }
  }
  for (const [url, { link, quelle }] of gesehen) {
    const antwort = await fetch(url, { redirect: 'follow' }).catch((f) => ({ status: 0, fehler: String(f) }));
    if (!antwort.status || antwort.status >= 400) {
      befunde.push({ stufe: 'fehler', bereich: 'links', pfad: quelle, text: `Link ins Leere (${antwort.status || antwort.fehler}): „${link.beschriftung}“ → ${url}` });
    }
  }
}

function schreibeBericht(ausgabe, basis, seiten, befunde) {
  const zaehler = (stufe) => befunde.filter((b) => b.stufe === stufe).length;
  const zeilen = [];
  zeilen.push('# Abnahmebericht');
  zeilen.push('');
  zeilen.push(`Basis: ${basis}`);
  zeilen.push(`Seiten: ${seiten.map((s) => s.pfad).join(', ')}`);
  zeilen.push(`Ergebnis: **${zaehler('fehler') === 0 ? 'bestanden' : 'nicht bestanden'}** — ${zaehler('fehler')} Fehler, ${zaehler('warnung')} Warnungen, ${zaehler('verdacht')} Gestaltungsverdacht`);
  zeilen.push('');

  for (const stufe of ['fehler', 'warnung', 'verdacht']) {
    const gruppe = befunde.filter((b) => b.stufe === stufe);
    const titel = { fehler: 'Fehler — blockieren die Abnahme', warnung: 'Warnungen — begründen oder beheben', verdacht: 'Gestaltungsverdacht — Hinweis auf Standardlösungen' }[stufe];
    zeilen.push(`## ${titel} (${gruppe.length})`);
    zeilen.push('');
    if (!gruppe.length) zeilen.push('_keine_');
    for (const b of gruppe) zeilen.push(`- \`${b.pfad}\` **${b.bereich}**: ${b.text}`);
    zeilen.push('');
  }

  zeilen.push('## Screenshots');
  zeilen.push('');
  zeilen.push('Diese Bilder müssen angesehen werden, nicht nur erzeugt.');
  zeilen.push('');
  for (const s of seiten) {
    for (const [name, v] of Object.entries(s.viewports)) {
      if (v.screenshot) zeilen.push(`- \`${s.pfad}\` ${name}: \`${v.screenshot}\``);
    }
  }
  zeilen.push('');

  zeilen.push('## Messwerte');
  zeilen.push('');
  for (const s of seiten) {
    const d = s.viewports.desktop ?? Object.values(s.viewports)[0];
    if (!d) continue;
    zeilen.push(`### \`${s.pfad}\``);
    zeilen.push(`- Schriftgrößen: ${d.schriftgroessen.map(([g]) => g + 'px').join(', ') || '—'}`);
    zeilen.push(`- Schriftfamilien: ${d.schriftfamilien.map(([f]) => f).slice(0, 5).join(', ') || '—'}`);
    zeilen.push(`- Eckenradien: ${Array.from(new Set(d.radien)).slice(0, 8).join(', ') || '—'}`);
    zeilen.push(`- Farbwerte: ${d.farbwerte.length} verschiedene`);
    zeilen.push(`- Kontrast geprüft: ${d.geprüfteTexte} Textknoten, ${d.ungeprüfteTexte} nicht bewertbar (Hintergrundbild)`);
    zeilen.push(`- Abschnitte: ${d.abschnittszahl}, Trennabstände: ${d.abschnittsabstaende.join(', ') || '—'} px`);
    zeilen.push(`- Dreierkarten-Blöcke: ${d.dreierKarten}, Kopfbereich zentriert: ${d.held?.zentriert ? 'ja' : 'nein'}`);
    zeilen.push(`- Tabstopps: ${(s.tastatur ?? []).length}, davon ohne sichtbaren Fokus: ${(s.tastatur ?? []).filter((t) => !t.fokusSichtbar).length}`);
    zeilen.push(`- DOM-Knoten: ${d.struktur.knotenzahl}`);
    zeilen.push('');
  }

  fs.writeFileSync(path.join(ausgabe, 'bericht.md'), zeilen.join('\n'));
  fs.writeFileSync(path.join(ausgabe, 'bericht.json'), JSON.stringify({ basis, befunde, seiten }, null, 2));
}

async function haupt() {
  const argumente = process.argv.slice(2);
  if (!argumente.length || argumente.includes('--hilfe') || argumente.includes('-h')) {
    console.log('Aufruf: node pruefen.mjs <verzeichnis|url> [pfad ...] [--out .pruefung]');
    process.exit(argumente.length ? 0 : 2);
  }
  const outIndex = argumente.indexOf('--out');
  const ausgabe = path.resolve(outIndex >= 0 ? argumente[outIndex + 1] : '.pruefung');
  const positionen = argumente.filter((a, i) => !a.startsWith('--') && i !== outIndex + 1);
  const ziel = positionen[0];
  const pfade = positionen.slice(1).length ? positionen.slice(1) : ['/'];

  fs.rmSync(ausgabe, { recursive: true, force: true });
  fs.mkdirSync(path.join(ausgabe, 'screenshots'), { recursive: true });

  let server = null;
  let basis = ziel;
  if (!/^https?:\/\//.test(ziel)) {
    if (!fs.existsSync(ziel)) { console.error(`Verzeichnis nicht gefunden: ${ziel}`); process.exit(2); }
    ({ server, basis } = await starteStatischenServer(path.resolve(ziel)));
    console.log(`Statischer Server: ${basis} → ${path.resolve(ziel)}`);
  }

  const { chromium } = await ladePlaywright();
  const browser = await chromium.launch();
  const befunde = [];
  const seiten = [];
  try {
    for (const pfad of pfade) {
      console.log(`Prüfe ${pfad} …`);
      seiten.push(await pruefeSeite(browser, basis, pfad, ausgabe, befunde));
    }
    await pruefeLinks(basis, seiten, befunde);
  } finally {
    await browser.close();
    server?.close();
  }

  schreibeBericht(ausgabe, basis, seiten, befunde);

  const fehler = befunde.filter((b) => b.stufe === 'fehler');
  const warnungen = befunde.filter((b) => b.stufe === 'warnung');
  const verdacht = befunde.filter((b) => b.stufe === 'verdacht');
  console.log('');
  for (const b of fehler) console.log(`FEHLER   ${b.pfad} [${b.bereich}] ${b.text}`);
  for (const b of warnungen) console.log(`WARNUNG  ${b.pfad} [${b.bereich}] ${b.text}`);
  for (const b of verdacht) console.log(`VERDACHT ${b.pfad} [${b.bereich}] ${b.text}`);
  console.log('');
  console.log(`${fehler.length} Fehler, ${warnungen.length} Warnungen, ${verdacht.length} Gestaltungsverdacht`);
  console.log(`Bericht: ${path.join(ausgabe, 'bericht.md')}`);
  process.exit(fehler.length ? 1 : 0);
}

haupt().catch((fehler) => {
  console.error(fehler);
  process.exit(2);
});
