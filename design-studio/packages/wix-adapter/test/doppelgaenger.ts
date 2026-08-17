/**
 * Doppelgänger für die Wix-Schnittstellen. Bilden das Verhalten nach, das die
 * Dokumentation zusagt — nicht mehr. Wo der echte Dienst mehr kann, darf sich
 * der Adapter nicht darauf verlassen.
 */

import type { BlobSpeicher, Mandant } from '../src/speicher.js';
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
  ): Promise<{ id: string; url: string }> {
    this.#zaehler += 1;
    const id = `datei-${this.#zaehler}`;
    this.dateien.set(id, await daten.text());
    return { id, url: `https://static.example/${id}/${name}` };
  }

  async liesText(id: string): Promise<string> {
    const inhalt = this.dateien.get(id);
    if (inhalt === undefined) throw new Error(`Datei "${id}" gibt es nicht`);
    return inhalt;
  }

  async loesche(id: string): Promise<void> {
    this.dateien.delete(id);
  }
}

export class MedienDoppelgaenger implements WixMedienClient {
  readonly aufrufe: { mimeType: string; optionen: unknown }[] = [];

  readonly files = {
    generateFileUploadUrl: async (mimeType: string, optionen?: unknown) => {
      this.aufrufe.push({ mimeType, optionen });
      return { uploadUrl: `https://upload.example/${this.aufrufe.length}` };
    },
  };
}

export const mandant: Mandant = { organisationId: 'org-1' };
export const fremderMandant: Mandant = { organisationId: 'org-2' };
