/**
 * Die Marke — alles, was getintouch zu einem eigenen Produkt macht.
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
  /**
   * Die Wortmarke wird klein geschrieben und in einem Wort — so steht es im
   * Markenbaukasten des Handoffs, und so steht sie in jedem Prototyp.
   */
  name: 'getintouch',
  /** Was das Produkt in einem Satz ist. Steht im Titel und in der Vorschaukarte. */
  anspruch: 'Die Seite hinter deinem Namen — mit Kontakt, Terminen und Bewertungen eingebaut.',
  /** Wohin Entwürfe und Anfragen gehen. */
  postfach: 'hallo@hnvr.me',
  hersteller: { name: 'hnvr.me', adresse: 'https://hnvr.me' },
} as const;

/**
 * Das Zeichen: eine gefüllte Scheibe und ein offener Ring, die sich berühren —
 * „du" und „die anderen".
 *
 * Aus der Geometrie des Design-Handoffs gerechnet, nicht nachgezeichnet: Kreise
 * mit r = 20,5 % der Kantenlänge, Mittelpunkte bei x = 38,5 % und 64,5 %,
 * y = 50 %, Ringstärke 8,5 %. Auf 100 gerechnet ergibt das r = 20,5, Mitten bei
 * 38,5 und 64,5, Strich 8,5 — und weil ein Ring auf seiner Mittellinie
 * gezeichnet wird, hat sein Pfad den Radius 20,5 − 8,5/2 = 16,25.
 *
 * Der Handoff hält fest, dass ein echtes SVG des Zeichens fehlte und aus dieser
 * Geometrie neu zu zeichnen sei. Das ist es.
 *
 * `currentColor` überall: das Zeichen nimmt die Farbe an, in der es steht.
 */
/**
 * Das Zeichen als Plättchen — Scheibe und Ring auf farbigem Grund.
 *
 * Aus `doku/handoff/brand/icon-1024.png` ausgemessen: beide Formen haben
 * denselben Radius von 20,5 % der Kantenlänge, die Mitten sitzen bei 38,5 %
 * und 64,5 %, der Ring ist 8,5 % stark. Der Ring liegt hinten, die Scheibe
 * davor — deshalb zeigt die Ringöffnung links den Grund und rechts nicht.
 *
 * Gezeichnet statt geladen. Die Originaldateien liegen im Projekt
 * (`doku/handoff/brand/`), aber nicht im ausgelieferten Verzeichnis: es gibt
 * keine öffentliche Adresse, unter der sich das Logo abholen ließe.
 *
 * `grund` ist die Plättchenfarbe, `form` die der beiden Kreise.
 */
export function zeichenPlaettchen(grund: string = MARKENFARBEN.akzent, form: string = MARKENFARBEN.grund): string {
  return (
    '<svg viewBox="0 0 100 100" class="signet" aria-hidden="true" focusable="false">' +
    `<rect width="100" height="100" rx="32" fill="${grund}"/>` +
    `<circle cx="64.5" cy="50" r="20.5" fill="none" stroke="${form}" stroke-width="8.5"/>` +
    `<circle cx="38.5" cy="50" r="20.5" fill="${form}"/>` +
    '</svg>'
  );
}

/**
 * Dasselbe Zeichen ohne Plättchen, einfarbig in der Textfarbe.
 * Für Stellen, an denen der Grund schon farbig ist.
 */
export const SIGNET =
  '<svg viewBox="0 0 100 100" class="signet" aria-hidden="true" focusable="false">' +
  '<circle cx="64.5" cy="50" r="20.5" fill="none" stroke="currentColor" stroke-width="8.5"/>' +
  '<circle cx="38.5" cy="50" r="20.5" fill="currentColor"/></svg>';

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
  grund: '#F3F2F2',
  grund2: '',
  vordergrund: '#201E1D',
  akzent: '#EC3013',
  /** Text auf der Signalfarbe. */
  akzentText: '#FFFFFF',
} as const;

/**
 * Die übrigen Werte aus dem Designsystem „Modernist", soweit der Kern sie
 * braucht. Vollständig stehen sie in `design-system/modernist-styles.css` des
 * Handoffs; hier nur, was im Code auftaucht.
 *
 * `signalTief` trägt den Standfuß unter der Hauptschaltfläche und dient als
 * Textfarbe dort, wo Rot auf hellem Grund lesbar sein muss — reines `#EC3013`
 * schafft als Fließtext den Kontrast nicht.
 */
export const MARKENWERTE = {
  flaeche: '#EAE9E9',
  signalHover: '#DD2B0F',
  signalTief: '#AE1800',
  rose: '#FFE0D9',
  roseHell: '#FFF2EF',
  linie: '#D7D3D3',
  /** Der harte Versatz unter Knöpfen und Karten. Kein Weichzeichner. */
  standfuss: 4,
} as const;
