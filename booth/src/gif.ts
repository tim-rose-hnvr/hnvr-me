/**
 * GIF-Kodierer.
 *
 * Boomerang und GIF werden aufgenommen und am Screen animiert gezeigt; damit
 * der Gast sie mitnehmen kann, braucht es eine Datei. GIF ist dafür die
 * unempfindlichste Wahl: jedes Telefon, jeder Messenger und jedes Mailprogramm
 * zeigt es, ohne Codec-Frage. Geschrieben ist der Kodierer hier selbst — die
 * Box lädt nichts nach, auch nicht beim ersten Start in einem fremden Netz.
 *
 * Format: GIF89a mit globaler Farbtabelle (bis 256 Farben, Median-Cut),
 * LZW-Kompression, NETSCAPE-Schleife. Ohne Dithering — bei Kamerabildern
 * fällt das kaum auf, und es hält die Kodierung schnell genug für den Betrieb.
 */

export type Bewegtbild = {
  blob: Blob;
  breite: number;
  hoehe: number;
  rahmen: number;
};

export type Gifwunsch = {
  /** Breite der Datei; die Höhe folgt dem Seitenverhältnis. */
  breite?: number;
  /** Anzeigedauer je Einzelbild in Millisekunden. */
  verzoegerungMs: number;
  /** Vor und zurück — die Bewegung läuft in der Schleife sauber durch. */
  pingpong?: boolean;
};

/* --- Farbtabelle ---------------------------------------------------- */

type Kasten = { pixel: Uint8Array; anzahl: number };

function spannweite(k: Kasten, kanal: number): number {
  let min = 255;
  let max = 0;
  for (let i = 0; i < k.anzahl; i++) {
    const w = k.pixel[i * 3 + kanal]!;
    if (w < min) min = w;
    if (w > max) max = w;
  }
  return max - min;
}

function laengsterKanal(k: Kasten): { kanal: number; weite: number } {
  let kanal = 0;
  let weite = -1;
  for (let c = 0; c < 3; c++) {
    const w = spannweite(k, c);
    if (w > weite) {
      weite = w;
      kanal = c;
    }
  }
  return { kanal, weite };
}

function teile(k: Kasten, kanal: number): [Kasten, Kasten] {
  // Nach dem Kanal sortieren und in der Mitte trennen — Median-Cut.
  const stellen = Array.from({ length: k.anzahl }, (_, i) => i);
  stellen.sort((a, b) => k.pixel[a * 3 + kanal]! - k.pixel[b * 3 + kanal]!);

  const mitte = k.anzahl >> 1;
  const links = new Uint8Array(mitte * 3);
  const rechts = new Uint8Array((k.anzahl - mitte) * 3);

  stellen.forEach((stelle, i) => {
    const ziel = i < mitte ? links : rechts;
    const platz = (i < mitte ? i : i - mitte) * 3;
    ziel[platz] = k.pixel[stelle * 3]!;
    ziel[platz + 1] = k.pixel[stelle * 3 + 1]!;
    ziel[platz + 2] = k.pixel[stelle * 3 + 2]!;
  });

  return [
    { pixel: links, anzahl: mitte },
    { pixel: rechts, anzahl: k.anzahl - mitte },
  ];
}

function mittelwert(k: Kasten): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < k.anzahl; i++) {
    r += k.pixel[i * 3]!;
    g += k.pixel[i * 3 + 1]!;
    b += k.pixel[i * 3 + 2]!;
  }
  const n = Math.max(1, k.anzahl);
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

/** Baut eine Farbtabelle aus Stichproben aller Einzelbilder. */
export function farbtabelle(proben: Uint8Array, anzahl: number, farben: number): Uint8Array {
  let kaesten: Kasten[] = [{ pixel: proben, anzahl }];

  while (kaesten.length < farben) {
    // Den Kasten teilen, der am meisten Farbe auf einmal zusammenfasst.
    let besterWert = 0;
    let bester = -1;
    let besterKanal = 0;
    kaesten.forEach((k, i) => {
      if (k.anzahl < 2) return;
      const { kanal, weite } = laengsterKanal(k);
      const wert = weite * k.anzahl;
      if (wert > besterWert) {
        besterWert = wert;
        bester = i;
        besterKanal = kanal;
      }
    });
    if (bester < 0) break;

    const [a, b] = teile(kaesten[bester]!, besterKanal);
    kaesten = [...kaesten.slice(0, bester), a, b, ...kaesten.slice(bester + 1)];
  }

  const tabelle = new Uint8Array(farben * 3);
  kaesten.forEach((k, i) => {
    const [r, g, b] = mittelwert(k);
    tabelle[i * 3] = r;
    tabelle[i * 3 + 1] = g;
    tabelle[i * 3 + 2] = b;
  });
  return tabelle;
}

/**
 * Ordnet Farben ihrer nächsten Tabellenfarbe zu.
 *
 * Der Umweg über 15 Bit (5 Bit je Kanal) macht aus Millionen Vergleichen
 * einen Tabellenzugriff; berechnet wird ein Eintrag erst, wenn die Farbe
 * wirklich vorkommt.
 */
class Zuordner {
  private tabelle: Uint8Array;
  private anzahl: number;
  private merker = new Int16Array(32768).fill(-1);

  constructor(tabelle: Uint8Array, anzahl: number) {
    this.tabelle = tabelle;
    this.anzahl = anzahl;
  }

  index(r: number, g: number, b: number): number {
    const eimer = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const gemerkt = this.merker[eimer]!;
    if (gemerkt >= 0) return gemerkt;

    let beste = 0;
    let bestesMass = Infinity;
    for (let i = 0; i < this.anzahl; i++) {
      const dr = r - this.tabelle[i * 3]!;
      const dg = g - this.tabelle[i * 3 + 1]!;
      const db = b - this.tabelle[i * 3 + 2]!;
      const mass = dr * dr + dg * dg + db * db;
      if (mass < bestesMass) {
        bestesMass = mass;
        beste = i;
        if (mass === 0) break;
      }
    }
    this.merker[eimer] = beste;
    return beste;
  }
}

/* --- LZW ------------------------------------------------------------ */

class Bitstrom {
  private bytes: number[] = [];
  private puffer = 0;
  private bits = 0;

  schreibe(code: number, breite: number): void {
    this.puffer |= code << this.bits;
    this.bits += breite;
    while (this.bits >= 8) {
      this.bytes.push(this.puffer & 0xff);
      this.puffer >>= 8;
      this.bits -= 8;
    }
  }

  /** Schließt ab und packt in Unterblöcke zu höchstens 255 Byte. */
  abschluss(): number[] {
    if (this.bits > 0) {
      this.bytes.push(this.puffer & 0xff);
      this.puffer = 0;
      this.bits = 0;
    }
    const heraus: number[] = [];
    for (let i = 0; i < this.bytes.length; i += 255) {
      const teil = this.bytes.slice(i, i + 255);
      heraus.push(teil.length, ...teil);
    }
    heraus.push(0);
    return heraus;
  }
}

/** LZW-Kompression, wie GIF sie verlangt. */
export function lzw(indizes: Uint8Array, minBreite: number): number[] {
  const loeschen = 1 << minBreite;
  const ende = loeschen + 1;

  const strom = new Bitstrom();
  let breite = minBreite + 1;
  let naechster = ende + 1;
  let tabelle = new Map<number, number>();

  strom.schreibe(loeschen, breite);

  if (indizes.length === 0) {
    strom.schreibe(ende, breite);
    return strom.abschluss();
  }

  let laufend = indizes[0]!;

  for (let i = 1; i < indizes.length; i++) {
    const k = indizes[i]!;
    const kette = (laufend << 8) | k;
    const bekannt = tabelle.get(kette);

    if (bekannt !== undefined) {
      laufend = bekannt;
      continue;
    }

    strom.schreibe(laufend, breite);

    if (naechster === 4096) {
      // Tabelle voll: löschen und von vorn — der Leser tut dasselbe.
      strom.schreibe(loeschen, breite);
      tabelle = new Map();
      naechster = ende + 1;
      breite = minBreite + 1;
    } else {
      if (naechster >= 1 << breite) breite++;
      tabelle.set(kette, naechster++);
    }

    laufend = k;
  }

  strom.schreibe(laufend, breite);
  strom.schreibe(ende, breite);
  return strom.abschluss();
}

/* --- Zusammenbau ---------------------------------------------------- */

/** Wachsender Bytepuffer — die Datenblöcke werden zu groß für `push(...)`. */
class Puffer {
  private daten = new Uint8Array(1 << 16);
  private laenge = 0;

  private platz(mehr: number): void {
    if (this.laenge + mehr <= this.daten.length) return;
    let groesse = this.daten.length * 2;
    while (groesse < this.laenge + mehr) groesse *= 2;
    const neu = new Uint8Array(groesse);
    neu.set(this.daten.subarray(0, this.laenge));
    this.daten = neu;
  }

  byte(...werte: number[]): void {
    this.platz(werte.length);
    werte.forEach((w) => (this.daten[this.laenge++] = w));
  }

  block(werte: ArrayLike<number>): void {
    this.platz(werte.length);
    this.daten.set(werte as Uint8Array, this.laenge);
    this.laenge += werte.length;
  }

  text(zeichen: string): void {
    this.block(Array.from(zeichen, (z) => z.charCodeAt(0)));
  }

  zahl16(wert: number): void {
    this.byte(wert & 0xff, (wert >> 8) & 0xff);
  }

  fertig(): ArrayBuffer {
    return this.daten.buffer.slice(0, this.laenge) as ArrayBuffer;
  }
}

function bildDaten(flaeche: HTMLCanvasElement, breite: number, hoehe: number): ImageData {
  const klein = document.createElement('canvas');
  klein.width = breite;
  klein.height = hoehe;
  const stift = klein.getContext('2d', { willReadFrequently: true });
  if (!stift) throw new Error('Zeichenfläche nicht verfügbar');
  stift.drawImage(flaeche, 0, 0, breite, hoehe);
  return stift.getImageData(0, 0, breite, hoehe);
}

/** Hängt die Rückwärtsfolge an, ohne Anfang und Ende doppelt zu zeigen. */
export function pingpong<T>(rahmen: T[]): T[] {
  if (rahmen.length < 3) return rahmen;
  return [...rahmen, ...rahmen.slice(1, -1).reverse()];
}

/**
 * Setzt Einzelbilder zu einem animierten GIF zusammen.
 *
 * Zwischen den Einzelbildern gibt die Funktion die Steuerung ab, damit der
 * Booth währenddessen nicht einfriert.
 */
export async function alsGif(
  rahmen: HTMLCanvasElement[],
  wunsch: Gifwunsch
): Promise<Bewegtbild> {
  if (rahmen.length === 0) throw new Error('Ohne Einzelbilder kein GIF');

  const folge = wunsch.pingpong ? pingpong(rahmen) : rahmen;
  const erstes = rahmen[0]!;
  const breite = Math.max(2, Math.round(wunsch.breite ?? 480));
  const hoehe = Math.max(2, Math.round((breite * erstes.height) / erstes.width));

  const daten = folge.map((r) => bildDaten(r, breite, hoehe));

  // Stichproben über alle Einzelbilder — jede Farbe der Bewegung zählt mit.
  const schritt = Math.max(1, Math.floor((breite * hoehe) / 4000));
  const probenzahl = daten.length * Math.ceil((breite * hoehe) / schritt);
  const proben = new Uint8Array(probenzahl * 3);
  let gezaehlt = 0;
  daten.forEach((bild) => {
    for (let p = 0; p < breite * hoehe; p += schritt) {
      proben[gezaehlt * 3] = bild.data[p * 4]!;
      proben[gezaehlt * 3 + 1] = bild.data[p * 4 + 1]!;
      proben[gezaehlt * 3 + 2] = bild.data[p * 4 + 2]!;
      gezaehlt++;
    }
  });

  const FARBEN = 256;
  const tabelle = farbtabelle(proben, gezaehlt, FARBEN);
  const zuordner = new Zuordner(tabelle, FARBEN);

  const puffer = new Puffer();
  puffer.text('GIF89a');
  puffer.zahl16(breite);
  puffer.zahl16(hoehe);
  puffer.byte(0xf7, 0, 0); // globale Tabelle, 256 Farben
  puffer.block(tabelle);

  // NETSCAPE-Erweiterung: endlose Schleife.
  puffer.byte(0x21, 0xff, 0x0b);
  puffer.text('NETSCAPE2.0');
  puffer.byte(0x03, 0x01, 0, 0, 0);

  // Mindestens 2 Hundertstel: darunter setzen viele Betrachter eigene Werte ein.
  const verzoegerung = Math.max(2, Math.round(wunsch.verzoegerungMs / 10));

  for (const bild of daten) {
    const indizes = new Uint8Array(breite * hoehe);
    for (let p = 0; p < indizes.length; p++) {
      indizes[p] = zuordner.index(bild.data[p * 4]!, bild.data[p * 4 + 1]!, bild.data[p * 4 + 2]!);
    }

    puffer.byte(0x21, 0xf9, 0x04, 0x04);
    puffer.zahl16(verzoegerung);
    puffer.byte(0, 0);

    puffer.byte(0x2c);
    puffer.zahl16(0);
    puffer.zahl16(0);
    puffer.zahl16(breite);
    puffer.zahl16(hoehe);
    puffer.byte(0);

    puffer.byte(8);
    puffer.block(lzw(indizes, 8));

    await new Promise((weiter) => setTimeout(weiter, 0));
  }

  puffer.byte(0x3b);

  return {
    blob: new Blob([puffer.fertig()], { type: 'image/gif' }),
    breite,
    hoehe,
    rahmen: daten.length,
  };
}
