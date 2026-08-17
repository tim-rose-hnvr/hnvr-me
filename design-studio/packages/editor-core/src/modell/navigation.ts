/**
 * Suchen und Ersetzen im Elementbaum.
 *
 * Alle Funktionen arbeiten unveränderlich: sie geben einen neuen Entwurf zurück
 * und fassen den alten nicht an. Der Kommando-Stack verlässt sich darauf, weil
 * die Umkehrung eines Kommandos sonst auf verändertem Grund stünde.
 */

import type { Entwurf, Entwurfselement, Seite } from './entwurf.js';

export interface Fundstelle {
  element: Entwurfselement;
  seiteId: string;
  /** Index in der direkt umgebenden Elementliste. */
  index: number;
  /** Id der umgebenden Gruppe, `null` wenn das Element direkt auf der Seite liegt. */
  gruppenId: string | null;
}

export function findeElement(entwurf: Entwurf, elementId: string): Fundstelle | null {
  for (const seite of entwurf.seiten) {
    const treffer = sucheInListe(seite.elemente, elementId, seite.id, null);
    if (treffer !== null) return treffer;
  }
  return null;
}

function sucheInListe(
  elemente: readonly Entwurfselement[],
  elementId: string,
  seiteId: string,
  gruppenId: string | null,
): Fundstelle | null {
  for (const [index, element] of elemente.entries()) {
    if (element.id === elementId) return { element, seiteId, index, gruppenId };
    if (element.typ === 'gruppe') {
      const treffer = sucheInListe(element.kinder, elementId, seiteId, element.id);
      if (treffer !== null) return treffer;
    }
  }
  return null;
}

export function findeSeite(entwurf: Entwurf, seiteId: string): Seite | null {
  return entwurf.seiten.find((s) => s.id === seiteId) ?? null;
}

/**
 * Ersetzt ein Element durch das Ergebnis von `ersetzer`. Gibt `null` zurück,
 * wenn es die id nicht gibt — der Aufrufer entscheidet, ob das ein Fehler ist.
 */
export function ersetzeElement(
  entwurf: Entwurf,
  elementId: string,
  ersetzer: (alt: Entwurfselement) => Entwurfselement,
): Entwurf | null {
  let getroffen = false;

  const ersetzeInListe = (elemente: readonly Entwurfselement[]): Entwurfselement[] =>
    elemente.map((element) => {
      if (element.id === elementId) {
        getroffen = true;
        return ersetzer(element);
      }
      if (element.typ === 'gruppe') {
        return { ...element, kinder: ersetzeInListe(element.kinder) };
      }
      return element;
    });

  const seiten = entwurf.seiten.map((seite) => ({
    ...seite,
    elemente: ersetzeInListe(seite.elemente),
  }));

  return getroffen ? { ...entwurf, seiten } : null;
}

export interface Entnahme {
  entwurf: Entwurf;
  fundstelle: Fundstelle;
}

/** Nimmt ein Element heraus und meldet, wo es lag — die Grundlage jeder Umkehrung. */
export function entnimmElement(entwurf: Entwurf, elementId: string): Entnahme | null {
  const fundstelle = findeElement(entwurf, elementId);
  if (fundstelle === null) return null;

  const entferneAusListe = (elemente: readonly Entwurfselement[]): Entwurfselement[] =>
    elemente
      .filter((element) => element.id !== elementId)
      .map((element) =>
        element.typ === 'gruppe' ? { ...element, kinder: entferneAusListe(element.kinder) } : element,
      );

  const seiten = entwurf.seiten.map((seite) => ({
    ...seite,
    elemente: entferneAusListe(seite.elemente),
  }));

  return { entwurf: { ...entwurf, seiten }, fundstelle };
}

/**
 * Fügt ein Element an einer bestimmten Stelle ein. `index` jenseits der Länge
 * hängt hinten an; das ist der Normalfall beim Anlegen.
 */
export function fuegeElementEin(
  entwurf: Entwurf,
  ziel: { seiteId: string; gruppenId: string | null; index: number },
  element: Entwurfselement,
): Entwurf | null {
  let getroffen = false;

  const einfuegen = (elemente: readonly Entwurfselement[]): Entwurfselement[] => {
    const kopie = [...elemente];
    const stelle = Math.max(0, Math.min(ziel.index, kopie.length));
    kopie.splice(stelle, 0, element);
    getroffen = true;
    return kopie;
  };

  const inGruppe = (elemente: readonly Entwurfselement[]): Entwurfselement[] =>
    elemente.map((kandidat) => {
      if (kandidat.typ !== 'gruppe') return kandidat;
      if (kandidat.id === ziel.gruppenId) {
        return { ...kandidat, kinder: einfuegen(kandidat.kinder) };
      }
      return { ...kandidat, kinder: inGruppe(kandidat.kinder) };
    });

  const seiten = entwurf.seiten.map((seite) => {
    if (seite.id !== ziel.seiteId) return seite;
    return {
      ...seite,
      elemente: ziel.gruppenId === null ? einfuegen(seite.elemente) : inGruppe(seite.elemente),
    };
  });

  return getroffen ? { ...entwurf, seiten } : null;
}

/** Alle Elemente eines Entwurfs in Dokumentreihenfolge, Gruppen eingeschlossen. */
export function* alleElemente(entwurf: Entwurf): Generator<{ element: Entwurfselement; seiteId: string }> {
  function* durchlaufe(
    elemente: readonly Entwurfselement[],
    seiteId: string,
  ): Generator<{ element: Entwurfselement; seiteId: string }> {
    for (const element of elemente) {
      yield { element, seiteId };
      if (element.typ === 'gruppe') yield* durchlaufe(element.kinder, seiteId);
    }
  }
  for (const seite of entwurf.seiten) yield* durchlaufe(seite.elemente, seite.id);
}
