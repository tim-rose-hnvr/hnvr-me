# Handoff: getintouch — Link-in-Bio mit echtem Kontakt (Marketing-Site + App-Screens)

## Overview
**getintouch** ist ein Link-in-Bio-Produkt, das nicht bei der Linkliste stehen bleibt: Nachricht, Terminbuchung und Visitenkarte passieren direkt auf der öffentlichen Profilseite, Bewertungen sind nur nach echter Buchung möglich, und Teams können das Ganze mit eigener Domain und Logo als Whitelabel betreiben. Dazu NFC-Karten, vCard-Export und Social-Sync.

Dieses Paket enthält:
1. eine **sechsseitige Marketing-Website** (Start, Vorlagen, Karte & NFC, Für Teams, Preise, Marke),
2. ein **Mockup-Dokument mit App-Screens** (öffentliches Profil mobil/desktop, Editor, Onboarding, Buchungs-Flow, Bewertungen, Analytics, Whitelabel, Vorlagen-Bibliothek, Aussehen-Panel),
3. **Markenassets** (App-Icon und Favicons als PNG) und
4. das **Design-System** („Modernist“) als CSS-Tokendatei plus Guide.

Sprache der Oberfläche: **Deutsch**, Ton warm und direkt („Schreib mir“, nicht „Kontaktformular“).

## About the Design Files
Die Dateien unter `design/` sind **Design-Referenzen in HTML** — Prototypen, die Aussehen und gewünschtes Verhalten zeigen. Sie sind **kein Produktionscode zum Kopieren**. Sie tragen die Endung `.dc.html` und laufen in einer Design-Umgebung mit einer eigenen Streaming-Runtime; Template und Logik stehen in derselben Datei (`<x-dc>`-Body + `class Component extends DCLogic`). Erwartet wird: **die Designs in der bestehenden Umgebung des Zielprojekts nachbauen** (React/Next, Vue, SwiftUI, native …) mit dessen etablierten Patterns, Komponenten und Routing. Existiert noch keine Codebasis, wähle das passende Framework und implementiere dort — Empfehlung für dieses Produkt: Next.js (App Router) + Tailwind oder CSS-Variablen aus `design-system/modernist-styles.css`, weil öffentliche Profilseiten SEO- und Ladezeit-kritisch sind.

Praktische Hinweise zum Lesen der Prototypen:
- Alle Styles stehen **inline** am Element (Anforderung der Design-Runtime). Beim Nachbau in Komponenten/Utility-Klassen überführen.
- `var(--color-*)`, `var(--font-*)` kommen aus `design-system/modernist-styles.css` (mitgeliefert).
- `<i data-lucide="name">` sind **Lucide**-Icons, die per `lucide.createIcons()` ersetzt werden. Im Zielprojekt stattdessen `lucide-react` (o. Ä.) verwenden.
- `<image-slot id="…">` ist ein Platzhalter-Element für Bilder, das in der Design-Umgebung Drag & Drop erlaubt. Im Produkt ist das ein **Upload-Feld** (Profilbild, Titelbild, Hintergrund, Bild-Karten) mit Crop/Reframe.
- `style-hover="…"` / `style-active="…"` sind Pseudo-State-Attribute der Runtime → im Zielprojekt `:hover` / `:active` (bzw. Tailwind `hover:` / `active:`).

## Fidelity
**High-fidelity.** Farben, Typo, Radien, Abstände, Schatten, Copy und Motion sind final gemeint und sollen möglichst genau übernommen werden — mit den Komponenten und Konventionen des Zielprojekts. Ausnahme: **Fotos sind Platzhalter** (`<image-slot>`, graue Kästchen mit „FOTO“/„BILD“). Echtes Bildmaterial fehlt und muss vom Kunden kommen.

Abweichung vom Design-System, bewusst: Modernist ist eigentlich radius 0 und kantig. Auf Wunsch des Auftraggebers ist die Umsetzung **rund und verspielt** — Radien 14–32 px, 2 px Konturen, Knöpfe mit „Standfuß“ (Offset-Schatten, der beim Drücken einsinkt). Farben, Schrift und Rot-als-Handlung sind aus dem System übernommen.

---

## Design Tokens

### Farben (aus Modernist, `design-system/modernist-styles.css`)
| Rolle | Token | Hex | Verwendung |
| --- | --- | --- | --- |
| Ground | `--color-bg` | `#f3f2f2` | Seitenhintergrund, Karten |
| Surface | `--color-surface` | `#eae9e9` | ruhige Flächen, sekundäre Karten |
| Ink | `--color-text` | `#201e1d` | Text, Konturen, dunkle Flächen |
| Signal | `--color-accent` | `#ec3013` | primäre Aktion, Status, Akzent |
| Signal hover | `--color-accent-600` | `#dd2b0f` | Hover primär |
| Signal press/deep | `--color-accent-700` | `#ae1800` | Standfuß-Schatten, Akzenttext |
| Signal light | `--color-accent-500` | `#ff563c` | Akzent auf dunklem Grund |
| Rosé | `--color-accent-200` | `#ffe0d9` | getönte Flächen |
| Rosé hell | `--color-accent-100` | `#fff2ef` | Info-/Vorschlagsflächen |
| Neutral | `--color-neutral-200/300/400/500/600/800/900` | `#eae7e7 / #d7d3d3 / #bab6b6 / #9b9797 / #7d7979 / #444141 / #2d2b2b` | Rahmen, Balken, Schatten, dunkle Karten |

Halbtransparente Textstufen im Prototyp: `rgba(32,30,29,.4 / .45 / .5 / .55 / .6 / .65 / .7 / .72 / .75 / .78)` — das ist Ink mit Alpha; im Zielprojekt gern als `--ink-60` etc. anlegen. Auf dunklem Grund analog `rgba(243,242,242,.5 – .9)`.

Regel: **Rot ist Handlung und Status, nie Dekoration.** Pro Screen möglichst ein rotes Element, das angetippt werden soll. Große rote Flächen nur als Abschluss-Banner (CTA).

### Typografie
- Familie: **Archivo** (Google Fonts), `--font-body` / `--font-heading`; Fallback `system-ui, sans-serif`.
- Nur zwei Gewichte: **800** (Headlines, Buttons, Zahlen, Labels) und **400** (Lauftext). 600 nur für Navigation/kleine Meta-Labels.
- Größen (Desktop-Web): H1 `56–62px / 0.96 / −0.04em`, H2 `38px / 1.02 / −0.03em`, H3 `19–22px`, Body `15px / 1.65`, Sekundär `13px / 1.6`, Meta `11.5px`, Micro `10–10.5px`.
- Kicker/Labels: `800 10px`, `letter-spacing .12em`, `text-transform: uppercase`, Farbe `rgba(32,30,29,.45)`.
- App-Screens (Mockups): Titel `21–24px`, Karten-Titel `12.5–15px`, Body `12.5px`, Meta `10.5px`.
- `text-wrap: pretty` auf Headlines.

### Spacing
Basis 4 px. Verwendete Schritte: 4, 6, 7, 8, 9, 11, 13, 14, 16, 18, 20, 22, 26, 28, 34, 40, 44, 50, 56. Seiten-Container: `max-width: 1180px`, `padding: 0 28px`, Header-Höhe `80px`, Sektionsabstand `44–56px`.

### Radien (bewusst abweichend vom System)
- Pillen/Chips: `14–22px` (Buttons `20–26px`, kleine Chips `15–18px`)
- Karten: `20–28px`, große Sektionen/Banner: `28–32px`
- Avatare: `50%`; „Blob“-Variante: `border-radius: 58% 42% 47% 53% / 49% 55% 45% 51%` animiert
- Bild-Slots: `18–30px`

### Schatten („Standfuß“)
Kein Weichzeichner-Look, sondern harter Offset:
- Karte: `0 4px 0 0 var(--color-neutral-300)` … `0 8px 0 0 var(--color-neutral-300)`
- Primärer Button: `0 4px 0 0 var(--color-accent-700)`; **aktiv**: `transform: translateY(3px); box-shadow: 0 1px 0 0 var(--color-accent-700)`
- Dunkler Button: `0 4px 0 0 var(--color-neutral-600)`
- Akzentuierte Karte: `0 6px 0 0 var(--color-accent)`

### Borders
`2px solid var(--color-text)` für aktive/umrandete Elemente, `2px solid var(--color-neutral-300)` für ruhige Rahmen und Trennlinien, `2px dashed var(--color-neutral-400)` für „hier fehlt noch was“ / Drop-Zonen.

---

## Motion

Vier Bewegungen, mehr nicht (dokumentiert auf der Marke-Seite):

| Name | Keyframes | Timing | Bedeutung |
| --- | --- | --- | --- |
| Berühren | zwei Kreise fahren zusammen (`translateX ±9px`) | 2.6 s ease-in-out, infinite | Logo-Animation, Ladezustand der App |
| Puls | `scale(.9→2.2)`, `opacity .5→0` auf einem Ring hinter einem Punkt | 1.9–2.6 s ease-out, infinite | Erreichbarkeit, neue Anfrage. **Nur ein Puls pro Screen** |
| Laden | Ring mit `border-top-color: accent`, `rotate 360°` | 1 s linear, infinite; erst ab >400 ms Wartezeit zeigen | Ladevorgang |
| Standfuß | `translateY(3px)` + Schatten von 4px auf 1px | 120–150 ms | Button-Druck (Tastgefühl der Marke) |

Weitere im Prototyp verwendete Helfer:
- `gtRise`: `opacity 0→1`, `translateY(14px→0)`, 450–600 ms ease-out, gestaffelt 60–80 ms — Einblenden von Listen/Karten.
- `gtPop`: `scale(.75→1.06→1)` mit Opacity, 400–500 ms — neu erscheinende Chips, Bestätigungen.
- `gtBounce`: `translateY(0→−7px→0)`, 2.2–2.6 s ease-in-out — Aufmerksamkeit auf einen einzelnen CTA/Status.
- `gtFloat`: `translateY(0→−9px)` + leichte Rotation, 4 s — schwebende Info-Karte im Hero.
- `gtBlobA`: animierte asymmetrische `border-radius` (8–9 s) — Avatar-Blob in verspielten Vorlagen.
- Karten-Hover: `translateY(−3…−5px)`, `transition: transform .18s ease`.
- `prefers-reduced-motion`: im Prototyp nicht umgesetzt — **bitte im Produkt ergänzen** (alle infinite Animationen abschalten, Rise/Pop auf Opacity reduzieren).

---

## Screens / Views

### A. Marketing-Website (`design/Website-*.dc.html`)

Gemeinsames Gerüst aller sechs Seiten:
- **Header**, 80 px hoch, sticky nicht nötig: Logo (28–34 px, Radius 11 px) + Wortmarke `800 17px`, dann Navigation `600 12.5px` in `rgba(32,30,29,.7)` (aktive Seite: Ink + 800), rechts „Anmelden“ als Textlink und ein dunkler Pill-Button (`--color-text`, Radius 22 px, Standfuß `neutral-600`).
- Navigationsreihenfolge: **Vorlagen · Karte & NFC · Für Teams · Preise · Marke**.
- **Footer**: 2 px Oberlinie, Logo + Wortmarke links, Links rechts (`12.5px`). Auf der Startseite vierspaltig mit Rubriken Produkt / Firma / Rechtliches.
- **Abschluss-Banner** je Seite: rote Fläche (`--color-accent`), Radius 32 px, Kicker (uppercase, opacity .9), H2 `38–50px`, weißer Button mit Standfuß `accent-700`.

#### 1. Start (`Website-Start.dc.html`)
Zweck: Wertversprechen und Handle-Sicherung.
- **Hero**, Grid `minmax(0,1.2fr) minmax(0,1fr)`, gap 34 px (das `minmax(0,…)` ist wichtig, sonst drückt der Bild-Slot das Grid auf).
  Links: Badge-Pill (Rosé, Sparkles-Icon, „Ein Link, der antwortet“), H1 62 px „Deine Leute sollen dich erreichen, nicht nur anklicken.“, Body 15 px, dann **Handle-Feld**: Pill-Container `border 2px solid ink`, Radius 30 px, Präfix „getintouch.me/“ in `ink-50`, Eingabe `800 14px`, roter Button „Sichern“; darunter Meta „Kostenlos starten · Eigene Domain ab Pro · In 2 Minuten live“.
  Rechts: Bild-Slot 420 px hoch, Radius 30 px, Standfuß `neutral-300`; darüber schwebende Karte („Neue Anfrage · vor 2 Min.“) mit Puls-Punkt, `gtFloat`.
- **Stat-Reihe**: vier Karten (Radius 26 px, `surface`, die vierte Rosé): 7,5 % Kontaktrate · 2 Min. bis fertig · 9 Vorlagen · 4,9 Bewertungsschnitt.
- **„Drei Dinge, die eine Linkliste nicht kann“**: drei Karten mit Icon-Kachel 46 px (Radius 16 px; rot / ink / Rosé), H3 20 px, Body, dazu Chips bzw. Bewertungs-Sterne bzw. Textlink.
- **„So läuft's“**: drei Schritt-Karten mit rotem Nummernkreis 34 px.
- **Vorlagen-Teaser**: vier verlinkte Mini-Previews (Kirsche, Nachtschicht, Beton, Sticker), Hover `translateY(−4px)`.
- **Zwei Zitatkarten** (`800 22px/1.35`) mit Avatar-Platzhalter.
- **Rotes Abschluss-Banner** „Hör auf, Leute wegzuschicken.“ + zwei Buttons.

#### 2. Vorlagen (`Website-Vorlagen.dc.html`)
Zweck: Vorlagen-Bibliothek (das Kernversprechen „ein Look pro Charakter“).
- H1 54 px + Erklärtext, darunter **Filter-Pillen**: Alle 9 · Creator · Musik · Studio & Atelier · Café & Laden · Handwerk · Team · Praxis (aktiv = Ink-Pill).
- **Grid 3×3** mit neun Vorlagenkarten. Jede Karte: farbiger Rahmenbereich (die „Bühne“ der Vorlage) mit einer **echten Miniatur** des Profils darin (Avatar, Name, Rolle, primärer Button, zwei Link-Buttons — im jeweiligen Look), darunter Fußzeile mit Name, Ein-Zeilen-Charakterisierung und „Wählen“-Button. Hover: `translateY(−5px)`.
  Die neun Vorlagen und ihre Merkmale:
  | Name | Charakter | Formensprache |
  | --- | --- | --- |
  | Kirsche | warm, rund, freundlich (Creator) | Rosé-Bühne, runde Pillen, roter Primär |
  | Nachtschicht | dunkel, laut (Musik) | Ink-Bühne, `neutral-900`-Karte, Radius 8, roter Glow-Avatar |
  | Beton | streng, sachlich (Studio) | Grauton, Radius 0, gesperrte Versalien |
  | Sticker | verspielt, schief (Creator) | rote Bühne, rotierte Pillen (±1.5°), Blob-Avatar, „BELIEBT“-Badge |
  | Papier | skizzenhaft, leicht (Atelier) | gestrichelte 2 px Rahmen, Radius 12–16 |
  | Tresen | Chat zuerst (Café & Laden) | Sprechblasen (Radius 18/6), Reservieren-Chips |
  | Werkbank | robust (Handwerk & Team) | drei Avatare, Radius 0, roter Offerten-Button |
  | Sprechstunde | ruhig, Termin zuerst (Praxis) | sehr helle Neutrals, Radius 10 |
  | Riso | Print-Look (Kollektiv) | `accent-700`-Bühne, Linien statt Flächen |
- Zwei Erklärkarten: „Look wechseln, Inhalte behalten“ (Rückgängig bis 24 h) und „Und dann frei anpassen“ (Hintergrund Bild/Farbe/Verlauf/Muster, 5 Knopfformen, 3 Schriftstile, Motion ein/aus).
- Rotes Abschluss-Banner.

#### 3. Karte & NFC (`Website-Karte.dc.html`)
Zweck: NFC, vCard und Social erklären.
- **Hero**: Badge „NFC · vCard · Social“, H1 56 px „Handy dran, Kontakt drin.“; rechts eine **NFC-Karte** 330×206 px, Radius 22 px, rot, `rotate(-4deg)`, Standfuß `accent-700`, Logo + NFC-Icon, Name, Rolle, Handle; dahinter Puls-Kreis (`gtRipple`), davor schwebende Karte „Profil geöffnet · ohne App, ohne Scan“.
- **Drei Wege**: NFC antippen (Karte 19 CHF, Sticker 3er 12 CHF) · vCard speichern (.vcf 4.0, iOS & Android) · Kanäle verbinden (Auto-Sync, DM-Weiche).
- **vCard-Sektion** (Grid, `surface`, Radius 32 px): links Feld-Schalter (Name/Rolle/Firma **an**, Mobil & Mail **an**, Studio-Adresse **an**, Privatnummer **aus**); rechts Handy-Vorschau mit Kontaktzeilen (Telefon, Mail, Adresse) und CTA „Zu Kontakten hinzufügen“ (`gtBounce`), Hinweis auf Update-Benachrichtigung bei Nummernwechsel.
- **Social-Sektion**: links Verbindungsliste (Instagram *verbunden*, YouTube *verbunden*, WhatsApp Business *verbinden*, LinkedIn *verbinden*, gestrichelte Zeile mit weiteren acht Kanälen); rechts oben „Live-Feed auf deinem Profil“ (zwei Post-Kacheln mit Bild-Slot, stündliche Aktualisierung), rechts unten „DM-Weiche“ (Instagram → DM, QR → WhatsApp, Web → Mail).
- **„Karte einrichten: 3 Schritte“** + rotes Abschluss-Banner.

#### 4. Für Teams (`Website-Teams.dc.html`)
Zweck: Whitelabel verkaufen.
- Hero (Grid `minmax(0,1.15fr) minmax(0,1fr)`): H1 „Eure Marke vorne. Wir bleiben unsichtbar.“, zwei Buttons, Meta „Ab 39 CHF / Monat · bis 20 Profile · Rechnung möglich“; rechts Besucher-Vorschau mit Firmenlogo-Zeile, zwei Team-Profilkarten und gestrichelter Zeile „12 weitere Profile“.
- **Sechs Nutzen-Karten**: Eigene Domain · Marke gesperrt · Ein Eingang · CSV-Onboarding · Rollen & Rechte · Zahlen pro Person.
- **Zitat-Sektion** mit Teamfoto-Slot (260 px, Radius 26 px).
- **„Passt für“**: vier Segmente (Studios & Agenturen, Praxen, Handwerk, Vertrieb).
- **Ink-Banner** „20 Minuten Demo, dann wisst ihr's.“ mit rotem Button.

#### 5. Preise (`Website-Preise.dc.html`)
- H1 „Kostenlos anfangen. Zahlen, wenn's dir Arbeit spart.“ + Monatlich/Jährlich-Umschalter (jährlich = 2 Monate gratis).
- **Drei Pläne**:
  - **Frei — 0 CHF**: unbegrenzte Links & Besuche, Nachrichten-Baustein mit 2 Absichten, 3 Vorlagen, Profil-/Titelbild, vCard & QR. Button: Outline.
  - **Pro — 9 CHF/Monat** (hervorgehoben: 2 px roter Rahmen, Standfuß `accent`, Badge „EMPFOHLEN“ oben rechts, `top:-13px`): Terminbuchung mit Kalender, Bewertungen mit privatem Feedback, eigene Domain, alle 9 Vorlagen, Analytics mit Empfehlungen, Kontextregeln. Button: rot, „14 Tage testen“.
  - **Studio · Whitelabel — 39 CHF/Monat** (Ink-Karte, Häkchen in `accent-400`): bis 20 Team-Profile, eigenes Logo, gesperrte Markenwerte, gemeinsamer Eingang & Rollen, CSV-Import, Rechnung.
- **Vergleichstabelle** „Im Detail“: Grid `1.6fr 1fr 1fr 1fr`, Zeilen mit 2 px `neutral-200` Trennlinie, Häkchen in Rot, „—“ in `ink-40`.
- **Vier FAQ-Karten**: nach den 14 Tagen · Werbung („nie“, Frei-Plan mit kleiner Zeile „gebaut mit getintouch“) · Datenbesitz (CSV-Export, kein Datenverkauf, kein personenbezogenes Tracking) · Import der alten Linkliste.
- Rotes Abschluss-Banner.

#### 6. Marke (`Website-Marke.dc.html`)
Zweck: Markenbaukasten / Styleguide für Entwickler und Kunden.
- **Logo-Idee**: gefüllte Scheibe + offener Ring, die sich berühren („du“ und „die anderen“). Große rote Bühne mit dem Zeichen (86 px Kreise, Ring 16 px Strichstärke, Überlappung −14 px).
- **Lockups**: hell (Icon + Wortmarke, immer klein geschrieben) und invers auf Ink.
- **Animationen**: die vier oben tabellierten Bewegungen als lauffähige Specimens mit Erklärtext.
- **App-Icon & Favicons**: 1024 (Store), 180 (iOS), 32 (Tab), 16 (Lesezeichen), Ink-Variante; Regeln: ab 32 px keine Wortmarke, bei 16 px Ring 1 px dicker, keine Ränder/Schatten in der Datei (iOS rundet selbst). Dazu ein Browser-Tab-Mock und ein Homescreen-Mock.
- **Icon-Set**: Lucide, 2 px Strich, drei Größen (14 px in Pillen, 18 px in Listen, 22 px in Kartenköpfen), gefüllt nur der Stern. Verwendete Namen: `message-circle-heart, calendar-heart, contact-round, qr-code, star, shield-check, images, link, palette, grid-2x2, users-round, inbox, bar-chart-3, wand-sparkles, globe, lock, nfc, smartphone-nfc, share-2, rss, git-branch, send, download, arrow-right, arrow-up-right, arrow-up-to-line, check, circle-check, x, eye, eye-off, grip-vertical, sliders-horizontal, timer, moon, camera, users-round, message-circle-question, instagram, youtube, linkedin, message-circle, phone, mail, map-pin, plus, quote, sparkles, badge-check, image, file-spreadsheet, stethoscope, hammer, building-2, globe, smartphone, monitor, wifi, battery-full, repeat, paperclip, calendar-plus, calendar-days, user-round, newspaper, shopping-bag, store, rss`.
- **Farben & Schrift** als Swatches/Specimen.
- **Dateien**: Verweis auf `brand/`.

### B. App-Screens (`design/GetInTouch Mockups.dc.html`)
Ein Canvas-Dokument mit mehreren „Runden“; **maßgeblich ist Runde 6** (das runde Design, durchgezogen) sowie Runde 5 (Bilder), 4 (Vorlagen-Bibliothek in der App) und 3 (drei Profil-Richtungen zur Auswahl). Jede Option hat eine sichtbare ID (`6a`, `5b`, …), die auch im Markup als Anker steht.

| ID | Screen | Kerninhalt |
| --- | --- | --- |
| 6a | **Editor** (1000 px) | Drei Spalten `212px / 1fr / 300px`: Bausteine als ziehbare Pillen (Nachricht, Termin, Link, Bild-Karte, Bewertungen, Karte, Feed) + aktive **Kontextregeln**; Mitte: Reihenfolge als weiche Karten mit Grip, Sichtbarkeits-Auge, Drop-Zone (gestrichelt rot); rechts: Inspektor des Bausteins „Nachricht“ (Frage im Kopf, Absichts-Chips mit ×, drei Schalter, Vorschlagskarte). Kopfzeile mit Segmenten Aufbau / Aussehen / Regeln / Bewertungen und „Live setzen“. |
| 6b | **Buchungs-Flow** (3×300 px) | Schritt 1 Absicht (drei Optionen, ausgewählte rot mit Standfuß), Schritt 2 Kalender (4-Spalten-Datumsgrid, Slot-Pillen, ausgebuchte ausgegraut), Schritt 3 Bestätigung (roter Check-Kreis mit `gtPop`, Terminkarte, Kalender/Kontakt-Buttons, Hinweis auf die späte Bewertungsanfrage). |
| 6c | **Onboarding** (3×300 px) | Fortschrittsbalken 33/66/100 %; 1 Adresse (Handle-Feld, „frei“-Bestätigung), 2 Bilder & Inhalte (Profilbild + Titelbild-Slot, Quellen Instagram/Kalender/alte Linkliste), 3 Ziel (vier Pillen, ausgewählt „Anfragen & Buchungen“). |
| 6d | **Bewertungen** (560 px) | Kopf mit 4,9 in Rosé-Pill; Verteilung 5–2 Sterne als Balken; **privates Feedback** mit Schwelle „3 Sterne“; Filterpillen (Alle / Unbeantwortet · 2 / Nicht öffentlich); Karten: verifizierte öffentliche Bewertung mit Antwort-/Anzeigen-Aktionen, private 3-Sterne-Kritik mit Antwortfeld und rundem Senden-Knopf. |
| 6e | **Analytics** (560 px) | Zeitraum-Segmente 7T/30T/Alles; drei Kennzahlkarten (1 284 Besuche +18 %, 96 Kontakte +41 %, 7,5 % Kontaktrate); Balkenreihe (letzte zwei Balken rot); **Empfehlungsliste** — jede Zeile Icon + Erklärung + ausführender Button („Verschieben“, „Einschalten“, „Anfragen“). |
| 6f | **Whitelabel** (640 px) | Links: Domain (verifiziert), Logo-Upload, Akzentfarbe (drei Swatches + „+“), „Fürs Team gesperrt“-Chips (Logo, Farben gesperrt; Reihenfolge, Links frei). Rechts: Profilliste (live/wartet), CSV-Zeile, Vorschaukarte mit Firmenlogo. |
| 6g | **Desktop-Profil** (1000 px) | Header mit Name + roter „Schreib mir“; links Portrait-Slot 300 px, H2 38 px, drei Kennzahlkarten (4,9 / ~2 Std. / seit 2014); rechts Rosé-Kontaktbox (Absichts-Pillen, Textfeld, Senden, Termin/Karte), zwei Bild-Link-Karten, zwei Zeilen-Links. |
| 6h | **Landingpage in-App-Variante** (1000 px) | Wie Marketing-Start, kompakt. |
| 5a | **Öffentliches Profil, mobil, mit Bildern** (392 px) | Hintergrundbild-Slot + Abdunkelung (Gradient bis `rgba(32,30,29,.72)`), Karte mit Titelbild-Slot 118 px, überlappender Avatar 70 px (3 px Rand in `bg`), Status-Pill „~2 Std.“, roter Haupt-CTA, zwei Outline-Buttons, zwei Bild-Karten, zwei Glas-Zeilen (`rgba(243,242,242,.16)` + `backdrop-filter: blur(6px)`), Bewertungsblock. |
| 5b | **Aussehen-Panel** (760 px) | Bilder (Profil + Titel), Hintergrund-Modi (Bild / Farbe / Verlauf / Muster) mit sechs Swatches inkl. gestreiftem und gepunktetem Muster, Abdunkeln-Slider (62 %), fünf Knopfformen (Pille, Rund, Kante, Skizze, Weich), drei Schriftstile, drei Motion-Schalter; rechts Live-Vorschau (mobil/desktop). |
| 4a | **Vorlagen-Bibliothek in-App** (1060 px) | Kategorie-Pillen, 3×3 Grid der neun Vorlagen mit „Übernehmen“. |
| 4b | **Look wechseln** (700 px) | Links Vorlagen-Auswahl mit Häkchen-Badge, Vorschlagskarte; rechts Live-Vorschau + „Kirsche übernehmen“, Hinweis „Rückgängig bis 24 Std.“. |
| 3a/3b/3c | **Profil-Richtungen** | Sticker-Sheet (schiefe Aufkleber, Blob-Avatar), Sprechblasen (Chat-Profil mit Tipp-Punkten), Kartendeck (überlappende Karten, fächern beim Hover auf). |

---

## Interactions & Behavior

**Marketing-Site**
- Navigation: statische Seitenwechsel; aktive Seite in Ink/800.
- Handle-Feld: Eingabe prüft Verfügbarkeit live (Debounce ~300 ms) → „frei“ (Icon `circle-check`, `accent-700`) oder Fehlermeldung; Submit führt in die Registrierung mit vorbelegtem Handle.
- Preis-Umschalter Monatlich/Jährlich tauscht Beträge (jährlich = 10× Monatspreis).
- Karten-Hover: `translateY(−3…−5px)`; Buttons: Hover `accent-600`, Active Standfuß-Einsinken.
- Bild-Slots: im Produkt Upload mit Crop; Formate JPG/PNG/WebP, Ziel-Ausgabe Titelbild 1200×420, Avatar quadratisch ≥ 400 px, Hintergrund ≥ 1600 px Breite.

**App**
- **Editor**: Bausteine per Drag & Drop aus der linken Palette in die Reihenfolge; Sortieren per Grip; Klick öffnet den Inspektor rechts; Auge schaltet Sichtbarkeit; „Live setzen“ publiziert. Regeln sind Wenn-Dann-Sätze (Uhrzeit, Herkunftskanal) und dürfen die Reihenfolge zur Laufzeit umstellen.
- **Kontaktflow** (öffentlich): Absicht wählen → Textfeld (max. ~800 Zeichen, optional Anhang) → ein Kanal Pflicht (Mail ODER Telefon) → Senden; Empfängeradresse wird nie angezeigt; Antwortzeit-Anzeige speist sich aus dem Median der letzten 30 Tage.
- **Buchung**: nur echte freie Slots (Kalender-Verbindung), 30-Minuten-Raster, Bestätigung per Mail + optionalem Kalendereintrag (.ics); Bewertungsanfrage automatisch X Tage nach Abschluss, ein Klick, ohne Konto.
- **Bewertungen**: nur nach abgeschlossener Buchung möglich (Token pro Buchung); ≤ 3 Sterne gehen zuerst in den privaten Kanal, öffentlich nur nach Freigabe; Inhaber kann antworten oder melden.
- **vCard**: Download `.vcf` (vCard 4.0) mit den freigeschalteten Feldern; wer gespeichert hat, kann Updates abonnieren (Push oder Mail bei Änderung von Telefon/Adresse).
- **NFC**: Tag enthält eine feste URL; das Ziel (Profil / direkte vCard / einzelner Link) ist serverseitig umstellbar, ohne den Tag neu zu schreiben; Berührungen werden je Tag gezählt (Karte, Sticker, Anhänger).
- **Social**: OAuth pro Kanal; Feed-Abruf stündlich mit Cache; LinkedIn liefert Rolle/Firma; „DM-Weiche“ wählt den Antwortkanal nach Referrer/UTM.
- **Ladezustände**: Skeletons in `surface` mit `gtRise`; Spinner erst ab 400 ms.
- **Fehlerzustände**: Feldfehler in `accent-700` unter dem Feld, 2 px Rahmen in `accent`; Netzwerkfehler als Karte mit Wiederholen-Button, niemals als roter Vollflächen-Banner.
- **Responsive**: Marketing-Grids ab < 900 px einspaltig, H1 auf 38–42 px; App-Screens sind für 390 px (mobil) bzw. ≥ 1000 px (Desktop-Tools) entworfen; Editor unter 900 px als Vollbild-Sheet je Spalte.
- **A11y**: Fokusring `2px solid var(--color-accent)` mit `outline-offset: 2px` (kommt aus dem Design-System), Hit-Targets mobil ≥ 44 px, Rot/Weiß nur für große Schrift und Chrome — Body-Text in Rot nur als `accent-700`.

## State Management
Öffentliches Profil (serverseitig gerendert, minimaler Client-State): `profile`, `intents[]`, `selectedIntent`, `messageDraft`, `attachments[]`, `contactChannel`, `submitState (idle|sending|sent|error)`, `availableSlots[]`, `selectedSlot`, `reviewSummary`.
Editor: `blocks[]` (Typ, Sichtbarkeit, Props), `selectedBlockId`, `dragState`, `rules[]`, `theme` (`templateId`, `background{type,value,dim}`, `buttonShape`, `fontStyle`, `motion{cards,pulse,ticker}`), `publishState`, `undoStack` (Look-Wechsel 24 h rückgängig).
Whitelabel: `brand{domain,logo,accent,lockedFields[]}`, `members[]`, `invites[]`, `inboxAssignments`.
Daten: Profil, Blocks und Theme in einem Dokument pro Handle; Nachrichten/Buchungen/Bewertungen als eigene Collections; Analytics als Events (`view`, `intent_click`, `link_click`, `contact_sent`, `booking_created`, `nfc_tap` mit Tag-ID, `vcf_download`).

## Assets
- `brand/icon-1024.png`, `icon-180.png`, `icon-32.png`, `icon-16.png` — App-Icon/Favicons, rote Fläche mit Scheibe + Ring, **in diesem Projekt generiert**, frei verwendbar. `icon-ink-1024.png` = dunkle Variante. Ein echtes SVG des Zeichens fehlt noch und sollte aus der Geometrie neu gezeichnet werden: Quadrat, zwei Kreise mit r = 20,5 % der Kantenlänge, Mittelpunkte bei x = 38,5 % und 64,5 %, y = 50 %; linker Kreis gefüllt, rechter als Ring mit 8,5 % Strichstärke.
- **Fotos: keine.** Alle Bildflächen sind Platzhalter — Kunde muss Material liefern (Portrait, Titelbild, Produktbild „Handy in der Hand“, Teamfoto, zwei Social-Posts).
- **Icons**: Lucide (ISC-Lizenz), im Prototyp per CDN, im Produkt als Paket.
- **Schrift**: Archivo (Google Fonts, OFL).
- **Design-System**: `design-system/modernist-styles.css` (Tokens + Basiskomponenten) und `modernist-readme.md` (Regeln). Achtung: der Guide beschreibt radius 0 und kantige Buttons — für dieses Produkt gilt die runde Ausprägung, siehe „Fidelity“.

## Files
```
design/Website-Start.dc.html        Marketing: Startseite
design/Website-Vorlagen.dc.html     Marketing: Vorlagen-Bibliothek
design/Website-Karte.dc.html        Marketing: NFC, vCard, Social
design/Website-Teams.dc.html        Marketing: Whitelabel für Teams
design/Website-Preise.dc.html       Marketing: Pläne, Vergleich, FAQ
design/Website-Marke.dc.html        Markenbaukasten (Logo, Motion, Icons, Favicons)
design/GetInTouch Mockups.dc.html   App-Screens (Runde 6 ist maßgeblich)
brand/icon-*.png                    App-Icon und Favicons
design-system/modernist-styles.css  Design-Tokens (var(--color-*), --font-*, …)
design-system/modernist-readme.md   Regeln des Design-Systems
screenshots/                        Bildschirmfotos aller Seiten und App-Screens
  01-01…04-01-website-start.png     Startseite, von oben nach unten
  01-02…03-02-website-vorlagen.png  Vorlagen-Bibliothek
  01-03…03-03-website-karte-nfc.png NFC / vCard / Social
  01-04…03-04-website-teams.png     Whitelabel für Teams
  01-05…03-05-website-preise.png    Pläne, Vergleich, FAQ
  01-06…03-06-website-marke.png     Markenbaukasten
  01-07…07-07-app-screens.png       App-Screens: Editor (6a), Buchung (6b),
                                    Bewertungen (6d), Desktop-Profil (6g),
                                    Profil mit Bildern (5a), Vorlagen (4a),
                                    verspielte Richtungen (3a–3c)
```

Die Bildschirmfotos sind JPEG-Ausschnitte des Viewports (909 px breit) — verbindlich sind die Maße und Werte in diesem README, nicht die Pixel der Screenshots.

## Empfohlene Reihenfolge der Umsetzung
1. Tokens + Grundkomponenten (Button mit Standfuß, Pill/Chip, Karte, Feld, Schalter, Segment).
2. Öffentliches Profil (mobil zuerst) mit Nachricht-Baustein — das ist das Produkt.
3. Editor mit Blocks und Theme, danach Vorlagen-Anwendung.
4. Buchung, dann Bewertungen mit privatem Kanal.
5. NFC/vCard/Social.
6. Whitelabel und Team-Eingang.
7. Marketing-Seiten (statisch, SEO).
