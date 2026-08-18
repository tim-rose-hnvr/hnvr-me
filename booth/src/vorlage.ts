/**
 * Das Vorlagenmodell — die Datenform hinter jedem Druckbild.
 *
 * Eine Vorlage beschreibt ein Blatt und die Felder darauf. Der Renderer kennt
 * keine festen Layouts; was gedruckt wird, steht in den Daten. Genau dieselben
 * Daten bearbeitet der Booth-Editor, deshalb ist die Vorschau dort kein Bild
 * von etwas Ähnlichem, sondern das Druckbild selbst.
 *
 * Das Modell ist die Zusammenführung zweier Stände: unseres (eine einzige
 * Feldliste, Reihenfolge = Ebene) und des Katalogmodells aus 1.30 (Zellen,
 * feste Textplätze, Hintergrundbild, sieben Papierformate). Übernommen wurde
 * die Feldliste, weil eine Liste einfacher zu bearbeiten ist als vier
 * Sondertöpfe — die 78 Katalogvorlagen werden beim Einlesen darauf abgebildet.
 *
 * Feldkoordinaten sind Anteile des Blattes (0..1). Schriftgrößen sind
 * Blattpunkte bei 300 dpi, also dieselbe Einheit wie die Blattmaße.
 */

import {
  FORMATE,
  formatVon,
  gedreht,
  istFormat,
  schriftbau,
  schriftenBereit,
  type Formatschluessel,
  type Schriftart,
} from './formate';

export type { Formatschluessel, Schriftart };

export type Feldart = 'bild' | 'text' | 'flaeche' | 'logo' | 'bilddatei' | 'qr';
export type Ausrichtung = 'links' | 'mitte' | 'rechts';
export type Figur = 'rechteck' | 'ellipse' | 'linie';

export type Feld = {
  id: string;
  art: Feldart;
  /** Anteile des Blattes, 0..1. */
  x: number;
  y: number;
  b: number;
  h: number;
  /** Drehung in Grad um die eigene Mitte. */
  dreh?: number;

  /* Text */
  text?: string;
  groesse?: number;
  gewicht?: number;
  schrift?: Schriftart;
  ausrichtung?: Ausrichtung;
  versalien?: boolean;
  farbe?: string;
  /**
   * Umbrechen statt stauchen. Aus (Vorgabe) heißt: eine Zeile, notfalls
   * schmaler gezogen — so bleibt ein gekauftes Blatt so gesetzt, wie es
   * gestaltet wurde. An heißt: umbrechen, für eigene mehrzeilige Texte.
   */
  umbruch?: boolean;

  /* Fläche */
  figur?: Figur;
  linie?: string;
  linienstaerke?: number;

  /* Bildfeld, Bilddatei, Logo */
  radius?: number;
  schatten?: boolean;
  rahmen?: string;
  rahmenB?: number;
  /** Quelle für Bilddatei, Logo und QR-Inhalt. */
  quelle?: string;
};

export type Vorlage = {
  id: string;
  name: string;
  format: Formatschluessel;
  /** Was der Gast dafür aufnimmt — Einzelbild oder Serie. */
  art: 'foto' | 'streifen';
  /** Anzahl Aufnahmen, die die Vorlage erwartet. */
  aufnahmen: number;
  papier: string;
  tinte: string;
  akzent: string;
  /** Hintergrundbild, deckend eingepasst. Pfad auf der Box oder Datenadresse. */
  hintergrund?: string;
  /** Runde Ecken an allen Bildfeldern. */
  ecken?: boolean;
  /** Logo als Datenadresse; liegt in der Vorlage, damit sie für sich steht. */
  logo?: string;
  felder: Feld[];
};

/** Werte, die beim Drucken in die Texte eingesetzt werden. */
export type Werte = {
  event: string;
  box: string;
  datum: string;
  zeit: string;
  nummer: string;
};

export const PLATZHALTER: { marke: string; erklaerung: string }[] = [
  { marke: '{event}', erklaerung: 'Name des Events aus den Einstellungen' },
  { marke: '{datum}', erklaerung: 'Tag der Aufnahme, z. B. 14.06.2026' },
  { marke: '{zeit}', erklaerung: 'Uhrzeit der Aufnahme, z. B. 21:47' },
  { marke: '{box}', erklaerung: 'Name der Box' },
  { marke: '{nummer}', erklaerung: 'Laufende Nummer der Aufnahme an diesem Abend' },
];

export function setzeWerte(text: string, werte: Werte): string {
  return text
    .replaceAll('{event}', werte.event)
    .replaceAll('{datum}', werte.datum)
    .replaceAll('{date}', werte.datum) // Katalogvorlagen tragen die alte Marke
    .replaceAll('{zeit}', werte.zeit)
    .replaceAll('{box}', werte.box)
    .replaceAll('{tagline}', werte.box)
    .replaceAll('{nummer}', werte.nummer);
}

export function werteJetzt(event: string, box: string, nummer: number): Werte {
  const jetzt = new Date();
  return {
    event,
    box,
    datum: jetzt.toLocaleDateString('de-DE'),
    zeit: jetzt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    nummer: String(nummer),
  };
}

/** Zählt die Bildfelder — so viele Aufnahmen zeigt die Vorlage. */
export function bildfelder(v: Vorlage): number {
  return v.felder.filter((f) => f.art === 'bild').length;
}

export function neueFeldKennung(): string {
  return 'f' + Math.random().toString(36).slice(2, 9);
}

export function klemme(wert: number, mindest = 0): number {
  return Math.min(1, Math.max(mindest, wert));
}

/* ------------------------------------------------------------------ */
/* Zubehör laden                                                       */
/* ------------------------------------------------------------------ */

/**
 * Alles, was der Renderer nicht selbst herstellen kann: Hintergrundbild,
 * Logos, Bilddateien, fertig gezeichnete QR-Codes.
 *
 * Getrennt vom Zeichnen, damit `zeichneVorlage` gleichbleibend und ohne
 * Warten läuft — der Editor zeichnet bei jedem Tastendruck neu.
 */
export type Zubehoer = {
  hintergrund: CanvasImageSource | null;
  /** Je Feldkennung das geladene Bild. */
  zuFeld: Map<string, CanvasImageSource>;
};

export const LEERES_ZUBEHOER: Zubehoer = { hintergrund: null, zuFeld: new Map() };

function ladeBild(quelle: string): Promise<HTMLImageElement | null> {
  return new Promise((fertig) => {
    const bild = new Image();
    bild.onload = () => fertig(bild);
    bild.onerror = () => fertig(null);
    bild.src = quelle;
  });
}

/**
 * Lädt Hintergrund, Logos, Bilddateien und QR-Codes einer Vorlage.
 * `qrBild` erzeugt aus einem Text eine Bilddatenadresse — der Aufrufer gibt
 * sie herein, damit dieses Modul keine QR-Bibliothek kennen muss.
 */
export async function ladeZubehoer(
  v: Vorlage,
  werte: Werte,
  qrBild?: (inhalt: string) => Promise<string>
): Promise<Zubehoer> {
  const zubehoer: Zubehoer = { hintergrund: null, zuFeld: new Map() };

  const arbeiten: Promise<void>[] = [];

  if (v.hintergrund) {
    arbeiten.push(
      ladeBild(v.hintergrund).then((b) => {
        zubehoer.hintergrund = b;
      })
    );
  }

  for (const feld of v.felder) {
    if (feld.art === 'logo') {
      const quelle = feld.quelle || v.logo;
      if (quelle) {
        arbeiten.push(
          ladeBild(quelle).then((b) => {
            if (b) zubehoer.zuFeld.set(feld.id, b);
          })
        );
      }
    } else if (feld.art === 'bilddatei' && feld.quelle) {
      arbeiten.push(
        ladeBild(feld.quelle).then((b) => {
          if (b) zubehoer.zuFeld.set(feld.id, b);
        })
      );
    } else if (feld.art === 'qr' && feld.quelle && qrBild) {
      const inhalt = setzeWerte(feld.quelle, werte);
      arbeiten.push(
        qrBild(inhalt)
          .then(ladeBild)
          .then((b) => {
            if (b) zubehoer.zuFeld.set(feld.id, b);
          })
          .catch(() => undefined)
      );
    }
  }

  // Schriften gehören dazu: ohne sie zeichnet die Leinwand still in Ersatz.
  arbeiten.push(schriftenBereit(v.felder.filter((f) => f.art === 'text').map((f) => f.schrift)));

  await Promise.all(arbeiten);
  return zubehoer;
}

/* ------------------------------------------------------------------ */
/* Zeichnen                                                            */
/* ------------------------------------------------------------------ */

function stiftVon(flaeche: HTMLCanvasElement): CanvasRenderingContext2D {
  const stift = flaeche.getContext('2d');
  if (!stift) throw new Error('Zeichenfläche nicht verfügbar');
  return stift;
}

function pfadRechteck(
  stift: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  radius: number
): void {
  const r = Math.max(0, Math.min(radius, Math.min(b, h) / 2));
  stift.beginPath();
  stift.moveTo(x + r, y);
  stift.arcTo(x + b, y, x + b, y + h, r);
  stift.arcTo(x + b, y + h, x, y + h, r);
  stift.arcTo(x, y + h, x, y, r);
  stift.arcTo(x, y, x + b, y, r);
  stift.closePath();
}

function masseVon(bild: CanvasImageSource): { breite: number; hoehe: number } {
  const q = bild as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
  return { breite: q.width ?? q.videoWidth ?? 1, hoehe: q.height ?? q.videoHeight ?? 1 };
}

/** Zeichnet ein Bild formatfüllend in ein Feld, ohne es zu verzerren. */
function fuelleFeld(
  stift: CanvasRenderingContext2D,
  bild: CanvasImageSource,
  x: number,
  y: number,
  breite: number,
  hoehe: number,
  radius: number
): void {
  const q = masseVon(bild);
  const skala = Math.max(breite / q.breite, hoehe / q.hoehe);
  const zielBreite = q.breite * skala;
  const zielHoehe = q.hoehe * skala;

  stift.save();
  pfadRechteck(stift, x, y, breite, hoehe, radius);
  stift.clip();
  stift.drawImage(
    bild,
    x + (breite - zielBreite) / 2,
    y + (hoehe - zielHoehe) / 2,
    zielBreite,
    zielHoehe
  );
  stift.restore();
}

/** Bild vollständig ins Feld einpassen — für Logos und eingefügte Bilder. */
function passeEin(
  stift: CanvasRenderingContext2D,
  bild: CanvasImageSource,
  x: number,
  y: number,
  b: number,
  h: number
): void {
  const q = masseVon(bild);
  const skala = Math.min(b / q.breite, h / q.hoehe);
  stift.drawImage(
    bild,
    x + (b - q.breite * skala) / 2,
    y + (h - q.hoehe * skala) / 2,
    q.breite * skala,
    q.hoehe * skala
  );
}

/** Platzhalter für ein Feld ohne Inhalt — schraffiert, nicht leer. */
function zeichnePlatzhalter(
  stift: CanvasRenderingContext2D,
  x: number,
  y: number,
  b: number,
  h: number,
  radius: number,
  beschriftung: string
): void {
  stift.save();
  pfadRechteck(stift, x, y, b, h, radius);
  stift.clip();
  stift.fillStyle = 'rgba(0,0,0,0.05)';
  stift.fillRect(x, y, b, h);
  stift.strokeStyle = 'rgba(0,0,0,0.14)';
  stift.lineWidth = 2;
  for (let i = -h; i < b; i += 26) {
    stift.beginPath();
    stift.moveTo(x + i, y + h);
    stift.lineTo(x + i + h, y);
    stift.stroke();
  }
  stift.fillStyle = 'rgba(0,0,0,0.4)';
  stift.textAlign = 'center';
  stift.textBaseline = 'middle';
  stift.font = `500 ${Math.max(14, Math.min(22, h / 6))}px ui-monospace, monospace`;
  stift.fillText(beschriftung, x + b / 2, y + h / 2);
  stift.restore();
}

/** Bricht Text auf die Feldbreite um. Leere Zeilen bleiben erhalten. */
function umbreche(stift: CanvasRenderingContext2D, text: string, breite: number): string[] {
  const zeilen: string[] = [];
  text.split('\n').forEach((absatz) => {
    const woerter = absatz.split(' ');
    let zeile = '';
    woerter.forEach((wort) => {
      const versuch = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && stift.measureText(versuch).width > breite) {
        zeilen.push(zeile);
        zeile = wort;
      } else {
        zeile = versuch;
      }
    });
    zeilen.push(zeile);
  });
  return zeilen;
}

function zeichneText(
  stift: CanvasRenderingContext2D,
  feld: Feld,
  v: Vorlage,
  werte: Werte,
  x: number,
  y: number,
  b: number,
  h: number
): void {
  const roh = setzeWerte(feld.text ?? '', werte);
  const text = feld.versalien ? roh.toLocaleUpperCase('de-DE') : roh;
  if (!text.trim()) return;

  const groesse = feld.groesse ?? 40;
  stift.save();
  stift.fillStyle = feld.farbe ?? v.tinte;
  stift.font = schriftbau(feld.schrift)(groesse, (feld.gewicht ?? 600) >= 700);

  const links = feld.ausrichtung === 'links';
  const rechts = feld.ausrichtung === 'rechts';
  stift.textAlign = links ? 'left' : rechts ? 'right' : 'center';
  const anker = links ? x : rechts ? x + b : x + b / 2;

  if (!feld.umbruch) {
    // Eine Zeile, notfalls gestaucht: so bleibt ein gekauftes Blatt gesetzt,
    // wie es gestaltet wurde. Ein Umbruch schöbe alles darunter nach unten.
    stift.textBaseline = 'middle';
    stift.fillText(text, anker, y + h / 2, Math.max(10, b));
    stift.restore();
    return;
  }

  stift.textBaseline = 'top';
  const zeilen = umbreche(stift, text, b);
  const zeilenhoehe = Math.round(groesse * 1.22);
  let oben = y + Math.max(0, (h - zeilen.length * zeilenhoehe) / 2);
  zeilen.forEach((zeile) => {
    stift.fillText(zeile, anker, oben);
    oben += zeilenhoehe;
  });
  stift.restore();
}

function zeichneFlaeche(
  stift: CanvasRenderingContext2D,
  feld: Feld,
  x: number,
  y: number,
  b: number,
  h: number
): void {
  const figur: Figur = feld.figur ?? 'rechteck';
  const radius = feld.radius ?? 0;

  stift.save();
  if (feld.schatten) {
    stift.shadowColor = 'rgba(0,0,0,0.32)';
    stift.shadowBlur = Math.max(6, Math.min(b, h) * 0.12);
    stift.shadowOffsetY = Math.max(3, Math.min(b, h) * 0.05);
  }

  stift.beginPath();
  if (figur === 'ellipse') {
    stift.ellipse(x + b / 2, y + h / 2, Math.max(1, b / 2), Math.max(1, h / 2), 0, 0, Math.PI * 2);
  } else if (figur === 'linie') {
    // Eine Linie ist ein Rechteck von der Höhe der Strichbreite — so lässt
    // sie sich anfassen und drehen wie alles andere.
    const d = Math.max(1, feld.linienstaerke ?? 4);
    stift.rect(x, y + h / 2 - d / 2, b, d);
  } else if (radius > 0) {
    pfadRechteck(stift, x, y, b, h, radius);
  } else {
    stift.rect(x, y, b, h);
  }

  if (figur === 'linie') {
    stift.fillStyle = feld.linie || feld.farbe || '#17171c';
    stift.fill();
  } else {
    if (feld.farbe && feld.farbe !== 'transparent') {
      stift.fillStyle = feld.farbe;
      stift.fill();
    }
    stift.shadowColor = 'transparent';
    if (feld.linie && feld.linie !== 'transparent' && (feld.linienstaerke ?? 0) > 0) {
      stift.lineWidth = feld.linienstaerke!;
      stift.strokeStyle = feld.linie;
      stift.stroke();
    }
  }
  stift.restore();
}

function zeichneBildfeld(
  stift: CanvasRenderingContext2D,
  feld: Feld,
  v: Vorlage,
  bild: CanvasImageSource | null,
  nummer: number,
  x: number,
  y: number,
  b: number,
  h: number
): void {
  const radius = feld.radius ?? (v.ecken ? 26 : 0);

  if (!bild) {
    zeichnePlatzhalter(stift, x, y, b, h, radius, `Bild ${nummer + 1}`);
    return;
  }

  // Der Schatten liegt UNTER dem Foto: erst die Fläche mit Schatten füllen,
  // dann das Bild ohne Schatten darüber. Sonst wirft jedes Detail im Bild
  // seinen eigenen Schatten.
  if (feld.schatten) {
    stift.save();
    stift.shadowColor = 'rgba(0,0,0,0.34)';
    stift.shadowBlur = Math.max(8, Math.min(b, h) * 0.08);
    stift.shadowOffsetY = Math.max(4, Math.min(b, h) * 0.03);
    stift.fillStyle = v.papier || '#ffffff';
    pfadRechteck(stift, x, y, b, h, radius);
    stift.fill();
    stift.restore();
  }

  fuelleFeld(stift, bild, x, y, b, h, radius);

  if (feld.rahmen && (feld.rahmenB ?? 0) > 0) {
    // Der Strich sitzt mittig auf der Kante — halbe Breite nach innen, sonst
    // ragt die Hälfte über die Zelle hinaus.
    const halb = feld.rahmenB! / 2;
    stift.save();
    stift.lineWidth = feld.rahmenB!;
    stift.strokeStyle = feld.rahmen;
    pfadRechteck(stift, x + halb, y + halb, b - feld.rahmenB!, h - feld.rahmenB!, Math.max(0, radius - halb));
    stift.stroke();
    stift.restore();
  }
}

/**
 * Welches Foto in welches Bildfeld gehört.
 *
 * Viele übernommene Vorlagen zeigen dieselbe Serie zweimal nebeneinander auf
 * einem Blatt, das später mittig geschnitten wird. Geht die Zahl der Felder
 * glatt durch die Zahl der Aufnahmen, wiederholt sich die Serie — sonst füllt
 * die letzte Aufnahme die restlichen Plätze.
 */
export function bildFuerFeld(
  bilder: CanvasImageSource[],
  nummer: number,
  felder: number
): CanvasImageSource | null {
  if (!bilder.length) return null;
  if (nummer >= bilder.length && felder % bilder.length === 0) {
    return bilder[nummer % bilder.length]!;
  }
  return bilder[Math.min(nummer, bilder.length - 1)]!;
}

/**
 * Zeichnet eine Vorlage. `bilder` werden der Reihe nach in die Bildfelder
 * gesetzt. Fehlt jedes Bild, erscheint der Platzhalter — für die Vorschau.
 */
export function zeichneVorlage(
  v: Vorlage,
  bilder: CanvasImageSource[],
  werte: Werte,
  zubehoer: Zubehoer = LEERES_ZUBEHOER
): HTMLCanvasElement {
  const masse = formatVon(v.format);
  const W = masse.breite;
  const H = masse.hoehe;

  const flaeche = document.createElement('canvas');
  flaeche.width = W;
  flaeche.height = H;
  const stift = stiftVon(flaeche);

  stift.fillStyle = v.papier || '#ffffff';
  stift.fillRect(0, 0, W, H);

  if (zubehoer.hintergrund) {
    const q = masseVon(zubehoer.hintergrund);
    const r = Math.max(W / q.breite, H / q.hoehe);
    stift.drawImage(
      zubehoer.hintergrund,
      (W - q.breite * r) / 2,
      (H - q.hoehe * r) / 2,
      q.breite * r,
      q.hoehe * r
    );
  }

  const bildfelderGesamt = v.felder.filter((f) => f.art === 'bild').length;
  let bildzaehler = 0;

  v.felder.forEach((feld) => {
    const x = feld.x * W;
    const y = feld.y * H;
    const b = feld.b * W;
    const h = feld.h * H;

    stift.save();
    gedreht(stift, feld.dreh, x + b / 2, y + h / 2);

    if (feld.art === 'flaeche') {
      zeichneFlaeche(stift, feld, x, y, b, h);
    } else if (feld.art === 'bild') {
      const nummer = bildzaehler++;
      zeichneBildfeld(
        stift,
        feld,
        v,
        bildFuerFeld(bilder, nummer, bildfelderGesamt),
        nummer,
        x,
        y,
        b,
        h
      );
    } else if (feld.art === 'logo' || feld.art === 'bilddatei' || feld.art === 'qr') {
      const bild = zubehoer.zuFeld.get(feld.id);
      if (bild) passeEin(stift, bild, x, y, b, h);
      else
        zeichnePlatzhalter(
          stift,
          x,
          y,
          b,
          h,
          feld.radius ?? 0,
          feld.art === 'qr' ? 'QR' : feld.art === 'logo' ? 'Logo' : 'Bild'
        );
    } else {
      zeichneText(stift, feld, v, werte, x, y, b, h);
    }

    stift.restore();
  });

  return flaeche;
}

/* ------------------------------------------------------------------ */
/* Prüfen                                                              */
/* ------------------------------------------------------------------ */

const ARTEN: Feldart[] = ['bild', 'text', 'flaeche', 'logo', 'bilddatei', 'qr'];

/**
 * Prüft eine eingelesene Vorlage, bevor sie übernommen wird — und hebt dabei
 * ältere Stände an: Vorlagen aus der Zeit vor den sieben Formaten trugen
 * `blatt: 'foto' | 'streifen'` statt eines Formatschlüssels.
 */
export function pruefeVorlage(roh: unknown): { vorlage: Vorlage } | { fehler: string } {
  if (!roh || typeof roh !== 'object') return { fehler: 'Die Datei enthält keine Vorlage.' };
  const v = roh as Record<string, unknown>;

  if (typeof v.name !== 'string' || !v.name.trim()) return { fehler: 'Der Vorlage fehlt ein Name.' };

  const format = istFormat(v.format)
    ? v.format
    : v.blatt === 'streifen'
      ? 'streifen-2x6'
      : v.blatt === 'foto'
        ? 'hoch-4x6'
        : null;
  if (!format) {
    return {
      fehler: 'Unbekanntes Blattformat. Erlaubt sind: ' + Object.keys(FORMATE).join(', ') + '.',
    };
  }

  if (!Array.isArray(v.felder) || v.felder.length === 0)
    return { fehler: 'Die Vorlage hat keine Felder.' };

  const felder: Feld[] = [];
  for (const roheres of v.felder as Partial<Feld>[]) {
    if (!roheres || typeof roheres !== 'object' || !ARTEN.includes(roheres.art as Feldart))
      return { fehler: 'Ein Feld hat eine unbekannte Art.' };
    const zahlen = [roheres.x, roheres.y, roheres.b, roheres.h];
    if (zahlen.some((z) => typeof z !== 'number' || !Number.isFinite(z)))
      return { fehler: 'Ein Feld hat unbrauchbare Maße.' };
    felder.push({
      ...(roheres as Feld),
      id: typeof roheres.id === 'string' && roheres.id ? roheres.id : neueFeldKennung(),
      x: klemme(roheres.x as number),
      y: klemme(roheres.y as number),
      b: klemme(roheres.b as number, 0.01),
      h: klemme(roheres.h as number, 0.01),
    });
  }
  if (!felder.some((f) => f.art === 'bild'))
    return { fehler: 'Ohne Bildfeld kann die Vorlage keine Aufnahme zeigen.' };

  const zeichen = (wert: unknown, ersatz: string) =>
    typeof wert === 'string' && wert ? wert : ersatz;

  return {
    vorlage: {
      id: zeichen(v.id, 'v' + Math.random().toString(36).slice(2, 9)),
      name: (v.name as string).slice(0, 60),
      format,
      art: v.art === 'streifen' || v.kind === 'strip' ? 'streifen' : 'foto',
      aufnahmen: Math.max(1, Number(v.aufnahmen ?? v.shots ?? felder.filter((f) => f.art === 'bild').length)),
      papier: zeichen(v.papier ?? v.bg, '#ffffff'),
      tinte: zeichen(v.tinte ?? v.fg, '#17171c'),
      akzent: zeichen(v.akzent ?? v.accent, '#f2b23e'),
      hintergrund: typeof v.hintergrund === 'string' ? v.hintergrund : undefined,
      ecken: Boolean(v.ecken),
      logo:
        typeof v.logo === 'string' && v.logo.startsWith('data:image/') ? v.logo : undefined,
      felder,
    },
  };
}
