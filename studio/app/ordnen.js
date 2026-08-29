/* Seiten ordnen — das Seitenraster.

   Die Miniaturen in der Seitenleiste sind schmal und liegen in einer Spalte.
   Damit lässt sich blättern, aber nicht ordnen: Wer Seite 14 vor Seite 3
   ziehen will, sieht beide nie gleichzeitig. Diese Ansicht legt alle Seiten
   groß nebeneinander, mit Mehrfachauswahl und Ziehen zum Umsortieren. Sie
   arbeitet auf demselben Zustand wie die Seitenleiste — dieselbe Auswahl,
   dieselbe Rückgängig-Kette.

   **Sie sitzt in der Mitte, nicht über allem.** Vorher war sie ein weißes
   Vollbild, das die ganze Anwendung verdeckte — Reiter, Leisten, Statuszeile.
   Das Mockup lässt alles stehen und tauscht nur die Bühne: Aktionsleiste in
   Chromefarbe, darunter das Raster auf dem dunkleren Bühnenton. Wer Seiten
   ordnet, verliert damit nicht den Rest seines Dokuments aus dem Blick. */

import { zustand, melde, hoer, el, $, sage } from './kern.js';
import { holeSeite } from './dokument.js';
import { sortiere, drehe, loesche, verdopple, kurztitel } from './seiten.js';

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
  /* Es gibt genau eine Mitte: das Raster tritt an die Stelle der Bühne, wie
     der Vergleich es auch tut. */
  $('#buehne').hidden = true;
  schirm.hidden = false;
  baueKopf();
  baueGitter();
  /* `preventScroll`, sonst zieht der Browser die Aktionsleiste an ihr rechtes
     Ende und die Zahl der gewählten Seiten steht außerhalb des Bildes. */
  schirm.querySelector('.ordnen-fertig')?.focus({ preventScroll: true });
}

export function schliesseOrdnen() {
  if (!schirm || schirm.hidden) return;
  schirm.hidden = true;
  $('#buehne').hidden = false;
  beobachter?.disconnect();
  beobachter = null;
  gezeichnet.clear();
}

/** Ob der Seitenordner offen ist — die Werkzeugzeile zeigt es an. */
export function ordnenOffen() { return istOffen(); }

export function umschalteOrdnen() {
  if (istOffen()) schliesseOrdnen(); else oeffneOrdnen();
}

/* ---------- Aufbau -------------------------------------------------------- */

function baueKopf() {
  schirm.innerHTML = '';
  kopfzahl = el('span', { klasse: 'ordnen-zahl', id: 'ordnen-zahl' });

  const knopf = (text, title, tun, klasse = 'ordnen-knopf') =>
    el('button', { klasse, title, text, beiClick: tun });

  /* Die Aktionsleiste des Mockups: links die Zahl der gewählten Seiten, dann
     die Aktionen, rechts der Hinweis in Mono-Versalien. */
  /* Die Aktionsleiste des Mockups: links die Zahl der gewählten Seiten, dann
     vier Aktionen, rechts der Hinweis in Mono-Versalien. Vorher standen hier
     sieben Knöpfe — bei 452 px Bühnenbreite scrollte die Hälfte aus dem Bild.
     Alles auswählen und umkehren stehen im Menü „Seiten" und auf Strg+A. */
  const kopf = el('header', { klasse: 'ordnen-kopf' },
    kopfzahl,
    knopf('Drehen', 'Gewählte Seiten rechts drehen', () => drehe(90)),
    knopf('Löschen', 'Gewählte Seiten löschen (Entf)', loesche),
    knopf('Verdoppeln', 'Gewählte Seiten verdoppeln', verdopple),
    knopf('Als neues Dokument', 'Die gewählten Seiten als neue PDF sichern',
      () => melde('ordnen:auszug'), 'ordnen-knopf ist-betont'),
    el('span', { klasse: 'ordnen-hinweis', text: 'ZIEHEN ZUM SORTIEREN' }),
    el('button', {
      klasse: 'ordnen-knopf ordnen-fertig', text: 'Fertig',
      title: 'Zurück zum Dokument (Esc)', beiClick: schliesseOrdnen,
    }));

  gitter = el('div', { klasse: 'ordnen-gitter' });
  schirm.append(kopf, gitter);
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
        /* Mockup: „1 · Deckblatt". Derselbe Kurztitel wie in der Seitenleiste
           — die erste Zeile, die nicht auf jeder Seite steht. */
        el('span', { klasse: 'ordnen-titel', text: kurztitel(eintrag) })));

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
    e.dataTransfer.setData('text/studio-seiten', gewaehlteInReihenfolge().join(','));
    e.dataTransfer.effectAllowed = 'move';
    karte.classList.add('wird-gezogen');
  });
  karte.addEventListener('dragend', () => {
    karte.classList.remove('wird-gezogen');
    loescheZielmarken();
  });
  karte.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('text/studio-seiten')) return;
    e.preventDefault();
    const kasten = karte.getBoundingClientRect();
    const nachher = e.clientX > kasten.left + kasten.width / 2;
    loescheZielmarken();
    karte.classList.add(nachher ? 'ziel-nach' : 'ziel-vor');
  });
  karte.addEventListener('drop', (e) => {
    const nutzlast = e.dataTransfer.getData('text/studio-seiten');
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
    /* Mockup: „2 Seiten ausgewählt" — die Zahl der Auswahl steht vorn, weil
       sich alle Knöpfe daneben auf sie beziehen. */
    kopfzahl.textContent = n
      ? `${n} ${n === 1 ? 'Seite' : 'Seiten'} ausgewählt`
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
