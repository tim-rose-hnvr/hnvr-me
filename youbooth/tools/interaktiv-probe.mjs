/**
 * Die interaktiven Seiten — BUILD_SPEC 5.4 und 5.6 bis 5.9.
 *
 * Für jede dieser Seiten nennt die Spec einen Zustand und was er bewirkt.
 * Das ist prüfbar, und es ist die Sorte Fehler, die man beim Durchsehen
 * nicht findet: Ein Chip, der aussieht wie ein Filter und keiner ist, fällt
 * erst auf, wenn jemand ihn drückt und nichts passiert.
 *
 * Abnahmekriterium 4 sagt es kurz: „Jeder sichtbare Chip filtert, jeder
 * Button tut etwas, jede Filterfläche hat einen Leer-Zustand."
 *
 *   node tools/interaktiv-probe.mjs
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

/* ---------------------------------------------------------------- */
/* 5.4 — Die Vorlagen-Galerie                                        */
/* ---------------------------------------------------------------- */
console.log('\n1 · /vorlagen — Filter');
await seite.goto(BASIS + '/vorlagen', { waitUntil: 'networkidle' });

const zaehleVorlagen = () => seite.evaluate(() =>
  [...document.querySelectorAll('.vorlage, .vkarte, [data-vorlage]')]
    .filter((k) => getComputedStyle(k).display !== 'none').length
);

const vorher = await zaehleVorlagen();
pruefe(`Es liegen Vorlagen da (${vorher})`, vorher > 0);

const chips = await seite.$$('.chip[data-anlass]:not([data-anlass="alle"])');
pruefe(`Anlass-Chips gefunden (${chips.length})`, chips.length > 0);

if (chips.length) {
  await chips[0].click();
  await seite.waitForTimeout(250);
  const nachher = await zaehleVorlagen();
  pruefe('Ein Anlass-Chip verändert die Trefferzahl', nachher !== vorher && nachher >= 0,
    `${vorher} → ${nachher}`);
  pruefe('Der gedrückte Chip meldet das auch der Vorlesehilfe',
    (await chips[0].getAttribute('aria-pressed')) === 'true');
}

/* Preise haben auf Vorlagen nichts zu suchen — sie sind inklusive. */
const preisImRaster = await seite.evaluate(() => {
  const raster = document.querySelector('.vraster, .vorlagen, main');
  return /\d+[,.]\d\d\s*€|\d+\s*€/.test(raster?.textContent || '');
});
pruefe('Keine Preise bei den Vorlagen', !preisImRaster);
const kennzeichen = await seite.evaluate(() => /inklusive/i.test(document.body.textContent || ''));
pruefe('Sie sind als „inklusive" gekennzeichnet', kennzeichen);

/* Leer-Zustand: zwei Filter, die sich ausschließen. */
console.log('\n2 · /vorlagen — Leer-Zustand');
const leer = await seite.evaluate(() => {
  const anlass = [...document.querySelectorAll('.chip[data-anlass]')];
  const format = [...document.querySelectorAll('.chip[data-format]')];
  /* Jede Kombination durchprobieren, bis eine keinen Treffer hat — welche
     das ist, hängt vom Bestand ab und darf sich ändern. */
  for (const a of anlass) {
    for (const f of format) {
      a.click(); f.click();
      const sichtbar = [...document.querySelectorAll('.vorlage, .vkarte, [data-vorlage]')]
        .filter((k) => getComputedStyle(k).display !== 'none').length;
      if (sichtbar === 0) return { gefunden: true, a: a.textContent.trim(), f: f.textContent.trim() };
    }
  }
  return { gefunden: false };
});
if (leer.gefunden) {
  await seite.waitForTimeout(200);
  const hinweis = await seite.evaluate(() => {
    const t = document.body.textContent || '';
    return /kein treffer|nichts gefunden|keine vorlage/i.test(t);
  });
  pruefe(`Bei 0 Treffern (${leer.a} + ${leer.f}) steht ein Hinweis da`, hinweis);
} else {
  console.log('  – Keine Filterkombination ohne Treffer; Leer-Zustand nicht auslösbar');
}

/* ---------------------------------------------------------------- */
/* 5.6 — Der Preiskonfigurator                                       */
/* ---------------------------------------------------------------- */
console.log('\n3 · /preise — rechnet mit');
await seite.goto(BASIS + '/preise', { waitUntil: 'networkidle' });

const summe = () => seite.evaluate(() => {
  const el = document.querySelector('[data-feld="summe"], [data-summe], .psumme');
  return el ? el.textContent.trim() : null;
});
const s1 = await summe();
pruefe('Es gibt eine sichtbare Summe', s1 !== null, String(s1));

const modulSchalter = await seite.$$('[data-modul], .pmodul, .modulschalter');
pruefe(`Module lassen sich einzeln schalten (${modulSchalter.length})`, modulSchalter.length >= 10,
  String(modulSchalter.length));
if (modulSchalter.length) {
  await modulSchalter[0].click();
  await seite.waitForTimeout(220);
  const s2 = await summe();
  pruefe('Ein Modul zu buchen ändert die Summe', s2 !== s1, `${s1} → ${s2}`);
}

const mehr = await seite.$('[data-boxen="plus"], [data-boxen="+"], [data-feld="boxen-mehr"]');
if (mehr) {
  const vor = await summe();
  await mehr.click();
  await seite.waitForTimeout(220);
  pruefe('Eine Box mehr ändert die Summe', (await summe()) !== vor, `${vor} → ${await summe()}`);
} else {
  console.log('  – Kein Boxen-Schalter gefunden');
}

const komma = await seite.evaluate(() => {
  const t = document.querySelector('[data-summe], .psumme, .summe')?.textContent || '';
  return !/\d+\.\d\d\s*€/.test(t);
});
pruefe('Beträge mit Komma, nicht mit Punkt', komma);

/* Akkordeon: immer nur eines offen.
   Die Seiten benutzen `<details name>` — das native Element mit
   gegenseitigem Ausschluss. Es hält die Regel ohne eine Zeile JavaScript und
   funktioniert auch dann, wenn das Skript scheitert; `aria-expanded` braucht
   es nicht, der Browser meldet den Zustand selbst. */
console.log('\n4 · Akkordeon — immer nur eines offen');
for (const pfad of ['/preise', '/hilfe', '/ratgeber']) {
  await seite.goto(BASIS + pfad, { waitUntil: 'networkidle' });
  /* Nur sichtbare Köpfe: Auf den Filterseiten sind die ausgefilterten
     Klappen mit `display: none` weg, und auf eine unsichtbare zu klicken
     misst nichts. */
  const alle = await seite.$$('details > summary, [aria-expanded]');
  const koepfe = [];
  for (const k of alle) if (await k.isVisible()) koepfe.push(k);
  if (koepfe.length < 2) { console.log(`  – ${pfad}: kein sichtbares Akkordeon`); continue; }
  const gruppe = await seite.evaluate(() => {
    const d = document.querySelector('details');
    return d ? d.getAttribute('name') : null;
  });
  pruefe(`${pfad}: die Klappen bilden eine Gruppe`, !!gruppe, String(gruppe));
  await koepfe[0].scrollIntoViewIfNeeded();
  await koepfe[0].click();
  await seite.waitForTimeout(150);
  await koepfe[1].scrollIntoViewIfNeeded();
  await koepfe[1].click();
  await seite.waitForTimeout(200);
  const offen = await seite.evaluate(() =>
    document.querySelectorAll('details[open], [aria-expanded="true"]').length
  );
  pruefe(`${pfad}: nach zwei Klicks ist genau eines offen`, offen === 1, String(offen));
}

/* ---------------------------------------------------------------- */
/* 5.9 — Das Kontaktformular                                         */
/* ---------------------------------------------------------------- */
console.log('\n5 · /kontakt — Fehler erst nach dem Absenden');
await seite.goto(BASIS + '/kontakt', { waitUntil: 'networkidle' });

/* Gezählt wird, was SICHTBAR ist: Die Meldungen stehen im Markup und sind
   mit `hidden` weggeschaltet — das ist richtig so, sie brauchen ihren Platz
   und ihre Kennung für `aria-describedby`. */
const fehlerVorher = await seite.evaluate(() =>
  [...document.querySelectorAll('.fehler, [data-fehler], [aria-invalid="true"]')]
    .filter((e) => e.offsetParent !== null).length
);
pruefe('Vor dem Absenden steht kein Fehler da', fehlerVorher === 0, String(fehlerVorher));

const freitext = await seite.$('textarea');
if (freitext) {
  pruefe('Das Freitextfeld startet leer', (await freitext.inputValue()) === '');
}

const senden = await seite.$('button[type="submit"], [data-senden]');
if (senden) {
  await senden.click();
  await seite.waitForTimeout(300);
  const nach = await seite.evaluate(() => ({
    fehler: [...document.querySelectorAll('.fehler, [data-fehler], [aria-invalid="true"]')]
      .filter((e) => e.offsetParent !== null).length,
    text: document.body.textContent || '',
  }));
  pruefe('Nach dem Absenden ohne Eingabe stehen Fehler da', nach.fehler > 0, String(nach.fehler));
  pruefe('Die Einwilligung wird eigens verlangt',
    /einwillig|zustimm|datenschutz/i.test(nach.text));
} else {
  console.log('  – Kein Absendeknopf gefunden');
}

/* ---------------------------------------------------------------- */
/* Abnahmekriterium 4 — quer über alle Filterseiten                  */
/* ---------------------------------------------------------------- */
console.log('\n6 · Kein Chip ohne Wirkung');
for (const pfad of ['/vorlagen', '/vergleich', '/hilfe', '/ratgeber']) {
  await seite.goto(BASIS + pfad, { waitUntil: 'networkidle' });
  const befund = await seite.evaluate(() => {
    const chips = [...document.querySelectorAll('.chip')];
    return {
      anzahl: chips.length,
      ohneZustand: chips.filter((c) => !c.hasAttribute('aria-pressed')).length,
      keineKnoepfe: chips.filter((c) => c.tagName !== 'BUTTON' && c.getAttribute('role') !== 'button').length,
    };
  });
  if (!befund.anzahl) { console.log(`  – ${pfad}: keine Chips`); continue; }
  pruefe(`${pfad}: alle ${befund.anzahl} Chips melden ihren Zustand`,
    befund.ohneZustand === 0, String(befund.ohneZustand));
  pruefe(`${pfad}: alle sind bedienbar`, befund.keineKnoepfe === 0, String(befund.keineKnoepfe));
}

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
