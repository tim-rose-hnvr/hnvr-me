/** Die 24 Hilfe-Artikel in sechs Kategorien. */

export type Artikel = { frage: string; antwort: string };
export type Kategorie = { name: string; icon: string; artikel: Artikel[] };

export const kategorien: Kategorie[] = [
  {
    name: 'Erste Schritte',
    icon: 'einstellungen',
    artikel: [
      {
        frage: 'Box koppeln und Lizenz zuweisen (Kopplung)',
        antwort:
          'Kopplung: Im Installations-Zentrum steht ein sechsstelliger Code auf dem Screen. Diesen im Cockpit unter „Boxen & Puls" eintragen — danach erscheint die Box mit Puls, Version und Materialstand.',
      },
      {
        frage: 'Kamera per Tethering einrichten',
        antwort:
          'Kamera per USB anschließen, in den Einstellungen unter Kamera „Tethering" wählen, Testaufnahme starten. Wenn die Kamera nicht erscheint: anderes Kabel, dann Kamera aus- und einschalten.',
      },
      {
        frage: 'Drucker anmelden',
        antwort:
          'youbooth druckt über den Systemdruck. Erst im Betriebssystem testen, dann in den Einstellungen unter Druck erneut suchen und einen Testdruck auslösen.',
      },
      {
        frage: 'Kiosk-PIN setzen',
        antwort:
          'Ohne PIN können Gäste die Software verlassen. PIN unter System & Diagnose setzen, danach startet der Booth im Vollbild.',
      },
    ],
  },
  {
    name: 'Aufnahme & Effekte',
    icon: 'foto',
    artikel: [
      {
        frage: 'Countdown-Stil und Dauer ändern',
        antwort:
          'Einstellungen → Aufnahme & Ablauf: Ring, Zahl oder Balken, Dauer 3 oder 5 Sekunden. Änderungen greifen zwischen zwei Sessions.',
      },
      {
        frage: 'GIF: Bilderzahl, Tempo, Pingpong',
        antwort:
          'Standard sind 4 Bilder mit 120 ms. Weniger Bilder wirken ruhiger, Pingpong lässt die Schleife vor- und zurücklaufen.',
      },
      {
        frage: 'Freistellung ohne Greenscreen',
        antwort:
          'Effekte & Freistellung → „Ohne Greenscreen · KI" einschalten. Bei dunklen Räumen Dauerlicht dazuschalten, sonst werden Haarkanten unruhig.',
      },
      {
        frage: 'Cheese-Text und Sprachausgabe',
        antwort:
          'Sprache & Texte: Cheese-Text pro Event frei formulieren, Sprachausgabe optional. Beides ist mehrsprachig hinterlegbar.',
      },
    ],
  },
  {
    name: 'Druck',
    icon: 'druck',
    artikel: [
      {
        frage: 'Drucker wird nicht erkannt',
        antwort:
          'Systemdruck prüfen: Gerät im Betriebssystem sichtbar? Dann USB-Kabel und Stromversorgung testen. In den Einstellungen erneut suchen — die Queue bleibt dabei erhalten.',
      },
      {
        frage: 'Papier oder Tinte am Ende',
        antwort:
          'Das Cockpit warnt ab 15 % Tinte und bei knappem Papier. Nach dem Wechsel im Cockpit „Queue fortsetzen" — angefangene Aufträge werden nachgedruckt, nichts geht verloren.',
      },
      {
        frage: 'Doppelstreifen und Schnittlinie',
        antwort:
          'Beides gehört zur Vorlage, nicht zum Druckdialog. Im Editor unter Druckregeln einschalten — die Schnittlinie erscheint mittig auf dem Blatt.',
      },
      {
        frage: 'Limits pro Gast und pro Stunde',
        antwort:
          'Bezahlung & Limits: Standard sind 2 Drucke pro Gast und 40 pro Stunde. Bei erreichtem Limit zeigt der Booth einen Hinweis, keinen Fehler.',
      },
    ],
  },
  {
    name: 'Teilen & Galerie',
    icon: 'qr',
    artikel: [
      {
        frage: 'QR ohne Internet',
        antwort:
          'Hotspot der Box aktivieren: Gäste verbinden sich mit dem Box-WLAN und laden die Datei direkt. Uploads in die Cloud folgen später automatisch.',
      },
      {
        frage: 'WhatsApp, Mail und SMS',
        antwort:
          'Ausgabe & Teilen: einzeln schaltbar. SMS ist als Fallback gedacht, wenn Gäste keine App nutzen.',
      },
      {
        frage: 'Löschfrist ändern',
        antwort:
          'Standard sind 30 Tage pro Event, im Cockpit pro Kunde verlängerbar. Die Frist steht sichtbar in der Galerie — das beruhigt Gäste.',
      },
      {
        frage: 'Gäste-Upload freigeben',
        antwort:
          'Upload ist pro Event schaltbar, mit oder ohne Moderation. Für Mosaik-Wände „nur Booth" wählen, dann erscheinen keine Handybilder.',
      },
    ],
  },
  {
    name: 'Betrieb & Fernsteuerung',
    icon: 'fernbedienung',
    artikel: [
      {
        frage: 'Fernauftrag: auslösen, pausieren',
        antwort:
          'Cockpit oder Handy-App: Auslösen, Pause, Testdruck, Queue leeren. Aufträge werden mit dem nächsten Puls abgeholt, auch im Box-Hotspot.',
      },
      {
        frage: 'Hardware-Taster anlernen',
        antwort:
          'Taster verbinden, in der App drücken, Funktion zuordnen. Alles was sich als Tastatur oder Gamepad meldet, funktioniert.',
      },
      {
        frage: 'Update einspielen',
        antwort:
          'Updates werden von euch angestoßen, nie automatisch mitten im Event. Im Cockpit „Update einspielen", die Box startet zwischen zwei Sessions neu.',
      },
      {
        frage: 'Box offline — was tun?',
        antwort:
          'Der Booth läuft lokal weiter. Ohne Netz fehlen nur Cloud-Galerie und Fernauftrag; beides holt sich die Box nach, sobald sie wieder online ist.',
      },
    ],
  },
  {
    name: 'Vermietung',
    icon: 'kalender',
    artikel: [
      {
        frage: 'Buchungsseite veröffentlichen',
        antwort:
          'Modul Vermietung & Buchung aktivieren, Pakete pflegen, Adresse setzen. Die Seite läuft unter eurer Marke, ohne youbooth-Logo.',
      },
      {
        frage: 'Blockzeiten und Wartung',
        antwort:
          'Im Kalender eintragen — die öffentliche Seite zeigt diese Tage als belegt, Doppelbuchungen sind damit ausgeschlossen.',
      },
      {
        frage: 'Vertrag und Anzahlung',
        antwort:
          'Nach der Bestätigung automatisch: Vertrag, Anzahlung, Erinnerung sieben Tage vorher. Zahlungsstand steht am Auftrag.',
      },
      {
        frage: 'Statistik als Beleg',
        antwort:
          'Pro Event: Sessions, Ausdrucke, Galerie-Aufrufe. Als PDF exportierbar, gut für Schlussrechnungen und Nachverhandlungen.',
      },
    ],
  },
];

export const artikelZahl = kategorien.reduce((n, k) => n + k.artikel.length, 0);
