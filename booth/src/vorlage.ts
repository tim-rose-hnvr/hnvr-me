/**
 * Das Vorlagenmodell — die Datenform hinter jedem Druckbild.
 *
 * Eine Vorlage beschreibt ein Blatt und die Felder darauf. Der Renderer kennt
 * keine festen Layouts mehr; was gedruckt wird, steht in den Daten. Genau
 * dieselben Daten bearbeitet der Booth-Editor, deshalb ist die Vorschau dort
 * kein Bild von etwas Ähnlichem, sondern das Druckbild selbst.
 *
 * Maße bei 300 dpi:
 *   Blatt „foto"      10×15 cm → 1200 × 1800
 *   Blatt „streifen"   5×15 cm →  600 × 1800
 *
 * Feldkoordinaten sind Anteile des Blattes (0..1). Schriftgrößen sind
 * Blattpunkte, also dieselbe Einheit wie die Blattmaße — ein 46er Titel ist auf
 * jedem Blatt gleich groß, unabhängig davon, wie breit das Blatt ist.
 */

export type Blattart = 'foto' | 'streifen';

export const BLATT: Record<
  Blattart,
  { breite: number; hoehe: number; mmBreite: number; mmHoehe: number; name: string }
> = {
  foto: { breite: 1200, hoehe: 1800, mmBreite: 100, mmHoehe: 150, name: '10 × 15 cm' },
  streifen: { breite: 600, hoehe: 1800, mmBreite: 50, mmHoehe: 150, name: '5 × 15 cm' },
};

export type Feldart = 'bild' | 'text' | 'flaeche' | 'logo';
export type Ausrichtung = 'links' | 'mitte' | 'rechts';
export type Schriftart = 'anzeige' | 'mono';

export type Feld = {
  id: string;
  art: Feldart;
  /** Anteile des Blattes, 0..1. */
  x: number;
  y: number;
  b: number;
  h: number;
  /** Text mit Platzhaltern, siehe PLATZHALTER. */
  text?: string;
  groesse?: number;
  gewicht?: number;
  schrift?: Schriftart;
  ausrichtung?: Ausrichtung;
  versalien?: boolean;
  /** Farbe für Text, Füllung für Flächen. */
  farbe?: string;
  linie?: string;
  linienstaerke?: number;
  radius?: number;
};

export type Vorlage = {
  id: string;
  name: string;
  blatt: Blattart;
  papier: string;
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
    .replaceAll('{zeit}', werte.zeit)
    .replaceAll('{box}', werte.box)
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

/** Zählt die Bildfelder — so viele Aufnahmen nimmt die Vorlage auf. */
export function bildfelder(v: Vorlage): number {
  return v.felder.filter((f) => f.art === 'bild').length;
}

export function neueFeldKennung(): string {
  return 'f' + Math.random().toString(36).slice(2, 9);
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

/** Zeichnet ein Bild formatfüllend in ein Feld, ohne es zu verzerren. */
function fuelleFeld(
  stift: CanvasRenderingContext2D,
  bild: CanvasImageSource,
  quelleBreite: number,
  quelleHoehe: number,
  x: number,
  y: number,
  breite: number,
  hoehe: number,
  radius: number
): void {
  const skala = Math.max(breite / quelleBreite, hoehe / quelleHoehe);
  const zielBreite = quelleBreite * skala;
  const zielHoehe = quelleHoehe * skala;

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

/** Platzhalter für ein Bildfeld ohne Aufnahme — schraffiert, nicht leer. */
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

function schriftFamilie(art: Schriftart | undefined): string {
  return art === 'mono'
    ? `'IBM Plex Mono', ui-monospace, monospace`
    : `Archivo, 'Archivo Variable', system-ui, sans-serif`;
}

/** Bricht Text auf die Feldbreite um. Leere Zeilen bleiben erhalten. */
function umbreche(
  stift: CanvasRenderingContext2D,
  text: string,
  breite: number
): string[] {
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
  stift.fillStyle = feld.farbe ?? '#17171c';
  stift.font = `${feld.gewicht ?? 700} ${groesse}px ${schriftFamilie(feld.schrift)}`;
  stift.textBaseline = 'top';

  const zeilen = umbreche(stift, text, b);
  const zeilenhoehe = Math.round(groesse * 1.22);
  const block = zeilen.length * zeilenhoehe;
  // Senkrecht mittig im Feld — so bleibt eine Zeile mehr oder weniger ruhig.
  let oben = y + Math.max(0, (h - block) / 2);

  const links = feld.ausrichtung === 'links';
  const rechts = feld.ausrichtung === 'rechts';
  stift.textAlign = links ? 'left' : rechts ? 'right' : 'center';
  const anker = links ? x : rechts ? x + b : x + b / 2;

  zeilen.forEach((zeile) => {
    stift.fillText(zeile, anker, oben);
    oben += zeilenhoehe;
  });
  stift.restore();
}

/**
 * Zeichnet eine Vorlage. `bilder` werden der Reihe nach in die Bildfelder
 * gesetzt; sind es weniger, wiederholt sich die Reihe. Fehlt jedes Bild,
 * erscheint der Platzhalter — für die Vorschau im Editor.
 */
export function zeichneVorlage(
  v: Vorlage,
  bilder: CanvasImageSource[],
  werte: Werte,
  logobild?: CanvasImageSource | null
): HTMLCanvasElement {
  const masse = BLATT[v.blatt];
  const flaeche = document.createElement('canvas');
  flaeche.width = masse.breite;
  flaeche.height = masse.hoehe;
  const stift = stiftVon(flaeche);

  stift.fillStyle = v.papier || '#ffffff';
  stift.fillRect(0, 0, masse.breite, masse.hoehe);

  let bildzaehler = 0;

  v.felder.forEach((feld) => {
    const x = feld.x * masse.breite;
    const y = feld.y * masse.hoehe;
    const b = feld.b * masse.breite;
    const h = feld.h * masse.hoehe;
    const radius = feld.radius ?? 0;

    if (feld.art === 'flaeche') {
      if (feld.farbe && feld.farbe !== 'transparent') {
        stift.fillStyle = feld.farbe;
        pfadRechteck(stift, x, y, b, h, radius);
        stift.fill();
      }
      if (feld.linie && (feld.linienstaerke ?? 0) > 0) {
        stift.strokeStyle = feld.linie;
        stift.lineWidth = feld.linienstaerke ?? 2;
        pfadRechteck(stift, x, y, b, h, radius);
        stift.stroke();
      }
      return;
    }

    if (feld.art === 'bild') {
      const nummer = bildzaehler++;
      const bild = bilder.length ? bilder[nummer % bilder.length]! : null;
      if (bild) {
        const q = masseVon(bild);
        fuelleFeld(stift, bild, q.breite, q.hoehe, x, y, b, h, radius);
      } else {
        zeichnePlatzhalter(stift, x, y, b, h, radius, `Bild ${nummer + 1}`);
      }
      return;
    }

    if (feld.art === 'logo') {
      if (logobild) {
        const q = masseVon(logobild);
        const skala = Math.min(b / q.breite, h / q.hoehe);
        stift.drawImage(
          logobild,
          x + (b - q.breite * skala) / 2,
          y + (h - q.hoehe * skala) / 2,
          q.breite * skala,
          q.hoehe * skala
        );
      } else {
        zeichnePlatzhalter(stift, x, y, b, h, radius, 'Logo');
      }
      return;
    }

    zeichneText(stift, feld, werte, x, y, b, h);
  });

  return flaeche;
}

function masseVon(bild: CanvasImageSource): { breite: number; hoehe: number } {
  const q = bild as { width?: number; height?: number; videoWidth?: number; videoHeight?: number };
  return {
    breite: q.width ?? q.videoWidth ?? 1,
    hoehe: q.height ?? q.videoHeight ?? 1,
  };
}

/* ------------------------------------------------------------------ */
/* Standardvorlagen                                                    */
/* ------------------------------------------------------------------ */

/**
 * Die mitgelieferten Vorlagen. Sie sind der Ausgangspunkt jeder eigenen —
 * im Editor wird kopiert, nicht bei Null angefangen.
 */
export function standardVorlagen(): Vorlage[] {
  return [
    {
      id: 'foto-klassisch',
      name: 'Foto — Klassisch',
      blatt: 'foto',
      papier: '#ffffff',
      felder: [
        { id: 'f1', art: 'bild', x: 0.05, y: 0.0333, b: 0.9, h: 0.45, radius: 0 },
        {
          id: 'f2',
          art: 'text',
          x: 0.08,
          y: 0.51,
          b: 0.84,
          h: 0.05,
          text: '{event}',
          groesse: 46,
          gewicht: 800,
          schrift: 'anzeige',
          ausrichtung: 'mitte',
          versalien: false,
          farbe: '#17171c',
        },
        {
          id: 'f3',
          art: 'text',
          x: 0.08,
          y: 0.5622,
          b: 0.84,
          h: 0.03,
          text: '{datum}',
          groesse: 22,
          gewicht: 500,
          schrift: 'mono',
          ausrichtung: 'mitte',
          versalien: true,
          farbe: 'rgba(0,0,0,0.45)',
        },
      ],
    },
    {
      id: 'foto-rand',
      name: 'Foto — Randlos mit Balken',
      blatt: 'foto',
      papier: '#0b0b0d',
      felder: [
        { id: 'g1', art: 'bild', x: 0, y: 0, b: 1, h: 0.82 },
        { id: 'g2', art: 'flaeche', x: 0, y: 0.82, b: 1, h: 0.18, farbe: '#0b0b0d' },
        {
          id: 'g3',
          art: 'text',
          x: 0.06,
          y: 0.845,
          b: 0.88,
          h: 0.06,
          text: '{event}',
          groesse: 52,
          gewicht: 800,
          schrift: 'anzeige',
          ausrichtung: 'mitte',
          versalien: true,
          farbe: '#f6f4f1',
        },
        {
          id: 'g4',
          art: 'text',
          x: 0.06,
          y: 0.915,
          b: 0.88,
          h: 0.04,
          text: '{datum} · {zeit}',
          groesse: 22,
          gewicht: 500,
          schrift: 'mono',
          ausrichtung: 'mitte',
          versalien: true,
          farbe: '#f2b23e',
        },
      ],
    },
    {
      id: 'streifen-klassisch',
      name: 'Streifen — Klassisch',
      blatt: 'streifen',
      papier: '#ffffff',
      felder: [
        { id: 's1', art: 'bild', x: 0.0567, y: 0.0189, b: 0.8867, h: 0.2546 },
        { id: 's2', art: 'bild', x: 0.0567, y: 0.2846, b: 0.8867, h: 0.2546 },
        { id: 's3', art: 'bild', x: 0.0567, y: 0.5502, b: 0.8867, h: 0.2546 },
        {
          id: 's4',
          art: 'text',
          x: 0.08,
          y: 0.836,
          b: 0.84,
          h: 0.05,
          text: '{event}',
          groesse: 33,
          gewicht: 800,
          schrift: 'anzeige',
          ausrichtung: 'mitte',
          farbe: '#17171c',
        },
        {
          id: 's5',
          art: 'text',
          x: 0.08,
          y: 0.892,
          b: 0.84,
          h: 0.03,
          text: '{datum}',
          groesse: 16,
          gewicht: 500,
          schrift: 'mono',
          ausrichtung: 'mitte',
          versalien: true,
          farbe: 'rgba(0,0,0,0.45)',
        },
      ],
    },
    {
      id: 'streifen-dunkel',
      name: 'Streifen — Dunkel',
      blatt: 'streifen',
      papier: '#0b0b0d',
      felder: [
        { id: 'd1', art: 'bild', x: 0.05, y: 0.0222, b: 0.9, h: 0.2528 },
        { id: 'd2', art: 'bild', x: 0.05, y: 0.2917, b: 0.9, h: 0.2528 },
        { id: 'd3', art: 'bild', x: 0.05, y: 0.5611, b: 0.9, h: 0.2528 },
        {
          id: 'd4',
          art: 'flaeche',
          x: 0.05,
          y: 0.8361,
          b: 0.9,
          h: 0.0044,
          farbe: '#f2b23e',
        },
        {
          id: 'd5',
          art: 'text',
          x: 0.06,
          y: 0.858,
          b: 0.88,
          h: 0.05,
          text: '{event}',
          groesse: 32,
          gewicht: 800,
          schrift: 'anzeige',
          ausrichtung: 'mitte',
          versalien: true,
          farbe: '#f6f4f1',
        },
        {
          id: 'd6',
          art: 'text',
          x: 0.06,
          y: 0.912,
          b: 0.88,
          h: 0.03,
          text: '{datum} · {box}',
          groesse: 15,
          gewicht: 500,
          schrift: 'mono',
          ausrichtung: 'mitte',
          versalien: true,
          farbe: 'rgba(246,244,241,0.6)',
        },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Prüfen                                                              */
/* ------------------------------------------------------------------ */

/**
 * Prüft eine eingelesene Vorlage, bevor sie übernommen wird. Eine Datei aus
 * fremder Hand darf die Box nicht in einen Zustand bringen, in dem sie nichts
 * mehr drucken kann.
 */
export function pruefeVorlage(roh: unknown): { vorlage: Vorlage } | { fehler: string } {
  if (!roh || typeof roh !== 'object') return { fehler: 'Die Datei enthält keine Vorlage.' };
  const v = roh as Partial<Vorlage>;
  if (typeof v.name !== 'string' || !v.name.trim()) return { fehler: 'Der Vorlage fehlt ein Name.' };
  if (v.blatt !== 'foto' && v.blatt !== 'streifen')
    return { fehler: 'Unbekanntes Blattformat — erlaubt sind „foto" und „streifen".' };
  if (!Array.isArray(v.felder) || v.felder.length === 0)
    return { fehler: 'Die Vorlage hat keine Felder.' };

  const arten: Feldart[] = ['bild', 'text', 'flaeche', 'logo'];
  const felder: Feld[] = [];
  for (const f of v.felder as Partial<Feld>[]) {
    if (!f || typeof f !== 'object' || !arten.includes(f.art as Feldart))
      return { fehler: 'Ein Feld hat eine unbekannte Art.' };
    const zahlen = [f.x, f.y, f.b, f.h];
    if (zahlen.some((z) => typeof z !== 'number' || !Number.isFinite(z)))
      return { fehler: 'Ein Feld hat unbrauchbare Maße.' };
    felder.push({
      ...(f as Feld),
      id: typeof f.id === 'string' && f.id ? f.id : neueFeldKennung(),
      x: klemme(f.x as number),
      y: klemme(f.y as number),
      b: klemme(f.b as number, 0.01),
      h: klemme(f.h as number, 0.01),
    });
  }
  if (!felder.some((f) => f.art === 'bild'))
    return { fehler: 'Ohne Bildfeld kann die Vorlage keine Aufnahme zeigen.' };

  return {
    vorlage: {
      id: typeof v.id === 'string' && v.id ? v.id : 'v' + Math.random().toString(36).slice(2, 9),
      name: v.name.slice(0, 60),
      blatt: v.blatt,
      papier: typeof v.papier === 'string' ? v.papier : '#ffffff',
      logo: typeof v.logo === 'string' && v.logo.startsWith('data:image/') ? v.logo : undefined,
      felder,
    },
  };
}

export function klemme(wert: number, mindest = 0): number {
  return Math.min(1, Math.max(mindest, wert));
}
