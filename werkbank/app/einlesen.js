/* Einlesen — aus Word, Excel, Text, Markdown und CSV wird ein PDF.

   Acrobat nennt das „PDF erstellen" und „In PDF konvertieren" und schickt die
   Datei dafür an einen Dienst. Hier passiert es im Browser: ein .docx ist ein
   ZIP mit XML darin, ein .xlsx auch, und beides lässt sich lesen, ohne die
   Datei aus dem Haus zu geben.

   Der Weg ist zweigeteilt, und das mit Absicht:

   1. **Lesen** — jedes Format wird in dieselbe Liste von Blöcken übersetzt:
      Überschrift, Absatz, Aufzählung, Tabelle, Seitenumbruch. Ein Block kennt
      keine Koordinaten.
   2. **Setzen** — die Blöcke werden auf A4 gesetzt: umbrochen, gezählt,
      umgebrochen. Der Setzer kennt kein Word und kein Excel.

   Damit kostet ein weiteres Eingangsformat nur einen Leser.

   **Was dabei nicht ankommt, und warum:** Word beschreibt ein Dokument mit
   Vorlagen, Nummerierungen, Rahmen, Feldern und Zeichnungen. Die Werkbank
   nimmt daraus, was Text ist — Überschriften, Absätze, Aufzählungen,
   Tabellen, fett und kursiv. Nicht mit kommen Bilder, Kopf- und Fußzeilen,
   Fußnoten, Spalten, Farben und die genaue Nummerierung. Das steht auch im
   Dialog, bevor jemand auf „Erstellen" drückt: eine ehrliche Annäherung ist
   mehr wert als eine Nachbildung, die an drei Stellen lügt. */

import { fremdWeg } from './kern.js';
import { liesZip, alsText } from './zip.js';

/* ---------- Maße ---------------------------------------------------------- */

const A4 = { breite: 595.28, hoehe: 841.89 };
const RAND = { links: 56, rechts: 56, oben: 64, unten: 56 };
const ZEILE = 1.34;                       // Zeilenabstand als Vielfaches
const GRUNDGROESSE = 10.5;
const UEBERSCHRIFT = [18, 15, 13, 11.5];  // Stufe 1 bis 4

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const EINGANGSFORMATE = ['.docx', '.xlsx', '.csv', '.txt', '.md'];

/** Kann diese Datei eingelesen werden? */
export function istEingangsformat(name) {
  return EINGANGSFORMATE.some((endung) => name.toLowerCase().endsWith(endung));
}

/* ---------- Öffentlicher Weg ---------------------------------------------- */

/**
 * Liest eine Datei und gibt ein PDF zurück.
 * @param {File|{name: string, bytes: Uint8Array}} datei
 * @returns {Promise<{bytes: Uint8Array, name: string, bloecke: number}>}
 */
export async function ausDatei(datei, optionen = {}) {
  const name = datei.name || 'Ohne Namen';
  const bytes = datei.bytes || new Uint8Array(await datei.arrayBuffer());
  const bloecke = await liesBloecke(bytes, name);
  if (!bloecke.length) throw new Error(`${name} enthält keinen Text, den die Werkbank setzen könnte.`);
  const pdf = await setze(bloecke, { titel: name.replace(/\.[^.]+$/, ''), ...optionen });
  return { bytes: pdf, name: `${name.replace(/\.[^.]+$/, '')}.pdf`, bloecke: bloecke.length };
}

/** Nur lesen, nicht setzen — für Prüfläufe und die Vorschau im Dialog. */
export async function liesBloecke(bytes, name) {
  const klein = name.toLowerCase();
  if (klein.endsWith('.docx')) return ausWord(bytes);
  if (klein.endsWith('.xlsx')) return ausExcel(bytes);
  if (klein.endsWith('.csv')) return ausCsv(new TextDecoder().decode(bytes));
  if (klein.endsWith('.md')) return ausMarkdown(new TextDecoder().decode(bytes));
  if (klein.endsWith('.txt')) return ausText(new TextDecoder().decode(bytes));
  throw new Error(`${name}: dieses Format kann die Werkbank nicht einlesen.`);
}

/* ---------- Word ---------------------------------------------------------- */

function kinderNS(knoten, tag) {
  return [...knoten.childNodes].filter((k) => k.nodeType === 1 && k.localName === tag && k.namespaceURI === NS_W);
}
function ersterNS(knoten, tag) { return kinderNS(knoten, tag)[0] || null; }
function attrW(knoten, name) { return knoten?.getAttributeNS?.(NS_W, name) ?? null; }

/* `<w:b/>` heißt fett, `<w:b w:val="0"/>` heißt ausdrücklich nicht fett.
   Wer nur auf das Vorhandensein sieht, setzt halbe Dokumente fett. */
function anIst(knoten) {
  if (!knoten) return false;
  const wert = attrW(knoten, 'val');
  return wert == null || !['0', 'false', 'off'].includes(wert);
}

/**
 * Übersetzt word/document.xml in Blöcke.
 *
 * Die Absatzvorlage entscheidet über die Art: `Heading2`, `berschrift2` und
 * `Titel` heißen in jeder Sprachfassung anders, tragen aber alle die Stufe im
 * Namen. Deshalb wird auf die Ziffer gesehen, nicht auf das Wort davor.
 */
export async function ausWord(bytes) {
  const dateien = await liesZip(bytes);
  const xml = alsText(dateien, 'word/document.xml');
  if (!xml) throw new Error('Das ist keine Word-Datei — word/document.xml fehlt.');
  const baum = new DOMParser().parseFromString(xml, 'application/xml');
  if (baum.querySelector('parsererror')) throw new Error('Die Word-Datei ließ sich nicht lesen.');
  const koerper = baum.getElementsByTagNameNS(NS_W, 'body')[0];
  if (!koerper) throw new Error('Die Word-Datei hat keinen Textkörper.');

  const bloecke = [];
  for (const knoten of [...koerper.childNodes].filter((k) => k.nodeType === 1)) {
    if (knoten.localName === 'p') bloecke.push(...absatzBlock(knoten));
    else if (knoten.localName === 'tbl') bloecke.push(tabellenBlock(knoten));
  }
  return bloecke.filter(Boolean);
}

function absatzBlock(p) {
  const eigenschaften = ersterNS(p, 'pPr');
  const vorlage = attrW(ersterNS(eigenschaften || p, 'pStyle'), 'val') || '';
  const laeufe = [];
  const raus = [];
  let umbruchVorher = false;

  for (const lauf of kinderNS(p, 'r')) {
    const lp = ersterNS(lauf, 'rPr');
    const fett = anIst(lp && ersterNS(lp, 'b'));
    const kursiv = anIst(lp && ersterNS(lp, 'i'));
    for (const kind of [...lauf.childNodes].filter((k) => k.nodeType === 1 && k.namespaceURI === NS_W)) {
      if (kind.localName === 't') laeufe.push({ text: kind.textContent, fett, kursiv });
      else if (kind.localName === 'tab') laeufe.push({ text: '\t', fett, kursiv });
      else if (kind.localName === 'br' && attrW(kind, 'type') === 'page') umbruchVorher = true;
      else if (kind.localName === 'br') laeufe.push({ text: '\n', fett, kursiv });
    }
  }

  if (umbruchVorher) raus.push({ art: 'seitenumbruch' });

  const text = laeufe.map((l) => l.text).join('').trim();
  if (!text) return raus;

  const stufe = Number(/(\d)/.exec(vorlage)?.[1] || 0);
  /* Nicht auf den Anfang prüfen: dieselbe Vorlage heißt je nach Sprachfassung
     `Heading1`, `berschrift1` oder `Ueberschrift1`. Gemeinsam ist ihnen das
     Wort in der Mitte und die Ziffer am Ende. */
  if (/(heading|berschrift|title|titel)/i.test(vorlage)) {
    raus.push({ art: 'ueberschrift', stufe: Math.min(4, stufe || 1), laeufe });
  } else if (eigenschaften && ersterNS(eigenschaften, 'numPr')) {
    const nummerierung = ersterNS(eigenschaften, 'numPr');
    const ebene = Number(attrW(ersterNS(nummerierung, 'ilvl'), 'val') || 0);
    raus.push({ art: 'punkt', ebene: Math.min(2, ebene), laeufe });
  } else {
    raus.push({ art: 'absatz', laeufe });
  }
  return raus;
}

function tabellenBlock(tbl) {
  const zeilen = [];
  for (const tr of [...tbl.childNodes].filter((k) => k.nodeType === 1 && k.localName === 'tr')) {
    const zelle = [];
    for (const tc of [...tr.childNodes].filter((k) => k.nodeType === 1 && k.localName === 'tc')) {
      const stuecke = [];
      for (const t of tc.getElementsByTagNameNS(NS_W, 't')) stuecke.push(t.textContent);
      zelle.push(stuecke.join('').trim());
    }
    if (zelle.length) zeilen.push(zelle);
  }
  if (!zeilen.length) return null;
  return { art: 'tabelle', zeilen, kopf: true };
}

/* ---------- Excel --------------------------------------------------------- */

/** Spaltenbuchstaben → Index. „A" = 0, „AA" = 26. */
export function spaltenIndex(bezug) {
  const buchstaben = /^([A-Z]+)/.exec(String(bezug).toUpperCase())?.[1] || 'A';
  let wert = 0;
  for (const zeichen of buchstaben) wert = wert * 26 + (zeichen.charCodeAt(0) - 64);
  return wert - 1;
}

export async function ausExcel(bytes) {
  const dateien = await liesZip(bytes);
  const mappe = alsText(dateien, 'xl/workbook.xml');
  if (!mappe) throw new Error('Das ist keine Excel-Datei — xl/workbook.xml fehlt.');

  const gemeinsam = leseGemeinsameTexte(alsText(dateien, 'xl/sharedStrings.xml'));
  const wege = leseBeziehungen(alsText(dateien, 'xl/_rels/workbook.xml.rels'));
  const baum = new DOMParser().parseFromString(mappe, 'application/xml');

  const bloecke = [];
  const blaetter = [...baum.getElementsByTagNameNS(NS_S, 'sheet')];
  for (const blatt of blaetter) {
    const name = blatt.getAttribute('name') || 'Tabelle';
    const bezug = blatt.getAttributeNS(NS_R, 'id');
    const ziel = wege.get(bezug);
    const xml = ziel ? alsText(dateien, ziel.startsWith('xl/') ? ziel : `xl/${ziel}`) : '';
    if (!xml) continue;
    const zeilen = leseBlatt(xml, gemeinsam);
    if (!zeilen.length) continue;
    if (blaetter.length > 1) bloecke.push({ art: 'ueberschrift', stufe: 2, laeufe: [{ text: name }] });
    bloecke.push({ art: 'tabelle', zeilen, kopf: true });
  }
  if (!bloecke.length) throw new Error('Die Excel-Datei enthält keine gefüllte Tabelle.');
  return bloecke;
}

function leseBeziehungen(xml) {
  const karte = new Map();
  if (!xml) return karte;
  const baum = new DOMParser().parseFromString(xml, 'application/xml');
  for (const b of baum.getElementsByTagName('Relationship')) {
    karte.set(b.getAttribute('Id'), b.getAttribute('Target').replace(/^\//, ''));
  }
  return karte;
}

function leseGemeinsameTexte(xml) {
  if (!xml) return [];
  const baum = new DOMParser().parseFromString(xml, 'application/xml');
  return [...baum.getElementsByTagNameNS(NS_S, 'si')].map((si) => {
    /* Ein Eintrag kann aus mehreren Läufen bestehen — verschieden formatierte
       Teile derselben Zelle. Für uns zählt der Text, nicht die Formatierung. */
    const teile = [...si.getElementsByTagNameNS(NS_S, 't')].map((t) => t.textContent);
    return teile.join('');
  });
}

function leseBlatt(xml, gemeinsam) {
  const baum = new DOMParser().parseFromString(xml, 'application/xml');
  const zeilen = [];
  for (const zeile of baum.getElementsByTagNameNS(NS_S, 'row')) {
    const werte = [];
    for (const zelle of zeile.getElementsByTagNameNS(NS_S, 'c')) {
      const spalte = spaltenIndex(zelle.getAttribute('r') || 'A');
      const art = zelle.getAttribute('t');
      let wert = '';
      if (art === 's') {
        const nummer = Number(zelle.getElementsByTagNameNS(NS_S, 'v')[0]?.textContent);
        wert = gemeinsam[nummer] ?? '';
      } else if (art === 'inlineStr') {
        wert = [...zelle.getElementsByTagNameNS(NS_S, 't')].map((t) => t.textContent).join('');
      } else {
        wert = zelle.getElementsByTagNameNS(NS_S, 'v')[0]?.textContent ?? '';
      }
      while (werte.length < spalte) werte.push('');
      werte[spalte] = String(wert);
    }
    /* Ganz leere Zeilen fallen weg; Excel legt sie großzügig an. */
    if (werte.some((w) => w.trim())) zeilen.push(werte);
  }
  return zeilen;
}

/* ---------- CSV, Text, Markdown ------------------------------------------- */

/** CSV nach RFC 4180: Komma oder Semikolon, Anführungszeichen verdoppelt. */
export function ausCsv(text) {
  const trenner = (text.split('\n')[0].match(/;/g)?.length || 0) > (text.split('\n')[0].match(/,/g)?.length || 0) ? ';' : ',';
  const zeilen = [];
  let zeile = [], feld = '', inAnfuehrung = false;

  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i];
    if (inAnfuehrung) {
      if (zeichen === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (zeichen === '"') inAnfuehrung = false;
      else feld += zeichen;
    } else if (zeichen === '"') inAnfuehrung = true;
    else if (zeichen === trenner) { zeile.push(feld); feld = ''; }
    else if (zeichen === '\n') { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ''; }
    else if (zeichen !== '\r') feld += zeichen;
  }
  if (feld || zeile.length) { zeile.push(feld); zeilen.push(zeile); }

  const gefuellt = zeilen.filter((z) => z.some((f) => f.trim()));
  if (!gefuellt.length) return [];
  return [{ art: 'tabelle', zeilen: gefuellt, kopf: true }];
}

export function ausText(text) {
  return text
    .split(/\n\s*\n/)
    .map((teil) => teil.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((teil) => ({ art: 'absatz', laeufe: [{ text: teil }] }));
}

/**
 * Markdown, so weit es ohne Zweifel geht: Überschriften, Aufzählungen,
 * Zitat, Trennlinie, Code, **fett** und *kursiv*. Alles andere bleibt Text —
 * lieber ein Sternchen zu viel auf dem Papier als ein verschluckter Satz.
 */
export function ausMarkdown(text) {
  const bloecke = [];
  const zeilen = text.split(/\r?\n/);
  let absatz = [];
  let imCode = false;
  let code = [];

  const schliesseAbsatz = () => {
    if (!absatz.length) return;
    bloecke.push({ art: 'absatz', laeufe: markdownLaeufe(absatz.join(' ')) });
    absatz = [];
  };

  for (const zeile of zeilen) {
    if (/^```/.test(zeile)) {
      if (imCode) { bloecke.push({ art: 'code', text: code.join('\n') }); code = []; }
      else schliesseAbsatz();
      imCode = !imCode;
      continue;
    }
    if (imCode) { code.push(zeile); continue; }

    const ueberschrift = /^(#{1,4})\s+(.*)$/.exec(zeile);
    const punkt = /^\s*([-*+]|\d+\.)\s+(.*)$/.exec(zeile);
    if (!zeile.trim()) { schliesseAbsatz(); continue; }
    if (/^\s*(---|\*\*\*|___)\s*$/.test(zeile)) { schliesseAbsatz(); bloecke.push({ art: 'linie' }); continue; }
    if (ueberschrift) {
      schliesseAbsatz();
      bloecke.push({ art: 'ueberschrift', stufe: ueberschrift[1].length, laeufe: markdownLaeufe(ueberschrift[2]) });
    } else if (punkt) {
      schliesseAbsatz();
      const ebene = Math.min(2, Math.floor((/^\s*/.exec(zeile)[0].length) / 2));
      bloecke.push({ art: 'punkt', ebene, laeufe: markdownLaeufe(punkt[2]) });
    } else if (/^>\s?/.test(zeile)) {
      schliesseAbsatz();
      bloecke.push({ art: 'zitat', laeufe: markdownLaeufe(zeile.replace(/^>\s?/, '')) });
    } else {
      absatz.push(zeile.trim());
    }
  }
  if (imCode && code.length) bloecke.push({ art: 'code', text: code.join('\n') });
  schliesseAbsatz();
  return bloecke;
}

/** **fett** und *kursiv* in Läufe zerlegen. */
export function markdownLaeufe(text) {
  const laeufe = [];
  const muster = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;
  let letzte = 0, treffer;
  while ((treffer = muster.exec(text))) {
    if (treffer.index > letzte) laeufe.push({ text: text.slice(letzte, treffer.index) });
    if (treffer[2] != null) laeufe.push({ text: treffer[2], fett: true });
    else if (treffer[4] != null) laeufe.push({ text: treffer[4], kursiv: true });
    else laeufe.push({ text: treffer[5], fest: true });
    letzte = muster.lastIndex;
  }
  if (letzte < text.length) laeufe.push({ text: text.slice(letzte) });
  return laeufe.length ? laeufe : [{ text }];
}

/* ---------- Setzen -------------------------------------------------------- */

/* Helvetica kann nur WinAnsi. Dieselbe Ersetzungstabelle wie in der Ausgabe —
   bewusst hier noch einmal, damit dieses Modul für sich prüfbar bleibt. */
const ERSATZ = {
  '„': '"', '“': '"', '”': '"', '‚': "'", '‘': "'", '’': "'",
  '–': '-', '—': '-', '‐': '-', '‑': '-', '…': '...', ' ': ' ',
  '−': '-', '′': "'", '″': '"', '\t': '   ', '•': '-', '→': '->',
};
export function nurWinAnsi(text) {
  let ergebnis = '';
  for (const zeichen of String(text)) {
    if (ERSATZ[zeichen] != null) { ergebnis += ERSATZ[zeichen]; continue; }
    const nummer = zeichen.codePointAt(0);
    if (nummer >= 32 && nummer <= 126) ergebnis += zeichen;
    else if (nummer >= 160 && nummer <= 255) ergebnis += zeichen;
    else if (zeichen === '\n') ergebnis += '\n';
    else ergebnis += ' ';
  }
  return ergebnis;
}

/**
 * Bricht Läufe auf eine Breite um. Ein Lauf darf mitten im Wort enden — die
 * Formatierung wechselt schließlich nicht an Wortgrenzen.
 * @returns {{text: string, fett?: boolean, kursiv?: boolean}[][]} Zeilen aus Läufen
 */
export function umbrecheLaeufe(laeufe, breite, groesse, messer) {
  const zeilen = [];
  let zeile = [], zeilenBreite = 0;

  const neueZeile = () => { zeilen.push(zeile); zeile = []; zeilenBreite = 0; };

  for (const lauf of laeufe) {
    const stuecke = nurWinAnsi(lauf.text).split(/(\s+)/);
    for (const stueck of stuecke) {
      if (stueck === '') continue;
      if (stueck.includes('\n')) { neueZeile(); continue; }
      const wortBreite = messer(stueck, groesse, lauf);
      if (zeilenBreite + wortBreite > breite && zeilenBreite > 0) {
        if (/^\s+$/.test(stueck)) { neueZeile(); continue; }
        neueZeile();
      }
      if (/^\s+$/.test(stueck) && zeilenBreite === 0) continue;
      zeile.push({ ...lauf, text: stueck });
      zeilenBreite += wortBreite;
    }
  }
  if (zeile.length) zeilen.push(zeile);
  return zeilen.length ? zeilen : [[]];
}

/**
 * Setzt Blöcke auf A4 und gibt die PDF-Bytes zurück.
 * @param {object[]} bloecke
 * @param {{titel?: string}} optionen
 */
export async function setze(bloecke, { titel = 'Ohne Titel' } = {}) {
  const pdflib = await import(fremdWeg('pdf-lib.mjs'));
  const { PDFDocument, StandardFonts, rgb } = pdflib;
  const doc = await PDFDocument.create();

  const schriften = {
    normal: await doc.embedFont(StandardFonts.Helvetica),
    fett: await doc.embedFont(StandardFonts.HelveticaBold),
    kursiv: await doc.embedFont(StandardFonts.HelveticaOblique),
    fettKursiv: await doc.embedFont(StandardFonts.HelveticaBoldOblique),
    fest: await doc.embedFont(StandardFonts.Courier),
  };
  const schriftVon = (lauf = {}) => {
    if (lauf.fest) return schriften.fest;
    if (lauf.fett && lauf.kursiv) return schriften.fettKursiv;
    if (lauf.fett) return schriften.fett;
    if (lauf.kursiv) return schriften.kursiv;
    return schriften.normal;
  };
  const messer = (text, groesse, lauf) => schriftVon(lauf).widthOfTextAtSize(text, groesse);

  const nutzbreite = A4.breite - RAND.links - RAND.rechts;
  let seite = null, y = 0;

  const neueSeite = () => {
    seite = doc.addPage([A4.breite, A4.hoehe]);
    y = A4.hoehe - RAND.oben;
  };
  const platz = (hoehe) => {
    if (!seite || y - hoehe < RAND.unten) neueSeite();
  };
  const schreibeZeile = (laeufe, groesse, x0, farbe = rgb(0.07, 0.07, 0.08)) => {
    let x = x0;
    for (const lauf of laeufe) {
      const schrift = schriftVon(lauf);
      seite.drawText(lauf.text, { x, y, size: groesse, font: schrift, color: farbe });
      x += schrift.widthOfTextAtSize(lauf.text, groesse);
    }
  };

  neueSeite();

  for (const block of bloecke) {
    if (block.art === 'seitenumbruch') { neueSeite(); continue; }

    if (block.art === 'linie') {
      platz(18);
      y -= 8;
      seite.drawLine({
        start: { x: RAND.links, y }, end: { x: A4.breite - RAND.rechts, y },
        thickness: 0.6, color: rgb(0.75, 0.75, 0.73),
      });
      y -= 10;
      continue;
    }

    if (block.art === 'tabelle') { y = setzeTabelle(block); continue; }

    if (block.art === 'code') {
      const groesse = 9;
      for (const zeile of nurWinAnsi(block.text).split('\n')) {
        platz(groesse * ZEILE);
        y -= groesse * ZEILE;
        seite.drawRectangle({
          x: RAND.links - 6, y: y - groesse * 0.32, width: nutzbreite + 12, height: groesse * ZEILE,
          color: rgb(0.96, 0.96, 0.95),
        });
        schreibeZeile([{ text: zeile, fest: true }], groesse, RAND.links, rgb(0.15, 0.2, 0.2));
      }
      y -= 6;
      continue;
    }

    const ueberschrift = block.art === 'ueberschrift';
    const punkt = block.art === 'punkt';
    const zitat = block.art === 'zitat';
    const groesse = ueberschrift ? UEBERSCHRIFT[Math.min(3, (block.stufe || 1) - 1)] : GRUNDGROESSE;
    const einzug = punkt ? 14 + (block.ebene || 0) * 14 : zitat ? 16 : 0;
    const laeufe = ueberschrift
      ? block.laeufe.map((l) => ({ ...l, fett: true }))
      : block.laeufe;

    if (ueberschrift) y -= groesse * 0.7;

    const zeilen = umbrecheLaeufe(laeufe, nutzbreite - einzug, groesse, messer);
    zeilen.forEach((zeile, i) => {
      platz(groesse * ZEILE);
      y -= groesse * ZEILE;
      if (punkt && i === 0) {
        schreibeZeile([{ text: (block.ebene || 0) === 0 ? '•' : '–' }], groesse, RAND.links + einzug - 12);
      }
      if (zitat) {
        seite.drawLine({
          start: { x: RAND.links + 4, y: y - groesse * 0.28 }, end: { x: RAND.links + 4, y: y + groesse * 0.9 },
          thickness: 2, color: rgb(0.06, 0.46, 0.43),
        });
      }
      schreibeZeile(zeile, groesse, RAND.links + einzug,
        zitat ? rgb(0.3, 0.32, 0.32) : rgb(0.07, 0.07, 0.08));
    });
    y -= ueberschrift ? groesse * 0.42 : groesse * 0.5;
  }

  /* Der Tabellensetzer sitzt innen: er braucht Seite, y und die Schriften.
     Kopfzeilen werden auf jeder neuen Seite wiederholt — eine Tabelle ohne
     Kopf ab Seite zwei ist eine Zahlenwüste. */
  function setzeTabelle(block) {
    const groesse = block.zeilen[0]?.length > 6 ? 8 : 9.5;
    const spalten = Math.max(...block.zeilen.map((z) => z.length));
    const breiten = spaltenBreiten(block.zeilen, spalten, nutzbreite, groesse, messer);
    const polster = 4;

    const zeichneZeile = (werte, istKopf, { wiederholen = true } = {}) => {
      const zellZeilen = werte.map((wert, s) => umbrecheLaeufe(
        [{ text: String(wert ?? ''), fett: istKopf }], breiten[s] - polster * 2, groesse, messer));
      const hoehe = Math.max(...zellZeilen.map((z) => z.length)) * groesse * 1.25 + polster * 2;
      if (!seite || y - hoehe < RAND.unten) {
        neueSeite();
        /* Die Kopfzeile wandert mit: eine Tabelle ohne Kopf ab Seite zwei ist
           eine Zahlenwüste. */
        if (block.kopf && !istKopf && wiederholen) zeichneZeile(block.zeilen[0], true, { wiederholen: false });
      }
      const oben = y;
      if (istKopf) {
        seite.drawRectangle({
          x: RAND.links, y: oben - hoehe, width: breiten.reduce((a, b) => a + b, 0), height: hoehe,
          color: rgb(0.94, 0.95, 0.94),
        });
      }
      let x = RAND.links;
      zellZeilen.forEach((zeilenDerZelle, s) => {
        let zy = oben - polster;
        for (const zeile of zeilenDerZelle) {
          zy -= groesse * 1.05;
          let zx = x + polster;
          for (const lauf of zeile) {
            const schrift = schriftVon(lauf);
            seite.drawText(lauf.text, { x: zx, y: zy, size: groesse, font: schrift, color: rgb(0.07, 0.07, 0.08) });
            zx += schrift.widthOfTextAtSize(lauf.text, groesse);
          }
          zy -= groesse * 0.2;
        }
        x += breiten[s];
      });
      /* Raster: waagerecht unter jeder Zeile, senkrecht an jeder Spaltengrenze. */
      const gesamt = breiten.reduce((a, b) => a + b, 0);
      seite.drawLine({
        start: { x: RAND.links, y: oben - hoehe }, end: { x: RAND.links + gesamt, y: oben - hoehe },
        thickness: 0.5, color: rgb(0.78, 0.78, 0.76),
      });
      let gx = RAND.links;
      for (let s = 0; s <= spalten; s++) {
        seite.drawLine({
          start: { x: gx, y: oben }, end: { x: gx, y: oben - hoehe },
          thickness: 0.5, color: rgb(0.86, 0.86, 0.84),
        });
        gx += breiten[s] || 0;
      }
      y = oben - hoehe;
    };

    const [kopf, ...rest] = block.zeilen;
    zeichneZeile(kopf, !!block.kopf, { wiederholen: false });
    for (const zeile of rest) zeichneZeile(zeile, false);
    y -= 10;
    return y;
  }

  doc.setTitle(titel);
  doc.setProducer('Werkbank');
  doc.setCreator('Werkbank');
  /* Sprache setzen: ohne sie liest eine Sprachausgabe deutschen Text englisch
     vor. Dieselbe Regel wie in barrierefrei.js. */
  try { doc.catalog.set(pdflib.PDFName.of('Lang'), pdflib.PDFString.of('de-DE')); } catch { /* ältere Fassung */ }

  return doc.save();
}

/**
 * Spaltenbreiten aus dem Inhalt: der längste Eintrag je Spalte bestimmt den
 * Wunsch, danach wird auf die verfügbare Breite gestaucht. Eine Spalte bekommt
 * nie weniger als 8 % — sonst steht dort eine Buchstabensäule.
 */
export function spaltenBreiten(zeilen, spalten, verfuegbar, groesse, messer) {
  const wunsch = new Array(spalten).fill(24);
  for (const zeile of zeilen) {
    for (let s = 0; s < spalten; s++) {
      const text = nurWinAnsi(String(zeile[s] ?? ''));
      wunsch[s] = Math.max(wunsch[s], Math.min(220, messer(text, groesse, {}) + 12));
    }
  }
  const summe = wunsch.reduce((a, b) => a + b, 0);
  const kleinste = verfuegbar * 0.08;
  let breiten = wunsch.map((w) => Math.max(kleinste, (w / summe) * verfuegbar));
  const nach = breiten.reduce((a, b) => a + b, 0);
  breiten = breiten.map((b) => (b / nach) * verfuegbar);
  return breiten;
}
