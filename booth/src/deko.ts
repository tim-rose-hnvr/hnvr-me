/**
 * Gezeichnete Verzierungen — Blüten, Feuerwerk, Schnee, Gold.
 *
 * Aus dem alten System übernommen und hierher übersetzt. Dort lagen 22
 * Vorlagen, deren Schmuck nicht als Bild vorlag, sondern als Zeichenbefehl:
 * Blütenkränze, Neonrahmen, Lorbeer. Beim Zusammenlegen der beiden Stände
 * blieben sie zunächst liegen, weil unser Vorlagenmodell nur Felder kennt —
 * Bild, Text, Fläche. Ein Blütenkranz ist keins davon.
 *
 * Er wird auch keins. Statt 22 Vorlagen mit je hundert Flächenfeldern
 * nachzubauen, trägt eine Vorlage jetzt einen Namen: `deko`. Der Rest steht
 * hier. Das hat drei Gründe:
 *
 *  - Ein PNG in Druckauflösung wäre je Vorlage mehrere Megabyte. Gezeichnet
 *    kostet es Kilobyte und ist bei jeder Blattgröße scharf.
 *  - Der Schmuck nimmt Papier-, Tinten- und Akzentfarbe der Vorlage an. Wer
 *    im Editor die Farbe ändert, sieht den Kranz mitgehen.
 *  - Vorschau und Druck laufen durch denselben Code. Was auf dem Schirm
 *    steht, kommt aus dem Drucker — das ist der ganze Sinn.
 *
 * Der Zufall ist deshalb keiner: `streu()` liefert bei gleicher Saat immer
 * dieselbe Folge. Ein Konfetti, das bei jedem Neuzeichnen woanders liegt,
 * wäre in einer Vorschau eine Lüge.
 *
 * Gezeichnet wird ZULETZT, über die Bilder. Das ist Absicht: Die Blüten
 * greifen über die Bildecken, genau darin besteht der Effekt.
 */

export type Dekoart =
  | 'hochzeit-gold'
  | 'blush-blumen'
  | 'botanik'
  | 'konfetti'
  | 'ballons'
  | 'firma'
  | 'reiner-rahmen'
  | 'feuerwerk'
  | 'bokeh'
  | 'lorbeer'
  | 'sanfter-himmel'
  | 'schnee'
  | 'neon'
  | 'filmkante'
  | 'art-deco'
  | 'sofortbild'
  | 'herzen'
  | 'feine-linie';

/** Die drei Farben der Vorlage. Mehr braucht keine Verzierung. */
export type Dekofarben = { papier: string; tinte: string; akzent: string };

export const DEKOLISTE: { art: Dekoart; name: string }[] = [
  { art: 'hochzeit-gold', name: 'Hochzeit Gold' },
  { art: 'blush-blumen', name: 'Blüten Blush' },
  { art: 'botanik', name: 'Botanik' },
  { art: 'konfetti', name: 'Konfetti' },
  { art: 'ballons', name: 'Ballons' },
  { art: 'firma', name: 'Firma' },
  { art: 'reiner-rahmen', name: 'Reiner Rahmen' },
  { art: 'feuerwerk', name: 'Feuerwerk' },
  { art: 'bokeh', name: 'Bokeh' },
  { art: 'lorbeer', name: 'Lorbeer' },
  { art: 'sanfter-himmel', name: 'Sanfter Himmel' },
  { art: 'schnee', name: 'Schnee' },
  { art: 'neon', name: 'Neon' },
  { art: 'filmkante', name: 'Filmkante' },
  { art: 'art-deco', name: 'Art déco' },
  { art: 'sofortbild', name: 'Sofortbild' },
  { art: 'herzen', name: 'Herzen' },
  { art: 'feine-linie', name: 'Feine Linie' },
];

export function istDekoart(wert: unknown): wert is Dekoart {
  return typeof wert === 'string' && DEKOLISTE.some((d) => d.art === wert);
}

type Stift = CanvasRenderingContext2D;

/* ------------------------------------------------------------------ */
/* Handwerkszeug                                                       */
/* ------------------------------------------------------------------ */

/** Gleiche Saat, gleiche Folge — sonst wäre die Vorschau eine Lüge. */
function streu(saat: number): () => number {
  let s = saat;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Farbe mit Deckkraft. Nimmt `#rrggbb` und alles, was der Browser kennt. */
function mitDeckung(farbe: string, a: number): string {
  if (/^#[0-9a-f]{6}$/i.test(farbe)) {
    const n = parseInt(farbe.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (/^#[0-9a-f]{3}$/i.test(farbe)) {
    const k = farbe.slice(1);
    const n = parseInt(k[0]! + k[0]! + k[1]! + k[1]! + k[2]! + k[2]!, 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // Kein Hexwert (z. B. `rgb(...)` aus einer Fremdvorlage): unverändert
  // durchreichen. Falsch deckend ist besser als gar nicht gezeichnet.
  return farbe;
}

function istHell(farbe: string): boolean {
  if (!/^#[0-9a-f]{6}$/i.test(farbe)) return true;
  const n = parseInt(farbe.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 140;
}

function verlauf(
  c: Stift,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halte: [number, string][]
): CanvasGradient {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  halte.forEach(([p, f]) => g.addColorStop(p, f));
  return g;
}

/** Goldfolie: mehrstufiger Verlauf mit Glanzband — wirkt geprägt, nicht flach. */
function goldfolie(c: Stift, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  return verlauf(c, x0, y0, x1, y1, [
    [0, '#a8761f'],
    [0.22, '#e8c25e'],
    [0.42, '#fff6d6'],
    [0.58, '#f0cf72'],
    [0.78, '#e8c25e'],
    [1, '#9c6a18'],
  ]);
}

/** Feines Korn. Ohne das wirkt jede große Fläche im Druck tot. */
function korn(c: Stift, w: number, h: number, a: number, saat: number): void {
  const r = streu(saat);
  const n = Math.round((w * h) / 3200);
  c.save();
  for (let i = 0; i < n; i++) {
    c.fillStyle = `rgba(255,255,255,${(a * (0.35 + r() * 0.65)).toFixed(3)})`;
    c.fillRect(r() * w, r() * h, 1.5, 1.5);
  }
  c.restore();
}

/** Weicher Farbfleck — Aquarell-Wirkung hinter den Motiven. */
function schleier(c: Stift, x: number, y: number, s: number, farbe: string): void {
  const g = c.createRadialGradient(x, y, 0, x, y, s);
  g.addColorStop(0, mitDeckung(farbe, 0.48));
  g.addColorStop(0.5, mitDeckung(farbe, 0.22));
  g.addColorStop(1, mitDeckung(farbe, 0));
  c.save();
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, s, 0, 6.283);
  c.fill();
  c.restore();
}

function blattblatt(c: Stift, x: number, y: number, s: number, dreh: number, farbe: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(dreh);
  c.fillStyle = farbe;
  c.beginPath();
  c.ellipse(0, -s * 0.55, s * 0.34, s * 0.62, 0, 0, 6.283);
  c.fill();
  c.restore();
}

function bluete(c: Stift, x: number, y: number, s: number, farbe: string, kern: string): void {
  for (let i = 0; i < 5; i++) blattblatt(c, x, y, s, i * 1.2566, farbe);
  c.fillStyle = kern;
  c.beginPath();
  c.arc(x, y, s * 0.22, 0, 6.283);
  c.fill();
}

function zweig(
  c: Stift,
  x: number,
  y: number,
  laenge: number,
  dreh: number,
  farbe: string | CanvasGradient
): void {
  c.save();
  c.translate(x, y);
  c.rotate(dreh);
  c.strokeStyle = farbe;
  c.lineWidth = Math.max(1, laenge * 0.02);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(laenge * 0.5, -laenge * 0.12, laenge, 0);
  c.stroke();
  c.fillStyle = farbe;
  for (let i = 1; i <= 6; i++) {
    const px = (i / 7) * laenge;
    const py = -Math.sin((i / 7) * Math.PI) * laenge * 0.1;
    c.save();
    c.translate(px, py);
    c.rotate(i % 2 ? -0.9 : 0.9);
    c.beginPath();
    c.ellipse(0, -laenge * 0.07, laenge * 0.035, laenge * 0.09, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
  c.restore();
}

function stern(c: Stift, x: number, y: number, s: number, farbe: string | CanvasGradient): void {
  c.fillStyle = farbe;
  c.save();
  c.translate(x, y);
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 ? s * 0.38 : s;
    if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  c.restore();
}

function flocke(c: Stift, x: number, y: number, s: number, farbe: string): void {
  c.save();
  c.translate(x, y);
  c.strokeStyle = farbe;
  c.lineWidth = Math.max(1, s * 0.12);
  c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, -s);
    c.moveTo(0, -s * 0.55);
    c.lineTo(s * 0.28, -s * 0.78);
    c.moveTo(0, -s * 0.55);
    c.lineTo(-s * 0.28, -s * 0.78);
    c.stroke();
  }
  c.restore();
}

function knall(c: Stift, x: number, y: number, s: number, farbe: string): void {
  c.save();
  c.translate(x, y);
  c.strokeStyle = farbe;
  c.fillStyle = farbe;
  c.lineWidth = Math.max(1, s * 0.03);
  c.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * 6.283;
    const r0 = s * 0.25;
    const r1 = s * (0.75 + (i % 3) * 0.12);
    c.beginPath();
    c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    c.stroke();
    c.beginPath();
    c.arc(Math.cos(a) * r1, Math.sin(a) * r1, s * 0.04, 0, 6.283);
    c.fill();
  }
  c.restore();
}

function herz(
  c: Stift,
  x: number,
  y: number,
  s: number,
  farbe: string | CanvasGradient,
  dreh = 0
): void {
  c.save();
  c.translate(x, y);
  if (dreh) c.rotate(dreh);
  c.fillStyle = farbe;
  c.beginPath();
  c.moveTo(0, s * 0.32);
  c.bezierCurveTo(s * 0.6, -s * 0.32, s * 0.95, s * 0.28, 0, s * 0.92);
  c.bezierCurveTo(-s * 0.95, s * 0.28, -s * 0.6, -s * 0.32, 0, s * 0.32);
  c.closePath();
  c.fill();
  c.restore();
}

/** Strahlenfächer aus einer Ecke — das Art-déco-Zeichen schlechthin. */
function faecher(
  c: Stift,
  x: number,
  y: number,
  s: number,
  dreh: number,
  farbe: string | CanvasGradient
): void {
  c.save();
  c.translate(x, y);
  c.rotate(dreh);
  c.strokeStyle = farbe;
  c.lineWidth = Math.max(1, s * 0.02);
  c.lineCap = 'round';
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    c.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    c.beginPath();
    c.arc(0, 0, s * (0.34 + k * 0.22), 0, Math.PI / 2);
    c.stroke();
  }
  c.restore();
}

/** Geschichtete Pfingstrose: drei Kränze und ein Kern. */
function pfingstrose(
  c: Stift,
  x: number,
  y: number,
  s: number,
  aussen: string,
  mitte: string,
  innen: string
): void {
  c.save();
  c.translate(x, y);
  for (let i = 0; i < 9; i++) {
    c.save();
    c.rotate((i * 6.283) / 9);
    c.fillStyle = aussen;
    c.beginPath();
    c.ellipse(0, -s * 0.64, s * 0.34, s * 0.68, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
  for (let i = 0; i < 8; i++) {
    c.save();
    c.rotate((i * 6.283) / 8 + 0.4);
    c.fillStyle = mitte;
    c.beginPath();
    c.ellipse(0, -s * 0.42, s * 0.27, s * 0.46, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
  for (let i = 0; i < 6; i++) {
    c.save();
    c.rotate((i * 6.283) / 6);
    c.fillStyle = innen;
    c.beginPath();
    c.ellipse(0, -s * 0.22, s * 0.17, s * 0.28, 0, 0, 6.283);
    c.fill();
    c.restore();
  }
  c.fillStyle = innen;
  c.beginPath();
  c.arc(0, 0, s * 0.15, 0, 6.283);
  c.fill();
  c.restore();
}

/** Eukalyptuszweig: geschwungener Stiel, paarige runde Blätter. */
function eukalyptus(
  c: Stift,
  x: number,
  y: number,
  laenge: number,
  dreh: number,
  farbe1: string,
  farbe2: string
): void {
  c.save();
  c.translate(x, y);
  c.rotate(dreh);
  c.strokeStyle = farbe2;
  c.lineWidth = Math.max(1, laenge * 0.018);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(laenge * 0.5, -laenge * 0.16, laenge, -laenge * 0.03);
  c.stroke();
  for (let i = 1; i <= 7; i++) {
    const p = i / 8;
    const px = p * laenge;
    const py = -Math.sin(p * Math.PI) * laenge * 0.14 - p * laenge * 0.03;
    const rr = laenge * 0.1 * (1 - p * 0.45);
    [-1, 1].forEach((seite) => {
      c.save();
      c.translate(px, py);
      c.rotate(seite * 0.85);
      c.fillStyle = i % 2 ? farbe1 : farbe2;
      c.beginPath();
      c.ellipse(0, -rr, rr * 0.72, rr, 0, 0, 6.283);
      c.fill();
      c.restore();
    });
  }
  c.restore();
}

function beeren(c: Stift, x: number, y: number, s: number, dreh: number, farbe: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(dreh);
  c.strokeStyle = mitDeckung(farbe, 0.7);
  c.lineWidth = Math.max(1, s * 0.06);
  for (let i = 0; i < 5; i++) {
    const a = i * 0.5;
    const px = Math.cos(a) * s * i * 0.2;
    const py = -Math.abs(Math.sin(a)) * s * i * 0.18;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(px, py);
    c.stroke();
    c.fillStyle = farbe;
    c.beginPath();
    c.arc(px, py, s * 0.12, 0, 6.283);
    c.fill();
  }
  c.restore();
}

/** Goldrahmen doppelt, mit Eckrauten. */
function goldrahmen(c: Stift, w: number, h: number, einzug: number): void {
  const m = Math.min(w, h);
  const o = m * einzug;
  c.strokeStyle = goldfolie(c, o, o, w - o, h - o);
  c.lineWidth = m * 0.011;
  c.strokeRect(o, o, w - o * 2, h - o * 2);
  const o2 = o + m * 0.02;
  c.strokeStyle = goldfolie(c, w - o2, o2, o2, h - o2);
  c.lineWidth = m * 0.0035;
  c.strokeRect(o2, o2, w - o2 * 2, h - o2 * 2);
  (
    [
      [o, o],
      [w - o, o],
      [o, h - o],
      [w - o, h - o],
    ] as [number, number][]
  ).forEach(([x, y]) => {
    c.save();
    c.translate(x, y);
    c.rotate(Math.PI / 4);
    c.fillStyle = goldfolie(c, -m * 0.014, 0, m * 0.014, 0);
    c.fillRect(-m * 0.013, -m * 0.013, m * 0.026, m * 0.026);
    c.restore();
  });
}

type Blumenfarben = {
  pAussen: string;
  pMitte: string;
  pInnen: string;
  qAussen: string;
  qMitte: string;
  qInnen: string;
  blatt1: string;
  blatt2: string;
  beere: string;
};

/** Blütenbüschel an einer Ecke — der Look, den Betreiber „DSLR-Booth" nennen. */
function bueschel(
  c: Stift,
  x: number,
  y: number,
  s: number,
  dreh: number,
  p: Blumenfarben
): void {
  c.save();
  c.translate(x, y);
  c.rotate(dreh);
  eukalyptus(c, 0, 0, s * 1.5, -0.3, p.blatt1, p.blatt2);
  eukalyptus(c, 0, 0, s * 1.25, 0.5, p.blatt2, p.blatt1);
  eukalyptus(c, 0, 0, s * 1.05, 1.5, p.blatt1, p.blatt2);
  beeren(c, s * 0.1, s * 0.1, s * 0.5, 0.3, p.beere);
  pfingstrose(c, 0, 0, s * 0.62, p.pAussen, p.pMitte, p.pInnen);
  pfingstrose(c, s * 0.78, s * 0.5, s * 0.4, p.qAussen, p.qMitte, p.qInnen);
  bluete(c, -s * 0.55, s * 0.5, s * 0.2, mitDeckung(p.qAussen, 0.95), mitDeckung(p.pInnen, 0.9));
  c.restore();
}

/** Kleines Band mit runden Ecken — `roundRect` fehlt in älteren Fassungen. */
function rundeck(c: Stift, x: number, y: number, b: number, h: number, r: number): void {
  const rr = Math.min(r, b / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.lineTo(x + b - rr, y);
  c.quadraticCurveTo(x + b, y, x + b, y + rr);
  c.lineTo(x + b, y + h - rr);
  c.quadraticCurveTo(x + b, y + h, x + b - rr, y + h);
  c.lineTo(x + rr, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - rr);
  c.lineTo(x, y + rr);
  c.quadraticCurveTo(x, y, x + rr, y);
  c.closePath();
}

/**
 * Farbe Nummer i aus einer Liste, umlaufend. Eigene Funktion, weil der
 * Übersetzer bei `liste[i % liste.length]` `undefined` für möglich hält.
 */
function ausListe(liste: string[], i: number): string {
  return liste[((i % liste.length) + liste.length) % liste.length] ?? '#000000';
}

/** Höhe eines Punktes im oberen oder unteren Randband. */
function randband(k: number, h: number, anteil: number): number {
  return k < 0.5 ? k * h * anteil : h - (1 - k) * h * anteil;
}

/* ------------------------------------------------------------------ */
/* Die Verzierungen                                                    */
/* ------------------------------------------------------------------ */

/**
 * `fuss` ist der Streifen unten, in dem die Beschriftung steht — gemessen am
 * Blatt, nicht geraten: Er reicht vom unteren Rand des letzten Bildfeldes bis
 * zur Blattkante. Die großen Motive halten sich daraus heraus.
 *
 * Der erste Probebogen zeigte, warum: Auf „Hochzeit Gold" saß eine
 * Pfingstrose mitten auf „Anna & Ben". Die Schrift danach zu zeichnen half
 * nur halb — goldene Schrift auf cremefarbener Blüte liest sich auch oben
 * liegend nicht. Feine Ranken und Girlanden dürfen weiter bis an die Kante,
 * sie verdecken nichts.
 */
type Zeichner = (c: Stift, w: number, h: number, f: Dekofarben, fuss: number) => void;

const ZEICHNER: Record<Dekoart, Zeichner> = {
  'hochzeit-gold'(c, w, h, f, fuss) {
    const m = Math.min(w, h);
    const hu = h - fuss;
    goldrahmen(c, w, h, 0.035);
    const p: Blumenfarben = {
      pAussen: '#f6ecd2',
      pMitte: '#efe0b8',
      pInnen: '#e6cd8f',
      qAussen: '#fff6df',
      qMitte: '#f0dcac',
      qInnen: '#dcbf82',
      blatt1: mitDeckung(f.tinte, 0.9),
      blatt2: '#c9a24a',
      beere: '#e8c25e',
    };
    const s = m * 0.2;
    bueschel(c, m * 0.12, m * 0.12, s, 0.4, p);
    bueschel(c, w - m * 0.12, hu - m * 0.12, s, Math.PI + 0.4, p);
    eukalyptus(c, w - m * 0.1, m * 0.1, s * 0.8, Math.PI * 0.75, mitDeckung(f.tinte, 0.85), '#c9a24a');
    eukalyptus(c, m * 0.1, hu - m * 0.1, s * 0.8, -Math.PI * 0.25, mitDeckung(f.tinte, 0.85), '#c9a24a');

    // Zwei Ringe unten mittig — das Zeichen, das jede Hochzeitsvorlage trägt.
    const ry = hu - m * 0.045;
    const rr = m * 0.032;
    c.strokeStyle = goldfolie(c, w / 2 - rr, ry - rr, w / 2 + rr, ry + rr);
    c.lineWidth = m * 0.009;
    c.beginPath();
    c.arc(w / 2 - rr * 0.62, ry, rr, 0, 6.283);
    c.stroke();
    c.beginPath();
    c.arc(w / 2 + rr * 0.62, ry, rr, 0, 6.283);
    c.stroke();
    c.strokeStyle = mitDeckung(f.tinte, 0.5);
    c.lineWidth = m * 0.003;
    c.beginPath();
    c.moveTo(w / 2 - m * 0.14, ry);
    c.lineTo(w / 2 - rr * 1.9, ry);
    c.moveTo(w / 2 + rr * 1.9, ry);
    c.lineTo(w / 2 + m * 0.14, ry);
    c.stroke();
    korn(c, w, h, 0.05, 3);
  },

  'blush-blumen'(c, w, h, f, fuss) {
    const r = streu(7);
    const m = Math.min(w, h);
    const hu = h - fuss;
    schleier(c, m * 0.1, m * 0.1, m * 0.3, '#e7a7ac');
    schleier(c, w - m * 0.12, hu - m * 0.12, m * 0.32, '#d98a9a');
    schleier(c, w - m * 0.1, m * 0.14, m * 0.18, '#e8c9a0');
    const p: Blumenfarben = {
      pAussen: '#e79aa2',
      pMitte: '#dd8791',
      pInnen: '#b95f6b',
      qAussen: '#f0c0b0',
      qMitte: '#e7a7a0',
      qInnen: '#c9737a',
      blatt1: '#9aa87c',
      blatt2: '#7d8f63',
      beere: '#c98f8f',
    };
    bueschel(c, m * 0.11, m * 0.1, m * 0.19, 0.5, p);
    bueschel(c, w - m * 0.11, hu - m * 0.11, m * 0.19, Math.PI + 0.5, p);
    bluete(c, w - m * 0.1, m * 0.09, m * 0.045, mitDeckung('#e79aa2', 0.95), mitDeckung(f.tinte, 0.9));
    eukalyptus(c, w - m * 0.13, m * 0.12, m * 0.16, Math.PI * 0.8, '#9aa87c', '#7d8f63');
    eukalyptus(c, m * 0.12, hu - m * 0.11, m * 0.15, -0.2, '#9aa87c', '#7d8f63');
    c.fillStyle = mitDeckung(f.tinte, 0.3);
    for (let i = 0; i < 22; i++) {
      c.beginPath();
      c.arc(r() * w, randband(r(), h, 0.2), m * (0.003 + r() * 0.004), 0, 6.283);
      c.fill();
    }
  },

  botanik(c, w, h, f) {
    const m = Math.min(w, h);
    const hell = istHell(f.papier);
    const l1 = hell ? '#8fa06a' : '#a9c07e';
    const l2 = hell ? '#728a52' : '#8aa267';
    for (let i = 0; i < 6; i++) {
      eukalyptus(c, w * (i / 5), m * 0.05, m * (0.16 + (i % 2) * 0.04), (i % 2 ? 0.2 : -0.2) + i * 0.05, l1, l2);
      eukalyptus(c, w * (i / 5), h - m * 0.05, m * (0.16 + (i % 2) * 0.05), Math.PI + (i % 2 ? 0.2 : -0.2), l2, l1);
    }
    bluete(c, m * 0.09, m * 0.09, m * 0.05, mitDeckung('#f6f1e7', 0.95), mitDeckung(f.akzent, 0.9));
    bluete(c, w - m * 0.09, h - m * 0.09, m * 0.05, mitDeckung('#f6f1e7', 0.95), mitDeckung(f.akzent, 0.9));
    beeren(c, w - m * 0.12, m * 0.1, m * 0.09, 1.2, f.akzent);
    beeren(c, m * 0.12, h - m * 0.1, m * 0.09, -1.9, f.akzent);
  },

  konfetti(c, w, h, f) {
    const r = streu(21);
    const m = Math.min(w, h);
    const farben = [f.tinte, f.akzent, '#7ee081', '#8fd3ff', '#ff5d8f', '#f6f1e7'];
    (
      [
        [0, 0, 1, 1],
        [w, 0, -1, 1],
        [0, h, 1, -1],
        [w, h, -1, -1],
      ] as [number, number, number, number][]
    ).forEach(([x0, y0, dx, dy], k) => {
      for (let s = 0; s < 2; s++) {
        c.strokeStyle = mitDeckung(ausListe(farben, k + s), 0.9);
        c.lineWidth = m * (0.007 - s * 0.002);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x0, y0 + dy * m * 0.02);
        for (let i = 1; i <= 6; i++) {
          c.quadraticCurveTo(
            x0 + dx * m * (i * 0.04 - 0.02 + s * 0.015),
            y0 + dy * m * (i * 0.055 + (i % 2 ? 0.05 : -0.012)),
            x0 + dx * m * i * 0.04,
            y0 + dy * m * i * 0.055
          );
        }
        c.stroke();
      }
    });
    for (let i = 0; i < 70; i++) {
      const oben = r() < 0.5;
      const x = r() * w;
      const y = oben ? r() * h * 0.16 : h - r() * h * 0.16;
      c.save();
      c.translate(x, y);
      c.rotate(r() * 6.283);
      c.fillStyle = mitDeckung(ausListe(farben, i), 0.95);
      const k = i % 3;
      if (k === 0) {
        c.beginPath();
        c.arc(0, 0, m * 0.007, 0, 6.283);
        c.fill();
      } else if (k === 1) {
        c.fillRect(-m * 0.013, -m * 0.006, m * 0.026, m * 0.012);
      } else {
        c.beginPath();
        c.moveTo(-m * 0.01, m * 0.008);
        c.lineTo(m * 0.01, m * 0.008);
        c.lineTo(0, -m * 0.01);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    for (let i = 0; i < 8; i++) {
      stern(c, r() * w, randband(r(), h, 0.2), m * (0.008 + r() * 0.008), mitDeckung(f.tinte, 0.9));
    }
  },

  ballons(c, w, h, f) {
    const m = Math.min(w, h);
    const farben = [f.akzent, '#ffc857', '#8fd3ff', '#7ee081', '#ff5d8f'];

    const ballon = (bx: number, by: number, s: number, farbe: string, richtung: number): void => {
      c.strokeStyle = 'rgba(18,16,13,0.28)';
      c.lineWidth = Math.max(1, m * 0.0022);
      c.beginPath();
      c.moveTo(bx, by + s);
      c.quadraticCurveTo(bx + richtung * m * 0.016, by + s + m * 0.07, bx + richtung * m * 0.004, by + s + m * 0.14);
      c.stroke();
      const g = c.createRadialGradient(bx - s * 0.3, by - s * 0.35, s * 0.1, bx, by, s * 1.1);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.25, farbe);
      g.addColorStop(1, mitDeckung(farbe, 0.92));
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(bx, by, s * 0.84, s, 0, 0, 6.283);
      c.fill();
      c.fillStyle = mitDeckung(farbe, 0.9);
      c.beginPath();
      c.moveTo(bx - s * 0.08, by + s);
      c.lineTo(bx + s * 0.08, by + s);
      c.lineTo(bx, by + s * 1.14);
      c.closePath();
      c.fill();
    };

    (
      [
        [m * 0.1, m * 0.13, 1],
        [w - m * 0.1, m * 0.12, -1],
      ] as [number, number, number][]
    ).forEach(([x, y, richtung], k) => {
      const plaetze: [number, number, number][] = [
        [0, 0, 0.05],
        [richtung * 0.06, 0.02, 0.042],
        [richtung * 0.02, 0.09, 0.046],
        [richtung * 0.1, 0.07, 0.036],
        [richtung * -0.03, 0.05, 0.034],
      ];
      plaetze.forEach((sp, i) =>
        ballon(x + richtung * sp[0] * m, y + sp[1] * m, m * sp[2], ausListe(farben, i + k), richtung)
      );
    });

    // Wimpelkette
    c.strokeStyle = mitDeckung(istHell(f.papier) ? '#12100d' : '#f6f1e7', 0.3);
    c.lineWidth = Math.max(1, m * 0.003);
    c.beginPath();
    c.moveTo(0, m * 0.055);
    c.quadraticCurveTo(w / 2, m * 0.11, w, m * 0.055);
    c.stroke();
    for (let i = 0; i < 11; i++) {
      const px = (w * (i + 0.5)) / 11;
      const py = m * (0.055 + Math.sin(((i + 0.5) / 11) * Math.PI) * 0.05);
      c.fillStyle = mitDeckung(ausListe(farben, i), 0.95);
      c.beginPath();
      c.moveTo(px - m * 0.017, py);
      c.lineTo(px + m * 0.017, py);
      c.lineTo(px, py + m * 0.032);
      c.closePath();
      c.fill();
    }
    const r = streu(41);
    for (let i = 0; i < 20; i++) {
      c.save();
      c.translate(r() * w, h - r() * h * 0.14);
      c.rotate(r() * 6.28);
      c.fillStyle = mitDeckung(ausListe(farben, i), 0.9);
      c.fillRect(-m * 0.011, -m * 0.005, m * 0.022, m * 0.01);
      c.restore();
    }
  },

  firma(c, w, h, f) {
    const m = Math.min(w, h);
    const col = f.akzent;
    const o = m * 0.05;
    const L = m * 0.13;
    c.save();
    c.fillStyle = verlauf(c, 0, 0, w, m * 0.05, [
      [0, mitDeckung(col, 0.22)],
      [1, mitDeckung(col, 0)],
    ]);
    c.fillRect(0, 0, w, m * 0.09);
    c.fillStyle = verlauf(c, w, h, 0, h - m * 0.05, [
      [0, mitDeckung(col, 0.22)],
      [1, mitDeckung(col, 0)],
    ]);
    c.fillRect(0, h - m * 0.09, w, m * 0.09);
    c.restore();

    c.strokeStyle = mitDeckung(col, 0.95);
    c.lineWidth = m * 0.009;
    c.lineCap = 'square';
    c.beginPath();
    c.moveTo(o, o + L);
    c.lineTo(o, o);
    c.lineTo(o + L, o);
    c.stroke();
    c.beginPath();
    c.moveTo(w - o - L, h - o);
    c.lineTo(w - o, h - o);
    c.lineTo(w - o, h - o - L);
    c.stroke();
    c.strokeStyle = mitDeckung(col, 0.5);
    c.lineWidth = m * 0.0035;
    c.beginPath();
    c.moveTo(o + m * 0.02, o + L);
    c.lineTo(o + m * 0.02, o + m * 0.02);
    c.lineTo(o + L, o + m * 0.02);
    c.stroke();
    c.beginPath();
    c.moveTo(w - o - L, h - o - m * 0.02);
    c.lineTo(w - o - m * 0.02, h - o - m * 0.02);
    c.lineTo(w - o - m * 0.02, h - o - L);
    c.stroke();
    c.strokeStyle = mitDeckung(col, 0.45);
    c.lineWidth = m * 0.003;
    c.beginPath();
    c.moveTo(o, h - o);
    c.lineTo(o + L * 1.5, h - o);
    c.stroke();
    c.beginPath();
    c.moveTo(w - o - L * 1.5, o);
    c.lineTo(w - o, o);
    c.stroke();
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        c.fillStyle = mitDeckung(col, 0.12 + ((i + j) / 16) * 0.3);
        c.beginPath();
        c.arc(w - o - L * 1.1 + i * m * 0.024, h - o - L * 1.1 + j * m * 0.024, m * 0.0035, 0, 6.283);
        c.fill();
      }
    }
  },

  'reiner-rahmen'(c, w, h, f) {
    const m = Math.min(w, h);
    const col = f.akzent;
    c.strokeStyle = mitDeckung(col, 0.6);
    c.lineWidth = Math.max(1, m * 0.0045);
    c.strokeRect(m * 0.03, m * 0.03, w - m * 0.06, h - m * 0.06);
    c.strokeStyle = mitDeckung(col, 0.3);
    c.lineWidth = Math.max(1, m * 0.002);
    c.strokeRect(m * 0.042, m * 0.042, w - m * 0.084, h - m * 0.084);
    const L = m * 0.045;
    c.strokeStyle = mitDeckung(col, 0.85);
    c.lineWidth = Math.max(1, m * 0.004);
    (
      [
        [m * 0.03, m * 0.03, 1, 1],
        [w - m * 0.03, m * 0.03, -1, 1],
        [m * 0.03, h - m * 0.03, 1, -1],
        [w - m * 0.03, h - m * 0.03, -1, -1],
      ] as [number, number, number, number][]
    ).forEach(([x, y, sx, sy]) => {
      c.beginPath();
      c.moveTo(x, y + sy * L);
      c.lineTo(x, y);
      c.lineTo(x + sx * L, y);
      c.stroke();
    });
    (
      [
        [w / 2, m * 0.03],
        [w / 2, h - m * 0.03],
      ] as [number, number][]
    ).forEach(([x, y]) => {
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      c.fillStyle = mitDeckung(col, 0.8);
      c.fillRect(-m * 0.008, -m * 0.008, m * 0.016, m * 0.016);
      c.restore();
    });
  },

  feuerwerk(c, w, h, f) {
    const m = Math.min(w, h);
    const r = streu(31);
    const rakete = (x: number, y: number, s: number, farbe: string): void => {
      schleier(c, x, y, s * 1.6, farbe);
      knall(c, x, y, s, mitDeckung(farbe, 0.95));
      c.fillStyle = 'rgba(255,246,214,0.9)';
      c.beginPath();
      c.arc(x, y, s * 0.06, 0, 6.283);
      c.fill();
    };
    rakete(w * 0.17, m * 0.15, m * 0.13, f.tinte);
    rakete(w * 0.82, m * 0.11, m * 0.1, f.akzent);
    rakete(w * 0.6, m * 0.24, m * 0.06, '#8fd3ff');
    rakete(w * 0.3, h - m * 0.12, m * 0.075, f.akzent);
    rakete(w * 0.8, h - m * 0.16, m * 0.05, f.tinte);
    c.strokeStyle = mitDeckung(f.tinte, 0.4);
    c.lineWidth = m * 0.004;
    for (let i = 0; i < 4; i++) {
      const x = w * (0.2 + i * 0.2);
      c.beginPath();
      c.moveTo(x, h * 0.95);
      for (let k = 1; k <= 5; k++) c.lineTo(x + Math.sin(k) * m * 0.01, h * 0.95 - k * m * 0.05);
      c.stroke();
    }
    for (let i = 0; i < 26; i++) {
      const k = r();
      const y = k < 0.55 ? k * h * 0.35 : h - (1 - k) * h * 0.22;
      c.fillStyle = mitDeckung(i % 2 ? f.akzent : '#f6f1e7', 0.1 + r() * 0.35);
      c.beginPath();
      c.arc(r() * w, y, m * (0.004 + r() * 0.014), 0, 6.283);
      c.fill();
    }
    for (let i = 0; i < 12; i++) {
      const k = r();
      stern(c, r() * w, k < 0.6 ? k * h * 0.3 : h - (1 - k) * h * 0.18, m * (0.006 + r() * 0.008), mitDeckung(f.tinte, 0.85));
    }
  },

  bokeh(c, w, h, f) {
    const r = streu(11);
    const m = Math.min(w, h);
    schleier(c, w * 0.2, h * 0.06, m * 0.3, f.akzent);
    schleier(c, w * 0.8, h * 0.04, m * 0.26, '#f6f1e7');
    schleier(c, w * 0.5, h * 0.98, m * 0.34, f.akzent);
    for (let i = 0; i < 54; i++) {
      const y = h - r() * h * 0.5;
      const x = r() * w;
      const s = m * (0.006 + r() * 0.026);
      const a = 0.1 + (1 - (h - y) / (h * 0.52)) * 0.42;
      const col = i % 3 ? f.akzent : '#f6f1e7';
      if (i % 4 === 0) {
        c.strokeStyle = mitDeckung(col, Math.max(0.08, a));
        c.lineWidth = m * 0.004;
        c.beginPath();
        c.arc(x, y, s, 0, 6.283);
        c.stroke();
      } else {
        c.fillStyle = mitDeckung(col, Math.max(0.06, a * 0.8));
        c.beginPath();
        c.arc(x, y, s, 0, 6.283);
        c.fill();
      }
    }
    for (let i = 0; i < 12; i++) {
      stern(c, r() * w, r() * h * 0.34, m * (0.005 + r() * 0.009), mitDeckung(f.akzent, 0.9));
    }
    korn(c, w, h, 0.03, 7);
  },

  lorbeer(c, w, h, f, fuss) {
    const m = Math.min(w, h);
    const hu = h - fuss;
    c.strokeStyle = goldfolie(c, m * 0.04, m * 0.04, w - m * 0.04, h - m * 0.04);
    c.lineWidth = m * 0.006;
    c.strokeRect(m * 0.04, m * 0.04, w - m * 0.08, h - m * 0.08);
    const gold = goldfolie(c, w / 2 - m * 0.2, h - m * 0.1, w / 2 + m * 0.2, h - m * 0.1);
    zweig(c, w / 2 - m * 0.02, hu - m * 0.03, m * 0.24, Math.PI - 0.3, gold);
    zweig(c, w / 2 + m * 0.02, hu - m * 0.03, m * 0.24, 0.3, gold);
    zweig(c, w / 2 - m * 0.02, hu - m * 0.03, m * 0.17, Math.PI - 0.7, mitDeckung(f.tinte, 0.7));
    zweig(c, w / 2 + m * 0.02, hu - m * 0.03, m * 0.17, 0.7, mitDeckung(f.tinte, 0.7));
    stern(c, w / 2, hu - m * 0.09, m * 0.022, goldfolie(c, w / 2 - m * 0.02, hu - m * 0.11, w / 2 + m * 0.02, hu - m * 0.07));
    const r = streu(19);
    for (let i = 0; i < 9; i++) {
      stern(c, r() * w, r() * h * 0.18 + m * 0.04, m * (0.006 + r() * 0.01), mitDeckung(f.tinte, 0.55 + r() * 0.35));
    }
  },

  'sanfter-himmel'(c, w, h, f) {
    const m = Math.min(w, h);
    const col = f.akzent;
    schleier(c, w * 0.12, m * 0.12, m * 0.3, col);
    schleier(c, w - m * 0.12, m * 0.1, m * 0.26, '#f3d9e6');

    const wolke = (x: number, y: number, s: number): void => {
      const ballen: [number, number, number][] = [
        [0, 0, s],
        [s * 0.8, -s * 0.25, s * 0.75],
        [s * 1.6, 0, s * 0.85],
        [s * 0.8, s * 0.3, s * 0.9],
        [s * -0.5, s * 0.1, s * 0.6],
      ];
      c.fillStyle = 'rgba(255,255,255,0.95)';
      ballen.forEach(([dx, dy, r2]) => {
        c.beginPath();
        c.arc(x + dx, y + dy, r2, 0, 6.283);
        c.fill();
      });
      c.fillStyle = mitDeckung(col, 0.18);
      ballen.forEach(([dx, dy, r2]) => {
        c.beginPath();
        c.arc(x + dx, y + dy + r2 * 0.35, r2 * 0.8, 0, 6.283);
        c.fill();
      });
    };
    wolke(m * 0.09, m * 0.12, m * 0.03);
    wolke(w - m * 0.22, m * 0.09, m * 0.026);
    wolke(w * 0.5, m * 0.05, m * 0.02);

    c.strokeStyle = mitDeckung(col, 0.55);
    c.lineWidth = m * 0.006;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(w * 0.5 - m * 0.02, m * 0.16, m * 0.03, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    c.beginPath();
    c.arc(w * 0.5 + m * 0.02, m * 0.16, m * 0.03, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();

    const r = streu(17);
    for (let i = 0; i < 14; i++) {
      const k = r();
      stern(c, r() * w, k < 0.6 ? k * h * 0.22 : h - (1 - k) * h * 0.14, m * (0.004 + r() * 0.006), mitDeckung(col, 0.8));
    }
    c.strokeStyle = mitDeckung(col, 0.5);
    c.lineWidth = m * 0.005;
    c.beginPath();
    c.moveTo(0, h - m * 0.04);
    c.quadraticCurveTo(w / 2, h - m * 0.09, w, h - m * 0.04);
    c.stroke();
    c.strokeStyle = mitDeckung(col, 0.25);
    c.lineWidth = m * 0.003;
    c.beginPath();
    c.moveTo(0, h - m * 0.065);
    c.quadraticCurveTo(w / 2, h - m * 0.11, w, h - m * 0.065);
    c.stroke();
  },

  schnee(c, w, h, f) {
    const r = streu(13);
    const m = Math.min(w, h);
    const col = f.akzent === '#7ee081' ? '#f6f1e7' : f.akzent;
    schleier(c, m * 0.08, m * 0.06, m * 0.28, '#bfe0ff');
    schleier(c, w - m * 0.08, m * 0.06, m * 0.28, '#bfe0ff');
    const tanne1 = '#4e6f52';
    const tanne2 = '#3c5a41';
    for (let i = 0; i < 6; i++) {
      zweig(c, w * (i / 5), m * 0.05, m * (0.17 + (i % 2) * 0.04), i % 2 ? 0.25 : -0.25, mitDeckung(i % 2 ? tanne1 : tanne2, 0.92));
    }
    c.fillStyle = 'rgba(138,106,58,0.8)';
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.ellipse(w * (0.2 + i * 0.2), m * 0.1, m * 0.014, m * 0.022, 0, 0, 6.283);
      c.fill();
    }
    for (let i = 0; i < 8; i++) {
      const oben = r() < 0.5;
      flocke(c, r() * w, oben ? m * 0.04 + r() * h * 0.14 : h - r() * h * 0.14, m * (0.014 + r() * 0.022), mitDeckung(col, 0.85));
    }
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 34; i++) {
      const k = r();
      c.beginPath();
      c.arc(r() * w, k < 0.6 ? k * h * 0.28 : h - (1 - k) * h * 0.22, m * (0.002 + r() * 0.005), 0, 6.283);
      c.fill();
    }
    zweig(c, m * 0.04, h - m * 0.04, m * 0.18, -0.5, mitDeckung(tanne1, 0.92));
    zweig(c, w - m * 0.04, h - m * 0.04, m * 0.18, Math.PI + 0.5, mitDeckung(tanne2, 0.92));
  },

  neon(c, w, h, f) {
    const m = Math.min(w, h);
    const glut = (einzug: number, farbe: string, breite: number): void => {
      c.save();
      for (let p = 0; p < 2; p++) {
        c.shadowColor = farbe;
        c.shadowBlur = m * (p ? 0.045 : 0.02);
        c.strokeStyle = mitDeckung(farbe, p ? 0.5 : 0.95);
        c.lineWidth = breite;
        c.strokeRect(einzug, einzug, w - einzug * 2, h - einzug * 2);
      }
      c.restore();
    };
    glut(m * 0.035, f.tinte, m * 0.006);
    glut(m * 0.055, f.akzent, m * 0.003);
    c.save();
    c.lineCap = 'round';
    (
      [
        [m * 0.07, f.akzent],
        [h - m * 0.07, f.tinte],
      ] as [number, string][]
    ).forEach(([yy, farbe]) => {
      c.shadowColor = farbe;
      c.shadowBlur = m * 0.03;
      c.strokeStyle = mitDeckung(farbe, 0.95);
      c.lineWidth = m * 0.008;
      c.beginPath();
      for (let i = 0; i <= 8; i++) {
        const px = w * 0.18 + i * w * 0.08;
        const py = yy + (i % 2 ? m * 0.03 : -m * 0.03);
        if (i) c.lineTo(px, py);
        else c.moveTo(px, py);
      }
      c.stroke();
    });
    c.shadowColor = f.tinte;
    c.shadowBlur = m * 0.03;
    c.strokeStyle = mitDeckung(f.tinte, 0.9);
    c.lineWidth = m * 0.007;
    c.beginPath();
    c.arc(m * 0.11, m * 0.12, m * 0.035, 0, 6.283);
    c.stroke();
    c.shadowColor = f.akzent;
    c.strokeStyle = mitDeckung(f.akzent, 0.9);
    c.beginPath();
    c.arc(w - m * 0.11, h - m * 0.12, m * 0.045, 0.3, 5.2);
    c.stroke();
    c.shadowColor = f.tinte;
    c.strokeStyle = 'rgba(246,241,231,0.9)';
    c.lineWidth = m * 0.004;
    const r = streu(23);
    for (let i = 0; i < 6; i++) {
      const x = r() * w;
      const k = r();
      const y = k < 0.5 ? m * 0.05 + k * h * 0.16 : h - m * 0.05 - (1 - k) * h * 0.16;
      const s = m * 0.012;
      c.beginPath();
      c.moveTo(x - s, y);
      c.lineTo(x + s, y);
      c.moveTo(x, y - s);
      c.lineTo(x, y + s);
      c.stroke();
    }
    c.restore();
  },

  filmkante(c, w, h, f) {
    const m = Math.min(w, h);
    const col = f.tinte;
    const band = m * 0.05;
    const loch = m * 0.02;
    const luecke = loch * 2.2;
    c.fillStyle = mitDeckung(col, 0.1);
    c.fillRect(0, 0, band, h);
    c.fillRect(w - band, 0, band, h);
    c.fillStyle = mitDeckung(col, 0.28);
    for (let y = luecke; y < h - luecke * 0.5; y += luecke) {
      rundeck(c, band * 0.3, y, loch, loch * 0.78, loch * 0.2);
      c.fill();
      rundeck(c, w - band * 0.3 - loch, y, loch, loch * 0.78, loch * 0.2);
      c.fill();
    }
    c.strokeStyle = mitDeckung(col, 0.2);
    c.lineWidth = Math.max(1, m * 0.002);
    c.beginPath();
    c.moveTo(band, m * 0.02);
    c.lineTo(w - band, m * 0.02);
    c.stroke();
  },

  'art-deco'(c, w, h, f) {
    const m = Math.min(w, h);
    const o = m * 0.05;
    c.strokeStyle = goldfolie(c, o, o, w - o, h - o);
    c.lineWidth = m * 0.01;
    c.strokeRect(o, o, w - o * 2, h - o * 2);
    const o2 = o + m * 0.022;
    c.strokeStyle = goldfolie(c, w - o2, o2, o2, h - o2);
    c.lineWidth = m * 0.0035;
    c.strokeRect(o2, o2, w - o2 * 2, h - o2 * 2);
    const fs = m * 0.18;
    (
      [
        [o + m * 0.008, o + m * 0.008, 0],
        [w - o - m * 0.008, o + m * 0.008, Math.PI / 2],
        [w - o - m * 0.008, h - o - m * 0.008, Math.PI],
        [o + m * 0.008, h - o - m * 0.008, -Math.PI / 2],
      ] as [number, number, number][]
    ).forEach(([x, y, dreh]) => {
      c.save();
      c.translate(x, y);
      c.rotate(dreh);
      for (let i = 0; i < 7; i++) {
        if (i % 2 !== 0) continue;
        const a0 = (i / 7) * (Math.PI / 2);
        const a1 = ((i + 1) / 7) * (Math.PI / 2);
        c.fillStyle = mitDeckung(f.tinte, 0.16);
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, fs, a0, a1);
        c.closePath();
        c.fill();
      }
      c.restore();
      faecher(c, x, y, fs, dreh, goldfolie(c, x - fs, y, x + fs, y));
    });
    (
      [
        [w / 2, o + m * 0.03],
        [w / 2, h - o - m * 0.03],
      ] as [number, number][]
    ).forEach(([x, y]) => {
      c.save();
      c.translate(x, y);
      c.rotate(Math.PI / 4);
      c.fillStyle = goldfolie(c, -m * 0.018, 0, m * 0.018, 0);
      c.fillRect(-m * 0.016, -m * 0.016, m * 0.032, m * 0.032);
      c.fillStyle = mitDeckung(f.papier, 0.9);
      c.fillRect(-m * 0.007, -m * 0.007, m * 0.014, m * 0.014);
      c.restore();
      c.strokeStyle = goldfolie(c, x - m * 0.1, y, x + m * 0.1, y);
      c.lineWidth = m * 0.004;
      c.beginPath();
      c.moveTo(x - m * 0.11, y);
      c.lineTo(x - m * 0.035, y);
      c.moveTo(x + m * 0.035, y);
      c.lineTo(x + m * 0.11, y);
      c.stroke();
      [-1, 1].forEach((s) => {
        c.fillStyle = mitDeckung(f.tinte, 0.8);
        c.beginPath();
        c.arc(x + s * m * 0.04, y, m * 0.006, 0, 6.283);
        c.fill();
      });
    });
    korn(c, w, h, 0.04, 5);
  },

  sofortbild(c, w, h, f) {
    const m = Math.min(w, h);
    const rand = m * 0.05;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.28)';
    c.shadowBlur = m * 0.03;
    c.shadowOffsetY = m * 0.012;
    c.fillStyle = 'rgba(255,255,255,0.98)';
    c.fillRect(rand * 0.5, rand * 0.5, w - rand, rand * 0.5);
    c.fillRect(rand * 0.5, h - m * 0.12, w - rand, m * 0.12 - rand * 0.5);
    c.fillRect(rand * 0.5, rand * 0.5, rand * 0.5, h - rand);
    c.fillRect(w - rand, rand * 0.5, rand * 0.5, h - rand);
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.05)';
    c.lineWidth = m * 0.006;
    c.strokeRect(rand, rand, w - rand * 2, h - rand - m * 0.12);
    (
      [
        [m * 0.05, m * 0.015, -0.32],
        [w - m * 0.16, m * 0.015, 0.32],
      ] as [number, number, number][]
    ).forEach(([x, y, dreh]) => {
      c.save();
      c.translate(x, y);
      c.rotate(dreh);
      c.fillStyle = mitDeckung(f.akzent, 0.45);
      c.fillRect(0, 0, m * 0.13, m * 0.042);
      c.strokeStyle = mitDeckung(f.akzent, 0.6);
      c.lineWidth = 1;
      c.strokeRect(0, 0, m * 0.13, m * 0.042);
      c.restore();
    });
    c.strokeStyle = mitDeckung(f.tinte, 0.45);
    c.lineWidth = m * 0.004;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(w * 0.28, h - m * 0.045);
    c.lineTo(w * 0.62, h - m * 0.045);
    c.stroke();
    herz(c, w * 0.68, h - m * 0.05, m * 0.016, mitDeckung(f.akzent, 0.8));
  },

  herzen(c, w, h, f, fuss) {
    const r = streu(29);
    const m = Math.min(w, h);
    const hu = h - fuss;
    const a = f.akzent;
    const g = f.tinte;

    const glanzherz = (x: number, y: number, s: number, farbe: string, dreh = 0): void => {
      const gr = c.createRadialGradient(x - s * 0.2, y - s * 0.1, s * 0.1, x, y, s * 0.9);
      gr.addColorStop(0, '#ffffff');
      gr.addColorStop(0.3, farbe);
      gr.addColorStop(1, mitDeckung(farbe, 0.9));
      herz(c, x, y, s, gr, dreh);
    };

    schleier(c, m * 0.1, m * 0.1, m * 0.24, a);
    schleier(c, w - m * 0.1, hu - m * 0.1, m * 0.24, a);
    (
      [
        [m * 0.1, m * 0.1, 1],
        [w - m * 0.1, hu - m * 0.1, -1],
      ] as [number, number, number][]
    ).forEach(([x, y, richtung]) => {
      glanzherz(x, y, m * 0.052, a);
      glanzherz(x + richtung * m * 0.06, y + richtung * m * 0.04, m * 0.036, '#ffb3c1');
      glanzherz(x - richtung * m * 0.02, y + richtung * m * 0.07, m * 0.028, g);
    });
    for (let i = 0; i < 16; i++) {
      const oben = r() < 0.5;
      glanzherz(
        r() * w,
        oben ? r() * h * 0.14 : h - r() * h * 0.14,
        m * (0.009 + r() * 0.012),
        i % 2 ? a : '#ffb3c1',
        (r() - 0.5) * 0.7
      );
    }
    (
      [
        [m * 0.06, 1],
        [h - m * 0.06, -1],
      ] as [number, number][]
    ).forEach(([yy, richtung]) => {
      c.strokeStyle = mitDeckung(a, 0.45);
      c.lineWidth = m * 0.004;
      c.beginPath();
      c.moveTo(w * 0.15, yy);
      c.quadraticCurveTo(w / 2, yy + richtung * m * 0.05, w * 0.85, yy);
      c.stroke();
      herz(c, w / 2, yy + richtung * m * 0.03, m * 0.02, mitDeckung(a, 0.9));
    });
  },

  'feine-linie'(c, w, h, f) {
    const m = Math.min(w, h);
    const col = f.akzent;
    c.strokeStyle = mitDeckung(col, 0.8);
    c.lineWidth = Math.max(1, m * 0.004);
    c.lineCap = 'butt';
    c.beginPath();
    c.moveTo(w * 0.12, m * 0.06);
    c.lineTo(w * 0.88, m * 0.06);
    c.stroke();
    c.fillStyle = mitDeckung(col, 0.9);
    c.beginPath();
    c.arc(w / 2, m * 0.06, m * 0.008, 0, 6.283);
    c.fill();
    const o = m * 0.05;
    const L = m * 0.05;
    c.strokeStyle = mitDeckung(col, 0.55);
    c.lineWidth = Math.max(1, m * 0.0035);
    (
      [
        [o, o, 1, 1],
        [w - o, o, -1, 1],
        [o, h - o, 1, -1],
        [w - o, h - o, -1, -1],
      ] as [number, number, number, number][]
    ).forEach(([x, y, sx, sy]) => {
      c.beginPath();
      c.moveTo(x, y + sy * L);
      c.lineTo(x, y);
      c.lineTo(x + sx * L, y);
      c.stroke();
    });
  },
};

/**
 * Zeichnet die Verzierung über das ganze Blatt.
 *
 * Fehler werden geschluckt: Ein Blatt ohne Blütenkranz ist ärgerlich, ein
 * Blatt, das gar nicht erst gedruckt wird, kostet den Abend. Der Aufrufer
 * zeichnet als Letztes, deshalb steht zu diesem Zeitpunkt schon alles
 * Wesentliche auf dem Papier.
 */
export function zeichneDeko(
  stift: Stift,
  breite: number,
  hoehe: number,
  farben: Dekofarben,
  art: Dekoart | undefined,
  freierFuss = 0
): void {
  if (!art) return;
  const zeichner = ZEICHNER[art];
  if (!zeichner) return;
  // Mehr als ein Drittel des Blattes freizuhalten ergibt keinen Sinn — dann
  // stünde der Schmuck zusammengedrängt im oberen Rest.
  const fuss = Math.max(0, Math.min(freierFuss, hoehe * 0.34));
  stift.save();
  try {
    zeichner(stift, breite, hoehe, farben, fuss);
  } catch {
    /* siehe oben */
  }
  stift.restore();
}
