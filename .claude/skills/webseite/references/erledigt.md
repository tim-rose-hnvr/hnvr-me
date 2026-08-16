# Erledigt — und Umwege dorthin

## Wie „erledigt" verrutscht

Es gibt drei Mechanismen, und keiner davon fühlt sich beim Arbeiten wie Schummeln an:

1. **Die Aufgabe schrumpft still.** Aus „Kontaktformular" wird „Kontaktformular gestaltet", weil der Versand einen Endpunkt bräuchte, den es nicht gibt. Niemand hat entschieden, den Umfang zu kürzen — er ist einfach kleiner geworden, während man am Schwierigen vorbeigearbeitet hat.
2. **Der Nachweis fehlt.** „Erledigt" bedeutet dann: es sieht im Code so aus, als müsste es gehen. Das ist eine Meinung, keine Feststellung. Der Unterschied zeigt sich erst beim ersten Klick — meistens beim Kunden.
3. **Die Prüfung wird entschärft.** Der Schwellenwert wandert, der Test wird übersprungen, die Regel wird „für diesen Fall" gelockert. Danach ist alles grün und nichts geheilt.

Gegen alle drei hilft dieselbe Sache: **Umfang und Nachweis werden aufgeschrieben, bevor gearbeitet wird, und maschinell nachgehalten.**

---

## Das Auftragsregister

Jede Anforderung aus Phase 0 bekommt einen Eintrag mit Kennung, Zustand und Nachweis.

```bash
node .claude/skills/webseite/scripts/auftrag.mjs --vorlage > auftrag.md
node .claude/skills/webseite/scripts/auftrag.mjs auftrag.md
```

```markdown
## A1 Startseite mit Preisrechner
- Zustand: erledigt
- Nachweis: pruefung:.pruefung/bericht.json
- Nachweis: screenshot:.pruefung/screenshots/start-desktop.png
- Nachweis: manuell: drei Eingaben durchgerechnet, gegen die Preistabelle geprüft

## A2 Kontaktformular
- Zustand: teilweise
- Offen: Versand fehlt, kein Endpunkt vorhanden
- Nachweis: screenshot:.pruefung/screenshots/kontakt-mobil.png
```

Zustände: `erledigt`, `teilweise`, `offen`, `entfallen`. Das Skript verlangt:

- kein Eintrag ohne Zustand,
- kein `erledigt` ohne Nachweis,
- kein `teilweise` ohne Angabe, was offen ist,
- kein `entfallen` ohne Begründung,
- und es **sieht Nachweise nach**: Prüfberichte müssen null Fehler haben, Dateien und Screenshots müssen existieren und Inhalt haben.

Der wichtigste Unterschied im Bericht ist die Spalte zwischen **Beleg** und **Aussage**. Ein `manuell:`-Nachweis ist zulässig — vieles lässt sich nur von Hand prüfen —, zählt aber ausdrücklich als Behauptung und wird als solche ausgewiesen. Wer am Ende fünf Belege und acht Aussagen hat, weiß, wo die Seite dünn ist.

`--rest-erlaubt` lässt offene Punkte zu, wenn eine Teilabgabe verabredet ist. Sie verschwinden dadurch nicht aus dem Bericht, sie blockieren nur nicht mehr.

**Das Register wird zu Beginn geschrieben, nicht am Ende.** Am Ende geschrieben, enthält es genau die Punkte, an die man sich erinnert — und das sind die erledigten.

---

## Die Umwegleiter

Ein blockierter Weg ist kein Ergebnis. Aber Hartnäckigkeit ohne Regel wird zu Versanden, deshalb hat sie Stufen und ein Ende.

| Stufe | Was | Beispiel |
|---|---|---|
| 0 | Direkter Weg | Browser lädt die Seite und misst |
| 1 | **Gleiche Sache, anderes Werkzeug** | Browser kommt nicht durch den Proxy — Node holt die Antworten und reicht sie durch |
| 2 | **Gleiches Ziel, andere Ebene** | Fremde Seite nicht erreichbar — Analyse an lokalen Seiten belegen und die Grenze benennen |
| 3 | **Ziel zerlegen** | Welcher Teil geht ohne den blockierten Teil? Den bauen, den Rest sichtbar offen lassen |
| 4 | **Teillösung mit benanntem Rest** | nur mit ausdrücklicher Ansage, nie stillschweigend |
| 5 | **Blockade melden** | mit Liste der Versuche und der Frage, die zu entscheiden ist |

**Regeln dazu:**

- **Nach jedem Umweg prüfen, ob das Ziel noch dasselbe ist.** Der häufigste Fehler ist nicht Aufgeben, sondern stilles Schrumpfen. Wer den Umweg nimmt und dabei die Aufgabe kleiner macht, hat sie nicht gelöst, sondern ersetzt.
- **Höchstens drei Umwege für dieselbe Sache**, dann fragen. Der vierte Versuch ist fast nie der, der es löst.
- **Ab Stufe 4 nur mit Bestätigung.** Eine Teillösung ist eine Entscheidung über den Auftrag, und die trifft der Auftraggeber.
- **Zeitgrenze:** Dauert der Umweg länger als die eigentliche Aufgabe, ist er der falsche Umweg. Dann Stufe 5.
- **Jeder Umweg wird protokolliert** — er ist beim nächsten Mal der direkte Weg. Dass Chromium `HTTPS_PROXY` nicht von selbst liest und seine Bypass-Liste keine CIDR-Notation versteht, hat einmal eine Stunde gekostet; jetzt steht es fest im Skript und kostet nie wieder etwas.

---

## Der verbotene Umweg

Genau eine Sorte Umweg ist ausgeschlossen, und sie ist die verlockendste, weil sie sofort grün macht:

- **Die Prüfung entschärfen statt den Fehler beheben.** Schwellenwert senken, Test überspringen, Regel „für diesen Fall" lockern, Warnung stummschalten.
- **Den Nachweis erfinden** oder auf etwas zeigen lassen, das die Sache nicht belegt.
- **Das Ziel im Stillen kleiner machen.**

> **Ein Umweg führt um das Hindernis herum, nicht am Ziel vorbei.**

Der Unterschied ist immer an einer Frage erkennbar: Steht am Ende dasselbe Ergebnis wie beim direkten Weg? Wenn nein, war es kein Umweg, sondern eine Abkürzung — und die gehört in die Fertigmeldung, nicht in den stillen Teil der Arbeit.

---

## Die Fertigmeldung

Zulässig, wenn alle vier Läufe vorliegen:

```bash
node .claude/skills/webseite/scripts/pruefen.mjs ./dist / /…      # Seite heil
node .claude/skills/webseite/scripts/auftrag.mjs auftrag.md        # Umfang vollständig und belegt
# Screenshots angesehen (Read-Werkzeug)                            # Seite gut
# Kritiker beauftragt                                              # Seite eigen
```

Und sie enthält:

1. Die Ausgabe des Auftragsregisters, ungekürzt — mit der Trennung zwischen Beleg und Aussage.
2. Den Prüflauf: `0 Fehler`, plus Antwort auf jede Warnung und jeden Verdacht.
3. Die angesehenen Screenshots, mit einem Satz zu dem, was auffiel.
4. Das Urteil des Kritikers und was daraus folgte.
5. **Die Umwege**: was blockiert war, wie es gelöst wurde, was dabei anders geworden ist als geplant.
6. Was bewusst weggelassen wurde und warum.

Punkt 5 fehlt in fast jeder Fertigmeldung und ist der wertvollste: Dort steht, wo das Ergebnis von der Absicht abweicht — und genau das will der Auftraggeber wissen, bevor er es selbst herausfindet.
