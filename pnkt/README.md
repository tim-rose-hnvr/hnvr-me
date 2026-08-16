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
| `druck` | Druckurteil: Modulgröße gegen sieben Verfahren, GS1-Kassenmaße, Ruhezone, Kontrast, umgekehrte Codes, Logofläche gegen die Reserve. Note A bis F mit Rat je Befund |
| `gs1` | GTIN-Prüfziffer nach Modulo 10, Digital Link bauen und zurücklesen |
| `speicher` | Anhängende Dateien plus Verzeichnis im Arbeitsspeicher. Kollisionsschutz beim Kürzel, Fassungszählung, Ereignisprotokoll, Tageszähler |
| `ausgabe` | PDF und EPS von Hand geschrieben — echter Vektor in Punkt, ohne fremdes Paket |
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

| Weg | Zweck |
|---|---|
| `GET /{kuerzel}` | Weiterleitung. Der heißeste Pfad: eine Suche im Verzeichnis, kein Dateizugriff |
| `GET /01/{gtin}` | GS1 Digital Link — Auflösung über die GTIN |
| `GET /qr.svg?inhalt=…` | Vektor, sofort, mit allen Gestaltungsangaben |
| `GET /qr.pdf?inhalt=…` | dieselbe Zeichnung als PDF, Seitenmass in Millimetern |
| `GET /qr.eps?inhalt=…` | dieselbe Zeichnung als EPS |
| `POST /api/charge` | Massenanlage: CSV hinein, ZIP mit Dateien und Prüfbericht heraus |
| `GET /api/druckpruefung?…` | Druckurteil ohne etwas anzulegen |
| `GET /api/gs1?gtin=…` | Digital-Link-URL bauen |
| `POST /api/codes` | Code anlegen, Kürzel wird vergeben |
| `PATCH /api/codes/{id}` | Ziel ändern — erzeugt eine neue Fassung und einen Protokolleintrag |
| `GET /api/codes/{id}/statistik` | Tageszähler |
| `GET /api/codes/{id}/protokoll` | Änderungsgeschichte |
| `GET /` | Studio |

### Drei Regeln, die im Code stehen

1. **Ein Scan läuft nie in einen Serverfehler.** Unbekannt, gesperrt,
   stillgelegt, abgelaufen — jeder Fall bekommt eine lesbare Seite.
   Dahinter steht ein Mensch mit einem Telefon vor einem Plakat.
2. **Keine IP-Adresse, kein Kennzeichen im Gerät, keine Zeile je Scan.**
   Gezählt wird in Klassen: Gerät, System, Sprache, Quelle, Stunde. Was
   hier nicht entsteht, kann später niemand verlangen oder herausgeben
   müssen.
3. **Die Reihenfolge des Regelwerks ist festgelegt** — Zeit vor Land vor
   Sprache vor Gerät. Wäre sie frei, könnte niemand vorhersagen, wohin
   ein gedruckter Code führt.

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

Die Druckdateien sind ebenso gegengelesen: **PDF wird gerastert und der
Code darin zurückgelesen**, für alle sechs Modulformen. EPS ist strukturell
geprüft (BoundingBox, Pfade, Even-odd-Füllung), aber hier mangels
Ghostscript **nicht im Bild nachgewiesen** — das steht offen.

Die Geometrie liegt an einer Stelle: SVG, PDF und EPS lesen dieselben
Grundformen. Sonst zeigt die Vorschau etwas anderes als die Druckdatei,
und das merkt niemand, bevor die Auflage liegt.

Die Prüfwerkzeuge liegen bewusst **nicht** im Programm — jsQR und OpenCV
sind Testzubehör, kein Bestandteil. Das Binär bleibt abhängigkeitsfrei.

---

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

- **Konten und Anmeldung.** Der Dienst ist heute offen; `kontoId` wird
  geführt, aber nicht erzwungen. Vor jedem Betrieb im Netz nötig.
- **EPS im Bild nachweisen.** Struktur stimmt, ein Rasterbeleg fehlt.
- **Sonderfarben und CMYK.** PDF und EPS schreiben heute RGB. Für den
  Offsetdruck gehört dort ein Volltonkanal hin.
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
