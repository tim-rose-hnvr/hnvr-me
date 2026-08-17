/**
 * Die Speicherschnittstelle — die Grenze zwischen Produkt und Anbieter.
 *
 * Alles oberhalb dieser Datei kennt nur diese Verträge. Wix steckt
 * ausschließlich in den Umsetzungen daneben. Ein Wechsel zu einem eigenen
 * Backend ist damit ein zweiter Adapter und keine Änderung am Produkt.
 */

import type { Entwurf, Markenkit, Vorlage } from '@studio/editor-core';

export class SpeicherFehler extends Error {
  readonly ursache: unknown;

  constructor(meldung: string, ursache?: unknown) {
    super(meldung);
    this.name = 'SpeicherFehler';
    this.ursache = ursache;
  }
}

export class NichtGefunden extends SpeicherFehler {
  constructor(art: string, id: string) {
    super(`${art} "${id}" gibt es nicht`);
    this.name = 'NichtGefunden';
  }
}

/** Mandantengrenze. Jede Abfrage trägt sie mit, keine Ausnahme. */
export interface Mandant {
  organisationId: string;
}

export interface Seitenabfrage {
  limit?: number;
  offset?: number;
}

export interface Kurzfassung {
  id: string;
  name: string;
  geaendertAm: string;
  vorlageId: string | null;
}

export interface EntwurfSpeicher {
  lade(mandant: Mandant, entwurfId: string): Promise<Entwurf>;
  sichere(mandant: Mandant, entwurf: Entwurf): Promise<void>;
  loesche(mandant: Mandant, entwurfId: string): Promise<void>;
  /** Liste für die Übersicht — ohne den Entwurfsinhalt, der ist zu groß. */
  liste(mandant: Mandant, abfrage?: Seitenabfrage): Promise<Kurzfassung[]>;
}

export interface VorlagenSpeicher {
  lade(mandant: Mandant, vorlageId: string): Promise<Vorlage>;
  sichere(mandant: Mandant, vorlage: Vorlage): Promise<void>;
  liste(mandant: Mandant, abfrage?: Seitenabfrage): Promise<Kurzfassung[]>;
}

export interface MarkenkitSpeicher {
  lade(mandant: Mandant, markenkitId: string): Promise<Markenkit>;
  sichere(mandant: Mandant, markenkit: Markenkit): Promise<void>;
}

/**
 * Verweis auf eine abgelegte Datei.
 *
 * Beides wird gebraucht und beides wird mitgespeichert: die `id` ist der
 * dauerhafte Schlüssel, über den sich ein Lesezugriff beschaffen lässt, die
 * `url` taugt für öffentliche Dateien und als Anzeigepfad. Bei privaten Dateien
 * ist die `url` **nicht** zum Lesen zu gebrauchen — siehe `wixBlobSpeicher.ts`.
 */
export interface Blobreferenz {
  id: string;
  url: string;
}

/**
 * Rohdatenablage für alles, was nicht in einen Datensatz passt: Bilder,
 * Schriften und ausgelagerte Entwurfsinhalte.
 */
export interface BlobSpeicher {
  schreibe(mandant: Mandant, name: string, mimeTyp: string, daten: Blob): Promise<Blobreferenz>;
  liesText(referenz: Blobreferenz): Promise<string>;
  loesche(referenz: Blobreferenz): Promise<void>;
}
