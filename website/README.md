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

**Impressum und Datenschutzerklärung.** Der Fuß verweist auf
`/impressum` und `/datenschutz` — beide Seiten gibt es nicht, die
Verweise laufen ins Leere. Für ein deutsches Unternehmen ist das keine
Feinheit: § 5 DDG verlangt Namen, Anschrift, Vertretungsberechtigte,
Registergericht und Registernummer, Umsatzsteuer-Identifikationsnummer
und eine Kontaktmöglichkeit.

Ich habe die beiden Seiten **nicht** angelegt. Ein Impressum mit
erfundenen oder ausgedachten Angaben ist schlimmer als keines, und die
Angaben kenne ich nicht. Sie kommen von euch, dann sind es zwei kleine
Seiten.

**Die Domain.** `pnkt.me` löst derzeit in keinem DNS auf — weder A noch
über `www`. Solange das so ist, ist diese Seite ein Ordner, keine
Adresse.

## Was hier bewusst nicht gebaut ist

Der Handoff enthält neben der Marketingseite ein zweites, größeres Stück:
die Produktoberfläche (`QR System.dc.html`) — Werkstatt-Editor,
Serien-Assistent, vier App-Bildschirme, Dashboard, Design-System-Seite.
Das ist nicht Marketing, sondern das Produkt, und ein guter Teil davon
läuft bereits unter `/studio` und `/zentrale`. Es dort einzubauen ist die
richtige Reihenfolge — nicht, es hier ein zweites Mal zu bauen.

## Eine Falle beim Bauen

`export type` im Frontmatter einer `.astro`-Datei strippt der Compiler
nicht. Der Bau bricht dann mit `Unexpected "|"` ab und zeigt auf eine
Zeile im Markup — eine Meldung, die nichts mit Typen zu tun zu haben
scheint. Deshalb liegen die Icon-Namen in `components/icons.ts` und
werden als `import type` geholt. Aufgefallen ist das nur, weil der Bau
wirklich gelaufen ist.
