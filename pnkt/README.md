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
| `qr` (svg.go) | Vektorausgabe in Millimetern: sechs Modulformen, eigene Augenformen, Ruhezone, Logoaussparung. Kein eingebettetes Rasterbild |
| `druck` | Druckurteil nach den **veröffentlichten Grenzwerten** von pnkt.me: 0,20 mm Bildschirm, 0,40 mm Laser und Tinte, 0,50 mm Offset, 0,75 mm Großformat, 1,00 mm Gravur; Kontrast ab 4:1, Ruhezone 4 Module, Warnung ab 60 % verbrauchter Reserve |
| `farbe` | Drei Farbwelten: Bildschirm, CMYK und Sonderfarbe mit Ersatzrezept |
| `regel` | Wohin ein Scan führt: Liste statt Zuordnung, mit Zeitzone; UTM mit Platzhaltern |
| `gs1` | GTIN-Prüfziffer nach Modulo 10, Digital Link bauen und zurücklesen |
| `inhalt` | GiroCode nach EPC069-12 mit IBAN-Prüfung (ISO 13616, Modulo 97, Längentabelle je Land), vCard 3.0, WLAN |
| `speicher` | Anhängende Dateien plus Verzeichnis im Arbeitsspeicher. Kollisionsschutz beim Kürzel, Fassungszählung, Ereignisprotokoll, Tageszähler |
| `ausgabe` | PDF und EPS von Hand geschrieben — echter Vektor in Punkt, ohne fremdes Paket. Verläufe als Schattierung (PDF Typ 2 und 3, PostScript `shfill`), Beschriftung in Helvetica |
| `main.go` | Weiterleitung, Schnittstelle, Massenanlage, Studio |

### Die Ablage

Drei Dateien, jede nur angehängt:

```
daten/codes.jsonl        jede Fassung eines Codes, die letzte gilt
daten/ereignisse.jsonl   wer hat wann welches Ziel geändert
daten/zaehler.jsonl      Scans je Code und Tag, in Klassen
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
| `GET/POST /api/v1/codes` | Codes lesen und anlegen | Schlüssel |
| `PATCH /api/v1/codes/{id}` | Ziel ändern — neue Fassung, Protokolleintrag | Schlüssel |
| `GET /api/v1/codes/{id}/statistik`, `/protokoll` | Auswertung, Änderungsgeschichte | Schlüssel |
| `POST /api/v1/massenanlage` | CSV hinein, ZIP heraus | Schlüssel |
| `GET /api/v1/marke` | Erscheinungsbild des aufgerufenen Hostnamens | offen |
| `PUT /api/v1/marke` | Marke setzen | Inhaber |
| `GET/POST /api/v1/mitarbeitende`, `DELETE …/{id}` | Personen der Organisation | Schlüssel / Inhaber |
| `GET /qr.svg\|pdf\|eps?inhalt=…` | derselbe Vektor über die Adresszeile | offen |
| `GET /` | Studio | offen |

`POST /api/v1/rendern` trägt das Urteil im Antwortkopf `x-punkt-pruefung`
(`gut`, `achtung`, `kritisch`) — auch beim Binärabruf. Wer eine Datei
bekommt, soll nicht raten müssen, ob sie druckreif ist.

### Zugang

Wie in der Zentrale festgelegt: Passwörter als PBKDF2-Abdruck mit
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

Vier Pakete, alle grün. Wichtiger ist aber die Prüfung, die ein Encoder
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

Die Prüfwerkzeuge liegen bewusst **nicht** im Programm — jsQR und OpenCV
sind Testzubehör, kein Bestandteil. Das Binär bleibt abhängigkeitsfrei.

---

## Gestaltung

Elf der zwölf Modulformen, vier Rahmen- und vier Kernformen, dazu:

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

Drei Rollen, wie in der Zentrale festgelegt:

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

## Was noch fehlt

Gemessen am veröffentlichten Stand von pnkt.me fehlt dieser Fassung:

- **Ordner, Suche und Löschen** in der Zentrale.
- **Übernahme aus Wix** — Feldabbildung steht, ein Trockenlauf fehlt.
- **Produktpass.** Die gehostete Seite hinter dem Code ist die
  eigentliche Anforderung der ESPR.
- **Übernahme aus Wix.** `PK_Codes` lässt sich zeilenweise in
  `codes.jsonl` überführen; die Feldnamen stimmen bis auf `regelnJson`,
  das hier bereits als Struktur statt als Text liegt.

---

## Verhältnis zum Wix-Stand

Der Wix-Stand bleibt unangetastet. Was dort als Befund offen ist — der
gescheiterte eindeutige Index auf dem Kürzel — ist hier von vornherein
gelöst: die Eindeutigkeit wird unter derselben Sperre geprüft, unter der
eingetragen wird, und ist in `speicher_test.go` festgehalten. Eine
Vorabfrage wäre ein Wettlauf, den zwei gleichzeitige Anfragen verlieren.
