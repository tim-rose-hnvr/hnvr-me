# „Vorgang" — die neue Richtung

**Figma:** https://www.figma.com/design/P8MrdGvfyH1ZBjFtTl2zrC
**Vorgänger (Registratur, archiviert):** https://www.figma.com/design/CvhOPK3NKn28gWvlUYU3dh

## Die These

Die Einheit ist nicht die Datei, sondern der **Vorgang**: dieses Dokument, was
daran offen ist, was erledigt ist, was als Nächstes kommt. Daraus folgt alles
andere.

Was dadurch verschwindet: die Titelleiste, die Menüleiste mit acht Wörtern,
die Werkzeugzeile mit fünfzehn Werkzeugen auf Vorrat, die Statusleiste über
die ganze Breite für zwei Zahlen. Zusammen rund 106 px Rahmen vor dem ersten
Dokument.

Was an ihre Stelle tritt:

| Weg | Statt dessen |
|---|---|
| Menüleiste | **Ein Befehlsfeld** im Kopf (`⌘K`) — suchen oder sagen, was geschehen soll |
| Werkzeugzeile | **Werkzeuge am Dokument**: eine Blase an der Auswahl bietet an, was mit *dieser* Auswahl geht |
| Werkzeugliste links | **Die sechs Schritte des Vorgangs** mit ihrem Stand: Lesen · Prüfen · Schwärzen · Ausfüllen · Unterschreiben · Ausgeben |
| Kommentarliste rechts | **Was der aktive Schritt gefunden hat** — jeder Befund mit Grund und einem Knopf, der ihn erledigt |
| Statusleiste | **Schwebender Seitenstand** unten rechts, nur wo er gebraucht wird |

Im Kopf steht genau **eine** Haupthandlung: die, die jetzt dran ist.

## Die Regel, die zwei Fehlerklassen ausschließt

**Farbe bedeutet Zustand, nie Marke.** Ocker heißt offen, Grün heißt erledigt,
Rot heißt unumkehrbar. Der Akzent ist keine Farbe, sondern der stärkste
Kontrast zum Grund: fast schwarz in der hellen Fassung, fast weiß in der
dunklen. Damit kann er in keiner Fassung zu schwach werden — genau der Fehler,
der in der alten Richtung zweimal auftrat (weiße Schrift auf hellem Blau,
1,6:1).

Und das Blatt bleibt in beiden Fassungen weiß, mit eigenen `papier-*`-Token
für alles, was darauf liegt.

## Was in Figma steht

47 Variablen (Farbe mit Hell/Dunkel, Raum, Satz, Radius), 12 Textstile, ein
einziger Effektstil („Schwebend" — nur für Dinge, die wirklich über der Seite
liegen). Zwei Bildschirme: Studio hell und dunkel, derselbe Rahmen mit einem
Moduswechsel. Dazu der Aufmacher der Webseite, die dieselbe Sprache spricht
und die laufende Anwendung zeigt statt einer Zeichnung davon.

## Was gebaut ist (Stand dieser Runde)

Die Richtung steht nicht mehr nur in Figma, sie läuft:

- **Die Menüleiste ist weg.** `#menueleiste` rechnet zu `display: none`; jeder
  Befehl bleibt über das Befehlsfeld erreichbar (geprüft in `03-wege`).
- **Die Statusleiste ist weg.** An ihrer Stelle schwebt eine Pille unten
  rechts, die auf Hover voll deckt.
- **Die Werkzeugzeile ist weg.** Sie trug fünfzehn Werkzeuge, von denen bei
  944 px zwölf sichtbar waren. Jedes Werkzeug steht jetzt unter dem Schritt
  des Vorgangs, zu dem es gehört; was in keinen Schritt gehört, findet das
  Befehlsfeld. Rückgängig und Wiederholen sind in den Kopf gezogen — sie
  gehören zu keinem Schritt, sondern zum Dokument.
- **Die Vorgangsschiene** rechnet ihren Stand aus dem Dokument, nicht aus
  Vorräten: Seitenzahl, Befunde, offene Felder, Unterschrift.
- **Die Werkzeugblase** erscheint an der Textauswahl — und nur dort.
- Jeder Schritt ist ein Aufklapper: `aria-expanded`, zweiter Druck schließt,
  Escape schließt und gibt den Fokus zurück.

Das Raster hat dadurch zwei Zeilen statt fünf: Kopf und Rumpf.

### Schmale Fenster

Unter 900 px sind die Leisten Schubladen, keine Spalten. Das Dokument steht
vorn; höchstens eine Leiste liegt darüber, die Bühne dunkelt dahinter ab, und
ein Tipp daneben oder Escape räumt sie weg. Beide Leistenschalter stehen in
der Pille, links und rechts außen — wie die Leisten selbst.

Das war vorher kaputt, und zwar schon vor „Vorgang": auf dem Telefon lagen
beide Leisten offen übereinander, und vom Dokument war nichts zu sehen. Der
Umbau hat es verschlimmert — die Pille rechnete ihren Abstand von der rechten
Leiste aus und stand bei x = −184, der linke Schalter war per CSS
ausgeblendet („die Leiste hat ihren eigenen Griff" — den gab es nie).

Dazu die Einstellung „Zoom beim Öffnen": sie wurde angeboten und nirgends
gelesen. Ihre Vorgabe heißt jetzt **Passend zum Fenster** — 100 %, wo die
Seite samt Rand auf die Bühne passt, sonst Breite. Auf dem Desktop ändert
sich nichts, auf dem Telefon passt das Blatt ins Fenster.

## Atelier — zwei Hände, ein Programm

Seit dem 04.10.2026 folgt das Studio dem Atelier-Entwurf (Figma
`P8MrdGvfyH1ZBjFtTl2zrC`, „PDF Studio — Vorgang", 12 Bildschirme). Er
ändert zweierlei: die **Hand** (Farben, Schrift, Kanten) und den **Aufbau**.

**Aufbau.** Statt Kopf + Schiene + Bühne steht das Studio jetzt wie ein
Arbeitsraum: Menüleiste oben, Navigation links mit Ansichten (Start,
Editor, …), rechts die Ansicht. Die Vorgangsschiene mit sechs Schritten ist
der **Modusleiste** gewichen — Bearbeiten, Kommentieren, Organisieren,
Exportieren —, deren Werkzeuge oben im Inspektor rechts stehen. Was am
Dokument ansteht, rechnet weiter das Dokument (`vorgangsstand()` in
`vorgang.js`) und steht als Zahl an den Reitern: „Hinweise 8", „Felder 2/10".
Kein Werkzeug ging verloren; die Prüfung „Die Werkzeuge tragen die Wörter
des Entwurfs" sammelt sie aus allen vier Modi ein.

**Zwei Hände, eine davon im Gebrauch.** Das Studio trägt das Atelier — seit
dem 04.10.2026 auch, wenn es aus der Konsole von hnvr.me kommt. `?von=hnvr`
nennt nur noch die Herkunft (`data-herkunft="hnvr"`) und zeigt den Rückweg
„Konsole / PDF Studio"; der Inhaber wollte das Studio dort so sehen, wie der
Entwurf es zeigt, nicht in Orange. Die Hand der Konsole gibt es weiter, nur
ausdrücklich gewählt (`?gestalt=hnvr`). Sie belegt dieselben Variablen neu
(`:root[data-gestalt="hnvr"]`); eine Prüfung hält fest, dass sie jede Variable
des Ateliers neu belegt.

**Das Deckblatt.** Der Start ist im Entwurf das eine Blatt ohne dunkle
Leisten (Figma, Seite „Deckblatt", Rahmen „PDF Studio · Dokumentenatelier"):
helle Menüzeile auf dem Papier mit Suche, „Lokal auf diesem Gerät",
Einstellungen und Konto; die Wortmarke; die Ansichten als Reiter darunter,
der aktive in Rost mit 4-px-Kante, rechts „Datei öffnen"; „Zuletzt geöffnet"
als Stapel (oben groß mit rostrotem Rücken, darunter schmal und je 14 px
eingerückt); die Sammlungen als Register; unten das dunkle Band. Es ist
dieselbe Hülle wie im Editor, nur anders gekleidet, solange
`data-ansicht="start"` gilt — sobald ein Dokument offen ist, stehen wieder die
dunkle Leiste oben und die Navigation links. Bewusst anders als im Entwurf:
die Symbole sind die des Studios (die exportierten aus Figma sind teils
beschädigt: die Lupe ohne Griff, die Unterschrift ein Punkt); Schriftgrößen
folgen der Staffel (34/33/29 → 32 px, 22 → 24, 9/10 → 11); „PRO" fehlt, weil
es keine Lizenz gibt; „Beispiel ansehen" und „Jedes Werkzeug auch einzeln"
bleiben, weil sie Wege sind, die es sonst nicht gäbe.

**Zwei Töne sind verschoben**, weil sie den Mindestkontrast nicht schaffen:
Graubraun `#7A6F63` auf Papier (4,3:1) wird `#746D61` (4,5:1); Kupfer als
Schrift auf der Leiste (3,8:1) wird `#D9A27A` (4,9:1).

**Was der Entwurf zeigt und das Studio (noch) nicht hat**, kommt in eigenen
Etappen: Dokumentenatelier mit lokaler Ablage und Sammlungen, Vertraulich
teilen in drei Schritten, Einstellungen als Seite. „PRO" und eine Lizenz
gibt es nicht — das Studio ist kostenlos.

### Dokumentenatelier und das Versprechen, nichts zu hinterlassen

Bis hierher versprach das Studio, nichts im Browser liegen zu lassen. Der
Entwurf zeigt „Zuletzt geöffnet" und Sammlungen — das geht nur, wenn Dateien
zwischen zwei Besuchen liegen bleiben. Beides zugleich geht nicht; deshalb
**entscheidet der Nutzer**, einmal, auf der Startseite:

- Bis zur Antwort wird nichts abgelegt (Prüfung „Ohne Zustimmung liegt nichts
  auf dem Gerät").
- „Nein" heißt: nichts. Die Antwort selbst wird gemerkt, damit die Frage nicht
  bei jedem Besuch kommt.
- „Ja" heißt: jede geöffnete Datei liegt in IndexedDB dieses Browsers, nach
  dem Sichern die gesicherte Fassung. Nichts davon geht ins Netz.
- In „Dokumente" lässt sich jede Datei einzeln entfernen, die Ablage leeren
  und die Antwort ändern.

Dieselbe Datei erscheint nur einmal (erkannt an Name und Größe); aus dem
Stapel geöffnet, wechselt das Studio zu ihrem Reiter, statt sie ein zweites
Mal zu öffnen. Die Prüfgruppe `14-dokumentenatelier` hält das fest — sie hat
beim Bau einen Fehler gefunden: ein verzögerter Vermerk „bearbeitet"
überschrieb nach dem Sichern „Gespeichert".

### Vertraulich teilen — und drei Fehler, die dabei auffielen

Der Ablauf baut auf dem, was das Studio schon konnte (Schwärzen durch
Rastern, Metadaten entfernen), und ergänzt, was für eine *sichere* Kopie
fehlte: Fundstellen mit Lage, ein Neuaufbau ohne Kommentare, Anhänge,
Ebenen, Skripte und Lesezeichen, und eine Nachprüfung der fertigen Kopie.

Beim Bau kamen drei Fehler heraus, die älter sind als der Ablauf:

1. **Erkannter Text kam unter der Schwärzung zurück.** Beim Sichern wurde
   die OCR-Textebene auf gerasterten Seiten wieder unsichtbar eingeschrieben
   — samt der geschwärzten Wörter. Wer die Datei durchsuchte, fand sie.
   Jetzt fallen Wörter weg, die eine Schwärzung berühren (Prüfung mit
   Gegenprobe: ohne den Fix schlägt sie an).
2. **Die IBAN wurde ohne ihre letzten Ziffern erkannt** („… 2020" statt
   „… 2020 51"). Geschwärzt hätte das zwei Ziffern stehen lassen.
3. **Das Steuermerkmal lief in den nächsten Satz.** Das Muster trug den
   Schalter `i`; damit passte `[A-Z]` auch auf Kleinbuchstaben. Bestätigt
   hätte das einen halben Absatz geschwärzt.

Und eine Ungenauigkeit im eigenen Bau: die Balken saßen anfangs bis zu einem
Buchstaben daneben, weil die Lage nach Zeichenzahl statt nach Schriftbreite
gerechnet war. Da die Seite als Bild ausgegeben wird, hätte die
Textnachprüfung das nicht gefunden. Jetzt wird mit der Schrift gemessen und
ein Rand zugegeben; die Prüfung misst jeden Balken gegen die Textebene, die
der Browser beim Markieren benutzt.

### Einstellungen als Seite — und was dabei nicht wirkte

Der Entwurf zeigt neun Bereiche mit gut fünfzig Zeilen. Gebaut ist, was im
Browser wirklich etwas schaltet: Dichte, Skalierung, Dokumentpapier (nur
Anzeige), Kontrast, ruhige Bewegung, starker Fokus, Kürzel in Menüs,
Hinweise und ihre Höchstzahl, Zoom beim Öffnen, Seitenzahlen, Textgröße,
Kommentarfarbe, Strichstärke, OCR-Sprache und -Auflösung, Metadaten und
Kommentare beim Sichern, die Warnung vor personenbezogenen Angaben. Der
Rest steht als Zustand da („Drucker: im Druckdialog", „KI: nicht
eingebaut") oder als Knopf auf einen vorhandenen Befehl.

Beim Verdrahten fiel auf, dass sechs Einstellungen der alten Fassung zwar
dastanden, aber von niemandem gelesen wurden — darunter „Metadaten
entfernen" und „Vor Weitergabe warnen". Sie wirken jetzt, und je eine
Prüfung weist die Wirkung nach. Die neue Prüfgruppe fand außerdem einen
Fehler in der Seite selbst: das Suchfeld wurde bei jedem Tastendruck neu
gebaut, die Schreibmarke sprang an den Anfang, aus „Metadaten" wurde
„netadateM".

## hnvr.me-Rebrand (jetzt die Hand der Konsole)

Seit das Studio eine App von hnvr.me ist, trägt es dieselbe Hand wie die
Konsole (Figma „Atelier OS", Seite Rebrand; Werte aus `plattform.css`). Die
Richtung bleibt „Vorgang".

| Was | Apple-Anmutung | Rebrand |
|---|---|---|
| Kopf, Vorgangsschiene | hell | dunkel wie die Leiste der Konsole: `#172124`, Flächen `#263438`, Text `#F3F7F7` |
| Akzent | Blau | Orange `#FF7120` als Fläche mit Tinte `#172124` darauf; `#A83C05` als Schrift auf Hell |
| Aktiver Schritt | blaue Tönung | volle orange Fläche wie der aktive Menüpunkt der Konsole |
| Zähler | Systemschrift | Geist Mono, orange — wie die Zähler im Menü der Konsole |
| Etiketten | halbfett | 10 px Versalien, gesperrt („VORGANG", „S. GLIEDERUNG") |
| Titel / Text | System / Inter | Space Grotesk / Inter |
| Befehlsfeld | Knopf | weißes Suchfeld „Suchen oder Befehl … ⌘K" |
| Radien | 8 / 10 / 14 | 8 / 12 / 16 |
| Bühne | Grau | Verlauf `#EFF3F3 → #E6EBEC → #DCE4E5` wie die Arbeitsfläche der Konsole |

**Weiß auf Orange gibt es nicht.** `#FF7120` erreicht mit Weiß nur 2,9:1,
mit Tinte 5,97:1. Auf der dunklen Leiste trägt Orange auch als Schrift (5,97:1
auf `#172124`, 4,68:1 auf `#263438`); auf Hell nur das dunkle `#A83C05`
(6,34:1).

**Als App von hnvr.me** setzt die einbettende Seite zwei Kopfzeilen,
`studio-heimat` und `studio-heimat-name`. Dann steht im Kopf
„KONSOLE / PDF STUDIO" und führt zurück — wie der Pfad oben in der Konsole.
Erlaubt sind nur https-Adressen und Pfade derselben Seite. Ohne die Zeilen
bleibt der Kopf ohne Pfad: das Studio im Repository weiß nichts von hnvr.me.

## Apple-Anmutung (abgelöst)

Die Richtung bleibt „Vorgang" — die Schiene, die Blase, die Schubladen. Neu
ist die Hand, in der sie gezeichnet ist: näher an macOS und iPadOS, weil das
Studio dort zu Hause ist.

| Was | Vorher | Jetzt |
|---|---|---|
| Akzent | fast Schwarz, stärkster Kontrast zum Grund | Blau: `#0066CC` als Schrift, `#0071E3` als Fläche |
| Schrift | IBM Plex Sans, Mono für Etiketten | Systemschrift (SF Pro auf Apple-Geräten), sonst Inter; Ziffern tabellarisch |
| Etiketten | Mono, Versalien, gesperrt | halbfett, normale Schreibung |
| Radien | 6 / 10 | 8 / 10 / 14, Kapseln für Schalter und Meldungen |
| Reiter | Strich unter dem Wort | Segmentsteuerung |
| Schalter | eckig, blau | iOS-Schalter, grün |
| Blase an der Auswahl | helle Tafel | dunkles HUD wie das Bearbeiten-Menü auf dem iPhone |
| Dialoge | dunkler Kopfbalken | Blatt mit Titel auf der Fläche, runder Schließknopf, Grund verwischt |
| Pille, Meldungen | Fläche | Material: durchscheinend mit Unschärfe |

**Die Farbregel wird genauer, nicht aufgegeben.** Blau heißt bedienbar,
Orange/Grün/Rot heißen Zustand. Blau gibt es zweimal, aus einem gerechneten
Grund: in der dunklen Fassung gibt es keinen Blauton, der als Schrift auf
Dunkel *und* als Fläche unter weißer Schrift je 4,5:1 schafft — die Bereiche
überlappen nicht. Also `--tally` für Schrift und Linie, `--tally-voll` für
Flächen.

**SF Pro liegt nicht bei.** Apples Lizenz erlaubt sie nur für Oberflächen auf
Apple-Plattformen. Auf einem Mac oder iPad nimmt das Studio sie vom Gerät,
überall sonst greift Inter (OFL, ein variabler Schnitt, 48 kB).

Beim Umbau kamen Fehler heraus, die älter sind als er:

- Der Einstellungsknopf im Kopf reichte das Klick-Ereignis als Kategorie
  durch — der Dialog zeigte „[object PointerEvent]" und keine Einstellung.
- Seitenordnung und Vergleich trugen weiße Schrift auf `--chrome-600`, gebaut
  für die dunkle Chrome der Registratur. Seit „Vorgang" stand das grau auf
  grau.
- Auf der Webseite hob eine spätere Regel die Ausblendung der Navigation
  auf dem Telefon wieder auf; die Punkte lagen hinter dem Kopfknopf.
- Fünf feste Farbwerte auf der Webseite hätten in der dunklen Fassung dunkle
  Schrift auf Dunkel ergeben.

## Was noch nicht existiert

Die Bauteilbibliothek in Figma und die übrigen Bildschirme dort (Empfang,
Einzelwerkzeuge, Dialoge). Aus der alten Runde bleiben: die Token-Staffeln als
Gerüst, die Bauteilstruktur und die Prüfungen, die gerenderte Pixel messen.
