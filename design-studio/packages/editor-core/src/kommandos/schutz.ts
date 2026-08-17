/**
 * Schutzregeln — hier steckt das eigentliche Produktversprechen.
 *
 * Der Standardfall ist nicht die freie Leinwand, sondern ein gesperrtes Layout
 * mit ausgefüllten Platzhaltern. Ein Kunde soll ein markenkonformes Ergebnis
 * bekommen, ohne gestalten zu können und zu müssen.
 *
 * Zwei Mechanismen, klar getrennt:
 * - `gesperrt`      — Layoutsperre für gewöhnliche Elemente: alles oder nichts.
 * - `platzhalter`   — die Ausnahme davon: benennt genau, was geändert werden darf.
 *
 * Ein Element mit Platzhalter ignoriert `gesperrt`. Der Platzhalter ist die
 * feinere Aussage und gewinnt deshalb.
 */

import type { Bearbeitbar, Entwurfselement } from '../modell/entwurf.js';
import { KommandoFehler } from './stack.js';

/** Was ein Kommando ändern will. `struktur` deckt Löschen, Einfügen und Umsortieren ab. */
export type Aspekt = Bearbeitbar | 'struktur';

export function darfAendern(element: Entwurfselement, aspekt: Aspekt): boolean {
  if (element.platzhalter !== null) {
    if (aspekt === 'struktur') return false;
    return element.platzhalter.bearbeitbar.includes(aspekt);
  }
  return !element.gesperrt;
}

/** Wirft, wenn die Änderung nicht erlaubt ist. Für den Einsatz in Kommandos. */
export function verlangeAenderungsrecht(
  kommando: string,
  element: Entwurfselement,
  aspekt: Aspekt,
): void {
  if (darfAendern(element, aspekt)) return;

  if (element.platzhalter !== null) {
    const erlaubt = element.platzhalter.bearbeitbar.join(', ');
    throw new KommandoFehler(
      kommando,
      `Platzhalter "${element.platzhalter.schluessel}" erlaubt nur [${erlaubt}], nicht "${aspekt}"`,
    );
  }
  throw new KommandoFehler(
    kommando,
    `Element "${element.name}" (${element.id}) ist gesperrt`,
  );
}
