# Design Studio

Einbettbarer Design-Editor als eigenes Produkt. Kunden erzeugen markenkonforme
Social-Media-Grafiken und druckfertige PDFs aus Vorlagen. Ausgeliefert wird zweifach:
als eigenständige Anwendung auf Wix Headless und als Custom Element zum Einbau in
fremde Projekte.

> Liegt vorübergehend im Repository des Sitzungssystems und ist so gebaut, dass
> `git subtree split --prefix=design-studio` es ohne Umbau herauslöst. Die
> Projektanweisung im Wurzelverzeichnis gilt hier **nicht** — siehe `CLAUDE.md`
> in diesem Verzeichnis.

## Stand

| Paket | Zustand |
|---|---|
| `packages/editor-core` | steht, 117 Tests, 91 % Abdeckung |
| `packages/wix-adapter` | steht, 31 Tests, 92 % Abdeckung |
| `apps/spike-pdf` | messbereit, mit eigenem Selbsttest (5 Tests) |
| `apps/spike-druck` | **Kette bewiesen**, 33 Tests |
| `packages/editor-ui` | offen — der Lizenzweg ist nicht mehr zwingend, siehe unten |
| `packages/export` | offen, Bauplan steht in `apps/spike-druck` |
| `packages/embed` | offen |
| `apps/studio` | offen |

## Der Druckweg ist lizenzfrei — bewiesen

`apps/spike-druck` zeigt die vollständige Kette:

```
Entwurf-JSON → HTML → Chromium setzt → Glyphen ablesen → pdf-lib → PDF/X-4 CMYK
```

Alles unter **MIT**. Kein Render-SDK, kein Ghostscript (AGPL), keine
Domain-Klausel. Am Prüfentwurf: 0 RGB-Operatoren, Schwarz als K-only, TrimBox
exakt auf 3 mm Anschnitt, Schrift eingebettet.

Damit ist die Polotno-Lizenzfrage **entschärft**, nicht mehr blockierend. Sie
lohnt trotzdem eine Anfrage — ein gekaufter Editor spart Monate an der
Oberfläche. Aber der Druckpfad, also der Teil mit dem Lizenzrisiko, ist eigen.

Nebeneffekt: weil der Satz serverseitig läuft, braucht der Druckexport **kein
WASM im Browser**. Der CSP-Spike (`apps/spike-pdf`) entscheidet damit nur noch
über clientseitige Vorschauen, nicht mehr über die Machbarkeit.

## Was als Nächstes ansteht

1. **Silbentrennung.** `hyphens: auto` wirkt in headless Chromium nicht — die
   Trennmuster fehlen. Weiche Trennstriche vorab einzusetzen funktioniert
   (geprüft), es braucht also eine Trennbibliothek vor dem HTML-Aufbau.
2. **ICC-Profil einbetten.** Bisher steht nur die registrierte Druckbedingung im
   OutputIntent. Für strenge Abnehmer muss ein CMYK-Profil hinein; die
   Lizenzlage der ECI-Profile ist vorher zu klären.
3. **Preflight gegenlesen lassen.** veraPDF prüft kein PDF/X (die eingebauten
   Profile enden bei PDF/A-4). Einmalige Abnahme durch ein Preflight-Werkzeug
   oder die Druckerei, bevor der erste echte Auftrag rausgeht.

## Loslegen

```bash
pnpm install
pnpm run check         # Linter, Typen, Tests mit Abdeckung
pnpm run spike         # Selbsttest des CSP-Spikes
pnpm run spike:druck   # die Druckkette bis zum PDF/X-4
```

`pnpm run check` ist das Tor: dasselbe läuft in der CI
(`.github/workflows/design-studio.yml`) bei jedem Push. Biome übernimmt Linten
und Formatieren, die Abdeckungsschwellen sind Sperrklinken knapp unter dem
Ist-Stand.

## Wo was liegt

- **Dokumentformat** — `packages/editor-core/src/modell/entwurf.ts`. Die Einheitenregel
  (alles in px bei der `dpi` des Entwurfs) steht in `CLAUDE.md` und in `masse.ts`.
- **Kommandos und Rückgängig** — `packages/editor-core/src/kommandos/`. Jedes Kommando
  gibt seine Umkehrung mit zurück; der Stack verschmilzt Tippen und Ziehen zu je einem
  Schritt.
- **Schutzregeln** — `packages/editor-core/src/kommandos/schutz.ts`. Gesperrte Layouts
  und Platzhalter. Hier steckt das Produktversprechen.
- **Markenkit** — `packages/editor-core/src/markenkit/`. Im strikten Modus lehnt der
  Wächter Kommandos ab, die neue Verstöße einführen — bestehende Verstöße bleiben
  bearbeitbar, sonst wäre ein Altentwurf für immer eingefroren.
- **Druckvorstufe** — `packages/editor-core/src/pruefung/druck.ts`. Anschnitt,
  Sicherheitsabstand, Bildauflösung, Haarlinien.
- **Speicher** — `packages/wix-adapter/src/speicher.ts` ist die anbieterfreie Grenze.
  Alles Wix-Spezifische liegt daneben.

## Zwei Wix-Eigenheiten, die man kennen muss

**Ein Datensatz in Wix Data darf höchstens 512 KB groß sein** (Fehler WDE0009). Ein
Entwurf mit vielen Elementen sprengt das — und zwar lautlos erst beim Kunden. Der
`WixEntwurfSpeicher` schreibt den Inhalt deshalb nur unterhalb einer Schwelle direkt in
den Datensatz und lagert ihn darüber in den Media Manager aus. Die Übersichtsliste
kommt in beiden Fällen ohne den Inhalt aus.

**Private Dateien sind über ihre `url` nicht lesbar.** Wix gibt beim Hochladen eine
URL zurück, die bei `private: true` mit 403 antwortet. Lesbar wird die Datei nur über
eine befristete URL aus `generateFileDownloadUrl` — und dieser Aufruf braucht
`SCOPE.DC-MEDIA.MANAGE-MEDIAMANAGER`, den eine Besuchersitzung im Browser nicht hat.
Im Frontend muss die Auflösung deshalb über eine eigene Serverfunktion laufen; dafür
ist `downloadUrlAufloeser` im `WixBlobSpeicher` da. **Das ist die erste
Serverfunktion, die `apps/studio` braucht.**

## Was beim Härten gefunden wurde

Sechs echte Fehler, alle inzwischen durch Tests abgesichert — die Regeln
dahinter stehen in `CLAUDE.md`:

1. Rückgängig nahm von zehn Ziehschritten nur einen zurück, weil die Umkehrung
   von `ElementVerschieben` relativ statt absolut war.
2. Instagram Story wurde 1919,99 px statt 1920, weil alle Formate durch
   Millimeter gerechnet wurden.
3. Ausgelagerte Entwürfe wären beim Kunden nie ladbar gewesen: der Adapter las
   private Dateien über ihre dauerhafte URL, die immer 403 liefert.
4. Schriften über `file://` laden in einer per `setContent` gesetzten Seite
   nicht — der Browser setzte lautlos in einer Ersatzschrift.
5. Der Test dagegen prüfte den *angeforderten* statt den *benutzten* Font und
   war grün, während der Abzug Serifen zeigte.
6. `JSON.stringify` in einem `style`-Attribut beendet dieses vorzeitig — wieder
   stille Ersatzschrift.

Vier bis sechs haben dasselbe Muster: **der Fehlerfall ist nicht der Absturz,
sondern das falsche, plausibel aussehende Ergebnis.** Deshalb legt der
Druck-Spike neben jedem PDF einen PNG-Abzug ab.
