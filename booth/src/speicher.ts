/**
 * Ablage der Aufnahmen — auf der Box, nicht im Browser.
 *
 * Bis hierher lagen die Bilder in IndexedDB. Das hatte eine Grenze, die man
 * erst im Saal merkt: **Nur derselbe Browser auf demselben Rechner sah sie.**
 * Foto-Wall am Beamer, Galerie auf dem Handy, Teilen-Station neben der Box —
 * alles andere sind eigene Geräte im WLAN, und für die war die Ablage
 * unsichtbar.
 *
 * Jetzt liegen die Aufnahmen als Dateien auf der Box und werden über deren
 * Server ausgeliefert. Damit sehen alle Geräte dasselbe, und ein Neustart des
 * Browsers verliert nichts.
 *
 * Grundsatz aus dem Produktversprechen bleibt: Eine Aufnahme ist gesichert,
 * bevor irgendetwas anderes passiert — Druck, Teilen und Wand kommen danach.
 */

export type Aufnahme = {
  /** Dateiname auf der Box; zugleich die Kennung für QR und Download. */
  id: string;
  /** Adresse zum Anzeigen und Herunterladen. */
  url: string;
  /** Zeitpunkt in Millisekunden seit 1970. */
  zeit: number;
  /** Aufnahmeart, aus dem Dateinamen gelesen. */
  art: string;
  /** Bewegtbild statt Standbild — GIF ebenso wie echtes Video. */
  bewegt: boolean;
  /**
   * Echte Videodatei. Der Unterschied zum GIF ist keine Formatfrage: Ein
   * GIF läuft in einem `<img>`, ein Video braucht ein `<video>` — und es
   * hat Ton. Wer beides gleich behandelt, zeigt eine kaputte Kachel.
   */
  video: boolean;
};

type Rohaufnahme = { name: string; url: string; time: number; type: string };

/**
 * Die Aufnahmeart steckt im Dateinamen: `youbooth_<zeit>_<art>_<zufall>.jpg`.
 * Kein zweites Verzeichnis, keine Datenbank daneben — wer den Ordner kopiert,
 * kopiert auch die Zuordnung mit.
 */
function deute(roh: Rohaufnahme): Aufnahme {
  const teile = roh.name.split('_');
  const art = teile.length >= 4 ? teile[2]! : 'foto';
  return {
    id: roh.name,
    url: roh.url,
    zeit: roh.time,
    art,
    bewegt: /\.(gif|webm|mp4)$/i.test(roh.name),
    video: /\.(webm|mp4)$/i.test(roh.name),
  };
}

async function hole<T>(pfad: string, wunsch?: RequestInit): Promise<T> {
  const antwort = await fetch(pfad, wunsch);
  if (!antwort.ok) {
    const text = await antwort.text().catch(() => '');
    throw new Error(`${antwort.status} ${text.slice(0, 120)}`);
  }
  return (await antwort.json()) as T;
}

/**
 * Sichert eine Aufnahme auf der Box und gibt sie zurück — mit dem Namen, den
 * die Box vergeben hat. Der ist ab da die Kennung für QR-Code und Datei.
 */
export async function sichere(
  bilddaten: string,
  art: string,
  /**
   * Name einer Aufnahme, die diese hier ersetzen soll. Gedacht für den
   * Ergebnisbildschirm: Der Gast wählt einen Kunststil, das Blatt wird neu
   * gerechnet — und tritt an die Stelle des alten, statt daneben zu liegen.
   *
   * Die Box entscheidet, ob sie das zulässt. Sie tut es nur für eine Datei,
   * die es gibt und die jung genug ist, um zur laufenden Runde zu gehören.
   * Kommt sie nicht mit, legt sie eine neue an — der Gast bekommt sein Bild,
   * und höchstens die Ablage hat ein Blatt zu viel.
   */
  ersetzt?: string
): Promise<Aufnahme> {
  const antwort = await hole<{ ok: boolean; photo: Rohaufnahme }>('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: bilddaten, mode: art, source: 'booth', ersetzt }),
  });
  return deute(antwort.photo);
}

export async function alle(): Promise<Aufnahme[]> {
  const liste = await hole<Rohaufnahme[]>('/api/photos');
  return liste.map(deute);
}

export async function anzahl(): Promise<number> {
  return (await alle()).length;
}

export async function loesche(id: string): Promise<void> {
  await fetch('/api/photos/' + encodeURIComponent(id), { method: 'DELETE' });
}

/**
 * Löscht Aufnahmen, deren Löschfrist abgelaufen ist. Läuft beim Start des
 * Booths — was den Gästen versprochen wurde, muss ohne Zutun passieren.
 */
export async function raeumeAuf(fristTage: number): Promise<number> {
  if (!(fristTage > 0)) return 0;
  const grenze = Date.now() - fristTage * 24 * 60 * 60 * 1000;
  const alt = (await alle()).filter((a) => a.zeit < grenze);
  for (const a of alt) await loesche(a.id);
  return alt.length;
}
