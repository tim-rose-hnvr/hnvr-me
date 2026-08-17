/**
 * Die Wix-Aufrufe, die dieser Adapter braucht — als schmale Schnittstellen
 * beschrieben, nicht als Abhängigkeit importiert.
 *
 * Grund: `@wix/sdk` lässt sich ohne echtes Headless-Projekt nicht sinnvoll
 * testen. Die hier beschriebenen Formen entsprechen den dokumentierten
 * Signaturen, der echte Client erfüllt sie strukturell. Damit ist der Adapter
 * gegen Doppelgänger prüfbar und trotzdem gegen die echte API gebaut.
 *
 * Belegt in der Wix-Dokumentation:
 * - `data.items.saveDataItem`, `removeDataItem`, `queryDataItems`
 *   https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/save-data-item
 * - `media.files.generateFileUploadUrl` und der anschließende PUT auf die URL
 *   https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/upload-api
 *
 * Bewusst nicht benutzt: die Kettenbauer (`items.query(...).eq(...).find()`).
 * Wix bezeichnet sie als Altbestand und empfiehlt die Wix API Query Language.
 */

export interface WixDatensatz {
  _id?: string;
  [feld: string]: unknown;
}

export interface WixFilter {
  [feld: string]: unknown;
}

export interface WixAbfrage {
  filter?: WixFilter;
  sort?: { fieldName: string; order: 'ASC' | 'DESC' }[];
  paging?: { limit?: number; offset?: number };
}

export interface WixDatenClient {
  items: {
    saveDataItem(
      dataCollectionId: string,
      item: WixDatensatz,
    ): Promise<{ dataItem?: WixDatensatz } | WixDatensatz>;
    removeDataItem(dataCollectionId: string, itemId: string): Promise<unknown>;
    queryDataItems(
      dataCollectionId: string,
      optionen: { query?: WixAbfrage },
    ): Promise<{ dataItems?: { data?: WixDatensatz }[]; items?: WixDatensatz[] }>;
  };
}

export interface WixMedienClient {
  files: {
    generateFileUploadUrl(
      mimeType: string,
      optionen?: {
        fileName?: string;
        parentFolderId?: string;
        private?: boolean;
        labels?: string[];
      },
    ): Promise<{ uploadUrl: string }>;
  };
}

/** Der `fetch`, den der Adapter für Hoch- und Herunterladen benutzt. */
export type Netzzugriff = typeof globalThis.fetch;

/**
 * Wix liefert Datensätze je nach Aufrufweg als `{ dataItem: { data } }`,
 * `{ data }` oder flach. Diese Funktion ist die einzige Stelle, die das weiß.
 */
export function datenAus(antwort: unknown): WixDatensatz | null {
  if (typeof antwort !== 'object' || antwort === null) return null;
  const o = antwort as Record<string, unknown>;

  const ausDataItem = o['dataItem'];
  if (typeof ausDataItem === 'object' && ausDataItem !== null) {
    return datenAus(ausDataItem) ?? (ausDataItem as WixDatensatz);
  }

  const ausData = o['data'];
  if (typeof ausData === 'object' && ausData !== null) {
    return ausData as WixDatensatz;
  }

  return o as WixDatensatz;
}
