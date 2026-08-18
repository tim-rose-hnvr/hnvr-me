/**
 * Bruecke zur Desktop-Huelle.
 *
 * Im Browser laeuft alles wie bisher; laeuft der Booth in der Tauri-App,
 * legt sie jede Aufnahme zusaetzlich als Datei ab und liefert sie im lokalen
 * Netz aus — das ist der Weg, auf den der QR-Code zeigt.
 */

type Aufruf = <T>(befehl: string, daten?: Record<string, unknown>) => Promise<T>;

let aufruf: Aufruf | null = null;
let geprueft = false;

/** Laeuft der Booth in der Desktop-Huelle? */
export function inHuelle(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function hole(): Promise<Aufruf | null> {
  if (geprueft) return aufruf;
  geprueft = true;

  if (!inHuelle()) return null;

  try {
    const modul = await import('@tauri-apps/api/core');
    aufruf = modul.invoke as Aufruf;
  } catch {
    aufruf = null;
  }
  return aufruf;
}

/**
 * Legt die Aufnahme als Datei auf der Box ab.
 * Gibt den Pfad zurueck oder null, wenn es keine Huelle gibt.
 */
export async function legeAb(
  kennung: string,
  blob: Blob,
  endung: 'jpg' | 'gif' = 'jpg'
): Promise<string | null> {
  const rufe = await hole();
  if (!rufe) return null;

  const daten = Array.from(new Uint8Array(await blob.arrayBuffer()));
  try {
    return await rufe<string>('sichere_aufnahme', { kennung, endung, daten });
  } catch {
    return null;
  }
}

/**
 * Adresse, unter der die Box ihre Dateien anbietet — Grundlage des QR-Codes.
 * Leer, wenn der Dienst nicht laeuft oder der Booth im Browser laeuft.
 */
export async function ausgabeAdresse(): Promise<string> {
  const rufe = await hole();
  if (!rufe) return '';

  try {
    return await rufe<string>('ausgabe_adresse');
  } catch {
    return '';
  }
}
