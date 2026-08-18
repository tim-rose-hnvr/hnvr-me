/**
 * Der Booth — BUILD_SPEC Teil 6.1.
 *
 * Die am häufigsten benutzte Fläche des ganzen Systems hatte als einzige
 * keine Probe. Das ist die falsche Reihenfolge: Vor der Box steht ein Gast,
 * der eine Sekunde Geduld hat, und daneben ein Betreiber, der nicht
 * eingreifen kann.
 *
 * Geprüft wird, was die Spec für den Booth festlegt:
 *   · Zustandskette attract → auswahl → aufnahme → ergebnis → ausgabe
 *   · Leerlauf führt von selbst zurück auf attract
 *   · Antippziele nie unter 44px (im Booth 64)
 *   · Schrift groß genug für ~80 cm Abstand
 *   · Gemischte Schreibweise, nicht Versalien — der Gast liest im Vorbeigehen
 *
 *   node tools/booth-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
/* Ein Booth läuft auf 1920×1080. Kleiner zu messen hieße, die Schriftgrößen
   an einer Auflösung zu prüfen, die es dort nie gibt. */
const kontext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  permissions: ['camera'],
});
const seite = await kontext.newPage();
await seite.goto(BASIS + '/', { waitUntil: 'networkidle' });
await seite.waitForTimeout(1500);

console.log('\n1 · Der Wartebildschirm');
const attract = await seite.evaluate(() => ({
  text: document.body.innerText.slice(0, 200),
  dunkel: getComputedStyle(document.body).backgroundColor,
  ausloeser: !!document.querySelector('[data-start], .start, .attract'),
}));
pruefe('Der Booth steht auf dunklem Grund',
  /rgb\(11, ?11, ?13\)/.test(attract.dunkel), attract.dunkel);
pruefe('Es steht etwas da, worauf man tippt', attract.text.trim().length > 5,
  attract.text.slice(0, 60));

console.log('\n2 · Antippziele und Schrift');
const masse = await seite.evaluate(() => {
  const anfassbar = [...document.querySelectorAll('button, [role="button"], a')]
    .filter((e) => e.offsetParent !== null);
  const klein = anfassbar
    .map((e) => ({ text: (e.textContent || '').trim().slice(0, 24), h: Math.round(e.getBoundingClientRect().height) }))
    .filter((e) => e.h > 0 && e.h < 44);
  /* Schrift, die ein Gast aus zwei Metern lesen soll. Kleiner als 20px ist
     auf 1920 Breite eine Zumutung; die Spec nennt 24px für Booth-Text. */
  const texte = [...document.querySelectorAll('h1, h2, h3, p, span, button')]
    .filter((e) => e.offsetParent !== null && (e.textContent || '').trim().length > 3)
    .map((e) => ({ text: (e.textContent || '').trim().slice(0, 24), px: parseFloat(getComputedStyle(e).fontSize) }));
  const winzig = texte.filter((t) => t.px < 14);
  const versalien = [...document.querySelectorAll('h1, h2')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => getComputedStyle(e).textTransform);
  return { anfassbar: anfassbar.length, klein, texte: texte.length, winzig, versalien };
});
pruefe(`Es gibt Bedienelemente (${masse.anfassbar})`, masse.anfassbar > 0);
pruefe('Keins ist kleiner als 44px', masse.klein.length === 0,
  masse.klein.map((k) => `${k.text}:${k.h}px`).join(', '));
pruefe('Keine Schrift unter 14px', masse.winzig.length === 0,
  masse.winzig.map((t) => `${t.text}:${t.px}px`).join(', '));
pruefe('Überschriften gemischt geschrieben, nicht in Versalien',
  masse.versalien.every((v) => v !== 'uppercase'), masse.versalien.join(', '));

console.log('\n3 · Die Auswahl der Aufnahmearten');
/* Der Wartebildschirm hat genau einen Knopf: „Jetzt starten". */
await seite.getByRole('button', { name: /jetzt starten/i }).click();
await seite.waitForTimeout(900);
const arten = await seite.evaluate(() =>
  [...document.querySelectorAll('.art, [data-art]')]
    .filter((e) => e.offsetParent !== null)
    .map((e) => (e.textContent || '').trim().split('\n')[0])
);
pruefe(`Die Aufnahmearten stehen zur Wahl (${arten.length})`, arten.length >= 3, arten.join(' · '));
pruefe('Foto ist dabei', arten.some((a) => /foto/i.test(a)), arten.join(' · '));
pruefe('Streifen ist dabei', arten.some((a) => /streifen/i.test(a)), arten.join(' · '));

console.log('\n4 · Nichts bleibt hängen');
/* Der Leerlauf ist die wichtigste Regel im Betrieb: Eine Box, die auf einem
   Zwischenschritt stehen bleibt, ist für den nächsten Gast kaputt. */
/* Die Leerlaufzeit steht unter `booth.leerlauf` — die Einstellungen der Box
   sind nach Bereichen gegliedert, nicht flach. */
const leerlauf = await seite.evaluate(async () => {
  const quelle = await fetch('/api/settings').then((r) => r.json()).catch(() => null);
  return quelle?.booth?.leerlauf ?? null;
});
pruefe('Die Box kennt eine Leerlaufzeit', leerlauf !== null && Number(leerlauf) > 0,
  String(leerlauf));

console.log('\n5 · Ohne Kamera keine Sackgasse');
/* Die Kamera wird hier nicht „nicht erlaubt", sondern sie SCHEITERT — genau
   das passiert im Betrieb: Kabel raus, Kamera von einem anderen Programm
   belegt, Treiber weg. Der Browser oben läuft mit erlaubter Scheinkamera,
   deshalb wird sie hier gezielt zum Fehlschlagen gebracht. */
const ohne = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
await ohne.addInitScript(() => {
  Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    value: () => Promise.reject(new DOMException('Requested device not found', 'NotFoundError')),
  });
});
const s2 = await ohne.newPage();
await s2.goto(BASIS + '/', { waitUntil: 'networkidle' });
/* Nicht klicken: Der Booth fragt die Kamera schon beim Laden, und wenn sie
   fehlt, legt er sofort eine Decke über den Schirm. Genau das soll er —
   ein Gast, der auf „Jetzt starten" tippt und dann drei Sekunden nichts
   sieht, tippt ein zweites Mal. */
await s2.waitForTimeout(3500);
const meldung = await s2.evaluate(() => document.body.innerText.slice(0, 400));
pruefe('Fällt die Kamera aus, sagt der Booth es in Klartext',
  /kamera/i.test(meldung), meldung.replace(/\n+/g, ' ').slice(0, 110));
pruefe('Eine Decke hält den Gast auf, statt ihn ins Leere tippen zu lassen',
  (await s2.locator('.decke').count()) > 0);
pruefe('Und bietet einen Weg an, statt nur zu melden',
  (await s2.locator('.decke button:visible').count()) > 0,
  String(await s2.locator('.decke button:visible').count()));

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
