/**
 * Die Namen des Icon-Satzes an einer Stelle. Als eigenes Modul, nicht im
 * Frontmatter von Icon.astro: einen `export type` dort strippt der
 * Astro-Compiler nicht, und der Bau bricht mit einer Meldung ab, die
 * nichts mit Typen zu tun zu haben scheint.
 */
export const ICON_NAMEN = [
  'punkt', 'scannen', 'code', 'strecke', 'etikett', 'bogen', 'kamera',
  'zahlen', 'glocke', 'team', 'geprueft', 'weiter', 'zeitregel', 'variante',
] as const;

export type IconName = (typeof ICON_NAMEN)[number];
