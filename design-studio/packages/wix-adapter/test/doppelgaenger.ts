/**
 * Doppelgänger für die Wix-Schnittstellen. Bilden das Verhalten nach, das die
 * Dokumentation zusagt — nicht mehr. Wo der echte Dienst mehr kann, darf sich
 * der Adapter nicht darauf verlassen.
 */

import type { Blobreferenz, BlobSpeicher, Mandant } from '../src/speicher.js';
import type { WixDatenClient, WixDatensatz, WixMedienClient } from '../src/wixApi.js';

export class DatenDoppelgaenger implements WixDatenClient {
  readonly sammlungen = new Map<string, Map<string, WixDatensatz>>();
  /** Wird bei jedem `saveDataItem` gesetzt — für Größenprüfungen im Test. */
  letzteGroesse = 0;

  readonly items = {
    saveDataItem: async (sammlung: string, item: WixDatensatz) => {
      this.letzteGroesse = new TextEncoder().encode(JSON.stringify(item)).length;
      const id = typeof item['_id'] === 'string' ? item['_id'] : `auto-${Math.random()}`;
      this.#sammlung(sammlung).set(id, { ...item, _id: id });
      return { dataItem: { data: { ...item, _id: id } } };
    },

    removeDataItem: async (sammlung: string, itemId: string) => {
      this.#sammlung(sammlung).delete(itemId);
      return {};
    },

    queryDataItems: async (
      sammlung: string,
      optionen: {
        query?: {
          filter?: Record<string, unknown>;
          sort?: { fieldName: string; order: 'ASC' | 'DESC' }[];
          paging?: { limit?: number; offset?: number };
        };
      },
    ) => {
      const filter = optionen.query?.filter ?? {};
      let treffer = [...this.#sammlung(sammlung).values()].filter((d) =>
        Object.entries(filter).every(([feld, wert]) => d[feld] === wert),
      );

      const sortierung = optionen.query?.sort?.[0];
      if (sortierung !== undefined) {
        const richtung = sortierung.order === 'DESC' ? -1 : 1;
        treffer = [...treffer].sort((a, b) => {
          const x = String(a[sortierung.fieldName] ?? '');
          const y = String(b[sortierung.fieldName] ?? '');
          return x < y ? -richtung : x > y ? richtung : 0;
        });
      }

      const offset = optionen.query?.paging?.offset ?? 0;
      const limit = optionen.query?.paging?.limit ?? 50;
      return { dataItems: treffer.slice(offset, offset + limit).map((data) => ({ data })) };
    },
  };

  #sammlung(name: string): Map<string, WixDatensatz> {
    let vorhanden = this.sammlungen.get(name);
    if (vorhanden === undefined) {
      vorhanden = new Map();
      this.sammlungen.set(name, vorhanden);
    }
    return vorhanden;
  }
}

export class BlobDoppelgaenger implements BlobSpeicher {
  readonly dateien = new Map<string, string>();
  #zaehler = 0;

  async schreibe(
    _mandant: Mandant,
    name: string,
    _mimeTyp: string,
    daten: Blob,
  ): Promise<Blobreferenz> {
    this.#zaehler += 1;
    const id = `datei-${this.#zaehler}`;
    this.dateien.set(id, await daten.text());
    return { id, url: `https://static.example/${id}/${name}` };
  }

  async liesText(referenz: Blobreferenz): Promise<string> {
    // Bewusst nur über die id: eine dauerhafte URL taugt bei privaten Dateien
    // nicht zum Lesen, und dieser Doppelgänger soll das nicht verschleiern.
    const inhalt = this.dateien.get(referenz.id);
    if (inhalt === undefined) throw new Error(`Datei "${referenz.id}" gibt es nicht`);
    return inhalt;
  }

  async loesche(referenz: Blobreferenz): Promise<void> {
    this.dateien.delete(referenz.id);
  }
}

/**
 * Bildet den Media Manager **einschließlich seiner Unfreundlichkeit** nach:
 * die beim Hochladen zurückgegebene `url` einer privaten Datei antwortet mit
 * 403, lesbar ist nur eine über `generateFileDownloadUrl` ausgestellte,
 * befristete URL. Ein gutmütigerer Doppelgänger hat genau diesen Fehler schon
 * einmal durchgelassen.
 */
export class MedienDoppelgaenger implements WixMedienClient {
  readonly aufrufe: { mimeType: string; optionen: unknown }[] = [];
  readonly downloadAufrufe: { fileId: string; optionen: unknown }[] = [];
  /** id → Inhalt, wie er nach dem Upload im Media Manager läge. */
  readonly inhalte = new Map<string, string>();
  /** Auf `false` setzen, um einen Client ohne diese Fähigkeit nachzubilden. */
  kannDownloadUrl = true;

  readonly files = {
    generateFileUploadUrl: async (mimeType: string, optionen?: unknown) => {
      this.aufrufe.push({ mimeType, optionen });
      return { uploadUrl: `https://upload.example/${this.aufrufe.length}` };
    },

    generateFileDownloadUrl: async (fileId: string, optionen?: unknown) => {
      if (!this.kannDownloadUrl) throw new Error('nicht verfügbar');
      this.downloadAufrufe.push({ fileId, optionen });
      return { downloadUrls: [{ assetKey: 'src', url: `${BEFRISTET}${fileId}?token=abc` }] };
    },
  };
}

/** Präfix der befristeten, lesbaren URLs im Doppelgänger. */
export const BEFRISTET = 'https://download-files.example/';
/** Präfix der dauerhaften URLs, die bei privaten Dateien 403 liefern. */
export const DAUERHAFT = 'https://static.example/';

export const mandant: Mandant = { organisationId: 'org-1' };
export const fremderMandant: Mandant = { organisationId: 'org-2' };
