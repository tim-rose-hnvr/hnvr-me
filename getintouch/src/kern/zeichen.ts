/**
 * Zeichen — ein einziges Strichalphabet für die ganze Seite.
 *
 * Selbst gezeichnet und mitgeliefert: kein Icon-CDN, kein Nachladen von
 * fremden Servern, kein Aufruf, den man in einer Datenschutzerklärung erklären
 * müsste. Alle Marken teilen dieselbe Strichstärke und dieselben Radien, damit
 * eine Reihe aus Telefon, Kalender und Instagram nicht wie ein Flohmarkt wirkt.
 */

const STRICH =
  'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const ZEICHEN: Record<string, string> = {
  link: '<path d="M10.3 13.7a4.4 4.4 0 0 0 6.6.5l2.6-2.6a4.4 4.4 0 0 0-6.2-6.2l-1.5 1.5"/><path d="M13.7 10.3a4.4 4.4 0 0 0-6.6-.5l-2.6 2.6a4.4 4.4 0 0 0 6.2 6.2l1.5-1.5"/>',
  globus:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.4 3.3 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.3-5.4-3.3-8.5S9.8 5.9 12 3.5z"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.4"/><path d="M3.6 7.4 12 13l8.4-5.6"/>',
  telefon:
    '<path d="M7.1 3.6h3l1.5 3.7-1.9 1.2a11.4 11.4 0 0 0 5.8 5.8l1.2-1.9 3.7 1.5v3a1.9 1.9 0 0 1-2.1 1.9C10.5 18.1 5.9 13.5 5.2 5.7A1.9 1.9 0 0 1 7.1 3.6z"/>',
  mobil: '<rect x="7" y="2.5" width="10" height="19" rx="2.6"/><path d="M11 18.4h2"/>',
  whatsapp:
    '<path d="M20.4 11.6a8.4 8.4 0 0 1-12.4 7.4L3.6 20.4l1.5-4.3A8.4 8.4 0 1 1 20.4 11.6z"/><path d="M9.2 8.8c.3 2.9 2.6 5.1 5.5 5.4l.8-1.4 1.7.8v1.2c0 .6-.5 1.1-1.2 1a7.9 7.9 0 0 1-6.9-6.9c0-.7.4-1.2 1-1.2h1.2l.8 1.7z"/>',
  termin:
    '<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.6"/><path d="M3.4 9.8h17.2M8.2 3.4v3.4M15.8 3.4v3.4"/>',
  route:
    '<path d="M12 21s6.5-5.6 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.4"/>',
  shop: '<path d="M4.4 7.6h15.2l-1.2 11a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8z"/><path d="M8.8 10V7a3.2 3.2 0 0 1 6.4 0v3"/>',
  datei:
    '<path d="M13.4 3.4H7.6a2 2 0 0 0-2 2v13.2a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2V8.4z"/><path d="M13.4 3.4v5h5"/>',
  video: '<rect x="3" y="6" width="12.6" height="12" rx="2.4"/><path d="m15.6 10.6 5.4-3v8.8l-5.4-3z"/>',
  visitenkarte:
    '<rect x="2.8" y="4.6" width="18.4" height="14.8" rx="2.6"/><circle cx="9" cy="10.8" r="2.2"/><path d="M5.6 16.4a3.6 3.6 0 0 1 6.8 0M14.8 9.8h3.8M14.8 13h3.8"/>',
  laden: '<path d="M12 3.8v11M7.6 10.4 12 14.8l4.4-4.4M4.4 19.2h15.2"/>',
  qr: '<rect x="3.4" y="3.4" width="7" height="7" rx="1.4"/><rect x="13.6" y="3.4" width="7" height="7" rx="1.4"/><rect x="3.4" y="13.6" width="7" height="7" rx="1.4"/><path d="M13.6 13.6h3v3h-3zM20.6 13.6h-1M20.6 20.6h-4v-1"/>',
  uhr: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 2"/>',
  haken: '<path d="m4.8 12.6 4.8 4.8L19.2 7.8"/>',
  teilen:
    '<circle cx="17.6" cy="5.6" r="2.4"/><circle cx="6.4" cy="12" r="2.4"/><circle cx="17.6" cy="18.4" r="2.4"/><path d="m8.6 10.8 6.8-4M8.6 13.2l6.8 4"/>',
  pfeil: '<path d="M5 12h13M13 7l5 5-5 5"/>',
  instagram:
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5"/><circle cx="12" cy="12" r="4.1"/><circle cx="16.9" cy="7.1" r=".9" fill="currentColor"/>',
  linkedin:
    '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.6"/><path d="M7.6 10.6v6.1M12 16.7v-3.5a2.1 2.1 0 0 1 4.2 0v3.5"/><path d="M12 16.7v-6.1"/><circle cx="7.6" cy="7.6" r="1.1" fill="currentColor" stroke="none"/>',
  facebook: '<circle cx="12" cy="12" r="8.6"/><path d="M14.6 8.2h-1.3a1.8 1.8 0 0 0-1.8 1.8v6.6M9.9 12.4h4"/>',
  youtube: '<rect x="2.6" y="5.6" width="18.8" height="12.8" rx="4"/><path d="M10.4 9.4 15.2 12l-4.8 2.6z"/>',
  tiktok: '<path d="M14.2 3.2v10.9a3.7 3.7 0 1 1-3.2-3.7"/><path d="M14.2 3.2c.3 2.7 2.1 4.4 4.8 4.6"/>',
  x: '<path d="M4.4 4.4 19.6 19.6M19.6 4.4 4.4 19.6"/>',
  xing: '<path d="M5.6 8.2h2.6l2 3.4-3.2 5.1"/><path d="M12.4 17.5 17 4.2h2.6"/>',
  threads:
    '<path d="M15.6 12.3c-.2-3-3.9-3.6-5.3-1.6-1 1.5.2 3.4 2 3.2 2-.2 2.6-2.4 2.6-5.1"/><path d="M16.6 6.4C15.5 5 13.9 4.4 12 4.4 7.9 4.4 5.4 7.3 5.4 12s2.5 7.6 6.6 7.6c3.9 0 6-2 6-4.4 0-1.7-1-2.7-2.4-3.1"/>',
  pinterest:
    '<circle cx="12" cy="12" r="8.6"/><path d="M10.4 16.8 12 9.9"/><path d="M9.6 13.2a2.9 2.9 0 0 0 5.5-1.3c0-1.9-1.6-3.1-3.4-3.1a3.6 3.6 0 0 0-3.6 3.5"/>',
  spotify:
    '<circle cx="12" cy="12" r="8.6"/><path d="M7.7 9.6c2.9-.8 6-.5 8.6.9"/><path d="M8.4 12.5c2.4-.6 4.9-.4 7 .8"/><path d="M9.1 15.3c1.8-.4 3.7-.3 5.4.6"/>',
  telegram:
    '<path d="M20.6 4.2 3.6 10.8l4.9 1.8 1.7 5.6 2.6-3.3 4.3 3.4z"/><path d="m8.5 12.6 8.6-6.2-6.9 8"/>',
  github:
    '<path d="M9.2 20.2v-2.6c-3 .6-3.7-1.3-3.7-1.3-.5-1.2-1.2-1.6-1.2-1.6-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.7 2.6 1.2 3.2.9.1-.7.4-1.2.7-1.5-2.4-.3-5-1.3-5-5.5 0-1.2.4-2.2 1.1-3-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 1.1a10 10 0 0 1 5.4 0c2.1-1.4 3-1.1 3-1.1.6 1.5.2 2.6.1 2.9.7.8 1.1 1.8 1.1 3 0 4.2-2.6 5.2-5 5.5.4.4.8 1.1.8 2.2v3.4"/>',
};

/** Der Asterisk aus dem hnvr.me-Zeichen. Steht als Absender am Seitenfuß. */
export const SIGNET =
  '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path fill="currentColor" d="M50 4c3 0 5.4 2.4 5.4 5.4v25l17.7-17.7a5.4 5.4 0 1 1 7.6 7.6L63 42h25a5.4 5.4 0 1 1 0 10.8H63l17.7 17.7a5.4 5.4 0 1 1-7.6 7.6L55.4 60.4v25a5.4 5.4 0 1 1-10.8 0v-25L26.9 78.1a5.4 5.4 0 1 1-7.6-7.6L37 52.8H12a5.4 5.4 0 1 1 0-10.8h25L19.3 24.3a5.4 5.4 0 1 1 7.6-7.6l17.7 17.7v-25C44.6 6.4 47 4 50 4z"/></svg>';

export function hatZeichen(name: string): boolean {
  return name in ZEICHEN;
}

/**
 * Gibt ein Zeichen als SVG zurück. Unbekannte Namen werden zur Kettenglied-Marke —
 * eine fehlende Grafik darf keine Seite zerlegen.
 */
export function zeichen(name: string, klasse = 'zeichen'): string {
  const pfade = ZEICHEN[name] ?? ZEICHEN.link!;
  return `<svg class="${klasse}" viewBox="0 0 24 24" ${STRICH} aria-hidden="true" focusable="false">${pfade}</svg>`;
}
