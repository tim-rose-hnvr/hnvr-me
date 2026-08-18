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
 *
 * ÜBERHOLT: Seit die Box einen eigenen Server hat, legt der die Aufnahmen an
 * (`/api/photos`) und liefert sie im ganzen WLAN aus. Diese Brücke bleibt nur,
 * bis die Desktop-Hülle gewechselt ist — dann verschwindet sie mitsamt dem
 * Rust-Auslieferungsdienst.
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

/**
 * Stand des Fernausloesers: Wie oft wurde im Netz der Box auf „Los" getippt?
 * Ein Zaehler, kein Ereignis — eine verpasste Abfrage verschluckt nichts.
 * Ohne Huelle bleibt es bei 0.
 */
export async function fernStand(): Promise<number> {
  const rufe = await hole();
  if (!rufe) return 0;

  try {
    return await rufe<number>('fern_stand');
  } catch {
    return 0;
  }
}

/* ---------- Drucken ueber das Betriebssystem ----------
   Im Browser bleibt der Druckdialog; in der Huelle druckt die Box selbst,
   randlos zentriert und ohne Rueckfrage. Auf einer Feier steht niemand am
   Rechner, der einen Dialog wegklickt. */

export type Druckerauskunft = { drucker: string[]; standard: string | null };

export async function druckerListe(): Promise<Druckerauskunft> {
  const rufe = await hole();
  if (!rufe) return { drucker: [], standard: null };
  try {
    return await rufe<Druckerauskunft>('drucker_liste');
  } catch {
    return { drucker: [], standard: null };
  }
}

/**
 * Druckt ein Bild ueber die Huelle. Gibt `null` zurueck, wenn es keine Huelle
 * gibt — dann bleibt der Weg ueber den Systemdruckdialog. Ein Fehlertext
 * heisst: Die Huelle war da, der Druck ging schief.
 */
export async function druckeInHuelle(
  blob: Blob,
  drucker: string
): Promise<{ gedruckt: true } | { fehler: string } | null> {
  const rufe = await hole();
  if (!rufe) return null;

  const daten = Array.from(new Uint8Array(await blob.arrayBuffer()));
  try {
    await rufe<void>('drucke_bild', { daten, drucker, endung: 'jpg' });
    return { gedruckt: true };
  } catch (fehler) {
    return { fehler: String(fehler).slice(0, 200) };
  }
}
