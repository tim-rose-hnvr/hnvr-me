# seo-rank.me

Kostenloses SEO-Werkzeug. Zwölf Prüfer, zehn davon im Browser, Kommandozeile
und Crawler laufen mit Node, alle über **einen** Regelkatalog. Der Funktionsumfang
von seobility.net diente als Vergleichsliste, die Gestaltung ist eigen.

Eine ausführliche Anleitung für Außenstehende steht in `LIESMICH.md`.
Diese Datei hier ist die Arbeitsanweisung.

## Was hier liegt

- `site/` — die Website. Reines HTML, CSS, vierundzwanzig JS-Dateien. Kein
  Build, kein Paketmanager: `site/index.html` im Browser öffnen genügt.
  `regelkatalog.js` urteilt, `analyse.js` misst, `pruefansicht.js` zeichnet
  die Messblätter. `protokoll.js` ist der Seiten-Prüfer (das Protokoll),
  `start.js` die Startseite samt Übergabe ans Protokoll und Protokollprobe.
  `pruefwerk.js` hält die Urteile von robots- und Sitemap-Prüfer und den
  Domain-Sammler OHNE Oberfläche — Protokoll und Einzelwerkzeuge rufen
  dieselben Funktionen. `werkzeuge.js` zeichnet robots- und Sitemap-Prüfer,
  `werkzeuge2.js` Snippet, Strukturdaten, hreflang, `stichwort.js`,
  `werkbank.js` (mehrere Seiten, verdichtet zu einer Reihenfolge), `wdf.js`,
  `tempo.js` (der einzige, der Google ruft), `weiterleitung.js`, `domain.js`
  sind die übrigen Werkzeuge. `abruf.js` ist das Relais samt der einen
  Erkennung „Adresse oder Quelltext“, `beispielseite.js` die fehlerhafte
  Probe, `bewegung.js` Bewegung und Bedienung, `seorank.js` Gerüst und
  Weltschalter.
- Die Gestaltung stammt aus der Figma-Datei „seo-rank.me – Gestaltungssystem“
  (Key `hfE0FfHbf5WA2xAlv95rAI`): Seiten „Neu · …“ sind die geltende
  Richtung, „Bestand · …“ der Stand vor dem 22.09.2026 zum Vergleich.
- `cli/` — Kommandozeile, Crawler, Domain-Check (`domain.mjs`), das
  Abrufrelais (`relais.mjs`) und ein eigener HTML-Parser mit
  Selektorauswertung. Ohne Fremdpakete.
- `bauen/` — Hilfsskripte, keine Auslieferung: Regelsatz-Erzeuger,
  Vorschauserver, Selbsttest.
- `design/` — die Design-Leinwand mit den drei Richtungen. Die erzeugte
  Datei `seo-rank.me-seo-webseite.html` nicht von Hand bearbeiten.
- `backend/` — dasselbe Abrufrelais als Wix-Velo-Datei, zum Einlegen in
  eine Wix-Website. Gleicher Vertrag wie `cli/relais.mjs`.
- `action.yml`, `.github/workflows/` — die CI-Anbindung.

## Die eine Regel, die über allem steht

**Der Regelkatalog `site/assets/js/regelkatalog.js` ist die einzige Quelle.**
Er wird gelesen von: dem Prüfer im Browser, der Kommandozeile, dem Crawler
und dem Erzeuger, der `site/regelsatz.html` schreibt.

Nach jeder Änderung daran, ohne Ausnahme:

```bash
node bauen/regelsatz-erzeugen.mjs
node bauen/gewichtsbild-erzeugen.mjs
node bauen/sitemap-erzeugen.mjs
node bauen/selbsttest.mjs
```

Der zweite Befehl schreibt das **Gewichtsbild** auf der Startseite neu: ein
Quadrat je Gewichtspunkt, gruppiert in gehalten / verloren / im Plan. Die
Zahlen kommen aus dem Katalog und aus einer echten Messung der
Beispielseite, nicht aus dem Fließtext. Der Selbsttest vergleicht die Summe
der Quadrate mit dem Katalogsgewicht und die Legende mit den Quadraten;
eine Gegenprobe mit einem entfernten Punkt lässt ihn scheitern.

Der erste Erzeuger schreibt die Regeltabelle zwischen `<!-- REGELN:ANFANG -->` und
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

Der Katalog gibt seine Messroutinen zusätzlich über `SEORANK_MESSEN` nach
außen. `analyse.js` und die Kommandozeile rechnen damit, statt eigene Fassungen
zu führen, die auseinanderlaufen könnten.

Dieselbe Trennung gilt für `site/assets/js/robotsregeln.js`: eine Quelle für
den robots-Prüfer im Browser und für den Crawler.

## Der Selbsttest

`bauen/selbsttest.mjs`, 181 Prüfungen. Er sichert den handgeschriebenen Parser
ab, vergleicht die Kommandozeile mit dem Browser, hält den Domain-Regelsatz
fest — vor allem die Zusage, dass ein leerer Befund NICHTS ergibt — und ist
der **Wächter der eigenen Seiten**: alle 24 laufen durch den Katalog, jeder
nicht zugelassene Befund lässt ihn scheitern, und die Gesamtbilanz
6 / 19 / 17 ist festgeschrieben (Abschnitt „Die Punktzahl" erklärt sie).

**Was über alle Seiten gleich sein muss, prüft der Katalog NICHT.** Er sieht
eine Seite für sich, nicht die Reihe. Sieben Proben schließen diese Lücke:
Markenname im Titel, canonical auf sich selbst (und auf gesperrten Seiten
ausdrücklich KEINE — sie widerspräche dem `noindex`), og:url gleich der
canonical, BreadcrumbList, Inhaltsrichtlinie, und dass Welt-Skript und sein
Hash zusammenpassen. Sie standen bis zum 12.09.2026 nur im Messskript im
Browser; genau deshalb blieb unbemerkt, dass `kostenlos.html` beim Beheben
von `titel-ohne-bezug-h1` den Markennamen aus dem Titel verlor. Beim
Einbauen fanden sie sofort den nächsten Fall — sechs `noindex`-Seiten ohne
canonical, was richtig ist und jetzt als solches festgeschrieben steht. **Die Sollwerte für die
Beispielseite stammen aus dem Browser** — wer sie ändert, muss vorher im
Browser nachmessen, sonst zementiert der Test einen Fehler.

## Die Detailblaetter der kleinen Pruefer (25.08.2026)

- **robots**: Crawler-Matrix (15 benannte Crawler, darunter die grossen
  KI-Crawler, gegen den geprueften Pfad — dieselbe Entscheidung wie das
  Urteil, einmal je Agent) und eine Gruppentafel (Allow/Disallow je Gruppe,
  Markierung fuer `Disallow: /`).
- **Sitemap**: Adresstabelle (bis 200 Zeilen: loc, lastmod, changefreq,
  priority, Anmerkung je Zeile) und die lastmod-Spanne.
- **Strukturdaten**: Deckungstabelle je erkanntem Objekt (Pflicht x/y,
  Empfohlen x/y, fehlende Felder) — zaehlt mit derselben Leer-Pruefung wie
  die Befunde, sonst zwei Wahrheiten.
- **hreflang**: Gegenseitigkeitsmatrix Seiten x Sprachen; „fehlt" heisst,
  eine andere Seite nennt die Sprache, diese nicht.
- **Snippet**: zwei Geraete nebeneinander (Schreibtisch 600 px / 1 Titelzeile
  / 2 Textzeilen, Telefon 400 px / 2 / 3), Datumsvorspann zuschaltbar, der
  abgeschnittene Rest im Klartext und zehn Befunde mit Behebung.

**Der Umbruch wird gerechnet, nicht dem Browser ueberlassen.** `umbrechen()`
legt Wort fuer Wort in Arial um; die Vorschau traegt deshalb
`white-space: pre` und eine FESTE Breite (640 / 440 px inkl. Innenabstand),
sonst bricht der Browser ein zweites Mal und die Vorschau zeigt mehr Zeilen
als die Trefferliste. Passt sie nicht ins Fenster, rollt `.vorschaugeraet` —
nie die Seite. Nach jeder Aenderung nachmessen: gerechnete Zeilenzahl mal
Zeilenhoehe muss die gerenderte Hoehe ergeben.

Alle vier zeichnen in Container, die im HTML angelegt sind (`r-crawler`,
`r-gruppentafel`, `m-tabelle`/`m-spanne`, `sd-deckung`, `hl-matrix`) und
benutzen nur bestehende Tabellenklassen. `.still` ist der Nebentext in
Zellen.

## Seiten

| Datei | Was es ist |
|---|---|
| `index.html` | Startseite: das Feld ist der Aufmacher, acht Bereiche, echte Protokollprobe |
| `pruefer.html` | Seiten-Prüfer als **Protokoll**: Adresse oder Quelltext, Umfang „Nur diese Seite“/„Ganze Domain“, Zuerst beheben, acht Bereiche, Befundblatt, Messwerte |
| `snippet.html` | Snippet-Vorschau mit Pixelmessung |
| `robots.html` | robots.txt-Prüfer, samt Sperren für KI-Crawler |
| `sitemap.html` | Sitemap-Prüfer |
| `strukturdaten.html` | JSON-LD gegen 41 Typen |
| `hreflang.html` | Sprachangaben, auch gegenseitig |
| `stichwort.html` | Stichwort-Prüfer: zehn tragende Stellen, Dichte, Begriffsvergleich |
| `werkbank.html` | Werkbank: bis 40 Seiten auf einmal, Prioritätenliste, Vorlage/Einzelfall |
| `wdf.html` | WDF·IDF gegen ein selbst eingelegtes Vergleichsfeld |
| `tempo.html` | Core Web Vitals über Googles APIs — **das einzige Werkzeug, das den Browser verlässt** |
| `weiterleitung.html` | Weiterleitungsregeln: Ketten, Schleifen, verdeckte Regeln — gelesen, nicht abgerufen |
| `domain.html` | Domain-Check, 48 Regeln — 27 aus eingefügten Angaben, 39 mit Abruf, alle 48 auf der Kommandozeile |
| `kommandozeile.html` | Kommandozeile, Crawler und CI |
| `werkzeuge.html` | Übersicht: was läuft, was im Bau ist |
| `regelsatz.html` | Die 158 Regeln im Klartext, **erzeugt** |
| `konto.html` | Konto: anmelden, registrieren, abgelegte Prüfungen — freiwillig |
| `kostenlos.html` | Warum kostenlos, Grenzen, häufige Fragen |
| `impressum.html`, `datenschutz.html` | Gerüste mit Platzhaltern, `noindex` |
| `app*.html` | Produktoberfläche, Entwurf mit Demodaten, `noindex` |

## Entscheidungen, die feststehen

- **Richtung „Plan"** (24.09.2026, geltende Fassung, Entwurf in Figma-Datei
  `h8vh0gi1qr9NC6HgBNtFEr`): **dunkel ist der Grundzustand** (`--grund`
  `#0b0c0e`), Karten `#131519`, Vertiefung `#1a1d22`, und **Xenon**
  (`--signal` `#e8ff5a`) ist die Farbe der Handlung und des Plans. Zustände:
  offen Koralle (`--warn` `#ff6b57`), in Arbeit Bernstein (`--arbeit`
  `#ffc24b`), nachgemessen Mint (`--gut` `#5ad1a0`). Der Textmarker ist
  derselbe Xenon (`--marker`) und steht NUR im Block „Zuerst beheben“.
  **Die Stufe steht als Stempel** (`.befund__stufe`, Wort in Versalien mit
  Kontur, kritisch gefüllt), nie nur als Farbe. **Genau drei Radien:**
  Flächen `--radius` 14px, Eingaben `--radius-eingabe` 8px, Stempel und
  Bedienelemente als Pille (`--pille`). Keine Schatten, keine Verläufe.
  Die Variablennamen sind über zwei Richtungen hinweg dieselben geblieben,
  damit einundzwanzig Skripte weiter passen — nur ihre Werte wechseln.
- **Eine Signalfarbe, zwei Rollen.** 89 Regeln im Stilblatt benutzen
  `--signal`: 49 als Schrift, 46 als Fläche. Deshalb muss der Ton in BEIDEN
  Rollen halten. Nachts geht das mit Xenon (Schrift 15,19:1, Fläche mit
  `--auf-signal` darauf 17,60:1), tags NICHT — dort ist `--signal` ein
  tiefes Oliv `#3f4d00` (Schrift auf Weiß 8,10:1, Fläche mit Xenonschrift
  8,31:1). Wer den Akzent ändert, rechnet beide Rollen in beiden Welten.
- **Zwei Welten, ein Regelwerk — dunkel ist die Vorgabe.**
  `:root[data-welt="hell"]` überschreibt nur die Farbvariablen; ohne
  Attribut gilt die Nacht. Der Schalter sitzt im Kopf jeder Seite
  (`seorank.js`), gemerkt wird in `sessionStorage` unter `seorank-welt` —
  und zwar nur die Ausnahme `"hell"`.
  Deshalb: **keine festen Hexwerte in HTML oder SVG** — alles über
  `var(--…)`, sonst bleibt es beim Weltwechsel stehen. Beim Wechsel legt
  `.welt-wechselt` alle Übergänge für einen Umlauf still: der neue Zustand
  muss auch bei stehender Zeitachse sofort vollständig dastehen
  (eingefrorene 190-ms-Übergänge haben sonst 80 Kontrastverstöße erzeugt).
- **Ein Link im Fliesstext ist unterstrichen.** Xenon gegen den Nebensatz
  kommt nur auf 1,84:1 — Farbe allein reicht damit nicht (WCAG 1.4.1,
  Lighthouse `link-in-text-block`). `a` traegt deshalb
  `text-decoration: underline`; ausgenommen sind Stellen, an denen die
  Form schon die Bedienung zeigt: `.knopf`, `.kopf__link`, `.marke`,
  `.springmarke`, `.inhaltsleiste__punkt`, Linklisten der Fusszeile und
  ganz verlinkte Tabellenzellen. Gemessen ueber alle 23 Seiten: 32 Links
  im Fliesstext, alle unterstrichen.
- **Der Weltschalter heisst, wie er beschriftet ist.** Sichtbar steht
  „nacht", das `aria-label` sagte „Tagansicht einschalten" — wer per
  Sprache „nacht" sagt, traf den Knopf nicht (WCAG 2.5.3). Jetzt
  „nacht — zur Tagansicht wechseln". Wer die Beschriftung aendert, zieht
  beides mit, im HTML aller 20 Seiten mit Schalter UND in `seorank.js`.
- **Jeder Ton ist nachgerechnet:** jede Textfarbe gegen Grund, Karte und
  Vertiefung in BEIDEN Welten über 4,5:1, die starke Linie gegen beide
  Flächen über 3:1. Der kleinste Textwert liegt bei 5,09:1, der kleinste
  Flächenwert bei 3,57:1. **Umgedrehte Flächen brauchen eine eigene
  Rechnung:** im Block „Die Rechnung“ ist `--auf-signal` die Fläche, und
  die Probezeile darin stand erst auf `--linie-stark` mit 4,13:1 — unter
  AA. Sie steht jetzt auf `--text-3` (6,14 nachts, 5,22 tags).
- **Schriften Onest und JetBrains Mono**, lokal unter
  `site/assets/fonts/`, beide SIL Open Font License (kein reservierter
  Name), Latin-Teilsatz mit Gewichtsachse, 33 und 31 KB.
  **Dazu je eine Zusatzdatei von 2,0 und 1,6 KB**: der Latin-Teilsatz kennt
  Pfeil, Malzeichen, Minuszeichen, Paragraph und Haken NICHT, und ohne sie
  fallen 42 Stellen im Projekt mitten im Satz auf eine Systemschrift
  zurück (im Browser gemessen). Wer ein weiteres Sonderzeichen in einen
  Text schreibt, misst nach, ob es enthalten ist. Herkunft und Prüfung in
  `SCHRIFTEN.md`. Kein Aufruf nach außen. Schibsted Grotesk und IBM Plex
  Mono sind entfallen.
- **Der Schriftwechsel darf nichts verschieben.** Bis Onest geladen ist,
  zeigt der Browser eine Ersatzschrift; haben beide verschiedene Masse,
  springt beim Wechsel die halbe Seite. Auf `werkzeuge.html` gemessen
  (Slow 4G, CPU vierfach gebremst, 412 px): **0,091 Layoutverschiebung**,
  eine einzige, bei 5,2 Sekunden — genau wenn die Schrift eintrifft.
  Zwei `@font-face`-Regeln legen Arial und Courier New per `size-adjust`
  und `ascent-override` auf die Masse von Onest und JetBrains Mono um; sie
  stehen als zweiter Eintrag in `--schrift` und `--schrift-mono`. Danach
  **0,0009**. Die Werte sind im Browser gemessen (Canvas: Textbreite und
  `fontBoundingBox`), nicht geschaetzt — nachgeprueft: Onest 3459,8 px
  gegen Ersatz 3463,6 px, Hoehen gleich. Wer eine Schrift tauscht, misst
  neu.
- **Die Schriften werden vorgeladen** (`<link rel="preload" as="font"
  crossorigin>` auf allen 24 Seiten). Ohne das entdeckt der Browser sie
  erst im Stilblatt. Gemessen, je drei Laeufe: Schrift fertig nach
  **3.095 statt 1.974 ms**, der erste sichtbare Aufbau kostet dafuer
  123 ms — ein Unterschied, der in der Streuung liegt (1.900–2.188 gegen
  2.048–2.300).
  **Diese Messung ging beim ersten Anlauf schief:** ohne Kompression war
  das Stilblatt 120 statt 21 KB, der Vorladenachteil erschien als 456 ms
  und haette zur falschen Entscheidung gefuehrt. Seither komprimiert
  `bauen/server.mjs` wie die Auslieferung (brotli, gzip). **Wer Ladezeiten
  gegen den Vorschauserver misst, prueft zuerst, dass er komprimiert.**
- **`h1` bricht nie mit Trennstrich.** Nur `h2`/`h3` trennen unter 760 px.
  Unter 430 px hängt die `h1` an der Schirmbreite (`min(2rem, 8vw)`), weil
  „Datenschutzerklärung“ bei 32 px 335 px misst und die Spalte bei 320 px
  270 bietet (gemessen: vorher +45 px Überlauf). Nach jeder Änderung an
  Überschriftengrößen: Überstand bei 320, 360, 390, 430 und 1440 px messen.
- **Kostenlos, keine Tarife.** Es gibt keine Preisseite. Wer eine einbaut,
  widerspricht dem Rest der Website.
- **Keine Fremdpakete**, weder auf der Website noch in der Kommandozeile.
  Das ist Teil des Produktversprechens, nicht nur Geschmack.
- Farben und Abstände stehen als Variablen im `:root` von
  `site/assets/css/seorank.css`. Neue Farben nicht erfinden.

## Was nicht erfunden werden darf

- Keine Preise. Wie ein gehosteter Crawl getragen wird, steht als
  `[Finanzierung ergänzen]` offen.
- Alle Zahlen in der Produktoberfläche sind Demodaten und gekennzeichnet.
- Keine Kundenstimmen, keine Referenzlogos, keine Nutzerzahlen.
- Offene Angaben stehen als `[… ergänzen]`: Anschrift, Hosting-Standort,
  sämtliche Felder in Impressum und Datenschutz.
- **`seo-rank.me` ist als Domain nicht registriert** (DNS: ENOTFOUND). Die
  Basisadresse in `canonical`, den og-Angaben, im JSON-LD, in `robots.txt`
  und in `sitemap-seiten.xml` ist die der Live-Site und wird mit
  `bauen/adresse-setzen.mjs` gesetzt — nie von Hand. Der Markenname im
  Titel bleibt „seo-rank.me“.

## WDF·IDF

`wdf.js`. Rechnung offen: `WDF = log2(H+1)/log2(L)`, `IDF = log2(N/n)`,
Wert = Produkt. Das Vergleichsfeld legt der Benutzer selbst ein — es wird
nichts abgerufen, und die Grundlage bleibt sichtbar.

**Die Falle, die einmal zugeschnappt ist:** ein Begriff, der in JEDEM
Dokument steht, hat IDF = 0 und damit Wert 0. Wer „vorhanden" am WERT misst,
meldet ihn als fehlend. Vorhandensein wird deshalb an `eigenAnzahl` gemessen,
nie an `eigen`; für diesen Fall gibt es das eigene Urteil „überall".
Sortiert wird nach der Zahl der Vergleichsseiten, die einen Begriff tragen —
nicht nach dem Wert, sonst stehen Einzelfunde mit hohem IDF oben.

## Tempo

`tempo.js`. **Das einzige Werkzeug, das den Browser verlässt** — und deshalb
das einzige, bei dem der Hinweis darauf oben auf der Seite steht, nicht im
Kleingedruckten. Zwei Schnittstellen, beide direkt aus dem Browser:

- **PageSpeed Insights v5**, `googleapis.com/pagespeedonline/v5/runPagespeed`
  — die Labormessung, dazu die Lighthouse-Bereiche und die Chancen.
- **Chrome UX Report**, `chromeuxreport.googleapis.com/v1/records:queryRecord`,
  POST — was echte Besucher der letzten 28 Tage erlebt haben.

Beide sind **CORS-offen**, das ist gemessen: ohne Schlüssel antwortet PSI mit
429 und CrUX mit 403, in beiden Fällen erreicht die Antwort den Browser. Das
gemeinsame Kontingent ohne Schlüssel ist in aller Regel erschöpft — auch aus
Node heraus. Praktisch braucht das Werkzeug also einen Schlüssel; der ist
kostenlos und liegt allein im `sessionStorage` unter `seorank-psi-schluessel`.
Die Adresse wird bewusst **nicht** gemerkt.

Feldpfade stehen fest und sind gegen Googles Referenz geprüft:
`lighthouseResult.categories.<id>.score`, `lighthouseResult.audits.<id>` mit
`score`/`displayValue`/`title`, `loadingExperience.metrics.<KEY>` mit
`percentile`/`category`/`distributions[]`. **Die Verteilungseinträge heißen
bei PSI `proportion`, bei CrUX `density`** — der Zeichner nimmt beide, sonst
bleibt ein Balken leer.

Vier Blätter: Echte Besucher (75. Perzentil plus dreiteiliger Verteilungsbalken),
Was bremst (nach `overallSavingsMs` sortiert), Labor, Lighthouse-Bereiche.
Grenzwerte: LCP 2500/4000 ms, INP 200/500 ms, CLS 0,1/0,25, FCP 1800/3000 ms,
TTFB 800/1800 ms.

**Was hier nicht behauptet werden darf:** dass die Website nichts sendet.
Eingefügtes bleibt im Browser; nach außen gehen vier Wege, jeder erst auf
Klick: eine Adresse (Relais), „Ganze Domain“ bzw. „dns und registrierung
holen“ (Relais, cloudflare-dns.com, rdap.org) und Tempo (Google). Der
Datenschutztext nennt alle drei seit dem 22.09.2026 — vorher behauptete er
noch, der Domain-Check rufe nichts ab. Die Fußzeile sagt „Eingefügtes bleibt
im Browser, Abrufe gibt es nur auf Klick“; wer den alten Satz „die Werkzeuge
rechnen im Browser“ wieder einsetzt, macht den Datenschutztext falsch.

## Suchen-und-Ersetzen ueber Quelltext: zwei Fallen

Beim Setzen richtiger Umlaute in sichtbaren Texten sind nacheinander zwei
Fehler passiert. Beide waren syntaktisch heil, beide blieben vom Selbsttest
zunaechst unbemerkt, und beide haetten ein Werkzeug stillschweigend kaputt
gemacht:

1. **Anfuehrungszeichen ueber die ganze Datei gezaehlt.** Ein einzelnes `"`
   in einem Kommentar verschiebt die Paarung, und ab dort haelt das Skript
   Code fuer Text. So wurde aus der Variablen `temporaer` ein `temporär`.
   Abhilfe: Paarung NUR innerhalb einer Zeile. In diesem Projekt geht keine
   doppelt gequotete Zeichenkette ueber einen Zeilenumbruch.
2. **Jede Zeichenkette fuer Prosa gehalten.** Aus der Kennung
   `"l-laengste"` wurde `"l-längste"`, und der Weiterleitungs-Pruefer fand
   sein Bilanzfeld nicht mehr. Abhilfe: nur Zeichenketten MIT Leerzeichen
   anfassen — eine Kennung oder ein Klassenname hat keines.

Dagegen stehen seit dem 30.08. drei Proben im Selbsttest: jede
`getElementById`-Kennung muss es im HTML geben, jeder Blattname auch, und
Bezeichner mit Umlaut gibt es nicht. Die dritte Probe hat beim Bauen selbst
noch etwas gefunden: ein Zeilenumbruch allein trennt bei CRLF nicht sauber —
das Wagenrücklaufzeichen bleibt am Zeilenende stehen, und in JavaScript passt
der Punkt NICHT darauf. Damit greift der Ausdruck, der Zeilenkommentare
entfernt, nicht mehr, und jeder deutsche Kommentar wird als Bezeichner
gemeldet. Getrennt wird deshalb mit einem Ausdruck, der beide Formen kennt.

**Dieselbe Falle noch einmal, diesmal in der Doku:** wer JS oder Markdown
ueber ein Python-Skript durch eine Shell schreibt, verliert die Zeichen fuer
Zeilenumbruch und Wagenruecklauf — sie werden zu echten Umbruechen und
zerlegen die Datei. Solche Absaetze gehoeren direkt editiert. In dieser
Sitzung ist es dreimal passiert.

## Das Abrufrelais

Die eine Faehigkeit, die dem Projekt bis zum 30.08.2026 fehlte: eine
ADRESSE pruefen statt Quelltext einzufuegen. Der Browser darf fremde
Adressen nicht abrufen, ein Server darf es. Uebernommen wurde die Idee
von hnvr.me — die Bauweise ausdruecklich nicht.

**Das Relais HOLT. Es urteilt nicht.**

Das ist die tragende Entscheidung. Die naheliegende Bauweise legt die
Regeln in den Server; dann gibt es sie zweimal, einmal dort und einmal im
Browser, und zwei Fassungen derselben Bewertung laufen auseinander. Hier
gibt der Server nur zurueck, was er bekommen hat — Kopfzeilen,
Weiterleitungskette, Quelltext — und geurteilt wird weiter im Browser mit
demselben Regelkatalog wie bei eingefuegtem Text.

### Zwei Fassungen, ein Vertrag

| Datei | Wofuer |
|---|---|
| `cli/relais.mjs` | Node, ohne Fremdpakete. `node cli/relais.mjs [port]` |
| `backend/http-functions.js` | Wix Velo, zum Einlegen in eine Wix-Website |

Beide antworten auf `GET /holen?url=<adresse>[&nurkopf=1]` mit demselben
JSON: `ok, angefragt, ziel, status, kette, spruenge, kopf, cookies, html,
bytes, abgeschnitten, ttfb`. Bei einem Problem `ok: false` und `fehler` —
**immer mit HTTP 200**. Wer 500 zurueckgibt, laesst den Browser nur
„Failed to fetch" sehen, und dann weiss niemand, woran es lag.

### Was ein Relais gefaehrlich macht

Ein Dienst, der jede Adresse abruft, die man ihm nennt, ist ein Tor in das
Netz, in dem er steht. Deshalb:

- Nur `http` und `https`.
- Kein `localhost`, keine Adressen aus `10.*`, `127.*`, `192.168.*`,
  `169.254.*`, `172.16-31.*`, keine Namen auf `.internal` oder `.local`,
  kein Name ohne Punkt.
- **Die Node-Fassung prueft zusaetzlich, WOHIN ein Name zeigt** — vor
  jedem Sprung, auch nach einer Weiterleitung. Ein oeffentlicher Name auf
  `127.0.0.1` wird damit abgewiesen. Gemessen an `localtest.me`: abgelehnt
  mit Nennung der Adresse.
- **Velo kann das nicht**, dort gibt es kein `node:dns`. In der Wix-Cloud
  ist kein internes Netz zu erreichen, deshalb ist es dort vertretbar. Auf
  einem eigenen Server gehoert die Node-Fassung hin, nicht die Velo-Fassung.

Nachgemessen, alle acht abgewiesen: `localhost`, `127.0.0.1`, `192.168.1.1`,
`10.0.0.1`, `169.254.169.254` (die Metadatenadresse in Cloud-Umgebungen),
`file://`, `router.local`, `intern`.

### Wo es benutzt wird

- **Seiten-Pruefer:** Feld „adresse laden" in der Werkzeugleiste. Der
  geholte Quelltext landet SICHTBAR im Eingabefeld — was geprueft wird,
  soll man lesen koennen — und laeuft dann durch alle 158 Regeln.
- **Domain-Check:** „dns und registrierung holen" ruft zusaetzlich die
  vier Schreibweisen ab (nur Kopfzeilen), dazu robots.txt, sitemap.xml
  (dort, wo die robots.txt sie nennt), favicon, security.txt und einen
  erfundenen Pfad. Damit steigt die Zahl der im Browser beurteilten Regeln
  von 27 auf **39 von 48**. Offen bleiben die sieben Zertifikatsregeln —
  dafuer muesste man die TLS-Verbindung selbst aufbauen, und das kann
  weder ein Browser noch ein Relais, das Text weiterreicht.

### Die Adresse des Relais steht nicht im Code

Sie liegt in `sessionStorage` unter `seorank-relais`, Standard ist
`https://www.hnvr.me/_functions`. Auf jeder Seite, die abruft, steht
sichtbar, wohin es geht. Wer ein eigenes betreibt, traegt es ein.

**Die Zusage wird mitgefuehrt.** Ohne Abruf steht „Nichts hat dieses
Fenster verlassen" — und das stimmt. Nach einem Abruf steht dort, was
gegangen ist und wohin. Zwei einander widersprechende Saetze in einer
Zeile sind schlimmer als einer; deshalb wird der Satz ERSETZT, nicht
ergaenzt.

## Was von hnvr.me uebernommen wurde

Auf hnvr.me stehen seit laengerem ein `/seo-checker` und ein
`/domain-checker`, beide als Wix-HTML-Baustein. Am 30.08.2026 wurden sie
Zeile fuer Zeile durchgesehen. Zwei Dinge konnten sie, die seo-rank.me
nicht konnte:

**1. DNS und Registrierung direkt aus dem Browser.** Der hnvr-Checker
fragt `cloudflare-dns.com` ueber DNS-over-HTTPS und `rdap.org` nach der
Registrierung. Nachgemessen von fremdem Ursprung: beide antworten mit 200
und offenem CORS, `dns.google` ebenfalls. Damit war die Behauptung in
diesem Projekt, der Browser koenne kein DNS aufloesen, widerlegt (siehe
den Abschnitt zum Domain-Check).

Uebernommen als **`dns und registrierung holen`** im Domain-Check:

- Ein eigener Knopf. Nie beim Laden, nie beim gewoehnlichen Pruefen
  eingefuegter Angaben. Ein Warnband ueber dem Werkzeug sagt vorher, was
  wohin geht.
- Sechs Eintragsarten ueber DoH (A, AAAA, NS, MX, TXT, CAA) plus
  `_dmarc`. Gemessen: alle sechs liefern, das Format passt genau auf das,
  was `domainregeln.js` ohnehin erwartet.
- Damit werden **zwoelf** der einundzwanzig sonst offenen Regeln pruefbar:
  zehn DNS-Regeln und zwei zur Registrierung.
- **Eingefuegte Angaben haben Vorrang.** Wer eine dig-Ausgabe einfuegt,
  bekommt seine eigene, nicht die geholte.
- **Geholtes gilt nur fuer die Domain, fuer die es geholt wurde.** Wer
  danach den Host aendert, bekommt es nicht mehr angerechnet — sonst
  stuenden fremde Messwerte unter einem anderen Namen.
- **`rdap.org` kennt nicht jede Endung.** Gemessen: `.com` und `.net`
  antworten mit 200, `.de` und `.me` mit 404. Der Unterschied zwischen
  „gibt es dort nicht" und „war nicht erreichbar" steht in der Meldung.
- **Die Zusage wird angepasst.** Nach einem Abruf steht NICHT mehr
  „Nichts hat dieses Fenster verlassen", sondern was gegangen ist. Eine
  Zusage, die nicht mehr stimmt, ist schlimmer als keine.

**2. Bericht als PDF.** hnvr.me benutzt dafuer `html2pdf` von einem
fremden Server; das legt die Seite als BILD ins PDF — nicht durchsuchbar,
nicht kopierbar. Uebernommen wurde die Idee, nicht die Umsetzung: der
Knopf **`als pdf`** oeffnet den Druckdialog des Browsers. Der schreibt ein
PDF mit echtem Text, und was darin landet, bestimmt der Druckstil. Kein
Fremdpaket, kein Nachladen.

Der Knopf wird in `seorank.js` an EINER Stelle eingehaengt und erscheint
auf allen zwoelf Werkzeugen. Vor dem Drucken klickt er einmal durch alle
Register: manche Blaetter zeichnen sich erst beim Anklicken, und wer nur
ausdruckt, was er gesehen hat, druckt zu wenig.

**Was NICHT uebernommen wurde:** das Backend. hnvr.me hat unter
`/_functions/seocheck` eine Wix-Velo-Funktion, die eine fremde Adresse
serverseitig abruft und zwanzig Pruefungen zurueckgibt — gemessen, sie
laeuft und antwortet in einer halben Sekunde. Das ist die eine Faehigkeit,
die seo-rank.me weiterhin fehlt: eine Adresse eingeben statt Quelltext
einfuegen. Dafuer braeuchte es einen Server, und den hat dieses Projekt
bewusst nicht. Wer ihn einbaut, entscheidet damit ueber das
Produktversprechen, nicht ueber eine Regel.

## Papier, Anker und Kontrastmodus

Drei Dinge, die auf dem Schirm niemand sieht und die trotzdem jeden Tag
gebraucht werden. Alle drei fehlten bis zum 30.08.2026 vollstaendig:
`@media print` 0 Regeln, `scroll-margin` 0, `forced-colors` 0.

**Der Ankersprung.** Die Kopfzeile klebt (`position: sticky`) und ist
gemessen 77 px hoch (75 px unter 760 px Schirmbreite). Ohne
`scroll-margin-top` landete jede Zielueberschrift dahinter — gemessen bei
63 px, also verdeckt. Der Regelsatz besteht fast nur aus solchen Sprungen.
Die Hoehe steht als `--kopfhoehe` im `:root` und wird an EINER Stelle
gepflegt; wer die Kopfzeile umbaut, zieht sie mit. Nachgemessen wird ueber
alle Seiten: jede Ueberschrift mit Kennung anspringen und pruefen, dass
ihre Oberkante nicht unter der Kopfhoehe liegt. Stand: 432 Anker, 0 verdeckt.

**Der Druck.** Ein SEO-Bericht wird ausgedruckt oder als PDF
weitergereicht. Ohne eigene Regeln druckt eine Werkzeugseite ihre
Navigation, ihre Knoepfe und genau EIN aufgeschlagenes Register — der Rest
fehlt, und niemand sieht, dass er fehlt. Deshalb:

- Bedienung raus (Kopfzeile, Fusszeile, Knoepfe, Register, Filter,
  Weltschalter, Sprungmarke).
- **Alle Blaetter auf.** `[data-blatt][hidden] { display: block }`, und
  jedes Blatt bekommt ueber `::before` seinen Namen als Ueberschrift.
- **Aber die Filterwahl bleibt.** Wer auf „nur kritisch" gestellt hat,
  will auch nur die kritischen auf dem Papier. Ein Register ist eine
  Ansicht, ein Filter ist eine Entscheidung. Deshalb wird `.befund[hidden]`
  ausdruecklich NICHT aufgehoben.
- Eigene Palette: die dunkle Welt darf den Druck nicht schwaerzen, also
  setzen sowohl `:root` als auch `:root[data-welt="hell"]` im Druckblock
  dieselben hellen Werte.
- **Die Zeilenlaenge gilt auf Papier auch — nur mit einem anderen Wert.**
  Hier stand bis zum 12.09.2026 das Gegenteil: die Begrenzung falle weg,
  weil auf A4 der Seitenrand die Spalte bestimme. Das war eine Annahme
  und ist beim Nachmessen gefallen — ohne Begrenzung lief die Zeile auf
  A4 **122 Zeichen** weit (Merkmale) beziehungsweise 108 (Vorspann),
  lesbar sind 45 bis 90. Jetzt `max-width: 120mm`, gemessen 82 und 72
  Zeichen. Die Seitenzahl blieb dabei gleich; den Umbruch bestimmen die
  Abschnittsabstaende, nicht die Spaltenbreite.
- **Der Zweispaltenblock greift auf Papier NICHT** und soll das auch
  nicht: `@media (min-width: 1200px)` misst gegen die Seitenbox, und die
  ist auf A4 182 mm breit. Nachgewiesen mit einer Gegenprobe — dieselbe
  Regel ohne Breitenbedingung aenderte den Ausdruck von 3 auf 2 Seiten,
  mit Bedingung blieb er byteidentisch. Zwei Spalten auf A4 ergaeben rund
  57 Zeichen; das waere lesbar, aber Befunde mit Belegkaesten brechen
  darin schlecht.
- Kein Umbruch mitten in einem Befund (`break-inside: avoid`).
- Fremdverweise bekommen ihre Adresse in Klammern dahinter. Interne
  Sprungmarken nicht, die waeren auf Papier nur Ballast.

**Die Drucklinie ist gerechnet, nicht geschaetzt.** `--linie` mit `#c9c6c0`
kommt auf Weiss auf 1,70:1 und druckt auf vielen Geraeten gar nicht — ein
Bericht ohne Trennlinien sieht kaputt aus. Im Druckblock steht deshalb
`#948f86` mit 3,21:1, dem Schwellwert fuer Nicht-Text. Alle Textfarben des
Druckblocks liegen zwischen 8,47:1 und 21:1.

**Windows-Kontrastmodus.** Dort ersetzt das Betriebssystem alle Farben.
Was seine Bedeutung NUR aus einer Hintergrundfarbe zieht, verschwindet
dann — bei uns die Marker vor jedem Befund, die Statuspillen und die
Balken. Sie bekommen unter `forced-colors: active` eine Kontur
beziehungsweise eine Systemfarbe (`CanvasText`, `Mark`, `Highlight`).

**Nachsehen, nicht annehmen.** Die Druckregeln lassen sich pruefen, ohne
zu drucken: den `@media print`-Block aus `document.styleSheets` holen,
seinen Inhalt als gewoehnliches `<style>` einhaengen und die Seite ansehen.
Dabei kam heraus, dass die Prosa auf Papier nur ein Drittel der Breite
nutzte und die Belege unter den Befunden ohne Rahmen im Weissen
verschwanden. Beides waere durch reines Lesen des CSS nicht aufgefallen.

## Der Domain-Check

**Zwei Dateien, eine Quelle.** `site/assets/js/domainregeln.js` urteilt und
kennt weder Netz noch Dateisystem; `cli/domain.mjs` sammelt und urteilt
nicht. Genau wie bei `robotsregeln.js`. Wer eine Regel aendert, aendert sie
fuer Browser und Kommandozeile zugleich.

Stand: **48 Regeln in sieben Gruppen**, 11 kritisch / 17 wichtig / 20
Hinweise, Gesamtgewicht 200. Gruppen: Erreichbarkeit 6, Zertifikat 7,
Kopfzeilen 13, Cookies 4, DNS 10, Standarddateien 6, Registrierung 2.

**Der Kern des Entwurfs: `braucht(b)` vor `pruefe(b)`.** Eine Regel, deren
Angabe fehlt, wird UEBERSPRUNGEN und zaehlt weder positiv noch negativ —
wie `--nur` im grossen Katalog. Nur so kann derselbe Regelsatz im Browser
laufen, wo dreiundzwanzig Regeln grundsaetzlich nicht pruefbar sind.

**Die Falle, die dabei zugeschnappt ist:** `da({})` gab urspruenglich
`true` zurueck, weil `typeof {} === "object"`. Wer im Browser nichts
einfuegte, bekam dreizehn Befunde ueber fehlende Kopfzeilen — behauptet aus
dem Nichts. Ein leeres OBJEKT gilt seither als unbekannt, ein leeres ARRAY
dagegen als gemessen (der Sammler gibt es nur zurueck, wenn er nachgesehen
hat). Wer `da()` anfasst, prueft beide Faelle nach.

**Was Node kann und der Browser nicht.** Diese Liste war zu lang. Am
30.08.2026 nachgemessen, weil hnvr.me/domain-checker es anders macht:

- **DNS geht doch im Browser** — über DNS-over-HTTPS. Gemessen von fremdem
  Ursprung: `cloudflare-dns.com/dns-query` und `dns.google/resolve`
  antworten beide mit 200 und offenem CORS. Die zehn DNS-Regeln wären also
  auch im Browser prüfbar. Sie sind es hier NICHT, und zwar aus einem
  anderen Grund: es wäre ein Fremdaufruf, und das Versprechen dieser
  Website lautet, dass die Werkzeuge nichts abrufen. Wer das ändert,
  ändert das Versprechen — nicht nur eine Regel.
- **Registrierungsdaten teilweise auch** — `rdap.org` antwortet mit 200 und
  offenem CORS. `rdap.denic.de` blockiert CORS, für `.de` geht es im
  Browser also nicht.
- **Was wirklich nur Node kann:** eine TLS-Verbindung aufbauen und das
  Zertifikat lesen (`node:tls`,
`rejectUnauthorized: false` — ein ungueltiges Zertifikat soll GEMESSEN
werden, nicht die Verbindung abbrechen), fremde Antwortkopfzeilen lesen und
Weiterleitungen mit `redirect: "manual"` von Hand verfolgen. Ohne
Fremdpakete.

**Die vier Schreibweisen werden EINZELN abgerufen** — http und https,
jeweils mit und ohne www. Antworten zwei davon mit 200 auf verschiedenen
Hosts, ist das der haeufigste Doppelinhalt ueberhaupt. Wer nur eine Variante
prueft, findet ihn nie.

**Die Sitemap wird dort gesucht, wo die robots.txt sie nennt**, nicht nur
unter `/sitemap.xml`. Sonst meldet der Check eine fehlende Sitemap, die es
gibt.

**Einmal abrufen, einmal urteilen.** Der Rueckgabewert fuer die CI kommt aus
demselben Durchgang; ein zweiter Abruf nur fuer den Exitcode waere gegenueber
einer fremden Domain unhoeflich und koennte ausserdem anders ausfallen.

**Abgerufen werden:** die gepruefte Domain, die DNS-Aufloeser des Rechners
und — nur fuer die Registrierungsdaten — rdap.org. `--ohne-rdap` laesst das
Letzte weg. Das steht auf `domain.html`, im Datenschutztext und in der
Hilfe der Kommandozeile; es darf nicht stillschweigend wachsen.

**RFC 7505:** ein `MX 0 .` heisst „diese Domain empfaengt keine Post". Ohne
diesen Sonderfall steht in der Ausgabe nur `0 `.

## Der Weiterleitungs-Pruefer

`weiterleitung.js`. Liest Regeln, ruft nichts ab. Erkannt werden `Redirect`,
`RedirectMatch`, `RewriteRule` (mit und ohne `R=`), nginx `rewrite` und
`return` im `location`-Block sowie Zeilen `von -> nach`.

**Die Reihenfolge ist die Aussage.** Der Server nimmt die ERSTE passende
Regel und faengt danach von vorne an. `aufloesen()` rechnet genau so; wer
das aendert, bekommt falsche Kettenlaengen. Aus derselben Logik folgt der
Befund „Regel wird nie erreicht": eine frueher stehende Regel, die die
Quelle einer spaeteren schon abfaengt.

**Ein Muster ist keine Adresse.** Regeln, deren Quelle Klammern oder
Sternchen enthaelt, werden fuer Ketten und Schleifen uebersprungen — sonst
entstuenden Ketten aus Zeichenketten, die es nie gibt. Dafuer gibt es den
Probelauf: der Benutzer traegt echte Adressen ein.

**Ohne `R`-Flagge ist es keine Weiterleitung.** `RewriteRule` ohne `R=`
schreibt intern um; die Adresse bleibt stehen. Diese Regeln zaehlen nicht
mit, werden aber genannt, damit ihr Fehlen in der Bilanz nicht wie ein
Lesefehler aussieht.

Sechzehn Befunde, alle allein aus dem Text belegbar: Schleife, lange Kette,
kurze Kette, Selbstverweis, doppelte Quelle, verdeckte Regel, 302/307,
fehlender Code, Muster ohne Anker, Massenweiterleitung auf die Startseite,
Sprungmarke im Ziel, verlorener Abfrageteil (`?` im Ziel ohne `QSA`),
fehlendes `L`, http/https gemischt, www gemischt, Schraegstrich uneinheitlich.
Dazu 410, internes Umschreiben und nicht gelesene Zeilen.

**Was NICHT behauptet werden darf:** dass hier die Auslieferung geprueft
wird. `RewriteCond` und nginx-`if` werden nicht ausgewertet, ein
Vorschaltserver ist unsichtbar. Das steht auf der Seite unter „Grenzen"
und muss dort stehen bleiben.

## Die Werkbank

`werkbank.js` prüft bis zu 40 eingefügte Seiten (getrennt durch `---`) gegen
den vollen Katalog und **verdichtet**: eine Zeile je Regel, sortiert nach
`Gewicht × betroffene Seiten` — nicht nach Stufe. Ein Befund, der mindestens
60 % der Seiten trifft, heißt **Vorlage** (ein Handgriff im Baukasten), sonst
Einzelfall. Vier Blätter: Was zuerst, Seitenübersicht, Wirkung, Messwerte.
Der Bericht geht als Textdatei heraus.

## Das Protokoll (seit 22.09.2026)

`pruefer.html` + `protokoll.js`. **Ein Feld für Adresse ODER Quelltext.**
Die Erkennung steht an EINER Stelle, `SEORANK_ABRUF.erkennen()` in
`abruf.js`: spitze Klammer heißt HTML, ein Wort mit Punkt und ohne
Leerzeichen heißt Adresse. Start und Protokoll fragen beide dort.

- **Umfang** „Nur diese Seite“ (Katalog über den Quelltext) oder „Ganze
  Domain“ (dazu robots.txt, Sitemap, DNS, Kopfzeilen, Registrierung über
  Relais, DoH, rdap.org). „Ganze Domain“ ist ohne Adresse abgeschaltet und
  sagt, warum.
- **Die Zusage** unter dem Feld sagt VOR dem Start, was wohin geht, und
  wird NACH dem Lauf durch das ersetzt, was wirklich gegangen ist.
- **Zuerst beheben**: höchstens fünf, nach Stufe, dann Gewicht, über alle
  Quellen (Katalog, robots, Sitemap, Domain). Nur hier steht der Textmarker.
- **Bereiche**: acht, jeder mit Zustand. Snippet und Strukturierte Daten
  sind die Katalog-Gruppen „Titel und Beschreibung“ bzw. „Auszeichnung und
  Vorschau“ — und so beschriftet. Nicht Geprüftes heißt „nicht geprüft“,
  nennt den Weg dorthin und zählt nicht als bestanden. Ein Bereich
  verschwindet nie.
- **Befundblatt**: rechts, auf dem Telefon von unten. Die Liste bleibt
  stehen, man blättert durch dieselbe Reihe; Esc schließt, der Fokus geht
  zur Zeile zurück. „Im Regelsatz nachlesen“ springt auf
  `regelsatz.html#regel-<id>` — die Anker erzeugt `regelsatz-erzeugen.mjs`.
- **Erneut prüfen** vergleicht mit dem letzten Lauf DERSELBEN Seite
  (sessionStorage `seorank-protokoll-vorher`). Die Seite erkennt man an der
  Adresse, bei Quelltext an canonical, sonst am Titel — nicht am Inhalt,
  sonst gäbe es nach einer Korrektur nie einen Vergleich. **Die Falle, die
  zugeschnappt ist:** ohne Kennung wurden zwei fremde Seiten verglichen
  („5 behoben, 42 neu“).
- **Messwerte**: die Gruppenpunktzahl und die sechs Blätter aus
  `pruefansicht.js`, dazu der geprüfte Quelltext zum Nachlesen.

## Das Konto (seit 29.09.2026)

`konto.html` + `konto.js` (kann alles, zeichnet nichts) + `kontoansicht.js`
(zeichnet, kann nichts) + `protokollablage.js` (hängt den Ablage-Knopf ins
Protokoll, ohne `protokoll.js` anzufassen).

**Ein Konto ist freiwillig und ändert an den Werkzeugen nichts.** Alle zwölf
laufen ohne. Der einzige Unterschied: angemeldet lässt sich das Ergebnis
einer Prüfung ABLEGEN und wiederfinden. Wer das aufweicht — etwa ein
Werkzeug hinter die Anmeldung stellt — bricht das Produktversprechen.

### Wo die Mitglieder liegen

**Nicht hier.** Sie liegen in der Mitgliederverwaltung der Wix-Site
`e8492887-5537-412e-a484-297fb7a6ba28` (www.hnvr.me). Diese Website ist nur
deren OAuth-Client. Kein Geheimnis im Code: die Client-Kennung
`0d78f0ce-1dba-41bc-a273-46accc6d481a` ist öffentlich, so ist OAuth mit PKCE
gebaut. Sie steht als Standard in `konto.js` und lässt sich über
`sessionStorage` unter `seorank-konto-client` ersetzen — derselbe Weg wie
bei der Relais-Adresse.

**Die App war schon da.** Sie heißt `CompanionApp0d78f0ce…`, trägt
`loginUrl: https://www.hnvr.me/konsole/anmelden` und gehört zu hnvr.me.
Eine zweite anzulegen war nicht nötig — und Wix Members musste NICHT
installiert werden, obwohl `GetSiteContext` die App nicht listet: die
Mitgliederverwaltung antwortet trotzdem.

### Gemessen am 29.09.2026, aus dem Browser, Herkunft `http://localhost:8099`

| Weg | Ergebnis |
|---|---|
| Besucher-Token (`anonymous`, ohne Secret) | HTTP 200, 811 Zeichen, mit refresh_token |
| Login V2 mit erfundenen Daten | HTTP 404 „Identity not found" — Endpunkt lebt |
| Redirect Session, `web_message` | HTTP 200, liefert `fullUrl` |
| Mitglieder-API als Besucher | HTTP 403 „Missing site member id" — richtig |

Alle vier sind **CORS-offen**. Die Anmeldung braucht deshalb keinen Server
und kein Fremdpaket.

**Die Autorisierungs-URL zeigt auf `www.moment-creator.de`**, nicht auf
hnvr.me: die Wix-Site bedient vier Domains, und Wix nimmt ihre primäre. Das
ist funktional egal, steht aber in der Netzwerkansicht des Besuchers.

### Der iframe statt des Vollseiten-Umwegs

Aus dem `sessionToken` (5 Minuten, autorisiert nichts) wird über eine
Redirect Session ein Mitglieder-Token. Zwei Wege stehen offen:

- **`responseMode: "web_message"`** — ein unsichtbarer Rahmen, Antwort per
  `postMessage`. Braucht **keine** registrierte Rückkehradresse.
- `query`/`fragment` — Vollseiten-Umweg, braucht eine exakt eingetragene
  Adresse.

Genommen ist der erste, weil die Adresse von seo-rank.me in der fremden
App NICHT eingetragen ist und bei jeder Neuauslieferung ohnehin wechselt.
Dafür trägt **nur `konto.html`** ein `frame-src https:` in der
Inhaltsrichtlinie; die anderen 23 Seiten bleiben unverändert. Der
Selbsttest prüft nur, DASS eine Richtlinie da ist, nicht ihren Inhalt.

**NICHT GEPRÜFT ist die Gestalt der postMessage-Antwort.** Ein echter Lauf
hätte ein echtes Mitglied in einer fremden Kundenliste erzeugt. Deshalb
wird in `codeAusFenster` NICHT auf eine Form geraten: `suchen` geht die
Nachricht rekursiv durch und nimmt das erste Paar aus `code` und `state`.
Streng geprüft werden dagegen **Herkunft** (muss die Origin der
Autorisierungs-Adresse sein) und **`state`** — sonst könnte eine fremde
Seite einen Anmeldecode hereinreichen.

### Was abgelegt wird — und was nicht

Adresse oder Seitenkennung, Titel, Umfang, Wert, die drei Befundzahlen und
die Regelkennungen. **NICHT der Quelltext der geprüften Seite** — er kann
alles enthalten, und niemand hat darum gebeten, ihn fortzugeben.

Die Regelkennungen holt `protokollablage.js` aus `sessionStorage` unter
`seorank-protokoll-vorher`, wo `protokoll.js` sie nach jedem Lauf für
„erneut prüfen" ablegt. Gemessen an der Beispielseite: 56 Kennungen, Ziel
`quelltext:/waagen/industrie`. So bleiben 43 KB `protokoll.js` unberührt.

### Der Ablageort fehlt noch

Die Sammlung `seorank-pruefungen` ist auf der Wix-Site **noch nicht
angelegt**. `bauen/kundendaten-anlegen.mjs` legt sie an:

```bash
WIX_API_KEY=<schluessel> node bauen/kundendaten-anlegen.mjs
```

**Alle vier Rechte stehen auf `SITE_MEMBER_AUTHOR`** — jedes Konto liest und
schreibt ausschließlich die eigenen Einträge. Wer das im Dashboard
zusammenklickt und `SITE_MEMBER` setzt, macht jede abgelegte Prüfung für
jedes andere Mitglied lesbar. Deshalb das Skript.

Bis dahin meldet `speicherKlartext` genau das: „Der Ablageort für Prüfungen
ist auf der Wix-Site noch nicht angelegt." Anmelden geht, Ablegen nicht.

### Das Sitzungsgedächtnis

`sessionStorage` unter `seorank-konto`, nie `localStorage`. Das Versprechen
lautet, dass alles mit dem Reiter verschwindet; ein Konto ändert daran
nichts. Der Token gilt vier Stunden und wird über `refresh_token` erneuert.

### Was mit dem Konto an Texten wandern musste

- **Startseite:** „Kostenlos · 158 Regeln · kein Konto" → „Konto
  freiwillig". Ein „kein Konto" neben einem Konto-Link in der Kopfzeile ist
  irreführend.
- **Datenschutz:** „Nach außen führen drei Wege" → **vier**, dazu der
  eigene Abschnitt „Das Konto" mit vier offenen Platzhaltern
  (Verantwortlicher, Auftragsverarbeitung, Aufbewahrung, Rechtsgrundlage).
- Die Sätze „ohne Konto" auf `werkzeuge.html` und `werkbank.html` bleiben
  **wahr** und stehen bewusst weiter da: die Werkzeuge brauchen keins.

**Was dadurch offen ist, und zwar ernsthaft:** Impressum und
Datenschutzerklärung sind Gerüste mit Platzhaltern. Solange dort
`[Anschrift ergänzen]` und `[Verantwortlichen ergänzen]` steht, fehlt bei
der Verarbeitung personenbezogener Daten die Angabe, wer verantwortlich
ist. Das lässt sich nicht erfinden.

## Die Startseite

`index.html` + `start.js`. Das Feld ist der Aufmacher. Es gibt absichtlich
**kein `form`-Element**: die Eingabe geht über sessionStorage
(`seorank-pruefer`, `seorank-umfang`, `seorank-sofort`) ans Protokoll, nie
über die Adresse. Mit `form` ohne `name` meldete der eigene Katalog zu Recht
`feld-ohne-namen`; mit `name` landete ohne Skript die Eingabe in der URL.

Die **Protokollprobe** ist eine echte Messung: der Katalog läuft beim Laden
über `beispielseite.js`. Fällt das Skript aus, steht ein Strich und der
Satz, dass gemessen wird. `werkplatte.js` ist mit dem alten Aufmacher
entfallen.

## Das Prüfwerk

`pruefwerk.js`: `robotsUrteil`, `crawlerEntscheiden`, `sitemapUrteil`,
`dnsHolen`, `rdapHolen`, `relaisHolen`. Bis zum 22.09. standen sie
verwoben mit dem Zeichnen in `werkzeuge.js` und `domain.js`. Beim
Herauslösen wurde die Ausgabe beider Beispiele vorher und nachher im
Browser verglichen: zeichengleich (590/590 und 934/934). Der Selbsttest
hält fest, dass es keine zweite Fassung gibt, und die Gegenprobe an der
alten Fassung schlägt in allen vier Mustern an.

## Einblenden beim Heranrollen

`bewegung.js` blendet Abschnitte, Karten und Kennzahlen ein, wenn sie ins Bild
kommen. Entscheidend ist, WIE: es wird **keine Klasse gesetzt, die Inhalt
versteckt**. Die Elemente stehen jederzeit sichtbar im Dokument, und beim
Eintreten läuft nur kurz eine Animation über sie (`sicherLaufen`, `fill:
backwards`). Fällt Skript oder Zeitachse aus, ist die Seite trotzdem
vollständig da — die frühere Fassung mit `.einblenden` konnte das nicht und
hat einmal einen ganzen Block versteckt.

Was beim Laden schon im Bild steht, blendet sofort ein; alles darunter hängt
an einem `IntersectionObserver`. Nach jeder Änderung nachmessen: **kein
Element darf 1,8 Sekunden nach dem Laden noch unter Deckkraft 1 stehen.**

## Bewegung

Leitsatz: **Bewegung zeigt eine Messung, nicht eine Laune.** Es gibt genau
einen inszenierten Moment — den Augenblick, in dem ein Ergebnis entsteht:
Zahlen fahren hoch, Befundzeilen tragen sich nacheinander ein, die
Diagrammlinie zeichnet sich, Vergleichsbalken fahren aus. Alles andere ist
kurze Rückmeldung auf eine Handlung.

- Alles steht in `site/assets/js/bewegung.js` und im Bewegungsteil am Ende
  von `seo-rank.me.css`. Werte: `--dauer-druck` 120 ms, `--dauer-zustand`
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
- **Die Zeilenlänge steht im Stilblatt, nicht im `style`-Attribut.** Die
  23 Merkmalslisten trugen ihre Breite inline; inline schlägt jeden
  Selektor, und solange sie dort stand, ließ sich die Liste auf breiten
  Schirmen nicht anders setzen. Jetzt: `.merkmale { max-width: 74ch }`,
  und ab 1200 px Schirmbreite **zwei Spalten, aber nur ab fünf Punkten**
  (`:has(> li:nth-child(5))`) — bei drei Punkten ergäbe es 2+1. Gemessen
  bei 1440 px: zwei Spalten zu je 592 px, also rund 70 Zeichen wie zuvor.
  Wo `:has()` fehlt, greift die Regel nicht und es bleibt einspaltig; ein
  Zusatz soll genau so ausfallen.
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
node cli/seorank.mjs pruefen "site/*.html"
node cli/seorank.mjs analyse site/index.html
node cli/seorank.mjs crawl http://localhost:8099/
node cli/seorank.mjs domain beispiel-domain.de --ausführlich
node bauen/selbsttest.mjs
```

## Die Auslieferung (seit 24.09.2026)

Die Website liegt live auf einer **Wix-Headless-Site**, angelegt über den
Drop-Weg für fertige Dateien (`headless-business-setup`: anlegen, hochladen,
freigeben, danach ein Claim ins Konto). `site/` ist rein statisch und läuft
auch aus dem Dateisystem.

**Adresse:** `https://instant-aocfmzsjdndd-hnvrme-1406.wix-site-host.com/`

```bash
node bauen/adresse-setzen.mjs https://neue-adresse.example
node bauen/paket-schnueren.mjs [zielordner]
```

`adresse-setzen.mjs` schreibt die Basisadresse um (canonical, og:url, JSON-LD,
robots.txt, Sitemap) und merkt sie in `bauen/adresse.txt`; **der Selbsttest
liest denselben Merker**, eine falsche Adresse lässt ihn scheitern.
`paket-schnueren.mjs` erzeugt zuerst die Sitemap neu und legt dann eine Kopie
ohne Werkzeugreste an (alles mit `.` oder `_` am Anfang fällt weg).

**Beim Claim wechselt die Adresse, und danach nimmt Wix keine Dateien mehr
an** — es gibt keinen Re-Upload für eine geclaimte Instant-Site. Die Adresse
ist aber vorhersagbar: aus `instant-<name>-headlessstack-140d` wird
`instant-<name>-hnvrme-1406`. Neu ausliefern heißt deshalb: Site anlegen,
eine Probedatei hochladen, aus der Antwort den Namen lesen, Adresse setzen,
Paket hochladen, freigeben, claimen, robots.txt setzen (unten), nachmessen,
die alte Fassung in den Papierkorb (sonst steht die Website doppelt im Netz).

### Was Wix anders macht (gemessen an einer Wegwerf-Site)

- **`sitemap.xml` sperrt Wix**, auch im Unterordner: 404. Andere Namen
  liefert es als `application/xml` aus. Die Sitemap heißt deshalb
  **`sitemap-seiten.xml`** — im Projekt, in der robots.txt und im
  `<link rel="sitemap">` aller 24 Seiten. Der Code sucht `/sitemap.xml` nur
  als Rückfall, wenn die robots.txt keine nennt.
- **`robots.txt` ersetzt Wix durch seine eigene.** Die Projektfassung wird über
  die Schnittstelle gesetzt: `PUT promote-seo-robots-server/v2/robots` mit
  `default: false`, Inhalt = `site/robots.txt`. Gemessen: live wortgleich.
- **Ordner mit Punkt** (`.well-known/`) werden nicht ausgeliefert.

### Die Sitemap wird erzeugt

`node bauen/sitemap-erzeugen.mjs` (läuft auch in `paket-schnueren.mjs`).
Hinein kommt jede Seite **ohne** `noindex`, `lastmod` ist das
Änderungsdatum der Datei. Bis zum 25.09.2026 war sie von Hand gepflegt und
enthielt Impressum und Datenschutz, obwohl beide `noindex` tragen, und jedes
`lastmod` stand im August. Der Selbsttest prüft die **Menge** (genau die
offenen Seiten), nicht das Datum — das wäre nach jedem Kopieren anders.

Ergebnis im eigenen Domain-Check der Live-Adresse: **86 → 89 von 100**,
„Keine Sitemap gefunden" ist weg. Die zwei übrigen wichtigen Befunde (ein
Nameserver, Zertifikat ohne zweite Schreibweise) gehören dem Wix-Hosting.

### Was Lighthouse sagt (25./26.09.2026, mobil)

Vor dem Durchgang vom 26.09.: Barrierefreiheit 95–96, Agentic Browsing
97–100, Layoutverschiebung 0,091 (werkzeuge) und 0,055 (domain).
Danach auf Start, Prüfer, Werkzeuge, Domain und App: **Barrierefreiheit
100, Empfohlene Praktiken 100, SEO 100, Agentic Browsing 100,
Layoutverschiebung 0**. Der einzige verbleibende Befund ist
`is-crawlable` auf `app.html` — das beabsichtigte `noindex`.

Die drei App-Unterseiten hatten keinen Weltschalter, `app.html` schon.
Er steht jetzt überall in derselben Aktionsleiste.

### Das Relais

`https://www.hnvr.me/_functions/holen` antwortet mit 404 — im Browser als
„Failed to fetch", weil die Fehlerseite keine CORS-Kopfzeile trägt.
`/_functions/seocheck` antwortet mit 200: Velo läuft dort, nur `holen` fehlt.
Bis es eingespielt ist, arbeiten „Adresse prüfen" und „Ganze Domain" live
nicht; alles andere schon (am 25.09. jedes Werkzeug live durchgeklickt).

**Auf hnvr.me gibt es schon eine `http-functions.js`** (mit seocheck), und
eine Wix-Site hat nur eine. Die Relais-Datei wird deshalb UNTER den
vorhandenen Code gesetzt. Dafür tragen alle ihre Namen das Präfix `relais`,
und die Importe laufen über eigene Namen (`ok as relaisOk`, `fetch as
relaisFetch`). Die frühere Fassung importierte `ok` und `fetch` unter dem
gewöhnlichen Namen — nachgestellt und mit `node --check` gemessen:
„Identifier 'ok' has already been declared", die ganze Datei samt seocheck
wäre ausgefallen. Der Selbsttest verlangt jetzt, dass jeder Import einen
eigenen Namen hat. Mit nachgebildeten Wix-Modulen in Node ausgeführt holt
die Datei example.com und weist localhost, 169.254.169.254 und file:// ab.

**Was das tote Relais sonst noch aufgedeckt hat:** der Domain-Check machte
daraus „Domain antwortet nicht" und behauptete in derselben Zeile, das Relais
habe die Seite abgerufen. `relaisHolen` liefert auch im Fehlerfall ein
`varianten`-Feld, nur mit `status: null`. Jetzt werden die Varianten nur
übernommen, wenn mindestens eine geantwortet hat, und die Zusage nennt den
Ausfall. Gemessen an hnvr.me: ohne Relais 10 von 48 Regeln (vorher 13, drei
davon aus dem Nichts), mit `node cli/relais.mjs` 35 von 48.


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

Der beste Test der Website ist sie selbst. Stand 29.09.2026: **24 Seiten,
6 kritisch / 20 wichtig / 17 Hinweise** — und der Selbsttest hält genau diese
Bilanz fest (`Eigene Seiten: Gesamtbilanz`). Jeder Befund, der dort nicht
ausdrücklich zugelassen ist, lässt ihn scheitern; jede Zulassung nennt Grund
und Geltungsbereich. Was bleibt, ist nicht behebbar, ohne zu ERFINDEN:

- die **6 kritischen** sind das beabsichtigte `noindex` auf Rechtsseiten
  und Produktoberfläche,
- die **19 wichtigen** sind `platzhaltertext` auf jeder Seite mit Fußzeile:
  `[Anschrift ergänzen]`. Er verschwindet, sobald die Anschrift eingetragen
  ist — nicht vorher, und er wird nicht ausgeblendet,
- die **17 Hinweise** sind `autor-fehlt` auf dem Datenschutztext (ein
  Verfasser wäre erfunden), `dom-gross` auf dem Regelsatz (158 Regeln im
  Klartext SIND groß) und fünf Prosa-Maße auf den vier `app*`-Entwürfen:
  Bedienbeschriftungen sind keine Sätze, und „2026“ steht in einer
  Datumsspalte, nicht im Fließtext.

**Was am 31.08. von 70 auf 17 Hinweise geführt hat, ist echter Inhalt,
nichts Erfundenes:** eine `BreadcrumbList` je Seite, die der Navigation
folgt (Startseite → Werkzeuge → Werkzeug); eine `Content-Security-Policy`
als meta; sechs Titel-H1-Paare mit einem gemeinsamen Wort; eine Frage, die
jetzt eine Antwort unter sich hat; ein Feld mit `autocomplete`.

**Die Richtlinie und das Welt-Skript.** `script-src 'self'` verlangt, dass
kein Inline-Skript läuft — aber das Welt-Skript MUSS inline und synchron im
Kopf stehen, sonst blitzt die Seite erst hell und dann dunkel auf. Der
erste Versuch, es auszulagern, hat sofort `skript-blockierend` auf allen
24 Seiten ausgelöst (der Katalog hat recht). Die Lösung ist ein
**Hash**: `'sha256-wKCw1Phd2uoyQG4mFDa4uW9hlZS0WEOGdcqDVO/W5mE='` erlaubt
genau dieses eine Skript und sonst keines. **Wer das Skript auch nur um ein
Zeichen ändert, muss den Hash auf allen 24 Seiten neu setzen** — sonst
schweigt der Browser das Skript weg und die dunkle Welt blitzt.
`connect-src https:` ist bewusst weit: das Relais trägt der Benutzer selbst
ein, eine feste Liste würde diese dokumentierte Freiheit brechen.

Wer eine Seite hinzufügt, rechnet mit +1 wichtig (Fußzeile) und setzt
Pfad, Richtlinie und Welt-Skript wie auf den anderen; der Selbsttest sagt
sonst, was fehlt.

Gemessen wird außerdem im Browser mit `bauen/pruefstand.js` (der
Vorschauserver liefert nur `site/` aus; den Code in einer Seite ausführen),
über alle 23 Seiten in beiden Welten bei 390 und 1440 px. Stand 22.09.2026:
**0 Klassen ohne Regel** (19.692 Vorkommen), **0 Textstellen unter AA**
(14.802 geprüft), **0 waagerechter Überlauf** bei 320/360/390/430 px,
alle 96 Welten richtig gesetzt, 0 fremde Seiten, 192 Läufe. „Getrübt“ meldet er 10
Elemente je Welt, alle beabsichtigt: die unsichtbaren Radioknöpfe der
Umfangwahl (die Karte zeigt den Zustand) und Ableseband und Zierfläche im
Diagramm auf `app.html`. Ankersprünge (h2/h3/section/li mit Kennung, 19
Seiten, 390 und 1440 px): **508 Sprünge, 0 verdeckt** in 38 Läufen, darunter
die 158 Regelanker des Regelsatzes. Kopfzeile gemessen 74,7 px (390) und
75,8 px (1440), also unter `--kopfhoehe` 75/77.

**Beim Messen im Browser zuerst prüfen, WER auf dem Port antwortet.** Auf
8099 lag einmal der Server eines anderen Projekts; `curl` gab brav 200
zurück, und eine ganze Messreihe lief gegen fremde Seiten — samt einem
Überlauf, den es bei uns nie gab. Der Prüfstand holt deshalb je Seite den
`<title>` und verlangt darin `seo-rank.me`.

## SEO Wächter (seit 04.10.2026)

`waechter/` ist die neue Produktoberfläche und löst `site/app*.html` ab. Sie ist eine eigene
Node-Anwendung mit Konto, Dashboard, Überwachung und Berichten und liest denselben Regelkatalog
über `waechter/lib/werk.mjs`. Arbeitsanweisung in `waechter/CLAUDE.md`, Betrieb in
`waechter/LIESMICH.md`. Wer hier am Katalog ändert, lässt danach auch
`node waechter/test/selbsttest.mjs` laufen (Stand 04.10.: 82 Prüfungen, 0 gescheitert).
