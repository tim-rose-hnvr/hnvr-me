# Fremde Seiten und fremdes Wissen

## Die Falle vorweg

„Die besten Seiten analysieren und daraus die beste Struktur ableiten" erzeugt **den Durchschnitt** — also genau die austauschbare Seite, die dieser Skill verhindern soll. Wer aus fünfzig preisgekrönten Seiten das Gemeinsame zieht, bekommt das Gemeinsame.

Brauchbar wird es nur mit der Trennung:

| Ebene | Mitteln | Was man mitnimmt |
|---|---|---|
| **Konvention** — Reihenfolge, Vollständigkeit, Benennung, Bedienmuster | richtig | die Regel selbst |
| **Ausdruck** — Aussehen, Idee, Ton, der Einfall | falsch | nur die **Spannweite**: wie weit man gehen darf |

Deshalb gibt der Vergleichsbericht des Zerlegers keine Mittelwerte aus, sondern die Streuung.

## Werkzeug

```bash
node .claude/skills/webseite/scripts/zerlegen.mjs https://a.example https://b.example https://c.example
```

Misst je Seite: Abschnittsfolge mit gedeuteter Art, Inhalt des ersten Sichtfelds, Navigationspunkte, Typo-Fingerabdruck (Familien, Größenskala, Größenfaktor, Zeichen je Zeile, Zeilenhöhen), Farbflächen und Akzente, Bewegungsumfang, Seitenhöhe — jeweils Desktop und Mobil, mit Screenshots.

Ergebnis: je Seite ein Bericht, dazu `vergleich.md` mit einer Merkmalstabelle, den Abschnittsfolgen nebeneinander und **Konventionskandidaten** (Abschnittsarten, die auf mehreren Seiten an ähnlicher Stelle vorkommen).

**So liest man den Vergleich:**
- Merkmale, bei denen alle Seiten nah beieinander liegen → Konvention, übernehmbar.
- Merkmale mit großer Streuung → Ausdruck. Nicht übernehmen; die Spannweite zeigt nur, wie viel Freiheit die Sache verträgt. Wenn der Größenfaktor zwischen 3 und 9 liegt, ist 2 zu wenig — nicht „5 ist richtig".
- Etwas, das genau eine Seite tut und keine andere → dort sitzt deren Signature Moment. **Nicht kopieren.** Es ist der Beleg, dass so etwas existieren muss, nicht die Vorlage dafür.

**Grenzen:** Die Abschnittsdeutung ist eine Heuristik aus Überschrift, Rastern und Wortzahl. Seiten mit starkem JavaScript oder Bot-Abwehr liefern unvollständige Daten. Hinter einem Proxy, der den Browser aussperrt, holt das Skript die Antworten über Node und reicht sie durch — schlägt auch das fehl, steht die Seite im Bericht als nicht zerlegt.

**Grenze des Erlaubten:** Öffentliche Seiten einmal aufrufen und vermessen ist das, was jeder Browser tut. Kein Massenabruf, keine Anmeldebereiche, kein Umgehen von Sperren, `robots.txt` und Nutzungsbedingungen respektieren. Übernommen werden Reihenfolge, Vollständigkeit, Benennung und Bedienmuster — **nie** Gestaltung, Texte, Bilder oder der besondere Einfall. Das ist nicht nur rechtlich der Unterschied, sondern auch der zwischen Lernen und Abschreiben.

---

## Wissensdatenbanken, die es wirklich gibt

Keine davon ist offline verfügbar; sie werden gelesen und in eigene Regeln übersetzt, nicht zur Laufzeit abgefragt. Angaben zu Zugang und Umfang ändern sich — im Zweifel nachsehen.

### Für Struktur und Bedienung

- **Nielsen Norman Group** (nngroup.com) — Ergebnisse aus Nutzertests seit den Neunzigern zu Navigation, Formularen, Lesbarkeit, Startseiten. Der solideste frei lesbare Bestand. Manches ist alt; die Befunde zu Leseverhalten und Formularen haben besser gehalten als die zu Bildschirmgrößen.
- **Baymard Institute** (baymard.com) — die gründlichste Sammlung zu Kaufprozessen, Warenkorb, Suche, Filtern; sehr große Testbasis. Vieles kostenpflichtig, die Artikel und Statistiken sind frei. Wenn etwas verkauft wird, ist das die erste Adresse.
- **GOV.UK Design System und Service Manual** (design-system.service.gov.uk) — Muster, die an sehr vielen und sehr verschiedenen Menschen geprüft wurden, mit Begründung und Forschungsstand je Muster. Die beste frei zugängliche Mustersammlung überhaupt, auch außerhalb des Behördenkontexts.
- **Laws of UX** (lawsofux.com) — die Heuristiken (Jakob, Fitts, Hick, Miller) kurz und zitierbar. Merkhilfe, kein Beweis.
- **GoodUI** (goodui.org) — Muster mit Testergebnissen aus A/B-Tests statt Meinung. Nützlich, weil es Effektrichtungen benennt; die Datenbasis ist kleiner als die Darstellung suggeriert, also als Hinweis lesen, nicht als Gesetz.

### Für Handwerk und Technik

- **WAI-ARIA Authoring Practices Guide** (w3.org/WAI/ARIA/apg) — wie Dialoge, Menüs, Reiter, Kombinationsfelder tastaturbedienbar gebaut werden. Die Referenz, bevor man ein Bedienelement selbst schreibt.
- **WCAG 2.2** — die Prüfkriterien selbst; das Abnahmeskript deckt einen Teil davon ab, nicht alles.
- **web.dev / Core Web Vitals** (web.dev) — Ladeverhalten, Layoutverschiebung, Interaktionsverzögerung, mit konkreten Schwellenwerten.
- **MDN** (developer.mozilla.org) — Referenz für alles, was der Browser wirklich kann. Bei Unsicherheit über eine Eigenschaft: hier nachsehen statt raten.
- **Refactoring UI** (Wathan/Schoger) — Handwerk in Zahlen. Deckt sich weitgehend mit `handwerk.md`; wer dort mehr Beispiele braucht, findet sie hier.

### Für Ausdruck — mit Vorsicht

Galerien zeigen, was gerade gemacht wird. Sie sind nützlich, um die **Spannweite** zu sehen, und gefährlich, wenn man sie als Vorlage nimmt: eine Seite, die aussieht wie die aktuelle Awwwards-Startseite, ist in achtzehn Monaten datiert und heute schon eine unter vielen.

- **Awwwards**, **FWA** — technisch aufwendige Arbeiten, oft Ausdruck über Brauchbarkeit
- **SiteInspire**, **Land-book**, **Godly**, **Httpster** — breitere Auswahl, ruhigere Arbeiten
- **Mobbin** — Bildschirmsammlung nach Bedienmustern sortiert, stark für Abläufe (Anmeldung, Bezahlung), größtenteils kostenpflichtig
- **Typewolf**, **Fonts In Use** — Schriftpaarungen in echter Anwendung; die schnellste Abkürzung zu einer nicht beliebigen Schriftwahl

Sinnvolle Nutzung: nicht „was sieht gut aus", sondern **„was tut hier jemand, das kaum jemand tut, und warum funktioniert es"**. Diese Frage lässt sich in eine Ausschlussliste übersetzen. „Sieht gut aus" nicht.

---

## Ablauf einer Beweisaufnahme

Wenn für ein Projekt Vorbilder untersucht werden sollen:

1. **Auswahl begründen.** Fünf bis acht Seiten, davon mindestens zwei aus einer **fremden** Branche. Nur Wettbewerber anzusehen führt garantiert zum Branchendurchschnitt — dem Zustand, den der Kunde meist gerade verlassen will.
2. **Zerlegen** mit dem Skript. Zahlen vor Eindruck: erst messen, dann ansehen. Umgekehrt sieht man nur, was man erwartet hat.
3. **Screenshots ansehen** und je Seite einen Satz notieren: Was tut diese Seite, das die anderen nicht tun?
4. **Konventionen herausschreiben** — daraus wird das Gerüst in `struktur.md` für dieses Projekt bestätigt oder ergänzt.
5. **Ausschlussliste bilden** — was alle tun und was dieses Projekt deshalb **nicht** tut. Das ist der wertvollste Teil der Übung und geht direkt in die Designthese (Phase 1).
6. **Eintrag in `gelernt.md`**, wenn dabei eine Regel entstanden ist.

Der Ertrag einer Beweisaufnahme ist nicht „so machen wir es auch". Der Ertrag ist eine kürzere Liste von Möglichkeiten, in der die naheliegendste gestrichen ist.
