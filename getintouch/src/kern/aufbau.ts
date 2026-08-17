/**
 * Aufbau — wie die Blöcke eines Profils auf der Seite angeordnet werden.
 *
 * Steht hier und nicht in der Astro-Seite, damit die Regel prüfbar ist: sie
 * entscheidet, ob aus vier Kontaktwegen ein Gitter oder eine Balkenreihe wird,
 * und das ist der sichtbarste Unterschied zum Vorbild.
 */

import { darstellungFuer, type Aktionsblock, type Block } from './profil.ts';
import { adresseFuer } from './ziele.ts';

export type Abschnitt =
  | { was: 'gitter'; bloecke: { block: Aktionsblock; adresse: string }[] }
  | { was: 'zeile'; block: Aktionsblock; adresse: string }
  | { was: 'sonst'; block: Block };

/**
 * Aufeinanderfolgende Kachelblöcke werden zu einem Gitter zusammengefasst.
 * Die gepflegte Reihenfolge bleibt dabei erhalten — eine Überschrift trennt
 * also weiterhin, was der Besitzer getrennt haben wollte.
 *
 * Eine einzelne Kachel wird zur Zeile: ein Gitter aus einem Element ist kein
 * Gitter, sondern ein verlorener Knopf am linken Rand.
 *
 * Blöcke ohne gültiges Ziel fallen ganz heraus. Lieber ein Eintrag weniger als
 * eine Schaltfläche, die ins Leere führt.
 */
export function ordne(bloecke: Block[]): Abschnitt[] {
  const abschnitte: Abschnitt[] = [];
  let stapel: { block: Aktionsblock; adresse: string }[] = [];

  const abladen = () => {
    if (stapel.length >= 2) abschnitte.push({ was: 'gitter', bloecke: stapel });
    else for (const e of stapel) abschnitte.push({ was: 'zeile', block: e.block, adresse: e.adresse });
    stapel = [];
  };

  for (const block of bloecke) {
    if (block.art !== 'aktion') {
      abladen();
      abschnitte.push({ was: 'sonst', block });
      continue;
    }

    const adresse = adresseFuer(block.kanal, block.ziel);
    if (!adresse) continue;

    if (darstellungFuer(block) === 'kachel') {
      stapel.push({ block, adresse });
    } else {
      abladen();
      abschnitte.push({ was: 'zeile', block, adresse });
    }
  }

  abladen();
  return abschnitte;
}
