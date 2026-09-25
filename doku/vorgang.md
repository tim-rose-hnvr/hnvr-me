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

## Was noch nicht existiert

Die Bauteilbibliothek in Figma und die übrigen Bildschirme dort (Empfang,
Einzelwerkzeuge, Dialoge). Aus der alten Runde bleiben: die Token-Staffeln als
Gerüst, die Bauteilstruktur und die Prüfungen, die gerenderte Pixel messen.
