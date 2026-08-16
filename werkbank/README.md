# Werkbank — PDF

Eine PDF-Arbeitsumgebung im Browser: lesen, kommentieren, schwärzen, Formulare
ausfüllen, unterschreiben, Seiten umbauen, zusammenführen, teilen, vergleichen,
ausgeben. Läuft vollständig lokal — kein Server, kein Konto, kein Netz.

Sie ist als Gegenentwurf zu Adobe Acrobat gebaut: gleiche Arbeit, weniger
Bedienlast. Der Unterschied liegt nicht in der Zahl der Werkzeuge, sondern
darin, dass die Werkbank das geöffnete Dokument liest und von sich aus sagt,
was zu tun ist.

## Starten

Die Anwendung braucht einen Webserver — als `file://` verweigern Browser
ES-Module und Worker.

```sh
cd werkbank
python3 -m http.server 8080
# dann http://localhost:8080/ öffnen
```

Beim ersten Öffnen liegt eine Beispieldatei bereit (`Beispiel laden`); sie
lässt sich mit `node werkzeuge/beispiel-bauen.mjs` neu erzeugen.

## Was mitdenkt

Nach dem Laden liest die Werkbank bis zu 60 Seiten und zieht daraus Schlüsse.
Jeder Vorschlag steht rechts, nennt seinen Grund und erledigt die Arbeit auf
Knopfdruck. Nichts geschieht ungefragt; jeder Vorschlag lässt sich wegklicken
und kommt in dieser Sitzung nicht wieder.

| Befund | Vorschlag |
|---|---|
| Formularfelder offen | zum ersten leeren Feld springen, Schreibpunkt setzen |
| „Unterschrift", „Ort, Datum" im Text | Unterschrift anlegen und an der Stelle einsetzen |
| IBAN, E-Mail, Rufnummer, Geburtsdatum, Steuernummer | Fundstellen zeigen, Schwärzen-Werkzeug reichen |
| kein auswählbarer Text | sagen, dass es ein Scan ist — statt eine leere Suche liefern |
| Seiten ohne Text | auswählen, damit man über Trennblätter entscheiden kann |
| Schwärzungen gesetzt | vor dem Sichern erklären, dass die Seite gerastert wird |
| Metadaten mit Verfasser | vor der Weitergabe zum Entfernen anbieten |
| mehrere Quellen zusammengeführt | Reihenfolge prüfen lassen |
| dritte Hervorhebung in Folge | den Kniff dazu zeigen (Text markieren genügt) |

Dazu kommen kleine Aufmerksamkeiten: die Farbe wird je Werkzeug gemerkt (Gelb
zum Hervorheben, Tinte zum Schreiben), ein Tastendruck auf `H` wendet die
Hervorhebung sofort auf markierten Text an, statt nur umzuschalten, und der
Sicherungsdialog sagt vorher, welchen Weg die Ausgabe nimmt und was das kostet.

## Funktionsumfang

**Lesen** — fortlaufender Seitenfluss, nur Sichtbares wird gezeichnet; Zoom
(Breite, ganze Seite, 25–600 %), Ansichtsdrehung, Miniaturen, Lesezeichen,
Textauswahl, Volltextsuche mit Groß/klein und ganzem Wort, helle und dunkle
Fassung.

**Anmerken** — Hervorheben, Unterstreichen, Durchstreichen (aus der
Textauswahl), Notiz, Freihand, Text, Rechteck, Ellipse, Pfeil, Unterschrift.
Anmerkungen lassen sich wählen, verschieben, ändern, löschen; alles über
Rückgängig und Wiederholen. Anmerkungsliste mit Sprung zur Stelle und
Textbericht.

**Seiten** — umsortieren (ziehen), drehen, löschen, verdoppeln, auszugsweise
ausgeben, weitere Dateien anhängen, in gleich große Teile zerlegen.

**Formulare** — vorhandene AcroForm-Felder werden erkannt und direkt auf der
Seite ausgefüllt (Text, mehrzeilig, Ankreuzfeld, Auswahlliste, Optionsfeld).
Beim Sichern wahlweise ausfüllbar belassen oder fest einbrennen.

**Schwärzen** — Rechteck ziehen. Beim Sichern wird die betroffene Seite
gerastert und das Rechteck deckend gefüllt: der Text darunter ist danach
wirklich fort, nicht nur verdeckt. Das steht auch im Vorschlag, bevor es
passiert.

**Unterschreiben** — zeichnen, tippen oder als Bild laden; durchsichtiger
Rand wird abgeschnitten. Klick in ein Unterschriftsfeld setzt sie passend ein.

**Vergleichen** — zwei Dateien seitenweise wortweise gegenüberstellen.

**Ausgeben** — PDF, Text (`.txt`), Seite als PNG, Anmerkungsbericht.

**Bedienung** — Befehlspalette mit `Strg+K`; jede Fähigkeit ist ein Befehl und
über Werkzeugleiste, Palette, Tastenkürzel und Vorschlag gleichermaßen
erreichbar. Tastenkürzel unter `F1`.

## Was sie nicht kann

Ehrlicher als eine lange Merkmalsliste:

- **Keine Texterkennung (OCR).** Ein Scan bleibt ein Bild. Die Werkbank sagt
  das, statt eine leere Suche zu liefern.
- **Kein Kennwortschutz.** Geschützte Dateien lassen sich nicht öffnen und
  keine schützen. `pdf-lib` kann nicht verschlüsseln.
- **Keine kryptografische Signatur.** Die Unterschrift ist ein Bild. Für
  eIDAS-konformes Signieren braucht es Zertifikat und Signaturkarte.
- **Kein Umschreiben vorhandenen Fließtexts.** Neuer Text wird darübergelegt.
- **Lesezeichen** bleiben nur erhalten, solange Seitenfolge und Drehung
  unverändert sind (siehe Ausgabewege).

## Aufbau

```
index.html          Gerüst
app/kern.js         Zustand, Ereignisse, Dialoge, Meldungen, Historie
app/dokument.js     Quellen laden, Seitenfolge, Text, Merkmale, Formularfelder
app/ansicht.js      Seitenfluss, Zoom, Textebene, Koordinatenwandlung
app/anmerkungen.js  Anmerkungsmodell, Darstellung, Zeigerbedienung
app/seiten.js       Miniaturen, Auswahl, Umsortieren
app/suche.js        Volltextsuche und Trefferhervorhebung
app/formulare.js    AcroForm-Felder ausfüllen
app/unterschrift.js Unterschrift zeichnen, tippen, laden
app/vergleich.js    Wortvergleich zweier Dateien
app/mitdenken.js    Befunde und Vorschläge
app/ausgabe.js      Schreiben über pdf-lib
app/oberflaeche.js  Befehlsregister, Tafeln, Tastatur
fremd/              pdf.js und pdf-lib, siehe fremd/HERKUNFT.md
werkzeuge/          Beispieldatei bauen, Prüflauf fahren
```

### Datenmodell

Drei Listen tragen alles:

- **Quellen** — je geladener Datei die Bytes und das pdf.js-Dokument.
- **Folge** — die Seitenreihenfolge des Arbeitsdokuments. Ein Eintrag zeigt auf
  eine Quellseite und trägt eine zusätzliche Drehung. Zusammenführen, Einfügen,
  Umsortieren, Löschen und Verdoppeln sind damit derselbe Handgriff.
- **Anmerkungen** — Geometrie in PDF-Punkten der Quellseite (Ursprung unten
  links, ohne Seitendrehung). Deshalb sitzen sie bei jedem Zoom, jeder
  Ansichts- und Seitendrehung richtig — und die Ausgabe rechnet im selben
  Koordinatensystem, ohne Umrechnung.

Die Originaldatei wird nie verändert. Gesichert wird immer in eine neue Datei.

### Ausgabewege

Die Werkbank wählt selbst und sagt im Sicherungsdialog, welcher Weg gilt:

1. **Original ergänzen** — eine Quelle, ursprüngliche Reihenfolge, keine
   Schwärzung. Lesezeichen, Formularstruktur und Metadaten bleiben erhalten;
   Formularwerte werden geschrieben und bleiben änderbar.
2. **Neu aufbauen** — sobald Seiten umgestellt, gedreht, gelöscht, angehängt
   oder geschwärzt wurden. Formularwerte werden dabei fest eingebrannt, weil
   die Feldstruktur beim Seitenkopieren nicht mitwandert; Lesezeichen gehen
   verloren.

## Prüfen

```sh
node werkzeuge/pruefen.mjs
```

Fährt Chromium über die Hauptwege und prüft am Ende die erzeugte Datei: fünf
Seiten, geschwärzte Seite ohne auslesbaren Text, unberührte Seite mit Text,
Formularwert in der Ausgabe, Rückgängig, Suche, Zusammenführen — und dass die
Browserkonsole leer bleibt.
