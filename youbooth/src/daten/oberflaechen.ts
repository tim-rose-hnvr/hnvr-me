/**
 * Die Oberflächen der Software, die es tatsächlich schon gibt.
 * Screenshots stammen aus der laufenden Anwendung, nicht aus einem Entwurf.
 */

export type Oberflaeche = {
  id: string;
  titel: string;
  kicker: string;
  h1: string;
  sub: string;
  screenshot: string;
  bildbeschreibung: string;
  /** Was die Oberfläche kann — jeder Punkt ist umgesetzt. */
  koennen: string[];
  /** Was sie bewusst nicht tut, und warum. */
  regeln: { titel: string; text: string }[];
  /** Was noch fehlt — offen benannt. */
  offen: string;
  knoepfe: { text: string; ziel: string }[];
};

export const oberflaechen: Oberflaeche[] = [
  {
    id: 'mosaik-wand',
    titel: 'Foto-Wall',
    kicker: 'Beamer und TV',
    h1: 'Die Wand, die den Abend über wächst',
    sub: 'Jede Aufnahme aus der Box erscheint von selbst an der Wand, die neueste wird kurz groß gezeigt. Betriebsart „nur Booth": kein Upload-Aufruf, nichts zu moderieren.',
    screenshot: '/assets/app-wand.png',
    bildbeschreibung: 'Foto-Wall mit Kachelraster und Kopfzeile',
    koennen: [
      'Neue Aufnahmen erscheinen im Takt von selbst — niemand muss etwas aktualisieren',
      'Die neueste Aufnahme wird kurz groß gezeigt, damit Gäste sich wiederfinden',
      'Läuft im Vollbild ohne Bedienelemente: nichts, was Gäste antippen könnten',
      'Zeigt ausschließlich, was durch den Kiosk gelaufen ist',
    ],
    regeln: [
      {
        titel: 'Kein Upload-Aufruf',
        text: 'In der Betriebsart „nur Booth" fehlt der QR zum Hochladen bewusst. Was nicht hochgeladen werden kann, muss auch niemand prüfen.',
      },
      {
        titel: 'Läuft parallel zum Booth',
        text: 'Die Wand liest dieselbe Ablage wie der Booth. Sie braucht keinen zweiten Rechner und kein Netz.',
      },
    ],
    offen:
      'Gäste-Upload, Hashtag-Einspeisung und die Moderationsliste brauchen den Dienst zwischen den Geräten — die Betriebsart „alle Quellen" folgt damit.',
    knoepfe: [
      { text: 'Modul Live-Foto-Wall', ziel: '/module/foto-wall' },
      { text: 'Software laden', ziel: '/download' },
    ],
  },
  {
    id: 'kunden-galerie',
    titel: 'Kunden-Galerie',
    kicker: 'Für Gäste und Auftraggeber',
    h1: 'Alle Bilder eines Events an einem Ort',
    sub: 'Ansehen, filtern, herunterladen — im lokalen Netz der Box, ohne Internet. Die Löschfrist steht sichtbar im Kopf, so wie sie den Gästen versprochen wurde.',
    screenshot: '/assets/app-galerie.png',
    bildbeschreibung: 'Galerie mit Kachelraster und Filterleiste',
    koennen: [
      'Filter nach Aufnahmeart, mit Trefferzähler',
      'Großansicht mit Vor und Zurück, auch per Pfeiltasten und Escape bedienbar',
      'Herunterladen einzeln, ohne Anmeldung',
      'Löschfrist steht im Kopf, nicht im Kleingedruckten',
    ],
    regeln: [
      {
        titel: 'Große Ziele',
        text: 'Die Galerie wird am Handy bedient, oft mit einer Hand. Alle Schaltflächen sind mindestens 44 Pixel hoch.',
      },
      {
        titel: 'Ohne Konto',
        text: 'Wer den QR scannt, ist drin. Ein Passwort pro Event ist vorgesehen, eine Anmeldung nicht.',
      },
    ],
    offen:
      'Passwortschutz pro Event, Gäste-Upload und die Cloud-Galerie mit eigener Adresse folgen mit dem Dienst.',
    knoepfe: [
      { text: 'Modul Event-Galerie', ziel: '/module/galerie' },
      { text: 'Software laden', ziel: '/download' },
    ],
  },
  {
    id: 'onboarding',
    titel: 'Installations-Zentrum',
    kicker: 'Einrichtung in sechs Schritten',
    h1: 'Prüfen, was wirklich läuft',
    sub: 'Jeder Schritt prüft etwas Echtes: Kamera, Druckweg, Ablage, Ausgabe-Adresse, Speicherplatz. Am Ende sagt die Selbstprüfung, ob die Box laufen kann.',
    screenshot: '/assets/app-einrichtung.png',
    bildbeschreibung: 'Installations-Zentrum mit sechs Schritten und Selbstprüfung',
    koennen: [
      'Kamera anfragen, Geräte zählen, Live-Testbild ansehen',
      'Testdruck über den Systemdruck auslösen',
      'Aufnahmearten freischalten — angeboten wird nur, was hier an ist',
      'Ausgabe-Adresse holen und den QR-Code zur Probe erzeugen',
      'Selbstprüfung über Kamera, Ablage, Ausgabe, Speicher und Arten',
    ],
    regeln: [
      {
        titel: 'Kein Haken ohne Prüfung',
        text: 'Jeder Schritt macht etwas und meldet das Ergebnis. Was nicht geprüft werden kann, sagt das offen — statt grün zu leuchten.',
      },
      {
        titel: 'PIN mit Regel',
        text: 'Vier bis acht Ziffern. Ohne gültige PIN wird nicht gesichert, sonst steht der Kiosk offen.',
      },
    ],
    offen:
      'Kopplung an ein Konto und die Lizenzzuweisung brauchen den Lizenzdienst — bis dahin richtet ihr die Box lokal ein.',
    knoepfe: [
      { text: 'Support & Installation', ziel: '/support' },
      { text: 'Hilfe-Center', ziel: '/hilfe' },
    ],
  },
];
