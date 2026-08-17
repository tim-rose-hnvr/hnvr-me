/**
 * Vorlagen.
 *
 * Eine Vorlage ist ein vollständiger Entwurf, in dem einzelne Elemente als
 * Platzhalter markiert sind. Beim Erzeugen bekommt der Kunde eine Kopie mit
 * frischen ids, in der nur die Platzhalter angreifbar sind. Das ist der
 * Standardweg im Produkt — freies Gestalten ist die Ausnahme.
 */

import {
  type AssetReferenz,
  type Entwurf,
  type Entwurfselement,
  type Farbe,
  SCHEMA_VERSION,
} from '../modell/entwurf.js';
import { standardWerkzeuge, type Werkzeuge } from '../modell/erzeugen.js';
import { alleElemente } from '../modell/navigation.js';

export interface Vorlage {
  id: string;
  organisationId: string;
  name: string;
  beschreibung: string;
  markenkitId: string | null;
  /** Der Bauplan. Seine `id` wird beim Erzeugen nicht übernommen. */
  bauplan: Entwurf;
}

export interface PlatzhalterInfo {
  schluessel: string;
  beschriftung: string;
  elementTyp: Entwurfselement['typ'];
  bearbeitbar: readonly string[];
  /** Aktueller Inhalt im Bauplan, dient als Vorbelegung und Vorschau. */
  vorbelegung: string | null;
}

export type VorlagenWert =
  | { typ: 'text'; wert: string }
  | { typ: 'bild'; wert: AssetReferenz }
  | { typ: 'farbe'; wert: Farbe };

export class VorlagenFehler extends Error {
  readonly gruende: readonly string[];

  constructor(gruende: readonly string[]) {
    super(`Vorlage konnte nicht befüllt werden:\n${gruende.map((g) => `  ${g}`).join('\n')}`);
    this.name = 'VorlagenFehler';
    this.gruende = gruende;
  }
}

/** Listet die Platzhalter einer Vorlage für das Bedienfeld. */
export function sammlePlatzhalter(vorlage: Vorlage): PlatzhalterInfo[] {
  const infos: PlatzhalterInfo[] = [];
  const gesehen = new Set<string>();

  for (const { element } of alleElemente(vorlage.bauplan)) {
    const platzhalter = element.platzhalter;
    if (platzhalter === null) continue;
    if (gesehen.has(platzhalter.schluessel)) continue;
    gesehen.add(platzhalter.schluessel);

    infos.push({
      schluessel: platzhalter.schluessel,
      beschriftung: platzhalter.beschriftung ?? element.name,
      elementTyp: element.typ,
      bearbeitbar: platzhalter.bearbeitbar,
      vorbelegung: element.typ === 'text' ? element.inhalt : null,
    });
  }

  return infos;
}

export interface ErzeugenOptionen {
  name?: string;
  /** Fehlende Platzhalterwerte zulassen; der Bauplaninhalt bleibt dann stehen. */
  luecken?: boolean;
}

/**
 * Erzeugt aus einer Vorlage einen neuen Entwurf und setzt die Platzhalterwerte.
 * Wirft `VorlagenFehler` mit allen Gründen auf einmal.
 */
export function erzeugeAusVorlage(
  vorlage: Vorlage,
  werte: Readonly<Record<string, VorlagenWert>>,
  optionen: ErzeugenOptionen = {},
  werkzeuge: Werkzeuge = standardWerkzeuge,
): Entwurf {
  const gruende: string[] = [];
  const bekannt = new Map(sammlePlatzhalter(vorlage).map((i) => [i.schluessel, i]));

  for (const schluessel of Object.keys(werte)) {
    if (!bekannt.has(schluessel)) {
      gruende.push(`Platzhalter "${schluessel}" gibt es in dieser Vorlage nicht`);
    }
  }

  if (optionen.luecken !== true) {
    for (const schluessel of bekannt.keys()) {
      if (!(schluessel in werte)) gruende.push(`Platzhalter "${schluessel}" fehlt`);
    }
  }

  const zeitpunkt = werkzeuge.jetzt();
  const seiten = vorlage.bauplan.seiten.map((seite) => ({
    ...seite,
    id: werkzeuge.neueId(),
    elemente: seite.elemente.map((element) => uebernimm(element, werte, gruende, werkzeuge)),
  }));

  if (gruende.length > 0) throw new VorlagenFehler(gruende);

  return {
    ...vorlage.bauplan,
    schemaVersion: SCHEMA_VERSION,
    id: werkzeuge.neueId(),
    organisationId: vorlage.organisationId,
    name: optionen.name ?? vorlage.name,
    markenkitId: vorlage.markenkitId,
    vorlageId: vorlage.id,
    seiten,
    erstelltAm: zeitpunkt,
    geaendertAm: zeitpunkt,
  };
}

function uebernimm(
  element: Entwurfselement,
  werte: Readonly<Record<string, VorlagenWert>>,
  gruende: string[],
  werkzeuge: Werkzeuge,
): Entwurfselement {
  const neu: Entwurfselement =
    element.typ === 'gruppe'
      ? {
          ...element,
          id: werkzeuge.neueId(),
          kinder: element.kinder.map((kind) => uebernimm(kind, werte, gruende, werkzeuge)),
        }
      : { ...element, id: werkzeuge.neueId() };

  const platzhalter = neu.platzhalter;
  if (platzhalter === null) return neu;

  const wert = werte[platzhalter.schluessel];
  if (wert === undefined) return neu;

  const erlaubt = platzhalter.bearbeitbar;
  const stelle = `Platzhalter "${platzhalter.schluessel}"`;

  switch (wert.typ) {
    case 'text':
      if (!erlaubt.includes('text')) {
        gruende.push(`${stelle} ist nicht als Text bearbeitbar`);
        return neu;
      }
      if (neu.typ !== 'text') {
        gruende.push(`${stelle} sitzt auf einem Element vom Typ "${neu.typ}", nicht "text"`);
        return neu;
      }
      return { ...neu, inhalt: wert.wert };

    case 'bild':
      if (!erlaubt.includes('bild')) {
        gruende.push(`${stelle} ist nicht als Bild bearbeitbar`);
        return neu;
      }
      if (neu.typ !== 'bild') {
        gruende.push(`${stelle} sitzt auf einem Element vom Typ "${neu.typ}", nicht "bild"`);
        return neu;
      }
      return { ...neu, quelle: wert.wert, zuschnitt: { x: 0, y: 0, breite: 1, hoehe: 1 } };

    case 'farbe':
      if (!erlaubt.includes('farbe')) {
        gruende.push(`${stelle} ist nicht als Farbe bearbeitbar`);
        return neu;
      }
      if (neu.typ === 'text') return { ...neu, farbe: wert.wert };
      if (neu.typ === 'form') return { ...neu, fuellung: wert.wert };
      gruende.push(`${stelle} sitzt auf einem Element vom Typ "${neu.typ}", das keine Farbe hat`);
      return neu;
  }
}
