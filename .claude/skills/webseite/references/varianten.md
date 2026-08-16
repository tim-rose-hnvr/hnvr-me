# Varianten — Auswahl statt Ermahnung

## Warum „sei kreativer" nicht wirkt

Ein Modell, das einmal antwortet, liefert seinen wahrscheinlichsten Entwurf. Der wahrscheinlichste Entwurf ist per Definition der durchschnittliche. Eine schärfere Anweisung verschiebt diesen Punkt ein Stück, aber sie ändert nichts daran, dass **ein** Zug gezogen wird — und der Erwartungswert eines Zuges ist der Durchschnitt.

Fünf Züge und der beste davon sind etwas völlig anderes: nicht der Erwartungswert, sondern das Maximum. Genau daher kommt Qualität in jedem Gestaltungsbetrieb — nicht daraus, dass jemand angestrengter gestaltet, sondern daraus, dass mehrere Entwürfe entstehen und die schwachen sterben.

Das ist der Unterschied zwischen Ermahnung und Verfahren. Ermahnung skaliert nicht. Auswahl schon.

Dieser Skill hat in Phase 1 die schwache Fassung davon: drei Richtungen als Text skizzieren. Das ist besser als nichts, aber ein Text ist kein Entwurf — man kann nicht beurteilen, was man nicht sieht. Die starke Fassung baut die Varianten wirklich und bewertet sie blind.

## Wofür Varianten, wofür nicht

| Wofür | Warum |
|---|---|
| Kopfbereich / erstes Sichtfeld | trägt die Entscheidung des Lesers, teuerster Quadratmeter der Seite |
| Signature Moment | genau hier entscheidet sich, ob etwas hängenbleibt |
| Typo- und Farbsystem | wirkt auf jede Seite, lässt sich am Beispiel eines Abschnitts beurteilen |

| Wofür nicht | Warum |
|---|---|
| Abschnittsfolge, Navigation, Formulare | Konvention — hier ist Vielfalt ein Fehler, kein Gewinn (siehe `struktur.md`) |
| die ganze Seite | zu teuer; die Entscheidung fällt oben, der Rest folgt ihr |
| Feinschliff | Varianten von Details sind keine Varianten, sondern Zögern |

## Wie viele

Drei ist das Minimum, das echte Divergenz erzwingt: bei zweien wird die zweite zur Variation der ersten. Fünf bei einem wichtigen Kopfbereich. Über sechs wird das Urteil weich — der Bewerter vergleicht dann Nachbarn statt Entwürfe.

## Die Divergenzregel

**Wenn sich der Unterschied als „dasselbe, aber blauer" beschreiben lässt, ist es keine Variante.**

Jede Variante braucht ihre eigene Einzeilerthese und muss mindestens zwei der folgenden Achsen gegen die anderen verschieben:

- Bildsprache: Typografie allein / Zeichnung / Demonstration / Foto
- Tonfall: sachlich / behauptend / erzählend / trocken-technisch
- Dichte: viel Luft und wenig Text / dicht und informationsreich
- Ausrichtung: zentriert / links angeschlagen / asymmetrisch mit Marginalspalte
- Farbstrategie: heller Grund / dunkler Grund / vollflächige Farbe
- Was zuerst gelesen wird: die Aussage / eine Zahl / ein Bild / ein Name

Praktisch: Die Varianten aus verschiedenen Richtungen des Katalogs in `designthese.md` bauen, nicht aus derselben.

## Wie teuer

Nur das erste Sichtfeld, mit **echtem Inhalt**, echter Schrift, echter Farbe, ohne Bedienlogik. Zwanzig bis dreißig Minuten je Variante. Wer eine Variante schön ausbaut und die anderen als Skizze lässt, hat die Entscheidung schon getroffen und führt sie nur noch vor — der häufigste Selbstbetrug in diesem Verfahren.

Gleiche Bedingungen für alle: gleiche Bildschirmgröße, gleicher Text, gleicher Screenshot-Ausschnitt.

## Blind bewerten

```bash
node .claude/skills/webseite/scripts/blindvergleich.mjs varianten/*.png --titel "Kopfbereich"
```

Das Skript benennt die Entwürfe zu A, B, C um, mischt sie deterministisch und legt die Zuordnung in eine getrennte Datei. **Erst bewerten, dann `schluessel.txt` öffnen.**

Warum das nötig ist: Wer weiß, dass C der eigene dritte Versuch war, bewertet C nicht mehr — er verteidigt ihn. Dasselbe gilt für den Kritiker-Subagenten, der sonst aus Dateinamen und Reihenfolge liest, was er sehen soll. Die Umbenennung ist kein Zierrat, sie ist der Zweck.

Ablauf:
1. `blatt.html` ansehen oder die Einzelbilder mit dem Read-Werkzeug.
2. Den Kritiker beauftragen — mit den Bildern A, B, C, dem Auftrag, aber **ohne** die Thesen. Er soll ranken und begründen, nicht raten, welcher gemeint war.
3. Selbst ranken, bevor der Kritiker gelesen wird.
4. Auflösen. Wo Kritiker und eigenes Urteil auseinandergehen, liegt der interessante Fall — der gehört ins Protokoll.

## Nach der Auswahl

- **Eine Variante gewinnt.** Nicht zwei, nicht eine Mischung aus allen — Mischungen fallen zurück auf den Durchschnitt, also genau dorthin, wo das Verfahren herausführen sollte.
- **Ein Element aus dem Zweitplatzierten darf einziehen.** Genau eines, und nur wenn es die These des Gewinners stützt. Meist ist es der beste Einfall der ganzen Runde, nur im falschen Rahmen.
- **Der Rest wird weggeworfen**, nicht aufgehoben. Aufgehobene Varianten kommen als Kompromissvorschlag zurück.
- **Die Verlierergründe kommen in `gelernt.md`.** Warum B verloren hat, ist wertvollere Kalibrierdatei als warum A gewonnen hat: Ablehnungsgründe sind konkret, Zustimmungsgründe verschwimmen zu „gefällt mir".

Nach etwa zehn solcher Runden steht im Protokoll ein Geschmacksprofil, das kein Regelwerk der Welt vorher hätte aufschreiben können — weil es das des Auftraggebers ist und nicht das allgemeine.
