/**
 * Verbindet Kommandos mit dem Markenkit.
 *
 * Wichtig ist die Feinheit: abgelehnt werden nur **neu hinzukommende** Verstöße.
 * Ein Entwurf, der vor der Verschärfung des Markenkits entstanden ist, bleibt
 * sonst für immer unbearbeitbar — der Kunde könnte ihn nicht einmal in Ordnung
 * bringen, weil jedes Kommando am Altbestand scheitert.
 */

import { type Kommando, type KommandoErgebnis, KommandoFehler } from '../kommandos/stack.js';
import type { Entwurf } from '../modell/entwurf.js';
import { type Markenkit, type Markenverstoss, pruefeMarkenkonform } from './markenkit.js';

function kennung(verstoss: Markenverstoss): string {
  return `${verstoss.regel}|${verstoss.elementId ?? '-'}|${verstoss.seiteId ?? '-'}|${verstoss.meldung}`;
}

export function neueVerstoesse(
  vorher: readonly Markenverstoss[],
  nachher: readonly Markenverstoss[],
): Markenverstoss[] {
  const bekannt = new Set(vorher.map(kennung));
  return nachher.filter((v) => !bekannt.has(kennung(v)));
}

class BewachtesKommando implements Kommando {
  constructor(
    private readonly innen: Kommando,
    private readonly kit: Markenkit,
  ) {}

  get name(): string {
    return this.innen.name;
  }

  get verschmelzSchluessel(): string | null {
    return this.innen.verschmelzSchluessel;
  }

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const vorher = pruefeMarkenkonform(entwurf, this.kit);
    const ergebnis = this.innen.anwenden(entwurf);
    const nachher = pruefeMarkenkonform(ergebnis.entwurf, this.kit);

    const neu = neueVerstoesse(vorher, nachher).filter((v) => v.schwere === 'fehler');
    if (neu.length > 0) {
      const liste = neu.map((v) => v.meldung).join('; ');
      throw new KommandoFehler(this.innen.name, `verletzt das Markenkit: ${liste}`);
    }

    // Die Umkehrung wird mitbewacht, sonst kann Wiederholen einen Verstoß
    // einschleusen, den Ausführen abgelehnt hätte.
    return { entwurf: ergebnis.entwurf, umkehr: new BewachtesKommando(ergebnis.umkehr, this.kit) };
  }
}

/**
 * Hüllt ein Kommando so ein, dass es das Markenkit einhält. Bei nicht striktem
 * Kit ist das ein Durchreichen, weil dort alle Verstöße nur Warnungen sind.
 */
export function mitMarkenkit(kommando: Kommando, kit: Markenkit): Kommando {
  return new BewachtesKommando(kommando, kit);
}
