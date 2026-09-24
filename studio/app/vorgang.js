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
    const zeile = el('button', {
      klasse: `schritt ist-${stand.art} ${ist ? 'ist-aktiv' : ''}`,
      daten: { schritt: schritt.id },
      'aria-current': ist ? 'step' : 'false',
      beiClick: () => { aktiverSchritt = schritt.id; schritt.tun(); zeichneSchiene(); },
    },
      el('i', { klasse: 'schritt-punkt', 'aria-hidden': 'true' }),
      el('span', { klasse: 'schritt-wort', text: schritt.wort }),
      stand.text ? el('span', { klasse: 'schritt-stand', text: stand.text }) : null);
    schiene.append(zeile);
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

  for (const ereignis of ['dokument:geladen', 'seiten:geaendert', 'anmerkungen:geaendert',
    'formular:geaendert', 'mitdenken:geaendert']) hoer(ereignis, zeichneSchiene);
  zeichneSchiene();
}
