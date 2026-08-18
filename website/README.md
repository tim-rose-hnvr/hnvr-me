# pnkt.me — Marketingseite

Die fünf Seiten aus dem Design-Handoff, gebaut in Astro. Statisch: die
Seite zeigt nichts, was sich je Besucher unterscheidet.

```sh
cd website
npm install
npm run schriften     # einmalig: Schriften holen
npm run dev           # http://localhost:4321
npm run build         # nach dist/
```

| Weg | Datei | Inhalt |
|---|---|---|
| `/` | `src/pages/index.astro` | Aufmacher, Kundenband, vier Kiesel, Werkstatt, drei Versprechen, Abschluss |
| `/werkstatt` | `werkstatt.astro` | Prüfliste, acht Stile, drei Regeln, drei Merkmale, Serie |
| `/strecken` | `strecken.astro` | Trichter mit Röhren, A/B-Ergebnis, Push, Bausteine, Regeln |
| `/vorlagen` | `vorlagen.astro` | sechs Vorlagen, Team-Panel |
| `/preise` | `preise.astro` | vier Tarife, „In jedem Tarif", Fragen, Abschluss |
| `/lesbarkeit` | `lesbarkeit.astro` | sechs Grenzwerte, Verfahrenstabelle, die Messung zu runden Ecken |
| `/massenanlage` | `massenanlage.astro` | Massenanlage und Serie, Spalten, Inhalt des Archivs |
| `/schnittstelle` | `schnittstelle.astro` | alle Wege der REST-Schnittstelle, zwei curl-Beispiele |

Die letzten drei standen schon unter derselben Adresse im alten Entwurf
(`punkt-954d3e9b-hnvrme.wix-site-host.com`). Sie sind hier nicht abgeschrieben,
sondern gegen `pnkt/` gehalten: jeder Grenzwert steht in `pnkt/druck/druck.go`,
jede Spalte in `pnkt/charge.go`, jeder Weg in `pnkt/main.go`. An zwei Stellen
wich der alte Text vom Programm ab — die Spaltenliste der Massenanlage nannte
Spalten, die nicht gelesen werden, und die Schnittstellenseite nannte Endpunkte
unter anderen Namen. Es gilt der Code.

Gemeinsam: `layouts/Seite.astro` (Kopf, Fuß, Tokens, Bewegung),
`components/SiteNav.astro`, `SiteFooter.astro`, `Icon.astro` (alle
vierzehn Zeichen), `styles/organic.css` (die Tokenschicht aus dem
Handoff, unverändert bis auf eine Zeile — siehe unten).

---

## Die Schriften liegen hier, nicht bei Google

`organic.css` holt Caprasimo und Figtree im Original von
`fonts.googleapis.com`. Das ist geändert, und zwar nicht aus Geschmack:

Im Fuß jeder Seite steht **„EU-Hosting · keine Tracking-Cookies"**. Eine
Seite, die dabei ihre Schriften von Google holt, schickt die IP jedes
Besuchers nach Amerika, bevor der erste Buchstabe steht. Das Landgericht
München I hat dafür im Januar 2022 Schadenersatz zugesprochen
(3 O 17493/20). Die Aussage im Fuß und der Ladeweg müssen zusammenpassen
— sonst ist eine von beiden falsch, und die Aussage ist das Versprechen.

`npm run schriften` holt beide einmal und legt sie samt `@font-face` und
Lizenz nach `public/schrift/`. Acht Schnitte, zusammen 114 KB, davon
laden zwei sofort. Beide stehen unter der SIL Open Font License; das
Mitliefern ist ausdrücklich erlaubt.

Die Seite lädt danach **nichts** von fremden Servern. Nachprüfbar:

```sh
npm run build && grep -r "fonts.googleapis\|fonts.gstatic" dist/   # nichts
```

## Zwei Abweichungen vom Entwurf

**Die häufigen Fragen stehen offen da.** Der Handoff nennt „15px question
+ 13.5px answer" und der Referenz-Screenshot zeigt beides sichtbar. Ich
hatte zuerst eine Ziehharmonika gebaut — hübscher, aber falsch: vier
Fragen passen auf den Schirm, und wer Preise vergleicht, will alles
sehen, nicht viermal klicken. Zurückgebaut.

**Kopf und Raster brechen früher um.** Der Entwurf ist für 1200 px
gezeichnet und sagt zu schmalen Geräten nichts. Die Marketingseite wird
zur Hälfte am Telefon gelesen, deshalb: Wegeleiste rutscht unter die
Marke und wird scrollbar, Raster gehen von vier auf zwei auf eine Spalte,
Überschriften von 70 auf 46 px. Kein zusammengeschobenes Menü mit
11-px-Text.

## Was noch Platzhalter ist

Aus dem Handoff selbst: „Photography and logos are placeholders."

- **Kundenzeichen** im Band — gestreifte Pillen mit Namen. Bewusst
  gestreift, damit niemand sie für fertige Logos hält.
- **Bildschirmfotos der Vorlagen** — gestreifte Rechtecke mit Beschriftung.
- **`photo-organic.jpg`** im Aufmacher — das Platzhalterbild aus dem
  Designsystem.
- **Die acht QR-Bilder** sind erzeugte Muster ohne echte Adresse. Vor dem
  Druck durch echte ersetzen; die Prüfregeln dafür stehen auf `/werkstatt`.

## Was fehlt, bevor das öffentlich geht

**Impressum und Datenschutzerklärung ausfüllen.** Beide Seiten gibt es
inzwischen, beide sind Gerüst: die Pflichtfelder stehen als sichtbare
Lücken in eckigen Klammern, und ganz oben steht ein Kasten, der sagt,
dass der Text noch nicht vollständig ist. § 5 DDG verlangt Namen,
Anschrift, Vertretungsberechtigte, Registergericht und Registernummer,
Umsatzsteuer-Identifikationsnummer und eine Kontaktmöglichkeit — davon
kenne ich nichts.

Was ich ausfüllen konnte, ist der technische Teil des Datenschutzes: was
gezählt wird, was nicht entsteht, was die Landeseiten laden (nichts) und
welche Kopfzeilen dabei gesetzt werden. Das steht dort ausgeschrieben,
damit die juristische Prüfung kurz wird.

**Die Domain.** `pnkt.me` löst derzeit in keinem DNS auf — weder A noch
über `www`. Solange das so ist, ist diese Seite ein Ordner, keine
Adresse.

## Die Zahlen im Entwurf sind Fassaden

Der Handoff ist ein Layout, kein Datenblatt. Er trägt Werte, die gut
aussehen und nie gemessen wurden — und sie standen zunächst genauso in
dieser Seite:

| stand da | war | jetzt |
|---|---|---|
| „4,1× mehr Bestellungen je Scan" | erfunden | drei Angaben, die aus dem Programm folgen |
| „31 % bestellen", „22 % senden ab", … | erfunden | was die Vorlage enthält, plus ihr Stand |
| „A gewinnt mit 31 %, Signifikanz 93 %" | erfunden, für ein Merkmal, das es nicht gibt | die zwei Stufen, die wirklich gezählt werden |
| „Schon dabei: Nordwerk, Halle 7, …" | erfundene Referenzen | wofür das System gebaut ist |
| „© pnkt.me GmbH · Hamburg", „Frankfurt" | erfundene Firmenangaben | Lücke, sichtbar markiert |
| „jeder Entwurf mit eigener Scanrate" | nicht messbar | der Satz ist weg, der Grund steht daneben |

Eine Werbeaussage mit einer erfundenen Zahl ist nach § 5 UWG
irreführend. Eine erfundene Referenz ist schwerer: sie behauptet, jemand
stehe dahinter. Und eine Zahl unter einem Merkmal, das es nicht gibt,
ist beides auf einmal.

Wo im Layout ein Beispiel stehen muss, damit man die Anordnung sieht,
steht jetzt dabei, dass es eines ist — „Beispiel, keine Messung",
„Beispielbefund".

## Impressum und Datenschutz

Beide Seiten gibt es, beide sind unvollständig, und beide sagen das
oben in einem Kasten. Der technische Teil der Datenschutzerklärung ist
genau: er beschreibt, was das Programm tatsächlich zählt und was nicht
entsteht — genau der Teil, den eine Kanzlei sonst erfragen muss. Was
fehlt, steht am Ende jeder Seite als Liste: Anbieter, Anschrift, Hoster,
Fristen, Rechtsgrundlagen.

**Vor dem Onlinegehen muss beides ausgefüllt und geprüft werden.** Ein
Impressum mit erfundener Adresse ist schlechter als keines.

## Was hier bewusst nicht gebaut ist

Der Handoff enthält neben der Marketingseite ein zweites, größeres Stück:
die Produktoberfläche (`QR System.dc.html`) — Werkstatt-Editor,
Serien-Assistent, vier App-Bildschirme, Dashboard, Design-System-Seite.
Das ist nicht Marketing, sondern das Produkt, und ein guter Teil davon
läuft bereits unter `/studio` und `/zentrale`. Es dort einzubauen ist die
richtige Reihenfolge — nicht, es hier ein zweites Mal zu bauen.

## Eine Datei zum Weitergeben

`npm run eine-datei` baut die Seite und legt sie danach als **eine**
HTML-Datei ab (`website/pnkt-me.html`, rund 4 MB). Darin steckt alles:
die acht Schriftschnitte und alle Bilder als Daten-URI, der Stil im
Dokument, die sieben Seiten als sieben Abschnitte. Die Wege dazwischen
laufen über den Anker in der Adresse (`#werkstatt`, `#vorlagen~liste-gastro`),
sodass Zurück und Vorwärts weiterhin stimmen.

Wozu: die Seite ist vorzeigbar, bevor ein Server und eine Domain stehen.
Eine Datei ohne einen einzigen Abruf nach außen lässt sich anhängen,
weiterreichen oder auf einen Stick legen — und sie beweist nebenbei den
Anspruch aus dem Fuß: nichts wird von fremden Servern geholt. Das Skript
bricht ab, wenn nach dem Einbetten noch ein Verweis auf `/…` übrig ist.

Der Ersatz für einen Server ist das nicht: es gibt keine getrennten
Adressen, keine Sitemap, kein `robots.txt`. Für die Veröffentlichung
unter `pnkt.me` gilt weiter `npm run build` und ein Webserver.

---

## Eine Falle beim Bauen

`export type` im Frontmatter einer `.astro`-Datei strippt der Compiler
nicht. Der Bau bricht dann mit `Unexpected "|"` ab und zeigt auf eine
Zeile im Markup — eine Meldung, die nichts mit Typen zu tun zu haben
scheint. Deshalb liegen die Icon-Namen in `components/icons.ts` und
werden als `import type` geholt. Aufgefallen ist das nur, weil der Bau
wirklich gelaufen ist.
