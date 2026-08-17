# Kanalwerk

Redaktionsplaner für Kundensites auf Wix. Ein Binary, keine Fremdbibliotheken,
keine Datenbank.

**Stand:** läuft, Ende zu Ende geprüft. Noch nicht gegen einen echten
API-Schlüssel gelaufen — siehe [Der offene Punkt](#der-offene-punkt).

---

## Was es kann

- **Redaktionsplan** mit Freigabelauf für mehrere Kunden auf ihren eigenen
  Wix-Sites.
- **Verteilung** auf Facebook, Instagram und LinkedIn über die Wix-Publisher-
  Schnittstelle — je Kanal ein eigener Text aus derselben Vorlage.
- **Rundbrief** über die Email-Transmissions-Schnittstelle, im selben
  Freigabelauf und aus derselben Vorlage.
- **Vorlagen**, die die Agentur gestaltet und die Kundin nur füllt.

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
Die Absenderadresse ist für den Newsletter nötig und **muss in Wix bestätigt
sein** — sonst weist die Schnittstelle den Versand ab.

```sh
./kanalwerk -einrichten "bothe=Tanzschule Bothe=5b043fb4-…=post@tanzschule-bothe.de"
```

### 4. Vorlagen einspielen

Vorlagen sind Agentursache. Sie werden als JSON eingespielt, **nicht** in der
Oberfläche der Kundin gebaut — genau das ist der Punkt.

```sh
./kanalwerk -vorlagen beispiel/bothe-vorlagen.json
```

Beiliegend sind fünf Vorlagen für die Tanzschule Bothe in ihren Marken­farben
(Limette `#9BBE00`, Karminrot `#D8063A`, Anton als Displayschrift).

### 5. Starten

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
| `-vorlagen` | — | Vorlagen aus JSON laden, dann beenden |
| `-trockenlauf` | aus | ohne Wix laufen |

---

## Die Regeln im Code

Diese sechzehn Punkte sind der Grund, warum es den Dienst gibt. Jeder ist durch
einen Test abgedeckt — 42 Tests, alle grün.

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

Dazu die Rundbriefregeln (`internal/planer/`, `internal/vorlage/brief.go`):

13. **Das Kontingent zählt E-Mails, nicht Aussendungen.** 3 690 Empfänger passen
    nicht in 200 freie E-Mails. Das fällt **vor** dem Versand auf, nicht nach
    den ersten 200.
14. **Ohne bestätigten Absender geht nichts raus.**
15. **Ohne Abmeldelink geht keine Werbemail raus.** Der Platzhalter steht
    bewusst in Adressform: `html/template` normalisiert alles in einem `href`
    und hätte aus geschweiften Klammern ein prozentkodiertes `%7b%7b…` gemacht,
    das Wix nie wiedergefunden hätte. Ein Test hält das fest.
16. **Was die Kundin tippt, bleibt Text.** Spitze Klammern im Brief werden
    maskiert, nicht ausgeführt.

Dazu die Vorlagenregeln (`internal/vorlage/`):

8. **Die Vorlage bestimmt, was gefüllt werden darf.** Ein Feld, das die Vorlage
   nicht kennt, wird abgewiesen statt ignoriert — wer an der Vorlage
   vorbeischreiben will, soll auffallen.
9. **Alle Beanstandungen auf einmal.** Wer ein Formular ausfüllt, will nicht
   fünfmal hintereinander einen einzelnen Fehler vorgesetzt bekommen.
10. **Längen zählen Zeichen, nicht Bytes.** 24 Umlaute sind 24 Zeichen.
11. **Der Text wird je Kanal gesetzt.** Instagram bekommt sein eigenes Muster
    samt Schlagwörtern, LinkedIn ein anderes — die Kundin tippt einmal.
12. **Zu lang für den Kanal heißt: geht nicht raus.** Abgeschnitten zu werden
    ist schlimmer als hier zu scheitern.

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
internal/vorlage/   Gestaltungsvorlagen, Prüfung, Textaufbau je Kanal, Briefsatz
internal/web/       Oberfläche in der Marke der Kundin
beispiel/           Vorlagen der Tanzschule Bothe
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

- **Das Bild wird nicht gesetzt.** Die Vorschau zeichnet die Gestaltung, aber
  das veröffentlichte Bild ist unverändert das der Kundin — Text wird nicht
  hineingerendert. Dafür bräuchte es einen Rasterer samt Schriftsatz und einen
  Ort, an dem das fertige Bild öffentlich liegt. Bewusst nicht gebaut, bevor
  jemand danach fragt.
- **Instagram** verlangt ein Bild. Ohne Bildadresse scheitert die Zustellung mit
  einem klaren Satz, statt einen Schnittstellenfehler durchzureichen.
- **Der Rundbrief geht an die ersten 100 Empfänger.** Die Schnittstelle nimmt
  je Aufruf eine begrenzte Liste; das Aufteilen einer großen Liste auf mehrere
  Aufrufe samt Fortschritt über Abbrüche hinweg ist noch nicht gebaut. Solange
  das Kontingent bei 200 liegt, fällt es nicht auf — für Hanomag Ersatzteile mit
  3 690 Kontakten wäre es der erste Schritt nach einem bezahlten Plan.
- **YouTube, Pinterest, TikTok, Google Business Profile** sind in der
  Kanalliste, aber im Versand noch nicht bedient.
