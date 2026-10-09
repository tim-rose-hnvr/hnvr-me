# RANGWERK

Kostenloses SEO-Werkzeug. Sechs Prüfer laufen im Browser, Kommandozeile und
Crawler laufen mit Node, alle über **einen** Regelkatalog. Der Funktionsumfang
von seobility.net diente als Vergleichsliste, die Gestaltung ist eigen.

Eine ausführliche Anleitung für Außenstehende steht in `LIESMICH.md`.
Diese Datei hier ist die Arbeitsanweisung.

## Was hier liegt

- `site/` — die Website. Reines HTML, CSS, sieben JS-Dateien. Kein Build,
  kein Paketmanager: `site/index.html` im Browser öffnen genügt.
  `regelkatalog.js` urteilt, `analyse.js` misst, `pruefansicht.js` zeichnet
  die Analyseblätter, `werkzeuge.js` und `werkzeuge2.js` sind die sechs
  Prüfer, `bewegung.js` ist Bewegung und Bedienung, `rangwerk.js` das Gerüst.
- `cli/` — Kommandozeile, Crawler und ein eigener HTML-Parser mit
  Selektorauswertung. Ohne Fremdpakete.
- `bauen/` — Hilfsskripte, keine Auslieferung: Regelsatz-Erzeuger,
  Vorschauserver, Selbsttest.
- `design/` — die Design-Leinwand mit den drei Richtungen. Die erzeugte
  Datei `rangwerk-seo-webseite.html` nicht von Hand bearbeiten.
- `action.yml`, `.github/workflows/` — die CI-Anbindung.

## Die eine Regel, die über allem steht

**Der Regelkatalog `site/assets/js/regelkatalog.js` ist die einzige Quelle.**
Er wird gelesen von: dem Prüfer im Browser, der Kommandozeile, dem Crawler
und dem Erzeuger, der `site/regelsatz.html` schreibt.

Nach jeder Änderung daran, ohne Ausnahme:

```bash
node bauen/regelsatz-erzeugen.mjs
node bauen/selbsttest.mjs
```

Der Erzeuger schreibt die Regeltabelle zwischen `<!-- REGELN:ANFANG -->` und
`<!-- REGELN:ENDE -->` neu. Ändert sich die **Gesamtzahl**, müssen die Texte
auf `index.html`, `pruefer.html`, `snippet.html`, `werkzeuge.html`,
`kostenlos.html`, `kommandozeile.html` und `regelsatz.html` mitgezogen werden;
sie nennen die Zahl im Klartext. Der Selbsttest prüft, dass Katalog und
Regelsatz gleich groß sind, aber nicht die Fließtexte.

Stand: **158 Regeln in vierzehn Gruppen**, 9 kritisch / 38 wichtig / 111 Hinweise,
23 davon brauchen ein vollständiges Dokument, Gesamtgewicht 351 Punkte.

Jede Regel trägt neben `wozu` auch `beheben`, `wirkung` und `gewicht`. Diese
drei stehen gesammelt in der Tabelle `ZUSATZ` am Ende des Katalogs und werden
beim Laden angeheftet — die Prüfroutinen bleiben so lesbar. Der Selbsttest
verlangt, dass keine Regel ohne diese Angaben bleibt.

Der Katalog gibt seine Messroutinen zusätzlich über `RANGWERK_MESSEN` nach
außen. `analyse.js` und die Kommandozeile rechnen damit, statt eigene Fassungen
zu führen, die auseinanderlaufen könnten.

Dieselbe Trennung gilt für `site/assets/js/robotsregeln.js`: eine Quelle für
den robots-Prüfer im Browser und für den Crawler.

## Der Selbsttest

`bauen/selbsttest.mjs`, 57 Prüfungen. Er sichert den handgeschriebenen Parser
ab und vergleicht die Kommandozeile mit dem Browser. **Die Sollwerte für die
Beispielseite stammen aus dem Browser** — wer sie ändert, muss vorher im
Browser nachmessen, sonst zementiert der Test einen Fehler.

## Seiten

| Datei | Was es ist |
|---|---|
| `index.html` | Startseite |
| `pruefer.html` | Seiten-Prüfer, 158 Regeln, Punktzahl, sechs Analyseblätter |
| `snippet.html` | Snippet-Vorschau mit Pixelmessung |
| `robots.html` | robots.txt-Prüfer, samt Sperren für KI-Crawler |
| `sitemap.html` | Sitemap-Prüfer |
| `strukturdaten.html` | JSON-LD gegen 41 Typen |
| `hreflang.html` | Sprachangaben, auch gegenseitig |
| `kommandozeile.html` | Kommandozeile, Crawler und CI |
| `werkzeuge.html` | Übersicht: was läuft, was im Bau ist |
| `regelsatz.html` | Die 158 Regeln im Klartext, **erzeugt** |
| `kostenlos.html` | Warum kostenlos, Grenzen, häufige Fragen |
| `impressum.html`, `datenschutz.html` | Gerüste mit Platzhaltern, `noindex` |
| `app*.html` | Produktoberfläche, Entwurf mit Demodaten, `noindex` |

## Entscheidungen, die feststehen

- **Richtung B „Messinstrument"**: dunkler Grund, harte 1px-Linien, ein
  Signalton Grün, Zahlen vor Bildern.
- **Schriften Archivo und IBM Plex Mono**, lokal unter `site/assets/fonts/`,
  beide SIL Open Font License. Kein Aufruf nach außen, auch nicht für Icons.
- **Kostenlos, keine Tarife.** Es gibt keine Preisseite. Wer eine einbaut,
  widerspricht dem Rest der Website.
- **Keine Fremdpakete**, weder auf der Website noch in der Kommandozeile.
  Das ist Teil des Produktversprechens, nicht nur Geschmack.
- Farben und Abstände stehen als Variablen im `:root` von
  `site/assets/css/rangwerk.css`. Neue Farben nicht erfinden.

## Was nicht erfunden werden darf

- Keine Preise. Wie ein gehosteter Crawl getragen wird, steht als
  `[Finanzierung ergänzen]` offen.
- Alle Zahlen in der Produktoberfläche sind Demodaten und gekennzeichnet.
- Keine Kundenstimmen, keine Referenzlogos, keine Nutzerzahlen.
- Offene Angaben stehen als `[… ergänzen]`: Anschrift, Hosting-Standort,
  sämtliche Felder in Impressum und Datenschutz.
- **`rangwerk.example` ist ein Platzhalter** und steht in `canonical`, den
  og-Angaben, im JSON-LD, in `robots.txt` und in `sitemap.xml`.

## Bewegung

Leitsatz: **Bewegung zeigt eine Messung, nicht eine Laune.** Es gibt genau
einen inszenierten Moment — den Augenblick, in dem ein Ergebnis entsteht:
Zahlen fahren hoch, Befundzeilen tragen sich nacheinander ein, die
Diagrammlinie zeichnet sich, Vergleichsbalken fahren aus. Alles andere ist
kurze Rückmeldung auf eine Handlung.

- Alles steht in `site/assets/js/bewegung.js` und im Bewegungsteil am Ende
  von `rangwerk.css`. Werte: `--dauer-druck` 120 ms, `--dauer-zustand`
  190 ms, `--dauer-messung` 620 ms, Kurve `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Jede Animation läuft über `sicherLaufen()`.** Das startet sie über die
  Web-Animations-API und bricht sie nach Ablauf ab, falls die Zeitachse
  stehen bleibt. Ein Abbruch nimmt die Wirkung zurück: das Element steht
  danach in seinem eigenen, sichtbaren Zustand. Nie `element.animate()`
  direkt aufrufen.
- **Inhalt zuerst, Bewegung danach.** Zähler schreiben den wahren Wert
  sofort ins Dokument; der Filter setzt die Liste synchron und blendet nur
  hinterher über. Was nur in der Animation existiert, existiert nicht.
- Keine generische Einblendung je Abschnitt. Die gab es einmal und sie hat
  den Preisblock versteckt; sie ist ersatzlos entfallen.
- Nur `transform` und `opacity`, dazu `stroke-dashoffset` für die Linie.
- `prefers-reduced-motion` lässt die Messbewegung ganz aus, behält aber
  Zustandswechsel und Rückmeldung.

## Bedienung

`bewegung.js` stellt außerdem: Sprung von einem Befund zur Fundstelle im
eingefügten Quelltext, Merken der Eingaben in `sessionStorage` (nicht
`localStorage` — das Versprechen lautet, dass alles mit dem Reiter
verschwindet), Bericht als Datei, Sofortsuche im Regelsatz und das
Ableseband am Diagramm (Maus und Pfeiltasten). Taste `/` springt in das
erste Eingabefeld.

## Regeln der Umsetzung

- **Der Ruhezustand ist der sichtbare Zustand.** Siehe Abschnitt Bewegung:
  keine Klasse und kein Attribut, das Inhalt versteckt und später wieder
  aufgeräumt werden muss.
- Raster brauchen `minmax(0, …)`, sonst schieben Tabellen die Seite
  auseinander. Breite Tabellen rollen in `.rolle`, nicht die Seite.
- **Listen mit `<strong>` und Fließtext dürfen kein Grid und kein Flex sein.**
  Jeder Textknoten würde zu einem eigenen Element und die Zeile bräche Wort
  für Wort um. `.merkmale` und `.rechtstext li` lösen das über
  `position: relative` und einen absolut gesetzten Marker.
- Klassen ohne CSS-Regel gelten als Fehler.
- Beim Schreiben von JS über Python-Skripte aufpassen: ein `\n` in einer
  Zeichenkette wird sonst zum echten Zeilenumbruch und zerlegt die Datei.

## Ansehen und prüfen

```bash
node bauen/server.mjs
node cli/rangwerk.mjs pruefen "site/*.html"
node cli/rangwerk.mjs analyse site/index.html
node cli/rangwerk.mjs crawl http://localhost:8099/
node bauen/selbsttest.mjs
```

## Die Punktzahl

`Gruppenwert = 1 − (verlorenes Gewicht / mögliches Gewicht)`, der Gesamtwert
über alle geprüften Regeln gerechnet, nicht als Mittelwert der Gruppen — sonst
zählte eine Gruppe mit zwei Regeln so viel wie eine mit zwanzig. Übersprungene
Regeln zählen weder positiv noch negativ; das gilt auch für `--nur` und
`--ohne`. Keine Kurve, kein Bonus. Wer die Rechnung ändert, ändert damit jede
je genannte Zahl — dann müssen die Sollwerte im Selbsttest neu im Browser
gemessen werden.

Für echte 390-px-Breite nicht `--window-size` benutzen (Windows erzwingt eine
Mindestbreite), sondern die Ansichtsemulation der DevTools.

Der beste Test der Website ist sie selbst. Stand 24.08.2026: **17 Seiten,
0 wichtige Befunde.** Die verbliebenen 6 kritischen sind das beabsichtigte
`noindex` auf Rechtsseiten und Produktoberfläche, die 4 Hinweise sind
`wenig-text` auf ebendiesen Seiten.
