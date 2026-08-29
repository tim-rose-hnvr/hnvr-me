/**
 * Die Marke an einer Stelle.
 *
 * Name, Farben, Schrift. Steht hier, damit ein Namenswechsel eine Datei kostet
 * und nicht eine Suche über dreißig — und weil ein Weißetikett-Betrieb später
 * genau diese Werte je Mandant überschreiben wird.
 */

export const MARKE = {
  name: 'Redaktion',
  /** Ein Satz, nicht drei. Steht im Kopf und in der Vorschaukarte. */
  zeile: 'Ein Plan für soziale Kanäle und E-Mail.',
  beschreibung:
    'Redaktionsplan, Freigabe, Posteingang und Newsletter in einem Programm — selbst betrieben, ohne Fremdaufruf im Browser.',
} as const;

/**
 * Farben.
 *
 * Wenige und ruhige: ein Werkzeug, in dem jemand acht Stunden am Tag
 * arbeitet, darf nicht leuchten. Die einzigen kräftigen Töne gehören den drei
 * Schweregraden, und die sollen auffallen.
 */
export const FARBEN = {
  grund: '#faf9f6',
  flaeche: '#ffffff',
  linie: '#e3e0d8',
  schrift: '#1d1c19',
  gedaempft: '#6b675e',
  akzent: '#1d4e4a',
  akzentHell: '#e6efee',

  fehler: '#9c2b1c',
  fehlerHell: '#fbeae7',
  warnung: '#8a5a06',
  warnungHell: '#fdf3e0',
  hinweis: '#3c5a80',
  hinweisHell: '#eaf0f7',
} as const;

/** Die Kanalfarben. Nur zur Unterscheidung im Plan, nicht als Markenzitat. */
export const KANALFARBEN: Record<string, string> = {
  mastodon: '#5b4bc4',
  bluesky: '#1063c4',
  x: '#2b2b2b',
  linkedin: '#0a5c8a',
  instagram: '#a83b6d',
  facebook: '#2b4d8a',
  mail: '#1d4e4a',
};
