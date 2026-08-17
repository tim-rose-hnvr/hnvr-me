/**
 * Der Prüfer — Bausteine für Schemaprüfungen von Hand.
 *
 * Bewusst ohne Fremdbibliothek: `editor-core` wird in fremde Seiten eingebettet
 * und soll keine Abhängigkeit mitschleppen. Der Preis sind ein paar hundert
 * Zeilen, der Gewinn sind Fehlermeldungen in der Sprache der Fachdomäne statt
 * eines Pfadausdrucks.
 *
 * Getrennt von `schema.ts`, weil außer dem Entwurf auch die **Aussage** geprüft
 * werden muss — und zwei Kopien derselben Prüfbausteine liefen unweigerlich
 * auseinander.
 */

import type { Farbe } from './entwurf.js';

export interface Verstoss {
  pfad: string;
  meldung: string;
}

export class SchemaFehler extends Error {
  readonly verstoesse: readonly Verstoss[];

  constructor(verstoesse: readonly Verstoss[], gegenstand = 'Entwurf') {
    const liste = verstoesse.map((v) => `  ${v.pfad}: ${v.meldung}`).join('\n');
    super(`${gegenstand} ist ungültig (${verstoesse.length} Verstöße):\n${liste}`);
    this.name = 'SchemaFehler';
    this.verstoesse = verstoesse;
  }
}

const FARBMUSTER = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
/** Sammelt alle Verstöße, statt beim ersten abzubrechen. */
export class Pruefer {
  readonly verstoesse: Verstoss[] = [];

  melde(pfad: string, meldung: string): void {
    this.verstoesse.push({ pfad, meldung });
  }

  objekt(wert: unknown, pfad: string): Record<string, unknown> {
    if (typeof wert !== 'object' || wert === null || Array.isArray(wert)) {
      this.melde(pfad, 'muss ein Objekt sein');
      return {};
    }
    return wert as Record<string, unknown>;
  }

  liste(wert: unknown, pfad: string): unknown[] {
    if (!Array.isArray(wert)) {
      this.melde(pfad, 'muss eine Liste sein');
      return [];
    }
    return wert;
  }

  zahl(
    wert: unknown,
    pfad: string,
    grenzen: { min?: number; max?: number; ganz?: boolean } = {},
  ): number {
    if (typeof wert !== 'number' || !Number.isFinite(wert)) {
      this.melde(pfad, 'muss eine endliche Zahl sein');
      return 0;
    }
    if (grenzen.ganz === true && !Number.isInteger(wert)) {
      this.melde(pfad, 'muss eine ganze Zahl sein');
    }
    if (grenzen.min !== undefined && wert < grenzen.min) {
      this.melde(pfad, `muss mindestens ${grenzen.min} sein, war ${wert}`);
      return grenzen.min;
    }
    if (grenzen.max !== undefined && wert > grenzen.max) {
      this.melde(pfad, `darf höchstens ${grenzen.max} sein, war ${wert}`);
      return grenzen.max;
    }
    return wert;
  }

  text(wert: unknown, pfad: string, regeln: { nichtLeer?: boolean } = {}): string {
    if (typeof wert !== 'string') {
      this.melde(pfad, 'muss eine Zeichenkette sein');
      return '';
    }
    if (regeln.nichtLeer === true && wert.trim() === '') {
      this.melde(pfad, 'darf nicht leer sein');
    }
    return wert;
  }

  wahrheitswert(wert: unknown, pfad: string): boolean {
    if (typeof wert !== 'boolean') {
      this.melde(pfad, 'muss true oder false sein');
      return false;
    }
    return wert;
  }

  farbe(wert: unknown, pfad: string): Farbe {
    if (typeof wert !== 'string') {
      this.melde(pfad, 'muss eine Farbe als Zeichenkette sein');
      return '#000000';
    }
    const normalisiert = wert.toLowerCase();
    if (!FARBMUSTER.test(normalisiert)) {
      this.melde(pfad, `muss #RRGGBB oder #RRGGBBAA sein, war "${wert}"`);
      return '#000000';
    }
    return normalisiert;
  }

  farbeOderNull(wert: unknown, pfad: string): Farbe | null {
    return wert === null ? null : this.farbe(wert, pfad);
  }

  auswahl<T extends string>(wert: unknown, pfad: string, erlaubt: readonly T[]): T {
    if (typeof wert !== 'string' || !erlaubt.includes(wert as T)) {
      this.melde(pfad, `muss einer von [${erlaubt.join(', ')}] sein, war ${JSON.stringify(wert)}`);
      return erlaubt[0] as T;
    }
    return wert as T;
  }

  zeitpunkt(wert: unknown, pfad: string): string {
    const text = this.text(wert, pfad);
    if (text !== '' && Number.isNaN(Date.parse(text))) {
      this.melde(pfad, `muss ein ISO-8601-Zeitpunkt sein, war "${text}"`);
    }
    return text;
  }
}
