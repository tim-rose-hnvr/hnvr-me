/**
 * Textmessung im echten Satz.
 *
 * ## Warum es das gibt
 *
 * Die Wahl der Kürzungsstufe hing an einer Schätzung: mittlere Zeichenbreite
 * 0,5 em, Zeilen aus Rahmenhöhe durch Zeilenabstand. Für eine fette Grotesk ist
 * das zu großzügig. Im Probemodell wählte der Instagram-Beitrag deshalb die
 * lange Fassung, setzte sie in drei statt zwei Zeilen und schob sie über den
 * Untertitel — und die Prüfung meldete „passt". Genau die Sorte Fehler, die
 * nicht abstürzt, sondern plausibel falsch aussieht.
 *
 * Hier misst stattdessen der Browser. Dieselben CSS-Eigenschaften wie in der
 * Darstellung (`schriftStil`), dieselbe Silbentrennung, nur mit freier Höhe.
 *
 * ## Grenzen
 *
 * Gemessen wird gegen die Schriften, die auf der Seite **geladen** sind. Ist
 * die Markenschrift noch nicht da, misst Chromium die Ersatzschrift und die
 * Zahl ist falsch. Deshalb wartet `warteAufSchriften` vorher ab.
 */

import type { TextElement } from '@studio/editor-core';
import { schriftStil } from './html.js';
import { type Sprache, setzeTrennstriche } from './trennung.js';

export interface Messoptionen {
  sprache?: Sprache;
}

export type Textmesser = ((text: string, element: TextElement) => number) & {
  aufraeumen: () => void;
};

const VERSTECKT = 'position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none';

/**
 * Ein Messer, der Texte in einem verborgenen Knoten setzt und die Höhe liest.
 *
 * Der Knoten steht außerhalb des Sichtfelds statt auf `display:none` — ein
 * nicht dargestellter Knoten hat gar keine Maße.
 */
export function erzeugeTextmesser(dokument: Document, optionen: Messoptionen = {}): Textmesser {
  const knoten = dokument.createElement('div');
  knoten.setAttribute('aria-hidden', 'true');
  knoten.style.cssText = VERSTECKT;
  dokument.body.append(knoten);

  const messen = (text: string, element: TextElement): number => {
    knoten.style.cssText = `${VERSTECKT};width:${element.breite}px;height:auto;${schriftStil(element)}`;
    knoten.textContent = setzeTrennstriche(
      text,
      optionen.sprache === undefined ? {} : { sprache: optionen.sprache },
    );
    return knoten.getBoundingClientRect().height;
  };

  messen.aufraeumen = (): void => {
    knoten.remove();
  };
  return messen;
}

/**
 * Wartet, bis die eingebetteten Schriften geladen sind.
 *
 * Ohne das misst Chromium gegen die Ersatzschrift und liefert eine Höhe, die
 * mit dem späteren Bild nichts zu tun hat — derselbe stille Schriftfallback wie
 * im PDF-Pfad, nur an anderer Stelle.
 */
export async function warteAufSchriften(dokument: Document): Promise<void> {
  await dokument.fonts.ready;
}
