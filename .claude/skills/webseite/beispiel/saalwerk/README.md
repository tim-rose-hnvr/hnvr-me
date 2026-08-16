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
| `kritik.md` | Urteil des Kritikers, was daraufhin behoben wurde und was bewusst offen blieb |

## Selbst nachprüfen

```bash
node ../../scripts/pruefen.mjs . / /impressum /datenschutz --out .pruefung
node ../../scripts/auftrag.mjs auftrag.md --rest-erlaubt
```

`.pruefung/` ist bewusst **nicht** eingecheckt. Ein Nachweis ist nichts, was man ablegt — er ist etwas, das man erzeugt. Wer den Beleg sehen will, lässt die Prüfung laufen; ein eingecheckter Bericht wäre schon am Tag darauf eine Behauptung über einen alten Stand.

## Was offen ist

- **A8 Echte Displayschrift** — in der Bauumgebung war keine lizenzierte Schriftdatei verfügbar. Die Seite läuft auf einem Georgia-Stack. Der Kritiker hält das für leicht wiegend („für Kreistag und Sparkasse liest Georgia institutionell, nicht billig"), die Formsprache trägt die Eigenständigkeit ohnehin über Raster, Positionsnummern und Zeichnung.
- **A9 Formsprache in allen Abschnitten** — POS. 03, 04 und 05 tragen außer der Positionsnummer keine Bemaßung; POS. 01, 04 und 05 würden einen Logotausch unverändert überstehen. Die Seite ist an zwei Stellen eigen und an drei Stellen konventionell.
- **A10 Signature Moment vollständig** — die Überschrift sagt „der Platz trägt die Identität, nicht das Gerät und nicht die Person", aber in der Zeichnung kommen weder Personen noch Geräte vor.

Alle drei stehen im Register als `offen`. Das ist der Punkt: Sie sind sichtbar, statt in einer Fertigmeldung unterzugehen. `kritik.md` hält fest, worauf sie zurückgehen.
