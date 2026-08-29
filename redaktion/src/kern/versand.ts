/**
 * Der Versandlauf.
 *
 * Hier gilt der Satz, der über allem steht: **ein Ausfall darf Komfort kosten,
 * niemals Daten.** Für einen Newsletter heißt das etwas Bestimmtes und nichts
 * Allgemeines:
 *
 * - Eine Mail darf **nie zweimal** hinausgehen. Deshalb ist die Postenkennung
 *   errechnet und nicht gezogen: derselbe Lauf und derselbe Empfänger ergeben
 *   dieselbe Kennung, auch nach einem Neustart mitten im Versand.
 * - Ein abgebrochener Lauf bleibt abgebrochen. Ein Lauf, der sich nach einem
 *   Neustart selbst fortsetzt, ist genau der Fehler, den der Abbruch
 *   verhindern sollte.
 * - Was nicht zugestellt werden konnte, wird gezählt und nicht vergessen. Fünf
 *   weiche Rückläufer hintereinander sind ein harter.
 *
 * Die Drosselung ist keine Höflichkeit gegenüber den Postfächern, sondern
 * Eigennutz: wer 40 000 Mails in zehn Minuten abgibt, wird von jedem großen
 * Anbieter verzögert, und die Verzögerung trifft dann auch die Mails, die
 * wichtig sind.
 */

import type { Befund } from './befund.ts';
import { streuwert } from './kennung.ts';

export type Postenzustand =
  | 'offen'
  | 'gesendet'
  | 'weich'
  | 'hart'
  | 'beschwerde'
  | 'uebersprungen'
  | 'aufgegeben';

export interface Posten {
  /** Errechnet aus Lauf und Empfänger — der Schutz vor dem zweiten Versand. */
  kennung: string;
  empfaenger: string;
  variante: string;
  zustand: Postenzustand;
  versuche: number;
  gesendetAm?: number;
  /** Bei weichem Rückläufer: wann der nächste Versuch frühestens ansteht. */
  naechsterVersuch?: number;
  /** Was der Server gesagt hat. Wörtlich — zusammengefasste Fehler sind wertlos. */
  meldung?: string;
}

export type Laufzustand = 'vorbereitet' | 'laeuft' | 'pausiert' | 'fertig' | 'abgebrochen';

export interface Versandlauf {
  kennung: string;
  organisation: string;
  newsletter: string;
  zustand: Laufzustand;
  posten: Posten[];
  begonnenAm: number | null;
  beendetAm: number | null;
  /** Wie viele Mails je Stunde höchstens. Kommt aus dem Aufwärmplan. */
  hoechstProStunde: number;
  /** Beim Abbruch: warum, und von wem. */
  abbruchgrund?: string;
}

/**
 * Wie viele Mails ohne Wartezeit gleich zu Beginn hinausgehen dürfen.
 *
 * Ohne dieses Anfangskontingent stünde jeder Lauf in der ersten Minute still,
 * weil die verstrichene Zeit noch null ist.
 */
export const ANFANGSKONTINGENT = 50;

/** Nach so vielen vergeblichen Versuchen wird ein Posten aufgegeben. */
export const HOECHSTVERSUCHE = 4;

/**
 * Wartezeiten zwischen den Versuchen.
 *
 * Steigend, aber nicht ins Unendliche: nach zwölf Stunden ist ein Postfach,
 * das voll war, entweder leer oder es bleibt voll.
 */
export const WARTEZEITEN_MS = [15 * 60_000, 60 * 60_000, 4 * 3_600_000, 12 * 3_600_000];

/**
 * Die Postenkennung.
 *
 * Errechnet, nicht gezogen. Das ist der ganze Schutz vor dem doppelten
 * Versand: fällt der Rechner mitten im Lauf aus und beginnt die Liste von
 * vorn, tragen die Posten dieselben Kennungen wie zuvor, und die schon
 * gesendeten sind daran zu erkennen.
 */
export function postenkennung(lauf: string, empfaenger: string): string {
  return `${lauf}~${empfaenger}~${streuwert(`${lauf}~${empfaenger}`).toString(36).slice(2, 10)}`;
}

export function legeLaufAn(
  kennung: string,
  organisation: string,
  newsletter: string,
  empfaengerMitVariante: ReadonlyArray<{ kennung: string; variante: string }>,
  hoechstProStunde: number,
): Versandlauf {
  return {
    kennung,
    organisation,
    newsletter,
    zustand: 'vorbereitet',
    posten: empfaengerMitVariante.map((e) => ({
      kennung: postenkennung(kennung, e.kennung),
      empfaenger: e.kennung,
      variante: e.variante,
      zustand: 'offen',
      versuche: 0,
    })),
    begonnenAm: null,
    beendetAm: null,
    hoechstProStunde,
  };
}

/**
 * Wie viele Mails jetzt hinausgehen dürfen.
 *
 * Ein auslaufender Eimer: das Kontingent wächst mit der Zeit, verbraucht wird
 * es durch das, was schon hinaus ist. Mehr Buchhaltung braucht es nicht, und
 * jede weitere wäre eine, die nach einem Neustart neu aufzubauen wäre.
 */
export function kontingent(lauf: Versandlauf, jetzt: number): number {
  if (lauf.begonnenAm === null) return 0;
  const stunden = Math.max(0, jetzt - lauf.begonnenAm) / 3_600_000;
  const erlaubt = Math.floor(lauf.hoechstProStunde * stunden) + Math.min(ANFANGSKONTINGENT, lauf.hoechstProStunde);
  const schonRaus = lauf.posten.filter((p) => p.gesendetAm !== undefined).length;
  return Math.max(0, erlaubt - schonRaus);
}

/**
 * Die nächsten Posten, die abzuarbeiten sind.
 *
 * Ein Posten kommt dran, wenn er offen ist oder auf einen zweiten Versuch
 * wartet und dessen Zeit gekommen ist. Läuft der Lauf nicht, kommt gar
 * nichts — auch nicht „nur diese eine".
 */
export function naechsteCharge(lauf: Versandlauf, jetzt: number, groesse = 100): Posten[] {
  if (lauf.zustand !== 'laeuft') return [];
  const frei = Math.min(groesse, kontingent(lauf, jetzt));
  if (frei <= 0) return [];
  return lauf.posten
    .filter(
      (p) =>
        p.zustand === 'offen' ||
        (p.zustand === 'weich' && p.versuche < HOECHSTVERSUCHE && (p.naechsterVersuch ?? 0) <= jetzt),
    )
    .slice(0, frei);
}

function mitPosten(lauf: Versandlauf, kennung: string, aenderung: (p: Posten) => Posten): Versandlauf {
  return { ...lauf, posten: lauf.posten.map((p) => (p.kennung === kennung ? aenderung(p) : p)) };
}

/**
 * Ein Posten ist hinaus.
 *
 * Ein bereits gesendeter Posten wird **nicht** noch einmal gesendet, auch
 * wenn er aus Versehen ein zweites Mal gemeldet wird. Das ist die Stelle, an
 * der der Doppelversandschutz wirkt, und der Grund, warum sie kein `if`
 * überspringt.
 */
export function alsGesendet(lauf: Versandlauf, posten: string, jetzt: number): Versandlauf {
  return mitPosten(lauf, posten, (p) =>
    p.gesendetAm !== undefined
      ? p
      : { ...p, zustand: 'gesendet', gesendetAm: jetzt, versuche: p.versuche + 1 },
  );
}

/** Ein weicher Rückläufer: es wird noch einmal versucht, aber nicht sofort. */
export function alsWeich(lauf: Versandlauf, posten: string, meldung: string, jetzt: number): Versandlauf {
  return mitPosten(lauf, posten, (p) => {
    const versuche = p.versuche + 1;
    if (versuche >= HOECHSTVERSUCHE) return { ...p, zustand: 'aufgegeben', versuche, meldung };
    return {
      ...p,
      zustand: 'weich',
      versuche,
      meldung,
      naechsterVersuch: jetzt + (WARTEZEITEN_MS[versuche - 1] ?? WARTEZEITEN_MS.at(-1)!),
    };
  });
}

/** Ein harter Rückläufer oder eine Beschwerde: nie wieder, kein zweiter Versuch. */
export function alsEndgueltig(
  lauf: Versandlauf,
  posten: string,
  art: 'hart' | 'beschwerde',
  meldung: string,
): Versandlauf {
  return mitPosten(lauf, posten, (p) => ({ ...p, zustand: art, versuche: p.versuche + 1, meldung }));
}

/** Übersprungen: der Empfänger ist zwischen Vorbereitung und Versand ausgeschieden. */
export function alsUebersprungen(lauf: Versandlauf, posten: string, grund: string): Versandlauf {
  return mitPosten(lauf, posten, (p) =>
    p.gesendetAm !== undefined ? p : { ...p, zustand: 'uebersprungen', meldung: grund },
  );
}

export type Laufergebnis = { ok: true; lauf: Versandlauf } | { ok: false; befund: Befund };

export function starten(lauf: Versandlauf, jetzt: number): Laufergebnis {
  if (lauf.zustand === 'abgebrochen') {
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'versand.abgebrochen',
        text: 'Ein abgebrochener Lauf wird nicht fortgesetzt. Wenn er doch hinaus soll, braucht es einen neuen.',
      },
    };
  }
  if (lauf.zustand === 'fertig') {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'versand.fertig', text: 'Der Lauf ist bereits durch.' } };
  }
  if (lauf.zustand === 'laeuft') return { ok: true, lauf };
  return { ok: true, lauf: { ...lauf, zustand: 'laeuft', begonnenAm: lauf.begonnenAm ?? jetzt } };
}

/**
 * Anhalten.
 *
 * Pausieren ist umkehrbar, Abbrechen nicht. Beide halten sofort an — was
 * bereits an den Mailserver übergeben ist, kommt trotzdem an, und das steht
 * so auch in der Oberfläche. Ein Knopf, der behauptet, eine abgegebene Mail
 * zurückholen zu können, lügt.
 */
export function pausieren(lauf: Versandlauf): Versandlauf {
  return lauf.zustand === 'laeuft' ? { ...lauf, zustand: 'pausiert' } : lauf;
}

export function abbrechen(lauf: Versandlauf, grund: string, jetzt: number): Versandlauf {
  if (lauf.zustand === 'fertig' || lauf.zustand === 'abgebrochen') return lauf;
  return { ...lauf, zustand: 'abgebrochen', abbruchgrund: grund, beendetAm: jetzt };
}

export interface Fortschritt {
  gesamt: number;
  gesendet: number;
  offen: number;
  wartend: number;
  hart: number;
  beschwerden: number;
  uebersprungen: number;
  aufgegeben: number;
  /** Anteil zwischen 0 und 1. */
  anteil: number;
}

export function fortschritt(lauf: Versandlauf): Fortschritt {
  const zaehle = (z: Postenzustand) => lauf.posten.filter((p) => p.zustand === z).length;
  const gesamt = lauf.posten.length;
  const gesendet = zaehle('gesendet');
  const erledigt = gesendet + zaehle('hart') + zaehle('beschwerde') + zaehle('uebersprungen') + zaehle('aufgegeben');
  return {
    gesamt,
    gesendet,
    offen: zaehle('offen'),
    wartend: zaehle('weich'),
    hart: zaehle('hart'),
    beschwerden: zaehle('beschwerde'),
    uebersprungen: zaehle('uebersprungen'),
    aufgegeben: zaehle('aufgegeben'),
    anteil: gesamt === 0 ? 1 : erledigt / gesamt,
  };
}

/** Ist alles abgearbeitet? Wartende zählen nicht als fertig. */
export function durch(lauf: Versandlauf, jetzt: number): boolean {
  return lauf.posten.every(
    (p) =>
      p.zustand === 'gesendet' ||
      p.zustand === 'hart' ||
      p.zustand === 'beschwerde' ||
      p.zustand === 'uebersprungen' ||
      p.zustand === 'aufgegeben' ||
      (p.zustand === 'weich' && p.versuche >= HOECHSTVERSUCHE && (p.naechsterVersuch ?? 0) <= jetzt),
  );
}

/**
 * Die Beschwerdequote.
 *
 * Die Zahl, an der ein Versand steht und fällt. Google und Yahoo verlangen
 * von Massenversendern seit 2024 dauerhaft unter 0,3 %, und wer über 0,1 %
 * liegt, sollte den Grund kennen, bevor die Grenze erreicht ist. Deshalb
 * warnt diese Funktion früher, als sie müsste.
 */
export function beschwerdequote(lauf: Versandlauf): number {
  const zugestellt = lauf.posten.filter((p) => p.zustand === 'gesendet').length;
  if (zugestellt === 0) return 0;
  return lauf.posten.filter((p) => p.zustand === 'beschwerde').length / zugestellt;
}

export function quotenbefund(lauf: Versandlauf): Befund | null {
  const quote = beschwerdequote(lauf);
  const zugestellt = lauf.posten.filter((p) => p.zustand === 'gesendet').length;
  // Unter 500 Zustellungen ist die Quote Rauschen: eine Beschwerde bei 100
  // Mails wäre 1 % und bedeutet nichts.
  if (zugestellt < 500) return null;
  if (quote >= 0.003) {
    return {
      schwere: 'fehler',
      kennung: 'versand.beschwerden.hoch',
      text: `${(quote * 100).toFixed(2)} % melden diesen Versand als Werbung. Ab 0,3 % drosseln Google und Yahoo die ganze Domain — nicht nur diesen Newsletter.`,
    };
  }
  if (quote >= 0.001) {
    return {
      schwere: 'warnung',
      kennung: 'versand.beschwerden.erhoeht',
      text: `${(quote * 100).toFixed(2)} % melden diesen Versand als Werbung. Die Grenze liegt bei 0,3 %; ab hier lohnt es, den Grund zu suchen.`,
    };
  }
  return null;
}
