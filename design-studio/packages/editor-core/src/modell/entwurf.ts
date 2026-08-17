/**
 * Das Dokumentformat. Dieses Modul ist die einzige Quelle der Wahrheit über die
 * Struktur eines Entwurfs — kein Render-SDK darf hier hineinreichen.
 *
 * Einheiten: alle Koordinaten und Maße sind Pixel bei der `dpi` des Entwurfs.
 * Ursprung ist die linke obere Ecke des Endformats. Elemente, die in den
 * Anschnitt ragen, haben negative Koordinaten. Siehe `masse.ts`.
 *
 * Optionale Felder gibt es bewusst nicht — abwesende Werte sind `null`. Das hält
 * die JSON-Serialisierung verlustfrei und erspart die Unterscheidung zwischen
 * "nicht gesetzt" und "auf undefined gesetzt".
 */

/** Erhöhen, sobald ein Feld die Bedeutung ändert oder wegfällt. Siehe `schema.ts`. */
export const SCHEMA_VERSION = 1;

/** `#RRGGBB` oder `#RRGGBBAA`, immer klein geschrieben. */
export type Farbe = string;

export interface Masse {
  /** Endformatbreite in px bei `dpi`. */
  breite: number;
  /** Endformathöhe in px bei `dpi`. */
  hoehe: number;
  /** 72 für Bildschirm (1 px = 1 pt), 300 für Druck. */
  dpi: number;
}

/** Anschnitt je Kante in px bei `dpi`. Alles 0 heißt: kein Anschnitt. */
export interface Anschnitt {
  oben: number;
  rechts: number;
  unten: number;
  links: number;
}

/** Was ein Kunde an einem Vorlagenelement ändern darf. */
export type Bearbeitbar = 'text' | 'bild' | 'farbe' | 'position';

/**
 * Markiert ein Element als Platzhalter einer Vorlage. Ohne Platzhalter ist ein
 * Element in einem aus einer Vorlage erzeugten Entwurf unantastbar.
 */
export interface Platzhalter {
  /** Fachlicher Schlüssel, etwa `schlagzeile` oder `logo`. Je Vorlage eindeutig. */
  schluessel: string;
  bearbeitbar: readonly Bearbeitbar[];
  /** Anzeigetext im Bedienfeld, wenn der Elementname zu technisch ist. */
  beschriftung: string | null;
  /**
   * Verweis auf ein Feld der Aussage. Ist er gesetzt, ist der Inhalt dieses
   * Elements **keine Kopie, sondern eine Sicht**: er wird beim Anzeigen
   * aufgelöst und zieht nach, wenn die Aussage sich ändert.
   *
   * Genau hier liegt der Unterschied zu „Magic Resize" in anderen Werkzeugen:
   * dort entsteht beim Umformatieren eine unabhängige Datei, und ab dem Moment
   * laufen die Fassungen auseinander.
   *
   * `null` heißt: gewöhnlicher Platzhalter, der Inhalt steht im Element.
   * Der Typ ist absichtlich `string`, damit `modell` nicht von `aussage`
   * abhängt — geprüft wird beim Auflösen.
   */
  bindung: string | null;
}

/** Verweis auf eine Datei im Assetspeicher. Die URL ist ein Zwischenstand, die id trägt. */
export interface AssetReferenz {
  id: string;
  url: string;
  breite: number;
  hoehe: number;
  mimeTyp: string;
}

/** Relativer Bildausschnitt, jeweils 0..1 der Quelldatei. */
export interface Zuschnitt {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}

export interface ElementBasis {
  id: string;
  name: string;
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  /** Grad im Uhrzeigersinn, um den Mittelpunkt des Elements. */
  drehung: number;
  /** 0..1 */
  deckkraft: number;
  sichtbar: boolean;
  /** Gesperrte Elemente sind gegen Kommandos geschützt, siehe `kommandos/schutz.ts`. */
  gesperrt: boolean;
  platzhalter: Platzhalter | null;
}

export type Textausrichtung = 'links' | 'mitte' | 'rechts' | 'blocksatz';

/**
 * `autoAnpassung` steuert, was bei Textüberlauf passiert:
 * - `keine`     — Text läuft über, der Editor zeigt eine Warnung
 * - `schrumpfen`— Schriftgröße wird verkleinert, bis der Text passt
 * - `hoehe`     — der Rahmen wächst nach unten
 */
export type Autoanpassung = 'keine' | 'schrumpfen' | 'hoehe';

export interface TextElement extends ElementBasis {
  typ: 'text';
  inhalt: string;
  schriftFamilie: string;
  /** px bei `dpi` des Entwurfs. */
  schriftGroesse: number;
  /** 100..900 in Hundertern, wie CSS `font-weight`. */
  schriftStaerke: number;
  kursiv: boolean;
  farbe: Farbe;
  ausrichtung: Textausrichtung;
  /** Faktor auf die Schriftgröße, 1.2 ist der übliche Standard. */
  zeilenabstand: number;
  /** Laufweite in px, negativ erlaubt. */
  laufweite: number;
  autoAnpassung: Autoanpassung;
}

export type Bildpassform = 'fuellen' | 'einpassen' | 'strecken';

export interface BildElement extends ElementBasis {
  typ: 'bild';
  quelle: AssetReferenz;
  zuschnitt: Zuschnitt;
  passform: Bildpassform;
}

export type Formart = 'rechteck' | 'ellipse' | 'linie' | 'pfad';

export interface Kontur {
  farbe: Farbe;
  staerke: number;
}

export interface FormElement extends ElementBasis {
  typ: 'form';
  form: Formart;
  fuellung: Farbe | null;
  kontur: Kontur | null;
  /** Nur bei `rechteck` wirksam. */
  eckenradius: number;
  /** SVG-Pfaddaten, nur bei `form === 'pfad'` gesetzt. */
  pfad: string | null;
}

export interface GruppenElement extends ElementBasis {
  typ: 'gruppe';
  kinder: Entwurfselement[];
}

/**
 * Heißt bewusst nicht `Element` — der Name ist im DOM belegt und die Verwechslung
 * in einem Paket, das im Browser läuft, wäre garantiert.
 */
export type Entwurfselement = TextElement | BildElement | FormElement | GruppenElement;

export type Elementtyp = Entwurfselement['typ'];

export interface Seite {
  id: string;
  name: string;
  /** `null` heißt transparent. Für Druck fast immer ein Wert. */
  hintergrund: Farbe | null;
  /** Reihenfolge ist Stapelreihenfolge: Index 0 liegt hinten. */
  elemente: Entwurfselement[];
}

export interface Entwurf {
  schemaVersion: number;
  id: string;
  /** Mandantentrennung. Steht in jedem gespeicherten Datensatz. */
  organisationId: string;
  name: string;
  masse: Masse;
  anschnitt: Anschnitt;
  /** Abstand vom Endformat nach innen, in px bei `dpi`. Nur eine Warnhilfe. */
  sicherheitsabstand: number;
  seiten: Seite[];
  markenkitId: string | null;
  vorlageId: string | null;
  /** ISO-8601 in UTC. */
  erstelltAm: string;
  geaendertAm: string;
}

export function istGruppe(element: Entwurfselement): element is GruppenElement {
  return element.typ === 'gruppe';
}

export function istText(element: Entwurfselement): element is TextElement {
  return element.typ === 'text';
}

export function istBild(element: Entwurfselement): element is BildElement {
  return element.typ === 'bild';
}

export function istForm(element: Entwurfselement): element is FormElement {
  return element.typ === 'form';
}
