# Werkbank — PDF

Eine PDF-Arbeitsumgebung im Browser: lesen, kommentieren, Text erkennen und
ersetzen, schwärzen, Formulare ausfüllen, unterschreiben, mit Kennwort
schützen, Seiten umbauen, zusammenführen, teilen, verkleinern, vergleichen,
ausgeben. Läuft vollständig lokal — kein Server, kein Konto, kein Netz, keine
Gebühr. Auch Texterkennung und Verschlüsselung, sonst die üblichen Gründe für
einen Upload, laufen auf diesem Gerät.

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
| kein auswählbarer Text | Texterkennung anbieten — danach ist der Scan durchsuchbar |
| Erkennung unter 80 % sicher | zweiten Lauf mit höherer Auflösung anbieten |
| Datei war kennwortgeschützt | vor der Weitergabe wieder ein Kennwort anbieten |
| Datei über 8 MB | Verkleinern anbieten, mit Hinweis auf die Texterkennung |
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

**Texterkennung (OCR)** — Tesseract läuft als Web-Worker auf diesem Gerät,
Deutsch und Englisch, 150 bis 300 dpi, mit Abbruchknopf. Der erkannte Text
erscheint sofort als Textebene über dem Bild — Suchen, Markieren und
Hervorheben gehen damit auf einem Scan wie in einem gesetzten Dokument. Beim
Sichern wandert er als unsichtbarer Text (Textmodus 3, waagerecht auf die
Wortbreite gestaucht) hinter das Bild: das Ergebnis ist ein durchsuchbares
PDF, das in jedem Betrachter gleich aussieht.

**Text ersetzen** — auf ein Textstück klicken, neuen Text schreiben. Lage,
Größe, Grund- und Schriftfarbe werden aus der gezeichneten Seite abgegriffen.
Auf Wunsch wird der alte Text wirklich entfernt (die Seite wird dabei zum
Bild) statt nur überdeckt — beides steht im Dialog.

**Kennwort und Rechte** — geschützte Dateien öffnen (die Werkbank fragt nach
dem Kennwort und entschlüsselt einmalig), Schutz mit AES-256 setzen, Drucken,
Ändern und Kopieren begrenzen, Schutz entfernen. Dazu Reparieren und
Linearisieren. Getragen von qpdf als WebAssembly — keine eigene Kryptografie.

**Verkleinern** — Seiten mit fester Auflösung neu berechnen, mit Vorher/Nachher
in der Meldung. Liegt eine Texterkennung vor, wandert sie mit: klein und
trotzdem durchsuchbar.

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

- **Keine kryptografische Signatur.** Die Unterschrift ist ein Bild. Für eine
  fortgeschrittene oder qualifizierte Signatur nach eIDAS braucht es ein
  Zertifikat, eine PAdES-Struktur und bei „qualifiziert" eine Signaturkarte
  oder einen Vertrauensdiensteanbieter. Das ist der nächste sinnvolle Ausbau.
- **Ersetzter Text wird in Helvetica gesetzt.** Die Originalschrift wird nicht
  nachgebildet; bei ausgefallenen Schriften sieht man den Unterschied.
- **Texterkennung ist nie fehlerfrei.** Sie nennt ihre Sicherheit in Prozent.
  Zahlen, Namen und Kennzeichen gehören geprüft.
- **Kein Export nach Word oder Excel.** Nur PDF, Text, PNG.
- **Ein unbekanntes Kennwort bleibt unbekannt.** qpdf entschlüsselt mit
  Kennwort, es knackt keines.
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
app/texterkennung.js Tesseract ansteuern, Wörter in PDF-Punkte umrechnen
app/schutz.js       qpdf ansteuern: Kennwort, Rechte, Reparatur
app/unterschrift.js Unterschrift zeichnen, tippen, laden
app/vergleich.js    Wortvergleich zweier Dateien
app/mitdenken.js    Befunde und Vorschläge
app/ausgabe.js      Schreiben über pdf-lib
app/oberflaeche.js  Befehlsregister, Tafeln, Tastatur
fremd/              pdf.js, pdf-lib, tesseract.js, qpdf — siehe fremd/HERKUNFT.md
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

Fährt Chromium über die Hauptwege und prüft am Ende die erzeugten Dateien:
geschwärzte Seite ohne auslesbaren Text, unberührte Seite mit Text,
Formularwert in der Ausgabe, Rückgängig, Suche, Verkleinern, Texterkennung mit
Inhalts- und Sicherheitsprüfung, durchsuchbarer Scan nach dem Sichern,
Kennwortschutz (ohne Kennwort verschlossen, mit Kennwort offen), Text ersetzen,
Zusammenführen — und dass die Browserkonsole leer bleibt. 29 Prüfungen.
