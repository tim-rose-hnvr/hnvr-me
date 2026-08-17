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
| QR-Code | erzeugt, zeigt auf die Ausgabe-Adresse der Box — der lokale Auslieferungsdienst fehlt noch |
| Einstellungen mit Kiosk-PIN | läuft |
| Leerlauf-Rückkehr, Auto-Weiter, Druck-Stundenlimit, Löschfrist | läuft |
| Bewegtbild (Boomerang, GIF) | Aufnahme und Vorschau laufen; die Videodatei fehlt noch |
| DSLR-Tethering, Drucker-Sonderfunktionen, Freistellung, Cloud | offen, siehe unten |

## Starten

```bash
npm install
npm run dev      # Booth im Browser auf http://localhost:4400
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
  haupt.ts           Einstieg
  ablauf.ts          Zustandsmaschine und Oberfläche des Booths
  arten.ts           die Aufnahmearten
  kamera.ts          Kamera — hier hängt später das DSLR-Tethering
  layout.ts          Canvas-Renderer: Foto, Streifen, Doppelstreifen
  ausgabe.ts         Druck, Datei, QR, Stundenlimit
  speicher.ts        lokale Ablage der Aufnahmen
  einstellungen.ts   Konfiguration der Box
  stil.css           Booth-Optik (dunkel, Ziele ≥ 64 px)
src-tauri/           Desktop-Hülle (Rust)
```

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
- **QR-Auslieferung.** Der QR-Code zeigt auf `<Ausgabe-Adresse>/f/<Kennung>`. Damit er trägt,
  braucht die Box einen kleinen lokalen Dateiserver im eigenen Hotspot — der ist der nächste
  Schritt in der Desktop-Hülle.
- **Bewegtbild als Datei.** Boomerang und GIF werden aufgenommen und am Screen animiert gezeigt;
  für die Datei fehlt die Kodierung (GIF oder WebM).
- **Freistellung ohne Greenscreen, Effekt-Studio, Cloud-Galerie, Lizenzserver.**
