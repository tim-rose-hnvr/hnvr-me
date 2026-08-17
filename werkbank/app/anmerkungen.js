/* Anmerkungen — Modell, Darstellung, Werkzeuge.

   Alle Geometrie liegt in PDF-Punkten der Quellseite (Ursprung unten links,
   ohne Seitendrehung). Damit bleiben Anmerkungen bei Zoom, Ansichtsdrehung
   und Seitendrehung an ihrem Platz — und die Ausgabe über pdf-lib rechnet
   im selben Koordinatensystem. */

import { zustand, kennung, melde, sage, el, svgEl, merkeSchritt } from './kern.js';
import { nummerVon } from './dokument.js';

export const WERKZEUGE = [
  { id: 'auswahl',      name: 'Auswahl',       kuerzel: 'V', zeichen: 'M4 3l7 17 2-7 7-2z' },
  { id: 'hervor',       name: 'Hervorheben',   kuerzel: 'H', zeichen: 'M3 20h18M6 16l9-9 3 3-9 9H6z' },
  { id: 'unterstrich',  name: 'Unterstreichen',kuerzel: 'U', zeichen: 'M6 4v7a6 6 0 0 0 12 0V4M5 20h14' },
  { id: 'durchstrich',  name: 'Durchstreichen',kuerzel: 'D', zeichen: 'M4 12h16M7 6h10M7 18h10' },
  { id: 'notiz',        name: 'Notiz',         kuerzel: 'N', zeichen: 'M4 4h16v11H9l-5 5z' },
  { id: 'freihand',     name: 'Freihand',      kuerzel: 'F', zeichen: 'M3 17c4 0 4-10 8-10s4 10 8 10' },
  { id: 'text',         name: 'Text',          kuerzel: 'T', zeichen: 'M5 5h14M12 5v14M9 19h6' },
  { id: 'rechteck',     name: 'Rechteck',      kuerzel: 'R', zeichen: 'M4 5h16v14H4z' },
  { id: 'ellipse',      name: 'Ellipse',       kuerzel: 'E', zeichen: 'M12 5c4.4 0 8 3.1 8 7s-3.6 7-8 7-8-3.1-8-7 3.6-7 8-7z' },
  { id: 'pfeil',        name: 'Pfeil',         kuerzel: 'P', zeichen: 'M4 20L20 4M20 4h-7M20 4v7' },
  { id: 'ersetzen',     name: 'Text bearbeiten', kuerzel: 'B', zeichen: 'M4 20h7M14 4l6 6-9 9H5v-6z' },
  { id: 'schwaerzen',   name: 'Schwärzen',     kuerzel: 'S', zeichen: 'M4 8h16v8H4zM4 4h16' },
  { id: 'unterschrift', name: 'Unterschrift',  kuerzel: 'G', zeichen: 'M3 18c3 0 5-12 8-12s2 9 4 9 2-3 6-3' },
  { id: 'stempel',      name: 'Stempel',       kuerzel: 'Z', zeichen: 'M5 20h14M7 16h10V9l-3-5H10L7 9z' },
  { id: 'bereich',      name: 'Bereich kopieren', kuerzel: 'M', zeichen: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4' },
  { id: 'feld',         name: 'Formularfeld anlegen', kuerzel: 'K', zeichen: 'M3 7h18v10H3zM7 10h6' },
];

/* Die Feldarten, die pdf-lib schreiben kann. Ein Unterschriftsfeld wird
   angelegt, aber nicht ausgefüllt — dafür braucht es ein Zertifikat. */
export const FELDARTEN = {
  text: 'Textfeld',
  mehrzeilig: 'Mehrzeiliges Textfeld',
  ankreuz: 'Ankreuzfeld',
  auswahl: 'Auswahlliste',
  option: 'Optionsfeld',
  unterschrift: 'Unterschriftsfeld',
};

export const FARBEN = ['#FFD400', '#67E667', '#7FD3FF', '#FF9BD2', '#FF6B4A', '#A82E23', '#1B6AC9', '#111111'];

const TEXTWERKZEUGE = new Set(['hervor', 'unterstrich', 'durchstrich']);
const ZIEHWERKZEUGE = new Set(['rechteck', 'ellipse', 'pfeil', 'schwaerzen', 'unterschrift', 'bereich', 'feld']);

let entwurf = null;   // laufende Zeichnung { art, seiteId, punkte/rechteck, knoten }
let letzteUnterschrift = null;

export function setzeUnterschriftsbild(datenUrl, seitenverhaeltnis) {
  letzteUnterschrift = { datenUrl, verhaeltnis: seitenverhaeltnis };
}
export function hatUnterschrift() { return !!letzteUnterschrift; }

/* ---------- Modell ------------------------------------------------------- */

export function fuegeAn(anmerkung) {
  const neu = { id: kennung('a'), erstellt: Date.now(), ...anmerkung };
  zustand.anmerkungen.push(neu);
  merkeSchritt(`${bezeichne(neu)} hinzugefügt`,
    () => { zustand.anmerkungen = zustand.anmerkungen.filter((a) => a.id !== neu.id); melde('anmerkungen:geaendert'); },
    () => { zustand.anmerkungen.push(neu); melde('anmerkungen:geaendert'); });
  melde('anmerkungen:geaendert');
  zaehleWerkzeug(neu.art);
  return neu;
}

export function entferne(id) {
  const index = zustand.anmerkungen.findIndex((a) => a.id === id);
  if (index < 0) return;
  const [weg] = zustand.anmerkungen.splice(index, 1);
  if (zustand.gewaehlteAnmerkung === id) zustand.gewaehlteAnmerkung = null;
  merkeSchritt(`${bezeichne(weg)} gelöscht`,
    () => { zustand.anmerkungen.splice(index, 0, weg); melde('anmerkungen:geaendert'); },
    () => { zustand.anmerkungen = zustand.anmerkungen.filter((a) => a.id !== weg.id); melde('anmerkungen:geaendert'); });
  melde('anmerkungen:geaendert');
}

export function aendere(id, aenderung, beschreibung = 'Anmerkung geändert') {
  const anmerkung = zustand.anmerkungen.find((a) => a.id === id);
  if (!anmerkung) return;
  const vorher = { ...anmerkung };
  Object.assign(anmerkung, aenderung);
  const nachher = { ...anmerkung };
  merkeSchritt(beschreibung,
    () => { Object.assign(anmerkung, vorher); melde('anmerkungen:geaendert'); },
    () => { Object.assign(anmerkung, nachher); melde('anmerkungen:geaendert'); });
  melde('anmerkungen:geaendert');
}

export function bezeichne(a) {
  const werkzeug = WERKZEUGE.find((w) => w.id === a.art);
  return werkzeug ? werkzeug.name : a.art;
}

function zaehleWerkzeug(art) {
  const karte = zustand.gedaechtnis.benutzteWerkzeuge;
  karte.set(art, (karte.get(art) || 0) + 1);
}

/* ---------- Darstellung --------------------------------------------------- */

export function zeichneAnmerkungen(ebene, eintrag, sicht) {
  ebene.innerHTML = '';
  const svg = svgEl('svg', { width: sicht.width, height: sicht.height, viewBox: `0 0 ${sicht.width} ${sicht.height}` });
  ebene.append(svg);

  const zuBild = (x, y) => sicht.convertToViewportPoint(x, y);

  for (const a of zustand.anmerkungen.filter((a) => a.seiteId === eintrag.id)) {
    const gewaehlt = zustand.gewaehlteAnmerkung === a.id;
    if (TEXTWERKZEUGE.has(a.art)) {
      for (const quad of a.quads) {
        const [x1, y1] = zuBild(quad.x, quad.y);
        const [x2, y2] = zuBild(quad.x + quad.b, quad.y + quad.h);
        const links = Math.min(x1, x2), oben = Math.min(y1, y2);
        const breite = Math.abs(x2 - x1), hoehe = Math.abs(y2 - y1);
        let form;
        if (a.art === 'hervor') {
          form = svgEl('rect', { x: links, y: oben, width: breite, height: hoehe, fill: a.farbe, 'fill-opacity': 0.4, rx: 1 });
        } else if (a.art === 'unterstrich') {
          form = svgEl('line', { x1: links, y1: oben + hoehe - 1, x2: links + breite, y2: oben + hoehe - 1, stroke: a.farbe, 'stroke-width': Math.max(1, hoehe * 0.07) });
        } else {
          form = svgEl('line', { x1: links, y1: oben + hoehe / 2, x2: links + breite, y2: oben + hoehe / 2, stroke: a.farbe, 'stroke-width': Math.max(1, hoehe * 0.07) });
        }
        form.classList.add('anmerkung-griff');
        form.dataset.anmerkung = a.id;
        if (a.art !== 'hervor') svg.append(fangbahn(form, a.id, Math.max(10, hoehe * 0.5)));
        svg.append(form);
      }
      if (gewaehlt) svg.append(rahmen(umriss(a, sicht)));
      continue;
    }

    if (a.art === 'freihand') {
      const punkte = a.punkte.map(([x, y]) => zuBild(x, y).map((n) => n.toFixed(2)).join(',')).join(' ');
      const zug = svgEl('polyline', {
        points: punkte, fill: 'none', stroke: a.farbe, 'stroke-width': a.staerke * sicht.scale,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-opacity': a.deckkraft ?? 1,
      });
      zug.classList.add('anmerkung-griff');
      zug.dataset.anmerkung = a.id;
      svg.append(fangbahn(zug, a.id, Math.max(12, a.staerke * sicht.scale * 3), gewaehlt), zug);
      if (gewaehlt) svg.append(rahmen(umriss(a, sicht)));
      continue;
    }

    if (a.art === 'notiz') {
      const [x, y] = zuBild(a.x, a.y);
      const marke = el('div', {
        klasse: 'notiz-marke', title: a.text || 'Notiz',
        stil: { left: `${x}px`, top: `${y}px`, background: a.farbe, outline: gewaehlt ? '2px solid var(--tally)' : '' },
        daten: { anmerkung: a.id }, text: '✎',
      });
      ebene.append(marke);
      continue;
    }

    if (a.art === 'text') {
      const [x, y] = zuBild(a.x, a.y);
      const knoten = el('div', {
        klasse: 'anmerkung-griff',
        stil: {
          position: 'absolute', left: `${x}px`, top: `${y}px`, color: a.farbe,
          fontSize: `${a.groesse * sicht.scale}px`, lineHeight: '1.25', whiteSpace: 'pre-wrap',
          fontFamily: 'var(--sans)', maxWidth: `${(a.breite || 260) * sicht.scale}px`,
          outline: gewaehlt ? '1px dashed var(--tally)' : '', pointerEvents: 'auto', cursor: 'move',
        },
        daten: { anmerkung: a.id }, text: a.text,
      });
      ebene.append(knoten);
      continue;
    }

    if (a.art === 'stempel') {
      const [sx1, sy1] = zuBild(a.x, a.y + a.h);
      const [sx2, sy2] = zuBild(a.x + a.b, a.y);
      const links = Math.min(sx1, sx2), oben = Math.min(sy1, sy2);
      const breite = Math.abs(sx2 - sx1), hoehe = Math.abs(sy2 - sy1);
      const knoten = el('div', {
        klasse: 'anmerkung-griff stempel', daten: { anmerkung: a.id }, text: a.text,
        stil: {
          position: 'absolute', left: `${links}px`, top: `${oben}px`,
          width: `${breite}px`, height: `${hoehe}px`,
          color: a.farbe, borderColor: a.farbe,
          fontSize: `${a.groesse * sicht.scale}px`,
          outline: gewaehlt ? '1px dashed var(--tally)' : '',
        },
      });
      ebene.append(knoten);
      continue;
    }

    if (a.art === 'ersatz') {
      const [ax1, ay1] = zuBild(a.x, a.y + a.h);
      const [ax2, ay2] = zuBild(a.x + a.b, a.y);
      const links = Math.min(ax1, ax2), oben = Math.min(ay1, ay2);
      const breite = Math.abs(ax2 - ax1), hoehe = Math.abs(ay2 - ay1);
      const knoten = el('div', {
        klasse: 'anmerkung-griff', daten: { anmerkung: a.id }, text: a.text,
        stil: {
          position: 'absolute', left: `${links}px`, top: `${oben}px`,
          minWidth: `${breite}px`, height: `${hoehe}px`,
          background: a.grundfarbe || '#fff', color: a.schriftfarbe || '#111',
          fontSize: `${a.groesse * sicht.scale}px`, lineHeight: `${hoehe}px`,
          fontFamily: 'var(--sans)', whiteSpace: 'pre', pointerEvents: 'auto', cursor: 'pointer',
          outline: gewaehlt ? '1px dashed var(--tally)' : '',
        },
      });
      ebene.append(knoten);
      continue;
    }

    if (a.art === 'feldneu') {
      /* Der Platzhalter für ein noch nicht geschriebenes Feld. Er sieht
         bewusst nicht wie ein echtes Feld aus — sonst tippt jemand hinein
         und wundert sich, dass nichts ankommt. Das Feld entsteht erst beim
         Sichern; bis dahin steht hier nur, was entstehen wird. */
      const [x1, y1] = zuBild(a.x, a.y + a.h);
      const [x2, y2] = zuBild(a.x + a.b, a.y);
      const kasten = el('div', {
        klasse: 'anmerkung-griff feld-entwurf', daten: { anmerkung: a.id },
        title: `${FELDARTEN[a.feldArt] || a.feldArt}: ${a.name}`,
        stil: {
          position: 'absolute', left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`,
          width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px`,
          pointerEvents: 'auto', cursor: 'move',
          outline: gewaehlt ? '2px dashed var(--tally)' : '',
        },
      }, el('span', { text: a.name }));
      ebene.append(kasten);
      continue;
    }

    if (a.art === 'unterschrift') {
      const [x1, y1] = zuBild(a.x, a.y + a.h);
      const [x2, y2] = zuBild(a.x + a.b, a.y);
      const bild = el('img', {
        src: a.bild, klasse: 'anmerkung-griff', daten: { anmerkung: a.id },
        stil: {
          position: 'absolute', left: `${Math.min(x1, x2)}px`, top: `${Math.min(y1, y2)}px`,
          width: `${Math.abs(x2 - x1)}px`, height: `${Math.abs(y2 - y1)}px`,
          pointerEvents: 'auto', cursor: 'move', outline: gewaehlt ? '1px dashed var(--tally)' : '',
        },
      });
      ebene.append(bild);
      continue;
    }

    // Rechteck, Ellipse, Pfeil, Schwärzung
    const [x1, y1] = zuBild(a.x, a.y);
    const [x2, y2] = zuBild(a.x2, a.y2);
    const links = Math.min(x1, x2), oben = Math.min(y1, y2);
    const breite = Math.abs(x2 - x1), hoehe = Math.abs(y2 - y1);
    let form;
    if (a.art === 'rechteck') {
      form = svgEl('rect', { x: links, y: oben, width: breite, height: hoehe, fill: a.fuellung || 'none', 'fill-opacity': a.fuellung ? 0.25 : 0, stroke: a.farbe, 'stroke-width': a.staerke * sicht.scale });
    } else if (a.art === 'ellipse') {
      form = svgEl('ellipse', { cx: links + breite / 2, cy: oben + hoehe / 2, rx: breite / 2, ry: hoehe / 2, fill: a.fuellung || 'none', 'fill-opacity': a.fuellung ? 0.25 : 0, stroke: a.farbe, 'stroke-width': a.staerke * sicht.scale });
    } else if (a.art === 'schwaerzen') {
      form = svgEl('rect', { x: links, y: oben, width: breite, height: hoehe, fill: '#000', 'fill-opacity': 0.85, stroke: '#A82E23', 'stroke-width': 1, 'stroke-dasharray': '4 3' });
    } else {
      form = svgEl('g', {});
      form.append(svgEl('line', { x1, y1, x2, y2, stroke: a.farbe, 'stroke-width': a.staerke * sicht.scale, 'stroke-linecap': 'round' }));
      const winkel = Math.atan2(y2 - y1, x2 - x1);
      const laenge = Math.max(8, a.staerke * sicht.scale * 4);
      for (const seite of [-1, 1]) {
        const wx = x2 - laenge * Math.cos(winkel - seite * 0.42);
        const wy = y2 - laenge * Math.sin(winkel - seite * 0.42);
        form.append(svgEl('line', { x1: x2, y1: y2, x2: wx, y2: wy, stroke: a.farbe, 'stroke-width': a.staerke * sicht.scale, 'stroke-linecap': 'round' }));
      }
    }
    form.classList.add('anmerkung-griff');
    form.dataset.anmerkung = a.id;
    if (a.art !== 'schwaerzen') svg.append(fangbahn(form, a.id, Math.max(14, (a.staerke || 2) * sicht.scale * 3), gewaehlt));
    svg.append(form);
    if (gewaehlt) svg.append(rahmen({ links, oben, breite, hoehe }));
  }
}

/* Formen ohne Fuellung treffen nur auf ihrer Linie. Eine unsichtbare Bahn
   entlang derselben Geometrie macht sie greifbar, ohne die Flaeche zu
   verschliessen — darunter bleibt Text auswaehlbar. */
function fangbahn(form, id, breite, ganzeFlaeche = false) {
  const kopie = form.cloneNode(true);
  const setzen = (knoten) => {
    knoten.setAttribute('stroke', 'transparent');
    knoten.setAttribute('stroke-width', String(breite));
    knoten.setAttribute('fill', 'none');
    // Unberührt: nur die Linie fängt, damit Text darunter auswählbar bleibt.
    // Gewählt: die ganze Fläche fängt, damit sich die Form bequem ziehen lässt.
    knoten.setAttribute('pointer-events', ganzeFlaeche ? 'all' : 'stroke');
  };
  setzen(kopie);
  kopie.querySelectorAll('*').forEach(setzen);
  kopie.classList.add('anmerkung-griff');
  kopie.dataset.anmerkung = id;
  return kopie;
}

function rahmen({ links, oben, breite, hoehe }) {
  return svgEl('rect', {
    x: links - 3, y: oben - 3, width: breite + 6, height: hoehe + 6,
    fill: 'none', stroke: 'var(--tally)', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'pointer-events': 'none',
  });
}

/** Bildschirm-Umriss einer Anmerkung (für Auswahlrahmen). */
function umriss(a, sicht) {
  const punkte = [];
  const zu = (x, y) => sicht.convertToViewportPoint(x, y);
  if (a.quads) for (const q of a.quads) { punkte.push(zu(q.x, q.y), zu(q.x + q.b, q.y + q.h)); }
  else if (a.punkte) for (const [x, y] of a.punkte) punkte.push(zu(x, y));
  else if (a.x2 != null) punkte.push(zu(a.x, a.y), zu(a.x2, a.y2));
  else punkte.push(zu(a.x, a.y));
  const xs = punkte.map((p) => p[0]), ys = punkte.map((p) => p[1]);
  return { links: Math.min(...xs), oben: Math.min(...ys), breite: Math.max(...xs) - Math.min(...xs), hoehe: Math.max(...ys) - Math.min(...ys) };
}

/* ---------- Zeigerbedienung ---------------------------------------------- */

export function starteWerkzeuge(spur, zuPdfPunkt) {
  spur.addEventListener('pointerdown', (ereignis) => {
    const blattKnoten = ereignis.target.closest('.blatt');
    if (!blattKnoten) return;

    const griff = ereignis.target.closest('[data-anmerkung]');
    if (griff && (zustand.werkzeug === 'auswahl' || zustand.gewaehlteAnmerkung === griff.dataset.anmerkung)) {
      waehleAn(griff.dataset.anmerkung);
      beginneVerschieben(ereignis, blattKnoten, zuPdfPunkt, griff.dataset.anmerkung);
      return;
    }
    if (zustand.werkzeug === 'auswahl') { waehleAn(null); return; }

    const punkt = zuPdfPunkt(blattKnoten, ereignis.clientX, ereignis.clientY);
    if (!punkt) return;
    const seiteId = blattKnoten.dataset.seite;
    ereignis.preventDefault();

    if (zustand.werkzeug === 'notiz') {
      const anmerkung = fuegeAn({ art: 'notiz', seiteId, x: punkt.x, y: punkt.y, farbe: zustand.farbe, text: '' });
      melde('anmerkung:bearbeiten', anmerkung.id);
      return;
    }
    if (zustand.werkzeug === 'text') {
      melde('anmerkung:neuerText', { seiteId, x: punkt.x, y: punkt.y });
      return;
    }
    if (zustand.werkzeug === 'stempel') {
      melde('anmerkung:stempel', { seiteId, x: punkt.x, y: punkt.y });
      return;
    }
    if (zustand.werkzeug === 'freihand') {
      entwurf = { art: 'freihand', seiteId, punkte: [[punkt.x, punkt.y]], blattKnoten };
      blattKnoten.setPointerCapture?.(ereignis.pointerId);
      return;
    }
    if (ZIEHWERKZEUGE.has(zustand.werkzeug)) {
      entwurf = { art: zustand.werkzeug, seiteId, x: punkt.x, y: punkt.y, x2: punkt.x, y2: punkt.y, blattKnoten };
      return;
    }
  });

  spur.addEventListener('pointermove', (ereignis) => {
    if (!entwurf) return;
    const punkt = zuPdfPunkt(entwurf.blattKnoten, ereignis.clientX, ereignis.clientY);
    if (!punkt) return;
    if (entwurf.art === 'freihand') {
      const letzter = entwurf.punkte.at(-1);
      if (Math.hypot(punkt.x - letzter[0], punkt.y - letzter[1]) > 0.8) entwurf.punkte.push([punkt.x, punkt.y]);
    } else {
      entwurf.x2 = punkt.x; entwurf.y2 = punkt.y;
    }
    zeichneEntwurf(punkt.blatt.sicht);
  });

  const beende = () => {
    if (!entwurf) return;
    const e = entwurf;
    entwurf = null;
    entferneEntwurf();
    if (e.art === 'freihand') {
      if (e.punkte.length < 2) { melde('anmerkungen:geaendert'); return; }
      fuegeAn({ art: 'freihand', seiteId: e.seiteId, punkte: e.punkte, farbe: zustand.farbe, staerke: zustand.strichstaerke });
      return;
    }
    const breite = Math.abs(e.x2 - e.x), hoehe = Math.abs(e.y2 - e.y);
    if (breite < 3 || hoehe < 3) { melde('anmerkungen:geaendert'); return; }
    if (e.art === 'bereich') {
      // Kein Eintrag im Dokument: der Bereich wird nur abgelichtet.
      melde('bereich:aufgenommen', {
        seiteId: e.seiteId,
        x: Math.min(e.x, e.x2), y: Math.min(e.y, e.y2), b: breite, h: hoehe,
      });
      melde('anmerkungen:geaendert');
      return;
    }
    if (e.art === 'feld') {
      /* Erst der Rahmen, dann die Frage nach Art und Namen — das Feld
         entsteht im Dialog, nicht schon beim Loslassen der Maus. */
      melde('anmerkung:neuesFeld', {
        seiteId: e.seiteId,
        x: Math.min(e.x, e.x2), y: Math.min(e.y, e.y2), b: breite, h: hoehe,
      });
      melde('anmerkungen:geaendert');
      return;
    }
    if (e.art === 'unterschrift') {
      if (!letzteUnterschrift) { sage('Erst eine Unterschrift anlegen', { art: 'warn' }); return; }
      const x = Math.min(e.x, e.x2), y = Math.min(e.y, e.y2);
      const h = breite / letzteUnterschrift.verhaeltnis;
      fuegeAn({ art: 'unterschrift', seiteId: e.seiteId, x, y, b: breite, h: Math.min(h, hoehe * 4), bild: letzteUnterschrift.datenUrl });
      return;
    }
    fuegeAn({
      art: e.art, seiteId: e.seiteId,
      x: e.x, y: e.y, x2: e.x2, y2: e.y2,
      farbe: e.art === 'schwaerzen' ? '#000000' : zustand.farbe,
      staerke: zustand.strichstaerke,
    });
  };
  spur.addEventListener('pointerup', beende);
  spur.addEventListener('pointercancel', beende);
  spur.addEventListener('pointerleave', beende);

  // Text ersetzen: Klick auf ein Stück der Textebene
  spur.addEventListener('click', (ereignis) => {
    if (zustand.werkzeug !== 'ersetzen') return;
    const stueck = ereignis.target.closest('.textebene span');
    const blattKnoten = ereignis.target.closest('.blatt');
    if (!stueck || !blattKnoten) return;
    ereignis.preventDefault();
    ereignis.stopPropagation();
    melde('anmerkung:textErsetzen', beschreibeTextstueck(stueck, blattKnoten));
  });

  // Textauswahl-Werkzeuge
  document.addEventListener('mouseup', () => {
    if (!TEXTWERKZEUGE.has(zustand.werkzeug)) return;
    setTimeout(() => uebernehmeAuswahl(zustand.werkzeug), 0);
  });
}

function zeichneEntwurf(sicht) {
  if (!entwurf) return;
  const ebene = entwurf.blattKnoten.querySelector('.malebene');
  let svg = ebene.querySelector('svg');
  if (!svg) { svg = svgEl('svg'); ebene.append(svg); }
  entferneEntwurf();
  const zu = (x, y) => sicht.convertToViewportPoint(x, y);
  let form;
  if (entwurf.art === 'freihand') {
    form = svgEl('polyline', {
      points: entwurf.punkte.map(([x, y]) => zu(x, y).join(',')).join(' '),
      fill: 'none', stroke: zustand.farbe, 'stroke-width': zustand.strichstaerke * sicht.scale,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    });
  } else {
    const [x1, y1] = zu(entwurf.x, entwurf.y);
    const [x2, y2] = zu(entwurf.x2, entwurf.y2);
    const links = Math.min(x1, x2), oben = Math.min(y1, y2);
    const breite = Math.abs(x2 - x1), hoehe = Math.abs(y2 - y1);
    if (entwurf.art === 'ellipse') {
      form = svgEl('ellipse', { cx: links + breite / 2, cy: oben + hoehe / 2, rx: breite / 2, ry: hoehe / 2, fill: 'none', stroke: zustand.farbe, 'stroke-width': zustand.strichstaerke * sicht.scale });
    } else if (entwurf.art === 'pfeil') {
      form = svgEl('line', { x1, y1, x2, y2, stroke: zustand.farbe, 'stroke-width': zustand.strichstaerke * sicht.scale });
    } else if (entwurf.art === 'bereich') {
      form = svgEl('rect', {
        x: links, y: oben, width: breite, height: hoehe,
        fill: '#1B6AC9', 'fill-opacity': 0.12, stroke: '#1B6AC9', 'stroke-width': 1.5, 'stroke-dasharray': '5 3',
      });
    } else {
      form = svgEl('rect', {
        x: links, y: oben, width: breite, height: hoehe,
        fill: entwurf.art === 'schwaerzen' ? '#000' : 'none', 'fill-opacity': entwurf.art === 'schwaerzen' ? 0.75 : 0,
        stroke: entwurf.art === 'schwaerzen' ? '#A82E23' : zustand.farbe, 'stroke-width': zustand.strichstaerke * sicht.scale,
      });
    }
  }
  form.classList.add('ist-entwurf');
  svg.append(form);
}

function entferneEntwurf() {
  document.querySelectorAll('.ist-entwurf').forEach((k) => k.remove());
}

function beginneVerschieben(startEreignis, blattKnoten, zuPdfPunkt, id) {
  const anmerkung = zustand.anmerkungen.find((a) => a.id === id);
  if (!anmerkung) return;
  const start = zuPdfPunkt(blattKnoten, startEreignis.clientX, startEreignis.clientY);
  if (!start) return;
  const vorher = JSON.parse(JSON.stringify(anmerkung));
  let bewegt = false;

  const beiBewegung = (ereignis) => {
    const jetzt = zuPdfPunkt(blattKnoten, ereignis.clientX, ereignis.clientY);
    if (!jetzt) return;
    const dx = jetzt.x - start.x, dy = jetzt.y - start.y;
    if (!bewegt && Math.hypot(dx, dy) < 1.5) return;
    bewegt = true;
    verschiebe(anmerkung, vorher, dx, dy);
    melde('anmerkungen:geaendert');
  };
  const beiEnde = () => {
    document.removeEventListener('pointermove', beiBewegung);
    document.removeEventListener('pointerup', beiEnde);
    if (!bewegt) return;
    const nachher = JSON.parse(JSON.stringify(anmerkung));
    merkeSchritt(`${bezeichne(anmerkung)} verschoben`,
      () => { Object.assign(anmerkung, vorher); melde('anmerkungen:geaendert'); },
      () => { Object.assign(anmerkung, nachher); melde('anmerkungen:geaendert'); });
  };
  document.addEventListener('pointermove', beiBewegung);
  document.addEventListener('pointerup', beiEnde);
}

function verschiebe(anmerkung, vorher, dx, dy) {
  if (vorher.quads) anmerkung.quads = vorher.quads.map((q) => ({ ...q, x: q.x + dx, y: q.y + dy }));
  else if (vorher.punkte) anmerkung.punkte = vorher.punkte.map(([x, y]) => [x + dx, y + dy]);
  else {
    anmerkung.x = vorher.x + dx; anmerkung.y = vorher.y + dy;
    if (vorher.x2 != null) { anmerkung.x2 = vorher.x2 + dx; anmerkung.y2 = vorher.y2 + dy; }
  }
}

/** Liest Lage, Größe und Farben eines Textstücks aus der gezeichneten Seite. */
export function beschreibeTextstueck(stueck, blattKnoten) {
  const seiteId = blattKnoten.dataset.seite;
  const sicht = sichtHolen(seiteId);
  const blattKasten = blattKnoten.getBoundingClientRect();
  const kasten = stueck.getBoundingClientRect();
  const [x1, y1] = sicht.convertToPdfPoint(kasten.left - blattKasten.left, kasten.top - blattKasten.top);
  const [x2, y2] = sicht.convertToPdfPoint(kasten.right - blattKasten.left, kasten.bottom - blattKasten.top);
  const groessePx = parseFloat(stueck.style.fontSize) || kasten.height;

  return {
    seiteId,
    text: stueck.textContent,
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    b: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    groesse: groessePx / sicht.scale,
    ...lieseFarben(blattKnoten, kasten, blattKasten),
  };
}

/** Grund- und Schriftfarbe aus dem gezeichneten Bild abgreifen. */
function lieseFarben(blattKnoten, kasten, blattKasten) {
  const grundfarbe = '#FFFFFF', schriftfarbe = '#111111';
  const leinwand = blattKnoten.querySelector('canvas');
  if (!leinwand?.width) return { grundfarbe, schriftfarbe };
  try {
    const stift = leinwand.getContext('2d', { willReadFrequently: true });
    const massstab = leinwand.width / blattKasten.width;
    const links = Math.max(0, Math.floor((kasten.left - blattKasten.left) * massstab));
    const oben = Math.max(0, Math.floor((kasten.top - blattKasten.top) * massstab));
    const breite = Math.max(1, Math.min(leinwand.width - links, Math.floor(kasten.width * massstab)));
    const hoehe = Math.max(1, Math.min(leinwand.height - oben, Math.floor(kasten.height * massstab)));
    const daten = stift.getImageData(links, oben, breite, hoehe).data;

    let hellstesR = 0, hellstesG = 0, hellstesB = 0, hellste = -1;
    let dunkelstesR = 0, dunkelstesG = 0, dunkelstesB = 0, dunkelste = 1e9;
    for (let i = 0; i < daten.length; i += 4) {
      const helligkeit = daten[i] * 0.299 + daten[i + 1] * 0.587 + daten[i + 2] * 0.114;
      if (helligkeit > hellste) { hellste = helligkeit; hellstesR = daten[i]; hellstesG = daten[i + 1]; hellstesB = daten[i + 2]; }
      if (helligkeit < dunkelste) { dunkelste = helligkeit; dunkelstesR = daten[i]; dunkelstesG = daten[i + 1]; dunkelstesB = daten[i + 2]; }
    }
    const alsHex = (r, g, b) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    return { grundfarbe: alsHex(hellstesR, hellstesG, hellstesB), schriftfarbe: alsHex(dunkelstesR, dunkelstesG, dunkelstesB) };
  } catch {
    return { grundfarbe, schriftfarbe };
  }
}

export function waehleAn(id) {
  zustand.gewaehlteAnmerkung = id;
  melde('anmerkungen:geaendert');
  melde('anmerkung:gewaehlt', id);
}

/* ---------- Aus Textauswahl ---------------------------------------------- */

/** Wandelt die aktuelle Textauswahl in Quads je Seite und legt Anmerkungen an. */
export function uebernehmeAuswahl(art) {
  const auswahl = window.getSelection();
  if (!auswahl || auswahl.isCollapsed || !auswahl.rangeCount) return null;
  const bereich = auswahl.getRangeAt(0);
  const text = auswahl.toString().trim();
  const kaesten = [...bereich.getClientRects()].filter((k) => k.width > 0.5 && k.height > 0.5);
  if (!kaesten.length) return null;

  const nachSeite = new Map();
  for (const kasten of kaesten) {
    const mitteX = kasten.left + kasten.width / 2, mitteY = kasten.top + kasten.height / 2;
    const knoten = document.elementsFromPoint(mitteX, mitteY).find((k) => k.classList?.contains('blatt'));
    if (!knoten) continue;
    const seitenId = knoten.dataset.seite;
    if (!nachSeite.has(seitenId)) nachSeite.set(seitenId, { knoten, kaesten: [] });
    nachSeite.get(seitenId).kaesten.push(kasten);
  }

  const angelegt = [];
  for (const [seitenId, { knoten, kaesten: liste }] of nachSeite) {
    const quads = [];
    const blattKasten = knoten.getBoundingClientRect();
    const sicht = fensterSicht(seitenId);
    if (!sicht) continue;
    for (const kasten of liste) {
      const [x1, y1] = sicht.convertToPdfPoint(kasten.left - blattKasten.left, kasten.top - blattKasten.top);
      const [x2, y2] = sicht.convertToPdfPoint(kasten.right - blattKasten.left, kasten.bottom - blattKasten.top);
      quads.push({ x: Math.min(x1, x2), y: Math.min(y1, y2), b: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
    }
    if (!quads.length) continue;
    angelegt.push(fuegeAn({ art, seiteId: seitenId, quads, farbe: zustand.farbe, text }));
  }
  auswahl.removeAllRanges();
  if (angelegt.length) sage(`${WERKZEUGE.find((w) => w.id === art).name}: ${angelegt.length === 1 ? 'eine Stelle' : angelegt.length + ' Stellen'}`);
  return angelegt;
}

let sichtHolen = () => null;
export function setzeSichtHoler(fn) { sichtHolen = fn; }
function fensterSicht(seitenId) { return sichtHolen(seitenId); }

/* ---------- Auswertung für die Liste -------------------------------------- */

export function anmerkungsListe() {
  return zustand.anmerkungen
    .map((a) => ({ ...a, seite: nummerVon(a.seiteId) }))
    .sort((a, b) => a.seite - b.seite || a.erstellt - b.erstellt);
}
