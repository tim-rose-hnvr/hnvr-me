/**
 * Der Zugriff auf die Daten, die bereits auf der Wix-Site liegen.
 *
 * Diese Sammlungen sind nicht neu und nicht von mir angelegt — sie
 * stammen aus der vorigen PUNKT-Anwendung und tragen echte Daten:
 * fünf Codes, zwei Konten, Zählerstände. Als die alte Oberfläche beim
 * Ausliefern ersetzt wurde, blieb die Datenbank stehen und die
 * Weiterleitung verschwand. Ein gedruckter Code, der ins Leere zeigt,
 * ist der teuerste Fehler, den dieses System machen kann. Deshalb steht
 * diese Datei am Anfang der Wiederherstellung und nicht am Ende.
 *
 * Die Feldnamen sind aus dem Bestand abgelesen, nicht erfunden:
 *
 *   PK_Codes      kuerzel, ziel, aktiv, geloescht, dynamisch, kontoId,
 *                 name, typ, erstellt, geaendert, scans,
 *                 gesperrtWegen, regelnJson, stilJson, inhaltJson
 *   PK_Statistik  _id = codeId + "_" + tag, codeId, tag, gesamt,
 *                 zaehlerJson
 *   PK_Konten     mail, pwHash, sitzungsSalz, name, plan, erstellt,
 *                 letzteAnmeldung, fehlversuche, gesperrtBis
 *
 * Wer hier ein Feld umbenennt, verliert den Bestand. Das ist der Grund,
 * warum diese Namen nicht schöner gemacht werden.
 */

export const CODES = 'PK_Codes';
export const STATISTIK = 'PK_Statistik';
export const KONTEN = 'PK_Konten';

/** Der Ausschnitt von `@wix/data`, den diese Ablage wirklich benutzt. */
interface Abfrage {
  eq(feld: string, wert: unknown): Abfrage;
  limit(anzahl: number): Abfrage;
  descending(feld: string): Abfrage;
  find(): Promise<{ items: Record<string, unknown>[] }>;
}
interface Items {
  query(sammlung: string): Abfrage;
  insert(sammlung: string, eintrag: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(sammlung: string, eintrag: Record<string, unknown>): Promise<Record<string, unknown>>;
  get(sammlung: string, id: string): Promise<Record<string, unknown>>;
  save(sammlung: string, eintrag: Record<string, unknown>): Promise<Record<string, unknown>>;
  remove(sammlung: string, id: string): Promise<unknown>;
}
/**
 * `auth.elevate` nimmt eine **SDK-Funktion** und gibt eine Fassung
 * zurück, die mit erhöhten Rechten läuft. Nicht einen beliebigen
 * Abschluss: der erste Versuch wickelte hier eigene Pfeilfunktionen
 * ein, und die Abfrage lief dann doch ohne Rechte — die Weiterleitung
 * antwortete mit 503 statt weiterzuleiten.
 *
 *   richtig:  auth.elevate(items.query)(SAMMLUNG).eq(…).find()
 *   falsch:   auth.elevate(() => items.query(SAMMLUNG).find())()
 *
 * Steht so in der Dokumentation zu `@wix/essentials`.
 */
interface Rechte {
  elevate<T extends (...a: never[]) => unknown>(f: T): T;
}

let module: Promise<{ items: Items; auth: Rechte } | null> | null = null;

/**
 * Beide Pakete kommen erst zur Laufzeit und genau einmal. Fehlen sie —
 * etwa in einem Bau ohne Wix —, steht das einmal im Log und nicht bei
 * jedem Aufruf.
 */
export function wixModule(): Promise<{ items: Items; auth: Rechte } | null> {
  module ??= Promise.all([import('@wix/data'), import('@wix/essentials')])
    .then(([daten, kern]) => ({
      items: (daten as unknown as { items: Items }).items,
      auth: (kern as unknown as { auth: Rechte }).auth,
    }))
    .catch((fehler) => {
      console.error('[pnkt] @wix/data oder @wix/essentials nicht ladbar:', fehler);
      return null;
    });
  return module;
}

export interface Code {
  id: string;
  kuerzel: string;
  ziel: string;
  aktiv: boolean;
  geloescht: boolean;
  dynamisch: boolean;
  kontoId: string;
  name: string;
  gesperrtWegen?: string;
  erstellt?: string;
  geaendert?: string;
  scans?: number;
}

function alsCode(eintrag: Record<string, unknown>): Code {
  const text = (n: string) => (typeof eintrag[n] === 'string' ? (eintrag[n] as string) : '');
  return {
    id: text('_id'),
    kuerzel: text('kuerzel'),
    ziel: text('ziel'),
    aktiv: eintrag.aktiv === true,
    geloescht: eintrag.geloescht === true,
    dynamisch: eintrag.dynamisch === true,
    kontoId: text('kontoId'),
    name: text('name'),
    gesperrtWegen: text('gesperrtWegen') || undefined,
    erstellt: text('erstellt') || undefined,
    geaendert: text('geaendert') || undefined,
    scans: typeof eintrag.scans === 'number' ? (eintrag.scans as number) : 0,
  };
}

/**
 * Sucht ein Kürzel. Kleinschreibung, weil ein gedruckter Code je nach
 * Scanner in beiden Schreibweisen ankommt — und weil das Kürzel im
 * Bestand klein abgelegt ist.
 */
export async function codeNachKuerzel(kuerzel: string): Promise<Code | null> {
  const w = await wixModule();
  if (!w) return null;
  const abfrage = w.auth.elevate(w.items.query)(CODES);
  const treffer = await abfrage.eq('kuerzel', kuerzel.toLowerCase()).limit(1).find();
  const eintrag = treffer.items[0];
  return eintrag ? alsCode(eintrag) : null;
}

export async function codesVonKonto(kontoId: string, grenze = 200): Promise<Code[]> {
  const w = await wixModule();
  if (!w) return [];
  const abfrage = w.auth.elevate(w.items.query)(CODES);
  const treffer = await abfrage.eq('kontoId', kontoId).limit(grenze).find();
  return treffer.items.map(alsCode).filter((c) => !c.geloescht);
}

/**
 * Setzt ein neues Ziel. Der Kern des ganzen Systems: das gedruckte
 * Muster bleibt, nur die Adresse dahinter wechselt.
 */
export async function zielSetzen(id: string, ziel: string): Promise<void> {
  const w = await wixModule();
  if (!w) throw new Error('keine Ablage');
  const alt = await w.auth.elevate(w.items.get)(CODES, id);
  await w.auth.elevate(w.items.update)(CODES, { ...alt, ziel, geaendert: new Date().toISOString() });
}

/**
 * Zählt einen Scan. Ein Satz je Code und Tag, dazu grobe Klassen —
 * niemals etwas, das zu einer Person führt. Genau so liegen die
 * vorhandenen Sätze auch da.
 */
export async function zaehle(codeId: string, klassen: string[]): Promise<void> {
  const w = await wixModule();
  if (!w) return;
  const tag = new Date().toISOString().slice(0, 10);
  const id = `${codeId}_${tag}`;

  let stand: Record<string, unknown> | null = null;
  try {
    stand = await w.auth.elevate(w.items.get)(STATISTIK, id);
  } catch {
    stand = null; // den Tag gibt es noch nicht
  }

  const zaehler: Record<string, number> =
    stand && typeof stand.zaehlerJson === 'string'
      ? (JSON.parse(stand.zaehlerJson as string) as Record<string, number>)
      : {};
  zaehler.gesamt = (zaehler.gesamt ?? 0) + 1;
  for (const k of klassen) zaehler[k] = (zaehler[k] ?? 0) + 1;

  await w.auth.elevate(w.items.save)(STATISTIK, {
    ...(stand ?? {}),
    _id: id,
    codeId,
    tag,
    gesamt: zaehler.gesamt,
    zaehlerJson: JSON.stringify(zaehler),
  });
}

/**
 * Die Klassen eines Aufrufs. Grob und ohne Wiedererkennung: Gerätetyp,
 * System, Herkunft. Keine IP, kein Fingerabdruck, keine Kennung, die
 * denselben Menschen zweimal erkennt.
 */
export function klassen(kopf: Headers): string[] {
  const ua = (kopf.get('user-agent') ?? '').toLowerCase();
  const geraet = /iphone|android.*mobile|windows phone/.test(ua)
    ? 'geraet:telefon'
    : /ipad|tablet|android/.test(ua)
      ? 'geraet:tablet'
      : 'geraet:rechner';
  const system = /iphone|ipad|ios|mac os/.test(ua)
    ? 'system:apple'
    : /android/.test(ua)
      ? 'system:android'
      : /windows/.test(ua)
        ? 'system:windows'
        : 'system:sonstige';
  const verweis = kopf.get('referer');
  const quelle = verweis ? 'quelle:verweis' : 'quelle:direkt';
  return [geraet, system, quelle];
}

export async function kontoNachMail(mail: string): Promise<Record<string, unknown> | null> {
  const w = await wixModule();
  if (!w) return null;
  const abfrage = w.auth.elevate(w.items.query)(KONTEN);
  const treffer = await abfrage.eq('mail', mail.toLowerCase().trim()).limit(1).find();
  return treffer.items[0] ?? null;
}

export interface Tagesstand {
  tag: string;
  gesamt: number;
  /** Grobe Klassen: geraet:…, system:…, quelle:… */
  klassen: Record<string, number>;
}

export async function statistikVonCode(codeId: string, tage = 30): Promise<Tagesstand[]> {
  const w = await wixModule();
  if (!w) return [];
  const abfrage = w.auth.elevate(w.items.query)(STATISTIK);
  const treffer = await abfrage.eq('codeId', codeId).descending('tag').limit(tage).find();
  return treffer.items.map((i) => {
    let klassen: Record<string, number> = {};
    if (typeof i.zaehlerJson === 'string') {
      try {
        klassen = JSON.parse(i.zaehlerJson) as Record<string, number>;
      } catch {
        // Ein kaputter Satz darf die Auswertung nicht mitreissen.
        klassen = {};
      }
    }
    return {
      tag: typeof i.tag === 'string' ? i.tag : '',
      gesamt: typeof i.gesamt === 'number' ? i.gesamt : 0,
      klassen,
    };
  });
}

// ─── Anlegen ──────────────────────────────────────────────────────────

/**
 * Wege, die es auf dieser Seite schon gibt. Ein Kürzel darf keinen
 * davon verdecken: /r/… liegt zwar in einem eigenen Ast, aber die
 * kurze Form pnkt.me/tisch12 soll später ohne /r/ funktionieren, und
 * dann kollidiert „preise" mit der Preisseite.
 */
const VERGEBEN = new Set([
  'r', 'api', 'anmelden', 'abmelden', 'registrieren', 'zentrale', 'zahlen',
  'studio', 'serie', 'system', 'preise', 'impressum', 'datenschutz',
  'vorlagen', 'strecken', 'werkstatt', 'lesbarkeit', 'schnittstelle',
  'massenanlage', 'index', 'admin', 'assets', 'wasm', 'favicon',
]);

export interface Kuerzelurteil {
  ok: boolean;
  grund?: string;
  /** Das bereinigte Kürzel — klein, ohne Rand. */
  wert: string;
}

/**
 * Prüft die Form eines Kürzels, ohne die Ablage zu fragen. Getrennt
 * gehalten, damit dieselbe Regel im Browser und auf dem Server gilt und
 * ein Tippfehler nicht erst nach einer Abfrage auffällt.
 */
export function kuerzelPruefen(roh: string): Kuerzelurteil {
  const wert = roh.trim().toLowerCase();
  if (!wert) return { ok: false, wert, grund: 'Ohne Kürzel geht es nicht.' };
  // Zuerst die eigenen Wege: „r" ist auch schon wegen der Länge
  // unzulässig, aber der Grund, den man liest, soll der wahre sein.
  if (VERGEBEN.has(wert)) return { ok: false, wert, grund: `„${wert}" ist für die Seite selbst reserviert.` };
  if (wert.length < 2) return { ok: false, wert, grund: 'Mindestens zwei Zeichen.' };
  if (wert.length > 32) return { ok: false, wert, grund: 'Höchstens 32 Zeichen.' };
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(wert))
    return {
      ok: false,
      wert,
      grund: 'Erlaubt sind Kleinbuchstaben, Ziffern und Bindestriche; am Anfang und Ende kein Bindestrich.',
    };
  if (wert.includes('--')) return { ok: false, wert, grund: 'Zwei Bindestriche hintereinander sind zu leicht zu übersehen.' };
  return { ok: true, wert };
}

/** Ein Vorschlag, wenn niemand ein Kürzel angeben will. */
export function kuerzelVorschlag(): string {
  // Kein l, kein 1, kein o, kein 0: das Kürzel wird abgetippt, wenn die
  // Kamera streikt, und diese vier verwechselt jeder.
  const zeichen = 'abcdefghijkmnpqrstuvwxyz23456789';
  const zufall = crypto.getRandomValues(new Uint8Array(7));
  return [...zufall].map((b) => zeichen[b % zeichen.length]).join('');
}

/**
 * Legt einen dynamischen Code an.
 *
 * Zur Eindeutigkeit: Wix-Daten kennt keine Sperre auf einer Spalte, ein
 * „vorher nachsehen" allein ist also ein Rennen. Deshalb wird nach dem
 * Schreiben noch einmal nachgesehen, und wer nicht der Älteste auf dem
 * Kürzel ist, räumt seinen eigenen Satz wieder weg. Das ist nicht
 * elegant, aber es ist ehrlich: zwei gedruckte Aufsteller mit demselben
 * Kürzel wären der schlimmere Ausgang.
 */
export async function codeAnlegen(werte: {
  kontoId: string;
  kuerzel: string;
  ziel: string;
  name: string;
}): Promise<Code> {
  const w = await wixModule();
  if (!w) throw new Error('keine Ablage');

  const kuerzel = werte.kuerzel.toLowerCase();
  const belegt = await codeNachKuerzel(kuerzel);
  if (belegt) throw new Error('kuerzel-vergeben');

  const jetzt = new Date().toISOString();
  const angelegt = await w.auth.elevate(w.items.insert)(CODES, {
    kuerzel,
    ziel: werte.ziel,
    name: werte.name,
    kontoId: werte.kontoId,
    dynamisch: true,
    aktiv: true,
    geloescht: false,
    typ: 'url',
    erstellt: jetzt,
    geaendert: jetzt,
    scans: 0,
  });

  const meineId = String(angelegt._id);
  const abfrage = w.auth.elevate(w.items.query)(CODES);
  const alle = (await abfrage.eq('kuerzel', kuerzel).limit(5).find()).items
    .map(alsCode)
    .filter((c) => !c.geloescht);
  if (alle.length > 1) {
    // Der älteste Satz gewinnt; bei gleicher Zeit die kleinere Kennung.
    const erster = alle.slice().sort((a, b) =>
      (a.erstellt ?? '').localeCompare(b.erstellt ?? '') || a.id.localeCompare(b.id),
    )[0];
    if (erster.id !== meineId) {
      await w.auth.elevate(w.items.remove)(CODES, meineId).catch(() => {});
      throw new Error('kuerzel-vergeben');
    }
  }

  return alsCode(angelegt);
}

/**
 * Legt einen Code still. Gelöscht wird nichts: das Kürzel bleibt
 * dauerhaft vergeben, damit ein alter Aufsteller nie plötzlich auf ein
 * fremdes Ziel zeigt. Die Weiterleitung antwortet danach mit 410.
 */
export async function codeStilllegen(id: string, grund: string): Promise<void> {
  const w = await wixModule();
  if (!w) throw new Error('keine Ablage');
  const alt = await w.auth.elevate(w.items.get)(CODES, id);
  await w.auth.elevate(w.items.update)(CODES, {
    ...alt,
    aktiv: false,
    gesperrtWegen: grund,
    geaendert: new Date().toISOString(),
  });
}

/** Nimmt einen stillgelegten Code wieder in Betrieb. */
export async function codeWiederAufnehmen(id: string): Promise<void> {
  const w = await wixModule();
  if (!w) throw new Error('keine Ablage');
  const alt = await w.auth.elevate(w.items.get)(CODES, id);
  await w.auth.elevate(w.items.update)(CODES, {
    ...alt,
    aktiv: true,
    gesperrtWegen: '',
    geaendert: new Date().toISOString(),
  });
}

export async function nameSetzen(id: string, name: string): Promise<void> {
  const w = await wixModule();
  if (!w) throw new Error('keine Ablage');
  const alt = await w.auth.elevate(w.items.get)(CODES, id);
  await w.auth.elevate(w.items.update)(CODES, { ...alt, name, geaendert: new Date().toISOString() });
}

/**
 * Legt ein Konto an. Der Aufrufer hat das Passwort bereits gestreut —
 * diese Datei sieht Klartext nie.
 */
export async function kontoAnlegen(werte: {
  mail: string;
  pwHash: string;
  sitzungsSalz: string;
  name: string;
}): Promise<{ id: string }> {
  const w = await wixModule();
  if (!w) throw new Error('keine Ablage');
  const mail = werte.mail.toLowerCase().trim();
  if (await kontoNachMail(mail)) throw new Error('mail-vergeben');

  const angelegt = await w.auth.elevate(w.items.insert)(KONTEN, {
    mail,
    pwHash: werte.pwHash,
    sitzungsSalz: werte.sitzungsSalz,
    name: werte.name,
    plan: 'einfuehrung',
    erstellt: new Date().toISOString(),
    letzteAnmeldung: '',
    fehlversuche: 0,
    gesperrtBis: '',
  });
  return { id: String(angelegt._id) };
}
