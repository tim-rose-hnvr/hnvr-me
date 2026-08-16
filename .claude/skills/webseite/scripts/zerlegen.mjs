#!/usr/bin/env node
// Zerlegt fremde Seiten in einen strukturellen Fingerabdruck — messbar statt gefühlt.
//
//   node zerlegen.mjs https://a.example https://b.example --out .zerlegung
//
// Ergebnis: <out>/<host>.md je Seite, <out>/vergleich.md, <out>/*.png
//
// Absicht: Konventionen erkennen (Abschnittsfolge, Reihenfolge der Argumente,
// was über der Falz steht) und Ausdrucksmittel nebeneinanderlegen.
//
// Der Vergleich bildet bewusst KEINE Mittelwerte. Er zeigt die Spannweite.
// Wer aus zehn guten Seiten den Durchschnitt zieht, bekommt die austauschbare
// Seite — genau das, was dieser Skill verhindern soll. Interessant ist, worin
// sich gute Seiten unterscheiden (Ausdruck) und worin sie übereinstimmen
// (Konvention, und nur die darf übernommen werden).
//
// Was übernommen werden darf: Reihenfolge, Vollständigkeit, Benennung,
// Bedienmuster. Nicht: Gestaltung, Texte, Bilder, der besondere Einfall.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Hinter einem Firmen- oder Sitzungsproxy erreicht Node das Netz, der Browser
// oft nicht. Dann holt Node die Antworten und reicht sie an Chromium durch
// (siehe `durchleitung`). Dafür muss Node den Proxy aus der Umgebung lesen,
// was erst beim Start entschieden wird — deshalb einmal neu starten.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && process.env.NODE_USE_ENV_PROXY !== '1') {
  const lauf = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NODE_USE_ENV_PROXY: '1', NODE_NO_WARNINGS: '1' },
  });
  process.exit(lauf.status ?? 1);
}

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
      const aufgeloest = modul.chromium ? modul : modul.default;
      if (aufgeloest?.chromium) return aufgeloest;
    } catch { /* nächster Versuch */ }
  }
  throw new Error('playwright nicht gefunden. Installieren mit: npm i -D playwright');
}

// Beantwortet alle Browseranfragen aus Node heraus. Der Proxy bleibt in der
// Kette — es wird nichts umgangen, nur ein anderer Klient benutzt.
async function durchleitung(kontext) {
  await kontext.route('**/*', async (route) => {
    const anfrage = route.request();
    try {
      const kopfEin = { ...anfrage.headers() };
      delete kopfEin['accept-encoding'];
      const antwort = await fetch(anfrage.url(), {
        method: anfrage.method(),
        headers: kopfEin,
        body: ['GET', 'HEAD'].includes(anfrage.method()) ? undefined : anfrage.postDataBuffer() ?? undefined,
        redirect: 'follow',
      });
      const kopfAus = {};
      antwort.headers.forEach((wert, name) => {
        if (!/^(content-encoding|content-length|transfer-encoding|content-security-policy)$/i.test(name)) kopfAus[name] = wert;
      });
      await route.fulfill({
        status: antwort.status,
        headers: kopfAus,
        body: Buffer.from(await antwort.arrayBuffer()),
      });
    } catch {
      await route.abort().catch(() => {});
    }
  });
}

function fingerabdruckImBrowser() {
  const rgb = (wert) => {
    const t = String(wert).match(/rgba?\(([^)]+)\)/);
    if (!t) return null;
    const p = t[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length < 3 || p.slice(0, 3).some(Number.isNaN)) return null;
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const hex = (f) => '#' + [f.r, f.g, f.b].map((k) => Math.round(k).toString(16).padStart(2, '0')).join('');
  const saettigung = (f) => {
    const [max, min] = [Math.max(f.r, f.g, f.b), Math.min(f.r, f.g, f.b)];
    return max === 0 ? 0 : (max - min) / max;
  };
  const sichtbar = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) < 0.1) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const text = (el) => (el.innerText || '').trim().replace(/\s+/g, ' ');

  const alle = Array.from(document.querySelectorAll('body *'));

  // --- Abschnittsfolge: die eigentliche Struktur
  const kandidaten = Array.from(document.querySelectorAll('section, article, header, footer, main > div, body > div, body > main > *, [class*="section"]'))
    .filter((el) => sichtbar(el) && el.getBoundingClientRect().height > 140);
  const abschnitte = kandidaten
    .filter((el) => !kandidaten.some((a) => a !== el && a.contains(el)))
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    .slice(0, 30)
    .map((el, i) => {
      const r = el.getBoundingClientRect();
      const ueberschrift = el.querySelector('h1, h2, h3');
      const raster = [el, ...el.querySelectorAll('*')].find((k) => {
        const s = getComputedStyle(k);
        return (s.display === 'grid' || s.display === 'flex') && k.children.length >= 2
          && Array.from(k.children).every((kind) => kind.getBoundingClientRect().height > 60);
      });
      const woerter = text(el).split(' ').filter(Boolean).length;
      return {
        nummer: i + 1,
        ueberschrift: ueberschrift ? text(ueberschrift).slice(0, 70) : null,
        ebene: ueberschrift ? ueberschrift.tagName.toLowerCase() : null,
        hoehe: Math.round(r.height),
        woerter,
        bilder: el.querySelectorAll('img, svg, video, canvas, picture').length,
        links: el.querySelectorAll('a[href]').length,
        formular: el.querySelectorAll('form, input, textarea').length > 0,
        rasterspalten: raster ? raster.children.length : 0,
        art: null, // wird in Node gedeutet
      };
    });

  // --- Erstes Sichtfeld: was ohne Scrollen ankommt
  const imErstenBild = alle.filter((el) => {
    const r = el.getBoundingClientRect();
    return sichtbar(el) && r.top < window.innerHeight && r.bottom > 0;
  });
  const erstesBild = {
    ueberschrift: (() => {
      const h = imErstenBild.find((el) => /^h[12]$/i.test(el.tagName));
      return h ? text(h).slice(0, 120) : null;
    })(),
    fliesstext: (() => {
      const p = imErstenBild.find((el) => el.tagName === 'P' && text(el).length > 30);
      return p ? text(p).slice(0, 160) : null;
    })(),
    aktionen: imErstenBild
      .filter((el) => (el.tagName === 'A' || el.tagName === 'BUTTON') && text(el).length > 0 && text(el).length < 30)
      .filter((el) => {
        const s = getComputedStyle(el);
        const f = rgb(s.backgroundColor);
        return (f && f.a > 0.1) || s.borderTopWidth !== '0px' || s.display.includes('block');
      })
      .slice(0, 6)
      .map((el) => text(el)),
    medienart: (() => {
      if (imErstenBild.some((el) => el.tagName === 'VIDEO')) return 'Video';
      if (imErstenBild.some((el) => el.tagName === 'CANVAS')) return 'Canvas';
      const bild = imErstenBild.find((el) => el.tagName === 'IMG' && el.getBoundingClientRect().width > 200);
      if (bild) return 'Bild';
      if (imErstenBild.some((el) => el.tagName === 'SVG' && el.getBoundingClientRect().width > 200)) return 'SVG';
      return 'nur Typografie';
    })(),
    wortzahl: text(document.body).split(' ').slice(0, 0).length || imErstenBild
      .filter((el) => el.children.length === 0)
      .map((el) => text(el)).join(' ').split(' ').filter(Boolean).length,
  };

  // --- Typografie
  const groessen = new Map();
  const familien = new Map();
  const zeilenhoehen = new Map();
  let breitesterTextblock = 0;
  const zeichenProZeile = [];
  for (const el of alle) {
    const eigen = Array.from(el.childNodes)
      .filter((k) => k.nodeType === 3 && k.textContent.trim().length > 1)
      .map((k) => k.textContent.trim()).join(' ');
    if (!eigen || !sichtbar(el)) continue;
    const s = getComputedStyle(el);
    const groesse = Math.round(parseFloat(s.fontSize));
    groessen.set(groesse, (groessen.get(groesse) ?? 0) + eigen.length);
    const familie = s.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    familien.set(familie, (familien.get(familie) ?? 0) + eigen.length);
    const zh = parseFloat(s.lineHeight) / parseFloat(s.fontSize);
    if (Number.isFinite(zh)) zeilenhoehen.set(groesse, Math.round(zh * 100) / 100);
    const r = el.getBoundingClientRect();
    if (eigen.length > 80 && groesse <= 24) {
      breitesterTextblock = Math.max(breitesterTextblock, Math.round(r.width));
      const zeilen = Math.max(1, Math.round(r.height / (parseFloat(s.lineHeight) || groesse * 1.5)));
      zeichenProZeile.push(Math.round(eigen.length / zeilen));
    }
  }

  // --- Farbe
  const farbgewicht = new Map();
  // body und html mitzählen — dort steht meist die Grundfarbe der ganzen Seite.
  for (const el of [document.documentElement, document.body, ...alle.slice(0, 2000)]) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const flaeche = Math.max(0, r.width) * Math.max(0, r.height);
    const grund = rgb(s.backgroundColor);
    if (grund && grund.a > 0.5 && flaeche > 0) {
      farbgewicht.set(hex(grund), (farbgewicht.get(hex(grund)) ?? 0) + flaeche);
    }
  }
  const akzente = new Map();
  for (const el of document.querySelectorAll('a, button, [role="button"], mark, .btn')) {
    if (!sichtbar(el)) continue;
    const s = getComputedStyle(el);
    for (const wert of [s.backgroundColor, s.color, s.borderTopColor]) {
      const f = rgb(wert);
      if (f && f.a > 0.5 && saettigung(f) > 0.25) akzente.set(hex(f), (akzente.get(hex(f)) ?? 0) + 1);
    }
  }

  // --- Bewegung
  const mitUebergang = alle.filter((el) => {
    const s = getComputedStyle(el);
    return s.transitionDuration && s.transitionDuration !== '0s';
  }).length;

  return {
    titel: document.title,
    beschreibung: document.querySelector('meta[name="description"]')?.content ?? null,
    sprache: document.documentElement.lang || null,
    abschnitte,
    erstesBild,
    navigation: Array.from(document.querySelectorAll('header a[href], nav a[href]'))
      .filter(sichtbar).slice(0, 12).map((a) => text(a).slice(0, 24)).filter(Boolean),
    fusszeilenbloecke: document.querySelectorAll('footer h2, footer h3, footer h4, footer strong').length,
    typo: {
      familien: Array.from(familien.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4),
      groessen: Array.from(groessen.entries()).sort((a, b) => b[0] - a[0]),
      zeilenhoehen: Array.from(zeilenhoehen.entries()).sort((a, b) => b[0] - a[0]).slice(0, 6),
      zeichenProZeile: zeichenProZeile.length
        ? Math.round(zeichenProZeile.reduce((a, b) => a + b, 0) / zeichenProZeile.length) : null,
      textbreite: breitesterTextblock,
    },
    farbe: {
      flaechen: Array.from(farbgewicht.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f]) => f),
      akzente: Array.from(akzente.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f),
      anzahl: farbgewicht.size,
    },
    bewegung: {
      laufend: (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running').length,
      mitUebergang,
    },
    knotenzahl: document.querySelectorAll('*').length,
    seitenhoehe: Math.round(document.body.scrollHeight),
  };
}

// Deutet einen Abschnitt aus seinen Merkmalen — grob, aber vergleichbar.
function deuteAbschnitt(a, index) {
  const h = (a.ueberschrift ?? '').toLowerCase();
  if (index === 0) return 'Kopf / Aufmacher';
  if (a.formular) return 'Formular';
  if (/preis|pricing|tarif|plan|kosten/.test(h)) return 'Preise';
  if (/kund|customer|trusted|vertrau|referenz|case|logo/.test(h)) return 'Belege / Kunden';
  if (/faq|frage|question/.test(h)) return 'Fragen';
  if (/team|über uns|about|wir/.test(h)) return 'Über uns';
  if (/blog|news|artikel|resource/.test(h)) return 'Inhalte';
  if (a.rasterspalten >= 2 && a.woerter < 400) return `Raster (${a.rasterspalten})`;
  if (a.bilder > 0 && a.woerter < 120) return 'Bild / Demonstration';
  if (a.woerter > 300) return 'Fließtext';
  return 'Aussage';
}

function seitenbericht(eintrag) {
  const { url, desktop, mobil } = eintrag;
  const z = [];
  z.push(`# ${new URL(url).host}`);
  z.push('');
  z.push(`${url}`);
  z.push(`Titel: ${desktop.titel}`);
  z.push(`Seitenhöhe: ${desktop.seitenhoehe} px · DOM-Knoten: ${desktop.knotenzahl}`);
  z.push('');
  z.push('## Erstes Sichtfeld');
  z.push(`- Überschrift: ${desktop.erstesBild.ueberschrift ?? '—'}`);
  z.push(`- Fließtext: ${desktop.erstesBild.fliesstext ?? '—'}`);
  z.push(`- Aktionen: ${desktop.erstesBild.aktionen.join(' | ') || '—'}`);
  z.push(`- Medium: ${desktop.erstesBild.medienart}`);
  z.push(`- Wörter im ersten Bild: ${desktop.erstesBild.wortzahl}`);
  z.push('');
  z.push('## Abschnittsfolge');
  z.push('');
  z.push('| # | Art | Überschrift | Höhe | Wörter | Medien | Spalten |');
  z.push('|---|---|---|---|---|---|---|');
  for (const a of desktop.abschnitte) {
    z.push(`| ${a.nummer} | ${a.art} | ${a.ueberschrift ?? '—'} | ${a.hoehe} | ${a.woerter} | ${a.bilder} | ${a.rasterspalten || '—'} |`);
  }
  z.push('');
  z.push('## Navigation');
  z.push(desktop.navigation.join(' · ') || '—');
  z.push('');
  z.push('## Typografie');
  z.push(`- Familien: ${desktop.typo.familien.map(([f]) => f).join(', ')}`);
  z.push(`- Größen: ${desktop.typo.groessen.map(([g]) => g).join(', ')} px`);
  const grössen = desktop.typo.groessen.map(([g]) => g);
  const body = desktop.typo.groessen.slice().sort((a, b) => b[1] - a[1])[0]?.[0];
  z.push(`- Fließtext ${body} px, größte ${Math.max(...grössen)} px → Faktor ${(Math.max(...grössen) / body).toFixed(1)}`);
  z.push(`- Zeichen je Zeile: ${desktop.typo.zeichenProZeile ?? '—'} · Textbreite: ${desktop.typo.textbreite} px`);
  z.push(`- Zeilenhöhen (Größe → Faktor): ${desktop.typo.zeilenhoehen.map(([g, h]) => `${g}px→${h}`).join(', ')}`);
  z.push('');
  z.push('## Farbe');
  z.push(`- Flächen: ${desktop.farbe.flaechen.join(', ')}`);
  z.push(`- Akzente: ${desktop.farbe.akzente.join(', ') || '—'}`);
  z.push(`- Verschiedene Flächenfarben: ${desktop.farbe.anzahl}`);
  z.push('');
  z.push('## Bewegung');
  z.push(`- Laufende Animationen beim Laden: ${desktop.bewegung.laufend}`);
  z.push(`- Elemente mit Übergang: ${desktop.bewegung.mitUebergang}`);
  z.push('');
  if (mobil) {
    z.push('## Mobil (390 px)');
    z.push(`- Größte Schrift: ${Math.max(...mobil.typo.groessen.map(([g]) => g))} px (Desktop: ${Math.max(...grössen)} px)`);
    z.push(`- Abschnitte: ${mobil.abschnitte.length} · Seitenhöhe ${mobil.seitenhoehe} px`);
    z.push(`- Aktionen im ersten Bild: ${mobil.erstesBild.aktionen.join(' | ') || '—'}`);
    z.push('');
  }
  return z.join('\n');
}

function vergleich(eintraege) {
  const z = [];
  z.push('# Vergleich');
  z.push('');
  z.push('Dieser Bericht bildet **keine Mittelwerte**. Er zeigt die Spannweite.');
  z.push('Wo alle Seiten übereinstimmen, liegt eine Konvention — die darf übernommen werden.');
  z.push('Wo sie weit auseinanderliegen, liegt der Ausdruck — der darf **nicht** übernommen werden,');
  z.push('sondern zeigt nur, wie groß der zulässige Spielraum ist.');
  z.push('');

  const zeile = (name, werte) => `| ${name} | ${werte.join(' | ')} |`;
  const namen = eintraege.map((e) => new URL(e.url).host);
  z.push(`| Merkmal | ${namen.join(' | ')} |`);
  z.push(`|---|${namen.map(() => '---').join('|')}|`);

  const größteSchrift = (e) => Math.max(...e.desktop.typo.groessen.map(([g]) => g));
  const fliesstext = (e) => e.desktop.typo.groessen.slice().sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;

  z.push(zeile('Abschnitte', eintraege.map((e) => e.desktop.abschnitte.length)));
  z.push(zeile('Seitenhöhe (px)', eintraege.map((e) => e.desktop.seitenhoehe)));
  z.push(zeile('Wörter im ersten Bild', eintraege.map((e) => e.desktop.erstesBild.wortzahl)));
  z.push(zeile('Medium oben', eintraege.map((e) => e.desktop.erstesBild.medienart)));
  z.push(zeile('Aktionen oben', eintraege.map((e) => e.desktop.erstesBild.aktionen.length)));
  z.push(zeile('Navigationspunkte', eintraege.map((e) => e.desktop.navigation.length)));
  z.push(zeile('Fließtext (px)', eintraege.map(fliesstext)));
  z.push(zeile('Größte Schrift (px)', eintraege.map(größteSchrift)));
  z.push(zeile('Größenfaktor', eintraege.map((e) => (größteSchrift(e) / fliesstext(e)).toFixed(1))));
  z.push(zeile('Zeichen je Zeile', eintraege.map((e) => e.desktop.typo.zeichenProZeile ?? '—')));
  z.push(zeile('Schriftfamilien', eintraege.map((e) => e.desktop.typo.familien.map(([f]) => f).slice(0, 2).join(' + '))));
  z.push(zeile('Flächenfarben', eintraege.map((e) => e.desktop.farbe.anzahl)));
  z.push(zeile('Akzent', eintraege.map((e) => e.desktop.farbe.akzente[0] ?? '—')));
  z.push(zeile('Elemente mit Übergang', eintraege.map((e) => e.desktop.bewegung.mitUebergang)));
  z.push('');

  z.push('## Abschnittsfolgen nebeneinander');
  z.push('');
  for (const e of eintraege) {
    z.push(`**${new URL(e.url).host}**  `);
    z.push(e.desktop.abschnitte.map((a) => a.art).join(' → '));
    z.push('');
  }

  // Gemeinsamkeiten in der Reihenfolge = Konventionskandidaten
  const folgen = eintraege.map((e) => e.desktop.abschnitte.map((a) => a.art));
  const arten = new Map();
  for (const folge of folgen) {
    for (const [i, art] of folge.entries()) {
      if (!arten.has(art)) arten.set(art, { seiten: 0, positionen: [] });
      const eintrag = arten.get(art);
      eintrag.positionen.push(i / Math.max(1, folge.length - 1));
    }
  }
  for (const folge of folgen) {
    for (const art of new Set(folge)) arten.get(art).seiten++;
  }
  z.push('## Konventionskandidaten');
  z.push('');
  z.push('Abschnittsarten, die auf mehreren Seiten vorkommen, mit ihrer typischen Lage (0 = oben, 1 = unten).');
  z.push('Je mehr Seiten und je enger die Lage, desto eher ist es eine Konvention und keine Zufälligkeit.');
  z.push('');
  z.push('| Art | auf Seiten | Lage |');
  z.push('|---|---|---|');
  for (const [art, d] of Array.from(arten.entries()).sort((a, b) => b[1].seiten - a[1].seiten)) {
    if (d.seiten < 2) continue;
    const mittel = d.positionen.reduce((a, b) => a + b, 0) / d.positionen.length;
    z.push(`| ${art} | ${d.seiten}/${eintraege.length} | ${mittel.toFixed(2)} |`);
  }
  z.push('');
  z.push('> Übernommen werden darf: Reihenfolge, Vollständigkeit, Benennung, Bedienmuster.');
  z.push('> Nicht übernommen wird: Gestaltung, Texte, Bilder, der besondere Einfall.');
  return z.join('\n');
}

async function haupt() {
  const argumente = process.argv.slice(2);
  const outIndex = argumente.indexOf('--out');
  const ausgabe = path.resolve(outIndex >= 0 ? argumente[outIndex + 1] : '.zerlegung');
  const urls = argumente.filter((a, i) => !a.startsWith('--') && i !== outIndex + 1);
  if (!urls.length) {
    console.log('Aufruf: node zerlegen.mjs <url> [url ...] [--out .zerlegung]');
    process.exit(2);
  }

  fs.rmSync(ausgabe, { recursive: true, force: true });
  fs.mkdirSync(ausgabe, { recursive: true });

  // Chromium liest HTTPS_PROXY nicht von selbst — hinter einem Proxy muss er
  // ausdrücklich übergeben werden, sonst nur ERR_CONNECTION_RESET.
  const proxyAdresse = process.env.HTTPS_PROXY || process.env.https_proxy;
  const { chromium } = await ladePlaywright();
  // Chromiums Bypass-Liste kennt keine CIDR-Notation. Ein Eintrag wie 10.0.0.0/8
  // macht die ganze Liste unbrauchbar — dann läuft auch localhost über den Proxy
  // und man misst dessen Fehlerseite statt der eigenen.
  const bypass = ['localhost', '127.0.0.1', '::1', '<-loopback>']
    .concat((process.env.NO_PROXY ?? '').split(',').map((e) => e.trim()).filter((e) => e && !e.includes('/')))
    .join(',');
  const browser = await chromium.launch(
    proxyAdresse ? { proxy: { server: proxyAdresse, bypass } } : {},
  );
  const eintraege = [];

  for (const url of urls) {
    console.log(`Zerlege ${url} …`);
    const eintrag = { url };
    for (const [name, breite, hoehe] of [['desktop', 1440, 900], ['mobil', 390, 844]]) {
      const kontext = await browser.newContext({
        viewport: { width: breite, height: hoehe },
        userAgent: name === 'mobil'
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : undefined,
        locale: 'de-DE',
      });
      const seite = await kontext.newPage();
      try {
        let geladen = await seite.goto(url, { waitUntil: 'load', timeout: 45000 }).catch((f) => ({ fehler: f }));
        if (geladen?.fehler) {
          // Browser kommt nicht durch — Antworten aus Node nachreichen.
          console.log('  Netzweg über Node (Browser blockiert)');
          await durchleitung(kontext);
          geladen = await seite.goto(url, { waitUntil: 'load', timeout: 45000 });
        }
        await seite.waitForTimeout(2500);
        // Durchscrollen, damit nachladende Abschnitte existieren
        await seite.evaluate(async () => {
          const schritt = window.innerHeight * 0.8;
          for (let y = 0; y < document.body.scrollHeight; y += schritt) {
            window.scrollTo(0, y);
            await new Promise((auf) => setTimeout(auf, 220));
          }
          window.scrollTo(0, 0);
        });
        await seite.waitForTimeout(1200);
        const messung = await seite.evaluate(fingerabdruckImBrowser);
        messung.abschnitte.forEach((a, i) => { a.art = deuteAbschnitt(a, i); });
        eintrag[name] = messung;
        await seite.screenshot({
          path: path.join(ausgabe, `${new URL(url).host.replace(/\W+/g, '-')}-${name}.png`),
          fullPage: name === 'desktop',
        });
      } catch (fehler) {
        console.error(`  ${name}: ${String(fehler).split('\n')[0]}`);
      } finally {
        await kontext.close();
      }
    }
    if (eintrag.desktop) {
      eintraege.push(eintrag);
      fs.writeFileSync(path.join(ausgabe, `${new URL(url).host.replace(/\W+/g, '-')}.md`), seitenbericht(eintrag));
    }
  }
  await browser.close();

  if (eintraege.length > 1) fs.writeFileSync(path.join(ausgabe, 'vergleich.md'), vergleich(eintraege));
  fs.writeFileSync(path.join(ausgabe, 'rohdaten.json'), JSON.stringify(eintraege, null, 2));
  console.log(`\n${eintraege.length}/${urls.length} Seiten zerlegt → ${ausgabe}`);
  if (eintraege.length > 1) console.log(`Vergleich: ${path.join(ausgabe, 'vergleich.md')}`);
}

haupt().catch((fehler) => {
  console.error(fehler);
  process.exit(2);
});
