/**
 * Ablage — woher ein Profil kommt.
 *
 * Zwei Quellen hinter einer Schnittstelle:
 *
 *  - **dateien**: die Profile aus `daten/profile/*.json`. Sie werden mit gebaut
 *    und liegen im Bündel. Damit läuft das Projekt vollständig ohne Wix-Konto,
 *    und die eigene Seite von hnvr.me ist auch dann noch da, wenn eine
 *    Datenbank streikt.
 *  - **wix**: die Collection `GetInTouchProfile` im Wix-CMS. Das ist die Quelle,
 *    sobald sich fremde Leute Seiten anlegen.
 *
 * Beide werden übereinandergelegt: Wix wird zuerst gefragt, die Dateien fangen
 * auf. So kann eine gepflegte Hausseite nie von einem leeren Datensatz
 * überschrieben werden, und der Umbau auf den Editor ändert an den Seiten,
 * die es schon gibt, nichts.
 */

import type { Profil } from '../profil.ts';
import { ausDateien } from './dateien.ts';
import { ausWix, wixIstEingerichtet } from './wix.ts';

export interface Ablage {
  name: string;
  hole(slug: string): Promise<Profil | null>;
  /** Alle Adressen, die zur Bauzeit bekannt sind. Für Sitemap und Vorabbau. */
  liste(): Promise<string[]>;
}

let zwischenspeicher: Ablage | null = null;

export function ablage(): Ablage {
  if (zwischenspeicher) return zwischenspeicher;

  const quellen: Ablage[] = [];
  if (wixIstEingerichtet()) quellen.push(ausWix());
  quellen.push(ausDateien());

  zwischenspeicher = {
    name: quellen.map((q) => q.name).join(' → '),

    async hole(slug) {
      for (const quelle of quellen) {
        try {
          const profil = await quelle.hole(slug);
          if (profil) return profil;
        } catch (fehler) {
          // Eine ausgefallene Quelle darf die Seite nicht mitreißen: die
          // nächste Quelle bekommt ihre Chance, und der Ausfall steht im Log.
          console.error(`[getintouch] Quelle „${quelle.name}" nicht erreichbar:`, fehler);
        }
      }
      return null;
    },

    async liste() {
      const alle = new Set<string>();
      for (const quelle of quellen) {
        try {
          for (const slug of await quelle.liste()) alle.add(slug);
        } catch (fehler) {
          console.error(`[getintouch] Quelle „${quelle.name}" liefert keine Liste:`, fehler);
        }
      }
      return [...alle].sort();
    },
  };

  return zwischenspeicher;
}
