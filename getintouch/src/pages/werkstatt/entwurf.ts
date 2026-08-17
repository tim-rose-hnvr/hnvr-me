/**
 * Ein Entwurf aus der Werkstatt, entpackt und geprüft.
 *
 * Steht hier und nicht im Kern, weil es allein die Werkstatt betrifft: aus dem
 * Parameter `p` wird ein Profil oder nichts.
 */

import { entpacke } from '../../kern/packung.ts';
import { lieseProfil, type Profil } from '../../kern/profil.ts';

export async function entwurfAus(parameter: URLSearchParams): Promise<Profil | null> {
  const gepackt = parameter.get('p');
  if (!gepackt) return null;

  const roh = await entpacke(gepackt);
  if (!roh) return null;

  const ergebnis = lieseProfil(roh);
  return ergebnis.ok ? ergebnis.profil : null;
}
