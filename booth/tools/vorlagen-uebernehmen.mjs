/**
 * Übernimmt den Vorlagenkatalog aus der Fassung 1.30 in unser Modell.
 *
 *   node tools/vorlagen-uebernehmen.mjs <pfad-zu-vorlagen-paket.json> [<pfad-zu-server.js>]
 *
 * Der Katalog dort besteht aus vier Töpfen — Zellen, drei feste Textplätze,
 * eingefügte Bilder, ein QR — und wird hier auf unsere eine Feldliste
 * abgebildet. Die Reihenfolge der Liste IST die Ebene; deshalb wird nach `z`
 * sortiert, bevor geschrieben wird.
 *
 * Zwei Dinge werden dabei bewusst umgerechnet:
 *
 *  1. Dort sitzt ein Text auf seiner MITTE (x/y als Ankerpunkt). Bei uns hat
 *     jedes Feld einen Kasten. Aus dem Anker wird deshalb ein Kasten, dessen
 *     senkrechte Mitte auf demselben Punkt liegt — gezeichnet wird gleich.
 *  2. Dort staucht ein zu langer Text auf die Blattbreite, statt umzubrechen.
 *     Das bleibt so (`umbruch: false`): Ein Umbruch schöbe auf einem gekauften
 *     Blatt alles darunter nach unten.
 *
 * Geschrieben wird `src/daten/vorlagen-katalog.json`. Die Hintergrundbilder
 * liegen bereits unter `public/vorlagen/`.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const ZIEL = path.join(HIER, '..', 'src', 'daten', 'vorlagen-katalog.json');

const paketPfad = process.argv[2];
const serverPfad = process.argv[3];
if (!paketPfad) {
  console.error('Aufruf: node tools/vorlagen-uebernehmen.mjs <vorlagen-paket.json> [server.js]');
  process.exit(2);
}

/** Aus dem Textanker der alten Fassung einen Kasten machen. */
function textFeld(schluessel, konf, inhalt, blattHoehe) {
  const groesse = Number(konf.size) || 40;
  const halbe = (groesse * 0.72) / blattHoehe;
  return {
    id: 't-' + schluessel,
    art: 'text',
    // Waagerecht bleibt der Anker die Mitte: Kasten über die Blattbreite,
    // mittig ausgerichtet. So sitzt der Text auf demselben Punkt wie vorher.
    x: 0.06,
    y: Math.max(0, konf.y - halbe),
    b: 0.88,
    h: halbe * 2,
    text: inhalt,
    groesse,
    gewicht: konf.bold ? 700 : 400,
    schrift: konf.font === 'sans' ? 'sans' : konf.font === 'display' ? 'display' : 'serif',
    ausrichtung: 'mitte',
    farbe: konf.color || undefined,
    umbruch: false,
    z: konf.z ?? 20,
  };
}

function uebernehmeVorlage(t) {
  const layout = t.layout || {};
  const format =
    t.format && typeof t.format === 'string'
      ? t.format
      : t.kind === 'strip'
        ? 'streifen-2x6'
        : 'postkarte-4x6';
  const blattHoehe = format === 'postkarte-4x6' ? 1200 : format === 'quadrat-4x4' ? 1200 : 1800;

  const felder = [];

  (layout.cells || []).forEach((c, i) => {
    felder.push({
      id: 'z' + i,
      art: 'bild',
      x: c.x,
      y: c.y,
      b: c.w,
      h: c.h,
      dreh: c.r || undefined,
      schatten: c.schatten || undefined,
      rahmen: c.rahmen || undefined,
      rahmenB: c.rahmenB || undefined,
      z: c.z ?? 10 + i,
    });
  });

  ['title', 'line1', 'line2'].forEach((k, i) => {
    const konf = layout.texts && layout.texts[k];
    const inhalt = t[k];
    if (!konf || !inhalt) return;
    const feld = textFeld(k, konf, inhalt, blattHoehe);
    feld.z = konf.z ?? 20 + i;
    felder.push(feld);
  });

  (layout.images || []).forEach((im, i) => {
    felder.push({
      id: 'b' + i,
      art: 'bilddatei',
      x: im.x,
      y: im.y,
      b: im.w,
      h: im.h,
      dreh: im.r || undefined,
      quelle: im.src,
      z: im.z ?? 30 + i,
    });
  });

  if (layout.qr) {
    felder.push({
      id: 'qr',
      art: 'qr',
      x: layout.qr.x,
      y: layout.qr.y,
      b: layout.qr.s,
      h: layout.qr.s,
      quelle: layout.qr.inhalt || layout.qr.text || '',
      z: layout.qr.z ?? 40,
    });
  }

  (layout.extras || []).forEach((e, i) => {
    const gemein = {
      id: 'e' + i,
      x: e.x,
      y: e.y,
      b: e.w,
      h: e.h,
      dreh: e.r || undefined,
      z: e.z ?? 50 + i,
    };
    if (e.art === 'form') {
      felder.push({
        ...gemein,
        art: 'flaeche',
        figur: e.figur === 'ellipse' ? 'ellipse' : e.figur === 'linie' ? 'linie' : 'rechteck',
        farbe: e.fill || undefined,
        linie: e.stroke || undefined,
        linienstaerke: e.strichB || undefined,
        radius: e.radius || undefined,
        schatten: e.schatten || undefined,
      });
    } else {
      // Gästedaten (Umfrageantwort, Unterschrift) haben bei uns noch keinen
      // eigenen Platz — sie kommen als Text mit, damit nichts verlorengeht.
      felder.push({
        ...gemein,
        art: 'text',
        text: e.inhalt || '',
        groesse: e.size || 30,
        gewicht: e.bold ? 700 : 400,
        schrift: e.font === 'sans' ? 'sans' : 'serif',
        ausrichtung: e.align === 'left' ? 'links' : e.align === 'right' ? 'rechts' : 'mitte',
        farbe: e.color || undefined,
        umbruch: false,
      });
    }
  });

  felder.sort((a, b) => (a.z ?? 0) - (b.z ?? 0));
  felder.forEach((f) => delete f.z);

  return {
    id: t.id,
    name: String(t.name || '').replace(/\s+/g, ' ').trim(),
    format,
    art: t.kind === 'strip' ? 'streifen' : 'foto',
    aufnahmen: Math.max(1, Number(t.shots) || (layout.cells || []).length || 1),
    papier: t.bg || '#ffffff',
    tinte: t.fg || '#17171c',
    akzent: t.accent || '#6b6355',
    hintergrund: t.bgImage || undefined,
    ecken: t.rounded || undefined,
    felder,
  };
}

/* --- Einlesen ------------------------------------------------------- */

const paket = JSON.parse(readFileSync(paketPfad, 'utf8'));
let eingebaut = [];

if (serverPfad && existsSync(serverPfad)) {
  // Die 19 eingebauten Vorlagen stehen als Literal im Server. Sie haben kein
  // `layout` — ihre Zellen rechnete der Booth selbst aus. Sie werden hier
  // NICHT übernommen: unsere vier eigenen decken dieselben Fälle ab, und ein
  // Layout zu erfinden hieße raten.
  const text = readFileSync(serverPfad, 'utf8');
  const treffer = text.match(/const DEFAULT_TEMPLATES = (\[[\s\S]*?\n\];)/);
  if (treffer) eingebaut = eval(treffer[1]);
}

/* ---------- Was NICHT mitkommt ----------
   Die acht `eigen-*`-Blätter sind selbst gezeichnete Vorlagen der Fassung
   1.30. In ihre Hintergrundbilder ist ein Schriftzug eingebrannt — und zwar
   der ALTE Produktname. Ein Werkzeug kann Dateien umbenennen, aber keine
   Pixel; die Bilder stammen aus der Zeit davor. Sie zu übernehmen hieße,
   einen fremden Namen auf die Abzüge der Gäste zu drucken.

   Sie kommen wieder, sobald sie in unserer Gestaltung neu gezeichnet sind —
   dann aus unserem Code, nicht als Bilddatei mit eingebranntem Text. */
const AUSGESCHLOSSEN = /^eigen-/;
const weggelassen = paket.filter((t) => AUSGESCHLOSSEN.test(t.id));
const katalog = paket.filter((t) => !AUSGESCHLOSSEN.test(t.id)).map(uebernehmeVorlage);

/* --- Prüfen --------------------------------------------------------- */

const fehler = [];
for (const v of katalog) {
  if (!v.felder.some((f) => f.art === 'bild')) fehler.push(v.id + ': kein Bildfeld');
  for (const f of v.felder) {
    for (const k of ['x', 'y', 'b', 'h']) {
      if (typeof f[k] !== 'number' || !Number.isFinite(f[k])) fehler.push(v.id + ': ' + f.id + '.' + k);
    }
    if (f.art === 'text') {
      // Der Kasten eines Textes ist nur Rechenhilfe: gezeichnet wird auf
      // seiner Mitte. Ein Text ganz unten am Blatt hat deshalb einen Kasten,
      // der überhängt — das ist richtig so. Geprüft wird die MITTE.
      const mx = f.x + f.b / 2, my = f.y + f.h / 2;
      if (mx < 0 || mx > 1 || my < 0 || my > 1) {
        fehler.push(v.id + ': ' + f.id + ' sitzt neben dem Blatt (' + mx.toFixed(3) + ' / ' + my.toFixed(3) + ')');
      }
    } else if (f.x + f.b > 1.02 || f.y + f.h > 1.02) {
      fehler.push(v.id + ': ' + f.id + ' ragt über das Blatt (' + f.x + '+' + f.b + ' / ' + f.y + '+' + f.h + ')');
    }
  }
  if (v.hintergrund && !existsSync(path.join(HIER, '..', 'public', v.hintergrund))) {
    fehler.push(v.id + ': Hintergrundbild fehlt — ' + v.hintergrund);
  }
}

writeFileSync(ZIEL, JSON.stringify(katalog, null, 1) + '\n');

const formate = {};
katalog.forEach((v) => (formate[v.format] = (formate[v.format] || 0) + 1));

console.log('Übernommen: ' + katalog.length + ' Vorlagen');
console.log('Formate:    ' + Object.entries(formate).map(([k, n]) => k + ' ' + n).join(' · '));
console.log('Felder:     ' + katalog.reduce((s, v) => s + v.felder.length, 0));
console.log('Eingebaute im Server gefunden: ' + eingebaut.length + ' (bewusst nicht übernommen)');
console.log('Weggelassen: ' + weggelassen.length + ' eigene Blätter mit eingebranntem Schriftzug');
console.log('Geschrieben: ' + path.relative(process.cwd(), ZIEL));
if (fehler.length) {
  console.error('\nFEHLER (' + fehler.length + '):');
  fehler.slice(0, 20).forEach((f) => console.error('  · ' + f));
  process.exit(1);
}
console.log('Geprüft: alle Felder liegen auf dem Blatt, alle Hintergründe sind da.');
