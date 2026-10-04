/* Atelier — die Hülle um das Studio.

   Der Atelier-Entwurf (Figma P8MrdGvfyH1ZBjFtTl2zrC) ordnet das Studio wie
   einen Arbeitsraum: oben die Menüleiste, links die Navigation mit den
   Ansichten (Start, Editor, …), rechts davon die jeweilige Ansicht. Diese
   Datei schaltet zwischen den Ansichten und hält die Teile der Hülle auf
   Stand, die sonst niemandem gehören: den Dokumentkopf, das Konto-Kürzel,
   den Vollbild-Knopf.

   Eine Ansicht ist eine Sektion in #arbeitsinhalt. Gezeigt wird genau eine;
   `data-ansicht` an der Hülle sagt, welche — daran hängt auch die CSS. */

import { zustand, hoer, melde, $, $$ } from './kern.js';
import { mappenListe } from './mappen.js';

/* Welche Sektion zu welcher Ansicht gehört. Neue Ansichten (Dokumente,
   Vertraulich teilen, Einstellungen) tragen sich hier ein. */
const ANSICHTEN = {
  start: '#empfang',
  dokumente: '#ansicht-dokumente',
  editor: '#ansicht-editor',
};

let aktuelle = 'start';

/** Die Ansicht, die gerade steht. */
export function aktuelleAnsicht() { return aktuelle; }

/**
 * Zeigt eine Ansicht und verbirgt die übrigen.
 * Der Editor ohne Dokument wäre eine leere Bühne — dann bleibt es beim Start.
 * @param {keyof ANSICHTEN} name
 */
export function zeigeAnsicht(name) {
  if (!ANSICHTEN[name]) return;
  if (name === 'editor' && !zustand.folge.length) name = 'start';
  aktuelle = name;
  for (const [n, wahl] of Object.entries(ANSICHTEN)) {
    const sektion = $(wahl);
    if (sektion) sektion.hidden = n !== name;
  }
  const huelle = $('#huelle');
  if (huelle) {
    huelle.hidden = false;
    huelle.dataset.ansicht = name;
  }
  for (const punkt of $$('#atelier-navi .navi-punkt')) {
    if (punkt.dataset.ansicht === name) punkt.setAttribute('aria-current', 'page');
    else punkt.removeAttribute('aria-current');
  }
  melde('ansicht:gewechselt', name);
}

/* Der Dokumentkopf: Name groß, darunter Ort und Stand. */
function zeichneDokumentkopf() {
  const titel = $('#dokument-titel');
  const zusatz = $('#titel-zusatz');
  if (!titel) return;
  titel.textContent = zustand.folge.length ? (zustand.name || 'Ohne Titel') : '–';
  titel.title = titel.textContent;
  if (zusatz) {
    const teile = [];
    if (zustand.folge.length) teile.push(`${zustand.folge.length} ${zustand.folge.length === 1 ? 'Seite' : 'Seiten'}`);
    if (zustand.quellen.size > 1) teile.push(`${zustand.quellen.size} Quellen`);
    teile.push(zustand.geaendert ? 'Ungesicherte Änderungen' : 'Unverändert');
    zusatz.textContent = teile.join(' · ');
  }
  /* Mehrere Dateien zeigen Reiter; bei einer ist der Titel genug. */
  const reiter = $('#dokument-reiter');
  if (reiter) reiter.hidden = mappenListe().filter((m) => m.seiten).length < 2;
  const editor = $('#atelier-navi .navi-punkt[data-ansicht="editor"]');
  if (editor) editor.disabled = !zustand.folge.length;
}

/* Das Konto-Kürzel oben rechts: zwei Buchstaben aus dem Namen der
   Anmeldung, sonst ein Strich. */
export function zeigeKonto(name) {
  const feld = $('#profil');
  if (!feld) return;
  const kuerzel = String(name || '').trim().split(/[\s@._-]+/).filter(Boolean)
    .slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  feld.textContent = kuerzel || '–';
  feld.title = name ? `Angemeldet als ${name}` : 'Nicht angemeldet';
}

export function starteAtelier() {
  for (const punkt of $$('#atelier-navi .navi-punkt')) {
    punkt.addEventListener('click', () => zeigeAnsicht(punkt.dataset.ansicht));
  }
  $('#knopf-zum-start')?.addEventListener('click', () => zeigeAnsicht('start'));
  $('#knopf-vollbild')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  $('#knopf-signieren')?.addEventListener('click', () => window.studio?.fuehreAus?.('werkzeug:unterschrift'));
  $('#knopf-schwaerzen')?.addEventListener('click', () => window.studio?.fuehreAus?.('werkzeug:schwaerzen'));

  hoer('dokument:geladen', () => {
    zeichneDokumentkopf();
    zeigeAnsicht(zustand.folge.length ? 'editor' : 'start');
  });
  for (const ereignis of ['dokument:geaendert', 'seiten:geaendert', 'mappen:geaendert', 'historie:geaendert']) {
    hoer(ereignis, zeichneDokumentkopf);
  }
  zeichneDokumentkopf();
  zeigeAnsicht('start');
}
