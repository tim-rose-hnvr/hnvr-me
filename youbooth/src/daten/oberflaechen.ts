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
    id: 'booth-editor',
    titel: 'Booth-Editor',
    kicker: 'Druckvorlagen entwerfen',
    h1: 'Der Editor druckt, was er zeigt',
    sub: 'Bildfelder, Texte, Flächen und Logo auf dem Blatt setzen — in Millimetern, wie auf dem Papier. Die Vorschau ist kein Bild von etwas Ähnlichem: sie entsteht mit demselben Renderer, der später druckt.',
    screenshot: '/assets/app-editor.png',
    bildbeschreibung: 'Booth-Editor mit Streifenvorlage, Feldliste und Werkzeugpalette',
    koennen: [
      'Felder ziehen und in der Größe ändern, mit Raster; Pfeiltasten schieben in kleinen Schritten',
      'Maße in Millimetern — 10 × 15 cm und 5 × 15 cm, gerechnet auf 300 dpi',
      'Textfelder mit Platzhaltern: {event}, {datum}, {zeit}, {box}, {nummer}',
      'Logo als PNG einbetten — es steckt in der Vorlage und wandert mit ihr',
      'Vorlage als Datei ablegen und auf der nächsten Box wieder einlesen',
      'Testdruck über den Systemdruck, bevor der erste Gast kommt',
      'Als Standard für Fotos oder Streifen setzen — der Booth druckt danach genau das',
    ],
    regeln: [
      {
        titel: 'Mitgeliefertes bleibt heil',
        text: 'Die mitgelieferten Vorlagen sind schreibgeschützt. Die erste Änderung legt eine Kopie an, damit der Weg zurück auch um drei Uhr nachts offen ist.',
      },
      {
        titel: 'Kein Blatt ohne Bildfeld',
        text: 'Das letzte Bildfeld lässt sich nicht löschen, und eine eingelesene Datei ohne Bildfeld weist der Editor ab. Eine Vorlage, die keine Aufnahme zeigen kann, ist kein Layout.',
      },
    ],
    offen:
      'Mitgeliefert sind 55 Vorlagen auf sieben Papierformaten. Acht weitere aus dem Katalog fehlen mit Absicht: Sie tragen einen alten Produktnamen als Pixel im Hintergrund — eine Vorlage, die den falschen Namen auf den Abzug eines Gastes druckt, ist kein Layout, sondern ein Rückruf. Noch nicht da sind der Bildschirm-Designer, freie Schriften über die sechs Druckschriften hinaus und die Vorlagen-Bibliothek über mehrere Boxen hinweg.',
    knoepfe: [
      { text: 'Vorlagen-System ansehen', ziel: '/vorlagen/system' },
      { text: 'Software laden', ziel: '/download' },
    ],
  },
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
      'Herunterladen einzeln, ohne Anmeldung — Boomerang und GIF zusätzlich als Animation',
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
    id: 'booth-animationen',
    titel: 'Bewegung am Screen',
    kicker: 'Attract, Countdown, Übergang',
    h1: 'Bewegung, die führt statt ablenkt',
    sub: 'Der Attract holt Gäste heran, der Countdown sagt ihnen, wann sie stillhalten sollen, der Übergang zeigt, dass etwas passiert ist. Jede Bewegung hat eine Aufgabe — und lässt sich abschalten.',
    screenshot: '/assets/app-attract.png',
    bildbeschreibung: 'Attract-Bild der Box mit Laufband und QR-Code zum Auslöser',
    koennen: [
      'Attract in drei Stufen: ruhig, pulsender Startknopf oder Laufband mit eigenem Text',
      'Drei Countdown-Stile: Ring, Zahl, Balken',
      'Blitz im Auslösemoment, abschaltbar',
      'Weicher Auftritt beim Schrittwechsel, abschaltbar',
      'Boomerang und GIF laufen schon im Ergebnis animiert, vor dem Sichern',
      'Umgestellt wird im Kiosk-Menü, ohne Neustart und ohne Datei zu tauschen',
    ],
    regeln: [
      {
        titel: 'Weniger Bewegung heißt weniger Bewegung',
        text: 'Wer am Gerät „Bewegung reduzieren" eingestellt hat, bekommt keine Schleifen und keinen Auftritt. Das ist keine Einstellung im Menü, sondern die des Betriebssystems.',
      },
      {
        titel: 'Kurz statt auffällig',
        text: 'Der Auftritt dauert 220 Millisekunden, der Puls atmet über zwei Sekunden. Nichts blinkt: Ein Kiosk, der zappelt, wirkt kaputt statt lebendig.',
      },
    ],
    offen:
      'Einen Animations-Editor gibt es nicht. Videohintergründe, Partikel und eigene Übergänge je Event stehen im Katalog, aber nicht in der Software — sie kosten Rechenzeit, die beim Kamerabild fehlt.',
    knoepfe: [
      { text: 'Booth-Flow ansehen', ziel: '/oberflaechen/fotobox-system' },
      { text: 'Software laden', ziel: '/download' },
    ],
  },
  {
    id: 'iphone-apps',
    titel: 'Auslöser am Telefon',
    kicker: 'Im WLAN der Box',
    h1: 'Das eigene Telefon als Fernbedienung',
    sub: 'QR am Screen scannen, ein Knopf, Countdown an der Box. Die Seite kommt aus der Box selbst — keine App, kein Konto, kein Internet.',
    screenshot: '/assets/app-fernausloeser.png',
    bildbeschreibung: 'Auslöser-Seite auf einem Telefon neben der Erklärung',
    koennen: [
      'Auslösen aus dem WLAN der Box, ohne Installation und ohne Anmeldung',
      'Ein Ziel von 260 Pixeln — bedienbar mit einer Hand, auch im Halbdunkel',
      'Nach dem Auslösen 12 Sekunden gesperrt, damit niemand den Countdown zerhackt',
      'Der QR steht im Attract-Bild, nur wenn die Box den Dienst auch anbietet',
      'Dieselbe Adresse trägt die Event-Galerie — ansehen und herunterladen am selben Gerät',
    ],
    regeln: [
      {
        titel: 'Nur eine Zahl',
        text: 'Von außen lässt sich genau ein Zähler erhöhen, und nur per POST. Die Box schaut selbst nach ihm; sie nimmt keine Befehle entgegen.',
      },
      {
        titel: 'Kein Auslösen mitten in der Aufnahme',
        text: 'Ausgelöst wird nur aus dem Attract oder der Auswahl. Wer während einer laufenden Serie tippt, unterbricht niemanden.',
      },
    ],
    offen:
      'Eine App im App Store gibt es nicht — dafür braucht es ein Apple-Developer-Konto und die Verteilung darüber. Live-Vorschau am Telefon, Gäste-Upload und Untertitel brauchen zusätzlich den Dienst zwischen den Geräten.',
    knoepfe: [
      { text: 'Kunden-Galerie ansehen', ziel: '/oberflaechen/kunden-galerie' },
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
