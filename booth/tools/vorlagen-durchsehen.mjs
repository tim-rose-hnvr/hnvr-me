/**
 * Jede Vorlage einmal wirklich zeichnen — messen statt hoffen.
 *
 *   npm run dev            (in einem zweiten Fenster)
 *   node tools/vorlagen-durchsehen.mjs [--schuesse <ordner>]
 *
 * Warum das ein Werkzeug ist und keine Sichtprüfung: Der Katalog hat 63
 * Blätter. Ein falsch umgerechnetes Feld fällt beim Durchklicken nicht auf —
 * es fällt dem Betreiber auf, wenn der Drucker es ausgibt. Geprüft wird
 * deshalb an der laufenden Oberfläche, mit demselben Renderer, der druckt:
 *
 *   · Zeichnet die Vorlage überhaupt, ohne Ausnahme?
 *   · Kommt der Hintergrund an (bei Vorlagen, die einen haben)?
 *   · Liegt jedes Bildfeld auf dem Blatt und ist groß genug zum Sehen?
 *   · Steht Text im Blatt statt daneben?
 *   · Ist das Blatt am Ende mehr als eine Farbe — also nicht leer?
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const BROWSER = process.env.PLAYWRIGHT_CHROMIUM || '/opt/pw-browsers/chromium';
const ADRESSE = process.env.BOOTH_URL || 'http://localhost:4400';
const schuesseIndex = process.argv.indexOf('--schuesse');
const schuesse = schuesseIndex > -1 ? process.argv[schuesseIndex + 1] : null;
if (schuesse) mkdirSync(schuesse, { recursive: true });

const browser = await chromium.launch({ executablePath: BROWSER });
const seite = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const seitenfehler = [];
seite.on('pageerror', (e) => seitenfehler.push(String(e).slice(0, 200)));

await seite.goto(ADRESSE + '/editor.html', { waitUntil: 'networkidle' });
await seite.waitForTimeout(600);

const befunde = await seite.evaluate(async () => {
  const { alleVorlagen } = await import('/src/vorlagen.ts');
  const { ladeZubehoer, zeichneVorlage, werteJetzt } = await import('/src/vorlage.ts');
  const { qrBild } = await import('/src/ausgabe.ts');
  const { formatVon } = await import('/src/formate.ts');

  // Muster: vier unterscheidbare Flächen, damit ein leeres Bildfeld auffällt.
  const muster = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad'].map((farbe) => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 960;
    const s = c.getContext('2d');
    s.fillStyle = farbe;
    s.fillRect(0, 0, c.width, c.height);
    return c;
  });

  const werte = werteJetzt('Hochzeit Lena & Jonas', 'Box #2', 128);
  const aus = [];

  for (const v of alleVorlagen()) {
    const befund = { id: v.id, name: v.name, format: v.format, mangel: [] };
    try {
      const zubehoer = await ladeZubehoer(v, werte, qrBild);
      if (v.hintergrund && !zubehoer.hintergrund) befund.mangel.push('Hintergrund fehlt');

      const blatt = zeichneVorlage(v, muster, werte, zubehoer);
      const masse = formatVon(v.format);
      if (blatt.width !== masse.breite || blatt.height !== masse.hoehe) {
        befund.mangel.push(`Blattmaß ${blatt.width}×${blatt.height} statt ${masse.breite}×${masse.hoehe}`);
      }

      const stift = blatt.getContext('2d');
      const daten = stift.getImageData(0, 0, blatt.width, blatt.height).data;
      const toene = new Set();
      for (let i = 0; i < daten.length; i += 4 * 499) {
        toene.add(`${daten[i]},${daten[i + 1]},${daten[i + 2]}`);
      }
      befund.farbtoene = toene.size;
      if (toene.size < 3) befund.mangel.push('Blatt bleibt nahezu leer');

      // Jedes Bildfeld muss auch wirklich ein Muster tragen: in der Mitte des
      // Feldes nachsehen, ob eine der vier Musterfarben angekommen ist.
      const musterfarben = new Set(['192,57,43', '41,128,185', '39,174,96', '142,68,173']);
      v.felder
        .filter((f) => f.art === 'bild')
        .forEach((f, i) => {
          const x = Math.round((f.x + f.b / 2) * blatt.width);
          const y = Math.round((f.y + f.h / 2) * blatt.height);
          if (x < 0 || y < 0 || x >= blatt.width || y >= blatt.height) {
            befund.mangel.push(`Bildfeld ${i + 1} liegt neben dem Blatt`);
            return;
          }
          if (f.b * blatt.width < 40 || f.h * blatt.height < 40) {
            befund.mangel.push(`Bildfeld ${i + 1} ist kleiner als 40 px`);
          }
          if (f.dreh) return; // gedreht: die Mitte trifft nicht mehr sicher
          const p = stift.getImageData(x, y, 1, 1).data;
          if (!musterfarben.has(`${p[0]},${p[1]},${p[2]}`)) {
            befund.mangel.push(`Bildfeld ${i + 1} zeigt kein Foto`);
          }
        });

      v.felder
        .filter((f) => f.art === 'text' && (f.text || '').trim())
        .forEach((f, i) => {
          const mx = f.x + f.b / 2;
          const my = f.y + f.h / 2;
          if (mx < 0 || mx > 1 || my < 0 || my > 1) {
            befund.mangel.push(`Text ${i + 1} sitzt neben dem Blatt`);
          }
          if ((f.groesse ?? 40) < 8) befund.mangel.push(`Text ${i + 1} ist kleiner als 8 px`);
        });

      befund.bild = blatt.toDataURL('image/jpeg', 0.6);
    } catch (e) {
      befund.mangel.push('Ausnahme: ' + String(e && e.message ? e.message : e).slice(0, 120));
    }
    aus.push(befund);
  }
  return aus;
});

let schlecht = 0;
for (const b of befunde) {
  if (b.mangel.length) {
    schlecht++;
    console.log(`✗ ${b.id}  (${b.format})`);
    b.mangel.forEach((m) => console.log('    · ' + m));
  }
}

if (schuesse) {
  const { writeFileSync } = await import('node:fs');
  for (const b of befunde) {
    if (!b.bild) continue;
    writeFileSync(
      path.join(schuesse, b.id + '.jpg'),
      Buffer.from(b.bild.split(',')[1], 'base64')
    );
  }
  console.log(`\nBilder abgelegt: ${schuesse}`);
}

console.log(`\n${befunde.length} Vorlagen gezeichnet, ${befunde.length - schlecht} ohne Mangel.`);
if (seitenfehler.length) {
  console.log('Seitenfehler:');
  seitenfehler.slice(0, 5).forEach((f) => console.log('  · ' + f));
}

await browser.close();
process.exit(schlecht || seitenfehler.length ? 1 : 0);
