/**
 * Auswertung.
 *
 * Hier steht die unbequemste Entscheidung dieses Programms, und sie steht hier
 * ganz oben, weil sie nicht wegzuklicken sein soll:
 *
 * **Die Öffnungsrate ist keine Zahl, sie ist eine Schätzung mit einem
 * systematischen Fehler.** Seit Apple 2021 den Schutz der Mail-Aktivität
 * eingeführt hat, lädt Apple auf jedem Gerät mit dieser Einstellung die Bilder
 * einer Mail im Voraus — ob sie geöffnet wird oder nicht. Damit zählt der
 * Zählpixel eine Öffnung, die keine ist. Bei einem Bestand mit vielen
 * Apple-Geräten sind das leicht 40 Prozent Luft, und sie sind nicht
 * herausrechenbar, weil nicht zu erkennen ist, welche der Öffnungen echt war.
 *
 * Die Folge ist keine Fußnote, sondern eine Bauentscheidung:
 *
 * 1. Die Öffnungsrate wird angezeigt, aber **immer mit ihrem Vorbehalt** —
 *    `oeffnungenSindGeschaetzt` ist Teil des Ergebnisses und nicht Teil der
 *    Anzeige, damit keine Oberfläche sie versehentlich weglässt.
 * 2. **A/B-Versuche werden über Klicks entschieden**, wenn es geht. Eine
 *    Betreffzeile über Öffnungen zu vergleichen, ist die eine Anwendung, in der
 *    der Fehler direkt in die Entscheidung läuft.
 * 3. Die Zählung geht auch **ganz ohne Personenbezug**. Dann fehlen die
 *    Segmente nach Verhalten, und das steht so in der Oberfläche — statt sie
 *    lautlos leer zu lassen.
 *
 * Und eine kleinere, aber häufigere Sache: **die Öffnungsrate wird auf die
 * Zugestellten bezogen, nicht auf die Gesendeten.** Der Unterschied sind die
 * Rückläufer, und wer durch die Gesendeten teilt, weist einen schlechten
 * Bestand als schlechte Betreffzeile aus.
 */

import type { Befund } from './befund.ts';
import type { Kanalart } from './kanal.ts';

/**
 * Wie gezählt wird.
 *
 * `anonym` zählt nur Summen: 412 Öffnungen, nicht *wer*. Damit sind
 * Verhaltenssegmente nicht möglich — und das ist der ehrliche Preis, der in
 * der Oberfläche steht.
 *
 * `personenbezogen` zählt je Empfänger. Das braucht einen Hinweis im Wortlaut
 * der Einwilligung; die Prüfung dazu steht unten.
 */
export type Zaehlweise = 'aus' | 'anonym' | 'personenbezogen';

export interface Zaehleinstellung {
  organisation: string;
  oeffnungen: Zaehlweise;
  klicks: Zaehlweise;
  /** Der Wortlaut, den die Verteiler tragen — für die Prüfung unten. */
  einwilligungswortlaut: string;
}

/* --------------------------------------------------------------- E-Mail */

export interface Mailzahlen {
  gesendet: number;
  zugestellt: number;
  hart: number;
  weich: number;
  geoeffnet: number;
  geklickt: number;
  abgemeldet: number;
  beschwerden: number;
}

export interface Mailquoten {
  zustellquote: number;
  /** Auf die Zugestellten bezogen. Siehe Kopf dieser Datei. */
  oeffnungsrate: number;
  klickrate: number;
  /**
   * Klicks je Öffnung. Die stabilere Zahl von beiden: der Zählfehler steckt
   * im Nenner **und** wird durch ihn geteilt, was ihn zwar nicht aufhebt,
   * aber deutlich dämpft.
   */
  klickAufOeffnung: number;
  abmelderate: number;
  beschwerderate: number;
  ruecklaeuferquote: number;
  /** Immer mitgeliefert, nie herausgerechnet. */
  oeffnungenSindGeschaetzt: boolean;
}

function anteil(zaehler: number, nenner: number): number {
  return nenner === 0 ? 0 : zaehler / nenner;
}

export function quoten(zahlen: Mailzahlen, oeffnungenGezaehlt: boolean): Mailquoten {
  const z = zahlen.zugestellt;
  return {
    zustellquote: anteil(z, zahlen.gesendet),
    oeffnungsrate: anteil(zahlen.geoeffnet, z),
    klickrate: anteil(zahlen.geklickt, z),
    klickAufOeffnung: anteil(zahlen.geklickt, zahlen.geoeffnet),
    abmelderate: anteil(zahlen.abgemeldet, z),
    beschwerderate: anteil(zahlen.beschwerden, z),
    ruecklaeuferquote: anteil(zahlen.hart + zahlen.weich, zahlen.gesendet),
    oeffnungenSindGeschaetzt: oeffnungenGezaehlt,
  };
}

/**
 * Der Satz, der neben jeder Öffnungsrate stehen muss.
 *
 * Als Funktion und nicht als Zeichenkette in einer Vorlage, damit er an allen
 * Stellen derselbe ist — auch in einem Bericht, den jemand später hinzufügt.
 */
export const OEFFNUNGSVORBEHALT =
  'Öffnungen sind geschätzt. Apple lädt die Bilder vieler Mails im Voraus, ohne dass jemand sie geöffnet hat; die Rate liegt deshalb zu hoch und lässt sich nicht bereinigen. Für Vergleiche taugen Klicks.';

/* ----------------------------------------------------------- A/B-Versuch */

export interface Variantenzahlen {
  variante: string;
  zahlen: Mailzahlen;
}

export type Versuchsergebnis =
  | { entschieden: true; gewinner: string; vorsprung: number; mass: 'oeffnung' | 'klick'; befunde: Befund[] }
  | { entschieden: false; grund: string; befunde: Befund[] };

/**
 * Die Gewinnervariante bestimmen.
 *
 * Zwei Bedingungen, die beide gerissen werden können und deshalb beide geprüft
 * werden: es muss genug Post angekommen sein, und der Unterschied muss größer
 * sein als das, was zwischen zwei gleichen Varianten ohnehin schwankt.
 *
 * Die Schwelle von 20 Prozent relativem Vorsprung ist keine Statistik, sondern
 * eine Faustregel — aber eine, die die häufigste Fehlentscheidung verhindert:
 * bei 500 Zustellungen und 2 Prozent Unterschied wird eine Betreffzeile zur
 * Siegerin erklärt, die keine ist. Wer es genauer will, braucht einen echten
 * Test; wer ihn nicht hat, soll wenigstens nicht das Rauschen ausrufen.
 */
export function entscheideVersuch(
  varianten: readonly Variantenzahlen[],
  mass: 'oeffnung' | 'klick',
  mindestZustellungen = 500,
  mindestVorsprung = 0.2,
): Versuchsergebnis {
  const befunde: Befund[] = [];

  if (varianten.length < 2) return { entschieden: false, grund: 'Es gibt nur eine Variante.', befunde };

  if (mass === 'oeffnung') {
    befunde.push({
      schwere: 'warnung',
      kennung: 'auswertung.ab.ueber.oeffnungen',
      text: `Der Versuch wird über Öffnungen entschieden. ${OEFFNUNGSVORBEHALT}`,
    });
  }

  const zuKlein = varianten.filter((v) => v.zahlen.zugestellt < mindestZustellungen);
  if (zuKlein.length > 0) {
    return {
      entschieden: false,
      grund: `Bei ${zuKlein.map((v) => v.variante.toUpperCase()).join(' und ')} sind noch keine ${mindestZustellungen} Mails zugestellt. Darunter entscheidet der Zufall.`,
      befunde,
    };
  }

  const bewertet = varianten
    .map((v) => ({
      variante: v.variante,
      wert: anteil(mass === 'klick' ? v.zahlen.geklickt : v.zahlen.geoeffnet, v.zahlen.zugestellt),
    }))
    .sort((a, b) => b.wert - a.wert);

  const [erster, zweiter] = bewertet;
  if (!erster || !zweiter) return { entschieden: false, grund: 'Zu wenige Varianten.', befunde };
  if (zweiter.wert === 0 && erster.wert === 0) {
    return { entschieden: false, grund: 'Keine der Varianten hat eine Regung ausgelöst.', befunde };
  }

  const vorsprung = zweiter.wert === 0 ? 1 : erster.wert / zweiter.wert - 1;
  if (vorsprung < mindestVorsprung) {
    return {
      entschieden: false,
      grund: `Der Unterschied liegt bei ${(vorsprung * 100).toFixed(1)} %. Unter ${(mindestVorsprung * 100).toFixed(0)} % ist er nicht von Schwankung zu unterscheiden.`,
      befunde,
    };
  }

  return { entschieden: true, gewinner: erster.variante, vorsprung, mass, befunde };
}

/* ------------------------------------------------------- Soziale Kanäle */

export interface Beitragszahlen {
  beitrag: string;
  kanal: string;
  kanalart: Kanalart;
  veroeffentlichtAm: number;
  /** Wie oft ausgeliefert. Bei manchen Netzen nicht abrufbar — dann `null`. */
  auslieferungen: number | null;
  /** Alles zusammen: Gefällt-mir, Teilen, Kommentare, Klicks. */
  regungen: number;
  klicks: number;
  kommentare: number;
}

/**
 * Die Regungsrate.
 *
 * `null`, wenn das Netz keine Auslieferungen herausgibt — und dann wird sie
 * auch **nicht** durch die Zahl der Folgenden ersetzt. Das tun die meisten
 * Werkzeuge, und die Zahl, die dabei herauskommt, ist eine andere als die auf
 * dem Nachbarkanal. Zwei Zahlen mit demselben Namen und verschiedener
 * Bedeutung sind schlimmer als eine fehlende.
 */
export function regungsrate(z: Beitragszahlen): number | null {
  if (z.auslieferungen === null || z.auslieferungen === 0) return null;
  return z.regungen / z.auslieferungen;
}

export interface Kanalbild {
  kanal: string;
  beitraege: number;
  regungen: number;
  klicks: number;
  /** `null`, wenn mindestens ein Beitrag keine Auslieferungen kennt. */
  mittlereRegungsrate: number | null;
}

export function kanalbild(zahlen: readonly Beitragszahlen[], kanal: string): Kanalbild {
  const eigene = zahlen.filter((z) => z.kanal === kanal);
  const raten = eigene.map(regungsrate);
  return {
    kanal,
    beitraege: eigene.length,
    regungen: eigene.reduce((s, z) => s + z.regungen, 0),
    klicks: eigene.reduce((s, z) => s + z.klicks, 0),
    mittlereRegungsrate:
      raten.length === 0 || raten.some((r) => r === null)
        ? null
        : (raten as number[]).reduce((a, b) => a + b, 0) / raten.length,
  };
}

/* --------------------------------------------------------- Beides zusammen */

/**
 * Das gemeinsame Bild.
 *
 * Der Grund, aus dem dieses Programm überhaupt gebaut wird: eine Zeile, in der
 * die Reichweite eines Newsletters und die eines LinkedIn-Beitrags
 * nebeneinanderstehen — und darunter die Klicks, die einzige Zahl, die auf
 * beiden Seiten dasselbe bedeutet.
 *
 * Bewusst **keine** gemeinsame „Gesamtreichweite". Sie ließe sich addieren und
 * wäre eine Erfindung: eine E-Mail-Zustellung und eine Auslieferung in einer
 * Zeitleiste sind nicht dasselbe Ereignis, und wer sie zusammenzählt, bekommt
 * eine Zahl, die nur größer, aber nicht wahrer wird.
 */
export interface Gesamtbild {
  zeitraum: { von: number; bis: number };
  mail: { versaende: number; zugestellt: number; klicks: number; abmeldungen: number };
  sozial: { beitraege: number; regungen: number; klicks: number };
  /** Die einzige Zahl, die über beide Seiten dasselbe meint. */
  klicksZusammen: number;
}

export function gesamtbild(
  zeitraum: { von: number; bis: number },
  mail: readonly Mailzahlen[],
  sozial: readonly Beitragszahlen[],
): Gesamtbild {
  const imZeitraum = sozial.filter((z) => z.veroeffentlichtAm >= zeitraum.von && z.veroeffentlichtAm <= zeitraum.bis);
  const mailKlicks = mail.reduce((s, m) => s + m.geklickt, 0);
  const sozialKlicks = imZeitraum.reduce((s, z) => s + z.klicks, 0);
  return {
    zeitraum,
    mail: {
      versaende: mail.length,
      zugestellt: mail.reduce((s, m) => s + m.zugestellt, 0),
      klicks: mailKlicks,
      abmeldungen: mail.reduce((s, m) => s + m.abgemeldet, 0),
    },
    sozial: {
      beitraege: imZeitraum.length,
      regungen: imZeitraum.reduce((s, z) => s + z.regungen, 0),
      klicks: sozialKlicks,
    },
    klicksZusammen: mailKlicks + sozialKlicks,
  };
}

/* ---------------------------------------------------------------- Prüfung */

/**
 * Passt die Zählweise zu dem, dem die Leute zugestimmt haben?
 *
 * Wer je Person zählt, misst Verhalten, und dafür genügt „ich möchte den
 * Newsletter bekommen" nicht. Die Prüfung ist grob — sie sucht nach einem
 * Hinweis im Wortlaut — und das ist Absicht: sie soll auffallen und nicht
 * ersetzen, was ein Jurist sagt.
 */
export function pruefeZaehlweise(e: Zaehleinstellung): Befund[] {
  const befunde: Befund[] = [];
  const jePerson = e.oeffnungen === 'personenbezogen' || e.klicks === 'personenbezogen';
  const wortlaut = e.einwilligungswortlaut.toLowerCase();
  const erwaehnt = /messung|auswert|statistik|öffnung|oeffnung|klick|nutzungsverhalten/.test(wortlaut);

  if (jePerson && !erwaehnt) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'auswertung.wortlaut',
      text: 'Es wird je Person gezählt, aber der Wortlaut der Einwilligung erwähnt keine Messung. Entweder der Satz wird ergänzt — dann gilt er nur für neue Einträge — oder die Zählung geht auf „anonym".',
    });
  }
  if (e.oeffnungen !== 'aus') {
    befunde.push({
      schwere: 'hinweis',
      kennung: 'auswertung.oeffnungen',
      text: OEFFNUNGSVORBEHALT,
    });
  }
  if (e.oeffnungen === 'aus' && e.klicks === 'aus') {
    befunde.push({
      schwere: 'hinweis',
      kennung: 'auswertung.nichts',
      text: 'Es wird nichts gezählt. Zustellung und Rückläufer stehen weiter zur Verfügung — sie kommen vom Mailserver und nicht vom Empfänger.',
    });
  }
  if (e.oeffnungen === 'anonym' || e.klicks === 'anonym') {
    befunde.push({
      schwere: 'hinweis',
      kennung: 'auswertung.anonym',
      text: 'Bei anonymer Zählung gibt es Summen, aber keine Segmente nach Verhalten. „Wer seit 90 Tagen nichts geöffnet hat" ist dann nicht zu beantworten.',
    });
  }
  return befunde;
}

/** Für die Anzeige: Anteil als Prozentwert mit einer Nachkommastelle. */
export function alsProzent(anteilWert: number): string {
  return `${(anteilWert * 100).toFixed(1).replace('.', ',')} %`;
}
