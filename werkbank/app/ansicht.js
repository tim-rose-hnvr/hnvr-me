/* Ansicht — Seiten darstellen, Zoom, Textebene, Blättern.

   Gerendert wird nur, was sichtbar ist (IntersectionObserver). Jedes Blatt
   kennt seine Maße vorab, damit der Bildlauf nicht springt. */

import { zustand, melde, hoer, $, el, drossel } from './kern.js';
import { holeSeite, seitenMasse, pdfjs } from './dokument.js';
import { zeichneAnmerkungen } from './anmerkungen.js';
import { zeichneFormularfelder } from './formulare.js';
import { legeErkannteTextebene } from './texterkennung.js';

const blaetter = new Map();     // seitenId → { knoten, eintrag, sicht, gerendert, aufgabe }
let beobachter = null;
let buehne = null, spur = null;
let esLaeuft = false;
let nachzuholen = null;   // Neuaufbau, der waehrend eines laufenden kam

export function starteAnsicht() {
  buehne = $('#buehne');
  spur = $('#spur');

  beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      const id = e.target.dataset.seite;
      if (e.isIntersecting) rendereBlatt(id);
      else entlasteBlatt(id);
    }
  }, { root: buehne, rootMargin: '400px 0px' });

  buehne.addEventListener('scroll', drossel(() => {
    verfolgeSeite();
    melde('ansicht:gescrollt');
  }, 100), { passive: true });

  window.addEventListener('resize', drossel(() => { if (zustand.zoom === 'breite' || zustand.zoom === 'seite') baueNeu(); }, 200));

  hoer('dokument:geladen', () => baueNeu());
  hoer('seiten:geaendert', () => baueNeu({ haltePosition: true }));
  hoer('anmerkungen:geaendert', () => aktualisiereAnmerkungen());
  // Bewusst nicht auf 'formular:geaendert': ein Neuaufbau während des Tippens
  // würde das Eingabefeld unter dem Schreibpunkt wegziehen.
  hoer('formular:neuAufbau', () => aktualisiereFormular());
  hoer('ocr:geaendert', () => baueNeu({ haltePosition: true }));
  hoer('werkzeug:gewechselt', () => setzeWerkzeugKlasse());
}

function setzeWerkzeugKlasse() {
  const zeichnend = !['auswahl', 'text'].includes(zustand.werkzeug);
  spur.classList.toggle('werkzeug-aktiv', zeichnend);
  spur.classList.toggle('werkzeug-text', zustand.werkzeug === 'auswahl' || zustand.werkzeug === 'text');
  spur.classList.toggle('werkzeug-ersetzen', zustand.werkzeug === 'ersetzen');
}

/** Maßstab für einen Eintrag unter der aktuellen Zoom-Einstellung. */
function maszstab(basisBreite, basisHoehe) {
  const platzBreite = buehne.clientWidth - 48;
  const platzHoehe = buehne.clientHeight - 48;
  if (zustand.zoom === 'breite') return Math.max(0.1, platzBreite / basisBreite);
  if (zustand.zoom === 'seite') return Math.max(0.1, Math.min(platzBreite / basisBreite, platzHoehe / basisHoehe));
  return Number(zustand.zoom) || 1;
}

export async function baueNeu({ haltePosition = false } = {}) {
  if (!spur) return;
  // Kommt ein zweiter Auftrag herein, waehrend gezeichnet wird, wird er
  // gemerkt und danach ausgefuehrt. Frueher fiel er unter den Tisch — die
  // Ansicht zeigte dann einen Zoom, den der Zustand nicht mehr kannte.
  if (esLaeuft) { nachzuholen = { haltePosition }; return; }
  esLaeuft = true;
  const merkeSeite = zustand.aktuelleSeite;

  for (const [, blatt] of blaetter) beobachter.unobserve(blatt.knoten);
  blaetter.clear();
  spur.innerHTML = '';
  setzeWerkzeugKlasse();

  /* Fokus („nur gewählte Seiten"): die übrigen Blätter werden ausgeblendet,
     nicht entfernt. Die Seitennummern bleiben deshalb die des Dokuments —
     wer Seite 7 und 9 betrachtet, sieht „7" und „9" und nicht „1" und „2". */
  const fokus = zustand.nurAuswahl && zustand.gewaehlteSeiten.size > 0;

  for (const eintrag of zustand.folge) {
    const { sicht } = await seitenMasse(eintrag, zustand.ansichtDrehung);
    const skala = maszstab(sicht.width, sicht.height);
    const verborgen = fokus && !zustand.gewaehlteSeiten.has(eintrag.id);
    const knoten = el('div', {
      klasse: `blatt${verborgen ? ' ist-verborgen' : ''}`,
      daten: { seite: eintrag.id },
      stil: { width: `${Math.round(sicht.width * skala)}px`, height: `${Math.round(sicht.height * skala)}px` },
      beiClick: (ereignis) => {
        if (ereignis.target.closest('.malebene, .feldebene')) return;
        zustand.aktuelleSeite = zustand.folge.indexOf(eintrag) + 1;
        melde('seite:gewechselt');
      },
    },
      el('canvas'),
      el('div', { klasse: 'textebene' }),
      el('div', { klasse: 'malebene' }),
      el('div', { klasse: 'feldebene' }),
      el('div', { klasse: 'blatt-nummer', text: String(zustand.folge.indexOf(eintrag) + 1) }));

    spur.append(knoten);
    blaetter.set(eintrag.id, { knoten, eintrag, skala, gerendert: false, aufgabe: null, verborgen });
    if (!verborgen) beobachter.observe(knoten);
  }

  // Der Maszstab der aktuellen Seite ist der, den der Mensch sieht. Frueher
  // stand hier der Wert der letzten Seite — bei gemischten Formaten falsch.
  zustand.zoomWert = aktuelleSkala();

  esLaeuft = false;
  melde('ansicht:neu');
  if (haltePosition) zeigeSeite(Math.min(merkeSeite, zustand.folge.length), { sanft: false });

  if (nachzuholen) {
    const auftrag = nachzuholen;
    nachzuholen = null;
    await baueNeu(auftrag);
  }
}

/** Maszstab der Seite, die gerade betrachtet wird. */
export function aktuelleSkala() {
  const eintrag = zustand.folge[zustand.aktuelleSeite - 1] || zustand.folge[0];
  return blaetter.get(eintrag?.id)?.skala || 1;
}

async function rendereBlatt(seitenId) {
  const blatt = blaetter.get(seitenId);
  if (!blatt || blatt.gerendert || blatt.aufgabe) return;
  blatt.aufgabe = (async () => {
    try {
      const seite = await holeSeite(blatt.eintrag);
      const drehung = (seite.rotate + blatt.eintrag.drehung + zustand.ansichtDrehung) % 360;
      const sicht = seite.getViewport({ scale: blatt.skala, rotation: drehung });
      const dichte = Math.min(window.devicePixelRatio || 1, 2);
      const leinwand = blatt.knoten.querySelector('canvas');
      leinwand.width = Math.floor(sicht.width * dichte);
      leinwand.height = Math.floor(sicht.height * dichte);
      const stift = leinwand.getContext('2d', { alpha: false });
      stift.fillStyle = '#fff';
      stift.fillRect(0, 0, leinwand.width, leinwand.height);
      blatt.aufgabeRender = seite.render({
        canvasContext: stift,
        viewport: sicht,
        transform: dichte !== 1 ? [dichte, 0, 0, dichte, 0, 0] : null,
      });
      await blatt.aufgabeRender.promise;
      blatt.sicht = sicht;
      blatt.gerendert = true;
      await legeTextebene(blatt, seite, sicht);
      zeichneAnmerkungen(blatt.knoten.querySelector('.malebene'), blatt.eintrag, sicht);
      zeichneFormularfelder(blatt.knoten.querySelector('.feldebene'), blatt.eintrag, sicht);
      melde('blatt:gerendert', blatt);
    } catch (fehler) {
      if (fehler?.name !== 'RenderingCancelledException') console.error('Seite konnte nicht gezeichnet werden', fehler);
    } finally {
      blatt.aufgabe = null;
    }
  })();
}

function entlasteBlatt(seitenId) {
  const blatt = blaetter.get(seitenId);
  if (!blatt || !blatt.gerendert) return;
  // Weit entfernte Seiten geben Speicher frei; Maße bleiben erhalten.
  const abstand = Math.abs((zustand.folge.findIndex((e) => e.id === seitenId) + 1) - zustand.aktuelleSeite);
  if (abstand < 4) return;
  const leinwand = blatt.knoten.querySelector('canvas');
  leinwand.width = 0; leinwand.height = 0;
  blatt.knoten.querySelector('.textebene').innerHTML = '';
  blatt.gerendert = false;
}

async function legeTextebene(blatt, seite, sicht) {
  const behaelter = blatt.knoten.querySelector('.textebene');
  behaelter.innerHTML = '';
  behaelter.style.setProperty('--scale-factor', String(sicht.scale));
  const inhalt = await seite.getTextContent();
  const eigenerText = inhalt.items.map((i) => i.str).join('').trim();
  zustand.textLaenge.set(blatt.eintrag.id, eigenerText.length);

  // Auf Scans tritt die Erkennung an die Stelle der fehlenden Textebene.
  if (eigenerText.length < 40 && zustand.ocr.has(blatt.eintrag.id)) {
    legeErkannteTextebene(behaelter, blatt.eintrag.id, sicht);
    blatt.textFertig = true;
    melde('textebene:fertig', blatt);
    return;
  }

  if (pdfjs?.TextLayer) {
    const ebene = new pdfjs.TextLayer({ textContentSource: inhalt, container: behaelter, viewport: sicht });
    await ebene.render();
  } else {
    // Rückfall: einfache Positionierung, reicht für Auswahl und Suche.
    for (const stueck of inhalt.items) {
      if (!stueck.str) continue;
      const [a, b, c, d, e, f] = pdfjs.Util.transform(sicht.transform, stueck.transform);
      const hoehe = Math.hypot(c, d);
      const span = el('span', { text: stueck.str, stil: {
        left: `${e}px`, top: `${f - hoehe}px`, fontSize: `${hoehe}px`, fontFamily: stueck.fontName,
        transform: `scaleX(${(Math.hypot(a, b) / hoehe) || 1})`,
      } });
      behaelter.append(span);
    }
  }
  blatt.textFertig = true;
  melde('textebene:fertig', blatt);
}

export function aktualisiereAnmerkungen() {
  for (const blatt of blaetter.values()) {
    if (!blatt.sicht) continue;
    zeichneAnmerkungen(blatt.knoten.querySelector('.malebene'), blatt.eintrag, blatt.sicht);
  }
}

export function aktualisiereFormular() {
  for (const blatt of blaetter.values()) {
    if (!blatt.sicht) continue;
    zeichneFormularfelder(blatt.knoten.querySelector('.feldebene'), blatt.eintrag, blatt.sicht);
  }
}

export function blattVon(seitenId) { return blaetter.get(seitenId) || null; }
export function alleBlaetter() { return [...blaetter.values()]; }

function verfolgeSeite() {
  if (!zustand.folge.length) return;
  const mitte = buehne.scrollTop + buehne.clientHeight * 0.38;
  let beste = 1, kleinsterAbstand = Infinity;
  let i = 0;
  for (const eintrag of zustand.folge) {
    i++;
    const blatt = blaetter.get(eintrag.id);
    if (!blatt || blatt.verborgen) continue;
    const oben = blatt.knoten.offsetTop;
    const abstand = Math.abs(oben + blatt.knoten.offsetHeight / 2 - mitte);
    if (abstand < kleinsterAbstand) { kleinsterAbstand = abstand; beste = i; }
  }
  if (beste !== zustand.aktuelleSeite) {
    zustand.aktuelleSeite = beste;
    melde('seite:gewechselt');
  }
}

export function zeigeSeite(nummer, { sanft = true } = {}) {
  const eintrag = zustand.folge[nummer - 1];
  if (!eintrag) return;
  const blatt = blaetter.get(eintrag.id);
  if (!blatt) return;
  /* Im Fokus liegt die gesuchte Seite womöglich hinter dem Vorhang. Dann wird
     nicht stillschweigend irgendwohin gesprungen, sondern gar nicht. */
  if (blatt.verborgen) return;
  buehne.scrollTo({ top: blatt.knoten.offsetTop - 12, behavior: sanft ? 'smooth' : 'auto' });
  zustand.aktuelleSeite = nummer;
  melde('seite:gewechselt');
}

export function bringeInSicht(seitenId, yAnteil = 0.5) {
  const blatt = blaetter.get(seitenId);
  if (!blatt) return;
  const ziel = blatt.knoten.offsetTop + blatt.knoten.offsetHeight * yAnteil - buehne.clientHeight / 2;
  buehne.scrollTo({ top: Math.max(0, ziel), behavior: 'smooth' });
}

export function setzeZoom(wert) {
  zustand.zoom = wert;
  baueNeu({ haltePosition: true });
  melde('zoom:geaendert');
}

export function zoomeSchritt(richtung) {
  const stufen = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 6];
  const jetzt = Number(zustand.zoom) || aktuelleSkala() || 1;
  const naechste = richtung > 0
    ? stufen.find((s) => s > jetzt + 0.01) ?? stufen.at(-1)
    : [...stufen].reverse().find((s) => s < jetzt - 0.01) ?? stufen[0];
  setzeZoom(String(naechste));
}

export function dreheAnsicht(grad = 90) {
  zustand.ansichtDrehung = (((zustand.ansichtDrehung + grad) % 360) + 360) % 360;
  baueNeu({ haltePosition: true });
}

/** Wandelt einen Mausereignis-Punkt in PDF-Punkte der Quellseite. */
export function zuPdfPunkt(blattKnoten, klientX, klientY) {
  const seitenId = blattKnoten.dataset.seite;
  const blatt = blaetter.get(seitenId);
  if (!blatt?.sicht) return null;
  const kasten = blattKnoten.getBoundingClientRect();
  const x = klientX - kasten.left;
  const y = klientY - kasten.top;
  const [px, py] = blatt.sicht.convertToPdfPoint(x, y);
  return { x: px, y: py, blatt };
}
