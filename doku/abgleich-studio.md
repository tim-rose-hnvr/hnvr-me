# Abgleich: ausgeliefertes Studio gegen `pnkt/`

Stand 17. August 2026. Grundlage ist nicht mehr die Beschreibung auf den
Seiten, sondern **der ausgelieferte Code** von
`punkt-954d3e9b-hnvrme.wix-site-host.com`:

```
_astro/studio.astro_astro_type_script_index_0_lang.BUBZY8mT.js   82 665 B
_astro/zentrale.astro_astro_type_script_index_0_lang.DlMyhBDb.js 21 551 B
_astro/massenanlage.astro_…CtQOp9ls.js                            5 274 B
_astro/studio.BKxqwdqu.css                                        5 111 B
```

Quellkarten gibt es nicht (`.map` → 404), der gebaute Stand ist aber
lesbar genug, um Funktion für Funktion abzugleichen. Die Dateinamen
nennen die Quellstruktur: `studio.astro`, `zentrale.astro`,
`massenanlage.astro`.

---

## Was das ausgelieferte Studio bereits kann

Nachgewiesen durch Fundstellen im Bündel, nicht durch die Werbeseite:

| Fähigkeit | Fundstelle |
|---|---|
| Verläufe in PDF und EPS | `ShadingType` (2×), `shfill` |
| CMYK | `DeviceCMYK` (2×) |
| GiroCode | `EPC069`, `BCD`, `SCT`, `IBAN` |
| Visitenkarte, WLAN | `VCARD`, `WIFI` |
| Umlaute in Druckdateien | `ISOLatin1`, `stringwidth` |
| Zwölf Modulformen | `quadrat mosaik abgerundet weich punkt raute blatt stern kreuz querstriche fliessend tropfen` |
| Ruhezone, Verfahrensgrenzen | `Ruhezone`, `minModulMm`, `verfahren`, `gravur`, `offset` |
| Ordner, Rollen, Schlüssel, Marke, Domain | in `zentrale.astro` |

**Das heißt: Der größte Teil dessen, was ich in `pnkt/` gebaut habe, war
dort schon vorhanden.** Verläufe, CMYK, GiroCode, die Latin-1-Umkodierung
und sogar `stringwidth` zum mittigen Setzen — dieselben Lösungen für
dieselben Probleme. Das ist kein Zufall: es sind dieselben Zwänge.

---

## Was im ausgelieferten Studio fehlt

Ebenfalls durch Abwesenheit im Bündel belegt:

| Lücke | Beleg | in `pnkt/` vorhanden |
|---|---|---|
| **Sonderfarben** | kein `Separation`, kein `setcmykcolor`, kein `DocumentCustomColors` | ja, mit Ghostscript-Auszug nachgewiesen |
| **GS1 Digital Link** | Felder `gtin` und `gs1Json` sind da, das Bündel benutzt sie nicht | ja, samt Prüfziffer und Kassenmaßen |
| **Produktpass** | Feld `passJson` ist da, das Bündel benutzt es nicht | ja, öffentliche Seite mit beschränkten Angaben |

### Zweite Berichtigung: das Datenmodell ist weiter als die Oberfläche

Ein Blick in das Schema von `PK_Codes` — nicht in das Bündel — zeigt
**`passJson`, `gtin`, `gs1Json`, `ordnerName`, `gesperrtWegen`,
`gueltigBis`, `druckJson`, `herkunft`**. Das Datenmodell hat Produktpass
und GS1 also längst vorgesehen; nur die ausgelieferte Oberfläche greift
nicht darauf zu.

Damit sind die beiden Zeilen oben keine fehlenden Merkmale, sondern
**halbfertige**: der Platz ist da, die Bedienung fehlt. Das ist eine
andere und deutlich kleinere Aufgabe, als sie hier zuerst stand.

### Berichtigung: Mitarbeitende fehlen nicht

Hier stand, `zentrale.astro` kenne keine Mitarbeitenden — belegt durch
die Abwesenheit von „mitarbeit" im Bündel. **Das war falsch.** Ein Blick
in die Sammlungen zeigt `PK_Mitglieder`, gefüllt mit `admin@hnvr.me` als
`redakteur`. Das Projekt sagt „Mitglied", ich habe nach „Mitarbeit"
gesucht.

Der Fehler ist lehrreich genug, um ihn stehen zu lassen: Abwesenheit
eines Wortes im gebauten Bündel belegt Abwesenheit eines Merkmals nur
dann, wenn man das Wort kennt, das die Autoren benutzt haben. Für die
beiden anderen Zeilen oben gilt der Einwand nicht — `Separation`,
`setcmykcolor` und `/01/` sind Formatvorgaben und keine frei gewählten
Bezeichner.

### Und ein Befund, der schwerer wiegt als jede Lücke

`PK_Ereignisse` enthält am 10. August ein `code.geloescht` für das Kürzel
**`maepux`**. In `PK_Codes` gibt es dazu keine Zeile mehr. Der eindeutige
Index `kuerzel-eindeutig` wirkt nur auf vorhandene Zeilen — das Kürzel
ist also **wieder frei und kann ein zweites Mal vergeben werden.**

Das Kürzel steht möglicherweise auf Papier. Wird es neu vergeben, zeigt
ein gedrucktes Plakat eines Tages auf das Ziel eines Fremden.

**Am 17. August behoben, im laufenden Projekt.** `maepux` liegt jetzt als
stillgelegte Zeile in `PK_Codes`; der eindeutige Index hält das Kürzel
dauerhaft besetzt. Nachgeprüft:

| | vorher | nachher |
|---|---|---|
| `/r/maepux` | 404 „Diesen Code kennen wir nicht" | **410 „Nicht abrufbar"** |
| Kürzel neu vergeben | ging | **`WDE0123`, abgewiesen** |

Keine Zeile Code war dafür nötig — der laufende Stand beantwortet einen
stillgelegten Code bereits richtig. Dazu ist `PK_Codes` um ein Feld
`geloescht` gewachsen, damit künftiges Löschen die Zeile stehen lassen
kann statt sie zu entfernen. Der Rest liegt als
`beitrag/punkt-zentrale.js` bereit.

Dazu drei Dinge, die keine Codefrage sind:

- **Die Messung der Augenformen.** 160 Kombinationen, mit OpenCV
  gegengelesen: `quadrat` und `kissen` 40 von 40, `blatt` und `rund`
  0 von 40. Das Studio bietet beide an, ohne diese Zahl zu nennen.
- **Der Nachweis der Druckdateien.** PDF über pdfium, EPS über
  Ghostscript, Encoder über zwei unabhängige Decoder.
- **Der Serverteil**: Weiterleitung, Ablage, Ereignisprotokoll,
  Massenanlage serverseitig, Auflösung der Marke über den Hostnamen.

---

## Was `pnkt/` fehlte

- **`tropfen`** als Modulform war die einzige der zwölf, die dort stand
  und hier nicht. Sie steht jetzt, gegengeprüft über die eigene
  PDF-Ausgabe mit Ghostscript und OpenCV: 32 von 32, mit `quadrat` als
  Gegenprobe auf derselben Nutzlast.

Damit ist die Gestaltungsseite gleichauf. Was `pnkt/` darüber hinaus hat
— Sonderfarben, GS1, Produktpass, Ordner, Suche, Löschen mit dauerhaft
gesperrtem Kürzel, und den Serverteil — steht oben.

---

## Was daraus folgt

Der Nachbau war zu großen Teilen ein Nachbau. Sinnvoll ist deshalb nicht,
das Studio zu ersetzen, sondern **hinüberzutragen, was dort fehlt**. Der
Code dafür liegt einbaufertig in `beitrag/`:

1. **Das Löschen zuerst.** Es ist der einzige Punkt mit einem Schaden,
   der schon eingetreten sein kann — `maepux` ist seit dem 10. August
   wieder frei. `loeschePlan`, `verwaisteKuerzel`, `sperrzeile`.
2. Sonderfarben in die PDF- und EPS-Ausgabe (`/Separation` mit
   Ersatzrezept, `%%DocumentCustomColors` im EPS-Kopf).
3. GS1 Digital Link als Inhaltstyp samt Prüfziffer und der Prüfung gegen
   die Kassenmaße 0,396 bis 0,990 mm.
4. Ordner und Suche in der Zentrale — `sucheCodes`, `ordnerStand`.

Dazu die gemessenen Zahlen zu den Augenformen in die Prüfhinweise — die
kosten nichts und ersparen eine Auflage.

Der Produktpass bleibt außen vor: Er ist keine Funktion, sondern eine
gehostete Seite mit Fassungen und getrennten Sichtbarkeiten. Der steht
in `pnkt/` und lässt sich von dort betreiben, auch wenn das Studio auf
Wix bleibt — der Code auf dem Etikett zeigt ohnehin auf einen Hostnamen,
und welcher das ist, entscheidet ihr.

Der Serverteil aus `pnkt/` bleibt eigenständig sinnvoll, weil er etwas
kann, was eine Astro-Seite auf Wix nicht kann: Weiterleitung, Ablage und
Protokoll ohne fremden Dienst, als ein Binär.
