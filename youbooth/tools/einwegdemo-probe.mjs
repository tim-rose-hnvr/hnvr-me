/**
 * Die spielbare Einwegkamera — BUILD_SPEC 5.10.
 *
 * Der Witz des Moduls ist eine fehlende Funktion: kein Vorschaubild. Genau
 * deshalb ist die Demo prüfbar — und genau deshalb wäre es fatal, wenn
 * jemand sie später „verbessert" und ein Bild einbaut.
 *
 *   node tools/einwegdemo-probe.mjs
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
const seite = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await seite.goto(BASIS + '/module/einwegkamera', { waitUntil: 'networkidle' });

console.log('\n1 · Ausgangslage');
pruefe('Die Demo steht auf der Seite', await seite.locator('[data-einwegdemo]').count() === 1);
pruefe('Der Zähler steht auf 24', (await seite.textContent('[data-zaehler]'))?.trim() === '24');
pruefe('„Entwickeln" ist noch gesperrt', await seite.isDisabled('[data-entwickeln]'));
pruefe('Es ist kein Abzug zu sehen', await seite.locator('.abzug').count() === 0);

console.log('\n2 · Abdrücken');
await seite.click('[data-ausloesen]');
await seite.waitForTimeout(120);
pruefe('Der Zähler geht eins runter', (await seite.textContent('[data-zaehler]'))?.trim() === '23');
pruefe('ES ERSCHEINT KEIN BILD — der Witz des Moduls',
  await seite.locator('.abzug').count() === 0);
pruefe('Dafür sagt die Demo, was passiert ist',
  /Aufnahme weniger|belichtet/.test((await seite.textContent('[data-sagt]')) || ''),
  await seite.textContent('[data-sagt]'));
pruefe('„Entwickeln" ist jetzt frei', !(await seite.isDisabled('[data-entwickeln]')));

console.log('\n3 · Filmlänge wechseln');
pruefe('Während ein Film läuft, ist die Länge gesperrt',
  await seite.isDisabled('[data-laenge="12"]'));
await seite.click('[data-neu]');
await seite.waitForTimeout(80);
pruefe('Nach „Neuer Film" wieder wählbar', !(await seite.isDisabled('[data-laenge="12"]')));
await seite.click('[data-laenge="12"]');
pruefe('Zwölf Aufnahmen', (await seite.textContent('[data-zaehler]'))?.trim() === '12');

console.log('\n4 · Film voll');
for (let i = 0; i < 12; i++) await seite.click('[data-ausloesen]');
await seite.waitForTimeout(150);
pruefe('Der Zähler steht auf 0', (await seite.textContent('[data-zaehler]'))?.trim() === '0');
pruefe('Der Auslöser ist gesperrt', await seite.isDisabled('[data-ausloesen]'));
pruefe('Die Demo sagt „Film voll"',
  /voll/i.test((await seite.textContent('[data-sagt]')) || ''),
  await seite.textContent('[data-sagt]'));
pruefe('Und immer noch kein Bild', await seite.locator('.abzug').count() === 0);

console.log('\n5 · Entwickeln');
await seite.click('[data-entwickeln]');
await seite.waitForTimeout(700);
pruefe('Zwölf Abzüge auf einmal', await seite.locator('.abzug').count() === 12,
  String(await seite.locator('.abzug').count()));
const erster = await seite.locator('.abzug').first().textContent();
pruefe('Jeder trägt Nummer und Datum', /01/.test(erster || '') && /\d{1,2}\.\d{1,2}\.\d{4}/.test(erster || ''),
  erster?.trim());
pruefe('Danach lässt sich nicht weiter abdrücken', await seite.isDisabled('[data-ausloesen]'));

console.log('\n6 · Von vorn');
await seite.click('[data-neu]');
await seite.waitForTimeout(120);
pruefe('Die Abzüge sind weg', await seite.locator('.abzug').count() === 0);
pruefe('Der Zähler steht wieder auf 12', (await seite.textContent('[data-zaehler]'))?.trim() === '12');

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
