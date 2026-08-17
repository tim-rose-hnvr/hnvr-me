/**
 * Kommandos auf Elementen.
 *
 * Jedes Kommando gibt seine Umkehrung mit zurück. Wo eine Umkehrung Daten
 * braucht, die es erst beim Anwenden gibt (die alte Position eines gelöschten
 * Elements etwa), wird sie dort erzeugt und nicht vorher geraten.
 */

import type {
  BildElement,
  Entwurf,
  Entwurfselement,
  FormElement,
  GruppenElement,
  TextElement,
} from '../modell/entwurf.js';
import {
  entnimmElement,
  ersetzeElement,
  findeElement,
  findeSeite,
  fuegeElementEin,
} from '../modell/navigation.js';
import { KommandoFehler, type Kommando, type KommandoErgebnis } from './stack.js';
import { verlangeAenderungsrecht, type Aspekt } from './schutz.js';

/**
 * Teiländerung an einem Element. `Partial` verteilt sich über die Vereinigung,
 * deshalb ist `{ schriftGroesse: 40 }` gültig und `{ schriftGroesse: 40,
 * passform: 'fuellen' }` nicht — genau richtig.
 */
export type ElementAenderung =
  | Partial<Omit<TextElement, 'typ' | 'id'>>
  | Partial<Omit<BildElement, 'typ' | 'id'>>
  | Partial<Omit<FormElement, 'typ' | 'id'>>
  | Partial<Omit<GruppenElement, 'typ' | 'id'>>;

export interface Einfuegestelle {
  seiteId: string;
  gruppenId: string | null;
  index: number;
}

export class ElementHinzufuegen implements Kommando {
  readonly name = 'Element hinzufügen';
  readonly verschmelzSchluessel = null;

  constructor(
    private readonly stelle: Einfuegestelle,
    private readonly element: Entwurfselement,
  ) {}

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    if (findeSeite(entwurf, this.stelle.seiteId) === null) {
      throw new KommandoFehler(this.name, `Seite "${this.stelle.seiteId}" gibt es nicht`);
    }
    if (findeElement(entwurf, this.element.id) !== null) {
      throw new KommandoFehler(this.name, `Element-id "${this.element.id}" ist schon vergeben`);
    }

    const neu = fuegeElementEin(entwurf, this.stelle, this.element);
    if (neu === null) {
      throw new KommandoFehler(
        this.name,
        `Einfügestelle nicht gefunden (Seite ${this.stelle.seiteId}, Gruppe ${String(this.stelle.gruppenId)})`,
      );
    }

    return { entwurf: neu, umkehr: new ElementEntfernen(this.element.id) };
  }
}

export class ElementEntfernen implements Kommando {
  readonly name = 'Element entfernen';
  readonly verschmelzSchluessel = null;

  constructor(private readonly elementId: string) {}

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const fundstelle = findeElement(entwurf, this.elementId);
    if (fundstelle === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" gibt es nicht`);
    }
    verlangeAenderungsrecht(this.name, fundstelle.element, 'struktur');

    const entnahme = entnimmElement(entwurf, this.elementId);
    if (entnahme === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" ließ sich nicht entnehmen`);
    }

    const { seiteId, gruppenId, index, element } = entnahme.fundstelle;
    return {
      entwurf: entnahme.entwurf,
      umkehr: new ElementHinzufuegen({ seiteId, gruppenId, index }, element),
    };
  }
}

export class ElementAendern implements Kommando {
  readonly name: string;

  constructor(
    private readonly elementId: string,
    private readonly aenderung: ElementAenderung,
    private readonly aspekt: Aspekt,
    readonly verschmelzSchluessel: string | null = null,
    name = 'Element ändern',
  ) {
    this.name = name;
  }

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const fundstelle = findeElement(entwurf, this.elementId);
    if (fundstelle === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" gibt es nicht`);
    }
    verlangeAenderungsrecht(this.name, fundstelle.element, this.aspekt);

    const schluessel = Object.keys(this.aenderung) as (keyof Entwurfselement)[];
    if (schluessel.length === 0) {
      throw new KommandoFehler(this.name, 'leere Änderung');
    }

    const alt = fundstelle.element as unknown as Record<string, unknown>;
    const rueckAenderung: Record<string, unknown> = {};
    for (const k of schluessel) {
      if (k === 'id' || k === 'typ') {
        throw new KommandoFehler(this.name, `"${k}" darf nicht geändert werden`);
      }
      rueckAenderung[k] = alt[k];
    }

    // Einziger Cast im Kommandopfad: die Vereinigungs-Partial lässt sich nicht
    // ohne Hilfe auf das konkrete Element zurückführen. `typ` und `id` sind oben
    // ausgeschlossen, damit bleibt die Variante erhalten.
    const neu = ersetzeElement(
      entwurf,
      this.elementId,
      (element) => ({ ...element, ...this.aenderung }) as Entwurfselement,
    );
    if (neu === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" verschwand beim Ersetzen`);
    }

    return {
      entwurf: neu,
      umkehr: new ElementAendern(
        this.elementId,
        rueckAenderung as ElementAenderung,
        this.aspekt,
        this.verschmelzSchluessel,
        this.name,
      ),
    };
  }
}

/**
 * Verschieben ist ein eigenes Kommando statt einer `ElementAendern`-Variante,
 * weil es beim Ziehen hundertfach je Sekunde kommt und deshalb verschmelzen muss.
 */
export class ElementVerschieben implements Kommando {
  readonly name = 'Element verschieben';
  readonly verschmelzSchluessel: string;

  constructor(
    private readonly elementId: string,
    private readonly dx: number,
    private readonly dy: number,
  ) {
    this.verschmelzSchluessel = `verschieben:${elementId}`;
  }

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const fundstelle = findeElement(entwurf, this.elementId);
    if (fundstelle === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" gibt es nicht`);
    }
    verlangeAenderungsrecht(this.name, fundstelle.element, 'position');

    const neu = ersetzeElement(entwurf, this.elementId, (element) => ({
      ...element,
      x: element.x + this.dx,
      y: element.y + this.dy,
    }));
    if (neu === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" verschwand beim Ersetzen`);
    }

    return {
      entwurf: neu,
      umkehr: new ElementVerschieben(this.elementId, -this.dx, -this.dy),
    };
  }
}

export class TextAendern implements Kommando {
  readonly name = 'Text ändern';
  readonly verschmelzSchluessel: string;

  constructor(
    private readonly elementId: string,
    private readonly inhalt: string,
  ) {
    this.verschmelzSchluessel = `text:${elementId}`;
  }

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const fundstelle = findeElement(entwurf, this.elementId);
    if (fundstelle === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" gibt es nicht`);
    }
    if (fundstelle.element.typ !== 'text') {
      throw new KommandoFehler(
        this.name,
        `Element "${this.elementId}" ist vom Typ "${fundstelle.element.typ}", nicht "text"`,
      );
    }
    verlangeAenderungsrecht(this.name, fundstelle.element, 'text');

    const alt = fundstelle.element.inhalt;
    const neu = ersetzeElement(entwurf, this.elementId, (element) => ({
      ...(element as TextElement),
      inhalt: this.inhalt,
    }));
    if (neu === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" verschwand beim Ersetzen`);
    }

    return { entwurf: neu, umkehr: new TextAendern(this.elementId, alt) };
  }
}

export type Stapelrichtung = 'vor' | 'zurueck' | 'ganzVor' | 'ganzZurueck';

/**
 * Ändert die Stapelreihenfolge innerhalb der umgebenden Liste. Index 0 liegt
 * hinten, das letzte Element vorn.
 */
export class StapelReihenfolgeAendern implements Kommando {
  readonly name = 'Stapelreihenfolge ändern';
  readonly verschmelzSchluessel = null;

  constructor(
    private readonly elementId: string,
    private readonly richtung: Stapelrichtung,
  ) {}

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const fundstelle = findeElement(entwurf, this.elementId);
    if (fundstelle === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" gibt es nicht`);
    }
    verlangeAenderungsrecht(this.name, fundstelle.element, 'struktur');

    const entnahme = entnimmElement(entwurf, this.elementId);
    if (entnahme === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" ließ sich nicht entnehmen`);
    }

    const { seiteId, gruppenId, index, element } = entnahme.fundstelle;
    const geschwister = zaehleGeschwister(entnahme.entwurf, seiteId, gruppenId);
    const zielIndex = neuerIndex(this.richtung, index, geschwister);

    if (zielIndex === index) {
      // Schon ganz vorn oder ganz hinten: unveränderter Stand, Umkehrung ist ein No-op.
      return { entwurf, umkehr: new StapelIndexSetzen(this.elementId, index) };
    }

    const neu = fuegeElementEin(entnahme.entwurf, { seiteId, gruppenId, index: zielIndex }, element);
    if (neu === null) {
      throw new KommandoFehler(this.name, 'Einfügestelle nach dem Entnehmen nicht mehr gefunden');
    }

    return { entwurf: neu, umkehr: new StapelIndexSetzen(this.elementId, index) };
  }
}

/** Umkehrung von `StapelReihenfolgeAendern`: setzt einen genauen Index. */
export class StapelIndexSetzen implements Kommando {
  readonly name = 'Stapelposition setzen';
  readonly verschmelzSchluessel = null;

  constructor(
    private readonly elementId: string,
    private readonly zielIndex: number,
  ) {}

  anwenden(entwurf: Entwurf): KommandoErgebnis {
    const entnahme = entnimmElement(entwurf, this.elementId);
    if (entnahme === null) {
      throw new KommandoFehler(this.name, `Element "${this.elementId}" gibt es nicht`);
    }

    const { seiteId, gruppenId, index, element } = entnahme.fundstelle;
    if (index === this.zielIndex) {
      return { entwurf, umkehr: new StapelIndexSetzen(this.elementId, index) };
    }

    const neu = fuegeElementEin(
      entnahme.entwurf,
      { seiteId, gruppenId, index: this.zielIndex },
      element,
    );
    if (neu === null) {
      throw new KommandoFehler(this.name, 'Einfügestelle nach dem Entnehmen nicht mehr gefunden');
    }

    return { entwurf: neu, umkehr: new StapelIndexSetzen(this.elementId, index) };
  }
}

function zaehleGeschwister(entwurf: Entwurf, seiteId: string, gruppenId: string | null): number {
  if (gruppenId === null) {
    return findeSeite(entwurf, seiteId)?.elemente.length ?? 0;
  }
  const gruppe = findeElement(entwurf, gruppenId);
  return gruppe !== null && gruppe.element.typ === 'gruppe' ? gruppe.element.kinder.length : 0;
}

function neuerIndex(richtung: Stapelrichtung, index: number, geschwisterOhneMich: number): number {
  const hoechster = geschwisterOhneMich;
  switch (richtung) {
    case 'vor':
      return Math.min(index + 1, hoechster);
    case 'zurueck':
      return Math.max(index - 1, 0);
    case 'ganzVor':
      return hoechster;
    case 'ganzZurueck':
      return 0;
  }
}
