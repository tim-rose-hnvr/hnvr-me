/**
 * Die Abfragen des Eingangs.
 *
 * Steht neben der Profil-Ablage und nicht darin, weil es etwas anderes ist:
 * die Ablage liefert, was jeder sehen darf, das hier liefert, was nur der
 * Betreiber sehen darf. Zwei Dinge mit unterschiedlichem Zugang gehören nicht
 * hinter dieselbe Schnittstelle.
 *
 * Beide Abfragen laufen mit erhöhten Rechten. Das ist Absicht: die Collections
 * stehen bewusst nur der Verwaltung offen, damit der einzige Weg an die Daten
 * durch diesen Code führt — mitsamt der Schlüsselprüfung davor. Deshalb wird
 * hier auch nie ein Schlüssel entgegengenommen, sondern immer nur ein bereits
 * geprüfter Slug.
 */

import { schluesselFormStimmt, schluesselStimmt, type Nachrichteneintrag } from '../eingang.ts';

const PROFILE = 'GetInTouchProfile';
const NACHRICHTEN = 'GetInTouchNachricht';

interface WixAbfrage {
  eq(feld: string, wert: unknown): WixAbfrage;
  descending(feld: string): WixAbfrage;
  limit(anzahl: number): WixAbfrage;
  find(): Promise<{ items: unknown[] }>;
}
interface WixItems {
  query(collection: string): WixAbfrage;
}

async function erhoben(): Promise<WixItems | null> {
  try {
    const { items } = (await import('@wix/data')) as { items: WixItems };
    const { auth } = (await import('@wix/essentials')) as {
      auth: { elevate<T extends (...a: never[]) => unknown>(f: T): T };
    };
    return { query: (c: string) => auth.elevate(items.query.bind(items))(c) } as WixItems;
  } catch (fehler) {
    console.error('[getintouch] Eingang: Datenzugriff nicht möglich:', fehler);
    return null;
  }
}

function text(wert: unknown): string {
  return typeof wert === 'string' ? wert : '';
}

/**
 * Zu welchem Profil gehört dieser Schlüssel?
 *
 * Gibt `null` zurück, sobald irgendetwas nicht stimmt — falsche Form, kein
 * Treffer, kein hinterlegter Schlüssel. Nie eine Auskunft darüber, woran es
 * lag: „diesen Schlüssel gibt es nicht" und „dieser Schlüssel ist falsch"
 * wären zwei verschiedene Antworten und damit schon zu viel.
 */
export async function profilNachSchluessel(schluessel: string): Promise<string | null> {
  if (!schluesselFormStimmt(schluessel)) return null;

  const items = await erhoben();
  if (!items) return null;

  try {
    const treffer = await items.query(PROFILE).eq('eingangSchluessel', schluessel).limit(2).find();
    // Genau ein Treffer, sonst nichts: zwei Profile mit demselben Schlüssel
    // wären ein Fehler in den Daten, und im Zweifel wird nichts gezeigt.
    if (treffer.items.length !== 1) return null;

    const eintrag = treffer.items[0] as Record<string, unknown>;
    // Trotz der Abfrage noch einmal selbst vergleichen: worauf die Datenbank
    // bei ihrem `eq` genau vergleicht — Groß- und Kleinschreibung, Leerzeichen
    // am Rand — ist ihre Sache und nicht unsere Zusage.
    if (!schluesselStimmt(schluessel, text(eintrag.eingangSchluessel))) return null;

    const slug = text(eintrag.slug).toLowerCase();
    return slug || null;
  } catch (fehler) {
    console.error('[getintouch] Eingang: Profil nicht abfragbar:', fehler);
    return null;
  }
}

export async function nachrichtenFuer(slug: string, hoechstens = 200): Promise<Nachrichteneintrag[]> {
  const items = await erhoben();
  if (!items) return [];

  try {
    const treffer = await items.query(NACHRICHTEN).eq('slug', slug).descending('_createdDate').limit(hoechstens).find();
    return treffer.items.map((roh) => {
      const e = roh as Record<string, unknown>;
      const datum = e._createdDate;
      return {
        id: text(e._id),
        absicht: text(e.absicht),
        text: text(e.text),
        name: text(e.name),
        antwortweg: text(e.antwortweg),
        erledigt: e.erledigt === true,
        eingegangen: datum instanceof Date ? datum : typeof datum === 'string' ? new Date(datum) : null,
      };
    });
  } catch (fehler) {
    console.error('[getintouch] Eingang: Nachrichten nicht abfragbar:', fehler);
    return [];
  }
}
