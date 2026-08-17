/**
 * Die Marke — alles, was Get in Touch zu einem eigenen Produkt macht.
 *
 * Diese Datei gibt es, weil das Werkzeug verkauft werden soll. Vorher trug es
 * die Kleider seines Herstellers: hnvrs Asterisk als Signet, hnvrs Hausorange
 * als Produktfarbe, „hnvr.me" als Absender unter jeder fremden Seite. Für eine
 * Vorführung geht das, für ein Produkt nicht — wer es kauft, kauft dann eine
 * Seite, die nach jemand anderem aussieht.
 *
 * Deshalb steht die Identität hier an einer Stelle und nirgends sonst. Wer den
 * Namen, das Zeichen oder die Farben ändern will, ändert diese Datei und sonst
 * keine. Das ist nicht Ordnungsliebe, sondern die Voraussetzung dafür, das
 * Produkt später unter anderem Namen auszuliefern.
 *
 * Der Hersteller bleibt sichtbar, aber als Absender und nicht als Marke —
 * eine Zeile am Fuß, so wie ein Schild am Zaun und nicht wie das Haus.
 */

export const MARKE = {
  name: 'Get in Touch',
  /** Was das Produkt in einem Satz ist. Steht im Titel und in der Vorschaukarte. */
  anspruch: 'Eine Seite, die Menschen erreichbar macht.',
  /** Wohin Entwürfe und Anfragen gehen. */
  postfach: 'hallo@hnvr.me',
  hersteller: { name: 'hnvr.me', adresse: 'https://hnvr.me' },
} as const;

/**
 * Das Zeichen: zwei Wege, die in einem Punkt zusammenlaufen.
 *
 * Das ist buchstäblich das Produkt — viele Kontaktwege, eine Adresse — und es
 * ist bewusst das Gegenteil eines Baums, in dem sich Wege verzweigen. Geprüft
 * wurde es bis 16 Pixel und einfarbig auf hellem wie dunklem Grund, weil es
 * neben einem QR-Code auf einem Fahrzeug landen kann und dort weder Farbe noch
 * Größe garantiert sind.
 *
 * `currentColor` überall: das Zeichen nimmt die Farbe an, in der es steht.
 */
export const SIGNET =
  '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
  '<g fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M14 18C44 18 48 50 62 50"/><path d="M14 82C44 82 48 50 62 50"/></g>' +
  '<circle cx="78" cy="50" r="13" fill="currentColor"/></svg>';

/** Der Asterisk von hnvr.me. Steht nur noch dort, wo der Hersteller gemeint ist. */
export const HERSTELLERZEICHEN =
  '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path fill="currentColor" d="M50 4c3 0 5.4 2.4 5.4 5.4v25l17.7-17.7a5.4 5.4 0 1 1 7.6 7.6L63 42h25a5.4 5.4 0 1 1 0 10.8H63l17.7 17.7a5.4 5.4 0 1 1-7.6 7.6L55.4 60.4v25a5.4 5.4 0 1 1-10.8 0v-25L26.9 78.1a5.4 5.4 0 1 1-7.6-7.6L37 52.8H12a5.4 5.4 0 1 1 0-10.8h25L19.3 24.3a5.4 5.4 0 1 1 7.6-7.6l17.7 17.7v-25C44.6 6.4 47 4 50 4z"/></svg>';

/**
 * Die Produktfarben.
 *
 * Ein tiefes Petrolschwarz, warmes Papier und ein Signalton, der „erreichbar"
 * meint. Bewusst weder hnvrs Orange (das gehört dem Hersteller) noch das
 * Frühlingsgrün von Linktree (das gehört dem Wettbewerb).
 *
 * Diese Werte tragen die Marketingseite, die Galerie, die Werkstatt und die
 * Vorgabe-Vorlage. Was ein Kunde für seine eigene Seite wählt, steht davon
 * unberührt in `gestaltung.ts`.
 */
export const MARKENFARBEN = {
  grund: '#0B0F10',
  grund2: '#141A1B',
  vordergrund: '#F4F1EC',
  akzent: '#00C2A8',
  /** Text auf der Signalfarbe. Dunkel, weil Weiß auf dem Ton nicht trägt. */
  akzentText: '#04211C',
} as const;
