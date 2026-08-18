/**
 * Die Lucide-Zeichen aus dem Design-Handoff.
 *
 * Der Prototyp lädt Lucide von `unpkg.com` nach und ersetzt `<i data-lucide>`
 * im Browser. Das geht hier nicht: kein Fremdaufruf im Browser, das ist eine
 * der Zusagen auf der Startseite. Deshalb liegen die Pfade hier — erzeugt aus
 * `lucide-static` in derselben Fassung 0.446.0, die der Prototyp verlangt,
 * und danach ist das Paket nicht mehr nötig.
 *
 * Erzeugt, nicht von Hand geschrieben. Wer ein Zeichen ergänzen will, nimmt
 * `werkzeug/lucide-holen.py` und trägt den Namen dort ein.
 *
 * Lizenz der Pfaddaten: ISC, Lucide Contributors.
 */

/** Strichstärke 2, wie im Handoff festgelegt. Gefüllt ist nur der Stern. */
export type Lucidename =
  | 'arrow-right'
  | 'badge-check'
  | 'bar-chart-3'
  | 'battery-full'
  | 'building-2'
  | 'calendar-heart'
  | 'camera'
  | 'check'
  | 'contact-round'
  | 'download'
  | 'file-spreadsheet'
  | 'git-branch'
  | 'globe'
  | 'grid-2x2'
  | 'hammer'
  | 'image'
  | 'images'
  | 'inbox'
  | 'instagram'
  | 'link'
  | 'linkedin'
  | 'lock'
  | 'mail'
  | 'map-pin'
  | 'message-circle'
  | 'message-circle-heart'
  | 'nfc'
  | 'palette'
  | 'phone'
  | 'plus'
  | 'qr-code'
  | 'quote'
  | 'repeat'
  | 'rss'
  | 'share-2'
  | 'shield-check'
  | 'sliders-horizontal'
  | 'smartphone-nfc'
  | 'sparkles'
  | 'star'
  | 'stethoscope'
  | 'users-round'
  | 'wand-sparkles'
  | 'wifi'
  | 'x'
  | 'youtube';

const PFADE: Record<Lucidename, string> = {
  'arrow-right': "<path d=\"M5 12h14\" /> <path d=\"m12 5 7 7-7 7\" />",
  'badge-check': "<path d=\"M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z\" /> <path d=\"m9 12 2 2 4-4\" />",
  'bar-chart-3': "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /> <path d=\"M18 17V9\" /> <path d=\"M13 17V5\" /> <path d=\"M8 17v-3\" />",
  'battery-full': "<rect width=\"16\" height=\"10\" x=\"2\" y=\"7\" rx=\"2\" ry=\"2\" /> <line x1=\"22\" x2=\"22\" y1=\"11\" y2=\"13\" /> <line x1=\"6\" x2=\"6\" y1=\"11\" y2=\"13\" /> <line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"13\" /> <line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"13\" />",
  'building-2': "<path d=\"M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z\" /> <path d=\"M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2\" /> <path d=\"M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2\" /> <path d=\"M10 6h4\" /> <path d=\"M10 10h4\" /> <path d=\"M10 14h4\" /> <path d=\"M10 18h4\" />",
  'calendar-heart': "<path d=\"M3 10h18V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7\" /> <path d=\"M8 2v4\" /> <path d=\"M16 2v4\" /> <path d=\"M21.29 14.7a2.43 2.43 0 0 0-2.65-.52c-.3.12-.57.3-.8.53l-.34.34-.35-.34a2.43 2.43 0 0 0-2.65-.53c-.3.12-.56.3-.79.53-.95.94-1 2.53.2 3.74L17.5 22l3.6-3.55c1.2-1.21 1.14-2.8.19-3.74Z\" />",
  'camera': "<path d=\"M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z\" /> <circle cx=\"12\" cy=\"13\" r=\"3\" />",
  'check': "<path d=\"M20 6 9 17l-5-5\" />",
  'contact-round': "<path d=\"M16 2v2\" /> <path d=\"M17.915 22a6 6 0 0 0-12 0\" /> <path d=\"M8 2v2\" /> <circle cx=\"12\" cy=\"12\" r=\"4\" /> <rect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" />",
  'download': "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" /> <polyline points=\"7 10 12 15 17 10\" /> <line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\" />",
  'file-spreadsheet': "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\" /> <path d=\"M14 2v4a2 2 0 0 0 2 2h4\" /> <path d=\"M8 13h2\" /> <path d=\"M14 13h2\" /> <path d=\"M8 17h2\" /> <path d=\"M14 17h2\" />",
  'git-branch': "<line x1=\"6\" x2=\"6\" y1=\"3\" y2=\"15\" /> <circle cx=\"18\" cy=\"6\" r=\"3\" /> <circle cx=\"6\" cy=\"18\" r=\"3\" /> <path d=\"M18 9a9 9 0 0 1-9 9\" />",
  'globe': "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20\" /> <path d=\"M2 12h20\" />",
  'grid-2x2': "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M3 12h18\" /> <path d=\"M12 3v18\" />",
  'hammer': "<path d=\"m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9\" /> <path d=\"m18 15 4-4\" /> <path d=\"m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5\" />",
  'image': "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\" /> <circle cx=\"9\" cy=\"9\" r=\"2\" /> <path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\" />",
  'images': "<path d=\"M18 22H4a2 2 0 0 1-2-2V6\" /> <path d=\"m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18\" /> <circle cx=\"12\" cy=\"8\" r=\"2\" /> <rect width=\"16\" height=\"16\" x=\"6\" y=\"2\" rx=\"2\" />",
  'inbox': "<polyline points=\"22 12 16 12 14 15 10 15 8 12 2 12\" /> <path d=\"M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z\" />",
  'instagram': "<rect width=\"20\" height=\"20\" x=\"2\" y=\"2\" rx=\"5\" ry=\"5\" /> <path d=\"M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z\" /> <line x1=\"17.5\" x2=\"17.51\" y1=\"6.5\" y2=\"6.5\" />",
  'link': "<path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" /> <path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" />",
  'linkedin': "<path d=\"M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z\" /> <rect width=\"4\" height=\"12\" x=\"2\" y=\"9\" /> <circle cx=\"4\" cy=\"4\" r=\"2\" />",
  'lock': "<rect width=\"18\" height=\"11\" x=\"3\" y=\"11\" rx=\"2\" ry=\"2\" /> <path d=\"M7 11V7a5 5 0 0 1 10 0v4\" />",
  'mail': "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\" /> <path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\" />",
  'map-pin': "<path d=\"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0\" /> <circle cx=\"12\" cy=\"10\" r=\"3\" />",
  'message-circle': "<path d=\"M7.9 20A9 9 0 1 0 4 16.1L2 22Z\" />",
  'message-circle-heart': "<path d=\"M7.9 20A9 9 0 1 0 4 16.1L2 22Z\" /> <path d=\"M15.8 9.2a2.5 2.5 0 0 0-3.5 0l-.3.4-.35-.3a2.42 2.42 0 1 0-3.2 3.6l3.6 3.5 3.6-3.5c1.2-1.2 1.1-2.7.2-3.7\" />",
  'nfc': "<path d=\"M6 8.32a7.43 7.43 0 0 1 0 7.36\" /> <path d=\"M9.46 6.21a11.76 11.76 0 0 1 0 11.58\" /> <path d=\"M12.91 4.1a15.91 15.91 0 0 1 .01 15.8\" /> <path d=\"M16.37 2a20.16 20.16 0 0 1 0 20\" />",
  'palette': "<circle cx=\"13.5\" cy=\"6.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"17.5\" cy=\"10.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"8.5\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" /> <circle cx=\"6.5\" cy=\"12.5\" r=\".5\" fill=\"currentColor\" /> <path d=\"M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z\" />",
  'phone': "<path d=\"M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z\" />",
  'plus': "<path d=\"M5 12h14\" /> <path d=\"M12 5v14\" />",
  'qr-code': "<rect width=\"5\" height=\"5\" x=\"3\" y=\"3\" rx=\"1\" /> <rect width=\"5\" height=\"5\" x=\"16\" y=\"3\" rx=\"1\" /> <rect width=\"5\" height=\"5\" x=\"3\" y=\"16\" rx=\"1\" /> <path d=\"M21 16h-3a2 2 0 0 0-2 2v3\" /> <path d=\"M21 21v.01\" /> <path d=\"M12 7v3a2 2 0 0 1-2 2H7\" /> <path d=\"M3 12h.01\" /> <path d=\"M12 3h.01\" /> <path d=\"M12 16v.01\" /> <path d=\"M16 12h1\" /> <path d=\"M21 12v.01\" /> <path d=\"M12 21v-1\" />",
  'quote': "<path d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\" /> <path d=\"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\" />",
  'repeat': "<path d=\"m17 2 4 4-4 4\" /> <path d=\"M3 11v-1a4 4 0 0 1 4-4h14\" /> <path d=\"m7 22-4-4 4-4\" /> <path d=\"M21 13v1a4 4 0 0 1-4 4H3\" />",
  'rss': "<path d=\"M4 11a9 9 0 0 1 9 9\" /> <path d=\"M4 4a16 16 0 0 1 16 16\" /> <circle cx=\"5\" cy=\"19\" r=\"1\" />",
  'share-2': "<circle cx=\"18\" cy=\"5\" r=\"3\" /> <circle cx=\"6\" cy=\"12\" r=\"3\" /> <circle cx=\"18\" cy=\"19\" r=\"3\" /> <line x1=\"8.59\" x2=\"15.42\" y1=\"13.51\" y2=\"17.49\" /> <line x1=\"15.41\" x2=\"8.59\" y1=\"6.51\" y2=\"10.49\" />",
  'shield-check': "<path d=\"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\" /> <path d=\"m9 12 2 2 4-4\" />",
  'sliders-horizontal': "<line x1=\"21\" x2=\"14\" y1=\"4\" y2=\"4\" /> <line x1=\"10\" x2=\"3\" y1=\"4\" y2=\"4\" /> <line x1=\"21\" x2=\"12\" y1=\"12\" y2=\"12\" /> <line x1=\"8\" x2=\"3\" y1=\"12\" y2=\"12\" /> <line x1=\"21\" x2=\"16\" y1=\"20\" y2=\"20\" /> <line x1=\"12\" x2=\"3\" y1=\"20\" y2=\"20\" /> <line x1=\"14\" x2=\"14\" y1=\"2\" y2=\"6\" /> <line x1=\"8\" x2=\"8\" y1=\"10\" y2=\"14\" /> <line x1=\"16\" x2=\"16\" y1=\"18\" y2=\"22\" />",
  'smartphone-nfc': "<rect width=\"7\" height=\"12\" x=\"2\" y=\"6\" rx=\"1\" /> <path d=\"M13 8.32a7.43 7.43 0 0 1 0 7.36\" /> <path d=\"M16.46 6.21a11.76 11.76 0 0 1 0 11.58\" /> <path d=\"M19.91 4.1a15.91 15.91 0 0 1 .01 15.8\" />",
  'sparkles': "<path d=\"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\" /> <path d=\"M20 3v4\" /> <path d=\"M22 5h-4\" /> <path d=\"M4 17v2\" /> <path d=\"M5 18H3\" />",
  'star': "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\" />",
  'stethoscope': "<path d=\"M11 2v2\" /> <path d=\"M5 2v2\" /> <path d=\"M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1\" /> <path d=\"M8 15a6 6 0 0 0 12 0v-3\" /> <circle cx=\"20\" cy=\"10\" r=\"2\" />",
  'users-round': "<path d=\"M18 21a8 8 0 0 0-16 0\" /> <circle cx=\"10\" cy=\"8\" r=\"5\" /> <path d=\"M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3\" />",
  'wand-sparkles': "<path d=\"m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72\" /> <path d=\"m14 7 3 3\" /> <path d=\"M5 6v4\" /> <path d=\"M19 14v4\" /> <path d=\"M10 2v2\" /> <path d=\"M7 8H3\" /> <path d=\"M21 16h-4\" /> <path d=\"M11 3H9\" />",
  'wifi': "<path d=\"M12 20h.01\" /> <path d=\"M2 8.82a15 15 0 0 1 20 0\" /> <path d=\"M5 12.859a10 10 0 0 1 14 0\" /> <path d=\"M8.5 16.429a5 5 0 0 1 7 0\" />",
  'x': "<path d=\"M18 6 6 18\" /> <path d=\"m6 6 12 12\" />",
  'youtube': "<path d=\"M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17\" /> <path d=\"m10 15 5-3-5-3z\" />",
};

/**
 * Ein Zeichen als SVG.
 *
 * `groesse` folgt dem Handoff: 14 px in Pillen, 18 px in Listen, 22 px in
 * Kartenköpfen. `gefuellt` gibt es nur für den Stern.
 */
export function lucide(name: Lucidename, groesse = 18, gefuellt = false): string {
  const fuellung = gefuellt ? 'currentColor' : 'none';
  return (
    `<svg class="ic" width="${groesse}" height="${groesse}" viewBox="0 0 24 24" ` +
    `fill="${fuellung}" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${PFADE[name]}</svg>`
  );
}
