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
  name: 'hnvr.me digital GbR' as Angabe,
  strasse: 'Am Bahnhof 8' as Angabe,
  plzOrt: '30926 Seelze' as Angabe,
  land: 'Deutschland',

  /** Wer vertritt das Unternehmen — bei GmbH die Geschäftsführung. */
  vertretung: 'Tim Rose' as Angabe,

  /**
   * Alle Gesellschafter der GbR, mit Namen.
   *
   * Eine GbR hat keine eigene Rechtspersönlichkeit im Register, deshalb
   * verlangt § 5 DDG die Nennung ALLER Gesellschafter — und eine GbR hat
   * definitionsgemäß mindestens zwei. Bekannt ist bisher einer. Der zweite
   * Name fehlt, und ihn zu erfinden wäre schlimmer als ihn offen zu lassen.
   */
  gesellschafter: null as Angabe,

  /** Kein Platzhalter mehr: Hier stand eine ausgedachte Bochumer Nummer,
      während die Firma in Seelze sitzt. Eine erfundene Telefonnummer im
      Impressum ist schlechter als gar keine — § 5 DDG verlangt eine schnelle
      elektronische Kontaktaufnahme, und die leistet die E-Mail. */
  telefon: null as Angabe,
  email: 'hallo@youbooth.me' as Angabe,

  /* --- Register und Steuer --------------------------------------------- */
  /** Etwa „Amtsgericht Bochum". Bei Einzelunternehmen: null, dann entfällt
      der Abschnitt — nicht jede Firma steht im Handelsregister. */
  registergericht: null as Angabe,
  registernummer: null as Angabe,
  /** Umsatzsteuer-Identifikationsnummer, etwa „DE123456789". */
  ustId: null as Angabe,

  /** Verantwortlich nach § 18 Abs. 2 MStV. Meist dieselbe Person. */
  redaktion: 'Tim Rose' as Angabe,

  /* --- Datenschutz ------------------------------------------------------ */
  /** Kontakt der oder des Datenschutzbeauftragten, oder null, wenn keine
      Bestellpflicht besteht — dann steht das ausdrücklich auf der Seite. */
  datenschutzbeauftragte: null as Angabe,
  /**
   * Wo die Cloud-Dienste laufen.
   *
   * Hier stand „Frankfurt am Main" — ein Satz in einer Datenschutzerklärung
   * über einen Server, den es nicht gibt: Die Cloud-Galerie ist nicht
   * gebaut, und der Dienst zwischen den Boxen auch nicht. Eine Zusage über
   * einen Serverstandort ist eine Zusage; sie darf erst dahin, wenn der
   * Vertrag mit dem Rechenzentrum steht.
   */
  serverstandort: null as Angabe,
  /**
   * Die Datenschutz-Aufsichtsbehörde — und das ist etwas anderes als die
   * „Aufsichtsbehörde" im Impressum.
   *
   * Im Impressum (§ 5 DDG) meint der Begriff eine Behörde, die einen
   * zulassungspflichtigen Beruf beaufsichtigt: Makler, Handwerk, Heilberufe.
   * Für ein Softwareunternehmen gibt es die nicht, und dort steht deshalb
   * auch keine.
   *
   * Hier steht die andere: die Stelle, bei der ein Betroffener sich über UNS
   * beschweren kann (Art. 77 DSGVO). Die hat jeder Verantwortliche, sie
   * richtet sich nach dem Sitz — Seelze liegt in Niedersachsen.
   */
  aufsichtsbehoerde:
    'Die Landesbeauftragte für den Datenschutz Niedersachsen, ' +
    'Prinzenstraße 5, 30159 Hannover' as Angabe,

  /* --- Fristen und Zusagen ---------------------------------------------- */
  fristProtokolle: '7 Tagen' as Angabe,
  fristAnfragen: '6 Monaten' as Angabe,
  fristNachVertrag: '30 Tage' as Angabe,
  verfuegbarkeit: '99 %' as Angabe,

  /* --- AGB -------------------------------------------------------------- */
  /** Der Sitz der Gesellschaft. Die AGB-Zeile beschränkt ihn ausdrücklich auf
      Kaufleute — gegenüber Verbrauchern gilt ohnehin das Gesetz, und eine
      Klausel, die das übergeht, ist unwirksam. */
  gerichtsstand: 'Seelze' as Angabe,
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
  /* Eine Telefonnummer verlangt § 5 DDG nicht, solange eine schnelle
     elektronische Kontaktaufnahme möglich ist — die E-Mail leistet das.
     Steht keine da, entfällt die Zeile im Impressum. */
  'telefon',
  /* Der Serverstandort gehört erst genannt, wenn es einen gibt. Bis dahin
     sagt die Datenschutzerklärung, dass alles auf der Box bleibt — was
     stimmt. */
  'serverstandort',
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
