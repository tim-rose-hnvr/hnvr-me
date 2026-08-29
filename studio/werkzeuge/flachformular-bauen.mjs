/* Baut ein flaches Formular — eines ohne Formularfelder, wie es aus einem
   Textprogramm kommt oder aus dem Scanner. Nur Linien, Kästchen und Text.

   Genau das ist der Fall, für den `felderkennen.js` gebaut ist, und ohne so
   eine Datei ließe sich die Erkennung nicht prüfen. Die Datei liegt neben dem
   Beispiel und wird vom Prüflauf geladen.

   Aufruf:  node werkzeuge/flachformular-bauen.mjs */

import { writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const { PDFDocument, StandardFonts, rgb } = await import('../fremd/pdf-lib.mjs');

const hier = dirname(fileURLToPath(import.meta.url));
const A4 = [595.28, 841.89];
const dok = await PDFDocument.create();
const normal = await dok.embedFont(StandardFonts.Helvetica);
const fett = await dok.embedFont(StandardFonts.HelveticaBold);
const tinte = rgb(0.08, 0.1, 0.11);
const strich = rgb(0.35, 0.4, 0.42);

const s = dok.addPage(A4);
s.drawText('Anmeldung zur Sitzung', { x: 56, y: 780, size: 17, font: fett, color: tinte });
s.drawText('Bitte ausfuellen und unterschrieben zurueckgeben.', { x: 56, y: 760, size: 9.5, font: normal, color: strich });

/* Ausfuelllinien mit Beschriftung links — der haeufigste Fall. */
const linie = (y, beschriftung, von = 150, bis = 539) => {
  s.drawText(beschriftung, { x: 56, y: y + 3, size: 10, font: normal, color: tinte });
  s.drawLine({ start: { x: von, y }, end: { x: bis, y }, thickness: 0.8, color: strich });
};
linie(710, 'Name:');
linie(680, 'Vorname:');
linie(650, 'Gremium:');
linie(620, 'E-Mail:');

/* Ankreuzfelder — Quadrate mit Text daneben. */
const kaestchen = (x, y, beschriftung) => {
  s.drawRectangle({ x, y, width: 12, height: 12, borderWidth: 0.9, borderColor: strich });
  s.drawText(beschriftung, { x: x + 18, y: y + 2.5, size: 10, font: normal, color: tinte });
};
s.drawText('Teilnahme:', { x: 56, y: 578, size: 10, font: normal, color: tinte });
kaestchen(150, 575, 'in Praesenz');
kaestchen(280, 575, 'per Zuschaltung');
kaestchen(430, 575, 'verhindert');

/* Ein Rahmen fuer mehrzeiligen Text. */
s.drawText('Anmerkungen:', { x: 56, y: 528, size: 10, font: normal, color: tinte });
s.drawRectangle({ x: 150, y: 450, width: 389, height: 82, borderWidth: 0.9, borderColor: strich });

/* Eine Tabelle mit Inhalt — sie darf NICHT als Feld gelten. Das ist die
   Probe darauf, dass die Erkennung Layout von Formular unterscheidet. */
s.drawText('Bisherige Sitzungen', { x: 56, y: 410, size: 11, font: fett, color: tinte });
const zeilen = [['12.03.2026', 'Hauptausschuss', 'anwesend'],
                ['09.04.2026', 'Bauausschuss', 'entschuldigt'],
                ['14.05.2026', 'Hauptausschuss', 'anwesend']];
let y = 390;
for (const zeile of zeilen) {
  s.drawRectangle({ x: 56, y: y - 4, width: 483, height: 20, borderWidth: 0.7, borderColor: strich });
  zeile.forEach((text, i) => s.drawText(text, { x: 62 + i * 160, y: y + 2, size: 9.5, font: normal, color: tinte }));
  y -= 20;
}

/* Unterschriftszeile — sie soll als Unterschriftsfeld erkannt werden. */
s.drawText('Ort, Datum:', { x: 56, y: 260, size: 10, font: normal, color: tinte });
s.drawLine({ start: { x: 150, y: 257 }, end: { x: 300, y: 257 }, thickness: 0.8, color: strich });
s.drawText('Unterschrift:', { x: 330, y: 260, size: 10, font: normal, color: tinte });
s.drawLine({ start: { x: 420, y: 257 }, end: { x: 539, y: 257 }, thickness: 0.8, color: strich });

dok.setTitle('Anmeldung zur Sitzung');
dok.setProducer('PDF Studio');
dok.setSubject('Flaches Formular fuer die Pruefung der Felderkennung');

const bytes = await dok.save();
const ziel = resolve(hier, '..', 'beispiel', 'flachformular.pdf');
await writeFile(ziel, bytes);
console.log(`geschrieben: ${ziel} (${(bytes.length / 1024).toFixed(1)} kB, ${dok.getPageCount()} Seite)`);
