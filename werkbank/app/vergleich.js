/* Vergleich — zwei Dokumente wortweise gegenüberstellen.

   Verglichen wird der ausgelesene Text, nicht das Bild. Bei Scans ohne
   Textebene sagt der Vergleich das ausdrücklich, statt „keine Unterschiede"
   zu behaupten. */

import { el, zeigeDialog, ladeDatei, sage, mitLader } from './kern.js';
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

function zeigeVergleich(links, rechts, nameLinks, nameRechts) {
  const anzahl = Math.max(links.length, rechts.length);
  const auswahl = el('select', { klasse: 'feld' },
    ...Array.from({ length: anzahl }, (_, i) => el('option', { value: String(i), text: `Seite ${i + 1}` })));
  const linkeSpalte = el('div', { klasse: 'vergleich-spalte' });
  const rechteSpalte = el('div', { klasse: 'vergleich-spalte' });
  const zusammenfassung = el('p', { klasse: 'hinweis' });

  const zeichne = () => {
    const i = Number(auswahl.value);
    const l = (links[i] || '').replace(/\s+/g, ' ').trim();
    const r = (rechts[i] || '').replace(/\s+/g, ' ').trim();
    linkeSpalte.innerHTML = '';
    rechteSpalte.innerHTML = '';

    if (!l && !r) {
      zusammenfassung.textContent = 'Beide Seiten enthalten keinen auslesbaren Text (vermutlich Scans). Ein Textvergleich ist hier nicht aussagekräftig.';
      return;
    }
    const vorspann = (!l || !r)
      ? `In „${l ? nameRechts : nameLinks}" trägt diese Seite keinen auslesbaren Text — Scan, Bild oder geschwärzte und gerasterte Seite. Deshalb steht hier der ganze Text der Gegenseite als Unterschied. `
      : '';
    const stuecke = unterschied(l, r);
    let weg = 0, neu = 0;
    for (const stueck of stuecke) {
      if (stueck.art === 'weg') weg += stueck.text.trim().split(/\s+/).length;
      if (stueck.art === 'neu') neu += stueck.text.trim().split(/\s+/).length;
      if (stueck.art !== 'neu') linkeSpalte.append(el('span', { klasse: stueck.art === 'weg' ? 'diff-weg' : '', text: stueck.text }));
      if (stueck.art !== 'weg') rechteSpalte.append(el('span', { klasse: stueck.art === 'neu' ? 'diff-neu' : '', text: stueck.text }));
    }
    zusammenfassung.textContent = vorspann + (weg || neu
      ? `${weg} Wörter entfallen, ${neu} Wörter neu.`
      : 'Kein Unterschied im Text dieser Seite.');
  };
  auswahl.addEventListener('change', zeichne);

  const rumpf = el('div', {},
    el('div', { klasse: 'zeile' }, el('label', { text: 'Seite' }), auswahl,
      el('span', { klasse: 'hinweis', text: `${links.length} Seiten ↔ ${rechts.length} Seiten` })),
    zusammenfassung,
    el('div', { klasse: 'vergleich' },
      el('div', {}, el('h3', { klasse: 'klein', text: nameLinks }), linkeSpalte),
      el('div', {}, el('h3', { klasse: 'klein', text: nameRechts }), rechteSpalte)));

  zeigeDialog({ titel: 'Vergleich', rumpf, breit: true, knoepfe: [{ beschriftung: 'Schließen', betont: true }] });
  zeichne();
}
