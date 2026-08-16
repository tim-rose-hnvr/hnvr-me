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

_Noch keine. Der erste Eintrag entsteht beim ersten Projekt._

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

_leer_

**Schlechte Beispiele** — die sind die wertvolleren. Sie füllen die Ausschlussliste, und die Ausschlussliste ist der Teil, der den Standardreflex bricht:

_leer_

---

## Offene Prüfungen für `pruefen.mjs`

Regeln, die heute nur in Prosa stehen und in eine Messung gehören. Absteigend nach Nutzen.

- [x] **Schrift-Rückfall erkennen** — per Breitenmessung gegen drei generische Ersatzfamilien. `document.fonts.check` reicht nicht: eine nie installierte Familie ohne `@font-face` gilt ihm als verfügbar.
- [x] **Weißraum messen** — Trennabstand zwischen Abschnitten (Lücke plus aneinanderstoßende Innenabstände), Verdacht unter 64 px Median
- [x] **Standardmuster erkennen** — zentrierter Kopfbereich mit zwei Schaltflächen, Dreierkarten mit gleicher Höhe und gleichem Aufbau
- [x] **Tastaturdurchlauf** — 30 Tabstopps, Fokussichtbarkeit gegen einen unfokussierten Klon desselben Elements gemessen, Fokusfallen erkannt
- [x] **Formularfelder** — Felder ohne zugänglichen Namen (`placeholder` zählt nicht)
- [ ] **Visuelle Regression** — Screenshots gegen einen freigegebenen Stand vergleichen
- [ ] **Formularabgabe** — einmal leer und einmal falsch absenden, Fehlerzustände aufnehmen
- [ ] **Dunkelfassung** — zweiter Durchlauf mit `colorScheme: 'dark'`, damit die halbe Dunkelfassung auffällt
- [ ] **Bildgewicht** — Gesamtgröße der Bilder je Seite, damit 4-MB-PNGs nicht durchrutschen

## Bekannte Grenzen der Prüfung

- **Kontrast** wird für Text auf Hintergrundbildern nicht bewertet (im Bericht als „nicht bewertbar" gezählt).
- **Schriftverfügbarkeit** wird auf dem Prüfrechner gemessen. Klassische Systemschriften (Georgia, Arial …) fehlen auf einem nackten Container, sind beim Besucher aber da — sie stehen deshalb auf einer Ausnahmeliste im Skript.
- **Gestaltungsverdacht** ist Heuristik. Er findet „hier hat niemand entschieden", nicht „das ist hässlich". Für das Zweite gibt es den Kritiker, und auch der ersetzt kein Auge.
