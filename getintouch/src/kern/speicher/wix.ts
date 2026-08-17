/**
 * Profile aus dem Wix-CMS.
 *
 * Diese Quelle ist der Schritt, der aus einer Vorführung ein Produkt macht.
 * Der Vorgänger hielt alle Daten im `localStorage` des Browsers — die Seite
 * `hnvr.me/t/tim` meldete deshalb jedem Besucher „noch frei", und der QR-Code
 * auf einer gedruckten Visitenkarte zeigte ins Leere. Ein Link, der nur für
 * den Ersteller funktioniert, ist kein Link.
 *
 * Erwartet wird eine Collection mit drei Feldern:
 *
 *   slug            Text, eindeutig      — die Adresse unter /t/
 *   daten           Objekt               — das Profil, Aufbau siehe `profil.ts`
 *   veroeffentlicht Ja/Nein              — Entwürfe bleiben unsichtbar
 *
 * Der Name der Collection ist eine Konstante des Programms, keine Einstellung.
 * Er stand einmal in `GETINTOUCH_WIX_COLLECTION` — und genau daran ist die
 * Quelle beim ersten Ausliefern gescheitert: die Variable wird zur Laufzeit aus
 * `process.env` gelesen, auf den Servern von Wix ist sie nicht gesetzt, und die
 * Seite fiel lautlos auf die Dateien zurück. Ein Ausfall, den niemand sieht,
 * ist schlimmer als einer, der kracht. Die Variable übersteuert weiterhin —
 * für Tests gegen eine zweite Collection —, aber sie entscheidet nicht mehr,
 * ob es das CMS überhaupt gibt.
 *
 * Die Anmeldung übernimmt die Astro-Anbindung von Wix: sie hinterlegt die
 * Zugangsdaten des Projekts, deshalb wird hier kein Client gebaut und kein
 * Token angefasst.
 * Siehe https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/about-the-astro-integration
 */

import { lieseProfil, type Profil } from '../profil.ts';
import type { Ablage } from './index.ts';

const VORGABE = 'GetInTouchProfile';

function collectionName(): string {
  const wert = import.meta.env.GETINTOUCH_WIX_COLLECTION;
  return typeof wert === 'string' && wert.trim() ? wert.trim() : VORGABE;
}

export function wixIstEingerichtet(): boolean {
  return true;
}

/**
 * Der Ausschnitt von `@wix/data`, den diese Ablage tatsächlich benutzt.
 * Absichtlich hier beschrieben statt aus dem Paket bezogen: das Projekt baut
 * damit auch, solange `@wix/data` noch nicht installiert ist.
 */
interface WixAbfrage {
  eq(feld: string, wert: unknown): WixAbfrage;
  limit(anzahl: number): WixAbfrage;
  find(): Promise<{ items: unknown[] }>;
}
interface WixItems {
  query(collection: string): WixAbfrage;
}

/**
 * Erst zur Laufzeit geladen und genau einmal: fehlt das Paket — etwa in einer
 * Prüfumgebung ohne Wix —, soll das einmal im Log stehen und nicht bei jedem
 * Seitenaufruf. Danach gelten allein die Dateien.
 */
let modul: Promise<WixItems | null> | null = null;

function datenmodul(): Promise<WixItems | null> {
  modul ??= import('@wix/data')
    .then((m) => (m as { items: WixItems }).items)
    .catch((fehler) => {
      console.error('[getintouch] „@wix/data" nicht ladbar — es gelten die Dateien:', fehler);
      return null;
    });
  return modul;
}

function alsProfil(eintrag: Record<string, unknown>, slug: string): Profil | null {
  // Wix legt Objektfelder als Objekt ab; ältere Datensätze können JSON-Text enthalten.
  let roh = eintrag.daten;
  if (typeof roh === 'string') {
    try {
      roh = JSON.parse(roh);
    } catch {
      console.error(`[getintouch] Profil „${slug}": Feld „daten" ist kein gültiges JSON.`);
      return null;
    }
  }

  // Die Adresse gilt aus der Spalte, nicht aus dem Datensatz — sonst könnten
  // zwei Einträge dieselbe Seite beanspruchen.
  const ergebnis = lieseProfil({ ...(roh as Record<string, unknown>), slug });
  if (!ergebnis.ok) {
    const liste = ergebnis.fehler.map((f) => `  ${f.stelle || '(Wurzel)'}: ${f.meldung}`).join('\n');
    console.error(`[getintouch] Profil „${slug}" aus dem CMS ist unvollständig:\n${liste}`);
    return null;
  }
  return ergebnis.profil;
}

export function ausWix(): Ablage {
  const collection = collectionName();

  return {
    name: `wix:${collection}`,

    async hole(slug) {
      const items = await datenmodul();
      if (!items) return null;

      const treffer = await items
        .query(collection)
        .eq('slug', slug.toLowerCase())
        .eq('veroeffentlicht', true)
        .limit(1)
        .find();

      const eintrag = treffer.items[0];
      return eintrag ? alsProfil(eintrag as Record<string, unknown>, slug.toLowerCase()) : null;
    },

    async liste() {
      const items = await datenmodul();
      if (!items) return [];

      const treffer = await items.query(collection).eq('veroeffentlicht', true).limit(1000).find();
      return treffer.items
        .map((e) => (e as Record<string, unknown>).slug)
        .filter((s): s is string => typeof s === 'string');
    },
  };
}
