/**
 * Notdach für `@wix/data`.
 *
 * Das Paket wird erst installiert, wenn das Projekt mit Wix verbunden ist
 * (`npm create @wix/new@latest headless link`). Bis dahin soll trotzdem alles
 * bauen und typprüfen — deshalb steht hier der Ausschnitt, den `speicher/wix.ts`
 * tatsächlich benutzt.
 *
 * Sobald `@wix/data` installiert ist, gewinnen dessen eigene Typen. Diese Datei
 * kann dann gelöscht werden; sie beschreibt bewusst nur einen Bruchteil der
 * Schnittstelle und ist kein Ersatz für die echte.
 *
 * Aufbau nach https://dev.wix.com/docs/sdk/business-solutions/data/items/query
 */
declare module '@wix/data' {
  interface WixDataAbfrage {
    eq(feld: string, wert: unknown): WixDataAbfrage;
    limit(anzahl: number): WixDataAbfrage;
    find(): Promise<{ items: unknown[] }>;
  }

  export const items: {
    query(dataCollectionId: string): WixDataAbfrage;
  };
}
