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
| `packages/editor-ui` | **wartet auf die Lizenzklärung** |
| `packages/export` | offen |
| `packages/embed` | offen |
| `apps/studio` | offen |

## Was zuerst passieren muss

Zwei Dinge blockieren alles Weitere, beide unabhängig voneinander:

1. **Polotno-Lizenz für Mehrfach-Domain-Einbau klären.** Die Self-Serve-Lizenz deckt
   laut Preisseite nur *a single domain under one brand family*. Der geplante Einbau in
   mehrere Kundenprojekte fällt vermutlich unter Enterprise. Fällt der Preis zu hoch
   aus, kommen Konva plus HarfBuzz plus eigener PDF-Pfad zurück ins Rennen — rund sechs
   Monate mehr. Deshalb ist `editor-core` bewusst SDK-frei: die Klärung blockiert die
   Arbeit am Kern nicht.
2. **CSP-Spike laufen lassen.** Siehe `apps/spike-pdf/README.md`. Entscheidet, ob der
   Druckexport im Browser bleiben kann oder ein Renderserver nötig wird.

## Loslegen

```bash
pnpm install
pnpm run check     # Linter, Typen, Tests mit Abdeckung
pnpm run spike     # Selbsttest des CSP-Spikes (braucht Chromium)
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

Drei echte Fehler, alle inzwischen durch Tests abgesichert — die Regeln dahinter
stehen in `CLAUDE.md`:

1. Rückgängig nahm von zehn Ziehschritten nur einen zurück, weil die Umkehrung
   von `ElementVerschieben` relativ statt absolut war.
2. Instagram Story wurde 1919,99 px statt 1920, weil alle Formate durch
   Millimeter gerechnet wurden.
3. Ausgelagerte Entwürfe wären beim Kunden nie ladbar gewesen: der Adapter las
   private Dateien über ihre dauerhafte URL, die immer 403 liefert.
