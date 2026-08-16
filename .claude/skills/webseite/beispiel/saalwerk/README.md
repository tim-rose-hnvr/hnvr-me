# Referenzbau Saalwerk

Der erste vollständige Durchlauf des Skills an einem echten Auftrag. Er dient drei Zwecken:

1. **Beweis**, dass der Ablauf trägt — und nicht nur beschrieben ist.
2. **Kalibrierung**: alle Schwellenwerte im Prüfskript waren vorher geraten; hier sind sie einmal gegen eine echte Seite gelaufen.
3. **Beispiel mit Begründung**: `these.md` sagt, was gewollt war, `auftrag.md` sagt, was geschuldet war, der Prüflauf sagt, was davon belegt ist.

## Das hier ist keine Vorlage

Kopieren wäre der schnellste Weg zurück in den Durchschnitt. Die Bauzeichnungs-Haltung ist für **dieses** Publikum entstanden — Menschen, die selbst Leistungsverzeichnisse schreiben. Für eine Konditorei wäre sie falsch, und zwar genau so falsch wie ein Farbverlauf hier.

Übernehmbar ist das **Verfahren**: These vor Code, Ausschlussliste, ein Signature Moment mit Bezug zum Gegenstand, Nachweis vor Fertigmeldung. Nicht übernehmbar ist das Ergebnis.

## Dateien

| Datei | Was |
|---|---|
| `these.md` | Designthese aus Phase 1 — These, Signature Moment, Ausschlussliste, Bausteine als Werte |
| `auftrag.md` | Auftragsregister mit Zuständen und Nachweisen |
| `index.html` | die Seite, ohne jede externe Abhängigkeit |
| `impressum.html`, `datenschutz.html` | Platzhalterangaben, vor einer Veröffentlichung juristisch prüfen lassen |

## Selbst nachprüfen

```bash
node ../../scripts/pruefen.mjs . / /impressum /datenschutz --out .pruefung
node ../../scripts/auftrag.mjs auftrag.md --rest-erlaubt
```

`.pruefung/` ist bewusst **nicht** eingecheckt. Ein Nachweis ist nichts, was man ablegt — er ist etwas, das man erzeugt. Wer den Beleg sehen will, lässt die Prüfung laufen; ein eingecheckter Bericht wäre schon am Tag darauf eine Behauptung über einen alten Stand.

## Was offen ist

- **A7 Mobilfassung des Grundrisses** — er skaliert nur, statt eine eigene Fassung zu haben. Bei 390 px nähern sich die Platznummern der Lesbarkeitsgrenze.
- **A8 Echte Displayschrift** — in der Bauumgebung war keine lizenzierte Schriftdatei verfügbar. Die Seite läuft auf einem Georgia-Stack, ihr fehlt damit der stärkste Einzelhebel für Eigenständigkeit.

Beide stehen im Register als `teilweise` und `offen`. Das ist der Punkt: Sie sind sichtbar, statt in einer Fertigmeldung unterzugehen.
