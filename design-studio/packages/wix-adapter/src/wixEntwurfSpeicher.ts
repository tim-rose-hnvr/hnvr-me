/**
 * Entwürfe in Wix Data.
 *
 * Der Knackpunkt: **ein Datensatz in Wix Data darf höchstens 512 KB groß sein**
 * (Fehler WDE0009). Ein Entwurf mit vielen Elementen sprengt das, und zwar
 * lautlos erst beim Kunden. Deshalb schreibt dieser Speicher den Inhalt
 * unterhalb einer Schwelle direkt in den Datensatz und lagert ihn darüber in den
 * Media Manager aus. Der Datensatz behält in beiden Fällen dieselben Felder für
 * die Übersichtsliste, damit `liste()` nie den Inhalt laden muss.
 */

import { type Entwurf, ladeEntwurf } from '@studio/editor-core';
import {
  type Blobreferenz,
  type BlobSpeicher,
  type EntwurfSpeicher,
  type Kurzfassung,
  type Mandant,
  NichtGefunden,
  type Seitenabfrage,
  SpeicherFehler,
} from './speicher.js';
import { datenAus, type WixDatenClient, type WixDatensatz } from './wixApi.js';

/** Harte Grenze eines Wix-Data-Datensatzes. */
export const WIX_DATENSATZ_GRENZE = 512 * 1024;

/**
 * Ab hier wird ausgelagert. Deutlich unter der harten Grenze, weil neben dem
 * Inhalt noch Metafelder, Feldnamen und die JSON-Hülle im selben Datensatz
 * liegen und UTF-8 mehr Bytes braucht als die Zeichenkette lang ist.
 */
export const AUSLAGERUNGSSCHWELLE = 300 * 1024;

export const SAMMLUNG_ENTWUERFE = 'Entwuerfe';

interface EntwurfDatensatz extends WixDatensatz {
  _id: string;
  organisationId: string;
  name: string;
  geaendertAm: string;
  vorlageId: string | null;
  markenkitId: string | null;
  /** JSON des Entwurfs, wenn er klein genug ist — sonst `null`. */
  inhalt: string | null;
  /** Blob-id des ausgelagerten JSON, wenn er zu groß war — sonst `null`. */
  inhaltDateiId: string | null;
  /**
   * URL derselben Datei. Wird mitgeschrieben, weil die Blobreferenz beides
   * trägt — zum Lesen privater Dateien taugt sie nicht, siehe `wixBlobSpeicher`.
   */
  inhaltDateiUrl: string | null;
}

function byteLaenge(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Liest die Auslagerungsreferenz aus einem Datensatz, oder `null`. */
function auslagerung(datensatz: WixDatensatz): Blobreferenz | null {
  const id = datensatz['inhaltDateiId'];
  if (typeof id !== 'string' || id === '') return null;
  const url = datensatz['inhaltDateiUrl'];
  return { id, url: typeof url === 'string' ? url : '' };
}

export interface WixEntwurfSpeicherOptionen {
  sammlung?: string;
  auslagerungsschwelle?: number;
}

export class WixEntwurfSpeicher implements EntwurfSpeicher {
  readonly #daten: WixDatenClient;
  readonly #blobs: BlobSpeicher;
  readonly #sammlung: string;
  readonly #schwelle: number;

  constructor(
    daten: WixDatenClient,
    blobs: BlobSpeicher,
    optionen: WixEntwurfSpeicherOptionen = {},
  ) {
    this.#daten = daten;
    this.#blobs = blobs;
    this.#sammlung = optionen.sammlung ?? SAMMLUNG_ENTWUERFE;
    this.#schwelle = optionen.auslagerungsschwelle ?? AUSLAGERUNGSSCHWELLE;
  }

  async sichere(mandant: Mandant, entwurf: Entwurf): Promise<void> {
    if (entwurf.organisationId !== mandant.organisationId) {
      throw new SpeicherFehler(
        `Entwurf gehört zu "${entwurf.organisationId}", gespeichert wird für "${mandant.organisationId}"`,
      );
    }

    const json = JSON.stringify(entwurf);
    const groesse = byteLaenge(json);

    let inhalt: string | null = json;
    let inhaltDateiId: string | null = null;
    let inhaltDateiUrl: string | null = null;

    if (groesse > this.#schwelle) {
      const datei = await this.#blobs.schreibe(
        mandant,
        `entwurf-${entwurf.id}.json`,
        'application/json',
        new Blob([json], { type: 'application/json' }),
      );
      inhalt = null;
      inhaltDateiId = datei.id;
      inhaltDateiUrl = datei.url;
    }

    const datensatz: EntwurfDatensatz = {
      _id: entwurf.id,
      organisationId: entwurf.organisationId,
      name: entwurf.name,
      geaendertAm: entwurf.geaendertAm,
      vorlageId: entwurf.vorlageId,
      markenkitId: entwurf.markenkitId,
      inhalt,
      inhaltDateiId,
      inhaltDateiUrl,
    };

    try {
      await this.#daten.items.saveDataItem(this.#sammlung, datensatz);
    } catch (ursache) {
      throw new SpeicherFehler(`Entwurf "${entwurf.id}" ließ sich nicht sichern`, ursache);
    }
  }

  async lade(mandant: Mandant, entwurfId: string): Promise<Entwurf> {
    const datensatz = await this.#hole(mandant, entwurfId);
    if (datensatz === null) throw new NichtGefunden('Entwurf', entwurfId);

    const json = await this.#inhaltVon(datensatz, entwurfId);

    let roh: unknown;
    try {
      roh = JSON.parse(json);
    } catch (ursache) {
      throw new SpeicherFehler(`Entwurf "${entwurfId}" enthält kein gültiges JSON`, ursache);
    }

    // Bewusst durch die Schemaprüfung: gespeicherte Daten sind Fremddaten,
    // auch wenn sie aus dem eigenen Backend kommen.
    const entwurf = ladeEntwurf(roh);

    if (entwurf.organisationId !== mandant.organisationId) {
      throw new NichtGefunden('Entwurf', entwurfId);
    }
    return entwurf;
  }

  async loesche(mandant: Mandant, entwurfId: string): Promise<void> {
    const datensatz = await this.#hole(mandant, entwurfId);
    if (datensatz === null) throw new NichtGefunden('Entwurf', entwurfId);

    // Erst der Datensatz, dann die Auslagerungsdatei: bricht der zweite Schritt
    // ab, bleibt eine verwaiste Datei zurück statt eines Entwurfs ohne Inhalt.
    try {
      await this.#daten.items.removeDataItem(this.#sammlung, entwurfId);
    } catch (ursache) {
      throw new SpeicherFehler(`Entwurf "${entwurfId}" ließ sich nicht löschen`, ursache);
    }

    const referenz = auslagerung(datensatz);
    if (referenz !== null) await this.#blobs.loesche(referenz);
  }

  async liste(mandant: Mandant, abfrage: Seitenabfrage = {}): Promise<Kurzfassung[]> {
    const antwort = await this.#daten.items.queryDataItems(this.#sammlung, {
      query: {
        filter: { organisationId: mandant.organisationId },
        sort: [{ fieldName: 'geaendertAm', order: 'DESC' }],
        paging: { limit: abfrage.limit ?? 50, offset: abfrage.offset ?? 0 },
      },
    });

    return this.#datensaetze(antwort).map((d) => ({
      id: String(d['_id'] ?? ''),
      name: String(d['name'] ?? ''),
      geaendertAm: String(d['geaendertAm'] ?? ''),
      vorlageId: typeof d['vorlageId'] === 'string' ? d['vorlageId'] : null,
    }));
  }

  async #hole(mandant: Mandant, entwurfId: string): Promise<WixDatensatz | null> {
    const antwort = await this.#daten.items.queryDataItems(this.#sammlung, {
      query: {
        filter: { _id: entwurfId, organisationId: mandant.organisationId },
        paging: { limit: 1 },
      },
    });
    return this.#datensaetze(antwort)[0] ?? null;
  }

  #datensaetze(antwort: {
    dataItems?: { data?: WixDatensatz }[];
    items?: WixDatensatz[];
  }): WixDatensatz[] {
    if (Array.isArray(antwort.dataItems)) {
      return antwort.dataItems.map((e) => datenAus(e)).filter((d): d is WixDatensatz => d !== null);
    }
    if (Array.isArray(antwort.items)) return antwort.items;
    return [];
  }

  async #inhaltVon(datensatz: WixDatensatz, entwurfId: string): Promise<string> {
    if (typeof datensatz['inhalt'] === 'string') return datensatz['inhalt'];

    const referenz = auslagerung(datensatz);
    if (referenz === null) {
      throw new SpeicherFehler(
        `Entwurf "${entwurfId}" hat weder Inhalt noch Auslagerungsdatei — der Datensatz ist kaputt`,
      );
    }

    try {
      return await this.#blobs.liesText(referenz);
    } catch (ursache) {
      throw new SpeicherFehler(
        `Auslagerungsdatei "${referenz.id}" von Entwurf "${entwurfId}" ist nicht lesbar`,
        ursache,
      );
    }
  }
}
