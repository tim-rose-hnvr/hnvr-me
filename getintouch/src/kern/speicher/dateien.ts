/**
 * Profile aus dem Verzeichnis `daten/profile`.
 *
 * Bewusst über `import.meta.glob` und nicht über `fs`: die Dateien wandern
 * damit ins Bündel und sind auf jeder Laufzeitumgebung lesbar — auch dort, wo
 * es kein Dateisystem gibt, wie auf der Wix-Infrastruktur.
 *
 * Ein Profil, das die Prüfung nicht besteht, wird nicht ausgeliefert. Lieber
 * eine Seite, die ehrlich fehlt, als eine mit halben Angaben.
 */

import { lieseProfil, type Profil } from '../profil.ts';
import type { Ablage } from './index.ts';

const rohdaten = import.meta.glob<{ default: unknown }>('/daten/profile/*.json', { eager: true });

const profile = new Map<string, Profil>();

for (const [pfad, modul] of Object.entries(rohdaten)) {
  const ergebnis = lieseProfil(modul.default);
  if (!ergebnis.ok) {
    const liste = ergebnis.fehler.map((f) => `  ${f.stelle || '(Wurzel)'}: ${f.meldung}`).join('\n');
    console.error(`[getintouch] ${pfad} wird übergangen:\n${liste}`);
    continue;
  }
  profile.set(ergebnis.profil.slug, ergebnis.profil);
}

export function ausDateien(): Ablage {
  return {
    name: 'dateien',
    async hole(slug) {
      return profile.get(slug.toLowerCase()) ?? null;
    },
    async liste() {
      return [...profile.keys()];
    },
  };
}
