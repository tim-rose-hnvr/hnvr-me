# youbooth — Booth

Die Software auf der Box: Attract, Aufnahme, Ergebnis, Ausgabe. Läuft im Browser und — als
Desktop-App verpackt — auf Windows und macOS. Die Website dazu liegt in `../youbooth`.

## Stand

| Teil | Stand |
|---|---|
| Booth-Ablauf (Attract → Auswahl → Countdown → Aufnahme → Ergebnis → Ausgabe) | läuft |
| Kamera über die Systemkamera/Webcam | läuft |
| Sieben Papierformate bei 300 dpi, eine Quelle für Booth und Editor | läuft |
| 55 Druckvorlagen (4 eigene, 51 aus dem Katalog) mit Hintergrundbildern | läuft |
| Layout-Renderer: Bildfeld, Text, Fläche, Logo, Bilddatei, QR — mit Drehung | läuft |
| Doppelstreifen mit Schnittlinie (nur beim 2×6-Blatt) | läuft |
| Aufnahme sichern (lokal, vor jeder Ausgabe) | läuft |
| Druck über das Betriebssystem — randlos, ohne Dialog (Windows und macOS) | läuft |
| Datei sichern | läuft |
| QR-Code und lokale Auslieferung über den Hotspot der Box | läuft (in der Desktop-Hülle) |
| Einstellungen mit Kiosk-PIN | läuft |
| Leerlauf-Rückkehr, Auto-Weiter, Druck-Stundenlimit, Löschfrist | läuft |
| Foto-Wall für Beamer und TV | läuft |
| Kunden-Galerie mit Filter und Großansicht | läuft |
| Installations-Zentrum mit echter Selbstprüfung | läuft |
| Booth-Editor: Druckvorlagen entwerfen, Vorschau = Druckbild | läuft |
| Fernauslöser am Telefon der Gäste, aus dem WLAN der Box | läuft (in der Desktop-Hülle) |
| Bewegung: Attract-Stil, Countdown-Stil, Übergang, Blitz | läuft, im Kiosk-Menü umstellbar |
| Bewegtbild (Boomerang, GIF) als Datei — eigener GIF-Kodierer | läuft |
| DSLR-Tethering, Drucker-Sonderfunktionen, Freistellung, Cloud | offen, siehe unten |

## Aufbau in zwei Teilen

Die Box besteht aus **einem Server** und **einer Oberfläche**.

Der Server (`server/`) stammt aus der Fassung 1.30 und ist der Teil, der ohne
ihn nicht geht: Er hält Einstellungen, Vorlagen und Aufnahmen als Dateien,
liefert sie im WLAN aus und verteilt Ereignisse über WebSocket. **Deshalb sehen
Foto-Wall am Beamer, Galerie auf dem Handy und die Teilen-Station dieselben
Bilder** — vorher lagen sie in IndexedDB und waren nur in genau einem Browser
sichtbar.

Die Oberfläche (`src/`) ist unsere: unser Gestaltungssystem, unsere Seiten,
TypeScript und Vite. Gebaut landet sie in `dist/`, und der Server liefert sie
aus.

## Starten

```bash
npm install
npm run server   # die Box auf http://localhost:3377 (liefert dist/ aus)
npm run dev      # daneben Vite auf http://localhost:4400 mit Neuladen beim Tippen
                 #   im Kiosk führen die Einstellungen (PIN) zu allen Oberflächen
                 #   /cockpit.html      Betreiber-Ansicht
                 #   /wand.html         Foto-Wall für Beamer
                 #   /galerie.html      Kunden-Galerie
                 #   /einrichtung.html  Installations-Zentrum
                 #   /editor.html       Booth-Editor (Druckvorlagen)
npm run build    # Oberfläche nach dist/ — danach genügt `npm run server`
npm run huelle   # als Desktop-App (Electron, startet die Box selbst)
npm run paket    # Installationspaket für das eigene System
```

Weitere Oberflächen, die nicht im Kiosk hängen:

```
/portal.html   Betreiber-Portal: Buchungen, Kalender, Pakete, Event-Seiten, Tickets
/buchen.html   öffentliche Buchungsseite für Kunden
/m/<kennung>   Event-Seite für einen Kunden nach der Feier
/fern          Fernauslöser für das Handy des Gastes
```

## Windows-Paket und Selbstaktualisierung

`.github/workflows/paket.yml` baut auf einem Windows-Runner den NSIS-Installer und hängt ihn an
eine GitHub-Release. Ausgelöst wird das über einen Tag `booth-v<Fassung>` oder von Hand.

Die installierte App sieht danach selbst nach neuen Fassungen — `electron-updater` fragt dieselbe
Release-Liste ab. Heruntergeladen wird sofort, **eingespielt aber erst beim Beenden**: Ein
Neustart mitten in einer Feier ist der teuerste Fehler, den eine Selbstaktualisierung machen kann.
Wer nicht warten will, bekommt einen Knopf dafür.

**Codesigning fehlt noch.** Ohne Zertifikat zeigt Windows SmartScreen beim ersten Start eine
Warnung. Sobald ein Zertifikat (EV oder OV) vorliegt: als Secret hinterlegen und im Workflow vor
dem Hochladen signieren. Für macOS gilt dasselbe mit einem Apple-Developer-Konto (Signieren und
Notarisieren), sonst blockt Gatekeeper.

## Aufbau

```
src/
  haupt.ts           Einstieg des Booths
  ablauf.ts          Zustandsmaschine und Oberfläche des Booths
  cockpit.ts         Betreiber-Ansicht
  wand.ts            Foto-Wall
  galerie.ts         Kunden-Galerie
  einrichtung.ts     Installations-Zentrum
  editor.ts          Booth-Editor
  vorlage.ts         Vorlagenmodell und Renderer — hier entsteht jedes Druckbild
  vorlagen.ts        Ablage der Vorlagen (eigene, Katalog, die des Betreibers)
  formate.ts         die sieben Papierformate und die Druckschriften
  daten/vorlagen-katalog.json   51 uebernommene Blaetter
  portal.ts          Betreiber-Portal: Buchungen, Kalender, Pakete, Event-Seiten, Tickets
  buchen.ts          öffentliche Buchungsseite
  event.ts           Event-Seite für den Kunden nach der Feier
  fern.ts            Fernauslöser fürs Handy
  draht.ts           offene Verbindung zur Box (Aufnahmen, Einstellungen, Vorlagen)
  huelle.ts          Brücke zur Box (Drucken, Adresse) und zur Desktop-Hülle
  arten.ts           die Aufnahmearten
  kamera.ts          Kamera — hier hängt später das DSLR-Tethering
  layout.ts          Blatt, Doppelstreifen, Ausgabeformate
  gif.ts             GIF-Kodierer fuer Boomerang und GIF
  ausgabe.ts         Druck, Datei, QR, Stundenlimit
  speicher.ts        lokale Ablage der Aufnahmen
  einstellungen.ts   Konfiguration der Box
  stil.css           Booth-Optik (dunkel, Ziele ≥ 64 px)
huelle/              Desktop-Hülle (Electron): startet die Box, Vollbild, Selbstaktualisierung
server/              die Box: Aufnahmen, Einstellungen, Vorlagen, Buchungen, Druck
```

## QR-Download ohne Internet

Die Box liefert ihre Aufnahmen selbst aus — über denselben Server, der auch die Oberflächen
zeigt. Der QR-Code am Screen zeigt auf `http://<Adresse der Box>:3377/…`; welche Adresse das ist,
weiß die Box (`/api/info`), nicht der Browser: Der kennt nur `localhost`, und darauf zeigt kein
brauchbarer QR-Code.

Das gilt im Browser genauso wie in der Desktop-Hülle. Vorher konnte nur die Hülle drucken und
ausliefern — die Teilen-Station daneben und das Handy im WLAN nicht.

## Vorlagen

Eine Vorlage beschreibt ein Blatt und die Felder darauf: Bildfelder, Textfelder, Flächen, Logo,
Bilddateien, QR-Codes — jedes mit Drehung, Schatten, Rahmen und runden Ecken. Feldkoordinaten sind
Anteile des Blattes, im Editor als Millimeter angezeigt; gerechnet wird auf 300 dpi. Texte tragen
Platzhalter (`{event}`, `{datum}`, `{zeit}`, `{box}`, `{nummer}`), die beim Druck gefüllt werden.

Sieben Papierformate stehen einmal in `formate.ts` und werden von Booth und Editor gelesen —
Streifen 2×6, Postkarte 4×6 quer und hoch, Quadrat 4×4, Groß 5×7, Magnet, Lesezeichen. Die Maße an
zwei Stellen zu halten war in der Vorfassung teuer: Bei 41 von 78 Vorlagen rechnete der Editor mit
einem anderen Blatt als der Druck.

Wie viele Aufnahmen eine Serie hat, entscheidet die **Vorlage**, nicht die Aufnahmeart. Ein Blatt
mit vier Bildfeldern bekommt vier Aufnahmen.

### Der Katalog

51 Vorlagen kommen aus der Fassung 1.30 (`tools/vorlagen-uebernehmen.mjs`), samt Hintergrundbildern
und den drei Druckschriften als woff2 auf der Box. Acht dort selbst gezeichnete Blätter fehlen
bewusst: In ihre Hintergrundbilder ist der alte Produktname eingebrannt — ein Werkzeug kann Dateien
umbenennen, keine Pixel. Sie kommen wieder, wenn sie in unserer Gestaltung neu entstehen.

`node tools/vorlagen-durchsehen.mjs` zeichnet bei laufendem `npm run dev` jede einzelne Vorlage und
prüft: Hintergrund da, jedes Bildfeld trägt ein Foto, jeder Text auf dem Blatt.

## Drucken

In der Desktop-Hülle druckt die Box selbst — randlos zentriert, ohne Dialog: Auf einer Feier steht
niemand am Rechner, der ein Fenster wegklickt. Unter Windows über `System.Drawing.Printing`, unter
macOS und Linux über CUPS (`lp -o fit-to-page`). Der Drucker wird im Installations-Zentrum aus der
Liste des Betriebssystems gewählt, nicht getippt.

Im Browser bleibt der Systemdruckdialog. Schlägt der Druck fehl, sagt die Box es dem Gast und
nennt den Grund des Druckers — ein Knopf, der nichts tut, ist schlimmer als eine Absage.

Der Booth kennt keine festen Layouts mehr — er rendert die eingestellte Vorlage. Der Editor
zeichnet die Vorschau mit demselben Renderer, deshalb ist sie kein Bild von etwas Ähnlichem,
sondern das Druckbild selbst. Vorlagen liegen als JSON vor und wandern als Datei auf die nächste
Box; eingelesene Dateien werden geprüft, bevor sie übernommen werden.

Die vier mitgelieferten Vorlagen stehen im Code und sind schreibgeschützt: die erste Änderung legt
eine Kopie an. Der Weg zurück bleibt damit offen, auch nach einer verunglückten Nacht am Editor.

## Bewegtbild

Boomerang und GIF werden nicht nur animiert gezeigt, sondern als Datei ausgegeben. Der Kodierer
steht in `gif.ts` und ist selbst geschrieben — GIF89a mit globaler Farbtabelle (Median-Cut, 256
Farben), LZW und NETSCAPE-Schleife. Kein Nachladen aus dem Netz, auch nicht beim ersten Start in
einem fremden WLAN.

Die Serie läuft als Pingpong: vor und zurück, damit die Schleife ohne Sprung durchläuft. Kodiert
wird auf 480 Pixel Breite, **nachdem** das Blatt gesichert und gezeigt wurde — der Gast wartet
nicht auf die Rechenzeit. Acht Aufnahmen ergeben 14 Einzelbilder in gut einer halben Sekunde.

Der QR-Code zeigt bei Boomerang und GIF auf die Bewegung (`/f/<kennung>.gif`), sonst auf das
Standbild. Der Auslieferungsdienst kennt genau zwei Endungen; alles andere landet als `jpg` in der
Ablage.

## Fernauslöser

Der Attract sagt „per Fernbedienung am Handy auslösen" — das löst der Auslieferungsdienst ein.
Unter `/fern` liegt eine Seite mit genau einem Knopf; ein POST auf `/fern/ausloesen` erhöht einen
Zähler in der Hülle. Der Booth fragt diesen Zähler ab und startet die Aufnahme, wenn er steigt.

Bewusst ein Zähler statt eines Ereignisses: eine verpasste Abfrage verschluckt nichts, und von
außen lässt sich nichts weiter anstoßen als das Hochzählen einer Zahl. Ausgelöst wird nur aus
Attract oder Auswahl — wer während einer laufenden Serie tippt, unterbricht niemanden. Der QR zum
Auslöser steht im Attract, aber nur, wenn die Box den Dienst tatsächlich anbietet.

## Bewegung

Drei Stellschrauben im Kiosk-Menü: Attract-Stil (ruhig, pulsender Startknopf, Laufband mit eigenem
Text), Countdown-Stil (Ring, Zahl, Balken) und der weiche Auftritt beim Schrittwechsel. Dazu der
Blitz im Auslösemoment.

Zwei Regeln stecken darin: Der Auftritt dauert 220 ms und der Puls atmet über 2,4 s — nichts
blinkt, denn ein zappelnder Kiosk wirkt kaputt statt lebendig. Und wer am Gerät „Bewegung
reduzieren" eingestellt hat, bekommt keine Schleifen; das entscheidet das Betriebssystem, nicht das
Menü.

## Regeln, die im Code stecken

- **Erst sichern, dann zeigen.** `baueErgebnis()` legt die Aufnahme ab, bevor das Ergebnis am
  Screen erscheint. Schlägt das Sichern fehl, sagt die Box es und zeigt das Bild trotzdem — der
  Gast bekommt sein Bild.
- **Die Box bleibt nie hängen.** Leerlauf (45 s) holt sie zum Attract zurück, Auto-Weiter (8 s)
  verhindert, dass sie am Ergebnis stehen bleibt.
- **Gespiegelt zeigen, ungespiegelt drucken.** Gäste erwarten am Screen einen Spiegel; auf dem
  Abzug wäre Schrift dann seitenverkehrt.
- **Der Druck läuft über den Systemdruck.** Was das Betriebssystem kennt, kennt die Box.
- **Doppelstreifen mit Schnittlinie**: einer für den Gast, einer fürs Gästebuch.
- **Stundenlimit** für Drucke, damit das Material bis zum Ende reicht.
- **Löschfrist**: abgelaufene Aufnahmen räumt die Box beim Start weg.

## Offen — und warum

- **DSLR-Tethering.** Die Schnittstelle in `kamera.ts` (`starte`, `standbild`, `stoppe`) ist so
  geschnitten, dass ein nativer Weg (gphoto2, Canon EDSDK, Nikon SDK) dahinter passt, ohne die
  Oberfläche anzufassen. Ohne Kamera am Kabel lässt sich das nicht verlässlich schreiben.
- **Drucker-Sonderfunktionen.** Materialstand und der Schnitt im Gerät hängen am Treiber des
  jeweiligen Sofortdruckers. Randlos-zentriert steht, für Windows und macOS.
- **Bewegtbild als Video.** GIF steht; WebM oder MP4 wären kleiner und schärfer, hängen aber am
  Codec des jeweiligen Systems (MediaRecorder). Für den Gast am Handy reicht GIF.
- **Vorlagen-Katalog.** Mitgeliefert sind vier Vorlagen, nicht die 82 aus dem Katalog der
  Website. Sie entstehen mit demselben Modell — das ist Fleißarbeit, keine Technik.
- **Bildschirm-Designer und freie Schriften.** Der Editor gestaltet das Druckbild; die Screen-Seite
  und Schriften jenseits der beiden Systemschriften kommen später.
- **Freistellung ohne Greenscreen, Effekt-Studio, Cloud-Galerie, Lizenzserver.**
