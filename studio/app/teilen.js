/* Vertraulich teilen — eine sichere Kopie in drei Schritten.

   Nach dem Atelier-Entwurf: Schwärzen → Metadaten prüfen → Prüfen &
   exportieren. Der Ablauf ändert nichts an der Originaldatei — das Studio
   kann in sie gar nicht schreiben —, er erzeugt eine bereinigte Kopie und
   prüft sie, bevor er sie herausgibt.

   Was „bereinigt" hier heißt, steht im Prüfprotokoll und ist nachgeprüft:

   1. **Schwärzungen sind echt.** Jede Seite mit Schwärzung wird als Bild
      neu gezeichnet; der Text darunter existiert in der Kopie nicht mehr.
      Auch die erkannte Textebene (OCR) lässt geschwärzte Wörter weg.
      Nach dem Bauen wird die Kopie mit pdf.js neu gelesen und nach jeder
      bestätigten Fundstelle durchsucht. Taucht eine auf, gibt es keine Kopie.
   2. **Metadaten sind leer.** Verfasser, Betreff, Stichwörter, Erzeuger und
      der XMP-Block mit dem Bearbeitungsverlauf fallen weg; der Titel nur auf
      Wunsch nicht.
   3. **Verborgenes ist entfernt.** Kommentare und Verknüpfungen (Annots),
      Formularfelder (eingebrannt), Dateianhänge, Ebenen, Skripte und
      Lesezeichen kommen nicht mit.

   Die Fundstellen kommen aus denselben Mustern wie die Hinweise
   (mitdenken.js) — aber mit ihrer Lage auf der Seite, damit „Bestätigen"
   genau dort schwärzt. Nichts wird ungefragt geschwärzt. */

import { zustand, melde, hoer, el, $, sage, mitLader, sichereBytes, zeigeDialog } from './kern.js';
import { holeSeite, nummerVon, starteMotor } from './dokument.js';
import { MUSTER, befunde } from './mitdenken.js';
import { fuegeAn, entferne } from './anmerkungen.js';

/* ---------- Zustand des Ablaufs ------------------------------------------ */

const SCHRITTE = [
  { nummer: 1, titel: 'Schwärzen', satz: 'Fundstellen bestätigen oder verwerfen' },
  { nummer: 2, titel: 'Metadaten prüfen', satz: 'Was die Datei über sich verrät' },
  { nummer: 3, titel: 'Prüfen & exportieren', satz: 'Sichere Kopie für Ihre Freigabe' },
];

const ablauf = {
  schritt: 1,
  funde: [],              // { id, art, hinweis, seiteId, text, rechtecke, entscheidung, anmerkungen }
  gesucht: false,
  metadaten: null,        // { felder: [[name, wert]], xmp: bool }
  verborgen: null,        // { kommentare, anhaenge, ebenen, skripte, felder, lesezeichen }
  titelBehalten: false,
  protokoll: null,
};

export function ablaufStand() { return ablauf; }

/* ---------- Fundstellen mit Lage ----------------------------------------- */

/* Aus den Textstücken einer Seite: ein durchgehender Text und für jedes
   Zeichen, aus welchem Stück es stammt. So lässt sich zu einem Treffer im
   Text sagen, wo er auf der Seite liegt. */
function textMitLage(inhalt) {
  let text = '';
  const stuecke = [];
  for (const item of inhalt.items) {
    if (typeof item.str !== 'string') continue;
    const start = text.length;
    text += item.str;
    stuecke.push({ start, ende: text.length, item, schrift: inhalt.styles?.[item.fontName]?.fontFamily || 'sans-serif' });
    if (item.hasEOL) text += ' ';
  }
  return { text, stuecke };
}

/* Wo innerhalb eines Stücks ein Zeichenbereich liegt — gemessen mit der
   Schrift, die pdf.js für das Stück nennt, nicht nach Zeichenzahl. In einer
   Proportionalschrift ist „ma" breiter als „il"; nach Zeichen gerechnet saß
   der Balken bis zu einem Buchstaben daneben. */
let messer = null;
function anteile(stueck, von, bis) {
  const str = stueck.item.str;
  try {
    messer ??= document.createElement('canvas').getContext('2d');
    messer.font = `100px ${stueck.schrift}`;
    const ganz = messer.measureText(str).width;
    if (ganz > 0) return [messer.measureText(str.slice(0, von)).width / ganz, messer.measureText(str.slice(0, bis)).width / ganz];
  } catch { /* ohne Leinwand: nach Zeichen */ }
  return [von / Math.max(1, str.length), bis / Math.max(1, str.length)];
}

/* Rechteck(e) zu einem Bereich [von, bis) im Text — eines je berührtem
   Stück. Dazu ein Rand von gut einem Drittel Zeichenbreite auf jeder Seite:
   die Messung ist eine Näherung an die eingebettete Schrift, und ein Balken,
   der ein Zeichen zu kurz ist, lässt es im Bild stehen — das findet keine
   Textprüfung. Gedrehte Stücke bekommen ihren ganzen Kasten. */
function rechteckeFuer(stuecke, von, bis) {
  const rechtecke = [];
  for (const stueck of stuecke) {
    const { start, ende, item } = stueck;
    if (ende <= von || start >= bis) continue;
    const [a, b, c, d, e, f] = item.transform;
    const hoehe = item.height || Math.hypot(c, d) || 10;
    const laenge = Math.max(1, ende - start);
    const breite = item.width || Math.abs(a) * laenge * 0.5;
    const gedreht = Math.abs(b) > 0.01 || Math.abs(c) > 0.01;
    const [anfang, schluss] = gedreht ? [0, 1]
      : anteile(stueck, Math.max(von, start) - start, Math.min(bis, ende) - start);
    const rand = Math.max(1.5, (breite / laenge) * 0.4);
    rechtecke.push({
      x: e + breite * anfang - rand,
      y: f - hoehe * 0.3,
      x2: e + breite * schluss + rand,
      y2: f + hoehe * 1.0,
    });
  }
  return rechtecke;
}

/** Sucht alle Fundstellen im Dokument, mit Lage. Bis zu 60 Seiten wie die Hinweise. */
export async function sucheFundstellen() {
  const gefunden = [];
  const grenze = Math.min(zustand.folge.length, 60);
  for (let i = 0; i < grenze; i++) {
    const eintrag = zustand.folge[i];
    let inhalt;
    try { inhalt = await (await holeSeite(eintrag)).getTextContent(); } catch { continue; }
    const { text, stuecke } = textMitLage(inhalt);
    for (const { art, regel, hinweis } of MUSTER) {
      const muster = new RegExp(regel.source, regel.flags);
      let fund;
      while ((fund = muster.exec(text)) !== null) {
        if (!fund[0].length) { muster.lastIndex++; continue; }
        const rechtecke = rechteckeFuer(stuecke, fund.index, fund.index + fund[0].length);
        if (!rechtecke.length) continue;
        gefunden.push({
          id: `f${i}-${fund.index}-${art}`, art, hinweis, seiteId: eintrag.id,
          text: fund[0].trim(), rechtecke, entscheidung: 'offen', anmerkungen: [],
          von: fund.index, bis: fund.index + fund[0].length,
        });
        if (gefunden.length > 200) break;
      }
    }
  }
  /* Ein Fund, der ganz in einem anderen derselben Seite liegt, ist kein
     eigener — „0000 0000" als Telefonnummer mitten in einer IBAN. */
  const bereinigt = gefunden.filter((f) => !gefunden.some((g) => g !== f && g.seiteId === f.seiteId
    && g.von <= f.von && g.bis >= f.bis && (g.bis - g.von) > (f.bis - f.von)));
  gefunden.length = 0;
  gefunden.push(...bereinigt);
  /* Was schon entschieden war, bleibt entschieden. */
  const vorher = new Map(ablauf.funde.map((f) => [f.id, f]));
  ablauf.funde = gefunden.map((f) => {
    const alt = vorher.get(f.id);
    return alt ? { ...f, entscheidung: alt.entscheidung, anmerkungen: alt.anmerkungen } : f;
  });
  ablauf.gesucht = true;
  melde('teilen:geaendert');
  return ablauf.funde;
}

/** Bestätigen: an jeder Lage der Fundstelle eine Schwärzung setzen. */
export function bestaetige(id) {
  const fund = ablauf.funde.find((f) => f.id === id);
  if (!fund || fund.entscheidung === 'bestaetigt') return;
  fund.anmerkungen = fund.rechtecke.map((r) => fuegeAn({
    art: 'schwaerzen', seiteId: fund.seiteId, x: r.x, y: r.y, x2: r.x2, y2: r.y2,
    farbe: '#000000', aus: 'teilen',
  }).id);
  fund.entscheidung = 'bestaetigt';
  melde('teilen:geaendert');
}

/** Verwerfen: die Stelle bleibt sichtbar; eine schon gesetzte Schwärzung fällt weg. */
export function verwirf(id) {
  const fund = ablauf.funde.find((f) => f.id === id);
  if (!fund) return;
  for (const anmerkung of fund.anmerkungen) entferne(anmerkung);
  fund.anmerkungen = [];
  fund.entscheidung = 'verworfen';
  melde('teilen:geaendert');
}

/** Schwärzungen, die nicht aus einer Fundstelle kommen — mit dem Werkzeug gesetzt. */
function eigeneSchwaerzungen() {
  const ausFunden = new Set(ablauf.funde.flatMap((f) => f.anmerkungen));
  return zustand.anmerkungen.filter((a) => a.art === 'schwaerzen' && !ausFunden.has(a.id));
}

/* ---------- Metadaten und Verborgenes ------------------------------------ */

const METADATEN_NAMEN = [
  ['Title', 'Titel'], ['Author', 'Verfasser'], ['Subject', 'Betreff'], ['Keywords', 'Stichwörter'],
  ['Creator', 'Erzeuger'], ['Producer', 'Hersteller'], ['CreationDate', 'Erstellt'], ['ModDate', 'Geändert'],
];

export async function pruefeMetadaten() {
  const felder = [];
  let xmp = false;
  for (const quelle of zustand.quellen.values()) {
    try {
      const { info, metadata } = await quelle.pdf.getMetadata();
      for (const [schluessel, name] of METADATEN_NAMEN) {
        const wert = info?.[schluessel];
        if (wert && String(wert).trim()) felder.push([name, String(wert).trim()]);
      }
      if (metadata) xmp = true;
    } catch { /* ohne Metadaten */ }
  }
  ablauf.metadaten = { felder, xmp };
  melde('teilen:geaendert');
  return ablauf.metadaten;
}

export async function pruefeVerborgenes() {
  const stand = { kommentare: 0, verknuepfungen: 0, formularfelder: 0, anhaenge: 0, ebenen: 0, skripte: 0, lesezeichen: 0 };
  for (const eintrag of zustand.folge.slice(0, 200)) {
    try {
      const anmerkungen = await (await holeSeite(eintrag)).getAnnotations({ intent: 'display' });
      for (const a of anmerkungen) {
        if (a.subtype === 'Link') stand.verknuepfungen += 1;
        else if (a.subtype === 'Widget') stand.formularfelder += 1;
        else if (a.subtype !== 'Popup') stand.kommentare += 1;
      }
    } catch { /* Seite ohne Anmerkungen */ }
  }
  for (const quelle of zustand.quellen.values()) {
    try { stand.anhaenge += Object.keys((await quelle.pdf.getAttachments()) || {}).length; } catch { /* keine */ }
    try {
      const konfig = await quelle.pdf.getOptionalContentConfig();
      const gruppen = konfig?.getGroups?.();
      stand.ebenen += gruppen ? Object.keys(gruppen).length : 0;
    } catch { /* keine Ebenen */ }
    try { stand.skripte += Object.keys((await quelle.pdf.getJSActions?.()) || {}).length; } catch { /* keine */ }
    try { stand.lesezeichen += ((await quelle.pdf.getOutline()) || []).length; } catch { /* keine */ }
  }
  stand.kommentare += zustand.anmerkungen.filter((a) => a.art !== 'schwaerzen' && a.art !== 'ersatz').length;
  stand.anhaenge += zustand.anhaenge?.length || 0;
  ablauf.verborgen = stand;
  melde('teilen:geaendert');
  return stand;
}

/* ---------- Die sichere Kopie --------------------------------------------- */

function normalisiere(text) { return String(text).replace(/\s+/g, '').toLowerCase(); }

/**
 * Baut die bereinigte Kopie, prüft sie nach und gibt Bytes und Protokoll
 * zurück. Wirft, wenn eine bestätigte Fundstelle in der Kopie noch lesbar ist.
 */
export async function baueSichereKopie({ dateiname }) {
  const { baueDokument, starteSchreiber } = await import('./ausgabe.js');
  const pdflib = await starteSchreiber();
  const gerastert = zustand.folge.filter((e) => zustand.anmerkungen.some(
    (a) => a.seiteId === e.id && (a.art === 'schwaerzen' || (a.art === 'ersatz' && a.rastern))));

  const roh = await baueDokument({ neuAufbauen: true, ohneKommentare: true, metadatenEntfernen: true, ohneDokumentteile: true });

  /* Was baueDokument nicht kennt, räumt dieser Schritt weg: alles, was
     neben dem sichtbaren Seiteninhalt Informationen tragen kann. */
  const doc = await pdflib.PDFDocument.load(roh);
  const { PDFName } = pdflib;
  for (const seite of doc.getPages()) {
    seite.node.delete(PDFName.of('Annots'));
    seite.node.delete(PDFName.of('AA'));
  }
  for (const name of ['Names', 'OCProperties', 'AcroForm', 'OpenAction', 'AA', 'Metadata', 'Outlines', 'PieceInfo', 'StructTreeRoot', 'MarkInfo']) {
    doc.catalog.delete(PDFName.of(name));
  }
  doc.setTitle(ablauf.titelBehalten ? (zustand.eigenschaften?.titel || zustand.name.replace(/\.pdf$/i, '')) : '');
  doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator('');
  doc.setProducer('PDF Studio');
  const jetzt = new Date();
  doc.setCreationDate(jetzt); doc.setModificationDate(jetzt);
  const bytes = await doc.save({ useObjectStreams: false });

  /* Nachprüfung: die Kopie neu lesen und nach jeder bestätigten Stelle
     suchen. pdf.js liest dabei auch, was unsichtbar im Text liegt. */
  const pdfjs = await starteMotor();
  const geprueft = await pdfjs.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  let gesamt = '';
  for (let i = 1; i <= geprueft.numPages; i++) {
    const inhalt = await (await geprueft.getPage(i)).getTextContent();
    gesamt += inhalt.items.map((t) => t.str || '').join('');
  }
  const info = (await geprueft.getMetadata()).info || {};
  const anhaenge = Object.keys((await geprueft.getAttachments()) || {}).length;
  await geprueft.destroy();
  const flach = normalisiere(gesamt);
  const bestaetigt = ablauf.funde.filter((f) => f.entscheidung === 'bestaetigt');
  const noch = bestaetigt.filter((f) => flach.includes(normalisiere(f.text)));
  if (noch.length) {
    throw new Error(`Die Kopie enthält noch ${noch.length} geschwärzte Stelle${noch.length === 1 ? '' : 'n'} als Text (${noch.map((f) => f.art).join(', ')}). Es wurde nichts herausgegeben.`);
  }
  if (info.Author || info.Subject || info.Keywords || info.Creator) {
    throw new Error('Die Kopie trägt noch Metadaten. Es wurde nichts herausgegeben.');
  }
  if (anhaenge) throw new Error('Die Kopie trägt noch Dateianhänge. Es wurde nichts herausgegeben.');

  ablauf.protokoll = {
    zeit: jetzt,
    quelle: zustand.name,
    kopie: dateiname,
    seiten: zustand.folge.length,
    bestaetigt: bestaetigt.map((f) => ({ art: f.art, seite: nummerVon(f.seiteId) })),
    verworfen: ablauf.funde.filter((f) => f.entscheidung === 'verworfen').map((f) => ({ art: f.art, seite: nummerVon(f.seiteId) })),
    offen: ablauf.funde.filter((f) => f.entscheidung === 'offen').map((f) => ({ art: f.art, seite: nummerVon(f.seiteId) })),
    eigene: eigeneSchwaerzungen().length,
    gerastert: gerastert.map((e) => nummerVon(e.id)),
    metadaten: (ablauf.metadaten?.felder || []).map(([n]) => n).filter((n) => !(ablauf.titelBehalten && n === 'Titel')),
    xmp: !!ablauf.metadaten?.xmp,
    verborgen: ablauf.verborgen,
    nachpruefung: `${bestaetigt.length} bestätigte Stelle${bestaetigt.length === 1 ? '' : 'n'} im Text der Kopie gesucht — keine gefunden.`,
    seitenGeprueft: befunde.seitenGeprueft || Math.min(zustand.folge.length, 60),
  };
  melde('teilen:geaendert');
  return { bytes, protokoll: ablauf.protokoll };
}

/** Das Protokoll als Text — zum Ansehen und zum Mitgeben. */
export function protokollText(p = ablauf.protokoll) {
  if (!p) return '';
  const liste = (eintraege) => (eintraege.length ? eintraege.map((e) => `${e.art} (S. ${e.seite})`).join(', ') : '—');
  const v = p.verborgen || {};
  return [
    'Prüfprotokoll — Vertraulich teilen (PDF Studio)',
    `Zeitpunkt: ${p.zeit.toLocaleString('de-DE')}`,
    `Quelle: ${p.quelle} (unverändert)`,
    `Sichere Kopie: ${p.kopie}`,
    '',
    `Bestätigt und geschwärzt: ${liste(p.bestaetigt)}`,
    `Verworfen, bleibt sichtbar: ${liste(p.verworfen)}`,
    `Nicht entschieden, bleibt sichtbar: ${liste(p.offen)}`,
    `Eigene Schwärzungen: ${p.eigene}`,
    `Als Bild neu gezeichnet: ${p.gerastert.length ? `Seite ${p.gerastert.join(', ')}` : 'keine Seite'}`,
    '',
    `Metadaten entfernt: ${p.metadaten.length ? p.metadaten.join(', ') : 'keine vorhanden'}${p.xmp ? ', XMP-Block mit Verlauf' : ''}`,
    `Nicht übernommen: ${v.kommentare || 0} Kommentare, ${v.verknuepfungen || 0} Verknüpfungen, ${v.formularfelder || 0} Formularfelder (eingebrannt), ${v.anhaenge || 0} Anhänge, ${v.ebenen || 0} Ebenen, ${v.skripte || 0} Skripte, ${v.lesezeichen || 0} Lesezeichen`,
    '',
    `Nachprüfung: ${p.nachpruefung}`,
    `Fundstellen gesucht auf ${p.seitenGeprueft} von ${p.seiten} Seiten.${p.seitenGeprueft < p.seiten ? ' Die übrigen Seiten bitte selbst durchsehen.' : ''}`,
    'Musterkennung ist keine Rechtsberatung: Namen, Beträge und Fristen bitte selbst prüfen.',
  ].join('\n');
}

/* ---------- Oberfläche ----------------------------------------------------- */

let aktiv = false;
export function ablaufAktiv() { return aktiv; }

/** Startet den Ablauf auf dem offenen Dokument. */
export async function starteAblauf() {
  if (!zustand.folge.length) return;
  aktiv = true;
  ablauf.schritt = 1;
  ablauf.protokoll = null;
  ablauf.funde = [];
  ablauf.gesucht = false;
  $('#huelle').dataset.ablauf = 'teilen';
  window.studio?.fuehreAus?.('werkzeug:auswahl');
  zeichne();
  await Promise.all([sucheFundstellen(), pruefeMetadaten(), pruefeVerborgenes()]);
}

export function beendeAblauf() {
  aktiv = false;
  delete $('#huelle').dataset.ablauf;
  melde('teilen:beendet');
}

function setzeSchritt(nummer) {
  ablauf.schritt = Math.max(1, Math.min(3, nummer));
  zeichne();
}

const haken = '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

function zeichneKopf() {
  const kopf = $('#ablaufkopf');
  if (!kopf) return;
  kopf.innerHTML = '';
  kopf.append(el('div', { klasse: 'ablauf-titel' },
    el('h2', { text: 'Vertraulich teilen' }),
    el('p', { text: 'Sichere Kopie in drei Schritten' })));
  const liste = el('ol', { klasse: 'ablauf-schritte' });
  for (const s of SCHRITTE) {
    const art = s.nummer < ablauf.schritt ? 'erledigt' : s.nummer === ablauf.schritt ? 'aktiv' : 'offen';
    liste.append(el('li', { klasse: `ablauf-schritt ist-${art}`, 'aria-current': art === 'aktiv' ? 'step' : null },
      el('button', { type: 'button', klasse: 'ablauf-schritt-knopf', beiClick: () => setzeSchritt(s.nummer) },
        el('span', { klasse: 'ablauf-marke', html: art === 'erledigt' ? haken : String(s.nummer) }),
        el('span', { klasse: 'ablauf-wort' },
          el('strong', { text: s.titel }),
          el('span', { text: s.satz })))));
  }
  kopf.append(liste);
}

function zeichneLinks() {
  const tafel = $('#ablauf-links');
  if (!tafel) return;
  tafel.innerHTML = '';
  const bestaetigt = ablauf.funde.filter((f) => f.entscheidung === 'bestaetigt').length;
  const verworfen = ablauf.funde.filter((f) => f.entscheidung === 'verworfen').length;
  const eigene = eigeneSchwaerzungen();
  tafel.append(el('div', { klasse: 'ablauf-tafelkopf' },
    el('h3', { text: 'Schwärzungen' }),
    el('span', { klasse: 'ablauf-zahl', text: String(bestaetigt + eigene.length) })));
  tafel.append(el('div', { klasse: 'ablauf-hinweis' },
    el('span', { html: '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z"/></svg>' }),
    el('span', { text: !ablauf.gesucht ? 'Fundstellen werden gesucht …'
      : `${ablauf.funde.length} lokale Treffer: ${bestaetigt} bestätigt, ${verworfen} verworfen. Keine automatische Änderung.` })));

  const liste = el('div', { klasse: 'ablauf-funde' });
  for (const f of ablauf.funde) {
    const seite = nummerVon(f.seiteId);
    const zustandText = f.entscheidung === 'bestaetigt' ? 'Bestätigt · endgültig entfernt'
      : f.entscheidung === 'verworfen' ? 'Verworfen · bleibt sichtbar' : 'Offen';
    liste.append(el('div', { klasse: `ablauf-fund ist-${f.entscheidung}`, daten: { fund: f.id } },
      el('div', { klasse: 'ablauf-fund-kopf' },
        el('span', { klasse: 'ablauf-fund-balken', 'aria-hidden': 'true' }),
        el('button', { type: 'button', klasse: 'ablauf-fund-art', text: f.hinweis,
          beiClick: () => melde('seiten:springe', seite) })),
      el('div', { klasse: 'ablauf-fund-text', text: `Seite ${seite} · ${f.text}` }),
      el('div', { klasse: 'ablauf-fund-stand', text: zustandText }),
      el('div', { klasse: 'ablauf-fund-taten' },
        f.entscheidung !== 'bestaetigt' ? el('button', { type: 'button', klasse: 'knopf knopf-klein', text: 'Schwärzen', beiClick: () => bestaetige(f.id) }) : null,
        f.entscheidung !== 'verworfen' ? el('button', { type: 'button', klasse: 'knopf knopf-klein knopf-still', text: 'Verwerfen', beiClick: () => verwirf(f.id) }) : null)));
  }
  for (const a of eigene) {
    liste.append(el('div', { klasse: 'ablauf-fund ist-bestaetigt' },
      el('div', { klasse: 'ablauf-fund-kopf' },
        el('span', { klasse: 'ablauf-fund-balken', 'aria-hidden': 'true' }),
        el('span', { klasse: 'ablauf-fund-art', text: 'Eigene Schwärzung' })),
      el('div', { klasse: 'ablauf-fund-text', text: `Seite ${nummerVon(a.seiteId)}` }),
      el('div', { klasse: 'ablauf-fund-stand', text: 'Bestätigt · endgültig entfernt' })));
  }
  if (ablauf.gesucht && !ablauf.funde.length && !eigene.length) {
    liste.append(el('p', { klasse: 'stapel-leer', text: 'Keine Fundstellen. Eigene Stellen schwärzen Sie direkt auf der Seite.' }));
  }
  tafel.append(liste);
  tafel.append(el('button', {
    type: 'button', klasse: 'knopf knopf-klein ablauf-eigene',
    text: 'Eigene Stelle schwärzen',
    beiClick: () => window.studio?.fuehreAus?.('werkzeug:schwaerzen'),
  }));

  const geprueft = befunde.seitenGeprueft || Math.min(zustand.folge.length, 60);
  tafel.append(el('div', { klasse: 'ablauf-fuss' },
    el('span', { html: haken }),
    el('strong', { text: `${geprueft} von ${zustand.folge.length} Seiten geprüft` }),
    el('p', { text: geprueft < zustand.folge.length
      ? 'Die übrigen Seiten bitte selbst durchsehen.'
      : 'Text und erkannter Text aller Seiten berücksichtigt.' }),
    el('button', { type: 'button', klasse: 'knopf knopf-klein', text: 'Prüfprotokoll ansehen', disabled: !ablauf.protokoll,
      beiClick: zeigeProtokoll })));
}

function pruefpunkt(titel, satz, gut) {
  return el('div', { klasse: `ablauf-pruefpunkt ${gut ? 'ist-gut' : 'ist-offen'}` },
    el('span', { html: gut ? haken : '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>' }),
    el('div', {}, el('strong', { text: titel }), el('p', { text: satz })));
}

function zeichneRechts() {
  const tafel = $('#ablauf-rechts');
  if (!tafel) return;
  tafel.innerHTML = '';
  const bestaetigt = ablauf.funde.filter((f) => f.entscheidung === 'bestaetigt').length + eigeneSchwaerzungen().length;
  const offen = ablauf.funde.filter((f) => f.entscheidung === 'offen').length;
  const v = ablauf.verborgen;
  const verborgenSumme = v ? v.kommentare + v.verknuepfungen + v.formularfelder + v.anhaenge + v.ebenen + v.skripte + v.lesezeichen : 0;

  if (ablauf.schritt === 1) {
    tafel.append(el('h2', { text: 'Schwärzen' }),
      el('p', { klasse: 'ablauf-satz', text: 'Jede Fundstelle links bestätigen oder verwerfen. Bestätigt heißt: in der Kopie endgültig entfernt — nicht nur überdeckt.' }),
      pruefpunkt('Fundstellen entschieden', offen ? `${offen} noch offen` : 'Alle entschieden', !offen),
      el('div', { klasse: 'ablauf-weiter' },
        el('button', { type: 'button', klasse: 'knopf knopf-voll', text: 'Weiter zu den Metadaten', beiClick: () => setzeSchritt(2) })));
    return;
  }

  if (ablauf.schritt === 2) {
    const m = ablauf.metadaten;
    tafel.append(el('h2', { text: 'Metadaten prüfen' }),
      el('p', { klasse: 'ablauf-satz', text: 'Das steht in der Datei, ohne dass man es auf einer Seite sieht. In der sicheren Kopie fällt es weg.' }));
    const tabelle = el('div', { klasse: 'ablauf-metadaten' });
    if (!m) tabelle.append(el('p', { text: 'Wird gelesen …' }));
    else if (!m.felder.length && !m.xmp) tabelle.append(el('p', { text: 'Die Datei trägt keine Metadaten.' }));
    for (const [name, wert] of m?.felder || []) {
      tabelle.append(el('div', { klasse: 'ablauf-zeile' }, el('span', { text: name }), el('span', { klasse: 'ablauf-wert', text: wert })));
    }
    if (m?.xmp) tabelle.append(el('div', { klasse: 'ablauf-zeile' }, el('span', { text: 'XMP' }), el('span', { klasse: 'ablauf-wert', text: 'Block mit Bearbeitungsverlauf' })));
    tafel.append(tabelle);
    const titel = el('input', { type: 'checkbox', id: 'teilen-titel' });
    titel.checked = ablauf.titelBehalten;
    titel.addEventListener('change', () => { ablauf.titelBehalten = titel.checked; });
    tafel.append(el('label', { klasse: 'ablauf-kasten', for: 'teilen-titel' }, titel, ' Titel behalten'));
    tafel.append(el('h3', { klasse: 'ablauf-unterkopf', text: 'Verborgene Inhalte' }));
    const verborgen = el('div', { klasse: 'ablauf-metadaten' });
    if (!v) verborgen.append(el('p', { text: 'Wird geprüft …' }));
    else {
      for (const [name, zahl] of [['Kommentare', v.kommentare], ['Verknüpfungen', v.verknuepfungen], ['Formularfelder', v.formularfelder],
        ['Dateianhänge', v.anhaenge], ['Ebenen', v.ebenen], ['Skripte', v.skripte], ['Lesezeichen', v.lesezeichen]]) {
        verborgen.append(el('div', { klasse: 'ablauf-zeile' }, el('span', { text: name }), el('span', { klasse: 'ablauf-wert', text: zahl ? `${zahl} · entfällt` : 'keine' })));
      }
    }
    tafel.append(verborgen,
      el('div', { klasse: 'ablauf-weiter' },
        el('button', { type: 'button', klasse: 'knopf knopf-voll', text: 'Weiter zur Prüfung', beiClick: () => setzeSchritt(3) }),
        el('button', { type: 'button', klasse: 'verweis', text: '← Zum Schwärzen', beiClick: () => setzeSchritt(1) })));
    return;
  }

  const name = el('input', { klasse: 'feld', id: 'teilen-dateiname', value: `${zustand.name.replace(/\.pdf$/i, '')}_vertraulich.pdf`, 'aria-label': 'Dateiname der sicheren Kopie' });
  tafel.append(el('h2', { text: 'Bereit zum sicheren Export' }),
    el('p', { klasse: 'ablauf-satz', text: 'Prüfen Sie die Vorschau. Erst Ihr Export erstellt die sichere Kopie.' }),
    pruefpunkt('Sensible Inhalte entfernt', `${bestaetigt} bestätigte Stelle${bestaetigt === 1 ? '' : 'n'} werden weder sichtbar noch durchsuchbar sein.${offen ? ` ${offen} nicht entschieden — sie bleiben sichtbar.` : ''}`, !offen),
    pruefpunkt('Metadaten bereinigt', 'Verfasser, Betreff, Stichwörter, Erzeuger und Verlauf entfallen.', true),
    pruefpunkt('Verborgene Inhalte geprüft', verborgenSumme ? `${verborgenSumme} Einträge (Kommentare, Anhänge, Ebenen …) entfallen.` : 'Keine Kommentare, Anhänge oder ausgeblendeten Ebenen enthalten.', true),
    el('h3', { klasse: 'ablauf-unterkopf', text: 'Sichere Kopie' }),
    el('label', { klasse: 'ablauf-feld', for: 'teilen-dateiname' }, el('span', { text: 'Dateiname' }), name),
    el('div', { klasse: 'ablauf-zeile' }, el('span', { text: 'Format' }), el('span', { klasse: 'ablauf-wert', text: 'PDF · bereinigt' })),
    el('div', { klasse: 'ablauf-zeile' }, el('span', { text: 'Speicherort' }), el('span', { klasse: 'ablauf-wert', text: 'Download dieses Browsers' })),
    el('div', { klasse: 'ablauf-zeile' }, el('span', { text: 'Original' }), el('span', { klasse: 'ablauf-wert', text: 'bleibt unverändert' })),
    el('div', { klasse: 'ablauf-warnung' },
      el('span', { html: '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.01"/></svg>' }),
      el('span', { text: 'Schwärzungen sind in der exportierten Kopie endgültig und können nicht rückgängig gemacht werden. Seiten mit Schwärzung werden als Bild ausgegeben.' })),
    el('div', { klasse: 'ablauf-weiter' },
      el('button', {
        type: 'button', klasse: 'knopf knopf-voll', id: 'teilen-exportieren', text: 'Sichere Kopie exportieren',
        beiClick: () => exportiere(name.value),
      }),
      el('button', { type: 'button', klasse: 'verweis', text: '← Zur Metadatenprüfung', beiClick: () => setzeSchritt(2) })));
}

async function exportiere(dateiname) {
  const name = /\.pdf$/i.test(dateiname.trim()) ? dateiname.trim() : `${dateiname.trim() || 'vertraulich'}.pdf`;
  await mitLader('Sichere Kopie wird gebaut und nachgeprüft …', async () => {
    try {
      const { bytes } = await baueSichereKopie({ dateiname: name });
      sichereBytes(bytes, name);
      sage(`Sichere Kopie exportiert: ${name}`, { dauer: 6000, aktion: { beschriftung: 'Prüfprotokoll', tun: zeigeProtokoll } });
      melde('teilen:exportiert', { bytes, name });
    } catch (fehler) {
      sage(fehler.message, { art: 'warn', dauer: 9000 });
    }
  });
}

export function zeigeProtokoll() {
  const text = protokollText();
  if (!text) return;
  zeigeDialog({
    titel: 'Prüfprotokoll',
    rumpf: el('pre', { klasse: 'protokoll', text }),
    knoepfe: [
      { beschriftung: 'Als Textdatei sichern', tun: () => { sichereBytes(new TextEncoder().encode(text), 'pruefprotokoll.txt', 'text/plain'); return false; } },
      { beschriftung: 'Schließen', betont: true },
    ],
  });
}

function zeichne() {
  if (!aktiv) return;
  zeichneKopf();
  zeichneLinks();
  zeichneRechts();
}

export function starteTeilen() {
  hoer('teilen:geaendert', zeichne);
  hoer('anmerkungen:geaendert', () => { if (aktiv) zeichneLinks(); });
  hoer('mitdenken:geaendert', () => { if (aktiv) zeichneLinks(); });
  /* Ein anderes Dokument beendet den Ablauf: seine Funde gehören zum alten. */
  hoer('dokument:frisch', () => { if (aktiv) beendeAblauf(); });
  $('#knopf-ablauf-verlassen')?.addEventListener('click', () => { beendeAblauf(); melde('ansicht:editor-verlangt'); });
}
