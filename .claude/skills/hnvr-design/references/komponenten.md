# Bausteine

Fertiges Markup zu den Klassen in `assets/hnvr.css`. Kopieren, Inhalt tauschen, fertig.
Was hier nicht steht, gibt es nicht — bis es jemand hier einträgt.

---

## Label über einer Überschrift

Zwei Schrägstriche im Akzent, dann Kleinschrift in Großbuchstaben. Steht über fast jeder Überschrift.

```html
<p class="ey"><span class="s">//</span> unsere leistungen</p>
```

---

## Button

Pille mit Kreis rechts. Der Pfeil dreht sich beim Hover auf −45°.

```html
<a class="btn" href="#kontakt">
  Erstgespräch
  <span class="ic">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M5 12h14M13 6l6 6-6 6"/>
    </svg>
  </span>
</a>
```

Varianten: `.btn.light` (heller Grund, auf Bildern), `.btn.onink` (auf Creme-Abschnitten).
Auf einem Creme-Abschnitt einen normalen `.btn` zu verwenden ergibt weißen Text auf hellem Grund — der häufigste Fehler.

---

## Abschnitts-Kopfzeile

Links Label und Überschrift, rechts ein erklärender Satz. Bricht auf schmalen Fenstern untereinander.

```html
<div class="sec-head">
  <div>
    <p class="ey"><span class="s">//</span> unsere leistungen</p>
    <h2 class="disp-4 rv" style="margin-top:18px">Was wir<br>für dich machen</h2>
  </div>
  <p class="copy rv d1">Vom Onepager bis zum Onlineshop – strategisch geplant, sauber umgesetzt.</p>
</div>
```

---

## Aussagesatz

Displaygröße, ein Wort im Akzent. Steht allein in einem Abschnitt, ohne Bild daneben.

```html
<p class="philo">Ideen zünden. <em>Erfolg</em> entfachen.</p>
```

---

## Großer Schriftzug

Ein Wort, überbreit gesetzt, mittig. Auf der Seite gibt es dafür **keine** eigene Schrift — es ist derselbe Clash Display, nur im größten Grad.

```html
<div style="display:flex; justify-content:center; overflow:hidden">
  <span class="disp-2">Arbeiten</span>
</div>
```

Das umgebende `overflow:hidden` ist Pflicht, sonst erzeugt der Schriftzug eine waagerechte Scrollleiste.
Einmal pro Seite. Der Aufruf im Fuß zählt mit.

---

## Laufband

Der Track steht **zweimal** im Markup, die zweite Kopie mit `aria-hidden`. Ohne die Kopie reißt die Schleife sichtbar ab.

```html
<div class="marquee" style="--dur:30s">
  <div class="track">
    <span class="it">Branding</span><span class="it">Webdesign</span><span class="it">SEO</span>
  </div>
  <div class="track" aria-hidden="true">
    <span class="it">Branding</span><span class="it">Webdesign</span><span class="it">SEO</span>
  </div>
</div>
```

`.marquee.rev` läuft rückwärts. Zwei gegenläufige Bänder übereinander sind ein bewährtes Bild — drei sind zu viel.

---

## Leistungskarte

Text links, Farbfläche rechts. Ab dem zweiten Element wechselt der Verlauf automatisch (`nth-child`).

```html
<article class="srv-card rv">
  <div class="info">
    <h3>Branding &amp; Text</h3>
    <p>Im Kern von allem steht die Marke.</p>
    <div class="tags">
      <span class="pill">Positionierung</span>
      <span class="pill">Naming</span>
    </div>
  </div>
  <div class="pic"><i class="grain"></i></div>
</article>
```

Statt der Farbfläche ein Foto: `<div class="pic"><img src="…" alt="…" style="width:100%;height:100%;object-fit:cover"><i class="grain"></i></div>`

---

## Stapelkarten

Bleiben beim Scrollen stehen und schieben sich übereinander. Für Werte, Vorteile, Argumente — drei bis fünf Stück.

```html
<div style="position:relative">
  <article class="vcard">
    <div class="illo"></div>
    <div class="body">
      <h3>Partner auf Augenhöhe</h3>
      <p>Mit echtem Zuhören und enger Zusammenarbeit heben wir jedes Projekt auf ein neues Level.</p>
      <ul><li>Ein Ansprechpartner</li><li>Feste Termine</li></ul>
    </div>
  </article>
  <!-- weitere .vcard -->
</div>
```

`top: 110px` passt zur fixierten Kopfzeile. Wird die Kopfzeile höher, muss dieser Wert mit.

---

## Zahlenband

Vier Zellen, durch 1px-Raster getrennt. Die Zahl selbst kommt in `<i>` und wird orange.

```html
<div class="stats">
  <div class="n"><span class="v"><i>2017</i></span><span class="k">seit · in Hannover</span></div>
  <div class="n"><span class="v"><i>120</i>+</span><span class="k">Projekte</span></div>
  <div class="n"><span class="v"><i>1</i></span><span class="k">Ansprechpartner</span></div>
  <div class="n"><span class="v"><i>0</i></span><span class="k">Baukasten</span></div>
</div>
```

---

## Schritt-Karte

Für Ablauf, Prozess, Vorgehen. Die Nummer ist orange, der Abstand darunter groß.

```html
<div class="pstep">
  <p class="sn">Schritt 01</p>
  <h3>Zuhören</h3>
  <p>Wir verstehen erst dein Geschäft, dann reden wir über Gestaltung.</p>
</div>
```

---

## Zeilenliste

Für Referenzen, Auszeichnungen, Leistungsübersichten. Rückt beim Hover nach rechts, ein Pfeil erscheint.
Der Pfeil ist Schmuck und bekommt `aria-hidden="true"` — er steht bis zum Überfahren auf `opacity: 0`.

```html
<div class="row-item">
  <span class="no">01</span>
  <span class="dt">2026 · Hannover</span>
  <span class="ti">Relaunch für einen Maschinenbauer</span>
  <span class="ar" aria-hidden="true">→</span>
</div>
```

---

## Preisblock

Ein Paket, kein Vergleichsraster. Preis groß, Ziffern im Akzent, Haken orange.

```html
<div class="price2">
  <div class="l">
    <h2 class="disp-4">Website-Paket</h2>
    <p class="copy">Alles drin: Planung, Design, Umsetzung, Hosting, Support.</p>
  </div>
  <div class="r">
    <p class="amt">ab <i>2.400</i>&nbsp;€</p>
    <p class="per">einmalig, netto</p>
    <ul>
      <li>Strategie und Struktur</li>
      <li>Individuelles Design</li>
      <li>Technik, Hosting, Wartung</li>
    </ul>
    <a class="btn" href="#kontakt">Anfragen <span class="ic">→</span></a>
  </div>
</div>
```

---

## Stimme

Zitat mit großem Anführungszeichen im Akzent (Clash Display). Drei nebeneinander, auf schmalen Fenstern untereinander.

```html
<div style="display:grid; grid-template-columns:repeat(3,1fr); gap:22px">
  <figure class="tst">
    <span class="qm">“</span>
    <p>Endlich jemand, der zuhört und dann liefert.</p>
    <figcaption class="who">
      <span class="av">MB</span>
      <span><span class="nm">M. Bothe</span><br><span class="rl">Geschäftsführung</span></span>
    </figcaption>
  </figure>
</div>
```

---

## Bühne

Drei Zeilen Großbuchstaben in `.disp-1`, darüber ein Label, darunter Vorspann und Button.
Kein Bild? `--grad-hero` trägt die Fläche. Vollständiges Markup in `assets/vorlage.html`.

```html
<section class="hero">
  <div class="hero-bg"><i class="grain"></i></div>
  <div class="wrap">
    <p class="ey"><span class="s">//</span> Digitalagentur Hannover</p>
    <h1 class="disp-1">Digital,<br>das um die<br>Ecke denkt.</h1>
  </div>
</section>
```

Die Verdunkelung sitzt als `::after` auf `.hero-bg` und ist nicht optional — ohne sie steht der Vorspann unlesbar auf der Flamme. Für ein Foto das `<img>` in `.hero-bg` legen, die Verdunkelung liegt automatisch darüber.

---

## Formular

Die Werte sind an der Seite gemessen: Rand `1px rgba(248,248,248,.15)`, Radius `11px`, Höhe `55px`, Text `#c2c2c2`.

```html
<form class="form" action="#" method="post">
  <div>
    <label for="f-name">Name *</label>
    <input id="f-name" name="name" type="text" autocomplete="name" required>
  </div>
  <div>
    <label for="f-thema">Worum geht es?</label>
    <select id="f-thema" name="thema">
      <option>Website</option><option>Branding</option>
    </select>
  </div>

  <!-- Honigtopf: nicht display:none, sonst erkennen es die Skripte -->
  <div class="hp" aria-hidden="true">
    <label for="f-hp">Bitte leer lassen</label>
    <input id="f-hp" name="website" type="text" tabindex="-1" autocomplete="off">
  </div>

  <div class="ok">
    <label for="f-ok">
      <input id="f-ok" name="ok" type="checkbox" required>
      <span>Ich habe die <a href="#">Datenschutzerklärung</a> gelesen.</span>
    </label>
  </div>

  <div>
    <button class="btn" type="submit">Absenden <span class="ic">→</span></button>
    <p class="status" role="status" aria-live="polite"></p>
  </div>
</form>
```

Drei Dinge, die man leicht vergisst:

- **`label` und `id` gehören zusammen.** Ohne `for`/`id` ist das Feld für Screenreader namenlos.
- **`option` braucht eigene Farben.** Die aufgeklappte Liste zeichnet das Betriebssystem auf hellem Grund — ohne `option { color:#111; background:#fff }` steht heller Text auf hellem Grund. Steht schon in `hnvr.css`.
- **Der Honigtopf darf nicht `display:none` sein.** Das durchschauen die besseren Skripte. `position:absolute; left:-9999px` ist der Weg.

Rückmeldung: `.status` für die Zeile unter dem Knopf, `.status.fehler` für Rot, `.danke` für den grün gerahmten Kasten nach dem Absenden.

Auf Creme-Abschnitten stellt sich die Farbe des Einwilligungstextes von allein um.

---

## Blog, Shop, FAQ, Team

Diese vier stehen mit vollständigem Markup in `seitentypen.md`, weil dort auch der Seitenaufbau drumherum beschrieben ist. Kurz die Klassen:

| Baustein | Klassen | Achtung |
|---|---|---|
| Beitragskachel | `.beitrag` mit `.bild`, `.kopfzeile`, `h2`, `p` | Abstand 79px, Bild 830×453 |
| Blätterung | `.blaettern` mit `.aktuell` | Kreise 52px |
| Produktkachel | `.produkt` mit `.bild`, `.merken`, `.preis` | Bild 767×879 hochkant |
| Ziehharmonika | `.zieh` > `details.zeile` > `summary.frage` + `.antwort` | `details`/`summary`, kein JavaScript |
| Team | `.team` > `.person` | Bilder grau, färben beim Überfahren |
| Icon-Kasten | `.ikon-box` mit `.ikon` | |
| Schiene | `.schiene` mit `.punkte` | ersetzt den Slider, `scroll-snap` |

**Blog und Shop laufen auf der Theme-Typografie** — `h2` ist dort 35px, nicht 80. Keine `.disp-*`-Klassen verwenden.

---

## Sprunglink

Erstes Element im Körper, sichtbar erst beim Tabben. Ohne ihn tabbt sich jede Tastaturbedienung auf jeder Seite zuerst durch die komplette Navigation.

```html
<body>
  <a class="sprung" href="#inhalt">Zum Inhalt springen</a>
  <header class="site">…</header>
  <main id="inhalt">…</main>
```

Der Prüflauf meldet, wenn er fehlt.

---

## Kopf und Fuß

Stehen komplett in `assets/vorlage.html`. Beides unverändert übernehmen —
die Kopfzeile verdichtet sich beim Scrollen (`.scrolled`), der Fuß trägt den großen Schriftzug im Aufruf.

> Achtung: Wenn die Seite bereits einen `.disp-2` im Inhalt hat, ist der Fuß-Schriftzug der zweite.
> Dann entweder den einen im Inhalt streichen oder im Fuß auf `.disp-4` wechseln.
