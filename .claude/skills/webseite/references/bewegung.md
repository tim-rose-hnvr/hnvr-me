# Bewegung

Schlechte Animation ist fast immer dieselbe: alles fährt beim Scrollen von unten ein, 600 ms, `ease-in-out`, mit Verzögerung. Das Ergebnis wirkt langsam, nicht lebendig, und ab dem zweiten Besuch nur noch lästig.

## Grundsätze

1. **Bewegung erklärt oder entfällt.** Zulässige Gründe: Zustandswechsel zeigen, Herkunft eines Elements zeigen, Reihenfolge zeigen, Aufmerksamkeit auf eine Änderung lenken. „Wirkt dynamischer" ist kein Grund.
2. **Ein bewegtes Element pro Blick.** Zwei gleichzeitige Animationen ohne Bezug erzeugen Unruhe.
3. **Nur `transform` und `opacity`.** Alles andere kostet Layout und ruckelt. `will-change` sparsam und nur unmittelbar vor der Bewegung.
4. **Kürzer als gedacht.** Nachmessen: was sich beim zweiten Ansehen zieht, ist zu lang.

## Zeiten

| Was | Dauer |
|---|---|
| Hover, Fokus, Umschalter | 100–160 ms |
| Aufklappen, Tooltip, Menü | 180–260 ms |
| Seiten- oder Abschnittswechsel | 280–420 ms |
| Signature Moment | darf 600–1200 ms, aber nur dort |
| Versatz in Gruppen | 40–70 ms je Element, höchstens 5 Elemente |

Über fünf Elemente hinaus nicht weiter staffeln — die Gruppe als Ganzes bewegen, sonst wartet der Leser.

## Kurven

```css
--aus:   cubic-bezier(.2, .8, .2, 1);    /* Eintritt: schnell los, weich aus */
--an:    cubic-bezier(.5, 0, .9, .3);    /* Austritt: weich los, schnell weg */
--weich: cubic-bezier(.4, 0, .2, 1);     /* Standardwechsel */
--zack:  cubic-bezier(.34, 1.4, .64, 1); /* leichtes Überschwingen, sparsam */
```

`ease-in-out` für alles ist der Grund, warum Seiten „nach Vorlage" aussehen. Eintritte laufen aus, Austritte laufen an — das entspricht Trägheit.

## Muster, die tragen

**Zustandswechsel statt Einblendung.** `@starting-style` und `transition-behavior: allow-discrete` erlauben echte Ein- und Ausblendungen ohne JavaScript:

```css
dialog{ opacity:0; transform:translateY(8px);
  transition: opacity .2s var(--aus), transform .2s var(--aus), overlay .2s allow-discrete, display .2s allow-discrete; }
dialog[open]{ opacity:1; transform:none; }
@starting-style{ dialog[open]{ opacity:0; transform:translateY(8px); } }
```

**Zusammenhang zeigen** mit `view-transition-name` bei Ansichts- oder Seitenwechsel — ein Element bleibt dasselbe, statt zu verschwinden und neu zu erscheinen. Fortschrittliche Verbesserung: fehlt die Unterstützung, wechselt die Seite hart, und das ist in Ordnung.

**Scrollgebundene Bewegung** nur dort, wo der Scrollweg die Erzählung ist (Erklärzeichnung, Zeitachse). Dann an den Fortschritt koppeln (`animation-timeline: view()` oder `IntersectionObserver` mit Fortschrittswert), nicht per Auslöser abfeuern. Und niemals als Standardbehandlung für jeden Abschnitt.

**Klebrige Abschnitte** (`position: sticky`) sind billiger und robuster als Scroll-Entführung. Echtes Scroll-Hijacking macht Seiten unbedienbar — nicht verwenden.

**Trägheit** statt Easing für den Signature Moment: Position pro Frame um einen Bruchteil an das Ziel annähern (`p += (ziel - p) * 0.12`). Fühlt sich sofort anders an als jede CSS-Kurve.

## Pflicht

```css
@media (prefers-reduced-motion: reduce){
  *, *::before, *::after{
    animation: none !important;          /* nicht nur verkürzen — abschalten */
    animation-delay: 0s !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Warum `animation: none` und nicht die verbreitete Kurzfassung mit `animation-duration: .01ms`:** Eine Animation gilt als *laufend*, solange ihre **Verzögerung** läuft. Wer eine Gruppe mit `animation-delay: 4s` staffelt und die Dauer auf `.01ms` setzt, hat vier Sekunden lang eine laufende Animation — und hat damit die Einstellung des Nutzers nicht befolgt, obwohl im CSS die richtige Mediaabfrage steht. Das Abnahmeskript meldet es; im Browser sieht man es nicht. Deshalb: abschalten und die Verzögerung mit zurücksetzen.

Der Signature Moment braucht zusätzlich eine sinnvolle **statische** Fassung — Endzustand zeigen, nicht leere Fläche. Das Abnahmeskript lädt die Seite mit reduzierter Bewegung und meldet jede weiterlaufende Animation als **Fehler**.

Dauerhaft laufende Animationen (Pulsieren, Rotieren, Verlaufsschieben) sind auch ohne diese Einstellung fragwürdig: sie verbrauchen Akku und ziehen Aufmerksamkeit von Inhalten ab. Wenn, dann pausiert per `IntersectionObserver`, sobald außer Sicht.
