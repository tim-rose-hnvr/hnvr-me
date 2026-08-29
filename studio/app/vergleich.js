/* Vergleich — zwei Dokumente wortweise gegenüberstellen.

   Verglichen wird der ausgelesene Text, nicht das Bild. Bei Scans ohne
   Textebene sagt der Vergleich das ausdrücklich, statt „keine Unterschiede"
   zu behaupten. */

import { el, $, ladeDatei, melde } from './kern.js';
import { ladeQuelle } from './dokument.js';
import { zustand } from './kern.js';
import { seitenText } from './dokument.js';

/** Wortweiser Unterschied über die längste gemeinsame Folge. */
export function unterschied(links, rechts) {
  const a = links.split(/(\s+)/).filter((s) => s !== '');
  const b = rechts.split(/(\s+)/).filter((s) => s !== '');
  const n = a.length, m = b.length;
  // Bei sehr langen Texten grob absichern.
  if (n * m > 4_000_000) return [{ art: 'gleich', text: links }, { art: 'hinweis', text: '… zu lang für Wortvergleich' }];

  const tafel = new Uint32Array((n + 1) * (m + 1));
  const bei = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tafel[bei(i, j)] = a[i] === b[j] ? tafel[bei(i + 1, j + 1)] + 1 : Math.max(tafel[bei(i + 1, j)], tafel[bei(i, j + 1)]);
    }
  }
  const stuecke = [];
  let i = 0, j = 0;
  const schiebe = (art, text) => {
    const letztes = stuecke.at(-1);
    if (letztes && letztes.art === art) letztes.text += text;
    else stuecke.push({ art, text });
  };
  while (i < n && j < m) {
    if (a[i] === b[j]) { schiebe('gleich', a[i]); i++; j++; }
    else if (tafel[bei(i + 1, j)] >= tafel[bei(i, j + 1)]) { schiebe('weg', a[i]); i++; }
    else { schiebe('neu', b[j]); j++; }
  }
  while (i < n) { schiebe('weg', a[i++]); }
  while (j < m) { schiebe('neu', b[j++]); }
  return stuecke;
}

export async function vergleicheMitDatei(datei) {
  const bytes = await ladeDatei(datei);
  const fremd = await ladeQuelle(bytes, datei.name);

  const eigeneSeiten = [];
  for (const eintrag of zustand.folge) eigeneSeiten.push((await seitenText(eintrag)).roh);

  const fremdeSeiten = [];
  for (let i = 0; i < fremd.seitenzahl; i++) {
    const seite = await fremd.pdf.getPage(i + 1);
    const inhalt = await seite.getTextContent();
    fremdeSeiten.push(inhalt.items.map((s) => s.str + (s.hasEOL ? '\n' : '')).join(''));
  }

  zeigeVergleich(eigeneSeiten, fremdeSeiten, zustand.name, datei.name);
  zustand.quellen.delete(fremd.id);
}

/* ---------- Der Vergleich als eigene Ansicht ------------------------------ */

/* Vorher lag er in einem Dialog. Ein Dialog ist das falsche Möbel dafür: man
   vergleicht nicht in zwei Sekunden, sondern blättert hin und her, sucht die
   Stelle, liest nach. Das Handoff macht daraus zu Recht eine der drei
   Hauptansichten — sie tritt an die Stelle der Bühne und hat ihre eigene
   Kopfzeile mit Legende. */

let offen = false;
export function vergleichOffen() { return offen; }

export function schliesseVergleich() {
  const ansicht = $('#vergleich-ansicht');
  if (!ansicht || ansicht.hidden) return;
  ansicht.hidden = true;
  ansicht.innerHTML = '';
  $('#buehne').hidden = false;
  offen = false;
  melde('ansicht:gewechselt', 'dokument');
}

function zeigeVergleich(links, rechts, nameLinks, nameRechts) {
  const ansicht = $('#vergleich-ansicht');
  if (!ansicht) return;
  ansicht.innerHTML = '';
  ansicht.hidden = false;
  $('#buehne').hidden = true;
  offen = true;
  melde('ansicht:gewechselt', 'vergleich');

  const anzahl = Math.max(links.length, rechts.length);
  let seite = 0;

  const zaehlerNeu = el('span', { klasse: 'diff-marke diff-marke-neu' });
  const zaehlerWeg = el('span', { klasse: 'diff-marke diff-marke-weg' });
  const zaehlerGleich = el('span', { klasse: 'klein leise' });
  const seitenmarke = el('span', { klasse: 'mono klein' });

  const linkeSpalte = el('div', { klasse: 'vergleich-spalte' });
  const rechteSpalte = el('div', { klasse: 'vergleich-spalte' });
  const zusammenfassung = el('p', { klasse: 'vergleich-hinweis' });

  const blaettere = (schritt) => {
    seite = Math.max(0, Math.min(anzahl - 1, seite + schritt));
    zeichne();
  };

  const kopf = el('header', { klasse: 'vergleich-kopf' },
    el('div', { klasse: 'vergleich-titel' },
      el('strong', { text: 'Versionsvergleich' }),
      seitenmarke),
    el('div', { klasse: 'vergleich-legende' }, zaehlerNeu, zaehlerWeg, zaehlerGleich),
    el('div', { klasse: 'vergleich-nav' },
      el('button', { klasse: 'knopf knopf-klein', text: '‹', title: 'Vorherige Seite', beiClick: () => blaettere(-1) }),
      el('button', { klasse: 'knopf knopf-klein', text: '›', title: 'Nächste Seite', beiClick: () => blaettere(1) }),
      el('button', { klasse: 'knopf knopf-klein', text: 'Fertig', title: 'Vergleich schließen (Esc)', beiClick: schliesseVergleich })));

  const gitter = el('div', { klasse: 'vergleich' },
    el('div', { klasse: 'vergleich-seite' },
      el('div', { klasse: 'vergleich-kennung mono', text: nameLinks }), linkeSpalte),
    el('div', { klasse: 'vergleich-seite' },
      el('div', { klasse: 'vergleich-kennung mono' }, nameRechts, el('span', { klasse: 'diff-marke diff-marke-neu', text: 'aktuell' })), rechteSpalte));

  ansicht.append(kopf, zusammenfassung, gitter);

  function zeichne() {
    const l = (links[seite] || '').replace(/\s+/g, ' ').trim();
    const r = (rechts[seite] || '').replace(/\s+/g, ' ').trim();
    linkeSpalte.innerHTML = '';
    rechteSpalte.innerHTML = '';
    seitenmarke.textContent = `Seite ${seite + 1} von ${anzahl} · ${links.length} ↔ ${rechts.length} Seiten`;

    if (!l && !r) {
      zusammenfassung.textContent = 'Beide Seiten enthalten keinen auslesbaren Text (vermutlich Scans). Ein Textvergleich ist hier nicht aussagekräftig.';
      zaehlerNeu.textContent = ''; zaehlerWeg.textContent = ''; zaehlerGleich.textContent = '';
      return;
    }
    const vorspann = (!l || !r)
      ? `In „${l ? nameRechts : nameLinks}" trägt diese Seite keinen auslesbaren Text — Scan, Bild oder geschwärzte und gerasterte Seite. Deshalb steht hier der ganze Text der Gegenseite als Unterschied. `
      : '';
    const stuecke = unterschied(l, r);
    let weg = 0, neu = 0, gleich = 0;
    for (const stueck of stuecke) {
      const woerter = stueck.text.trim() ? stueck.text.trim().split(/\s+/).length : 0;
      if (stueck.art === 'weg') weg += woerter;
      else if (stueck.art === 'neu') neu += woerter;
      else gleich += woerter;
      if (stueck.art !== 'neu') linkeSpalte.append(el('span', { klasse: stueck.art === 'weg' ? 'diff-weg' : '', text: stueck.text }));
      if (stueck.art !== 'weg') rechteSpalte.append(el('span', { klasse: stueck.art === 'neu' ? 'diff-neu' : '', text: stueck.text }));
    }
    zaehlerNeu.textContent = `hinzugefügt ${neu}`;
    zaehlerWeg.textContent = `entfernt ${weg}`;
    zaehlerGleich.textContent = `unverändert ${gleich}`;
    zusammenfassung.textContent = vorspann + (weg || neu
      ? `${weg} Wörter entfallen, ${neu} Wörter neu.`
      : 'Kein Unterschied im Text dieser Seite.');
  }

  document.addEventListener('keydown', beiTaste);
  zeichne();
}

function beiTaste(ereignis) {
  if (!offen) return;
  if (ereignis.key === 'Escape') { ereignis.preventDefault(); schliesseVergleich(); }
}
