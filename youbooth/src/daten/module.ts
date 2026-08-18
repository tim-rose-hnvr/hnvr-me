/**
 * Die 14 Module: die Basis plus 13 zubuchbare.
 *
 * Name und Preis kommen aus `gestaltung/module.json` — derselben Datei, aus
 * der auch die Software ihre Modulliste baut. BUILD_SPEC Teil 5.11 und
 * Abnahmekriterium 6 verlangen das: „Preise, Modulnamen und
 * Bibliotheksgroessen existieren genau einmal."
 *
 * Vorher standen sie hier UND in `booth/server/produkte.js`, und die beiden
 * Listen waren schon auseinander: Die Software kannte nur 13 Module — die
 * Einwegkamera fehlte ganz —, benutzte englische Kennungen und vier andere
 * Namen. Hier bleiben nur die Texte, die es nur auf der Website gibt.
 */

import gestaltung from '../../../gestaltung/module.json';

const NAMEN = new Map(gestaltung.module.map((m) => [m.id, m]));

/** Holt Name und Preis aus der gemeinsamen Quelle. Fehlt die Kennung dort,
    ist das ein Fehler im Datenstand und kein Fall fuer einen Ersatzwert. */
function ausQuelle(id: string): { name: string; preis: number } {
  const treffer = NAMEN.get(id);
  if (!treffer) throw new Error(`Modul "${id}" steht nicht in gestaltung/module.json`);
  return { name: treffer.name, preis: treffer.preis };
}

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
    titel: ausQuelle('fotobox').name,
    icon: 'box',
    preis: ausQuelle('fotobox').preis,
  kennung: 'Pro Monat · je Box-Lizenz',
  text: 'Booth mit vier Aufnahmearten — Foto, Streifen, Boomerang, GIF —, Sofortdruck über den Systemdruck, Kiosk-Betrieb mit PIN, Einstellungen am Screen, Cockpit und Druck-Designer. Video, Boxen-Puls über mehrere Geräte und der Bildschirm-Designer sind eingeplant.',
  kurz: 'Booth, Sofortdruck und Cockpit — die Basis, auf der jedes weitere Modul aufsetzt.',
  pfad: '/module/fotobox',
};

export const zusatzmodule: Modul[] = [
  {
    id: 'foto-wall',
    titel: ausQuelle('foto-wall').name,
    icon: 'wand',
    preis: ausQuelle('foto-wall').preis,
    kennung: 'Beamer · TV',
    text: 'Fotos live auf Beamer & TV. Moderation vorschaltbar, Layout und Tempo einstellbar, läuft parallel zum Booth.',
    kurz: 'Fotos live auf Beamer & TV',
    pfad: '/module/foto-wall',
  },
  {
    id: 'foto-finder',
    titel: ausQuelle('foto-finder').name,
    icon: 'gesicht',
    preis: ausQuelle('foto-finder').preis,
    kennung: 'Handy',
    text: 'Gäste finden ihre Bilder per Selfie. Einwilligung vorab, Suchbild wird nach dem Treffer verworfen.',
    kurz: 'Eigene Fotos per Gesicht finden',
    pfad: '/module/foto-finder',
  },
  {
    id: 'galerie',
    titel: ausQuelle('galerie').name,
    icon: 'qr',
    preis: ausQuelle('galerie').preis,
    kennung: 'Web',
    text: 'Alle Bilder eines Events zum Ansehen und Herunterladen, mit Löschfrist und optionalem Passwort.',
    kurz: 'Teilen & Herunterladen',
    pfad: '/module/galerie',
  },
  {
    id: 'gaestebuch',
    titel: ausQuelle('gaestebuch').name,
    icon: 'gaestebuch',
    preis: ausQuelle('gaestebuch').preis,
    kennung: 'Booth · Wand',
    text: 'Grüße als Live-Zettelwand: Text und Bild am Screen, danach als PDF für das Paar.',
    kurz: 'Grüße als Live-Zettelwand',
    pfad: '/module/gaestebuch',
  },
  {
    id: 'web-kamera',
    titel: ausQuelle('web-kamera').name,
    icon: 'wolke',
    preis: ausQuelle('web-kamera').preis,
    kennung: 'Browser',
    text: 'Fotobox im Browser, ohne Hardware. Gut für Testphasen, Homeoffice-Events und Aktionen mit vielen Standorten.',
    kurz: 'Fotobox im Browser, ohne Hardware',
    pfad: '/module/web-kamera',
  },
  {
    id: 'einwegkamera',
    titel: ausQuelle('einwegkamera').name,
    icon: 'foto',
    preis: ausQuelle('einwegkamera').preis,
    kennung: 'Handy · QR',
    text: 'Jedes Gästehandy wird zum Film mit begrenzten Aufnahmen: kein Löschen, keine Vorschau, entwickelt wird erst nach dem Event.',
    kurz: 'Handy wird zum Film mit 24 Bildern',
    pfad: '/module/einwegkamera',
  },
  {
    id: 'event-seiten',
    titel: ausQuelle('event-seiten').name,
    icon: 'galerie',
    preis: ausQuelle('event-seiten').preis,
    kennung: 'Web',
    text: 'Gebrandete Microsites pro Event: Ablauf, Galerie-Link, Hashtag, Upload für Gäste.',
    kurz: 'Gebrandete Microsite pro Event',
    pfad: '/module/event-seiten',
  },
  {
    id: 'slideshow',
    titel: ausQuelle('slideshow').name,
    icon: 'slideshow',
    preis: ausQuelle('slideshow').preis,
    kennung: 'Beamer',
    text: 'Vollbild-Diashow für Pausen und Empfang, mit eigenen Zwischenbildern und Musikhinweis.',
    kurz: 'Vollbild-Diashow für Pausen',
    pfad: '/module/slideshow',
  },
  {
    id: 'effekt-studio',
    titel: ausQuelle('effekt-studio').name,
    icon: 'effekt',
    preis: ausQuelle('effekt-studio').preis,
    kennung: 'Booth',
    text: 'Kunststile und KI-Hintergründe, Freistellung auch ohne Greenscreen — pro Event auswählbar.',
    kurz: 'Kunststile & KI-Hintergrund',
    pfad: '/module/effekt-studio',
  },
  {
    id: 'audio-gaestebuch',
    titel: ausQuelle('audio-gaestebuch').name,
    icon: 'chat',
    preis: ausQuelle('audio-gaestebuch').preis,
    kennung: 'Booth',
    text: 'Gesprochene Grüße werden als Video mit Standbild und Stimme abgelegt.',
    kurz: 'Gesprochene Grüße als Video',
    pfad: '/module/audio-gaestebuch',
  },
  {
    id: 'slow-motion',
    titel: ausQuelle('slow-motion').name,
    icon: 'video',
    preis: ausQuelle('slow-motion').preis,
    kennung: 'Booth',
    text: 'Red-Carpet-Zeitlupe mit Dauerlicht — Clips direkt teilbar, ohne Schnitt.',
    kurz: 'Red-Carpet-Zeitlupe mit Dauerlicht',
    pfad: '/module/slow-motion',
  },
  {
    id: 'vermietung',
    titel: ausQuelle('vermietung').name,
    icon: 'kalender',
    preis: ausQuelle('vermietung').preis,
    kennung: 'Web · Büro',
    text: 'Öffentliche Buchungsseite mit Kalender, Paketen, Konto, Vertrag und Zahlungsstand.',
    kurz: 'Buchungsseite, Kalender, Pakete',
    pfad: '/module/vermietung',
  },
  {
    id: '360-booth',
    titel: ausQuelle('360-booth').name,
    icon: 'boomerang',
    preis: ausQuelle('360-booth').preis,
    kennung: 'Hardware',
    text: 'Rundum-Clip mit Arm und Plattform, inklusive Vorlagen für Übergänge und Musikbetten.',
    kurz: 'Rundum-Clip mit Arm und Plattform',
    pfad: '/module/360-booth',
  },
];

/** Basis plus Zusatzmodule — die 14, von denen die Entwuerfe sprechen. */
export const alleModule = [basismodul, ...zusatzmodule];
