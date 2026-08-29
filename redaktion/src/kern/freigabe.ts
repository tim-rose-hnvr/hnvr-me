/**
 * Der Freigabelauf.
 *
 * Derselbe Lauf trägt Beiträge und Newsletter. Das ist der Grund, warum dieses
 * Modul nichts über beide weiß außer einer Kennung und einem Stand: sobald
 * eine Freigabe „für Beiträge" und eine zweite „für Newsletter" existiert,
 * laufen sie auseinander, und dann gilt für den Newsletter an die 40 000 eine
 * lockerere Regel als für den Beitrag an die 300.
 *
 * Drei Regeln tragen das Ganze:
 *
 * 1. **Vier Augen.** Wer verfasst hat, gibt nicht frei. Ohne das ist eine
 *    Freigabe ein Knopf, den man selbst drückt.
 * 2. **Eine Ablehnung wiegt schwerer als jede Zustimmung.** Zwei Ja und ein
 *    Nein heißt Nein — und zwar mit Begründung, sonst ist die Ablehnung für
 *    den Verfasser wertlos.
 * 3. **Die Freigabe gilt einem Stand, nicht einem Gegenstand.** Wer nach der
 *    Freigabe den Text ändert, hat keinen freigegebenen Text mehr. Das ist die
 *    Regel, an der die meisten Werkzeuge vorbeisehen, und sie ist der einzige
 *    Grund, aus dem eine Freigabe überhaupt etwas wert ist.
 */

import type { Befund } from './befund.ts';
import { darfHier, type Sitzung } from './rollen.ts';

export interface Zustimmung {
  person: string;
  zeitpunkt: number;
  anmerkung?: string;
}

export interface Ablehnung {
  person: string;
  zeitpunkt: number;
  /** Pflicht. Eine Ablehnung ohne Grund ist eine Sackgasse. */
  grund: string;
}

export interface Freigabelauf {
  kennung: string;
  organisation: string;
  art: 'beitrag' | 'newsletter';
  /** Kennung des Beitrags oder Newsletters. */
  gegenstand: string;
  verfasser: string;
  /**
   * Der Inhaltsstand, für den die Freigabe gilt — ein Streuwert über Text und
   * Medien zum Zeitpunkt des Einreichens. Ändert sich der Inhalt, passt der
   * Stand nicht mehr und die Zustimmungen sind hinfällig.
   */
  stand: string;
  /** Wie viele Zustimmungen nötig sind. Mindestens eine. */
  noetig: number;
  zustimmungen: Zustimmung[];
  ablehnung?: Ablehnung;
  /** Bis wann entschieden sein soll. `null`, wenn es keine Frist gibt. */
  frist: number | null;
  eingereichtAm: number;
}

export type Freigabestand = 'offen' | 'freigegeben' | 'abgelehnt' | 'ueberholt';

/**
 * Wo der Lauf steht.
 *
 * `aktuellerStand` ist der Streuwert des Inhalts **jetzt**. Weicht er ab, ist
 * der Lauf `ueberholt` — auch wenn genug Zustimmungen vorliegen.
 */
export function standVon(lauf: Freigabelauf, aktuellerStand: string): Freigabestand {
  if (aktuellerStand !== lauf.stand) return 'ueberholt';
  if (lauf.ablehnung) return 'abgelehnt';
  return lauf.zustimmungen.length >= lauf.noetig ? 'freigegeben' : 'offen';
}

/**
 * Darf diese Sitzung hier zustimmen oder ablehnen?
 *
 * Gibt den Befund zurück, der dagegen spricht — oder `null`, wenn nichts
 * dagegen spricht. Die Oberfläche zeigt den Satz an; sie leitet ihn nicht ab.
 */
export function hindernis(lauf: Freigabelauf, sitzung: Sitzung, aktuellerStand: string): Befund | null {
  if (!darfHier(sitzung, 'beitrag.freigeben', lauf.organisation)) {
    return {
      schwere: 'fehler',
      kennung: 'freigabe.kein.recht',
      text: 'Diese Rolle gibt nicht frei.',
    };
  }
  if (aktuellerStand !== lauf.stand) {
    return {
      schwere: 'fehler',
      kennung: 'freigabe.ueberholt',
      text: 'Der Inhalt hat sich seit dem Einreichen geändert. Der Lauf muss neu eingereicht werden.',
    };
  }
  /* Vier Augen. Steht bewusst nach der Standprüfung: die veraltete Freigabe
     ist der häufigere Fall und die genauere Auskunft, wenn beides zutrifft. */
  if (sitzung.person === lauf.verfasser) {
    return {
      schwere: 'fehler',
      kennung: 'freigabe.vier.augen',
      text: 'Wer verfasst hat, gibt nicht frei. Es braucht ein zweites Paar Augen.',
    };
  }
  if (lauf.ablehnung) {
    return {
      schwere: 'fehler',
      kennung: 'freigabe.schon.abgelehnt',
      text: 'Der Lauf ist bereits abgelehnt.',
    };
  }
  if (lauf.zustimmungen.some((z) => z.person === sitzung.person)) {
    return {
      schwere: 'fehler',
      kennung: 'freigabe.schon.zugestimmt',
      text: 'Du hast hier bereits zugestimmt.',
    };
  }
  if (lauf.zustimmungen.length >= lauf.noetig) {
    return {
      schwere: 'hinweis',
      kennung: 'freigabe.schon.vollstaendig',
      text: 'Es liegen bereits genug Zustimmungen vor.',
    };
  }
  return null;
}

export type Freigabeergebnis = { ok: true; lauf: Freigabelauf } | { ok: false; befund: Befund };

export function zustimmen(
  lauf: Freigabelauf,
  sitzung: Sitzung,
  aktuellerStand: string,
  jetzt: number,
  anmerkung?: string,
): Freigabeergebnis {
  const dagegen = hindernis(lauf, sitzung, aktuellerStand);
  if (dagegen && dagegen.schwere === 'fehler') return { ok: false, befund: dagegen };
  const zustimmung: Zustimmung = { person: sitzung.person, zeitpunkt: jetzt };
  if (anmerkung && anmerkung.trim()) zustimmung.anmerkung = anmerkung.trim();
  return { ok: true, lauf: { ...lauf, zustimmungen: [...lauf.zustimmungen, zustimmung] } };
}

export function ablehnen(
  lauf: Freigabelauf,
  sitzung: Sitzung,
  aktuellerStand: string,
  grund: string,
  jetzt: number,
): Freigabeergebnis {
  const dagegen = hindernis(lauf, sitzung, aktuellerStand);
  if (dagegen && dagegen.schwere === 'fehler') return { ok: false, befund: dagegen };
  if (grund.trim().length < 5) {
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'freigabe.grund.fehlt',
        text: 'Eine Ablehnung braucht einen Grund. Ohne ihn weiß der Verfasser nicht, was zu ändern ist.',
      },
    };
  }
  return {
    ok: true,
    lauf: { ...lauf, ablehnung: { person: sitzung.person, zeitpunkt: jetzt, grund: grund.trim() } },
  };
}

/** Wie viele Zustimmungen noch fehlen. Nie negativ. */
export function fehlende(lauf: Freigabelauf): number {
  return Math.max(0, lauf.noetig - lauf.zustimmungen.length);
}

/**
 * Ist die Frist gerissen?
 *
 * Eine gerissene Frist blockiert nichts — sie steht im Plan und in der
 * Übersicht. Eine Freigabe, die nach Ablauf der Frist von selbst erteilt
 * würde, wäre keine; eine, die dann verfällt, kostet die Arbeit noch einmal.
 */
export function ueberfaellig(lauf: Freigabelauf, jetzt: number): boolean {
  return lauf.frist !== null && jetzt > lauf.frist && fehlende(lauf) > 0 && !lauf.ablehnung;
}

export function fristbefund(lauf: Freigabelauf, jetzt: number): Befund | null {
  if (!ueberfaellig(lauf, jetzt)) return null;
  const stunden = Math.floor((jetzt - lauf.frist!) / 3_600_000);
  return {
    schwere: 'warnung',
    kennung: 'freigabe.ueberfaellig',
    text:
      stunden < 1
        ? 'Die Frist für die Freigabe ist eben abgelaufen.'
        : `Die Frist für die Freigabe ist seit ${stunden} ${stunden === 1 ? 'Stunde' : 'Stunden'} abgelaufen.`,
    stelle: lauf.gegenstand,
  };
}

/**
 * Der Inhaltsstand.
 *
 * Kurz und ohne Kryptografie: der Stand soll Änderungen bemerken, nicht
 * Fälschungen abwehren — wer den Inhalt ändern darf, darf auch den Stand neu
 * berechnen lassen. Es geht um Versehen, nicht um Angriff. Zwei Durchläufe
 * mit verschiedenen Streuzahlen, damit zwei ähnliche Texte nicht zufällig
 * denselben Stand bekommen.
 */
export function standAus(teile: readonly string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  // Ein Trennzeichen, das in keinem Text vorkommt: ohne eines ergäben
  // ['ab', 'c'] und ['a', 'bc'] denselben Stand.
  const roh = teile.join('\u0000');
  for (let i = 0; i < roh.length; i++) {
    const c = roh.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
