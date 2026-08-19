/** Ratgeber-Artikel fuer Vermieter: Rubrik, Anriss, Volltext, Merkpunkte, Fazit.
 *
 * gestaltung: eigene Palette — je Rubrik eine Kennfarbe, damit sich die
 * Artikel im Register unterscheiden. Sie folgt der Rubrik, nicht der Marke.
 */

export type Ratgeberartikel = {
  rubrik: string;
  meta: string;
  farbe: string;
  titel: string;
  teaser: string;
  absatz: string;
  merkpunkte: string[];
  fazit: string;
};

export const rubriken = [
  { id: 'alle', text: 'Alle' },
  { id: 'geschaeft', text: 'Geschäft' },
  { id: 'technik', text: 'Technik' },
  { id: 'entscheidung', text: 'Entscheidung' },
  { id: 'recht', text: 'Recht' },
  { id: 'praxis', text: 'Praxis' },
];

export const artikel: Ratgeberartikel[] = [
  {
    rubrik: 'geschaeft',
    meta: 'Geschäft · 6 Min',
    farbe: '#8e2b26',
    titel: 'Preise ansetzen, ohne sich zu verkaufen',
    teaser: 'Pakete statt Stundenlohn, Zusatzstunden, Kaution und wie man Rabattfragen beantwortet.',
    absatz: 'Der Stundenlohn ist die schlechteste Einheit für ein Fotobox-Angebot: er lädt zum Vergleichen ein und bestraft euch für Erfahrung. Drei Pakete mit klaren Grenzen verkaufen besser, weil der Kunde wählt statt verhandelt.',
    merkpunkte: ['Drei Pakete: 3 Stunden digital, 4 Stunden mit Druck, 6 Stunden mit Betreuung und zweiter Vorlage.', 'Zusatzstunde als fester Betrag im Angebot nennen — sonst wird sie am Abend verschenkt.', 'Kaution nur bei Selbstabholung, dafür Aufbau- und Abbauzeit als Position sichtbar machen.', 'Auf Rabattfragen mit Leistung antworten: kleineres Paket statt kleinerer Preis.'],
    fazit: 'Wer den Preis drückt, kauft selten zweimal. Wer das Paket versteht, empfiehlt weiter.',
  },
  {
    rubrik: 'technik',
    meta: 'Technik · 5 Min',
    farbe: '#1e5f4f',
    titel: 'Der Abend ohne WLAN',
    teaser: 'Warum Hotspot, lokale Queue und späterer Upload zusammengehören — und was ihr vorher testen solltet.',
    absatz: 'In alten Sälen ist Netz die Ausnahme, nicht der Ausfall. Eine Box muss deshalb komplett lokal arbeiten und erst später hochladen — sonst stehen Gäste vor einem Ladebalken.',
    merkpunkte: ['Eigener Hotspot an der Box: der QR-Code führt ins lokale Netz, Download läuft ohne Internet.', 'Aufnahmen, Drucke und Mails in eine Queue legen, die nach dem Event automatisch abarbeitet.', 'Vor dem Event einmal im Flugmodus proben: Aufnahme, Druck, QR-Download, Neustart.', 'Handy-Hotspot als Reserve, aber nie als Grundlage einplanen.'],
    fazit: 'Offline ist kein Notfallmodus, sondern der Normalfall. Cloud ist Komfort danach.',
  },
  {
    rubrik: 'entscheidung',
    meta: 'Entscheidung · 4 Min',
    farbe: '#8a5a12',
    titel: 'Druck oder nur digital?',
    teaser: 'Wann Sofortdruck den Preis trägt und wann eine digitale Box das bessere Angebot ist.',
    absatz: 'Sofortdruck kostet je Abend Material, Platz und Aufmerksamkeit — trägt aber gut 150 bis 250 € Aufpreis. Digital ist schneller aufgebaut und passt zu Messen, Clubs und großen Gästezahlen.',
    merkpunkte: ['Hochzeit und Geburtstag: Druck lohnt fast immer, das Bild in der Hand ist das Andenken.', 'Messe und Kongress: digital plus Mail, weil Adressen mehr wert sind als Papier.', 'Über 200 Gäste: zweite Box oder digital, sonst entsteht Schlange am Drucker.', 'Materialkosten bei 0,28 € je Abzug rechnen, nicht bei 0,18 € — Fehldrucke gehören dazu.'],
    fazit: 'Fragt nach dem Zweck des Abends, nicht nach dem Budget: der Zweck entscheidet über Druck.',
  },
  {
    rubrik: 'recht',
    meta: 'Recht · 7 Min',
    farbe: '#3a3f7a',
    titel: 'Datenschutz beim Firmenevent',
    teaser: 'Einwilligung am Screen, Unterschrift, Löschfrist — und wie man Betriebsräten die Frage vorwegnimmt.',
    absatz: 'Bei Firmenkunden entscheidet oft nicht das Marketing, sondern der Betriebsrat. Wer Einwilligung, Speicherort und Löschfrist von selbst auf ein Blatt schreibt, gewinnt die Freigabe ohne Rückfragerunde.',
    merkpunkte: ['Einwilligung am Screen vor der ersten Aufnahme, mit Datum protokolliert.', 'Löschfrist je Event setzen — 30 Tage sind ein guter Standard, 14 bei Betriebsversammlungen.', 'Auftragsverarbeitung als PDF beilegen, Serverstandort nennen.', 'Selfie-Suche nur mit eigener Einwilligung, Suchbild danach verwerfen.'],
    fazit: 'Datenschutz ist ein Verkaufsargument, sobald ihr ihn vor der Frage beantwortet.',
  },
  {
    rubrik: 'praxis',
    meta: 'Praxis · 5 Min',
    farbe: '#a8412f',
    titel: 'Fünf Fehler beim ersten Event',
    teaser: 'Zu wenig Papier, falscher Standort, kein Licht, keine Betreuung, kein Testdruck. Reihenfolge nach Häufigkeit.',
    absatz: 'Fast alle Pannen am ersten Abend sind Logistik, nicht Technik. Diese fünf tauchen in unseren Support-Tickets am häufigsten auf — in dieser Reihenfolge.',
    merkpunkte: ['Papier und Bänder für die doppelte Menge mitnehmen: Gäste drucken mehr als geplant.', 'Standort weg von Buffet und Boxen-Lautsprecher, aber in Sichtachse der Tanzfläche.', 'Eigenes Licht mitbringen — Saallicht ist warm, dunkel und wechselt beim Tanz.', 'Erster Testdruck vor dem Einlass, danach Vorlage nicht mehr wechseln.', 'Für die erste Stunde jemanden hinstellen, der erklärt: danach läuft es allein.'],
    fazit: 'Der zweite Abend ist einfach. Plant den ersten mit doppelter Reserve.',
  },
];
