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

Gemessen am veröffentlichten Stand von pnkt.me fehlt dieser Fassung:

- **Sechs der zwölf Modulformen** (Weich, Stern, Blatt, Querstriche,
  Längsstriche, Fließend) und die sieben Ecken- und Kernformen.
- **Verläufe** in allen drei Ausgabeformaten.
- **GiroCode nach EPC069-12** mit IBAN-Prüfung, vCard, WLAN — die
  Inhaltstypen sind in `/api/v1/typen` beschrieben, aber noch nicht gebaut.
- **Rahmen mit Beschriftung** („JETZT SCANNEN").
- **Ordner, Suche, Löschen, Mitarbeitende** in der Zentrale.
- **Regeln als Liste** mit Zeitzone, wie die Schnittstellenseite sie zeigt
  (`{art:land, werte:[…], ziel}`); hier liegen sie noch als Zuordnung.
- **UTM mit Platzhaltern** wie `{land}-{geraet}`.
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
