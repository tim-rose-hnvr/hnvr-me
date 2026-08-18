# youbooth — Booth

Die Software auf der Box: Attract, Aufnahme, Ergebnis, Ausgabe. Läuft im Browser und — als
Desktop-App verpackt — auf Windows und macOS. Die Website dazu liegt in `../youbooth`.

## Stand

| Teil | Stand |
|---|---|
| Booth-Ablauf (Attract → Auswahl → Countdown → Aufnahme → Ergebnis → Ausgabe) | läuft |
| Kamera über die Systemkamera/Webcam | läuft |
| Layout-Renderer: Foto, Streifen, Doppelstreifen mit Schnittlinie | läuft |
| Aufnahme sichern (lokal, vor jeder Ausgabe) | läuft |
| Druck über den Systemdruckdialog | läuft |
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

## Starten

```bash
npm install
npm run dev      # Booth im Browser auf http://localhost:4400
                 #   /cockpit.html      Betreiber-Ansicht
                 #   /wand.html         Foto-Wall für Beamer
                 #   /galerie.html      Kunden-Galerie
                 #   /einrichtung.html  Installations-Zentrum
                 #   /editor.html       Booth-Editor (Druckvorlagen)
npm run build    # Weboberfläche nach dist/
npm run tauri dev    # als Desktop-App (braucht Rust)
npm run tauri build  # Installationspaket
```

## Windows-Paket

Das Paket baut die GitHub Action `.github/workflows/booth-windows.yml` auf einem Windows-Runner
(NSIS-Installer und MSI). Auslöser ist jeder Push auf `booth/**`, manuell startbar über
„Run workflow". Das Ergebnis liegt als Artefakt `youbooth-windows` am Lauf.

**Codesigning fehlt noch.** Ohne Zertifikat zeigt Windows SmartScreen beim ersten Start eine
Warnung. Sobald ein Zertifikat (EV oder OV) vorliegt: als Secret hinterlegen und im Workflow vor
dem Upload signieren. Für macOS gilt dasselbe mit einem Apple-Developer-Konto (Signieren und
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
  vorlagen.ts        Ablage der Vorlagen
  huelle.ts          Brücke zur Desktop-Hülle (Ablage als Datei, Ausgabe-Adresse)
  arten.ts           die Aufnahmearten
  kamera.ts          Kamera — hier hängt später das DSLR-Tethering
  layout.ts          Blatt, Doppelstreifen, Ausgabeformate
  gif.ts             GIF-Kodierer fuer Boomerang und GIF
  ausgabe.ts         Druck, Datei, QR, Stundenlimit
  speicher.ts        lokale Ablage der Aufnahmen
  einstellungen.ts   Konfiguration der Box
  stil.css           Booth-Optik (dunkel, Ziele ≥ 64 px)
src-tauri/           Desktop-Hülle (Rust)
```

## QR-Download ohne Internet

Die Desktop-Hülle legt jede Aufnahme als Datei ab und liefert sie über einen kleinen HTTP-Server
im eigenen Netz aus (`src-tauri/src/ausgabe.rs`, Port 8322). Der QR-Code am Screen zeigt auf
`http://<Adresse der Box>:8322/f/<Kennung>`. Ausgeliefert wird ausschließlich aus dem
Ablageordner und nur unter `/f/`; Kennungen werden gefiltert, damit von außen kein Pfadwechsel
möglich ist. Zwei Rust-Tests decken Auslieferung und Ausbruchsversuch ab (`cargo test`).

Im Browser ohne Hülle gibt es keine Adresse — dort bleibt der direkte Weg über „Sichern", und der
Booth sagt das auch.

## Vorlagen

Eine Vorlage beschreibt ein Blatt (`foto` 10×15 cm, `streifen` 5×15 cm) und die Felder darauf:
Bildfelder, Textfelder, Flächen, Logo. Feldkoordinaten sind Anteile des Blattes, im Editor als
Millimeter angezeigt; gerechnet wird auf 300 dpi. Texte tragen Platzhalter (`{event}`, `{datum}`,
`{zeit}`, `{box}`, `{nummer}`), die beim Druck gefüllt werden.

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
- **Drucker-Sonderfunktionen.** Randlos, Doppelstreifen-Schnitt und Materialstand hängen am
  Treiber des jeweiligen Sofortdruckers. Der generische Systemdruck steht.
- **Bewegtbild als Video.** GIF steht; WebM oder MP4 wären kleiner und schärfer, hängen aber am
  Codec des jeweiligen Systems (MediaRecorder). Für den Gast am Handy reicht GIF.
- **Vorlagen-Katalog.** Mitgeliefert sind vier Vorlagen, nicht die 82 aus dem Katalog der
  Website. Sie entstehen mit demselben Modell — das ist Fleißarbeit, keine Technik.
- **Bildschirm-Designer und freie Schriften.** Der Editor gestaltet das Druckbild; die Screen-Seite
  und Schriften jenseits der beiden Systemschriften kommen später.
- **Freistellung ohne Greenscreen, Effekt-Studio, Cloud-Galerie, Lizenzserver.**
