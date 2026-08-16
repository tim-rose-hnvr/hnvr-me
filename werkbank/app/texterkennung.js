/* Texterkennung — aus Bildern wird durchsuchbarer Text.

   Tesseract läuft als Web-Worker im Browser; Programm und Sprachdaten liegen
   unter fremd/. Kein Netz, kein Dienst, keine Datei verlässt das Gerät.

   Das Ergebnis wird zweimal verwendet:
   1. sofort in der Textebene der Ansicht — damit Suchen, Markieren und
      Hervorheben auf einem Scan genauso gehen wie auf echtem Text;
   2. beim Sichern als unsichtbarer Text hinter dem Bild (Textmodus 3) —
      das ergibt ein durchsuchbares PDF, das überall gleich aussieht. */

import { zustand, melde, sage, kennung, el, zeigeDialog, merkeSchritt, $ } from './kern.js';
import { holeSeite, nummerVon, seitenText } from './dokument.js';

export const SPRACHEN = [
  { id: 'deu', name: 'Deutsch' },
  { id: 'eng', name: 'Englisch' },
  { id: 'deu+eng', name: 'Deutsch und Englisch' },
];

let tesseract = null;
let arbeiter = null;
let laufendeSprache = null;
let abbruch = false;

/* Die Ergebnisse liegen im Zustand (zustand.ocr), nicht in diesem Modul:
   Ansicht, Suche und Ausgabe lesen sie, ohne dieses Modul zu laden. */
export const erkannt = zustand.ocr;

export function hatErkennung(seiteId) { return erkannt.has(seiteId); }
export function erkennungVon(seiteId) { return erkannt.get(seiteId) || null; }

export function textAusErkennung(seiteId) {
  const treffer = erkannt.get(seiteId);
  if (!treffer) return '';
  return treffer.zeilen.map((z) => z.text).join('\n');
}

export function brichAb() { abbruch = true; }

async function holeArbeiter(sprache, beiFortschritt) {
  if (!tesseract) {
    const bezogen = await import('../fremd/tesseract.mjs');
    // Der ausgelieferte Build stellt alles unter default bereit.
    tesseract = bezogen.createWorker ? bezogen : bezogen.default;
  }
  if (arbeiter && laufendeSprache === sprache) return arbeiter;
  if (arbeiter) { await arbeiter.terminate(); arbeiter = null; }

  const wurzel = new URL('../fremd/', import.meta.url).toString();
  arbeiter = await tesseract.createWorker(sprache, 1, {
    workerPath: `${wurzel}tesseract-arbeiter.js`,
    corePath: `${wurzel}tesseract-kern.js`,
    langPath: `${wurzel}sprachen`,
    gzip: true,
    cacheMethod: 'none',        // nichts im Browserspeicher ablegen
    logger: (nachricht) => {
      if (nachricht.status && beiFortschritt) beiFortschritt(nachricht);
    },
  });
  laufendeSprache = sprache;
  return arbeiter;
}

export async function beendeArbeiter() {
  if (arbeiter) { await arbeiter.terminate(); arbeiter = null; laufendeSprache = null; }
}

/**
 * Erkennt Text auf den angegebenen Seiten.
 * @param {{ seiten: object[], sprache: string, dichte: number, beiFortschritt: Function }} auftrag
 */
export async function erkenneSeiten({ seiten, sprache = 'deu', dichte = 200, beiFortschritt = null }) {
  abbruch = false;
  const werkzeug = await holeArbeiter(sprache, (n) => beiFortschritt?.({ art: 'lade', ...n }));
  const angelegt = [];

  for (const [nummer, eintrag] of seiten.entries()) {
    if (abbruch) break;
    beiFortschritt?.({ art: 'seite', seite: nummer + 1, gesamt: seiten.length, anteil: nummer / seiten.length });

    const seite = await holeSeite(eintrag);
    const skala = dichte / 72;
    const sicht = seite.getViewport({ scale: skala, rotation: (seite.rotate + eintrag.drehung) % 360 });
    const leinwand = document.createElement('canvas');
    leinwand.width = Math.ceil(sicht.width);
    leinwand.height = Math.ceil(sicht.height);
    const stift = leinwand.getContext('2d', { willReadFrequently: true });
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, leinwand.width, leinwand.height);
    await seite.render({ canvasContext: stift, viewport: sicht }).promise;

    // Ohne diese Angabe liefert tesseract.js nur den Fließtext ohne Kästchen.
    const { data } = await werkzeug.recognize(leinwand, {}, { blocks: true, text: true });
    const woerter = [];
    const zeilen = [];

    for (const zeile of sammleZeilen(data)) {
      const zeilenWoerter = [];
      for (const wort of zeile.words || []) {
        if (!wort.text?.trim()) continue;
        const kasten = wort.bbox || wort;
        const [x1, y1] = sicht.convertToPdfPoint(kasten.x0, kasten.y0);
        const [x2, y2] = sicht.convertToPdfPoint(kasten.x1, kasten.y1);
        const eintragWort = {
          text: wort.text,
          konf: wort.confidence ?? 0,
          x: Math.min(x1, x2), y: Math.min(y1, y2),
          b: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
        };
        woerter.push(eintragWort);
        zeilenWoerter.push(eintragWort);
      }
      if (zeilenWoerter.length) zeilen.push({ text: zeilenWoerter.map((w) => w.text).join(' '), woerter: zeilenWoerter });
    }

    const konfidenz = woerter.length ? woerter.reduce((s, w) => s + w.konf, 0) / woerter.length : 0;
    erkannt.set(eintrag.id, { woerter, zeilen, sprache, dichte, konfidenz, zeit: Date.now() });
    angelegt.push(eintrag.id);
    melde('ocr:seite', { seiteId: eintrag.id, woerter: woerter.length, konfidenz });
  }

  melde('ocr:geaendert');
  melde('dokument:geaendert');
  return angelegt;
}

/** tesseract.js liefert je nach Fassung blocks→paragraphs→lines oder lines. */
function sammleZeilen(data) {
  if (Array.isArray(data.lines) && data.lines.length) return data.lines;
  const zeilen = [];
  for (const block of data.blocks || []) {
    for (const absatz of block.paragraphs || []) {
      for (const zeile of absatz.lines || []) zeilen.push(zeile);
    }
    for (const zeile of block.lines || []) zeilen.push(zeile);
  }
  if (!zeilen.length && Array.isArray(data.words) && data.words.length) {
    return [{ words: data.words }];
  }
  return zeilen;
}

/* ---------- Textebene aus der Erkennung ---------------------------------- */

/** Legt unsichtbare, auswählbare Wörter über eine gerenderte Seite. */
export function legeErkannteTextebene(behaelter, seiteId, sicht) {
  const treffer = erkannt.get(seiteId);
  if (!treffer) return false;
  for (const wort of treffer.woerter) {
    const [x1, y1] = sicht.convertToViewportPoint(wort.x, wort.y + wort.h);
    const [x2, y2] = sicht.convertToViewportPoint(wort.x + wort.b, wort.y);
    const links = Math.min(x1, x2), oben = Math.min(y1, y2);
    const breite = Math.abs(x2 - x1), hoehe = Math.abs(y2 - y1);
    const span = el('span', {
      text: wort.text,
      stil: {
        left: `${links}px`, top: `${oben}px`,
        fontSize: `${hoehe * 0.92}px`, lineHeight: '1',
        transformOrigin: '0 0',
      },
    });
    behaelter.append(span);
    // Breite angleichen, damit Markierungsrechtecke zum Bild passen.
    const ist = span.getBoundingClientRect().width;
    if (ist > 0 && breite > 0) span.style.transform = `scaleX(${(breite / ist).toFixed(4)})`;
  }
  return true;
}

/* ---------- Bedienung ------------------------------------------------------ */

export function zeigeErkennungsDialog({ nurOhneText = false } = {}) {
  const ohneText = [];
  for (const eintrag of zustand.folge) {
    const vorhanden = zustand.textLaenge?.get(eintrag.id);
    if (vorhanden == null || vorhanden < 40) ohneText.push(eintrag);
  }

  const umfang = el('select', { klasse: 'feld' },
    el('option', { value: 'ohne', text: `Nur Seiten ohne Text (${ohneText.length})` }),
    el('option', { value: 'alle', text: `Alle Seiten (${zustand.folge.length})` }),
    el('option', { value: 'auswahl', text: `Gewählte Seiten (${zustand.gewaehlteSeiten.size})` }),
    el('option', { value: 'aktuell', text: `Nur Seite ${zustand.aktuelleSeite}` }));
  if (!nurOhneText && !ohneText.length) umfang.value = 'alle';

  const sprache = el('select', { klasse: 'feld' }, ...SPRACHEN.map((s) => el('option', { value: s.id, text: s.name })));
  const dichte = el('select', { klasse: 'feld' },
    el('option', { value: '150', text: '150 dpi — schnell' }),
    el('option', { value: '200', text: '200 dpi — ausgewogen', selected: true }),
    el('option', { value: '300', text: '300 dpi — gründlich, langsam' }));
  dichte.value = '200';

  const rumpf = el('div', {},
    el('div', { klasse: 'zeile' }, el('label', { text: 'Umfang' }), umfang),
    el('div', { klasse: 'zeile' }, el('label', { text: 'Sprache' }), sprache),
    el('div', { klasse: 'zeile' }, el('label', { text: 'Auflösung' }), dichte),
    el('p', { klasse: 'hinweis' },
      'Die Erkennung läuft auf diesem Gerät — je nach Rechner etwa 1 bis 4 Sekunden je Seite. ',
      'Das Seitenbild bleibt unverändert; der erkannte Text wird unsichtbar dahintergelegt. ',
      'Er ist damit durchsuchbar und kopierbar, aber nie fehlerfrei — Zahlen und Namen bitte prüfen.'));

  zeigeDialog({
    titel: 'Texterkennung',
    rumpf,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Erkennen', betont: true,
        tun: () => {
          const wahl = umfang.value;
          const seiten = wahl === 'alle' ? [...zustand.folge]
            : wahl === 'ohne' ? ohneText
            : wahl === 'auswahl' ? zustand.folge.filter((e) => zustand.gewaehlteSeiten.has(e.id))
            : [zustand.folge[zustand.aktuelleSeite - 1]];
          if (!seiten.length) { sage('Keine Seite ausgewählt', { art: 'warn' }); return false; }
          laufeMitAnzeige(seiten, sprache.value, Number(dichte.value));
        },
      },
    ],
  });
}

async function laufeMitAnzeige(seiten, sprache, dichte) {
  const lader = $('#lader');
  const text = $('#lader-text');
  lader.hidden = false;
  const abbrechen = el('button', { klasse: 'knopf knopf-klein', text: 'Abbrechen', beiClick: () => { brichAb(); text.textContent = 'Wird abgebrochen …'; } });
  lader.append(abbrechen);

  const beginn = Date.now();
  try {
    const vorher = new Map(erkannt);
    const angelegt = await erkenneSeiten({
      seiten, sprache, dichte,
      beiFortschritt: (n) => {
        if (n.art === 'seite') text.textContent = `Texterkennung — Seite ${n.seite} von ${n.gesamt}`;
        else if (n.status) text.textContent = `Texterkennung — ${uebersetzeStatus(n.status)}`;
      },
    });
    const dauer = Math.round((Date.now() - beginn) / 1000);
    if (angelegt.length) {
      const nachher = new Map(erkannt);
      merkeSchritt(`Text auf ${angelegt.length} Seite${angelegt.length === 1 ? '' : 'n'} erkannt`,
        () => { erkannt.clear(); for (const [k, v] of vorher) erkannt.set(k, v); melde('ocr:geaendert'); },
        () => { erkannt.clear(); for (const [k, v] of nachher) erkannt.set(k, v); melde('ocr:geaendert'); });
      const gesamtKonf = angelegt.reduce((s, id) => s + (erkannt.get(id)?.konfidenz || 0), 0) / angelegt.length;
      sage(`${angelegt.length} Seite${angelegt.length === 1 ? '' : 'n'} erkannt in ${dauer} s · Sicherheit ${Math.round(gesamtKonf)} %`);
    } else {
      sage('Nichts erkannt', { art: 'warn' });
    }
  } catch (fehler) {
    console.error(fehler);
    sage(`Texterkennung gescheitert: ${fehler?.message || fehler}`, { art: 'fehler', dauer: 8000 });
  } finally {
    abbrechen.remove();
    lader.hidden = true;
    await beendeArbeiter();
  }
}

function uebersetzeStatus(status) {
  const karte = {
    'loading tesseract core': 'Programm wird geladen',
    'initializing tesseract': 'Programm wird vorbereitet',
    'loading language traineddata': 'Sprachdaten werden geladen',
    'initializing api': 'Erkennung wird vorbereitet',
    'recognizing text': 'Text wird gelesen',
  };
  return karte[status] || status;
}

/** Übersicht für die rechte Tafel. */
export function erkennungsUebersicht() {
  if (!erkannt.size) return null;
  const seiten = [...erkannt.entries()].map(([id, wert]) => ({ seite: nummerVon(id), ...wert }))
    .filter((e) => e.seite > 0)
    .sort((a, b) => a.seite - b.seite);
  const woerter = seiten.reduce((s, e) => s + e.woerter.length, 0);
  const konfidenz = seiten.length ? seiten.reduce((s, e) => s + e.konfidenz, 0) / seiten.length : 0;
  return { seiten, woerter, konfidenz };
}
