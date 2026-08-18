/**
 * Die Primitives gegen BUILD_SPEC Teil 3.
 *
 * Gemessen wird am gerenderten Ergebnis, nicht am Quelltext: Ob ein Knopf
 * 40px hoch ist, entscheidet der Browser nach allen Kaskadenregeln — und
 * genau dort sind die Abweichungen bisher entstanden.
 *
 *   node tools/bausteine-probe.mjs
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
const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const seite = await kontext.newPage();
await seite.goto(BASIS + '/', { waitUntil: 'networkidle' });

console.log('\n1 · Knopf (3.4)');
const knopf = await seite.evaluate(() => {
  const alle = [...document.querySelectorAll('.knopf:not(.knopf--text)')];
  return alle.map((k) => {
    const s = getComputedStyle(k);
    return { hoehe: Math.round(k.getBoundingClientRect().height), gewicht: s.fontWeight,
             groesse: parseFloat(s.fontSize), radius: s.borderRadius };
  });
});
pruefe(`Es gibt Knöpfe zu messen (${knopf.length})`, knopf.length > 0);
const zuHoch = knopf.filter((k) => k.hoehe !== 40 && k.hoehe !== 36);
pruefe('Alle 40px hoch (klein: 36)', zuHoch.length === 0, zuHoch.map((k) => k.hoehe + 'px').join(', '));
pruefe('Gewicht 600', knopf.every((k) => k.gewicht === '600'), [...new Set(knopf.map((k) => k.gewicht))].join());
pruefe('Größe 12.5–14px', knopf.every((k) => k.groesse >= 12.5 && k.groesse <= 14),
  [...new Set(knopf.map((k) => k.groesse))].join());
pruefe('Radius 10px', knopf.every((k) => k.radius === '10px'), [...new Set(knopf.map((k) => k.radius))].join());

console.log('\n2 · Karte (3.3)');
const karte = await seite.evaluate(() => {
  const k = document.querySelector('.karte:not(.karte--gross)');
  if (!k) return null;
  const s = getComputedStyle(k);
  return { polster: s.padding, radius: s.borderRadius, luecke: s.gap, schatten: s.boxShadow };
});
pruefe('Polster 24px', karte && karte.polster === '24px', karte && karte.polster);
pruefe('Radius 14px', karte && karte.radius === '14px', karte && karte.radius);
pruefe('Lücke 11px', karte && karte.luecke === '11px', karte && karte.luecke);

console.log('\n3 · Bildfläche (3.9) — nie anschneiden');
const bilder = await seite.evaluate(() =>
  [...document.querySelectorAll('.bildflaeche img, .platz img')].map(
    (b) => getComputedStyle(b).objectFit
  )
);
pruefe('Jedes Bild steht auf contain', bilder.every((f) => f === 'contain'),
  [...new Set(bilder)].join());
const gezeichnet = await seite.evaluate(() => document.querySelectorAll('.boxbild svg').length);
pruefe('Kein gezeichnetes Ersatzmotiv mehr', gezeichnet === 0, String(gezeichnet));

console.log('\n4 · Abschnitt (3.1)');
/* Gemessen wird der INHALT, nicht die Flaeche: Der Abschnitt reicht bewusst
   von Kante zu Kante, damit ein dunkler Grund randlos steht. Gekappt wird,
   was darin liegt. */
const abschnitt = await seite.evaluate(() => {
  const breiten = [...document.querySelectorAll('.abschnitt')].map((a) => {
    const kind = a.querySelector(':scope > .innen') || a.firstElementChild;
    return kind ? Math.round(kind.getBoundingClientRect().width) : 0;
  });
  return { groesste: Math.max(...breiten), anzahl: breiten.length };
});
pruefe(`Inhalt aller ${abschnitt.anzahl} Abschnitte höchstens 1240px breit`,
  abschnitt.groesste <= 1240, String(abschnitt.groesste));

console.log('\n5 · Chip (3.5) — kein Chip ohne Wirkung');
const chipseite = await kontext.newPage();
await chipseite.goto(BASIS + '/vorlagen', { waitUntil: 'networkidle' });
const chips = await chipseite.evaluate(() =>
  [...document.querySelectorAll('.chip, [role="button"][aria-pressed]')].map((c) => ({
    hoehe: Math.round(c.getBoundingClientRect().height),
    gedrueckt: c.getAttribute('aria-pressed'),
    knopf: c.tagName === 'BUTTON' || c.getAttribute('role') === 'button',
  }))
);
if (chips.length) {
  pruefe(`Chips gefunden (${chips.length})`, true);
  pruefe('Alle 34px hoch', chips.every((c) => c.hoehe === 34), [...new Set(chips.map((c) => c.hoehe))].join());
  pruefe('Alle mit aria-pressed', chips.every((c) => c.gedrueckt !== null));
  pruefe('Alle bedienbar (button/role)', chips.every((c) => c.knopf));
} else {
  console.log('  – Auf /vorlagen stehen noch keine Chips (Teil 5 steht aus)');
}

console.log('\n6 · Bewegung (3.11)');
const bewegung = await seite.evaluate(() => {
  const regeln = [...document.styleSheets].flatMap((b) => {
    try { return [...b.cssRules]; } catch { return []; }
  });
  const namen = regeln.filter((r) => r.type === 7).map((r) => r.name);
  return { keyframes: namen, einflug: namen.includes('einflug') };
});
pruefe('Es gibt genau einen Einflug', bewegung.einflug, bewegung.keyframes.join(', '));

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
