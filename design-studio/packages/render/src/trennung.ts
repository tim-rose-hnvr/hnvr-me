/**
 * Silbentrennung.
 *
 * ## Warum das hier von Hand passiert
 *
 * Die naheliegende Lösung wäre `hyphens: auto` im CSS. Der Druck-Spike hat
 * gemessen, dass das in headless Chromium **nicht wirkt** — die Trennmuster
 * fehlen im Build, die Zeilenhöhe ist mit und ohne identisch. Volles Chrome
 * lädt sie über den Komponentenupdater nach, was auf einem Server nicht
 * passiert und in einem abgeschotteten Netz erst recht nicht.
 *
 * Deshalb werden weiche Trennstriche (U+00AD) **vor** dem Aufbau des HTML
 * eingesetzt. Der Browser bricht dort zuverlässig um — das ist geprüft. Damit
 * ist die Trennung außerdem deterministisch und hängt nicht mehr davon ab,
 * welche Wörterbücher auf welchem Rechner liegen.
 *
 * Muster aus `hyphen` (ISC), abgeleitet aus den TeX-Trennmustern.
 */

/// <reference path="./hyphen.d.ts" />
import de1996 from 'hyphen/de-1996';
import enUs from 'hyphen/en-us';

/** Weicher Trennstrich. Unsichtbar, außer der Umbruch fällt genau darauf. */
export const WEICHER_TRENNSTRICH = '­';

export type Sprache = 'de' | 'en' | 'keine';

const TRENNER: Record<Exclude<Sprache, 'keine'>, (text: string, o: object) => string> = {
  de: (text, o) => de1996.hyphenateSync(text, o),
  en: (text, o) => enUs.hyphenateSync(text, o),
};

export interface Trennoptionen {
  sprache?: Sprache;
  /**
   * Wörter unterhalb dieser Länge werden nicht getrennt. Kurze Wörter zu
   * trennen sieht im Satz billig aus und spart keine Zeile.
   */
  mindestlaenge?: number;
}

/**
 * Setzt weiche Trennstriche in einen Text. Zeichen, die keine Buchstaben sind,
 * bleiben unangetastet — die Muster arbeiten wortweise.
 */
export function setzeTrennstriche(text: string, optionen: Trennoptionen = {}): string {
  const sprache = optionen.sprache ?? 'de';
  if (sprache === 'keine' || text === '') return text;

  const mindestlaenge = optionen.mindestlaenge ?? 6;
  const trenne = TRENNER[sprache];

  // Wortweise, damit Zeichensetzung und Zahlen unverändert durchlaufen und
  // die Mindestlänge je Wort gilt statt für den ganzen Absatz.
  return text.replace(/\p{L}+/gu, (wort) => {
    if (wort.length < mindestlaenge) return wort;
    return trenne(wort, { hyphenChar: WEICHER_TRENNSTRICH });
  });
}

/** Entfernt weiche Trennstriche wieder — für Vergleiche und zum Speichern. */
export function entferneTrennstriche(text: string): string {
  return text.replaceAll(WEICHER_TRENNSTRICH, '');
}

/** Zählt die eingesetzten Trennmöglichkeiten. Für Tests und Diagnose. */
export function zaehleTrennstellen(text: string): number {
  return (text.match(new RegExp(WEICHER_TRENNSTRICH, 'g')) ?? []).length;
}
