/* Kern — Zustand, Ereignisverteiler, kleine Helfer.
   Kein Zustand liegt im DOM: die Oberfläche liest hier und hört auf Ereignisse. */

export const zustand = {
  /** Quellen: geladene PDF-Dateien. Schlüssel → { id, name, bytes, pdf, seitenzahl } */
  quellen: new Map(),
  /** Seitenfolge des Arbeitsdokuments: [{ id, quelleId, index, drehung }] */
  folge: [],
  /** Anmerkungen: [{ id, seiteId, art, ... }] in PDF-Punkten der Quellseite */
  anmerkungen: [],
  /** Formularwerte: { feldName: wert } */
  formularwerte: new Map(),
  /** Erkannter Text je Seite: seiteId → { woerter, zeilen, sprache, konfidenz } */
  ocr: new Map(),
  /** Länge des vorhandenen Seitentexts: seiteId → Zeichenzahl */
  textLaenge: new Map(),
  /** Formularfelder aus der Quelle: [{ name, art, seiteId, rechteck, optionen, wert, nurLesen }] */
  formularfelder: [],
  name: 'Ohne Titel',
  werkzeug: 'auswahl',
  farbe: '#FFD400',
  /* Farbe je Werkzeug: Gelb taugt zum Hervorheben, nicht zum Schreiben.
     Die Werkbank merkt sich die zuletzt gewählte Farbe je Werkzeug. */
  farbeJeWerkzeug: {
    hervor: '#FFD400', unterstrich: '#A82E23', durchstrich: '#A82E23',
    notiz: '#FFD400', freihand: '#A82E23', text: '#111111',
    rechteck: '#A82E23', ellipse: '#A82E23', pfeil: '#A82E23',
  },
  strichstaerke: 2,
  schriftgroesse: 12,
  zoom: 'breite',
  zoomWert: 1,
  ansichtDrehung: 0,
  aktuelleSeite: 1,
  gewaehlteSeiten: new Set(),
  /** Fokus: nur die gewählten Seiten anzeigen. Ändert das Dokument nicht. */
  nurAuswahl: false,
  gewaehlteAnmerkung: null,
  geaendert: false,
  gliederung: null,
  /** Barrierefreiheit: was beim naechsten Sichern gesetzt wird */
  zugang: null,
  eigenschaften: null,
  /** Merkfähigkeit des Assistenten */
  gedaechtnis: {
    benutzteWerkzeuge: new Map(),
    abgelehnteVorschlaege: new Set(),
    letzteAktionen: [],
  },
  /** Rückgängig-Stapel: [{ beschreibung, zurueck, vor }] */
  historie: [],
  historieZeiger: -1,
};

/* ---------- Ereignisse -------------------------------------------------- */
const hoerer = new Map();

export function hoer(name, rueckruf) {
  if (!hoerer.has(name)) hoerer.set(name, new Set());
  hoerer.get(name).add(rueckruf);
  return () => hoerer.get(name).delete(rueckruf);
}

export function melde(name, nutzlast) {
  const menge = hoerer.get(name);
  if (!menge) return;
  for (const r of [...menge]) {
    try { r(nutzlast); } catch (fehler) { console.error(`Hörer für "${name}" gescheitert:`, fehler); }
  }
}

/* ---------- Kennungen und Formate --------------------------------------- */
let zaehler = 0;
export const kennung = (praefix = 'k') => `${praefix}${(++zaehler).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function groesse(bytes) {
  if (!Number.isFinite(bytes)) return '–';
  const einheiten = ['B', 'kB', 'MB', 'GB'];
  let i = 0, wert = bytes;
  while (wert >= 1024 && i < einheiten.length - 1) { wert /= 1024; i++; }
  return `${wert.toFixed(wert < 10 && i > 0 ? 1 : 0)} ${einheiten[i]}`;
}

export function datum(wert) {
  if (!wert) return '–';
  try {
    const d = wert instanceof Date ? wert : new Date(wert);
    if (Number.isNaN(d.getTime())) return String(wert);
    return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return String(wert); }
}

/* ---------- DOM-Helfer --------------------------------------------------- */
export function el(tag, eigenschaften = {}, ...kinder) {
  const knoten = document.createElement(tag);
  for (const [schluessel, wert] of Object.entries(eigenschaften)) {
    if (wert == null || wert === false) continue;
    if (schluessel === 'klasse') knoten.className = wert;
    else if (schluessel === 'text') knoten.textContent = wert;
    else if (schluessel === 'html') knoten.innerHTML = wert;
    else if (schluessel === 'stil') Object.assign(knoten.style, wert);
    else if (schluessel.startsWith('bei')) knoten.addEventListener(schluessel.slice(3).toLowerCase(), wert);
    else if (schluessel === 'daten') for (const [d, v] of Object.entries(wert)) knoten.dataset[d] = v;
    else knoten.setAttribute(schluessel, wert === true ? '' : wert);
  }
  for (const kind of kinder.flat()) {
    if (kind == null || kind === false) continue;
    knoten.append(kind.nodeType ? kind : document.createTextNode(String(kind)));
  }
  return knoten;
}

export const $ = (wahl, wurzel = document) => wurzel.querySelector(wahl);
export const $$ = (wahl, wurzel = document) => [...wurzel.querySelectorAll(wahl)];

const svgRaum = 'http://www.w3.org/2000/svg';
export function svgEl(tag, eigenschaften = {}) {
  const knoten = document.createElementNS(svgRaum, tag);
  for (const [schluessel, wert] of Object.entries(eigenschaften)) {
    if (wert == null || wert === false) continue;
    if (schluessel.startsWith('bei')) knoten.addEventListener(schluessel.slice(3).toLowerCase(), wert);
    else knoten.setAttribute(schluessel, wert);
  }
  return knoten;
}

/* ---------- Meldungen ---------------------------------------------------- */
export function sage(text, { art = 'gut', dauer = 3600, aktion = null } = {}) {
  const behaelter = $('#meldungen');
  if (!behaelter) return;
  const knoten = el('div', { klasse: `meldung ${art === 'warn' ? 'ist-warnung' : art === 'fehler' ? 'ist-fehler' : ''}` }, text);
  if (aktion) {
    knoten.append(el('button', {
      text: aktion.beschriftung,
      beiClick: () => { knoten.remove(); aktion.tun(); },
    }));
  }
  behaelter.append(knoten);
  const weg = () => { knoten.style.opacity = '0'; setTimeout(() => knoten.remove(), 180); };
  if (dauer) setTimeout(weg, dauer);
  return weg;
}

let laderTiefe = 0;
export function ladeAn(text = 'Einen Augenblick …') {
  laderTiefe++;
  const lader = $('#lader');
  if (lader) { $('#lader-text').textContent = text; lader.hidden = false; }
}
export function ladeAus() {
  laderTiefe = Math.max(0, laderTiefe - 1);
  if (laderTiefe === 0) { const lader = $('#lader'); if (lader) lader.hidden = true; }
}

/** Führt eine Arbeit mit Ladeanzeige aus und meldet Fehler menschenlesbar. */
export async function mitLader(text, arbeit) {
  ladeAn(text);
  try {
    return await arbeit();
  } catch (fehler) {
    console.error(fehler);
    sage(`${text.replace(/ …$/, '')}: ${fehler?.message || fehler}`, { art: 'fehler', dauer: 7000 });
    throw fehler;
  } finally {
    ladeAus();
  }
}

/* ---------- Dialoge ------------------------------------------------------ */
let dialogSchliessen = null;

export function zeigeDialog({ titel, rumpf, knoepfe = [], breit = false, beiSchliessen = null }) {
  const schirm = $('#schirm');
  schirm.innerHTML = '';
  const fuss = el('div', { klasse: 'dialog-fuss' });
  const dialog = el('div', { klasse: 'dialog', stil: breit ? { width: 'min(64rem, 100%)' } : {}, role: 'dialog', 'aria-modal': 'true' },
    el('div', { klasse: 'dialog-kopf' },
      el('h2', { text: titel }),
      el('button', { klasse: 'knopf knopf-still knopf-klein', text: '✕', 'aria-label': 'Schließen', beiClick: () => schliesseDialog() })),
    el('div', { klasse: 'dialog-rumpf' }, rumpf),
    knoepfe.length ? fuss : null);

  for (const knopf of knoepfe) {
    fuss.append(el('button', {
      klasse: `knopf ${knopf.betont ? '' : 'knopf-still'} ${knopf.gefahr ? 'knopf-gefahr' : ''}`,
      text: knopf.beschriftung,
      beiClick: () => { if (knopf.tun?.() !== false) schliesseDialog(); },
    }));
  }

  schirm.append(dialog);
  schirm.hidden = false;
  dialogSchliessen = beiSchliessen;
  const ersterFokus = dialog.querySelector('input, select, textarea, button.knopf');
  ersterFokus?.focus();
  return dialog;
}

export function schliesseDialog() {
  const schirm = $('#schirm');
  if (!schirm || schirm.hidden) return;
  schirm.hidden = true;
  schirm.innerHTML = '';
  dialogSchliessen?.();
  dialogSchliessen = null;
}

export function frage({ titel, text, jaText = 'Ja', neinText = 'Abbrechen', gefahr = false }) {
  return new Promise((loese) => {
    zeigeDialog({
      titel,
      rumpf: el('p', { text }),
      knoepfe: [
        { beschriftung: neinText, tun: () => loese(false) },
        { beschriftung: jaText, betont: true, gefahr, tun: () => loese(true) },
      ],
      beiSchliessen: () => loese(false),
    });
  });
}

/* ---------- Historie ------------------------------------------------------ */
export function merkeSchritt(beschreibung, zurueck, vor) {
  zustand.historie.length = zustand.historieZeiger + 1;
  zustand.historie.push({ beschreibung, zurueck, vor });
  if (zustand.historie.length > 60) zustand.historie.shift();
  zustand.historieZeiger = zustand.historie.length - 1;
  zustand.geaendert = true;
  zustand.gedaechtnis.letzteAktionen.unshift({ beschreibung, zeit: Date.now() });
  zustand.gedaechtnis.letzteAktionen.length = Math.min(zustand.gedaechtnis.letzteAktionen.length, 20);
  melde('historie:geaendert');
  melde('dokument:geaendert');
}

export function schrittZurueck() {
  if (zustand.historieZeiger < 0) { sage('Nichts zurückzunehmen'); return; }
  const schritt = zustand.historie[zustand.historieZeiger--];
  schritt.zurueck();
  sage(`Zurückgenommen: ${schritt.beschreibung}`);
  melde('historie:geaendert');
  melde('dokument:geaendert');
}

export function schrittVor() {
  if (zustand.historieZeiger >= zustand.historie.length - 1) { sage('Nichts zu wiederholen'); return; }
  const schritt = zustand.historie[++zustand.historieZeiger];
  schritt.vor();
  sage(`Wiederholt: ${schritt.beschreibung}`);
  melde('historie:geaendert');
  melde('dokument:geaendert');
}

/* ---------- Wo die fremden Bestandteile liegen ----------------------------- */

/* Voreinstellung: neben der Anwendung, in fremd/. Wer sie woanders ablegen
   muss — etwa weil ein Hoster keine WebAssembly-Dateien annimmt — trägt im
   HTML eine andere Wurzel ein:

     <meta name="werkbank-fremd" content="https://beispiel.example/fremd/">

   Alles Schwere (PDF-Motor, Texterkennung, qpdf, Sprachdaten) wird von dort
   geholt. Der Rest der Anwendung bleibt unverändert. */
let fremdBasis = null;

export function fremdWurzel() {
  if (!fremdBasis) {
    const eigene = document.querySelector('meta[name="werkbank-fremd"]')?.content?.trim();
    const gewaehlt = eigene
      ? new URL(eigene, document.baseURI)
      : new URL('../fremd/', import.meta.url);
    fremdBasis = gewaehlt.href.endsWith('/') ? gewaehlt.href : `${gewaehlt.href}/`;
  }
  return fremdBasis;
}

export function fremdWeg(datei) {
  return new URL(datei, fremdWurzel()).href;
}

/* ---------- Sonstiges ----------------------------------------------------- */
export function drossel(fn, ms = 120) {
  let zeit = 0, kennungTimer = null, letzteArgs = null;
  return (...args) => {
    letzteArgs = args;
    const jetzt = Date.now();
    if (jetzt - zeit >= ms) { zeit = jetzt; fn(...args); }
    else if (!kennungTimer) {
      kennungTimer = setTimeout(() => { kennungTimer = null; zeit = Date.now(); fn(...letzteArgs); }, ms - (jetzt - zeit));
    }
  };
}

export function warte(ms) { return new Promise((l) => setTimeout(l, ms)); }

/** #RRGGBB → { r, g, b } in 0..1 für pdf-lib. */
export function farbeZuAnteilen(hex) {
  const wert = hex.replace('#', '');
  const voll = wert.length === 3 ? wert.split('').map((z) => z + z).join('') : wert;
  return {
    r: parseInt(voll.slice(0, 2), 16) / 255,
    g: parseInt(voll.slice(2, 4), 16) / 255,
    b: parseInt(voll.slice(4, 6), 16) / 255,
  };
}

export function ladeDatei(datei) {
  return new Promise((loese, weise) => {
    const leser = new FileReader();
    leser.onload = () => loese(new Uint8Array(leser.result));
    leser.onerror = () => weise(new Error(`${datei.name} ließ sich nicht lesen`));
    leser.readAsArrayBuffer(datei);
  });
}

/** Dateinamen entschärfen: Browser verwerfen Namen mit Sonderzeichen still. */
export function sichererName(name) {
  return name
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[\u201a\u201c\u201d\u201e\u2018\u2019]/g, '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 120) || 'dokument.pdf';
}

export function sichereBytes(bytes, dateiname, typ = 'application/pdf') {
  const blob = new Blob([bytes], { type: typ });
  const url = URL.createObjectURL(blob);
  const anker = el('a', { href: url, download: sichererName(dateiname) });
  document.body.append(anker);
  anker.click();
  anker.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
