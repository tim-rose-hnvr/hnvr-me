/**
 * Zeitrechnung mit Zeitzonen.
 *
 * Warum das eine eigene Datei ist: ein Redaktionsplan rechnet ausschließlich in
 * örtlicher Zeit („Dienstag um neun"), ein Versand ausschließlich in absoluter
 * („in 3600 Sekunden"). Dazwischen liegen zweimal im Jahr die Stunden, die es
 * nicht gibt und die es doppelt gibt. Wer das an fünf Stellen einzeln löst,
 * löst es viermal falsch.
 *
 * Es gibt hier keine Bibliothek. `Intl.DateTimeFormat` kennt die
 * Zeitzonendatenbank, die im Betriebssystem liegt, und das genügt. Eine
 * mitgelieferte Zonentabelle wäre eine, die veraltet.
 */

export interface OertlicheZeit {
  jahr: number;
  monat: number; // 1–12
  tag: number; // 1–31
  stunde: number; // 0–23
  minute: number; // 0–59
  sekunde: number; // 0–59
}

/** Standardzone des Hauses. Steht an einer Stelle, damit sie an einer wechselt. */
export const ZONE = 'Europe/Berlin';

const formatspeicher = new Map<string, Intl.DateTimeFormat>();

function former(zone: string): Intl.DateTimeFormat {
  let f = formatspeicher.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      // h23, nicht h24: sonst kommt für Mitternacht die Stunde 24 zurück und
      // jede Rechnung darauf ist um einen Tag daneben.
      hourCycle: 'h23',
    });
    formatspeicher.set(zone, f);
  }
  return f;
}

/** Ein Zeitpunkt, gelesen in einer Zone. */
export function oertlich(zeitpunkt: number, zone: string = ZONE): OertlicheZeit {
  const teile = former(zone).formatToParts(new Date(zeitpunkt));
  const holen = (art: Intl.DateTimeFormatPartTypes): number => {
    const t = teile.find((p) => p.type === art);
    return t ? Number(t.value) : 0;
  };
  return {
    jahr: holen('year'),
    monat: holen('month'),
    tag: holen('day'),
    stunde: holen('hour'),
    minute: holen('minute'),
    sekunde: holen('second'),
  };
}

/** Der Versatz der Zone gegenüber UTC in Minuten, für diesen einen Zeitpunkt. */
export function versatzMinuten(zeitpunkt: number, zone: string = ZONE): number {
  const o = oertlich(zeitpunkt, zone);
  const alsWaereEsUtc = Date.UTC(o.jahr, o.monat - 1, o.tag, o.stunde, o.minute, o.sekunde);
  // Millisekunden abschneiden: der Former liefert keine.
  return Math.round((alsWaereEsUtc - (zeitpunkt - (zeitpunkt % 1000))) / 60000);
}

/**
 * Wie eine örtliche Angabe zu einem Zeitpunkt wird — und was sie ist.
 *
 * `eindeutig` ist der Normalfall. Die beiden anderen sind die Nacht der
 * Umstellung:
 *
 * - `luecke`: die Angabe gibt es nicht (in Berlin am Umstellungssonntag im März
 *   zwischen 02:00 und 03:00). Zurück kommt der Zeitpunkt, der so weit hinter
 *   der Lücke liegt wie die Angabe hinter ihrem Beginn — aus 02:30 wird 03:30.
 *   Ein Newsletter, der „um halb drei" sollte, geht dann um halb vier und nicht
 *   gar nicht.
 * - `doppelt`: die Angabe gibt es zweimal (im Oktober zwischen 02:00 und
 *   03:00). Zurück kommt die **erste**. Zu früh ist bei einer Veröffentlichung
 *   das kleinere Übel als zu spät, und vor allem ist es die Regel, die auch
 *   Temporal anwenden wird.
 */
export function ausOertlich(
  o: OertlicheZeit,
  zone: string = ZONE,
): { zeitpunkt: number; lage: 'eindeutig' | 'luecke' | 'doppelt' } {
  const naiv = Date.UTC(o.jahr, o.monat - 1, o.tag, o.stunde, o.minute, o.sekunde);

  // Der Versatz einen Tag davor und einen Tag danach: an einem Umstellungstag
  // sind das zwei verschiedene, an jedem anderen Tag derselbe.
  const vorher = versatzMinuten(naiv - 86_400_000, zone);
  const nachher = versatzMinuten(naiv + 86_400_000, zone);

  const kandidaten = [...new Set([naiv - vorher * 60_000, naiv - nachher * 60_000])];
  const gueltig = kandidaten.filter((k) => {
    const zurueck = oertlich(k, zone);
    return (
      zurueck.jahr === o.jahr &&
      zurueck.monat === o.monat &&
      zurueck.tag === o.tag &&
      zurueck.stunde === o.stunde &&
      zurueck.minute === o.minute
    );
  });

  if (gueltig.length === 1) return { zeitpunkt: gueltig[0]!, lage: 'eindeutig' };
  if (gueltig.length > 1) return { zeitpunkt: Math.min(...gueltig), lage: 'doppelt' };
  return { zeitpunkt: Math.max(...kandidaten), lage: 'luecke' };
}

/** 1 = Montag … 7 = Sonntag. ISO, weil eine Redaktionswoche montags beginnt. */
export function wochentag(zeitpunkt: number, zone: string = ZONE): number {
  const o = oertlich(zeitpunkt, zone);
  const tag = new Date(Date.UTC(o.jahr, o.monat - 1, o.tag)).getUTCDay();
  return tag === 0 ? 7 : tag;
}

/** Minuten seit Mitternacht in der Zone — das Maß für Ruhezeiten. */
export function minutenAmTag(zeitpunkt: number, zone: string = ZONE): number {
  const o = oertlich(zeitpunkt, zone);
  return o.stunde * 60 + o.minute;
}

/**
 * Auf das nächste Rastermaß aufrunden — in örtlicher Zeit.
 *
 * In UTC zu runden wäre einfacher und in Indien, Nepal und auf den
 * Chatham-Inseln falsch: deren Versatz ist keine volle Stunde, ein
 * Viertelstundenraster läge dort schief.
 */
export function rasterAuf(zeitpunkt: number, minuten: number, zone: string = ZONE): number {
  if (minuten <= 0) return zeitpunkt;
  const o = oertlich(zeitpunkt, zone);
  // Schon genau auf dem Raster? Dann nicht bewegen. Sonst schöbe jeder Aufruf
  // den Zeitpunkt um ein weiteres Rastermaß nach hinten.
  if (o.sekunde === 0 && zeitpunkt % 60_000 === 0 && o.minute % minuten === 0) return zeitpunkt;

  const ziel = (Math.floor((o.stunde * 60 + o.minute) / minuten) + 1) * minuten;
  if (ziel >= 1440) return tagesbeginn(tagePlus(zeitpunkt, 1, zone), zone);
  return ausOertlich(
    { ...o, stunde: Math.floor(ziel / 60), minute: ziel % 60, sekunde: 0 },
    zone,
  ).zeitpunkt;
}

/** Mitternacht des Tages, in dem der Zeitpunkt liegt. */
export function tagesbeginn(zeitpunkt: number, zone: string = ZONE): number {
  const o = oertlich(zeitpunkt, zone);
  return ausOertlich({ ...o, stunde: 0, minute: 0, sekunde: 0 }, zone).zeitpunkt;
}

/** Montag, 00:00, der Woche, in der der Zeitpunkt liegt. */
export function wochenbeginn(zeitpunkt: number, zone: string = ZONE): number {
  // Über `tagePlus` und nicht über `- n * 86400000`: über eine Umstellung
  // hinweg hat ein Tag 23 oder 25 Stunden, und dann liegt die Woche schief.
  return tagesbeginn(tagePlus(zeitpunkt, -(wochentag(zeitpunkt, zone) - 1), zone), zone);
}

/** Ganze Tage weiterschalten, ohne über Umstellungen zu verrutschen. */
export function tagePlus(zeitpunkt: number, tage: number, zone: string = ZONE): number {
  const o = oertlich(zeitpunkt, zone);
  const verschoben = new Date(Date.UTC(o.jahr, o.monat - 1, o.tag + tage));
  return ausOertlich(
    {
      jahr: verschoben.getUTCFullYear(),
      monat: verschoben.getUTCMonth() + 1,
      tag: verschoben.getUTCDate(),
      stunde: o.stunde,
      minute: o.minute,
      sekunde: o.sekunde,
    },
    zone,
  ).zeitpunkt;
}

export const WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'] as const;

export const MONATE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
] as const;

/** Für die Anzeige: „Di, 3. Feb, 09:00". Kurz, weil es in Tabellen steht. */
export function alsText(zeitpunkt: number, zone: string = ZONE): string {
  const o = oertlich(zeitpunkt, zone);
  const wt = WOCHENTAGE[wochentag(zeitpunkt, zone) - 1]!.slice(0, 2);
  const mo = MONATE[o.monat - 1]!.slice(0, 3);
  return `${wt}, ${o.tag}. ${mo}, ${String(o.stunde).padStart(2, '0')}:${String(o.minute).padStart(2, '0')}`;
}

/** Für `datetime`-Felder im Browser: `2026-02-03T09:00`, örtlich. */
export function alsFeldwert(zeitpunkt: number, zone: string = ZONE): string {
  const o = oertlich(zeitpunkt, zone);
  const z = (n: number, s = 2) => String(n).padStart(s, '0');
  return `${z(o.jahr, 4)}-${z(o.monat)}-${z(o.tag)}T${z(o.stunde)}:${z(o.minute)}`;
}

/** Und zurück. Gibt `null`, wenn der Wert keine Form hat, mit der zu rechnen wäre. */
export function ausFeldwert(wert: string, zone: string = ZONE): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wert.trim());
  if (!m) return null;
  const [, j, mo, t, st, mi] = m;
  const o: OertlicheZeit = {
    jahr: Number(j), monat: Number(mo), tag: Number(t),
    stunde: Number(st), minute: Number(mi), sekunde: 0,
  };
  if (o.monat < 1 || o.monat > 12 || o.tag < 1 || o.tag > 31 || o.stunde > 23 || o.minute > 59) return null;
  return ausOertlich(o, zone).zeitpunkt;
}
