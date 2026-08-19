/**
 * Booth-Editor — die Druckvorlagen der Box entwerfen.
 *
 * Die Vorschau ist kein Bild von etwas Ähnlichem: gezeichnet wird mit
 * demselben Renderer, der später druckt (`vorlage.ts`). Was hier steht, kommt
 * so aus dem Drucker.
 *
 * Zwei Regeln stecken fest darin:
 *  1. Mitgelieferte Vorlagen bleiben, wie sie sind — die erste Änderung legt
 *     eine Kopie an. Der Weg zurück ist damit immer offen.
 *  2. Eine Vorlage ohne Bildfeld kann keine Aufnahme zeigen; der Editor lässt
 *     das letzte Bildfeld deshalb nicht löschen.
 */

import './stil.css';
import './editor.css';
import { holeEinstellungen, ladeEinstellungen } from './einstellungen';
import { amDraht } from './draht';
import { verlangeAnmeldung } from './anmeldung';
import { Kamera } from './kamera';
import { alsBilddaten } from './layout';
import { drucke, qrBild } from './ausgabe';
import {
  PLATZHALTER,
  klemme,
  neueFeldKennung,
  pruefeVorlage,
  zeichneVorlage,
  ladeZubehoer,
  LEERES_ZUBEHOER,
  type Ausrichtung,
  type Feld,
  type Feldart,
  type Vorlage,
  type Werte,
  type Zubehoer,
} from './vorlage';
import {
  FORMATE,
  FORMATLISTE,
  SCHRIFTNAMEN,
  formatVon,
  type Formatschluessel,
  type Schriftart,
} from './formate';
import {
  alleVorlagen,
  eingestellt,
  istMitgeliefert,
  kopiere,
  ladeVorlagen,
  loescheVorlage,
  neueVorlagenKennung,
  sichereVorlage,
  stelleEin,
} from './vorlagen';
import { farbe, schrift } from './farben';

/* --- Bausteine ------------------------------------------------------ */

function el<T extends HTMLElement>(id: string): T {
  const knoten = document.getElementById(id);
  if (!knoten) throw new Error(`Element #${id} fehlt`);
  return knoten as T;
}

function knopf(text: string, klasse: string): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = klasse;
  k.textContent = text;
  return k;
}

function feldblock(beschriftung: string, eingabe: HTMLElement): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'vfeld';
  const span = document.createElement('span');
  span.textContent = beschriftung;
  label.append(span, eingabe);
  return label;
}

function zahleneingabe(
  wert: number,
  schritt: number,
  bei: (n: number) => void,
  min = 0,
  max = 100
): HTMLInputElement {
  const e = document.createElement('input');
  e.type = 'number';
  e.className = 'veingabe';
  e.value = String(Math.round(wert * 100) / 100);
  e.step = String(schritt);
  e.min = String(min);
  e.max = String(max);
  e.addEventListener('input', () => {
    const n = Number(e.value);
    if (Number.isFinite(n)) bei(n);
  });
  return e;
}

function auswahl<T extends string>(
  werte: { wert: T; text: string }[],
  aktiv: T,
  bei: (w: T) => void
): HTMLSelectElement {
  const s = document.createElement('select');
  s.className = 'veingabe';
  werte.forEach((w) => {
    const o = document.createElement('option');
    o.value = w.wert;
    o.textContent = w.text;
    if (w.wert === aktiv) o.selected = true;
    s.append(o);
  });
  s.addEventListener('change', () => bei(s.value as T));
  return s;
}

/* --- Musterbilder --------------------------------------------------- */

/**
 * Testbilder für die Vorschau. Drei unterscheidbare Kacheln, damit man in
 * einem Streifen sieht, welches Bildfeld welche Aufnahme bekommt.
 */
function testbilder(): HTMLCanvasElement[] {
  const toene = [
    ['#2b3a55', '#7b8ba6'],
    ['#5a3b2e', '#c08a5e'],
    ['#2f4f3a', '#7fae8c'],
    ['#4a2f52', '#a07eae'],
  ];
  return toene.map(([dunkel, hell], i) => {
    const f = document.createElement('canvas');
    f.width = 1280;
    f.height = 960;
    const s = f.getContext('2d')!;
    const verlauf = s.createLinearGradient(0, 0, f.width, f.height);
    verlauf.addColorStop(0, dunkel!);
    verlauf.addColorStop(1, hell!);
    s.fillStyle = verlauf;
    s.fillRect(0, 0, f.width, f.height);

    // Ein grober Kopf-und-Schultern-Umriss: zeigt, wo im Feld der Anschnitt sitzt.
    s.fillStyle = 'rgba(255,255,255,0.22)';
    s.beginPath();
    s.arc(f.width / 2, f.height * 0.42, f.height * 0.17, 0, Math.PI * 2);
    s.fill();
    s.beginPath();
    s.ellipse(f.width / 2, f.height * 1.05, f.height * 0.42, f.height * 0.42, 0, Math.PI, 0);
    s.fill();

    s.fillStyle = 'rgba(255,255,255,0.85)';
    s.font = schrift(44, 600);
    s.textAlign = 'center';
    s.fillText(`TESTBILD ${i + 1}`, f.width / 2, f.height - 48);
    return f;
  });
}

/* --- Zustand -------------------------------------------------------- */

/* Die Liste liegt auf der Box. Hier steht nur, woran gerade gearbeitet wird —
   und ob es schon dort angekommen ist. */
let aktuell: Vorlage = alleVorlagen()[0]!;
let gewaehlt: string | null = null;
let muster = testbilder();
let zubehoer: Zubehoer = LEERES_ZUBEHOER;
let ungesichert = false;

let einstellungen = ladeEinstellungen();

const leinwand = el<HTMLCanvasElement>('leinwand');
const blatt = el<HTMLDivElement>('blatt');
const felderSchicht = el<HTMLDivElement>('felder');
const meldungsfeld = el<HTMLParagraphElement>('meldung');

function musterwerte(): Werte {
  const jetzt = new Date();
  return {
    event: einstellungen.event,
    box: einstellungen.box,
    datum: jetzt.toLocaleDateString('de-DE'),
    zeit: jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    nummer: '128',
  };
}

function sage(text: string, art: 'still' | 'gut' | 'fehler' = 'still'): void {
  meldungsfeld.textContent = text;
  meldungsfeld.dataset.art = art;
}

/* --- Bearbeiten ----------------------------------------------------- */

/**
 * Jede Änderung geht hierdurch. Ist die Vorlage mitgeliefert, entsteht zuerst
 * eine Kopie — das Original bleibt unangetastet.
 *
 * `teile` grenzt ein, was danach neu aufgebaut wird. Wer gerade in einem
 * Zahlenfeld tippt, darf das Feld nicht unter den Fingern verlieren; deshalb
 * baut der Prüfer sich nicht bei jedem Tastendruck neu auf.
 */
function aendere(tue: (v: Vorlage) => void, teile: Wunsch = {}): void {
  let kopiert = false;
  if (istMitgeliefert(aktuell.id)) {
    aktuell = kopiere(aktuell, `${aktuell.name} (eigene)`);
    kopiert = true;
    sage(
      'Mitgelieferte Vorlagen bleiben unverändert — die Änderung liegt jetzt in einer Kopie. ' +
        '„Sichern" legt sie auf der Box ab.'
    );
  }
  tue(aktuell);
  ungesichert = true;
  // Entsteht eine Kopie, wechselt die Vorlage ihre Identität: Name, Herkunft
  // und Auswahlliste stimmen dann nicht mehr. Der Kopf muss mit, auch wenn
  // der Aufrufer ihn ausgenommen hat.
  zeichneAlles(kopiert ? {} : teile);
}

/**
 * Legt die bearbeitete Vorlage auf der Box ab. Die Box prüft sie noch einmal
 * und antwortet mit dem Stand, der danach gilt — deshalb wird ihre Antwort
 * übernommen, statt der eigenen Fassung zu glauben.
 */
async function sichereAlles(): Promise<boolean> {
  try {
    const abgelegt = await sichereVorlage(aktuell);
    aktuell = abgelegt;
    ungesichert = false;
    zeichneAlles();
    return true;
  } catch (fehler) {
    sage('Die Box hat die Vorlage nicht angenommen: ' + String(fehler).replace('Error: ', ''), 'fehler');
    return false;
  }
}

/* --- Zeichnen ------------------------------------------------------- */

/** Welche Teile der Oberfläche neu gebaut werden. Ohne Angabe: alle. */
type Wunsch = { rahmen?: boolean; liste?: boolean; pruefer?: boolean; kopf?: boolean };

function zeichneAlles(teile: Wunsch = {}): void {
  const w = { rahmen: true, liste: true, pruefer: true, kopf: true, ...teile };
  zeichneBlatt();
  if (w.rahmen) baueRahmen();
  if (w.liste) baueListe();
  if (w.pruefer) bauePruefer();
  if (w.kopf) baueKopf();
}

function zeichneBlatt(): void {
  const bild = zeichneVorlage(aktuell, muster, musterwerte(), zubehoer);
  leinwand.width = bild.width;
  leinwand.height = bild.height;
  leinwand.getContext('2d')!.drawImage(bild, 0, 0);
  blatt.style.aspectRatio = `${bild.width} / ${bild.height}`;
  const f = formatVon(aktuell.format);
  el<HTMLSpanElement>('blattmass').textContent =
    `${f.name} · ${f.kurz} · ${bild.width} × ${bild.height} px bei 300 dpi`;
}

function baueRahmen(): void {
  felderSchicht.replaceChildren();
  aktuell.felder.forEach((f) => {
    const rahmen = document.createElement('button');
    rahmen.type = 'button';
    rahmen.className = 'vfeld-rahmen';
    rahmen.dataset.art = f.art;
    rahmen.dataset.feld = f.id;
    rahmen.setAttribute('aria-pressed', String(f.id === gewaehlt));
    rahmen.setAttribute('aria-label', `${beschriftung(f)} bearbeiten`);
    setzeRahmen(rahmen, f);

    const griff = document.createElement('span');
    griff.className = 'vgriff';
    griff.dataset.griff = 'groesse';
    rahmen.append(griff);

    rahmen.addEventListener('pointerdown', (e) => beginneZug(e, f, rahmen));
    rahmen.addEventListener('keydown', (e) => schiebePerTaste(e, f));
    felderSchicht.append(rahmen);
  });
}

function setzeRahmen(rahmen: HTMLElement, f: Feld): void {
  rahmen.style.left = `${f.x * 100}%`;
  rahmen.style.top = `${f.y * 100}%`;
  rahmen.style.width = `${f.b * 100}%`;
  rahmen.style.height = `${f.h * 100}%`;
}

function beschriftung(f: Feld): string {
  if (f.art === 'text') return `Text „${(f.text ?? '').slice(0, 24)}"`;
  if (f.art === 'bild') return 'Bildfeld';
  if (f.art === 'logo') return 'Logo';
  if (f.art === 'bilddatei') return `Bilddatei ${(f.quelle ?? '').split('/').pop() ?? ''}`;
  if (f.art === 'qr') return 'QR-Code';
  return f.figur === 'ellipse' ? 'Ellipse' : f.figur === 'linie' ? 'Linie' : 'Fläche';
}

/* --- Ziehen und Schieben -------------------------------------------- */

function beginneZug(e: PointerEvent, f: Feld, rahmen: HTMLElement): void {
  e.preventDefault();
  // Ohne Neuaufbau der Rahmen: der gezogene Rahmen muss der bleiben, der er ist.
  gewaehlt = f.id;
  felderSchicht.querySelectorAll<HTMLElement>('[data-feld]').forEach((r) => {
    r.setAttribute('aria-pressed', String(r.dataset.feld === f.id));
  });
  zeichneAlles({ rahmen: false });
  rahmen.focus();

  const griff = (e.target as HTMLElement).dataset.griff === 'groesse';
  const kasten = blatt.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;
  const anfang = { x: f.x, y: f.y, b: f.b, h: f.h };
  const ziel = aktuell.felder.find((g) => g.id === f.id);
  if (!ziel) return;

  const raster = (wert: number, aus: boolean) => (aus ? wert : Math.round(wert * 200) / 200);
  let bewegt = false;

  const bewege = (z: PointerEvent) => {
    bewegt = true;
    const dx = (z.clientX - startX) / kasten.width;
    const dy = (z.clientY - startY) / kasten.height;
    const ohneRaster = z.altKey;

    if (griff) {
      ziel.b = klemme(raster(anfang.b + dx, ohneRaster), 0.02);
      ziel.h = klemme(raster(anfang.h + dy, ohneRaster), 0.01);
    } else {
      ziel.x = klemme(raster(anfang.x + dx, ohneRaster));
      ziel.y = klemme(raster(anfang.y + dy, ohneRaster));
    }
    setzeRahmen(rahmen, ziel);
    zeichneBlatt();
  };

  const ende = () => {
    window.removeEventListener('pointermove', bewege);
    window.removeEventListener('pointerup', ende);
    // Ein Klick ohne Zug wählt nur aus — er darf aus einer mitgelieferten
    // Vorlage keine Kopie machen.
    if (!bewegt) return;
    // Erst am Ende des Zugs entsteht die Kopie — sonst bei jedem Pixel eine.
    if (istMitgeliefert(aktuell.id)) {
      const gemerkt = { ...ziel };
      aendere((v) => {
        const neu = v.felder.find((g) => g.id === f.id);
        if (neu) Object.assign(neu, gemerkt);
      });
    } else {
      ungesichert = true;
      zeichneAlles({ rahmen: false });
    }
  };

  window.addEventListener('pointermove', bewege);
  window.addEventListener('pointerup', ende);
}

function schiebePerTaste(e: KeyboardEvent, f: Feld): void {
  const richtungen: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  const richtung = richtungen[e.key];
  if (!richtung) return;
  e.preventDefault();
  const schritt = e.shiftKey ? 0.02 : 0.002;
  aendere((v) => {
    const ziel = v.felder.find((g) => g.id === f.id);
    if (!ziel) return;
    ziel.x = klemme(ziel.x + richtung[0] * schritt);
    ziel.y = klemme(ziel.y + richtung[1] * schritt);
  });
  // Nach dem Neuaufbau denselben Rahmen wieder greifen.
  felderSchicht.querySelector<HTMLElement>(`[data-feld="${f.id}"]`)?.focus();
}

function waehle(id: string | null): void {
  gewaehlt = id;
  zeichneAlles();
}

/* --- Liste und Prüfer ----------------------------------------------- */

function baueListe(): void {
  const liste = el<HTMLUListElement>('liste');
  liste.replaceChildren();

  aktuell.felder.forEach((f, i) => {
    const zeile = document.createElement('li');

    const eintrag = knopf(beschriftung(f), 'vlisteneintrag');
    eintrag.setAttribute('aria-pressed', String(f.id === gewaehlt));
    eintrag.addEventListener('click', () => waehle(f.id));

    const hoch = knopf('↑', 'vmini');
    hoch.title = 'weiter nach hinten';
    hoch.disabled = i === 0;
    hoch.addEventListener('click', () => tausche(i, i - 1));

    const runter = knopf('↓', 'vmini');
    runter.title = 'weiter nach vorn';
    runter.disabled = i === aktuell.felder.length - 1;
    runter.addEventListener('click', () => tausche(i, i + 1));

    const weg = knopf('×', 'vmini');
    weg.title = 'Feld löschen';
    weg.addEventListener('click', () => loescheFeld(f.id));

    zeile.append(eintrag, hoch, runter, weg);
    liste.append(zeile);
  });
}

function tausche(a: number, b: number): void {
  aendere((v) => {
    const hilf = v.felder[a]!;
    v.felder[a] = v.felder[b]!;
    v.felder[b] = hilf;
  });
}

function loescheFeld(id: string): void {
  const feld = aktuell.felder.find((f) => f.id === id);
  if (!feld) return;
  if (feld.art === 'bild' && aktuell.felder.filter((f) => f.art === 'bild').length === 1) {
    sage('Das letzte Bildfeld bleibt — ohne Bildfeld zeigt die Vorlage keine Aufnahme.', 'fehler');
    return;
  }
  aendere((v) => {
    v.felder = v.felder.filter((f) => f.id !== id);
  });
  if (gewaehlt === id) gewaehlt = null;
}

function neuesFeld(art: Feldart): void {
  const feld: Feld = {
    id: neueFeldKennung(),
    art,
    x: 0.1,
    y: 0.1,
    b: 0.8,
    h: art === 'text' ? 0.05 : 0.25,
  };
  if (art === 'text') {
    feld.text = '{event}';
    feld.groesse = 40;
    feld.gewicht = 700;
    feld.schrift = 'anzeige';
    feld.ausrichtung = 'mitte';
    feld.farbe = farbe('--ink-soft');
  }
  if (art === 'flaeche') {
    feld.farbe = farbe('--amber');
    feld.figur = 'rechteck';
  }
  if (art === 'qr') {
    feld.quelle = '{event}';
    feld.b = 0.2;
    feld.h = 0.2 * (formatVon(aktuell.format).breite / formatVon(aktuell.format).hoehe);
  }
  aendere((v) => {
    v.felder.push(feld);
  });
  waehle(feld.id);
}

/* Die Farbwahl im Editor bietet die Hausfarben an — sie stehen in
   `gestaltung/tokens.css` und werden von dort gelesen. Abgeschrieben wären
   sie beim nächsten Wechsel der Marke die einzigen, die alt bleiben. */
const FARBEN = [
  farbe('--ink-soft'),
  farbe('--weiss'),
  farbe('--amber'),
  farbe('--ink'),
  farbe('--paper'),
  'rgba(0,0,0,0.45)',
];

function farbwahl(wert: string, bei: (w: string) => void): HTMLElement {
  const huelle = document.createElement('div');
  huelle.className = 'vfeld';

  const eingabe = document.createElement('input');
  eingabe.type = 'text';
  eingabe.className = 'veingabe';
  eingabe.value = wert;
  eingabe.addEventListener('input', () => bei(eingabe.value));

  const reihe = document.createElement('div');
  reihe.className = 'vpalettenfarben';
  FARBEN.forEach((farbe) => {
    const punkt = document.createElement('button');
    punkt.type = 'button';
    punkt.className = 'vfarbe';
    punkt.style.background = farbe;
    punkt.title = farbe;
    punkt.setAttribute('aria-label', `Farbe ${farbe}`);
    punkt.addEventListener('click', () => {
      eingabe.value = farbe;
      bei(farbe);
    });
    reihe.append(punkt);
  });

  huelle.append(eingabe, reihe);
  return huelle;
}

function bauePruefer(): void {
  const kasten = el<HTMLDivElement>('pruefer');
  kasten.replaceChildren();

  const feld = aktuell.felder.find((f) => f.id === gewaehlt);
  if (!feld) {
    const hinweis = document.createElement('p');
    hinweis.className = 'vleer';
    hinweis.textContent = 'Kein Feld gewählt — im Blatt oder in der Liste eines antippen.';
    kasten.append(hinweis);
    return;
  }

  const setze = (tue: (f: Feld) => void) =>
    aendere(
      (v) => {
        const ziel = v.felder.find((f) => f.id === feld.id);
        if (ziel) tue(ziel);
      },
      { pruefer: false }
    );

  // Maße in Millimetern: so steht es auf dem Papier und so redet die Druckerei.
  const mmB = formatVon(aktuell.format).mmBreite;
  const mmH = formatVon(aktuell.format).mmHoehe;

  const masse = document.createElement('div');
  masse.className = 'vvier';
  masse.append(
    feldblock(
      'Links mm',
      zahleneingabe(feld.x * mmB, 1, (n) => setze((f) => (f.x = klemme(n / mmB))), 0, mmB)
    ),
    feldblock(
      'Oben mm',
      zahleneingabe(feld.y * mmH, 1, (n) => setze((f) => (f.y = klemme(n / mmH))), 0, mmH)
    ),
    feldblock(
      'Breite mm',
      zahleneingabe(feld.b * mmB, 1, (n) => setze((f) => (f.b = klemme(n / mmB, 0.01))), 1, mmB)
    ),
    feldblock(
      'Höhe mm',
      zahleneingabe(feld.h * mmH, 1, (n) => setze((f) => (f.h = klemme(n / mmH, 0.01))), 1, mmH)
    )
  );
  kasten.append(masse);

  if (feld.art === 'text') {
    const text = document.createElement('textarea');
    text.className = 'veingabe';
    text.value = feld.text ?? '';
    text.addEventListener('input', () => setze((f) => (f.text = text.value)));
    kasten.append(feldblock('Text', text));

    kasten.append(
      feldblock(
        'Schriftgröße (px bei 300 dpi)',
        zahleneingabe(feld.groesse ?? 40, 1, (n) => setze((f) => (f.groesse = Math.max(6, n))), 6, 300)
      )
    );
    kasten.append(
      feldblock(
        'Schrift',
        auswahl<Schriftart>(
          (Object.keys(SCHRIFTNAMEN) as Schriftart[]).map((k) => ({
            wert: k,
            text: SCHRIFTNAMEN[k],
          })),
          feld.schrift ?? 'anzeige',
          (w) => setze((f) => (f.schrift = w))
        )
      )
    );
    kasten.append(
      feldblock(
        'Gewicht',
        auswahl(
          [
            { wert: '400', text: 'Normal' },
            { wert: '500', text: 'Mittel' },
            { wert: '700', text: 'Fett' },
            { wert: '800', text: 'Extrafett' },
          ],
          String(feld.gewicht ?? 700),
          (w) => setze((f) => (f.gewicht = Number(w)))
        )
      )
    );
    kasten.append(
      feldblock(
        'Ausrichtung',
        auswahl<Ausrichtung>(
          [
            { wert: 'links', text: 'Links' },
            { wert: 'mitte', text: 'Mitte' },
            { wert: 'rechts', text: 'Rechts' },
          ],
          feld.ausrichtung ?? 'mitte',
          (w) => setze((f) => (f.ausrichtung = w))
        )
      )
    );

    const versalien = document.createElement('label');
    versalien.className = 'vhaken';
    const haken = document.createElement('input');
    haken.type = 'checkbox';
    haken.checked = Boolean(feld.versalien);
    haken.addEventListener('change', () => setze((f) => (f.versalien = haken.checked)));
    versalien.append(haken, document.createTextNode(' Großbuchstaben'));
    kasten.append(versalien);

    const umbruch = document.createElement('label');
    umbruch.className = 'vhaken';
    const uhaken = document.createElement('input');
    uhaken.type = 'checkbox';
    uhaken.checked = Boolean(feld.umbruch);
    uhaken.addEventListener('change', () => setze((f) => (f.umbruch = uhaken.checked)));
    umbruch.append(uhaken, document.createTextNode(' Umbrechen statt stauchen'));
    kasten.append(umbruch);

    kasten.append(
      feldblock(
        'Farbe',
        farbwahl(feld.farbe ?? farbe('--ink-soft'), (w) => setze((f) => (f.farbe = w)))
      )
    );
  }

  if (feld.art === 'flaeche') {
    kasten.append(
      feldblock(
        'Figur',
        auswahl(
          [
            { wert: 'rechteck', text: 'Rechteck' },
            { wert: 'ellipse', text: 'Ellipse' },
            { wert: 'linie', text: 'Linie' },
          ],
          feld.figur ?? 'rechteck',
          (w) => setze((f) => (f.figur = w as 'rechteck' | 'ellipse' | 'linie'))
        )
      )
    );
    kasten.append(
      feldblock(
        'Füllung',
        farbwahl(feld.farbe ?? farbe('--amber'), (w) => setze((f) => (f.farbe = w)))
      )
    );
    kasten.append(
      feldblock(
        'Linie',
        farbwahl(feld.linie ?? 'transparent', (w) => setze((f) => (f.linie = w)))
      )
    );
    kasten.append(
      feldblock(
        'Linienstärke',
        zahleneingabe(feld.linienstaerke ?? 0, 1, (n) => setze((f) => (f.linienstaerke = n)), 0, 40)
      )
    );
  }

  if (feld.art !== 'text') {
    kasten.append(
      feldblock(
        'Ecken (px bei 300 dpi)',
        zahleneingabe(feld.radius ?? 0, 2, (n) => setze((f) => (f.radius = Math.max(0, n))), 0, 400)
      )
    );
  }

  if (feld.art === 'bild') {
    const schatten = document.createElement('label');
    schatten.className = 'vhaken';
    const shaken = document.createElement('input');
    shaken.type = 'checkbox';
    shaken.checked = Boolean(feld.schatten);
    shaken.addEventListener('change', () => setze((f) => (f.schatten = shaken.checked)));
    schatten.append(shaken, document.createTextNode(' Schatten unter dem Bild'));
    kasten.append(schatten);

    kasten.append(
      feldblock(
        'Rahmen',
        farbwahl(feld.rahmen ?? 'transparent', (w) => setze((f) => (f.rahmen = w)))
      )
    );
    kasten.append(
      feldblock(
        'Rahmenstärke',
        zahleneingabe(feld.rahmenB ?? 0, 1, (n) => setze((f) => (f.rahmenB = Math.max(0, n))), 0, 40)
      )
    );
  }

  if (feld.art === 'bilddatei' || feld.art === 'qr') {
    const quelle = document.createElement('input');
    quelle.type = 'text';
    quelle.className = 'veingabe';
    quelle.value = feld.quelle ?? '';
    quelle.placeholder = feld.art === 'qr' ? 'https://… oder {event}' : '/vorlagen/bild.png';
    quelle.addEventListener('input', () => {
      setze((f) => (f.quelle = quelle.value));
      ladeZubehoerNeu();
    });
    kasten.append(
      feldblock(feld.art === 'qr' ? 'Inhalt des QR-Codes' : 'Bildquelle', quelle)
    );
  }

  // Drehung gilt für jedes Feld — sie dreht um die eigene Mitte.
  kasten.append(
    feldblock(
      'Drehung (Grad)',
      zahleneingabe(feld.dreh ?? 0, 1, (n) => setze((f) => (f.dreh = n)), -180, 180)
    )
  );
}

/* --- Kopf und Vorlagenverwaltung ------------------------------------ */

function baueKopf(): void {
  const wahl = el<HTMLSelectElement>('wahl');
  wahl.replaceChildren();

  // Nach Herkunft gruppiert: 63 Blätter in einer flachen Liste findet niemand.
  const gruppen: { name: string; liste: Vorlage[] }[] = [
    { name: 'Eigene Gestaltung', liste: alleVorlagen().filter((v) => istMitgeliefert(v.id) && !v.hintergrund) },
    { name: 'Katalog', liste: alleVorlagen().filter((v) => istMitgeliefert(v.id) && v.hintergrund) },
    { name: 'Auf dieser Box', liste: standardsUndEigene().filter((v) => !istMitgeliefert(v.id)) },
  ];
  gruppen.forEach((g) => {
    if (!g.liste.length) return;
    const topf = document.createElement('optgroup');
    topf.label = `${g.name} (${g.liste.length})`;
    g.liste.forEach((v) => {
      const o = document.createElement('option');
      o.value = v.id;
      o.textContent = `${v.name} · ${formatVon(v.format).kurz}`;
      if (v.id === aktuell.id) o.selected = true;
      topf.append(o);
    });
    wahl.append(topf);
  });

  // Die sieben Papierformate stehen einmal in `formate.ts` — nicht im HTML.
  const formatwahl = el<HTMLSelectElement>('blattart');
  if (formatwahl.options.length !== FORMATLISTE.length) {
    formatwahl.replaceChildren();
    FORMATLISTE.forEach((k) => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = `${FORMATE[k].name} · ${FORMATE[k].kurz}`;
      formatwahl.append(o);
    });
  }

  el<HTMLSpanElement>('herkunft').textContent = istMitgeliefert(aktuell.id)
    ? 'mitgeliefert · schreibgeschützt'
    : ungesichert
      ? 'eigene Vorlage · nicht gesichert'
      : 'eigene Vorlage';

  // Nur schreiben, wenn sich etwas geändert hat — sonst springt beim Tippen
  // der Schreibzeiger ans Ende.
  const namensfeld = el<HTMLInputElement>('name');
  if (namensfeld.value !== aktuell.name) namensfeld.value = aktuell.name;
  const papierfeld = el<HTMLInputElement>('papier');
  if (papierfeld.value !== aktuell.papier) papierfeld.value = aktuell.papier;
  const tintenfeld = el<HTMLInputElement>('tinte');
  if (tintenfeld.value !== aktuell.tinte) tintenfeld.value = aktuell.tinte;
  el<HTMLSelectElement>('blattart').value = aktuell.format;
  el<HTMLSpanElement>('logostand').textContent = aktuell.logo
    ? `Logo gesetzt · ${Math.round(aktuell.logo.length / 1024)} kB`
    : 'kein Logo';

  const fotoHaken = el<HTMLInputElement>('standard-foto');
  const streifenHaken = el<HTMLInputElement>('standard-streifen');
  fotoHaken.checked = eingestellt().foto === aktuell.id;
  streifenHaken.checked = eingestellt().streifen === aktuell.id;
  fotoHaken.disabled = aktuell.art !== 'foto';
  streifenHaken.disabled = aktuell.art !== 'streifen';
}

/**
 * Alles, was zur Auswahl steht — plus die Vorlage in Arbeit, falls sie noch
 * nicht auf der Box liegt. Sonst verschwände sie beim ersten Neuzeichnen aus
 * ihrer eigenen Auswahlliste.
 */
function standardsUndEigene(): Vorlage[] {
  const liste = alleVorlagen();
  return liste.some((v) => v.id === aktuell.id) ? liste : [...liste, aktuell];
}

function waehleVorlage(id: string): void {
  const treffer = standardsUndEigene().find((v) => v.id === id);
  if (!treffer) return;
  aktuell = treffer;
  gewaehlt = null;
  ladeZubehoerNeu();
  zeichneAlles();
}

/**
 * Hintergrund, Logo, eingefügte Bilder, QR-Codes und Schriften der aktuellen
 * Vorlage laden. Danach einmal neu zeichnen — vorher wäre das Blatt halb.
 */
let ladelauf = 0;
function ladeZubehoerNeu(): void {
  const lauf = ++ladelauf;
  zubehoer = LEERES_ZUBEHOER;
  void ladeZubehoer(aktuell, musterwerte(), qrBild, einstellungen.logo)
    .then((z) => {
      // Ein älterer Lauf darf einen neueren nicht überschreiben: Wer schnell
      // durch die Vorlagen blättert, sähe sonst den Hintergrund von vorhin.
      if (lauf !== ladelauf) return;
      zubehoer = z;
      zeichneAlles();
    })
    .catch(() => {
      if (lauf === ladelauf) sage('Zubehör der Vorlage ließ sich nicht laden.', 'fehler');
    });
}

/* --- Werkzeuge im Kopf ---------------------------------------------- */

function neueVorlage(): void {
  const vorlage: Vorlage = {
    id: neueVorlagenKennung(),
    name: 'Neue Vorlage',
    format: 'hoch-4x6',
    art: 'foto',
    aufnahmen: 1,
    papier: '#ffffff',
    tinte: farbe('--ink-soft'),
    akzent: farbe('--amber'),
    felder: [
      { id: neueFeldKennung(), art: 'bild', x: 0.05, y: 0.05, b: 0.9, h: 0.6 },
      {
        id: neueFeldKennung(),
        art: 'text',
        x: 0.08,
        y: 0.7,
        b: 0.84,
        h: 0.06,
        text: '{event}',
        groesse: 46,
        gewicht: 800,
        schrift: 'anzeige',
        ausrichtung: 'mitte',
        farbe: farbe('--ink-soft'),
      },
    ],
  };
  aktuell = vorlage;
  gewaehlt = null;
  ungesichert = true;
  ladeZubehoerNeu();
  zeichneAlles();
  sage('Neue Vorlage angelegt. „Sichern" legt sie dauerhaft ab.');
}

function kopiereAktuelle(): void {
  aktuell = kopiere(aktuell, `${aktuell.name} (Kopie)`);
  ungesichert = true;
  zeichneAlles();
  sage('Kopie angelegt.');
}

async function loescheAktuelle(): Promise<void> {
  if (istMitgeliefert(aktuell.id)) {
    sage('Mitgelieferte Vorlagen lassen sich nicht löschen.', 'fehler');
    return;
  }
  const name = aktuell.name;
  try {
    await loescheVorlage(aktuell.id);
  } catch (fehler) {
    // Die Box lässt die eingestellte Vorlage nicht löschen — mit gutem Grund:
    // Sonst stünde der Booth ohne Blatt da.
    return sage(String(fehler).replace('Error: ', ''), 'fehler');
  }
  aktuell = alleVorlagen()[0]!;
  gewaehlt = null;
  ungesichert = false;
  ladeZubehoerNeu();
  zeichneAlles();
  sage(`„${name}" gelöscht.`);
}

function alsDatei(): void {
  const inhalt = JSON.stringify(aktuell, null, 2);
  const blob = new Blob([inhalt], { type: 'application/json' });
  const adresse = URL.createObjectURL(blob);
  const glied = document.createElement('a');
  glied.href = adresse;
  glied.download = `${aktuell.name.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}.json`;
  glied.click();
  window.setTimeout(() => URL.revokeObjectURL(adresse), 4000);
  sage('Vorlage als Datei abgelegt — so wandert sie auf die nächste Box.');
}

async function ausDatei(datei: File): Promise<void> {
  try {
    const geprueft = pruefeVorlage(JSON.parse(await datei.text()));
    if ('fehler' in geprueft) {
      sage(geprueft.fehler, 'fehler');
      return;
    }
    aktuell = { ...geprueft.vorlage, id: neueVorlagenKennung() };
    gewaehlt = null;
    ungesichert = true;
    ladeZubehoerNeu();
    zeichneAlles();
    sage(`„${aktuell.name}" geladen. „Sichern" legt sie auf dieser Box ab.`, 'gut');
  } catch {
    sage('Die Datei enthält kein lesbares JSON.', 'fehler');
  }
}

async function testdruck(): Promise<void> {
  const bild = zeichneVorlage(aktuell, muster, musterwerte(), zubehoer);
  const ergebnis = await drucke(alsBilddaten(bild), aktuell.name, einstellungen.drucker);
  if ('fehler' in ergebnis) return sage('Druck ging nicht: ' + ergebnis.fehler, 'fehler');
  sage(
    ergebnis.weg === 'box'
      ? `Testdruck an „${einstellungen.drucker}" geschickt.`
      : 'Testdruck an den Systemdruck übergeben.',
    'gut'
  );
}

async function kamerabildAlsMuster(): Promise<void> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  const kamera = new Kamera(video);
  try {
    sage('Kamera wird gefragt …');
    await kamera.starte();
    // Ein Moment, bis die Belichtung steht — sonst ist das Muster schwarz.
    await new Promise((weiter) => window.setTimeout(weiter, 700));
    muster = [kamera.standbild(einstellungen.spiegeln)];
    sage('Kamerabild als Muster übernommen.', 'gut');
  } catch {
    sage('Keine Kamera erreichbar — es bleibt beim Testbild.', 'fehler');
  } finally {
    kamera.stoppe();
    zeichneAlles();
  }
}

async function logoAusDatei(datei: File): Promise<void> {
  if (datei.size > 400_000) {
    sage('Das Logo ist größer als 400 kB. Ein kleineres PNG reicht für den Druck völlig.', 'fehler');
    return;
  }
  const daten = await new Promise<string>((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result));
    leser.onerror = () => fehler(new Error('lesen'));
    leser.readAsDataURL(datei);
  }).catch(() => '');

  if (!daten.startsWith('data:image/')) {
    sage('Die Datei ist kein Bild.', 'fehler');
    return;
  }
  aendere((v) => {
    v.logo = daten;
  });
  ladeZubehoerNeu();
  if (!aktuell.felder.some((f) => f.art === 'logo')) {
    sage('Logo hinterlegt — jetzt noch ein Logo-Feld auf dem Blatt setzen.');
  }
}

/* --- Verdrahtung ---------------------------------------------------- */

document.querySelectorAll<HTMLButtonElement>('[data-tun]').forEach((k) => {
  k.addEventListener('click', () => {
    switch (k.dataset.tun) {
      case 'neu':
        return neueVorlage();
      case 'kopie':
        return kopiereAktuelle();
      case 'loeschen':
        void loescheAktuelle();
        return;
      case 'sichern':
        void sichereAlles().then((gut) => {
          if (gut) sage(`„${aktuell.name}" liegt auf der Box.`, 'gut');
        });
        return;
      case 'datei-sichern':
        return alsDatei();
      case 'datei-laden':
        return el<HTMLInputElement>('vorlagendatei').click();
      case 'testdruck':
        void testdruck();
        return;
      case 'muster-testbild':
        muster = testbilder();
        zeichneAlles();
        return sage('Testbilder als Muster.');
      case 'muster-kamera':
        void kamerabildAlsMuster();
        return;
      case 'logo-weg':
        aendere((v) => {
          v.logo = undefined;
        });
        ladeZubehoerNeu();
        return sage('Logo entfernt.');
    }
  });
});

document.querySelectorAll<HTMLButtonElement>('[data-neu]').forEach((k) => {
  k.addEventListener('click', () => neuesFeld(k.dataset.neu as Feldart));
});

el<HTMLSelectElement>('wahl').addEventListener('change', (e) => {
  waehleVorlage((e.target as HTMLSelectElement).value);
});

el<HTMLInputElement>('name').addEventListener('input', (e) => {
  const wert = (e.target as HTMLInputElement).value;
  aendere(
    (v) => {
      v.name = wert;
    },
    { kopf: false }
  );
});

el<HTMLSelectElement>('blattart').addEventListener('change', (e) => {
  const wert = (e.target as HTMLSelectElement).value as Formatschluessel;
  aendere((v) => {
    v.format = wert;
    // Streifenblätter erwarten eine Serie, Einzelblätter ein Bild. Das
    // entscheidet, welche Aufnahmeart die Vorlage überhaupt bedienen kann.
    v.art = wert === 'streifen-2x6' || wert === 'lesezeichen' ? 'streifen' : v.art;
  });
  sage('Blattformat gewechselt — die Felder behalten ihre Anteile, prüf das Ergebnis.');
});

el<HTMLInputElement>('tinte').addEventListener('input', (e) => {
  const wert = (e.target as HTMLInputElement).value;
  aendere(
    (v) => {
      v.tinte = wert;
    },
    { kopf: false }
  );
});

el<HTMLInputElement>('papier').addEventListener('input', (e) => {
  const wert = (e.target as HTMLInputElement).value;
  aendere(
    (v) => {
      v.papier = wert;
    },
    { kopf: false }
  );
});

el<HTMLInputElement>('logodatei').addEventListener('change', (e) => {
  const feld = e.target as HTMLInputElement;
  const datei = feld.files?.[0];
  // Zurücksetzen, sonst meldet dasselbe Feld dieselbe Datei kein zweites Mal.
  if (datei) void logoAusDatei(datei).finally(() => (feld.value = ''));
});

el<HTMLInputElement>('vorlagendatei').addEventListener('change', (e) => {
  const feld = e.target as HTMLInputElement;
  const datei = feld.files?.[0];
  if (datei) void ausDatei(datei).finally(() => (feld.value = ''));
});

async function setzeStandard(blattart: 'foto' | 'streifen', an: boolean): Promise<void> {
  if (!an) {
    sage('Eine Vorlage muss eingestellt bleiben — wähl stattdessen eine andere aus.');
    zeichneAlles();
    return;
  }
  // Eingestellt werden kann nur, was auf der Box liegt.
  if (ungesichert && !(await sichereAlles())) return;
  try {
    await stelleEin(aktuell.id);
  } catch (fehler) {
    return sage(String(fehler).replace('Error: ', ''), 'fehler');
  }
  zeichneAlles();
  sage(
    `„${aktuell.name}" ist jetzt die Vorlage für ${blattart === 'foto' ? 'Fotos' : 'Streifen'}.`,
    'gut'
  );
}

el<HTMLInputElement>('standard-foto').addEventListener('change', (e) =>
  void setzeStandard('foto', (e.target as HTMLInputElement).checked)
);
el<HTMLInputElement>('standard-streifen').addEventListener('change', (e) =>
  void setzeStandard('streifen', (e.target as HTMLInputElement).checked)
);

window.addEventListener('beforeunload', (e) => {
  if (!ungesichert) return;
  e.preventDefault();
  e.returnValue = '';
});

const platzhalterliste = el<HTMLUListElement>('platzhalter');
PLATZHALTER.forEach((p) => {
  const zeile = document.createElement('li');
  const marke = document.createElement('code');
  marke.textContent = p.marke;
  zeile.append(marke, document.createTextNode(` ${p.erklaerung}`));
  platzhalterliste.append(zeile);
});

/* Erst den Stand der Box holen, dann zeichnen. Ohne Box wird es der
   mitgelieferte Katalog — der Editor bleibt bedienbar, nur ohne Sichern. */
/* Der Editor schreibt die Vorlagen der Box — also hinter der Tür. */
void verlangeAnmeldung()
  .then((stand) => (stand ? Promise.all([ladeVorlagen(), holeEinstellungen(true)]) : null))
  .then((ergebnis) => {
  if (!ergebnis) return;
  const [quelle] = ergebnis;
  einstellungen = ladeEinstellungen();
  aktuell = alleVorlagen().find((v) => v.id === eingestellt().foto) ?? alleVorlagen()[0]!;
  ladeZubehoerNeu();
  zeichneAlles();
  /* Am zweiten Gerät kann jemand dieselbe Liste bearbeiten. Was hier offen ist,
     wird deshalb nie stillschweigend überschrieben — die Liste zieht nach, das
     Blatt in Arbeit bleibt stehen. */
  amDraht('editor', (n) => {
    if (n.type !== 'templates') return;
    if (ungesichert) {
      sage(
        'Ein anderes Gerät hat die Vorlagen geändert. Hier liegt noch Ungesichertes — beim Sichern gewinnt dieser Stand.',
        'fehler'
      );
      return;
    }
    zeichneAlles({ liste: true });
  });

  if (quelle === 'box') {
    sage('Vorschau und Druck nutzen denselben Renderer — was hier steht, kommt so aus dem Drucker.');
  } else {
    sage(
      'Die Box antwortet nicht — angezeigt wird der mitgelieferte Katalog. Sichern geht erst wieder, wenn sie da ist.',
      'fehler'
    );
  }
});
