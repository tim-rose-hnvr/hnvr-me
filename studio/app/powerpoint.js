/* PowerPoint — je PDF-Seite eine Folie.

   Eine `.pptx` ist wie `.docx` und `.xlsx` ein ZIP mit OOXML darin, also
   braucht es dafür keine fremde Bibliothek, nur `zip.js` und Sorgfalt beim
   Format. Was PowerPoint von Word unterscheidet: dort steht Text in Absätzen
   auf einer Seite, hier in **Rahmen** auf einer Folie, und jeder Rahmen hat
   eine Lage und eine Größe in EMU — englische metrische Einheiten, 914400 je
   Zoll, 12700 je Punkt.

   **Was hier entsteht und was nicht.** Aus einer PDF-Seite wird eine Folie
   mit zwei Rahmen: die erste Zeile als Titel, der Rest als Aufzählung. Das
   ist keine Umwandlung des Layouts — Spalten, Bilder, Farben und Tabellen
   bleiben zurück. Wer das Aussehen braucht, gibt das PDF weiter; wer die
   Sätze in eine Präsentation heben will, nimmt diese Datei.

   Das steht auch im Dialog. Eine Ausgabe, die mehr verspricht, als sie hält,
   kostet mehr Zeit als eine, die es gar nicht gibt. */

import { zustand } from './kern.js';
import { schreibeZip } from './zip.js';
import { seitenText } from './dokument.js';

const EMU_JE_PUNKT = 12700;
/* 16:9 in der Größe, die PowerPoint selbst benutzt: 13,333 × 7,5 Zoll. */
const FOLIE = { breite: 12192000, hoehe: 6858000 };

const schuetze = (text) => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Eine Folie: Titelrahmen oben, Textrahmen darunter. Die Maße sind die
   Vorgaben von PowerPoint für ein 16:9-Layout — so sitzt eine Folie aus
   dieser Datei dort, wo eine von Hand gebaute säße. */
function folieXml(titel, zeilen) {
  const absatz = (text) => `<a:p><a:r><a:rPr lang="de-DE" dirty="0"/><a:t>${schuetze(text)}</a:t></a:r></a:p>`;
  const koerper = zeilen.length ? zeilen.map(absatz).join('') : '<a:p><a:endParaRPr lang="de-DE"/></a:p>';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp>
<p:nvSpPr><p:cNvPr id="2" name="Titel"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="838200" y="365125"/><a:ext cx="10515600" cy="1325563"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/>${absatz(titel)}</p:txBody>
</p:sp>
<p:sp>
<p:nvSpPr><p:cNvPr id="3" name="Inhalt"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="838200" y="1825625"/><a:ext cx="10515600" cy="4351338"/></a:xfrm></p:spPr>
<p:txBody><a:bodyPr/><a:lstStyle/>${koerper}</p:txBody>
</p:sp>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

const LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="obj" preserve="1">
<p:cSld name="Titel und Inhalt"><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
<p:sp><p:nvSpPr><p:cNvPr id="2" name="Titel"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="de-DE"/></a:p></p:txBody></p:sp>
<p:sp><p:nvSpPr><p:cNvPr id="3" name="Inhalt"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="de-DE"/></a:p></p:txBody></p:sp>
</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>
<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4000"/></a:lvl1pPr></p:titleStyle>
<p:bodyStyle><a:lvl1pPr marL="285750" indent="-285750"><a:buChar char="•"/><a:defRPr sz="1800"/></a:lvl1pPr></p:bodyStyle>
<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>
</p:sldMaster>`;

const THEMA = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="PDF Studio">
<a:themeElements>
<a:clrScheme name="PDF Studio"><a:dk1><a:srgbClr val="171C20"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
<a:dk2><a:srgbClr val="1D2327"/></a:dk2><a:lt2><a:srgbClr val="EFF1F2"/></a:lt2>
<a:accent1><a:srgbClr val="0F766E"/></a:accent1><a:accent2><a:srgbClr val="7FD6CD"/></a:accent2>
<a:accent3><a:srgbClr val="B4530A"/></a:accent3><a:accent4><a:srgbClr val="5F686E"/></a:accent4>
<a:accent5><a:srgbClr val="8B3A3A"/></a:accent5><a:accent6><a:srgbClr val="333B40"/></a:accent6>
<a:hlink><a:srgbClr val="0F766E"/></a:hlink><a:folHlink><a:srgbClr val="5F686E"/></a:folHlink></a:clrScheme>
<a:fontScheme name="PDF Studio">
<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>
<a:fmtScheme name="PDF Studio">
<a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
<a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
</a:fmtScheme></a:themeElements></a:theme>`;

/**
 * Gibt das Arbeitsdokument als .pptx aus — je Seite eine Folie.
 * @param {{seiten?: string[], zeilenJeFolie?: number}} optionen
 */
export async function alsPowerPoint({ seiten = null, zeilenJeFolie = 12 } = {}) {
  const folge = seiten ? zustand.folge.filter((e) => seiten.includes(e.id)) : zustand.folge;
  if (!folge.length) throw new Error('Keine Seite ausgewählt.');

  const folien = [];
  let uebernommen = 0;
  let leer = 0;

  for (const [nummer, eintrag] of folge.entries()) {
    const erkannt = zustand.ocr.get(eintrag.id);
    const { roh } = await seitenText(eintrag);
    const text = roh.trim().length >= 40 ? roh
      : (erkannt?.zeilen || []).map((z) => z.text).join('\n');

    const zeilen = String(text).split('\n').map((z) => z.trim()).filter(Boolean);
    if (!zeilen.length) leer += 1;
    /* Die erste Zeile wird der Titel. Das trifft bei Berichten und Protokollen
       fast immer und ist bei Fließtext höchstens unglücklich, nie falsch. */
    const titel = zeilen[0] || `Seite ${nummer + 1}`;
    const rest = zeilen.slice(1, 1 + zeilenJeFolie);
    uebernommen += rest.length + (zeilen.length ? 1 : 0);
    folien.push(folieXml(titel, rest));
  }

  const folienNamen = folien.map((_, i) => `ppt/slides/slide${i + 1}.xml`);
  const folienIds = folien.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  const folienBeziehungen = folien.map((_, i) =>
    `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');

  const dateien = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
${folien.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`,
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" saveSubsetFonts="1">
<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
<p:sldIdLst>${folienIds}</p:sldIdLst>
<p:sldSz cx="${FOLIE.breite}" cy="${FOLIE.hoehe}"/><p:notesSz cx="${FOLIE.hoehe}" cy="${FOLIE.breite}"/>
</p:presentation>`,
    'ppt/_rels/presentation.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
${folienBeziehungen}
<Relationship Id="rId${folien.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`,
    'ppt/slideMasters/slideMaster1.xml': MASTER,
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`,
    'ppt/slideLayouts/slideLayout1.xml': LAYOUT,
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`,
    'ppt/theme/theme1.xml': THEMA,
    'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${schuetze(zustand.eigenschaften?.titel || zustand.name.replace(/\.pdf$/i, ''))}</dc:title>
<dc:creator>PDF Studio</dc:creator><cp:lastModifiedBy>PDF Studio</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`,
    'docProps/app.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>PDF Studio</Application><Slides>${folien.length}</Slides><PresentationFormat>Breitbild</PresentationFormat>
</Properties>`,
  };
  folien.forEach((xml, i) => { dateien[folienNamen[i]] = xml; });

  const bytes = await schreibeZip(Object.entries(dateien).map(([name, inhalt]) => ({
    name, daten: new TextEncoder().encode(inhalt),
  })));
  return { bytes, folien: folien.length, zeilen: uebernommen, leereFolien: leer };
}
