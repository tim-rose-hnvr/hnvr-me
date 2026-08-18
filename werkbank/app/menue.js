/* Menüleiste — jeder Befehl hat einen Weg mit der Maus.

   Vorher gab es 70 Befehle und zwanzig Knöpfe. Alles andere lag hinter
   Strg+K. Wer die Tastenkombination nicht kennt, für den war die Hälfte der
   Anwendung nicht vorhanden — Seiten löschen, Texterkennung, Kennwortschutz,
   Word-Ausgabe, sogar Rückgängig.

   Die Reihenfolge ist die des Handoffs — Datei, Bearbeiten, Ansicht,
   Werkzeuge, … , Hilfe. Wo die Werkbank mehr kann als das gezeichnete
   Produkt, stehen die zusätzlichen Menüs dazwischen (Seiten hinter Ansicht,
   Gehe zu und Schutz vor Hilfe), nicht davor: das Muster wird erweitert,
   nicht gebrochen.

   Die Menüs werden aus dem Befehlsregister gebaut, nicht daneben gepflegt.
   Was in MENUES nicht eingeordnet ist, landet sichtbar unter „Weiteres" —
   ein neuer Befehl kann also nicht unsichtbar bleiben, er kann höchstens
   unsortiert sein. `pruefeVollstaendigkeit` macht daraus eine Prüfung. */

import { el, $, $$, hoer, zustand } from './kern.js';
import { befehle, fuehreAus } from './oberflaeche.js';

const T = '-';   // Trennstrich

const MENUES = [
  ['Datei', [
    'datei:oeffnen', 'datei:anhaengen', T,
    'einlesen', 'bilder:zuPdf', T,
    'sichern', 'sichern:als', 'sichern:einbrennen', T,
    'seiten:ausgeben', 'teilen', T,
    'word:ausgeben', 'excel:ausgeben', 'text:ausgeben', 'bild:ausgeben', T,
    'drucken', T,
    'verkleinern', 'reparieren', 'linearisieren', T,
    'stapel', T,
    'vergleich', 'eigenschaften',
  ]],
  ['Bearbeiten', [
    'rueckgaengig', 'wiederholen', T,
    'werkzeug:ersetzen', 'werkzeug:text', 'werkzeug:schwaerzen', T,
    'texterkennung', T,
    'text:kopieren', 'text:alleKopieren', T,
    'anmerkungen:loeschen', 'anmerkungen:alleLoeschen',
  ]],
  ['Ansicht', [
    'ansicht:groesser', 'ansicht:kleiner', 'ansicht:breite', 'ansicht:seite', T,
    'ansicht:drehen', T,
    'leiste:umschalten', 'leiste:rechtsUmschalten', 'leiste:seiten', T,
    'ansicht:thema', 'einstellungen',
  ]],
  ['Seiten', [
    'seiten:ordnen', T,
    'seiten:drehenLinks', 'seiten:drehenRechts', 'seiten:verdoppeln', 'seiten:loeschen', T,
    'seiten:alleWaehlen', 'leere:waehlen', 'seiten:nurAuswahl',
  ]],
  ['Werkzeuge', [
    'werkzeug:auswahl', T,
    'werkzeug:hervor', 'werkzeug:unterstrich', 'werkzeug:durchstrich', 'werkzeug:notiz', T,
    'werkzeug:freihand', 'werkzeug:text', 'werkzeug:rechteck', 'werkzeug:ellipse', 'werkzeug:pfeil', T,
    'werkzeug:ersetzen', 'werkzeug:schwaerzen', 'werkzeug:feld', T,
    'werkzeug:unterschrift', 'unterschrift:anlegen', 'werkzeug:stempel', 'werkzeug:bereich', T,
    'werkzeug:messen', 'werkzeug:flaeche', 'messen:massstab', 'messen:liste', T,
    'suche:treffer-hervorheben',
  ]],
  ['Gehe zu', [
    'gehezu:zurueck', 'gehezu:vor', 'gehezu:erste', 'gehezu:letzte', 'gehezu:seite', T,
    'suchen', T,
    'springe:unterschrift', 'muster:zeigen', 'formular:naechstes', T,
    'palette',
  ]],
  ['Schutz', ['signieren', T, 'schutz:setzen', 'schutz:entfernen', 'schutz:zeigen']],
  ['Hilfe', ['barrierefrei', T, 'hilfe']],
];

/* Befehle, die auch ohne geöffnetes Dokument etwas tun. Alle übrigen werden
   grau, statt ins Leere zu laufen — ein toter Knopf ist ehrlicher als ein
   Fehler. Die Liste steht hier als Ausnahme, damit ein neuer Befehl im
   Zweifel gesperrt ist und nicht versehentlich offen.

   Bewusst kein `befehle`-Zugriff auf oberster Ebene: oberflaeche.js lädt
   dieses Modul, und dieses Modul lädt oberflaeche.js. Wer in diesem Ring
   beim Auswerten schon auf `befehle` zugreift, bekommt es in der zeitlichen
   Totzone — die Anwendung startet dann gar nicht. */
const OHNE_DOKUMENT = new Set([
  'datei:oeffnen', 'bilder:zuPdf', 'einlesen', 'stapel', 'palette', 'hilfe', 'ansicht:thema',
  'unterschrift:anlegen', 'einstellungen',
]);

let offen = null;

/** Welche Befehls-Ids in keinem Menü stehen. Für den Prüflauf. */
export function unsortierteBefehle() {
  const einsortiert = new Set(MENUES.flatMap(([, ids]) => ids).filter((x) => x !== T));
  return befehle.map((b) => b.id).filter((id) => !einsortiert.has(id));
}

export function starteMenue() {
  const leiste = $('#menueleiste');
  if (!leiste) return;

  const nachzuegler = unsortierteBefehle();
  const gruppen = nachzuegler.length ? [...MENUES, ['Weiteres', nachzuegler]] : MENUES;

  const stand = $('#menue-stand');
  for (const [titel, ids] of gruppen) leiste.append(baueMenue(titel, ids));
  /* Der Dokumentstand steht rechts — dafür muss er ans Ende, sonst schiebt
     sein margin-left:auto die Menüs vor sich her. */
  if (stand) leiste.append(stand);

  /* Ein Klick irgendwo sonst schließt das offene Menü; Escape ebenso. */
  document.addEventListener('click', (e) => { if (!e.target.closest('.menue')) schliesse(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') schliesse(); });
  /* Verschiebt sich etwas, wird die Liste nachgeführt — nicht geschlossen.
     Geschlossen hätte bedeutet: wer die Menüleiste auf einem schmalen Fenster
     zur Seite schiebt, um an „Hilfe" zu kommen, schließt damit genau das
     Menü, das er gerade geöffnet hat. */
  const nachfuehren = () => {
    if (!offen) return;
    richteAus(offen.querySelector('.menue-knopf'), offen.querySelector('.menue-liste'));
  };
  window.addEventListener('resize', nachfuehren);
  window.addEventListener('scroll', nachfuehren, true);

  hoer('historie:geaendert', frischeAuf);
  hoer('dokument:geladen', frischeAuf);
  hoer('seiten:geaendert', frischeAuf);
  hoer('auswahl:geaendert', frischeAuf);
  frischeAuf();
}

function baueMenue(titel, ids) {
  const liste = el('div', { klasse: 'menue-liste', role: 'menu', hidden: true });

  for (const id of ids) {
    if (id === T) { liste.append(el('hr', { klasse: 'menue-trenner' })); continue; }
    const gefunden = befehle.find((b) => b.id === id);
    if (!gefunden) continue;   // Befehl wurde umbenannt oder entfernt
    const eintrag = el('button', {
      klasse: 'menue-eintrag', role: 'menuitem', daten: { befehl: id },
      beiClick: () => { schliesse(); fuehreAus(id); },
    },
      el('span', { klasse: 'menue-name', text: kurzName(gefunden) }),
      gefunden.kuerzel ? el('kbd', { klasse: 'menue-kuerzel', text: gefunden.kuerzel }) : null);
    liste.append(eintrag);
  }

  const knopf = el('button', {
    klasse: 'menue-knopf', 'aria-haspopf': 'true', 'aria-expanded': 'false', text: titel,
    beiClick: (e) => { e.stopPropagation(); umschalten(huelle); },
  });

  const huelle = el('div', { klasse: 'menue' }, knopf, liste);
  /* Bei schon offenem Menü genügt Überfahren zum Wechseln — so verhält sich
     jede Menüleiste, und ohne das klickt man sich wund. */
  huelle.addEventListener('mouseenter', () => { if (offen && offen !== huelle) oeffne(huelle); });
  return huelle;
}

/* „Werkzeug: Markieren" heißt im Menü „Werkzeuge" schlicht „Markieren". */
function kurzName(befehl) {
  return befehl.name.replace(/^Werkzeug: /, '');
}

/* Die aufgeklappte Liste wird ans Fenster gehängt, nicht an die Leiste.

   Vorher hing sie in der Leiste. Damit die Leiste sie nicht beschnitt, musste
   sie `overflow: visible` tragen — und sprengte dadurch auf schmalen Fenstern
   das ganze Dokument nach rechts. Beides zusammen geht nur so: die Leiste darf
   scrollen, die Liste liegt fest im Fenster und wird beim Öffnen ausgerichtet.
   Nebenbei kann sie so nie wieder von irgendeinem Vorfahren geschnitten
   werden. */
function oeffne(huelle) {
  schliesse();
  offen = huelle;
  huelle.classList.add('ist-offen');
  const knopf = huelle.querySelector('.menue-knopf');
  const liste = huelle.querySelector('.menue-liste');
  liste.hidden = false;
  knopf.setAttribute('aria-expanded', 'true');
  richteAus(knopf, liste);
}

function richteAus(knopf, liste) {
  const kasten = knopf.getBoundingClientRect();
  liste.style.top = `${Math.round(kasten.bottom)}px`;
  liste.style.left = '0px';
  /* Erst setzen, dann messen: die Breite steht erst fest, wenn die Liste
     sichtbar ist. */
  const breite = liste.getBoundingClientRect().width;
  const rand = 8;
  const links = Math.max(rand, Math.min(kasten.left, window.innerWidth - breite - rand));
  liste.style.left = `${Math.round(links)}px`;
  liste.style.maxHeight = `${Math.round(window.innerHeight - kasten.bottom - rand)}px`;
}

function schliesse() {
  if (!offen) return;
  offen.classList.remove('ist-offen');
  offen.querySelector('.menue-liste').hidden = true;
  offen.querySelector('.menue-knopf').setAttribute('aria-expanded', 'false');
  offen = null;
}

function umschalten(huelle) {
  if (offen === huelle) schliesse();
  else oeffne(huelle);
}

/** Graut, was gerade nicht geht, und hakt an, was eingeschaltet ist. */
function frischeAuf() {
  const hatDokument = zustand.folge.length > 0;
  for (const eintrag of $$('#menueleiste .menue-eintrag')) {
    const id = eintrag.dataset.befehl;
    let aus = !OHNE_DOKUMENT.has(id) && !hatDokument;
    if (id === 'rueckgaengig') aus = zustand.historieZeiger < 0;
    if (id === 'wiederholen') aus = zustand.historieZeiger >= zustand.historie.length - 1;
    eintrag.disabled = aus;
    if (id === 'seiten:nurAuswahl') eintrag.classList.toggle('ist-an', !!zustand.nurAuswahl);
  }
}
