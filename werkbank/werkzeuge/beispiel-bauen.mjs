/* Erzeugt beispiel/beispiel.pdf — die Datei, die der Empfangsschirm anbietet.
   Aufruf: node werkzeuge/beispiel-bauen.mjs
   Nutzt die mitgelieferte pdf-lib, kein Netz nötig. */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PDFDocument, StandardFonts, rgb, PDFString, PDFName, PDFNumber } from '../fremd/pdf-lib.mjs';

const hier = dirname(fileURLToPath(import.meta.url));
const A4 = [595.28, 841.89];

const dok = await PDFDocument.create();
const normal = await dok.embedFont(StandardFonts.Helvetica);
const fett = await dok.embedFont(StandardFonts.HelveticaBold);
const tinte = rgb(0.08, 0.1, 0.11);
const leise = rgb(0.35, 0.4, 0.42);

function seite(titel) {
  const s = dok.addPage(A4);
  s.drawText('Muster & Partner', { x: 56, y: 780, size: 10, font: fett, color: leise });
  s.drawLine({ start: { x: 56, y: 770 }, end: { x: 539, y: 770 }, thickness: 0.7, color: leise });
  if (titel) s.drawText(titel, { x: 56, y: 726, size: 20, font: fett, color: tinte });
  return s;
}

function absatz(s, text, y, { size = 11, font = normal, farbe = tinte, breite = 483 } = {}) {
  const woerter = String(text).split(/\s+/);
  let zeile = '';
  let hoehe = y;
  for (const wort of woerter) {
    const versuch = zeile ? `${zeile} ${wort}` : wort;
    if (font.widthOfTextAtSize(versuch, size) > breite && zeile) {
      s.drawText(zeile, { x: 56, y: hoehe, size, font, color: farbe });
      hoehe -= size * 1.5;
      zeile = wort;
    } else zeile = versuch;
  }
  if (zeile) { s.drawText(zeile, { x: 56, y: hoehe, size, font, color: farbe }); hoehe -= size * 1.5; }
  return hoehe;
}

/* Seite 1 — Deckblatt mit personenbezogenen Angaben */
const s1 = seite('Vertragsentwurf — Sitzungstechnik');
let y = absatz(s1, 'Zwischen der Muster & Partner GmbH, Hauptstraße 12, 30159 Hannover, und dem Auftraggeber wird der folgende Vertrag über Lieferung und Betrieb einer Konferenzanlage geschlossen.', 686);
y = absatz(s1, 'Ansprechpartnerin: Dr. Ada Musterfrau, geboren am 14.03.1979', y - 8, { font: fett });
y = absatz(s1, 'E-Mail: ada.musterfrau@muster-partner.example · Telefon: +49 511 4567890', y);
y = absatz(s1, 'Bankverbindung: DE02 1203 0000 0000 2020 51 · USt-IdNr.: DE123456789', y);
y = absatz(s1, 'Der Auftragnehmer liefert acht Sprechstellen, zwei PTZ-Kameras, einen Raumserver sowie die Einmessung des Saals. Die Abnahme erfolgt nach einem Probelauf mit vollständiger Bestuhlung.', y - 14);
y = absatz(s1, 'Die Vergütung beträgt 84.500 EUR netto. Zahlbar in drei Raten: 30 Prozent bei Auftrag, 50 Prozent bei Lieferung, 20 Prozent nach Abnahme.', y - 8);

/* Seite 2 — Leistungsbeschreibung */
const s2 = seite('Leistungsbeschreibung');
y = 686;
for (const [kopf, text] of [
  ['Ton', 'Die Anlage regelt offene Mikrofone selbsttätig. Jede Verdopplung offener Mikrofone kostet drei Dezibel Reserve; die Höchstzahl folgt aus der Einmessung und liegt üblicherweise bei acht.'],
  ['Bild', 'Die Kameras fahren auf gelernte Plätze. Ein Wechsel geschieht frühestens nach zwei Sekunden Standzeit, Einwürfe unter anderthalb Sekunden werden übergangen.'],
  ['Abstimmung', 'Eine Abstimmung startet nur bei festgestellter Beschlussfähigkeit. Das Quorum wird beim Start eingefroren.'],
  ['Betrieb', 'Der Saal arbeitet ohne Internetverbindung. Lizenzen werden nicht im Netz abgerufen.'],
]) {
  s2.drawText(kopf, { x: 56, y, size: 12, font: fett, color: tinte });
  y = absatz(s2, text, y - 18) - 14;
}

/* Seite 3 — Formular */
const s3 = seite('Abnahmeprotokoll');
absatz(s3, 'Bitte vollständig ausfüllen und unterschrieben zurücksenden.', 690, { color: leise });
const formular = dok.getForm();

const beschriftungen = [
  ['name', 'Name der abnehmenden Person', 620],
  ['funktion', 'Funktion', 570],
  ['ort', 'Ort der Abnahme', 520],
  ['datum', 'Datum', 470],
];
for (const [feldname, beschriftung, hoehe] of beschriftungen) {
  s3.drawText(beschriftung, { x: 56, y: hoehe + 22, size: 10, font: normal, color: leise });
  const feld = formular.createTextField(feldname);
  feld.addToPage(s3, { x: 56, y: hoehe - 4, width: 380, height: 24, borderWidth: 0.8, borderColor: leise, backgroundColor: rgb(0.97, 0.98, 0.98) });
}

s3.drawText('Mängel festgestellt', { x: 56, y: 424, size: 10, font: normal, color: leise });
const kasten = formular.createCheckBox('maengel');
kasten.addToPage(s3, { x: 56, y: 398, width: 18, height: 18, borderWidth: 0.8, borderColor: leise });

s3.drawText('Anlage vollständig geliefert', { x: 56, y: 358, size: 10, font: normal, color: leise });
const auswahl = formular.createDropdown('lieferung');
auswahl.addOptions(['ja', 'nein', 'mit Vorbehalt']);
auswahl.addToPage(s3, { x: 56, y: 330, width: 200, height: 22, borderWidth: 0.8, borderColor: leise });

/* Optionsfeld — damit die Werkbank auch diese Feldart zu sehen bekommt. */
s3.drawText('Abnahme erfolgt', { x: 300, y: 358, size: 10, font: normal, color: leise });
const optionen = formular.createRadioGroup('abnahme');
optionen.addOptionToPage('vollstaendig', s3, { x: 300, y: 332, width: 16, height: 16, borderWidth: 0.8, borderColor: leise });
optionen.addOptionToPage('unter_vorbehalt', s3, { x: 380, y: 332, width: 16, height: 16, borderWidth: 0.8, borderColor: leise });
s3.drawText('ganz', { x: 320, y: 336, size: 9, font: normal, color: tinte });
s3.drawText('vorbehaltlich', { x: 400, y: 336, size: 9, font: normal, color: tinte });

/* Mehrzeiliges Feld für Bemerkungen. */
s3.drawText('Bemerkungen', { x: 56, y: 300, size: 10, font: normal, color: leise });
const bemerkung = formular.createTextField('bemerkungen');
bemerkung.enableMultiline();
bemerkung.addToPage(s3, { x: 56, y: 260, width: 380, height: 34, borderWidth: 0.8, borderColor: leise, backgroundColor: rgb(0.97, 0.98, 0.98) });

s3.drawLine({ start: { x: 56, y: 200 }, end: { x: 300, y: 200 }, thickness: 0.8, color: leise });
s3.drawText('Ort, Datum, Unterschrift', { x: 56, y: 186, size: 9, font: normal, color: leise });

/* Ein echtes Unterschriftsfeld (/FT /Sig). pdf-lib hat dafür keine bequeme
   Schnittstelle, also wird das Widget von Hand angelegt und in das Formular
   eingehängt — so kann die Werkbank den Klick darauf beantworten. */
const formularWurzel = dok.getForm();
const kontext = dok.context;
const unterschriftsfeld = kontext.obj({
  Type: 'Annot',
  Subtype: 'Widget',
  FT: 'Sig',
  T: PDFString.of('unterschrift_abnahme'),
  Rect: kontext.obj([56, 206, 300, 250]),
  F: PDFNumber.of(4),
  P: s3.ref,
});
const feldVerweis = kontext.register(unterschriftsfeld);
s3.node.addAnnot(feldVerweis);
formularWurzel.acroForm.addField(feldVerweis);
s3.drawText('Diese Seite ist rechtsverbindlich zu unterschreiben.', { x: 56, y: 160, size: 10, font: normal, color: tinte });

/* Seite 4 — leere Trennseite */
const s4 = dok.addPage(A4);
s4.drawText('—', { x: 297, y: 420, size: 10, font: normal, color: rgb(0.85, 0.87, 0.88) });

/* Seite 5 — Querformat mit Tabelle */
const s5 = dok.addPage([841.89, 595.28]);
s5.drawText('Anlage 1 — Platzliste', { x: 56, y: 520, size: 18, font: fett, color: tinte });
const spalten = ['Platz', 'Funktion', 'Stimmrecht', 'Kamerapreset'];
spalten.forEach((kopf, i) => s5.drawText(kopf, { x: 56 + i * 180, y: 480, size: 11, font: fett, color: leise }));
const zeilen = [
  ['1', 'Vorsitz', 'ja', 'P1'], ['2', 'Stellvertretung', 'ja', 'P2'],
  ['3', 'Schriftführung', 'nein', 'P3'], ['4', 'Mitglied', 'ja', 'P4'],
  ['5', 'Mitglied', 'ja', 'P5'], ['6', 'Gast', 'nein', '—'],
];
zeilen.forEach((zeile, r) => {
  zeile.forEach((zelle, i) => s5.drawText(zelle, { x: 56 + i * 180, y: 450 - r * 26, size: 11, font: normal, color: tinte }));
});

/* Lesezeichen — von Hand, weil pdf-lib dafür keine Schnittstelle hat.
   Damit ist die Gliederungstafel der Werkbank am Beispiel prüfbar. */
const gliederungsPunkte = [
  ['Vertragsentwurf', s1.ref],
  ['Leistungsbeschreibung', s2.ref],
  ['Abnahmeprotokoll', s3.ref],
  ['Anlage 1 — Platzliste', s5.ref],
];
const wurzelVerweis = dok.context.nextRef();
const punktVerweise = gliederungsPunkte.map(() => dok.context.nextRef());
gliederungsPunkte.forEach(([titel, seitenVerweis], i) => {
  dok.context.assign(punktVerweise[i], dok.context.obj({
    Title: PDFString.of(titel),
    Parent: wurzelVerweis,
    Dest: dok.context.obj([seitenVerweis, PDFName.of('Fit')]),
    ...(i > 0 ? { Prev: punktVerweise[i - 1] } : {}),
    ...(i < gliederungsPunkte.length - 1 ? { Next: punktVerweise[i + 1] } : {}),
  }));
});
dok.context.assign(wurzelVerweis, dok.context.obj({
  Type: 'Outlines',
  First: punktVerweise[0],
  Last: punktVerweise.at(-1),
  Count: PDFNumber.of(gliederungsPunkte.length),
}));
dok.catalog.set(PDFName.of('Outlines'), wurzelVerweis);

dok.setTitle('Vertragsentwurf Sitzungstechnik');
dok.setAuthor('Dr. Ada Musterfrau');
dok.setSubject('Beispieldatei der Werkbank');
dok.setProducer('Werkbank — Beispielbauer');
dok.setCreationDate(new Date('2026-02-03T09:15:00Z'));

const bytes = await dok.save();
await mkdir(join(hier, '..', 'beispiel'), { recursive: true });
await writeFile(join(hier, '..', 'beispiel', 'beispiel.pdf'), bytes);
console.log(`beispiel/beispiel.pdf geschrieben — ${bytes.length} Bytes, ${dok.getPageCount()} Seiten`);
