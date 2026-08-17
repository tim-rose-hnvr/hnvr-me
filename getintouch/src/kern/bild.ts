/**
 * Bilder für die Visitenkarte.
 *
 * Ein Kontakt mit Foto ist im Adressbuch wiederzufinden, einer ohne nicht.
 * Das Foto muss dafür aber *in* der vCard liegen, nicht als Verweis: ein
 * verlinktes Bild lädt jedes Mal nach, wenn jemand den Kontakt aufschlägt, und
 * meldet dabei Zeitpunkt und IP-Adresse an den Bildserver.
 *
 * Deshalb wird das Bild einmal auf dem Server geholt und eingebettet. Weil der
 * Pfad aus gepflegten Daten stammt und ein Server hier für andere ins Netz
 * greift, gilt eine enge Liste erlaubter Herkünfte, eine Obergrenze und ein
 * Zeitlimit. Ohne diese drei wäre das eine offene Tür (SSRF).
 */

/** Hosts, von denen Profilbilder stammen dürfen. Alles andere wird ausgelassen. */
const ERLAUBTE_HOSTS = [
  'hnvr.me',
  'www.hnvr.me',
  // Wix legt hochgeladene Medien dort ab.
  '.wixstatic.com',
  '.wixmp.com',
  '.wix-site-host.com',
];

/** Ein Foto im Adressbuch. Mehr als ein halbes Megabyte braucht dafür niemand. */
const MAX_BYTES = 512 * 1024;
const ZEITLIMIT_MS = 3000;

const ERLAUBTE_TYPEN = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function hostErlaubt(ziel: URL, basis: URL): boolean {
  if (ziel.origin === basis.origin) return true;
  if (ziel.protocol !== 'https:') return false;
  return ERLAUBTE_HOSTS.some((h) => (h.startsWith('.') ? ziel.hostname.endsWith(h) : ziel.hostname === h));
}

/**
 * Holt ein Bild und gibt es als Datenadresse zurück.
 *
 * Gibt `undefined` zurück, sobald irgendetwas nicht stimmt — ein fehlendes
 * Foto ist ein kleiner Verlust, eine kaputte oder hängende Antwort auf die
 * Visitenkarte ein großer.
 */
export async function alsDatenadresse(quelle: string | undefined, basis: URL): Promise<string | undefined> {
  if (!quelle) return undefined;
  if (quelle.startsWith('data:')) return quelle;

  let ziel: URL;
  try {
    ziel = new URL(quelle, basis);
  } catch {
    return undefined;
  }
  if (!hostErlaubt(ziel, basis)) return undefined;

  const abbruch = AbortSignal.timeout(ZEITLIMIT_MS);

  try {
    const antwort = await fetch(ziel, { signal: abbruch, redirect: 'follow' });
    if (!antwort.ok) return undefined;

    const typ = (antwort.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!ERLAUBTE_TYPEN.has(typ)) return undefined;

    const angekuendigt = Number(antwort.headers.get('content-length') ?? '0');
    if (angekuendigt > MAX_BYTES) return undefined;

    const daten = new Uint8Array(await antwort.arrayBuffer());
    // Nicht jeder Server kündigt die Länge an — deshalb wird auch danach geprüft.
    if (daten.byteLength === 0 || daten.byteLength > MAX_BYTES) return undefined;

    return `data:${typ};base64,${Buffer.from(daten).toString('base64')}`;
  } catch (fehler) {
    // Nicht still verschlucken: ein fehlendes Foto in der Visitenkarte fällt
    // sonst erst auf, wenn jemand den Kontakt gespeichert hat.
    console.error(`[getintouch] Foto ${ziel.href} nicht einbettbar:`, fehler);
    return undefined;
  }
}
