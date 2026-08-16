# Fallstricke

Was beim 1:1-Nachbau für hnvr.me digital schiefgegangen ist, wie es gemessen wurde und wie es gelöst ist. Aus der Design-Durchsicht vom 10.08.2026 (`assets/korrekturen.css`, `assets/mobil.css`, `assets/kontakt.js`) und den Nachbauten.

Diese Liste vor jedem größeren Bau einmal durchgehen. Die meisten Punkte sind in `assets/hnvr.css` und `assets/fonts.css` schon behandelt — sie stehen hier, damit niemand sie beim Umbauen wieder herausnimmt.

---

## 1 · Die Schrift war gar nicht geladen

**Befund.** Überschriften standen in Arial statt in der Hausschrift, ohne dass es jemandem auffiel.

**Ursache.** Das Theme schreibt an 574 Stellen `font-family:"ClashDisplay"` — ohne Leerzeichen. Geladen ist die Familie aber als `'Clash Display'` mit Leerzeichen. Die Schreibweise ohne Leerzeichen trifft nichts und fällt still auf die Systemschrift zurück. Die Vorlage hat denselben Fehler an 1145 Stellen.

**Wie man es misst.** Nicht mit `document.fonts.check()` — das meldet auch beim Rückfall `true`. Über die Textbreite. „PASSEND IM WIKI" bei 35px:

| Familie | Breite |
|---|---|
| `'Clash Display'` | 285px |
| `'ClashDisplay'` | 299px |
| `sans-serif` | 299px |

Gleiche Breite wie der blanke Rückfall heißt: es **ist** der Rückfall.

**Gelöst.** Dieselben Dateien ein zweites Mal unter dem falsch geschriebenen Namen anmelden, statt 574 Stellen anzufassen. Steht in `assets/fonts.css` und darf nicht gelöscht werden.

---

## 2 · „Bewegung reduzieren" wurde ignoriert

**Befund.** Mit gesetzter Systemeinstellung blieben **29 Textblöcke** auf `opacity: 0` stehen — darunter „Ideen zünden. Erfolg entfachen." und die ganze Mission-Karte. Wer die Einstellung nutzt, sah Löcher statt Text.

**Ursache.** Die Startzustände kommen nicht aus einer CSS-Klasse, sondern als Inline-Style von GSAP (`opacity:0; transform:translate3d(...)`). Kurze Übergangsdauern helfen dagegen nichts: das Element wird nie sichtbar gesetzt.

**Gelöst.** Nur `!important` in einem Stylesheet schlägt einen Inline-Style. Der Block in `hnvr.css` stellt Deckkraft, `transform`, `translate`, `rotate`, `scale`, `clip-path`, `filter` und `visibility` hart zurück.

**Merke.** Jede eigene Einblendung braucht denselben Rückweg. Eine Regel, die nur `transition-duration` verkürzt, ist keine Lösung — sie macht das Verschwinden nur schneller.

Bewusst **nicht** zurückgestellt wurde damals das Anheften waagerechter Abschnitte. Ohne das Pinnen wären die Abschnitte nicht ruhiger, sondern kaputt. Reduzierte Bewegung heißt nicht „alles abschalten".

---

## 3 · Waagerechter Überlauf ohne Scrollleiste

**Befund.** Bei 390px fehlte auf mehreren Seiten rechts der Zeilenrand — Text war abgeschnitten.

**Ursache.** `.row.pxl-content-wrap` trägt Bootstraps negative Außenränder (−15px links und rechts). Der Elternteil sollte sie ausgleichen, hat aber `padding: 0`. Ergebnis: eine 420px breite Inhaltsspalte in einem 390px-Fenster.

**Warum das tückisch ist.** `scrollWidth` blieb bei 390. Die Seite ließ sich also **nicht** seitlich schieben — der Überstand wurde einfach abgeschnitten. Ein Überlauftest, der nur `scrollWidth > innerWidth` prüft, hätte das durchgewinkt.

**Gelöst.** Negative Ränder unter 768px zurücknehmen; den Abstand liefert danach der Innenabstand der Spalte. Dazu die Deckelung in `hnvr.css`: Bilder, SVG, Video und Rahmen auf `max-width: 100%`, breite Tabellen scrollen in sich selbst.

**Merke.** Beim Prüfen zusätzlich die Breite einzelner Blöcke gegen die Fensterbreite messen, nicht nur `scrollWidth`.

---

## 4 · Das Logo war auf dem Handy größer als auf dem Rechner

**Befund.** Bei 390px Fensterbreite war das Logo **360px** breit — es begann bei x=15 und endete bei 375, genau dort, wo auch der Menüknopf sitzt (345–375). Die Wortmarke lief unter den Knopf, der Kopf fraß 84 von 844px Höhe. Auf dem Rechner war dasselbe Logo 193px breit.

**Gelöst.** `max-width: 150px` unter 768px. Steht in `hnvr.css` bei `.brand img`.

---

## 5 · Menüpunkte unter dem Kontrastminimum

**Befund.** `#777` auf `#111` ergibt bei 14px ein Verhältnis von **4,22:1**. AA verlangt 4,5:1.

**Gelöst.** `#8f8f8f` — 5,9:1. Der Zustand beim Überfahren wurde gleich mitgeschrieben, sonst hätte die neue Regel ihn geschlagen.

**Merke.** Auf dunklem Grund ist `#777` immer zu wenig. Die Farben dieses Systems liegen darüber: `--third-color` (`#c2c2c2`) kommt auf `#030303` auf 11,6:1. Wer eine neue Grauabstufung einführt, rechnet sie vorher aus.

---

## 6 · Das Laufband schnitt Namen hart ab

**Befund.** Am linken Rand stand „BC", am rechten „ASE" — Reste von Namen, die gerade aus dem Bild laufen. Ohne weiche Kante liest sich das wie ein Darstellungsfehler statt wie Bewegung.

**Gelöst.** `mask-image` blendet die äußersten 8 % aus. Steht in `hnvr.css` bei `.marquee`.

Damals bewusst nur auf das Kundenlaufband gelegt — bei den anderen beiden Karussells ist das Anschneiden Teil des Aufbaus. Wer hier ein Band ohne Maske will, nimmt sie gezielt für dieses eine Band zurück.

---

## 7 · Eine absolut gesetzte Nummer landete im Fließtext

**Befund.** In der Leistungs-Ziehharmonika las sich der Absatz als „… Wir arbeiten eng mit**//01** dir zusammen".

**Ursache.** Der Marker steht `position: absolute` mit festen Werten, der Inhaltskasten hat aber kein `position: relative`. Der Marker hängt sich deshalb an einen weit entfernten Vorfahren.

**Gelöst — ohne Zahlenraten.** Inhalt und Marker teilen sich **eine** Rasterzelle (`grid-area: 1 / 1`), der Marker bekommt `justify-self: end; align-self: start`. Damit sitzt er automatisch auf Höhe der Überschrift und hält über alle Breiten, weil das Raster die Innenabstände übernimmt.

**Merke.** `align-self: start` nicht vergessen — sonst wird der Marker als Rasterfeld auf volle Inhaltshöhe gestreckt und liegt unsichtbar über dem Text.

---

## 8 · Das Auswahlfeld war doppelt und leer

**Befund.** Im Kontaktformular standen mehrere kaputte Ersatzkästen; das echte Auswahlfeld war unsichtbar.

**Ursache.** Das Theme baut sein eigenes Widget **nach** dem Skript auf und hat sich im Export mehrfach initialisiert — je Runde ein sichtbarer Kasten. Wer die Kästen per JavaScript entfernt, findet sie danach wieder vor.

**Gelöst.** Per CSS verstecken statt per Skript entfernen — das greift unabhängig davon, wann die Elemente entstehen. Und die Sichtbarkeit für das echte Feld die ganze Kette hinauf zurückholen.

**Merke.** Beim Auswahlfeld auf dunklem Grund gehört `option { color:#111; background:#fff }` dazu: Die aufgeklappte Liste zeichnet das Betriebssystem auf hellem Grund, sonst steht heller Text auf hellem Grund. Steht in `hnvr.css`.

---

## 9 · Der teuerste Fehler: Regeln aus dem Kopf

In der Durchsicht wurde zweimal ein Regelwerk erfunden und danach umgestaltet — „Stufenleiter 50/40/35/25/16/14", „genau zwei Haarlinienfarben", „nie zentriert". Die Gegenmessung an der unveränderten Vorlage hat es widerlegt:

- Die Vorlage benutzt 12, 14, 16, 18, 20, 22, 25, 30, 35, 40, 45, 50, 80, 112,5 und 150 px. Allein 18px kommt 33×, 20px 43×, 22px 38× vor.
- Sie hat nicht zwei Haarlinienfarben, sondern **siebzehn**.
- Sie zentriert an mehreren Stellen.

Übrig blieben am Ende **zwei** Werte, die im gesamten Bestand nicht vorkamen. Alles andere wäre nicht Angleichung gewesen, sondern Geschmack.

**Merke.** Vor jeder „Vereinheitlichung" zählen, was tatsächlich vorkommt:

```bash
grep -oE 'font-size:[^;}]+'      seite.html | sort | uniq -c | sort -rn | head -20
grep -oE 'border-color:[^;}]+'   seite.html | sort | uniq -c | sort -rn | head -20
```

Das gilt auch für dieses Regelwerk hier. Die Leitplanken in `SKILL.md` sind eine **bewusst engere Auswahl** aus dem, was die Seite hergibt — gut für Neues, aber kein Beleg dafür, dass alles andere falsch ist. Was in der Seite steht und hier nicht, ist deshalb noch kein Fehler.

---

## 10 · Orange ist auf Creme keine Textfarbe

**Befund.** Beim Umbau auf `.disp-*` fielen zwei Stellen im Creme-Abschnitt durch: die Schrägstriche des Labels bei 2,40:1 und der große Schriftzug bei 1,15:1 — weiß auf Creme, also praktisch unsichtbar.

**Ursache.** Zwei verschiedene: Die Umschaltliste von `section.cream` nannte eine Klasse, die es nicht mehr gab (`.disp` statt `.disp-1` … `.disp-5`). Und der Akzent wurde ungeprüft aus dem dunklen Abschnitt übernommen.

**Gerechnet.**

| Farbe | auf Creme `#F1EFEB` | auf Schwarz `#030303` |
|---|---|---|
| `#FF7120` | 2,40:1 | 7,50:1 |
| `#DF3E06` | 3,79:1 | 4,74:1 |
| `#0C0C0C` | 17,03:1 | — |

Auf Creme erreicht **kein** Orangeton 4,5:1. Kleinschrift bleibt dort in Tinte; ab 24px genügen 3:1, dann ist `--accent-deep` erlaubt.

**Merke.** Wer eine Textklasse hinzufügt, trägt sie in die Umschaltliste von `section.cream` mit ein. Der Prüflauf findet so etwas in Sekunden — von Hand fällt es erst auf, wenn es gedruckt ist.


---

## Prüfliste vor dem Abliefern

Fünf der Punkte laufen automatisch:

```bash
npm i playwright-core
node assets/pruefen.mjs meine-seite.html
node assets/pruefen.mjs https://hnvr.me/
```

Das Skript prüft Schriftladung (über die Textbreite), `prefers-reduced-motion`, Überlauf bei 1440 und 390 px, Kontrast gegen den tatsächlichen Hintergrund und die Verbindung von Beschriftung und Formularfeld. Rückgabewert 1, wenn etwas durchfällt — taugt also für einen Vorab-Haken vor dem Ausliefern.

Von Hand bleiben:

1. Logo und Kopfzeile auf dem Handy — Überschneidung mit dem Menüknopf?
2. Laufbänder: weiche Kante vorhanden?
3. Auswahlfelder aufklappen: Ist die Liste lesbar (`option`-Farben)?
4. Nummern und Marker in Ziehharmonikas: stehen sie neben dem Text, nicht darin?
