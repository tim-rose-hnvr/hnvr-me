# Werkbank — PDF

Eine PDF-Arbeitsumgebung im Browser: lesen, kommentieren, Text erkennen und
ersetzen, schwärzen, Formulare ausfüllen, unterschreiben, mit Kennwort
schützen, Seiten umbauen, zusammenführen, teilen, verkleinern, vergleichen,
ausgeben, digital unterschreiben. Läuft vollständig lokal — kein Server, kein
Konto, kein Netz, keine Gebühr. Auch Texterkennung und Verschlüsselung, sonst die üblichen Gründe für
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
lässt sich mit `node werkzeuge/beispiel-bauen.mjs` neu erzeugen. Sie ist
absichtlich vielfältig: Lesezeichen, Text- und Querformatseiten, eine Seite
ohne Text, personenbezogene Angaben — und ein Formular mit Textfeld,
mehrzeiligem Feld, Ankreuzfeld, Auswahlliste, Optionsfeld und einem echten
Unterschriftsfeld. Damit lässt sich jede Fähigkeit der Werkbank ausprobieren,
ohne eine eigene Datei zu suchen.

## Wo alles steht

Ein Befehl, den niemand findet, gibt es nicht. Deshalb hat jeder der 76
Befehle einen Weg mit der Maus:

- **Menüleiste** unter dem Kopf — Datei, Bearbeiten, Seiten, Ansicht,
  Werkzeuge, Gehe zu, Schutz, Hilfe. Sie wird aus dem Befehlsregister gebaut,
  nicht daneben gepflegt; was nirgends einsortiert ist, landet sichtbar unter
  „Weiteres". Der Prüflauf lässt keinen Befehl ohne Menüweg durch.
- **Werkzeugleiste** im Kopf — die sechzehn Werkzeuge zum Zeigen und Zeichnen.
- **Rückgängig und Wiederholen** als Knöpfe im Kopf, mit dem Namen des
  Schritts im Tooltip („Rückgängig: 3 Seiten gelöscht").
- **Seiten ordnen** (`Strg+Umschalt+O`, Knopf über den Miniaturen) — alle
  Seiten groß nebeneinander: ziehen sortiert um, Umschalt und Strg wählen
  mehrere, dann drehen, verdoppeln, löschen, als eigene Datei sichern oder
  weitere Seiten einfügen. Doppelklick springt zur Seite.
- **Nur gewählte Seiten zeigen** — Seiten auswählen, dann „Seiten → Nur
  gewählte Seiten zeigen". Die übrigen treten zurück, ohne dass am Dokument
  etwas geändert wird; die Seitennummern bleiben die des Dokuments. Im Fuß
  steht, dass ein Ausschnitt sichtbar ist, mit dem Weg zurück daneben.
- **Befehlspalette** (`Strg+K`) für alle, die lieber tippen.

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

Es werden höchstens sechs Vorschläge gezeigt, nach Gewicht sortiert. Greifen
mehr Regeln, steht darunter „N weitere zeigen" — verschwiegen wird nichts.

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

**Text bearbeiten** — auf ein Textstück klicken, neuen Text schreiben. Lage,
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
ausgeben, weitere Dateien anhängen, in gleich große Teile zerlegen. Dafür gibt
es neben den Miniaturen die Ansicht **Seiten ordnen** (`Strg+Umschalt+O`): alle
Seiten groß nebeneinander, Mehrfachauswahl, Ziehen zum Sortieren. Und
**Nur gewählte Seiten zeigen**, wenn man sich auf wenige Seiten beschränken
will, ohne die übrigen zu löschen.

**Formulare ausfüllen** — vorhandene AcroForm-Felder werden erkannt und direkt
auf der Seite ausgefüllt (Text, mehrzeilig, Ankreuzfeld, Auswahlliste,
Optionsfeld). Beim Sichern wahlweise ausfüllbar belassen oder fest einbrennen.

**Formulare anlegen** — Werkzeug `K`, Rahmen ziehen, Art wählen: Textfeld,
mehrzeiliges Feld, Ankreuzfeld, Auswahlliste, Optionsfeld, Unterschriftsfeld.
Bis zum Sichern ist es ein Platzhalter, den man verschieben und löschen kann;
erst beim Schreiben entsteht ein echtes Feld. Auf geschwärzten Seiten wird
keines angelegt — die werden zum Bild, ein Eingabefeld darüber wäre ein
Widerspruch. Der Prüflauf schreibt alle sechs Arten und liest sie zurück.

**Nach Excel** — `.xlsx` mit einem Blatt je Seite. Ein PDF kennt keine
Tabellen, nur Buchstaben an Punkten; als Tabelle gilt hier, was in mindestens
drei Zeilen hintereinander an denselben Stellen beginnt. Findet das nichts,
holt der zweite Weg („jede Zeile ins Raster") den Text trotzdem. Zahlen werden
als Zahlen geschrieben, Bestellnummern mit führender Null bleiben Text. Nicht
übernommen: Rahmen, Farben, verbundene Zellen, Formeln, Bilder.

**Digital unterschreiben** — mit einem Zertifikat aus einer `.p12`, nicht als
Bild. Über die Bytes der Datei wird ein Hashwert gebildet und signiert; ändert
danach jemand ein Zeichen, meldet jeder Betrachter, dass das Dokument nach der
Unterschrift verändert wurde. Das Ergebnis ist PAdES-B-B mit dem verlangten
`signingCertificateV2`. Grenzen, die im Dialog stehen: eine Unterschrift je
Datei (eine zweite darüber bräche die erste), kein Zeitstempel von einem Dienst
— die Signaturzeit ist die Uhr des Geräts —, keine Abfrage von Sperrlisten. Ob
die Unterschrift als qualifiziert gilt, entscheidet das Zertifikat, nicht
dieses Programm. Der Prüflauf lässt openssl nachrechnen und prüft, dass ein
geändertes Byte die Signatur bricht.

**Barrierefreiheit** — Prüfung mit Begründung statt Ampel: fehlender
Strukturbaum, fehlende Dokumentsprache, Titel, Felder ohne Beschriftung, Seiten
ohne Text, Bilder. Was ohne Vermutung zu setzen ist, setzt die Werkbank auf
Knopfdruck: Sprache, Titel, „Titel statt Dateiname anzeigen", Feldbeschriftungen
(`/TU`). Was sie **nicht** tut, ist automatisch auszeichnen. Eine geratene
Überschriftenebene ist für einen Screenreader schlimmer als gar keine; die
Auszeichnung gehört in das Programm, das die Datei erzeugt.

**Schwärzen** — Rechteck ziehen. Beim Sichern wird die betroffene Seite
gerastert und das Rechteck deckend gefüllt: der Text darunter ist danach
wirklich fort, nicht nur verdeckt. Das steht auch im Vorschlag, bevor es
passiert.

**Unterschreiben** — zeichnen, tippen oder als Bild laden; durchsichtiger
Rand wird abgeschnitten. Klick in ein Unterschriftsfeld setzt sie passend ein.

**Vergleichen** — zwei Dateien seitenweise wortweise gegenüberstellen.

**Nach Word** — `.docx` mit Absätzen, Überschriften (aus der Schriftgröße),
fetten und kursiven Stellen und Seitenumbrüchen. Übernommen wird der Aufbau,
nicht das Layout: keine Spalten, keine Tabellenraster, keine Bilder. Ein PDF
beschreibt Buchstaben an Punkten, kein Word beschreibt Absätze — eine
Nachbildung des Aussehens zerfällt, sobald jemand ein Wort einfügt. Wer das
Aussehen braucht, gibt das PDF weiter; wer weiterschreiben will, nimmt die
`.docx`. Erkannter Text aus Scans wandert mit. Das Archiv wird selbst
geschrieben (`app/zip.js`), keine fremde Bibliothek nötig.

**Text mitnehmen** — markieren und mit `Strg+C` kopieren wie überall.
Zusätzlich: „Auswahl oder Seitentext kopieren" nimmt ohne Markierung die ganze
Seite, „Text des ganzen Dokuments kopieren" alles. Auf Scans greift dabei die
Texterkennung. Mit `Bereich kopieren` (`M`) lässt sich ein Ausschnitt als Bild
in die Zwischenablage ziehen — Acrobats Momentaufnahme.

**Stempel** — Genehmigt, Nicht genehmigt, Entwurf, Vertraulich, Kopie,
Erhalten; wahlweise mit heutigem Datum oder eigenem Text.

**Ausgeben** — PDF, Text (`.txt`), Seite als PNG, Anmerkungsbericht. Gedruckt
wird nicht die Bildschirmseite, sondern die Datei, die auch beim Sichern
entstünde — sie wird dafür im Betrachter des Browsers geöffnet.

**Bedienung** — Befehlspalette mit `Strg+K`; jede Fähigkeit ist ein Befehl und
über Werkzeugleiste, Palette, Tastenkürzel und Vorschlag gleichermaßen
erreichbar. Tastenkürzel unter `F1`.

## Abgleich mit der Acrobat-Werkzeugliste

Werkzeug für Werkzeug, in der Reihenfolge, in der Acrobat sie anbietet.

| Acrobat | Werkbank | Anmerkung |
|---|---|---|
| PDF exportieren | **ja** | PDF, Word (.docx), Excel (.xlsx), Text, PNG |
| Diese PDF stilisieren | nein | Gestaltung durch ein Sprachmodell — braucht einen Dienst |
| Ausfüllen und Signieren | **ja** | Formularfelder und sichtbare Unterschrift |
| PDF bearbeiten | **teilweise** | Text bearbeiten ja; Bilder und Objekte im PDF nein |
| E-Signaturen anfordern | nein | Unterschriftslauf über mehrere Personen braucht einen Server |
| Diese PDF-Datei übersetzen | nein | Übersetzungsdienst |
| PDF erstellen | **teilweise** | aus Bildern ja; aus Word oder Excel nein |
| Dateien zusammenführen | **ja** | |
| Seiten verwalten | **ja** | eigene Ansicht „Seiten ordnen“: sortieren, drehen, löschen, verdoppeln, auszugsweise ausgeben |
| Zum Kommentieren senden | nein | gemeinsames Kommentieren braucht einen Server |
| Scan & OCR | **teilweise** | Texterkennung ja; ein Scangerät ansteuern nein |
| PDF-Datei schützen | **ja** | AES-256, Rechte für Drucken, Ändern, Kopieren |
| PDF-Datei schwärzen | **ja** | mit Rasterung, der Text ist wirklich fort |
| PDF komprimieren | **ja** | „Verkleinern", mit Vorher/Nachher |
| Formular vorbereiten | **ja** | Rahmen ziehen, Art wählen: Text, mehrzeilig, Ankreuz, Auswahl, Option, Unterschrift |
| Kommentare hinzufügen | **ja** | zehn Werkzeuge, Liste, Bericht |
| In PDF konvertieren | **teilweise** | Bilder ja; Office-Dateien nein |
| Stempel hinzufügen | **ja** | Vorlagen und eigener Text, wahlweise mit Datum |
| Ein Zertifikat verwenden | **ja** | PAdES-B-B aus einer .p12; kein Zeitstempeldienst, keine Sperrlisten |
| Druckproduktion verwenden | nein | Druckvorstufe, Farbauszüge |
| Objekte messen | nein | |
| Dateien vergleichen | **ja** | wortweiser Textvergleich je Seite |
| Rich Media hinzufügen | nein | bewusst nicht: Video im PDF ist eine Sicherheitslücke mit Abspieltaste |
| Geführte Aktionen verwenden | **teilweise** | Befehlspalette statt Aktionsfolgen; kein Stapelbetrieb über Ordner |
| Barrierefreiheit vorbereiten | **teilweise** | Prüfung mit Begründung; Sprache, Titel und Feldbeschriftungen werden gesetzt. Auszeichnung (Tags) nicht — sie wäre geraten |
| PDF-Standards anwenden | nein | PDF/A, PDF/X |
| Suchindex hinzufügen | **teilweise** | Volltextsuche im Dokument ja; Index über einen Ordner nein |
| JavaScript verwenden | nein | bewusst nicht: JavaScript im PDF ist seit Jahren ein Einfallstor |
| Benutzerdefiniertes Tool erstellen | **teilweise** | jede Fähigkeit ist ein Befehl und über die Palette erreichbar |

Elf von neunundzwanzig fehlen ganz. Sechs davon brauchen einen Server oder
einen Dienst und passen deshalb nicht zu einer Anwendung, die nichts
weitergibt. Zwei sind bewusst abgelehnt. Drei — Zertifikat, Formularfelder
anlegen, Barrierefreiheit — sind echte Lücken und ließen sich hier bauen.

## Was sie nicht kann

Ehrlicher als eine lange Merkmalsliste:

- **Nur eine Unterschrift je Datei.** Eine zweite über die erste hinweg
  verlangt eine inkrementelle Ergänzung: die Datei müsste angehängt statt neu
  geschrieben werden. Die Werkbank kann das nicht — und sagt es, statt die
  erste Unterschrift stillschweigend zu brechen.
- **Kein Zeitstempel von einem Dienst und keine Sperrlistenabfrage.** Die
  Signaturzeit ist die Uhr des Geräts. Damit ist das Ergebnis PAdES-B-B, nicht
  -B-T oder -B-LT. Beides bräuchte einen Dienst im Netz; der Saal soll von
  nichts abhängen.
- **„Qualifiziert" entscheidet das Zertifikat.** Die Werkbank rechnet die
  Signatur; ob sie qualifiziert ist, hängt an Ihrem Zertifikat und seinem
  Aussteller. Eine Signaturkarte am Gerät kann sie nicht ansprechen.
- **Keine Auszeichnung (Tags) für Barrierefreiheit.** Prüfen ja, Sprache und
  Titel setzen ja — aber ein fertiges PDF nachträglich auszuzeichnen heißt
  raten, und eine falsche Überschriftenebene schadet mehr, als sie nützt.
- **Ersetzter Text wird in Helvetica gesetzt.** Die Originalschrift wird nicht
  nachgebildet; bei ausgefallenen Schriften sieht man den Unterschied.
- **Texterkennung ist nie fehlerfrei.** Sie nennt ihre Sicherheit in Prozent.
  Zahlen, Namen und Kennzeichen gehören geprüft.
- **Die Excel-Ausgabe erkennt Tabellen, sie versteht sie nicht.** Verbundene
  Zellen, mehrzeilige Kopfzeilen und Tabellen ohne gleiche Spaltenanfänge
  fallen durch. Deshalb steht der zweite Weg daneben, der jede Zeile mitnimmt.
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
app/ordnen.js       Seiten ordnen: alle Seiten gross, ziehen zum Sortieren
app/menue.js        Menueleiste, aus dem Befehlsregister gebaut
app/suche.js        Volltextsuche und Trefferhervorhebung
app/formulare.js    AcroForm-Felder ausfüllen
app/texterkennung.js Tesseract ansteuern, Wörter in PDF-Punkte umrechnen
app/schutz.js       qpdf ansteuern: Kennwort, Rechte, Reparatur
app/unterschrift.js Unterschrift zeichnen, tippen, laden
app/vergleich.js    Wortvergleich zweier Dateien
app/word.js         Aufbau lesen und als .docx schreiben
app/excel.js        Tabellen erkennen und als .xlsx schreiben
app/zip.js          ZIP-Schreiber (.docx und .xlsx sind ZIPs)
app/signieren.js    PKCS#12 lesen, CMS bauen, PDF signieren (PAdES)
app/barrierefrei.js Barrierefreiheit pruefen und setzen, was ohne Raten geht
app/mitdenken.js    Befunde und Vorschläge
app/ausgabe.js      Schreiben über pdf-lib
app/oberflaeche.js  Befehlsregister, Tafeln, Tastatur
fremd/              pdf.js, pdf-lib, tesseract.js, qpdf, node-forge — siehe fremd/HERKUNFT.md
werkzeuge/          Beispieldatei bauen, Prüfläufe fahren, ZIP wieder aufmachen
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

## Wo die schweren Bestandteile liegen

Voreingestellt neben der Anwendung, in `fremd/` — rund 11 MB, das meiste
WebAssembly und Sprachdaten. Wer sie woanders ablegen muss, etwa weil ein
Hoster keine `.wasm`-Dateien annimmt, trägt im `index.html` eine andere
Wurzel ein:

```html
<meta name="werkbank-fremd" content="https://beispiel.example/werkbank-fremd/">
```

Von dort holt die Anwendung dann PDF-Motor, Texterkennung, qpdf, Schriften
und Sprachdaten. Am Rest ändert sich nichts. Der Server muss `.wasm` als
`application/wasm` ausliefern, sonst startet die Texterkennung nicht.

## Prüfen

Zwei Läufe in einem echten Chromium, beide ohne Netz, und ein dritter gegen
die veröffentlichte Seite:

```sh
node werkzeuge/pruefen.mjs        # 96 Prüfungen — das Ergebnis in der Datei
node werkzeuge/vollpruefung.mjs   # 69 Prüfungen — die Bedienung
node werkzeuge/live-pruefen.mjs   # 12 Prüfungen — was der Hoster ausliefert
```

**`pruefen.mjs`** fragt: Stimmt, was herauskommt? Geschwärzte Seite ohne
auslesbaren Text, unberührte Seite mit Text, Formularwert in der Ausgabe,
Lesezeichen springen richtig, alle Feldarten ausfüllbar, Unterschrift sitzt im
Unterschriftsfeld, Texterkennung mit Inhalts- und Sicherheitsprüfung,
durchsuchbarer Scan nach dem Sichern, geschützte Datei ohne Kennwort
verschlossen und mit Kennwort offen, falsches Kennwort erkannt, jede
Mitdenken-Regel einmal ausgelöst, Zoomanzeige deckt sich mit dem Zoom.
Für die Word-Ausgabe wird die `.docx` von Hand ausgepackt und geprüft:
Pflichtteile vorhanden, Absätze, Überschriftenvorlage, fette Stellen,
Seitenumbrüche, Text der ersten und letzten Seite, saubere Sonderzeichen.
Dasselbe für die `.xlsx`: Pflichtteile, Kopfzeile der erkannten Tabelle, eine
Zahl, die als Zahl und nicht als Text geschrieben ist. Alle sechs
Formularfeldarten werden angelegt und aus der gesicherten Datei zurückgelesen.
Die Barrierefreiheit wird zweimal geprüft: dass der Bericht die Mängel nennt,
und dass Sprache, Titel und Feldbeschriftungen danach wirklich im Katalog
stehen. Bei der Unterschrift rechnet **openssl** die Signatur nach — und ein
absichtlich verändertes Byte muss sie brechen, sonst gilt der Lauf als
gescheitert.

**`vollpruefung.mjs`** fragt: Lässt sich alles bedienen? Zoomstufen, Drehen,
Blättern, Tastatur, Tafeln, jedes Werkzeug, Anmerkung wählen, verschieben,
löschen, zurücknehmen, Miniaturen ziehen, Suche mit Optionen, jeder Dialog,
Befehlspalette, Teilen, Reparieren, Linearisieren, Verkleinern, Vergleich,
Unterschrift in allen drei Wegen, Drucken, Word-Ausgabe, Text kopieren,
Bereich ablichten, Stempel, PDF aus Bildern. Dazu die Wege selbst: dass die
Menüleiste jeden Befehl trägt, dass ein Menü sichtbar aufklappt und nicht von
der Leiste beschnitten wird, dass die Ordnen-Ansicht per Ziehen sortiert und
Löschen zurücknehmbar bleibt, und dass der Fokus die richtigen Seiten mit den
richtigen Nummern zeigt.

**`live-pruefen.mjs`** fragt: Kommt draußen an, was hier gebaut wurde? Beim
Hoster entscheiden Dinge, die örtlich nie auffallen — MIME-Typen,
Verzeichnisregister, Zwischenspeicher. Der Lauf holt jede der 220 Dateien von
der veröffentlichten Adresse und vergleicht die Prüfsumme mit der gebauten
Fassung; stimmen alle überein, läuft dort dieselbe Anwendung, die die beiden
anderen Läufe durchgemessen haben. Zusätzlich geprüft: `.wasm` als
`application/wasm`, die Sprachdaten als `application/gzip`, und dass alle
Wege in die Anwendung offen sind.

Bei einem Fehlschlag legt `vollpruefung.mjs` ein Bildschirmfoto und einen
Zustandsauszug ab und nennt den Pfad. Beide Browserläufe schlagen auch dann
fehl, wenn in der Browserkonsole ein Fehler auftaucht.
