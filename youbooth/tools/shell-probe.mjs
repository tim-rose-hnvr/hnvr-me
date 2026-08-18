/**
 * Die Shell gegen BUILD_SPEC Teil 4 und die Abnahmekriterien aus Teil 7.
 *
 * Kopfleiste und Fußzeile gibt es genau einmal im Code — deshalb reicht es,
 * sie einmal zu messen. Was hier durchfällt, fällt auf allen 50 Seiten durch.
 *
 *   node tools/shell-probe.mjs
 */

import { chromium } from 'playwright-core';

const BASIS = process.env.YOUBOOTH_SEITE || 'http://localhost:4321';
let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});

/* 1 — Kopfleiste auf einem breiten Schirm. */
console.log('\n1 · Kopfleiste (1280px)');
const breit = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let seite = await breit.newPage();
await seite.goto(BASIS + '/preise', { waitUntil: 'networkidle' });

const kopf = await seite.evaluate(() => {
  const k = document.querySelector('.kopf');
  const s = getComputedStyle(k);
  return {
    hoehe: k.getBoundingClientRect().height,
    haftend: s.position,
    flaeche: s.backgroundColor,
    punkte: [...k.querySelectorAll('nav a')].map((a) => a.textContent.trim()),
    aktiv: [...k.querySelectorAll('nav a.on')].map((a) => a.textContent.trim()),
    knoepfe: [...k.querySelectorAll('.rechts a')].map((a) => a.textContent.trim()),
  };
});
pruefe('Genau 74px hoch', Math.round(kopf.hoehe) === 74, String(kopf.hoehe));
pruefe('Haftet oben', kopf.haftend === 'sticky', kopf.haftend);
pruefe('Fläche rgba(11,11,13,.86)', kopf.flaeche.replace(/\s/g, '') === 'rgba(11,11,13,0.86)', kopf.flaeche);

const SOLL = ['System', 'Module', 'Anlässe', 'Vorlagen', 'Vergleich', 'Preise', 'Rechner',
  'Referenzen', 'Ratgeber', 'Hilfe', 'Partner', 'Team'];
pruefe('Zwölf Menüpunkte in der Reihenfolge der Spec',
  kopf.punkte.join('|') === SOLL.join('|'), kopf.punkte.join(' · '));
pruefe('Der aktive Punkt kommt aus dem Pfad', kopf.aktiv.join() === 'Preise', kopf.aktiv.join());
pruefe('Rechts stehen Anmelden und Kostenlos testen',
  kopf.knoepfe.join('|') === 'Anmelden|Kostenlos testen', kopf.knoepfe.join(' · '));

/* 2 — Die Fußzeile. */
console.log('\n2 · Fußzeile');
const fuss = await seite.evaluate(() => {
  const f = document.querySelector('.fuss');
  return {
    titel: [...f.querySelectorAll('.spalte .mono')].map((s) => s.textContent.trim()),
    post: !!f.querySelector('a[href="mailto:hallo@youbooth.me"]'),
    punktde: f.innerHTML.includes('youbooth.de'),
  };
});
pruefe('Vier Spalten: Produkt · Anlässe · Hilfe · Unternehmen',
  fuss.titel.join('|') === 'Produkt|Anlässe|Hilfe|Unternehmen', fuss.titel.join(' · '));
pruefe('hallo@youbooth.me steht darin', fuss.post);
pruefe('youbooth.de kommt nirgends vor', !fuss.punktde);

/* 3 — Kein waagerechtes Scrollen, auf keiner Breite. */
console.log('\n3 · Breiten');
for (const breite of [1600, 1440, 1366, 1280, 1160, 1020, 900, 640, 380]) {
  const k = await browser.newContext({ viewport: { width: breite, height: 900 } });
  const s = await k.newPage();
  await s.goto(BASIS + '/', { waitUntil: 'networkidle' });
  /* Nach dem Bild vom ersten Durchgang: „steht nichts seitlich über" reicht
     nicht. Die Navigation kann bei `nowrap` auch INNERHALB der Leiste über
     Wortmarke und Knöpfe laufen — sichtbar, aber ohne Scrollbalken. */
  const messwert = await s.evaluate(() => {
    const kopf = document.querySelector('.kopf');
    const marke = kopf.querySelector('.marke').getBoundingClientRect();
    const rechts = kopf.querySelector('.rechts').getBoundingClientRect();
    const punkte = [...kopf.querySelectorAll('.links a')].map((a) => a.getBoundingClientRect());
    const sichtbar = getComputedStyle(kopf.querySelector('.links')).flexDirection === 'row';
    let ueberlappt = '';
    if (sichtbar && punkte.length) {
      if (punkte[0].left < marke.right - 0.5) ueberlappt = 'Navigation über der Wortmarke';
      else if (punkte[punkte.length - 1].right > rechts.left + 0.5) ueberlappt = 'Navigation über den Knöpfen';
    }
    return {
      ueber: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      kopfhoehe: kopf.getBoundingClientRect().height,
      burger: getComputedStyle(kopf.querySelector('.burger')).display !== 'none',
      ueberlappt,
    };
  });
  pruefe(`${breite}px: nichts steht seitlich über`, !messwert.ueber);
  pruefe(`${breite}px: Leiste bleibt 74px`, Math.round(messwert.kopfhoehe) === 74, String(messwert.kopfhoehe));
  pruefe(`${breite}px: Burger ${breite <= 1365 ? 'da' : 'weg'}`, messwert.burger === (breite <= 1365));
  pruefe(`${breite}px: nichts in der Leiste überlappt`, !messwert.ueberlappt, messwert.ueberlappt || '');
  await k.close();
}

/* 4 — Das Panel: öffnen, Escape, Sperre. */
console.log('\n4 · Menü auf schmalem Schirm');
const schmal = await browser.newContext({ viewport: { width: 700, height: 900 } });
const s2 = await schmal.newPage();
await s2.goto(BASIS + '/', { waitUntil: 'networkidle' });
await s2.click('.burger');
const offen = await s2.evaluate(() => ({
  sichtbar: getComputedStyle(document.querySelector('.huelle')).display !== 'none',
  unterhalb: document.querySelector('.huelle').getBoundingClientRect().top >= 74,
  kopfhoehe: document.querySelector('.kopf').getBoundingClientRect().height,
  gesperrt: getComputedStyle(document.body).overflow === 'hidden',
  anmelden: getComputedStyle(document.querySelector('.rechts .ghost')).display !== 'none',
}));
pruefe('Das Panel erscheint', offen.sichtbar);
pruefe('Es hängt UNTER der Leiste', offen.unterhalb);
pruefe('Die Leiste bleibt dabei 74px hoch', Math.round(offen.kopfhoehe) === 74, String(offen.kopfhoehe));
pruefe('Die Seite darunter scrollt nicht weg', offen.gesperrt);
pruefe('Anmelden ist im Panel sichtbar', offen.anmelden);

await s2.keyboard.press('Escape');
const zu = await s2.evaluate(() => ({
  sichtbar: getComputedStyle(document.querySelector('.huelle')).display !== 'none',
  gesperrt: getComputedStyle(document.body).overflow === 'hidden',
}));
pruefe('Escape schließt es', !zu.sichtbar);
pruefe('Und hebt die Sperre wieder auf', !zu.gesperrt);

/* 5 — Typografie nach Teil 2. */
console.log('\n5 · Typografie T1');
const typo = await seite.evaluate(() => {
  const h1 = document.querySelector('h1');
  const s = getComputedStyle(h1);
  const koerper = getComputedStyle(document.body);
  return {
    gewicht: s.fontWeight, laufweite: s.letterSpacing, groesse: parseFloat(s.fontSize),
    versalien: s.textTransform,
    schrift: s.fontFamily, textfarbe: koerper.color,
  };
});
pruefe('h1 ist 900', typo.gewicht === '900', typo.gewicht);
/* -0.035em bei der gemessenen Schriftgröße — der Browser gibt Pixel zurück. */
pruefe('h1 läuft auf -0.035em',
  Math.abs(parseFloat(typo.laufweite) / typo.groesse + 0.035) < 0.002,
  `${typo.laufweite} bei ${typo.groesse}px`);
pruefe('h1 in Versalien', typo.versalien === 'uppercase', typo.versalien);
pruefe('Archivo, nichts anderes', /Archivo/.test(typo.schrift), typo.schrift);
pruefe('Fließtext ist ink (#0b0b0d)', typo.textfarbe.replace(/\s/g, '') === 'rgb(11,11,13)', typo.textfarbe);

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
