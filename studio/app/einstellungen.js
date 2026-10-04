/* Einstellungen — das Verzeichnis.

   Hier steht nur, welche Einstellungen es gibt und welchen Wert sie haben.
   Was sie bewirken, steht in `wendeAn` (oberflaeche.js); gezeigt werden sie
   auf der Seite „Einstellungen" (einstellungsseite.js). Getrennt, damit auch
   Module, die die Oberfläche nicht kennen dürfen, einen Wert lesen können —
   die Texterkennung ihre Sprache, die Hinweise ihre Anzahl. */

/* Das Verzeichnis aller Einstellungen. Jede steht in einem der neun Bereiche
   des Atelier-Entwurfs und auf einer Karte darin — und jede wirkt: ein
   Schalter ohne Wirkung ist eine Lüge. Was der Entwurf zeigt, aber im
   Browser nicht gehen kann (Drucker, Ausgabeordner, Cloud-Konten,
   KI-Anbieter), steht auf der Seite als Zustand, nicht als Schalter
   (einstellungsseite.js).

   **Gemerkt wird nur mit Zustimmung.** Dieselbe Frage wie auf der
   Startseite: wer „Dokumente auf diesem Gerät merken" mit Ja beantwortet,
   dessen Einstellungen bleiben ebenfalls auf dem Gerät. Sonst gelten sie für
   diese Sitzung. */
const W = (werte) => werte.map((w) => (Array.isArray(w) ? w : [w, w]));
export const EINSTELLUNGEN = {
  'start.ansicht':        { bereich: 1, karte: 'Sprache & System', name: 'Beim Start', hinweis: 'Was nach dem Öffnen des Studios zu sehen ist', art: 'wahl', werte: [['start', 'Startbereich'], ['zuletzt', 'Zuletzt geöffnetes Dokument']], wert: 'start' },
  'anzeige.thema':        { bereich: 1, karte: 'Erscheinungsbild', name: 'Erscheinung', hinweis: 'Hell, dunkel oder nach Systemeinstellung', art: 'wahl', werte: [['hell', 'Hell'], ['dunkel', 'Dunkel'], ['system', 'System']], wert: 'system' },
  'anzeige.dichte':       { bereich: 1, karte: 'Erscheinungsbild', name: 'Oberflächendichte', hinweis: 'Großzügige oder dichte Bedienelemente', art: 'wahl', werte: [['komfortabel', 'Komfortabel'], ['kompakt', 'Kompakt']], wert: 'komfortabel' },
  'anzeige.skalierung':   { bereich: 1, karte: 'Erscheinungsbild', name: 'Standardskalierung', hinweis: 'Nur die Oberfläche, nicht das PDF', art: 'wahl', werte: W([['90', '90 %'], ['100', '100 %'], ['110', '110 %'], ['125', '125 %']]), wert: '100' },
  'anzeige.papier':       { bereich: 1, karte: 'Erscheinungsbild', name: 'Dokumentpapier', hinweis: 'Wie die Seiten angezeigt werden — die Datei bleibt, wie sie ist', art: 'wahl', werte: [['original', 'Originalfarben'], ['warm', 'Warm'], ['dunkel', 'Dunkel']], wert: 'original' },
  'zugang.kontrast':      { bereich: 1, karte: 'Barrierefreiheit', name: 'Erhöhter Kontrast', hinweis: 'Linien und leise Schrift kräftiger', art: 'schalter', wert: false },
  'zugang.bewegung':      { bereich: 1, karte: 'Barrierefreiheit', name: 'Bewegung reduzieren', hinweis: 'Keine Übergangsanimationen', art: 'schalter', wert: false },
  'zugang.fokus':         { bereich: 1, karte: 'Barrierefreiheit', name: 'Tastaturfokus hervorheben', hinweis: 'Ein breiterer Ring um das, was die Tastatur gerade bedient', art: 'schalter', wert: false },
  'bedienung.kuerzel':    { bereich: 1, karte: 'Bedienung & Hinweise', name: 'Kurzbefehle in Menüs', hinweis: '', art: 'schalter', wert: true },
  'mitdenken.an':         { bereich: 1, karte: 'Bedienung & Hinweise', name: 'Hinweise zum Dokument zeigen', hinweis: 'Die Vorschläge in der rechten Leiste', art: 'schalter', wert: true },
  'mitdenken.hoechstens': { bereich: 1, karte: 'Bedienung & Hinweise', name: 'Höchstens so viele Hinweise', hinweis: '', art: 'wahl', werte: W(['3', '6', '12']), wert: '6' },

  'anzeige.zoom':         { bereich: 2, karte: 'Dokumentansicht', name: 'Zoom beim Öffnen', hinweis: 'Womit eine frisch geöffnete Datei beginnt', art: 'wahl', werte: [['passend', 'Passend zum Fenster'], ['breite', 'Breite'], ['seite', 'Ganze Seite'], ['1', '100 %']], wert: 'passend' },
  'anzeige.nummern':      { bereich: 2, karte: 'Dokumentansicht', name: 'Seitenzahlen unter dem Blatt', hinweis: '', art: 'schalter', wert: true },
  'ablage.merken':        { bereich: 2, karte: 'Speichern & Wiederherstellen', name: 'Dokumente auf diesem Gerät merken', hinweis: 'Zuletzt geöffnet, Sammlungen und diese Einstellungen — nur in diesem Browser', art: 'wahl', werte: [['ja', 'Merken'], ['nein', 'Nichts merken']], wert: 'frage' },
  'anmerkung.groesse':    { bereich: 2, karte: 'Text & Bilder', name: 'Neue Textfelder', hinweis: 'Schriftgröße in Punkt', art: 'wahl', werte: W(['10', '12', '16']), wert: '12' },

  'kommentar.farbe':      { bereich: 3, karte: 'Kommentare', name: 'Kommentarfarbe', hinweis: 'Für neue Kommentare', art: 'wahl', werte: [['#FFD400', 'Gelb'], ['#9BD3AE', 'Salbei'], ['#9CC3E6', 'Blau'], ['#F4B6C2', 'Rosé']], wert: '#FFD400' },
  'anmerkung.staerke':    { bereich: 3, karte: 'Kommentare', name: 'Strichstärke', hinweis: 'Für Freihand, Rechteck, Ellipse, Pfeil', art: 'wahl', werte: [['1', 'Dünn'], ['2', 'Normal'], ['4', 'Dick']], wert: '2' },

  'ocr.sprache':          { bereich: 4, karte: 'Texterkennung', name: 'Sprache', hinweis: 'Liegt dem Studio bei, läuft auf diesem Gerät', art: 'wahl', werte: [['deu', 'Deutsch'], ['eng', 'Englisch']], wert: 'deu' },
  'ocr.dichte':           { bereich: 4, karte: 'Texterkennung', name: 'Auflösung', hinweis: 'Höher ist genauer und langsamer', art: 'wahl', werte: W([['150', '150 dpi'], ['200', '200 dpi'], ['300', '300 dpi']]), wert: '200' },

  'schutz.metadaten':     { bereich: 5, karte: 'PDF', name: 'Metadaten beim Sichern entfernen', hinweis: 'Verfasser, Erzeuger, Stichwörter', art: 'schalter', wert: false },
  'export.kommentare':    { bereich: 5, karte: 'PDF', name: 'Kommentare beim Sichern', hinweis: 'Markierungen, Notizen und Messungen', art: 'wahl', werte: [['behalten', 'Behalten'], ['entfernen', 'Entfernen']], wert: 'behalten' },

  'schutz.warnen':        { bereich: 6, karte: 'Lokale Verarbeitung & Freigaben', name: 'Vor Weitergabe personenbezogener Angaben warnen', hinweis: '', art: 'schalter', wert: true },
};

/* Die neun Bereiche des Entwurfs, in seiner Reihenfolge. */
export const BEREICHE = [
  { nummer: 1, name: 'Allgemein & Darstellung', satz: 'Ein Arbeitsraum, der zu Ihnen passt. Erscheinungsbild und Bedienung an einer Stelle.' },
  { nummer: 2, name: 'Editor & Dokumente', satz: 'Wie Dateien sich öffnen, wie sie aussehen und was auf diesem Gerät liegen bleibt.' },
  { nummer: 3, name: 'Kommentare & Formulare', satz: 'Kommentare eindeutig setzen und Formulare, die sich zuverlässig ausfüllen lassen.' },
  { nummer: 4, name: 'OCR & Scans', satz: 'Aus Papier wird durchsuchbarer Text. Die Erkennung läuft auf diesem Gerät.' },
  { nummer: 5, name: 'Export & Drucken', satz: 'Was beim Sichern mitkommt — und was nicht.' },
  { nummer: 6, name: 'Sicherheit & Datenschutz', satz: 'Lokal als Standard. Vertrauliches gezielt entfernen, Freigaben bewusst entscheiden.' },
  { nummer: 7, name: 'Signaturen & Zertifikate', satz: 'Eine sichtbare Unterschrift ist kein kryptografischer Nachweis. Wählen Sie bewusst.' },
  { nummer: 8, name: 'KI & Integrationen', satz: 'Was das Studio mit anderen Diensten verbindet — und was nicht.' },
  { nummer: 9, name: 'Konto, Speicher & Kurzbefehle', satz: 'Ihr Konto, der Platz auf diesem Gerät und die Handgriffe für jeden Tag.' },
];

/* Steht unter den Bereichen der Einstellungen. */
export const FASSUNG = '2026.10';

export function einstellung(schluessel) { return EINSTELLUNGEN[schluessel]?.wert; }

