/**
 * Das Ereignisprotokoll — nur anfügbar, als Hash-Kette.
 *
 * Warum das hier steht und nicht als „Audit-Log" nachgereicht wird: Wer
 * behauptet, ein Newsletter sei an 40 000 Menschen mit gültiger Einwilligung
 * gegangen, muss das im Streitfall zeigen können. Ein Protokoll, in dem sich
 * eine Zeile nachträglich ändern lässt, zeigt gar nichts.
 *
 * Die Kette leistet genau eine Sache: sie macht **jede** nachträgliche Änderung
 * sichtbar, auch die an der ältesten Zeile. Sie verhindert nichts — wer die
 * Datenbank besitzt, kann sie neu schreiben. Deshalb der Tagesabschluss: eine
 * Signatur über den Kopf des Tages, die außerhalb liegt. Was einmal abgeschlossen
 * ist, lässt sich nicht mehr unbemerkt neu schreiben.
 */

/** Was passiert ist. Frei erweiterbar — aber nie umbenennen, das Protokoll bleibt. */
export type Ereignisart =
  | 'beitrag.angelegt'
  | 'beitrag.geaendert'
  | 'beitrag.eingereicht'
  | 'beitrag.freigegeben'
  | 'beitrag.abgelehnt'
  | 'beitrag.geplant'
  | 'beitrag.veroeffentlicht'
  | 'beitrag.fehlgeschlagen'
  | 'beitrag.zurueckgezogen'
  | 'plan.ruhemodus.an'
  | 'plan.ruhemodus.aus'
  | 'empfaenger.eingetragen'
  | 'empfaenger.bestaetigt'
  | 'empfaenger.abgemeldet'
  | 'empfaenger.geloescht'
  | 'empfaenger.gesperrt'
  | 'newsletter.probe'
  | 'newsletter.ausgeloest'
  | 'newsletter.gesendet'
  | 'newsletter.abgebrochen'
  | 'kanal.verbunden'
  | 'kanal.getrennt'
  | 'mitglied.rolle.geaendert'
  | 'tag.abgeschlossen';

export interface Ereignis {
  /** Fortlaufend ab 1, lückenlos. Eine Lücke ist ein Befund. */
  folge: number;
  organisation: string;
  art: Ereignisart;
  /** Wer es ausgelöst hat. `system` für alles, was ohne Menschen geschah. */
  urheber: string;
  /** Worauf es sich bezieht — Kennung des Beitrags, des Empfängers, des Kanals. */
  bezug: string;
  zeitpunkt: number;
  /** Die Einzelheiten. Bewusst frei, aber ohne Personendaten: siehe unten. */
  inhalt: Record<string, string | number | boolean | null>;
  /** Hash des vorigen Ereignisses. Beim ersten: 64 Nullen. */
  vorher: string;
  hash: string;
}

export const KETTENANFANG = '0'.repeat(64);

/**
 * Kanonische Form.
 *
 * Zwei Rechner müssen aus demselben Ereignis denselben Hash bekommen — auch
 * dann, wenn ihre JSON-Umsetzung die Schlüssel anders sortiert. Also sortieren
 * wir selbst und schreiben nur die Felder, die zur Kette gehören.
 */
function kanonisch(e: Omit<Ereignis, 'hash'>): string {
  const inhalt = Object.keys(e.inhalt)
    .sort()
    .map((k) => [k, e.inhalt[k]] as const);
  return JSON.stringify([e.folge, e.organisation, e.art, e.urheber, e.bezug, e.zeitpunkt, inhalt, e.vorher]);
}

function alsHex(puffer: ArrayBuffer): string {
  return [...new Uint8Array(puffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashVon(e: Omit<Ereignis, 'hash'>): Promise<string> {
  const roh = new TextEncoder().encode(kanonisch(e));
  return alsHex(await crypto.subtle.digest('SHA-256', roh));
}

/**
 * Ein Ereignis an die Kette hängen.
 *
 * `voriges` ist das letzte Ereignis derselben Organisation — die Ketten laufen
 * je Mandant getrennt. Eine gemeinsame Kette wäre kürzer und würde bedeuten,
 * dass Kunde B den Takt von Kunde A ablesen kann.
 */
export async function anhaengen(
  voriges: Ereignis | null,
  neu: Omit<Ereignis, 'folge' | 'vorher' | 'hash'>,
): Promise<Ereignis> {
  const ohneHash: Omit<Ereignis, 'hash'> = {
    ...neu,
    folge: voriges ? voriges.folge + 1 : 1,
    vorher: voriges ? voriges.hash : KETTENANFANG,
  };
  return { ...ohneHash, hash: await hashVon(ohneHash) };
}

export type Kettenbefund =
  | { ok: true; laenge: number; kopf: string }
  | { ok: false; beiFolge: number; grund: 'folge' | 'verkettung' | 'hash' | 'organisation' };

/**
 * Die Kette prüfen.
 *
 * Es wird nicht nur der Hash nachgerechnet, sondern auch die Folge und die
 * Verkettung. Ein gelöschtes Ereignis in der Mitte fällt bei der Folge auf,
 * ein neu geschriebenes bei der Verkettung, ein geändertes beim Hash. Alle
 * drei zusammen decken alles ab, was ohne den Schlüssel möglich ist.
 */
export async function pruefeKette(kette: readonly Ereignis[]): Promise<Kettenbefund> {
  let vorher = KETTENANFANG;
  const organisation = kette[0]?.organisation;
  for (let i = 0; i < kette.length; i++) {
    const e = kette[i]!;
    if (e.folge !== i + 1) return { ok: false, beiFolge: e.folge, grund: 'folge' };
    if (e.organisation !== organisation) return { ok: false, beiFolge: e.folge, grund: 'organisation' };
    if (e.vorher !== vorher) return { ok: false, beiFolge: e.folge, grund: 'verkettung' };
    const { hash: _weg, ...ohne } = e;
    if ((await hashVon(ohne)) !== e.hash) return { ok: false, beiFolge: e.folge, grund: 'hash' };
    vorher = e.hash;
  }
  return { ok: true, laenge: kette.length, kopf: vorher };
}

/**
 * Der Tagesabschluss.
 *
 * Einmal am Tag wird der Kopf der Kette signiert. Die Signatur gehört an einen
 * Ort, den der Betrieb der Anwendung nicht beschreiben kann — im einfachsten
 * Fall eine Datei auf einem anderen Rechner, im besseren ein Zeitstempeldienst.
 * Ohne diesen zweiten Ort ist die Kette nur ein Versehensschutz und kein
 * Nachweis; mit ihm ist sie einer.
 */
export interface Tagesabschluss {
  organisation: string;
  /** Der Tag als `2026-08-29`, in der Zone der Organisation. */
  tag: string;
  bisFolge: number;
  kopf: string;
  signatur: string;
}

export async function schliesseTagAb(
  geheim: string,
  organisation: string,
  tag: string,
  kette: readonly Ereignis[],
): Promise<Tagesabschluss> {
  const letztes = kette.at(-1);
  const kopf = letztes ? letztes.hash : KETTENANFANG;
  const bisFolge = letztes ? letztes.folge : 0;
  const schluessel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(geheim),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    schluessel,
    new TextEncoder().encode(JSON.stringify([organisation, tag, bisFolge, kopf])),
  );
  return { organisation, tag, bisFolge, kopf, signatur: alsHex(sig) };
}

/**
 * Was **nicht** ins Protokoll gehört.
 *
 * Eine Mailadresse im Ereignisinhalt macht die Löschung nach Artikel 17
 * unmöglich, ohne die Kette zu brechen — und die Kette zu brechen, um eine
 * Löschung auszuführen, hebt beide Zusagen zugleich auf. Deshalb steht im
 * Protokoll die **Kennung** des Empfängers und nie seine Adresse. Wird der
 * Empfänger gelöscht, verweist das Protokoll ins Leere, und genau das ist
 * richtig: es bleibt nachweisbar, *dass* eine Einwilligung vorlag, ohne dass
 * noch abzulesen wäre, *wessen*.
 *
 * Diese Funktion ist der Wächter davor. Sie wird beim Anlegen aufgerufen und
 * nicht bei der Prüfung — was einmal in der Kette steht, bleibt darin.
 */
const VERDAECHTIG = /@|(?:\+\d[\d\s/-]{6,})/;

export function pruefeInhalt(inhalt: Record<string, unknown>): { ok: true } | { ok: false; feld: string } {
  for (const [feld, wert] of Object.entries(inhalt)) {
    if (typeof wert === 'string' && VERDAECHTIG.test(wert)) return { ok: false, feld };
  }
  return { ok: true };
}
