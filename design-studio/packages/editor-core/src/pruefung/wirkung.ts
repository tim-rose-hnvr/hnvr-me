/**
 * Wirkungsprüfung — ob das Material seinen Zweck erfüllt.
 *
 * `druck.ts` prüft, ob die **Datei** in Ordnung ist: Anschnitt, Auflösung,
 * Haarlinien. Das prüft jede Druckerei auch. Hier wird geprüft, ob das
 * **Ergebnis** funktioniert — und das prüft sonst niemand:
 *
 * - Ist der Text vor seinem *tatsächlichen* Untergrund lesbar? Nicht vor dem
 *   deklarierten, sondern vor dem, was wirklich dahinter liegt.
 * - Ist die Schrift auf die gedachte Entfernung groß genug? Ein A1-Plakat wird
 *   aus drei Metern gelesen, nicht aus vierzig Zentimetern.
 * - Liegt Inhalt unter den Bedienelementen der Plattform? Instagram legt oben
 *   und unten eigene Flächen über die Story.
 * - Steht mehr Text da, als auf diese Entfernung je gelesen wird?
 * - Ist die Aussage überhaupt noch gültig, oder hängt da ein totes Plakat?
 *
 * Alle Schwellen sind Faustregeln aus der Praxis, keine Normen. Sie stehen als
 * benannte Konstanten hier, damit sie diskutierbar und änderbar sind statt
 * irgendwo in einer Bedingung zu verschwinden.
 */

import type { Aussage } from '../aussage/aussage.js';
import { tageBisTermin } from '../aussage/aussage.js';
import type { Entwurf, Entwurfselement, Farbe, Seite, TextElement } from '../modell/entwurf.js';
import { pxZuMm } from '../modell/masse.js';

export type Wirkungsschwere = 'fehler' | 'warnung' | 'hinweis';

export interface Wirkungsbefund {
  regel: string;
  meldung: string;
  schwere: Wirkungsschwere;
  seiteId: string;
  elementId: string | null;
  /** Kurzform für die Anzeige neben dem Element, etwa „2,1:1". */
  messwert: string | null;
}

// --- Kontrast ---------------------------------------------------------------

/** WCAG 2.1: 4,5:1 für Fließtext, 3:1 für große Schrift. */
export const KONTRAST_NORMAL = 4.5;
export const KONTRAST_GROSS = 3;
/** Ab hier gilt Schrift als groß: 18,66 px bei 96 dpi, also ~14 pt fett / 18 pt normal. */
export const GROSSE_SCHRIFT_PT = 18;

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexZuRgb(hex: string): Rgb | null {
  const sauber = hex.trim().toLowerCase().replace('#', '');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(sauber)) return null;
  return {
    r: Number.parseInt(sauber.slice(0, 2), 16),
    g: Number.parseInt(sauber.slice(2, 4), 16),
    b: Number.parseInt(sauber.slice(4, 6), 16),
  };
}

/** Relative Leuchtdichte nach WCAG 2.1. */
export function leuchtdichte(farbe: Rgb): number {
  const kanal = (wert: number): number => {
    const anteil = wert / 255;
    return anteil <= 0.04045 ? anteil / 12.92 : ((anteil + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * kanal(farbe.r) + 0.7152 * kanal(farbe.g) + 0.0722 * kanal(farbe.b);
}

export function kontrastverhaeltnis(vorne: Rgb, hinten: Rgb): number {
  const a = leuchtdichte(vorne);
  const b = leuchtdichte(hinten);
  const hell = Math.max(a, b);
  const dunkel = Math.min(a, b);
  return (hell + 0.05) / (dunkel + 0.05);
}

function ueberschneidet(
  a: { x: number; y: number; breite: number; hoehe: number },
  b: { x: number; y: number; breite: number; hoehe: number },
): boolean {
  return a.x < b.x + b.breite && b.x < a.x + a.breite && a.y < b.y + b.hoehe && b.y < a.y + a.hoehe;
}

/**
 * Der Untergrund, der **tatsächlich** hinter einem Element liegt.
 *
 * Nicht die deklarierte Seitenfarbe: was zählt, ist die oberste deckende
 * Fläche, die das Element überlappt. Weiße Schrift auf weißem Grund ist der
 * häufigste Fehler dieser Art, und er entsteht fast immer dadurch, dass jemand
 * einen farbigen Balken verschiebt, auf dem die Schrift lag.
 */
export function tatsaechlicherUntergrund(
  seite: Seite,
  element: Entwurfselement,
): { farbe: Farbe; quelle: string } | null {
  const rahmen = { x: element.x, y: element.y, breite: element.breite, hoehe: element.hoehe };

  // Von vorn nach hinten suchen, aber nur unterhalb des Elements selbst.
  const eigenerIndex = seite.elemente.findIndex((e) => e.id === element.id);
  const darunter = eigenerIndex < 0 ? seite.elemente : seite.elemente.slice(0, eigenerIndex);

  for (const kandidat of [...darunter].reverse()) {
    if (!kandidat.sichtbar || kandidat.deckkraft < 0.9) continue;
    if (kandidat.typ !== 'form' || kandidat.fuellung === null) continue;
    if (!ueberschneidet(rahmen, kandidat)) continue;
    return { farbe: kandidat.fuellung, quelle: kandidat.name };
  }

  if (seite.hintergrund !== null) return { farbe: seite.hintergrund, quelle: 'Seitenhintergrund' };
  return null;
}

// --- Lesbarkeit auf Entfernung ---------------------------------------------

/**
 * Faustregel aus der Beschilderung: lesbar auf etwa das **250-fache der
 * Versalhöhe**, bequem auf das 125-fache. Eine Versalhöhe von 12 mm trägt
 * demnach gerade drei Meter, bequem eineinhalb.
 */
export const LESBAR_FAKTOR = 250;
export const BEQUEM_FAKTOR = 125;

/** Anteil der Schriftgröße, der auf die Versalhöhe entfällt. Grotesken: rund 0,7. */
export const VERSALANTEIL = 0.7;

export function versalhoeheMm(schriftGroesse: number, dpi: number): number {
  return pxZuMm(schriftGroesse * VERSALANTEIL, dpi);
}

/** Entfernung in Metern, auf die eine Schriftgröße gerade noch trägt. */
export function reichweiteMeter(schriftGroesse: number, dpi: number): number {
  return (versalhoeheMm(schriftGroesse, dpi) * LESBAR_FAKTOR) / 1000;
}

// --- Sperrflächen der Plattformen ------------------------------------------

/**
 * Flächen, die die Plattform mit eigenen Bedienelementen überdeckt, als Anteil
 * der Formathöhe. Näherungswerte — die Plattformen ändern das ohne Ankündigung,
 * deshalb stehen sie hier zentral und nicht verstreut in Bedingungen.
 */
export interface Sperrflaeche {
  name: string;
  /** Anteile 0..1, jeweils von der jeweiligen Kante aus. */
  oben: number;
  unten: number;
}

export const SPERRFLAECHEN: Record<string, Sperrflaeche> = {
  'instagram-story': { name: 'Instagram Story', oben: 0.14, unten: 0.2 },
  'instagram-post': { name: 'Instagram Beitrag', oben: 0, unten: 0.06 },
  'linkedin-post': { name: 'LinkedIn Beitrag', oben: 0, unten: 0 },
  'facebook-post': { name: 'Facebook Beitrag', oben: 0, unten: 0 },
};

// --- Textmenge --------------------------------------------------------------

/**
 * Ab wie vielen Zeichen ein Fernwirkungsformat überfrachtet ist. Ein Plakat
 * wird im Vorbeigehen gelesen; alles über etwa zwanzig Wörtern erreicht
 * niemanden mehr.
 */
export const ZEICHEN_FERNWIRKUNG = 140;
export const FERNWIRKUNG_AB_METER = 1.5;

export interface Wirkungsoptionen {
  /** Gedachter Leseabstand in Metern. Plakat 3, Aushang 0,5, Bildschirm 0,4. */
  leseabstandMeter?: number;
  /** Schlüssel aus `SPERRFLAECHEN`, wenn das Format auf einer Plattform läuft. */
  plattform?: string;
  /** Für die Haltbarkeitsprüfung. */
  aussage?: Aussage;
  heute?: Date;
}

function alleTexte(seite: Seite): TextElement[] {
  const treffer: TextElement[] = [];
  const sammle = (elemente: readonly Entwurfselement[]): void => {
    for (const element of elemente) {
      if (element.typ === 'text' && element.sichtbar) treffer.push(element);
      if (element.typ === 'gruppe') sammle(element.kinder);
    }
  };
  sammle(seite.elemente);
  return treffer;
}

export function pruefeWirkung(entwurf: Entwurf, optionen: Wirkungsoptionen = {}): Wirkungsbefund[] {
  const befunde: Wirkungsbefund[] = [];
  const dpi = entwurf.masse.dpi;
  const abstand = optionen.leseabstandMeter ?? 0.4;
  const sperre = optionen.plattform === undefined ? null : SPERRFLAECHEN[optionen.plattform];

  const melde = (
    regel: string,
    meldung: string,
    schwere: Wirkungsschwere,
    seiteId: string,
    elementId: string | null,
    messwert: string | null = null,
  ): void => {
    befunde.push({ regel, meldung, schwere, seiteId, elementId, messwert });
  };

  // --- Haltbarkeit: gilt für den ganzen Entwurf ----------------------------
  if (optionen.aussage !== undefined) {
    const tage = tageBisTermin(optionen.aussage, optionen.heute ?? new Date());
    const seiteId = entwurf.seiten[0]?.id ?? '';
    if (tage !== null && tage < 0) {
      melde(
        'abgelaufen',
        `Der Termin liegt ${Math.abs(tage)} Tage zurück. Dieses Material ist nicht hässlich, sondern falsch.`,
        'fehler',
        seiteId,
        null,
        `${tage} Tage`,
      );
    } else if (tage !== null && tage <= 3) {
      melde(
        'laeuft-ab',
        `Nur noch ${tage} Tage bis zum Termin — für Druck und Versand wird es knapp.`,
        'warnung',
        seiteId,
        null,
        `${tage} Tage`,
      );
    }
  }

  for (const seite of entwurf.seiten) {
    const texte = alleTexte(seite);

    // --- Kontrast auf dem tatsächlichen Untergrund ------------------------
    for (const text of texte) {
      const untergrund = tatsaechlicherUntergrund(seite, text);
      const vorne = hexZuRgb(text.farbe);
      const hinten = untergrund === null ? null : hexZuRgb(untergrund.farbe);

      if (vorne === null || hinten === null) {
        melde(
          'kontrast-unbekannt',
          `Für „${text.name}" lässt sich kein Untergrund bestimmen — der Kontrast ist ungeprüft.`,
          'hinweis',
          seite.id,
          text.id,
        );
        continue;
      }

      const verhaeltnis = kontrastverhaeltnis(vorne, hinten);
      const groessePt = (text.schriftGroesse / dpi) * 72;
      const schwelle = groessePt >= GROSSE_SCHRIFT_PT ? KONTRAST_GROSS : KONTRAST_NORMAL;

      if (verhaeltnis < schwelle) {
        melde(
          'kontrast',
          `„${text.name}" steht mit ${verhaeltnis.toFixed(1)}:1 auf ${untergrund?.quelle} — ` +
            `nötig sind ${schwelle}:1. Auf einem Bildschirm bei Sonne ist das unlesbar.`,
          verhaeltnis < schwelle * 0.6 ? 'fehler' : 'warnung',
          seite.id,
          text.id,
          `${verhaeltnis.toFixed(1)}:1`,
        );
      }
    }

    // --- Lesbarkeit auf die gedachte Entfernung ---------------------------
    for (const text of texte) {
      const reichweite = reichweiteMeter(text.schriftGroesse, dpi);
      if (reichweite >= abstand) continue;

      const noetig = (abstand * 1000) / LESBAR_FAKTOR;
      melde(
        'lesbarkeit',
        `„${text.name}" trägt ${reichweite.toFixed(1)} m, gelesen wird aus ${abstand} m. ` +
          `Nötig wären ${noetig.toFixed(0)} mm Versalhöhe statt ${versalhoeheMm(text.schriftGroesse, dpi).toFixed(1)} mm.`,
        reichweite < abstand * 0.5 ? 'fehler' : 'warnung',
        seite.id,
        text.id,
        `${reichweite.toFixed(1)} m`,
      );
    }

    // --- Sperrflächen der Plattform ---------------------------------------
    if (sperre !== null && sperre !== undefined) {
      const obenBis = entwurf.masse.hoehe * sperre.oben;
      const untenAb = entwurf.masse.hoehe * (1 - sperre.unten);

      for (const element of seite.elemente) {
        if (!element.sichtbar || element.typ === 'form') continue;
        const oben = element.y;
        const unten = element.y + element.hoehe;

        if (oben < obenBis || unten > untenAb) {
          melde(
            'sperrflaeche',
            `„${element.name}" liegt unter den Bedienelementen von ${sperre.name}. ` +
              'Die Plattform legt dort eigene Flächen darüber.',
            'warnung',
            seite.id,
            element.id,
          );
        }
      }
    }

    // --- Textmenge gegen Entfernung ---------------------------------------
    if (abstand >= FERNWIRKUNG_AB_METER) {
      const zeichen = texte.reduce((summe, t) => summe + t.inhalt.length, 0);
      if (zeichen > ZEICHEN_FERNWIRKUNG) {
        melde(
          'textmenge',
          `${zeichen} Zeichen auf ${abstand} m Entfernung. Über ${ZEICHEN_FERNWIRKUNG} liest das im Vorbeigehen niemand.`,
          'warnung',
          seite.id,
          null,
          `${zeichen} Zeichen`,
        );
      }
    }
  }

  return befunde;
}

export function nurWirkungsfehler(befunde: readonly Wirkungsbefund[]): Wirkungsbefund[] {
  return befunde.filter((b) => b.schwere === 'fehler');
}
