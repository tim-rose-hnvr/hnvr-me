/* Lager — die zwei Sammlungen, die der Server braucht.

   Wix legt Datensammlungen normalerweise im Verwaltungsbereich an. Das geht
   hier nicht: dieses Projekt wird vom Terminal aus gebaut und veröffentlicht,
   nicht angeklickt. Also legt der Server sie beim ersten Gebrauch selbst an,
   mit erhöhten Rechten (`auth.elevate`) — und merkt sich für den Rest des
   Laufs, dass er es schon getan hat.

   Das ist ausdrücklich träge und nicht schön. Der saubere Weg wäre eine
   Wanderung beim Ausrollen; den gibt es hier nicht. Wer die Sammlung von Hand
   anlegt, bekommt dieselbe — der Code prüft nur, ob sie da ist. */

import { auth } from '@wix/essentials';
import { collections } from '@wix/data';

const SAMMLUNGEN = {
  Kontaktanfragen: [
    { key: 'name', displayName: 'Name', type: 'TEXT' },
    { key: 'absender', displayName: 'Absender', type: 'TEXT' },
    { key: 'nachricht', displayName: 'Nachricht', type: 'TEXT' },
    { key: 'eingegangen', displayName: 'Eingegangen', type: 'DATETIME' },
  ],
  Signaturauftraege: [
    { key: 'titel', displayName: 'Titel', type: 'TEXT' },
    { key: 'dateiname', displayName: 'Dateiname', type: 'TEXT' },
    { key: 'datei', displayName: 'Datei', type: 'TEXT' },
    { key: 'absender', displayName: 'Absender', type: 'TEXT' },
    { key: 'empfaenger', displayName: 'Empfänger', type: 'TEXT' },
    { key: 'schluessel', displayName: 'Schlüssel', type: 'TEXT' },
    { key: 'stand', displayName: 'Stand', type: 'TEXT' },
    { key: 'unterschrift', displayName: 'Unterschrift', type: 'TEXT' },
    { key: 'verlauf', displayName: 'Verlauf', type: 'TEXT' },
    { key: 'angelegt', displayName: 'Angelegt', type: 'DATETIME' },
  ],
};

const fertig = new Set();

/**
 * Sorgt dafür, dass es die Sammlung gibt. Mehrfach aufrufbar.
 * @param {'Kontaktanfragen'|'Signaturauftraege'} name
 */
export async function sorgeFuerSammlung(name) {
  if (fertig.has(name)) return;
  const felder = SAMMLUNGEN[name];
  if (!felder) throw new Error(`Unbekannte Sammlung: ${name}`);

  const erhoeht = auth.elevate(collections.createDataCollection);
  try {
    await erhoeht({
      id: name,
      displayName: name,
      fields: felder,
      permissions: {
        /* Anlegen darf jeder — das ist der Zweck eines Formulars. Lesen und
           Ändern nur der Betreiber: eine Kontaktanfrage geht niemanden sonst
           etwas an, und ein Signaturauftrag schon gar nicht. */
        insert: 'ANYONE',
        read: 'ADMIN',
        update: 'ADMIN',
        remove: 'ADMIN',
      },
    });
  } catch (fehler) {
    /* „Gibt es schon" ist der Normalfall ab dem zweiten Aufruf und kein
       Fehler. Alles andere fliegt weiter. */
    const text = String(fehler?.message || fehler);
    if (!/already exists|ALREADY_EXISTS|duplicate/i.test(text)) throw fehler;
  }
  fertig.add(name);
}

/** Ein Schlüssel für einen Signaturlink. Kein Geheimnis von Hand gebaut. */
export function neuerSchluessel() {
  const rohe = new Uint8Array(24);
  crypto.getRandomValues(rohe);
  return [...rohe].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function antwort(koerper, status = 200) {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
