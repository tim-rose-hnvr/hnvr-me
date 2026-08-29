/**
 * Verteiler und Segmente.
 *
 * Ein **Verteiler** ist eine Liste, in die man sich einträgt: „Newsletter",
 * „Nur Termine". Er trägt eine eigene Einwilligung — wer den Terminverteiler
 * abbestellt, bleibt im Newsletter.
 *
 * Ein **Segment** ist eine Frage an den Bestand: „bestätigt, seit dem 1. Juni
 * dabei, hat in den letzten 90 Tagen nichts geöffnet". Es wird bei jedem
 * Versand neu beantwortet und nirgends gespeichert.
 *
 * Die wichtigste Eigenschaft steht nicht im Regelwerk, sondern in
 * `empfaengerFuer`: **ein Segment kann keine Unbestätigten und keine
 * Gesperrten enthalten.** Nicht, weil niemand solche Regeln schriebe, sondern
 * weil das Segment sie gar nicht erst sehen darf. Eine Zusage, die von der
 * Sorgfalt dessen abhängt, der die Filter zusammenklickt, ist keine.
 */

import type { Befund } from './befund.ts';
import { empfaengtPost, type Empfaenger } from './empfaenger.ts';

export interface Verteiler {
  kennung: string;
  organisation: string;
  name: string;
  /** Der Satz, dem beim Eintragen zugestimmt wird. Wandert in die Einwilligung. */
  wortlaut: string;
  /** Was im Kopf jeder Mail als `List-Id` steht. */
  listenkennung: string;
  beschreibung: string;
}

/* --------------------------------------------------------- Segmentregeln */

export const VERGLEICHE = [
  'ist', 'ist_nicht', 'enthaelt', 'beginnt_mit',
  'groesser', 'kleiner', 'vorhanden', 'fehlt',
  'in_verteiler', 'nicht_in_verteiler',
] as const;
export type Vergleich = (typeof VERGLEICHE)[number];

export interface Regel {
  /**
   * Feld. Entweder eines der eingebauten (`zustand`, `eingetragenAm`,
   * `bestaetigtAm`, `gesendet`, `geoeffnet`, `geklickt`, `letzteRegung`)
   * oder ein Merkmal, dann mit Punkt: `merkmal.stadt`.
   */
  feld: string;
  vergleich: Vergleich;
  wert?: string | number;
}

export interface Regelwerk {
  verknuepfung: 'und' | 'oder';
  teile: Array<Regel | Regelwerk>;
}

export interface Segment {
  kennung: string;
  organisation: string;
  name: string;
  regelwerk: Regelwerk;
}

/**
 * Was ein Segment über einen Empfänger wissen darf, das nicht in ihm steht.
 *
 * Zahlen, keine Verläufe: „hat 12 von 40 geöffnet", nicht „hat am 3. Februar
 * um 09:14 geöffnet". Für ein Segment reicht die Zahl, und alles darüber
 * hinaus wäre ein Bewegungsprofil, das man dann auch schützen müsste.
 */
export interface Kennzahlen {
  gesendet: number;
  geoeffnet: number;
  geklickt: number;
  /** Letzte Regung irgendeiner Art. `null`, wenn es keine gab. */
  letzteRegung: number | null;
}

export const LEERE_KENNZAHLEN: Kennzahlen = { gesendet: 0, geoeffnet: 0, geklickt: 0, letzteRegung: null };

/** So tief darf ein Regelwerk verschachtelt sein. Darunter ist es unlesbar. */
export const HOECHSTTIEFE = 5;

function feldwert(e: Empfaenger, k: Kennzahlen, feld: string): string | number | null | undefined {
  if (feld.startsWith('merkmal.')) return e.merkmale[feld.slice(8)];
  switch (feld) {
    case 'zustand': return e.zustand;
    case 'quelle': return e.einwilligung.quelle;
    case 'eingetragenAm': return e.einwilligung.eingetragenAm;
    case 'bestaetigtAm': return e.einwilligung.bestaetigtAm;
    case 'gesendet': return k.gesendet;
    case 'geoeffnet': return k.geoeffnet;
    case 'geklickt': return k.geklickt;
    case 'letzteRegung': return k.letzteRegung;
    default: return undefined;
  }
}

function istRegelwerk(t: Regel | Regelwerk): t is Regelwerk {
  return 'verknuepfung' in t;
}

/**
 * Passt dieser Empfänger auf das Regelwerk?
 *
 * Ein leeres Regelwerk passt auf **niemanden**, gleich welcher Verknüpfung.
 * Das ist die vorsichtige Richtung: ein versehentlich leeres Segment, das auf
 * alle passt, geht als Versand an den ganzen Bestand — der Fehler, den man
 * genau einmal macht.
 */
export function passt(e: Empfaenger, k: Kennzahlen, werk: Regelwerk, tiefe = 0): boolean {
  if (tiefe > HOECHSTTIEFE) return false;
  if (werk.teile.length === 0) return false;

  const einzeln = (t: Regel | Regelwerk): boolean =>
    istRegelwerk(t) ? passt(e, k, t, tiefe + 1) : trifft(e, k, t);

  return werk.verknuepfung === 'und' ? werk.teile.every(einzeln) : werk.teile.some(einzeln);
}

function trifft(e: Empfaenger, k: Kennzahlen, regel: Regel): boolean {
  if (regel.vergleich === 'in_verteiler') return e.verteiler.includes(String(regel.wert ?? ''));
  if (regel.vergleich === 'nicht_in_verteiler') return !e.verteiler.includes(String(regel.wert ?? ''));

  const wert = feldwert(e, k, regel.feld);

  if (regel.vergleich === 'vorhanden') return wert !== undefined && wert !== null && wert !== '';
  if (regel.vergleich === 'fehlt') return wert === undefined || wert === null || wert === '';
  if (wert === undefined || wert === null) return false;

  const soll = regel.wert;
  if (soll === undefined) return false;

  switch (regel.vergleich) {
    case 'ist':
      // Vergleich ohne Rücksicht auf Groß- und Kleinschreibung: „Verden" und
      // „verden" sind dieselbe Stadt, und wer ein Segment baut, tippt anders
      // als wer sich einträgt.
      return String(wert).toLowerCase() === String(soll).toLowerCase();
    case 'ist_nicht':
      return String(wert).toLowerCase() !== String(soll).toLowerCase();
    case 'enthaelt':
      return String(wert).toLowerCase().includes(String(soll).toLowerCase());
    case 'beginnt_mit':
      return String(wert).toLowerCase().startsWith(String(soll).toLowerCase());
    case 'groesser':
      return typeof wert === 'number' && typeof soll === 'number' && wert > soll;
    case 'kleiner':
      return typeof wert === 'number' && typeof soll === 'number' && wert < soll;
    default:
      return false;
  }
}

/**
 * Die Empfänger, an die wirklich gesendet wird.
 *
 * Hier steht die Zusage aus dem Kopf dieser Datei als Code: **zuerst** wird
 * auf `empfaengtPost` gefiltert, **dann** erst das Segment angewandt. Ein
 * Regelwerk, das ausdrücklich `zustand ist eingetragen` verlangt, liefert
 * deshalb eine leere Menge und keinen Verstoß.
 *
 * `verteiler` schneidet zusätzlich auf eine Liste zu — wer den Newsletter
 * abbestellt hat, ist im Terminverteiler weiter drin und umgekehrt.
 */
export function empfaengerFuer(
  alle: readonly Empfaenger[],
  kennzahlen: ReadonlyMap<string, Kennzahlen>,
  auswahl: { verteiler?: string; segment?: Segment; organisation: string },
): Empfaenger[] {
  return alle.filter((e) => {
    if (e.organisation !== auswahl.organisation) return false;
    if (!empfaengtPost(e)) return false;
    if (auswahl.verteiler && !e.verteiler.includes(auswahl.verteiler)) return false;
    if (auswahl.segment) {
      return passt(e, kennzahlen.get(e.kennung) ?? LEERE_KENNZAHLEN, auswahl.segment.regelwerk);
    }
    return true;
  });
}

/**
 * Ein Regelwerk prüfen, bevor es gespeichert wird.
 *
 * Zwei Befunde, die wirklich vorkommen: ein leeres Segment (trifft niemanden,
 * sieht aber aus wie „alle") und ein Zahlenvergleich mit einem Text (`geöffnet
 * größer „viele"`), der stumm nie zutrifft.
 */
export function pruefeRegelwerk(werk: Regelwerk, tiefe = 0): Befund[] {
  const befunde: Befund[] = [];
  if (tiefe > HOECHSTTIEFE) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'segment.zu.tief',
      text: `Mehr als ${HOECHSTTIEFE} Ebenen. Das versteht beim Nachlesen niemand mehr, auch der Verfasser nicht.`,
    });
    return befunde;
  }
  if (werk.teile.length === 0) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'segment.leer',
      text: 'Die Gruppe hat keine Regel. Ein leeres Segment trifft niemanden.',
    });
    return befunde;
  }

  for (const teil of werk.teile) {
    if (istRegelwerk(teil)) {
      befunde.push(...pruefeRegelwerk(teil, tiefe + 1));
      continue;
    }
    if (teil.vergleich === 'groesser' || teil.vergleich === 'kleiner') {
      if (typeof teil.wert !== 'number') {
        befunde.push({
          schwere: 'fehler',
          kennung: 'segment.zahl.erwartet',
          text: `„${teil.feld} ${teil.vergleich}" braucht eine Zahl. Mit einem Text trifft die Regel nie zu.`,
          stelle: teil.feld,
        });
      }
    } else if (teil.vergleich !== 'vorhanden' && teil.vergleich !== 'fehlt' && teil.wert === undefined) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'segment.wert.fehlt',
        text: `„${teil.feld} ${teil.vergleich}" hat keinen Vergleichswert.`,
        stelle: teil.feld,
      });
    }

    if (teil.feld === 'zustand') {
      befunde.push({
        schwere: 'hinweis',
        kennung: 'segment.zustand',
        text: 'Der Zustand wird ohnehin geprüft: es geht immer nur an Bestätigte. Die Regel ändert nichts.',
        stelle: teil.feld,
      });
    }
  }
  return befunde;
}

/**
 * Wie viele ein Segment trifft — und wie viele es **nicht** trifft, weil sie
 * nicht bestätigt oder gesperrt sind.
 *
 * Die zweite Zahl ist die wichtigere. Wer ein Segment baut und 12 000 im
 * Bestand hat, aber nur 3 400 erreicht, soll das vor dem Versand sehen und
 * nicht danach fragen.
 */
export interface Segmentbild {
  trifft: number;
  imBestand: number;
  nichtBestaetigt: number;
  abgemeldet: number;
  gesperrt: number;
}

export function segmentbild(
  alle: readonly Empfaenger[],
  kennzahlen: ReadonlyMap<string, Kennzahlen>,
  auswahl: { verteiler?: string; segment?: Segment; organisation: string },
): Segmentbild {
  const eigene = alle.filter((e) => e.organisation === auswahl.organisation && e.zustand !== 'geloescht');
  return {
    trifft: empfaengerFuer(alle, kennzahlen, auswahl).length,
    imBestand: eigene.length,
    nichtBestaetigt: eigene.filter((e) => e.zustand === 'eingetragen').length,
    abgemeldet: eigene.filter((e) => e.zustand === 'abgemeldet').length,
    gesperrt: eigene.filter((e) => e.zustand === 'gesperrt').length,
  };
}

export const VERGLEICHSNAMEN: Record<Vergleich, string> = {
  ist: 'ist',
  ist_nicht: 'ist nicht',
  enthaelt: 'enthält',
  beginnt_mit: 'beginnt mit',
  groesser: 'ist größer als',
  kleiner: 'ist kleiner als',
  vorhanden: 'ist gesetzt',
  fehlt: 'fehlt',
  in_verteiler: 'steht im Verteiler',
  nicht_in_verteiler: 'steht nicht im Verteiler',
};
