# Bewegung

Was sich auf der Seite bewegt, mit welchen Werten — aus dem Skript-Bündel der Installation gelesen (GSAP, ScrollTrigger, SplitText, Lenis, Swiper, WOW.js).

Der Skill baut das **ohne Bibliotheken** nach: CSS-Übergänge plus IntersectionObserver. Die Werte sind dieselben, die Abhängigkeit fällt weg. Wer die Bibliotheken ohnehin lädt — etwa beim Bauen in der WordPress-Seite selbst — nimmt die Originalwerte unten.

---

## Der Auslöser

```js
gsap.set(target, { perspective: 400 });
const baseTrigger = { trigger: target, start: "top 86%", toggleActions: "play none none none", once: true };
let settings = { duration: 0.8, stagger: 0.05, ease: "power3.out", scrollTrigger: baseTrigger };
```

Drei Dinge daran sind wichtig:

- **`start: "top 86%"`** — die Einblendung beginnt, wenn die Oberkante bei 86 % der Fensterhöhe steht. Als IntersectionObserver: `rootMargin: "0px 0px -14% 0px"`.
- **`once: true`** — jedes Element blendet **einmal** ein. Kein Wiederholen beim Zurückscrollen. Im Skill: `io.unobserve(e.target)` nach dem ersten Treffer.
- **`stagger: 0.05`** — 50 ms Versatz, nicht mehr. Der Skill bildet das mit `.d1 .d2 .d3` ab.

---

## Die Kurven

| GSAP | CSS-Entsprechung | im Skill |
|---|---|---|
| `power3.out` | `cubic-bezier(.215, .61, .355, 1)` | `--ease-out` |
| `power4.out` | `cubic-bezier(.165, .84, .44, 1)` | `--ease-out-stark` |
| `power1.inOut` | `cubic-bezier(.45, 0, .55, 1)` | — |
| `Linear.easeNone` | `linear` | Bildenthüllung |

Die Theme-Kurve für Hover und Zustandswechsel ist eine andere: `cubic-bezier(.645, .045, .355, 1)` — im Skill `--ease`.

---

## Die fünf Textbewegungen

Auf der Seite zerlegt SplitText die Überschrift und bewegt die Teile:

| Variante | Werte der Seite | im Skill |
|---|---|---|
| **Wörter aufsteigend** | `y: 80, opacity: 0, ease: power4.out, duration: 1.2, stagger je Wort, delay: .15` | `.rv` mit `.d1 .d2` |
| **Zeilen aufsteigend** | `yPercent: 100, autoAlpha: 0, stagger: .1` | `.rv-zeile` |
| **Zeichen** | `y: "101%", autoAlpha: 0, stagger: { each: .03, from: "random" }` | — |
| **Wörter aufskaliert** | `opacity: 1, scale: 1, duration: .8, ease: power3.out, stagger: .08` | — |
| **Zeichen versetzt** | `x: i % 2 ? 30 : -30` | — |

Die Zeichen-Varianten sind bewusst nicht nachgebaut: Sie zerlegen den Text in Einzelelemente und machen ihn damit für Screenreader unbrauchbar, wenn man nicht sehr sorgfältig ist. Für Zeilen genügt ein Element je Zeile — das ist `.rv-zeile`.

```html
<h1 class="disp-1 rv">
  <span class="rv-zeile"><span>Digital,</span></span>
  <span class="rv-zeile"><span>das um die</span></span>
  <span class="rv-zeile"><span>Ecke denkt.</span></span>
</h1>
```

---

## Bilder

**Enthüllung** — `clipPath: inset(0% 0% 0%)`, `scale: 1`, `duration: 1`, `ease: Linear.easeNone`. Die Fläche gibt das Bild frei, statt es einzublenden. Im Skill: `.rv-bild`.

**Parallaxe** — `data-pxl-parallax` am Element, Hintergründe über jarallax. Der Skill bildet das nicht nach: Parallaxe kostet auf schwachen Geräten spürbar Bildrate und bringt gestalterisch wenig, wenn der Verlauf ohnehin trägt. Wer sie will, nimmt `background-attachment: fixed` für den einfachen Fall.

**Neigung** — `.pxl-image-tilt` über VanillaTilt, mit `max`, `speed`, `perspective` aus den Theme-Einstellungen.

---

## Zeiger und magnetische Elemente

**Eigener Mauszeiger** — folgt mit `ease: "none", duration: 0.1`, zentriert sich beim Verlassen mit `power1.inOut, 0.5`. Punkt im Akzent, `mix-blend-mode: difference`.

**Magnetisch** — Schaltflächen ziehen zum Zeiger:
`x = (maus.x − breite/2) / breite × −100`, `duration: 0.5`. Beim Verlassen zurück auf `x: 0, y: 0`.

Beides ist Zierde. Auf Zeigergeräten nett, auf dem Handy wirkungslos — und bei `prefers-reduced-motion` gehört es abgeschaltet.

---

## Scrollen

**Lenis** mit `duration: 1.5` glättet das Scrollen der ganzen Seite.

Das ist eine Geschmacksfrage mit Nebenwirkung: Weiches Scrollen entkoppelt die Seite vom Eingabegerät und stört manche Menschen erheblich. Der Skill setzt stattdessen `scroll-behavior: smooth` für Sprungmarken und lässt das normale Scrollen in Ruhe. Wer Lenis will, muss es bei `prefers-reduced-motion` deaktivieren — das passiert **nicht** von allein.

**Angeheftete Abschnitte** — `pin: true` mit `scrub` für die waagerechten Strecken (Vorgehen, Branchen). Zwölf Stellen im Bündel. Der Skill bildet sie als Schiene (`.schiene`) ab: Wischen, Tastatur und Scrollleiste kommen vom Browser, kein Skript nötig.

Bei reduzierter Bewegung wurde das Anheften auf der Seite **bewusst nicht** abgeschaltet — ohne Pinnen wären die Abschnitte nicht ruhiger, sondern kaputt. Das ist die richtige Entscheidung und ein gutes Beispiel: Reduzierte Bewegung heißt nicht „alles aus".

---

## Slider

Swiper trägt alle Karussells. Ein Beispiel aus der Seite:

```js
new Swiper('.snap-slider-images', {
  slidesPerView: 1, spaceBetween: 0,
  wrapperClass: 'snap-slider-images-wrapper', slideClass: 'snap-slide',
  pagination: { el: '.slider-pagination-fraction', type: 'fraction' },
});
```

Der aktive Punkt steht auf `var(--primary-color)`.

Der Skill nimmt `.schiene` — ein Raster mit `scroll-snap-type: x mandatory`. Vorteile: kein Skript, Wischen und Tastaturbedienung funktionieren von selbst, und bei abgeschaltetem JavaScript bleibt der Inhalt erreichbar. Nachteil: keine Endlosschleife und kein automatischer Vorlauf. Wer beides braucht, lädt Swiper.

---

## Die Regel für alles davon

Jede Bewegung braucht einen Rückweg für `prefers-reduced-motion` — und zwar einen, der **auch Inline-Startzustände schlägt**. Auf der Seite blieben sonst 29 Textblöcke unsichtbar. Siehe `fallstricke.md`, Befund 2.

Der Block in `hnvr.css` erledigt das für alles aus diesem Skill. Wer eigene Bewegung ergänzt, prüft mit:

```bash
node assets/pruefen.mjs meine-seite.html
```
