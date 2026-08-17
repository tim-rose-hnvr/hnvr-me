/**
 * Kommando-Stack mit Rückgängig und Wiederholen.
 *
 * Ein Kommando ist eine reine Funktion `Entwurf -> Entwurf`, die zusätzlich ihre
 * eigene Umkehrung zurückgibt. Damit ist Rückgängig kein Sonderfall und keine
 * Schnappschussverwaltung: die Umkehrung eines Kommandos ist wieder ein Kommando,
 * und ihre Umkehrung ist das Wiederholen.
 *
 * Der Stack fasst aufeinanderfolgende Kommandos mit gleichem
 * `verschmelzSchluessel` zusammen. Ohne das erzeugt jeder Tastenanschlag beim
 * Texttippen einen eigenen Rückgängig-Schritt und die Funktion wird unbrauchbar.
 */

import type { Entwurf } from '../modell/entwurf.js';
import { systemUhr, type Uhr } from '../modell/erzeugen.js';

export interface KommandoErgebnis {
  entwurf: Entwurf;
  umkehr: Kommando;
}

export interface Kommando {
  /** Für Protokoll und Bedienoberfläche, etwa "Element verschieben". */
  readonly name: string;
  /**
   * Kommandos mit gleichem Schlüssel, die direkt aufeinander folgen, werden zu
   * einem Rückgängig-Schritt zusammengefasst. `null` heißt: nie verschmelzen.
   *
   * **Regel für verschmelzbare Kommandos: die Umkehrung muss absolut sein.**
   * Beim Verschmelzen behält der Stack nur die Umkehrung des *ersten*
   * Kommandos — sie muss also den Zustand von vor der ganzen Folge
   * wiederherstellen, nicht bloß einen Schritt zurückgehen. Eine relative
   * Umkehrung (etwa eine Gegenverschiebung um `-dx`) nimmt sonst von zehn
   * Ziehschritten nur einen zurück. Deshalb ist die Umkehrung von
   * `ElementVerschieben` ein `ElementPositionSetzen` und die von `TextAendern`
   * der vollständige alte Text.
   */
  readonly verschmelzSchluessel: string | null;
  anwenden(entwurf: Entwurf): KommandoErgebnis;
}

/** Ein Kommando konnte nicht angewandt werden. Der Entwurf bleibt unverändert. */
export class KommandoFehler extends Error {
  readonly kommando: string;

  constructor(kommando: string, meldung: string) {
    super(`${kommando}: ${meldung}`);
    this.name = 'KommandoFehler';
    this.kommando = kommando;
  }
}

interface Eintrag {
  umkehr: Kommando;
  verschmelzSchluessel: string | null;
}

export interface StackOptionen {
  /** Höchstzahl der Rückgängig-Schritte. Ältere fallen unten heraus. */
  grenze?: number;
  jetzt?: Uhr;
}

export type Hoerer = (entwurf: Entwurf) => void;

export class KommandoStack {
  #entwurf: Entwurf;
  readonly #rueckgaengig: Eintrag[] = [];
  readonly #wiederholen: Eintrag[] = [];
  readonly #grenze: number;
  readonly #jetzt: Uhr;
  readonly #hoerer = new Set<Hoerer>();

  constructor(entwurf: Entwurf, optionen: StackOptionen = {}) {
    this.#entwurf = entwurf;
    this.#grenze = optionen.grenze ?? 200;
    this.#jetzt = optionen.jetzt ?? systemUhr;
  }

  get entwurf(): Entwurf {
    return this.#entwurf;
  }

  get kannRueckgaengig(): boolean {
    return this.#rueckgaengig.length > 0;
  }

  get kannWiederholen(): boolean {
    return this.#wiederholen.length > 0;
  }

  /** Namen der Rückgängig-Schritte, jüngster zuletzt. Für die Verlaufsanzeige. */
  get verlauf(): readonly string[] {
    return this.#rueckgaengig.map((e) => e.umkehr.name);
  }

  abonniere(hoerer: Hoerer): () => void {
    this.#hoerer.add(hoerer);
    return () => {
      this.#hoerer.delete(hoerer);
    };
  }

  /**
   * Wendet ein Kommando an. Wirft `KommandoFehler`, wenn es nicht anwendbar ist —
   * der Stand bleibt dann unverändert, auch der Rückgängig-Verlauf.
   */
  ausfuehren(kommando: Kommando): Entwurf {
    const ergebnis = kommando.anwenden(this.#entwurf);

    const letzter = this.#rueckgaengig.at(-1);
    const verschmilzt =
      kommando.verschmelzSchluessel !== null &&
      letzter !== undefined &&
      letzter.verschmelzSchluessel === kommando.verschmelzSchluessel;

    // Beim Verschmelzen bleibt die ältere Umkehrung stehen: sie führt weiter
    // zurück und ist damit genau das, was der Nutzer erwartet.
    if (!verschmilzt) {
      this.#rueckgaengig.push({
        umkehr: ergebnis.umkehr,
        verschmelzSchluessel: kommando.verschmelzSchluessel,
      });
      if (this.#rueckgaengig.length > this.#grenze) this.#rueckgaengig.shift();
    }

    this.#wiederholen.length = 0;
    this.#setze(ergebnis.entwurf);
    return this.#entwurf;
  }

  rueckgaengig(): Entwurf {
    const eintrag = this.#rueckgaengig.pop();
    if (eintrag === undefined) return this.#entwurf;

    const ergebnis = eintrag.umkehr.anwenden(this.#entwurf);
    this.#wiederholen.push({
      umkehr: ergebnis.umkehr,
      verschmelzSchluessel: eintrag.verschmelzSchluessel,
    });
    this.#setze(ergebnis.entwurf);
    return this.#entwurf;
  }

  wiederholen(): Entwurf {
    const eintrag = this.#wiederholen.pop();
    if (eintrag === undefined) return this.#entwurf;

    const ergebnis = eintrag.umkehr.anwenden(this.#entwurf);
    this.#rueckgaengig.push({
      umkehr: ergebnis.umkehr,
      verschmelzSchluessel: eintrag.verschmelzSchluessel,
    });
    this.#setze(ergebnis.entwurf);
    return this.#entwurf;
  }

  #setze(entwurf: Entwurf): void {
    this.#entwurf = { ...entwurf, geaendertAm: this.#jetzt() };
    for (const hoerer of this.#hoerer) hoerer(this.#entwurf);
  }
}
