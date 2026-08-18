/**
 * Das Effekt-Studio — Kunststile und Freistellung, lokal auf der Box.
 *
 * Das Modul verspricht dreierlei: Kunststile, Hintergrundtausch per
 * Greenscreen und einen KI-Hintergrund ohne grünes Tuch. Zwei davon
 * brauchen nichts außer Rechenzeit und stehen hier. Der dritte hängt an
 * einem konfigurierten Dienst (`/api/aiart`) — dafür gibt es einen Proxy im
 * Server, und was er kann, entscheidet der Dienst, nicht diese Datei.
 *
 * Warum lokal: Eine Fotobox steht regelmäßig in einer Scheune ohne Netz.
 * Ein Effekt, der eine Leitung braucht, ist ein Effekt, der auf der Hälfte
 * der Feiern fehlt — und ein Foto, das für einen Filter das Haus verlässt,
 * ist eine Datenschutzfrage, die sich niemand stellen will.
 *
 * Alle Stile arbeiten auf einer Kopie und geben eine neue Fläche zurück.
 * Das Original bleibt unangetastet: Wer einen Filter wieder abwählt, soll
 * das Bild zurückbekommen und nicht eine zweimal gerechnete Fassung.
 */

export type Effektkennung =
  | 'ohne'
  | 'schwarzweiss'
  | 'sepia'
  | 'comic'
  | 'aquarell'
  | 'oel'
  | 'popart';

export type Effekt = {
  id: Effektkennung;
  name: string;
  /**
   * Kurze Zeile für den Screen — was der Gast erwarten darf. Kurz heißt
   * wörtlich: Die Kachel ist rund 180 px breit, und eine Zeile, die dort
   * umbricht, macht ihre Reihe höher als die daneben.
   */
  zeile: string;
};

export const EFFEKTE: Effekt[] = [
  { id: 'ohne', name: 'Ohne', zeile: 'So wie aufgenommen' },
  { id: 'schwarzweiss', name: 'Schwarzweiß', zeile: 'Klar und zeitlos' },
  { id: 'sepia', name: 'Sepia', zeile: 'Warm, wie früher' },
  { id: 'comic', name: 'Comic', zeile: 'Harte Kanten' },
  { id: 'aquarell', name: 'Aquarell', zeile: 'Weich verlaufen' },
  { id: 'oel', name: 'Öl', zeile: 'Grobe Pinselstriche' },
  { id: 'popart', name: 'Pop-Art', zeile: 'Vier laute Felder' },
];

export function istEffekt(wert: unknown): wert is Effektkennung {
  return typeof wert === 'string' && EFFEKTE.some((e) => e.id === wert);
}

/**
 * Wendet einen Stil an und gibt eine NEUE Fläche zurück.
 *
 * `ohne` gibt die Quelle unverändert zurück — nicht eine Kopie: Wer keinen
 * Effekt gewählt hat, soll auch keine Neuberechnung bezahlen.
 */
export function wende(quelle: HTMLCanvasElement, effekt: Effektkennung): HTMLCanvasElement {
  if (effekt === 'ohne') return quelle;

  const ziel = document.createElement('canvas');
  ziel.width = quelle.width;
  ziel.height = quelle.height;
  const stift = ziel.getContext('2d');
  if (!stift) return quelle;

  if (effekt === 'popart') {
    zeichnePopart(stift, quelle);
    return ziel;
  }

  stift.drawImage(quelle, 0, 0);
  const bild = stift.getImageData(0, 0, ziel.width, ziel.height);
  const d = bild.data;

  switch (effekt) {
    case 'schwarzweiss':
      for (let i = 0; i < d.length; i += 4) {
        /* Nach Helligkeitsempfinden, nicht als Mittelwert: Grün wiegt für
           das Auge dreimal so schwer wie Blau. Ein arithmetisches Mittel
           macht rote Kleider grau und grüne Wiesen hell. */
        const g = d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114;
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      break;

    case 'sepia':
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i]!;
        const g = d[i + 1]!;
        const b = d[i + 2]!;
        d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      }
      break;

    case 'comic':
      /* Farben auf wenige Stufen legen — das ergibt die flachen Flächen.
         Die Kanten kommen danach als dunkle Linien darüber. */
      for (let i = 0; i < d.length; i += 4) {
        d[i] = stufe(d[i]!, 5);
        d[i + 1] = stufe(d[i + 1]!, 5);
        d[i + 2] = stufe(d[i + 2]!, 5);
      }
      stift.putImageData(bild, 0, 0);
      zeichneKanten(stift, quelle);
      return ziel;

    case 'aquarell':
      /* Weich, aber nicht matschig: erst leicht stufen, dann verwischen.
         Reines Weichzeichnen sieht nach unscharfem Foto aus, nicht nach
         Farbe auf Papier. */
      for (let i = 0; i < d.length; i += 4) {
        d[i] = stufe(d[i]!, 12);
        d[i + 1] = stufe(d[i + 1]!, 12);
        d[i + 2] = stufe(d[i + 2]!, 12);
      }
      stift.putImageData(bild, 0, 0);
      stift.save();
      stift.globalAlpha = 0.55;
      stift.filter = 'blur(3px) saturate(1.25)';
      stift.drawImage(ziel, 0, 0);
      stift.restore();
      return ziel;

    case 'oel':
      stift.putImageData(bild, 0, 0);
      zeichneOel(stift, ziel);
      return ziel;
  }

  stift.putImageData(bild, 0, 0);
  return ziel;
}

/* ------------------------------------------------------------------ */
/* Freistellung                                                        */
/* ------------------------------------------------------------------ */

export type Greenscreen = {
  an: boolean;
  /** Die Farbe des Tuchs, als `#rrggbb`. */
  farbe: string;
  /** Wie großzügig verglichen wird, 0–100. */
  toleranz: number;
};

/**
 * Stellt vor einem Tuch frei und legt ein Bild dahinter.
 *
 * Verglichen wird im Farbton, nicht im RGB-Abstand: Ein Tuch ist an der
 * Falte dunkler und im Licht heller, bleibt aber grün. Wer über RGB
 * vergleicht, verliert die Schatten des Tuchs und frisst gleichzeitig
 * grüne Kleidung weg.
 */
export function stelleFrei(
  quelle: HTMLCanvasElement,
  hintergrund: CanvasImageSource | null,
  einstellung: Greenscreen
): HTMLCanvasElement {
  if (!einstellung.an) return quelle;

  const ziel = document.createElement('canvas');
  ziel.width = quelle.width;
  ziel.height = quelle.height;
  const stift = ziel.getContext('2d');
  if (!stift) return quelle;

  /* Zuerst der Hintergrund, deckend eingepasst — darüber das freigestellte
     Bild. Andersherum müsste man mit Masken arbeiten, und das kostet auf
     einem Booth-Rechner Zeit, die der Gast merkt. */
  if (hintergrund) {
    const q = masse(hintergrund);
    const f = Math.max(ziel.width / q.b, ziel.height / q.h);
    stift.drawImage(hintergrund, (ziel.width - q.b * f) / 2, (ziel.height - q.h * f) / 2, q.b * f, q.h * f);
  }

  const vorn = document.createElement('canvas');
  vorn.width = quelle.width;
  vorn.height = quelle.height;
  const vstift = vorn.getContext('2d');
  if (!vstift) return quelle;
  vstift.drawImage(quelle, 0, 0);

  const bild = vstift.getImageData(0, 0, vorn.width, vorn.height);
  const d = bild.data;
  const soll = farbton(einstellung.farbe);
  const grenze = Math.max(4, Math.min(90, einstellung.toleranz)) * 1.8;

  for (let i = 0; i < d.length; i += 4) {
    const ist = farbtonAus(d[i]!, d[i + 1]!, d[i + 2]!);
    /* Farbton ist ein Kreis: 355° und 5° liegen zehn Grad auseinander,
       nicht dreihundertfünfzig. */
    let abstand = Math.abs(ist.ton - soll.ton);
    if (abstand > 180) abstand = 360 - abstand;
    /* Sehr blasse oder sehr dunkle Stellen haben keinen verlässlichen
       Farbton — Haare vor dem Tuch würden sonst durchsichtig. */
    if (abstand < grenze && ist.saettigung > 0.18 && ist.helligkeit > 0.12) {
      d[i + 3] = 0;
    }
  }
  vstift.putImageData(bild, 0, 0);
  stift.drawImage(vorn, 0, 0);
  return ziel;
}

/* ------------------------------------------------------------------ */
/* Handwerkszeug                                                       */
/* ------------------------------------------------------------------ */

function stufe(wert: number, stufen: number): number {
  const schritt = 255 / (stufen - 1);
  return Math.round(Math.round(wert / schritt) * schritt);
}

/** Dunkle Linien an den Kanten — das, was ein Comic von einem Farbfoto
    unterscheidet. */
function zeichneKanten(stift: CanvasRenderingContext2D, quelle: HTMLCanvasElement): void {
  const hilf = document.createElement('canvas');
  hilf.width = quelle.width;
  hilf.height = quelle.height;
  const h = hilf.getContext('2d');
  if (!h) return;
  h.drawImage(quelle, 0, 0);
  const bild = h.getImageData(0, 0, hilf.width, hilf.height);
  const d = bild.data;
  const grau = new Uint8ClampedArray(hilf.width * hilf.height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    grau[p] = d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114;
  }

  const kanten = h.createImageData(hilf.width, hilf.height);
  const k = kanten.data;
  for (let y = 1; y < hilf.height - 1; y++) {
    for (let x = 1; x < hilf.width - 1; x++) {
      const p = y * hilf.width + x;
      /* Sobel, aber nur so grob wie nötig: Der Unterschied zum Nachbarn
         rechts und unten reicht für eine Comic-Linie. */
      const gx = Math.abs(grau[p - 1]! - grau[p + 1]!);
      const gy = Math.abs(grau[p - hilf.width]! - grau[p + hilf.width]!);
      const stark = gx + gy > 42 ? 255 : 0;
      const i = p * 4;
      k[i] = k[i + 1] = k[i + 2] = 0;
      k[i + 3] = stark;
    }
  }
  h.putImageData(kanten, 0, 0);
  stift.save();
  stift.globalAlpha = 0.72;
  stift.drawImage(hilf, 0, 0);
  stift.restore();
}

/** Grobe Striche: kleine, leicht versetzte Kopien übereinander. */
function zeichneOel(stift: CanvasRenderingContext2D, flaeche: HTMLCanvasElement): void {
  const kopie = document.createElement('canvas');
  kopie.width = flaeche.width;
  kopie.height = flaeche.height;
  kopie.getContext('2d')?.drawImage(flaeche, 0, 0);

  const strich = Math.max(2, Math.round(Math.min(flaeche.width, flaeche.height) / 260));
  stift.save();
  stift.globalAlpha = 0.5;
  stift.filter = 'saturate(1.3) contrast(1.08)';
  for (const [dx, dy] of [
    [-strich, 0],
    [strich, 0],
    [0, -strich],
    [0, strich],
  ] as [number, number][]) {
    stift.drawImage(kopie, dx, dy);
  }
  stift.restore();
}

/** Vier Felder, jedes anders eingefärbt. */
function zeichnePopart(stift: CanvasRenderingContext2D, quelle: HTMLCanvasElement): void {
  const b = quelle.width / 2;
  const h = quelle.height / 2;
  const toene = ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(180deg)', 'hue-rotate(270deg)'];
  const plaetze: [number, number][] = [
    [0, 0],
    [b, 0],
    [0, h],
    [b, h],
  ];
  plaetze.forEach(([x, y], i) => {
    stift.save();
    stift.filter = `saturate(2.2) contrast(1.35) ${toene[i]}`;
    stift.drawImage(quelle, x, y, b, h);
    stift.restore();
  });
}

function farbton(hex: string): { ton: number } {
  const n = parseInt((hex || '#00c800').replace('#', ''), 16);
  return farbtonAus((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

function farbtonAus(r: number, g: number, b: number): {
  ton: number;
  saettigung: number;
  helligkeit: number;
} {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const spanne = max - min;
  let ton = 0;
  if (spanne !== 0) {
    if (max === R) ton = ((G - B) / spanne) % 6;
    else if (max === G) ton = (B - R) / spanne + 2;
    else ton = (R - G) / spanne + 4;
    ton *= 60;
    if (ton < 0) ton += 360;
  }
  return { ton, saettigung: max === 0 ? 0 : spanne / max, helligkeit: max };
}

function masse(bild: CanvasImageSource): { b: number; h: number } {
  if (bild instanceof HTMLImageElement) return { b: bild.naturalWidth, h: bild.naturalHeight };
  if (bild instanceof HTMLCanvasElement) return { b: bild.width, h: bild.height };
  return { b: 1920, h: 1080 };
}
