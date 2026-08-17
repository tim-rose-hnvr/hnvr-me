/**
 * Die 14 Module: die Basis plus 13 zubuchbare.
 * Eine Quelle fuer Startseite, Moduluebersicht und Preiskonfigurator —
 * Preise und Texte stehen nur hier.
 */

export type Modul = {
  id: string;
  titel: string;
  icon: string;
  /** Monatspreis in Euro, Grundlage der Rechnung auf /preise. */
  preis: number;
  /** Wo das Modul wirkt — die Mono-Kennung auf der Kartenunterkante. */
  kennung: string;
  /** Langer Text auf der Uebersicht. */
  text: string;
  /** Knappe Zeile fuer die Startseiten-Kachel. */
  kurz: string;
  pfad: string;
};

export const basismodul = {
  id: 'fotobox',
  titel: 'Komplette Fotobox',
  icon: 'box',
  preis: 39,
  kennung: 'Pro Monat · je Box-Lizenz',
  text: 'Booth mit fünf Aufnahmearten, Sofortdruck über den Systemdruck, Kiosk-Betrieb, Einstellungsmenü, Cockpit mit Boxen-Puls und Fernsteuerung, Druck- und Bildschirm-Designer.',
  kurz: 'Booth, Sofortdruck und Cockpit — die Basis, auf der jedes weitere Modul aufsetzt.',
  pfad: '/module/fotobox',
};

export const zusatzmodule: Modul[] = [
  {
    id: 'foto-wall',
    titel: 'Live-Foto-Wall',
    icon: 'wand',
    preis: 19,
    kennung: 'Beamer · TV',
    text: 'Fotos live auf Beamer & TV. Moderation vorschaltbar, Layout und Tempo einstellbar, läuft parallel zum Booth.',
    kurz: 'Fotos live auf Beamer & TV',
    pfad: '/module/foto-wall',
  },
  {
    id: 'foto-finder',
    titel: 'Selfie-Foto-Finder',
    icon: 'gesicht',
    preis: 15,
    kennung: 'Handy',
    text: 'Gäste finden ihre Bilder per Selfie. Einwilligung vorab, Suchbild wird nach dem Treffer verworfen.',
    kurz: 'Eigene Fotos per Gesicht finden',
    pfad: '/module/foto-finder',
  },
  {
    id: 'galerie',
    titel: 'Event-Galerie & QR',
    icon: 'qr',
    preis: 12,
    kennung: 'Web',
    text: 'Alle Bilder eines Events zum Ansehen und Herunterladen, mit Löschfrist und optionalem Passwort.',
    kurz: 'Teilen & Herunterladen',
    pfad: '/module/galerie',
  },
  {
    id: 'gaestebuch',
    titel: 'Digitales Gästebuch',
    icon: 'gaestebuch',
    preis: 12,
    kennung: 'Booth · Wand',
    text: 'Grüße als Live-Zettelwand: Text und Bild am Screen, danach als PDF für das Paar.',
    kurz: 'Grüße als Live-Zettelwand',
    pfad: '/module/gaestebuch',
  },
  {
    id: 'web-kamera',
    titel: 'Web-Sofortbild-Kamera',
    icon: 'wolke',
    preis: 15,
    kennung: 'Browser',
    text: 'Fotobox im Browser, ohne Hardware. Gut für Testphasen, Homeoffice-Events und Aktionen mit vielen Standorten.',
    kurz: 'Fotobox im Browser, ohne Hardware',
    pfad: '/module/web-kamera',
  },
  {
    id: 'einwegkamera',
    titel: 'Einwegkamera-Modus',
    icon: 'foto',
    preis: 15,
    kennung: 'Handy · QR',
    text: 'Jedes Gästehandy wird zum Film mit begrenzten Aufnahmen: kein Löschen, keine Vorschau, entwickelt wird erst nach dem Event.',
    kurz: 'Handy wird zum Film mit 24 Bildern',
    pfad: '/module/einwegkamera',
  },
  {
    id: 'event-seiten',
    titel: 'Event-Seiten',
    icon: 'galerie',
    preis: 19,
    kennung: 'Web',
    text: 'Gebrandete Microsites pro Event: Ablauf, Galerie-Link, Hashtag, Upload für Gäste.',
    kurz: 'Gebrandete Microsite pro Event',
    pfad: '/module/event-seiten',
  },
  {
    id: 'slideshow',
    titel: 'Beamer-Slideshow',
    icon: 'slideshow',
    preis: 12,
    kennung: 'Beamer',
    text: 'Vollbild-Diashow für Pausen und Empfang, mit eigenen Zwischenbildern und Musikhinweis.',
    kurz: 'Vollbild-Diashow für Pausen',
    pfad: '/module/slideshow',
  },
  {
    id: 'effekt-studio',
    titel: 'Effekt-Studio',
    icon: 'effekt',
    preis: 15,
    kennung: 'Booth',
    text: 'Kunststile und KI-Hintergründe, Freistellung auch ohne Greenscreen — pro Event auswählbar.',
    kurz: 'Kunststile & KI-Hintergrund',
    pfad: '/module/effekt-studio',
  },
  {
    id: 'audio-gaestebuch',
    titel: 'Audio-Gästebuch',
    icon: 'chat',
    preis: 12,
    kennung: 'Booth',
    text: 'Gesprochene Grüße werden als Video mit Standbild und Stimme abgelegt.',
    kurz: 'Gesprochene Grüße als Video',
    pfad: '/module/audio-gaestebuch',
  },
  {
    id: 'slow-motion',
    titel: 'Slow-Motion Booth',
    icon: 'video',
    preis: 15,
    kennung: 'Booth',
    text: 'Red-Carpet-Zeitlupe mit Dauerlicht — Clips direkt teilbar, ohne Schnitt.',
    kurz: 'Red-Carpet-Zeitlupe mit Dauerlicht',
    pfad: '/module/slow-motion',
  },
  {
    id: 'vermietung',
    titel: 'Vermietung & Buchung',
    icon: 'kalender',
    preis: 25,
    kennung: 'Web · Büro',
    text: 'Öffentliche Buchungsseite mit Kalender, Paketen, Konto, Vertrag und Zahlungsstand.',
    kurz: 'Buchungsseite, Kalender, Pakete',
    pfad: '/module/vermietung',
  },
  {
    id: '360-booth',
    titel: '360°-Booth',
    icon: 'boomerang',
    preis: 19,
    kennung: 'Hardware',
    text: 'Rundum-Clip mit Arm und Plattform, inklusive Vorlagen für Übergänge und Musikbetten.',
    kurz: 'Rundum-Clip mit Arm und Plattform',
    pfad: '/module/360-booth',
  },
];

/** Basis plus Zusatzmodule — die 14, von denen die Entwuerfe sprechen. */
export const alleModule = [basismodul, ...zusatzmodule];
