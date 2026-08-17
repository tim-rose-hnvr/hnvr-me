# Kanalwerk

Redaktionsplaner für Kundensites auf Wix. Ein Binary, keine Fremdbibliotheken,
keine Datenbank.

**Stand:** läuft, Ende zu Ende geprüft. Noch nicht gegen einen echten
API-Schlüssel gelaufen — siehe [Der offene Punkt](#der-offene-punkt).

---

## Warum es das gibt

Wix' eigene Terminierung (`SCHEDULE_POST`) ist auf **allen zwölf geprüften
Kundensites abgeschaltet**. Ein Redaktionsplaner ohne Terminierung ist keiner.

Der Ausweg: `PUBLISH_POST` ist überall erlaubt, und ein Aufruf **ohne**
`schedulingInfo.scheduledDate` veröffentlicht sofort. Kanalwerk hält deshalb die
Warteschlange selbst und löst zum Termin ein Sofort-Veröffentlichen aus. Wix'
Terminierung wird nicht gebraucht.

Das kostet nichts und umgeht nichts — es verschiebt nur die Uhr dorthin, wo sie
sowieso hingehört.

---

## Einrichten

### 1. API-Schlüssel

Der Kontoinhaber legt ihn im [API Keys Manager](https://manage.wix.com/account/api-keys)
an, mit Zugriff auf **genau die betreuten Sites** — nicht auf alle.

```sh
export KANALWERK_WIX_SCHLUESSEL='…'
```

Der Schlüssel gehört ausschließlich in die Umgebung des Dienstes. Er steht nie
im Bestand, nie im Protokoll, nie in der Oberfläche.

### 2. Bauen

```sh
cd kanalwerk
go build -o kanalwerk ./cmd/kanalwerk
```

### 3. Kunden anlegen

Die Kennung ist frei, die Site-ID steht im Wix-Dashboard hinter `/dashboard/`.

```sh
./kanalwerk -einrichten "bothe=Tanzschule Bothe=5b043fb4-6440-4de2-aa8a-41af6b5475a7"
```

### 4. Starten

```sh
./kanalwerk -adresse :8080
```

Danach `http://localhost:8080` aufrufen. Beim Start und dann alle 30 Minuten
gleicht der Dienst die Kanäle mit Wix ab.

### Ohne Schlüssel ansehen

```sh
./kanalwerk -trockenlauf
```

Zwei erfundene Kanäle, nichts geht nach draußen. Zum Vorführen und zum Prüfen
der Oberfläche.

---

## Schalter

| Schalter | Voreinstellung | Bedeutung |
|---|---|---|
| `-adresse` | `:8080` | Adresse der Oberfläche |
| `-bestand` | `bestand.json` | Pfad zur Bestandsdatei |
| `-takt` | `30s` | Abstand zwischen zwei Läufen der Uhr |
| `-abgleich` | `30m` | Abstand zwischen zwei Kanalabgleichen |
| `-einrichten` | — | Kunde anlegen, dann beenden |
| `-trockenlauf` | aus | ohne Wix laufen |

---

## Die Regeln im Code

Diese sieben Punkte sind der Grund, warum es den Dienst gibt, und jeder ist
durch einen Test abgedeckt (`internal/planer/planer_test.go`).

1. **Ein Beitrag darf nie doppelt erscheinen.** Liegt eine Wix-Item-ID vor, ist
   der Beitrag draußen — ein Wiederholungsversuch wird übersprungen, auch wenn
   der übrige Zustand etwas anderes behauptet.
2. **Kontingent vor Versand prüfen.** Sonst scheitert ein gültiger Aufruf spät
   und ohne erkennbaren Grund.
3. **Fehlgeschlagen ist ein Zustand, kein Logeintrag.** Der Grund steht als
   deutscher Satz am Beitrag, nicht als Schnittstellenfehler.
4. **Freigabe verfällt bei Änderung.** Der Inhaltshash umfasst Text, Bild,
   Vorlagenwerte **und die Kanalauswahl** — wer nachträglich einen Kanal
   hinzufügt, hat dafür keine Freigabe.
5. **Ein Item je Kanal.** Ein Beitrag auf drei Kanälen sind drei Aufrufe und
   drei Einheiten Kontingent.
6. **Ein erloschener Kanal ist ein Vorgang, kein Fehler.** `USER_IS_DISCONNECTED`
   setzt den Kanal auf `ungueltig` und fordert zum Neuverbinden auf.
   `USER_NOT_EXIST_FOR_CHANNEL` heißt „nie eingerichtet" — die Unterscheidung
   bleibt sichtbar, sonst sucht man einen Fehler, wo nichts eingerichtet ist.
7. **Wiederholung mit wachsendem Abstand, gedeckelt** bei fünf Versuchen und
   einer Stunde. Plattformen sperren die App, nicht den einzelnen Aufruf.

```sh
go test ./...
```

---

## Aufbau

```
cmd/kanalwerk/      Start, Uhr, Kanalabgleich
internal/wix/       Wix-Schnittstelle (Client, Publisher)
internal/speicher/  Bestand als JSON-Datei
internal/planer/    Fachregeln und Warteschlange  ← hier steht das Wesentliche
internal/web/       Oberfläche in der Marke der Kundin
```

Der Bestand liegt in einer JSON-Datei, geschrieben über eine Zwischendatei und
umbenannt. Für eine Handvoll Kunden und einige Beiträge je Woche reicht das und
spart eine Datenbank samt Betrieb. Wächst die Menge, wird hinter `speicher`
PostgreSQL untergeschoben, ohne dass der übrige Code es merkt.

---

## Der offene Punkt

Die Bestandsaufnahme lief über die Kontoanmeldung, **nicht** über einen
API-Schlüssel. Dass die Publisher-Schnittstelle je Site erreichbar ist, ist
damit belegt; dass sie eine **Schlüssel-Identität** annimmt, noch nicht.

Der Beweis dauert eine Minute:

```sh
export KANALWERK_WIX_SCHLUESSEL='…'
curl -sS 'https://www.wixapis.com/social-publisher/v1/features/PUBLISH_POST' \
  -H "Authorization: $KANALWERK_WIX_SCHLUESSEL" \
  -H 'wix-site-id: 5b043fb4-6440-4de2-aa8a-41af6b5475a7'
```

Kommt ein `featureData` zurück, trägt der ganze Aufbau. Kommt ein 403, führt der
Weg über eine Wix-App mit App-Identität — Datenmodell und Regeln bleiben dabei
unverändert, es kommt nur ein anderer Anmeldeweg davor.

## Was noch fehlt

- **Vorlagen** sind im Datenmodell angelegt, aber noch nicht gestaltbar. Heute
  füllt die Kundin Text und Bild frei; die Sperre auf Schrift, Farbe und Raster
  ist beschrieben, aber noch nicht durchgesetzt.
- **Instagram** verlangt ein Bild. Ohne Bildadresse scheitert die Zustellung mit
  einem klaren Satz, statt einen Schnittstellenfehler durchzureichen.
- **Newsletter** über die Email-Transmissions-Schnittstelle ist entworfen
  (`doku/social-wix-architektur.md`), aber nicht gebaut. Nach der Messung lohnt
  es sich für elf von zwölf Kunden ohnehin noch nicht — nur Hanomag Ersatzteile
  hat mit 3 690 Kontakten eine echte Liste.
- **YouTube, Pinterest, TikTok, Google Business Profile** sind in der
  Kanalliste, aber im Versand noch nicht bedient.
