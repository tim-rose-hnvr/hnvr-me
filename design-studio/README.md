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
| `packages/editor-core` | steht, 86 Tests |
| `packages/wix-adapter` | steht, 24 Tests |
| `apps/spike-pdf` | messbereit, gegen zwei CSP-Fassungen geprüft |
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
pnpm -r test
pnpm -r typecheck
```

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

## Eine Wix-Eigenheit, die man kennen muss

Ein Datensatz in Wix Data darf höchstens **512 KB** groß sein (Fehler WDE0009). Ein
Entwurf mit vielen Elementen sprengt das — und zwar lautlos erst beim Kunden. Der
`WixEntwurfSpeicher` schreibt den Inhalt deshalb nur unterhalb einer Schwelle direkt in
den Datensatz und lagert ihn darüber in den Media Manager aus. Die Übersichtsliste
kommt in beiden Fällen ohne den Inhalt aus.
