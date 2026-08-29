/**
 * Empfänger und Einwilligung.
 *
 * Das ist der Teil, an dem ein E-Mail-Werkzeug rechtlich und praktisch hängt.
 * Vier Entscheidungen, die alles Weitere bestimmen:
 *
 * 1. **Nur `bestaetigt` bekommt Post.** Nicht „eingetragen", nicht „importiert",
 *    nicht „war mal Kunde". Der Zustand entscheidet, nicht die Absicht des
 *    Bedieners — deshalb lässt sich hier kein Segment bauen, das an
 *    Unbestätigte geht (siehe `empfaengerFuer` in `verteiler.ts`).
 * 2. **Der Wortlaut der Einwilligung wird gespeichert, nicht der Verweis
 *    darauf.** Ein Link auf „unsere Datenschutzerklärung" belegt nichts: die
 *    Seite von damals gibt es nicht mehr. Der Satz, dem jemand zugestimmt hat,
 *    gehört in den Datensatz.
 * 3. **Wer nicht bestätigt, wird gelöscht — nicht aufbewahrt.** Eine Adresse
 *    ohne Bestätigung ist kein halber Empfänger, sondern gar keiner. Sie 30
 *    Tage zu behalten und dann zu verwerfen ist die einzige Fassung, die
 *    beides einlöst: den zweiten Bestätigungsversuch und die Datensparsamkeit.
 * 4. **Löschen heißt löschen.** Die Adresse verschwindet, die Kennung bleibt.
 *    Damit zeigt das Ereignisprotokoll weiter, *dass* eine Einwilligung vorlag,
 *    ohne noch abzulesen, *wessen*.
 */

import type { Befund } from './befund.ts';
import { streuwert } from './kennung.ts';

export const EMPFAENGERZUSTAENDE = ['eingetragen', 'bestaetigt', 'abgemeldet', 'gesperrt', 'geloescht'] as const;
export type Empfaengerzustand = (typeof EMPFAENGERZUSTAENDE)[number];

export type Sperrgrund = 'hart' | 'beschwerde' | 'manuell' | 'unbestaetigt';

export interface Einwilligung {
  /** Woher: `formular:startseite`, `kasse`, `messe:2026-03`. */
  quelle: string;
  eingetragenAm: number;
  /** Wann bestätigt wurde. `null` heißt: nie. Und damit: keine Post. */
  bestaetigtAm: number | null;
  /**
   * Der Wortlaut, dem zugestimmt wurde. Wörtlich, nicht als Verweis.
   * Ein Link belegt nichts, wenn die Seite sich geändert hat.
   */
  wortlaut: string;
  /**
   * Streuwert der IP, nicht die IP.
   *
   * Für den Nachweis genügt „von derselben Stelle wie die Anmeldung"; die
   * Adresse selbst braucht niemand, und sie wäre ein Personendatum mehr, das
   * bei einer Löschung mitzudenken wäre.
   */
  quellStreuwert: string | null;
}

export interface Empfaenger {
  kennung: string;
  organisation: string;
  /** `null`, nachdem gelöscht wurde. Die Zeile bleibt, der Mensch nicht. */
  adresse: string | null;
  /** Kleingeschriebener Vergleichsschlüssel. Ebenfalls `null` nach Löschung. */
  schluessel: string | null;
  zustand: Empfaengerzustand;
  einwilligung: Einwilligung;
  /** Frei belegbare Merkmale für Segmente: Vorname, Stadt, Kundennummer. */
  merkmale: Record<string, string>;
  /** In welchen Verteilern er steht. */
  verteiler: string[];
  abgemeldetAm?: number;
  gesperrtAm?: number;
  gesperrtWegen?: Sperrgrund;
  /** Aufeinanderfolgende weiche Rückläufer. Bei genug davon wird gesperrt. */
  weicheRuecklaeufer: number;
}

/* ------------------------------------------------------- Adressen prüfen */

/**
 * Wie lange eine Adresse ohne Bestätigung aufbewahrt wird.
 *
 * 30 Tage: lang genug für einen zweiten Versuch und einen Urlaub, kurz genug,
 * dass keine Halde entsteht.
 */
export const BESTAETIGUNGSFRIST_MS = 30 * 86_400_000;

/** Nach so vielen weichen Rückläufern hintereinander wird gesperrt. */
export const WEICHE_GRENZE = 5;

/**
 * Rollenadressen.
 *
 * `info@` ist meist kein Mensch, sondern ein Postfach, in das mehrere sehen.
 * Eine Einwilligung von dort ist schwach, die Beschwerdequote hoch. Kein
 * Fehler — es gibt Fälle, in denen genau das gewollt ist —, aber ein Befund.
 */
const ROLLENTEILE = new Set([
  'info', 'kontakt', 'contact', 'office', 'buero', 'mail', 'email', 'post',
  'support', 'hilfe', 'service', 'abuse', 'postmaster', 'webmaster', 'hostmaster',
  'noreply', 'no-reply', 'donotreply', 'admin', 'administrator', 'sales', 'vertrieb',
  'presse', 'press', 'marketing', 'newsletter', 'team', 'hallo', 'hello',
]);

/** Die häufigsten Vertipper bei den großen Anbietern. */
const VERTIPPER: Record<string, string> = {
  'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com', 'gmail.de': 'gmail.com', 'googlemail.con': 'googlemail.com',
  'web.de.de': 'web.de', 'wed.de': 'web.de', 'wb.de': 'web.de',
  'gmx.ed': 'gmx.de', 'gmx.d': 'gmx.de', 'gmx.net.de': 'gmx.net',
  'hotmai.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 'hotmail.co': 'hotmail.com',
  'outlook.con': 'outlook.com', 'outlok.com': 'outlook.com',
  't-onlie.de': 't-online.de', 't-online.com': 't-online.de',
  'yahoo.con': 'yahoo.com', 'yaho.com': 'yahoo.com',
};

export interface Adressbefund {
  ok: boolean;
  /** Die Form, in der gespeichert wird. */
  adresse: string;
  /** Der Vergleichsschlüssel für Doppelte. */
  schluessel: string;
  befunde: Befund[];
}

/**
 * Eine Adresse prüfen und in Form bringen.
 *
 * Zur Groß- und Kleinschreibung: der Teil hinter dem `@` ist ein Rechnername
 * und damit ohne Unterschied — der wird kleingeschrieben. Der Teil davor
 * gehört laut RFC 5321 dem empfangenden Server, und der darf unterscheiden;
 * deshalb wird er **gespeichert wie eingetippt** und nur für den Vergleich
 * kleingeschrieben. In der Praxis unterscheidet kein großer Anbieter — aber
 * die Adresse eines Menschen umzuschreiben, weil es meistens gutgeht, ist die
 * falsche Richtung.
 */
export function pruefeAdresse(roh: string): Adressbefund {
  const befunde: Befund[] = [];
  const getrimmt = roh.trim().replace(/^<|>$/g, '');
  const leer: Adressbefund = { ok: false, adresse: getrimmt, schluessel: '', befunde };

  if (getrimmt.length === 0) {
    befunde.push({ schwere: 'fehler', kennung: 'adresse.leer', text: 'Es steht keine Adresse da.' });
    return leer;
  }
  if (getrimmt.length > 254) {
    befunde.push({ schwere: 'fehler', kennung: 'adresse.zu.lang', text: 'Die Adresse ist länger als 254 Zeichen.' });
    return leer;
  }
  if (/[\s,;]/.test(getrimmt)) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'adresse.trennzeichen',
      text: 'Die Adresse enthält ein Leer- oder Trennzeichen. Steht hier mehr als eine?',
    });
    return leer;
  }

  const at = getrimmt.lastIndexOf('@');
  if (at <= 0 || at === getrimmt.length - 1) {
    befunde.push({ schwere: 'fehler', kennung: 'adresse.kein.at', text: 'Die Adresse hat kein @ mit etwas auf beiden Seiten.' });
    return leer;
  }

  const oertlich = getrimmt.slice(0, at);
  let rechner = getrimmt.slice(at + 1).toLowerCase();

  if (oertlich.length > 64) {
    befunde.push({ schwere: 'fehler', kennung: 'adresse.teil.zu.lang', text: 'Der Teil vor dem @ ist länger als 64 Zeichen.' });
    return leer;
  }
  if (oertlich.startsWith('.') || oertlich.endsWith('.') || oertlich.includes('..')) {
    befunde.push({ schwere: 'fehler', kennung: 'adresse.punkte', text: 'Punkte am Rand oder zwei hintereinander gehen nicht.' });
    return leer;
  }

  /* Umlautdomains: `URL` bringt die Punycode-Umschrift mit, die jeder
     Mailserver ohnehin verlangt. Eine eigene Umsetzung wäre eine
     Bibliothek, die veraltet. */
  if (/[^ -~]/.test(rechner)) {
    try {
      rechner = new URL(`http://${rechner}`).hostname;
    } catch {
      befunde.push({ schwere: 'fehler', kennung: 'adresse.rechner', text: 'Der Teil hinter dem @ ist kein gültiger Rechnername.' });
      return leer;
    }
  }

  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(rechner)) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'adresse.rechner',
      text: 'Hinter dem @ steht kein Rechnername mit Punkt und Endung.',
    });
    return leer;
  }
  if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(oertlich)) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'adresse.zeichen',
      text: 'Vor dem @ steht ein Zeichen, das dort nicht vorkommen darf.',
    });
    return leer;
  }

  const adresse = `${oertlich}@${rechner}`;
  const schluessel = adresse.toLowerCase();

  const vorschlag = VERTIPPER[rechner];
  if (vorschlag) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'adresse.vertipper',
      text: `Meinte hier jemand ${oertlich}@${vorschlag}?`,
      stelle: adresse,
    });
  }
  if (ROLLENTEILE.has(oertlich.toLowerCase())) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'adresse.rolle',
      text: `${adresse} ist ein Sammelpostfach und selten ein einzelner Mensch. Die Einwilligung von dort trägt wenig.`,
      stelle: adresse,
    });
  }
  if (rechner === 'example.com' || rechner === 'example.org' || rechner.endsWith('.test') || rechner.endsWith('.invalid')) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'adresse.beispiel',
      text: `${rechner} ist eine Beispieldomain. Dorthin kommt nichts an.`,
      stelle: adresse,
    });
  }

  return { ok: true, adresse, schluessel, befunde };
}

/* ------------------------------------------------------- Zustandsführung */

/** Bekommt dieser Empfänger Post? Die einzige Stelle, die das entscheidet. */
export function empfaengtPost(e: Empfaenger): boolean {
  return e.zustand === 'bestaetigt' && e.adresse !== null;
}

export type Aenderung = { ok: true; empfaenger: Empfaenger } | { ok: false; befund: Befund };

/** Die doppelte Bestätigung. Der eine Schritt, ohne den nichts hinausgeht. */
export function bestaetigen(e: Empfaenger, jetzt: number, quellStreuwert?: string): Aenderung {
  if (e.zustand === 'geloescht') {
    return { ok: false, befund: { schwere: 'fehler', kennung: 'empfaenger.geloescht', text: 'Dieser Eintrag ist gelöscht.' } };
  }
  if (e.zustand === 'gesperrt') {
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'empfaenger.gesperrt',
        text: 'Diese Adresse ist gesperrt. Eine Sperre hebt keine Bestätigung auf.',
      },
    };
  }
  // Ein zweiter Klick auf denselben Link ist kein Fehler, sondern der
  // Normalfall — Mailprogramme rufen Links zur Prüfung selbst auf.
  if (e.zustand === 'bestaetigt') return { ok: true, empfaenger: e };

  return {
    ok: true,
    empfaenger: {
      ...e,
      zustand: 'bestaetigt',
      einwilligung: {
        ...e.einwilligung,
        bestaetigtAm: jetzt,
        quellStreuwert: quellStreuwert ?? e.einwilligung.quellStreuwert,
      },
    },
  };
}

/**
 * Abmelden.
 *
 * Geht immer und ohne Rückfrage — auch aus `eingetragen` heraus, auch
 * mehrfach. Eine Abmeldung, die eine Anmeldung verlangt, ist keine.
 */
export function abmelden(e: Empfaenger, jetzt: number): Empfaenger {
  if (e.zustand === 'geloescht' || e.zustand === 'abgemeldet') return e;
  return { ...e, zustand: 'abgemeldet', abgemeldetAm: jetzt };
}

/** Wieder anmelden — nur aus `abgemeldet`, nie aus `gesperrt`. */
export function wiederAnmelden(e: Empfaenger, jetzt: number, wortlaut: string): Aenderung {
  if (e.zustand !== 'abgemeldet') {
    return {
      ok: false,
      befund: {
        schwere: 'fehler',
        kennung: 'empfaenger.nicht.abgemeldet',
        text: 'Nur wer abgemeldet ist, kann sich wieder anmelden.',
      },
    };
  }
  // Neue Anmeldung heißt neue Einwilligung — mit neuer Bestätigung.
  return {
    ok: true,
    empfaenger: {
      ...e,
      zustand: 'eingetragen',
      abgemeldetAm: undefined,
      einwilligung: { quelle: 'wiederanmeldung', eingetragenAm: jetzt, bestaetigtAm: null, wortlaut, quellStreuwert: null },
    },
  };
}

/**
 * Sperren.
 *
 * Endgültig. Eine Sperre wegen Beschwerde oder hartem Rückläufer wird nie
 * automatisch aufgehoben, und ein erneutes Eintragen derselben Adresse führt
 * wieder hierher — sonst wäre die Sperrliste ein Vorschlag.
 */
export function sperren(e: Empfaenger, grund: Sperrgrund, jetzt: number): Empfaenger {
  if (e.zustand === 'geloescht') return e;
  return { ...e, zustand: 'gesperrt', gesperrtAm: jetzt, gesperrtWegen: grund };
}

/**
 * Ein weicher Rückläufer.
 *
 * Postfach voll, Server gerade nicht erreichbar: einmal ist nichts, fünfmal
 * hintereinander ist eine Adresse, die es nicht mehr gibt. Ein Zusteller,
 * der weiter schickt, verdirbt den Ruf der eigenen Domain für alle anderen.
 */
export function weicherRuecklaeufer(e: Empfaenger, jetzt: number): Empfaenger {
  const zahl = e.weicheRuecklaeufer + 1;
  if (zahl >= WEICHE_GRENZE) return sperren({ ...e, weicheRuecklaeufer: zahl }, 'hart', jetzt);
  return { ...e, weicheRuecklaeufer: zahl };
}

/** Eine erfolgreiche Zustellung setzt den Zähler zurück. */
export function zugestellt(e: Empfaenger): Empfaenger {
  return e.weicheRuecklaeufer === 0 ? e : { ...e, weicheRuecklaeufer: 0 };
}

/**
 * Löschen nach Artikel 17.
 *
 * Die Adresse geht, die Kennung bleibt. Das ist kein Schlupfloch, sondern die
 * Bedingung dafür, dass das Ereignisprotokoll nicht gebrochen werden muss:
 * dort steht nur die Kennung, und die zeigt danach ins Leere. Nachweisbar
 * bleibt, *dass* eine Einwilligung vorlag — nicht mehr, *wessen*.
 *
 * Die Merkmale gehen mit. Ein „Vorname: Anna" und ein „Stadt: Verden" sind
 * zusammen ein Personenbezug, auch ohne Adresse.
 */
export function loeschen(e: Empfaenger, jetzt: number): Empfaenger {
  return {
    ...e,
    adresse: null,
    schluessel: null,
    zustand: 'geloescht',
    merkmale: {},
    verteiler: [],
    einwilligung: { ...e.einwilligung, wortlaut: '', quellStreuwert: null },
    gesperrtAm: jetzt,
  };
}

/**
 * Wer aufzuräumen ist.
 *
 * Unbestätigte Einträge, deren Frist abgelaufen ist. Sie werden gelöscht und
 * nicht gesperrt: eine Sperrliste aus Menschen, die nie zugestimmt haben,
 * wäre selbst eine Sammlung ohne Rechtsgrundlage.
 */
export function faellig(alle: readonly Empfaenger[], jetzt: number): Empfaenger[] {
  return alle.filter(
    (e) => e.zustand === 'eingetragen' && jetzt - e.einwilligung.eingetragenAm > BESTAETIGUNGSFRIST_MS,
  );
}

/**
 * Doppelte finden.
 *
 * Verglichen wird über den kleingeschriebenen Schlüssel. Gelöschte zählen
 * nicht mit — sie haben keinen mehr.
 */
export function doppelte(alle: readonly Empfaenger[]): Map<string, Empfaenger[]> {
  const nach = new Map<string, Empfaenger[]>();
  for (const e of alle) {
    if (!e.schluessel) continue;
    const liste = nach.get(e.schluessel);
    if (liste) liste.push(e);
    else nach.set(e.schluessel, [e]);
  }
  for (const [k, v] of nach) if (v.length < 2) nach.delete(k);
  return nach;
}

/**
 * Der Streuwert für die A/B-Teilung.
 *
 * Über die Kennung und nicht über die Adresse: sonst wechselt ein Empfänger
 * die Gruppe, wenn er seine Adresse ändert, und eine gelöschte Adresse wäre
 * gar nicht mehr einzuordnen.
 */
export function gruppenwert(e: Empfaenger, versuch: string): number {
  return streuwert(`${versuch}:${e.kennung}`);
}

export const ZUSTANDSNAMEN: Record<Empfaengerzustand, string> = {
  eingetragen: 'Eingetragen, nicht bestätigt',
  bestaetigt: 'Bestätigt',
  abgemeldet: 'Abgemeldet',
  gesperrt: 'Gesperrt',
  geloescht: 'Gelöscht',
};

export const SPERRGRUENDE: Record<Sperrgrund, string> = {
  hart: 'Adresse gibt es nicht',
  beschwerde: 'Als Werbung gemeldet',
  manuell: 'Von Hand gesperrt',
  unbestaetigt: 'Nie bestätigt',
};
