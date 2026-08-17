/* Barrierefreiheit — prüfen und in Ordnung bringen, was zu bringen ist.

   Ehrlich vorweg, weil das der Punkt ist, an dem viele Werkzeuge schwindeln:

   Ein PDF gilt als barrierefrei (PDF/UA), wenn seine Seiteninhalte ausgezeichnet
   sind — jeder Absatz als Absatz, jede Überschrift als Überschrift, jede
   Tabelle als Tabelle, in einem Strukturbaum. Diese Auszeichnung entsteht beim
   Erzeugen des Dokuments. Sie nachträglich in ein fertiges PDF zu bringen,
   heißt: jeden Seiteninhalt neu schreiben und dabei Marken setzen. Was ein
   Werkzeug „automatisch taggen" nennt, ist dabei immer eine Vermutung — und
   eine falsche Überschriftenebene ist für einen Screenreader schlimmer als
   gar keine.

   Deshalb macht die Werkbank hier zweierlei und nicht mehr:

   · **Prüfen** — die Punkte, die sich maschinell feststellen lassen, mit
     klarer Aussage, was fehlt und was das bedeutet.
   · **Setzen, was ohne Vermutung geht** — Dokumentsprache, Titel, „Titel
     statt Dateiname anzeigen", Feldbeschriftungen als zugängliche Namen.
     Das sind Angaben, keine Vermutungen.

   Was nicht geht, steht im Bericht — nicht im Kleingedruckten. */

import { zustand } from './kern.js';
import { holeSeite, pdfjs } from './dokument.js';

/** Sprachen, die als Dokumentsprache zur Wahl stehen. */
export const SPRACHEN = [
  { wert: 'de-DE', name: 'Deutsch' },
  { wert: 'en-GB', name: 'Englisch (UK)' },
  { wert: 'en-US', name: 'Englisch (US)' },
  { wert: 'fr-FR', name: 'Französisch' },
  { wert: 'it-IT', name: 'Italienisch' },
  { wert: 'nl-NL', name: 'Niederländisch' },
  { wert: 'pl-PL', name: 'Polnisch' },
  { wert: 'tr-TR', name: 'Türkisch' },
];

/**
 * Prüft das geladene Dokument.
 * @returns {Promise<Array<{id, stufe, titel, text, behebbar}>>}
 *   stufe: 'fehler' | 'warnung' | 'gut'
 *   behebbar: true, wenn „In Ordnung bringen" es setzen kann
 */
export async function pruefe() {
  const punkte = [];
  const quelle = [...zustand.quellen.values()][0];
  if (!quelle) return punkte;

  /* ---- Auszeichnung (Strukturbaum) ---- */
  const ausgezeichnet = await istAusgezeichnet(quelle);
  punkte.push(ausgezeichnet
    ? { id: 'struktur', stufe: 'gut', titel: 'Das Dokument ist ausgezeichnet',
        text: 'Es trägt einen Strukturbaum. Ob die Auszeichnung inhaltlich stimmt, kann nur ein Mensch beurteilen.' }
    : { id: 'struktur', stufe: 'fehler', titel: 'Keine Auszeichnung (kein Strukturbaum)',
        text: 'Ein Screenreader liest die Seite dann in der Reihenfolge, in der die Buchstaben zufällig im Dokument stehen — '
            + 'bei mehrspaltigem Satz ergibt das Kauderwelsch. Nachträglich lässt sich das nicht ohne Vermutung herstellen: '
            + 'die Auszeichnung gehört in das Programm, das die Datei erzeugt (Word: „Als PDF speichern" statt „Drucken zu PDF"; '
            + 'InDesign: Artikel und Tags setzen). Die Werkbank rät hier nicht.',
        behebbar: false });

  /* ---- Dokumentsprache ---- */
  const sprache = await lieszSprache(quelle);
  punkte.push(sprache
    ? { id: 'sprache', stufe: 'gut', titel: `Dokumentsprache gesetzt (${sprache})`, text: 'Die Sprachausgabe wählt damit die richtige Aussprache.' }
    : { id: 'sprache', stufe: 'fehler', titel: 'Keine Dokumentsprache',
        text: 'Ohne Sprachangabe liest eine deutsche Sprachausgabe englische Wörter deutsch vor und umgekehrt. '
            + 'Das ist eine Angabe, keine Vermutung — die Werkbank kann sie setzen.',
        behebbar: true });

  /* ---- Titel und Anzeige des Titels ---- */
  const titel = (zustand.eigenschaften?.titel || '').trim();
  punkte.push(titel
    ? { id: 'titel', stufe: 'gut', titel: `Titel gesetzt („${titel}")`, text: 'Der Fenstertitel nennt damit das Dokument und nicht den Dateinamen.' }
    : { id: 'titel', stufe: 'warnung', titel: 'Kein Dokumenttitel',
        text: 'Wer mehrere Dateien offen hat, hört sonst nur Dateinamen. Die Werkbank setzt den Namen der Datei als Titel, '
            + 'wenn Sie nichts anderes angeben.',
        behebbar: true });

  const zeigtTitel = await zeigtDenTitel(quelle);
  punkte.push(zeigtTitel
    ? { id: 'titelanzeige', stufe: 'gut', titel: 'Titel wird statt des Dateinamens angezeigt', text: '' }
    : { id: 'titelanzeige', stufe: 'warnung', titel: 'Betrachter zeigt den Dateinamen, nicht den Titel',
        text: 'PDF/UA verlangt, dass der Titel angezeigt wird (ViewerPreferences → DisplayDocTitle). Ein Schalter, keine Vermutung.',
        behebbar: true });

  /* ---- Formularfelder ohne zugänglichen Namen ---- */
  const ohneNamen = zustand.formularfelder.filter((f) => !f.beschriftung);
  if (zustand.formularfelder.length) {
    punkte.push(ohneNamen.length
      ? { id: 'felder', stufe: 'fehler', titel: `${ohneNamen.length} von ${zustand.formularfelder.length} Formularfeldern ohne Beschriftung`,
          text: 'Eine Sprachausgabe sagt sonst nur „Textfeld". Als Beschriftung (PDF: /TU) wird der Feldname genommen — '
              + 'besser als nichts, aber sehen Sie ihn sich an: „vorname_1" hilft niemandem.',
          behebbar: true }
      : { id: 'felder', stufe: 'gut', titel: 'Alle Formularfelder haben eine Beschriftung', text: '' });
  }

  /* ---- Seiten ohne Text (Scans) ---- */
  const ohneText = [];
  for (const eintrag of zustand.folge) {
    const laenge = zustand.textLaenge.get(eintrag.id);
    if (laenge != null && laenge < 40 && !zustand.ocr.has(eintrag.id)) ohneText.push(eintrag);
  }
  if (ohneText.length) {
    punkte.push({ id: 'scan', stufe: 'fehler',
      titel: `${ohneText.length} Seite${ohneText.length === 1 ? '' : 'n'} ohne auslesbaren Text`,
      text: 'Ein Bild einer Seite ist für eine Sprachausgabe eine leere Seite. Die Texterkennung legt den Text dahinter — '
          + 'das ist der größte Einzelschritt zur Zugänglichkeit eines Scans.',
      behebbar: false, befehl: 'texterkennung' });
  }

  /* ---- Bilder ohne Alternativtext ---- */
  const bilder = await zaehleBilder();
  if (bilder > 0) {
    punkte.push({ id: 'bilder', stufe: 'warnung', titel: `${bilder} Bild${bilder === 1 ? '' : 'er'} im Dokument`,
      text: 'Ob sie einen Alternativtext tragen, steht im Strukturbaum — ohne Auszeichnung gibt es keinen. '
          + 'Alternativtexte lassen sich nicht erraten: was auf einem Bild wichtig ist, weiß nur, wer es eingefügt hat.',
      behebbar: false });
  }

  return punkte;
}

async function istAusgezeichnet(quelle) {
  try {
    const marken = await quelle.pdf.getMarkInfo?.();
    if (marken?.Marked) return true;
  } catch { /* ältere Fassungen kennen getMarkInfo nicht */ }
  try {
    const baum = await quelle.pdf.getStructTree?.(1);
    return !!baum?.children?.length;
  } catch { return false; }
}

async function lieszSprache(quelle) {
  try {
    const { info } = await quelle.pdf.getMetadata();
    return info?.Language || null;
  } catch { return null; }
}

async function zeigtDenTitel(quelle) {
  try {
    const einstellungen = await quelle.pdf.getViewerPreferences?.();
    return !!einstellungen?.DisplayDocTitle;
  } catch { return false; }
}

/** Wie viele Bild-XObjects auf den ersten Seiten vorkommen. */
async function zaehleBilder() {
  let anzahl = 0;
  for (const eintrag of zustand.folge.slice(0, 30)) {
    try {
      const seite = await holeSeite(eintrag);
      const liste = await seite.getOperatorList();
      const bildOps = new Set([
        pdfjs?.OPS?.paintImageXObject, pdfjs?.OPS?.paintInlineImageXObject,
        pdfjs?.OPS?.paintImageMaskXObject,
      ].filter((o) => o != null));
      if (!bildOps.size) return 0;   // ohne OPS-Tabelle lieber nichts behaupten
      anzahl += liste.fnArray.filter((f) => bildOps.has(f)).length;
    } catch { /* Seite überspringen */ }
  }
  return anzahl;
}

/**
 * Setzt beim Sichern, was ohne Vermutung zu setzen ist.
 * Wird aus `ausgabe.js` gerufen, nachdem das Zieldokument steht.
 */
export function setzeZugaenglichkeit(ziel, pdflib, { sprache, titel, feldbeschriftungen = true } = {}) {
  const { PDFName, PDFString, PDFBool, PDFDict } = pdflib;
  const kontext = ziel.context;
  const gesetzt = [];

  if (sprache) {
    ziel.catalog.set(PDFName.of('Lang'), PDFString.of(sprache));
    gesetzt.push(`Sprache ${sprache}`);
  }

  if (titel) {
    ziel.setTitle(titel);
    let einstellungen = ziel.catalog.get(PDFName.of('ViewerPreferences'));
    if (!einstellungen) {
      einstellungen = PDFDict.withContext(kontext);
      ziel.catalog.set(PDFName.of('ViewerPreferences'), einstellungen);
    }
    const dict = einstellungen instanceof PDFDict ? einstellungen : kontext.lookup(einstellungen, PDFDict);
    dict.set(PDFName.of('DisplayDocTitle'), PDFBool.True);
    gesetzt.push('Titel wird angezeigt');
  }

  if (feldbeschriftungen) {
    let anzahl = 0;
    try {
      for (const feld of ziel.getForm().getFields()) {
        const wurzel = feld.acroField.dict;
        if (wurzel.get(PDFName.of('TU'))) continue;
        wurzel.set(PDFName.of('TU'), PDFString.of(feld.getName()));
        anzahl += 1;
      }
    } catch { /* kein Formular */ }
    if (anzahl) gesetzt.push(`${anzahl} Feldbeschriftungen`);
  }

  return gesetzt;
}
