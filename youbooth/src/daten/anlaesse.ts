/**
 * Die sechs Anlass-Landingpages. Jede hat eine eigene Farbwelt und eine
 * eigene Hero-Deko — Amber bleibt trotzdem die Farbe des Handlungsaufrufs,
 * ausser bei der Hochzeit, die durchgaengig auf Bordeaux steht.
 */

export type Deko = 'bluete' | 'ballon' | 'funkeln' | 'schnee' | 'feuerwerk' | 'keine';

export type Anlass = {
  id: string;
  titel: string;
  /** Zeile auf der Uebersichtskachel. */
  kachelzeile: string;
  kicker: string;
  h1: string;
  sub: string;
  zitat: string;
  bild: string;
  /** Farbwelt */
  grund: string;
  text: string;
  akzent: string;
  streifen: [string, string];
  ctaGrund: string;
  ctaText: string;
  deko: Deko;
  paket: string[];
  module: [string, string][];
  faq: [string, string][];
  schluss: string;
};

export const anlaesse: Anlass[] = [
  {
    id: 'hochzeit',
    titel: 'Hochzeit',
    kachelzeile: 'Die Fotobox, über die am Tag danach geredet wird',
    kicker: 'Hochzeit Lena & Jonas',
    h1: 'Die Fotobox, über die am Tag danach geredet wird',
    sub: 'Streifen mit Monogramm, Gästebuch statt Papierbuch, Galerie für alle — und ein Betreuer, der niemandem im Weg steht.',
    zitat: '„Ein Bild für die Ewigkeit"',
    bild: 'Foto: Hochzeit, Booth im Einsatz',
    grund: '#f3ece0',
    text: '#2b211a',
    akzent: '#8e2b26',
    streifen: ['#e6ddcc', '#ded4c2'],
    ctaGrund: '#8e2b26',
    ctaText: '#f3ece0',
    deko: 'bluete',
    paket: [
      '4 Stunden mit Sofortdruck',
      'Doppelstreifen für Gast und Gästebuch',
      'Digitales Gästebuch mit PDF',
      'Galerie 30 Tage, Löschfrist inklusive',
    ],
    module: [
      ['Digitales Gästebuch', 'Grüße als Zettelwand, danach als Buch'],
      ['Event-Galerie & QR', 'Alle Bilder ohne Nachfragen beim Paar'],
      ['Selfie-Foto-Finder', 'Jeder findet seine eigenen Fotos'],
      ['Live-Foto-Wall', 'Bilder auf dem Beamer im Saal'],
    ],
    faq: [
      ['Braucht die Box WLAN?', 'Nein. QR-Download läuft über den eigenen Hotspot, Uploads gehen später raus.'],
      ['Wie viele Drucke sind üblich?', 'Bei 120 Gästen etwa 200 Streifen — Papier für 400 liegt trotzdem dabei.'],
      ['Wer betreut die Box?', 'Ihr, eure Aushilfe oder wir. Die Bedienung braucht keine Einweisung.'],
    ],
    schluss: 'Hochzeit: Termin sichern',
  },
  {
    id: 'firmenevent',
    titel: 'Firmenevent & Messe',
    kachelzeile: 'Fotos am Stand, ohne Datenschutz-Diskussion',
    kicker: 'Jahrestagung · Halle 3',
    h1: 'Fotos am Stand, ohne Datenschutz-Diskussion',
    sub: 'Freigabe per Unterschrift am Screen, Ausgabe nur per Mail, Branding in eurem Design — und eine Leadliste statt Zettelwirtschaft.',
    zitat: '„Kurz herschauen, bitte"',
    bild: 'Foto: Firmenevent & Messe, Booth im Einsatz',
    grund: '#17171c',
    text: '#f4f2ee',
    akzent: '#F2B23E',
    streifen: ['#22222a', '#1a1a21'],
    ctaGrund: '#F2B23E',
    ctaText: '#141008',
    deko: 'keine',
    paket: [
      '3 Messetage, Auf- und Abbau',
      'Freigabe mit Unterschrift am Screen',
      'Ausgabe per Mail, kein Druck nötig',
      'Auswertung je Tag als PDF',
    ],
    module: [
      ['Effekt-Studio', 'Standdesign als Hintergrund, ohne Set'],
      ['Event-Seiten', 'Microsite mit Galerie und Kontakt'],
      ['Slow-Motion Booth', 'Red-Carpet-Clips für den Feed'],
      ['Beamer-Slideshow', 'Endlosschleife am Stand'],
    ],
    faq: [
      ['Dürfen wir die Bilder verwenden?', 'Nur mit Einwilligung — die Box holt sie am Screen ein und protokolliert sie.'],
      ['Geht es ohne Drucker?', 'Ja. Dann entfällt der Druckschritt und die Box wird deutlich kleiner.'],
      ['Mehrere Standorte?', 'Ein Konto, mehrere Boxen oder die Web-Kamera pro Standort.'],
    ],
    schluss: 'Firmenevent & Messe: Termin sichern',
  },
  {
    id: 'geburtstag',
    titel: 'Geburtstag',
    kachelzeile: 'Der Abend, an dem alle einmal vor die Box wollen',
    kicker: 'Geburtstag · 40',
    h1: 'Der Abend, an dem alle einmal vor die Box wollen',
    sub: 'Ballons, Kerzen und Konfetti auf dem Screen, Streifen zum Mitnehmen, Grimassen inklusive. Auch für runde Zahlen mit Sitzordnung.',
    zitat: '„Happy Birthday!"',
    bild: 'Foto: Geburtstag, Booth im Einsatz',
    grund: '#0b0b0d',
    text: '#f4f2ee',
    akzent: '#F2B23E',
    streifen: ['#1b1b20', '#141419'],
    ctaGrund: '#F2B23E',
    ctaText: '#141008',
    deko: 'ballon',
    paket: [
      '4 Stunden, unbegrenzte Aufnahmen',
      'Streifen mit Alter und Datum',
      'Boomerang und GIF freigeschaltet',
      'Galerie am Tag danach',
    ],
    module: [
      ['Effekt-Studio', 'Kunststile und KI-Hintergründe'],
      ['Live-Foto-Wall', 'Bilder laufen im Raum mit'],
      ['Audio-Gästebuch', 'Gesprochene Glückwünsche'],
      ['Event-Galerie & QR', 'Download für alle Gäste'],
    ],
    faq: [
      ['Auch für Kinder?', 'Ja — große Ziele, einfache Auswahl, Seifenblasen- und Ballon-Screens.'],
      ['Wie laut ist die Box?', 'Sprachausgabe lässt sich abschalten, der Drucker ist leiser als Gespräche.'],
      ['Passt sie in eine Wohnung?', 'Ja, zwei Quadratmeter reichen; die Box steht auf einem Stativ.'],
    ],
    schluss: 'Geburtstag: Termin sichern',
  },
  {
    id: 'abiball',
    titel: 'Abiball & Abschluss',
    kachelzeile: 'Jahrgangsbild, das nicht in der Schublade landet',
    kicker: 'Abiball · Jahrgang 26',
    h1: 'Jahrgangsbild, das nicht in der Schublade landet',
    sub: 'Hüte fliegen, Streifen für jede Tischgruppe, Galerie für den ganzen Jahrgang — und eine Wand, die den Abend über wächst.',
    zitat: '„Endlich fertig!"',
    bild: 'Foto: Abiball & Abschluss, Booth im Einsatz',
    grund: '#0b0b0d',
    text: '#f4f2ee',
    akzent: '#F2B23E',
    streifen: ['#1e1e26', '#15151b'],
    ctaGrund: '#F2B23E',
    ctaText: '#141008',
    deko: 'funkeln',
    paket: [
      '5 Stunden für 200 Gäste',
      'Streifen mit Jahrgangslogo',
      'Mosaik-Wand als Jahrgangsbild',
      'Galerie mit Passwort',
    ],
    module: [
      ['Live-Foto-Wall', 'Mosaik ergibt die Jahreszahl'],
      ['Selfie-Foto-Finder', '200 Gäste finden ihre Bilder'],
      ['Slow-Motion Booth', 'Hutwurf in Zeitlupe'],
      ['Event-Seiten', 'Ablauf und Galerie an einem Ort'],
    ],
    faq: [
      ['Reicht eine Box für 200 Gäste?', 'Meist ja — bei Andrang lohnt eine zweite in der Nähe der Bar.'],
      ['Können wir Bilder moderieren?', 'Ja, auf Wunsch erscheint nichts ohne Freigabe auf der Wand.'],
      ['Wie schnell ist der Druck?', 'Etwa 13 Sekunden pro Bild, die Warteschlange läuft parallel weiter.'],
    ],
    schluss: 'Abiball & Abschluss: Termin sichern',
  },
  {
    id: 'weihnachtsfeier',
    titel: 'Weihnachtsfeier',
    kachelzeile: 'Ein Foto zwischen Gänsebraten und Tombola',
    kicker: 'Weihnachtsfeier 2026',
    h1: 'Ein Foto zwischen Gänsebraten und Tombola',
    sub: 'Schneefall auf dem Screen, Lichterkette im Layout, Bilder auf dem Beamer — und am Montag ein Link für die Abteilung.',
    zitat: '„Frohe Feiertage"',
    bild: 'Foto: Weihnachtsfeier, Booth im Einsatz',
    grund: '#17171c',
    text: '#f4f2ee',
    akzent: '#F2B23E',
    streifen: ['#1f2229', '#171a20'],
    ctaGrund: '#F2B23E',
    ctaText: '#141008',
    deko: 'schnee',
    paket: [
      '4 Stunden, ein Betreuer',
      'Streifen im Firmendesign',
      'Galerie mit Firmen-Passwort',
      'Löschfrist nach Absprache',
    ],
    module: [
      ['Beamer-Slideshow', 'Zwischenbilder für Programmpunkte'],
      ['Digitales Gästebuch', 'Grüße an Kollegen im Ausland'],
      ['Event-Galerie & QR', 'Interner Link, kein offenes Netz'],
      ['Effekt-Studio', 'Winterhintergründe ohne Greenscreen'],
    ],
    faq: [
      ['Datenschutz im Unternehmen?', 'Passwort, Löschfrist und Einwilligung sind einstellbar und dokumentiert.'],
      ['Auch im Restaurant?', 'Ja. Die Box braucht eine Steckdose und zwei Quadratmeter.'],
      ['Was ist mit Betriebsrat-Vorgaben?', 'Freigabe pro Bild und Ausgabe nur per Mail lassen sich vorschreiben.'],
    ],
    schluss: 'Weihnachtsfeier: Termin sichern',
  },
  {
    id: 'silvester',
    titel: 'Silvester & Party',
    kachelzeile: 'Countdown auf dem Screen, Bild in der Hand',
    kicker: 'Silvester · 31.12.',
    h1: 'Countdown auf dem Screen, Bild in der Hand',
    sub: 'Feuerwerk-Motive, Sekt-Bläschen und ein Countdown, der zur Mitternacht passt. Für Clubs, Hotels und Hausparties mit Anspruch.',
    zitat: '„Auf das neue Jahr"',
    bild: 'Foto: Silvester & Party, Booth im Einsatz',
    grund: '#0b0b0d',
    text: '#f4f2ee',
    akzent: '#F2B23E',
    streifen: ['#191921', '#101016'],
    ctaGrund: '#F2B23E',
    ctaText: '#141008',
    deko: 'feuerwerk',
    paket: [
      '6 Stunden bis in die Nacht',
      'Mitternachts-Countdown am Screen',
      'Clips und GIFs für Social',
      'Galerie am Neujahrstag',
    ],
    module: [
      ['Slow-Motion Booth', 'Konfetti in Zeitlupe'],
      ['Live-Foto-Wall', 'Wand füllt die Tanzfläche'],
      ['360°-Booth', 'Rundum-Clip zum Jahreswechsel'],
      ['Event-Galerie & QR', 'Download ohne Anmeldung'],
    ],
    faq: [
      ['Hält die Box Andrang aus?', 'Sessions dauern unter zwei Minuten, die Druck-Queue puffert Spitzen.'],
      ['Was bei feuchten Händen?', 'Der Touch reagiert weiter; der Screen ist beschichtet und leicht zu reinigen.'],
      ['Bis wann läuft sie?', 'So lange ihr wollt — Papier für 800 Drucke passt in die Box.'],
    ],
    schluss: 'Silvester & Party: Termin sichern',
  },
];

export const preishinweis = 'Preis auf Anfrage · abhängig von Stunden und Anfahrt';
