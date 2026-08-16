# Bausteine

Fertiges Markup zu den Klassen in `assets/erlebnis.css`.

---

## Label über einer Überschrift

Roter Strich, dann Kleinschrift in Tinte. Der Strich kommt aus dem `::before` — nicht selbst hinschreiben.

```html
<p class="ey">Eventservice</p>
```

Im Umkehrblock kippt die Textfarbe automatisch mit.

---

## Abschnitts-Kopfzeile

```html
<div class="sec-head">
  <div>
    <p class="ey">Eventservice</p>
    <h2 class="st-2 rv" style="margin-top:12px">Was wir<br>für dich MAchen</h2>
  </div>
  <p class="copy rv d1">Eventmanagement, Technik, Personal – aus einer Hand.</p>
</div>
```

---

## Button

Rechteck, kein Rahmen, kein Radius. Beim Hover wird aus Rot Schwarz.

```html
<a class="btn" href="#kontakt">Jetzt anfragen</a>
```

| Variante | Aussehen | Wofür |
|---|---|---|
| `.btn` | rot, weißer Text | Hauptaktion |
| `.btn.zweit` | weiß, roter Text und Rahmen | zweite Aktion daneben |
| `.btn.ghost` | Umriss | im Umkehrblock oder auf Bildern |

Nie zwei rote Buttons nebeneinander — der zweite bekommt `.zweit`.

---

## Karte

Radius 8, Rahmen 1px, Rahmen wird beim Hover rot.

```html
<article class="karte">
  <h3>Eventservice</h3>
  <p>Corporate Event, Privatfeier, Hochzeit. Planung bis Abbau.</p>
  <span class="mehr">Mehr erfahren</span>
</article>
```

Der Pfeil hinter „Mehr erfahren" kommt aus dem `::after` und ist rot — den Text selbst nicht rot setzen, das reißt den Kontrast (siehe `tokens.md`).

## Raster

Legt Karten nebeneinander und bricht von allein um.

```html
<div class="raster">
  <article class="karte">…</article>
  <article class="karte">…</article>
  <article class="karte">…</article>
</div>
```

---

## Umkehrblock

Ein Abschnitt kippt komplett auf Schwarz. Alle Textklassen darin kippen mit.

```html
<section class="blk block">
  <div class="wrap">
    <p class="ey">Rental</p>
    <h2 class="st-2">Mehr Wert.<br>Mehr Wirkung.<br>Mehr Technik.</h2>
    <a class="btn" href="#">Zur Technikliste</a>
  </div>
</section>
```

Ein bis zwei pro Seite. Drei nehmen dem Block die Wirkung.

---

## Technikliste

Die Aufzählung, die den Event-Auftritt ausmacht. Trennpunkte in Rot, Umbruch von selbst.

```html
<ul class="technik">
  <li>Tontechnik</li><li>Lichttechnik</li><li>Video</li>
  <li>LED &amp; Projektion</li><li>Stage</li><li>Gastronomie</li>
</ul>
```

---

## Zeile mit Ziffer

Für Abläufe, Pakete, Stufen. Die Ziffer ist groß und rot — hier ist Rot als Textfarbe erlaubt, weil sie über 24px liegt.

```html
<div class="zeile">
  <span class="nr">01</span>
  <div>
    <h3>Anfragen</h3>
    <p>Kurz sagen, was ansteht. Datum, Ort, Größenordnung reichen.</p>
  </div>
</div>
```

---

## Formular

Felder sind Linien, keine Kästen. Beim Fokus wird die Unterkante rot.

```html
<form class="form">
  <div>
    <label for="name">Name *</label>
    <input id="name" name="name" type="text" required>
  </div>
  <div>
    <label for="text">Nachricht</label>
    <textarea id="text" name="text"></textarea>
  </div>
  <div><button class="btn" type="submit">Absenden</button></div>
</form>
```

`label` und `id` gehören zusammen — ohne das ist das Feld für Screenreader namenlos.
Im Umkehrblock stellt sich die Linienfarbe von allein um.

---

## Sperrsatz

Für ein einzelnes Wort, meist die letzte Zeile eines Aufrufs.

```html
<h2 class="st-2">Let’s<br>get in<br><span class="gesperrt">Touch</span></h2>
```

---

## Kopf und Fuß

Stehen vollständig in `assets/vorlage.html`.
Die Kopfzeile ist `sticky`, fast deckend weiß und trägt rechts den roten Button. Der Fuß ist ein Umkehrblock und schließt die Seite auf Schwarz.
