/**
 * Brücke zur Box und zur Desktop-Hülle.
 *
 * Vorher lief hier alles über Tauri: Aufnahmen ablegen, drucken, Drucker
 * auflisten, Adresse erfragen. Das hatte eine Grenze, die im Saal auffällt —
 * **nur die Desktop-App konnte drucken.** Die Teilen-Station daneben, das
 * Handy im WLAN und der Browser auf dem zweiten Rechner nicht.
 *
 * Seit die Box einen eigenen Server hat, kann sie das alles selbst, und zwar
 * für jedes Gerät im Netz gleich: `/api/print`, `/api/printers`, `/api/info`.
 * Dort sitzen auch die Grenzen — Druckkontingent je Event und je Runde. Ein
 * Knopf, den nur der Booth ausblendet, wäre keine Grenze.
 *
 * Übrig bleibt für die Hülle das, was ein Browser nicht kann: Vollbild ohne
 * Leiste, Autostart, Selbstaktualisierung. Sie meldet sich über `window.hülle`,
 * das die Vorschaltdatei der Electron-App setzt.
 */

/** Beschreibung der Hülle, falls der Booth in ihr läuft. */
type Huelle = {
  fassung: string;
  system: string;
  /* Vollbild auf Zuruf. Die Box startet im Fenster — für den Abend gehört sie
     ins Vollbild, für die Einrichtung nicht. Im Browser fehlen die beiden
     Zeilen; dann schaltet der Betreiber selbst um. */
  vollbild?: (an: boolean) => Promise<boolean>;
  istVollbild?: () => Promise<boolean>;
};

declare global {
  interface Window {
    youboothHuelle?: Huelle;
  }
}

/** Läuft der Booth in der Desktop-Hülle? */
export function inHuelle(): boolean {
  return typeof window !== 'undefined' && !!window.youboothHuelle;
}

/** Fassung und System der Hülle — für die Einrichtung und die Fehlersuche. */
export function huellenauskunft(): Huelle | null {
  return (typeof window !== 'undefined' && window.youboothHuelle) || null;
}

async function hole<T>(pfad: string, wunsch?: RequestInit): Promise<T | null> {
  try {
    const antwort = await fetch(pfad, {
      ...wunsch,
      headers: { 'Content-Type': 'application/json', ...(wunsch?.headers ?? {}) },
    });
    if (!antwort.ok) return null;
    return (await antwort.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Adresse, unter der die Box ihre Dateien im Netz anbietet — Grundlage des
 * QR-Codes. Sie kommt von der Box selbst: Sie kennt ihre Adresse im WLAN, der
 * Browser kennt nur `localhost`, und darauf zeigt kein brauchbarer QR-Code.
 */
export async function ausgabeAdresse(): Promise<string> {
  const info = await hole<{ base?: string }>('/api/info');
  return info?.base ?? '';
}

/**
 * Stand des Fernauslösers: Wie oft wurde im Netz der Box auf „Los" getippt?
 * Ein Zähler, kein Ereignis — eine verpasste Abfrage verschluckt nichts.
 */
export async function fernStand(): Promise<number> {
  const stand = await hole<{ stand?: number }>('/api/fern/auftrag');
  return stand?.stand ?? 0;
}

/* ---------- Drucken über die Box ---------- */

export type Druckerauskunft = { drucker: string[]; standard: string | null };

export async function druckerListe(): Promise<Druckerauskunft> {
  const antwort = await hole<{ printers?: string[]; selected?: string | null }>('/api/printers');
  return { drucker: antwort?.printers ?? [], standard: antwort?.selected ?? null };
}

/**
 * Schickt ein Bild an den Drucker der Box.
 *
 * `null` heißt: Die Box ist nicht erreichbar — dann bleibt der Weg über den
 * Systemdruckdialog. Ein Fehlertext heißt: Sie war da und hat abgelehnt, etwa
 * weil das Druckkontingent des Events aufgebraucht ist. Der Unterschied ist
 * wichtig: Im ersten Fall soll der Booth es anders versuchen, im zweiten nicht.
 */
export async function druckeUeberBox(
  bilddaten: string,
  runde = ''
): Promise<{ gedruckt: true } | { fehler: string } | null> {
  let antwort: Response;
  try {
    antwort = await fetch('/api/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: bilddaten, runde }),
    });
  } catch {
    return null;
  }

  if (antwort.ok) return { gedruckt: true };

  const text = await antwort.text().catch(() => '');
  try {
    const daten = JSON.parse(text) as { error?: string };
    if (daten.error) return { fehler: daten.error };
  } catch {
    /* kein JSON — dann der nackte Text */
  }
  return { fehler: text.slice(0, 200) || `Die Box hat abgelehnt (${antwort.status}).` };
}
