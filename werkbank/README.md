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

## Gestaltung

Oberfläche und Marketingseite folgen dem Handoff „PDF Studio": Akzent
`#0f766e`, dunkle Chrome `#1d2327`, Bühne `#5f686e`, Papier `#fdfcf9`,
Statusleiste `#333b40`, IBM Plex in Sans, Serif und Mono, nur 4er-Schritte im
Raster, **Radius 0** — alles kantig. Aufbau von oben: Titelleiste 38 px mit
Dokumentreitern und akzentfarbenem Primärknopf, Menüleiste 27 px,
Werkzeugzeile 46 px, dann Bühne mit den beiden Leisten (196 px links, 296 px
rechts), unten Statusleiste 30 px.

**Das Seitenraster sitzt in der Mitte, nicht über allem.** Es war einmal ein
weißes Vollbild, das Reiter, Leisten und Statuszeile verdeckte. Jetzt tauscht
es die Bühne aus, wie der Vergleich es auch tut: Aktionsleiste 46 px in
Chromefarbe, darunter das Raster auf dem dunkleren Bühnenton, Karten mit
Häkchen und Mono-Fußzeile.

**Leere Tafeln sagen, was dort stünde — und wie es dorthin kommt.** „Noch
nichts geändert." allein ist eine Absage. Ein Leerzustand hat drei Teile:
Zeichen, Satz, Weg (`leerBild` im Kern). Der Weg ist der wichtigste.

**Der Empfang trägt dieselbe Sprache wie das Programm** — dunkle Titelleiste
38 px mit Wortmarke, kantige Karte, Mono-Zeile, Serif-Überschrift, der Knopf,
den man drücken soll, akzentfarben. Er war das Einzige ohne Vorbild und sah
danach aus.

**In der dunklen Fassung ist die Bühne der dunkelste Grund.** Sie war heller
als die Tafeln daneben — dann liegt das Blatt nicht auf einem Tisch, sondern
in einem Kasten.

**Die Seite steht auf der Bühne, sie füllt sie nicht.** 100 % heißt hier, was
im Handoff steht: die Seite ist 720 px breit („Breite 720px × zoom/100"), und
das ist die Voreinstellung — nicht „auf Fensterbreite". Der Unterschied ist
kein Detail: mit „Breite" wird aus dem Leuchttisch ein Textfenster, die
Bühnenfarbe verschwindet und die Schrift wird doppelt so groß wie gezeichnet.
Ist die Seite breiter als die Bühne, liegt der Überhang rechts (`margin: 0
auto`, nicht zentriert) — sonst wäre der linke Rand aus dem Bild geschoben und
nicht mehr erreichbar.

**Beide Leisten stehen bis 900 px nebeneinander.** Die Mockup-Aufnahme ist
924 px breit und zeigt 196 links, 452 Bühne, 296 rechts. Zwei alte Regeln
standen dem im Weg: eine versteckte beide Leisten schon unter 960 px, eine
schrumpfte die rechte unter 1180 px auf 260 px. Beide sind fort.

**Die Beschriftungen sind die des Handoffs** — Markieren, Kommentar,
Redigieren, Signieren —, nicht unsere eigenen Wörter. Wer den Entwurf neben
die Anwendung legt, soll dasselbe lesen.

**Die Werkzeugzeile trägt die vier Gruppen des Handoffs**, jeder Knopf 34 px
hoch mit Sinnbild *und* Wort: Auswahl/Text · Hervorheben/Notiz/Schwärzen ·
Formularfeld/Unterschrift · Seiten/Vergleichen/Dokument, dazu „Mehr" für die
elf übrigen Werkzeuge und rechts eine Gruppe (OCR, Exportieren), die beim
Scrollen stehen bleibt. Sie trug einmal sechzehn Knöpfe, sechs davon nur als
Zeichen — ein Sinnbild ohne Wort ist die stille Annahme, jeder wisse schon,
was es bedeutet.

Die Seitenleiste zeigt die Seiten **einspaltig**: Karte 112 px auf
Papierfarbe, darunter Mono-Seitenzahl, Kurztitel aus der ersten Zeile, die
nicht auf jeder Seite steht, und die Zahl der Kommentare. Dialoge tragen den
dunklen Kopf aus dem Handoff (42 px, Rautenmarke, Serif-Titel).

Nachgemessen wird das, nicht nachgesehen: `vollpruefung.mjs` prüft Höhen,
Breiten, Farben, Knopfhöhen, dass jeder Werkzeugknopf ein Wort trägt und dass
im ganzen Fenster kein runder Rahmen steht — mit genau den vier Ausnahmen, die
das Handoff zulässt.

Zwei Abweichungen vom Handoff, beide mit Grund:

- **Die Schriften liegen bei, nicht bei Google.** Das Handoff nennt Google
  Fonts; die Werkbank darf nichts nachladen. Acht Schnitte als woff2 in
  `fremd/schrift`, zusammen 176 kB. Der Prüflauf sieht in jeder
  `@font-face`-Regel nach und schlägt fehl, sobald eine fremde Adresse
  darin steht.
- **Es gibt eine dunkle Fassung.** Das Handoff ist nur hell gedacht. Die
  dunklen Werte sind daraus abgeleitet; der Akzent wird dort zu `#7fd6cd`,
  weil `#0f766e` auf dunklem Grund nicht mehr trägt.

**Der Aufbau ist der des Handoffs, Reiter für Reiter.** Links vier Reiter —
Seiten, Marken, Dateien, Suche; die ersten drei sind die gezeichneten, „Suche"
ist unsere Zutat und steht dahinter. Rechts ebenso: Kommentare, Felder,
Verlauf wie gezeichnet, „Hinweise" als vierter. Die Menüleiste folgt derselben
Regel — Datei, Bearbeiten, Ansicht, dann unsere Zusätze, am Ende Hilfe. Wo die
Werkbank mehr kann als das gezeichnete Produkt, wird das Muster erweitert,
nicht gebrochen.

Auch im Kleinen: die Kommentarkarte trägt den Art-Chip in Mono-Versalien und
darunter das Zitat aus dem Dokument in Serif-Kursiv mit goldener Kante — das
Zitat ist der markierte Seitentext, der Kommentar ist das, was jemand
dazuschreibt. Die Einstellungen tragen Abzeichen an den Kategorien; ihre
Zahlen werden gerechnet, nicht gesetzt.

Nicht übernommen wurde alles, was einen Server braucht: Avatare, „3 Bearbeiter
live", gemeinsame Ablage, Signaturanforderungen an Externe, das Menü „Team".
Ein Team-Merkmal, das ohne Server nicht geht, wäre in dieser Werkbank eine
Attrappe.

**Schmale Fenster statt zweiter App.** Das Handoff entwirft für das Telefon
eine eigene iOS-Anwendung. Eine zweite Anwendung wäre der Sonderzweig, den die
Projektanweisung ausschließt — also arbeitet dieselbe Werkbank auf einem
schmalen Fenster. Unter 980 px treten die Leisten aus dem Raster und legen sich
als Schubfächer über die Bühne, unter 760 px verlieren die Werkzeuge ihre
Beschriftung und die Statusleiste ihr Beiwerk. Auf 402 × 874 (iPhone) ist das
Blatt 354 px breit, und nichts scrollt waagerecht — das prüft der Prüflauf,
und er nennt bei einem Überhang das schuldige Element beim Namen.

## Wo alles steht

Ein Befehl, den niemand findet, gibt es nicht. Deshalb hat jeder der 83
Befehle einen Weg mit der Maus:

- **Menüleiste** unter dem Kopf — Datei, Bearbeiten, Seiten, Ansicht,
  Werkzeuge, Gehe zu, Schutz, Hilfe. Sie wird aus dem Befehlsregister gebaut,
  nicht daneben gepflegt; was nirgends einsortiert ist, landet sichtbar unter
  „Weiteres". Der Prüflauf lässt keinen Befehl ohne Menüweg durch.
- **Werkzeugzeile** unter dem Menü — die vier Gruppen des Handoffs, jeder
  Knopf mit Wort: Auswahl/Text · Hervorheben/Notiz/Schwärzen ·
  Formularfeld/Unterschrift · Seiten/Vergleichen/Dokument. Dahinter „Mehr" mit
  den elf übrigen der achtzehn Werkzeuge; rechts bleiben „OCR ausführen" und
  „Exportieren" beim Scrollen stehen.
- **Rückgängig und Wiederholen** ganz links in der Werkzeugzeile, mit dem
  Namen des Schritts im Tooltip („Rückgängig: 3 Seiten gelöscht").
- **Seiten ordnen** (`Strg+Umschalt+O`, Knopf über den Miniaturen) — alle
  Seiten groß nebeneinander: ziehen sortiert um, Umschalt und Strg wählen
  mehrere, dann drehen, verdoppeln, löschen, als eigene Datei sichern oder
  weitere Seiten einfügen. Doppelklick springt zur Seite.
- **Nur gewählte Seiten zeigen** — Seiten auswählen, dann „Seiten → Nur
  gewählte Seiten zeigen". Die übrigen treten zurück, ohne dass am Dokument
  etwas geändert wird; die Seitennummern bleiben die des Dokuments. Im Fuß
  steht, dass ein Ausschnitt sichtbar ist, mit dem Weg zurück daneben.
- **Dokumentreiter** in der Titelleiste — mehrere Dateien gleichzeitig offen,
  jede mit eigener Seitenfolge, eigenen Anmerkungen und eigener
  Rückgängig-Kette. Der Prüflauf legt eine Anmerkung in den zweiten Reiter und
  besteht darauf, dass sie im ersten nicht auftaucht.
- **Rechte Leiste mit vier Reitern** — Hinweise (das Mitdenken), Kommentare
  (Fäden mit Antworten und Erledigt-Zustand), Felder (mit Pflichtstatus),
  Verlauf (die Rückgängig-Kette als Zeitleiste).
- **Versionsvergleich als eigene Ansicht** — er tritt an die Stelle der Bühne,
  mit Legende (hinzugefügt / entfernt / unverändert), Blättern und `Esc`
  zurück. Vorher lag er in einem Dialog; man vergleicht aber nicht in zwei
  Sekunden, sondern blättert hin und her und liest nach.
- **Einstellungen** (`Ansicht → Einstellungen`) — sieben Kategorien. Jeder
  Schalter wirkt sofort; einer, der erst nach „Übernehmen" etwas tut, wird
  zweimal gedrückt. Bewusst ohne Browser-Speicher: die Einstellungen gelten
  für diese Sitzung, die Werkbank hinterlässt nichts.
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

**Aus Word, Excel, Text ein PDF** — `.docx`, `.xlsx`, `.csv`, `.txt` und
`.md` werden im Browser gelesen (ZIP + OOXML) und auf A4 gesetzt:
Überschriften, Absätze, Aufzählungen, Tabellen, fett und kursiv; bei Excel
jedes Blatt als eigene Tabelle mit wiederholter Kopfzeile. Nicht mit kommen
Bilder, Kopf- und Fußzeilen, Fußnoten, Spalten und Farben — das steht im
Dialog, bevor jemand auf „Erstellen" drückt. Eine Word-Datei auf die Werkbank
zu ziehen öffnet sie; das Ergebnis wird geöffnet, nicht heruntergeladen.

**Messen** — Strecken und Flächen in echten Einheiten (mm, cm, m, Zoll, Fuß,
Punkt). Ohne Kalibrierung gilt das Papiermaß: ein PDF-Punkt ist 1/72 Zoll,
also 0,3528 mm — auf dem Papier stimmt das immer. Wer einen Grundriss misst,
zieht eine Strecke bekannter Länge und trägt sie ein; **die Kalibrierung wirkt
rückwirkend auf alle Messungen**. Die Maßzahl steht auf dem Bildschirm und
wandert mit in die gesicherte Datei.

**Stapel** — dieselbe Arbeit an vielen Dateien: entschützen, reparieren,
Metadaten entfernen, drehen, linearisieren, schützen. Nur Schritte, die keine
Entscheidung brauchen; die Reihenfolge steht fest (entschützen zuerst,
schützen zuletzt), nicht die des Anklickens. Eine gescheiterte Datei hält den
Lauf nicht auf — das Ergebnis ist ein ZIP mit einem Bericht darin, der jede
Datei beim Namen nennt.

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
| PDF erstellen | **ja** | aus Bildern, Word, Excel, CSV, Text und Markdown |
| Dateien zusammenführen | **ja** | |
| Seiten verwalten | **ja** | eigene Ansicht „Seiten ordnen“: sortieren, drehen, löschen, verdoppeln, auszugsweise ausgeben |
| Zum Kommentieren senden | nein | gemeinsames Kommentieren braucht einen Server |
| Scan & OCR | **teilweise** | Texterkennung ja; ein Scangerät ansteuern nein |
| PDF-Datei schützen | **ja** | AES-256, Rechte für Drucken, Ändern, Kopieren |
| PDF-Datei schwärzen | **ja** | mit Rasterung, der Text ist wirklich fort |
| PDF komprimieren | **ja** | „Verkleinern", mit Vorher/Nachher |
| Formular vorbereiten | **ja** | Rahmen ziehen, Art wählen: Text, mehrzeilig, Ankreuz, Auswahl, Option, Unterschrift |
| Kommentare hinzufügen | **ja** | zehn Werkzeuge, Liste, Bericht |
| In PDF konvertieren | **ja** | Bilder, .docx, .xlsx, .csv, .txt, .md — Text und Tabellen, kein Layout |
| Stempel hinzufügen | **ja** | Vorlagen und eigener Text, wahlweise mit Datum |
| Ein Zertifikat verwenden | **ja** | PAdES-B-B aus einer .p12; kein Zeitstempeldienst, keine Sperrlisten |
| Druckproduktion verwenden | nein | Druckvorstufe, Farbauszüge |
| Objekte messen | **ja** | Strecke und Fläche, Maßstab kalibrierbar, Maß wandert in die Datei |
| Dateien vergleichen | **ja** | wortweiser Textvergleich je Seite |
| Rich Media hinzufügen | nein | bewusst nicht: Video im PDF ist eine Sicherheitslücke mit Abspieltaste |
| Geführte Aktionen verwenden | **ja** | Stapel über viele Dateien; kein Ordnerzugriff — der Browser gibt keinen her |
| Barrierefreiheit vorbereiten | **teilweise** | Prüfung mit Begründung; Sprache, Titel und Feldbeschriftungen werden gesetzt. Auszeichnung (Tags) nicht — sie wäre geraten |
| PDF-Standards anwenden | nein | PDF/A, PDF/X |
| Suchindex hinzufügen | **teilweise** | Volltextsuche im Dokument ja; Index über einen Ordner nein |
| JavaScript verwenden | nein | bewusst nicht: JavaScript im PDF ist seit Jahren ein Einfallstor |
| Benutzerdefiniertes Tool erstellen | **teilweise** | jede Fähigkeit ist ein Befehl und über die Palette erreichbar |

**Sieben von neunundzwanzig fehlen ganz** — und keine davon ist eine Lücke,
die sich hier schließen ließe: fünf brauchen einen Server oder einen Dienst
(Stilisieren, E-Signaturen anfordern, Übersetzen, gemeinsames Kommentieren,
Druckvorstufe) und passen nicht zu einer Anwendung, die nichts weitergibt;
zwei sind bewusst abgelehnt (Rich Media, JavaScript im PDF). Offen bleibt
PDF/A: dafür braucht es ein ICC-Profil und eine Konformitätsprüfung, beides
wäre hier zu bauen, aber nur richtig oder gar nicht.

Die drei früheren echten Lücken — Zertifikat, Formularfelder anlegen,
Barrierefreiheit — sind geschlossen, ebenso Einlesen, Messen und Stapel.

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
manifest.json       macht die Werkbank installierbar (Name, Symbole, Verknüpfungen)
dienst.js           Service Worker: legt die Werkbank aufs Gerät, damit sie ohne Netz läuft
symbole/            das Blatt mit dem umgeschlagenen Eck, als SVG und PNG
app/kern.js         Zustand, Ereignisse, Dialograhmen, Formularhelfer, Meldungen, Historie
app/dokument.js     Quellen laden, Seitenfolge, Text, Merkmale, Formularfelder
app/ansicht.js      Seitenfluss, Zoom, Textebene, Koordinatenwandlung
app/anmerkungen.js  Anmerkungsmodell, Darstellung, Zeigerbedienung
app/seiten.js       Miniaturen, Auswahl, Umsortieren
app/ordnen.js       Seiten ordnen: alle Seiten gross, ziehen zum Sortieren
app/menue.js        Menueleiste, aus dem Befehlsregister gebaut
app/mappen.js       mehrere Dateien offen: Reiter und Zustandstausch
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
app/installieren.js Dienst anmelden, Einrichten anbieten, Vorrat holen, Dateien annehmen
app/oberflaeche.js  Befehlsregister, Werkzeugleiste, Tastatur, Anschluss
app/tafeln.js       die beiden Leisten: Lesezeichen, Dateien, Suche, Kommentare, Felder, Verlauf
app/dialoge.js      alles, was sich als Fenster ueber die Werkbank legt
fremd/              pdf.js, pdf-lib, tesseract.js, qpdf, node-forge — siehe fremd/HERKUNFT.md
werkzeuge/          Beispieldatei bauen, Prüfläufe fahren, ZIP wieder aufmachen
werkzeuge/dateiserver.mjs  der kleine Server, den beide Prüfläufe benutzen
werkzeuge/pruefstand.mjs   Browser, Seite, `pruefe()` — der Aufbau, den alle teilen
werkzeuge/pruefungen/      die Prüfungen selbst, thematisch in acht Gruppen
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

## Auf dem Gerät einrichten

Die Werkbank lässt sich installieren wie ein Programm: eigenes Fenster ohne
Adresszeile, Symbol im Dock oder Startmenü, und sie läuft ohne Verbindung.
Menü **Datei → Auf diesem Gerät einrichten**; in Safari über „Teilen → Zum Dock
hinzufügen", in Chrome und Edge über das Symbol in der Adresszeile.

Es gibt bewusst **kein Installationsprogramm und kein ZIP**. Ein ausgepacktes
Verzeichnis, per Doppelklick geöffnet, funktioniert nicht: ES-Module und
WebAssembly brauchen einen Ursprung, über `file://` verweigert der Browser das.
Wer die Werkbank selbst betreiben will, kopiert den Ordner und stellt einen
statischen Server davor — dann gilt alles Folgende dort genauso.

Was auf dem Gerät liegt, in zwei Stufen:

| | Umfang | Wann |
|---|---|---|
| **Kern** | ~4 MB — Gerüst, alle Module, Schriften, PDF-Motor | beim Einrichten |
| **Nachschub** | ~9 MB — Texterkennung, qpdf, Zeichentabellen, node-forge | beim ersten Gebrauch, oder vorab per Knopf |

Wer nie eine Texterkennung laufen lässt, lädt sie nie. Wer offline damit
arbeiten will, drückt vorher „Alles für offline sichern".

Die Kernliste steht von Hand in `dienst.js` — und `vollpruefung.mjs` liest sie
gegen `app/` gegen. Fehlt dort ein Modul, scheitert der Prüflauf, statt dass die
installierte Fassung still kaputtgeht.

**Anmeldung und Offline.** Erreicht die Werkbank die Auskunft nicht, entscheidet
ein Merkzettel in `localStorage`: Wer sich schon einmal angemeldet hat, arbeitet
30 Tage weiter; wer noch nie angemeldet war, sieht die Schranke — mit dem
richtigen Text, denn dort fehlt das Netz, nicht der Wille. Der Merkzettel trägt
einen Zeitstempel und sonst nichts und ist keine Sicherung; das hier ist eine
Anmeldeschranke, keine Zugriffssperre.

## Prüfen

Zwei Läufe in einem echten Chromium, beide ohne Netz, und ein dritter gegen
die veröffentlichte Seite:

```sh
node werkzeuge/pruefen.mjs        # 128 Prüfungen — das Ergebnis in der Datei
node werkzeuge/vollpruefung.mjs   # 130 Prüfungen — Bedienung und Gestaltung
node werkzeuge/vollpruefung.mjs gestaltung   # nur eine Gruppe
node werkzeuge/live-pruefen.mjs   #  31 Prüfungen — was der Hoster ausliefert
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
gescheitert. Fürs Einlesen läuft ein Rundlauf: das Beispiel geht nach Word,
die `.docx` wird zurückgelesen, daraus ein PDF gesetzt und dessen Text wieder
ausgelesen — Überschriften, Umbrüche, fette Stellen und Umlaute müssen den
Weg überstehen. Beim Messen wird gegen die Definition gerechnet (100 pt sind
35,3 mm), kalibriert und nachgesehen, ob die Maßzahl in der gesicherten Datei
steht. Der Stapel läuft über drei Dateien, von denen eine absichtlich kaputt
ist: zwei müssen durchkommen, die dritte mit Begründung im Bericht stehen —
und das erzeugte Archiv wird von zwei Lesern gegengelesen, dem des Prüflaufs
und dem der Werkbank selbst.

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

**Jeder Befehl wird einmal ausgelöst** — alle 83 —, und keiner darf werfen
oder einen Konsolenfehler hinterlassen. Das prüft nicht, *was* ein Befehl tut
(das steht in den Abschnitten daneben), sondern dass keiner ins Leere greift,
wenn sich an einem anderen Modul etwas ändert. Dazu gehen vier Fälle die neuen
Dialoge bis zum Ergebnis durch: der Stapel läuft über zwei Dateien und gibt
ein Archiv mit stimmendem Bericht heraus, „Maßstab setzen" rechnet 200 Punkte
auf 8 m und „zurücksetzen" wieder auf 70,6 mm, eine Zeile in der Messungsliste
springt zur Messung, und „Datei wählen" im Einlesen-Dialog macht aus einer
.docx ein geöffnetes Dokument im eigenen Reiter.

Ein eigener Abschnitt misst die **Gestaltung gegen das Handoff**: Höhen und
Breiten der Chrome auf den Pixel (38/27/46/30, 196/296), die Farben auf den
Hexwert, dass der Primärknopf akzentfarben ist, dass jeder Werkzeugknopf
34 px hoch ist und ein Wort trägt, dass im ganzen Fenster kein runder Rahmen
steht, dass der Dialog den dunklen 42-px-Kopf hat und die Seitenliste
einspaltig mit 112-px-Karte, Mono-Zahl und Kurztitel ist. Dazu die Reiterfolge
links und rechts, die Dateienliste, das Serif-Zitat mit goldener Kante in der
Kommentarkarte und die gerechneten Abzeichen in den Einstellungen. Das ist die einzige
Art, eine Gestaltung zu prüfen, die nicht darauf hinausläuft, zwei
Bildschirmabzüge nebeneinanderzuhalten — und sie hat einen echten Fehler
gefunden: `.knopf-voll` stand oberhalb von `.knopf` und wurde von dessen
Grundwerten überschrieben, der Primärknopf war weiß statt akzentfarben.

**`live-pruefen.mjs`** fragt: Kommt draußen an, was hier gebaut wurde? Beim
Hoster entscheiden Dinge, die örtlich nie auffallen — MIME-Typen,
Verzeichnisregister, Zwischenspeicher. Der Lauf holt jede der 241 Dateien von
der veröffentlichten Adresse und vergleicht die Prüfsumme mit der gebauten
Fassung; stimmen alle überein, läuft dort dieselbe Anwendung, die die beiden
anderen Läufe durchgemessen haben. Zusätzlich geprüft: `.wasm` als
`application/wasm`, die Sprachdaten als `application/gzip`, und dass alle
Wege in die Anwendung offen sind.

Bei einem Fehlschlag legt `vollpruefung.mjs` ein Bildschirmfoto und einen
Zustandsauszug ab und nennt den Pfad. Beide Browserläufe schlagen auch dann
fehl, wenn in der Browserkonsole ein Fehler auftaucht.
