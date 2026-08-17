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
| **GS1 Digital Link** | kein `GTIN`, kein `digitalLink`, kein `/01/` | ja, samt Prüfziffer und Kassenmaßen |
| **Mitarbeitende** | kein `mitarbeit` in `zentrale.astro` | ja, drei Rollen |

Dazu drei Dinge, die keine Codefrage sind:

- **Die Messung der Augenformen.** 160 Kombinationen, mit OpenCV
  gegengelesen: `quadrat` und `kissen` 40 von 40, `blatt` und `rund`
  0 von 40. Das Studio bietet beide an, ohne diese Zahl zu nennen.
- **Der Nachweis der Druckdateien.** PDF über pdfium, EPS über
  Ghostscript, Encoder über zwei unabhängige Decoder.
- **Der Serverteil**: Weiterleitung, Ablage, Ereignisprotokoll,
  Massenanlage serverseitig, Auflösung der Marke über den Hostnamen.

---

## Was `pnkt/` fehlt

- **`tropfen`** als Modulform — die einzige der zwölf, die dort ist und
  hier nicht (`fliessend` und die übrigen stehen inzwischen).

---

## Was daraus folgt

Der Nachbau war zu großen Teilen ein Nachbau. Sinnvoll ist deshalb nicht,
das Studio zu ersetzen, sondern **drei Stücke hinüberzutragen**:

1. Sonderfarben in die PDF- und EPS-Ausgabe (`/Separation` mit
   Ersatzrezept, `%%DocumentCustomColors` im EPS-Kopf).
2. GS1 Digital Link als Inhaltstyp samt Prüfziffer und der Prüfung gegen
   die Kassenmaße 0,396 bis 0,990 mm.
3. Mitarbeitende mit drei Rollen in die Zentrale.

Dazu die gemessenen Zahlen zu den Augenformen in die Prüfhinweise — die
kosten nichts und ersparen eine Auflage.

Der Serverteil aus `pnkt/` bleibt eigenständig sinnvoll, weil er etwas
kann, was eine Astro-Seite auf Wix nicht kann: Weiterleitung, Ablage und
Protokoll ohne fremden Dienst, als ein Binär.
