# Seitentypen

Wie die Seiten der WordPress-Installation aufgebaut sind — abgelesen an hnvr5.wpcomstaging.com. Damit ein neuer Seitentyp so aussieht wie ein vorhandener, statt nur die Farben zu treffen.

---

## Drei Bauweisen, nicht eine

Der Seitenbestand kommt aus drei verschiedenen Quellen. Wer das verwechselt, sucht Einstellungen an der falschen Stelle.

| Bauweise | Welche Seiten | Woher die Gestaltung kommt |
|---|---|---|
| **Elementor** | Startseite, Über uns, Leistungen, Team, FAQ, Karriere, Kontakt, Portfolio-Übersichten | pro Element gesetzt, im Seiten-CSS |
| **Theme-Vorlage** | Blog-Übersicht, Beitrag, Kategorie, Suche | `pxl-*`-Klassen aus dem Theme-CSS |
| **WooCommerce** | Shop, Produkt, Warenkorb, Kasse, Konto, Merkliste | WooCommerce-Auszeichnung, vom Theme überschrieben |

Praktisch heißt das: Die großen Displaygrade (150/120/100/80) gibt es **nur** auf den Elementor-Seiten. Blog und Shop laufen auf der Theme-Grundtypografie (`h1` 50px, `h2` 35px …). Ein Blogbeitrag mit 150px-Überschrift wäre kein „konsequentes Design", sondern ein Fremdkörper.

---

## Das Bauteil-Vokabular

Die Elementor-Seiten bestehen aus 21 wiederkehrenden Bausteinen. Das ist der ganze Bestand — mehr gibt es nicht:

| Baustein | Wofür | im Skill |
|---|---|---|
| `pxl_heading` | Überschrift mit Label und Trennstrich | `.disp-*`, `.ey` |
| `pxl_divider` | waagerechter Strich, oft animiert | `.rule` |
| `pxl_text_editor` | Fließtext | `.copy`, `.lede` |
| `pxl_button`, `pxl_link` | Schaltfläche, Textlink | `.btn` |
| `pxl_image`, `pxl_images_slip` | Bild, versetzte Bildgruppe | `.rv-bild` |
| `pxl_counter` | hochzählende Zahl | `.stats` |
| `pxl_process` | Ablaufschritt | `.pstep` |
| `pxl_history` | Zeitleiste, Werdegang | `.row-item` |
| `pxl_accordion` | Ziehharmonika, FAQ | `.zieh` |
| `pxl_icon_box` (7 Varianten) | Icon plus Text | `.ikon-box` |
| `pxl_team_grid`, `pxl_team_box`, `pxl_team_carousel` | Team | `.team`, `.person` |
| `pxl_post_grid`, `pxl_post_list` | Portfolio- und Beitragslisten | `.beitrag`, `.schiene` |
| `pxl_text_carousel`, `pxl_image_carousel`, `pxl_client_carousel` | Laufbänder und Slider | `.marquee`, `.schiene` |
| `pxl_contact_form` | Formular | `.form` |
| `google_maps` | Karte | — |

Es gibt jeweils mehrere Layout-Varianten (`pxl-icon-box1` … `pxl-icon-box7`, `pxl-team-grid1`, `pxl-team-carousel2` …). Der Skill bildet je Baustein **eine** ab. Wenn eine bestimmte Variante gebraucht wird, gehört sie an der Seite nachgemessen und hier ergänzt — nicht geschätzt.

---

## Startseite

Reihenfolge der Abschnitte, wie sie steht:

1. Bühne — Vollbild, Verlauf oder Bild, drei Zeilen Displaygrad
2. Über uns — Label, Aussagesatz, Fließtext, Bildgruppe
3. Leistungen — Ziehharmonika mit Nummern `//01` bis `//05`
4. Warum wir — vier Icon-Kästen
5. Zahlen — vier hochzählende Werte
6. Vorgehen — waagerecht angehefteter Abschnitt mit Schritten
7. Projekte — Stapelkarten oder Raster
8. Team
9. Preise
10. Stimmen
11. Blog-Anrisse
12. Aufruf im Fuß

Der Wechsel Dunkel → Creme → Dunkel trägt den Rhythmus. Creme kommt ein- bis zweimal vor, nicht öfter.

---

## Blog

**Übersicht** (`/blog/`) — Theme-Vorlage, keine Elementor-Abschnitte.

```html
<article class="beitrag">
  <div class="bild"><a href="…"><img src="…" alt="…"></a></div>
  <div class="kopfzeile">
    <span class="datum">02 Juni /25</span>
    <span>Tim Rose</span>
    <span>Content, Website</span>
    <span>Keine Kommentare</span>
  </div>
  <h2><a href="…">Beyond the Brief: Unlocking Unexpected Creativity</a></h2>
  <p>Anriss, zwei bis drei Sätze …</p>
  <a class="btn" href="…">Weiterlesen <span class="ic">→</span></a>
</article>
```

Gemessene Werte der Seite: Abstand zwischen Beiträgen **79px**, Beitragsbild **830 × 453** (16:8.7).
Die Kopfzeile trägt Datum, Autor, Kategorien, Kommentarzahl — in dieser Reihenfolge, Trennpunkt in Orange.

**Blätterung** — Kreise, 52 × 52px, Rand `rgba(255,255,255,.12)`, Radius 100px, Schrift 15px. Der Weiter-Pfeil ist ein 24er-SVG mit `stroke="currentColor"`.

```html
<nav class="blaettern">
  <span class="aktuell">1</span>
  <a href="…">2</a>
  <a href="…" aria-label="Nächste Seite">→</a>
</nav>
```

**Einzelbeitrag** — zwei Abschnitte: Inhalt (Fließtext, Bilder, Zwischenüberschriften), darunter Autorenkasten mit Bild, Name, Kurztext.

Wichtig: Im Beitrag gilt die **Theme-Typografie**. `h2` ist 35px, nicht 80. Fließtext 16px/1.625.

---

## Shop

WooCommerce, vom Theme überschrieben. Neun Produkte, acht pro Seite.

**Übersicht** — Sortierleiste („Ergebnisse 1–8 von 9 werden angezeigt" plus Auswahlfeld), darunter das Raster.

```html
<div class="shop-leiste">
  <span>Ergebnisse 1 – 8 von 9 werden angezeigt</span>
  <select class="kf-select"><option>Standardsortierung</option>…</select>
</div>

<ul class="produkte">
  <li class="produkt">
    <div class="bild">
      <a href="…"><img src="…" alt="Barnen Dining Chair"></a>
      <button class="merken" aria-label="Auf die Merkliste">♡</button>
    </div>
    <h3><a href="…">Barnen Dining Chair</a></h3>
    <p class="preis">$&nbsp;640.00</p>
    <a class="btn korb" href="…">In den Warenkorb <span class="ic">→</span></a>
  </li>
</ul>
```

Gemessen: Produktbild **767 × 879** (hochkant, 1:1.15), innere Anordnung waagerecht mit `column-gap: 30px`.
Die Preisangabe bekommt `font-variant-numeric: tabular-nums` — sonst springen die Ziffern im Raster.

**Warenkorb leer** ist ein eigener Zustand und sieht auf der Seite so aus: eine Hinweiszeile plus Schaltfläche „Zurück zum Shop". Nicht vergessen — leere Zustände fallen sonst durch alle Entwürfe.

---

## Portfolio

Sechs Varianten im Bestand: Interactive Showcase, Grid Masonry, Full Width, Classic, Carousel, Interactive Links. Alle bauen auf `pxl_post_grid` bzw. `pxl_post_list`.

Gemeinsam: großes Bild, Titel im Displaygrad, Kategorien mit orangem Trennpunkt, Zähler `//01` in der Ecke. Beim Überfahren fährt ein Kreis mit Pfeil auf, der Pfeil dreht auf −45°.

---

## Weitere Seiten

| Seite | Aufbau |
|---|---|
| **Über uns** | 12 Abschnitte: Willkommen, Werte, Zahlen, Zeitleiste ab 2012, Vorgehen, Auszeichnungen |
| **Leistungen** | Ziehharmonika der Leistungen, Bild-Text-Wechsel, Zeitleiste, Aufruf, Kundenlaufband |
| **Team** | Werte, Bild-Text-Wechsel, Team-Raster, Aufruf |
| **FAQ** | zwei Abschnitte: Ziehharmonika, darunter Kasten „Frage nicht dabei?" mit Icon und Schaltfläche |
| **Karriere** | Werte, Bilderlaufband, Leistungen, Ablauf der Bewerbung, offene Stellen |
| **Kontakt** | Karte, Kontaktangaben als Icon-Kästen, Formular |

Ein Muster, das sich durchzieht: **Label, Überschrift, Fließtext, dann der Inhalt.** Und am Ende fast jeder Seite ein Aufruf, gefolgt vom Fuß mit dem großen Schriftzug.

---

## Was fehlt

Ehrlich benannt, damit niemand darauf baut:

- Die einzelnen Layout-Varianten je Baustein (7 Icon-Kästen, 3 Team-Layouts, 6 Portfolio-Layouts) sind nicht einzeln vermessen.
- Kasse, Konto, Merkliste und Produktdetail sind nur als Aufbau bekannt, nicht im Detail.
- Die waagerecht angehefteten Abschnitte (Vorgehen, Branchen) hängen an ScrollTrigger mit `pin` — siehe `bewegung.md`. Der Skill bildet sie als Schiene ab, nicht als Anheftung.
