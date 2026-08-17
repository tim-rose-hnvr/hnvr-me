/**
 * Der Eingang — wer die Nachrichten einer Seite lesen darf.
 *
 * Ein Konto-System gibt es nicht, und eines nebenbei zu bauen wäre der falsche
 * Weg. Stattdessen ein Geheimlink: `/eingang/<schluessel>`. Wer ihn hat, sieht
 * die Anfragen dieser einen Seite; wer ihn nicht hat, sieht eine 404 — nicht
 * „falscher Schlüssel", denn schon diese Auskunft wäre eine Auskunft.
 *
 * Drei Eigenschaften, die das tragen:
 *
 *  1. Der Schlüssel steht **nur im CMS**, am Profil, niemals in einer Datei
 *     dieses Repositories. Das Repository ist öffentlich.
 *  2. Verglichen wird in gleichbleibender Zeit. Ein Vergleich, der beim ersten
 *     falschen Zeichen abbricht, verrät über die Antwortzeit, wie viele Zeichen
 *     stimmten — daraus lässt sich ein Schlüssel Stück für Stück erraten.
 *  3. Es fällt zu, nicht auf: fehlt der Schlüssel am Profil, ist er zu kurz
 *     oder passt er nicht, gibt es nichts zu sehen. Kein Standardwert, keine
 *     Ausnahme, kein „nur diesmal".
 *
 * Der Link ist ein Schlüssel, kein Lesezeichen. Das steht auch auf der Seite.
 */

/** Kürzere Schlüssel sind nicht sicher genug, um sie zu erlauben. */
export const SCHLUESSEL_LAENGE = 32;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Ein neuer Schlüssel aus dem Zufallsgenerator des Systems.
 *
 * `Math.random` wäre hier ein Fehler: er ist vorhersagbar, und aus einem
 * bekannten Schlüssel ließen sich weitere errechnen.
 */
export function neuerSchluessel(laenge = SCHLUESSEL_LAENGE): string {
  const roh = new Uint8Array(laenge);
  crypto.getRandomValues(roh);
  // Der Rest der Division verzerrt die Verteilung minimal (256 ist kein
  // Vielfaches von 62). Für einen Zugangsschlüssel dieser Länge ist das ohne
  // Bedeutung — 62^32 bleibt weit außerhalb dessen, was sich raten lässt.
  return Array.from(roh, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Sieht der Wert überhaupt nach einem Schlüssel aus? Spart die teure Abfrage. */
export function schluesselFormStimmt(wert: string): boolean {
  return wert.length >= SCHLUESSEL_LAENGE && /^[A-Za-z0-9]+$/.test(wert);
}

/**
 * Vergleich in gleichbleibender Zeit.
 *
 * Läuft immer über alle Zeichen, auch wenn das erste schon abweicht, und
 * verrät über die Dauer nichts über die Übereinstimmung. Unterschiedliche
 * Längen ergeben `false`, aber erst nach dem vollständigen Durchlauf.
 */
export function schluesselStimmt(gegeben: string, erwartet: string): boolean {
  if (!erwartet || erwartet.length < SCHLUESSEL_LAENGE) return false;

  const a = new TextEncoder().encode(gegeben);
  const b = new TextEncoder().encode(erwartet);
  let unterschied = a.length ^ b.length;

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    unterschied |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return unterschied === 0;
}

export interface Nachrichteneintrag {
  id: string;
  absicht: string;
  text: string;
  name: string;
  antwortweg: string;
  erledigt: boolean;
  eingegangen: Date | null;
}

/** Mail an den Absender, mit Bezug — spart das Zusammensuchen. */
export function antwortAdresse(eintrag: Nachrichteneintrag, seite: string): string | null {
  const mail = eintrag.antwortweg.trim();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail)) return null;
  const betreff = `Deine Anfrage über ${seite}`;
  const rumpf = [`Hallo ${eintrag.name},`, '', 'vielen Dank für deine Nachricht:', '', `> ${eintrag.text.replace(/\n/g, '\n> ')}`, '', ''].join('\n');
  return `mailto:${mail}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(rumpf)}`;
}
