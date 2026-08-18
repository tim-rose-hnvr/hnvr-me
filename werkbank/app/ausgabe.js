/* Ausgabe — das Arbeitsdokument als PDF schreiben.

   Zwei Wege:
   1. Unverändertes Gerüst (eine Quelle, ursprüngliche Reihenfolge, keine
      Schwärzung): das Original wird geöffnet und ergänzt. Formularfelder,
      Lesezeichen und Metadaten bleiben erhalten.
   2. Umgebautes Gerüst: Seiten werden in ein neues Dokument kopiert.
      Formularwerte werden dabei fest eingebrannt, weil die Feldstruktur
      beim Kopieren nicht mitwandert.

   Schwärzung rastert die betroffene Seite. Das entfernt den darunter
   liegenden Text wirklich — anders als ein schwarzes Rechteck darüber. */

import { zustand, farbeZuAnteilen, sage, sichereBytes, fremdWeg } from './kern.js';
import { quelleVon, holeSeite } from './dokument.js';
import { setzeZugaenglichkeit } from './barrierefrei.js';
import { legePlatzhalterAn, fuelleSignatur } from './signieren.js';
import { beschriftung as messwert } from './messen.js';

let pdflib = null;
export async function starteSchreiber() {
  if (!pdflib) pdflib = await import(fremdWeg('pdf-lib.mjs'));
  return pdflib;
}

/* Eine Seite muss gerastert werden, wenn geschwärzt wurde — oder wenn beim
   Ersetzen ausdrücklich verlangt wurde, dass der alte Text verschwindet. */
const GESCHWAERZT = (seitenId) => zustand.anmerkungen.some(
  (a) => a.seiteId === seitenId && (a.art === 'schwaerzen' || (a.art === 'ersatz' && a.rastern)));

export function istUnveraendertesGeruest() {
  if (zustand.quellen.size !== 1) return false;
  const quelle = [...zustand.quellen.values()][0];
  if (zustand.folge.length !== quelle.seitenzahl) return false;
  return zustand.folge.every((e, i) => e.index === i && e.drehung === 0)
    && !zustand.folge.some((e) => GESCHWAERZT(e.id));
}

/**
 * Baut das Ausgabedokument.
 * @param {{ seiten?: string[], formularEinbrennen?: boolean, rasterDichte?: number }} optionen
 */
export async function baueDokument(optionen = {}) {
  const { PDFDocument } = await starteSchreiber();
  const { seiten = null, formularEinbrennen = false, rasterDichte = 2 } = optionen;
  const folge = seiten ? zustand.folge.filter((e) => seiten.includes(e.id)) : zustand.folge;
  if (!folge.length) throw new Error('Keine Seite ausgewählt.');

  const vollstaendig = !seiten || seiten.length === zustand.folge.length;
  const einfacherWeg = vollstaendig && istUnveraendertesGeruest();

  let ziel;
  const versatzKarte = new Map();

  if (einfacherWeg) {
    const quelle = [...zustand.quellen.values()][0];
    ziel = await PDFDocument.load(quelle.bytes.slice(0), { ignoreEncryption: true });
    await schreibeFormular(ziel, { einbrennen: formularEinbrennen });
    folge.forEach((eintrag, i) => versatzKarte.set(eintrag.id, { seite: ziel.getPage(i), versatz: { x: 0, y: 0 } }));
  } else {
    ziel = await PDFDocument.create();
    const kopien = new Map();   // quelleId → geladenes PDFDocument
    for (const eintrag of folge) {
      const quelle = quelleVon(eintrag);
      if (!kopien.has(quelle.id)) {
        const roh = await PDFDocument.load(quelle.bytes.slice(0), { ignoreEncryption: true });
        await schreibeFormular(roh, { einbrennen: true });
        kopien.set(quelle.id, roh);
      }
      if (GESCHWAERZT(eintrag.id)) {
        const { seite, versatz } = await rastereSeite(ziel, eintrag, rasterDichte);
        versatzKarte.set(eintrag.id, { seite, versatz });
      } else {
        const [kopie] = await ziel.copyPages(kopien.get(quelle.id), [eintrag.index]);
        const seite = ziel.addPage(kopie);
        if (eintrag.drehung) {
          const { degrees } = pdflib;
          seite.setRotation(degrees((seite.getRotation().angle + eintrag.drehung) % 360));
        }
        versatzKarte.set(eintrag.id, { seite, versatz: { x: 0, y: 0 } });
      }
    }
    ziel.setTitle(zustand.eigenschaften?.titel || zustand.name.replace(/\.pdf$/i, ''));
  }

  await schreibeErkanntenText(ziel, folge, versatzKarte);
  /* Vor den Anmerkungen: die neuen Felder sollen unter den gezeichneten
     Sachen liegen, nicht darüber. */
  await legeNeueFelderAn(ziel, folge, versatzKarte);
  await maleAnmerkungen(ziel, folge, versatzKarte);
  ziel.setProducer('Werkbank');
  ziel.setModificationDate(new Date());

  if (zustand.zugang) {
    const gesetzt = setzeZugaenglichkeit(ziel, pdflib, zustand.zugang);
    if (gesetzt.length) sage(`Für die Barrierefreiheit gesetzt: ${gesetzt.join(', ')}`, { dauer: 6000 });
  }
  if (optionen.metadatenEntfernen) {
    ziel.setAuthor('');
    ziel.setCreator('');
    ziel.setSubject('');
    ziel.setKeywords([]);
    try { ziel.catalog.delete(pdflib.PDFName.of('Metadata')); } catch { /* nicht vorhanden */ }
  }

  /* Unterschreiben und Verschlüsseln schließen einander aus: qpdf schreibt
     die Datei neu, und danach passt kein Hashwert mehr. Lieber jetzt sagen
     als hinterher eine Datei mit kaputter Unterschrift abliefern. */
  if (optionen.signatur && (optionen.schutz?.benutzer || optionen.schutz?.besitzer)) {
    throw new Error('Unterschreiben und Kennwortschutz gehen nicht zusammen: '
      + 'die Verschlüsselung schreibt die Datei neu und bricht die Unterschrift.');
  }

  if (optionen.signatur) {
    legePlatzhalterAn(ziel, pdflib, optionen.signatur);
    /* Ohne Objektströme: der Platzhalter muss in den fertigen Bytes im
       Klartext auffindbar bleiben. */
    const roh = await ziel.save({ useObjectStreams: false });
    return await fuelleSignatur(roh, optionen.signatur.ausweis);
  }

  let bytes = await ziel.save({ useObjectStreams: true });

  if (optionen.schutz?.benutzer || optionen.schutz?.besitzer) {
    const { verschluessle } = await import('./schutz.js');
    bytes = await verschluessle(bytes, optionen.schutz);
  }
  return bytes;
}

/* ---------- Erkannter Text als unsichtbare Ebene ---------------------------- */

/** Legt OCR-Wörter im Textmodus 3 hinter das Seitenbild: durchsuchbar, unsichtbar. */
async function schreibeErkanntenText(ziel, folge, versatzKarte) {
  const betroffen = folge.filter((e) => zustand.ocr.has(e.id));
  if (!betroffen.length) return;
  const { StandardFonts, TextRenderingMode, setTextRenderingMode, setCharacterSqueeze, pushGraphicsState, popGraphicsState } = pdflib;
  const schrift = await ziel.embedFont(StandardFonts.Helvetica);

  for (const eintrag of betroffen) {
    const ziel_ = versatzKarte.get(eintrag.id);
    if (!ziel_) continue;
    const { seite, versatz } = ziel_;
    const vx = -versatz.x, vy = -versatz.y;
    const erkennung = zustand.ocr.get(eintrag.id);

    seite.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible));
    for (const wort of erkennung.woerter) {
      const text = nurWinAnsi(wort.text);
      if (!text) continue;
      const groesse = Math.max(1, wort.h * 0.92);
      let breite = 0;
      try { breite = schrift.widthOfTextAtSize(text, groesse); } catch { continue; }
      // Waagerecht stauchen, damit die Auswahlrechtecke zum Bild passen.
      const stauchung = breite > 0 ? Math.max(10, Math.min(400, (wort.b / breite) * 100)) : 100;
      seite.pushOperators(setCharacterSqueeze(stauchung));
      try {
        seite.drawText(text, { x: wort.x + vx, y: wort.y + vy + wort.h * 0.16, size: groesse, font: schrift });
      } catch { /* einzelnes Wort auslassen, nie den ganzen Lauf */ }
    }
    seite.pushOperators(setCharacterSqueeze(100), popGraphicsState());
  }
}

/** Helvetica kann nur WinAnsi. Alles andere wird ersetzt oder fällt weg. */
const ERSATZ = {
  '„': '"', '“': '"', '”': '"', '‚': "'", '‘': "'", '’': "'",
  '–': '-', '—': '-', '‐': '-', '‑': '-', '…': '...', ' ': ' ',
  '−': '-', '˝': '"', '′': "'", '″': '"',
};
function nurWinAnsi(text) {
  let ergebnis = '';
  for (const zeichen of String(text)) {
    if (ERSATZ[zeichen] != null) { ergebnis += ERSATZ[zeichen]; continue; }
    const nummer = zeichen.codePointAt(0);
    if (nummer >= 32 && nummer <= 126) { ergebnis += zeichen; continue; }
    if (nummer >= 160 && nummer <= 255) { ergebnis += zeichen; continue; }
    ergebnis += ' ';
  }
  return ergebnis.trim();
}

/* ---------- Formularwerte -------------------------------------------------- */

/* Neue Formularfelder anlegen — Acrobats „Formular vorbereiten".

   Die Felder entstehen erst hier, nicht beim Zeichnen: erst beim Sichern ist
   klar, auf welcher Seite des Ausgabedokuments der Rahmen landet und wie weit
   sie verschoben wurde. Gerasterte Seiten (Schwärzung) bekommen keine Felder —
   ein Eingabefeld über einer Schwärzung wäre ein Widerspruch in sich. */
async function legeNeueFelderAn(ziel, folge, versatzKarte) {
  const neue = zustand.anmerkungen.filter((a) => a.art === 'feldneu');
  if (!neue.length) return 0;

  let formular;
  try { formular = ziel.getForm(); } catch (fehler) {
    console.warn('Kein Formular im Ausgabedokument:', fehler?.message);
    return 0;
  }

  const schon = new Set(formular.getFields().map((f) => f.getName()));
  let gelegt = 0;

  for (const eintrag of folge) {
    const ziel_ = versatzKarte.get(eintrag.id);
    if (!ziel_) continue;
    const { seite, versatz } = ziel_;
    const vx = -versatz.x, vy = -versatz.y;

    for (const a of neue.filter((x) => x.seiteId === eintrag.id)) {
      if (GESCHWAERZT(eintrag.id)) {
        sage(`„${a.name}" wurde nicht angelegt: die Seite wird geschwärzt und dabei zum Bild`, { art: 'warn' });
        continue;
      }
      if (schon.has(a.name)) {
        sage(`„${a.name}" gibt es im Dokument schon — Feld übersprungen`, { art: 'warn' });
        continue;
      }
      const lage = { x: a.x + vx, y: a.y + vy, width: a.b, height: a.h };
      try {
        if (a.feldArt === 'ankreuz') {
          const feld = formular.createCheckBox(a.name);
          feld.addToPage(seite, lage);
          if (a.pflicht) feld.enableRequired();
        } else if (a.feldArt === 'auswahl') {
          const feld = formular.createDropdown(a.name);
          feld.addOptions(a.optionen);
          feld.addToPage(seite, lage);
          if (a.pflicht) feld.enableRequired();
        } else if (a.feldArt === 'option') {
          const feld = formular.createRadioGroup(a.name);
          /* Jede Möglichkeit bekommt ein eigenes Kästchen, untereinander im
             gezogenen Rahmen — sonst lägen alle übereinander. */
          const hoehe = a.h / a.optionen.length;
          a.optionen.forEach((wahl, i) => {
            feld.addOptionToPage(wahl, seite, {
              x: lage.x, y: lage.y + a.h - hoehe * (i + 1),
              width: Math.min(hoehe, a.b), height: hoehe,
            });
          });
          if (a.pflicht) feld.enableRequired();
        } else if (a.feldArt === 'unterschrift') {
          legeUnterschriftsfeldAn(ziel, seite, a, vx, vy);
        } else {
          const feld = formular.createTextField(a.name);
          if (a.feldArt === 'mehrzeilig') feld.enableMultiline();
          feld.addToPage(seite, lage);
          if (a.pflicht) feld.enableRequired();
        }
        schon.add(a.name);
        gelegt += 1;
      } catch (fehler) {
        console.warn(`Feld "${a.name}" ließ sich nicht anlegen:`, fehler?.message);
        sage(`„${a.name}" ließ sich nicht anlegen`, { art: 'warn' });
      }
    }
  }
  return gelegt;
}

/* pdf-lib kennt keine Unterschriftsfelder. Das Widget wird deshalb von Hand
   gebaut — dieselben Bausteine wie im Beispielerzeuger, damit ein Betrachter
   es als Unterschriftsstelle erkennt. */
function legeUnterschriftsfeldAn(ziel, seite, a, vx, vy) {
  const { PDFName, PDFNumber, PDFString, PDFArray, PDFDict } = pdflib;
  const kontext = ziel.context;

  const widget = kontext.obj({
    Type: 'Annot', Subtype: 'Widget', FT: 'Sig',
    T: PDFString.of(a.name),
    F: PDFNumber.of(4),   // sichtbar beim Drucken
    Rect: [a.x + vx, a.y + vy, a.x + vx + a.b, a.y + vy + a.h],
    P: seite.ref,
  });
  const ref = kontext.register(widget);

  let annots = seite.node.get(PDFName.of('Annots'));
  if (!annots) { annots = PDFArray.withContext(kontext); seite.node.set(PDFName.of('Annots'), annots); }
  annots.push(ref);

  const katalog = ziel.catalog;
  let acro = katalog.get(PDFName.of('AcroForm'));
  if (!acro) {
    acro = PDFDict.withContext(kontext);
    acro.set(PDFName.of('Fields'), PDFArray.withContext(kontext));
    katalog.set(PDFName.of('AcroForm'), acro);
  }
  const acroDict = acro instanceof PDFDict ? acro : kontext.lookup(acro, PDFDict);
  let felder = acroDict.get(PDFName.of('Fields'));
  if (!felder) { felder = PDFArray.withContext(kontext); acroDict.set(PDFName.of('Fields'), felder); }
  const felderArray = felder instanceof PDFArray ? felder : kontext.lookup(felder, PDFArray);
  felderArray.push(ref);
  /* Ohne SigFlags halten manche Betrachter das Feld für ein leeres Widget. */
  acroDict.set(PDFName.of('SigFlags'), PDFNumber.of(3));
}

async function schreibeFormular(dokument, { einbrennen = false } = {}) {
  if (!zustand.formularfelder.length) return;
  let formular;
  try { formular = dokument.getForm(); } catch { return; }
  const felder = formular.getFields();
  if (!felder.length) return;

  const { PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFOptionList } = pdflib;

  for (const feld of felder) {
    const name = feld.getName();
    const wert = zustand.formularwerte.get(name);
    if (wert == null || wert === '') continue;
    // Klassenprüfung statt constructor.name: der ausgelieferte Build ist
    // verkleinert, Klassennamen sind darin nicht mehr aussagekräftig.
    try {
      if (feld instanceof PDFTextField) feld.setText(String(wert));
      else if (feld instanceof PDFCheckBox) { (wert && wert !== 'Off') ? feld.check() : feld.uncheck(); }
      else if (feld instanceof PDFRadioGroup || feld instanceof PDFDropdown || feld instanceof PDFOptionList) feld.select(String(wert));
      else if (typeof feld.setText === 'function') feld.setText(String(wert));
      else if (typeof feld.select === 'function') feld.select(String(wert));
    } catch (fehler) {
      console.warn(`Feld "${name}" ließ sich nicht setzen:`, fehler?.message);
    }
  }
  if (einbrennen) {
    try { formular.flatten(); }
    catch (fehler) { console.warn('Formular ließ sich nicht einbrennen:', fehler?.message); }
  }
}

/* ---------- Schwärzung durch Rastern ---------------------------------------- */

async function rastereSeite(ziel, eintrag, dichte) {
  const quellSeite = await holeSeite(eintrag);
  const sicht = quellSeite.getViewport({ scale: dichte, rotation: 0 });
  const leinwand = document.createElement('canvas');
  leinwand.width = Math.ceil(sicht.width);
  leinwand.height = Math.ceil(sicht.height);
  const stift = leinwand.getContext('2d');
  stift.fillStyle = '#fff';
  stift.fillRect(0, 0, leinwand.width, leinwand.height);
  await quellSeite.render({ canvasContext: stift, viewport: sicht }).promise;

  // Schwärzungen deckend auf das Rasterbild malen — der Text darunter
  // existiert im Ergebnis nicht mehr.
  stift.fillStyle = '#000';
  for (const a of zustand.anmerkungen.filter((x) => x.art === 'schwaerzen' && x.seiteId === eintrag.id)) {
    const [x1, y1] = sicht.convertToViewportPoint(a.x, a.y);
    const [x2, y2] = sicht.convertToViewportPoint(a.x2, a.y2);
    stift.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  const datenUrl = leinwand.toDataURL('image/jpeg', 0.92);
  const bild = await ziel.embedJpg(datenUrl);
  const basis = quellSeite.getViewport({ scale: 1, rotation: 0 });
  const seite = ziel.addPage([basis.width, basis.height]);
  seite.drawImage(bild, { x: 0, y: 0, width: basis.width, height: basis.height });
  const gesamt = (quellSeite.rotate + eintrag.drehung) % 360;
  if (gesamt) seite.setRotation(pdflib.degrees(gesamt));
  return { seite, versatz: { x: quellSeite.view[0], y: quellSeite.view[1] } };
}

/* ---------- Anmerkungen einbrennen ------------------------------------------ */

async function maleAnmerkungen(ziel, folge, versatzKarte) {
  const anmerkungen = zustand.anmerkungen.filter((a) => a.art !== 'schwaerzen');
  if (!anmerkungen.length) return;
  const { rgb, StandardFonts, BlendMode } = pdflib;
  const schrift = await ziel.embedFont(StandardFonts.Helvetica);
  const bildkarte = new Map();

  for (const eintrag of folge) {
    const ziel_ = versatzKarte.get(eintrag.id);
    if (!ziel_) continue;
    const { seite, versatz } = ziel_;
    const vx = -versatz.x, vy = -versatz.y;

    for (const a of anmerkungen.filter((x) => x.seiteId === eintrag.id)) {
      const farbe = farbeZuAnteilen(a.farbe || '#000000');
      const stiftFarbe = rgb(farbe.r, farbe.g, farbe.b);

      if (a.art === 'hervor') {
        for (const q of a.quads) {
          seite.drawRectangle({
            x: q.x + vx, y: q.y + vy, width: q.b, height: q.h,
            color: stiftFarbe, opacity: 0.42, blendMode: BlendMode?.Multiply,
          });
        }
      } else if (a.art === 'unterstrich' || a.art === 'durchstrich') {
        for (const q of a.quads) {
          const y = a.art === 'unterstrich' ? q.y + q.h * 0.06 : q.y + q.h * 0.42;
          seite.drawLine({
            start: { x: q.x + vx, y: y + vy }, end: { x: q.x + q.b + vx, y: y + vy },
            thickness: Math.max(0.7, q.h * 0.07), color: stiftFarbe,
          });
        }
      } else if (a.art === 'freihand') {
        for (let i = 1; i < a.punkte.length; i++) {
          const [x1, y1] = a.punkte[i - 1], [x2, y2] = a.punkte[i];
          seite.drawLine({
            start: { x: x1 + vx, y: y1 + vy }, end: { x: x2 + vx, y: y2 + vy },
            thickness: a.staerke || 2, color: stiftFarbe, lineCap: pdflib.LineCapStyle?.Round,
          });
        }
      } else if (a.art === 'messen' || a.art === 'flaeche') {
        /* Eine Messung ohne ihre Zahl wäre ein Strich. Deshalb wandert die
           Beschriftung mit in die Datei — dieselbe, die auf dem Bildschirm
           steht, gerechnet von messen.js. */
        const text = nurWinAnsi(messwert(a));
        const groesse = 8;
        let mx, my;
        if (a.art === 'messen') {
          seite.drawLine({
            start: { x: a.x + vx, y: a.y + vy }, end: { x: a.x2 + vx, y: a.y2 + vy },
            thickness: a.staerke || 1.5, color: stiftFarbe,
          });
          const winkel = Math.atan2(a.y2 - a.y, a.x2 - a.x) + Math.PI / 2;
          const arm = Math.max(3, (a.staerke || 1.5) * 3);
          for (const [px, py] of [[a.x, a.y], [a.x2, a.y2]]) {
            seite.drawLine({
              start: { x: px + vx - arm * Math.cos(winkel), y: py + vy - arm * Math.sin(winkel) },
              end: { x: px + vx + arm * Math.cos(winkel), y: py + vy + arm * Math.sin(winkel) },
              thickness: a.staerke || 1.5, color: stiftFarbe,
            });
          }
          mx = (a.x + a.x2) / 2 + vx; my = (a.y + a.y2) / 2 + vy;
        } else {
          const x = Math.min(a.x, a.x2) + vx, y = Math.min(a.y, a.y2) + vy;
          const b = Math.abs(a.x2 - a.x), h = Math.abs(a.y2 - a.y);
          seite.drawRectangle({
            x, y, width: b, height: h, borderColor: stiftFarbe,
            borderWidth: a.staerke || 1.5, color: stiftFarbe, opacity: 0.1,
          });
          mx = x + b / 2; my = y + h / 2;
        }
        const textbreite = schrift.widthOfTextAtSize(text, groesse);
        seite.drawRectangle({
          x: mx - textbreite / 2 - 2, y: my - groesse * 0.35,
          width: textbreite + 4, height: groesse * 1.35,
          color: rgb(1, 1, 1), borderColor: stiftFarbe, borderWidth: 0.5,
        });
        seite.drawText(text, { x: mx - textbreite / 2, y: my, size: groesse, font: schrift, color: stiftFarbe });
      } else if (a.art === 'rechteck') {
        const x = Math.min(a.x, a.x2) + vx, y = Math.min(a.y, a.y2) + vy;
        seite.drawRectangle({ x, y, width: Math.abs(a.x2 - a.x), height: Math.abs(a.y2 - a.y), borderColor: stiftFarbe, borderWidth: a.staerke || 2, opacity: 0 });
      } else if (a.art === 'ellipse') {
        const x = (a.x + a.x2) / 2 + vx, y = (a.y + a.y2) / 2 + vy;
        seite.drawEllipse({ x, y, xScale: Math.abs(a.x2 - a.x) / 2, yScale: Math.abs(a.y2 - a.y) / 2, borderColor: stiftFarbe, borderWidth: a.staerke || 2, opacity: 0 });
      } else if (a.art === 'pfeil') {
        const start = { x: a.x + vx, y: a.y + vy }, ende = { x: a.x2 + vx, y: a.y2 + vy };
        seite.drawLine({ start, end: ende, thickness: a.staerke || 2, color: stiftFarbe });
        const winkel = Math.atan2(ende.y - start.y, ende.x - start.x);
        const laenge = Math.max(6, (a.staerke || 2) * 4);
        for (const richtung of [-1, 1]) {
          seite.drawLine({
            start: ende,
            end: { x: ende.x - laenge * Math.cos(winkel - richtung * 0.42), y: ende.y - laenge * Math.sin(winkel - richtung * 0.42) },
            thickness: a.staerke || 2, color: stiftFarbe,
          });
        }
      } else if (a.art === 'text') {
        const groesse = a.groesse || 12;
        const zeilen = umbreche(a.text || '', schrift, groesse, a.breite || 260);
        zeilen.forEach((zeile, i) => {
          seite.drawText(zeile, {
            x: a.x + vx, y: a.y + vy - groesse * (i + 0.85) * 1.25 + groesse * 1.25,
            size: groesse, font: schrift, color: stiftFarbe,
          });
        });
      } else if (a.art === 'ersatz') {
        const grund = farbeZuAnteilen(a.grundfarbe || '#FFFFFF');
        const rand = Math.max(0.6, a.h * 0.12);
        seite.drawRectangle({
          x: a.x + vx - rand, y: a.y + vy - rand * 0.5,
          width: a.b + rand * 2, height: a.h + rand,
          color: rgb(grund.r, grund.g, grund.b),
        });
        const schriftfarbe = farbeZuAnteilen(a.schriftfarbe || '#111111');
        const groesse = a.groesse || a.h * 0.82;
        try {
          seite.drawText(nurWinAnsi(a.text), {
            x: a.x + vx, y: a.y + vy + a.h * 0.18,
            size: groesse, font: schrift, color: rgb(schriftfarbe.r, schriftfarbe.g, schriftfarbe.b),
          });
        } catch (fehler) { console.warn('Ersatztext ließ sich nicht setzen:', fehler?.message); }
      } else if (a.art === 'stempel') {
        const rand = farbeZuAnteilen(a.farbe || '#0D5A4D');
        seite.drawRectangle({
          x: a.x + vx, y: a.y + vy, width: a.b, height: a.h,
          borderColor: rgb(rand.r, rand.g, rand.b), borderWidth: 2, opacity: 0,
        });
        const groesse = a.groesse || a.h * 0.45;
        const text = nurWinAnsi(a.text).toUpperCase();
        const breite = schrift.widthOfTextAtSize(text, groesse);
        seite.drawText(text, {
          x: a.x + vx + (a.b - breite) / 2,
          y: a.y + vy + (a.h - groesse * 0.72) / 2,
          size: groesse, font: schrift, color: rgb(rand.r, rand.g, rand.b),
        });
      } else if (a.art === 'notiz') {
        // Echte PDF-Notiz, damit jeder Betrachter sie als Kommentar zeigt.
        legeNotizAn(ziel, seite, a, vx, vy);
      } else if (a.art === 'unterschrift') {
        let bild = bildkarte.get(a.bild);
        if (!bild) {
          bild = a.bild.startsWith('data:image/jpeg') ? await ziel.embedJpg(a.bild) : await ziel.embedPng(a.bild);
          bildkarte.set(a.bild, bild);
        }
        seite.drawImage(bild, { x: a.x + vx, y: a.y + vy, width: a.b, height: a.h });
      }
    }
  }
}

function legeNotizAn(ziel, seite, a, vx, vy) {
  try {
    const { PDFName, PDFString, PDFArray, PDFNumber } = pdflib;
    const kontext = ziel.context;
    const rechteck = kontext.obj([a.x + vx, a.y + vy - 20, a.x + vx + 20, a.y + vy]);
    const anmerkung = kontext.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Name: 'Comment',
      Rect: rechteck,
      /* Der Kommentar, ersatzweise der zitierte Seitentext — sonst stünde in
         einer hervorgehobenen Stelle nichts, was ein anderer Betrachter zeigt. */
      Contents: PDFString.of(a.text || a.zitat || ''),
      T: PDFString.of('Werkbank'),
      C: kontext.obj(Object.values(farbeZuAnteilen(a.farbe || '#FFD400'))),
      F: PDFNumber.of(4),
    });
    const verweis = kontext.register(anmerkung);
    const vorhanden = seite.node.get(PDFName.of('Annots'));
    if (vorhanden instanceof PDFArray) vorhanden.push(verweis);
    else seite.node.set(PDFName.of('Annots'), kontext.obj([verweis]));
  } catch (fehler) {
    console.warn('Notiz ließ sich nicht anlegen:', fehler?.message);
  }
}

function umbreche(text, schrift, groesse, maximalBreite) {
  const zeilen = [];
  for (const absatz of String(text).split('\n')) {
    let laufend = '';
    for (const wort of absatz.split(/\s+/)) {
      const versuch = laufend ? `${laufend} ${wort}` : wort;
      if (schrift.widthOfTextAtSize(versuch, groesse) > maximalBreite && laufend) {
        zeilen.push(laufend);
        laufend = wort;
      } else laufend = versuch;
    }
    zeilen.push(laufend);
  }
  return zeilen;
}

/* ---------- Bequeme Ausgaben ------------------------------------------------ */

export async function sichereDokument(optionen = {}) {
  const bytes = await baueDokument(optionen);
  const name = optionen.dateiname || vorschlagsname();
  sichereBytes(bytes, name);
  zustand.geaendert = false;
  sage(`Gesichert: ${name}`);
  return bytes;
}

export function vorschlagsname(zusatz = '') {
  const kern = zustand.name.replace(/\.pdf$/i, '') || 'dokument';
  return `${kern}${zusatz}.pdf`;
}

export async function seitenAusgeben(ids, dateiname) {
  const bytes = await baueDokument({ seiten: ids, formularEinbrennen: true });
  sichereBytes(bytes, dateiname);
  sage(`${ids.length} Seite${ids.length === 1 ? '' : 'n'} ausgegeben`);
}

/** Teilt das Dokument in Stapel zu je n Seiten und lädt sie einzeln herunter. */
export async function teileDokument(proDatei) {
  const gruppen = [];
  for (let i = 0; i < zustand.folge.length; i += proDatei) {
    gruppen.push(zustand.folge.slice(i, i + proDatei).map((e) => e.id));
  }
  for (let i = 0; i < gruppen.length; i++) {
    const bytes = await baueDokument({ seiten: gruppen[i], formularEinbrennen: true });
    sichereBytes(bytes, vorschlagsname(`-teil-${String(i + 1).padStart(2, '0')}`));
    await new Promise((l) => setTimeout(l, 260));   // Browser mögen keine Lawine
  }
  sage(`In ${gruppen.length} Dateien geteilt`);
}

/**
 * Verkleinern: alle Seiten werden mit fester Auflösung als JPEG neu aufgebaut.
 * Das ist der ehrliche Weg im Browser — Text wird dabei zu Bild. Liegt eine
 * Texterkennung vor, wandert sie als unsichtbare Ebene mit, dann bleibt die
 * Datei durchsuchbar.
 */
export async function verkleinere({ dichte = 110, guete = 0.72 } = {}) {
  const { PDFDocument } = await starteSchreiber();
  const ziel = await PDFDocument.create();
  const versatzKarte = new Map();

  for (const eintrag of zustand.folge) {
    const quellSeite = await holeSeite(eintrag);
    const sicht = quellSeite.getViewport({ scale: dichte / 72, rotation: 0 });
    const leinwand = document.createElement('canvas');
    leinwand.width = Math.ceil(sicht.width);
    leinwand.height = Math.ceil(sicht.height);
    const stift = leinwand.getContext('2d');
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, leinwand.width, leinwand.height);
    await quellSeite.render({ canvasContext: stift, viewport: sicht }).promise;

    // Schwärzungen gehören auch hier deckend ins Bild.
    stift.fillStyle = '#000';
    for (const a of zustand.anmerkungen.filter((x) => x.art === 'schwaerzen' && x.seiteId === eintrag.id)) {
      const [x1, y1] = sicht.convertToViewportPoint(a.x, a.y);
      const [x2, y2] = sicht.convertToViewportPoint(a.x2, a.y2);
      stift.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    }

    const bild = await ziel.embedJpg(leinwand.toDataURL('image/jpeg', guete));
    const basis = quellSeite.getViewport({ scale: 1, rotation: 0 });
    const seite = ziel.addPage([basis.width, basis.height]);
    seite.drawImage(bild, { x: 0, y: 0, width: basis.width, height: basis.height });
    const gesamt = (quellSeite.rotate + eintrag.drehung) % 360;
    if (gesamt) seite.setRotation(pdflib.degrees(gesamt));
    versatzKarte.set(eintrag.id, { seite, versatz: { x: quellSeite.view[0], y: quellSeite.view[1] } });
  }

  await schreibeErkanntenText(ziel, zustand.folge, versatzKarte);
  await maleAnmerkungen(ziel, zustand.folge, versatzKarte);
  ziel.setProducer('Werkbank');
  ziel.setModificationDate(new Date());

  if (zustand.zugang) {
    const gesetzt = setzeZugaenglichkeit(ziel, pdflib, zustand.zugang);
    if (gesetzt.length) sage(`Für die Barrierefreiheit gesetzt: ${gesetzt.join(', ')}`, { dauer: 6000 });
  }
  return ziel.save({ useObjectStreams: true });
}

/** Eine Seite als PNG. */
export async function seiteAlsBild(eintrag, dichte = 2) {
  const seite = await holeSeite(eintrag);
  const sicht = seite.getViewport({ scale: dichte, rotation: (seite.rotate + eintrag.drehung) % 360 });
  const leinwand = document.createElement('canvas');
  leinwand.width = Math.ceil(sicht.width);
  leinwand.height = Math.ceil(sicht.height);
  const stift = leinwand.getContext('2d');
  stift.fillStyle = '#fff';
  stift.fillRect(0, 0, leinwand.width, leinwand.height);
  await seite.render({ canvasContext: stift, viewport: sicht }).promise;
  return new Promise((loese) => leinwand.toBlob((blob) => loese(blob), 'image/png'));
}
