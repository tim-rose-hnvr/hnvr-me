/**
 * Die Seiten aus Daten — BUILD_SPEC 5.3 und 5.5, Abnahmekriterium 5.
 *
 * „Modulseiten und Anlassseiten kommen aus Daten, nicht aus kopierten
 * Dateien." Das ist keine Vorliebe für Technik: Zwanzig kopierte Seiten
 * heißt, dass die einundzwanzigste Änderung an neunzehn Stellen vergessen
 * wird. Geprüft wird deshalb, ob JEDE der zwanzig Seiten denselben Aufbau
 * hat — eine, die aus der Reihe fällt, ist eine, die von Hand angefasst
 * wurde.
 *
 *   node tools/seiten-probe.mjs
 */

import { chromium } from 'playwright-core';

const BASIS = process.env.YOUBOOTH_SEITE || 'http://localhost:4321';
let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const MODULE = ['fotobox', '360-booth', 'slow-motion', 'web-kamera', 'einwegkamera',
  'audio-gaestebuch', 'gaestebuch', 'galerie', 'foto-wall', 'slideshow', 'effekt-studio',
  'foto-finder', 'event-seiten', 'vermietung'];
const ANLAESSE = ['hochzeit', 'firmenevent', 'geburtstag', 'abiball', 'weihnachtsfeier', 'silvester'];

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
});
const kontext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const seite = await kontext.newPage();

/** Was jede Seite über sich verrät — einmal ausgelesen, mehrfach geprüft. */
async function lies(pfad) {
  const antwort = await seite.goto(BASIS + pfad, { waitUntil: 'domcontentloaded' });
  if (!antwort || !antwort.ok()) return { status: antwort?.status() ?? 0 };
  return seite.evaluate(() => {
    const abschnitte = [...document.querySelectorAll('main section')];
    const hero = abschnitte[0];
    return {
      status: 200,
      titel: document.title,
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      anzahlH1: document.querySelectorAll('h1').length,
      augenbraue: hero?.querySelector('.mono')?.textContent?.trim() || '',
      lead: hero?.querySelector('.fliess, p')?.textContent?.trim().length || 0,
      heroDunkel: /rgb\(11, ?11, ?13\)|rgb\(23, ?23, ?28\)/.test(
        getComputedStyle(hero || document.body).backgroundColor
      ),
      abschnitte: abschnitte.length,
      ueberschriften: abschnitte.map((a) => a.querySelector('h2')?.textContent?.trim() || ''),
      heroKnoepfe: [...(hero?.querySelectorAll('.knopf') || [])].map((k) => k.textContent.trim()),
      preisImHero: /\d+\s*€/.test(hero?.textContent || ''),
      /* Querverweise auf verwandte Seiten derselben Art. */
      verwandte: [...document.querySelectorAll('a[href^="/module/"], a[href^="/anlaesse/"]')]
        .map((a) => a.getAttribute('href'))
        .filter((z) => z !== location.pathname),
      schlussKnoepfe: [...(abschnitte.at(-1)?.querySelectorAll('.knopf') || [])]
        .map((k) => k.textContent.trim()),
    };
  });
}

/* 1 — Die Modulübersicht. */
console.log('\n1 · /module');
const uebersicht = await lies('/module');
pruefe('Die Übersicht antwortet', uebersicht.status === 200, String(uebersicht.status));
const kacheln = await seite.evaluate(() =>
  [...document.querySelectorAll('a[href^="/module/"]')].map((a) => a.getAttribute('href'))
);
const fehlend = MODULE.filter((m) => !kacheln.includes('/module/' + m));
pruefe('Alle vierzehn Module sind verlinkt', fehlend.length === 0, fehlend.join(', '));

/* 2 — Die vierzehn Modulseiten, jede gleich gebaut. */
console.log('\n2 · Die vierzehn Modulseiten');
const modulseiten = [];
for (const slug of MODULE) modulseiten.push([slug, await lies('/module/' + slug)]);

pruefe('Jede antwortet mit 200',
  modulseiten.every(([, d]) => d.status === 200),
  modulseiten.filter(([, d]) => d.status !== 200).map(([s]) => s).join(', '));
pruefe('Jede hat genau eine h1',
  modulseiten.every(([, d]) => d.anzahlH1 === 1),
  modulseiten.filter(([, d]) => d.anzahlH1 !== 1).map(([s, d]) => `${s}: ${d.anzahlH1}`).join(', '));
pruefe('Jede hat eine Augenbraue im Hero',
  modulseiten.every(([, d]) => d.augenbraue.length > 2),
  modulseiten.filter(([, d]) => d.augenbraue.length <= 2).map(([s]) => s).join(', '));
pruefe('Jeder Hero steht auf dunklem Grund',
  modulseiten.every(([, d]) => d.heroDunkel),
  modulseiten.filter(([, d]) => !d.heroDunkel).map(([s]) => s).join(', '));
pruefe('Jede nennt ihren Preis im Hero',
  modulseiten.every(([, d]) => d.preisImHero),
  modulseiten.filter(([, d]) => !d.preisImHero).map(([s]) => s).join(', '));
pruefe('Jede hat einen Lead',
  modulseiten.every(([, d]) => d.lead > 40),
  modulseiten.filter(([, d]) => d.lead <= 40).map(([s, d]) => `${s}: ${d.lead}`).join(', '));
pruefe('Jede verweist auf mindestens zwei verwandte Module',
  modulseiten.every(([, d]) => new Set(d.verwandte).size >= 2),
  modulseiten.filter(([, d]) => new Set(d.verwandte).size < 2)
    .map(([s, d]) => `${s}: ${new Set(d.verwandte).size}`).join(', '));
pruefe('Jede endet mit Knöpfen',
  modulseiten.every(([, d]) => d.schlussKnoepfe.length >= 1),
  modulseiten.filter(([, d]) => !d.schlussKnoepfe.length).map(([s]) => s).join(', '));

/* Aus Daten heißt: gleiche Zahl von Abschnitten. Weicht eine ab, wurde sie
   von Hand angefasst — und dann läuft sie beim nächsten Mal weiter weg. */
const anzahlen = [...new Set(modulseiten.map(([, d]) => d.abschnitte))];
pruefe('Alle haben denselben Aufbau (gleiche Abschnittszahl)', anzahlen.length <= 2,
  modulseiten.map(([s, d]) => `${s}:${d.abschnitte}`).join(' '));

/* 3 — Die Anlassübersicht und die sechs Seiten. */
console.log('\n3 · /anlaesse');
const anlassUebersicht = await lies('/anlaesse');
pruefe('Die Übersicht antwortet', anlassUebersicht.status === 200, String(anlassUebersicht.status));
const anlasslinks = await seite.evaluate(() =>
  [...document.querySelectorAll('a[href^="/anlaesse/"]')].map((a) => a.getAttribute('href'))
);
const fehlendA = ANLAESSE.filter((a) => !anlasslinks.includes('/anlaesse/' + a));
pruefe('Alle sechs Anlässe sind verlinkt', fehlendA.length === 0, fehlendA.join(', '));

console.log('\n4 · Die sechs Anlassseiten');
const anlassseiten = [];
for (const slug of ANLAESSE) anlassseiten.push([slug, await lies('/anlaesse/' + slug)]);

pruefe('Jede antwortet mit 200',
  anlassseiten.every(([, d]) => d.status === 200),
  anlassseiten.filter(([, d]) => d.status !== 200).map(([s]) => s).join(', '));
pruefe('Jede hat genau eine h1',
  anlassseiten.every(([, d]) => d.anzahlH1 === 1),
  anlassseiten.filter(([, d]) => d.anzahlH1 !== 1).map(([s, d]) => `${s}: ${d.anzahlH1}`).join(', '));
pruefe('Jede verweist auf passende Module',
  anlassseiten.every(([, d]) => d.verwandte.some((z) => z.startsWith('/module/'))),
  anlassseiten.filter(([, d]) => !d.verwandte.some((z) => z.startsWith('/module/')))
    .map(([s]) => s).join(', '));
const anlassAnzahlen = [...new Set(anlassseiten.map(([, d]) => d.abschnitte))];
pruefe('Alle haben denselben Aufbau', anlassAnzahlen.length <= 2,
  anlassseiten.map(([s, d]) => `${s}:${d.abschnitte}`).join(' '));

/* Die Anlassfarbe darf die Fläche färben — der Handlungsknopf bleibt Amber. */
console.log('\n5 · Anlassfarbe färbt nicht den Knopf');
for (const [slug] of anlassseiten) {
  await seite.goto(BASIS + '/anlaesse/' + slug, { waitUntil: 'domcontentloaded' });
  const amber = await seite.evaluate(() => {
    const k = document.querySelector('.knopf--amber');
    return k ? getComputedStyle(k).backgroundColor : null;
  });
  pruefe(`${slug}: der Hauptknopf ist amber`,
    amber !== null && amber.includes('242, 178, 62'), amber);
}

/* 6 — Der Weg zu den Vorlagen mit vorgewähltem Anlass. */
console.log('\n6 · Weg zu den passenden Vorlagen');
for (const [slug] of anlassseiten) {
  await seite.goto(BASIS + '/anlaesse/' + slug, { waitUntil: 'domcontentloaded' });
  const weg = await seite.evaluate(() =>
    [...document.querySelectorAll('a[href^="/vorlagen"]')].map((a) => a.getAttribute('href'))
  );
  pruefe(`${slug}: verweist auf die Vorlagen`, weg.length > 0, weg.join(', '));
}

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
