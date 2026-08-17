# Projektanweisung — Design Studio

> Dieses Verzeichnis ist ein **eigenständiges Produkt** und hat mit dem Sitzungssystem im
> Wurzelverzeichnis nichts zu tun. Die Leitprinzipien dort (Offline-Zwang, kein CDN,
> keine Cloud) gelten hier **nicht** und sind teilweise das Gegenteil dessen, was hier
> gebraucht wird. Es liegt nur vorübergehend im selben Repository und ist so gebaut,
> dass `git subtree split --prefix=design-studio` es ohne Umbau herauslöst.

---

## Was gebaut wird

Ein einbettbarer Design-Editor als eigenes Produkt. Kunden erzeugen daraus markenkonforme
Social-Media-Grafiken und druckfertige PDFs. Ausgeliefert wird er zweifach: als eigenständige
Anwendung (Astro auf Wix Headless) und als Custom Element zum Einbau in fremde Projekte.

**Nicht** das Ziel: Canva ersetzen. Ziel ist der Ausschnitt, den Canva schlecht macht —
erzwungene Markenkonformität und saubere Druckvorstufe.

---

## Leitprinzipien

1. **Kein Render-SDK, nirgends.** Der Editor zeichnet über `render`, das Druck-PDF
   entsteht über `export`. Beides steht unter MIT-lizenzierten Bausteinen. Es gibt keine
   Lizenzgebühr und keine Domain-Klausel — das war der Grund, warum `editor-core` von
   Anfang an SDK-frei gebaut wurde, und es hat sich ausgezahlt.
2. **Vorlage zuerst, freies Gestalten als Ausnahme.** Der Standardfall ist ein gesperrtes
   Layout mit ausgefüllten Platzhaltern. Kunden sollen markenkonforme Ergebnisse bekommen,
   keine kreative Spielwiese.
3. **Der Druckpfad ist kein Sonderfall.** Anschnitt, Endformat und Sicherheitsabstand sind
   im Modell, nicht im Export. Ein Entwurf, der für Instagram gebaut wurde, muss ohne
   Datenverlust auf A4 kommen.
4. **Alles Wix-Spezifische lebt in `wix-adapter`.** Die Speicherschnittstelle
   (`EntwurfSpeicher`, `AssetSpeicher`) ist die Grenze. Ein anderer Anbieter ist ein zweiter
   Adapter, keine Änderung im Kern.

---

## Einheiten — einmal lesen, dann nie wieder diskutieren

Alle Koordinaten und Maße im Dokument sind **Pixel bei der `dpi` des Entwurfs**.
Eine Einheit, überall, keine Mischung.

- Bildschirm: `dpi: 72` — dann gilt 1 px = 1 pt, und PDF-Punkte sind identisch.
- Druck: `dpi: 300` — A4 ist dann 2480 × 3508 px.
- Millimeter sind eine reine Anzeigeeinheit. Umrechnung nur über `mmZuPx` / `pxZuMm`.

Ursprung ist die **linke obere Ecke des Endformats**. Elemente im Anschnitt haben
negative Koordinaten. Das ist gewollt.

---

## Sechs Regeln, die aus echten Fehlern stammen

Jede davon war einmal falsch und ist durch einen Test abgesichert. Wer sie
aufweicht, holt den Fehler zurück.

1. **Verschmelzbare Kommandos brauchen absolute Umkehrungen.** Der Stack behält
   beim Verschmelzen nur die Umkehrung des *ersten* Kommandos. Eine relative
   Umkehrung (`-dx`) nahm von zehn Ziehschritten genau einen zurück. Deshalb ist
   die Umkehrung von `ElementVerschieben` ein `ElementPositionSetzen`.
2. **Jedes Format trägt seine natürliche Einheit.** Druck in mm, Bildschirm in px.
   Der Umweg über Millimeter ergab 1919,99 px für die Instagram Story statt 1920.
   Bildschirmformate müssen pixelgenau sein.
3. **Private Wix-Dateien sind über ihre `url` nicht lesbar** — sie antwortet mit
   403. Lesen geht nur über eine befristete URL aus `generateFileDownloadUrl`,
   und das braucht erhöhte Rechte, also eine Serverfunktion.
4. **Schriften nur als `data:`-URI.** Eine per `setContent` gesetzte Seite hat
   keine Dateiherkunft; Chromium verweigert dann jeden `file://`-Unterabruf und
   setzt lautlos in der Ersatzschrift weiter.
5. **CSS-Zeichenketten in `style`-Attributen brauchen einfache Anführungszeichen.**
   `JSON.stringify` beendet das Attribut vorzeitig — wieder stille Ersatzschrift.
6. **Weiche Trennstriche sind nicht an ihrer Breite zu erkennen.** Chromium gibt
   ihnen auch mitten im Wort etwa 0,02 px. Wer das als „gesetzt" liest, streut
   Bindestriche über den ganzen Text. Der sichtbare Trennstrich am Zeilenende ist
   umgekehrt gar kein Zeichen, sondern wird vom Umbruch erzeugt — er muss beim
   Zeilenwechsel selbst gesetzt werden.

Vier bis sechs haben dasselbe Muster: **der Fehlerfall ist nicht der Absturz,
sondern das falsche, plausibel aussehende Ergebnis.** Keiner wäre ohne
Sichtprüfung aufgefallen — deshalb legt die Ausgabekette neben jedes PDF einen
PNG-Abzug.

Und die Lehre für Tests: **Doppelgänger müssen so unfreundlich sein wie der
echte Dienst.** Fehler 3 blieb nur deshalb liegen, weil der Testdoppelgänger
eine URL zurückgab, die funktionierte — der echte Media Manager tut das nicht.
Fehler 5 blieb liegen, weil der Test den *angeforderten* statt den *benutzten*
Font prüfte.

## Werkzeuge

```bash
pnpm run check      # Linter, Typen, Tests mit Abdeckung — das Tor vor jedem Commit
pnpm run lint:fix   # Biome formatiert und räumt auf
pnpm run spike      # Selbsttest des CSP-Spikes, braucht einen Chromium
```

Abdeckungsschwellen sind Sperrklinken knapp unter dem Ist-Stand: sie melden
einen Rückschritt, sie sind kein Ziel. Wer eine Schwelle senkt, begründet es im
Commit.

Biome und TypeScript sind aufeinander abgestimmt: `noPropertyAccessFromIndexSignature`
verlangt Klammerzugriff bei Index-Signaturen, deshalb ist Biomes `useLiteralKeys`
abgeschaltet. Die beiden dürfen sich nicht widersprechen.

## Aufbau

```
packages/
  editor-core/   Dokumentmodell, Kommando-Stack, Markenkit, Vorlagen — framework-frei
  render/        Entwurf → HTML, mit Silbentrennung. Ein Renderer für beides.
  export/        Satz im headless Browser → PDF/X-4 in CMYK
  editor-ui/     Auswahl, Ziehen, Live-Prüfung — ohne Rahmenwerk
  wix-adapter/   Wix Data, Media, Members hinter der Speicherschnittstelle
  embed/         Custom Element für Fremdprojekte         (noch nicht angelegt)
apps/
  studio/        Probemodell — eine HTML-Datei, alles eingebettet
  spike-pdf/     Messung: läuft WASM im Browser unter Wix-CSP?
```

**Der Renderer ist derselbe für Bildschirm und Druck.** Editor und PDF laufen
beide durch `packages/render`. Deshalb kann die Vorschau nicht lügen, und es
gibt keinen zweiten Renderer, der irgendwann auseinanderläuft.

**Kein Rahmenwerk in `editor-ui`.** Der Editor soll als Custom Element in fremde
Seiten gehen, ohne dort React zu erzwingen.

---

## Arbeitsweise

- **Sprache Deutsch** in Bezeichnern, wo es die Fachdomäne betrifft (`entwurf`, `seite`,
  `vorlage`, `markenkit`, `anschnitt`). Technische Begriffe bleiben englisch, wo etabliert
  (`Kommando`-Stack heißt `KommandoStack`, aber `Store`, `Adapter`, `Schema` bleiben).
- **Lauffähiger Code mit Tests.** Die Regeln oben sind testbar und werden getestet.
- **Keine erfundenen APIs.** Wix-Aufrufe gegen die Dokumentation prüfen, nicht raten.
- **Widersprich, wenn etwas falsch ist.**

---

## Offene Punkte

- **ICC-Profil einbetten.** Im OutputIntent steht bisher nur die registrierte
  Druckbedingung, kein `/DestOutputProfile`. Für strenge Abnehmer muss ein CMYK-Profil
  hinein; die Lizenzlage der ECI-Profile ist vorher zu klären.
- **Preflight-Abnahme.** veraPDF prüft kein PDF/X (die Profile enden bei PDF/A-4). Vor dem
  ersten echten Auftrag muss ein Preflight-Werkzeug oder die Druckerei gegenlesen.
- **Farbmanagement.** `export/farbe.ts` rechnet ohne ICC um: vorhersagbar, aber nicht
  farbverbindlich. Echte Umrechnung über Little CMS als WASM.
- **Serverfunktion für Wix-Medien.** Private Dateien brauchen eine befristete Download-URL,
  und der Aufruf verlangt erhöhte Rechte. `WixBlobSpeicher.downloadUrlAufloeser` ist dafür
  schon austauschbar — der Endpunkt fehlt.
- **Griffe ziehen noch nicht.** `rahmenNachGriff` ist da und getestet, die Anbindung an
  Zeigerereignisse fehlt.
- Schrifteinbettung im PDF braucht Embedding-Lizenzen. Bis auf Weiteres nur SIL-OFL-Schriften.
- Polotno bleibt eine Option für die Oberfläche, ist aber **nicht mehr blockierend**.
  Falls es doch gekauft wird: Domain-Klausel prüfen.
