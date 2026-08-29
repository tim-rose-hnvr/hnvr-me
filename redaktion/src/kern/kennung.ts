/**
 * Kennungen, Zufall und Token.
 *
 * Drei Dinge, die überall gebraucht werden und die man genau einmal richtig
 * machen sollte: eine Kennung, die sich sortieren lässt; Zufall ohne
 * Schieflage; und ein Token, das man einem Fremden in die Hand geben kann,
 * ohne dass er daraus ein zweites bauen kann.
 *
 * Eigene Kryptografie gibt es hier nicht. Alles Rechnen macht `crypto.subtle`.
 */

/**
 * 62 Zeichen, keine Sonderzeichen, keine Verwechslung beim Vorlesen am Telefon
 * — dafür wäre ein kleineres Alphabet nötig, und das kostet Entropie, die wir
 * bei Abmeldelinks nicht verschenken wollen.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 256 ist kein Vielfaches von 62. Wer `byte % 62` rechnet, macht die ersten
 * acht Zeichen des Alphabets häufiger als die übrigen — bei 32 Zeichen Länge
 * ist das messbar und bei einem Abmeldetoken ist es ein Fehler.
 *
 * 62 · 4 = 248: alles ab 248 wird verworfen und neu gezogen.
 */
const OBERGRENZE = 248;

/**
 * `crypto.getRandomValues` nimmt höchstens 65 536 Bytes auf einmal — darüber
 * wirft es. Ein Puffer fester Größe, mehrfach gefüllt, umgeht das und ist
 * zugleich schonender mit dem Speicher als ein Puffer, der mit der Länge
 * wächst.
 */
const PUFFERGROESSE = 4096;

export function zufallszeichen(laenge: number): string {
  if (laenge <= 0) return '';
  let heraus = '';
  const rohling = new Uint8Array(PUFFERGROESSE);
  while (heraus.length < laenge) {
    crypto.getRandomValues(rohling);
    for (const b of rohling) {
      if (b >= OBERGRENZE) continue;
      heraus += ALPHABET[b % 62];
      if (heraus.length === laenge) break;
    }
  }
  return heraus;
}

/**
 * Eine Kennung, die nach Entstehungszeit sortiert.
 *
 * `Date.now().toString(36)` ist bis ins Jahr 5188 achtstellig, also lässt sich
 * lexikografisch sortieren, was zeitlich sortiert werden soll — ohne
 * Datenbanksequenz und ohne zweite Spalte. Die acht Zufallszeichen dahinter
 * verhindern Kollisionen innerhalb derselben Millisekunde.
 *
 * Das Präfix steht davor, damit man in einem Protokoll auf einen Blick sieht,
 * worum es geht: `bt_` ist ein Beitrag, `ep_` ein Empfänger.
 */
export function neueKennung(praefix: string, jetzt: number = Date.now()): string {
  return `${praefix}_${jetzt.toString(36).padStart(8, '0')}${zufallszeichen(8)}`;
}

/** Ein Schlüssel für Geheimlinks: 32 Zeichen aus 62 sind rund 190 Bit. */
export function neuerSchluessel(): string {
  return zufallszeichen(32);
}

/* ------------------------------------------------------------------ Token */

/**
 * Ein Token ist `nutzlast.signatur`, beide base64url.
 *
 * Die Nutzlast ist lesbar — absichtlich. Wer den Abmeldelink anschaut, soll
 * sehen können, worauf er sich bezieht. Geheim ist nicht der Inhalt, sondern
 * die Fähigkeit, einen gültigen zweiten zu erzeugen.
 */
export interface Nutzlast {
  /** Wofür das Token gilt. Ein Bestätigungstoken darf nicht abmelden. */
  zweck: string;
  /** Worauf es sich bezieht — meist eine Empfängerkennung. */
  bezug: string;
  /** Verfall in Millisekunden seit 1970. `0` heißt: verfällt nicht. */
  verfall: number;
}

function nachB64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function ausB64url(text: string): Uint8Array {
  const gefuellt = text.replace(/-/g, '+').replace(/_/g, '/');
  const roh = atob(gefuellt + '='.repeat((4 - (gefuellt.length % 4)) % 4));
  const bytes = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
  return bytes;
}

const schluesselspeicher = new Map<string, Promise<CryptoKey>>();

function hmacSchluessel(geheim: string): Promise<CryptoKey> {
  let vorhanden = schluesselspeicher.get(geheim);
  if (!vorhanden) {
    vorhanden = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(geheim),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    schluesselspeicher.set(geheim, vorhanden);
  }
  return vorhanden;
}

async function signiere(geheim: string, text: string): Promise<string> {
  const schluessel = await hmacSchluessel(geheim);
  const sig = await crypto.subtle.sign('HMAC', schluessel, new TextEncoder().encode(text));
  return nachB64url(new Uint8Array(sig));
}

/**
 * Vergleich in gleichbleibender Zeit.
 *
 * Ein Vergleich, der beim ersten falschen Zeichen abbricht, verrät über die
 * Dauer, wie viele Zeichen stimmten. Bei einem Token, das man beliebig oft
 * ausprobieren darf, ist das der ganze Angriff.
 */
export function gleichInGleicherZeit(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i++) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

export async function tokenBauen(geheim: string, nutzlast: Nutzlast): Promise<string> {
  // Feste Feldreihenfolge: JSON.stringify über ein Objektliteral ist in der
  // Reihenfolge stabil, über ein zusammengebautes Objekt nicht unbedingt.
  const roh = JSON.stringify([nutzlast.zweck, nutzlast.bezug, nutzlast.verfall]);
  const teil = nachB64url(new TextEncoder().encode(roh));
  return `${teil}.${await signiere(geheim, teil)}`;
}

export type Tokenpruefung =
  | { ok: true; nutzlast: Nutzlast }
  | { ok: false; grund: 'form' | 'signatur' | 'zweck' | 'abgelaufen' };

export async function tokenPruefen(
  geheim: string,
  token: string,
  zweck: string,
  jetzt: number = Date.now(),
): Promise<Tokenpruefung> {
  const punkt = token.indexOf('.');
  if (punkt <= 0 || punkt === token.length - 1) return { ok: false, grund: 'form' };
  const teil = token.slice(0, punkt);
  const sig = token.slice(punkt + 1);

  // Erst die Signatur, dann der Inhalt: unsignierte Nutzlast wird nicht einmal
  // geparst, damit ein missgebildetes JSON nichts auslösen kann.
  if (!gleichInGleicherZeit(sig, await signiere(geheim, teil))) {
    return { ok: false, grund: 'signatur' };
  }

  let felder: unknown;
  try {
    felder = JSON.parse(new TextDecoder().decode(ausB64url(teil)));
  } catch {
    return { ok: false, grund: 'form' };
  }
  if (!Array.isArray(felder) || felder.length !== 3) return { ok: false, grund: 'form' };
  const [z, bezug, verfall] = felder as [unknown, unknown, unknown];
  if (typeof z !== 'string' || typeof bezug !== 'string' || typeof verfall !== 'number') {
    return { ok: false, grund: 'form' };
  }

  // Der Zweck wird geprüft, nicht nur mitgeschrieben: sonst meldet ein
  // Bestätigungslink beim zweiten Klick jemanden ab.
  if (z !== zweck) return { ok: false, grund: 'zweck' };
  if (verfall !== 0 && jetzt > verfall) return { ok: false, grund: 'abgelaufen' };

  return { ok: true, nutzlast: { zweck: z, bezug, verfall } };
}

/**
 * Ein Streuwert über eine Zeichenkette, gleichverteilt zwischen 0 und 1.
 *
 * Gebraucht für A/B-Teilung: derselbe Empfänger muss bei jedem Aufruf in
 * dieselbe Gruppe fallen, auch nach einem Neustart. Ein Zufallszahlengenerator
 * kann das nicht, ein Streuwert schon. Ausdrücklich nicht für Sicherheit.
 *
 * **Der Nachlauf am Ende ist nicht schmückend.** FNV-1a allein mischt die
 * oberen Bits schlecht, und genau die entscheiden bei einer Zweiteilung. Bei
 * 49 ähnlichen Schlüsseln (`nl_1:ep_0` bis `nl_1:ep_48`) fielen ohne ihn
 * **2 statt 24** in die erste Gruppe — ein A/B-Versuch, der 2 gegen 47 teilt,
 * misst nichts. Der Nachlauf ist der Finalisierer aus Murmur3; er kostet drei
 * Schiebungen und macht aus dem Streuwert einen brauchbaren.
 *
 * Aufgefallen ist das nicht im Test — der prüfte 5000 Schlüssel, und dort
 * mittelt sich die Schieflage weg. Erst die Oberfläche mit 49 Empfängern hat
 * es gezeigt.
 */
export function streuwert(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}
