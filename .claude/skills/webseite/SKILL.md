---
name: webseite
description: Websites und Landingpages bauen, die eigenständig aussehen und nachweislich funktionieren. Erzwingt eine schriftliche Designthese vor der ersten Codezeile, verbietet Stockfotos und Standardpaletten, und lässt „fertig" erst zu, wenn die Abnahmeprüfung (Screenshots, Konsole, Kontrast, Bewegung, Links) grün ist. Verwenden bei: Website, Webseite, Landingpage, Homepage, Portfolio, Onepager, Marketingseite, Relaunch, Redesign, Hero-Sektion, website, landing page, web design, redesign.
---

# Websites bauen

Zwei Fehler machen Websites schlecht, und sie haben nichts miteinander zu tun:

**Mittelmaß** entsteht, weil ohne Zwang die naheliegendste Lösung entsteht: zentrierter Hero, drei Karten, blauer Verlauf, Stockfoto, Fade-in beim Scrollen. Das ist der Durchschnitt aller je gebauten Seiten. Gegenmittel: **vor** dem Code eine Entscheidung treffen und aufschreiben.

**Falsche Fertigmeldung** entsteht, weil der eigene Code plausibel aussieht und nie im Browser stand. Gegenmittel: nicht selbst einschätzen, sondern **messen**.

Deshalb hat dieser Ablauf zwei harte Tore. Beide sind nicht verhandelbar.

---

## Phase 0 — Auftrag

Höchstens fünf Fragen, gebündelt in einer Nachricht. Wenn keine Antwort kommt, mit begründeten Annahmen weiterarbeiten und die Annahmen sichtbar notieren.

Was wirklich gebraucht wird:
1. **Für wen und wogegen?** Wer liest das, und welche Alternative hat diese Person sonst?
2. **Der eine Satz.** Was soll hängenbleiben, wenn alles andere vergessen ist?
3. **Material.** Gibt es echte Texte, Logo, Fotos, Zahlen, Produktscreenshots? Was davon existiert, wird verwendet. Was nicht existiert, wird **nicht** durch Stockmaterial ersetzt (siehe `references/bilder.md`).
4. **Rahmen.** Statisch oder Framework, Domain, Sprachen, Barrierefreiheitsanspruch.
5. **Referenzen und Ausschlüsse.** Zwei Seiten, die gefallen — und die Begründung, was genau daran.

Fehlt echter Text, wird er geschrieben, nicht durch Lorem ipsum ersetzt. Platzhaltertext in einer Abgabe ist ein Fehler, kein Zwischenstand.

---

## Phase 1 — Designthese  ⟨Tor 1: kein Code vorher⟩

Vor der ersten Zeile HTML entsteht ein kurzer Text (10–20 Zeilen), der im Chat gezeigt wird. Er beantwortet vier Punkte. Details und ein Katalog von Richtungen: `references/designthese.md`.

**1. Die These.** Ein Satz über die Gestaltung, nicht über das Produkt.
> „Eine Seite wie ein Werkstattprotokoll: Monospace-Beschriftungen, Millimeterraster, alles beschriftet und vermaßt."

Nicht: „modern, clean, professionell". Diese drei Wörter beschreiben den Durchschnitt und führen genau dorthin.

**2. Der Signature Moment.** Genau **eine** Stelle, die aufwendig ist und im Kopf bleibt — und die mit dem Inhalt zu tun hat, nicht mit Dekoration. Eine Seite über Kameranachführung zeigt die Nachführung, sie beschreibt sie nicht. Alles andere auf der Seite darf ruhig sein; ohne diese eine Stelle gibt es keinen Wow-Effekt, mit zehn solchen Stellen auch nicht.

**3. Die Ausschlussliste.** Drei bis fünf Standardlösungen, die diese Seite ausdrücklich **nicht** verwendet. Das ist der wirksamste Teil der ganzen Übung.

**4. Die Bausteine, konkret als Werte.**
- Schriften: zwei Namen (Display + Text) oder eine Familie in zwei extremen Schnitten, plus Bezugsquelle. Lokal einbinden, nie über ein CDN.
- Farben: Hintergrund, Tinte, ein Akzent, plus Rampe — als OKLCH- oder Hex-Werte.
- Raster: Spaltenzahl, Maximalbreite, Basiseinheit.
- Textur: Korn, Papier, Linien, Rauschen oder bewusst nichts.

Erst wenn diese vier Punkte stehen, beginnt der Code.

---

## Phase 2 — Rohbau in Graustufen

Struktur und echte Inhalte, **ohne Farbe, ohne Bilder, ohne Bewegung**. Nur Schrift, Abstand, Hierarchie.

Grund: Eine Seite, die in Graustufen gut aussieht, wird durch Farbe besser. Eine Seite, die in Graustufen nichts hergibt, wird durch Farbe nur bunt. Wer sofort dekoriert, merkt nie, dass das Skelett langweilig ist.

In dieser Phase entscheiden: Reihenfolge der Abschnitte, Textmengen, Typo-Skala, Seitenrhythmus. Danach einmal ansehen (Screenshot, siehe Phase 5) und ehrlich beurteilen, bevor es weitergeht.

---

## Phase 3 — Handwerk

Farbe, Typografie, Raum, Tiefe — nach Zahlen, nicht nach Gefühl. Die vollständigen Werte stehen in `references/handwerk.md`; das ist die wichtigste Referenz und sollte bei jedem Bauauftrag gelesen werden.

Das Wichtigste in Kurzform:

- **Größenkontrast**: Display mindestens 3× Fließtext. Der häufigste Grund für langweilige Seiten sind lauter mittelgroße Elemente.
- **Fließtext** 17–20 px, Zeilenhöhe 1.5–1.65, Zeilenlänge 60–75 Zeichen.
- **Große Überschriften**: Zeilenhöhe 0.95–1.1, Laufweite −0.02 bis −0.04 em.
- **Weißraum ist das Luxussignal.** Abschnittsabstand am Desktop ab 8 rem. Enge Seiten wirken billig, unabhängig von allem anderen.
- **Nie reines Schwarz auf reinem Weiß.** `#0a0a0a` auf `#fafaf8` oder ein getöntes Paar.
- **Ein Akzent, konsequent.** Zwei Akzentfarben heben sich gegenseitig auf.
- **Eine Schattensprache oder gar keine.** Kontrast und Größe tragen weiter als Schatten.

---

## Phase 4 — Bewegung

Details in `references/bewegung.md`. Grundregeln:

- Bewegung nur, wo sie etwas erklärt: Zustandswechsel, Herkunft, Reihenfolge.
- **Kein Fade-in-beim-Scrollen für alles.** Das ist der Standardreflex und macht Seiten träge, nicht lebendig.
- Nur `transform` und `opacity` animieren. Mikrointeraktion 120–200 ms, Übergang 240–400 ms, der Signature Moment darf länger.
- Kein `ease-in-out` als Standard. Eintritte laufen aus (`cubic-bezier(.2,.8,.2,1)`), Austritte laufen an.
- `prefers-reduced-motion: reduce` schaltet ab — das prüft die Abnahme und es ist ein Fehler, kein Feinschliff.

---

## Phase 5 — Abnahme  ⟨Tor 2: kein „fertig" vorher⟩

```bash
node .claude/skills/webseite/scripts/pruefen.mjs ./dist / /preise /kontakt
# oder gegen einen laufenden Server:
node .claude/skills/webseite/scripts/pruefen.mjs http://localhost:3000
```

Das Skript startet Chromium, lädt jede Seite in drei Viewports, macht Screenshots und prüft: Konsolenfehler, fehlgeschlagene Requests, waagerechten Überlauf, kaputte Bilder, tote interne Links, Textkontrast nach WCAG, Tippziele, Überschriftenstruktur, Layoutverschiebung, Platzhaltertext und Bewegung bei `prefers-reduced-motion`. Zusätzlich meldet es **Gestaltungsverdacht**: zu kleiner Größenkontrast, fehlende Typo-Skala, nur Systemschriften, Akzentfarben aus der Tailwind-Standardpalette.

Exit 0 heißt: keine Fehler. Warnungen und Verdacht müssen beantwortet werden — behoben oder mit einem Satz begründet.

**Danach die Screenshots wirklich ansehen** (Read-Tool auf die PNG-Dateien in `.pruefung/screenshots/`). Das Skript findet Kaputtes, nicht Hässliches. Beim Ansehen prüfen: Stimmt die Hierarchie? Ist irgendetwas gedrängt? Sieht die Mobilfassung aus wie ein zusammengeschobener Desktop? Ist der Signature Moment sichtbar?

Ablauf und Berichtsvorlage: `references/abnahme.md`.

---

## Phase 6 — Nachlernen

Vor der Fertigmeldung, fünf Minuten: jede Korrektur aus diesem Projekt in `references/gelernt.md` eintragen — übersetzt in eine Zahl oder ein Verbot, nicht als Adjektiv. Dort steht auch, wann daraus eine feste Regel wird und was als Nächstes ins Prüfskript gehört.

Ohne diesen Schritt wirkt jede Rückmeldung genau einmal. Mit ihm wird der Skill mit jedem Projekt schärfer, statt bei jedem Projekt wieder beim Durchschnitt anzufangen.

---

## Verbote

Diese Liste bricht die Standardreflexe. Abweichung nur mit ausdrücklicher Ansage und Begründung.

**Bilder**
- Keine Stockfotos, keine automatische Bildersuche, keine Platzhalterdienste (`unsplash.it`, `picsum`, `placehold.co`) in einer Abgabe.
- Keine Emoji als Icons.
- Kein Icon-Set als tragende Gestaltung. Drei Karten mit drei Umriss-Icons sind kein Design.

**Farbe und Schrift**
- Keine Tailwind-Standardakzente (`#3b82f6`, `#6366f1`, `#8b5cf6` …).
- Kein Verlauf von Violett nach Blau. Kein Glassmorphism ohne inhaltlichen Grund.
- Keine reine Systemschrift als Gestaltungsentscheidung.

**Layout**
- Nicht: zentrierter Hero + zwei Buttons + drei Feature-Karten + Testimonial + CTA. Wenn diese Reihenfolge entsteht, ist Phase 1 übersprungen worden.
- Nicht alles auf `max-width: 1200px` zentrieren. Randlos, asymmetrisch, überbreit sind zulässige Antworten.
- Keine gleichförmigen Karten mit gleichem Radius und gleichem Schatten als Antwort auf jeden Inhalt.

**Abhängigkeiten**
- Keine Schriften, Skripte oder Bilder von fremden Servern. Alles lokal. Die Seite muss ohne Internet vollständig darstellbar sein.
- Kein Analytics und kein Tracker ohne ausdrücklichen Auftrag.

**Prozess**
- Kein Lorem ipsum, kein TODO, kein `#` als Link in einer Abgabe.
- Nicht „fertig" ohne grünen Abnahmelauf.

---

## Was „fertig" bedeutet

Die Meldung enthält alle vier Punkte, sonst ist sie keine Fertigmeldung:

1. Die Anforderungen aus Phase 0 einzeln aufgelistet, jede mit **erledigt / teilweise / offen**.
2. Der Abnahmelauf: `0 Fehler`, plus Antwort auf jede Warnung und jeden Verdacht.
3. Die angesehenen Screenshots benannt, mit einem Satz zu dem, was auffiel.
4. Was bewusst weggelassen wurde und warum.

Teilweise fertig heißt teilweise fertig. Eine ehrliche Restliste ist ein besseres Ergebnis als ein grünes Häkchen, das beim ersten Klick zerfällt.

---

## Referenzen

| Datei | Wann lesen |
|---|---|
| `references/designthese.md` | Phase 1 — Richtungskatalog, Signature-Moment-Katalog, Beispielthesen |
| `references/handwerk.md` | Phase 2/3 — Typo-Skala, Farbe, Raster, Tiefe, Textur, als Zahlen |
| `references/bilder.md` | immer wenn ein Bild gebraucht wird — Wege ohne Stockmaterial |
| `references/bewegung.md` | Phase 4 — Zeiten, Kurven, Muster, Signature-Techniken |
| `references/abnahme.md` | Phase 5 — Ablauf, Fehlerdeutung, Berichtsvorlage |
| `references/gelernt.md` | Phase 6 — Entscheidungsprotokoll, Beispielkorpus, offene Prüfungen |
