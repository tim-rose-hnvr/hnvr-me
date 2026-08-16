# Bilder ohne Stockmaterial

Stockfotos sind der schnellste Weg zur austauschbaren Seite: dasselbe Lächeln steht schon auf tausend anderen. Die automatische Bildersuche ist zusätzlich ein Rechtsrisiko und eine externe Abhängigkeit.

**Regel:** Fotos kommen vom Auftraggeber oder es gibt keine Fotos. Alles andere wird gebaut.

## Rangfolge

1. **Echtes Material des Kunden** — Fotos, Logo, Pläne, Screenshots, Zahlen. Immer zuerst danach fragen.
2. **Screenshots des echten Produkts.** Bei Software das Beste, was es gibt: die Oberfläche selbst, sauber aufgenommen. Mit Playwright reproduzierbar erzeugen — gleiche Größe, gleicher Zustand, jederzeit erneuerbar.
3. **Gezeichnetes SVG** — Diagramme, Grundrisse, Explosionszeichnungen, Signaturketten, Zustandsketten. Skaliert verlustfrei, ist winzig, theme-fähig und einzigartig, weil es diesen Gegenstand zeigt.
4. **Generative Flächen** — aus einem festen Startwert erzeugtes Muster als Kopfbild, Trennfläche oder Kachelhintergrund.
5. **Typografie als Bild** — eine Überschrift in 180 px ist ein stärkeres Kopfelement als jedes Symbolfoto.
6. **Bildgenerator**, falls im Werkzeugkasten vorhanden (z. B. Firefly-Werkzeuge über MCP). Dann mit einer festen Bildsprache arbeiten: gleiche Perspektive, gleiche Lichtführung, gleicher Farbraum über alle Bilder, anschließend einheitlich behandeln (Duoton, Korn). Ergebnisse sichten, nicht blind einbauen.
7. **Wenn wirklich ein Foto sein muss** und keins existiert: eine Lizenzquelle **mit dem Kunden abstimmen**, nicht selbst auswählen. Dann höchstens ein einziges, groß, hart behandelt — nie eine Galerie aus vier beliebigen Stockbildern.

## SVG-Zeichnungen, die nicht nach Clipart aussehen

- **Ein Strichstärkensystem**: eine Hauptlinie (1.5–2 px), eine Hilfslinie (0.75–1 px), sonst nichts.
- **Farben als `currentColor`** oder CSS-Variablen, damit die Zeichnung Farb- und Dunkelfassung mitmacht.
- **`vector-effect="non-scaling-stroke"`**, sonst werden Linien beim Skalieren fett.
- **Beschriften.** Eine vermaßte, beschriftete Zeichnung wirkt fachlich; eine unbeschriftete wirkt dekorativ.
- **Vom Gegenstand zeichnen, nicht vom Symbol.** Ein konkreter Saal mit 14 Plätzen sagt mehr als ein generisches Personensymbol.
- Als Datei einbinden, wenn statisch; inline nur, wenn Teile animiert oder eingefärbt werden.

## Generative Fläche mit festem Startwert

Reproduzierbar heißt: gleicher Startwert, gleiches Bild — kein Zufall bei jedem Laden, sonst ist es kein Design, sondern Rauschen.

```js
// Mulberry32 — kleiner, deterministischer Generator
const zufall = (startwert) => () => {
  startwert |= 0; startwert = (startwert + 0x6D2B79F5) | 0;
  let t = Math.imul(startwert ^ (startwert >>> 15), 1 | startwert);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const r = zufall(20260816); // Datum, Projektnummer, irgendetwas Festes
```

Damit Linienfelder, Punktraster, Kachelmuster oder Strömungsfelder erzeugen — im Zweifel als SVG bauen und statisch ausliefern, statt bei jedem Aufruf Canvas zu rechnen.

## Bildtechnik, wenn es doch Rasterbilder gibt

- AVIF mit WebP-Rückfall über `<picture>`, JPEG nur als letzte Stufe.
- `width` und `height` setzen (oder `aspect-ratio`), sonst springt das Layout — das Abnahmeskript meldet es als Verschiebung.
- `loading="lazy"` überall außer beim ersten Bild im Sichtfeld; dort `fetchpriority="high"`.
- `alt` beschreibt den Inhalt; rein dekorative Bilder bekommen `alt=""`.
- Einheitliche Behandlung über alle Bilder: gleicher Schnitt, gleiche Tonung. Uneinheitliche Bilder sind der zweitgrößte Grund für einen billigen Gesamteindruck nach zu wenig Weißraum.
- Alles lokal ablegen. Keine Hotlinks auf fremde Server.
