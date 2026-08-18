/**
 * Wache vor den Betreiber-Oberflächen.
 *
 * Cockpit, Portal, Editor und Einrichtung zeigen Kundennamen, Adressen und
 * Telefonnummern. Auf einer Feier hängt die Box im selben WLAN wie die Gäste —
 * ohne Anmeldung stünden diese Seiten dort offen wie ein Aushang.
 *
 * Der Booth selbst, die Foto-Wall und die Galerie bleiben frei: Sie sind für
 * Gäste gebaut, und eine Wand am Beamer, die nach einem Kennwort fragt, wäre
 * eine Wand, die niemand aufhängt.
 *
 * Geprüft wird auf der Box. Diese Datei entscheidet nichts — sie fragt nur, ob
 * die Box uns kennt, und schickt sonst zum Anmeldeschirm.
 */

export type Betreiberstand = {
  /** Ist überhaupt schon jemand eingerichtet? */
  angelegt: boolean;
  angemeldet: boolean;
  name: string;
  email: string;
  firma: string;
};

export async function betreiberstand(): Promise<Betreiberstand | null> {
  try {
    const antwort = await fetch('/api/betreiber');
    if (!antwort.ok) return null;
    return (await antwort.json()) as Betreiberstand;
  } catch {
    return null;
  }
}

/**
 * Vor dem Zeichnen aufrufen. Gibt den Stand zurück, wenn es weitergehen darf —
 * sonst schickt sie zum Anmeldeschirm und gibt `null` zurück; der Aufrufer
 * hört dann einfach auf.
 *
 * Antwortet die Box gar nicht, wird NICHT weggeschickt: Ein Netzaussetzer
 * mitten in einer Feier darf den Betreiber nicht aus seinem eigenen Cockpit
 * werfen. Dann bleibt die Seite stehen und sagt es.
 */
export async function verlangeAnmeldung(): Promise<Betreiberstand | null> {
  const stand = await betreiberstand();
  if (!stand) return null;
  if (stand.angemeldet || !stand.angelegt) return stand;

  const zurueck = encodeURIComponent(location.pathname + location.search);
  location.replace(`./anmelden.html?weiter=${zurueck}`);
  return null;
}

export async function abmelden(): Promise<void> {
  await fetch('/api/abmelden', { method: 'POST' }).catch(() => null);
  location.replace('./anmelden.html');
}
