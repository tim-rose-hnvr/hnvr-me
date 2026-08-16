# Kritik — Referenzbau Saalwerk

Unabhängige Beurteilung durch den Subagenten `webseite-kritiker`, mit frischem Kontext, nur anhand von Screenshots, Designthese und Prüfbericht — ohne den Code.

Dieser Bericht liegt im Repository, der Prüfbericht nicht. Der Unterschied ist Absicht: Ein Prüflauf ist jederzeit reproduzierbar, ein Urteil nicht. Was sich nachrechnen lässt, wird erzeugt; was einmal gefällt wurde, wird aufgeschrieben.

**Urteil: eigenständig.** — „die Desktopfassung hat mit Grundriss, Positionsliste und Schriftfeld mindestens drei Stellen, die nur zu diesem Produkt passen, und hält ihre Ausschlussliste vollständig; sie verliert diesen Vorsprung aber auf Mobil fast vollständig, weil dort ausgerechnet die Zeichnung zum unlesbaren Streifen wird."

## Austauschbarkeitsprobe: bestanden

Nicht austauschbar: der Grundriss; die Verfahrensliste 03.1–03.4 („das kann kein Videokonferenzanbieter abschreiben, ohne zu lügen"); die Fachzahlen (10 ms wegen Kammfiltereffekten, 8 Mikrofone wegen 3 dB je Verdopplung).

Austauschbar: POS. 01, 04 und 05 überstehen einen Logotausch unverändert. Die Seite besteht die Probe **wegen zwei Abschnitten, nicht wegen ihres Aufbaus.**

## Behoben nach dieser Kritik

| Fund | Was getan wurde |
|---|---|
| Grundriss auf Mobil ein unlesbarer Streifen — „der Verlust des einzigen unaustauschbaren Elements auf der Hälfte der Zugriffe" | Eigener Scrollrahmen mit Mindestbreite 660 px, Beschriftung auf 15 Einheiten vergrößert, sichtbarer Hinweis |
| Platz 07 die am schlechtesten lesbare Box der Zeichnung, Legende zeigt volles Rostrot | Ursache gefunden: `fill="none"` als Attribut verliert gegen die CSS-Regel — der Rahmen übermalte die Fläche. Rahmen auf eigene Klasse umgestellt |
| Kennzahlen in Georgia: Mediävalziffern sitzen nicht auf einer Linie, und es war die einzige Zahl der Seite ohne Monospace | Kennzahlen in die Monospace-Familie, gleiche Größe |
| Erklärungstext 15 px gedimmt gegen 86 px Zahl, Sprung 1:5,7 | Erklärung auf 19 px in Tintenfarbe, Zahl auf 74 px zurückgenommen |
| Zwei Beschriftungssprachen in der Kopfzeile, „Aufbau" passt zu keiner Überschrift | Navigation auf Monospace-Versalien und als Positionsliste benannt: `02 PLATZ · 03 VERFAHREN · 05 VORFÜHRUNG` |
| Displayzeile auf Mobil nur 2,8-fach statt 5,5-fach | Fließtext auf Mobil 17 px, Abstand Überschrift → Absatz auf 40 px |
| Linke Maßkette neben der Textachse | Zeichnungsausschnitt so gelegt, dass die Maßkette bündig auf der Textachse beginnt |

## Offen geblieben — bewusst

- **„Alles ist vermaßt und beschriftet" hält die These nicht ein.** POS. 03, 04 und 05 tragen außer der Positionsnummer keine Bemaßung. Der Kritiker hat recht; die Reparatur wäre, die Formsprache auch dort durchzuziehen — das ist Arbeit an der These, nicht am Detail, und gehört in eine nächste Runde.
- **Der Signature Moment zeigt die Leitidee nur halb.** Die Überschrift sagt „der Platz trägt die Identität, nicht das Gerät und nicht die Person"; in der Zeichnung kommen weder Personen noch Geräte vor. Vorschlag des Kritikers: an einen Platz schreiben, was dort hängt (`07 · PRESET 07 · STIMMRECHT JA`). Guter Fund, offen.
- **Schriftfeld oben rechts statt unten rechts.** Nach DIN 6771 gehört es unten rechts, und das Publikum weiß das. Auf einer Webseite füllt es oben rechts allerdings die Stelle, an der sonst Leere stünde. Bewusste Abweichung, kein Versehen.
- **POS. 01, 04 und 05 bleiben Standardgerüst.** Der schärfste Satz der Kritik, und er stimmt: Die Seite ist an zwei Stellen eigen und an drei Stellen konventionell. Für eine erste Fassung vertretbar, als Dauerzustand nicht.
