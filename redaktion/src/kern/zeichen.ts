/**
 * Zeichen zählen — vier Netze, vier Zählweisen.
 *
 * Das ist kein Detail. Ein Zähler, der „280" anzeigt und bei 274 Zeichen
 * abgewiesen wird, macht das Werkzeug unbrauchbar; wer einmal einen Beitrag
 * verloren hat, tippt fortan woanders. Die Zählweisen unterscheiden sich
 * wirklich, und zwar so:
 *
 * | Netz      | zählt                                    | Grenze |
 * |-----------|------------------------------------------|--------|
 * | X         | gewichtet, Adresse pauschal 23           | 280    |
 * | Bluesky   | Graphemgruppen                           | 300    |
 * | Mastodon  | Codepunkte, Adresse pauschal 23          | 500    |
 * | LinkedIn  | Codepunkte                               | 3000   |
 *
 * „Codepunkte", nicht `text.length`: JavaScript zählt UTF-16-Einheiten, und
 * damit ist jedes Emoji zwei und mancher Buchstabe außerhalb der Grundebene
 * ebenfalls. Kein Netz zählt so.
 */

export type Zaehlart = 'gewichtet' | 'graphem' | 'codepunkt' | 'kurzadresse';

/**
 * Der Bereich, den X mit einfachem Gewicht zählt — alles andere zählt doppelt.
 *
 * Die Grenzen stammen aus der Gewichtungstabelle von `twitter-text` (Fassung
 * 3): lateinische Schrift, Zeichensetzung und die üblichen Zusatzzeichen
 * wiegen 100, alles Übrige 200, bei einer Skala von 100 und einer Höchstlänge
 * von 28000. Geteilt durch 100 ergibt das die bekannten 280.
 */
const EINFACH: ReadonlyArray<readonly [number, number]> = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
  [8252, 8252],
];

/** Adressen zählen bei X und Mastodon pauschal — egal wie lang sie sind. */
export const ADRESSLAENGE = 23;

const segmentierer = new Intl.Segmenter('de', { granularity: 'grapheme' });

/**
 * Graphemgruppen: was ein Mensch als ein Zeichen sieht.
 *
 * „👩‍👩‍👧" ist eine Gruppe, aber fünf Codepunkte und acht UTF-16-Einheiten.
 * Bluesky zählt Gruppen; ein Zähler, der Einheiten zählt, wäre bei
 * Familien-Emoji um den Faktor acht zu streng.
 */
export function graphemzahl(text: string): number {
  let n = 0;
  for (const _ of segmentierer.segment(text)) n++;
  return n;
}

/** Codepunkte: das, was die meisten Netze meinen, wenn sie „Zeichen" sagen. */
export function codepunkte(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

/**
 * Adressen im Text finden.
 *
 * Bewusst zurückhaltend: erkannt wird, was mit `http://`, `https://` oder
 * `www.` beginnt. Eine Regel, die auch `beispiel.de` ohne Schema erkennt,
 * hält jeden Satz mit einem Punkt und ohne Leerzeichen für eine Adresse —
 * und zählt dann zu wenig, was schlimmer ist als zu viel: der Beitrag wird
 * am Ende doch abgewiesen, nur später und ohne Erklärung.
 *
 * Ein Schlusszeichen wird nicht mitgenommen: „siehe https://a.de." endet mit
 * einem Satzpunkt, nicht mit einer Adresse auf `.de.`.
 */
export function findeAdressen(text: string): Array<{ beginn: number; ende: number; text: string }> {
  const muster = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  const treffer: Array<{ beginn: number; ende: number; text: string }> = [];
  for (const m of text.matchAll(muster)) {
    let gefunden = m[0];
    // Satzzeichen am Ende gehören zum Satz, nicht zur Adresse. Eine Klammer
    // nur dann, wenn sie unpaarig ist — sonst zerschnitte man
    // Wikipedia-Adressen mit Klammern im Pfad.
    while (gefunden.length > 0) {
      const letzt = gefunden.at(-1)!;
      if ('.,;:!?"\''.includes(letzt)) { gefunden = gefunden.slice(0, -1); continue; }
      if (letzt === ')' && (gefunden.match(/\(/g)?.length ?? 0) < (gefunden.match(/\)/g)?.length ?? 0)) {
        gefunden = gefunden.slice(0, -1); continue;
      }
      break;
    }
    if (gefunden.length === 0) continue;
    treffer.push({ beginn: m.index, ende: m.index + gefunden.length, text: gefunden });
  }
  return treffer;
}

function gewichtEines(punkt: number): number {
  for (const [von, bis] of EINFACH) if (punkt >= von && punkt <= bis) return 1;
  return 2;
}

/**
 * Die gewichtete Zählung von X.
 *
 * Emoji zählen als ein Zeichen mit Gewicht 2 — auch dann, wenn sie aus
 * mehreren Codepunkten bestehen. Deshalb wird über Graphemgruppen gelaufen
 * und nicht über Codepunkte: sonst wögen zusammengesetzte Emoji ein
 * Vielfaches.
 */
function gewichtet(text: string): number {
  let summe = 0;
  for (const { segment } of segmentierer.segment(text)) {
    const punkte = [...segment];
    if (punkte.length > 1) {
      // Eine Gruppe aus mehreren Codepunkten: ein Zeichen, doppeltes Gewicht.
      summe += 2;
      continue;
    }
    summe += gewichtEines(punkte[0]!.codePointAt(0)!);
  }
  return summe;
}

/**
 * Wie viel dieser Text bei dieser Zählart zählt.
 *
 * Der Anteil, den Adressen ausmachen, wird bei `gewichtet` und `kurzadresse`
 * durch die Pauschale ersetzt — bei den anderen nicht, weil LinkedIn und
 * Instagram Adressen ganz normal zählen.
 */
export function zaehle(text: string, art: Zaehlart): number {
  if (art === 'graphem') return graphemzahl(text);
  if (art === 'codepunkt') return codepunkte(text);

  const adressen = findeAdressen(text);
  let rest = '';
  let letztes = 0;
  for (const a of adressen) {
    rest += text.slice(letztes, a.beginn);
    letztes = a.ende;
  }
  rest += text.slice(letztes);

  const pauschale = adressen.length * ADRESSLAENGE;
  return pauschale + (art === 'gewichtet' ? gewichtet(rest) : codepunkte(rest));
}

/**
 * Hashtags im Text.
 *
 * Ein Hashtag darf keine reine Zahl sein — `#1` ist auf keinem Netz ein
 * Hashtag, sondern eine Aufzählung. Der Unterstrich zählt dazu, der
 * Bindestrich nicht.
 */
export function hashtags(text: string): string[] {
  const gefunden = [...text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_]+)/gu)].map((m) => m[1]!);
  return gefunden.filter((t) => /\p{L}|_/u.test(t));
}

/** Erwähnungen. `@name` und `@name@haus.de` — Letzteres ist das Fediverse. */
export function erwaehnungen(text: string): string[] {
  return [...text.matchAll(/(?:^|[\s(])@([\p{L}\p{N}_.-]+(?:@[\p{L}\p{N}.-]+)?)/gu)].map((m) => m[1]!);
}

/**
 * Wie viele Zeichen von der Grenze übrig sind — negativ, wenn zu viel.
 * Getrennte Funktion, damit die Oberfläche nicht selbst subtrahiert und dabei
 * das Vorzeichen verliert.
 */
export function rest(text: string, art: Zaehlart, grenze: number): number {
  return grenze - zaehle(text, art);
}
