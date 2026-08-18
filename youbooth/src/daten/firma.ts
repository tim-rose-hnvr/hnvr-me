/**
 * Die Angaben, die rechtlich verlangt sind — an genau einer Stelle.
 *
 * Sie standen als Platzhalter in drei Seiten verstreut: `[Firmenname]` im
 * Impressum, noch einmal in der Datenschutzerklärung, dazu Register,
 * Behörde, Fristen. Wer das ausfüllt, sucht sonst dreimal und übersieht beim
 * dritten Mal etwas.
 *
 * Fehlende Angaben stehen hier als `null`, nicht als erfundener Text. Das ist
 * Absicht: Ein Impressum mit ausgedachtem Registergericht sieht fertig aus
 * und ist abmahnfähig. `null` sieht unfertig aus — und die Probe
 * `tools/recht-probe.mjs` sagt beim Bauen, was noch fehlt.
 *
 * Ausfüllen: Wert eintragen, `null` ersetzen. Sonst nichts.
 */

export type Angabe = string | null;

export const firma = {
  /* --- Wer betreibt die Seite (Impressum, § 5 DDG) --------------------- */
  name: null as Angabe,
  strasse: null as Angabe,
  plzOrt: null as Angabe,
  land: 'Deutschland',

  /** Wer vertritt das Unternehmen — bei GmbH die Geschäftsführung. */
  vertretung: null as Angabe,

  telefon: '+49 234 555 018' as Angabe,
  email: 'hallo@youbooth.me' as Angabe,

  /* --- Register und Steuer --------------------------------------------- */
  /** Etwa „Amtsgericht Bochum". Bei Einzelunternehmen: null, dann entfällt
      der Abschnitt — nicht jede Firma steht im Handelsregister. */
  registergericht: null as Angabe,
  registernummer: null as Angabe,
  /** Umsatzsteuer-Identifikationsnummer, etwa „DE123456789". */
  ustId: null as Angabe,

  /** Verantwortlich nach § 18 Abs. 2 MStV. Meist dieselbe Person. */
  redaktion: null as Angabe,

  /* --- Datenschutz ------------------------------------------------------ */
  /** Kontakt der oder des Datenschutzbeauftragten, oder null, wenn keine
      Bestellpflicht besteht — dann steht das ausdrücklich auf der Seite. */
  datenschutzbeauftragte: null as Angabe,
  /** Wo die Cloud-Dienste laufen. */
  serverstandort: 'Frankfurt am Main, Deutschland' as Angabe,
  /** Zuständige Aufsichtsbehörde samt Anschrift. */
  aufsichtsbehoerde: null as Angabe,

  /* --- Fristen und Zusagen ---------------------------------------------- */
  fristProtokolle: '7 Tagen' as Angabe,
  fristAnfragen: '6 Monaten' as Angabe,
  fristNachVertrag: '30 Tage' as Angabe,
  verfuegbarkeit: '99 %' as Angabe,

  /* --- AGB -------------------------------------------------------------- */
  gerichtsstand: null as Angabe,
};

/**
 * Pflicht gegen „je nach Rechtsform".
 *
 * Nicht jede Firma steht im Handelsregister, nicht jede hat eine
 * Umsatzsteuer-Id, und eine oder einen Datenschutzbeauftragten muss erst
 * bestellen, wer die Schwellen erreicht. Diese vier Felder dürfen `null`
 * bleiben — dann entfällt der Abschnitt auf der Seite, statt eine Eintragung
 * zu behaupten, die es nicht gibt.
 *
 * Die übrigen sind Pflicht. Ohne sie darf die Seite nicht live gehen.
 */
export const nachRechtsform = [
  'registergericht',
  'registernummer',
  'ustId',
  'datenschutzbeauftragte',
] as const;

/** Was fehlt und fehlen darf. */
export const offeneAngaben = Object.entries(firma)
  .filter(([, wert]) => wert === null)
  .map(([feld]) => feld);

/** Was fehlt und nicht fehlen darf. */
export const fehlendeAngaben = offeneAngaben.filter(
  (feld) => !(nachRechtsform as readonly string[]).includes(feld)
);

/**
 * Eine Angabe für die Seite.
 *
 * Fehlt sie, kommt eine sichtbare Markierung heraus statt einer Lücke oder
 * eines Ersatzwerts: Eine Lücke liest sich wie ein Satzfehler, ein
 * Ersatzwert wie eine Angabe. Beides ist schlechter als ein Feld, das sagt,
 * dass es leer ist.
 */
export function angabe(feld: keyof typeof firma): string {
  const wert = firma[feld];
  return wert ?? `⟨${feld} fehlt⟩`;
}

/** Ist die Angabe da? Für Abschnitte, die ohne sie entfallen. */
export function hat(feld: keyof typeof firma): boolean {
  return firma[feld] !== null;
}
