/* Seiten ordnen — die große Ansicht zum Sortieren, Löschen, Drehen.

   Die Miniaturen in der Seitenleiste sind 100 Pixel breit und liegen in einer
   Spalte. Damit lässt sich blättern, aber nicht ordnen: Wer Seite 14 vor
   Seite 3 ziehen will, sieht beide nie gleichzeitig.

   Diese Ansicht legt alle Seiten groß nebeneinander, mit Mehrfachauswahl,
   Ziehen zum Umsortieren und den Aktionen daneben. Sie arbeitet auf demselben
   Zustand wie die Seitenleiste — dieselbe Auswahl, dieselbe Rückgängig-Kette. */

import { zustand, melde, hoer, el, $, sage } from './kern.js';
import { holeSeite } from './dokument.js';
import { sortiere, drehe, loesche, verdopple } from './seiten.js';

let schirm = null;
let gitter = null;
let kopfzahl = null;
let beobachter = null;
let letzteGeklickt = null;
const gezeichnet = new Set();

export function istOffen() { return !!schirm && !schirm.hidden; }

export function starteOrdnen() {
  schirm = $('#ordnen');
  if (!schirm) return;
  hoer('seiten:geaendert', () => { if (istOffen()) baueGitter(); });
  hoer('auswahl:geaendert', () => { if (istOffen()) markiere(); });
  document.addEventListener('keydown', beiTaste);
}

export function oeffneOrdnen() {
  if (!schirm) return;
  if (!zustand.folge.length) { sage('Erst eine Datei öffnen', { art: 'warn' }); return; }
  schirm.hidden = false;
  baueKopf();
  baueGitter();
  schirm.querySelector('.ordnen-fertig')?.focus();
}

export function schliesseOrdnen() {
  if (!schirm || schirm.hidden) return;
  schirm.hidden = true;
  beobachter?.disconnect();
  beobachter = null;
  gezeichnet.clear();
}

export function umschalteOrdnen() {
  if (istOffen()) schliesseOrdnen(); else oeffneOrdnen();
}

/* ---------- Aufbau -------------------------------------------------------- */

function baueKopf() {
  schirm.innerHTML = '';
  kopfzahl = el('span', { klasse: 'leise klein', id: 'ordnen-zahl' });

  const knopf = (text, title, tun, klasse = 'knopf knopf-klein') =>
    el('button', { klasse, title, text, beiClick: tun });

  const kopf = el('header', { klasse: 'ordnen-kopf' },
    el('div', { klasse: 'ordnen-titel' },
      el('strong', { text: 'Seiten ordnen' }),
      kopfzahl),

    el('div', { klasse: 'ordnen-werkzeuge' },
      knopf('Alle', 'Alle Seiten wählen (Strg+A)', () => {
        zustand.folge.forEach((e) => zustand.gewaehlteSeiten.add(e.id));
        melde('auswahl:geaendert');
      }),
      knopf('Umkehren', 'Auswahl umkehren', () => {
        const neu = new Set(zustand.folge.filter((e) => !zustand.gewaehlteSeiten.has(e.id)).map((e) => e.id));
        zustand.gewaehlteSeiten.clear();
        neu.forEach((id) => zustand.gewaehlteSeiten.add(id));
        melde('auswahl:geaendert');
      }),
      knopf('Keine', 'Auswahl aufheben', () => {
        zustand.gewaehlteSeiten.clear();
        melde('auswahl:geaendert');
      }),
      el('span', { klasse: 'ordnen-trenner' }),
      knopf('↺ Links', 'Gewählte Seiten links drehen', () => drehe(-90)),
      knopf('↻ Rechts', 'Gewählte Seiten rechts drehen', () => drehe(90)),
      knopf('⧉ Verdoppeln', 'Gewählte Seiten verdoppeln', verdopple),
      knopf('Löschen', 'Gewählte Seiten löschen (Entf)', loesche, 'knopf knopf-klein knopf-gefahr'),
      el('span', { klasse: 'ordnen-trenner' }),
      knopf('Seiten einfügen …', 'Eine weitere PDF-Datei anhängen', () => $('#dateiwahl-anhang').click()),
      knopf('Auswahl als Datei …', 'Die gewählten Seiten als neue PDF sichern',
        () => melde('ordnen:auszug'))),

    el('button', { klasse: 'knopf ordnen-fertig', text: 'Fertig', title: 'Schließen (Esc)', beiClick: schliesseOrdnen }));

  gitter = el('div', { klasse: 'ordnen-gitter' });

  schirm.append(kopf, gitter,
    el('p', { klasse: 'ordnen-hinweis leise klein',
      text: 'Ziehen sortiert um · Klick wählt, Umschalt wählt einen Bereich, Strg einzeln · Doppelklick springt zur Seite' }));
}

function baueGitter() {
  if (!gitter) return;
  gitter.innerHTML = '';
  gezeichnet.clear();
  beobachter?.disconnect();
  beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) if (e.isIntersecting) zeichne(e.target.dataset.seite);
  }, { root: schirm, rootMargin: '300px' });

  zustand.folge.forEach((eintrag, i) => {
    const karte = el('div', {
      klasse: 'ordnen-karte', daten: { seite: eintrag.id }, draggable: 'true',
      beiClick: (ereignis) => waehle(ereignis, eintrag, i),
      beiDblclick: () => { schliesseOrdnen(); melde('seiten:springe', i + 1); },
    },
      el('div', { klasse: 'ordnen-blatt' }, el('canvas', { width: 180, height: 250 })),
      el('div', { klasse: 'ordnen-fuss' },
        el('span', { klasse: 'ordnen-nummer', text: String(i + 1) }),
        el('span', { klasse: 'ordnen-haken', 'aria-hidden': 'true', text: '✓' })));

    haengeZiehenAn(karte, eintrag);
    gitter.append(karte);
    beobachter.observe(karte);
  });

  markiere();
}

function haengeZiehenAn(karte, eintrag) {
  karte.addEventListener('dragstart', (e) => {
    if (!zustand.gewaehlteSeiten.has(eintrag.id)) {
      zustand.gewaehlteSeiten.clear();
      zustand.gewaehlteSeiten.add(eintrag.id);
      melde('auswahl:geaendert');
    }
    e.dataTransfer.setData('text/werkbank-seiten', gewaehlteInReihenfolge().join(','));
    e.dataTransfer.effectAllowed = 'move';
    karte.classList.add('wird-gezogen');
  });
  karte.addEventListener('dragend', () => {
    karte.classList.remove('wird-gezogen');
    loescheZielmarken();
  });
  karte.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('text/werkbank-seiten')) return;
    e.preventDefault();
    const kasten = karte.getBoundingClientRect();
    const nachher = e.clientX > kasten.left + kasten.width / 2;
    loescheZielmarken();
    karte.classList.add(nachher ? 'ziel-nach' : 'ziel-vor');
  });
  karte.addEventListener('drop', (e) => {
    const nutzlast = e.dataTransfer.getData('text/werkbank-seiten');
    if (!nutzlast) return;
    e.preventDefault();
    loescheZielmarken();
    const kasten = karte.getBoundingClientRect();
    const nachher = e.clientX > kasten.left + kasten.width / 2;
    const ziel = zustand.folge.findIndex((x) => x.id === eintrag.id) + (nachher ? 1 : 0);
    sortiere(nutzlast.split(','), ziel);
  });
}

const loescheZielmarken = () =>
  gitter?.querySelectorAll('.ziel-vor, .ziel-nach').forEach((k) => k.classList.remove('ziel-vor', 'ziel-nach'));

function gewaehlteInReihenfolge() {
  return zustand.folge.filter((e) => zustand.gewaehlteSeiten.has(e.id)).map((e) => e.id);
}

function waehle(ereignis, eintrag, index) {
  if (ereignis.shiftKey && letzteGeklickt != null) {
    const von = Math.min(letzteGeklickt, index), bis = Math.max(letzteGeklickt, index);
    for (let i = von; i <= bis; i++) zustand.gewaehlteSeiten.add(zustand.folge[i].id);
  } else if (ereignis.metaKey || ereignis.ctrlKey) {
    if (zustand.gewaehlteSeiten.has(eintrag.id)) zustand.gewaehlteSeiten.delete(eintrag.id);
    else zustand.gewaehlteSeiten.add(eintrag.id);
    letzteGeklickt = index;
  } else {
    zustand.gewaehlteSeiten.clear();
    zustand.gewaehlteSeiten.add(eintrag.id);
    letzteGeklickt = index;
  }
  melde('auswahl:geaendert');
}

function markiere() {
  if (!gitter) return;
  for (const karte of gitter.querySelectorAll('.ordnen-karte')) {
    karte.classList.toggle('ist-gewaehlt', zustand.gewaehlteSeiten.has(karte.dataset.seite));
  }
  const n = zustand.gewaehlteSeiten.size;
  if (kopfzahl) {
    kopfzahl.textContent = n
      ? `${zustand.folge.length} Seiten · ${n} gewählt`
      : `${zustand.folge.length} Seiten`;
  }
}

async function zeichne(seitenId) {
  if (gezeichnet.has(seitenId)) return;
  gezeichnet.add(seitenId);
  const eintrag = zustand.folge.find((e) => e.id === seitenId);
  const karte = gitter?.querySelector(`.ordnen-karte[data-seite="${CSS.escape(seitenId)}"]`);
  if (!eintrag || !karte) return;
  try {
    const seite = await holeSeite(eintrag);
    const drehung = (seite.rotate + eintrag.drehung) % 360;
    const grund = seite.getViewport({ scale: 1, rotation: drehung });
    const skala = 260 / grund.width;
    const sicht = seite.getViewport({ scale: skala, rotation: drehung });
    const leinwand = karte.querySelector('canvas');
    leinwand.width = Math.ceil(sicht.width);
    leinwand.height = Math.ceil(sicht.height);
    const stift = leinwand.getContext('2d');
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, leinwand.width, leinwand.height);
    await seite.render({ canvasContext: stift, viewport: sicht }).promise;
  } catch (fehler) {
    gezeichnet.delete(seitenId);
    console.warn('Seite konnte in der Ordnen-Ansicht nicht gezeichnet werden', fehler);
  }
}

function beiTaste(ereignis) {
  if (!istOffen()) return;
  if (ereignis.key === 'Escape') { ereignis.preventDefault(); schliesseOrdnen(); return; }
  if (ereignis.key === 'Delete' || ereignis.key === 'Backspace') { ereignis.preventDefault(); loesche(); return; }
  if ((ereignis.ctrlKey || ereignis.metaKey) && ereignis.key.toLowerCase() === 'a') {
    ereignis.preventDefault();
    zustand.folge.forEach((e) => zustand.gewaehlteSeiten.add(e.id));
    melde('auswahl:geaendert');
  }
}
