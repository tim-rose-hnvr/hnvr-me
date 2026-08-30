/* Dokumentteile — Lesezeichen, Dateianhänge, Vorabprüfung.

   Drei Fähigkeiten, die eines gemeinsam haben: sie hängen am Dokument als
   Ganzem, nicht an einer Seite und nicht an einer Stelle. Deshalb stehen sie
   zusammen und nicht bei den Anmerkungen.

   **Lesezeichen** las das Studio bisher nur. Beim Sichern blieben sie
   erhalten, solange die Seitenfolge unverändert war — anlegen oder ändern
   ging nicht. Bei einer 200-seitigen Sitzungsmappe ist das der Unterschied
   zwischen brauchbar und unbrauchbar.

   **Dateianhänge** sind Dateien *im* PDF: die Rechnung im Vertrag, die
   Tabelle zum Bericht. Jeder Betrachter zeigt sie als Büroklammer.

   **Die Vorabprüfung** sagt, was einer Datei zum Druck oder zur Archivierung
   fehlt: nicht eingebettete Schriften, zu grobe Bilder, Verschlüsselung,
   uneinheitliche Seitenmaße. Sie ändert nichts — sie sieht nach. Das ist der
   ganze Sinn: wer eine Datei weitergibt, will vorher wissen, woran sie
   scheitert, nicht hinterher.

   **PDF/A** wird hier ausdrücklich *vorbereitet* und nicht behauptet. Was das
   Studio setzen kann — Ausgabeabsicht, XMP-Kennzeichnung, eingebettete
   Schriften —, setzt es. Ob die Datei danach die Norm erfüllt, sagt ein
   Prüfprogramm wie veraPDF, nicht wir. Ein „PDF/A" auf dem Knopf, hinter dem
   keine Prüfung steht, ist eine Zusage, die niemand halten kann. */

import { zustand, melde, sage, fremdWeg } from './kern.js';
import { holeSeite } from './dokument.js';

/* ---------- Lesezeichen --------------------------------------------------- */

/**
 * Die Gliederung als flache Liste mit Ebene — so lässt sie sich als Liste
 * anzeigen und bearbeiten, ohne dass ein Baum-Bauteil nötig wird.
 * @returns {Promise<Array<{titel: string, seite: number, ebene: number}>>}
 */
export async function lesezeichenListe() {
  if (zustand.lesezeichen) return zustand.lesezeichen;
  const quelle = [...zustand.quellen.values()][0];
  const raus = [];
  if (quelle?.pdf && zustand.gliederung?.length) {
    const sammle = async (knoten, ebene) => {
      for (const punkt of knoten) {
        let seite = 1;
        try {
          const ziel = typeof punkt.dest === 'string'
            ? await quelle.pdf.getDestination(punkt.dest) : punkt.dest;
          const index = await quelle.pdf.getPageIndex(ziel[0]);
          const stelle = zustand.folge.findIndex((e) => e.quelleId === quelle.id && e.index === index);
          if (stelle >= 0) seite = stelle + 1;
        } catch { /* Lesezeichen ins Leere — es zeigt dann auf Seite 1 */ }
        raus.push({ titel: punkt.title || '(ohne Titel)', seite, ebene });
        if (punkt.items?.length) await sammle(punkt.items, ebene + 1);
      }
    };
    await sammle(zustand.gliederung, 0);
  }
  zustand.lesezeichen = raus;
  return raus;
}

/** Setzt die Liste. `null` heißt: keine Lesezeichen mehr. */
export function setzeLesezeichen(liste) {
  zustand.lesezeichen = liste;
  zustand.geaendert = true;
  melde('lesezeichen:geaendert');
  melde('seiten:geaendert');
}

/**
 * Schreibt die Gliederung in ein pdf-lib-Dokument.
 *
 * pdf-lib bringt dafür nichts mit, also wird der Katalogeintrag von Hand
 * gebaut: /Outlines mit /First, /Last, /Count und je Eintrag /Parent, /Prev,
 * /Next, /Dest. Das ist der Teil des Formats, der am ehesten kaputtgeht —
 * deshalb prüft der Prüflauf die geschriebene Datei mit pdf.js gegen.
 */
export async function schreibeLesezeichen(dokument, pdflib, liste) {
  if (!liste?.length) return;
  const { PDFDict, PDFName, PDFNumber, PDFArray, PDFString } = pdflib;
  const kontext = dokument.context;
  const seiten = dokument.getPages();

  /* Aus der flachen Liste mit Ebene wieder einen Baum machen. */
  const wurzel = [];
  const stapel = [{ kinder: wurzel, ebene: -1 }];
  for (const eintrag of liste) {
    while (stapel.length > 1 && stapel[stapel.length - 1].ebene >= eintrag.ebene) stapel.pop();
    const knoten = { ...eintrag, kinder: [] };
    stapel[stapel.length - 1].kinder.push(knoten);
    stapel.push({ kinder: knoten.kinder, ebene: eintrag.ebene });
  }

  const baue = (knoten, elternRef) => {
    const referenzen = knoten.map(() => kontext.nextRef());
    knoten.forEach((punkt, i) => {
      const seite = seiten[Math.min(seiten.length, Math.max(1, punkt.seite)) - 1];
      const ziel = PDFArray.withContext(kontext);
      ziel.push(seite.ref);
      ziel.push(PDFName.of('Fit'));

      const eintraege = new Map([
        [PDFName.of('Title'), PDFString.of(punkt.titel || '(ohne Titel)')],
        [PDFName.of('Parent'), elternRef],
        [PDFName.of('Dest'), ziel],
      ]);
      if (i > 0) eintraege.set(PDFName.of('Prev'), referenzen[i - 1]);
      if (i < knoten.length - 1) eintraege.set(PDFName.of('Next'), referenzen[i + 1]);

      const kinder = punkt.kinder.length ? baue(punkt.kinder, referenzen[i]) : null;
      if (kinder) {
        eintraege.set(PDFName.of('First'), kinder.erste);
        eintraege.set(PDFName.of('Last'), kinder.letzte);
        /* Negativ heißt: zugeklappt. Eine Mappe, die beim Öffnen komplett
           aufgeklappt ist, hilft niemandem. */
        eintraege.set(PDFName.of('Count'), PDFNumber.of(-kinder.anzahl));
      }
      kontext.assign(referenzen[i], PDFDict.fromMapWithContext(eintraege, kontext));
    });
    return { erste: referenzen[0], letzte: referenzen[referenzen.length - 1], anzahl: knoten.length };
  };

  const wurzelRef = kontext.nextRef();
  const oben = baue(wurzel, wurzelRef);
  kontext.assign(wurzelRef, PDFDict.fromMapWithContext(new Map([
    [PDFName.of('Type'), PDFName.of('Outlines')],
    [PDFName.of('First'), oben.erste],
    [PDFName.of('Last'), oben.letzte],
    [PDFName.of('Count'), PDFNumber.of(oben.anzahl)],
  ]), kontext));
  dokument.catalog.set(PDFName.of('Outlines'), wurzelRef);
}

/* ---------- Dateianhänge -------------------------------------------------- */

/** Die Anhänge des Arbeitsdokuments: [{ name, bytes, art, beschreibung }] */
export function anhaenge() { return zustand.anhaenge || []; }

export function fuegeAnhangAn(anhang) {
  zustand.anhaenge = [...anhaenge(), anhang];
  zustand.geaendert = true;
  melde('anhaenge:geaendert');
}

export function entferneAnhang(name) {
  zustand.anhaenge = anhaenge().filter((a) => a.name !== name);
  zustand.geaendert = true;
  melde('anhaenge:geaendert');
}

/** Liest die Anhänge, die schon in der Datei stecken. */
export async function lieseAnhaenge() {
  const quelle = [...zustand.quellen.values()][0];
  if (!quelle?.pdf) return [];
  try {
    const gefunden = await quelle.pdf.getAttachments();
    if (!gefunden) return [];
    return Object.entries(gefunden).map(([name, wert]) => ({
      name: wert.filename || name,
      bytes: wert.content,
      beschreibung: wert.description || '',
      ausDerDatei: true,
    }));
  } catch { return []; }
}

/** Schreibt die Anhänge in ein pdf-lib-Dokument. */
export async function schreibeAnhaenge(dokument, liste) {
  for (const anhang of liste || []) {
    await dokument.attach(anhang.bytes, anhang.name, {
      mimeType: anhang.art || 'application/octet-stream',
      description: anhang.beschreibung || '',
      creationDate: new Date(),
      modificationDate: new Date(),
    });
  }
}

/* ---------- Vorabprüfung -------------------------------------------------- */

/* Was geprüft wird, und warum es zählt. Jeder Befund nennt die Folge, nicht
   nur den Zustand — „Schrift nicht eingebettet" sagt nichts, „auf einem
   fremden Rechner wird sie ersetzt und der Umbruch verschiebt sich" schon. */

/**
 * Sieht ein Dokument durch, ohne es zu ändern.
 * @returns {Promise<{befunde: Array<{art:'fehler'|'warnung'|'gut', was:string, folge:string, wo?:string}>,
 *   zahlen: object}>}
 */
export async function vorabpruefung(beiFortschritt = null) {
  const befunde = [];
  const zahlen = { seiten: zustand.folge.length, schriften: 0, nichtEingebettet: 0, bilder: 0, grobeBilder: 0 };
  const schriftnamen = new Set();
  const fehlende = new Set();
  const standardschriften = new Set();
  const masse = new Set();
  let kleinstesBild = Infinity;

  /* Schriften, Bilder und Seitenmaße werden aus dem Dateiaufbau gelesen,
     nicht aus den Zeichenbefehlen.

     Der erste Anlauf ging über `page.commonObjs` von pdf.js — ein internes
     Feld, das leer blieb. Der zweite scheiterte an `lookup(name, PDFDict)`:
     pdf-lib wirft, wenn der Eintrag fehlt, und eine Seite erbt ihre
     /Resources oft vom Elternknoten, statt sie selbst zu tragen. Deshalb hier
     `alsDict` — nachsehen, und wenn nichts da ist, nichts. Eine Prüfung, die
     an einer fehlenden Angabe scheitert, prüft die Datei nicht, sondern sich
     selbst. */
  const { starteSchreiber } = await import('./ausgabe.js');
  const pdflib = await starteSchreiber();
  const { PDFName, PDFDict, PDFRawStream } = pdflib;
  const quelle = [...zustand.quellen.values()][0];

  if (quelle?.bytes) {
    try {
      const roh = await pdflib.PDFDocument.load(quelle.bytes.slice(0), { ignoreEncryption: true });
      const alsDict = (wert) => {
        const aufgelöst = wert && roh.context.lookupMaybe
          ? roh.context.lookup(wert) : wert;
        return aufgelöst instanceof PDFDict ? aufgelöst : null;
      };
      const holeDict = (dict, name) => (dict ? alsDict(dict.get(PDFName.of(name))) : null);
      const text = (wert) => String(wert ?? '').replace(/^\//, '');
      const gesehen = new Set();

      const durchsuche = (mittel, tiefe = 0) => {
        if (!mittel || tiefe > 6) return;

        const schriften = holeDict(mittel, 'Font');
        if (schriften) {
          for (const [, ref] of schriften.entries()) {
            const schrift = alsDict(ref);
            if (!schrift) continue;
            const name = text(schrift.get(PDFName.of('BaseFont'))) || '(ohne Namen)';
            if (gesehen.has(name)) continue;
            gesehen.add(name);
            schriftnamen.add(name);

            /* Typ 0 trägt seinen Descriptor im Nachfahren, nicht bei sich. */
            let beschreiber = holeDict(schrift, 'FontDescriptor');
            if (!beschreiber) {
              const kinder = schrift.get(PDFName.of('DescendantFonts'));
              const liste = kinder && roh.context.lookup(kinder);
              const erstes = liste?.get?.(0);
              beschreiber = holeDict(alsDict(erstes), 'FontDescriptor');
            }
            const eingebettet = !!beschreiber && ['FontFile', 'FontFile2', 'FontFile3']
              .some((f) => beschreiber.get(PDFName.of(f)));
            /* Die vierzehn Standardschriften darf jeder Betrachter selbst
               haben — sie fehlen nicht, sie sind vereinbart. Für PDF/A gilt
               das nicht; das steht im Befund. */
            const standard = /Helvetica|Courier|Times|Symbol|ZapfDingbats|Arial/i.test(name);
            if (!eingebettet && !standard) fehlende.add(name);
            else if (!eingebettet) standardschriften.add(name);
          }
        }

        const gegenstaende = holeDict(mittel, 'XObject');
        if (gegenstaende) {
          for (const [, ref] of gegenstaende.entries()) {
            const gegenstand = roh.context.lookup(ref);
            const teil = gegenstand instanceof PDFRawStream ? gegenstand.dict
              : (gegenstand instanceof PDFDict ? gegenstand : null);
            if (!teil) continue;
            const unterart = text(teil.get(PDFName.of('Subtype')));
            if (unterart === 'Form') { durchsuche(holeDict(teil, 'Resources'), tiefe + 1); continue; }
            if (unterart !== 'Image') continue;
            const breite = teil.get(PDFName.of('Width'))?.asNumber?.() || 0;
            if (!breite) continue;
            zahlen.bilder += 1;
            /* Näherung: das Bild sitzt in der Breite der Seite. Genau wäre die
               Matrix aus dem Zeichenstrom; für eine Warnung reicht das, und
               der Befund sagt „etwa". */
            const dpi = (breite / 595) * 72;
            kleinstesBild = Math.min(kleinstesBild, dpi);
            if (dpi < 150) zahlen.grobeBilder += 1;
          }
        }
      };

      for (const [i, blatt] of roh.getPages().entries()) {
        beiFortschritt?.({ seite: i + 1, gesamt: roh.getPageCount() });
        const drehung = blatt.getRotation().angle % 180;
        const b = Math.round(drehung ? blatt.getHeight() : blatt.getWidth());
        const h = Math.round(drehung ? blatt.getWidth() : blatt.getHeight());
        masse.add(`${b}×${h}`);
        /* `node.Resources()` läuft die Vererbung hoch — eine Seite trägt ihre
           Mittel oft nicht selbst. */
        durchsuche(blatt.node.Resources?.() || holeDict(blatt.node, 'Resources'));
      }
    } catch (fehler) {
      befunde.push({
        art: 'warnung',
        was: 'Der Dateiaufbau ließ sich nicht ganz lesen',
        folge: `Schriften und Bilder konnten nicht geprüft werden (${fehler.message}). `
          + 'Die übrigen Befunde stimmen trotzdem.',
      });
    }
  }

  zahlen.schriften = schriftnamen.size;
  zahlen.nichtEingebettet = fehlende.size;

  const merken = (art, was, folge, wo) => befunde.push({ art, was, folge, wo });

  if (fehlende.size) {
    merken('fehler', `${fehlende.size} Schrift${fehlende.size === 1 ? '' : 'en'} nicht eingebettet`,
      'Auf einem fremden Rechner wird sie durch eine ähnliche ersetzt. Der Umbruch verschiebt sich, '
      + 'Tabellen verrutschen. Für PDF/A und für den Druck ist das ein Ausschlusskriterium.',
      [...fehlende].slice(0, 4).join(', '));
  } else if (schriftnamen.size) {
    merken('gut', `Alle ${schriftnamen.size} Schriften eingebettet oder Standardschriften`,
      'Die Datei sieht überall gleich aus.');
  }
  if (standardschriften.size) {
    merken('warnung', `${standardschriften.size} Standardschrift${standardschriften.size === 1 ? '' : 'en'} nicht eingebettet`,
      'Jeder Betrachter hat sie — für den Bildschirm ist das in Ordnung. PDF/A verlangt trotzdem, '
      + 'dass auch sie in der Datei liegen; ohne sie fällt die Datei durch die Prüfung.',
      [...standardschriften].slice(0, 4).join(', '));
  }

  if (zahlen.grobeBilder) {
    merken('warnung', `${zahlen.grobeBilder} von ${zahlen.bilder} Bildern unter 150 dpi`,
      `Auf dem Bildschirm reicht das; gedruckt wird es sichtbar grob. Das gröbste liegt bei etwa ${Math.round(kleinstesBild)} dpi.`);
  } else if (zahlen.bilder) {
    merken('gut', `${zahlen.bilder} Bilder, alle über 150 dpi`, 'Druckfähig.');
  }

  if (masse.size > 1) {
    merken('warnung', `${masse.size} verschiedene Seitenmaße`,
      'Beim Drucken wird skaliert oder beschnitten, je nach Treiber unterschiedlich.',
      [...masse].slice(0, 4).join(' · '));
  } else {
    merken('gut', `Ein Seitenmaß: ${[...masse][0] || '—'} pt`, 'Nichts wird beim Drucken skaliert.');
  }

  const e = zustand.eigenschaften;
  if (!e?.titel) {
    merken('warnung', 'Kein Titel in den Merkmalen',
      'Betrachter und Sprachausgabe zeigen dann den Dateinamen. Für Barrierefreiheit ist der Titel Pflicht.');
  } else {
    merken('gut', `Titel gesetzt: „${e.titel}"`, '');
  }

  if (e?.wirktGescannt) {
    merken('fehler', 'Keine Textebene — das Dokument wirkt gescannt',
      'Nicht durchsuchbar, nicht vorlesbar, nicht kopierbar. Die Texterkennung legt sie an.');
  }

  if (zustand.anmerkungen.some((a) => a.art === 'schwaerzen')) {
    merken('warnung', 'Ungesicherte Schwärzungen',
      'Sie wirken erst beim Sichern, und nur wenn die Seite dabei gerastert wird. Bis dahin steht der Text noch darunter.');
  }

  return { befunde, zahlen };
}

/**
 * Bereitet ein Dokument auf PDF/A vor, soweit das ohne Prüfprogramm geht.
 * Setzt XMP-Kennzeichnung und Ausgabeabsicht. **Behauptet keine Konformität.**
 */
export async function bereitePdfAVor(dokument, pdflib, { fassung = '2B' } = {}) {
  const { PDFName, PDFDict, PDFArray, PDFString, PDFNumber } = pdflib;
  const kontext = dokument.context;
  const jetzt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const titel = zustand.eigenschaften?.titel || zustand.name.replace(/\.pdf$/i, '');

  const xmp = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>${fassung[0]}</pdfaid:part>
   <pdfaid:conformance>${fassung.slice(1)}</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${titel.replace(/[<&]/g, '')}</rdf:li></rdf:Alt></dc:title>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreatorTool>PDF Studio</xmp:CreatorTool>
   <xmp:ModifyDate>${jetzt}</xmp:ModifyDate>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;

  const strom = kontext.flateStream
    ? kontext.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })
    : kontext.stream(xmp);
  strom.dict?.set?.(PDFName.of('Type'), PDFName.of('Metadata'));
  strom.dict?.set?.(PDFName.of('Subtype'), PDFName.of('XML'));
  dokument.catalog.set(PDFName.of('Metadata'), kontext.register(strom));

  /* Die Ausgabeabsicht sagt, in welchem Farbraum die Datei gedacht ist. Ohne
     eingebettetes ICC-Profil ist sie unvollständig — deshalb steht sie hier
     mit Kennung, aber ohne Profil, und der Dialog sagt das. */
  const absicht = PDFDict.fromMapWithContext(new Map([
    [PDFName.of('Type'), PDFName.of('OutputIntent')],
    [PDFName.of('S'), PDFName.of('GTS_PDFA1')],
    [PDFName.of('OutputConditionIdentifier'), PDFString.of('sRGB IEC61966-2.1')],
    [PDFName.of('Info'), PDFString.of('sRGB IEC61966-2.1')],
  ]), kontext);
  const liste = PDFArray.withContext(kontext);
  liste.push(kontext.register(absicht));
  dokument.catalog.set(PDFName.of('OutputIntents'), liste);

  /* PDF/A verlangt eine Kennzeichnung als getaggtes Dokument nur für die
     a-Stufen; die Fassung mit `b` kommt ohne aus. Die Angabe schadet nicht
     und hilft Betrachtern beim Vorlesen. */
  const marken = PDFDict.fromMapWithContext(new Map([
    [PDFName.of('Marked'), kontext.obj(true)],
  ]), kontext);
  dokument.catalog.set(PDFName.of('MarkInfo'), marken);
  return { fassung, ohneProfil: true, seiten: PDFNumber.of(dokument.getPageCount()).asNumber() };
}
