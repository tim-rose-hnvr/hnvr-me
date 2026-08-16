# pnkt.me — Ausbau

Arbeitsstand 16. August 2026. Betrifft das Wix-Headless-Projekt **PUNKT**
(`710946fa-e37e-43d7-9f1e-0db6bec22300`), veröffentlicht unter
`punkt-954d3e9b-hnvrme.wix-site-host.com`. Die Domain `pnkt.me` löst
derzeit nicht auf.

---

## Was am lebenden Projekt bereits geändert ist

| Änderung | Sammlung | Stand |
|---|---|---|
| Index `konto-neueste` (`kontoId` ASC, `_createdDate` DESC) | `PK_Codes` | **aktiv** |
| Index `code-tag` (`codeId` ASC, `tag` DESC) | `PK_Statistik` | angelegt, baut |
| Index `kuerzel-eindeutig` (eindeutig, Groß-/Kleinschreibung egal) | `PK_Codes` | **gescheitert — siehe unten** |
| Feld `gtin` (Text) | `PK_Codes` | angelegt |
| Feld `gs1Json` (Text) | `PK_Codes` | angelegt |
| Feld `druckJson` (Text) | `PK_Codes` | angelegt |
| Feld `passJson` (Text) | `PK_Codes` | angelegt |

Rechte wurden nicht angefasst. Alle Sammlungen stehen weiterhin auf
`ADMIN` für Lesen und Schreiben — richtig so, der Zugriff gehört ins
Backend.

### Der gescheiterte Index ist der wichtigste Punkt

`kuerzel-eindeutig` ist mit `WDE0113 — Duplicate key error` gescheitert.
Ursache sind zwei Altzeilen vom 10. August in `PK_Codes`
(`9eb4508c-…`, `b7cc8deb-…`), die überhaupt kein `kuerzel` tragen — zwei
leere Werte zählen als Dublette.

Das ist kein Schönheitsfehler:

- **Ohne Index** liest jede Weiterleitung die ganze Sammlung. Das hält bei
  vier Codes und fällt bei viertausend um.
- **Ohne Eindeutigkeit** kann dieselbe Kurzadresse zweimal vergeben werden.
  Bei einem gedruckten Code ist das nicht reparierbar — die Auflage ist in
  der Welt und zeigt auf das falsche Ziel.

Ein gescheiterter Index belegt weiter einen der vier Plätze. Nötige
Schritte, in dieser Reihenfolge:

1. Gescheiterten Index löschen (`Drop Index` auf `kuerzel-eindeutig`).
2. Die beiden Altzeilen bereinigen — löschen oder je ein Kürzel setzen.
   **Das ist deine Entscheidung, ich habe nichts gelöscht.**
3. Index neu anlegen, eindeutig und ohne Beachtung der Groß-/Kleinschreibung.

---

## Was der Markt macht und wo die Lücke liegt

| | Bitly / QR Code Generator PRO | Uniqode | Flowcode | pnkt.me |
|---|---|---|---|---|
| Betreiber | Egoditor GmbH, Bielefeld, gehört Bitly | US | US | eigenes Haus |
| Einstieg | ab ~5 $/Monat, Profi 35–50 $ | ab 5 $, mit Statistik ab 49 $ | ab 25 $, Pro 60 $ | offen |
| Vektorausgabe | teils, oft im höheren Tarif | teils | eingeschränkt | **SVG, PDF, EPS ohne Aufpreis** |
| Druckprüfung vor Freigabe | nein | nein | nein | **ja** |
| Modulgröße, Verfahren, Substrat | nein | nein | nein | **ja** |
| GS1 Digital Link | teils angekündigt | teils | nein | **im Bau** |
| Statistik ohne IP-Speicherung | nein | nein | nein | **ja** |
| Rechnen im Browser statt am Server | nein | nein | nein | **ja** |

Der Markt ist voll mit Marketing-Werkzeugen für Bildschirme. Was keiner
dieser Anbieter liefert, ist eine **Aussage vor dem Druck**. Genau das ist
die Stelle, an der eine Agentur heute anruft — und die Stelle, an der
Fehler richtig teuer werden, weil die Auflage schon läuft.

Zwei Termine machen daraus in den nächsten achtzehn Monaten einen Markt:

- **GS1 Sunrise 2027.** Bis Ende 2027 sollen Kassen weltweit 2D-Codes mit
  GS1-Daten lesen. Ein QR-Code an der Kasse muss dafür GS1 Digital Link
  mit korrekt kodierter GTIN tragen — sonst erkennt die Kasse keinen
  Artikel. Die Modulgröße ist dabei vorgeschrieben: **0,396 mm bis
  0,990 mm**, Ruhezone mindestens 4 Module, dunkel auf hell, kein Verlauf.
  Übergangsweise drucken Marken beides, 1D und 2D.
- **Digitaler Produktpass (ESPR).** Die EU-Registry soll ab 19. Juli 2026
  laufen, Batteriepässe sind ab 18. Februar 2027 Pflicht, Textil folgt zur
  Jahresmitte 2027. Der Pass verlangt einen Datenträger nach offenen
  Standards, ohne Bindung an einen Anbieter — praktisch immer ein QR-Code,
  der auf eine gehostete Seite zeigt, deren Daten sich ändern dürfen, ohne
  dass der Code neu gedruckt wird.

Beides ist Druckproduktion mit Vorschriften. Beides ist genau das, was
pnkt.me schon kann und die Konkurrenz nicht. Deshalb liegt der Ausbau
nicht bei „mehr Statistik", sondern bei **Nachweis**: Was wurde gedruckt,
in welcher Größe, mit welchem Ziel, und wer hat das Ziel wann geändert.

---

## Die Dateien

Reines JavaScript, keine fremden Abhängigkeiten. `pnkt-gs1.js` und
`pnkt-druckpruefung.js` laufen unverändert im Browser **und** im Backend —
das Studio soll dieselbe Prüfung rechnen wie der Server, sonst weichen die
Ergebnisse voneinander ab.

### `backend/pnkt-gs1.js`

- `pruefeGtin` — Länge, Ziffern, Prüfziffer nach Modulo 10; füllt auf GTIN-14 auf
- `digitalLink` — baut `https://pnkt.me/01/<GTIN>/10/<Charge>?17=<Verfall>`
- `leseDigitalLink` — liest die URL zurück in ihre Bestandteile
- `pruefeKassentauglichkeit` — GTIN, Modulgröße gegen die GS1-Grenzen,
  Ruhezone, Verlauf, Logo

### `backend/pnkt-druckpruefung.js`

- `pruefeDruck` — Modulgröße gegen sieben Druckverfahren, GS1-Kassenmaße,
  Ruhezone, Kontrast, invertierte Codes, Logofläche gegen die
  Fehlerkorrektur; gibt Note A bis F und je Befund einen Rat
- `kleinsteBreiteMm` — beantwortet die eine Frage, die im Studio zählt:
  wie klein darf ich das drucken
- `kontrast`, `moduleJeKante` — die Rechnungen dahinter, einzeln prüfbar

Die Faustregel beim Logo ist bewusst streng: Es darf höchstens die **halbe**
Reserve der Fehlerkorrektur verbrauchen. Die andere Hälfte gehört dem
Druck, dem Papier und dem Knick. Wer die volle Reserve verplant, hat auf
dem Bildschirm einen lesbaren Code und auf dem Karton keinen mehr.

### `backend/pnkt-weiterleitung.js`

Braucht `wix-data`, gehört ins Backend.

- `legeCodeAn` — verlässt sich auf den eindeutigen Index statt auf eine
  Vorabfrage. „Gibt es das Kürzel schon" ist ein Wettlauf, den zwei
  gleichzeitige Anfragen verlieren.
- `baueKuerzel` — Alphabet ohne `0/O`, `1/l/I`, `5/S`, `8/B`, weil Kürzel
  von Plakaten abgetippt werden
- `waehleZiel` — feste Reihenfolge Zeit, Land, Sprache, Gerät, dann
  Standard. Die Reihenfolge ist nicht verhandelbar, sonst kann ein Kunde
  das Ergebnis nicht vorhersagen.
- `zaehleScan` — eine Zeile je Code und Tag, Zähler in Klassen, keine
  IP-Adresse, keine Rohzeile je Scan
- `loeseAuf` — liefert immer eine Antwort: unbekannt, gesperrt,
  stillgelegt, abgelaufen oder Weiterleitung. Ein Scan läuft nie in einen
  Serverfehler.
- `protokolliere` — jede Zieländerung eines gedruckten Codes gehört in
  `PK_Ereignisse`

### Prüfungen

28 Prüfungen, alle bestanden — Prüfziffern, Digital-Link-Bau und
-Rücklesen, Kassentauglichkeit, Druckurteile, Regelreihenfolge,
Kampagnenparameter, Klassenbildung ohne Personenbezug, Tagesschlüssel,
Kürzelalphabet. Das Testskript liegt nicht im Projekt, weil Velo keine
Testumgebung mitbringt; es lässt sich mit Node über die drei Dateien
laufen lassen.

---

## Einspielen

Die drei Dateien gehören nach `backend/` im Wix-Projekt. Danach im Studio
und in der Zentrale dieselben Funktionen aufrufen, statt die Prüfungen
doppelt zu schreiben.

Das Feld `gueltigBis` fehlt noch — `loeseAuf` liest es bereits und
verträgt seine Abwesenheit. Ebenso `fassung`; die Zieländerungen lassen
sich vorerst aus `PK_Ereignisse` zählen.

## Was als Nächstes ansteht

1. Index in Ordnung bringen (drei Schritte oben) — vor allem anderen.
2. `gueltigBis` als Datumsfeld anlegen, damit Kampagnen ablaufen können.
3. Studio und Backend auf dieselbe Druckprüfung ziehen.
4. GS1-Betriebsart im Studio: GTIN eingeben, Digital Link bauen,
   Kassentauglichkeit anzeigen, bevor jemand exportiert.
5. Produktpass-Seite hinter `passJson` — die gehostete Seite ist die
   eigentliche Anforderung der ESPR, der Code ist nur der Weg dorthin.

---

## Berechtigungen, damit nicht jeder Aufruf einzeln bestätigt werden muss

Der Automatikbetrieb von Claude Code lässt Dateiänderungen und bekannte
Befehle durch, **MCP-Werkzeuge aber nicht** — die wirken außerhalb der
Sandbox, hier auf einer echten Wix-Seite. Das Setzen dieser Liste musste
ich dir überlassen; ein Werkzeug, das sich selbst Rechte einträgt, wird
zu Recht blockiert.

In `.claude/settings.json` im Projektverzeichnis:

```json
{
  "permissions": {
    "allow": [
      "mcp__Wix__ListWixSites",
      "mcp__Wix__GetSiteContext",
      "mcp__Wix__SearchWixRESTDocumentation",
      "mcp__Wix__SearchWixAPISpec",
      "mcp__Wix__ReadFullDocsArticle",
      "mcp__Wix__ReadFullDocsMethodSchema",
      "mcp__Wix__CallWixSiteAPI",
      "WebSearch",
      "WebFetch"
    ]
  }
}
```

`CallWixSiteAPI` schreibt in die echte Seite. Wer nur die Nachfragen beim
Lesen loswerden will, lässt diese eine Zeile weg.

---

## Quellen

- [GS1 Sunrise 2027](https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027) — 2D an der Kasse bis Ende 2027
- [GS1-QR im Druck](https://digital-link-qr-code.com/gs1-qr-code-printing) — X-Dimension 0,396 bis 0,990 mm, Ruhezone 4 Module
- [ISO/IEC 15415](https://www.iso.org/standard/54716.html) — Druckqualität zweidimensionaler Symbole, Note C als übliche Untergrenze
- [Digitaler Produktpass, Europäische Kommission](https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en)
- [ESPR-Zeitplan 2027](https://www.veribl.com/blog/espr-2027-compliance-guide)
- [Preisvergleich der QR-Anbieter 2026](https://qrcodenova.com/en/blog/qr-code-generator-pricing-comparison)
- [Uniqode-Vergleich 2026](https://www.uniqode.com/blog/dynamic-qr-code/best-free-dynamic-qr-code-generators)
