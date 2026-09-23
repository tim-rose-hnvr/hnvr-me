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

## Was noch nicht existiert

Die Bauteilbibliothek, die übrigen Bildschirme (Empfang, Einzelwerkzeuge,
Dialoge) — und **nichts davon ist gebaut**. Die laufende Anwendung trägt
weiterhin Registratur. Was aus der alten Runde bleibt und wiederverwendet
wird: die Token-Staffeln als Gerüst, die Bauteilstruktur und die 169
Prüfungen, die gerenderte Pixel messen.
