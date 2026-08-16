/* Suche — Volltext über alle Seiten, Treffer in der Textebene hervorheben. */

import { zustand, melde, hoer, el, sage } from './kern.js';
import { seitenText } from './dokument.js';

let treffer = [];        // [{ seitenId, seite, index, ausschnitt, laenge }]
let aktiv = -1;
let begriff = '';
let einstellungen = { grossKlein: false, ganzesWort: false };

export function trefferListe() { return treffer; }
export function aktiverTreffer() { return treffer[aktiv] || null; }
export function suchbegriff() { return begriff; }

export async function suche(text, optionen = {}) {
  Object.assign(einstellungen, optionen);
  begriff = text;
  treffer = [];
  aktiv = -1;
  if (!text || text.length < 2) { melde('suche:geaendert'); return treffer; }

  const muster = baueMuster(text);
  for (let i = 0; i < zustand.folge.length; i++) {
    const eintrag = zustand.folge[i];
    const { roh } = await seitenText(eintrag);
    const gebuendelt = roh.replace(/\s+/g, ' ');
    muster.lastIndex = 0;
    let fund;
    while ((fund = muster.exec(gebuendelt)) !== null) {
      const start = fund.index;
      treffer.push({
        seitenId: eintrag.id,
        seite: i + 1,
        index: start,
        laenge: fund[0].length,
        ausschnitt: gebuendelt.slice(Math.max(0, start - 40), start + fund[0].length + 50).trim(),
      });
      if (fund[0].length === 0) muster.lastIndex++;
      if (treffer.length > 2000) break;
    }
  }
  melde('suche:geaendert');
  return treffer;
}

function baueMuster(text) {
  const entschaerft = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const kern = einstellungen.ganzesWort ? `\\b${entschaerft}\\b` : entschaerft;
  return new RegExp(kern, einstellungen.grossKlein ? 'g' : 'gi');
}

export function springeZu(index, { zeigeSeite, bringeInSicht }) {
  if (!treffer.length) return;
  aktiv = ((index % treffer.length) + treffer.length) % treffer.length;
  const t = treffer[aktiv];
  zeigeSeite(t.seite);
  setTimeout(() => { markiereAlle(); bringeInSicht?.(t.seitenId); }, 260);
  melde('suche:geaendert');
}

export function weiter(hilfen) { springeZu(aktiv + 1, hilfen); }
export function zurueck(hilfen) { springeZu(aktiv - 1, hilfen); }

export function leere() {
  begriff = ''; treffer = []; aktiv = -1;
  entferneMarkierungen();
  melde('suche:geaendert');
}

function entferneMarkierungen() {
  for (const marke of document.querySelectorAll('.textebene .treffer')) {
    const eltern = marke.parentNode;
    marke.replaceWith(...marke.childNodes);
    eltern?.normalize();
  }
}

/** Markiert alle Treffer in den derzeit gezeichneten Textebenen. */
export function markiereAlle() {
  entferneMarkierungen();
  if (!begriff || begriff.length < 2) return;
  const muster = baueMuster(begriff);
  const aktiverT = treffer[aktiv];

  for (const blattKnoten of document.querySelectorAll('.blatt')) {
    const seitenId = blattKnoten.dataset.seite;
    const ebene = blattKnoten.querySelector('.textebene');
    if (!ebene || !ebene.childNodes.length) continue;

    let laufendeNummer = -1;
    const trefferAufSeite = treffer.filter((t) => t.seitenId === seitenId);
    if (!trefferAufSeite.length) continue;

    for (const span of ebene.querySelectorAll('span')) {
      const text = span.textContent;
      if (!text) continue;
      muster.lastIndex = 0;
      if (!muster.test(text)) continue;
      muster.lastIndex = 0;
      const bruchstuecke = document.createDocumentFragment();
      let letzte = 0, fund;
      while ((fund = muster.exec(text)) !== null) {
        laufendeNummer++;
        bruchstuecke.append(document.createTextNode(text.slice(letzte, fund.index)));
        const istAktiv = aktiverT && aktiverT.seitenId === seitenId
          && trefferAufSeite.indexOf(aktiverT) === laufendeNummer;
        bruchstuecke.append(el('span', { klasse: `treffer ${istAktiv ? 'treffer-aktiv' : ''}`, text: fund[0] }));
        letzte = fund.index + fund[0].length;
        if (fund[0].length === 0) muster.lastIndex++;
      }
      bruchstuecke.append(document.createTextNode(text.slice(letzte)));
      span.replaceChildren(bruchstuecke);
    }
  }
}

export function starteSuche() {
  hoer('textebene:fertig', () => { if (begriff) markiereAlle(); });
}

/** Text aller Seiten als einfache Datei. */
export async function textAusgeben() {
  const teile = [];
  for (let i = 0; i < zustand.folge.length; i++) {
    const { roh } = await seitenText(zustand.folge[i]);
    teile.push(`— Seite ${i + 1} —\n${roh}`);
  }
  if (!teile.join('').trim()) sage('Kein Text gefunden — vermutlich ein Scan.', { art: 'warn' });
  return teile.join('\n\n');
}
