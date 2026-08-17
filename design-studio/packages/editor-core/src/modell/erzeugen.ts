/**
 * Fabriken für neue Entwürfe und Elemente.
 *
 * Id-Erzeugung und Uhr werden hereingereicht statt importiert. Das ist kein
 * Selbstzweck: ohne das sind Kommandos nicht deterministisch testbar, und ein
 * Dokumentformat, dessen Erzeugung man nicht testen kann, driftet.
 */

import {
  type BildElement,
  type ElementBasis,
  type Entwurf,
  type Entwurfselement,
  type FormElement,
  SCHEMA_VERSION,
  type Seite,
  type TextElement,
} from './entwurf.js';
import { type Format, formatInPx } from './masse.js';

export type IdErzeuger = () => string;
export type Uhr = () => string;

/** Standard im Betrieb. `crypto.randomUUID` gibt es in Node ab 19 und in allen Zielbrowsern. */
export const zufallsId: IdErzeuger = () => globalThis.crypto.randomUUID();

/** Standard im Betrieb: ISO-8601 in UTC, auf Sekunden genau reicht nicht — Millisekunden. */
export const systemUhr: Uhr = () => new Date().toISOString();

/** Deterministischer Erzeuger für Tests: `el-1`, `el-2`, … */
export function zaehlerId(praefix = 'id'): IdErzeuger {
  let n = 0;
  return () => {
    n += 1;
    return `${praefix}-${n}`;
  };
}

/** Feste Uhr für Tests. */
export function festeUhr(zeitpunkt = '2026-01-01T00:00:00.000Z'): Uhr {
  return () => zeitpunkt;
}

export interface Werkzeuge {
  neueId: IdErzeuger;
  jetzt: Uhr;
}

export const standardWerkzeuge: Werkzeuge = { neueId: zufallsId, jetzt: systemUhr };

export interface EntwurfOptionen {
  organisationId: string;
  name: string;
  format: Format;
  markenkitId?: string | null;
  vorlageId?: string | null;
}

export function erzeugeEntwurf(
  optionen: EntwurfOptionen,
  werkzeuge: Werkzeuge = standardWerkzeuge,
): Entwurf {
  const masse = formatInPx(optionen.format);
  const anschnitt = masse.anschnitt;
  const zeitpunkt = werkzeuge.jetzt();

  return {
    schemaVersion: SCHEMA_VERSION,
    id: werkzeuge.neueId(),
    organisationId: optionen.organisationId,
    name: optionen.name,
    masse: { breite: masse.breite, hoehe: masse.hoehe, dpi: masse.dpi },
    anschnitt: { oben: anschnitt, rechts: anschnitt, unten: anschnitt, links: anschnitt },
    sicherheitsabstand: masse.sicherheitsabstand,
    seiten: [erzeugeSeite('Seite 1', werkzeuge)],
    markenkitId: optionen.markenkitId ?? null,
    vorlageId: optionen.vorlageId ?? null,
    erstelltAm: zeitpunkt,
    geaendertAm: zeitpunkt,
  };
}

export function erzeugeSeite(name: string, werkzeuge: Werkzeuge = standardWerkzeuge): Seite {
  return { id: werkzeuge.neueId(), name, hintergrund: '#ffffff', elemente: [] };
}

export type Rahmen = Pick<Entwurfselement, 'x' | 'y' | 'breite' | 'hoehe'>;

function basis(name: string, rahmen: Rahmen, werkzeuge: Werkzeuge): ElementBasis {
  return {
    id: werkzeuge.neueId(),
    name,
    x: rahmen.x,
    y: rahmen.y,
    breite: rahmen.breite,
    hoehe: rahmen.hoehe,
    drehung: 0,
    deckkraft: 1,
    sichtbar: true,
    gesperrt: false,
    platzhalter: null,
  };
}

export function erzeugeText(
  rahmen: Rahmen,
  inhalt: string,
  ueberschreibungen: Partial<Omit<TextElement, 'typ' | 'id'>> = {},
  werkzeuge: Werkzeuge = standardWerkzeuge,
): TextElement {
  return {
    ...basis(inhalt.slice(0, 40) || 'Text', rahmen, werkzeuge),
    typ: 'text',
    inhalt,
    schriftFamilie: 'Inter',
    schriftGroesse: Math.max(1, rahmen.hoehe * 0.5),
    schriftStaerke: 400,
    kursiv: false,
    farbe: '#000000',
    ausrichtung: 'links',
    zeilenabstand: 1.2,
    laufweite: 0,
    autoAnpassung: 'schrumpfen',
    ...ueberschreibungen,
  };
}

export function erzeugeBild(
  rahmen: Rahmen,
  quelle: BildElement['quelle'],
  ueberschreibungen: Partial<Omit<BildElement, 'typ' | 'id'>> = {},
  werkzeuge: Werkzeuge = standardWerkzeuge,
): BildElement {
  return {
    ...basis('Bild', rahmen, werkzeuge),
    typ: 'bild',
    quelle,
    zuschnitt: { x: 0, y: 0, breite: 1, hoehe: 1 },
    passform: 'fuellen',
    ...ueberschreibungen,
  };
}

export function erzeugeForm(
  rahmen: Rahmen,
  form: FormElement['form'],
  ueberschreibungen: Partial<Omit<FormElement, 'typ' | 'id'>> = {},
  werkzeuge: Werkzeuge = standardWerkzeuge,
): FormElement {
  return {
    ...basis('Form', rahmen, werkzeuge),
    typ: 'form',
    form,
    fuellung: '#cccccc',
    kontur: null,
    eckenradius: 0,
    pfad: null,
    ...ueberschreibungen,
  };
}
