/* Dokument — Quellen laden, Seitenfolge führen, Text und Merkmale ermitteln.

   Begriffe:
   - Quelle : eine geladene PDF-Datei (Bytes + pdf.js-Dokument).
   - Folge  : die Seitenreihenfolge des Arbeitsdokuments. Ein Eintrag zeigt auf
              eine Quellseite und trägt eine zusätzliche Drehung.
   Damit sind Zusammenführen, Einfügen, Umsortieren, Löschen und Ausgeben
   ein und derselbe Mechanismus. */

import { zustand, kennung, melde, sage, ladeDatei } from './kern.js';

export let pdfjs = null;

export async function starteMotor() {
  if (pdfjs) return pdfjs;
  pdfjs = await import('../fremd/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../fremd/pdf.worker.mjs', import.meta.url).toString();
  return pdfjs;
}

const WURZEL = new URL('../fremd/', import.meta.url).toString();

export async function ladeQuelle(bytes, name) {
  await starteMotor();
  const id = kennung('q');
  // pdf.js übernimmt den Puffer; für spätere Ausgabe halten wir eine eigene Kopie.
  const eigen = bytes.slice(0);
  const aufgabe = pdfjs.getDocument({
    data: bytes,
    cMapUrl: `${WURZEL}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${WURZEL}schriften/`,
    isEvalSupported: false,
  });
  let pdf;
  try {
    pdf = await aufgabe.promise;
  } catch (fehler) {
    if (fehler?.name === 'PasswordException') throw new Error(`${name} ist kennwortgeschützt. Kennwortschutz kann diese Werkbank nicht öffnen.`);
    throw new Error(`${name} ließ sich nicht öffnen: ${fehler?.message || fehler}`);
  }
  const quelle = { id, name, bytes: eigen, pdf, seitenzahl: pdf.numPages, textkarte: new Map() };
  zustand.quellen.set(id, quelle);
  return quelle;
}

export function seitenEintrag(quelleId, index, drehung = 0) {
  return { id: kennung('s'), quelleId, index, drehung };
}

/** Öffnet Dateien. Die erste wird das Arbeitsdokument, weitere werden angehängt. */
export async function oeffneDateien(dateien, { anhaengen = false } = {}) {
  const liste = [...dateien].filter((d) => /\.pdf$/i.test(d.name) || d.type === 'application/pdf');
  if (!liste.length) throw new Error('Keine PDF-Datei dabei.');

  if (!anhaengen) leereDokument();
  for (const datei of liste) {
    const bytes = await ladeDatei(datei);
    const quelle = await ladeQuelle(bytes, datei.name);
    for (let i = 0; i < quelle.seitenzahl; i++) zustand.folge.push(seitenEintrag(quelle.id, i));
    if (!anhaengen && zustand.name === 'Ohne Titel') zustand.name = datei.name;
  }
  if (anhaengen) zustand.geaendert = true;

  await ermittleMerkmale();
  await ermittleFormularfelder();
  melde('dokument:geladen');
  melde('dokument:geaendert');
  return zustand.folge.length;
}

export function leereDokument() {
  for (const quelle of zustand.quellen.values()) quelle.pdf.destroy?.();
  zustand.quellen.clear();
  zustand.folge = [];
  zustand.anmerkungen = [];
  zustand.formularfelder = [];
  zustand.formularwerte.clear();
  zustand.gewaehlteSeiten.clear();
  zustand.gewaehlteAnmerkung = null;
  zustand.historie = [];
  zustand.historieZeiger = -1;
  zustand.geaendert = false;
  zustand.gliederung = null;
  zustand.eigenschaften = null;
  zustand.name = 'Ohne Titel';
  zustand.aktuelleSeite = 1;
}

export const hatDokument = () => zustand.folge.length > 0;

export function quelleVon(eintrag) { return zustand.quellen.get(eintrag.quelleId); }

export async function holeSeite(eintrag) {
  const quelle = quelleVon(eintrag);
  if (!quelle) throw new Error('Quelle der Seite fehlt.');
  return quelle.pdf.getPage(eintrag.index + 1);
}

export function eintragNach(id) { return zustand.folge.find((e) => e.id === id) || null; }
export function nummerVon(id) { return zustand.folge.findIndex((e) => e.id === id) + 1; }

/* ---------- Text -------------------------------------------------------- */

/** Text einer Seite, gecacht je Quelle+Index. Liefert { roh, stuecke }. */
export async function seitenText(eintrag) {
  const quelle = quelleVon(eintrag);
  if (quelle.textkarte.has(eintrag.index)) return quelle.textkarte.get(eintrag.index);
  const seite = await quelle.pdf.getPage(eintrag.index + 1);
  const inhalt = await seite.getTextContent();
  const stuecke = inhalt.items.map((i) => ({ text: i.str, ende: i.hasEOL }));
  const roh = stuecke.map((s) => s.text + (s.ende ? '\n' : '')).join('');
  const ergebnis = { roh, stuecke };
  quelle.textkarte.set(eintrag.index, ergebnis);
  return ergebnis;
}

export async function ganzerText(fortschritt = null) {
  const teile = [];
  for (let i = 0; i < zustand.folge.length; i++) {
    const { roh } = await seitenText(zustand.folge[i]);
    teile.push(roh);
    fortschritt?.(i + 1, zustand.folge.length);
  }
  return teile;
}

/* ---------- Merkmale ----------------------------------------------------- */

/** Gliederung, Metadaten und eine grobe Einschätzung des Inhalts. */
export async function ermittleMerkmale() {
  const erste = zustand.folge[0];
  if (!erste) return;
  const quelle = quelleVon(erste);
  try {
    zustand.gliederung = await quelle.pdf.getOutline();
  } catch { zustand.gliederung = null; }

  let info = {}, metadaten = null;
  try { ({ info, metadata: metadaten } = await quelle.pdf.getMetadata()); } catch { /* egal */ }

  const stichprobe = zustand.folge.slice(0, Math.min(6, zustand.folge.length));
  let zeichen = 0, mitText = 0;
  for (const eintrag of stichprobe) {
    const { roh } = await seitenText(eintrag);
    zeichen += roh.trim().length;
    if (roh.trim().length > 40) mitText++;
  }

  const erstesBlatt = await holeSeite(erste);
  const masse = erstesBlatt.getViewport({ scale: 1 });

  zustand.eigenschaften = {
    titel: info?.Title || '',
    verfasser: info?.Author || '',
    thema: info?.Subject || '',
    erzeuger: info?.Producer || info?.Creator || '',
    erstellt: info?.CreationDate ? pdfDatum(info.CreationDate) : null,
    geaendert: info?.ModDate ? pdfDatum(info.ModDate) : null,
    fassung: info?.PDFFormatVersion || '',
    verschluesselt: !!info?.IsEncrypted,
    metadaten: metadaten?.getAll?.() || null,
    breitePt: Math.round(masse.width),
    hoehePt: Math.round(masse.height),
    dateigroesse: [...zustand.quellen.values()].reduce((s, q) => s + q.bytes.byteLength, 0),
    textdichte: zeichen / Math.max(1, stichprobe.length),
    wirktGescannt: mitText === 0 && zustand.folge.length > 0,
    quellenzahl: zustand.quellen.size,
  };
}

function pdfDatum(wert) {
  // D:20240115103000+01'00'
  const treffer = /^D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(String(wert));
  if (!treffer) return null;
  const [, j, m = '01', t = '01', st = '00', mi = '00', se = '00'] = treffer;
  const d = new Date(Number(j), Number(m) - 1, Number(t), Number(st), Number(mi), Number(se));
  return Number.isNaN(d.getTime()) ? null : d;
}

/* ---------- Formularfelder ----------------------------------------------- */

const FELDARTEN = { Tx: 'text', Btn: 'knopf', Ch: 'auswahl', Sig: 'unterschrift' };

/** Liest Formularfelder über pdf.js aus allen Quellseiten der Folge. */
export async function ermittleFormularfelder() {
  const felder = [];
  for (const eintrag of zustand.folge) {
    let anmerkungen = [];
    try {
      const seite = await holeSeite(eintrag);
      anmerkungen = await seite.getAnnotations({ intent: 'display' });
    } catch { continue; }
    for (const a of anmerkungen) {
      if (a.subtype !== 'Widget' || !a.fieldName) continue;
      const art = FELDARTEN[a.fieldType] || 'text';
      const feld = {
        id: kennung('f'),
        seiteId: eintrag.id,
        name: a.fieldName,
        art: art === 'knopf' ? (a.checkBox ? 'kasten' : a.radioButton ? 'radio' : 'druckknopf') : art,
        rechteck: a.rect,           // [x1, y1, x2, y2] in PDF-Punkten
        optionen: (a.options || []).map((o) => ({ wert: o.exportValue ?? o.displayValue, text: o.displayValue ?? o.exportValue })),
        wert: a.fieldValue ?? '',
        anWert: a.exportValue || 'Yes',
        mehrzeilig: !!a.multiLine,
        nurLesen: !!a.readOnly,
        pflicht: !!a.required,
        maximal: a.maxLen || 0,
      };
      if (feld.art === 'druckknopf') continue;
      felder.push(feld);
      if (!zustand.formularwerte.has(feld.name) && feld.wert !== '' && feld.wert != null) {
        zustand.formularwerte.set(feld.name, feld.wert);
      }
    }
  }
  zustand.formularfelder = felder;
  return felder;
}

/* ---------- Seitenverwaltung --------------------------------------------- */

export function verschiebeSeiten(ids, zielIndex) {
  const bewegt = zustand.folge.filter((e) => ids.includes(e.id));
  const rest = zustand.folge.filter((e) => !ids.includes(e.id));
  const vorAnzahl = zustand.folge.slice(0, zielIndex).filter((e) => ids.includes(e.id)).length;
  rest.splice(zielIndex - vorAnzahl, 0, ...bewegt);
  zustand.folge = rest;
}

export function dreheSeiten(ids, gradAenderung) {
  for (const eintrag of zustand.folge) {
    if (ids.includes(eintrag.id)) eintrag.drehung = (((eintrag.drehung + gradAenderung) % 360) + 360) % 360;
  }
}

export function loescheSeiten(ids) {
  zustand.folge = zustand.folge.filter((e) => !ids.includes(e.id));
  zustand.anmerkungen = zustand.anmerkungen.filter((a) => !ids.includes(a.seiteId));
  zustand.formularfelder = zustand.formularfelder.filter((f) => !ids.includes(f.seiteId));
}

export function verdoppleSeiten(ids) {
  const neu = [];
  for (const eintrag of zustand.folge) {
    neu.push(eintrag);
    if (ids.includes(eintrag.id)) neu.push(seitenEintrag(eintrag.quelleId, eintrag.index, eintrag.drehung));
  }
  zustand.folge = neu;
}

/** Bildschirmmaße einer Seite in Punkten unter Berücksichtigung aller Drehungen. */
export async function seitenMasse(eintrag, zusatzDrehung = 0) {
  const seite = await holeSeite(eintrag);
  const sicht = seite.getViewport({ scale: 1, rotation: (seite.rotate + eintrag.drehung + zusatzDrehung) % 360 });
  return { breite: sicht.width, hoehe: sicht.height, sicht, seite };
}

export function beschreibeDokument() {
  const e = zustand.eigenschaften;
  if (!e) return '';
  return `${zustand.folge.length} Seiten · ${e.breitePt}×${e.hoehePt} pt`;
}

export async function ladeBeispiel() {
  const antwort = await fetch(new URL('../beispiel/beispiel.pdf', import.meta.url));
  if (!antwort.ok) throw new Error('Beispieldatei fehlt.');
  const bytes = new Uint8Array(await antwort.arrayBuffer());
  leereDokument();
  const quelle = await ladeQuelle(bytes, 'Beispiel — Vertragsentwurf.pdf');
  for (let i = 0; i < quelle.seitenzahl; i++) zustand.folge.push(seitenEintrag(quelle.id, i));
  zustand.name = quelle.name;
  await ermittleMerkmale();
  await ermittleFormularfelder();
  melde('dokument:geladen');
  melde('dokument:geaendert');
  sage('Beispiel geladen');
}
