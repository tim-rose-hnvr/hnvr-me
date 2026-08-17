/**
 * Die Aussage — das eigentliche Produkt.
 *
 * ## Warum es das gibt
 *
 * Marketingmaterial existiert nie einmal. Dieselbe Sache erscheint als
 * A5-Aushang, Instagram-Beitrag, Story, LinkedIn-Beitrag und E-Mail-Kopf. In
 * jedem Werkzeug am Markt sind das **fünf Kopien**. Verschiebt sich der Termin,
 * pflegt jemand vier Dateien und vergisst die fünfte — und die hängt dann noch
 * ein Jahr im Treppenhaus.
 *
 * Hier ist die Aussage die Quelle und jede Ausspielung nur eine Sicht darauf.
 * Der Termin steht **einmal**. Ändert er sich, ziehen alle Formate nach.
 *
 * ## Warum die Felder getippt sind
 *
 * Ein Termin ist kein Text, sondern ein Zeitpunkt. Nur deshalb kann das System
 * ihn je Format anders schreiben („12. September" auf dem Plakat, „12.9." in
 * der Story), rechnen („in drei Tagen") und wissen, wann das Material tot ist.
 * Freitext kann das alles nicht.
 *
 * ## Kürzungsstufen
 *
 * Ein Titel, der auf ein A1-Plakat passt, passt nicht in eine Story. Statt den
 * Text abzuschneiden oder zweimal tippen zu lassen, trägt jedes Feld bis zu
 * drei Fassungen. Die Ausspielung nimmt die längste, die in ihren Rahmen passt.
 */

/** Fachliche Felder einer Aussage. Bewusst geschlossen — kein Freitextzoo. */
export type Feldschluessel = 'titel' | 'untertitel' | 'termin' | 'ort' | 'handlung' | 'kontakt';

export const FELDSCHLUESSEL: readonly Feldschluessel[] = [
  'titel',
  'untertitel',
  'termin',
  'ort',
  'handlung',
  'kontakt',
];

export const FELDNAMEN: Record<Feldschluessel, string> = {
  titel: 'Titel',
  untertitel: 'Untertitel',
  termin: 'Termin',
  ort: 'Ort',
  handlung: 'Handlungsaufforderung',
  kontakt: 'Kontakt',
};

/**
 * Ein Feld in bis zu drei Längen. `lang` ist Pflicht — ohne sie gäbe es nichts
 * auszuspielen. `mittel` und `kurz` sind Angebote für enge Formate.
 */
export interface Feldwert {
  lang: string;
  mittel: string | null;
  kurz: string | null;
}

export type Kuerzungsstufe = 'lang' | 'mittel' | 'kurz';

export interface Aussage {
  id: string;
  organisationId: string;
  /** Interner Name, etwa „Sommerfest 2026". Steht nicht im Material. */
  name: string;
  felder: Partial<Record<Feldschluessel, Feldwert>>;
  /**
   * Zeitpunkt, auf den sich die Aussage bezieht, als ISO-Datum. Danach ist das
   * Material tot — nicht hässlich, sondern falsch. Siehe `pruefung/wirkung.ts`.
   */
  termin: string | null;
  erstelltAm: string;
  geaendertAm: string;
}

export function feldwert(lang: string, mittel?: string, kurz?: string): Feldwert {
  return {
    lang,
    mittel: mittel ?? null,
    kurz: kurz ?? null,
  };
}

/** Die vorhandenen Stufen, von der längsten zur kürzesten. */
export function stufen(wert: Feldwert): { stufe: Kuerzungsstufe; text: string }[] {
  const alle: { stufe: Kuerzungsstufe; text: string | null }[] = [
    { stufe: 'lang', text: wert.lang },
    { stufe: 'mittel', text: wert.mittel },
    { stufe: 'kurz', text: wert.kurz },
  ];
  return alle.filter((s): s is { stufe: Kuerzungsstufe; text: string } => s.text !== null);
}

/**
 * Wählt die **längste Fassung, die in die Kapazität passt**. Passt keine, kommt
 * die kürzeste vorhandene zurück — abschneiden wäre schlimmer als überlaufen,
 * weil ein abgeschnittener Satz falsch ist und ein überlaufender nur eng.
 * Die Prüfung meldet den Überlauf.
 */
export function waehleStufe(
  wert: Feldwert,
  kapazitaetZeichen: number,
): { stufe: Kuerzungsstufe; text: string; passt: boolean } {
  const vorhanden = stufen(wert);
  const passend = vorhanden.find((s) => s.text.length <= kapazitaetZeichen);
  if (passend !== undefined) return { ...passend, passt: true };

  const kuerzeste = vorhanden[vorhanden.length - 1];
  if (kuerzeste === undefined) return { stufe: 'lang', text: wert.lang, passt: false };
  return { ...kuerzeste, passt: false };
}

/**
 * Wie viele Zeichen in einen Textrahmen passen — eine **Schätzung**.
 *
 * Genau weiß das erst der Browser, wenn er gesetzt hat. Für die Wahl der
 * Kürzungsstufe braucht es die Zahl aber vorher, sonst müsste man alle drei
 * Fassungen setzen lassen. Die Schätzung geht von einer mittleren Zeichenbreite
 * von 0,5 em aus — das trifft lateinische Grotesken gut genug, um die richtige
 * Stufe zu wählen. Die anschließende Messung hat das letzte Wort.
 */
export function kapazitaetInZeichen(
  breite: number,
  hoehe: number,
  schriftGroesse: number,
  zeilenabstand: number,
): number {
  if (schriftGroesse <= 0 || breite <= 0 || hoehe <= 0) return 0;
  const zeichenJeZeile = breite / (schriftGroesse * 0.5);
  const zeilen = hoehe / (schriftGroesse * zeilenabstand);
  return Math.max(0, Math.floor(zeichenJeZeile * zeilen));
}

/** Deutsches Datumsformat je nach verfügbarem Platz. */
export function schreibeTermin(iso: string, stufe: Kuerzungsstufe): string {
  const zeitpunkt = new Date(iso);
  if (Number.isNaN(zeitpunkt.getTime())) return iso;

  const tag = zeitpunkt.getUTCDate();
  const monat = zeitpunkt.getUTCMonth();
  const jahr = zeitpunkt.getUTCFullYear();
  const monate = [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ];

  switch (stufe) {
    case 'lang':
      return `${tag}. ${monate[monat]} ${jahr}`;
    case 'mittel':
      return `${tag}. ${monate[monat]?.slice(0, 3)}. ${jahr}`;
    case 'kurz':
      return `${tag}.${monat + 1}.${String(jahr).slice(2)}`;
  }
}

/** Tage bis zum Termin. Negativ heißt: vorbei. `null` ohne Termin. */
export function tageBisTermin(aussage: Aussage, heute: Date): number | null {
  if (aussage.termin === null) return null;
  const ziel = new Date(aussage.termin);
  if (Number.isNaN(ziel.getTime())) return null;

  const einTag = 24 * 60 * 60 * 1000;
  const zielTag = Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth(), ziel.getUTCDate());
  const heuteTag = Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate());
  return Math.round((zielTag - heuteTag) / einTag);
}
