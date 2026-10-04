/* Vorgang — die Modusleiste und die Blase.

   Die Einheit ist nicht die Datei, sondern der Vorgang: dieses Dokument, was
   daran offen ist, was erledigt ist, was als Nächstes kommt.

   **Die Modusleiste** (Atelier-Entwurf) ersetzt die Schiene mit sechs
   Schritten. Vier Modi — Bearbeiten, Kommentieren, Organisieren,
   Exportieren — sagen, womit man gerade umgeht; ihre Werkzeuge stehen oben
   in der rechten Leiste, dem Inspektor. Was am Dokument noch ansteht, zählt
   weiter das Dokument selbst (`vorgangsstand`): offene Hinweise und
   Schwärzungsfunde am Reiter „Hinweise", leere Pflichtfelder an „Felder".
   Kein Werkzeug ging dabei verloren — jedes steht unter einem Modus, im Menü
   und im Befehlsfeld.

   **Die Blase** erscheint an einer Textauswahl und bietet an, was mit dieser
   Auswahl geht. */

import { zustand, melde, hoer, el, $ } from './kern.js';
import { befunde } from './mitdenken.js';
import { offeneFelder, hatFormular } from './formulare.js';
import { uebernehmeAuswahl, hatUnterschrift } from './anmerkungen.js';

let modi = null;
let inspektor = null;
let blase = null;
let aktiverModus = 'kommentieren';

/* Der Stand des Vorgangs, aus dem Dokument gerechnet. Jede Zeile beantwortet
   eine Frage mit einer von vier Antworten: erledigt, offen mit Zahl, wartet,
   oder nichts zu tun. Ein Schritt ohne Grund im Dokument zeigt keine Zahl. */
const SCHRITTE = [
  {
    id: 'lesen', wort: 'Lesen',
    stand: () => (zustand.folge.length ? { art: 'erledigt', text: `${zustand.folge.length} S.` } : { art: 'wartet' }),
  },
  {
    id: 'pruefen', wort: 'Prüfen',
    stand: () => {
      if (!befunde.untersucht) return { art: 'laeuft', text: '…' };
      const offen = zaehleBefunde();
      return offen ? { art: 'offen', text: String(offen) } : { art: 'erledigt', text: 'nichts' };
    },
  },
  {
    id: 'schwaerzen', wort: 'Schwärzen',
    stand: () => {
      const n = befunde.muster.length;
      if (!befunde.untersucht) return { art: 'laeuft', text: '…' };
      return n ? { art: 'offen', text: String(n) } : { art: 'nichts' };
    },
  },
  {
    id: 'ausfuellen', wort: 'Ausfüllen',
    stand: () => {
      if (!hatFormular()) return { art: 'nichts' };
      const offen = offeneFelder().length;
      const alle = zustand.formularfelder.length;
      return offen ? { art: 'offen', text: `${alle - offen} von ${alle}` } : { art: 'erledigt', text: `${alle} von ${alle}` };
    },
  },
  {
    id: 'unterschreiben', wort: 'Unterschreiben',
    stand: () => (hatUnterschrift() ? { art: 'erledigt', text: 'gesetzt' } : { art: 'wartet' }),
  },
  {
    id: 'ausgeben', wort: 'Ausgeben',
    stand: () => ({ art: 'wartet' }),
  },
];

/** Der Stand jedes Schritts — für Zähler, Prüfungen und die Startseite. */
export function vorgangsstand() {
  return SCHRITTE.map((s) => ({ id: s.id, wort: s.wort, ...s.stand() }));
}

/* Vier Modi wie im Entwurf. Jeder bringt seine Werkzeuge mit; der erste
   Eintrag ist das, was ein Druck auf den Modus gleich einschaltet — oder
   nichts, wenn der Modus nur eine Auswahl anbietet. */
const MODI = [
  {
    id: 'bearbeiten', wort: 'Bearbeiten', kuerzel: '⌘ E', titel: 'Bearbeiten', start: 'werkzeug:ersetzen',
    tafel: 'verlauf',
    werkzeuge: [
      ['werkzeug:ersetzen', 'Text bearbeiten'],
      ['werkzeug:text', 'Text einfügen'],
      ['bilder', 'Bilder'],
      ['texterkennung', 'Texterkennung (OCR)'],
      ['werkzeug:feld', 'Formularfeld anlegen'],
      ['formular:erkennen', 'Felder erkennen'],
      ['aufdruck', 'Wasserzeichen, Kopf- und Fußzeile'],
    ],
  },
  {
    id: 'kommentieren', wort: 'Kommentieren', titel: 'Kommentieren', start: null,
    tafel: 'anmerkungen',
    werkzeuge: [
      ['werkzeug:auswahl', 'Auswahl'],
      ['werkzeug:hervor', 'Markieren'],
      ['werkzeug:unterstrich', 'Unterstreichen'],
      ['werkzeug:notiz', 'Kommentar'],
      ['werkzeug:freihand', 'Freihand'],
      ['werkzeug:rechteck', 'Rechteck'],
      ['werkzeug:pfeil', 'Pfeil'],
      ['werkzeug:stempel', 'Stempel'],
      ['formular:naechstes', 'Formular ausfüllen'],
    ],
  },
  {
    id: 'organisieren', wort: 'Organisieren', titel: 'Organisieren', start: null,
    tafel: 'mitdenken',
    werkzeuge: [
      ['seiten:ordnen', 'Seiten ordnen'],
      ['datei:anhaengen', 'Datei anhängen'],
      ['teilen', 'Dokument teilen'],
      ['seiten:drehenRechts', 'Seiten drehen'],
      ['lesezeichen', 'Lesezeichen'],
      ['vergleich', 'Mit anderer Datei vergleichen'],
      ['werkzeug:bereich', 'Bereich kopieren'],
    ],
  },
  {
    id: 'exportieren', wort: 'Exportieren', titel: 'Exportieren', start: null,
    tafel: 'verlauf',
    werkzeuge: [
      ['sichern:als', 'Sichern unter …'],
      ['word:ausgeben', 'Word (.docx)'],
      ['excel:ausgeben', 'Excel (.xlsx)'],
      ['powerpoint:ausgeben', 'PowerPoint (.pptx)'],
      ['bild:ausgeben', 'Seite als Bild'],
      ['verkleinern', 'Verkleinern'],
      ['schutz:setzen', 'Mit Kennwort schützen'],
      ['drucken', 'Drucken'],
    ],
  },
];

/* Wer ein Werkzeug über die Tastatur wählt, springt damit auch in dessen
   Modus. Sonst leuchtet ein Werkzeug in einem Modus auf, den niemand sieht. */
function modusZumWerkzeug(werkzeugId) {
  const id = `werkzeug:${werkzeugId}`;
  return MODI.find((m) => m.werkzeuge.some(([befehlId]) => befehlId === id))?.id || null;
}

function zaehleBefunde() {
  return befunde.muster.length
    + (befunde.gescannt ? 1 : 0)
    + befunde.leereSeiten.length
    + (hatFormular() && offeneFelder().length ? 1 : 0);
}

function zeigeTafel(name) {
  document.querySelector(`[data-rtafel="${name}"].reiter-knopf`)?.click();
}

/** Schaltet einen Modus ein — mit seinem ersten Werkzeug, wenn er eines hat. */
export function setzeModus(id) {
  const modus = MODI.find((m) => m.id === id);
  if (!modus) return;
  aktiverModus = id;
  if (modus.start) window.studio?.fuehreAus?.(modus.start);
  zeigeTafel(modus.tafel);
  zeichneModi();
}

/* ---------- Die Modusleiste und der Inspektor ---------------------------- */

export function zeichneModi() {
  if (modi) {
    modi.innerHTML = '';
    for (const modus of MODI) {
      const ist = modus.id === aktiverModus;
      modi.append(el('button', {
        klasse: `modus ${ist ? 'ist-aktiv' : ''}`,
        role: 'tab',
        'aria-selected': ist ? 'true' : 'false',
        /* Eine Tab-Liste ist ein Halt für die Tabulatortaste, nicht vier:
           hinein mit Tab, zwischen den Modi mit den Pfeilen. */
        tabindex: ist ? '0' : '-1',
        daten: { modus: modus.id },
        beiClick: () => setzeModus(modus.id),
      },
        el('span', { text: modus.wort }),
        modus.kuerzel ? el('kbd', { klasse: 'modus-kuerzel', text: modus.kuerzel, 'aria-hidden': 'true' }) : null));
    }
  }
  if (inspektor) {
    const modus = MODI.find((m) => m.id === aktiverModus);
    inspektor.innerHTML = '';
    if (!modus) return;
    inspektor.append(el('h2', { klasse: 'inspektor-titel', text: modus.titel }));
    const liste = el('div', { klasse: 'inspektor-werkzeuge', role: 'group', 'aria-label': `Werkzeuge: ${modus.titel}` });
    for (const [befehlId, wortlaut] of modus.werkzeuge) {
      const werkzeug = befehlId.startsWith('werkzeug:') ? befehlId.slice(9) : null;
      const an = werkzeug && zustand.werkzeug === werkzeug;
      liste.append(el('button', {
        klasse: `inspektor-werkzeug ${an ? 'ist-aktiv' : ''}`,
        text: wortlaut,
        daten: { befehl: befehlId },
        'aria-pressed': werkzeug ? (an ? 'true' : 'false') : null,
        beiClick: () => { window.studio?.fuehreAus?.(befehlId); zeichneModi(); },
      }));
    }
    liste.append(el('button', {
      klasse: 'inspektor-werkzeug ist-weiter',
      text: 'Weitere Werkzeuge …',
      beiClick: () => window.studio?.fuehreAus?.('palette'),
    }));
    inspektor.append(liste);
  }
  zeichneZaehler();
}

/* Der Stand des Vorgangs als Zahl am Reiter: „Hinweise 8", „Felder 2/10". */
function zeichneZaehler() {
  const stand = Object.fromEntries(vorgangsstand().map((s) => [s.id, s]));
  const setze = (tafel, text) => {
    const knopf = document.querySelector(`[data-rtafel="${tafel}"].reiter-knopf`);
    if (!knopf) return;
    let zahl = knopf.querySelector('.reiter-zahl');
    if (!text) { zahl?.remove(); return; }
    if (!zahl) { zahl = el('span', { klasse: 'reiter-zahl' }); knopf.append(zahl); }
    /* Mit Leerzeichen davor: vorgelesen wird „Hinweise 8“, nicht „Hinweise8“. */
    zahl.textContent = ` ${text}`;
  };
  const pruefen = stand.pruefen;
  setze('mitdenken', pruefen?.art === 'offen' ? pruefen.text : '');
  const felder = stand.ausfuellen;
  setze('felder', felder?.art === 'offen' ? felder.text.replace(' von ', '/') : '');
}

/* ---------- Die Blase --------------------------------------------------- */

const BLASENTATEN = [
  { wort: 'Markieren', art: 'hervor' },
  { wort: 'Unterstreichen', art: 'unterstrich' },
  { wort: 'Durchstreichen', art: 'durchstrich' },
  { wort: 'Schwärzen', art: 'schwaerzen', gefahr: true },
];

function verbergeBlase() { if (blase) blase.hidden = true; }

function zeigeBlase() {
  const auswahl = window.getSelection();
  if (!auswahl || auswahl.isCollapsed || !auswahl.rangeCount) return verbergeBlase();
  const bereich = auswahl.getRangeAt(0);
  /* Nur auf dem Blatt: eine Auswahl im Kommentarfeld ist keine Textstelle. */
  const knoten = bereich.commonAncestorContainer;
  const element = knoten.nodeType === 1 ? knoten : knoten.parentElement;
  if (!element?.closest?.('.textebene')) return verbergeBlase();
  const kasten = bereich.getBoundingClientRect();
  if (kasten.width < 1 && kasten.height < 1) return verbergeBlase();

  blase.hidden = false;
  const eigen = blase.getBoundingClientRect();
  const rand = 8;
  const links = Math.max(rand, Math.min(
    kasten.left + kasten.width / 2 - eigen.width / 2,
    window.innerWidth - eigen.width - rand));
  /* Über der Auswahl, außer ganz oben — dann darunter. */
  const oben = kasten.top - eigen.height - 10;
  blase.style.left = `${Math.round(links)}px`;
  blase.style.top = `${Math.round(oben > rand ? oben : kasten.bottom + 10)}px`;
}

export function starteVorgang() {
  modi = $('#modi');
  inspektor = $('#inspektor-kopf');
  modi?.addEventListener('keydown', (ereignis) => {
    const schritt = { ArrowRight: 1, ArrowLeft: -1, Home: -Infinity, End: Infinity }[ereignis.key];
    if (schritt === undefined) return;
    ereignis.preventDefault();
    const i = MODI.findIndex((m) => m.id === aktiverModus);
    const ziel = Number.isFinite(schritt)
      ? (i + schritt + MODI.length) % MODI.length
      : (schritt < 0 ? 0 : MODI.length - 1);
    setzeModus(MODI[ziel].id);
    modi.querySelector(`.modus[data-modus="${MODI[ziel].id}"]`)?.focus();
  });

  blase = el('div', { klasse: 'werkzeugblase', id: 'werkzeugblase', role: 'toolbar',
    'aria-label': 'Was mit dieser Auswahl geht', hidden: true });
  for (const tat of BLASENTATEN) {
    blase.append(el('button', {
      klasse: `blasen-knopf ${tat.gefahr ? 'ist-gefahr' : ''}`,
      text: tat.wort,
      /* `mousedown` statt `click`: ein Klick räumt die Auswahl ab, bevor er
         ankommt — dann gäbe es nichts mehr zu markieren. */
      beiMousedown: (e) => {
        e.preventDefault();
        uebernehmeAuswahl(tat.art);
        window.getSelection()?.removeAllRanges();
        verbergeBlase();
      },
    }));
  }
  document.body.append(blase);

  /* Erst wenn die Maus los ist: während des Ziehens wandert die Blase sonst
     mit und steht im Weg. */
  let ziehtGerade = false;
  document.addEventListener('selectionchange', () => { if (!ziehtGerade) zeigeBlase(); });
  document.addEventListener('mousedown', (e) => {
    if (e.target.closest?.('.werkzeugblase')) return;
    ziehtGerade = true;
    verbergeBlase();
  });
  document.addEventListener('mouseup', () => { ziehtGerade = false; setTimeout(zeigeBlase, 0); });
  /* Escape räumt beides weg: die Blase und die Auswahl, auf die sie sich
     bezieht. Nur die Blase zu verstecken hilft nicht — die Auswahl steht
     noch, und beim nächsten Klick käme sie zurück. */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || blase.hidden) return;
    window.getSelection()?.removeAllRanges();
    verbergeBlase();
  });
  window.addEventListener('scroll', verbergeBlase, true);

  /* Wer ein Werkzeug über die Tastatur wählt, soll es im Inspektor
     aufleuchten sehen — und den Modus dazu. */
  for (const ereignis of ['dokument:geladen', 'seiten:geaendert', 'anmerkungen:geaendert',
    'formular:geaendert', 'mitdenken:geaendert']) hoer(ereignis, zeichneModi);
  hoer('werkzeug:gewechselt', (id) => {
    const modus = modusZumWerkzeug(id);
    if (modus) aktiverModus = modus;
    zeichneModi();
  });
  zeichneModi();
}
