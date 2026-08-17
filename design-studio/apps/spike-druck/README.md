# Spike: druckfertiges PDF ohne Lizenzkosten

**Frage:** Lässt sich aus einem Entwurf ein PDF/X-4 in CMYK erzeugen, ohne eine
Lizenz zu bezahlen — weder für ein Render-SDK noch für Ghostscript?

**Antwort: ja.** Die Kette läuft und ist durch Tests abgesichert.

```
Entwurf-JSON → HTML → Chromium setzt → Glyphen ablesen → pdf-lib → PDF/X-4 CMYK
```

## Ergebnis am Prüfentwurf

| geprüft | Ergebnis |
|---|---|
| Glyphenpositionen aus dem Browser | 182 Glyphen, 2 Textläufe |
| Zeilenumbruch | vom Browser, 3 Zeilen |
| Blocksatz | Zeilen enden exakt an der Rahmenkante |
| Farbraum | 0 RGB-Operatoren, alles CMYK |
| Schwarz | `0 0 0 1 k` — K-only, wie es der Druck verlangt |
| Buntfarben | echte Vierfarbmischungen |
| TrimBox | 8,504 pt = exakt 3 mm Anschnitt |
| Schrift | eingebettet als `/FontFile2`, Teilmenge |
| PDF/X-4-Struktur | vollständig, ein offener Hinweis (ICC, siehe unten) |

Alle benutzten Bibliotheken stehen unter **MIT**: `pdf-lib`, `@pdf-lib/fontkit`,
`playwright-core`. Kein Ghostscript, kein Render-SDK, keine Domain-Klausel.

## Ausführen

```bash
pnpm --filter @studio/spike-druck test    # die ganze Kette, mit Zusicherungen
pnpm exec tsx apps/spike-druck/bin/erzeuge.mjs   # erzeugt ausgabe/spike.pdf und ausgabe/abzug.png
```

Ohne Chromium oder ohne die DejaVu-Schriften überspringt sich der Kettentest
selbst — er meldet das aber, statt stillzuschweigen.

## Drei Fallen, die beim Bauen zugeschnappt sind

Jede davon hätte in Produktion Geld gekostet, keine wäre ohne Sichtprüfung
aufgefallen. Sie sind der eigentliche Ertrag dieses Spikes.

**1. `file://`-Schriften laden nicht.** Eine per `setContent` gesetzte Seite hat
keine Dateiherkunft, Chromium verweigert dann jeden `file://`-Unterabruf. Die
Schrift lädt nicht, der Browser setzt lautlos in einer Ersatzschrift weiter, und
der Umbruch stimmt für eine Schrift, die nie im PDF landet. Schriften gehen
deshalb als `data:`-URI in die Seite.

**2. Der naheliegende Test dafür greift nicht.** `getComputedStyle().fontFamily`
gibt den *Wunsch* wieder, nicht die *benutzte* Schrift — der Test war grün,
während der Abzug Serifen zeigte. Die Vermessung fragt jetzt
`document.fonts.check()`, und der Kettentest scheitert bei Ersatzschrift.

**3. Anführungszeichen im `style`-Attribut.** `JSON.stringify` liefert doppelte
Anführungszeichen und beendet damit das umgebende `style="…"`. Wieder kein
Fehler, wieder stille Ersatzschrift. CSS-Zeichenketten in Attributen brauchen
einfache Anführungszeichen.

Das Muster ist dreimal dasselbe: **der Fehlerfall ist nicht der Absturz, sondern
das falsche, plausibel aussehende Ergebnis.** Deshalb liegt neben dem PDF immer
ein PNG-Abzug — ohne Sichtprüfung fällt so etwas nicht auf.

## Zwei Korrekturen an früheren Annahmen

**veraPDF prüft kein PDF/X.** Der Plan war, gegen veraPDF zu validieren. Die
eingebauten Profile enden bei PDF/A-4 und PDF/UA-2 — für PDF/X gibt es im
offenen Bereich keinen gleichwertigen Prüfer. `src/pruefung.ts` prüft die
Anforderungen aus ISO 15930-7 deshalb selbst, auf Objektebene. veraPDF bleibt
als Lesbarkeitsgegenprobe eingebaut, ausdrücklich nicht als PDF/X-Urteil.
**Vor dem ersten echten Auftrag muss ein Preflight-Werkzeug oder die Druckerei
gegenlesen.**

**`hyphens: auto` wirkt in headless Chromium nicht.** Silbentrennung war eines
der Argumente für diesen Weg, und sie kommt nicht umsonst: die Trennmuster
fehlen im headless Build, gemessen an gleicher Zeilenhöhe mit und ohne. Der
Ersatzweg ist geprüft und funktioniert: **vorab eingesetzte weiche Trennstriche**
(`&shy;`) steuern den Umbruch zuverlässig. Es braucht also eine Trennbibliothek,
die serverseitig vor dem HTML-Aufbau läuft. Die Vermessung behandelt weiche
Trennstriche bereits richtig — unsichtbar wird übersprungen, am Zeilenende wird
ein gewöhnlicher Bindestrich ins PDF geschrieben.

## Was noch fehlt

| Punkt | Lage |
|---|---|
| **ICC-Profil** | Es wird nur die registrierte Druckbedingung eingetragen, kein `/DestOutputProfile`. Für strenge Abnehmer muss ein CMYK-Profil eingebettet werden — die Lizenzlage der ECI-Profile ist vorher zu klären. |
| **Silbentrennung** | Trennbibliothek auswählen und vor dem HTML-Aufbau einsetzen (siehe oben). |
| **Farbmanagement** | `farbe.ts` rechnet ohne ICC um. Vorhersagbar, aber nicht farbverbindlich. Echte Umrechnung über Little CMS als WASM. |
| **Bilder** | Werden gesetzt, aber noch nicht ins PDF übernommen. Braucht CMYK-Wandlung und Auflösungsprüfung. |
| **Mehrere Seiten** | Der Schreiber legt eine Seite an. |
| **Ligaturen** | Die Vermessung arbeitet auf Zeichen-, nicht auf Glyphenebene. Für lateinische Texte tragfähig; für Arabisch oder Devanagari müsste HarfBuzz einsteigen. |
| **Drehung bei Text** | Flächen werden gedreht, Textläufe noch nicht. |

Nichts davon stellt den Weg in Frage — es ist Arbeit, kein Risiko.

## Warum serverseitig und nicht im Kundenbrowser

Der Satz läuft in headless Chromium auf dem Server. Liefe er beim Kunden, hinge
das PDF davon ab, ob jemand Safari auf dem iPad oder Chrome auf Windows benutzt
— zwei Bestellungen desselben Entwurfs kämen unterschiedlich aus der Druckerei.

Das ist kein zusätzlicher Aufwand: eine Serverfunktion wird ohnehin gebraucht,
weil private Wix-Dateien nur über eine befristete Download-URL lesbar sind und
dieser Aufruf erhöhte Rechte verlangt. Nebenbei entschärft es den CSP-Spike —
ohne WASM im Browser ist die Frage nach `wasm-unsafe-eval` für den Druckpfad
gegenstandslos.
