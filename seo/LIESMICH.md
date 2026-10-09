# seo-rank.me

Kostenloses SEO-Werkzeug. Zwölf Prüfer, zehn davon vollständig im Browser,
Kommandozeile und Crawler laufen mit Node — alle mit demselben Regelsatz
aus **einer** Datei. Keine Abhängigkeiten, kein Server nötig. Ein Konto gibt
es seit dem 29.09.2026, es ist aber freiwillig: alle zwölf Werkzeuge laufen
ohne. Angemeldet lässt sich eine Prüfung ablegen und wiederfinden.

```bash
# Eine Seite prüfen
node cli/seorank.mjs pruefen site/index.html

# Eine ganze Domain crawlen
node cli/seorank.mjs crawl https://beispiel-domain.de/ --max 500

# Ein Dokument ausmessen: Profil, Gliederung, Wortfeld, Punktzahl
node cli/seorank.mjs analyse site/index.html

# Den Regelsatz durchsuchen
node cli/seorank.mjs regeln hreflang
```

## Was drin ist

| Teil | Zweck |
|---|---|
| `site/` | Die Website: zwölf Werkzeuge, Regelsatz, Produktoberfläche. Reines HTML, CSS, JS. Ohne Build im Browser zu öffnen. |
| `cli/` | Kommandozeile, Crawler und Domain-Check. Eigener HTML-Parser, eigene Selektoren, keine Fremdpakete. |
| `bauen/` | Hilfsskripte: Erzeuger für den Regelsatz, Vorschauserver, Selbsttest. |
| `design/` | Die frühere Design-Leinwand. Die geltende Gestaltung („Plan“, seit 24.09.2026) liegt in Figma, Datei `h8vh0gi1qr9NC6HgBNtFEr`. |
| `action.yml` | GitHub-Action, die den Build bei Befunden scheitern lässt. |

## Die zwölf Werkzeuge

| Werkzeug | Was es prüft |
|---|---|
| Seiten-Prüfer (Protokoll) | Adresse oder Quelltext, 158 Regeln in vierzehn Gruppen. Beginnt mit höchstens fünf Punkten „Zuerst beheben“, zeigt acht Bereiche mit Zustand, öffnet jeden Befund mit Fund, Grund und Behebung. Umfang „Ganze Domain“ nimmt robots.txt, Sitemap und die Domain-Regeln dazu |
| Snippet-Vorschau | Schreibtisch und Telefon nebeneinander, gerechneter Zeilenumbruch, Datumsvorspann, der abgeschnittene Rest im Klartext |
| robots.txt-Prüfer | Gruppenauswahl, Wildcards, Längenregel, Sperren für KI-Crawler |
| Sitemap-Prüfer | Aufbau, Namensraum, Doppelungen, Datumsformate, Größengrenzen |
| Strukturierte Daten | JSON-LD gegen Pflicht- und Empfehlungsfelder von 41 Typen |
| hreflang-Prüfer | Format, Eigenverweis, x-default, Gegenseitigkeit |
| Stichwort-Prüfer | Zehn tragende Stellen, Dichte, Vergleich mit den führenden Begriffen der Seite |
| Werkbank | Bis 40 Seiten auf einmal, verdichtet zu einer Arbeitsreihenfolge: was zuerst, was sitzt in der Vorlage |
| WDF·IDF | Begriffsgewicht gegen ein selbst eingelegtes Vergleichsfeld: was trägt das Thema, was fehlt |
| Tempo | Core Web Vitals aus Chrome UX Report und Lighthouse: Felddaten mit Verteilung, Labormessung, Bremsen nach Ersparnis sortiert |
| Weiterleitungen | Regeln aus .htaccess, nginx oder einer Liste: Ketten, Schleifen, verdeckte Regeln, 302 statt 301 — sechzehn Prüfungen, nichts wird abgerufen |
| Domain-Check | 48 Regeln unter den Seiten: DNS, Zertifikat, die vier Schreibweisen, Kopfzeilen, Cookies, Standarddateien, Registrierung |

**Wer Quelltext einfügt, gibt nichts aus der Hand.** Es wird nichts
abgerufen, nichts gesendet, nichts gespeichert. Zehn der zwölf können auf
Wunsch auch eine Adresse laden; dann holt ein Relais die Seite, und das
steht daneben (siehe unten).

**Tempo ist die eine Ausnahme ohne Wahl:** die Messung findet bei Google
statt, deshalb gehen Adresse und Schlüssel dorthin. Das steht auf der Seite
selbst, im Datenschutztext und in der Werkzeugübersicht. Ohne eigenen
API-Schlüssel antwortet Google in aller Regel mit 429; der Schlüssel ist
kostenlos und liegt nur im `sessionStorage`.

## Die Website besteht ihre eigenen Regeln

Alle 24 Seiten laufen im Selbsttest durch die 158 Regeln. Was übrig bleibt,
ist nicht behebbar, ohne etwas zu erfinden — das absichtliche `noindex` auf
Rechts- und Entwurfsseiten, der Platzhalter `[Anschrift ergänzen]`, ein
Verfasser für den Datenschutztext — und steht mit Grund und Geltungsbereich
im Test. Jeder andere Befund lässt ihn scheitern. Jede Seite trägt eine
`BreadcrumbList`, die der Navigation folgt, und eine `Content-Security-Policy`,
die außer dem einen Welt-Skript (per Hash erlaubt) kein Inline-Skript zulässt.

## Die Startseite misst sich selbst

Der Aufmacher zeigt kein Schaubild, sondern eine Messung: der volle Regelsatz
läuft im Browser über diese Seite und zeichnet Zeiger, Punktzahl und Befunde.
Ein zweiter Schalter legt stattdessen eine absichtlich fehlerhafte Seite ein
(`site/assets/js/beispielseite.js`) — dieselbe, gegen die auch der Selbsttest
prüft. Beide Läufe sind echt; es gibt keine hinterlegte Zahl.

## Der Regelkatalog

`site/assets/js/regelkatalog.js` ist die einzige Quelle. Jede Regel ist ein
Objekt:

```js
{
  id: "titel-breit",
  gruppe: "Titel und Beschreibung",
  name: "Titel wird abgeschnitten",
  stufe: "wichtig",            // kritisch | wichtig | hinweis
  braucht: false,              // true, wenn ein vollständiges Dokument nötig ist
  wozu: "Der Titel ist breiter als 600 px …",
  beheben: "Auf etwa 55 bis 60 Zeichen kürzen …",   // aus der Tabelle ZUSATZ
  wirkung: "Trefferliste",                          // worauf sie sich auswirkt
  gewicht: 3,                                       // 1 bis 5, für die Punktzahl
  pruefe: function (dokument, rohtext) {
    // null oder { wie: "…", fund: "…" }
  }
}
```

`beheben`, `wirkung` und `gewicht` stehen gesammelt in der Tabelle `ZUSATZ`
weiter unten in derselben Datei und werden beim Laden angeheftet. So bleiben
die Prüfroutinen lesbar, und der Selbsttest kann verlangen, dass keine Regel
ohne Behebungsweg bleibt.

## Die Punktzahl

Offen gerechnet, damit sie nachvollziehbar bleibt:

```
Gruppenwert = 1 − (verlorenes Gewicht / mögliches Gewicht)
Gesamtwert  = dasselbe über alle geprüften Regeln
```

Jede geprüfte Regel bringt ihr Gewicht ein, eine angeschlagene Regel verliert
es ganz. Regeln, die übersprungen wurden — weil nur ein Ausschnitt vorlag oder
weil `--nur`/`--ohne` sie ausgeschlossen hat —, zählen weder positiv noch
negativ. Keine Kurve, kein Bonus, keine Gewichtung nach Beliebtheit. Die
158 Regeln summieren sich auf 351 Gewichtspunkte.

## Die Analyse

`site/assets/js/analyse.js` misst, wo der Katalog urteilt. Beides rechnet mit
denselben Routinen (`SEORANK_MESSEN` aus dem Katalog), damit Zahl und Befund
nicht auseinanderlaufen.

| Blatt | Was darauf steht |
|---|---|
| Profil | Umfang, Textanteil, Schachtelungstiefe, Satzlänge, Lesbarkeit nach Amstad, Titel- und Beschreibungsbreite in Pixeln, Bausteine, Bilder, Verweise, fremde Hosts |
| Gliederung | Alle Überschriften in Dokumentreihenfolge, mit übersprungenen Ebenen |
| Wortfeld | Einzelne Wörter sowie Zweier- und Dreierfolgen mit Anzahl, Dichte und der Angabe, ob sie in Titel, Beschreibung, H1, H2/H3 oder Adresse vorkommen |
| Verweise | Jeder Verweis mit Text, Ziel, Art, `rel` und Zielfenster |
| Bilder | Jedes Bild mit Alternativtext, Maßen, Ladeverhalten, `srcset` und Format |
| Wirkung | Dieselben Befunde nach Wirkungsbereich statt nach Bauteil |

Dieselbe Datei wird gelesen von

- dem Seiten-Prüfer im Browser,
- der Kommandozeile und dem Crawler,
- dem Erzeuger, der daraus `site/regelsatz.html` schreibt.

**Nach jeder Änderung am Katalog:**

```bash
node bauen/regelsatz-erzeugen.mjs   # Regelsatz-Seite neu schreiben
node bauen/selbsttest.mjs           # 181 Prüfungen, muss grün sein
```

## Der Domain-Check holt DNS selbst

Zehn DNS-Regeln und zwei zur Registrierung lassen sich im Browser prüfen,
wenn man den Knopf **„dns und registrierung holen“** drückt: er fragt
cloudflare-dns.com und rdap.org, beide antworten dem Browser direkt. Das
ist ein Fremdaufruf und passiert deshalb nur auf diesen Klick, nie beim
Laden und nie beim Prüfen eingefügter Angaben. rdap.org kennt nicht jede
Endung: für `.com` und `.net` antwortet es, für `.de` und `.me` nicht.

Eingefügte Angaben haben Vorrang vor Geholtem, und Geholtes gilt nur für
die Domain, für die es geholt wurde.

## Eine Adresse prüfen statt Quelltext einfügen

Zehn der zwölf Werkzeuge können die Seite auch selbst holen: Seiten-Prüfer,
Domain-Check, robots, Sitemap, Strukturdaten, hreflang, Stichwort,
WDF·IDF, Werkbank und die Snippet-Vorschau. Ein Browser darf fremde
Adressen nicht abrufen, deshalb tut es ein **Abrufrelais**.

**Das Relais holt, der Browser urteilt.** Es gibt nur zurück, was es
bekommen hat — Kopfzeilen, Weiterleitungskette, Quelltext. Die Regeln
bleiben im Browser, damit es sie nicht zweimal gibt.

Es gibt es in zwei Fassungen, beide mit demselben Vertrag:

```bash
node cli/relais.mjs 8124     # überall, wo Node läuft
# backend/http-functions.js  — dieselbe Sache für Wix Velo
```

Die Adresse des Relais steht auf der Seite **Kommandozeile** unter
„Das Abrufrelais“ und lässt sich dort eintragen und prüfen. Ohne Relais
bleibt alles wie zuvor: Quelltext einfügen, nichts verlässt das Fenster.

Ein Relais, das jede genannte Adresse abruft, wäre ein Tor in das Netz,
in dem es steht. Abgewiesen werden localhost, alle privaten Bereiche,
169.254.169.254, Namen ohne Punkt und alles außer http und https; die
Node-Fassung prüft zusätzlich, wohin ein Name zeigt.

## Papier und Tastatur

Der Bericht wird gedruckt oder als PDF weitergereicht. Dafuer gibt es einen
eigenen Druckstil: Bedienung raus, **alle Register aufgeschlagen** (sonst
druckt sich nur das eine, das offen war), jedes Blatt mit seinem Namen
darueber, Fremdverweise mit Adresse dahinter, kein Umbruch mitten in einem
Befund. Was Sie weggefiltert haben, bleibt weggefiltert — ein Register ist
eine Ansicht, ein Filter ist eine Entscheidung.

Auf jedem Werkzeug steht dafür ein Knopf **„als pdf“**. Er öffnet den
Druckdialog des Browsers; dort „Als PDF speichern“ wählen. Das Ergebnis
hat echten, durchsuchbaren Text — anders als bei Werkzeugen, die dafür
eine Fremdbibliothek nachladen und die Seite als Bild ablegen.

Verweise auf Ueberschriften landen nicht mehr hinter der klebenden
Kopfzeile. Und im Windows-Kontrastmodus behalten die Marker vor den
Befunden ihre Kontur, statt mit ihrer Hintergrundfarbe zu verschwinden.

## Kommandozeile

```
seo-rank pruefen <datei|adresse> ...   Seiten gegen den Regelkatalog prüfen
seo-rank crawl <adresse>               Eine Domain crawlen und alles prüfen
seo-rank domain <domain> ...           Die Domain selbst: DNS, Zertifikat,
                                       Weiterleitungen, Kopfzeilen, Dateien
seo-rank regeln [suchwort]             Den Regelkatalog auflisten
seo-rank analyse <datei|adresse>       Dokumentprofil, Gliederung, Wortfeld
```

Wichtige Schalter: `--format text|json|junit`, `--stufe kritisch|wichtig|hinweis`,
`--nur`/`--ohne <ids>`, `--ausfuehrlich`, `--aus <datei>`, beim Crawl zusätzlich
`--max`, `--tiefe`, `--verzoegerung`, beim Domain-Check `--ohne-rdap`.

**`domain` ist der einzige Befehl, der von sich aus abruft** — die geprüfte
Domain, die DNS-Auflöser des Rechners und, sofern nicht abgeschaltet,
rdap.org für die Registrierungsdaten. Der Browser darf das nicht: fremde
Antwortkopfzeilen sind ihm verwehrt. Deshalb beurteilt `domain.html` nur,
was man dort einfügt, und nennt namentlich, was dabei offenbleibt.

Rückgabewert 0, solange nichts ab der gesetzten Stufe gefunden wird, sonst 1.

## In der CI

```yaml
- uses: actions/checkout@v4
- uses: ./
  with:
    ziel: "site/*.html"
    stufe: kritisch
    format: junit
    bericht: seo-rank-bericht.xml
```

Fangen Sie mit `stufe: kritisch` an. Sonst scheitert der erste Lauf an
dreißig Hinweisen, und die Strecke wird abgeschaltet statt repariert.

## Warum ohne Fremdpakete

Ein Prüfwerkzeug, das selbst dreihundert Pakete nachlädt, passt schlecht zu
einer Website, die keinen einzigen fremden Server aufruft. Der HTML-Parser
(`cli/dom.mjs`), die Selektorauswertung und die Ausgabe sind eigener Code.
Abgesichert ist das durch `bauen/selbsttest.mjs`: dieselbe Beispielseite läuft
durch Browser und Kommandozeile, und die Zahlen müssen übereinstimmen.

## Offene Punkte

- `seo-rank.me` ist ein Platzhalter für die Domain. Steht in `canonical`,
  in den og-Angaben, im JSON-LD, in `robots.txt` und in `sitemap.xml`.
- Impressum und Datenschutzerklärung sind Gerüste mit markierten Platzhaltern
  und müssen juristisch geprüft werden, bevor die Seite live geht.
- Wie der dauerhafte Betrieb eines gehosteten Crawls getragen wird, ist nicht
  entschieden. Steht als `[Finanzierung ergänzen]` auf der Seite.
- Rankings, Backlinks und Wettbewerbsvergleich sind entworfen, aber nicht
  gebaut: sie brauchen laufende Messungen und eingekaufte Daten.

## Lizenz

MIT für den Code. Die Schriften Onest und JetBrains Mono liegen
unter `site/assets/fonts/` und stehen unter der SIL Open Font License 1.1;
Herkunft und Teilsatz stehen in `site/assets/fonts/SCHRIFTEN.md`.
