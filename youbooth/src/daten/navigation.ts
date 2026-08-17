/** Kopfleiste und Fusszeile — eine Quelle, damit beide nie auseinanderlaufen. */

export type Verweis = { text: string; ziel: string };

/** Reihenfolge wie in den Entwuerfen. */
export const hauptnavigation: Verweis[] = [
  { text: 'System', ziel: '/system' },
  { text: 'Module', ziel: '/module' },
  { text: 'Anlässe', ziel: '/anlaesse' },
  { text: 'Vorlagen', ziel: '/vorlagen' },
  { text: 'Vergleich', ziel: '/vergleich' },
  { text: 'Rechner', ziel: '/rechner' },
  { text: 'Preise', ziel: '/preise' },
  { text: 'Hilfe', ziel: '/hilfe' },
  { text: 'Über uns', ziel: '/team' },
  { text: 'Download', ziel: '/download' },
];

export const fusszeile: { titel: string; verweise: Verweis[] }[] = [
  {
    titel: 'Produkt',
    verweise: [
      { text: 'System', ziel: '/system' },
      { text: 'Module', ziel: '/module' },
      { text: 'Vorlagen', ziel: '/vorlagen/system' },
      { text: 'Vorlagen-Galerie', ziel: '/vorlagen' },
      { text: 'Download', ziel: '/download' },
      { text: 'Design-System', ziel: '/design-system' },
      { text: 'Preise', ziel: '/preise' },
      { text: 'Referenzen', ziel: '/referenzen' },
    ],
  },
  {
    titel: 'Für Betreiber',
    verweise: [
      { text: 'Vermietung', ziel: '/fuer-vermieter' },
      { text: 'Cockpit-Login', ziel: '/anmelden' },
      { text: 'Installation', ziel: '/support' },
      { text: 'Support & Tickets', ziel: '/support' },
    ],
  },
];

/** Alle Routen, die die Entwuerfe vorsehen — Grundlage fuer die Platzhalterseiten. */
export const geplanteRouten: { pfad: string; titel: string; quelle: string }[] = [
  { pfad: '/anlaesse', titel: 'Anlässe', quelle: 'Anlaesse.dc.html' },
  { pfad: '/anlaesse/hochzeit', titel: 'Hochzeit', quelle: 'Anlass Hochzeit.dc.html' },
  { pfad: '/anlaesse/firmenevent', titel: 'Firmenevent', quelle: 'Anlass Firmenevent.dc.html' },
  { pfad: '/anlaesse/geburtstag', titel: 'Geburtstag', quelle: 'Anlass Geburtstag.dc.html' },
  { pfad: '/anlaesse/abiball', titel: 'Abiball', quelle: 'Anlass Abiball.dc.html' },
  { pfad: '/anlaesse/weihnachtsfeier', titel: 'Weihnachtsfeier', quelle: 'Anlass Weihnachtsfeier.dc.html' },
  { pfad: '/anlaesse/silvester', titel: 'Silvester', quelle: 'Anlass Silvester.dc.html' },
  { pfad: '/vorlagen', titel: 'Vorlagen-Galerie', quelle: 'Vorlagen Store.dc.html' },
  { pfad: '/vorlagen/system', titel: 'Vorlagen-Prinzip', quelle: 'Vorlagen.dc.html' },
  { pfad: '/vergleich', titel: 'Vergleich', quelle: 'Vergleich.dc.html' },
  { pfad: '/hilfe', titel: 'Hilfe-Center', quelle: 'Hilfe.dc.html' },
  { pfad: '/ratgeber', titel: 'Ratgeber', quelle: 'Ratgeber.dc.html' },
  { pfad: '/partner', titel: 'Partnerprogramm', quelle: 'Partner.dc.html' },
  { pfad: '/team', titel: 'Über uns', quelle: 'Team.dc.html' },
  { pfad: '/referenzen', titel: 'Referenzen', quelle: 'Referenzen.dc.html' },
  { pfad: '/fuer-vermieter', titel: 'Für Vermieter', quelle: 'Vermieter.dc.html' },
  { pfad: '/support', titel: 'Support & Installation', quelle: 'Support.dc.html' },
  { pfad: '/download', titel: 'Download', quelle: 'Download.dc.html' },
  { pfad: '/anmelden', titel: 'Anmelden', quelle: 'Anmelden.dc.html' },
  { pfad: '/design-system', titel: 'Design-System', quelle: 'Design System.dc.html' },
  { pfad: '/module/fotobox', titel: 'Komplette Fotobox', quelle: 'Modul Fotobox.dc.html' },
  { pfad: '/module/360-booth', titel: '360-Booth', quelle: 'Modul 360-Booth.dc.html' },
  { pfad: '/module/slow-motion', titel: 'Slow-Motion', quelle: 'Modul Slow-Motion.dc.html' },
  { pfad: '/module/web-kamera', titel: 'Web-Sofortbild-Kamera', quelle: 'Modul Web-Kamera.dc.html' },
  { pfad: '/module/einwegkamera', titel: 'Digitale Einwegkamera', quelle: 'Modul Einwegkamera.dc.html' },
  { pfad: '/module/audio-gaestebuch', titel: 'Audio-Gästebuch', quelle: 'Modul Audio-Gaestebuch.dc.html' },
  { pfad: '/module/gaestebuch', titel: 'Digitales Gästebuch', quelle: 'Modul Gaestebuch.dc.html' },
  { pfad: '/module/galerie', titel: 'Event-Galerie', quelle: 'Modul Galerie.dc.html' },
  { pfad: '/module/foto-wall', titel: 'Live-Foto-Wall', quelle: 'Modul Foto-Wall.dc.html' },
  { pfad: '/module/slideshow', titel: 'Slideshow', quelle: 'Modul Slideshow.dc.html' },
  { pfad: '/module/effekt-studio', titel: 'Effekt-Studio', quelle: 'Modul Effekt-Studio.dc.html' },
  { pfad: '/module/foto-finder', titel: 'Selfie-Foto-Finder', quelle: 'Modul Foto-Finder.dc.html' },
  { pfad: '/module/event-seiten', titel: 'Event-Seiten', quelle: 'Modul Event-Seiten.dc.html' },
  { pfad: '/module/vermietung', titel: 'Vermietung & Buchung', quelle: 'Modul Vermietung.dc.html' },

  // Oberflaechen der Software selbst — im Buendel als App-Prototypen.
  { pfad: '/oberflaechen/fotobox-system', titel: 'Booth-Flow und Cockpit', quelle: 'Fotobox System.dc.html' },
  { pfad: '/oberflaechen/booth-editor', titel: 'Booth-Editor', quelle: 'Booth Editor.dc.html' },
  { pfad: '/oberflaechen/kunden-galerie', titel: 'Kunden-Galerie', quelle: 'Kunden Galerie.dc.html' },
  { pfad: '/oberflaechen/mosaik-wand', titel: 'Mosaik-Wand', quelle: 'Mosaik Wand.dc.html' },
  { pfad: '/oberflaechen/onboarding', titel: 'Onboarding-Tour', quelle: 'Onboarding.dc.html' },
  { pfad: '/oberflaechen/iphone-apps', titel: 'iPhone-Begleit-Apps', quelle: 'iPhone Apps.dc.html' },
  { pfad: '/oberflaechen/booth-animationen', titel: 'Booth-Animationen', quelle: 'Booth Animationen.dc.html' },

  // Rechtliches — in den Entwuerfen nur als Fusszeilen-Text vorhanden.
  { pfad: '/impressum', titel: 'Impressum', quelle: '— noch kein Entwurf' },
  { pfad: '/datenschutz', titel: 'Datenschutz', quelle: '— noch kein Entwurf' },
  { pfad: '/agb', titel: 'AGB', quelle: '— noch kein Entwurf' },
  { pfad: '/kontakt', titel: 'Kontakt', quelle: 'Kontakt.dc.html' },
];
