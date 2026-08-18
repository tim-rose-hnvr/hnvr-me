/**
 * Die Werkstatt — Steuerung.
 *
 * Der Editor arbeitet auf einem Entwurf in der Form, die auch veröffentlicht
 * wird. Es gibt keine Zwischenform und keine Übersetzung: was hier steht, geht
 * unverändert durch `lieseProfil` und danach in die Vorschau, die von derselben
 * Komponente gerendert wird wie die echte Seite.
 *
 * Zwei Arten, die Vorschau nachzuziehen:
 *
 *  - Ändert sich nur die Gestaltung, werden die CSS-Variablen im Rahmen gesetzt.
 *    Das ist sofort da und behält die Scrollhöhe.
 *  - Ändert sich der Inhalt, wird der Rahmen mit dem gepackten Entwurf neu
 *    geladen. Gebündelt nach 350 ms Ruhe, und die Scrollhöhe wird gemerkt.
 *
 * Der Entwurf liegt im Browser, nicht auf einem Server. Das ist hier etwas
 * anderes als beim Vorgänger: dort war der Browser die Quelle der
 * *veröffentlichten* Seite, weshalb fremde Besucher nichts sahen. Hier ist er
 * nur der Notizblock, bis der Entwurf abgegeben wird.
 */

import {
  abweichung,
  AUFBAUTEN,
  cssVariablen,
  FLIESSTEXTSCHRIFTEN,
  istFarbe,
  pruefeLesbarkeit,
  SCHRIFTEN,
  vorlage,
  vorlagenName,
  VORLAGEN,
  type Gestaltung,
} from '../kern/gestaltung.ts';
import { abgabeAdresse, linkPasst, type Beilage } from '../kern/abgabe.ts';
import { musterprofil, neueKennung } from '../kern/muster.ts';
import { packe, entpacke } from '../kern/packung.ts';
import {
  KANALARTEN,
  NACHRICHT_GRENZEN,
  NETZWERKE,
  lieseProfil,
  pruefeSlug,
  type Aktionsblock,
  type Block,
  type KanalArt,
  type Netzwerk,
  type Profil,
} from '../kern/profil.ts';
import { nameDesWochentags, type Wochentag } from '../kern/zeit.ts';
import { lucide, type Lucidename } from '../kern/lucide.ts';

const SCHUBLADE = 'getintouch.entwurf.v1';
const RUHEZEIT = 350;

/* ------------------------------------------------------------------ *
 * Kleinkram
 * ------------------------------------------------------------------ */

function el<K extends keyof HTMLElementTagNameMap>(
  name: K,
  eigenschaften: Partial<Record<string, unknown>> = {},
  kinder: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const knoten = document.createElement(name);
  for (const [schluessel, wert] of Object.entries(eigenschaften)) {
    if (wert === undefined || wert === false) continue;
    if (schluessel === 'class') knoten.className = String(wert);
    else if (schluessel === 'text') knoten.textContent = String(wert);
    else if (schluessel.startsWith('on')) knoten.addEventListener(schluessel.slice(2), wert as EventListener);
    else knoten.setAttribute(schluessel, wert === true ? '' : String(wert));
  }
  for (const kind of kinder) knoten.append(kind);
  return knoten;
}

/**
 * Eine SVG-Zeichenkette als Knoten.
 *
 * `lucide()` gibt Markup zurück, weil es auch beim Bauen der Seiten gebraucht
 * wird. Hier im Browser braucht es einen Knoten — und `innerHTML` auf einem
 * Wegwerf-Element ist dafür der kurze Weg. Die Zeichenketten stammen aus
 * einer erzeugten Datei im eigenen Projekt, nicht aus einer Eingabe.
 */
function knotenAus(markup: string): Node {
  const huelle = document.createElement('span');
  huelle.innerHTML = markup;
  return huelle.firstElementChild ?? document.createTextNode('');
}

function frage<T extends HTMLElement>(wahl: string): T {
  const knoten = document.querySelector<T>(wahl);
  if (!knoten) throw new Error(`Fehlt in der Werkstatt: ${wahl}`);
  return knoten;
}

/* ------------------------------------------------------------------ *
 * Zustand
 * ------------------------------------------------------------------ */

let entwurf: Profil = musterprofil();
let reiter = 'inhalt';
let letzterInhalt = '';
let zeitschalter: ReturnType<typeof setTimeout> | undefined;

const rahmen = frage<HTMLIFrameElement>('#vorschaurahmen');

/**
 * Alles außer der Gestaltung — daran hängt, ob die Vorschau neu laden muss.
 *
 * Der Aufbau zählt mit, obwohl er zur Gestaltung gehört: Farben lassen sich als
 * Variablen nachschieben, eine andere Anordnung nicht. Der Aufbau „Held" bringt
 * ohne Titelbild eine eigene Fläche mit, und die muss erst entstehen.
 */
function inhaltsAbdruck(p: Profil): string {
  const { gestaltung, ...rest } = p;
  return JSON.stringify({ ...rest, aufbau: gestaltung.aufbau });
}

function sichern() {
  try {
    localStorage.setItem(SCHUBLADE, JSON.stringify(entwurf));
  } catch {
    /* Voller oder gesperrter Speicher darf die Werkstatt nicht anhalten. */
  }
}

function laden(): Profil | null {
  try {
    const roh = localStorage.getItem(SCHUBLADE);
    if (!roh) return null;
    const ergebnis = lieseProfil(JSON.parse(roh));
    return ergebnis.ok ? ergebnis.profil : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Vorschau
 * ------------------------------------------------------------------ */

function gestaltungAnwenden() {
  const koerper = rahmen.contentDocument?.body;
  if (!koerper) return;
  for (const [name, wert] of Object.entries(cssVariablen(entwurf.gestaltung))) {
    koerper.style.setProperty(name, wert);
  }
  const blatt = koerper.querySelector('.blatt');
  if (blatt) {
    blatt.setAttribute('data-schaltflaeche', entwurf.gestaltung.schaltflaeche);
    blatt.setAttribute('data-aufbau', entwurf.gestaltung.aufbau);
  }
  const bild = koerper.querySelector('.bild');
  if (bild) bild.className = `bild bild--${entwurf.gestaltung.bildform}`;
}

async function vorschauNeuLaden() {
  const hoehe = rahmen.contentWindow?.scrollY ?? 0;
  const gepackt = await packe(entwurf);
  rahmen.addEventListener(
    'load',
    () => {
      rahmen.contentWindow?.scrollTo(0, hoehe);
      gestaltungAnwenden();
    },
    { once: true },
  );
  rahmen.src = `/werkstatt/vorschau?p=${gepackt}`;
}

function vorschauNachziehen() {
  const abdruck = inhaltsAbdruck(entwurf);
  if (abdruck === letzterInhalt) {
    // Nur die Gestaltung hat sich geändert — kein Neuladen nötig.
    gestaltungAnwenden();
    return;
  }
  letzterInhalt = abdruck;
  clearTimeout(zeitschalter);
  zeitschalter = setTimeout(() => void vorschauNeuLaden(), RUHEZEIT);
}

/* ------------------------------------------------------------------ *
 * Befunde und Ausgabe
 * ------------------------------------------------------------------ */

function befundeZeichnen() {
  const kasten = frage('#befunde');
  kasten.replaceChildren();

  const ergebnis = lieseProfil(entwurf);
  if (!ergebnis.ok) {
    for (const f of ergebnis.fehler) {
      kasten.append(el('p', { class: 'befund befund--fehler', text: `${f.stelle || 'Profil'}: ${f.meldung}` }));
    }
  }

  for (const b of pruefeLesbarkeit(entwurf.gestaltung)) {
    kasten.append(el('p', { class: `befund befund--${b.schwere}`, text: b.meldung }));
  }

  if (ergebnis.ok && !kasten.children.length) {
    kasten.append(
      el('p', {
        class: 'befund befund--gut',
        text: 'Vollständig und lesbar. Kontrast nach WCAG 2.1 geprüft, alle Ziele ergeben eine gültige Adresse.',
      }),
    );
  }

  frage('#ausgabe').textContent = JSON.stringify(
    { ...entwurf, version: undefined, gestaltung: abweichung(entwurf.gestaltung) },
    (_s, w) => (w === undefined ? undefined : w),
    2,
  );
}

/* ------------------------------------------------------------------ *
 * Umlauf
 * ------------------------------------------------------------------ */

function geaendert(auchNeuZeichnen = false) {
  sichern();
  befundeZeichnen();
  vorschauNachziehen();
  if (auchNeuZeichnen) zeichneAlles();
}

/* ------------------------------------------------------------------ *
 * Bausteine für die Formulare
 * ------------------------------------------------------------------ */

function textfeld(name: string, wert: string, beiAenderung: (w: string) => void, platzhalter = ''): HTMLElement {
  const eingabe = el('input', { type: 'text', value: wert, placeholder: platzhalter, spellcheck: 'false' });
  eingabe.addEventListener('input', () => {
    beiAenderung(eingabe.value);
    geaendert();
  });
  return el('label', { class: 'feld' }, [el('span', { class: 'feld__name', text: name }), eingabe]);
}

function bereichfeld(name: string, wert: string, beiAenderung: (w: string) => void): HTMLElement {
  const eingabe = el('textarea', { rows: '3', spellcheck: 'false' });
  eingabe.value = wert;
  eingabe.addEventListener('input', () => {
    beiAenderung(eingabe.value);
    geaendert();
  });
  return el('label', { class: 'feld' }, [el('span', { class: 'feld__name', text: name }), eingabe]);
}

function auswahlfeld(
  name: string,
  wert: string,
  moeglichkeiten: { wert: string; name: string }[],
  beiAenderung: (w: string) => void,
): HTMLElement {
  const auswahl = el('select');
  for (const m of moeglichkeiten) {
    const eintrag = el('option', { value: m.wert, text: m.name });
    if (m.wert === wert) eintrag.selected = true;
    auswahl.append(eintrag);
  }
  auswahl.addEventListener('change', () => {
    beiAenderung(auswahl.value);
    geaendert(true);
  });
  return el('label', { class: 'feld' }, [el('span', { class: 'feld__name', text: name }), auswahl]);
}

function schalterfeld(name: string, an: boolean, beiAenderung: (an: boolean) => void): HTMLElement {
  const knopf = el('button', {
    type: 'button',
    class: 'kippe',
    'aria-pressed': String(an),
    text: an ? 'An' : 'Aus',
  });
  knopf.addEventListener('click', () => {
    beiAenderung(knopf.getAttribute('aria-pressed') !== 'true');
    geaendert(true);
  });
  return el('div', { class: 'feld feld--waagerecht' }, [el('span', { class: 'feld__name', text: name }), knopf]);
}

/* ------------------------------------------------------------------ *
 * Tafel: Inhalt
 * ------------------------------------------------------------------ */

function zeichneInhalt() {
  const tafel = frage('#tafel-inhalt');
  const pruefung = pruefeSlug(entwurf.slug);

  const adresse = el('input', { type: 'text', value: entwurf.slug, spellcheck: 'false' });
  adresse.addEventListener('input', () => {
    entwurf.slug = adresse.value.trim().toLowerCase();
    hinweis.textContent = pruefeSlug(entwurf.slug).ok ? 'Frei wählbar, später schwer zu ändern.' : pruefeSlug(entwurf.slug).ok === false ? (pruefeSlug(entwurf.slug) as { grund: string }).grund : '';
    hinweis.className = pruefeSlug(entwurf.slug).ok ? 'whinweis' : 'whinweis whinweis--warnung';
    geaendert();
  });
  const hinweis = el('p', {
    class: pruefung.ok ? 'whinweis' : 'whinweis whinweis--warnung',
    text: pruefung.ok ? 'Frei wählbar, später schwer zu ändern.' : pruefung.grund,
  });

  tafel.replaceChildren(
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Adresse' }),
      el('label', { class: 'feld' }, [
        // Die eigene Adresse, nicht die des Herstellers — und nicht fest
        // eingetragen, sondern aus dem Browser: unter welcher Domain der
        // Dienst läuft, weiß er selbst am besten.
        el('span', { class: 'feld__name', text: `${location.host}/t/…` }),
        adresse,
      ]),
      hinweis,
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Kopf' }),
      textfeld('Name', entwurf.kopf.name, (w) => (entwurf.kopf.name = w), 'Betrieb oder Person'),
      textfeld('Zeile darunter', entwurf.kopf.rolle ?? '', (w) => (entwurf.kopf.rolle = w), 'Was du machst · Ort'),
      bereichfeld('Beschreibung', entwurf.kopf.beschreibung ?? '', (w) => (entwurf.kopf.beschreibung = w)),
      textfeld('Profilbild', entwurf.kopf.bild ?? '', (w) => (entwurf.kopf.bild = w), '/bilder/… oder https://…'),
      textfeld('Titelbild', entwurf.kopf.titelbild ?? '', (w) => (entwurf.kopf.titelbild = w), 'optional'),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Rechtliches' }),
      textfeld('Impressum', entwurf.rechtliches?.impressum ?? '', (w) => {
        entwurf.rechtliches = { ...entwurf.rechtliches, impressum: w };
      }),
      textfeld('Datenschutz', entwurf.rechtliches?.datenschutz ?? '', (w) => {
        entwurf.rechtliches = { ...entwurf.rechtliches, datenschutz: w };
      }),
      el('p', {
        class: 'whinweis',
        text: 'Steht nur auf der Seite, wenn es gepflegt ist. Ein Link auf eine leere Impressumsseite ist schlechter als keiner.',
      }),
    ]),
  );
}

/* ------------------------------------------------------------------ *
 * Tafel: Blöcke
 * ------------------------------------------------------------------ */

const KANALNAMEN: Record<KanalArt, string> = {
  link: 'Link',
  telefon: 'Anrufen',
  mobil: 'Mobil',
  whatsapp: 'WhatsApp',
  mail: 'E-Mail',
  termin: 'Termin',
  route: 'Anfahrt',
  shop: 'Shop',
  datei: 'Download',
  video: 'Video',
};

const ZIELHINWEIS: Record<KanalArt, string> = {
  link: 'https://…',
  telefon: '+49 511 …',
  mobil: '+49 170 …',
  whatsapp: '+49 170 … oder https://wa.me/…',
  mail: 'post@beispiel.de',
  termin: 'https://…',
  route: 'Straße, PLZ Ort',
  shop: 'https://…',
  datei: 'https://…',
  video: 'https://…',
};

function verschiebe(index: number, richtung: -1 | 1) {
  const ziel = index + richtung;
  if (ziel < 0 || ziel >= entwurf.bloecke.length) return;
  const [block] = entwurf.bloecke.splice(index, 1);
  entwurf.bloecke.splice(ziel, 0, block!);
  geaendert(true);
}

/* Zeichen und Kurzbeschreibung je Baustein — im Editor-Screen `6a` trägt
   jede Zeile beides, damit man die Reihenfolge lesen kann, ohne sie
   aufzuklappen. */
function blockZeichen(block: Block): Lucidename {
  switch (block.art) {
    case 'nachricht':
      return 'message-circle-heart';
    case 'aktion':
      return 'link';
    case 'ueberschrift':
      return 'user-round';
    case 'text':
      return 'newspaper';
    default:
      return 'grip-vertical';
  }
}

function blockName(block: Block): string {
  switch (block.art) {
    case 'aktion':
      return KANALNAMEN[block.kanal];
    case 'nachricht':
      return 'Nachricht';
    case 'ueberschrift':
      return 'Überschrift';
    case 'text':
      return 'Textblock';
    default:
      return 'Trennlinie';
  }
}

function blockUnterzeile(block: Block): string {
  switch (block.art) {
    case 'nachricht': {
      const n = block.absichten.length;
      return `${n} ${n === 1 ? 'Absicht' : 'Absichten'}${block.frage ? ' · Frage im Kopf' : ''}`;
    }
    case 'aktion':
      return block.beschriftung || 'ohne Beschriftung';
    case 'ueberschrift':
    case 'text':
      return block.beschriftung || 'leer';
    default:
      return 'trennt zwei Abschnitte';
  }
}

/**
 * Ziehen zum Ordnen.
 *
 * Der Editor-Screen `6a` zeigt die Reihenfolge als Karten mit Griff und eine
 * gestrichelte rote Zone, in die man ablegt. Beides hier.
 *
 * Die Pfeiltasten an jeder Karte bleiben. Ziehen ist mit der Tastatur nicht
 * bedienbar und für manche Zeigergeräte mühsam — eine Oberfläche, die nur
 * gezogen werden kann, schließt Leute aus.
 */
/**
 * Welcher Baustein gerade aufgeklappt ist.
 *
 * Der Editor-Screen `6a` zeigt die Reihenfolge als schmale Zeilen und die
 * Felder rechts im Inspektor — „Ziehen zum Ordnen · Klick zum Bearbeiten".
 * Hier klappt der angetippte Baustein an Ort und Stelle auf, weil die dritte
 * Spalte schon die Vorschau trägt. Die Wirkung ist dieselbe: man sieht die
 * Reihenfolge, ohne durch acht ausgeklappte Formulare zu scrollen.
 */
let offenerBaustein: string | null = null;

function ziehenEinrichten(liste: HTMLElement): void {
  let herkunft = -1;

  const zonen = () => Array.from(liste.querySelectorAll<HTMLElement>('.block'));

  liste.addEventListener('dragstart', (e) => {
    const karte = (e.target as HTMLElement).closest<HTMLElement>('.block');
    if (!karte) return;
    herkunft = Number(karte.dataset.index);
    karte.classList.add('block--zieht');
    e.dataTransfer?.setData('text/plain', String(herkunft));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  });

  liste.addEventListener('dragend', () => {
    herkunft = -1;
    zonen().forEach((z) => z.classList.remove('block--zieht', 'block--ziel'));
  });

  liste.addEventListener('dragover', (e) => {
    if (herkunft < 0) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const ueber = (e.target as HTMLElement).closest<HTMLElement>('.block');
    zonen().forEach((z) => z.classList.toggle('block--ziel', z === ueber && Number(z.dataset.index) !== herkunft));
  });

  liste.addEventListener('drop', (e) => {
    if (herkunft < 0) return;
    e.preventDefault();
    const ueber = (e.target as HTMLElement).closest<HTMLElement>('.block');
    if (!ueber) return;
    const ziel = Number(ueber.dataset.index);
    if (Number.isNaN(ziel) || ziel === herkunft) return;
    const [block] = entwurf.bloecke.splice(herkunft, 1);
    entwurf.bloecke.splice(ziel, 0, block!);
    herkunft = -1;
    geaendert(true);
  });
}

function blockKarte(block: Block, index: number): HTMLElement {
  const offen = block.id === offenerBaustein;

  const kopf = el(
    'div',
    {
      class: offen ? 'block__kopf block__kopf--offen' : 'block__kopf',
      onclick: (e: Event) => {
        /* Die Werkzeuge im Kopf haben ihre eigene Aufgabe. */
        if ((e.target as HTMLElement).closest('.block__werkzeug')) return;
        offenerBaustein = offen ? null : block.id;
        geaendert(true);
      },
    },
    [
    /* Der Griff ist der Anfasser zum Ziehen. Er sagt es auch, statt es nur
       zu können: ein Feld, das man ziehen kann, muss danach aussehen. */
    el('span', { class: 'block__griff', title: 'Ziehen zum Ordnen', 'aria-hidden': 'true' }, [
      knotenAus(lucide('grip-vertical', 14)),
    ]),
    el('span', { class: 'block__zeichen', 'aria-hidden': 'true' }, [knotenAus(lucide(blockZeichen(block), 17))]),
    el('span', { class: 'block__benennung' }, [
      el('span', { class: 'block__art', text: blockName(block) }),
      el('span', { class: 'block__unter', text: blockUnterzeile(block) }),
    ]),
    el('div', { class: 'block__werkzeug' }, [
      el('button', { type: 'button', title: 'Nach oben', text: '↑', onclick: () => verschiebe(index, -1) }),
      el('button', { type: 'button', title: 'Nach unten', text: '↓', onclick: () => verschiebe(index, 1) }),
      el(
        'button',
        {
          type: 'button',
          title: block.aktiv ? 'Ausblenden' : 'Einblenden',
          'aria-pressed': String(block.aktiv),
          class: block.aktiv ? 'block__auge' : 'block__auge aus',
          onclick: () => {
            block.aktiv = !block.aktiv;
            geaendert(true);
          },
        },
        [knotenAus(lucide(block.aktiv ? 'eye' : 'eye-off', 15))],
      ),
      el('button', {
        type: 'button',
        title: 'Entfernen',
        text: '×',
        onclick: () => {
          entwurf.bloecke.splice(index, 1);
          if (entwurf.hauptaktion?.offen === block.id) delete entwurf.hauptaktion.offen;
          if (entwurf.hauptaktion?.zu === block.id) delete entwurf.hauptaktion.zu;
          geaendert(true);
        },
      }),
    ]),
    ],
  );

  const karte = el(
    'div',
    {
      class: block.aktiv ? 'block' : 'block block--aus',
      draggable: 'true',
      'data-index': String(index),
    },
    [kopf],
  );

  /* Zugeklappt bleibt es bei der Zeile — die Felder baut nur, wer sie sieht. */
  if (!offen || block.art === 'trenner') return karte;

  if (block.art === 'nachricht') {
    const nachricht = block;
    karte.append(
      textfeld('Überschrift', nachricht.beschriftung, (w) => (nachricht.beschriftung = w)),
      textfeld('Frage darüber', nachricht.frage ?? '', (w) => (nachricht.frage = w), 'Worum geht es?'),
      textfeld(
        'Absichten, mit Komma getrennt',
        nachricht.absichten.join(', '),
        (w) => {
          nachricht.absichten = w
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean)
            .slice(0, NACHRICHT_GRENZEN.absichten);
        },
        'Auftrag, Termin, Etwas anderes',
      ),
      el('p', {
        class: 'whinweis',
        text: 'Höchstens fünf. Wer die Wahl zwischen acht Absichten hat, wählt keine — und eine sortierte Anfrage ist für dich mehr wert als eine unsortierte.',
      }),
    );
    return karte;
  }

  if (block.art === 'ueberschrift' || block.art === 'text') {
    karte.append(
      block.art === 'text'
        ? bereichfeld('Text', block.beschriftung, (w) => (block.beschriftung = w))
        : textfeld('Überschrift', block.beschriftung, (w) => (block.beschriftung = w)),
    );
    return karte;
  }

  const aktion = block as Aktionsblock;
  karte.append(
    auswahlfeld(
      'Kanal',
      aktion.kanal,
      KANALARTEN.map((k) => ({ wert: k, name: KANALNAMEN[k] })),
      (w) => (aktion.kanal = w as KanalArt),
    ),
    textfeld('Beschriftung', aktion.beschriftung, (w) => (aktion.beschriftung = w)),
    textfeld('Unterzeile', aktion.unterzeile ?? '', (w) => (aktion.unterzeile = w), 'optional'),
    textfeld('Ziel', aktion.ziel, (w) => (aktion.ziel = w), ZIELHINWEIS[aktion.kanal]),
    schalterfeld('Hervorgehoben', aktion.betont === true, (an) => (aktion.betont = an || undefined)),
    auswahlfeld(
      'Darstellung',
      aktion.form ?? '',
      [
        { wert: '', name: 'Nach Kanal (empfohlen)' },
        { wert: 'kachel', name: 'Kachel' },
        { wert: 'zeile', name: 'Zeile' },
      ],
      (w) => (aktion.form = (w || undefined) as 'kachel' | 'zeile' | undefined),
    ),
  );
  return karte;
}

function zeichneBloecke() {
  const tafel = frage('#tafel-bloecke');
  const ueberschrift = el('div', { class: 'reihenfolge' }, [
    el('b', { text: 'Reihenfolge' }),
    el('span', { text: 'Ziehen zum Ordnen · Klick zum Bearbeiten' }),
  ]);

  const liste = el('div', { class: 'blockliste' }, entwurf.bloecke.map(blockKarte));
  ziehenEinrichten(liste);

  const hinzu = (art: Block['art'], kanal?: KanalArt) => {
    const id = neueKennung(entwurf.bloecke.map((b) => b.id));
    if (art === 'aktion') {
      entwurf.bloecke.push({
        id,
        art: 'aktion',
        kanal: kanal ?? 'link',
        beschriftung: KANALNAMEN[kanal ?? 'link'],
        unterzeile: '',
        ziel: '',
        aktiv: true,
      });
    } else if (art === 'trenner') {
      entwurf.bloecke.push({ id, art: 'trenner', aktiv: true });
    } else if (art === 'nachricht') {
      entwurf.bloecke.push({
        id,
        art: 'nachricht',
        beschriftung: 'Schreib uns',
        frage: 'Worum geht es?',
        absichten: ['Anfrage für einen Auftrag', 'Termin', 'Etwas anderes'],
        aktiv: true,
      });
    } else if (art === 'ueberschrift' || art === 'text') {
      entwurf.bloecke.push({ id, art, beschriftung: art === 'ueberschrift' ? 'Überschrift' : 'Text', aktiv: true });
    }
    geaendert(true);
  };

  const knoepfe = el('div', { class: 'zufuegen' }, [
    ...KANALARTEN.map((k) =>
      el('button', { type: 'button', text: `+ ${KANALNAMEN[k]}`, onclick: () => hinzu('aktion', k) }),
    ),
    el('button', { type: 'button', text: '+ Nachricht', onclick: () => hinzu('nachricht') }),
    el('button', { type: 'button', text: '+ Überschrift', onclick: () => hinzu('ueberschrift') }),
    el('button', { type: 'button', text: '+ Textblock', onclick: () => hinzu('text') }),
    el('button', { type: 'button', text: '+ Trennlinie', onclick: () => hinzu('trenner') }),
  ]);

  tafel.replaceChildren(
    el('div', { class: 'feldgruppe' }, [
      ueberschrift,
      el('p', {
        class: 'whinweis',
        text: 'Anrufen, Nachricht, Anfahrt und Termin werden Kacheln und stehen nebeneinander. Alles, was auf eine Seite zum Lesen führt, wird eine ruhige Zeile.',
      }),
      liste,
    ]),
    el('div', { class: 'feldgruppe' }, [el('h2', { class: 'wmarke2', text: 'Hinzufügen' }), knoepfe]),
  );
}

/* ------------------------------------------------------------------ *
 * Tafel: Kontakt (Kanäle + Visitenkarte)
 * ------------------------------------------------------------------ */

function zeichneKontakt() {
  const tafel = frage('#tafel-kontakt');

  const kanalliste = el(
    'div',
    { class: 'blockliste' },
    entwurf.kanaele.map((kanal, index) =>
      el('div', { class: 'block' }, [
        el('div', { class: 'block__kopf' }, [
          el('span', { class: 'block__art', text: 'Kanal' }),
          el('div', { class: 'block__werkzeug' }, [
            el('button', {
              type: 'button',
              title: 'Entfernen',
              text: '×',
              onclick: () => {
                entwurf.kanaele.splice(index, 1);
                geaendert(true);
              },
            }),
          ]),
        ]),
        auswahlfeld(
          'Netzwerk',
          kanal.netzwerk,
          NETZWERKE.map((n) => ({ wert: n, name: n === 'website' ? 'Website' : n[0]!.toUpperCase() + n.slice(1) })),
          (w) => (kanal.netzwerk = w as Netzwerk),
        ),
        textfeld('Name oder Adresse', kanal.ziel, (w) => (kanal.ziel = w), 'benutzername'),
      ]),
    ),
  );

  const karte = entwurf.visitenkarte;
  const kartenfelder: [string, keyof NonNullable<Profil['visitenkarte']>][] = [
    ['Vorname', 'vorname'],
    ['Nachname', 'nachname'],
    ['Firma', 'firma'],
    ['Funktion', 'funktion'],
    ['Telefon', 'telefon'],
    ['Mobil', 'mobil'],
    ['E-Mail', 'mail'],
    ['Web', 'web'],
    ['Straße', 'strasse'],
    ['PLZ', 'plz'],
    ['Ort', 'ort'],
    ['Land', 'land'],
    ['Notiz', 'notiz'],
  ];

  tafel.replaceChildren(
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Kanäle' }),
      kanalliste,
      el('div', { class: 'zufuegen' }, [
        el('button', {
          type: 'button',
          text: '+ Kanal',
          onclick: () => {
            entwurf.kanaele.push({ netzwerk: 'instagram', ziel: '' });
            geaendert(true);
          },
        }),
      ]),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Visitenkarte' }),
      el('p', {
        class: 'whinweis',
        text: 'Wird zur vCard 3.0 zum Herunterladen. Ohne Vor- und Nachnamen bleibt sie weg — eine Karte ohne Namen speichert niemand.',
      }),
      ...(karte
        ? kartenfelder.map(([name, feld]) => textfeld(name, karte[feld] ?? '', (w) => Object.assign(karte, { [feld]: w })))
        : [
            el('div', { class: 'zufuegen' }, [
              el('button', {
                type: 'button',
                text: '+ Visitenkarte anlegen',
                onclick: () => {
                  entwurf.visitenkarte = { vorname: '', nachname: '', land: 'Deutschland' };
                  geaendert(true);
                },
              }),
            ]),
          ]),
    ]),
  );
}

/* ------------------------------------------------------------------ *
 * Tafel: Zeiten
 * ------------------------------------------------------------------ */

function zeichneZeiten() {
  const tafel = frage('#tafel-zeiten');
  const plan = entwurf.erreichbarkeit;

  if (!plan) {
    tafel.replaceChildren(
      el('div', { class: 'feldgruppe' }, [
        el('h2', { class: 'wmarke2', text: 'Erreichbarkeit' }),
        el('p', {
          class: 'whinweis',
          text: 'Ohne Öffnungszeiten steht keine Statuszeile auf der Seite, und die Hauptaktion wechselt nicht. Das ist in Ordnung — eine erfundene Verfügbarkeit wäre schlimmer.',
        }),
        el('div', { class: 'zufuegen' }, [
          el('button', {
            type: 'button',
            text: '+ Öffnungszeiten pflegen',
            onclick: () => {
              entwurf.erreichbarkeit = {
                zeitzone: 'Europe/Berlin',
                fenster: [{ tag: 1, von: '09:00', bis: '17:00' }],
                ausnahmen: [],
              };
              geaendert(true);
            },
          }),
        ]),
      ]),
    );
    return;
  }

  const tage: HTMLElement[] = [];
  for (let tag = 1 as Wochentag; tag <= 7; tag = (tag + 1) as Wochentag) {
    const fenster = plan.fenster.filter((f) => f.tag === tag);
    const zeilen = fenster.map((f) => {
      const von = el('input', { type: 'time', value: f.von });
      const bis = el('input', { type: 'time', value: f.bis });
      von.addEventListener('input', () => {
        f.von = von.value;
        geaendert();
      });
      bis.addEventListener('input', () => {
        f.bis = bis.value;
        geaendert();
      });
      return el('div', { class: 'zeitzeile' }, [
        von,
        el('span', { text: 'bis' }),
        bis,
        el('button', {
          type: 'button',
          title: 'Entfernen',
          text: '×',
          onclick: () => {
            plan.fenster.splice(plan.fenster.indexOf(f), 1);
            geaendert(true);
          },
        }),
      ]);
    });

    tage.push(
      el('div', { class: fenster.length ? 'tag' : 'tag tag--zu' }, [
        el('div', { class: 'tag__kopf' }, [
          el('b', { text: nameDesWochentags(tag) }),
          el('button', {
            type: 'button',
            class: 'tag__plus',
            title: 'Zeitfenster hinzufügen',
            text: '+',
            onclick: () => {
              plan.fenster.push({ tag, von: '09:00', bis: '17:00' });
              geaendert(true);
            },
          }),
        ]),
        ...(zeilen.length ? zeilen : [el('p', { class: 'whinweis', text: 'geschlossen' })]),
      ]),
    );
  }

  const ausnahmen = plan.ausnahmen ?? (plan.ausnahmen = []);
  const ausnahmeliste = ausnahmen.map((a, index) => {
    const datum = el('input', { type: 'date', value: a.datum });
    datum.addEventListener('input', () => {
      a.datum = datum.value;
      geaendert();
    });
    return el('div', { class: 'block' }, [
      el('div', { class: 'block__kopf' }, [
        el('span', { class: 'block__art', text: 'Ausnahme' }),
        el('div', { class: 'block__werkzeug' }, [
          el('button', {
            type: 'button',
            title: 'Entfernen',
            text: '×',
            onclick: () => {
              ausnahmen.splice(index, 1);
              geaendert(true);
            },
          }),
        ]),
      ]),
      el('label', { class: 'feld' }, [el('span', { class: 'feld__name', text: 'Datum' }), datum]),
      textfeld('Grund', a.grund ?? '', (w) => (a.grund = w), 'Feiertag, Betriebsferien …'),
      el('p', { class: 'whinweis', text: 'Ohne Zeiten gilt der Tag als ganztags geschlossen.' }),
    ]);
  });

  const aktionen = entwurf.bloecke.filter((b): b is Aktionsblock => b.art === 'aktion');
  const wahl = [{ wert: '', name: '— erste aktive Aktion —' }, ...aktionen.map((b) => ({ wert: b.id, name: b.beschriftung }))];

  tafel.replaceChildren(
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Öffnungszeiten' }),
      textfeld('Zeitzone', plan.zeitzone, (w) => (plan.zeitzone = w), 'Europe/Berlin'),
      el('p', {
        class: 'whinweis',
        text: 'Alles gilt in der Zeitzone des Betriebs, nicht in der des Besuchers. Wer in Hannover um 17 Uhr schließt, schließt auch für jemanden in Singapur um 17 Uhr.',
      }),
      el('div', { class: 'tage' }, tage),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Hauptaktion' }),
      el('p', { class: 'whinweis', text: 'Welche eine Schaltfläche jeweils oben steht.' }),
      auswahlfeld('Während der Zeiten', entwurf.hauptaktion?.offen ?? '', wahl, (w) => {
        entwurf.hauptaktion = { ...entwurf.hauptaktion, offen: w || undefined };
      }),
      auswahlfeld('Außerhalb', entwurf.hauptaktion?.zu ?? '', wahl, (w) => {
        entwurf.hauptaktion = { ...entwurf.hauptaktion, zu: w || undefined };
      }),
      textfeld('Zusage außerhalb', plan.zusage ?? '', (w) => (plan.zusage = w), 'Antwort am nächsten Werktag'),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Ausnahmen' }),
      el('div', { class: 'blockliste' }, ausnahmeliste),
      el('div', { class: 'zufuegen' }, [
        el('button', {
          type: 'button',
          text: '+ Feiertag oder Sondertag',
          onclick: () => {
            ausnahmen.push({ datum: new Date().toISOString().slice(0, 10), grund: '' });
            geaendert(true);
          },
        }),
      ]),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('div', { class: 'zufuegen' }, [
        el('button', {
          type: 'button',
          text: 'Öffnungszeiten ganz weglassen',
          onclick: () => {
            delete entwurf.erreichbarkeit;
            if (entwurf.hauptaktion) delete entwurf.hauptaktion.zu;
            geaendert(true);
          },
        }),
      ]),
    ]),
  );
}

/* ------------------------------------------------------------------ *
 * Tafel: Gestaltung
 * ------------------------------------------------------------------ */

function farbzeile(name: string, feld: keyof Gestaltung, loeschbar = false): HTMLElement {
  const wert = String(entwurf.gestaltung[feld] ?? '');
  const farbe = el('input', { type: 'color', value: wert || '#000000' });
  const hex = el('input', { type: 'text', class: 'feld__hex', value: wert, spellcheck: 'false' });

  const setze = (neu: string) => {
    Object.assign(entwurf.gestaltung, { [feld]: neu });
    geaendert();
  };

  farbe.addEventListener('input', () => {
    hex.value = farbe.value;
    setze(farbe.value);
  });
  hex.addEventListener('input', () => {
    // Unfertige Eingaben werden übergangen, statt die Vorschau zu zerlegen.
    if (!istFarbe(hex.value)) return;
    farbe.value = hex.value;
    setze(hex.value);
  });

  const kinder: (Node | string)[] = [farbe, hex];
  if (loeschbar) {
    kinder.push(
      el('button', {
        type: 'button',
        class: 'feld__weg',
        title: 'Verlauf abschalten',
        text: '×',
        onclick: () => {
          setze('');
          zeichneGestaltung();
        },
      }),
    );
  }

  return el('label', { class: 'feld' }, [
    el('span', { class: 'feld__name', text: name }),
    el('span', { class: 'feld__eingabe' }, kinder),
  ]);
}

function reglerzeile(name: string, wert: number, min: number, max: number, einheit: string, beiAenderung: (w: number) => void): HTMLElement {
  const anzeige = el('b', { text: `${wert}${einheit}` });
  const regler = el('input', { type: 'range', min: String(min), max: String(max), step: '1', value: String(wert) });
  regler.addEventListener('input', () => {
    anzeige.textContent = `${regler.value}${einheit}`;
    beiAenderung(Number(regler.value));
    geaendert();
  });
  return el('label', { class: 'feld' }, [
    el('span', { class: 'feld__name' }, [name + ' ', anzeige]),
    regler,
  ]);
}

function knopfgruppe(name: string, feld: keyof Gestaltung, moeglichkeiten: { wert: string; name: string }[]): HTMLElement {
  const knoepfe = moeglichkeiten.map((m) =>
    el('button', {
      type: 'button',
      'aria-pressed': String(entwurf.gestaltung[feld] === m.wert),
      text: m.name,
      onclick: () => {
        Object.assign(entwurf.gestaltung, { [feld]: m.wert });
        geaendert(true);
      },
    }),
  );
  return el('div', { class: 'feld' }, [
    el('span', { class: 'feld__name', text: name }),
    el('div', { class: 'schalter', role: 'group' }, knoepfe),
  ]);
}

function zeichneGestaltung() {
  const tafel = frage('#tafel-design');
  const g = entwurf.gestaltung;

  const vorlagen = VORLAGEN.map((v) =>
    el(
      'button',
      {
        type: 'button',
        class: 'vorlagenknopf',
        'aria-pressed': String(g.vorlage === v.vorlage),
        style: `--v-grund:${v.grund2 ? `linear-gradient(140deg,${v.grund},${v.grund2})` : v.grund};--v-akzent:${v.akzent}`,
        onclick: () => {
          entwurf.gestaltung = { ...vorlage(v.vorlage) };
          geaendert(true);
        },
      },
      [el('span', { class: 'vorlagenknopf__probe' }, [el('span', { class: 'vorlagenknopf__punkt' })]), vorlagenName(v.vorlage)],
    ),
  );

  tafel.replaceChildren(
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Vorlage' }),
      el('p', { class: 'whinweis', text: 'Ein Anfang. Danach ist alles frei.' }),
      el('div', { class: 'vorlagen', role: 'group' }, vorlagen),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Aufbau' }),
      knopfgruppe('Anordnung', 'aufbau', AUFBAUTEN.map((a) => ({ wert: a.kennung, name: a.name }))),
      el('p', { class: 'whinweis', text: AUFBAUTEN.find((a) => a.kennung === g.aufbau)?.beschreibung ?? '' }),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Farben' }),
      farbzeile('Grundfarbe', 'grund'),
      farbzeile('Zweite Farbe', 'grund2', true),
      farbzeile('Textfarbe', 'vordergrund'),
      farbzeile('Akzent', 'akzent'),
      farbzeile('Schrift auf Akzent', 'akzentText'),
      reglerzeile('Winkel des Verlaufs', g.winkel, 0, 359, '°', (w) => (g.winkel = w)),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Schrift' }),
      auswahlfeld('Überschriften', g.anzeige, SCHRIFTEN.map((s) => ({ wert: s.id, name: s.name })), (w) => (g.anzeige = w)),
      auswahlfeld('Fließtext', g.schrift, FLIESSTEXTSCHRIFTEN.map((s) => ({ wert: s.id, name: s.name })), (w) => (g.schrift = w)),
      el('p', {
        class: 'whinweis',
        text: 'Anton, Bebas Neue und Clash Display stehen beim Fließtext nicht zur Wahl — als Grundschrift sind sie unlesbar.',
      }),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Form' }),
      reglerzeile('Eckenradius', Math.min(g.radius, 40), 0, 40, ' px', (w) => (g.radius = w)),
      knopfgruppe('Schaltflächen', 'schaltflaeche', [
        { wert: 'gefuellt', name: 'Gefüllt' },
        { wert: 'kontur', name: 'Kontur' },
        { wert: 'glas', name: 'Glas' },
      ]),
      knopfgruppe('Profilbild', 'bildform', [
        { wert: 'rund', name: 'Rund' },
        { wert: 'karte', name: 'Karte' },
      ]),
    ]),
    el('div', { class: 'feldgruppe' }, [
      el('h2', { class: 'wmarke2', text: 'Hintergrundbild' }),
      textfeld('Adresse des Bildes', g.bild, (w) => (g.bild = w.trim()), '/bilder/… oder https://…'),
      reglerzeile('Schleier', Math.round(g.schleier * 100), 0, 100, ' %', (w) => (g.schleier = w / 100)),
      el('p', {
        class: 'whinweis',
        text: 'Über einem Foto ist kein Kontrast berechenbar — heller Himmel und dunkler Baum liegen in derselben Fläche. Der Schleier aus der Grundfarbe macht die Rechnung erst gültig.',
      }),
    ]),
  );
}

/* ------------------------------------------------------------------ *
 * Tafel: Fertig
 * ------------------------------------------------------------------ */

async function vorschauLinkKopieren(knopf: HTMLElement) {
  const gepackt = await packe(entwurf);
  const adresse = new URL(`/werkstatt/vorschau?p=${gepackt}`, location.origin).toString();
  try {
    await navigator.clipboard.writeText(adresse);
    const vorher = knopf.textContent;
    knopf.textContent = 'Link kopiert';
    setTimeout(() => (knopf.textContent = vorher), 1800);
  } catch {
    /* Abbruch ist kein Fehler. */
  }
}

/**
 * Abgeben — ein Klick von der Werkstatt in unser Postfach.
 *
 * Wortlaut und Längengrenze stehen in `kern/abgabe.ts`; hier bleibt nur, was
 * den Browser braucht: prüfen, packen, notfalls ausweichen, Mail öffnen.
 */
async function abgeben(knopf: HTMLElement) {
  const ergebnis = lieseProfil(entwurf);
  if (!ergebnis.ok) {
    zeigeReiter('fertig');
    alert(
      `Der Entwurf ist noch unvollständig — abgeben lohnt sich erst, wenn das hier erledigt ist:\n\n${ergebnis.fehler
        .map((f) => `${f.stelle || 'Profil'}: ${f.meldung}`)
        .join('\n')}`,
    );
    return;
  }

  const link = new URL(`/werkstatt/vorschau?p=${await packe(entwurf)}`, location.origin).toString();

  let weg: Beilage = 'link';
  if (!linkPasst(entwurf, link)) {
    // Der Link ist zu lang für die Adresszeile. Nicht kürzen — ausweichen.
    try {
      await navigator.clipboard.writeText(link);
      weg = 'ablage';
    } catch {
      herunterladen();
      weg = 'datei';
    }
  }

  location.href = abgabeAdresse(entwurf, weg, link);

  const inhalt = knopf.querySelector('span')!;
  const vorher = inhalt.textContent;
  inhalt.textContent =
    weg === 'link'
      ? 'Mail geöffnet'
      : weg === 'ablage'
        ? 'Link kopiert, Mail geöffnet'
        : 'Datei gesichert, Mail geöffnet';
  setTimeout(() => (inhalt.textContent = vorher), 2600);
}

function herunterladen() {
  const inhalt = frage('#ausgabe').textContent ?? '';
  const url = URL.createObjectURL(new Blob([inhalt], { type: 'application/json' }));
  const a = el('a', { href: url, download: `${entwurf.slug || 'profil'}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 400);
}

function verdrahteFertig() {
  frage('#kopieren').addEventListener('click', async (e) => {
    const knopf = e.currentTarget as HTMLElement;
    const text = frage('#ausgabe').textContent ?? '';
    try {
      await navigator.clipboard.writeText(text);
      const inhalt = knopf.querySelector('span')!;
      const vorher = inhalt.textContent;
      inhalt.textContent = 'Kopiert';
      setTimeout(() => (inhalt.textContent = vorher), 1800);
    } catch {
      /* Abbruch ist kein Fehler. */
    }
  });

  frage('#abgeben').addEventListener('click', (e) => void abgeben(e.currentTarget as HTMLElement));
  frage('#herunterladen').addEventListener('click', herunterladen);
  frage('#linkkopieren').addEventListener('click', (e) => void vorschauLinkKopieren(e.currentTarget as HTMLElement));

  frage<HTMLInputElement>('#einlesen').addEventListener('change', async (e) => {
    const datei = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!datei) return;
    try {
      const ergebnis = lieseProfil(JSON.parse(await datei.text()));
      if (!ergebnis.ok) {
        alert(`Die Datei ist unvollständig:\n\n${ergebnis.fehler.map((f) => `${f.stelle}: ${f.meldung}`).join('\n')}`);
        return;
      }
      entwurf = ergebnis.profil;
      letzterInhalt = '';
      geaendert(true);
    } catch {
      alert('Das ist keine gültige JSON-Datei.');
    }
  });

  frage('#neuanfangen').addEventListener('click', () => {
    if (!confirm('Den Entwurf verwerfen und neu anfangen?')) return;
    entwurf = musterprofil();
    letzterInhalt = '';
    geaendert(true);
  });
}

/* ------------------------------------------------------------------ *
 * Reiter
 * ------------------------------------------------------------------ */

function zeigeReiter(name: string) {
  reiter = name;
  for (const knopf of document.querySelectorAll<HTMLButtonElement>('[data-reiter]')) {
    knopf.setAttribute('aria-selected', String(knopf.dataset.reiter === name));
  }
  for (const tafel of document.querySelectorAll<HTMLElement>('.tafel')) {
    tafel.hidden = tafel.id !== `tafel-${name}`;
  }
}

function zeichneAlles() {
  zeichneInhalt();
  zeichneBloecke();
  zeichneKontakt();
  zeichneZeiten();
  zeichneGestaltung();
  befundeZeichnen();
  zeigeReiter(reiter);
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

async function starten() {
  const ausAdresse = new URLSearchParams(location.search).get('p');
  if (ausAdresse) {
    const roh = await entpacke(ausAdresse);
    const ergebnis = roh ? lieseProfil(roh) : null;
    if (ergebnis?.ok) entwurf = ergebnis.profil;
    // Der Entwurf steckt jetzt im Editor; die lange Adresse hat ausgedient.
    history.replaceState(null, '', location.pathname);
  } else {
    entwurf = laden() ?? musterprofil();
  }

  for (const knopf of document.querySelectorAll<HTMLButtonElement>('[data-reiter]')) {
    knopf.addEventListener('click', () => zeigeReiter(knopf.dataset.reiter!));
  }

  verdrahteFertig();
  zeichneAlles();
  rahmen.addEventListener('load', gestaltungAnwenden);
  await vorschauNeuLaden();
  letzterInhalt = inhaltsAbdruck(entwurf);
}

void starten();
