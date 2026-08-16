/**
 * Das Profil — was auf einer Get-in-Touch-Seite steht.
 *
 * Bewusste Abweichung vom Vorbild: eine Linkliste hat keine Rangfolge, diese
 * Seite hat genau eine Hauptaktion. Welche das ist, hängt an der Erreichbarkeit
 * (`hauptaktion.offen` / `hauptaktion.zu`) und nicht an der Reihenfolge der
 * Liste. Alles andere ordnet sich unter.
 *
 * Daten kommen später aus einer Wix-Collection und damit von außen. Deshalb
 * wird hier geprüft statt vertraut: `lieseProfil` nimmt Unbekanntes entgegen
 * und gibt entweder ein gültiges Profil oder eine Liste von Klartextfehlern
 * zurück. Kein `as`, kein stillschweigendes Auffüllen von Pflichtfeldern.
 */

import type { Erreichbarkeitsplan, Fenster, Wochentag } from './erreichbarkeit.ts';
import { zuMinute } from './zeit.ts';
import { GESTALTUNG_VORGABE, lieseGestaltung, type Gestaltung } from './gestaltung.ts';

export const KANALARTEN = [
  'link',
  'telefon',
  'mobil',
  'whatsapp',
  'mail',
  'termin',
  'route',
  'shop',
  'datei',
  'video',
] as const;
export type KanalArt = (typeof KANALARTEN)[number];

export const NETZWERKE = [
  'instagram',
  'linkedin',
  'facebook',
  'youtube',
  'tiktok',
  'x',
  'xing',
  'threads',
  'pinterest',
  'spotify',
  'telegram',
  'github',
  'website',
] as const;
export type Netzwerk = (typeof NETZWERKE)[number];

export interface Aktionsblock {
  id: string;
  art: 'aktion';
  kanal: KanalArt;
  beschriftung: string;
  unterzeile?: string;
  /** Rohwert: URL, Telefonnummer, Adresse — je nach Kanal. Siehe `ziele.ts`. */
  ziel: string;
  aktiv: boolean;
  /** Optisch hervorgehoben, unabhängig von der Hauptaktion. */
  betont?: boolean;
}

export interface Textblock {
  id: string;
  art: 'ueberschrift' | 'text';
  beschriftung: string;
  aktiv: boolean;
}

export interface Trennerblock {
  id: string;
  art: 'trenner';
  aktiv: boolean;
}

export type Block = Aktionsblock | Textblock | Trennerblock;

export interface Kanal {
  netzwerk: Netzwerk;
  ziel: string;
}

export interface Visitenkarte {
  vorname: string;
  nachname: string;
  firma?: string;
  funktion?: string;
  telefon?: string;
  mobil?: string;
  mail?: string;
  web?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  notiz?: string;
}

export interface Kopf {
  name: string;
  rolle?: string;
  beschreibung?: string;
  /** Pfad oder Datenadresse des Profilbilds. */
  bild?: string;
  titelbild?: string;
}

export interface Profil {
  version: 1;
  slug: string;
  kopf: Kopf;
  bloecke: Block[];
  kanaele: Kanal[];
  visitenkarte?: Visitenkarte;
  erreichbarkeit?: Erreichbarkeitsplan;
  /** Verweise auf Block-IDs. Fehlt der Verweis, gilt der erste betonte Block. */
  hauptaktion?: { offen?: string; zu?: string };
  gestaltung: Gestaltung;
  rechtliches?: { impressum?: string; datenschutz?: string };
}

/* ------------------------------------------------------------------ *
 * Adressen
 * ------------------------------------------------------------------ */

/**
 * Erlaubt sind Kleinbuchstaben, Ziffern, Bindestrich und Punkt — nichts, was
 * beim Vorlesen am Telefon oder beim Abtippen von einem Flyer schiefgeht.
 * Keine Umlaute: sie überleben weder QR-Druck noch fremde Tastaturen zuverlässig.
 */
const SLUG_MUSTER = /^[a-z0-9][a-z0-9.-]{1,30}[a-z0-9]$/;

/** Adressen, die dem System selbst gehören oder zu Verwechslung einladen. */
const GESPERRTE_SLUGS = new Set([
  'app',
  'konto',
  'login',
  'logout',
  'admin',
  'api',
  'assets',
  'hilfe',
  'impressum',
  'datenschutz',
  'agb',
  'neu',
  'test',
  'www',
  't',
]);

export function pruefeSlug(slug: unknown): { ok: true; slug: string } | { ok: false; grund: string } {
  if (typeof slug !== 'string') return { ok: false, grund: 'Die Adresse fehlt.' };
  const s = slug.trim().toLowerCase();
  if (s.length < 3) return { ok: false, grund: 'Die Adresse braucht mindestens 3 Zeichen.' };
  if (s.length > 32) return { ok: false, grund: 'Die Adresse darf höchstens 32 Zeichen haben.' };
  if (!SLUG_MUSTER.test(s)) {
    return {
      ok: false,
      grund: 'Erlaubt sind Kleinbuchstaben, Ziffern, Bindestrich und Punkt — Anfang und Ende ohne Sonderzeichen.',
    };
  }
  if (s.includes('..') || s.includes('--')) {
    return { ok: false, grund: 'Zwei Sonderzeichen hintereinander sind zu leicht zu verlesen.' };
  }
  if (GESPERRTE_SLUGS.has(s)) return { ok: false, grund: `„${s}" ist für das System reserviert.` };
  return { ok: true, slug: s };
}

/* ------------------------------------------------------------------ *
 * Einlesen und Prüfen
 * ------------------------------------------------------------------ */

type Rohdaten = Record<string, unknown>;

function istObjekt(wert: unknown): wert is Rohdaten {
  return typeof wert === 'object' && wert !== null && !Array.isArray(wert);
}

function text(wert: unknown): string | undefined {
  if (typeof wert !== 'string') return undefined;
  const t = wert.trim();
  return t.length ? t : undefined;
}

export interface Lesefehler {
  /** Pfad im Datensatz, z. B. "bloecke[2].ziel". */
  stelle: string;
  meldung: string;
}

export type Leseergebnis = { ok: true; profil: Profil } | { ok: false; fehler: Lesefehler[] };

function lieseFenster(roh: unknown, stelle: string, fehler: Lesefehler[]): Fenster[] {
  if (!Array.isArray(roh)) return [];
  const heraus: Fenster[] = [];
  roh.forEach((eintrag, i) => {
    const wo = `${stelle}[${i}]`;
    if (!istObjekt(eintrag)) {
      fehler.push({ stelle: wo, meldung: 'Zeitfenster muss ein Objekt sein.' });
      return;
    }
    const tag = Number(eintrag.tag);
    if (!Number.isInteger(tag) || tag < 1 || tag > 7) {
      fehler.push({ stelle: `${wo}.tag`, meldung: 'Wochentag muss 1 (Montag) bis 7 (Sonntag) sein.' });
      return;
    }
    const von = text(eintrag.von);
    const bis = text(eintrag.bis);
    if (!von || zuMinute(von) === null) {
      fehler.push({ stelle: `${wo}.von`, meldung: 'Uhrzeit im Format HH:MM erwartet.' });
      return;
    }
    if (!bis || zuMinute(bis) === null) {
      fehler.push({ stelle: `${wo}.bis`, meldung: 'Uhrzeit im Format HH:MM erwartet.' });
      return;
    }
    heraus.push({ tag: tag as Wochentag, von, bis });
  });
  return heraus;
}

function lieseErreichbarkeit(roh: unknown, fehler: Lesefehler[]): Erreichbarkeitsplan | undefined {
  if (roh === undefined || roh === null) return undefined;
  if (!istObjekt(roh)) {
    fehler.push({ stelle: 'erreichbarkeit', meldung: 'Erwartet wird ein Objekt oder gar nichts.' });
    return undefined;
  }

  const zeitzone = text(roh.zeitzone);
  if (!zeitzone) {
    fehler.push({ stelle: 'erreichbarkeit.zeitzone', meldung: 'Zeitzone fehlt, z. B. "Europe/Berlin".' });
    return undefined;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zeitzone });
  } catch {
    fehler.push({ stelle: 'erreichbarkeit.zeitzone', meldung: `Unbekannte Zeitzone „${zeitzone}".` });
    return undefined;
  }

  const fenster = lieseFenster(roh.fenster, 'erreichbarkeit.fenster', fehler);
  if (!fenster.length) {
    fehler.push({
      stelle: 'erreichbarkeit.fenster',
      meldung: 'Ohne mindestens ein Zeitfenster wäre die Statuszeile eine Behauptung. Dann lieber ganz weglassen.',
    });
    return undefined;
  }

  const ausnahmen = Array.isArray(roh.ausnahmen)
    ? roh.ausnahmen.flatMap((a, i) => {
        if (!istObjekt(a)) return [];
        const datum = text(a.datum);
        if (!datum || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
          fehler.push({ stelle: `erreichbarkeit.ausnahmen[${i}].datum`, meldung: 'Datum im Format JJJJ-MM-TT erwartet.' });
          return [];
        }
        const zeiten = Array.isArray(a.zeiten)
          ? a.zeiten.flatMap((z) => {
              if (!istObjekt(z)) return [];
              const von = text(z.von);
              const bis = text(z.bis);
              if (!von || !bis || zuMinute(von) === null || zuMinute(bis) === null) return [];
              return [{ von, bis }];
            })
          : undefined;
        return [{ datum, grund: text(a.grund), zeiten }];
      })
    : [];

  return { zeitzone, fenster, ausnahmen, zusage: text(roh.zusage) };
}

function lieseBloecke(roh: unknown, fehler: Lesefehler[]): Block[] {
  if (!Array.isArray(roh)) {
    if (roh !== undefined) fehler.push({ stelle: 'bloecke', meldung: 'Erwartet wird eine Liste.' });
    return [];
  }

  const bloecke: Block[] = [];
  const vergebeneIds = new Set<string>();

  roh.forEach((eintrag, i) => {
    const wo = `bloecke[${i}]`;
    if (!istObjekt(eintrag)) {
      fehler.push({ stelle: wo, meldung: 'Block muss ein Objekt sein.' });
      return;
    }

    const id = text(eintrag.id);
    if (!id) {
      fehler.push({ stelle: `${wo}.id`, meldung: 'Jeder Block braucht eine eigene Kennung.' });
      return;
    }
    if (vergebeneIds.has(id)) {
      fehler.push({ stelle: `${wo}.id`, meldung: `Die Kennung „${id}" ist doppelt vergeben.` });
      return;
    }
    vergebeneIds.add(id);

    const aktiv = eintrag.aktiv !== false;
    const art = text(eintrag.art) ?? 'aktion';

    if (art === 'trenner') {
      bloecke.push({ id, art: 'trenner', aktiv });
      return;
    }

    if (art === 'ueberschrift' || art === 'text') {
      const beschriftung = text(eintrag.beschriftung);
      if (!beschriftung) {
        fehler.push({ stelle: `${wo}.beschriftung`, meldung: 'Ohne Text hat der Block nichts zu sagen.' });
        return;
      }
      bloecke.push({ id, art, beschriftung, aktiv });
      return;
    }

    if (art !== 'aktion') {
      fehler.push({ stelle: `${wo}.art`, meldung: `Unbekannte Blockart „${art}".` });
      return;
    }

    const kanal = text(eintrag.kanal) as KanalArt | undefined;
    if (!kanal || !KANALARTEN.includes(kanal)) {
      fehler.push({
        stelle: `${wo}.kanal`,
        meldung: `Unbekannter Kanal „${kanal ?? ''}". Erlaubt: ${KANALARTEN.join(', ')}.`,
      });
      return;
    }
    const beschriftung = text(eintrag.beschriftung);
    if (!beschriftung) {
      fehler.push({ stelle: `${wo}.beschriftung`, meldung: 'Eine Schaltfläche ohne Beschriftung ist nicht bedienbar.' });
      return;
    }
    const ziel = text(eintrag.ziel);
    if (!ziel) {
      fehler.push({ stelle: `${wo}.ziel`, meldung: 'Ohne Ziel führt die Schaltfläche ins Leere.' });
      return;
    }

    bloecke.push({
      id,
      art: 'aktion',
      kanal,
      beschriftung,
      unterzeile: text(eintrag.unterzeile),
      ziel,
      aktiv,
      betont: eintrag.betont === true,
    });
  });

  return bloecke;
}

function lieseKanaele(roh: unknown, fehler: Lesefehler[]): Kanal[] {
  if (!Array.isArray(roh)) return [];
  return roh.flatMap((eintrag, i) => {
    if (!istObjekt(eintrag)) return [];
    const netzwerk = text(eintrag.netzwerk) as Netzwerk | undefined;
    const ziel = text(eintrag.ziel);
    if (!netzwerk || !NETZWERKE.includes(netzwerk)) {
      fehler.push({ stelle: `kanaele[${i}].netzwerk`, meldung: `Unbekanntes Netzwerk „${netzwerk ?? ''}".` });
      return [];
    }
    if (!ziel) {
      fehler.push({ stelle: `kanaele[${i}].ziel`, meldung: 'Ohne Adresse kein Kanal.' });
      return [];
    }
    return [{ netzwerk, ziel }];
  });
}

function lieseVisitenkarte(roh: unknown, fehler: Lesefehler[]): Visitenkarte | undefined {
  if (roh === undefined || roh === null) return undefined;
  if (!istObjekt(roh)) {
    fehler.push({ stelle: 'visitenkarte', meldung: 'Erwartet wird ein Objekt oder gar nichts.' });
    return undefined;
  }
  const vorname = text(roh.vorname);
  const nachname = text(roh.nachname);
  if (!vorname && !nachname) {
    fehler.push({ stelle: 'visitenkarte', meldung: 'Eine Visitenkarte ohne Namen speichert niemand.' });
    return undefined;
  }
  return {
    vorname: vorname ?? '',
    nachname: nachname ?? '',
    firma: text(roh.firma),
    funktion: text(roh.funktion),
    telefon: text(roh.telefon),
    mobil: text(roh.mobil),
    mail: text(roh.mail),
    web: text(roh.web),
    strasse: text(roh.strasse),
    plz: text(roh.plz),
    ort: text(roh.ort),
    land: text(roh.land),
    notiz: text(roh.notiz),
  };
}

/**
 * Liest einen unbekannten Datensatz als Profil.
 *
 * Fehler werden gesammelt, nicht beim ersten geworfen: wer ein Profil pflegt,
 * will alle Beanstandungen auf einmal sehen und nicht eine nach der anderen.
 */
export function lieseProfil(roh: unknown): Leseergebnis {
  const fehler: Lesefehler[] = [];

  if (!istObjekt(roh)) {
    return { ok: false, fehler: [{ stelle: '', meldung: 'Erwartet wird ein Objekt.' }] };
  }

  const slugPruefung = pruefeSlug(roh.slug);
  if (!slugPruefung.ok) fehler.push({ stelle: 'slug', meldung: slugPruefung.grund });

  const kopfRoh = istObjekt(roh.kopf) ? roh.kopf : {};
  const name = text(kopfRoh.name);
  if (!name) fehler.push({ stelle: 'kopf.name', meldung: 'Ein Name muss auf die Seite.' });

  const bloecke = lieseBloecke(roh.bloecke, fehler);
  const kanaele = lieseKanaele(roh.kanaele, fehler);
  const visitenkarte = lieseVisitenkarte(roh.visitenkarte, fehler);
  const erreichbarkeit = lieseErreichbarkeit(roh.erreichbarkeit, fehler);

  const gestaltungErgebnis = lieseGestaltung(roh.gestaltung);
  gestaltungErgebnis.fehler.forEach((m) => fehler.push({ stelle: 'gestaltung', meldung: m }));

  const hauptaktionRoh = istObjekt(roh.hauptaktion) ? roh.hauptaktion : {};
  const hauptaktion = { offen: text(hauptaktionRoh.offen), zu: text(hauptaktionRoh.zu) };
  const aktionsIds = new Set(bloecke.filter((b) => b.art === 'aktion').map((b) => b.id));
  for (const [rolle, id] of Object.entries(hauptaktion)) {
    if (id && !aktionsIds.has(id)) {
      fehler.push({ stelle: `hauptaktion.${rolle}`, meldung: `Kein Aktionsblock mit der Kennung „${id}".` });
    }
  }
  if (hauptaktion.zu && !erreichbarkeit) {
    fehler.push({
      stelle: 'hauptaktion.zu',
      meldung: 'Eine Aktion für außerhalb der Zeiten setzt Öffnungszeiten voraus.',
    });
  }

  const rechtlichesRoh = istObjekt(roh.rechtliches) ? roh.rechtliches : {};

  if (fehler.length) return { ok: false, fehler };

  return {
    ok: true,
    profil: {
      version: 1,
      slug: (slugPruefung as { ok: true; slug: string }).slug,
      kopf: {
        name: name!,
        rolle: text(kopfRoh.rolle),
        beschreibung: text(kopfRoh.beschreibung),
        bild: text(kopfRoh.bild),
        titelbild: text(kopfRoh.titelbild),
      },
      bloecke,
      kanaele,
      visitenkarte,
      erreichbarkeit,
      hauptaktion: hauptaktion.offen || hauptaktion.zu ? hauptaktion : undefined,
      gestaltung: gestaltungErgebnis.gestaltung ?? GESTALTUNG_VORGABE,
      rechtliches: {
        impressum: text(rechtlichesRoh.impressum),
        datenschutz: text(rechtlichesRoh.datenschutz),
      },
    },
  };
}

/**
 * Der Block, der gerade oben stehen soll.
 *
 * Ohne ausdrücklichen Verweis gewinnt der erste betonte Aktionsblock, sonst
 * der erste aktive überhaupt. Es gibt also immer höchstens eine Hauptaktion und
 * nie zwei, die um die Aufmerksamkeit streiten.
 */
export function hauptaktionFuer(profil: Profil, offen: boolean): Aktionsblock | undefined {
  const aktive = profil.bloecke.filter((b): b is Aktionsblock => b.art === 'aktion' && b.aktiv);
  const gewuenscht = offen ? profil.hauptaktion?.offen : profil.hauptaktion?.zu;
  return aktive.find((b) => b.id === gewuenscht) ?? aktive.find((b) => b.betont) ?? aktive[0];
}
