#!/usr/bin/env node
/* Prüft das Einbaupaket „PDF Studio als App von hnvr.me“ — ohne Netz.

   Das Paket wird in einem Code eingebaut, den dieses Repository nicht kennt
   (Konsole und Hauptseite auf www.hnvr.me). Umso wichtiger, dass es in sich
   stimmt: dass jede Schnellaktion ein Werkzeug trifft, das es im Studio gibt,
   dass die Kachel dasselbe sagt wie das Manifest, dass keine Rechtestufe
   versprochen wird, die das Studio nicht durchsetzen kann, und dass die
   Kachel nichts aus dem Netz lädt.

   Aufruf: node hnvr-app/pruefe-app.mjs */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = join(HIER, '..');
const lies = (pfad) => readFile(join(WURZEL, pfad), 'utf8');

const manifest = JSON.parse(await lies('hnvr-app/manifest.json'));
const kachel = await lies('hnvr-app/kachel.html');
const symbol = await lies('hnvr-app/bereichssymbol.svg');
const werkzeuge = await lies('studio/app/einzelwerkzeuge.js');
const start = await lies('studio/app/main.js');
const einbetten = await lies('portal/skripte/app-einbetten.mjs');
const anmeldungDoku = await lies('doku/anmeldung-hnvr.md');

let gut = 0;
let schlecht = 0;
function pruefe(name, tun) {
  try { tun(); gut += 1; console.log(`  ✓ ${name}`); }
  catch (fehler) { schlecht += 1; console.log(`  ✗ ${name}\n      ${fehler.message}`); }
}

console.log('\n== Manifest ==');
pruefe('Pflichtangaben sind da', () => {
  for (const feld of ['id', 'fassung', 'name', 'anbieter', 'beschreibung', 'einstieg', 'bereich', 'rechte']) {
    assert.ok(manifest[feld] !== undefined && manifest[feld] !== '', `${feld} fehlt`);
  }
  assert.match(manifest.id, /^[a-z][a-z0-9-]*$/, 'id ist kein Kurzname');
});
pruefe('Der Einstieg ist www.hnvr.me/pdf-studio', () => {
  /* Alle Links auf hnvr.me — Kachel, Menüpunkt, Schnellaktionen — zeigen auf
     diese eine Adresse. Wohin sie weiterführt, steht in `weiterleitung`;
     zieht das Studio um, ändert sich nur die Weiterleitung, kein Link. */
  const url = new URL(manifest.einstieg);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.host, 'www.hnvr.me');
  assert.equal(url.pathname, manifest.weiterleitung.von);
  assert.equal(url.search, '', 'der Einstieg trägt keine Suche — die hängt die Weiterleitung an');
});
pruefe('Die Weiterleitung führt ins Studio, in der Hand der Konsole', () => {
  const url = new URL(manifest.weiterleitung.nach);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.pathname, '/studio/index.html');
  /* Mit `von=hnvr` trägt das Studio die Hand der Konsole (app/gestalt.js)
     und zeigt den Rückweg. Ohne wäre es das Atelier — ein anderes Haus. */
  assert.equal(url.searchParams.get('von'), 'hnvr', 'Weiterleitung ohne ?von=hnvr');
});
pruefe('Die Domain des Studios ist die, für die die Anmeldung eingerichtet wird', () => {
  /* Ein Studio auf einer anderen Domain landete bei einem Rücksprung, den
     hnvr.me nicht kennt — die Anmeldung schlüge mit 400 fehl. */
  const host = new URL(manifest.weiterleitung.nach).host;
  assert.ok(anmeldungDoku.includes(`https://${host}/api/hnvr/rueckkehr`), `${host} steht nicht in doku/anmeldung-hnvr.md`);
});
pruefe('Der Rückweg ist der, den das Einbetten setzt', () => {
  assert.equal(manifest.rueckweg.kopfzeile, 'studio-heimat');
  assert.ok(einbetten.includes(`'${manifest.rueckweg.ziel}'`), `app-einbetten.mjs setzt nicht ${manifest.rueckweg.ziel}`);
  assert.ok(einbetten.includes(`'${manifest.rueckweg.name}'`), `app-einbetten.mjs nennt nicht „${manifest.rueckweg.name}“`);
});

console.log('\n== Rechte ==');
pruefe('Nur Stufen, die das Studio durchsetzen kann: Ändern oder Keine', () => {
  /* Das Studio hat keinen Nur-Lese-Modus, und die Dateien liegen beim Nutzer.
     Eine Stufe „Lesen“ wäre ein Versprechen, das niemand hält. */
  assert.deepEqual([...manifest.rechte.stufen].sort(), ['aendern', 'keine']);
});
pruefe('Jede Standardrolle hat eine Stufe aus der Liste', () => {
  for (const rolle of ['inhaber', 'bearbeitung', 'nur-lesen']) {
    assert.ok(manifest.rechte.stufen.includes(manifest.rechte.standard[rolle]), `${rolle}: ${manifest.rechte.standard[rolle]}`);
  }
});

console.log('\n== Schnellaktionen ==');
const werkzeugIds = [...werkzeuge.matchAll(/^\s{4}id: '([a-z-]+)'/gm)].map((t) => t[1]);
for (const aktion of manifest.schnellaktionen) {
  pruefe(`„${aktion.beschriftung}“ trifft etwas, das es im Studio gibt`, () => {
    assert.ok(aktion.ziel.startsWith('?'), 'Ziel ist keine Suche an den Einstieg');
    const suche = new URLSearchParams(aktion.ziel.slice(1));
    const werkzeug = suche.get('werkzeug');
    const tun = suche.get('tun');
    assert.ok(werkzeug || tun, 'weder werkzeug noch tun');
    if (werkzeug) assert.ok(werkzeugIds.includes(werkzeug), `kein Werkzeug „${werkzeug}“ — da sind: ${werkzeugIds.join(', ')}`);
    if (tun) assert.ok(start.includes(`tun === '${tun}'`), `main.js kennt tun=${tun} nicht`);
    /* Zusammengesetzt wie in der Anleitung, auf den Einstieg. Die
       Weiterleitung hängt ihre eigene Suche an die mitgebrachte an
       (nachgemessen: /pdf-studio?x=1 → …?x=1&von=hnvr) — am Ziel stehen also
       beide. Nachgestellt wie Wix es tut: */
    const ganz = new URL(manifest.einstieg);
    for (const [k, v] of suche) ganz.searchParams.set(k, v);
    assert.equal(ganz.pathname, manifest.weiterleitung.von);
    const ziel = new URL(manifest.weiterleitung.nach);
    const angekommen = new URL(`${ziel.origin}${ziel.pathname}${ganz.search}&${ziel.search.slice(1)}`);
    assert.equal(angekommen.searchParams.get('von'), 'hnvr');
    if (werkzeug) assert.equal(angekommen.searchParams.get('werkzeug'), werkzeug);
    if (tun) assert.equal(angekommen.searchParams.get('tun'), tun);
  });
}

console.log('\n== Tagesfokus und Kennzahlen ==');
pruefe('Leer, mit Absicht: der Server weiß nichts über die Dateien', () => {
  assert.deepEqual(manifest.tagesfokus, []);
  assert.deepEqual(manifest.kennzahlen, []);
});

console.log('\n== Bereichssymbol ==');
pruefe('24er-Raster, Strich in currentColor, keine feste Farbe', () => {
  assert.match(symbol, /viewBox="0 0 24 24"/);
  assert.match(symbol, /stroke="currentColor"/);
  assert.doesNotMatch(symbol, /#[0-9a-f]{3,6}/i, 'feste Farbe im Symbol');
  assert.equal(manifest.bereich.symbol, 'bereichssymbol.svg');
});

console.log('\n== Kachel ==');
pruefe('Sie sagt dasselbe wie das Manifest', () => {
  const ohneTags = kachel.replace(/<[^>]+>/g, ' ');
  for (const teil of [manifest.name, manifest.beschreibung, ...manifest.fakten]) {
    assert.ok(ohneTags.includes(teil), `„${teil}“ fehlt in der Kachel`);
  }
  assert.ok(kachel.includes(`data-app="${manifest.id}"`), 'data-app passt nicht');
});
pruefe('Ein Link, und der führt auf /pdf-studio', () => {
  /* Die Kachel steht auf www.hnvr.me selbst — der Weg genügt, und er gilt
     so auch auf einer Vorschau-Adresse der Site. */
  const ziele = [...kachel.matchAll(/href="([^"]+)"/g)].map((t) => t[1]);
  assert.deepEqual(ziele, [new URL(manifest.einstieg).pathname]);
});
pruefe('Nichts aus dem Netz: kein Skript, kein Stylesheet, keine Schrift, kein Bild', () => {
  for (const muster of [/<script/i, /<link/i, /@import/i, /@font-face/i, /url\(/i, /<img/i, /src=/i]) {
    assert.doesNotMatch(kachel, muster);
  }
});

/* Kontrast nach WCAG, aus den Farben, die in der Kachel stehen. */
const kanal = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const helligkeit = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
};
const kontrast = (a, b) => { const [x, y] = [helligkeit(a), helligkeit(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const werte = (block) => Object.fromEntries([...block.matchAll(/--(k-[a-z-]+): (#[0-9A-Fa-f]{6})/g)].map((t) => [t[1], t[2]]));
const hell = werte(kachel.slice(kachel.indexOf('.hnvr-app-kachel {'), kachel.indexOf('.hnvr-app-kachel--dunkel {')));
const dunkel = { ...hell, ...werte(kachel.slice(kachel.indexOf('.hnvr-app-kachel--dunkel {'), kachel.indexOf('.hnvr-app-kachel * {'))) };
for (const [name, satz] of [['hell', hell], ['dunkel', dunkel]]) {
  pruefe(`Kontrast ${name}: Titel, Text, Etikett, Preis je mindestens 4,5:1`, () => {
    for (const [vorne, hinten] of [['k-titel', 'k-grund'], ['k-text', 'k-grund'], ['k-leise', 'k-grund'], ['k-preis', 'k-preis-grund']]) {
      const k = kontrast(satz[vorne], satz[hinten]);
      assert.ok(k >= 4.5, `${vorne} auf ${hinten}: ${k.toFixed(2)}:1`);
    }
  });
}
pruefe('Auf Orange steht Tinte, nicht Weiß', () => {
  const regel = kachel.slice(kachel.indexOf('.hnvr-app-kachel__oeffnen {'));
  assert.match(regel.slice(0, regel.indexOf('}')), /color: #172124/);
  assert.ok(kontrast('#172124', '#FF7120') >= 4.5);
  assert.ok(kontrast('#FFFFFF', '#FF7120') < 4.5, 'Weiß auf Orange wäre lesbar — dann stimmt die Regel nicht mehr');
});

console.log(`\n${gut} bestanden, ${schlecht} gescheitert`);
process.exit(schlecht ? 1 : 0);
