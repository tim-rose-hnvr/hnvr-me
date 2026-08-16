/**
 * Wanduhr — Datum und Uhrzeit so, wie sie am Ort des Betriebs an der Wand hängen.
 *
 * Jede Aussage über Erreichbarkeit gilt in der Zeitzone des Betriebs, nicht in
 * der des Besuchers. Wer in Hannover um 17 Uhr schließt, schließt auch dann um
 * 17 Uhr, wenn die Seite in Singapur geöffnet wird. Deshalb wird hier konsequent
 * über `Intl` in die Zielzeitzone gerechnet und danach nur noch mit
 * Wanduhr-Werten gearbeitet — kein Offset-Basteln, keine Sommerzeit-Fallen.
 */

/** Wochentage nach ISO-8601: 1 = Montag … 7 = Sonntag. */
export type Wochentag = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Wanduhr {
  /** ISO-Datum am Ort des Betriebs, z. B. "2026-08-16". */
  datum: string;
  wochentag: Wochentag;
  /** Minuten seit Mitternacht, 0 … 1439. */
  minute: number;
}

const WOCHENTAGE: Record<string, Wochentag> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

const NAMEN: Record<Wochentag, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
};

/** Formatierer sind teuer, werden aber je Zeitzone nur einmal gebraucht. */
const formatierer = new Map<string, Intl.DateTimeFormat>();

function formatierer_fuer(zeitzone: string): Intl.DateTimeFormat {
  let f = formatierer.get(zeitzone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zeitzone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    formatierer.set(zeitzone, f);
  }
  return f;
}

/**
 * Rechnet einen absoluten Zeitpunkt in die Wanduhr der angegebenen Zeitzone um.
 *
 * @throws RangeError, wenn die Zeitzone unbekannt ist. Bewusst laut: eine falsch
 *         geschriebene Zeitzone würde sonst stillschweigend UTC liefern und die
 *         Öffnungszeiten um bis zu zwei Stunden verschieben.
 */
export function wanduhr(zeitpunkt: Date, zeitzone: string): Wanduhr {
  const teile = formatierer_fuer(zeitzone).formatToParts(zeitpunkt);
  const w: Record<string, string> = {};
  for (const t of teile) if (t.type !== 'literal') w[t.type] = t.value;

  const wochentag = WOCHENTAGE[w.weekday!];
  if (!wochentag) throw new RangeError(`Unerwarteter Wochentag: ${w.weekday}`);

  // "24" statt "00" ist ein bekannter Ausrutscher älterer ICU-Stände bei hour12:false.
  const stunde = Number(w.hour) % 24;

  return {
    datum: `${w.year}-${w.month}-${w.day}`,
    wochentag,
    minute: stunde * 60 + Number(w.minute),
  };
}

/** "09:30" → 570. Gibt null zurück, wenn die Angabe keine gültige Uhrzeit ist. */
export function zuMinute(uhrzeit: string): number | null {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec(String(uhrzeit).trim());
  if (!treffer) return null;
  const stunde = Number(treffer[1]);
  const minute = Number(treffer[2]);
  if (stunde > 24 || minute > 59) return null;
  if (stunde === 24 && minute !== 0) return null;
  return stunde * 60 + minute;
}

/** 570 → "09:30". Minuten jenseits eines Tages werden auf den Tag zurückgeholt. */
export function zuUhrzeit(minute: number): string {
  const m = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function nameDesWochentags(tag: Wochentag): string {
  return NAMEN[tag];
}

/** Wochentag im Kreis verschieben: 7 + 1 = 1, 1 − 1 = 7. Auch für negative Schritte. */
export function tagPlus(tag: Wochentag, tage: number): Wochentag {
  return ((((tag - 1 + tage) % 7) + 7) % 7 + 1) as Wochentag;
}

/** Verschiebt ein ISO-Datum um ganze Tage. Rein kalendarisch, ohne Zeitzone. */
export function datumPlus(datum: string, tage: number): string {
  const [jahr, monat, tag] = datum.split('-').map(Number);
  const d = new Date(Date.UTC(jahr!, monat! - 1, tag!));
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}
