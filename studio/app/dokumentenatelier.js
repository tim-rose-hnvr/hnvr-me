/* Dokumentenatelier — Start, Dokumente, Sammlungen.

   Die Startseite des Atelier-Entwurfs: „Zuletzt geöffnet" als Stapel,
   „Was möchten Sie erledigen?" als nummerierte Liste, darunter die
   Sammlungen. Dazu die Ansicht „Dokumente" mit allem, was auf diesem Gerät
   liegt.

   **Erst fragen, dann merken.** Das Studio hat versprochen, nichts zu
   hinterlassen. Eine Liste der zuletzt geöffneten Dateien bricht dieses
   Versprechen, wenn sie ungefragt mitläuft — deshalb steht auf der
   Startseite einmal die Frage, und erst nach „Ja" wird abgelegt. Die Antwort
   selbst wird gemerkt (sonst käme die Frage bei jedem Besuch), und sie lässt
   sich in „Dokumente" jederzeit ändern. */

import { zustand, hoer, melde, el, $, $$, sage, groesse, frage, zeigeFormular } from './kern.js';
import {
  ablageVerfuegbar, legeAb, vermerke, liste, hole, entferne, leereAblage,
  ordneZu, sammlungen, legeSammlungAn, entferneSammlung, belegung,
} from './ablage.js';
import { zeigeAnsicht } from './atelier.js';
import { mappenListe, wechsleZu } from './mappen.js';

/* ---------- Die Frage: merken oder nicht ---------------------------------- */

const MERKEN_SCHLUESSEL = 'studio:ablage-merken';

/** 'ja', 'nein' oder 'frage' (noch nicht beantwortet). */
export function merkenStand() {
  if (!ablageVerfuegbar()) return 'nein';
  try { return localStorage.getItem(MERKEN_SCHLUESSEL) || 'frage'; } catch { return 'frage'; }
}

export function setzeMerken(wert) {
  try { localStorage.setItem(MERKEN_SCHLUESSEL, wert); } catch { /* ohne Speicher gilt es für diesen Besuch */ }
  merkenFluechtig = wert;
  /* „Nichts merken" gilt sofort auch für gemerkte Einstellungen. Die
     abgelegten Dokumente bleiben, bis man sie löscht — das sagt die
     Ansicht „Dokumente". */
  if (wert === 'nein') { try { localStorage.removeItem('studio:einstellungen'); } catch { /* ohne Speicher */ } }
  if (wert === 'ja') merkeAktuelles();
  melde('ablage:geaendert');
}
/* Falls localStorage gesperrt ist, gilt die Antwort wenigstens bis zum
   Neuladen — sonst fragte der Knopf „Ja" ins Leere. */
let merkenFluechtig = null;
const merken = () => merkenFluechtig || merkenStand();

/* ---------- Ablegen, was geöffnet wird ----------------------------------- */

function erstesQuellBytes() {
  const quelle = zustand.quellen.values().next().value;
  return quelle?.bytes || null;
}

async function merkeAktuelles(status = 'geoeffnet') {
  if (merken() !== 'ja' || !zustand.folge.length) return;
  const bytes = erstesQuellBytes();
  if (!bytes) return;
  const id = await legeAb({ name: zustand.name, bytes, seiten: zustand.folge.length, status });
  if (id) zustand.ablageId = id;
}

/* Status-Vermerke: was zuletzt geschah. Gedrosselt, damit nicht jeder
   Federstrich einen Schreibvorgang auslöst. */
let vermerkZeit = null;
function vermerkeSpaeter(status) {
  if (merken() !== 'ja' || !zustand.ablageId) return;
  clearTimeout(vermerkZeit);
  const id = zustand.ablageId;
  vermerkZeit = setTimeout(() => {
    /* „Bearbeitet" nur, wenn es beim Auslösen noch stimmt: wer in den 600 ms
       gesichert hat, hat eine gesicherte Datei, keine bearbeitete. */
    if (status === 'bearbeitet' && !zustand.geaendert) return;
    vermerke(id, status);
  }, 600);
}

/* ---------- Aufgaben: „Was möchten Sie erledigen?" ----------------------- */

/* Die sechs Aufgaben des Entwurfs. Wer eine wählt, ohne dass eine Datei
   offen ist, wählt zuerst eine — danach geht es gleich weiter. Die drei mit
   eigener Adresse (zusammenführen, OCR, verkleinern) führen auf den kurzen
   Weg, der dafür gebaut ist. */
const AUFGABEN = [
  {
    titel: 'Rechnung korrigieren', satz: 'Text und Beträge direkt bearbeiten', kennung: '⌘ E',
    zeichen: 'M4 6h7M7.5 6v12M4 18h7M14 9h6v6h-6z',
    tun: () => mitDatei(() => window.studio?.fuehreAus?.('modus:bearbeiten')),
  },
  {
    titel: 'PDFs zusammenführen', satz: 'Dateien sammeln, Seiten sortieren', kennung: 'Werkzeug',
    zeichen: 'M7 3h7l4 4v11H7zM14 3v4h4M3 7v14h11',
    adresse: '?werkzeug=zusammenfuegen',
  },
  {
    titel: 'Scan durchsuchbar machen', satz: 'Text erkennen mit lokaler OCR', kennung: 'OCR',
    zeichen: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 10h8M8 14h5',
    adresse: '?werkzeug=texterkennung',
  },
  {
    titel: 'Vertrag prüfen und unterschreiben', satz: 'Kommentieren, ausfüllen, signieren', kennung: 'Im Editor',
    zeichen: 'M3 18c3 0 5-12 8-12s2 9 4 9 2-3 6-3',
    tun: () => mitDatei(() => {
      window.studio?.fuehreAus?.('modus:kommentieren');
      document.querySelector('[data-rtafel="felder"].reiter-knopf')?.click();
    }),
  },
  {
    titel: 'Vertrauliche Informationen entfernen', satz: 'Schwärzen, prüfen und sicher teilen', kennung: '3 Schritte',
    zeichen: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z',
    tun: () => mitDatei(() => zeigeAnsicht('teilen')),
  },
  {
    titel: 'Datei für Versand verkleinern', satz: 'Qualität wählen, Dateigröße reduzieren', kennung: 'Export',
    zeichen: 'M8 3h8l4 4v14H4V7zM12 10v7M9 14l3 3 3-3',
    adresse: '?werkzeug=verkleinern',
  },
];

let wartet = null;
/** Führt `tat` mit dem offenen Dokument aus — oder nach der Dateiwahl. */
export function mitDatei(tat) {
  if (zustand.folge.length) { zeigeAnsicht('editor'); tat(); return; }
  wartet = tat;
  $('#dateiwahl')?.click();
}

function zeichneAufgaben() {
  const liste = $('#start-aufgaben');
  if (!liste) return;
  liste.innerHTML = '';
  AUFGABEN.forEach((aufgabe, i) => {
    const inhalt = [
      el('span', { klasse: 'aufgabe-nummer', text: String(i + 1).padStart(2, '0'), 'aria-hidden': 'true' }),
      el('span', { klasse: 'aufgabe-text' },
        el('span', { klasse: 'aufgabe-titel', text: aufgabe.titel }),
        el('span', { klasse: 'aufgabe-satz', text: aufgabe.satz })),
      el('span', { klasse: 'aufgabe-kennung' },
        el('span', { html: `<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><path d="${aufgabe.zeichen}"/></svg>` }),
        el('span', { klasse: 'aufgabe-kuerzel', text: aufgabe.kennung })),
    ];
    const ziel = aufgabe.adresse
      ? el('a', { klasse: 'aufgabe', href: aufgabe.adresse }, ...inhalt)
      : el('button', { klasse: 'aufgabe', type: 'button', beiClick: aufgabe.tun }, ...inhalt);
    liste.append(el('li', {}, ziel));
  });
}

/* ---------- Zuletzt geöffnet ---------------------------------------------- */

/* Mehrere Ereignisse lösen dasselbe Zeichnen aus, und jedes wartet auf die
   Ablage. Ohne Nummer überholen sich die Läufe und hängen ihr Ergebnis
   zweimal an. Mit Nummer gewinnt der jüngste; ältere brechen nach dem Warten
   ab. */
const laeufe = {};
const neuerLauf = (name) => { laeufe[name] = (laeufe[name] || 0) + 1; return laeufe[name]; };
const ueberholt = (name, nummer) => laeufe[name] !== nummer;

function wann(zeit) {
  const d = new Date(zeit);
  const heute = new Date();
  const gestern = new Date(Date.now() - 864e5);
  const uhr = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === heute.toDateString()) return `Heute, ${uhr}`;
  if (d.toDateString() === gestern.toDateString()) return `Gestern, ${uhr}`;
  return `${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}, ${uhr}`;
}

async function oeffneAusAblage(id) {
  /* Ist die Datei schon offen, wird zu ihrem Reiter gewechselt — nicht ein
     zweites Mal geöffnet. */
  const offen = mappenListe().find((m) => m.ablageId === id);
  if (offen) { wechsleZu(offen.id); zeigeAnsicht('editor'); return; }
  const datei = await hole(id).catch(() => null);
  if (!datei) { sage('Diese Datei liegt nicht mehr auf dem Gerät.', { art: 'warn' }); return; }
  melde('dateien:hereingereicht', [new File([datei.bytes], datei.name, { type: 'application/pdf' })]);
}

function frageKarte() {
  return el('div', { klasse: 'merken-frage', role: 'group', 'aria-labelledby': 'merken-frage-titel' },
    el('p', { klasse: 'merken-frage-titel', id: 'merken-frage-titel', text: 'Dokumente auf diesem Gerät merken?' }),
    el('p', { klasse: 'merken-frage-satz', text:
      'Dann stehen hier die zuletzt geöffneten Dateien, und Sie können sie in Sammlungen ordnen. '
      + 'Gespeichert wird nur in diesem Browser auf diesem Gerät — nichts geht ins Netz. '
      + 'Ohne bleibt alles, wie es ist: nach dem Schließen ist nichts mehr da.' }),
    el('div', { klasse: 'merken-frage-knoepfe' },
      el('button', { klasse: 'knopf knopf-voll', id: 'merken-ja', text: 'Ja, hier merken', beiClick: () => setzeMerken('ja') }),
      el('button', { klasse: 'knopf', id: 'merken-nein', text: 'Nein, nichts merken', beiClick: () => setzeMerken('nein') })));
}

async function zeichneStapel() {
  const stapel = $('#start-stapel');
  if (!stapel) return;
  const lauf = neuerLauf('stapel');
  const stand = merken();
  const suche = $('#start-suche')?.value || '';
  if (stand === 'frage') { stapel.innerHTML = ''; stapel.append(frageKarte()); return; }
  if (stand === 'nein') {
    stapel.innerHTML = '';
    stapel.append(el('p', { klasse: 'stapel-leer', text:
      'Das Studio merkt sich keine Dateien. Öffnen Sie eine Datei oder ziehen Sie sie hierher.' }));
    return;
  }
  const alle = await liste({ suche });
  const namen = Object.fromEntries((await sammlungen()).map((s) => [s.id, s.name]));
  if (ueberholt('stapel', lauf)) return;
  stapel.innerHTML = '';
  if (!alle.length) {
    stapel.append(el('p', { klasse: 'stapel-leer', text: suche
      ? `Kein Dokument passt zu „${suche}".`
      : 'Noch keine Dokumente. Die nächste Datei, die Sie öffnen, erscheint hier.' }));
    return;
  }
  /* Wie im Entwurf: das oberste Blatt groß, mit rostrotem Rücken, Etikett,
     Name in der Anzeigeschrift und einem Vermerk unter einer Linie; die
     übrigen schmal, Name links, Zeit und Stand rechts. */
  alle.slice(0, 4).forEach((d, i) => {
    const erstes = i === 0;
    const meta = [namen[d.sammlung], `${d.seiten} ${d.seiten === 1 ? 'Seite' : 'Seiten'}`, groesse(d.groesse)].filter(Boolean).join(' · ');
    const ruecken = el('span', { klasse: 'stapel-ruecken', 'aria-hidden': 'true' },
      el('span', { klasse: 'stapel-marke' }), el('span', { text: 'PDF' }));
    const datei = el('span', { klasse: 'stapel-datei' },
      el('span', { klasse: 'stapel-name', text: d.name }),
      el('span', { klasse: 'stapel-meta', text: meta }));
    const inhalt = erstes
      ? el('span', { klasse: 'stapel-inhalt' },
        el('span', { klasse: 'stapel-etikett', text: 'Dokument' }),
        datei,
        el('span', { klasse: 'stapel-vermerk' },
          el('span', {},
            el('span', { klasse: 'stapel-vermerk-etikett', text: 'Zuletzt geöffnet' }),
            el('span', { text: wann(d.zuletzt) })),
          el('span', {},
            el('span', { klasse: 'stapel-vermerk-etikett', text: 'Status' }),
            el('span', { klasse: 'stapel-status', text: d.statusText })),
          el('span', { klasse: 'stapel-symbol', html: DATEI_SYMBOL })))
      : el('span', { klasse: 'stapel-inhalt' },
        datei,
        el('span', { klasse: 'stapel-stand' },
          el('span', { text: wann(d.zuletzt) }),
          el('span', { klasse: 'stapel-status', text: d.statusText })));
    stapel.append(el('div', { klasse: `stapel-blatt ${erstes ? 'ist-oben' : ''}`, style: `--versatz: ${i}` },
      el('button', {
        klasse: 'stapel-karte', type: 'button',
        'aria-label': `${d.name} öffnen`,
        beiClick: () => oeffneAusAblage(d.id),
      }, ruecken, inhalt)));
  });
}

const DATEI_SYMBOL = '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true">'
  + '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>';

async function zeichneSammlungsregister() {
  const register = $('#start-sammlungen');
  const bestand = $('#start-bestand');
  const lauf = neuerLauf('register');
  const alle = merken() === 'ja' ? await sammlungen() : [];
  const zahl = merken() === 'ja' ? (await belegung()).anzahl : 0;
  if (ueberholt('register', lauf)) return;
  if (register) {
    register.innerHTML = '';
    register.hidden = merken() !== 'ja';
    register.append(el('span', { klasse: 'register-etikett', text: 'Sammlungen' }));
    if (!alle.length) {
      register.append(el('span', { klasse: 'register-leer', text: 'Noch keine — unter „Dokumente" anlegen.' }));
    }
    for (const s of alle) {
      register.append(el('button', {
        klasse: 'register-sammlung', type: 'button',
        beiClick: () => zeigeDokumente(s.id),
      },
        el('span', { html: '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>' }),
        el('span', { klasse: 'register-name', text: s.name }),
        el('span', { klasse: 'register-zahl', text: String(s.anzahl) })));
    }
  }
  if (bestand) {
    if (merken() !== 'ja') { bestand.textContent = 'Keine Dateien gemerkt · Keine Synchronisierung'; return; }
    bestand.textContent = `${zahl} ${zahl === 1 ? 'Dokument' : 'Dokumente'} auf diesem Gerät · Keine Synchronisierung`;
  }
}

/* Die Sammlungen auch links in der Navigation, wie im Entwurf. */
async function zeichneNaviSammlungen() {
  const kasten = $('#navi-sammlungen');
  if (!kasten) return;
  const lauf = neuerLauf('navi');
  const alle = merken() === 'ja' ? await sammlungen() : [];
  if (ueberholt('navi', lauf)) return;
  kasten.innerHTML = '';
  kasten.hidden = !alle.length;
  if (!alle.length) return;
  kasten.append(el('span', { klasse: 'navi-etikett', text: 'Sammlungen' }));
  for (const s of alle) {
    kasten.append(el('button', {
      klasse: 'navi-sammlung', type: 'button', title: s.name,
      beiClick: () => zeigeDokumente(s.id),
    },
      el('span', { html: '<svg viewBox="0 0 24 24" class="sinnbild" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z"/></svg>' }),
      el('span', { klasse: 'navi-sammlung-name', text: s.name }),
      el('span', { klasse: 'navi-sammlung-zahl', text: String(s.anzahl) })));
  }
}

function zeichneGruss(name) {
  const feld = $('#start-gruss');
  if (!feld) return;
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Guten Tag' : 'Guten Abend';
  feld.textContent = name ? `Ihr Dokumentenatelier / ${gruss}, ${name}` : 'Ihr Dokumentenatelier';
}

/* ---------- Ansicht „Dokumente" ------------------------------------------- */

let filterSammlung;        // undefined = alle, null = ohne Sammlung, sonst Kennung
let filterSuche = '';

export function zeigeDokumente(sammlung) {
  filterSammlung = sammlung;
  zeigeAnsicht('dokumente');
  zeichneDokumente();
}

async function zeichneDokumente() {
  const sektion = $('#ansicht-dokumente');
  if (!sektion || sektion.hidden) return;
  const lauf = neuerLauf('dokumente');
  const stand = merken();
  const [gruppen, platz] = await Promise.all([
    stand === 'ja' ? sammlungen() : [],
    stand === 'ja' ? belegung() : { anzahl: 0, bytes: 0, frei: null },
  ]);
  if (ueberholt('dokumente', lauf)) return;
  const namen = Object.fromEntries(gruppen.map((s) => [s.id, s.name]));
  sektion.innerHTML = '';

  const kopf = el('header', { klasse: 'seitenkopf' },
    el('div', {},
      el('p', { klasse: 'seitenkopf-etikett', text: 'Dokumentenatelier' }),
      el('h1', { klasse: 'anzeige-titel', text: filterSammlung ? (namen[filterSammlung] || 'Sammlung') : 'Dokumente' }),
      el('p', { klasse: 'seitenkopf-satz', text: 'Was auf diesem Gerät liegt. Nichts davon ist hochgeladen.' })),
    el('button', { klasse: 'knopf knopf-rost', text: 'Datei öffnen', beiClick: () => $('#dateiwahl')?.click() }));
  sektion.append(kopf);

  if (stand !== 'ja') {
    sektion.append(el('div', { klasse: 'dokumente-rumpf' }, stand === 'frage' ? frageKarte()
      : el('div', { klasse: 'merken-frage' },
        el('p', { klasse: 'merken-frage-titel', text: 'Das Studio merkt sich keine Dateien.' }),
        el('p', { klasse: 'merken-frage-satz', text: 'Sie haben entschieden, dass auf diesem Gerät nichts liegen bleibt. Das lässt sich ändern.' }),
        el('div', { klasse: 'merken-frage-knoepfe' },
          el('button', { klasse: 'knopf', text: 'Doch merken', beiClick: () => setzeMerken('ja') })))));
    return;
  }

  /* Werkzeugzeile: Suche, Sammlungen als Filter, neue Sammlung. */
  const suche = el('input', { type: 'search', klasse: 'feld', placeholder: 'Dokumente suchen', value: filterSuche,
    'aria-label': 'Dokumente suchen' });
  suche.addEventListener('input', () => { filterSuche = suche.value; zeichneTabelle(); });
  const filter = el('div', { klasse: 'filterreihe', role: 'group', 'aria-label': 'Sammlung' });
  const knopf = (wert, text) => el('button', {
    klasse: `knopf knopf-klein ${filterSammlung === wert ? 'ist-aktiv' : ''}`, text,
    'aria-pressed': filterSammlung === wert ? 'true' : 'false',
    beiClick: () => { filterSammlung = wert; zeichneDokumente(); },
  });
  filter.append(knopf(undefined, 'Alle'), knopf(null, 'Ohne Sammlung'), ...gruppen.map((s) => knopf(s.id, `${s.name} ${s.anzahl}`)));
  const neu = el('button', {
    klasse: 'knopf knopf-klein', text: '+ Sammlung',
    beiClick: () => zeigeFormular({
      titel: 'Neue Sammlung',
      felder: [{ name: 'name', beschriftung: 'Name', platzhalter: 'zum Beispiel Projekte' }],
      hinweise: ['Eine Sammlung ordnet Dokumente auf diesem Gerät. Sie liegt nirgends sonst.'],
      tat: {
        beschriftung: 'Anlegen',
        tun: async ({ name }) => {
          try { const s = await legeSammlungAn(name); sage(`Sammlung „${s.name}" angelegt`); } catch (fehler) { sage(fehler.message, { art: 'warn' }); }
        },
      },
    }),
  });
  const sammlungWeg = filterSammlung ? el('button', {
    klasse: 'knopf knopf-klein knopf-still', text: 'Sammlung auflösen',
    beiClick: async () => {
      if (!await frage({ titel: 'Sammlung auflösen', text: `„${namen[filterSammlung]}" wird aufgelöst. Die Dokumente bleiben, nur ohne Sammlung.`, jaText: 'Auflösen' })) return;
      await entferneSammlung(filterSammlung);
      filterSammlung = undefined;
      zeichneDokumente();
    },
  }) : null;
  sektion.append(el('div', { klasse: 'dokumente-werkzeuge' }, suche, filter, neu, sammlungWeg));

  const tabelle = el('div', { klasse: 'dokumente-tabelle', role: 'table', 'aria-label': 'Dokumente auf diesem Gerät' });
  sektion.append(tabelle);

  async function zeichneTabelle() {
    const tabellenlauf = neuerLauf('tabelle');
    const zeilen = await liste({ sammlung: filterSammlung, suche: filterSuche });
    if (ueberholt('tabelle', tabellenlauf)) return;
    tabelle.innerHTML = '';
    tabelle.append(el('div', { klasse: 'dokumente-zeile dokumente-kopf', role: 'row' },
      ...['Dokument', 'Sammlung', 'Seiten', 'Größe', 'Zuletzt', 'Status', ''].map((t) => el('span', { role: 'columnheader', text: t }))));
    if (!zeilen.length) {
      tabelle.append(el('p', { klasse: 'stapel-leer', text: filterSuche ? `Kein Dokument passt zu „${filterSuche}".` : 'Hier liegt noch nichts.' }));
      return;
    }
    for (const d of zeilen) {
      const wahl = el('select', { klasse: 'feld', 'aria-label': `Sammlung für ${d.name}` },
        el('option', { value: '', text: '—' }),
        ...gruppen.map((s) => el('option', { value: s.id, text: s.name })));
      wahl.value = d.sammlung || '';
      wahl.addEventListener('change', () => ordneZu(d.id, wahl.value || null));
      tabelle.append(el('div', { klasse: 'dokumente-zeile', role: 'row', daten: { dokument: d.id } },
        el('span', { role: 'cell' }, el('button', { klasse: 'verweis dokumente-name', text: d.name, beiClick: () => oeffneAusAblage(d.id) })),
        el('span', { role: 'cell' }, wahl),
        el('span', { role: 'cell', klasse: 'zahl', text: String(d.seiten) }),
        el('span', { role: 'cell', klasse: 'zahl', text: groesse(d.groesse) }),
        el('span', { role: 'cell', text: wann(d.zuletzt) }),
        el('span', { role: 'cell', klasse: 'stapel-status', text: d.statusText }),
        el('span', { role: 'cell' }, el('button', {
          klasse: 'knopf knopf-klein knopf-still', text: 'Entfernen', 'aria-label': `${d.name} vom Gerät entfernen`,
          beiClick: async () => {
            if (!await frage({ titel: 'Vom Gerät entfernen', text: `„${d.name}" wird aus der Ablage dieses Geräts gelöscht. Die Datei, aus der sie stammt, bleibt, wo sie ist.`, jaText: 'Entfernen', gefahr: true })) return;
            await entferne(d.id);
            if (zustand.ablageId === d.id) zustand.ablageId = null;
          },
        }))));
    }
  }
  await zeichneTabelle();
  if (ueberholt('dokumente', lauf)) return;

  const frei = platz.frei != null ? ` · ${groesse(platz.frei)} frei` : '';
  sektion.append(el('footer', { klasse: 'dokumente-fuss' },
    el('span', { text: `${platz.anzahl} ${platz.anzahl === 1 ? 'Dokument' : 'Dokumente'} · ${groesse(platz.bytes)} auf diesem Gerät${frei}` }),
    el('span', { klasse: 'dokumente-fuss-taten' },
      el('button', { klasse: 'knopf knopf-klein knopf-still', text: 'Nichts mehr merken', beiClick: () => setzeMerken('nein') }),
      el('button', {
        klasse: 'knopf knopf-klein', text: 'Ablage leeren',
        beiClick: async () => {
          if (!await frage({ titel: 'Ablage leeren', text: 'Alle Dokumente und Sammlungen werden von diesem Gerät gelöscht. Die Originaldateien bleiben, wo sie sind.', jaText: 'Alles löschen', gefahr: true })) return;
          await leereAblage();
          zustand.ablageId = null;
          sage('Ablage geleert');
        },
      }))));
}

/* ---------- Anschluss ------------------------------------------------------ */

function zeichneAlles() {
  zeichneStapel();
  zeichneSammlungsregister();
  zeichneNaviSammlungen();
  zeichneDokumente();
}

export function starteDokumentenatelier() {
  zeichneAufgaben();
  zeichneGruss('');
  zeichneAlles();

  $('#start-suche')?.addEventListener('input', () => zeichneStapel());
  $('#start-alle')?.addEventListener('click', () => zeigeDokumente(undefined));
  for (const punkt of $$('#atelier-navi .navi-punkt[data-ansicht="dokumente"]')) {
    punkt.addEventListener('click', () => { filterSammlung = undefined; zeichneDokumente(); });
  }
  /* Der Reiter „Dokumente" auf dem Deckblatt zeigt alle, wie der Punkt links. */
  document.addEventListener('click', (ereignis) => {
    if (ereignis.target.closest?.('.start-reiter[data-ansicht="dokumente"]')) zeigeDokumente(undefined);
  });

  hoer('ablage:geaendert', zeichneAlles);
  hoer('ansicht:gewechselt', (name) => { if (name === 'dokumente') zeichneDokumente(); if (name === 'start') zeichneStapel(); });
  /* Der Einzelwerkzeug-Weg ersetzt den Rumpf und stellt ihn als Text wieder
     her — ohne Ereignisse. Also neu zeichnen und neu verdrahten. */
  hoer('empfang:wiederhergestellt', () => {
    zeichneAufgaben();
    zeichneAlles();
    $('#start-suche')?.addEventListener('input', () => zeichneStapel());
    $('#start-alle')?.addEventListener('click', () => zeigeDokumente(undefined));
  });
  hoer('anmeldung:name', (name) => zeichneGruss(name));

  /* Was geöffnet wird, kommt in die Ablage — wenn gewollt. */
  hoer('dokument:frisch', () => {
    zustand.ablageId = null;
    merkeAktuelles();
  });
  hoer('dokument:geladen', () => {
    if (!wartet || !zustand.folge.length) return;
    const tat = wartet;
    wartet = null;
    setTimeout(tat, 0);
  });
  hoer('anmerkungen:geaendert', () => vermerkeSpaeter('kommentiert'));
  hoer('ocr:geaendert', () => vermerkeSpaeter('texterkannt'));
  hoer('historie:geaendert', () => { if (zustand.geaendert) vermerkeSpaeter('bearbeitet'); });
  /* Nach dem Sichern liegt die gesicherte Fassung in der Ablage — so öffnet
     „Zuletzt geöffnet" das, was zuletzt gesichert wurde. */
  hoer('dokument:gesichert', async ({ bytes }) => {
    clearTimeout(vermerkZeit);
    if (merken() !== 'ja' || !bytes) return;
    const id = await legeAb({ id: zustand.ablageId, name: zustand.name, bytes, seiten: zustand.folge.length, status: 'gespeichert' });
    if (id) zustand.ablageId = id;
  });
}
