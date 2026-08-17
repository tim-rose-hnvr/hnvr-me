/**
 * Erreichbarkeit — der Unterschied zwischen einer Linkliste und einer Seite,
 * die tatsächlich Kontakt herstellt.
 *
 * Eine Linkliste zeigt jedem dasselbe. Wer sonntags um 23 Uhr einen QR-Code am
 * Fahrzeug scannt und auf „Jetzt anrufen" tippt, landet im Nichts und ist weg.
 * Deshalb kennt diese Seite die Öffnungszeiten des Betriebs und stellt die
 * Aktion nach vorn, die gerade wirklich trägt: im Betrieb den Anruf, außerhalb
 * den schriftlichen Weg — mit ehrlicher Ansage, wann geantwortet wird.
 *
 * Zwei Regeln, die den Ausschlag geben:
 *
 *  1. Alles gilt in der Zeitzone des Betriebs (siehe `zeit.ts`).
 *  2. Es wird nie mehr behauptet, als der Plan hergibt. Ohne Plan gibt es
 *     keine Statuszeile — eine erfundene Verfügbarkeit ist schlimmer als keine.
 */

import {
  datumPlus,
  nameDesWochentags,
  tagPlus,
  wanduhr,
  zuMinute,
  zuUhrzeit,
  type Wanduhr,
  type Wochentag,
} from './zeit.ts';

export type { Wochentag };

/** Ein regelmäßiges Zeitfenster. `bis` kleiner/gleich `von` heißt: über Mitternacht. */
export interface Fenster {
  tag: Wochentag;
  von: string;
  bis: string;
}

/** Ein einzelner Tag, der von der Regel abweicht: Feiertag, Betriebsferien, Sondertermin. */
export interface Ausnahme {
  /** ISO-Datum in der Zeitzone des Betriebs, z. B. "2026-12-24". */
  datum: string;
  grund?: string;
  /** Fehlt oder leer: ganztags geschlossen. Sonst gelten genau diese Zeiten. */
  zeiten?: { von: string; bis: string }[];
}

export interface Erreichbarkeitsplan {
  zeitzone: string;
  fenster: Fenster[];
  ausnahmen?: Ausnahme[];
  /** Was außerhalb der Zeiten zugesagt wird, z. B. „Antwort am nächsten Werktag". */
  zusage?: string;
}

export interface NaechsteOeffnung {
  datum: string;
  von: string;
  /** 0 = heute, 1 = morgen, sonst Abstand in Kalendertagen. */
  inTagen: number;
  /** Fertige Angabe für die Statuszeile, z. B. „morgen ab 9:00". */
  text: string;
}

export interface Lage {
  offen: boolean;
  /** Nur wenn offen: bis wann durchgehend geöffnet ist. */
  bis?: string;
  /** Nur wenn geschlossen und in den nächsten 14 Tagen wieder geöffnet wird. */
  naechste?: NaechsteOeffnung;
  /** Grund einer Ausnahme, wenn heute eine greift. */
  grund?: string;
}

interface Abschnitt {
  von: number;
  bis: number;
}

/** Wie weit nach vorn gesucht wird, bevor „auf Weiteres geschlossen" gilt. */
const SICHTWEITE_TAGE = 14;

function ausnahmeFuer(plan: Erreichbarkeitsplan, datum: string): Ausnahme | undefined {
  return plan.ausnahmen?.find((a) => a.datum === datum);
}

/**
 * Die rohen Fenster eines Kalendertags — noch mit möglichem Überhang über
 * Mitternacht, so wie sie gepflegt wurden.
 */
function rohFenster(plan: Erreichbarkeitsplan, datum: string, tag: Wochentag): Abschnitt[] {
  const ausnahme = ausnahmeFuer(plan, datum);
  const roh = ausnahme
    ? (ausnahme.zeiten ?? []).map((z) => ({ von: z.von, bis: z.bis }))
    : plan.fenster.filter((f) => f.tag === tag).map((f) => ({ von: f.von, bis: f.bis }));

  const abschnitte: Abschnitt[] = [];
  for (const r of roh) {
    const von = zuMinute(r.von);
    const bis = zuMinute(r.bis);
    // Unlesbare Angaben werden übergangen statt geraten.
    if (von === null || bis === null) continue;
    if (von === bis) continue;
    abschnitte.push({ von, bis });
  }
  return abschnitte;
}

/** Überlappende und direkt aneinandergrenzende Abschnitte werden zu einem. */
function verschmelzen(abschnitte: Abschnitt[]): Abschnitt[] {
  const sortiert = [...abschnitte].sort((a, b) => a.von - b.von);
  const heraus: Abschnitt[] = [];
  for (const a of sortiert) {
    const letzter = heraus[heraus.length - 1];
    if (letzter && a.von <= letzter.bis) letzter.bis = Math.max(letzter.bis, a.bis);
    else heraus.push({ ...a });
  }
  return heraus;
}

/**
 * Alle Abschnitte, die auf diesem Kalendertag liegen — einschließlich des
 * Überhangs aus der Nacht davor. Danach liegt jeder Abschnitt sauber innerhalb
 * von 0 … 1440, was jede weitere Rechnung geradeaus macht.
 */
function tagesAbschnitte(plan: Erreichbarkeitsplan, datum: string, tag: Wochentag): Abschnitt[] {
  const abschnitte: Abschnitt[] = [];

  for (const a of rohFenster(plan, datum, tag)) {
    if (a.bis > a.von) abschnitte.push(a);
    else abschnitte.push({ von: a.von, bis: 1440 }); // Rest liegt im Folgetag
  }

  const vortag = datumPlus(datum, -1);
  for (const a of rohFenster(plan, vortag, tagPlus(tag, -1))) {
    if (a.bis <= a.von) abschnitte.push({ von: 0, bis: a.bis });
  }

  return verschmelzen(abschnitte);
}

/**
 * Endet ein Abschnitt exakt um Mitternacht und geht der Folgetag um Mitternacht
 * weiter, ist das durchgehend geöffnet — dann gehört das spätere Ende in die
 * Anzeige, nicht „bis 00:00".
 */
function durchgehendBis(plan: Erreichbarkeitsplan, datum: string, tag: Wochentag, bis: number): string {
  let d = datum;
  let t = tag;
  let ende = bis;

  for (let i = 0; i < 7 && ende === 1440; i++) {
    d = datumPlus(d, 1);
    t = tagPlus(t, 1);
    const naechster = tagesAbschnitte(plan, d, t)[0];
    if (!naechster || naechster.von !== 0) break;
    ende = naechster.bis;
  }

  return zuUhrzeit(ende);
}

function beschreibeTag(inTagen: number, tag: Wochentag): string {
  if (inTagen === 0) return 'heute';
  if (inTagen === 1) return 'morgen';
  if (inTagen < 7) return nameDesWochentags(tag);
  return `${nameDesWochentags(tag)} in einer Woche`;
}

/** Uhrzeiten für Menschen: „9:00" statt „09:00", „18:30" bleibt. */
function lesbar(uhrzeit: string): string {
  return uhrzeit.replace(/^0/, '');
}

/**
 * Bewertet, ob der Betrieb zum angegebenen Zeitpunkt erreichbar ist.
 *
 * @param plan   Öffnungszeiten samt Zeitzone.
 * @param jetzt  Zeitpunkt der Betrachtung. Wird übergeben statt gelesen, damit
 *               die Regel prüfbar bleibt.
 */
export function bewerteErreichbarkeit(plan: Erreichbarkeitsplan, jetzt: Date): Lage {
  const heute: Wanduhr = wanduhr(jetzt, plan.zeitzone);
  const abschnitteHeute = tagesAbschnitte(plan, heute.datum, heute.wochentag);

  const laufend = abschnitteHeute.find((a) => heute.minute >= a.von && heute.minute < a.bis);
  if (laufend) {
    return { offen: true, bis: durchgehendBis(plan, heute.datum, heute.wochentag, laufend.bis) };
  }

  const grund = ausnahmeFuer(plan, heute.datum)?.grund;

  for (let versatz = 0; versatz < SICHTWEITE_TAGE; versatz++) {
    const datum = datumPlus(heute.datum, versatz);
    const tag = tagPlus(heute.wochentag, versatz);
    const abschnitte = versatz === 0 ? abschnitteHeute : tagesAbschnitte(plan, datum, tag);
    const naechster = abschnitte.find((a) => versatz > 0 || a.von > heute.minute);
    if (!naechster) continue;

    const von = zuUhrzeit(naechster.von);
    return {
      offen: false,
      grund,
      naechste: {
        datum,
        von,
        inTagen: versatz,
        text: `${beschreibeTag(versatz, tag)} ab ${lesbar(von)}`,
      },
    };
  }

  return { offen: false, grund };
}

/**
 * Die Statuszeile, wie sie auf der Seite steht. Bewusst kurz und ohne
 * Ausrufezeichen: sie informiert, sie wirbt nicht.
 */
export function statusText(lage: Lage, zusage?: string): string {
  if (lage.offen) {
    return lage.bis ? `Jetzt erreichbar · bis ${lesbar(lage.bis)}` : 'Jetzt erreichbar';
  }

  const teile: string[] = [lage.grund ? `Geschlossen · ${lage.grund}` : 'Gerade geschlossen'];
  if (lage.naechste) teile.push(lage.naechste.text);
  else if (zusage) teile.push(zusage);
  return teile.join(' · ');
}
