/**
 * Das Effekt-Studio — Kunststile am Ergebnisbildschirm.
 *
 * Das Modul stand als einziges noch auf „in Arbeit", mit der Begründung:
 * Der Anschluss steht, die Auswahl am Screen fehlt. Diese Probe misst die
 * Auswahl — und zwar am Ergebnis, nicht am Quelltext:
 *
 *   · Steht die Wahl überhaupt da, und ist „Ohne" darunter?
 *   · Ändert eine Wahl das Bild, das der Gast sieht?
 *   · Holt „Ohne" das Ausgangsbild zurück — bitgleich, nicht ähnlich?
 *   · Liegt auf der Box dasselbe Bild wie am Screen? (QR, Wand und Galerie
 *     zeigen die Datei, nicht den Screen — laufen die auseinander, bekommt
 *     der Gast ein anderes Bild mit nach Hause als das, das er gewählt hat.)
 *   · Bleibt es EINE Datei? Sieben Stile dürfen keine sieben Blätter machen.
 *
 * Voraussetzung: die Box läuft (npm run build && npm run server).
 *
 *   node tools/effekte-probe.mjs
 */

import { chromium } from 'playwright-core';
import { BASIS, alsBetreiber } from './betreiber.mjs';

let bestanden = 0;
let gefallen = 0;
const pruefe = (satz, wahr, zusatz = '') => {
  if (wahr) { bestanden++; console.log(`  ✓ ${satz}`); }
  else { gefallen++; console.log(`  ✗ ${satz}${zusatz ? ' — ' + zusatz : ''}`); }
};

/** Fingerabdruck eines Bildes: kurz genug für die Ausgabe, lang genug zum
    Unterscheiden. Vergleicht wird über die volle Länge, gezeigt wird das. */
const kurz = (text) => `${text.length}B/${text.slice(-24)}`;

const browser = await chromium.launch({
  ...(process.env.YOUBOOTH_CHROMIUM ? { executablePath: process.env.YOUBOOTH_CHROMIUM } : {}),
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const kontext = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  permissions: ['camera'],
});
const seite = await kontext.newPage();

console.log('\n1 · Die Box gibt die Stile frei');
const stand = await fetch(BASIS + '/api/settings').then((r) => r.json());
pruefe('Die Einstellungen kennen eine Liste freigegebener Stile',
  Array.isArray(stand?.effekte?.erlaubt), JSON.stringify(stand?.effekte));
pruefe('„Ohne" steht NICHT darin — es ist kein Stil, sondern dessen Fehlen',
  !(stand?.effekte?.erlaubt || []).includes('ohne'),
  JSON.stringify(stand?.effekte?.erlaubt));

/* Wie viele Dateien vorher auf der Box lagen — die Zahl muss nach einer
   Runde mit drei Stilwechseln um genau eins gewachsen sein. */
const vorher = (await fetch(BASIS + '/api/photos').then((r) => r.json())).length;

await seite.goto(BASIS + '/', { waitUntil: 'networkidle' });
await seite.waitForTimeout(1500);

console.log('\n2 · Eine Runde bis zum Ergebnis');
await seite.getByRole('button', { name: /jetzt starten/i }).click();
await seite.waitForTimeout(700);
/* Foto, nicht Streifen: eine Aufnahme statt vier — die Probe misst die
   Stilwahl, nicht die Geduld des Countdowns. */
await seite.locator('.art', { hasText: /foto/i }).first().click();
await seite.getByRole('button', { name: /los geht/i }).click();
/* Countdown plus Aufnahme plus Sichern. Lieber einmal zu lange warten als
   eine Probe, die auf einer langsamen Box grundlos rot wird. */
await seite.locator('.stile').waitFor({ state: 'visible', timeout: 30000 });

const stile = await seite.evaluate(() =>
  [...document.querySelectorAll('.stil')].map((e) => ({
    id: e.dataset.stil,
    name: (e.querySelector('.stil__name')?.textContent || '').trim(),
    hoch: Math.round(e.getBoundingClientRect().height),
    gewaehlt: e.classList.contains('gewaehlt'),
  }))
);
pruefe(`Die Stile stehen zur Wahl (${stile.length})`, stile.length >= 2,
  stile.map((s) => s.name).join(' · '));
pruefe('„Ohne" ist dabei und ist der Ausgangszustand',
  stile[0]?.id === 'ohne' && stile[0]?.gewaehlt === true,
  JSON.stringify(stile[0]));
pruefe('Kein Stilknopf ist kleiner als 44px',
  stile.every((s) => s.hoch >= 44),
  stile.map((s) => `${s.name}:${s.hoch}px`).join(', '));

console.log('\n3 · Eine Wahl ändert das Bild');
const erstesBlatt = (await fetch(BASIS + '/api/photos').then((r) => r.json()))
  .sort((a, b) => b.time - a.time)[0]?.name;
const original = await seite.locator('img.ergebnis').getAttribute('src');
pruefe('Es hängt ein Ergebnis am Screen',
  typeof original === 'string' && original.startsWith('data:image'),
  kurz(original || ''));

await seite.locator('.stil[data-stil="schwarzweiss"]').click();
/* Gewartet wird darauf, dass die Sperre wieder fällt — nicht auf eine
   feste Zeit. Wie lange gerechnet wird, hängt an der Kamera-Auflösung. */
await seite.locator('.stil[data-stil="schwarzweiss"]:not([disabled])').waitFor({ timeout: 30000 });
await seite.waitForTimeout(400);

const schwarzweiss = await seite.locator('img.ergebnis').getAttribute('src');
pruefe('Schwarzweiß zeigt ein anderes Bild als vorher',
  schwarzweiss !== original, kurz(schwarzweiss || ''));
pruefe('Und der gewählte Stil ist am Knopf zu sehen',
  await seite.locator('.stil[data-stil="schwarzweiss"].gewaehlt').isVisible());

/* Die eigentliche Prüfung, ob der Effekt gerechnet wurde und nicht nur ein
   anderes JPEG entstanden ist: In einem schwarzweißen Bild liegen R, G und B
   je Bildpunkt beieinander. Gemessen wird auf der Bildfläche selbst. */
const bunt = await seite.evaluate(async (quelle) => {
  const bild = await new Promise((fertig) => {
    const b = new Image();
    b.onload = () => fertig(b);
    b.src = quelle;
  });
  const f = document.createElement('canvas');
  f.width = bild.naturalWidth;
  f.height = bild.naturalHeight;
  const stift = f.getContext('2d');
  stift.drawImage(bild, 0, 0);
  const d = stift.getImageData(0, 0, f.width, f.height).data;
  let farbig = 0;
  let gezaehlt = 0;
  for (let i = 0; i < d.length; i += 4 * 97) {
    const spanne = Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    gezaehlt++;
    if (spanne > 24) farbig++;
  }
  return Math.round((farbig / gezaehlt) * 100);
}, schwarzweiss);
/* Nicht null Prozent: Der Rahmen des Blattes trägt weiter Amber, und das
   soll er — der Stil greift auf die Aufnahme, nicht auf die Gestaltung. */
pruefe(`Im Schwarzweiß-Bild ist fast nichts mehr bunt (${bunt} %)`, bunt < 12);

console.log('\n4 · „Ohne" holt das Ausgangsbild zurück');
await seite.locator('.stil[data-stil="ohne"]').click();
await seite.locator('.stil[data-stil="ohne"]:not([disabled])').waitFor({ timeout: 30000 });
await seite.waitForTimeout(400);
const zurueck = await seite.locator('img.ergebnis').getAttribute('src');
pruefe('Ohne zeigt wieder genau das Ausgangsbild — bitgleich, nicht ähnlich',
  zurueck === original, kurz(zurueck || ''));

console.log('\n5 · Die Box zeigt dasselbe wie der Screen');
await seite.locator('.stil[data-stil="sepia"]').click();
await seite.locator('.stil[data-stil="sepia"]:not([disabled])').waitFor({ timeout: 30000 });
await seite.waitForTimeout(600);
const sepia = await seite.locator('img.ergebnis').getAttribute('src');

const dateien = await fetch(BASIS + '/api/photos').then((r) => r.json());
const neueste = dateien.sort((a, b) => b.time - a.time)[0];
const abgelegt = await seite.evaluate(async (pfad) => {
  const blob = await fetch(pfad).then((r) => r.blob());
  return await new Promise((fertig) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result));
    leser.readAsDataURL(blob);
  });
}, neueste?.url || '');

pruefe('Die Datei auf der Box ist Bit für Bit das Bild vom Screen',
  abgelegt === sepia, `Datei ${kurz(abgelegt)} · Screen ${kurz(sepia || '')}`);

console.log('\n6 · Eine Runde bleibt eine Datei');
pruefe(`Zwei Stilwechsel haben genau ein Blatt hinterlassen (${dateien.length - vorher})`,
  dateien.length - vorher === 1, `vorher ${vorher}, jetzt ${dateien.length}`);
/* Und der Name hat sich nicht geändert: Der QR-Code, den der Gast womöglich
   schon abfotografiert hat, zeigt auf diesen Namen. */
pruefe('Das Blatt behält seinen Namen über die Stilwechsel hinweg',
  neueste?.name === erstesBlatt, `${erstesBlatt} → ${neueste?.name}`);

console.log('\n7 · Während gerechnet wird, springt nichts weiter');
/* Auto-Weiter holt die Box vom Ergebnis in die Ausgabe. Wer gerade einen
   Stil gewählt hat, soll dessen Ergebnis noch sehen — sonst wählt er in
   eine Fläche, die im selben Moment verschwindet. */
/* Getippt und gemessen im selben Zug: Die Sperre muss stehen, BEVOR der
   Booth das erste Mal wartet — sonst tippt der Gast in der Sekunde, in der
   gerechnet wird, ein zweites Mal und stößt eine zweite Runde an. Über zwei
   Playwright-Aufrufe gemessen liefe die Probe der Rechnung hinterher und
   fiele je nach Bildgröße mal so und mal so aus. */
const beimRechnen = await seite.evaluate(() => {
  document.querySelector('.stil[data-stil="comic"]').click();
  return {
    gesperrt: [...document.querySelectorAll('.stil')].every((e) => e.disabled),
    laeuft: !!document.querySelector('.stil[data-stil="comic"].gewaehlt'),
  };
});
pruefe('Solange gerechnet wird, sind alle Stile gesperrt', beimRechnen.gesperrt);
pruefe('Und der angetippte Stil ist sofort als gewählt zu sehen', beimRechnen.laeuft);
await seite.locator('.stil[data-stil="comic"]:not([disabled])').waitFor({ timeout: 30000 });
pruefe('Danach steht der Booth immer noch beim Ergebnis, nicht in der Ausgabe',
  await seite.locator('.stile').isVisible());

console.log('\n8 · Der Betreiber entscheidet, was zur Wahl steht');
/* Die Freigabe ist kein Schmuck: Eine Trauung will keine Pop-Art auf dem
   Abzug. Geprüft wird der ganze Weg — schreiben, zurücklesen, und ob der
   Booth danach wirklich weniger anbietet. */
const sitzung = await alsBetreiber();
const zurueckgelegt = stand?.effekte?.erlaubt || [];

const geschrieben = await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({ effekte: { erlaubt: ['schwarzweiss', 'sepia', 'gibtesnicht'] } }),
});
pruefe('Die Box nimmt eine eingeschränkte Liste an', geschrieben.status === 200,
  String(geschrieben.status));

const nachher = await fetch(BASIS + '/api/settings').then((r) => r.json());
pruefe('Sie hat genau die zwei übernommen und den erfundenen Stil verworfen',
  JSON.stringify(nachher?.effekte?.erlaubt) === JSON.stringify(['schwarzweiss', 'sepia']),
  JSON.stringify(nachher?.effekte?.erlaubt));

const s3 = await kontext.newPage();
await s3.goto(BASIS + '/', { waitUntil: 'networkidle' });
await s3.waitForTimeout(1200);
await s3.getByRole('button', { name: /jetzt starten/i }).click();
await s3.waitForTimeout(600);
await s3.locator('.art', { hasText: /foto/i }).first().click();
await s3.getByRole('button', { name: /los geht/i }).click();
await s3.locator('.stile').waitFor({ state: 'visible', timeout: 30000 });
const engereWahl = await s3.evaluate(() =>
  [...document.querySelectorAll('.stil')].map((e) => e.dataset.stil)
);
pruefe('Der Booth bietet danach nur noch „Ohne" und die zwei freigegebenen an',
  JSON.stringify(engereWahl) === JSON.stringify(['ohne', 'schwarzweiss', 'sepia']),
  engereWahl.join(' · '));

console.log('\n9 · Freistellung vor dem Tuch');
/* Die Scheinkamera von Chromium liefert ein sattgrünes Bild — genau das,
   wofür ein Chroma-Key gebaut ist. Als Hintergrund kommt ein einfarbiges
   Magenta dahinter: Eine Farbe, die in keinem Kamerabild vorkommt, lässt
   sich hinterher zweifelsfrei zählen. */
const magenta = await seite.evaluate(() => {
  const f = document.createElement('canvas');
  f.width = 64;
  f.height = 64;
  const stift = f.getContext('2d');
  stift.fillStyle = '#ff00ff';
  stift.fillRect(0, 0, 64, 64);
  return f.toDataURL('image/png');
});

const freigestellt = await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    greenscreen: { enabled: true, key: '#00c800', similarity: 42, background: magenta },
    effekte: { erlaubt: zurueckgelegt },
  }),
});
pruefe('Die Box nimmt Tuchfarbe und Hintergrund an', freigestellt.status === 200,
  String(freigestellt.status));

const s4 = await kontext.newPage();
await s4.goto(BASIS + '/', { waitUntil: 'networkidle' });
await s4.waitForTimeout(1200);
await s4.getByRole('button', { name: /jetzt starten/i }).click();
await s4.waitForTimeout(600);
await s4.locator('.art', { hasText: /foto/i }).first().click();
await s4.getByRole('button', { name: /los geht/i }).click();
await s4.locator('.stile').waitFor({ state: 'visible', timeout: 30000 });
await s4.waitForTimeout(400);

const anteile = await s4.evaluate(async () => {
  const quelle = document.querySelector('img.ergebnis').src;
  const bild = await new Promise((fertig) => {
    const b = new Image();
    b.onload = () => fertig(b);
    b.src = quelle;
  });
  const f = document.createElement('canvas');
  f.width = bild.naturalWidth;
  f.height = bild.naturalHeight;
  const stift = f.getContext('2d');
  stift.drawImage(bild, 0, 0);
  const d = stift.getImageData(0, 0, f.width, f.height).data;
  let gruen = 0;
  let neu = 0;
  let gezaehlt = 0;
  for (let i = 0; i < d.length; i += 4 * 31) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    gezaehlt++;
    if (g > 90 && g > r * 1.6 && g > b * 1.6) gruen++;
    if (r > 150 && b > 150 && g < r * 0.6) neu++;
  }
  return { gruen: Math.round((gruen / gezaehlt) * 100), neu: Math.round((neu / gezaehlt) * 100) };
});
pruefe(`Das Tuch ist aus dem Bild verschwunden (noch ${anteile.gruen} % grün)`,
  anteile.gruen < 10);
pruefe(`Der neue Hintergrund steht dahinter (${anteile.neu} % der Fläche)`,
  anteile.neu > 25);

// Was vorher galt, gilt nachher wieder — eine Probe hinterlässt keine Box,
// die anders eingestellt ist als vorgefunden.
await sitzung.anDieBox('/api/settings', {
  method: 'PUT',
  body: JSON.stringify({
    effekte: { erlaubt: zurueckgelegt },
    greenscreen: {
      enabled: stand?.greenscreen?.enabled ?? false,
      key: stand?.greenscreen?.key ?? '#00c800',
      similarity: stand?.greenscreen?.similarity ?? 42,
      background: stand?.greenscreen?.background ?? null,
    },
  }),
});

await browser.close();
console.log(`\n${bestanden} bestanden, ${gefallen} gefallen\n`);
process.exit(gefallen ? 1 : 0);
