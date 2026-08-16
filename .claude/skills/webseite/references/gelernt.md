# Entscheidungsprotokoll

Hier stehen Korrekturen aus echten Projekten — übersetzt in etwas, das beim nächsten Mal wirkt.

Ohne dieses Protokoll wirkt jede Rückmeldung genau einmal und ist danach verloren. Mit ihm wird aus „das ist zu eng" beim dritten Mal eine Zahl, und aus der Zahl irgendwann eine Prüfung, die nie wieder vergisst.

## Ritual

Am Ende jedes Projekts, vor der Fertigmeldung, fünf Minuten:

1. **Was wurde korrigiert?** Jede inhaltliche Rückmeldung des Auftraggebers, jede eigene Nachbesserung nach dem Ansehen der Screenshots.
2. **In eine Zahl oder ein Verbot übersetzen.** „Zu eng" ist keine Regel. „Abschnittsabstand von 5 rem auf 9 rem" ist eine. Wenn sich eine Korrektur nicht übersetzen lässt, ist sie noch nicht verstanden — dann nachfragen, statt zu raten.
3. **Prüfbarkeit klären.** Kann `pruefen.mjs` das messen? Wenn ja, gehört es auf die Liste am Ende dieser Datei. Eine Regel, die ein Skript durchsetzt, verfällt nie; eine Regel in Prosa verfällt, sobald der Kontext lang wird.
4. **Verdichten.** Sobald drei Einträge auf dasselbe Thema zeigen, wird daraus eine Regel in `handwerk.md`, `bewegung.md` oder ein Punkt auf der Verbotsliste in `SKILL.md`. Die Einzeleinträge werden dann auf `verdichtet` gesetzt und bleiben als Beleg stehen.

## Format

```markdown
### JJJJ-MM-TT — <Kurzbeschreibung> (Projekt: <name>)
- Rückmeldung: <wörtlich, so wie sie kam>
- Ursache: <was im Ergebnis tatsächlich falsch war>
- Regel: <Zahl oder Verbot, nachprüfbar formuliert>
- Prüfbar: ja → <Prüfung> | nein → <warum nicht>
- Status: offen | übernommen in <datei> | verdichtet
```

Wörtlich zitieren lohnt sich: die Formulierung des Auftraggebers enthält oft mehr als die eigene Zusammenfassung davon.

---

## Einträge

### 2026-08-16 — Bewegung lief trotz reduzierter Bewegung (Projekt: Gegenprobe Saalwerk)
- Rückmeldung: Prüfskript, `[bewegung] Animation läuft trotz prefers-reduced-motion: schwenken`
- Ursache: Die verbreitete Kurzfassung `animation-duration: .01ms !important` schaltet nichts ab. Eine Animation gilt als **laufend**, solange ihre Verzögerung läuft — bei `animation-delay: 8s` also acht Sekunden lang. Im Browser sieht man davon nichts, im Code steht die richtige Mediaabfrage.
- Regel: Unter `prefers-reduced-motion: reduce` gilt `animation: none !important` **und** `animation-delay: 0s !important`. Verkürzen genügt nicht.
- Prüfbar: ja → wird bereits geprüft, genau so gefunden
- Status: übernommen in bewegung.md

### 2026-08-16 — Prüfskript hat Inhalt verschwinden lassen (Projekt: Gegenprobe Saalwerk)
- Rückmeldung: Der Kritiker meldete „rund 600 px sichtbar leer" als schwersten Mangel — an einer Stelle, an der die Seite in Wirklichkeit drei Karten und drei Kennzahlen zeigt.
- Ursache: `pruefen.mjs` sprang in **einem** Schritt ans Seitenende. Ein `IntersectionObserver` sieht übersprungene Elemente nie, also blieben alle Einblendungen bei `opacity: 0` — und der Screenshot zeigte eine Seite, die es so nie gab. Das Werkzeug hat sich selbst gemessen.
- Regel: Prüfwerkzeuge scrollen schrittweise (0,75 Bildschirmhöhen, 180 ms Pause). Ein Messwerkzeug, das die Messung verändert, ist schlimmer als keines: es erzeugt Befunde, denen man hinterherrepariert.
- Prüfbar: ja → zusätzlich neue Prüfung „Inhalt bleibt nach dem Durchscrollen unsichtbar"
- Status: übernommen in pruefen.mjs

### 2026-08-16 — Einblendung beim Scrollen ist zerbrechlich (Projekt: Gegenprobe Saalwerk)
- Rückmeldung: aus dem Fund oben abgeleitet
- Ursache: Beim Muster „Fade-in beim Scrollen" liegt der Inhalt bei `opacity: 0` und wird erst durch einen Auslöser sichtbar. Greift der Auslöser nicht — kein JavaScript, Sprung direkt auf einen Anker, Druckansicht, Screenshot-Werkzeug, sehr schnelles Scrollen —, bleibt der Inhalt für immer unsichtbar. Er ist im Quelltext vorhanden, also fällt es beim Lesen des Codes niemandem auf.
- Regel: Kein Inhalt darf seine Sichtbarkeit von einem Scroll-Auslöser abhängig machen. Einblendungen bewegen sichtbaren Inhalt, sie erzeugen ihn nicht. Wenn doch, dann mit `@media (scripting: none)`-Rückfall auf `opacity: 1`.
- Prüfbar: ja → neue Prüfung meldet Text, der nach dem Durchscrollen bei `opacity: 0` steht
- Status: übernommen in pruefen.mjs, Verbotsliste in SKILL.md

### 2026-08-16 — Größenkontrast global bestanden, abschnittsweise gescheitert (Projekt: Gegenprobe Saalwerk)
- Rückmeldung: Kritiker zu POS. 04 — „Der Abschnitt kündigt einen Höhepunkt an und liefert die Zahlen in derselben Größe wie die Überschrift darüber. Der Größenkontrast bricht genau dort zusammen, wo er gebraucht wird."
- Ursache: Die Regel „Display mindestens Faktor 3" stand in `handwerk.md` und wurde für die Seite als Ganzes eingehalten (h1 bei 106 px, Fließtext 19 px). Innerhalb des Kennzahlenabschnitts lagen Überschrift und Zahl beide bei etwa 34 px. Das Prüfskript vergleicht nur die **größte** Schrift der Seite mit dem Fließtext und merkt davon nichts — eine bestandene Gesamtprüfung hat einen lokalen Ausfall verdeckt.
- Regel: Der Größenkontrast gilt je Abschnitt, nicht je Seite. Wo eine Zahl der Inhalt ist, ist sie das Größte im Abschnitt — nicht gleich groß wie ihre Überschrift.
- Prüfbar: ja → Prüfung je Abschnitt statt global; steht auf der Liste unten
- Status: offen

### 2026-08-16 — SVG-Beschriftung an der Kontrastprüfung vorbei (Projekt: Referenzbau Saalwerk)
- Rückmeldung: eigener Fund beim Ansehen des Screenshots — die Nummer des aktiven Platzes stand in Grau auf Rostrot, etwa 1.5:1, bei grünem Prüflauf.
- Ursache: Die Kontrastprüfung liest `getComputedStyle(el).color`. SVG-Text trägt seine Farbe in `fill`. Damit ist jede Beschriftung in einer Zeichnung ungeprüft — also ausgerechnet dort, wo dieser Skill den Signature Moment hinlegt.
- Regel: SVG-Text braucht denselben Kontrast wie jeder andere Text. Wo eine Fläche eingefärbt wird, wird die Beschriftung darüber mitgeändert.
- Prüfbar: ja → `fill` mitlesen; steht auf der Liste
- Status: offen (im Referenzbau von Hand behoben)

### 2026-08-16 — Deckkraft im SVG über die falsche Eigenschaft (Projekt: Referenzbau Saalwerk)
- Rückmeldung: Kritiker — „es gibt zwei Kegel, von denen nur einer in der Legende erklärt ist"
- Ursache: `.plan .kegel{opacity:.16}` hat zwei Klassen und schlägt damit `.schwenk{opacity:0}` mit einer. Die Umschaltung hat nie etwas ausgeschaltet; alle drei Kamerakegel standen dauerhaft im Bild, einer davon durch die Keyframes bei voller Deckkraft.
- Regel: Deckkraft einer Fläche über `fill-opacity` setzen, nicht über `opacity`. `opacity` bleibt der Umschaltung vorbehalten — sonst kämpfen Gestaltung und Zustand um dieselbe Eigenschaft, und die Spezifität entscheidet.
- Prüfbar: nein → braucht ein Auge auf dem Bild; genau dafür gibt es den Kritiker
- Status: übernommen im Referenzbau

### 2026-08-16 — Präsentationsattribut verliert gegen CSS-Regel (Projekt: Referenzbau Saalwerk)
- Rückmeldung: Kritiker — „Der Platz mit offenem Mikrofon ist blass … Die Legende zeigt daneben ein volles Rostrot-Quadrat — Legende und Zeichnung sagen also Verschiedenes."
- Ursache: Über der farbigen Fläche lag ein Rahmen-Rechteck mit `fill="none"` **als Attribut**. In SVG haben Präsentationsattribute die niedrigste Priorität — jede CSS-Regel schlägt sie. `.plan .platz{fill:var(--papier)}` hat den Rahmen also papierfarben gefüllt und die rostrote Fläche darunter übermalt. Im Quelltext steht `fill="none"`, im Bild steht Papier.
- Regel: In SVG nichts über Präsentationsattribute steuern, was auch in CSS steht. Entweder alles als Attribut oder alles als Klasse — gemischt gewinnt immer das CSS, und zwar unsichtbar.
- Prüfbar: nein → braucht ein Auge auf dem Bild
- Status: übernommen im Referenzbau

### 2026-08-16 — Mediävalziffern in einer Zeichnung (Projekt: Referenzbau Saalwerk)
- Rückmeldung: Kritiker — „Georgia hat Mediävalziffern: die 0 und die 10 sitzen auf x-Höhe, die 8 hat eine Oberlänge. Bei 86 px stehen die drei Werte deshalb sichtbar nicht auf einer gemeinsamen Höhe, die Zeile wippt. Schlimmer: es ist die einzige Stelle der Seite, an der eine Zahl nicht monospace gesetzt ist."
- Ursache: Zwei Fehler in einem. Erstens setzen klassische Serifenschriften Ziffern mit Ober- und Unterlängen — als Fließtextzahl richtig, als Kennzahl in 80 px eine wippende Zeile. Zweitens war es die einzige Zahl der Seite außerhalb der Monospace-Familie, in der alle anderen Zahlen stehen.
- Regel: Kennzahlen in Displaygröße brauchen Versalziffern (`font-variant-numeric: lining-nums`) oder eine Schrift, die sie von Haus aus hat. Und: Zahlen einer Seite gehören in **eine** Familie — wo Maße, Positionsnummern und Platznummern monospace stehen, stehen Kennzahlen auch monospace.
- Prüfbar: teilweise → gleiche Familie ließe sich vergleichen; Ziffernform nicht
- Status: übernommen im Referenzbau

### 2026-08-16 — Zeichnung auf Mobil nur skaliert (Projekt: Referenzbau Saalwerk)
- Rückmeldung: Kritiker — „das ist kein offener Punkt, das ist der Verlust des einzigen unaustauschbaren Elements auf der Hälfte der Zugriffe."
- Ursache: Der Grundriss lag mit `width:100%` im Textfluss. Bei 390 px schrumpfte er auf einen Streifen, Platznummern auf etwa 6 px. Der Signature Moment war auf Mobil praktisch nicht vorhanden — und der Prüflauf war grün, weil unlesbar klein kein Fehler ist, den ein Skript kennt.
- Regel: Eine Zeichnung, deren Beschriftung unter 11 px fiele, wird nicht skaliert, sondern bekommt einen eigenen Scrollrahmen mit Mindestbreite (`overflow-x:auto`, `max-width:100%` am Rahmen, `min-width:0` am Rasterfeld) und einen sichtbaren Hinweis. Der Signature Moment muss auf Mobil derselbe sein wie auf Desktop.
- Prüfbar: ja → wirksame Schriftgröße von SVG-Text nach Skalierung messen; steht auf der Liste
- Status: übernommen im Referenzbau

### 2026-08-16 — Leere Form ist schädlicher als Weglassen (Projekt: Gegenprobe Saalwerk)
- Rückmeldung: Kritiker zur Fassung ohne Skill — „benutzt die Form eines Kundenlogo-Streifens und liefert Branchenkategorien. Bei einem Käufer, der Referenzen prüft, liest sich das als Verschleierung — schädlicher als kein Streifen."
- Ursache: Der Standardbausatz enthält einen Vertrauensstreifen. Wer ihn übernimmt, ohne echte Kunden zu haben, füllt ihn mit Kategorien („STADTWERKE", „SPARKASSE") oder anonymen Zitaten und erzeugt damit das Gegenteil von Vertrauen.
- Regel: Kein Beleg-Element ohne echten Beleg. Statt anonymer Referenz lieber ein Satz, der die Lücke benennt: „Referenzen auf Anfrage — wir nennen Ihnen zwei Häuser Ihrer Größe."
- Prüfbar: nein → braucht ein Urteil über Inhalt, nicht über Form
- Status: übernommen in struktur.md

---

## Beobachtung aus der Gegenprobe

Die erste Blindbewertung wurde durch einen Werkzeugfehler entwertet: Der Kritiker hat seinen schwersten Vorwurf gegen eine Seite erhoben, die es so nie gab. Das ist keine Anekdote, sondern die Betriebsanleitung für alles Weitere — **jeder Befund gilt nur so weit wie die Messung, die ihn erzeugt hat.** Wenn ein Urteil überrascht, ist die erste Frage nicht „was ist an der Seite falsch", sondern „stimmt, was ich dem Bewerter gezeigt habe".

<!-- Beispiel für die Form — beim ersten echten Eintrag löschen:

### 2026-08-16 — Seite wirkte gedrängt (Projekt: Beispiel)
- Rückmeldung: „sieht billig aus, alles klebt aneinander"
- Ursache: Abschnittsabstand 3 rem am Desktop, Außenrand 1 rem, Textblöcke über volle Breite
- Regel: Abschnittsabstand Desktop ≥ 8 rem, Außenrand ≥ 4 rem, Zeilenlänge ≤ 75 Zeichen
- Prüfbar: ja → Abstände zwischen Abschnitten und Zeilenlänge messen
- Status: übernommen in handwerk.md

-->

---

## Beispielkorpus

Bilder wirken stärker als Regeln. Screenshots gehören nach `references/beispiele/`, jeweils mit **einem Satz Begründung** in der Liste unten — ohne Begründung ist ein Screenshot wertlos, weil unklar bleibt, was daran gemeint ist.

**Gute Beispiele** — was genau daran trägt (Typografie? Rhythmus? Der eine Einfall?):

- `beispiel/saalwerk/` — der Signature Moment trägt, weil er den Satz darüber *zeigt* statt ihn zu wiederholen: „Der Platz trägt die Identität" plus ein Grundriss, in dem die Kamera einem Platz folgt, nicht einer Person. Zweitens die Positionslogik POS. 01–05: sie übernimmt die Ordnungssprache der Unterlagen, die der Käufer selbst schreibt, und macht aus einer Werbeseite ein Dokument.

**Schlechte Beispiele** — die sind die wertvolleren. Sie füllen die Ausschlussliste, und die Ausschlussliste ist der Teil, der den Standardreflex bricht:

- Die Fassung ohne Skill aus der Gegenprobe (Badge-Pille, Verlaufswort, zwei Knöpfe, Logostreifen aus Branchenwörtern, drei Icon-Kacheln, anonymes Zitat, blauer CTA-Block). Urteil des Kritikers: „Entfernt man die Wörter Sitzung, Quorum, Saalbeschallung, bleibt eine Seite, die man für eine Buchhaltungssoftware verwenden kann." Jedes einzelne dieser Elemente steht heute auf der Verbotsliste.

---

## Offene Prüfungen für `pruefen.mjs`

Regeln, die heute nur in Prosa stehen und in eine Messung gehören. Absteigend nach Nutzen.

- [x] **Schrift-Rückfall erkennen** — per Breitenmessung gegen drei generische Ersatzfamilien. `document.fonts.check` reicht nicht: eine nie installierte Familie ohne `@font-face` gilt ihm als verfügbar.
- [x] **Weißraum messen** — Trennabstand zwischen Abschnitten (Lücke plus aneinanderstoßende Innenabstände), Verdacht unter 64 px Median
- [x] **Standardmuster erkennen** — zentrierter Kopfbereich mit zwei Schaltflächen, Dreierkarten mit gleicher Höhe und gleichem Aufbau
- [x] **Tastaturdurchlauf** — 30 Tabstopps, Fokussichtbarkeit gegen einen unfokussierten Klon desselben Elements gemessen, Fokusfallen erkannt
- [x] **Formularfelder** — Felder ohne zugänglichen Namen (`placeholder` zählt nicht)
- [ ] **Wirksame Größe von SVG-Text** — Beschriftung in Zeichnungen nach der Skalierung messen; unter 11 px effektiv ist der Signature Moment auf Mobil verloren, und der Lauf bleibt trotzdem grün
- [ ] **Kontrast von SVG-Text** — die Prüfung liest `color`, SVG-Beschriftungen tragen ihre Farbe aber in `fill`. Im Referenzbau stand die Nummer des aktiven Platzes dadurch unbemerkt in Grau auf Rostrot (etwa 1.5:1), obwohl der Lauf grün war.
- [ ] **Größenkontrast je Abschnitt** statt global — ein starker Kopfbereich verdeckt heute jeden flachen Abschnitt darunter
- [ ] **Visuelle Regression** — Screenshots gegen einen freigegebenen Stand vergleichen
- [ ] **Formularabgabe** — einmal leer und einmal falsch absenden, Fehlerzustände aufnehmen
- [ ] **Dunkelfassung** — zweiter Durchlauf mit `colorScheme: 'dark'`, damit die halbe Dunkelfassung auffällt
- [ ] **Bildgewicht** — Gesamtgröße der Bilder je Seite, damit 4-MB-PNGs nicht durchrutschen

## Bekannte Grenzen der Prüfung

- **Kontrast** wird für Text auf Hintergrundbildern nicht bewertet (im Bericht als „nicht bewertbar" gezählt).
- **Schriftverfügbarkeit** wird auf dem Prüfrechner gemessen. Klassische Systemschriften (Georgia, Arial …) fehlen auf einem nackten Container, sind beim Besucher aber da — sie stehen deshalb auf einer Ausnahmeliste im Skript.
- **Gestaltungsverdacht** ist Heuristik. Er findet „hier hat niemand entschieden", nicht „das ist hässlich". Für das Zweite gibt es den Kritiker, und auch der ersetzt kein Auge.
