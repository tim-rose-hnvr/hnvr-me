/**
 * `@studio/wix-adapter` — Wix Headless hinter der Speicherschnittstelle.
 *
 * Nichts oberhalb dieses Pakets darf Wix kennen. Wer hier etwas hinzufügt,
 * prüft zuerst, ob es in `speicher.ts` als anbieterfreier Vertrag beschreibbar
 * ist.
 */

export * from './speicher.js';
export * from './wixApi.js';
export * from './wixAussageSpeicher.js';
export * from './wixBlobSpeicher.js';
export * from './wixEntwurfSpeicher.js';
