# pnkt — ein selbständiges System für gedruckte QR-Codes

Ein Programm, ein Verzeichnis, keine Abhängigkeiten. Kein Wix, keine
Datenbank, kein Rechenzentrum, kein fremdes Paket — die
Abhängigkeitsliste ist die Go-Standardbibliothek und sonst nichts.

```
cd pnkt
go build -o pnkt .
./pnkt -daten ./daten -adresse :8080
```

Das Binär ist rund 9 MB und läuft auf allem, was Linux spricht, bis
hinunter zum Einplatinenrechner. Sichern heißt: das Datenverzeichnis
kopieren. Umziehen heißt: Binär und Verzeichnis kopieren.

---

## Warum überhaupt selbst gebaut

Der QR-Markt besteht aus Werkzeugen für Bildschirme. Bitly, Uniqode und
Flowcode erzeugen hübsche Codes, sagen aber vor dem Druck nichts über
Modulgröße, Verfahren oder Kontrast — und ein Fehler fällt dort erst auf,
wenn die Auflage liegt. Fremde QR-Bibliotheken liefern meist nur ein
Bild; wer drucken will, braucht die Modulmatrix selbst in der Hand.

Deshalb ist der Encoder eigener Code: **Modulgröße, Ruhezone, Maske und
Fehlerkorrektur sind Druckentscheidungen, keine Darstellungsdetails.**

---

## Aufbau

| Paket | Aufgabe |
|---|---|
| `qr` | QR-Encoder nach ISO/IEC 18004 — Versionen 1 bis 40, Stufen L/M/Q/H, Ziffern-, Alphanumerik- und Bytebetrieb, Reed-Solomon in GF(256), Maskenwahl nach den vier Strafregeln |
| `qr` (svg.go) | Vektorausgabe in Millimetern: zwölf Modulformen, eigene Augenformen, Ruhezone, Logoaussparung. Kein eingebettetes Rasterbild |
| `druck` | Druckurteil nach den **veröffentlichten Grenzwerten** von pnkt.me: 0,20 mm Bildschirm, 0,40 mm Laser und Tinte, 0,50 mm Offset, 0,75 mm Großformat, 1,00 mm Gravur; Kontrast ab 4:1, Ruhezone 4 Module, Warnung ab 60 % verbrauchter Reserve |
| `farbe` | Drei Farbwelten: Bildschirm, CMYK und Sonderfarbe mit Ersatzrezept |
| `regel` | Wohin ein Scan führt: Liste statt Zuordnung, mit Zeitzone; UTM mit Platzhaltern |
| `gs1` | GTIN-Prüfziffer nach Modulo 10, Digital Link bauen und zurücklesen |
| `inhalt` | GiroCode nach EPC069-12 mit IBAN-Prüfung (ISO 13616, Modulo 97, Längentabelle je Land), vCard 3.0, WLAN |
| `speicher` | Anhängende Dateien plus Verzeichnis im Arbeitsspeicher. Kollisionsschutz beim Kürzel, Fassungszählung, Ereignisprotokoll, Tageszähler, Produktpässe |
| `pass` | Prüfung eines Produktpasses auf Vollständigkeit — Identität, Verantwortlicher, Stoffe, Nutzung und Ende |
| `uebernahme` | Bestand aus dem Wix-Datenspeicher holen. Trockenlauf zuerst, immer |
| `ausgabe` | PDF und EPS von Hand geschrieben — echter Vektor in Punkt, ohne fremdes Paket. Verläufe als Schattierung (PDF Typ 2 und 3, PostScript `shfill`), Beschriftung in Helvetica |
| `main.go` | Weiterleitung, Schnittstelle, Massenanlage, Studio, Zentrale, Produktpass |

### Die Ablage

Fünf Dateien, jede nur angehängt:

```
daten/codes.jsonl        jede Fassung eines Codes, die letzte gilt
daten/ereignisse.jsonl   wer hat wann welches Ziel geändert
daten/zaehler.jsonl      Scans je Code und Tag, in Klassen
daten/paesse.jsonl       jede Fassung eines Produktpasses
daten/zugang.jsonl       Konten, Schlüssel, Marken
```

Eine Änderung ist ein neuer Satz mit derselben Kennung. Damit ist die
Geschichte eines gedruckten Codes vollständig — und genau die braucht
man, wenn jemand fragt, wohin ein Code im März gezeigt hat. Ein
Stromausfall mitten im Schreiben kostet den letzten Satz, nicht die
Ablage; jeder Satz wird vor der Bestätigung durchgeschrieben.

---

## Was der Dienst kann

Die Wege folgen dem, was **pnkt.me unter „Schnittstelle" veröffentlicht
hat** — nicht umgekehrt. Wer einmal etwas gegen diese Zusage geschrieben
hat, darf nicht dadurch brechen, dass eine zweite Fassung eigene Pfade
erfindet. Der Schlüssel steht im Kopf `x-punkt-schluessel`.

| Weg | Zweck | Zugang |
|---|---|---|
| `GET /r/{kuerzel}` und `GET /{kuerzel}` | Weiterleitung, zählt den Scan | offen |
| `GET /r/{kuerzel}/vorschau` | Ziel anzeigen, ohne hinzugehen und ohne zu zählen | offen |
| `GET /01/{gtin}` | GS1 Digital Link — Auflösung über die GTIN | offen |
| `GET /api/v1/typen` | Inhaltstypen samt Formularaufbau | offen |
| `POST /api/v1/rendern` | Code erzeugen — SVG, PDF oder EPS | offen |
| `GET /api/v1/vorlage.csv` | Beispieltabelle für die Massenanlage | offen |
| `GET /api/v1/druckpruefung` | Druckurteil ohne etwas anzulegen | offen |
| `POST /api/v1/konten`, `/anmelden`, `/schluessel` | Konto und Schlüssel | offen |
| `GET/POST /api/v1/codes` | Codes lesen und anlegen; `?suche=…&ordner=…` | Schlüssel |
| `GET /api/v1/ordner` | Ordner der Organisation samt Anzahl | Schlüssel |
| `PATCH /api/v1/codes/{id}` | Ziel, Name, Ordner ändern — neue Fassung, Protokolleintrag | Schlüssel |
| `DELETE /api/v1/codes/{id}` | Code löschen, Kürzel bleibt reserviert | Inhaber |
| `GET /api/v1/codes/{id}/statistik`, `/protokoll` | Auswertung, Änderungsgeschichte | Schlüssel |
| `POST /api/v1/massenanlage` | CSV hinein, ZIP heraus | Schlüssel |
| `GET /api/v1/marke` | Erscheinungsbild des aufgerufenen Hostnamens | offen |
| `PUT /api/v1/marke` | Marke setzen | Inhaber |
| `GET/POST /api/v1/mitarbeitende`, `DELETE …/{id}` | Personen der Organisation | Schlüssel / Inhaber |
| `GET /qr.svg\|pdf\|eps?inhalt=…` | derselbe Vektor über die Adresszeile | offen |
| `POST /api/v1/inhalt` | Felder zu Nutzlast: vCard, WLAN, GiroCode, GS1 | offen |
| `GET /` | Studio | offen |
| `GET /zentrale` | Zentrale: suchen, ordnen, löschen | offen |
| `GET /p/{gtin}`, `/p/{gtin}/{charge}` | Produktpass als Seite oder JSON | offen |
| `POST /api/v1/pass/pruefen` | Pass messen, ohne ihn zu veröffentlichen | offen |
| `GET/PUT /api/v1/pass` | Pässe lesen und setzen | Schlüssel |
| `DELETE /api/v1/pass/{gtin}` | Pass zurückziehen | Inhaber |

`POST /api/v1/rendern` trägt das Urteil im Antwortkopf `x-punkt-pruefung`
(`gut`, `achtung`, `kritisch`) — auch beim Binärabruf. Wer eine Datei
bekommt, soll nicht raten müssen, ob sie druckreif ist.

### Zugang

Wie auf pnkt.me festgelegt: Passwörter als PBKDF2-Abdruck mit
**210 000 Runden**, Schlüssel nur als **SHA-256-Abdruck**. Ein Schlüssel
wird genau einmal im Klartext zurückgegeben und danach nie wieder — er
lässt sich nicht anzeigen, nur ersetzen. Nach fünf Fehlversuchen ist ein
Konto fünfzehn Minuten gesperrt. Schlüssel mit „nur lesen" bekommen auf
schreibende Wege 403.

### Drei Regeln, die im Code stehen

1. **Ein Scan läuft nie in einen Serverfehler.** Unbekannt, gesperrt,
   stillgelegt, abgelaufen — jeder Fall bekommt eine lesbare Seite.
   Dahinter steht ein Mensch mit einem Telefon vor einem Plakat.
2. **Keine IP-Adresse, kein Kennzeichen im Gerät, keine Zeile je Scan.**
   Gezählt wird in Klassen: Gerät, System, Sprache, Quelle, Stunde. Was
   hier nicht entsteht, kann später niemand verlangen oder herausgeben
   müssen.
3. **Das Regelwerk ist eine Liste, keine Zuordnung** — die erste
   zutreffende Regel gewinnt. Damit bestimmt der Kunde selbst, ob am
   Wochenende in Österreich die Wochenend- oder die Landesregel greift.
   Bei einer Zuordnung entschiede das Programm, und niemand könnte es
   vorhersagen.

Die Landregel wertet einen Kopf aus, den ein vorgelagerter Server setzt.
Eine eigene Standortbestimmung findet nicht statt.

---

## Prüfung

```
go test ./...
```

Alle Pakete grün. Wichtiger ist aber die Prüfung, die ein Encoder
sich nicht selbst ausstellen kann: **184 Symbole über alle 40 Versionen
und alle vier Fehlerkorrekturstufen wurden von zwei fremden Decodern
gegengelesen** — jsQR im Browser und OpenCV. Jedes Symbol wird von
mindestens einem der beiden exakt gelesen; die Schnittmenge der Ausfälle
ist leer.

Dass die beiden Decoder *verschiedene* Symbole nicht lesen — jsQR
scheitert an Version 23-L, OpenCV liest genau die —, ist der Beleg
dafür, dass es an den Decodern liegt und nicht am Encoder. Ein einzelner
Decoder als Schiedsrichter hätte hier in die Irre geführt.

Gefunden hat diese Prüfung unter anderem einen echten Fehler: das immer
dunkle Modul wurde von den Platzhaltern der Formatangabe wieder
überschrieben.

Die Druckdateien sind ebenso gegengelesen, und **jetzt alle drei**:
neun Fassungen — einfarbig, drei Verläufe, fließende Module, zwei Rahmen
und die Kombination aus allem — je als SVG, PDF und EPS gerastert und
zurückgelesen. **27 von 27.** SVG über Chromium, PDF über pdfium, EPS
über Ghostscript. Die frühere Lücke bei EPS ist damit geschlossen.

Dabei kam ein Fehler heraus, den nur das Auge findet und kein Decoder:
Die Beschriftung im Rahmen kam als Buchstabensalat heraus, weil Go seine
Zeichenketten als UTF-8 hält und die eingebauten Schriften von PDF und
PostScript Latin-1 erwarten — ein Umlaut sind zwei Byte und wurden als
zwei falsche Zeichen gesetzt. Im SVG fiel nichts auf, das kann UTF-8.
Behoben durch Umkodierung und, in EPS, durch Umschalten der Schrift auf
`ISOLatin1Encoding`.

Die Geometrie liegt an einer Stelle: SVG, PDF und EPS lesen dieselben
Grundformen. Sonst zeigt die Vorschau etwas anderes als die Druckdatei,
und das merkt niemand, bevor die Auflage liegt.

**Die Augenformen sind vermessen, nicht geschätzt.** 160 Kombinationen aus
zehn Modul-, vier Rahmen- und vier Kernformen, gegengelesen mit OpenCV:

| Augenrahmen | gelesen |
|---|---|
| `quadrat` | 40 von 40 |
| `kissen` (Radius 1 Modul) | 40 von 40 |
| `blatt` (Radius 2 Module) | 0 von 40 |
| `rund` (Vollkreis) | 0 von 40 |

Das ist keine Abstufung, sondern eine Kante — und sie bestätigt, was auf
`pnkt.me/lesbarkeit` unter „Formwahl" steht: gesucht wird das Verhältnis
1:1:3:1:1 in den Positionsmarken. Die Druckprüfung nennt jetzt diese
Zahlen im Befund. Verboten wird nichts: Telefonkameras sind nachsichtiger
als ein Prüfdecoder, und die Entscheidung gehört dem Gestalter.

Dieselbe Messung hat einen zu klein geratenen Punktkern aufgedeckt
(Radius 0,38 statt 0,44 der Kernbreite) — behoben, danach 40 von 40.

Die zwölfte Modulform, **`tropfen`** — drei Ecken voll gerundet, die
vierte spitz —, ist auf demselben Weg nachgeprüft: 32 Kombinationen aus
zwei Augenrahmen, vier Kernformen und allen vier Fehlerkorrekturstufen,
über die eigene PDF-Ausgabe, mit Ghostscript gerastert, mit OpenCV
gelesen. **32 von 32** — und ebenso die Gegenprobe mit `quadrat` auf
derselben Nutzlast.

Die Gegenprobe ist hier der eigentliche Punkt. Beim ersten Lauf, mit nur
einer Auflösung, las der Decoder 29 von 32 Tropfen — aber nur 25 von 32
Quadraten. Die bekannt gutmütige Form schnitt schlechter ab als die neue;
gescheitert war also der Prüfstand, nicht die Form. Erst über mehrere
Auflösungen lesen beide alles. Ohne Gegenprobe hätte diese Messung eine
Form beschuldigt, die nichts getan hat. Der Prüfstand steht in
`cmd/probe5`.

Die Prüfwerkzeuge liegen bewusst **nicht** im Programm — jsQR und OpenCV
sind Testzubehör, kein Bestandteil. Das Binär bleibt abhängigkeitsfrei.

---

## Gestaltung

Alle zwölf Modulformen, vier Rahmen- und vier Kernformen, dazu:

- **Verläufe** linear und radial, in **allen drei** Ausgabeformaten — im
  PDF als Schattierung vom Typ 2 und 3, in EPS über `shfill`. Der Verlauf
  wird nicht je Modul gemalt, sondern einmal über die Fläche und auf die
  Module beschnitten; sonst bekäme jedes Modul denselben Ausschnitt und
  der Verlauf wäre keiner.
- **Fließende Module**, die sich mit ihren Nachbarn verbinden: gerundet
  wird nur die Ecke, an der kein gesetztes Modul anschließt.
- **Rahmen mit Aufforderung** als Balken oder Schild. Der Code wird dabei
  **nicht** verkleinert — die Modulgröße ist eine Druckentscheidung und
  darf nicht still dadurch sinken, dass jemand eine Beschriftung dazunimmt.

Beim Verlauf rechnet die Prüfung den Kontrast gegen die **hellste** Marke.
Wer nur die dunkelste prüft, gibt Verläufe frei, die oben auslaufen.

### Farbe für den Druck

Auf dem Bildschirm ist eine Farbe drei Zahlen. In der Druckerei sind es
vier — oder ein Topf mit einer Nummer darauf. Farben tragen deshalb ihre
Herkunft mit:

```
#0d0d12                        Bildschirmfarbe
cmyk(0, 0.92, 0.86, 0.12)      vier Kanäle, wie die Maschine sie druckt
sonder(HKS 13 K, 0, 1, 1, 0)   ein Topf, mit Ersatzrezept für alles andere
```

PDF und EPS schreiben daraus den passenden Farbraum: `k` beziehungsweise
`setcmykcolor` für CMYK, einen `/Separation`-Farbraum für Sonderfarben,
in EPS zusätzlich mit `%%DocumentCustomColors` im Kopf. Das SVG zeigt
eine Näherung — welches Rot am Ende aus der Maschine kommt, entscheidet
das Profil der Druckerei.

**Nachgewiesen mit Ghostscript** (`-sDEVICE=tiffsep`, das die Auszüge
einzeln schreibt):

| Datei | gefundene Auszüge |
|---|---|
| `rgb.pdf`, `rgb.eps` | Cyan, Magenta, Yellow, Black |
| `cmyk.pdf`, `cmyk.eps` | Cyan, Magenta, Yellow, Black |
| `sonder.pdf`, `sonder.eps` | Cyan, Magenta, Yellow, Black **und `HKS 13 K`** |

Alle sechs Dateien bleiben lesbar.

## Studio

Alles an einem Ort, in der Reihenfolge des Ablaufs statt der Technik:
**Inhalt, Form, Farbe, Rahmen, Druck**. Das Urteil steht neben der
Vorschau und nicht am Ende — eine Warnung nach dem Export hilft niemandem
mehr.

- Sechs Inhaltstypen; IBAN und GTIN werden **auf dem Server** geprüft,
  bevor überhaupt ein Code entsteht.
- Zwölf Modulformen, vier Rahmen- und vier Kernformen, mit der Messung
  daneben: quadratische und leicht gerundete Augen 40 von 40, Blatt und
  Rund kein einziges Mal.
- Vier Farbwelten: Hexfarbe, CMYK, Sonderfarbe, Verlauf.
- Rahmen mit Aufforderung, Logoaussparung, Ruhezone, Fehlerkorrektur.
- Druckverfahren mit den veröffentlichten Grenzwerten und der Faustregel
  für den Leseabstand.
- Export als SVG, PDF und EPS — echter Vektor. PNG rechnet der Browser
  aus demselben SVG; für den Druck nimmt man es nicht.

Die Marke kommt aus dem Hostnamen: dasselbe Studio trägt bei jedem
Kunden dessen Gesicht.

## White-Label

Ein Binär, viele Marken, auseinandergehalten am **Hostnamen**. Eine
Agentur kann ihren Kunden damit einen eigenen Dienst anbieten, ohne dass
jemand eine zweite Anlage betreibt.

```
PUT /api/v1/marke
{ "name":"Bäckerei Klein", "host":"qr.baecker.de",
  "primaer":"#7a4a12", "grund":"#fdf6e9", "tinte":"#2b1a06",
  "logoSvg":"<svg …>", "impressum":"…", "datenschutz":"…" }
```

Derselbe unbekannte Code, über zwei Hostnamen gescannt:

| Host | Titel | Fläche |
|---|---|---|
| `code.hnvr.me` | Unbekannter Code · hnvr.me | `#101014` |
| `qr.baecker.de` | Unbekannter Code · Bäckerei Klein | `#fdf6e9` |

Ein Hostname gehört genau einer Organisation — zwei Marken auf demselben
Namen wären nicht auflösbar, und ein Kunde sähe die Hinweisseite eines
anderen. Das Logo wird als SVG eingebettet, nicht verlinkt: eine
Hinweisseite darf nichts nachladen müssen, um lesbar zu sein.

Entscheidend ist, was eine Marke **nicht** ist: kein eigener Codestand
und keine eigene Datenhaltung. Wer je Kunde einen Zweig aufmacht, pflegt
nach dem dritten Kunden drei Programme.

## Mitarbeitende

Drei Rollen, wie auf pnkt.me festgelegt:

| Rolle | lesen | schreiben | verwalten |
|---|---|---|---|
| Inhaber | ja | ja | ja |
| Redakteur | ja | ja | nein |
| Leser | ja | nein | nein |

Codes gehören der **Organisation**, nicht der einzelnen Person —
Mitarbeitende sehen dieselben Codes wie der Inhaber, sonst wäre
gemeinsame Arbeit an einer Kampagne nicht möglich. Eine fremde
Organisation sieht nichts.

Ein Schlüssel kann nie mehr dürfen als die Person, der er gehört: Wird
jemand zum Leser herabgestuft, verlieren seine Schlüssel im selben
Augenblick das Schreibrecht. Einladungen per E-Mail gibt es nicht — die
Person legt sich selbst ein Konto an, der Inhaber holt sie herein. Damit
wandert kein Passwort durch ein Postfach. Beim Entlassen bleibt das
Konto bestehen; es gehört der Person, nicht der Organisation.

## Massenanlage

Das Stück, das eine Agentur täglich braucht:

```
curl -X POST "localhost:8080/api/charge?breite=40&stufe=Q&verfahren=offset&anlegen=1&eps=1" \
     --data-binary @plakate.csv -o charge.zip
```

Kopfzeile `name,ziel,gtin`. Je Zeile entstehen SVG, PDF und auf Wunsch
EPS; Zeilen mit GTIN bekommen statt eines Kurzwegs einen GS1 Digital
Link. Dazu kommt `bericht.csv` — und der ist der eigentliche Gegenstand:
je Zeile Kürzel, Version, Modulgröße, Note und der Grund, falls etwas
nicht druckreif ist.

Eine Agentur legt selten einen Code an, sondern vierhundert. Ohne diese
Liste müsste jemand vierhundert Dateien einzeln ansehen — und dann sieht
sie niemand an. Fehlerhafte Zeilen brechen den Lauf nicht ab, sie stehen
mit Grund im Bericht: falsche Prüfziffer, fehlendes Ziel, zu kleine
Module für das gewählte Verfahren.

## Zentrale

Das Studio baut Codes, die Zentrale führt sie. Unter `/zentrale`: Suche
über Name, Kürzel, Ziel, GTIN und Ordner, Ordner als Reiter mit Anzahl,
Ordner setzen und leeren, Löschen. Eine Agentur legt selten einen Code an,
sondern vierhundert — und findet ihn ein halbes Jahr später wieder.

Der Schlüssel bleibt im Tab und wird beim Schließen vergessen. Gespeichert
wird er nirgends; auf dem Server liegt ohnehin nur sein SHA-256-Abdruck.

### Löschen ist kein Vergessen

Ein Kürzel wird **einmal vergeben und nie wieder** — auch nicht, wenn der
Code gelöscht ist. Das Kürzel steht auf Papier, und Papier lässt sich
nicht löschen. Würde es wieder frei, zeigte ein gedrucktes Plakat eines
Tages auf das Ziel eines Fremden. Aus demselben Grund bleibt auch ein
umbenanntes Kürzel gültig und führt weiter zum selben Code.

Gelöscht heißt deshalb: aus der Liste heraus, Ziel weg, Kürzel gesperrt.
Ein Scan bekommt danach **410 Gone** mit einer lesbaren Seite — nicht
„unbekannt", denn diesen Code gab es, und wer ihn scannt, hält etwas
Gedrucktes in der Hand.

Löschen darf nur der Inhaber. Es ist der einzige Vorgang, den eine
gedruckte Auflage nicht überlebt; ein Redakteur darf ändern, nicht
vernichten. Zum Bestätigen tippt man in der Zentrale das Kürzel ab.

### Ein Code gehört seiner Organisation

Jeder Zugriff auf einen einzelnen Code — ändern, löschen, Statistik,
Protokoll — prüft, ob er zur Organisation des Schlüssels gehört. „Gibt es
nicht" und „gehört einem anderen" bekommen dieselbe Antwort: sonst ließe
sich durch Probieren herausfinden, welche Kennungen es gibt.

## Produktpass

Die ESPR verlangt einen Datenträger am Produkt und dahinter Angaben, die
ein Mensch und eine Maschine lesen können. Der QR-Code ist der billige
Teil davon; die Seite ist die Anforderung.

```
PUT /api/v1/pass        { "gtin":"4006381333931", "bezeichnung":"…", … }
GET /p/4006381333931    die Seite, oder JSON mit Accept: application/json
```

Drei Entscheidungen stecken im Aufbau:

**Der Pass hängt an der GTIN, nicht am Code.** Ein Artikel bekommt seinen
Pass einmal; ob er auf zehn Etiketten gedruckt wird oder auf eines, ändert
daran nichts. Gesucht wird von genau nach allgemein — erst GTIN mit Charge
und Serie, dann nur mit Charge, dann der Artikel. So bekommt eine
Rückrufcharge ihre eigenen Angaben, ohne dass jede Charge einen Pass
braucht.

**Jede Fassung bleibt stehen.** Ein Pass beschreibt ein Produkt, das
jemand in der Hand hält. Wer sein Gerät von 2026 nachschlägt, darf nicht
die Angaben zum Nachfolger sehen.

**Beschränkte Angaben verlassen den Server nicht.** Die ESPR sieht
Felder vor, die nur Marktaufsicht, Reparaturbetriebe und Verwerter sehen.
Die Trennung geschieht in den Daten, nicht in der Oberfläche — eine Seite,
die etwas ausblendet, hat es trotzdem ausgeliefert. Dass etwas
zurückgehalten wird, steht dagegen sehr wohl auf der Seite: das ist selbst
keine Geheimsache, und wer es braucht, weiß dann, dass es sich zu fragen
lohnt.

Die Prüfung misst vier Abschnitte — Identität, Verantwortlicher, Stoffe,
Nutzung und Ende. Fehler verhindern die Veröffentlichung, Warnungen nicht:
**welche Angabe Pflicht ist, entscheidet der delegierte Rechtsakt der
Produktgruppe, und den kennt dieses Programm nicht.** Was es prüfen kann,
prüft es hart — eine falsche GTIN-Prüfziffer ist ein Fehler, denn der
Datenträger löst darüber auf, und Anteile über hundert Prozent gibt es
nicht.

`GET /01/{gtin}` bleibt, wie es war: Ist zu der GTIN ein Ziel hinterlegt,
gilt das Ziel. Der Pass springt nur ein, wo nichts anderes steht — sonst
hätten bestehende Etiketten über Nacht ein anderes Verhalten.

## Übernahme aus Wix

```
go run ./cmd/uebernahme -quelle ./ausfuhr                          # Bericht
go run ./cmd/uebernahme -quelle ./ausfuhr -daten ./daten -schreiben
```

Je Sammlung eine Datei mit der Antwort der Wix-Datenschnittstelle:
`PK_Codes.json`, `PK_Ordner.json`, `PK_Konten.json`, `PK_Mitglieder.json`,
`PK_Ereignisse.json`.

**Der Lauf ist trocken, solange nicht `-schreiben` gesetzt ist.** Der
Bericht entsteht in beiden Fällen gleich — wer erst beim Schreiben merkt,
dass ein Kürzel doppelt ist, hat den halben Bestand schon drin.

Gegen den echten Bestand des laufenden Projekts durchgeführt:

```
codes          4 gelesen,   4 übernommen
ereignisse     4 gelesen,   4 übernommen
konten         2 gelesen,   2 übernommen
mitglieder     1 gelesen,   0 übernommen
ordner         0 gelesen,   0 übernommen
verwaist       1 gelesen,   1 übernommen
0 Fehler.
```

Danach löst `/2cnjdq` auf `https://pnkt.me` auf, die beiden stillgelegten
Altzeilen antworten mit 410, und Unbekanntes mit 404.

Drei Dinge, die der Bericht dabei gesagt hat:

**`maepux` ist verwaist.** Das Kürzel steht im Protokoll als gelöscht und
fehlt in `PK_Codes` — in der Quelle ist es damit wieder frei und kann ein
zweites Mal vergeben werden, obwohl es auf Papier stehen kann. Die
Übernahme sperrt es dauerhaft.

**Die Mitarbeiterzeile ließ sich nicht binden.** `admin@hnvr.me` steht in
`PK_Mitglieder`, hat aber kein Konto in `PK_Konten`. Das ist ein Befund,
keine stille Auslassung: die Person legt sich selbst ein Konto an, danach
holt der Inhaber sie herein.

**Passwörter wandern unverändert.** Gleiches Verfahren, gleiche
Rundenzahl, gleiches Salz. Eine einzige Anmeldung bestätigt das; scheitert
sie, liegt es am Salz und die Passwörter müssen neu gesetzt werden.

Was die Quelle nicht hergibt, wird nicht erfunden. Eine Gesamtzahl von
Scans ohne Tage lässt sich nicht aufteilen — sie kommt als eine Zeile
unter `herkunft:uebernahme` am Anlagetag herein und bleibt als solche
erkennbar. Eine erfundene Tagesverteilung wäre schlimmer als eine
ehrliche Klumpenzahl.

## Betrieb

Systemd-Unit, Containerfile, Caddyfile und ein Sicherungsskript liegen in
`betrieb/`, samt dem, was vor dem ersten Start entschieden sein muss —
siehe `betrieb/README.md`.

Zwei Angaben lassen sich später nicht mehr folgenlos ändern: `-host`
steht im GS1 Digital Link und damit auf gedruckten Etiketten, und die
Länge der Kurzdomain bestimmt die Größe jedes gedruckten Codes.

## Was noch fehlt

- **Der Zielrechner.** Nichts davon läuft irgendwo. Welche Maschine es
  wird und ob `pnkt.me` selbst darauf zeigen soll, ist eine Entscheidung
  über Geld und Verantwortung und keine technische.

---

## Verhältnis zum Wix-Stand

Der Wix-Stand bleibt unangetastet — gelesen wurde er, geschrieben nicht.

Was dort als Befund offen war, ist hier von vornherein gelöst: die
Eindeutigkeit des Kürzels wird unter derselben Sperre geprüft, unter der
eingetragen wird, festgehalten in `speicher_test.go`. Eine Vorabfrage wäre
ein Wettlauf, den zwei gleichzeitige Anfragen verlieren.

Beim Trockenlauf der Übernahme kam ein zweiter Befund dazu, schwerer als
der erste: **Löschen gibt dort das Kürzel wieder frei.** `maepux` steht
seit dem 10. August im Protokoll als gelöscht und fehlt in `PK_Codes`; der
eindeutige Index wirkt nur auf vorhandene Zeilen. Wird es neu vergeben,
zeigt ein gedrucktes Plakat eines Tages auf das Ziel eines Fremden.

Hier heißt gelöscht stillgelegt: die Zeile bleibt, das Ziel geht weg, das
Kürzel bleibt dauerhaft belegt, ein Scan bekommt 410 mit lesbarer Seite.
Für den Wix-Stand liegt dieselbe Behebung als reine Funktion in
`beitrag/punkt-zentrale.js`, zusammen mit der Suche nach den bereits
verwaisten Kürzeln.
