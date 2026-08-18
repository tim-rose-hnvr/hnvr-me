/**
 * Einstellungen der Box — eine Quelle, nicht zwei.
 *
 * Bis hierher lagen sie im `localStorage` der Oberfläche, während der Server
 * seine eigenen hielt. Zwei Listen derselben Sache laufen auseinander: Wer im
 * Cockpit den Eventnamen änderte, sah ihn auf dem zweiten Bildschirm nicht.
 *
 * Jetzt gilt, was auf der Box steht. Diese Datei ist die Übersetzung zwischen
 * ihrem Modell (gewachsen, technisch geordnet) und unserer Oberfläche: Was
 * dort `vorschau.spiegeln` heißt, heißt hier `spiegeln`. Übersetzt wird an
 * genau einer Stelle, damit die Namen in der Oberfläche unsere bleiben.
 *
 * Ohne Server läuft die Box weiter: Der zuletzt gesehene Stand liegt als
 * Zwischenspeicher daneben. Komfort darf ein Ausfall kosten, Daten nicht.
 */

export type Countdownstil = 'ring' | 'zahl' | 'balken';
/** Bewegung im Attract: ruhig, pulsender Startknopf oder Laufband. */
export type Attractstil = 'ruhe' | 'puls' | 'laufband';

export type Einstellungen = {
  /** Anzeigename der Box, steht in der Kopfleiste. */
  box: string;
  event: string;
  attractTitel: string;
  attractZeile: string;
  laufband: string;
  /** Sekunden bis zur Aufnahme. */
  countdown: number;
  countdownstil: Countdownstil;
  attractstil: Attractstil;
  /** Weicher Übergang zwischen den Schritten. */
  uebergang: boolean;
  /** Sekunden Leerlauf, bis der Booth zum Attract zurückspringt. */
  leerlauf: number;
  /** Sekunden bis „Auto-Weiter" im Ergebnis. */
  autoWeiter: number;
  /** Freigegebene Aufnahmearten. */
  arten: string[];
  spiegeln: boolean;
  blitz: boolean;
  /** Drucken anbieten. */
  druck: boolean;
  /** Drucker, den die Box anspricht. Leer heißt: Druckdialog des Systems. */
  drucker: string;
  doppelstreifen: boolean;
  schnittlinie: boolean;
  /** Höchstzahl Drucke pro Stunde; 0 = ohne Grenze. */
  druckLimitStunde: number;
  loeschfristTage: number;
  /**
   * Kiosk-PIN. Sie steht NICHT mehr hier: Die Box prüft sie selbst
   * (`/api/kiosk/pin`, gesalzene Prüfsumme, Zwangspause nach Fehlversuchen)
   * und gibt sie nie heraus. Dieses Feld sagt nur, ob überhaupt eine gesetzt
   * ist — ohne PIN steht der Kiosk offen, und das soll sichtbar sein.
   */
  kioskGesetzt: boolean;
  /** Adresse, unter der die Box ihre Aufnahmen im Netz anbietet. */
  ausgabeBasis: string;
  /**
   * Das Zeichen des Betreibers, bei der Einrichtung hinterlegt. Es steht auf
   * jedem Blatt, das ein Logofeld hat und keins mitbringt — und auf der
   * Buchungs- und Event-Seite. Eine Quelle, ein Wechsel.
   */
  logo: string | null;
  /** Firmenname für Fußzeilen und Angebote. */
  firma: string;
  /**
   * Freigegebene Kunststile im Ergebnis. Der Betreiber entscheidet, was am
   * Screen zur Wahl steht — eine Firmenfeier will oft nur Schwarzweiß, eine
   * Hochzeit gar nichts. `ohne` gehört immer dazu und steht nicht in der
   * Liste: Es ist kein Stil, sondern deren Abwesenheit.
   */
  effekte: string[];
  /**
   * Freistellung vor dem Tuch. Der Hintergrund ist ein Bild als Data-URL —
   * er liegt auf der Box und geht nie ins Netz.
   */
  greenscreen: { an: boolean; farbe: string; toleranz: number; hintergrund: string | null };
};

import { EFFEKTE, istEffekt } from './effekte';

const ZWISCHENSPEICHER = 'youbooth.einstellungen.stand';

/* Welche Stile es gibt, weiß `effekte.ts` — hier steht nur, dass zunächst
   alle freigegeben sind. „Ohne" ist kein Stil und gehört nicht in die Liste. */
const ALLE_EFFEKTE = EFFEKTE.filter((e) => e.id !== 'ohne').map((e) => e.id);

const STANDARD: Einstellungen = {
  box: 'Box #1',
  event: 'Youbooth Event',
  attractTitel: 'Ein Bild für die Ewigkeit',
  attractZeile: 'Tippen oder per Fernbedienung am Handy auslösen',
  laufband: '3 · 2 · 1 · Cheese · Fotos nur für dieses Event',
  countdown: 3,
  countdownstil: 'ring',
  attractstil: 'laufband',
  uebergang: true,
  leerlauf: 45,
  autoWeiter: 8,
  arten: ['foto', 'streifen', 'boomerang', 'gif'],
  spiegeln: true,
  blitz: true,
  druck: true,
  drucker: '',
  doppelstreifen: false,
  schnittlinie: true,
  druckLimitStunde: 60,
  loeschfristTage: 30,
  kioskGesetzt: false,
  ausgabeBasis: '',
  logo: null,
  firma: '',
  effekte: ALLE_EFFEKTE,
  greenscreen: { an: false, farbe: '#00c800', toleranz: 42, hintergrund: null },
};

/* ------------------------------------------------------------------ */
/* Übersetzung                                                         */
/* ------------------------------------------------------------------ */

/** Die drei Countdown-Stile unserer Oberfläche in der Sprache der Box. */
const COUNTDOWN_HIN: Record<Countdownstil, string> = { ring: 'ring', zahl: 'pop', balken: 'bar' };
const COUNTDOWN_HER: Record<string, Countdownstil> = { ring: 'ring', pop: 'zahl', bar: 'balken' };

type Boxstand = Record<string, unknown>;

function feld<T>(quelle: unknown, pfad: string, ersatz: T): T {
  let stelle: unknown = quelle;
  for (const teil of pfad.split('.')) {
    if (!stelle || typeof stelle !== 'object') return ersatz;
    stelle = (stelle as Record<string, unknown>)[teil];
  }
  return (stelle === undefined || stelle === null ? ersatz : stelle) as T;
}

/** Aus dem Modell der Box unsere Einstellungen. */
export function ausBoxstand(roh: Boxstand): Einstellungen {
  const modi = feld<Record<string, boolean>>(roh, 'modes', {});
  const arten = ['foto', 'streifen', 'boomerang', 'gif'].filter((a) => {
    const schluessel = a === 'foto' ? 'photo' : a === 'streifen' ? 'strip' : a;
    return modi[schluessel] !== false;
  });

  return {
    box: feld(roh, 'boxName', STANDARD.box),
    event: feld(roh, 'eventName', STANDARD.event),
    attractTitel: feld(roh, 'attract.headline', '') || STANDARD.attractTitel,
    attractZeile: feld(roh, 'attract.hint', '') || STANDARD.attractZeile,
    laufband: feld(roh, 'ticker.text', '') || STANDARD.laufband,
    countdown: feld(roh, 'countdown', STANDARD.countdown),
    countdownstil: COUNTDOWN_HER[feld(roh, 'countdownStyle', 'ring')] ?? 'ring',
    attractstil: feld(roh, 'booth.attractstil', STANDARD.attractstil),
    uebergang: feld(roh, 'booth.uebergang', STANDARD.uebergang),
    leerlauf: feld(roh, 'booth.leerlauf', STANDARD.leerlauf),
    autoWeiter: feld(roh, 'booth.autoWeiter', STANDARD.autoWeiter),
    arten: arten.length ? arten : STANDARD.arten,
    spiegeln: feld(roh, 'vorschau.spiegeln', STANDARD.spiegeln),
    blitz: feld(roh, 'booth.blitz', STANDARD.blitz),
    druck: feld(roh, 'printing', STANDARD.druck),
    drucker: feld<string | null>(roh, 'printer', '') ?? '',
    doppelstreifen: feld(roh, 'druck.streifenDoppelt', STANDARD.doppelstreifen),
    schnittlinie: feld(roh, 'druck.schnittlinie', STANDARD.schnittlinie),
    druckLimitStunde: feld(roh, 'druck.maxProStunde', STANDARD.druckLimitStunde),
    loeschfristTage: feld(roh, 'booth.loeschfristTage', STANDARD.loeschfristTage),
    kioskGesetzt: feld(roh, 'kiosk.gesetzt', false),
    ausgabeBasis: STANDARD.ausgabeBasis,
    logo: feld<string | null>(roh, 'betreiber.logo', null),
    firma: feld(roh, 'betreiber.firma', ''),
    effekte: erlaubteEffekte(feld<unknown>(roh, 'effekte.erlaubt', null)),
    greenscreen: {
      an: feld(roh, 'greenscreen.enabled', false),
      farbe: feld(roh, 'greenscreen.key', STANDARD.greenscreen.farbe),
      toleranz: feld(roh, 'greenscreen.similarity', STANDARD.greenscreen.toleranz),
      hintergrund: feld<string | null>(roh, 'greenscreen.background', null),
    },
  };
}

/**
 * Eine fehlende Liste heißt „alle" — eine leere heißt „keine". Der
 * Unterschied ist wichtig: Eine Box, die das Feld noch nicht kennt, soll
 * die Stile zeigen; ein Betreiber, der alle abgewählt hat, soll sie
 * loswerden können.
 */
function erlaubteEffekte(roh: unknown): string[] {
  if (!Array.isArray(roh)) return [...ALLE_EFFEKTE];
  return roh.filter((e) => istEffekt(e) && e !== 'ohne');
}

/** Und zurück: nur die Felder, die die Box wirklich annimmt. */
export function alsBoxstand(e: Einstellungen): Boxstand {
  return {
    boxName: e.box,
    eventName: e.event,
    attract: { headline: e.attractTitel, hint: e.attractZeile },
    ticker: { enabled: e.attractstil === 'laufband', text: e.laufband },
    countdown: e.countdown,
    countdownStyle: COUNTDOWN_HIN[e.countdownstil],
    modes: {
      photo: e.arten.includes('foto'),
      strip: e.arten.includes('streifen'),
      boomerang: e.arten.includes('boomerang'),
      gif: e.arten.includes('gif'),
    },
    vorschau: { spiegeln: e.spiegeln },
    /* Der Greenscreen-Hintergrund ist ein Bild von bis zu fünf Megabyte.
       Er steht hier bewusst NICHT: Sonst schöbe jedes Sichern des Cockpits
       dasselbe Bild erneut über die Leitung, ohne dass sich etwas geändert
       hätte. Wer ihn setzt, tut das an der Stelle, an der er ihn auswählt. */
    effekte: { erlaubt: e.effekte },
    printing: e.druck,
    printer: e.drucker || null,
    druck: {
      streifenDoppelt: e.doppelstreifen,
      schnittlinie: e.schnittlinie,
      maxProStunde: e.druckLimitStunde,
    },
    booth: {
      attractstil: e.attractstil,
      uebergang: e.uebergang,
      leerlauf: e.leerlauf,
      autoWeiter: e.autoWeiter,
      blitz: e.blitz,
      loeschfristTage: e.loeschfristTage,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Stand halten                                                        */
/* ------------------------------------------------------------------ */

let stand: Einstellungen = { ...STANDARD };

function merke(roh: Boxstand): void {
  try {
    localStorage.setItem(ZWISCHENSPEICHER, JSON.stringify(roh));
  } catch {
    // Ohne Zwischenspeicher läuft die Box weiter, nur ohne Rückfall.
  }
}

/**
 * Holt die Einstellungen von der Box.
 *
 * `geraet` heißt: die des Geräts, nicht die eines laufenden Events darüber.
 * Das Cockpit bearbeitet das Gerät und muss die unvermischten sehen — sonst
 * schriebe der Betreiber beim nächsten Sichern die Eventwerte in seine Box
 * und hätte sie nach der Feier für immer.
 */
export async function holeEinstellungen(
  geraet = false
): Promise<'box' | 'zwischenspeicher' | 'vorgabe'> {
  try {
    const antwort = await fetch('/api/settings' + (geraet ? '?geraet=1' : ''));
    if (!antwort.ok) throw new Error(String(antwort.status));
    const roh = (await antwort.json()) as Boxstand;
    stand = ausBoxstand(roh);
    merke(roh);
    return 'box';
  } catch {
    try {
      const gemerkt = localStorage.getItem(ZWISCHENSPEICHER);
      if (gemerkt) {
        stand = ausBoxstand(JSON.parse(gemerkt) as Boxstand);
        return 'zwischenspeicher';
      }
    } catch {
      // dann eben die Vorgaben
    }
    return 'vorgabe';
  }
}

/** Nachricht der Box, dass sich die Einstellungen geändert haben. */
export function einstellungenGeaendert(roh: Boxstand): void {
  stand = ausBoxstand(roh);
  merke(roh);
}

/** Der geltende Stand — ohne Warten, damit die Oberfläche zeichnen kann. */
export function ladeEinstellungen(): Einstellungen {
  return stand;
}

/** Schreibt die Einstellungen auf die Box. */
export async function sichereEinstellungen(e: Einstellungen): Promise<boolean> {
  stand = { ...e };
  try {
    const antwort = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alsBoxstand(e)),
    });
    if (!antwort.ok) return false;
    const daten = (await antwort.json()) as { settings?: Boxstand };
    if (daten.settings) {
      stand = ausBoxstand(daten.settings);
      merke(daten.settings);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Schreibt die Freistellung auf die Box — eigener Weg, weil der Hintergrund
 * ein Bild ist. Er hängt bewusst nicht an `alsBoxstand`: Sonst schöbe jedes
 * Sichern einer beliebigen Einstellung dasselbe Bild erneut über die
 * Leitung, und auf einer Box mit schwachem Netz merkt man das.
 */
export async function sichereGreenscreen(
  teil: Einstellungen['greenscreen']
): Promise<boolean> {
  try {
    const antwort = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        greenscreen: {
          enabled: teil.an,
          key: teil.farbe,
          similarity: teil.toleranz,
          background: teil.hintergrund,
        },
      }),
    });
    if (!antwort.ok) return false;
    const daten = (await antwort.json()) as { settings?: Boxstand };
    if (daten.settings) {
      stand = ausBoxstand(daten.settings);
      merke(daten.settings);
    }
    return true;
  } catch {
    return false;
  }
}

export function standardEinstellungen(): Einstellungen {
  return { ...STANDARD };
}

/**
 * Prüft die Kiosk-PIN auf der Box. Die Prüfsumme verlässt den Rechner nie,
 * und nach einem Fehlversuch legt die Box eine kurze Zwangspause ein —
 * vierstellige Zahlen sind sonst in Sekunden durchprobiert.
 */
export async function pinStimmt(pin: string): Promise<{ ok: boolean; grund?: string }> {
  try {
    const antwort = await fetch('/api/kiosk/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (antwort.ok) return { ok: true };
    if (antwort.status === 429) return { ok: false, grund: 'Zu viele Versuche — kurz warten.' };
    return { ok: false, grund: 'Falsche PIN.' };
  } catch {
    return { ok: false, grund: 'Die Box antwortet nicht.' };
  }
}

/**
 * Setzt oder entfernt die Kiosk-PIN. Sie geht einmal im Klartext an die Box
 * und wird dort sofort gesalzen gehasht — zurück kommt sie nie. Ein leerer
 * Wert entfernt sie und macht den Kiosk wieder offen.
 */
export async function setzePin(pin: string): Promise<{ ok: boolean; grund?: string }> {
  const roh = pin.trim();
  if (roh && !/^\d{4,12}$/.test(roh)) {
    return { ok: false, grund: 'Die PIN braucht vier bis zwölf Ziffern.' };
  }
  try {
    const antwort = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kiosk: { pin: roh, enabled: !!roh } }),
    });
    if (!antwort.ok) return { ok: false, grund: 'Die Box hat die PIN nicht angenommen.' };
    const daten = (await antwort.json()) as { settings?: Boxstand };
    if (daten.settings) {
      stand = ausBoxstand(daten.settings);
      merke(daten.settings);
    }
    return { ok: true };
  } catch {
    return { ok: false, grund: 'Die Box antwortet nicht.' };
  }
}
