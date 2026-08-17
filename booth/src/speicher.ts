/**
 * Ablage der Aufnahmen auf der Box.
 *
 * Grundsatz aus dem Produktversprechen: Eine Aufnahme ist gesichert, bevor
 * irgendetwas anderes passiert — Netz, Druck und Upload kommen danach.
 * Im Browser liegt sie in IndexedDB, in der Desktop-Hülle später als Datei.
 */

export type Aufnahme = {
  id: string;
  /** Zeitpunkt in Millisekunden seit 1970. */
  zeit: number;
  art: string;
  event: string;
  blob: Blob;
};

const DATENBANK = 'youbooth';
const LAGER = 'aufnahmen';

let offen: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (offen) return offen;

  offen = new Promise((fertig, fehler) => {
    const anfrage = indexedDB.open(DATENBANK, 1);

    anfrage.onupgradeneeded = () => {
      const daten = anfrage.result;
      if (!daten.objectStoreNames.contains(LAGER)) {
        const lager = daten.createObjectStore(LAGER, { keyPath: 'id' });
        lager.createIndex('zeit', 'zeit');
      }
    };

    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error ?? new Error('Ablage nicht verfügbar'));
  });

  return offen;
}

export function neueKennung(): string {
  // Zeitstempel voran, damit die Reihenfolge auch im Dateinamen stimmt.
  const zufall = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${zufall}`;
}

export async function sichere(aufnahme: Aufnahme): Promise<void> {
  const daten = await db();
  await new Promise<void>((fertig, fehler) => {
    const vorgang = daten.transaction(LAGER, 'readwrite');
    vorgang.objectStore(LAGER).put(aufnahme);
    vorgang.oncomplete = () => fertig();
    vorgang.onerror = () => fehler(vorgang.error ?? new Error('Konnte nicht sichern'));
  });
}

export async function alle(): Promise<Aufnahme[]> {
  const daten = await db();
  return new Promise((fertig, fehler) => {
    const vorgang = daten.transaction(LAGER, 'readonly');
    const anfrage = vorgang.objectStore(LAGER).getAll();
    anfrage.onsuccess = () => fertig((anfrage.result as Aufnahme[]).sort((a, b) => b.zeit - a.zeit));
    anfrage.onerror = () => fehler(anfrage.error ?? new Error('Konnte nicht lesen'));
  });
}

export async function anzahl(): Promise<number> {
  const daten = await db();
  return new Promise((fertig, fehler) => {
    const vorgang = daten.transaction(LAGER, 'readonly');
    const anfrage = vorgang.objectStore(LAGER).count();
    anfrage.onsuccess = () => fertig(anfrage.result);
    anfrage.onerror = () => fehler(anfrage.error ?? new Error('Konnte nicht zählen'));
  });
}

/** Löscht Aufnahmen, deren Löschfrist abgelaufen ist. */
export async function raeumeAuf(fristTage: number): Promise<number> {
  const grenze = Date.now() - fristTage * 24 * 60 * 60 * 1000;
  const daten = await db();

  return new Promise((fertig, fehler) => {
    let geloescht = 0;
    const vorgang = daten.transaction(LAGER, 'readwrite');
    const zeiger = vorgang.objectStore(LAGER).index('zeit').openCursor(IDBKeyRange.upperBound(grenze));

    zeiger.onsuccess = () => {
      const stelle = zeiger.result;
      if (!stelle) return;
      stelle.delete();
      geloescht++;
      stelle.continue();
    };

    vorgang.oncomplete = () => fertig(geloescht);
    vorgang.onerror = () => fehler(vorgang.error ?? new Error('Aufräumen fehlgeschlagen'));
  });
}
