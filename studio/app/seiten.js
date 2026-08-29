/* Seiten — Miniaturen, Auswahl, Umsortieren, Drehen, Löschen, Verdoppeln. */

import { zustand, melde, hoer, el, sage, merkeSchritt, frage, $ } from './kern.js';
import { holeSeite, verschiebeSeiten, dreheSeiten, loescheSeiten, verdoppleSeiten } from './dokument.js';

let behaelter = null;
let gitter = null;
const miniaturen = new Map();
let beobachter = null;
let letzteGeklickt = null;

export function starteSeiten() {
  behaelter = $('#tafel-miniaturen');
  hoer('dokument:geladen', baueMiniaturen);
  hoer('seiten:geaendert', baueMiniaturen);
  hoer('seite:gewechselt', markiereAktuelle);
  hoer('auswahl:geaendert', markiereAuswahl);
}

function auswahlIds() {
  return zustand.gewaehlteSeiten.size
    ? zustand.folge.filter((e) => zustand.gewaehlteSeiten.has(e.id)).map((e) => e.id)
    : [zustand.folge[zustand.aktuelleSeite - 1]?.id].filter(Boolean);
}

export function gewaehlteOderAktuelle() { return auswahlIds(); }

export function baueMiniaturen() {
  if (!behaelter) return;
  behaelter.innerHTML = '';
  miniaturen.clear();
  beobachter?.disconnect();

  /* Im Handoff trägt die Seitenleiste nur die Liste — die Werkzeuge fürs
     Sortieren stehen in der Aktionsleiste des Seitenrasters, das über den
     Knopf „Seiten" in der Werkzeugzeile aufgeht. Zwei Zeilen Knöpfe über den
     Miniaturen schoben die Liste nach unten und machten aus einer Übersicht
     eine Schaltwand.

     Erreichbar bleibt alles: Menü „Seiten", Werkzeugzeile, Tastenkürzel. */

  gitter = el('div', { klasse: 'miniaturen' });
  behaelter.append(gitter);

  beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) if (e.isIntersecting) zeichneMiniatur(e.target.dataset.seite);
  }, { root: behaelter, rootMargin: '200px' });

  zustand.folge.forEach((eintrag, i) => {
    /* Aufbau wie im Handoff: eine Karte auf Papierfarbe, darunter eine Zeile
       mit Seitenzahl (Mono), Kurztitel und — wenn es welche gibt — der Zahl
       der Kommentare. Eine Spalte, nicht zwei: der Kurztitel braucht Platz,
       und zwei Spalten machen aus einer Seitenliste ein Briefmarkenalbum. */
    const anmerkungen = zustand.anmerkungen.filter((a) => a.seiteId === eintrag.id).length;
    const knoten = el('div', {
      klasse: 'miniatur', daten: { seite: eintrag.id }, draggable: 'true', title: `Seite ${i + 1}`,
      beiClick: (ereignis) => beiKlick(ereignis, eintrag, i),
    },
      el('div', { klasse: 'miniatur-karte' }, el('canvas', { width: 100, height: 140 })),
      el('div', { klasse: 'miniatur-zeile' },
        el('span', { klasse: 'miniatur-nummer', text: String(i + 1) }),
        el('span', { klasse: 'miniatur-titel', text: kurztitel(eintrag) }),
        anmerkungen ? el('span', { klasse: 'miniatur-zahl', text: String(anmerkungen) }) : null));

    knoten.addEventListener('dragstart', (e) => {
      if (!zustand.gewaehlteSeiten.has(eintrag.id)) {
        zustand.gewaehlteSeiten.clear();
        zustand.gewaehlteSeiten.add(eintrag.id);
        melde('auswahl:geaendert');
      }
      e.dataTransfer.setData('text/studio-seiten', auswahlIds().join(','));
      e.dataTransfer.effectAllowed = 'move';
      knoten.classList.add('wird-gezogen');
    });
    knoten.addEventListener('dragend', () => {
      knoten.classList.remove('wird-gezogen');
      gitter.querySelectorAll('.ziel-vor, .ziel-nach').forEach((k) => k.classList.remove('ziel-vor', 'ziel-nach'));
    });
    knoten.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes('text/studio-seiten')) return;
      e.preventDefault();
      const kasten = knoten.getBoundingClientRect();
      const nachher = e.clientY > kasten.top + kasten.height / 2;
      gitter.querySelectorAll('.ziel-vor, .ziel-nach').forEach((k) => k.classList.remove('ziel-vor', 'ziel-nach'));
      knoten.classList.add(nachher ? 'ziel-nach' : 'ziel-vor');
    });
    knoten.addEventListener('drop', (e) => {
      const nutzlast = e.dataTransfer.getData('text/studio-seiten');
      if (!nutzlast) return;
      e.preventDefault();
      const kasten = knoten.getBoundingClientRect();
      const nachher = e.clientY > kasten.top + kasten.height / 2;
      const zielIndex = zustand.folge.findIndex((x) => x.id === eintrag.id) + (nachher ? 1 : 0);
      sortiere(nutzlast.split(','), zielIndex);
    });

    gitter.append(knoten);
    miniaturen.set(eintrag.id, { knoten, eintrag, gezeichnet: false });
    beobachter.observe(knoten);
  });

  markiereAktuelle();
  markiereAuswahl();
}

/* Ein Wort, an dem die Seite wiederzuerkennen ist: die erste Zeile mit Text.
   Steht noch keiner da (der Text kommt asynchron), bleibt die Zeile leer —
   lieber leer als „Seite 3" doppelt neben der 3. */
export function kurztitel(eintrag) {
  const quelle = zustand.quellen.get(eintrag.quelleId);
  const roh = quelle?.textkarte.get(eintrag.index)?.roh || '';
  const zeilen = roh.split('\n').map((z) => z.trim()).filter((z) => z.length > 2);
  /* Die erste Zeile ist auf jeder Seite dieselbe, wenn das Dokument eine
     Kopfzeile trägt — dann taugt sie nicht zum Unterscheiden. In dem Fall
     wird die erste Zeile genommen, die nicht auf allen Seiten steht. */
  const zeile = zeilen.find((z) => !istKopfzeile(quelle, z)) || zeilen[0] || '';
  return zeile.slice(0, 40);
}

/* Eine Zeile gilt als Kopfzeile, wenn sie auf mindestens der Hälfte der
   gelesenen Seiten als erste Zeile auftaucht. */
function istKopfzeile(quelle, text) {
  if (!quelle || quelle.textkarte.size < 3) return false;
  let treffer = 0;
  for (const { roh } of quelle.textkarte.values()) {
    const erste = roh.split('\n').map((z) => z.trim()).find((z) => z.length > 2);
    if (erste === text) treffer += 1;
  }
  return treffer * 2 >= quelle.textkarte.size;
}

function beiKlick(ereignis, eintrag, index) {
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
    melde('seiten:springe', index + 1);
  }
  melde('auswahl:geaendert');
}

async function zeichneMiniatur(seitenId) {
  const eintrag = miniaturen.get(seitenId);
  if (!eintrag || eintrag.gezeichnet) return;
  eintrag.gezeichnet = true;
  try {
    const seite = await holeSeite(eintrag.eintrag);
    const drehung = (seite.rotate + eintrag.eintrag.drehung) % 360;
    const grund = seite.getViewport({ scale: 1, rotation: drehung });
    const skala = 150 / grund.width;
    const sicht = seite.getViewport({ scale: skala, rotation: drehung });
    const leinwand = eintrag.knoten.querySelector('canvas');
    leinwand.width = Math.ceil(sicht.width);
    leinwand.height = Math.ceil(sicht.height);
    const stift = leinwand.getContext('2d');
    stift.fillStyle = '#fff';
    stift.fillRect(0, 0, leinwand.width, leinwand.height);
    await seite.render({ canvasContext: stift, viewport: sicht }).promise;
  } catch (fehler) {
    eintrag.gezeichnet = false;
    console.warn('Miniatur fehlgeschlagen', fehler);
  }
}

function markiereAktuelle() {
  const aktuell = zustand.folge[zustand.aktuelleSeite - 1];
  for (const [id, m] of miniaturen) m.knoten.classList.toggle('ist-aktuell', id === aktuell?.id);
  const knoten = aktuell && miniaturen.get(aktuell.id)?.knoten;
  if (knoten && behaelter && !istSichtbar(knoten, behaelter)) knoten.scrollIntoView({ block: 'nearest' });
}

function istSichtbar(knoten, wurzel) {
  const a = knoten.getBoundingClientRect(), b = wurzel.getBoundingClientRect();
  return a.top >= b.top - 4 && a.bottom <= b.bottom + 4;
}

function markiereAuswahl() {
  for (const [id, m] of miniaturen) m.knoten.classList.toggle('ist-gewaehlt', zustand.gewaehlteSeiten.has(id));
  melde('tafel:auffrischen');
}

/* ---------- Aktionen ------------------------------------------------------ */

export function sortiere(ids, zielIndex) {
  const vorher = [...zustand.folge];
  verschiebeSeiten(ids, zielIndex);
  const nachher = [...zustand.folge];
  merkeSchritt(`${ids.length} Seite${ids.length === 1 ? '' : 'n'} verschoben`,
    () => { zustand.folge = [...vorher]; melde('seiten:geaendert'); },
    () => { zustand.folge = [...nachher]; melde('seiten:geaendert'); });
  melde('seiten:geaendert');
}

export function drehe(grad) {
  const ids = auswahlIds();
  if (!ids.length) return;
  dreheSeiten(ids, grad);
  merkeSchritt(`${ids.length} Seite${ids.length === 1 ? '' : 'n'} gedreht`,
    () => { dreheSeiten(ids, -grad); melde('seiten:geaendert'); },
    () => { dreheSeiten(ids, grad); melde('seiten:geaendert'); });
  melde('seiten:geaendert');
}

export async function loesche() {
  const ids = auswahlIds();
  if (!ids.length) return;
  if (ids.length === zustand.folge.length) { sage('Die letzte Seite bleibt stehen', { art: 'warn' }); return; }
  const sicher = ids.length < 3 || await frage({
    titel: 'Seiten löschen',
    text: `${ids.length} Seiten werden aus dem Arbeitsdokument entfernt. Die Originaldatei bleibt unberührt.`,
    jaText: 'Löschen', gefahr: true,
  });
  if (!sicher) return;
  const vorherFolge = [...zustand.folge];
  const vorherAnmerkungen = [...zustand.anmerkungen];
  loescheSeiten(ids);
  zustand.gewaehlteSeiten.clear();
  const nachherFolge = [...zustand.folge];
  const nachherAnmerkungen = [...zustand.anmerkungen];
  merkeSchritt(`${ids.length} Seite${ids.length === 1 ? '' : 'n'} gelöscht`,
    () => { zustand.folge = [...vorherFolge]; zustand.anmerkungen = [...vorherAnmerkungen]; melde('seiten:geaendert'); },
    () => { zustand.folge = [...nachherFolge]; zustand.anmerkungen = [...nachherAnmerkungen]; melde('seiten:geaendert'); });
  melde('seiten:geaendert');
  melde('auswahl:geaendert');
  sage(`${ids.length} Seite${ids.length === 1 ? '' : 'n'} gelöscht`, {
    aktion: { beschriftung: 'Rückgängig', tun: () => { zustand.folge = [...vorherFolge]; zustand.anmerkungen = [...vorherAnmerkungen]; melde('seiten:geaendert'); } },
  });
}

export function verdopple() {
  const ids = auswahlIds();
  if (!ids.length) return;
  const vorher = [...zustand.folge];
  verdoppleSeiten(ids);
  const nachher = [...zustand.folge];
  merkeSchritt(`${ids.length} Seite${ids.length === 1 ? '' : 'n'} verdoppelt`,
    () => { zustand.folge = [...vorher]; melde('seiten:geaendert'); },
    () => { zustand.folge = [...nachher]; melde('seiten:geaendert'); });
  melde('seiten:geaendert');
}
