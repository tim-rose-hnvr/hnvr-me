/**
 * Prüfung und Normalisierung eines Entwurfs beim Laden.
 *
 * Bewusst ohne Fremdbibliothek: `editor-core` wird in fremde Seiten eingebettet
 * und soll keine Abhängigkeit mitschleppen. Der Preis sind rund 300 Zeilen, der
 * Gewinn sind Fehlermeldungen in der Sprache der Fachdomäne.
 *
 * Alles, was hier durchkommt, ist ein gültiger `Entwurf`. Nichts anderes darf in
 * den Kommando-Stack.
 */

import {
  SCHEMA_VERSION,
  type Anschnitt,
  type AssetReferenz,
  type Autoanpassung,
  type Bearbeitbar,
  type Bildpassform,
  type Entwurf,
  type Entwurfselement,
  type Farbe,
  type Formart,
  type Kontur,
  type Masse,
  type Platzhalter,
  type Seite,
  type Textausrichtung,
  type Zuschnitt,
} from './entwurf.js';

export interface Verstoss {
  pfad: string;
  meldung: string;
}

export class SchemaFehler extends Error {
  readonly verstoesse: readonly Verstoss[];

  constructor(verstoesse: readonly Verstoss[]) {
    const liste = verstoesse.map((v) => `  ${v.pfad}: ${v.meldung}`).join('\n');
    super(`Entwurf ist ungültig (${verstoesse.length} Verstöße):\n${liste}`);
    this.name = 'SchemaFehler';
    this.verstoesse = verstoesse;
  }
}

const FARBMUSTER = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
const BEARBEITBAR: readonly Bearbeitbar[] = ['text', 'bild', 'farbe', 'position'];
const AUSRICHTUNGEN: readonly Textausrichtung[] = ['links', 'mitte', 'rechts', 'blocksatz'];
const AUTOANPASSUNGEN: readonly Autoanpassung[] = ['keine', 'schrumpfen', 'hoehe'];
const PASSFORMEN: readonly Bildpassform[] = ['fuellen', 'einpassen', 'strecken'];
const FORMARTEN: readonly Formart[] = ['rechteck', 'ellipse', 'linie', 'pfad'];

/** Sammelt alle Verstöße, statt beim ersten abzubrechen. */
class Pruefer {
  readonly verstoesse: Verstoss[] = [];

  melde(pfad: string, meldung: string): void {
    this.verstoesse.push({ pfad, meldung });
  }

  objekt(wert: unknown, pfad: string): Record<string, unknown> {
    if (typeof wert !== 'object' || wert === null || Array.isArray(wert)) {
      this.melde(pfad, 'muss ein Objekt sein');
      return {};
    }
    return wert as Record<string, unknown>;
  }

  liste(wert: unknown, pfad: string): unknown[] {
    if (!Array.isArray(wert)) {
      this.melde(pfad, 'muss eine Liste sein');
      return [];
    }
    return wert;
  }

  zahl(
    wert: unknown,
    pfad: string,
    grenzen: { min?: number; max?: number; ganz?: boolean } = {},
  ): number {
    if (typeof wert !== 'number' || !Number.isFinite(wert)) {
      this.melde(pfad, 'muss eine endliche Zahl sein');
      return 0;
    }
    if (grenzen.ganz === true && !Number.isInteger(wert)) {
      this.melde(pfad, 'muss eine ganze Zahl sein');
    }
    if (grenzen.min !== undefined && wert < grenzen.min) {
      this.melde(pfad, `muss mindestens ${grenzen.min} sein, war ${wert}`);
      return grenzen.min;
    }
    if (grenzen.max !== undefined && wert > grenzen.max) {
      this.melde(pfad, `darf höchstens ${grenzen.max} sein, war ${wert}`);
      return grenzen.max;
    }
    return wert;
  }

  text(wert: unknown, pfad: string, regeln: { nichtLeer?: boolean } = {}): string {
    if (typeof wert !== 'string') {
      this.melde(pfad, 'muss eine Zeichenkette sein');
      return '';
    }
    if (regeln.nichtLeer === true && wert.trim() === '') {
      this.melde(pfad, 'darf nicht leer sein');
    }
    return wert;
  }

  wahrheitswert(wert: unknown, pfad: string): boolean {
    if (typeof wert !== 'boolean') {
      this.melde(pfad, 'muss true oder false sein');
      return false;
    }
    return wert;
  }

  farbe(wert: unknown, pfad: string): Farbe {
    if (typeof wert !== 'string') {
      this.melde(pfad, 'muss eine Farbe als Zeichenkette sein');
      return '#000000';
    }
    const normalisiert = wert.toLowerCase();
    if (!FARBMUSTER.test(normalisiert)) {
      this.melde(pfad, `muss #RRGGBB oder #RRGGBBAA sein, war "${wert}"`);
      return '#000000';
    }
    return normalisiert;
  }

  farbeOderNull(wert: unknown, pfad: string): Farbe | null {
    return wert === null ? null : this.farbe(wert, pfad);
  }

  auswahl<T extends string>(wert: unknown, pfad: string, erlaubt: readonly T[]): T {
    if (typeof wert !== 'string' || !erlaubt.includes(wert as T)) {
      this.melde(pfad, `muss einer von [${erlaubt.join(', ')}] sein, war ${JSON.stringify(wert)}`);
      return erlaubt[0] as T;
    }
    return wert as T;
  }

  zeitpunkt(wert: unknown, pfad: string): string {
    const text = this.text(wert, pfad);
    if (text !== '' && Number.isNaN(Date.parse(text))) {
      this.melde(pfad, `muss ein ISO-8601-Zeitpunkt sein, war "${text}"`);
    }
    return text;
  }
}

function pruefeMasse(p: Pruefer, roh: unknown, pfad: string): Masse {
  const o = p.objekt(roh, pfad);
  return {
    breite: p.zahl(o['breite'], `${pfad}.breite`, { min: 1 }),
    hoehe: p.zahl(o['hoehe'], `${pfad}.hoehe`, { min: 1 }),
    dpi: p.zahl(o['dpi'], `${pfad}.dpi`, { min: 1 }),
  };
}

function pruefeAnschnitt(p: Pruefer, roh: unknown, pfad: string): Anschnitt {
  const o = p.objekt(roh, pfad);
  return {
    oben: p.zahl(o['oben'], `${pfad}.oben`, { min: 0 }),
    rechts: p.zahl(o['rechts'], `${pfad}.rechts`, { min: 0 }),
    unten: p.zahl(o['unten'], `${pfad}.unten`, { min: 0 }),
    links: p.zahl(o['links'], `${pfad}.links`, { min: 0 }),
  };
}

function pruefePlatzhalter(p: Pruefer, roh: unknown, pfad: string): Platzhalter | null {
  if (roh === null) return null;
  const o = p.objekt(roh, pfad);
  const rohBearbeitbar = p.liste(o['bearbeitbar'], `${pfad}.bearbeitbar`);
  const bearbeitbar = rohBearbeitbar.map((eintrag, i) =>
    p.auswahl(eintrag, `${pfad}.bearbeitbar[${i}]`, BEARBEITBAR),
  );
  if (bearbeitbar.length === 0) {
    p.melde(`${pfad}.bearbeitbar`, 'ein Platzhalter ohne bearbeitbare Eigenschaft ist sinnlos');
  }
  const beschriftung = o['beschriftung'];
  return {
    schluessel: p.text(o['schluessel'], `${pfad}.schluessel`, { nichtLeer: true }),
    bearbeitbar: [...new Set(bearbeitbar)],
    beschriftung: beschriftung === null ? null : p.text(beschriftung, `${pfad}.beschriftung`),
  };
}

function pruefeAsset(p: Pruefer, roh: unknown, pfad: string): AssetReferenz {
  const o = p.objekt(roh, pfad);
  return {
    id: p.text(o['id'], `${pfad}.id`, { nichtLeer: true }),
    url: p.text(o['url'], `${pfad}.url`),
    breite: p.zahl(o['breite'], `${pfad}.breite`, { min: 1 }),
    hoehe: p.zahl(o['hoehe'], `${pfad}.hoehe`, { min: 1 }),
    mimeTyp: p.text(o['mimeTyp'], `${pfad}.mimeTyp`, { nichtLeer: true }),
  };
}

function pruefeZuschnitt(p: Pruefer, roh: unknown, pfad: string): Zuschnitt {
  const o = p.objekt(roh, pfad);
  const zuschnitt = {
    x: p.zahl(o['x'], `${pfad}.x`, { min: 0, max: 1 }),
    y: p.zahl(o['y'], `${pfad}.y`, { min: 0, max: 1 }),
    breite: p.zahl(o['breite'], `${pfad}.breite`, { min: 0, max: 1 }),
    hoehe: p.zahl(o['hoehe'], `${pfad}.hoehe`, { min: 0, max: 1 }),
  };
  if (zuschnitt.x + zuschnitt.breite > 1.000001) {
    p.melde(`${pfad}.breite`, 'Zuschnitt ragt rechts über die Quelldatei hinaus');
  }
  if (zuschnitt.y + zuschnitt.hoehe > 1.000001) {
    p.melde(`${pfad}.hoehe`, 'Zuschnitt ragt unten über die Quelldatei hinaus');
  }
  return zuschnitt;
}

function pruefeKontur(p: Pruefer, roh: unknown, pfad: string): Kontur | null {
  if (roh === null) return null;
  const o = p.objekt(roh, pfad);
  return {
    farbe: p.farbe(o['farbe'], `${pfad}.farbe`),
    staerke: p.zahl(o['staerke'], `${pfad}.staerke`, { min: 0 }),
  };
}

function pruefeElement(p: Pruefer, roh: unknown, pfad: string): Entwurfselement {
  const o = p.objekt(roh, pfad);
  const basis = {
    id: p.text(o['id'], `${pfad}.id`, { nichtLeer: true }),
    name: p.text(o['name'], `${pfad}.name`),
    x: p.zahl(o['x'], `${pfad}.x`),
    y: p.zahl(o['y'], `${pfad}.y`),
    breite: p.zahl(o['breite'], `${pfad}.breite`, { min: 0 }),
    hoehe: p.zahl(o['hoehe'], `${pfad}.hoehe`, { min: 0 }),
    drehung: p.zahl(o['drehung'], `${pfad}.drehung`),
    deckkraft: p.zahl(o['deckkraft'], `${pfad}.deckkraft`, { min: 0, max: 1 }),
    sichtbar: p.wahrheitswert(o['sichtbar'], `${pfad}.sichtbar`),
    gesperrt: p.wahrheitswert(o['gesperrt'], `${pfad}.gesperrt`),
    platzhalter: pruefePlatzhalter(p, o['platzhalter'] ?? null, `${pfad}.platzhalter`),
  };

  const typ = o['typ'];
  switch (typ) {
    case 'text':
      return {
        ...basis,
        typ: 'text',
        inhalt: p.text(o['inhalt'], `${pfad}.inhalt`),
        schriftFamilie: p.text(o['schriftFamilie'], `${pfad}.schriftFamilie`, { nichtLeer: true }),
        schriftGroesse: p.zahl(o['schriftGroesse'], `${pfad}.schriftGroesse`, { min: 0.1 }),
        schriftStaerke: p.zahl(o['schriftStaerke'], `${pfad}.schriftStaerke`, { min: 100, max: 900 }),
        kursiv: p.wahrheitswert(o['kursiv'], `${pfad}.kursiv`),
        farbe: p.farbe(o['farbe'], `${pfad}.farbe`),
        ausrichtung: p.auswahl(o['ausrichtung'], `${pfad}.ausrichtung`, AUSRICHTUNGEN),
        zeilenabstand: p.zahl(o['zeilenabstand'], `${pfad}.zeilenabstand`, { min: 0.1 }),
        laufweite: p.zahl(o['laufweite'], `${pfad}.laufweite`),
        autoAnpassung: p.auswahl(o['autoAnpassung'], `${pfad}.autoAnpassung`, AUTOANPASSUNGEN),
      };

    case 'bild':
      return {
        ...basis,
        typ: 'bild',
        quelle: pruefeAsset(p, o['quelle'], `${pfad}.quelle`),
        zuschnitt: pruefeZuschnitt(p, o['zuschnitt'], `${pfad}.zuschnitt`),
        passform: p.auswahl(o['passform'], `${pfad}.passform`, PASSFORMEN),
      };

    case 'form': {
      const form = p.auswahl(o['form'], `${pfad}.form`, FORMARTEN);
      const pfaddaten = o['pfad'] ?? null;
      if (form === 'pfad' && (pfaddaten === null || pfaddaten === '')) {
        p.melde(`${pfad}.pfad`, 'form "pfad" braucht SVG-Pfaddaten');
      }
      return {
        ...basis,
        typ: 'form',
        form,
        fuellung: p.farbeOderNull(o['fuellung'] ?? null, `${pfad}.fuellung`),
        kontur: pruefeKontur(p, o['kontur'] ?? null, `${pfad}.kontur`),
        eckenradius: p.zahl(o['eckenradius'], `${pfad}.eckenradius`, { min: 0 }),
        pfad: pfaddaten === null ? null : p.text(pfaddaten, `${pfad}.pfad`),
      };
    }

    case 'gruppe': {
      const rohKinder = p.liste(o['kinder'], `${pfad}.kinder`);
      return {
        ...basis,
        typ: 'gruppe',
        kinder: rohKinder.map((kind, i) => pruefeElement(p, kind, `${pfad}.kinder[${i}]`)),
      };
    }

    default:
      p.melde(`${pfad}.typ`, `unbekannter Elementtyp ${JSON.stringify(typ)}`);
      return {
        ...basis,
        typ: 'form',
        form: 'rechteck',
        fuellung: null,
        kontur: null,
        eckenradius: 0,
        pfad: null,
      };
  }
}

function pruefeSeite(p: Pruefer, roh: unknown, pfad: string): Seite {
  const o = p.objekt(roh, pfad);
  const rohElemente = p.liste(o['elemente'], `${pfad}.elemente`);
  return {
    id: p.text(o['id'], `${pfad}.id`, { nichtLeer: true }),
    name: p.text(o['name'], `${pfad}.name`),
    hintergrund: p.farbeOderNull(o['hintergrund'] ?? null, `${pfad}.hintergrund`),
    elemente: rohElemente.map((el, i) => pruefeElement(p, el, `${pfad}.elemente[${i}]`)),
  };
}

/** Sammelt alle Element-ids eines Entwurfs, auch aus Gruppen. */
export function alleElementIds(entwurf: Entwurf): string[] {
  const ids: string[] = [];
  const sammle = (elemente: readonly Entwurfselement[]): void => {
    for (const element of elemente) {
      ids.push(element.id);
      if (element.typ === 'gruppe') sammle(element.kinder);
    }
  };
  for (const seite of entwurf.seiten) sammle(seite.elemente);
  return ids;
}

/**
 * Prüft Rohdaten und gibt einen normalisierten Entwurf zurück.
 * Wirft `SchemaFehler` mit allen Verstößen auf einmal.
 */
export function pruefeEntwurf(roh: unknown): Entwurf {
  const p = new Pruefer();
  const o = p.objekt(roh, '$');

  const rohSeiten = p.liste(o['seiten'], '$.seiten');
  if (rohSeiten.length === 0) {
    p.melde('$.seiten', 'ein Entwurf braucht mindestens eine Seite');
  }

  const entwurf: Entwurf = {
    schemaVersion: p.zahl(o['schemaVersion'], '$.schemaVersion', { min: 1, ganz: true }),
    id: p.text(o['id'], '$.id', { nichtLeer: true }),
    organisationId: p.text(o['organisationId'], '$.organisationId', { nichtLeer: true }),
    name: p.text(o['name'], '$.name'),
    masse: pruefeMasse(p, o['masse'], '$.masse'),
    anschnitt: pruefeAnschnitt(p, o['anschnitt'], '$.anschnitt'),
    sicherheitsabstand: p.zahl(o['sicherheitsabstand'], '$.sicherheitsabstand', { min: 0 }),
    seiten: rohSeiten.map((seite, i) => pruefeSeite(p, seite, `$.seiten[${i}]`)),
    markenkitId: o['markenkitId'] === null || o['markenkitId'] === undefined
      ? null
      : p.text(o['markenkitId'], '$.markenkitId', { nichtLeer: true }),
    vorlageId: o['vorlageId'] === null || o['vorlageId'] === undefined
      ? null
      : p.text(o['vorlageId'], '$.vorlageId', { nichtLeer: true }),
    erstelltAm: p.zeitpunkt(o['erstelltAm'], '$.erstelltAm'),
    geaendertAm: p.zeitpunkt(o['geaendertAm'], '$.geaendertAm'),
  };

  if (entwurf.schemaVersion > SCHEMA_VERSION) {
    p.melde(
      '$.schemaVersion',
      `Entwurf stammt aus einer neueren Fassung (${entwurf.schemaVersion} > ${SCHEMA_VERSION})`,
    );
  }

  // Doppelte ids brechen jede Kommando-Adressierung, deshalb hart geprüft.
  const ids = alleElementIds(entwurf);
  const gesehen = new Set<string>();
  for (const id of ids) {
    if (gesehen.has(id)) p.melde('$', `Element-id "${id}" kommt mehrfach vor`);
    gesehen.add(id);
  }

  if (p.verstoesse.length > 0) throw new SchemaFehler(p.verstoesse);
  return entwurf;
}

/**
 * Hebt Rohdaten auf die aktuelle Schemafassung. Wird vor `pruefeEntwurf`
 * aufgerufen, arbeitet also auf ungeprüften Daten und muss defensiv sein.
 *
 * Noch gibt es nur Fassung 1, das Gerüst steht aber von Anfang an: ein
 * Dokumentformat ohne Migrationspfad ist ein Datenverlust auf Zeit.
 */
export function migriere(roh: unknown): unknown {
  if (typeof roh !== 'object' || roh === null) return roh;
  let stand = roh as Record<string, unknown>;

  const version = typeof stand['schemaVersion'] === 'number' ? stand['schemaVersion'] : 0;
  if (version === 0) {
    // Fassung 0 gab es nie im Umlauf; wir behandeln fehlende Version als Fassung 1.
    stand = { ...stand, schemaVersion: 1 };
  }

  return stand;
}

/** Der übliche Ladeweg: migrieren, dann prüfen. */
export function ladeEntwurf(roh: unknown): Entwurf {
  return pruefeEntwurf(migriere(roh));
}
