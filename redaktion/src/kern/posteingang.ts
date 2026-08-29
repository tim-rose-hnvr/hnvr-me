/**
 * Der gemeinsame Posteingang.
 *
 * Kommentare, Erwähnungen, Direktnachrichten — **und Antworten auf den
 * Newsletter**. Das Letzte ist der Punkt: wer eine Mail an 40 000 verschickt,
 * bekommt 200 Antworten, und die landen sonst im Postfach einer einzelnen
 * Person, wo sie niemand sieht und niemand zuweisen kann. Genau dort geht die
 * Trennung zwischen „sozialen Kanälen" und „E-Mail" zuerst kaputt.
 *
 * Zwei Regeln tragen den Eingang:
 *
 * 1. **Ein Vorgang gehört zu einem Zeitpunkt genau einer Person.** Zwei
 *    Antworten auf denselben Kommentar sind schlimmer als eine späte. Die
 *    Zuweisung ist deshalb eine Sperre und keine Beschriftung — mit Ablauf,
 *    denn wer eine Sperre nimmt und in den Feierabend geht, blockiert sonst
 *    bis Montag.
 * 2. **Die Frist läuft in Dienstzeiten.** Ein Kommentar am Freitag um 18 Uhr
 *    mit vier Stunden Frist ist am Samstag um acht nicht überfällig. Eine
 *    Frist, die nachts weiterläuft, wird am Montag abgeschaltet und danach nie
 *    wieder eingeschaltet.
 */

import type { Befund } from './befund.ts';
import type { Kanalart } from './kanal.ts';
import { darfHier, type Sitzung } from './rollen.ts';
import { minutenAmTag, tagePlus, tagesbeginn, wochentag, ZONE } from './zeit.ts';

export type Vorgangsart = 'kommentar' | 'erwaehnung' | 'nachricht' | 'bewertung' | 'mailantwort';

export const VORGANGSZUSTAENDE = ['neu', 'inArbeit', 'beantwortet', 'geschlossen', 'versteckt'] as const;
export type Vorgangszustand = (typeof VORGANGSZUSTAENDE)[number];

export interface Vorgang {
  kennung: string;
  organisation: string;
  kanal: string;
  kanalart: Kanalart;
  art: Vorgangsart;
  /** Auf welchen Beitrag oder Newsletter er sich bezieht. Leer bei Nachrichten. */
  bezug?: string;
  /** Wie der Absender im Netz heißt. Bei Mail: die Adresse. */
  von: string;
  text: string;
  eingegangenAm: number;
  zustand: Vorgangszustand;
  /** Die Sperre: wer gerade daran arbeitet und bis wann. */
  sperre?: { person: string; bis: number };
  /** Wer zuletzt geantwortet hat und wann. */
  antwort?: { person: string; zeitpunkt: number; text: string };
  /** Interne Notizen. Gehen nie hinaus. */
  notizen: Array<{ person: string; zeitpunkt: number; text: string }>;
  /** Frist für die erste Antwort, in Dienstminuten. */
  fristMinuten: number;
}

/**
 * Wie lange eine Zuweisung hält.
 *
 * 30 Minuten. Lang genug, um in Ruhe zu antworten, kurz genug, dass ein
 * vergessener Vorgang nicht den Nachmittag blockiert. Wer länger braucht,
 * verlängert — das ist ein Handgriff und kein Hindernis.
 */
export const SPERRDAUER_MS = 30 * 60_000;

export interface Dienstzeit {
  /** ISO: 1 = Montag … 7 = Sonntag. */
  wochentage: number[];
  vonMinute: number;
  bisMinute: number;
}

export const DIENSTZEIT_UEBLICH: Dienstzeit[] = [
  { wochentage: [1, 2, 3, 4, 5], vonMinute: 9 * 60, bisMinute: 18 * 60 },
];

/**
 * Dienstminuten zwischen zwei Zeitpunkten.
 *
 * Tageweise, weil Dienstzeiten an Wochentagen hängen und ein Tag über eine
 * Zeitumstellung 23 oder 25 Stunden hat. Die Obergrenze von 90 Tagen ist eine
 * Notbremse: eine Frist über ein Vierteljahr ist keine.
 */
export function dienstminuten(
  von: number,
  bis: number,
  zeiten: readonly Dienstzeit[] = DIENSTZEIT_UEBLICH,
  zone: string = ZONE,
): number {
  if (bis <= von) return 0;
  let summe = 0;
  let tag = tagesbeginn(von, zone);
  const ende = tagesbeginn(bis, zone);

  for (let i = 0; i <= 90 && tag <= ende; i++) {
    const wt = wochentag(tag, zone);
    for (const z of zeiten) {
      if (!z.wochentage.includes(wt)) continue;
      // Fensteranfang und -ende dieses Tages, dann der Überlapp mit dem
      // gefragten Zeitraum.
      const ueberlappVon = Math.max(tag + z.vonMinute * 60_000, von);
      const ueberlappBis = Math.min(tag + z.bisMinute * 60_000, bis);
      if (ueberlappBis > ueberlappVon) summe += (ueberlappBis - ueberlappVon) / 60_000;
    }
    // Einen Tag weiter, über die Mittagszeit gerechnet: von Mitternacht aus
    // führte ein Tag mit 25 Stunden zurück auf denselben Tag.
    tag = tagesbeginn(tagePlus(tag + 12 * 3_600_000, 1, zone), zone);
  }
  return Math.round(summe);
}

/** Ist gerade Dienstzeit? Für die Anzeige „außerhalb der Zeiten". */
export function inDienstzeit(
  zeitpunkt: number,
  zeiten: readonly Dienstzeit[] = DIENSTZEIT_UEBLICH,
  zone: string = ZONE,
): boolean {
  const wt = wochentag(zeitpunkt, zone);
  const min = minutenAmTag(zeitpunkt, zone);
  return zeiten.some((z) => z.wochentage.includes(wt) && min >= z.vonMinute && min < z.bisMinute);
}

/**
 * Wie viel Frist noch bleibt, in Dienstminuten. Negativ heißt überfällig.
 *
 * Gemessen wird bis zur **ersten** Antwort. Was danach kommt, ist ein Gespräch
 * und keine Frist — eine zweite Frist auf jede Rückfrage macht aus einem
 * Eingang eine Uhr, vor der man flieht.
 */
export function fristrest(
  vorgang: Vorgang,
  jetzt: number,
  zeiten: readonly Dienstzeit[] = DIENSTZEIT_UEBLICH,
  zone: string = ZONE,
): number {
  const bis = vorgang.antwort?.zeitpunkt ?? jetzt;
  return vorgang.fristMinuten - dienstminuten(vorgang.eingegangenAm, bis, zeiten, zone);
}

export function fristbefund(
  vorgang: Vorgang,
  jetzt: number,
  zeiten: readonly Dienstzeit[] = DIENSTZEIT_UEBLICH,
  zone: string = ZONE,
): Befund | null {
  if (vorgang.antwort || vorgang.zustand === 'geschlossen' || vorgang.zustand === 'versteckt') return null;
  const rest = fristrest(vorgang, jetzt, zeiten, zone);
  if (rest < 0) {
    return {
      schwere: 'warnung',
      kennung: 'eingang.ueberfaellig',
      text: `Seit ${Math.abs(rest)} Dienstminuten über der Frist.`,
      stelle: vorgang.kennung,
    };
  }
  if (rest <= 30) {
    return {
      schwere: 'hinweis',
      kennung: 'eingang.knapp',
      text: `Noch ${rest} Dienstminuten bis zur Frist.`,
      stelle: vorgang.kennung,
    };
  }
  return null;
}

/* ------------------------------------------------------------- Zuweisung */

export type Vorgangsergebnis = { ok: true; vorgang: Vorgang } | { ok: false; befund: Befund };

/** Hält gerade jemand anderes die Sperre? */
export function gesperrtVon(vorgang: Vorgang, jetzt: number): string | null {
  if (!vorgang.sperre) return null;
  if (vorgang.sperre.bis <= jetzt) return null;
  return vorgang.sperre.person;
}

/**
 * Einen Vorgang übernehmen.
 *
 * Wer die Sperre schon hat, verlängert sie durch dasselbe Vorgehen — das ist
 * der Knopf „ich bin noch dran" und braucht keinen zweiten.
 */
export function uebernehmen(vorgang: Vorgang, sitzung: Sitzung, jetzt: number): Vorgangsergebnis {
  if (!darfHier(sitzung, 'eingang.antworten', vorgang.organisation)) {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'eingang.kein.recht', text: 'Diese Rolle antwortet nicht.' } };
  }
  const halter = gesperrtVon(vorgang, jetzt);
  if (halter && halter !== sitzung.person) {
    const nochMinuten = Math.ceil((vorgang.sperre!.bis - jetzt) / 60_000);
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'eingang.belegt',
        text: `${halter} arbeitet gerade daran, noch ${nochMinuten} ${nochMinuten === 1 ? 'Minute' : 'Minuten'}.`,
        stelle: vorgang.kennung,
      },
    };
  }
  return {
    ok: true,
    vorgang: {
      ...vorgang,
      zustand: vorgang.zustand === 'neu' ? 'inArbeit' : vorgang.zustand,
      sperre: { person: sitzung.person, bis: jetzt + SPERRDAUER_MS },
    },
  };
}

/** Zurücklegen. Der Vorgang geht auf `neu`, wenn noch nichts geschehen ist. */
export function zurueckgeben(vorgang: Vorgang, sitzung: Sitzung, jetzt: number): Vorgang {
  if (gesperrtVon(vorgang, jetzt) !== sitzung.person) return vorgang;
  const { sperre: _weg, ...ohne } = vorgang;
  return { ...ohne, zustand: vorgang.antwort ? vorgang.zustand : 'neu' };
}

/**
 * Antworten.
 *
 * Zwei Bedingungen, und beide sind der Grund für diese Datei: die Sperre muss
 * bei dieser Person liegen, und der Vorgang darf nicht schon beantwortet sein.
 * Das Zweite fängt den Fall, den kein Sperrmechanismus fängt — zwei geöffnete
 * Fenster derselben Person, oder eine Sperre, die zwischendurch ablief.
 */
export function antworten(
  vorgang: Vorgang,
  sitzung: Sitzung,
  text: string,
  jetzt: number,
): Vorgangsergebnis {
  if (!darfHier(sitzung, 'eingang.antworten', vorgang.organisation)) {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'eingang.kein.recht', text: 'Diese Rolle antwortet nicht.' } };
  }
  const halter = gesperrtVon(vorgang, jetzt);
  if (halter !== sitzung.person) {
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'eingang.ohne.sperre',
        text: halter
          ? `${halter} arbeitet gerade daran. Erst übernehmen, dann antworten.`
          : 'Der Vorgang ist nicht übernommen. Erst übernehmen, dann antworten.',
        stelle: vorgang.kennung,
      },
    };
  }
  if (vorgang.antwort) {
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'eingang.schon.beantwortet',
        text: `${vorgang.antwort.person} hat inzwischen geantwortet. Erst nachlesen — zwei Antworten sind schlimmer als eine späte.`,
        stelle: vorgang.kennung,
      },
    };
  }
  if (text.trim().length === 0) {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'eingang.antwort.leer', text: 'Die Antwort ist leer.' } };
  }
  const { sperre: _weg, ...ohne } = vorgang;
  return {
    ok: true,
    vorgang: { ...ohne, zustand: 'beantwortet', antwort: { person: sitzung.person, zeitpunkt: jetzt, text: text.trim() } },
  };
}

/** Eine interne Notiz. Geht nie hinaus — deshalb ohne Sperre und ohne Frist. */
export function notieren(vorgang: Vorgang, sitzung: Sitzung, text: string, jetzt: number): Vorgangsergebnis {
  if (!darfHier(sitzung, 'eingang.lesen', vorgang.organisation)) {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'eingang.kein.recht', text: 'Diese Rolle sieht den Eingang nicht.' } };
  }
  if (text.trim().length === 0) {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'eingang.notiz.leer', text: 'Die Notiz ist leer.' } };
  }
  return {
    ok: true,
    vorgang: { ...vorgang, notizen: [...vorgang.notizen, { person: sitzung.person, zeitpunkt: jetzt, text: text.trim() }] },
  };
}

export function schliessen(vorgang: Vorgang, sitzung: Sitzung): Vorgangsergebnis {
  if (!darfHier(sitzung, 'eingang.antworten', vorgang.organisation)) {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'eingang.kein.recht', text: 'Diese Rolle schließt nichts.' } };
  }
  const { sperre: _weg, ...ohne } = vorgang;
  return { ok: true, vorgang: { ...ohne, zustand: 'geschlossen' } };
}

/**
 * Die Reihenfolge im Eingang.
 *
 * Überfällige zuerst, dann nach Frist, dann nach Alter. Nicht nach Kanal und
 * nicht nach Netz: ein Eingang, der nach Kanälen sortiert, ist wieder ein
 * Stapel je Kanal, und dann hätte man ihn nicht zusammenlegen müssen.
 */
export function reihenfolge(
  vorgaenge: readonly Vorgang[],
  jetzt: number,
  zeiten: readonly Dienstzeit[] = DIENSTZEIT_UEBLICH,
  zone: string = ZONE,
): Vorgang[] {
  const offen = vorgaenge.filter((v) => v.zustand === 'neu' || v.zustand === 'inArbeit');
  return offen
    .map((v) => ({ v, rest: fristrest(v, jetzt, zeiten, zone) }))
    .sort((a, b) => a.rest - b.rest || a.v.eingegangenAm - b.v.eingegangenAm)
    .map((x) => x.v);
}

export interface Eingangsbild {
  offen: number;
  ueberfaellig: number;
  inArbeit: number;
  heuteBeantwortet: number;
  /** Mittlere erste Antwortzeit in Dienstminuten. `null`, wenn nichts vorliegt. */
  mittlereAntwortzeit: number | null;
}

export function eingangsbild(
  vorgaenge: readonly Vorgang[],
  jetzt: number,
  zeiten: readonly Dienstzeit[] = DIENSTZEIT_UEBLICH,
  zone: string = ZONE,
): Eingangsbild {
  const offen = vorgaenge.filter((v) => v.zustand === 'neu' || v.zustand === 'inArbeit');
  const beantwortet = vorgaenge.filter((v) => v.antwort);
  const heute = tagesbeginn(jetzt, zone);
  const zeitenListe = beantwortet.map((v) => dienstminuten(v.eingegangenAm, v.antwort!.zeitpunkt, zeiten, zone));
  return {
    offen: offen.length,
    ueberfaellig: offen.filter((v) => fristrest(v, jetzt, zeiten, zone) < 0).length,
    inArbeit: offen.filter((v) => gesperrtVon(v, jetzt) !== null).length,
    heuteBeantwortet: beantwortet.filter((v) => v.antwort!.zeitpunkt >= heute).length,
    mittlereAntwortzeit:
      zeitenListe.length === 0 ? null : Math.round(zeitenListe.reduce((a, b) => a + b, 0) / zeitenListe.length),
  };
}

export const ARTNAMEN: Record<Vorgangsart, string> = {
  kommentar: 'Kommentar',
  erwaehnung: 'Erwähnung',
  nachricht: 'Nachricht',
  bewertung: 'Bewertung',
  mailantwort: 'Antwort auf den Newsletter',
};

export const VORGANGSNAMEN: Record<Vorgangszustand, string> = {
  neu: 'Neu',
  inArbeit: 'In Arbeit',
  beantwortet: 'Beantwortet',
  geschlossen: 'Geschlossen',
  versteckt: 'Versteckt',
};
