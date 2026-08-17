# Design Studio

Einbettbarer Design-Editor als eigenes Produkt. Kunden erzeugen markenkonforme
Social-Media-Grafiken und druckfertige PDFs aus Vorlagen. Ausgeliefert wird zweifach:
als eigenständige Anwendung auf Wix Headless und als Custom Element zum Einbau in
fremde Projekte.

## Die These: die Aussage ist das Produkt, nicht der Entwurf

Marketingmaterial existiert nie einmal. Dieselbe Sache erscheint als A1-Plakat,
A5-Aushang, Instagram-Story, Instagram-Beitrag und LinkedIn-Banner. In jedem
Werkzeug am Markt sind das **fünf Kopien**. Verschiebt sich der Termin, pflegt
jemand vier Dateien und vergisst die fünfte — und die hängt dann noch ein Jahr
im Treppenhaus.

Hier ist die **Aussage** die Quelle, jede Ausspielung nur eine Sicht darauf.
Drei Bausteine tragen das:

1. **Bindung statt Kopie** (`editor-core/src/aussage/bindung.ts`). Ein
   Platzhalter enthält keinen Text, sondern einen Verweis auf ein Feld. Beim
   Anzeigen wird aufgelöst, nie kopiert. „Magic Resize" erzeugt dagegen eine
   unabhängige Datei — ab dem Moment laufen die Fassungen auseinander.
2. **Kürzungsstufen** (`aussage/aussage.ts`). Jedes Feld trägt bis zu drei
   Längen. Jedes Format nimmt die längste, die in seinen Rahmen passt — der
   Titel auf dem Plakat lang, in der Story mittel, auf LinkedIn kurz, aus
   *einer* Eingabe. Passt keine, läuft der Text über statt abgeschnitten zu
   werden: ein abgeschnittener Satz ist falsch, ein überlaufender nur eng, und
   der Überlauf wird gemeldet.
3. **Getippte Felder.** Ein Termin ist kein Text, sondern ein Zeitpunkt. Nur
   deshalb kann das System ihn je Format anders schreiben („12. September 2026"
   auf dem Plakat, „12.9.26" im Banner), damit rechnen und wissen, wann das
   Material tot ist.

## Wirkungsprüfung: was sonst niemand prüft

`pruefung/druck.ts` prüft, ob die **Datei** in Ordnung ist — das prüft jede
Druckerei auch. `pruefung/wirkung.ts` prüft, ob das **Ergebnis** funktioniert:

| Regel | Was sie fängt |
|---|---|
| `kontrast` | Kontrast gegen den *tatsächlichen* Untergrund — die oberste deckende Fläche darunter, nicht die deklarierte Seitenfarbe. Weiße Schrift auf weißem Grund entsteht fast immer dadurch, dass jemand den farbigen Balken verschiebt. |
| `lesbarkeit` | Versalhöhe gegen den gedachten Leseabstand. Ein A1-Plakat wird aus drei Metern gelesen, nicht aus vierzig Zentimetern. |
| `sperrflaeche` | Inhalt unter den Bedienelementen der Plattform. Instagram legt oben 14 % und unten 20 % der Story mit eigenen Flächen zu. |
| `textmenge` | Mehr Text, als auf diese Entfernung je gelesen wird. |
| `abgelaufen` | Der Termin ist vorbei. Das Material ist dann nicht hässlich, sondern falsch. |
| `ueberlauf` | Auch die kürzeste Fassung passt nicht in den Rahmen. |

Alle Schwellen stehen als benannte Konstanten im Modul, damit sie diskutierbar
und änderbar sind, statt in einer Bedingung zu verschwinden.

## Der Leuchttisch

`apps/studio` zeigt nie ein einzelnes Format, sondern alle fünf gleichzeitig,
wie Andrucke auf einem Leuchttisch: links die Aussage mit ihren
Kürzungsstufen, in der Mitte die Andrucke mit Statuszeichen und gewählter
Stufe, rechts das Prüfprotokoll. Wer den Termin ändert, sieht in derselben
Sekunde, was das mit jedem Format macht.

> Liegt vorübergehend im Repository des Sitzungssystems und ist so gebaut, dass
> `git subtree split --prefix=design-studio` es ohne Umbau herauslöst. Die
> Projektanweisung im Wurzelverzeichnis gilt hier **nicht** — siehe `CLAUDE.md`
> in diesem Verzeichnis.

## Stand

| Paket | Zustand |
|---|---|
| `packages/editor-core` | Modell, Kommandos, Markenkit, Vorlagen, **Aussage**, **Wirkungsprüfung** — 162 Tests |
| `packages/render` | Entwurf → HTML, Silbentrennung, **Textmesser** — 8 Tests |
| `packages/export` | Satz im Browser → PDF/X-4 in CMYK — 18 Tests |
| `packages/editor-ui` | Auswahl, Ziehen, Live-Prüfung — 15 Tests |
| `packages/wix-adapter` | Wix Headless hinter der Speicherschnittstelle — 31 Tests |
| `apps/studio` | **Leuchttisch**, im echten Browser durchgefahren — 8 Tests |
| `apps/spike-pdf` | CSP-Messung mit eigenem Selbsttest — 5 Tests |
| `packages/embed` | offen — Custom Element für Fremdprojekte |

**247 Tests**, Linter und Typecheck sauber.

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

1. **ICC-Profil einbetten.** Bisher steht nur die registrierte Druckbedingung im
   OutputIntent. Für strenge Abnehmer muss ein CMYK-Profil hinein; die
   Lizenzlage der ECI-Profile ist vorher zu klären.
2. **Preflight gegenlesen lassen.** veraPDF prüft kein PDF/X (die eingebauten
   Profile enden bei PDF/A-4). Einmalige Abnahme durch ein Preflight-Werkzeug
   oder die Druckerei, bevor der erste echte Auftrag rausgeht.

## Loslegen

```bash
pnpm install
pnpm run check         # Linter, Typen, Tests mit Abdeckung
pnpm run probemodell   # baut apps/studio/ausgabe/probemodell.html
pnpm run spike         # Selbsttest des CSP-Spikes
pnpm run spike:druck   # die Druckkette bis zum PDF/X-4
```

Das Probemodell ist **eine** HTML-Datei: Skript, Stil und Schriften eingebettet,
kein Netzabruf. Sie läuft per Doppelklick, in einem Wix Custom Element und in
einem abgeschotteten Netz gleichermaßen.

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

Neun echte Fehler, alle inzwischen durch Tests abgesichert — die Regeln
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

7. Die Wahl der Kürzungsstufe hing an einer Schätzung mit 0,5 em mittlerer
   Zeichenbreite. Eine fette Grotesk baut breiter: der Instagram-Beitrag nahm
   die lange Fassung, setzte sie eine Zeile zu hoch und schob sie über den
   Untertitel — gemeldet als „passt". Seither misst der Browser
   (`render/src/messen.ts`), und die Schätzung ist nur noch der Vorfilter für
   Umgebungen ohne Satz.
8. Die Druckprüfung meldete für jedes sauber eingerückte Element einen
   Sicherheitsabstandsverstoß: `x + (breite − 2·rand)` ist in Gleitkomma nicht
   bitgleich mit `breite − rand`. Sechs falsche Warnungen je Plakat, die das
   Protokoll unbrauchbar machten. Lagevergleiche haben jetzt eine Toleranz von
   1e-6 px — bei 300 dpi rund ein Zehntel Nanometer.
9. Ein gebundener Termin blieb leer, weil die Auflösung zusätzlich ein
   *Textfeld* `termin` verlangte. Der Zeitpunkt allein genügt; nur ohne ihn
   zählt, was jemand getippt hat („nach Vereinbarung").

Vier bis acht haben dasselbe Muster: **der Fehlerfall ist nicht der Absturz,
sondern das falsche, plausibel aussehende Ergebnis.** Deshalb legt der
Druck-Spike neben jedem PDF einen PNG-Abzug ab — und deshalb prüft der
Leuchttisch-Test im echten Browser nach, dass kein Text aus seinem Rahmen
läuft.
