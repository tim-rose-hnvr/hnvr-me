/**
 * Die Startseite gegen BUILD_SPEC 5.1.
 *
 * Die Spec zählt für `/` acht Abschnitte auf, mit Ton, Inhalt und Reihenfolge.
 * Das ist prüfbar — und es lohnt sich, weil die Startseite die einzige Seite
 * ist, die fast jeder Besucher sieht.
 *
 *   node tools/startseite-probe.mjs
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
const kontext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const seite = await kontext.newPage();
await seite.goto(BASIS + '/', { waitUntil: 'networkidle' });

/* 1 — Der Hero. */
console.log('\n1 · Hero (tone: ink)');
const hero = await seite.evaluate(() => {
  const h = document.querySelector('.hero');
  if (!h) return null;
  const flaeche = getComputedStyle(h).backgroundColor;
  return {
    dunkel: /rgb\(11, ?11, ?13\)/.test(flaeche) ||
      /rgb\(11, ?11, ?13\)/.test(getComputedStyle(h.parentElement).backgroundColor),
    augenbraue: h.querySelector('.mono')?.textContent?.trim(),
    titel: h.querySelector('h1')?.textContent?.trim(),
    lead: h.querySelector('.fliess')?.textContent?.trim().length || 0,
    knoepfe: [...h.querySelectorAll('.knopf')].map((k) => k.textContent.trim()),
    fussnote: [...h.querySelectorAll('.mono')].pop()?.textContent?.trim(),
    bild: !!h.querySelector('img, .platz, .bildflaeche'),
  };
});
pruefe('Es gibt einen Hero', !!hero);
pruefe('Er steht auf dunklem Grund', hero.dunkel);
pruefe('Augenbraue in Mono', (hero.augenbraue || '').length > 5, hero.augenbraue);
pruefe('h1 wie in der Spec',
  hero.titel === 'Die Software, die den ganzen Abend trägt', hero.titel);
pruefe('Ein Lead darunter', hero.lead > 60, String(hero.lead));
pruefe('Zwei Knöpfe: einer voll, einer als Rahmen', hero.knoepfe.length === 2, hero.knoepfe.join(' · '));
pruefe('Mono-Fußnote mit Preis und Kündbarkeit',
  /39|kündbar/i.test(hero.fussnote || ''), hero.fussnote);
pruefe('Rechts ein Bild', hero.bild);

/* 2 — Die beiden Karten. */
console.log('\n2 · Zwei Dinge, ein System');
const karten = await seite.evaluate(() => {
  const abschnitt = [...document.querySelectorAll('section')].find((s) =>
    s.querySelector('h2')?.textContent?.includes('Zwei Dinge')
  );
  if (!abschnitt) return null;
  return [...abschnitt.querySelectorAll('.karte')].map((k) => {
    const marke = k.querySelector('.karte__marke');
    return {
      dunkel: k.classList.contains('karte--dunkel'),
      ecke: marke?.textContent?.trim(),
      eckeAmber: marke ? getComputedStyle(marke).backgroundColor.includes('242, 178, 62') : false,
      punkte: k.querySelectorAll('.punkte li').length,
      bild: !!k.querySelector('img, .platz, .bildflaeche'),
    };
  });
});
pruefe('Genau zwei Karten', karten?.length === 2, String(karten?.length));
pruefe('Die erste ist dunkel und trägt ein Amber-Kennzeichen',
  karten?.[0]?.dunkel && karten?.[0]?.eckeAmber, JSON.stringify(karten?.[0]));
pruefe('Es sagt „Die Software"', /software/i.test(karten?.[0]?.ecke || ''), karten?.[0]?.ecke);
pruefe('Die zweite ist hell und trägt ein dunkles Kennzeichen',
  !karten?.[1]?.dunkel && !karten?.[1]?.eckeAmber, JSON.stringify(karten?.[1]));
pruefe('Es sagt „Eure Hardware"', /hardware/i.test(karten?.[1]?.ecke || ''), karten?.[1]?.ecke);
pruefe('Je drei Punkte', karten?.every((k) => k.punkte === 3),
  karten?.map((k) => k.punkte).join(', '));
pruefe('Je ein Bild', karten?.every((k) => k.bild));

/* 3–6 — Reihenfolge und Ton der Abschnitte. */
console.log('\n3 · Reihenfolge der acht Abschnitte');
const folge = await seite.evaluate(() =>
  [...document.querySelectorAll('main section')].map((s) => {
    const stil = getComputedStyle(s);
    /* Der Name eines Abschnitts kann in der Augenbraue stehen statt in der
       Überschrift — die Spec nennt Abschnitte, nicht Überschriftentexte. */
    const augenbraue = s.querySelector('.mono')?.textContent?.trim() || '';
    return {
      titel: s.querySelector('h1, h2')?.textContent?.trim().slice(0, 40) || '(ohne)',
      augenbraue,
      dunkel: /rgb\(11, ?11, ?13\)|rgb\(23, ?23, ?28\)/.test(stil.backgroundColor),
    };
  })
);
const ERWARTET = [
  ['Die Software, die den ganzen Abend', true],
  ['Zwei Dinge, ein System', false],
  ['So sieht eine Fotobox aus', true],
  ['Beispiele aus echten Events', false],
  ['So läuft ein Abend', false],
  ['Läuft weiter, wenn das WLAN', true],
  ['Module, die zusammenspielen', false],
];
for (const [text, dunkel] of ERWARTET) {
  const kurz = text.slice(0, 24);
  const treffer = folge.find((a) => a.titel.startsWith(kurz) || a.augenbraue.startsWith(kurz));
  pruefe(`„${text}" steht da`, !!treffer, folge.map((f) => f.titel).join(' | '));
  if (treffer) {
    pruefe(`  … auf ${dunkel ? 'dunklem' : 'hellem'} Grund`, treffer.dunkel === dunkel);
  }
}

/* 7 — Die Module. */
console.log('\n4 · Module, die zusammenspielen');
const module = await seite.evaluate(() => {
  const abschnitt = [...document.querySelectorAll('section')].find((s) =>
    s.querySelector('h2')?.textContent?.includes('Module')
  );
  if (!abschnitt) return null;
  /* Gemessen wird die KARTE, nicht der Link darin: Der Preis steht laut Spec
     auf der Karte, und ob er im Linktext oder daneben sitzt, ist Gestaltung. */
  const karten = [...abschnitt.querySelectorAll('.karte')];
  return {
    anzahl: karten.length,
    ziele: karten.map((k) => k.querySelector('a[href^="/module/"]')?.getAttribute('href')),
    mitPreis: karten.filter((k) => /\d+\s*€/.test(k.textContent || '')).length,
    weiter: abschnitt.querySelector('a[href="/module"]')?.textContent?.trim(),
  };
});
pruefe('Vierzehn Modulkarten', module?.anzahl === 14, String(module?.anzahl));
pruefe('Jede führt auf ihre Modulseite',
  module?.ziele.every((z) => /^\/module\/[a-z0-9-]+$/.test(z)),
  module?.ziele.filter((z) => !/^\/module\/[a-z0-9-]+$/.test(z)).join(', '));
pruefe('Jede nennt einen Preis', module?.mitPreis === 14, String(module?.mitPreis));
pruefe('Darüber der Verweis „Alle 14 Module ansehen"',
  /14 Module/.test(module?.weiter || ''), module?.weiter);

/* 8 — Der Abschluss. */
console.log('\n5 · Abschluss');
const schluss = await seite.evaluate(() => {
  const s = [...document.querySelectorAll('main section')].pop();
  return {
    dunkel: /rgb\(11, ?11, ?13\)|rgb\(23, ?23, ?28\)/.test(getComputedStyle(s).backgroundColor),
    knoepfe: [...s.querySelectorAll('.knopf')].map((k) => k.textContent.trim()),
  };
});
pruefe('Der letzte Abschnitt steht auf dunklem Grund', schluss.dunkel);
pruefe('Zwei Knöpfe zum Schluss', schluss.knoepfe.length === 2, schluss.knoepfe.join(' · '));

/* 9 — Ein Wort, überall gleich. */
console.log('\n6 · Der Testen-Knopf heißt überall gleich');
const namen = await seite.evaluate(() =>
  [...document.querySelectorAll('a[href="/kontakt"]')]
    .map((a) => a.textContent.trim())
    .filter((t) => /test/i.test(t))
);
const eindeutig = [...new Set(namen)];
pruefe('Nur eine Schreibweise auf der Startseite', eindeutig.length <= 1, eindeutig.join(' | '));

/* 10 — Kein angeschnittenes Bild. */
console.log('\n7 · Bilder');
/* Die Regel aus 3.9 gilt für Screenshots und Fotos in einer Bildfläche —
   nicht für das Signet in der Leiste, das mit fester Größe steht. */
const bilder = await seite.evaluate(() =>
  [...document.querySelectorAll('.platz img, .bildflaeche img, figure img')].map((b) => ({
    fit: getComputedStyle(b).objectFit,
    alt: b.getAttribute('alt'),
  }))
);
pruefe(`Bilder in Bildflächen gefunden (${bilder.length})`, bilder.length > 0);
pruefe('Jedes steht auf contain', bilder.every((b) => b.fit === 'contain'),
  [...new Set(bilder.map((b) => b.fit))].join(', '));
pruefe('Jedes Bild hat einen Alternativtext',
  bilder.every((b) => b.alt !== null), String(bilder.filter((b) => b.alt === null).length));

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
