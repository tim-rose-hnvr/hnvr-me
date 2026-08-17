/**
 * Auswahl und Ziehen.
 *
 * Die Schicht über dem Renderer: sie zeichnet nichts vom Entwurf, sondern nur
 * Auswahlrahmen und Griffe darüber. Alles, was der Nutzer tut, geht als
 * Kommando in den Stack — nie direkt an das Modell. Damit ist jede Handlung
 * rückgängig zu machen, ohne dass diese Datei davon etwas wissen muss.
 *
 * Die Schutzregeln aus `editor-core` gelten unverändert: ein gesperrtes Element
 * lässt sich nicht ziehen, ein Platzhalter nur in dem, was er freigibt. Diese
 * Datei fragt vorher, damit der Griff gar nicht erst erscheint — abgelehnt
 * würde es ohnehin.
 */

import {
  darfAendern,
  ElementPositionSetzen,
  ElementVerschieben,
  type Entwurfselement,
  findeElement,
  KommandoFehler,
  type KommandoStack,
} from '@studio/editor-core';

export type Griffart = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface Zeigerlage {
  /** Position in Dokumentpixeln, Ursprung linke obere Blattecke. */
  x: number;
  y: number;
}

export interface Ziehzustand {
  elementId: string;
  start: Zeigerlage;
  letzte: Zeigerlage;
  /** Position des Elements beim Aufsetzen — für ein sauberes Abbrechen. */
  ursprung: { x: number; y: number };
}

export type Aenderungsmelder = (meldung: string) => void;

/**
 * Verwaltet Auswahl und Ziehen. Kennt den Stack, nicht das DOM — die Anbindung
 * an Zeigerereignisse macht der Aufrufer, damit sich diese Datei ohne Browser
 * testen lässt.
 */
export class Auswahlsteuerung {
  #ausgewaehlt: string | null = null;
  #ziehen: Ziehzustand | null = null;
  readonly #stack: KommandoStack;
  readonly #melde: Aenderungsmelder;

  constructor(stack: KommandoStack, melde: Aenderungsmelder = () => {}) {
    this.#stack = stack;
    this.#melde = melde;
  }

  get ausgewaehlt(): string | null {
    return this.#ausgewaehlt;
  }

  get ziehtGerade(): boolean {
    return this.#ziehen !== null;
  }

  get ausgewaehltesElement(): Entwurfselement | null {
    if (this.#ausgewaehlt === null) return null;
    return findeElement(this.#stack.entwurf, this.#ausgewaehlt)?.element ?? null;
  }

  waehle(elementId: string | null): void {
    if (elementId === null) {
      this.#ausgewaehlt = null;
      return;
    }
    if (findeElement(this.#stack.entwurf, elementId) === null) {
      this.#ausgewaehlt = null;
      return;
    }
    this.#ausgewaehlt = elementId;
  }

  /** Darf das ausgewählte Element überhaupt bewegt werden? */
  get istBeweglich(): boolean {
    const element = this.ausgewaehltesElement;
    return element !== null && darfAendern(element, 'position');
  }

  beginneZiehen(elementId: string, bei: Zeigerlage): boolean {
    const fundstelle = findeElement(this.#stack.entwurf, elementId);
    if (fundstelle === null) return false;
    if (!darfAendern(fundstelle.element, 'position')) {
      this.#melde(
        fundstelle.element.platzhalter !== null
          ? `„${fundstelle.element.name}" ist ein Platzhalter und darf nicht verschoben werden.`
          : `„${fundstelle.element.name}" ist gesperrt.`,
      );
      return false;
    }

    this.#ausgewaehlt = elementId;
    this.#ziehen = {
      elementId,
      start: bei,
      letzte: bei,
      ursprung: { x: fundstelle.element.x, y: fundstelle.element.y },
    };
    return true;
  }

  /**
   * Bewegt das Element um die Differenz zur letzten Meldung. Die Kommandos
   * verschmelzen im Stack zu einem einzigen Rückgängig-Schritt.
   */
  zieheWeiter(nach: Zeigerlage): void {
    const ziehen = this.#ziehen;
    if (ziehen === null) return;

    const dx = nach.x - ziehen.letzte.x;
    const dy = nach.y - ziehen.letzte.y;
    if (dx === 0 && dy === 0) return;

    try {
      this.#stack.ausfuehren(new ElementVerschieben(ziehen.elementId, dx, dy));
      ziehen.letzte = nach;
    } catch (fehler) {
      if (fehler instanceof KommandoFehler) {
        this.#melde(fehler.message);
        this.#ziehen = null;
        return;
      }
      throw fehler;
    }
  }

  beendeZiehen(): void {
    this.#ziehen = null;
  }

  /** Setzt das Element auf seine Ausgangslage zurück — für Escape beim Ziehen. */
  brichZiehenAb(): void {
    const ziehen = this.#ziehen;
    this.#ziehen = null;
    if (ziehen === null) return;

    this.#stack.ausfuehren(
      new ElementPositionSetzen(ziehen.elementId, ziehen.ursprung.x, ziehen.ursprung.y),
    );
  }

  /** Verschiebt mit den Pfeiltasten. `schritt` in Dokumentpixeln. */
  verschiebeUmSchritt(dx: number, dy: number): void {
    if (this.#ausgewaehlt === null) return;
    try {
      this.#stack.ausfuehren(new ElementVerschieben(this.#ausgewaehlt, dx, dy));
    } catch (fehler) {
      if (fehler instanceof KommandoFehler) {
        this.#melde(fehler.message);
        return;
      }
      throw fehler;
    }
  }
}

/** Die acht Griffe eines Auswahlrahmens, im Uhrzeigersinn ab oben links. */
export const GRIFFE: readonly Griffart[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export interface Griffage {
  art: Griffart;
  /** Anteil 0..1 der Rahmenbreite bzw. -höhe. */
  ax: number;
  ay: number;
}

export function grifflagen(): Griffage[] {
  const lage: Record<Griffart, [number, number]> = {
    nw: [0, 0],
    n: [0.5, 0],
    ne: [1, 0],
    e: [1, 0.5],
    se: [1, 1],
    s: [0.5, 1],
    sw: [0, 1],
    w: [0, 0.5],
  };
  return GRIFFE.map((art) => ({ art, ax: lage[art][0], ay: lage[art][1] }));
}

/**
 * Neuer Rahmen beim Ziehen an einem Griff. Hält die Mindestgröße ein und
 * verhindert, dass ein Element durch Überziehen gespiegelt wird.
 */
export function rahmenNachGriff(
  rahmen: { x: number; y: number; breite: number; hoehe: number },
  griff: Griffart,
  dx: number,
  dy: number,
  mindestgroesse = 4,
): { x: number; y: number; breite: number; hoehe: number } {
  let { x, y, breite, hoehe } = rahmen;

  if (griff.includes('w')) {
    const neu = Math.min(breite - dx, breite + x);
    const begrenzt = Math.max(mindestgroesse, neu);
    x += breite - begrenzt;
    breite = begrenzt;
  }
  if (griff.includes('e')) breite = Math.max(mindestgroesse, breite + dx);
  if (griff.includes('n')) {
    const begrenzt = Math.max(mindestgroesse, hoehe - dy);
    y += hoehe - begrenzt;
    hoehe = begrenzt;
  }
  if (griff.includes('s')) hoehe = Math.max(mindestgroesse, hoehe + dy);

  return { x, y, breite, hoehe };
}
