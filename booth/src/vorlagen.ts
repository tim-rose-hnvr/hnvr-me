/**
 * Ablage der Vorlagen — auf der Box, nicht im Browser.
 *
 * Vorher lag jede eigene Vorlage im `localStorage` genau eines Browsers,
 * während der Server seine eigene Liste hielt. Zwei Listen derselben Sache
 * laufen auseinander, und man merkt es auf dem Papier: Der Editor zeigte eine
 * Vorlage, die der Booth nicht kannte.
 *
 * Jetzt gibt es eine Liste. Sie liegt auf der Box (`config/templates.json`),
 * wird über `/api/templates` gelesen und geschrieben, und ändert sie jemand
 * anders — der Editor am zweiten Gerät, ein Push aus dem Konto —, sagt der
 * Server es allen offenen Oberflächen.
 *
 * Der Katalog (`vorlagen-katalog.json`) bleibt im Programm: Er ist die
 * Erstausstattung, mit der der Server eine frische Box einrichtet, und
 * zugleich der Rückfall, wenn die Box gerade nicht antwortet. Eine Fotobox,
 * die ohne Server nichts mehr anzeigt, wäre ein Rückschritt.
 */

import katalogRoh from '../vorlagen-katalog.json';
import { pruefeVorlage, type Formatschluessel, type Vorlage } from './vorlage';

const ZWISCHENSPEICHER = 'youbooth.vorlagen.stand';

/**
 * Jede Liste geht durch dieselbe Prüfung wie eine eingelesene Datei — der
 * Katalog aus dem Programm ebenso wie die Antwort der Box. Eine kaputte Zeile
 * darf nicht als kaputtes Blatt im Drucker enden.
 */
function pruefeListe(roh: unknown): Vorlage[] {
  if (!Array.isArray(roh)) return [];
  return roh.flatMap((eintrag) => {
    const geprueft = pruefeVorlage(eintrag);
    return 'vorlage' in geprueft ? [geprueft.vorlage] : [];
  });
}

const KATALOG: Vorlage[] = pruefeListe(katalogRoh);
const KATALOG_IDS = new Set(KATALOG.map((v) => v.id));

/** Was gerade gilt. Wird beim Start geladen und bei Änderungen nachgeführt. */
let bekannt: Vorlage[] = KATALOG;
const aktiv: { foto: string; streifen: string } = {
  foto: 'foto-klassisch',
  streifen: 'streifen-klassisch',
};

type Serverstand = { templates: unknown[]; active?: { single?: string; strip?: string } };

function ausZwischenspeicher(): Serverstand | null {
  try {
    const roh = localStorage.getItem(ZWISCHENSPEICHER);
    return roh ? (JSON.parse(roh) as Serverstand) : null;
  } catch {
    return null;
  }
}

function inZwischenspeicher(stand: Serverstand): void {
  try {
    localStorage.setItem(ZWISCHENSPEICHER, JSON.stringify(stand));
  } catch {
    // Ohne Zwischenspeicher läuft die Box weiter, nur ohne Rückfall.
  }
}

function uebernimm(stand: Serverstand): void {
  const geprueft = pruefeListe(stand.templates);
  // Eine leere Antwort ersetzt nichts: Lieber der alte Stand als gar keine
  // Vorlage — ohne Vorlage druckt die Box nicht.
  if (geprueft.length) bekannt = geprueft;
  if (stand.active?.single) aktiv.foto = stand.active.single;
  if (stand.active?.strip) aktiv.streifen = stand.active.strip;
}

/**
 * Holt den Stand von der Box. Antwortet sie nicht, gilt der Zwischenspeicher,
 * und fehlt auch der, der mitgelieferte Katalog.
 */
export async function ladeVorlagen(): Promise<'box' | 'zwischenspeicher' | 'katalog'> {
  try {
    const antwort = await fetch('/api/templates');
    if (!antwort.ok) throw new Error(String(antwort.status));
    const stand = (await antwort.json()) as Serverstand;
    uebernimm(stand);
    inZwischenspeicher(stand);
    return 'box';
  } catch {
    const gemerkt = ausZwischenspeicher();
    if (gemerkt) {
      uebernimm(gemerkt);
      return 'zwischenspeicher';
    }
    return 'katalog';
  }
}

/** Nachricht der Box, dass sich die Liste geändert hat. */
export function vorlagenGeaendert(stand: Serverstand): void {
  uebernimm(stand);
  inZwischenspeicher(stand);
}

export function alleVorlagen(): Vorlage[] {
  return bekannt;
}

export function eigeneVorlagen(): Vorlage[] {
  return bekannt.filter((v) => !KATALOG_IDS.has(v.id));
}

export function mitgelieferteVorlagen(): Vorlage[] {
  return bekannt.filter((v) => KATALOG_IDS.has(v.id));
}

export function istMitgeliefert(id: string): boolean {
  return KATALOG_IDS.has(id);
}

/** Welche Vorlage die Box gerade druckt — je Aufnahmeart. */
export function eingestellt(): { foto: string; streifen: string } {
  return aktiv;
}

/**
 * Die Vorlage zu einer Kennung. Gibt es sie nicht mehr, wird die erste des
 * passenden Blattes genommen — die Box druckt weiter, auch wenn eine Vorlage
 * gelöscht wurde, während sie eingestellt war.
 */
export function findeVorlage(id: string, art: 'foto' | 'streifen'): Vorlage {
  return bekannt.find((v) => v.id === id) ?? bekannt.find((v) => v.art === art) ?? KATALOG[0]!;
}

export function vorlagenNachFormat(format: Formatschluessel): Vorlage[] {
  return bekannt.filter((v) => v.format === format);
}

export function neueVorlagenKennung(): string {
  return 'v' + Math.random().toString(36).slice(2, 9);
}

/** Kopiert eine Vorlage samt Feldern; den Namen bekommt der Aufrufer. */
export function kopiere(v: Vorlage, name: string): Vorlage {
  return {
    ...v,
    id: neueVorlagenKennung(),
    name,
    felder: v.felder.map((f) => ({ ...f })),
  };
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

async function anDieBox<T>(pfad: string, wunsch: RequestInit): Promise<T> {
  const antwort = await fetch(pfad, wunsch);
  const text = await antwort.text();
  let daten: Record<string, unknown> = {};
  try {
    daten = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    daten = {};
  }
  if (!antwort.ok) {
    throw new Error(String(daten.error || `${antwort.status} ${text.slice(0, 120)}`));
  }
  return daten as T;
}

/**
 * Legt eine Vorlage auf der Box ab. Die Box prüft sie noch einmal — sie traut
 * niemandem, auch nicht dem eigenen Editor —, und ihre Antwort ist der Stand,
 * der danach gilt.
 */
export async function sichereVorlage(v: Vorlage): Promise<Vorlage> {
  const antwort = await anDieBox<{ template: Vorlage }>('/api/templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  });
  await ladeVorlagen();
  return antwort.template;
}

export async function loescheVorlage(id: string): Promise<void> {
  await anDieBox('/api/templates/' + encodeURIComponent(id), { method: 'DELETE' });
  await ladeVorlagen();
}

/** Stellt eine Vorlage scharf — für Fotos oder Streifen, je nach ihrem Blatt. */
export async function stelleEin(id: string): Promise<void> {
  await anDieBox('/api/templates/' + encodeURIComponent(id) + '/activate', { method: 'POST' });
  await ladeVorlagen();
}
