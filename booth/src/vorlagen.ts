/**
 * Ablage der Vorlagen.
 *
 * Mitgelieferte Vorlagen sind unveränderlich — sie kommen aus dem Code und
 * bleiben, wie sie sind. Wer eine davon bearbeitet, bekommt eine Kopie. So ist
 * der Weg zurück immer offen, auch nach einer verunglückten Nacht am Editor.
 */

import { standardVorlagen, type Blattart, type Vorlage } from './vorlage';

const SCHLUESSEL = 'youbooth.vorlagen';

export function eigeneVorlagen(): Vorlage[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return [];
    const liste = JSON.parse(roh) as Vorlage[];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

export function sichereEigene(liste: Vorlage[]): { ok: true } | { fehler: string } {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
    return { ok: true };
  } catch {
    // Meist die Speichergrenze des Browsers — fast immer ein zu großes Logo.
    return {
      fehler:
        'Die Vorlagen passen nicht in den Speicher. Meist liegt es an einem zu großen Logo — nimm ein kleineres PNG.',
    };
  }
}

export function alleVorlagen(): Vorlage[] {
  return [...standardVorlagen(), ...eigeneVorlagen()];
}

export function istMitgeliefert(id: string): boolean {
  return standardVorlagen().some((v) => v.id === id);
}

export function findeVorlage(id: string, blatt: Blattart): Vorlage {
  const alle = alleVorlagen();
  const treffer = alle.find((v) => v.id === id && v.blatt === blatt);
  if (treffer) return treffer;
  // Fällt zurück auf die erste Vorlage des Blattes — die Box druckt weiter,
  // auch wenn eine Vorlage gelöscht wurde, während sie eingestellt war.
  return alle.find((v) => v.blatt === blatt) ?? standardVorlagen()[0]!;
}

export function neueVorlagenKennung(): string {
  return 'v' + Math.random().toString(36).slice(2, 9);
}

/** Kopiert eine Vorlage samt Feldern; Namen bekommt der Aufrufer. */
export function kopiere(v: Vorlage, name: string): Vorlage {
  return {
    ...v,
    id: neueVorlagenKennung(),
    name,
    felder: v.felder.map((f) => ({ ...f })),
  };
}
