/* Vorgang — die Schiene und die Blase.

   Die Einheit ist nicht die Datei, sondern der Vorgang: dieses Dokument, was
   daran offen ist, was erledigt ist, was als Nächstes kommt. Daraus folgen
   die beiden Dinge in dieser Datei:

   **Die Schiene** zeigt sechs Schritte mit ihrem Stand. Sie ersetzt keine
   Werkzeugliste, sie beantwortet eine andere Frage: nicht „was kann ich tun",
   sondern „was steht noch an". Die Zahlen kommen aus dem Dokument selbst —
   aus `mitdenken`, aus den Formularfeldern, aus den Anmerkungen. Ein Schritt
   ohne Grund im Dokument zeigt keine Zahl.

   **Die Blase** erscheint an einer Textauswahl und bietet an, was mit dieser
   Auswahl geht. Das ist der Unterschied zur Werkzeugzeile: die bot fünfzehn
   Werkzeuge auf Vorrat an, ohne zu wissen, ob eines davon gerade passt. */

import { zustand, melde, hoer, el, $ } from './kern.js';
import { befunde } from './mitdenken.js';
import { offeneFelder, hatFormular } from './formulare.js';
import { uebernehmeAuswahl, hatUnterschrift } from './anmerkungen.js';

let schiene = null;
let blase = null;
let aktiverSchritt = 'pruefen';

/* Jeder Schritt sagt, was er tut, und rechnet seinen Stand aus dem Dokument
   aus. `stand` liefert eine von vier Antworten: erledigt, offen mit Zahl,
   wartet, oder nichts zu tun. */
const SCHRITTE = [
  {
    id: 'lesen', wort: 'Lesen',
    stand: () => (zustand.folge.length ? { art: 'erledigt', text: `${zustand.folge.length} S.` } : { art: 'wartet' }),
    tun: () => { zeigeTafel('links', 'miniaturen'); },
  },
  {
    id: 'pruefen', wort: 'Prüfen',
    stand: () => {
      if (!befunde.untersucht) return { art: 'laeuft', text: '…' };
      const offen = zaehleBefunde();
      return offen ? { art: 'offen', text: String(offen) } : { art: 'erledigt', text: 'nichts' };
    },
    tun: () => { zeigeTafel('rechts', 'mitdenken'); },
  },
  {
    id: 'schwaerzen', wort: 'Schwärzen',
    stand: () => {
      const n = befunde.muster.length;
      if (!befunde.untersucht) return { art: 'laeuft', text: '…' };
      return n ? { art: 'offen', text: String(n) } : { art: 'nichts' };
    },
    tun: () => { zeigeTafel('rechts', 'mitdenken'); window.studio?.fuehreAus?.('werkzeug:schwaerzen'); },
  },
  {
    id: 'ausfuellen', wort: 'Ausfüllen',
    stand: () => {
      if (!hatFormular()) return { art: 'nichts' };
      const offen = offeneFelder().length;
      const alle = zustand.formularfelder.length;
      return offen ? { art: 'offen', text: `${alle - offen} von ${alle}` } : { art: 'erledigt', text: `${alle} von ${alle}` };
    },
    tun: () => { zeigeTafel('rechts', 'felder'); },
  },
  {
    id: 'unterschreiben', wort: 'Unterschreiben',
    stand: () => (hatUnterschrift() ? { art: 'erledigt', text: 'gesetzt' } : { art: 'wartet' }),
    tun: () => { window.studio?.fuehreAus?.('werkzeug:unterschrift'); },
  },
  {
    id: 'ausgeben', wort: 'Ausgeben',
    stand: () => ({ art: 'wartet' }),
    tun: () => { window.studio?.fuehreAus?.('export:word'); },
  },
];

/* **Die Werkzeuge liegen unter ihrem Schritt.** Das ist der Rest des
   Umbaus: statt fünfzehn Werkzeugen auf Vorrat in einer Zeile zeigt die
   Schiene die, die zum aktiven Schritt gehören. Verloren geht keines —
   jedes steht weiter im Befehlsfeld, und die selteneren unter „Weitere". */
const WERKZEUGE_JE_SCHRITT = {
  lesen: [
    ['werkzeug:auswahl', 'Auswahl'],
    ['werkzeug:text', 'Text'],
    ['werkzeug:bereich', 'Bereich kopieren'],
    ['seiten:ordnen', 'Seiten ordnen'],
    ['vergleich', 'Mit anderer Datei vergleichen'],
  ],
  pruefen: [
    ['texterkennung', 'Texterkennung (OCR)'],
    ['werkzeug:hervor', 'Markieren'],
    ['werkzeug:unterstrich', 'Unterstreichen'],
    ['werkzeug:notiz', 'Kommentar'],
    ['werkzeug:freihand', 'Freihand'],
  ],
  schwaerzen: [
    ['werkzeug:schwaerzen', 'Redigieren'],
    ['werkzeug:ersetzen', 'Text bearbeiten'],
  ],
  ausfuellen: [
    ['werkzeug:feld', 'Formularfeld anlegen'],
  ],
  unterschreiben: [
    ['werkzeug:unterschrift', 'Signieren'],
    ['werkzeug:stempel', 'Stempel'],
  ],
  ausgeben: [
    ['sichern:als', 'Sichern unter …'],
    ['aufdruck', 'Aufdruck: Wasserzeichen, Kopf- und Fußzeile'],
  ],
};


/* Wer ein Werkzeug über die Tastatur wählt, springt damit auch im Vorgang.
   Sonst leuchtet ein Werkzeug in einem Schritt auf, den niemand sieht. */
function schrittZumWerkzeug(werkzeugId) {
  for (const [schrittId, taten] of Object.entries(WERKZEUGE_JE_SCHRITT)) {
    if (taten.some(([befehlId]) => befehlId === `werkzeug:${werkzeugId}`)) return schrittId;
  }
  return null;
}

function zaehleBefunde() {
  return befunde.muster.length
    + (befunde.gescannt ? 1 : 0)
    + befunde.leereSeiten.length
    + (hatFormular() && offeneFelder().length ? 1 : 0);
}

function zeigeTafel(seite, name) {
  const wahl = seite === 'links' ? `[data-tafel="${name}"].reiter-knopf` : `[data-rtafel="${name}"].reiter-knopf`;
  document.querySelector(wahl)?.click();
}

/* ---------- Die Schiene ------------------------------------------------- */

export function zeichneSchiene() {
  if (!schiene) return;
  schiene.innerHTML = '';
  const fertig = SCHRITTE.filter((s) => s.stand().art === 'erledigt').length;

  schiene.append(el('div', { klasse: 'schienenkopf' },
    el('span', { klasse: 'schienenkopf-wort', text: 'Vorgang' }),
    el('span', { klasse: 'schienenkopf-zahl', text: `${fertig} von ${SCHRITTE.length}` })));

  for (const schritt of SCHRITTE) {
    const stand = schritt.stand();
    const ist = schritt.id === aktiverSchritt;
    const hatTaten = (WERKZEUGE_JE_SCHRITT[schritt.id] || []).length > 0;
    /* Der Schritt ist ein Aufklapper: er sagt, ob seine Werkzeuge offen sind,
       und ein zweiter Druck schließt sie wieder. Ohne das gäbe es einen
       Aufklapper, der sich nur öffnen lässt — und die Schiene wüchse mit
       jedem Klick, ohne je wieder schmaler zu werden. */
    const zeile = el('button', {
      klasse: `schritt ist-${stand.art} ${ist ? 'ist-aktiv' : ''}`,
      daten: { schritt: schritt.id },
      'aria-current': ist ? 'step' : 'false',
      'aria-expanded': hatTaten ? (ist ? 'true' : 'false') : null,
      'aria-controls': hatTaten ? `schritt-werkzeuge-${schritt.id}` : null,
      beiClick: () => {
        if (ist) { aktiverSchritt = null; zeichneSchiene(); return; }
        aktiverSchritt = schritt.id;
        schritt.tun();
        zeichneSchiene();
      },
    },
      el('i', { klasse: 'schritt-punkt', 'aria-hidden': 'true' }),
      el('span', { klasse: 'schritt-wort', text: schritt.wort }),
      stand.text ? el('span', { klasse: 'schritt-stand', text: stand.text }) : null);
    schiene.append(zeile);

    /* Unter dem aktiven Schritt stehen seine Werkzeuge — und nur seine. */
    if (!ist) continue;
    const taten = WERKZEUGE_JE_SCHRITT[schritt.id] || [];
    if (!taten.length) continue;
    const kasten = el('div', { klasse: 'schritt-werkzeuge', id: `schritt-werkzeuge-${schritt.id}` });
    for (const [befehlId, wortlaut] of taten) {
      kasten.append(el('button', {
        klasse: `schritt-werkzeug ${zustand.werkzeug === befehlId.replace('werkzeug:', '') ? 'ist-aktiv' : ''}`,
        text: wortlaut,
        daten: { befehl: befehlId },
        beiClick: () => { window.studio?.fuehreAus?.(befehlId); zeichneSchiene(); },
      }));
    }
    kasten.append(el('button', {
      klasse: 'schritt-werkzeug ist-weiter',
      text: 'Weitere Werkzeuge …',
      beiClick: () => window.studio?.fuehreAus?.('palette'),
    }));
    schiene.append(kasten);
  }
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
  schiene = $('#vorgangsschiene');

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

  /* Escape in der Schiene klappt den Schritt wieder zu — und der Fokus bleibt,
     wo er war. Ohne das steht er nach dem Schließen auf einem Knopf, den es
     nicht mehr gibt, und die Tastatur fängt oben auf der Seite wieder an. */
  schiene?.addEventListener('keydown', (ereignis) => {
    if (ereignis.key !== 'Escape' || !aktiverSchritt) return;
    ereignis.preventDefault();
    const id = aktiverSchritt;
    aktiverSchritt = null;
    zeichneSchiene();
    schiene.querySelector(`.schritt[data-schritt="${id}"]`)?.focus();
  });

  /* „werkzeug:gewechselt" steht mit in der Liste, seit die Werkzeuge in der
     Schiene stehen: wer ein Werkzeug über die Tastatur wählt, soll es in der
     Schiene aufleuchten sehen. */
  for (const ereignis of ['dokument:geladen', 'seiten:geaendert', 'anmerkungen:geaendert',
    'formular:geaendert', 'mitdenken:geaendert']) hoer(ereignis, zeichneSchiene);
  hoer('werkzeug:gewechselt', (id) => {
    const schritt = schrittZumWerkzeug(id);
    if (schritt) aktiverSchritt = schritt;
    zeichneSchiene();
  });
  zeichneSchiene();
}
