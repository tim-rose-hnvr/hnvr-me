/* Word — den Text eines PDFs als .docx ausgeben.

   Was hier passiert und was nicht: Ein PDF beschreibt Buchstaben an Punkten,
   kein Word beschreibt Absätze. Diese Ausgabe stellt den Aufbau wieder her,
   den man aus den Buchstaben ablesen kann — Zeilen, Absätze, Überschriften,
   fette und kursive Stellen, Seitenumbrüche. Sie stellt nicht das Layout
   wieder her: keine Spalten, keine Tabellenraster, keine Bilder.

   Das ist ehrlicher als eine Nachbildung, die im Word-Fenster zerfällt,
   sobald jemand ein Wort einfügt. Wer das Aussehen braucht, nimmt das PDF.

   Für Scans gilt: liegt eine Texterkennung vor, wandert deren Text mit. */

import { zustand } from './kern.js';
import { holeSeite, seitenText } from './dokument.js';
import { schreibeZip } from './zip.js';

/* ---------- Aufbau aus den Buchstaben lesen ------------------------------- */

/** Sammelt die Stücke einer Seite zu Zeilen. */
async function zeilenDerSeite(eintrag) {
  const erkannt = zustand.ocr.get(eintrag.id);
  const { roh } = await seitenText(eintrag);

  if (roh.trim().length < 40 && erkannt) {
    // Erkannter Scan: die Zeilen stehen schon fest.
    return erkannt.zeilen.map((zeile) => ({
      text: zeile.text,
      y: zeile.woerter[0]?.y ?? 0,
      groesse: zeile.woerter[0]?.h ?? 11,
      teile: [{ text: zeile.text, fett: false, kursiv: false }],
    }));
  }

  const seite = await holeSeite(eintrag);
  const inhalt = await seite.getTextContent();

  /* pdf.js nennt Schriften in der Textebene nur mit einer laufenden Kennung
     ("g_d0_f1"). Der wirkliche Name — und damit fett oder kursiv — steht erst
     bereit, wenn die Seite einmal durch die Befehlsliste gelaufen ist. */
  const schriftnamen = new Map();
  try { await seite.getOperatorList(); } catch { /* dann eben ohne Auszeichnung */ }
  const schriftname = (kennung) => {
    if (!schriftnamen.has(kennung)) {
      let name = kennung;
      try { name = seite.commonObjs.get(kennung)?.name || kennung; } catch { name = kennung; }
      schriftnamen.set(kennung, String(name));
    }
    return schriftnamen.get(kennung);
  };

  const stuecke = inhalt.items
    .filter((i) => i.str && i.str.trim() !== '')
    .map((i) => ({
      text: i.str,
      x: i.transform[4],
      y: i.transform[5],
      groesse: Math.abs(i.height) || Math.hypot(i.transform[2], i.transform[3]) || 11,
      schrift: schriftname(i.fontName || ''),
    }));
  if (!stuecke.length) return [];

  const zeilen = [];
  for (const stueck of stuecke) {
    const passend = zeilen.find((z) => Math.abs(z.y - stueck.y) <= Math.max(1.2, stueck.groesse * 0.4));
    if (passend) passend.stuecke.push(stueck);
    else zeilen.push({ y: stueck.y, stuecke: [stueck] });
  }
  zeilen.sort((a, b) => b.y - a.y);

  return zeilen.map((zeile) => {
    zeile.stuecke.sort((a, b) => a.x - b.x);
    const teile = [];
    for (const stueck of zeile.stuecke) {
      const fett = /bold|black|heavy|semibold/i.test(stueck.schrift);
      const kursiv = /italic|oblique/i.test(stueck.schrift);
      const letztes = teile.at(-1);
      // Gleiche Auszeichnung: zusammenfassen, sonst entstehen hundert Läufe.
      if (letztes && letztes.fett === fett && letztes.kursiv === kursiv) {
        const luecke = stueck.x - (letztes.endeX ?? stueck.x);
        letztes.text += (luecke > stueck.groesse * 0.28 && !/\s$/.test(letztes.text) ? ' ' : '') + stueck.text;
        letztes.endeX = stueck.x + (stueck.text.length * stueck.groesse * 0.5);
      } else {
        teile.push({ text: stueck.text, fett, kursiv, endeX: stueck.x + (stueck.text.length * stueck.groesse * 0.5) });
      }
    }
    return {
      y: zeile.y,
      groesse: Math.max(...zeile.stuecke.map((s) => s.groesse)),
      text: teile.map((t) => t.text).join(''),
      teile: teile.map(({ text, fett, kursiv }) => ({ text, fett, kursiv })),
    };
  }).filter((z) => z.text.trim() !== '');
}

/** Fasst Zeilen zu Absätzen zusammen und erkennt Überschriften. */
function absaetzeAusZeilen(zeilen, { ueberschriftenErkennen = true } = {}) {
  if (!zeilen.length) return [];
  const groessen = zeilen.map((z) => z.groesse).sort((a, b) => a - b);
  const grundgroesse = groessen[Math.floor(groessen.length / 2)] || 11;

  const absaetze = [];
  let laufend = null;

  for (let i = 0; i < zeilen.length; i++) {
    const zeile = zeilen[i];
    const vorige = zeilen[i - 1];
    const abstand = vorige ? vorige.y - zeile.y : 0;
    const istUeberschrift = ueberschriftenErkennen
      && zeile.groesse >= grundgroesse * 1.22
      && zeile.text.trim().length < 90;
    const neuerAbsatz = !laufend
      || istUeberschrift
      || laufend.ueberschrift
      || (vorige && abstand > Math.max(zeile.groesse, vorige.groesse) * 1.55);

    if (neuerAbsatz) {
      laufend = {
        ueberschrift: istUeberschrift,
        ebene: istUeberschrift ? (zeile.groesse >= grundgroesse * 1.7 ? 1 : 2) : 0,
        teile: [...zeile.teile],
      };
      absaetze.push(laufend);
    } else {
      // Getrennte Wörter am Zeilenende wieder zusammenziehen.
      const letztes = laufend.teile.at(-1);
      if (letztes && /[a-zäöüß]-$/.test(letztes.text)) letztes.text = letztes.text.slice(0, -1);
      else if (letztes && !/\s$/.test(letztes.text)) letztes.text += ' ';
      laufend.teile.push(...zeile.teile);
    }
  }
  return absaetze;
}

/* ---------- XML ------------------------------------------------------------ */

function schuetze(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function laufZuXml(teil) {
  const auszeichnung = `${teil.fett ? '<w:b/>' : ''}${teil.kursiv ? '<w:i/>' : ''}`;
  return `<w:r><w:rPr>${auszeichnung}</w:rPr><w:t xml:space="preserve">${schuetze(teil.text)}</w:t></w:r>`;
}

function absatzZuXml(absatz) {
  const stil = absatz.ueberschrift ? `<w:pStyle w:val="Ueberschrift${absatz.ebene}"/>` : '';
  return `<w:p><w:pPr>${stil}</w:pPr>${absatz.teile.map(laufZuXml).join('')}</w:p>`;
}

const STILE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Standard"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Ueberschrift1"><w:name w:val="heading 1"/><w:basedOn w:val="Standard"/><w:pPr><w:outlineLvl w:val="0"/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Ueberschrift2"><w:name w:val="heading 2"/><w:basedOn w:val="Standard"/><w:pPr><w:outlineLvl w:val="1"/><w:spacing w:before="200" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
</w:styles>`;

const INHALTSARTEN = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const WURZELBEZUG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

const DOKUMENTBEZUG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`;

/* Word erwartet diese beiden Teile nicht zwingend, öffnet damit aber ohne
   Nachfragen und stellt den Zoom vernünftig ein. */
const EINSTELLUNGEN = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="708"/>
  <w:compat/>
</w:settings>`;

const ANWENDUNG = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>PDF Studio</Application>
</Properties>`;

/**
 * Baut das Word-Dokument.
 * @param {{ seiten?: string[], ueberschriftenErkennen?: boolean, seitenumbrueche?: boolean }} optionen
 */
export async function alsWord(optionen = {}) {
  const { seiten = null, ueberschriftenErkennen = true, seitenumbrueche = true } = optionen;
  const folge = seiten ? zustand.folge.filter((e) => seiten.includes(e.id)) : zustand.folge;
  if (!folge.length) throw new Error('Keine Seite ausgewählt.');

  const koerper = [];
  let woerter = 0;
  let seitenOhneText = 0;

  for (const [nummer, eintrag] of folge.entries()) {
    const zeilen = await zeilenDerSeite(eintrag);
    if (!zeilen.length) seitenOhneText++;
    const absaetze = absaetzeAusZeilen(zeilen, { ueberschriftenErkennen });
    for (const absatz of absaetze) {
      woerter += absatz.teile.map((t) => t.text).join(' ').split(/\s+/).filter(Boolean).length;
      koerper.push(absatzZuXml(absatz));
    }
    if (seitenumbrueche && nummer < folge.length - 1) {
      koerper.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
  }

  // Seitenformat aus der ersten Seite übernehmen (Hoch- oder Querformat).
  const erste = await holeSeite(folge[0]);
  const masse = erste.getViewport({ scale: 1, rotation: (erste.rotate + folge[0].drehung) % 360 });
  const breiteTwips = Math.round(masse.width * 20);
  const hoeheTwips = Math.round(masse.height * 20);
  const ausrichtung = masse.width > masse.height ? ' w:orient="landscape"' : '';

  const dokument = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${koerper.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="${breiteTwips}" w:h="${hoeheTwips}"${ausrichtung}/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const titel = zustand.eigenschaften?.titel || zustand.name.replace(/\.pdf$/i, '');
  const eigenschaften = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>${schuetze(titel)}</dc:title>
  <dc:creator>PDF Studio</dc:creator>
  <cp:lastModifiedBy>PDF Studio</cp:lastModifiedBy>
</cp:coreProperties>`;

  const bytes = await schreibeZip([
    { name: '[Content_Types].xml', daten: INHALTSARTEN },
    { name: '_rels/.rels', daten: WURZELBEZUG },
    { name: 'docProps/core.xml', daten: eigenschaften },
    { name: 'word/_rels/document.xml.rels', daten: DOKUMENTBEZUG },
    { name: 'word/document.xml', daten: dokument },
    { name: 'word/styles.xml', daten: STILE },
    { name: 'word/settings.xml', daten: EINSTELLUNGEN },
    { name: 'docProps/app.xml', daten: ANWENDUNG },
  ]);

  return { bytes, woerter, absaetze: koerper.length, seitenOhneText };
}
