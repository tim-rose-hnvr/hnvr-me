# Handwerk — Werte statt Gefühl

Diese Zahlen sind der Unterschied zwischen „sieht nach Bootstrap aus" und „sieht gemacht aus".

## Typografie

**Skala.** Ein Verhältnis wählen und durchhalten. 1.25 (ruhig), 1.333 (redaktionell), 1.5 (laut), 1.618 (dramatisch). Mindestens sechs Stufen, davon zwei unterhalb des Fließtexts.

```css
:root{
  --schrift-basis: 1.1875rem;      /* 19px */
  --v: 1.414;
  --s--2: calc(var(--schrift-basis) / var(--v) / var(--v));  /* ~9.5px  Marginalie */
  --s--1: calc(var(--schrift-basis) / var(--v));             /* ~13px   Label */
  --s-0: var(--schrift-basis);                               /* 19px    Fließtext */
  --s-1: calc(var(--schrift-basis) * var(--v));              /* ~27px   Vorspann */
  --s-2: calc(var(--s-1) * var(--v));                        /* ~38px   h3 */
  --s-3: calc(var(--s-2) * var(--v));                        /* ~53px   h2 */
  --s-4: clamp(3.5rem, 9vw, 7.5rem);                         /* Display */
}
```

**Regeln, die zählen:**

| Was | Wert |
|---|---|
| Display zu Fließtext | mindestens Faktor 3, gern 5–7 |
| Fließtext | 17–20 px; unter 16 px nur für Labels |
| Zeilenhöhe Fließtext | 1.5–1.65 |
| Zeilenhöhe Display | 0.95–1.1 |
| Laufweite ab 48 px | −0.02 bis −0.04 em |
| Laufweite Versal-Labels | +0.08 bis +0.14 em |
| Zeilenlänge | 60–75 Zeichen (`max-width: 65ch`) |
| Absatzabstand | 0.75–1 × Zeilenhöhe, kein Erstzeileneinzug **und** Abstand zugleich |
| Schnitte je Familie | höchstens 3 |

**Deutsche Besonderheiten:** Wörter sind lang. `hyphens: auto` mit `lang="de"` setzen, sonst reißen Überschriften das Layout auf. `text-wrap: balance` für Überschriften, `text-wrap: pretty` für Absätze. Schriften mit echten Umlauten und `ß` prüfen — viele Displayschriften haben schlechte Umlautpunkte in großen Graden.

**Zahlen:** `font-variant-numeric: tabular-nums` in Tabellen und Zählern, sonst zappeln sie.

## Farbe

**Struktur:** ein Grund, eine Tinte, ein Akzent, dazu 4–6 Zwischenstufen aus derselben Familie. Mehr braucht keine Seite; zwei gleichstarke Akzente heben sich auf.

**Nicht reines Schwarz auf reinem Weiß.** Grund leicht getönt (`#faf8f5`, `#0d0e10`), Tinte nie `#000`. Der Kontrast bleibt hoch, die Härte verschwindet.

**In OKLCH arbeiten**, weil dort gleiche Helligkeitswerte auch gleich hell wirken:

```css
:root{
  --grund:  oklch(97% 0.008 85);
  --tinte:  oklch(18% 0.012 60);
  --gedimmt:oklch(45% 0.010 60);
  --akzent: oklch(52% 0.16 35);
  --rand:   oklch(88% 0.006 75);
}
```

**Kontrast:** Fließtext ≥ 4.5:1, Text ab 24 px (oder 19 px fett) ≥ 3:1, Bedienelementränder ≥ 3:1. Das Abnahmeskript misst das; graue Hilfstexte auf grauem Grund sind der häufigste Fund.

**Dunkelfassung** ist keine Invertierung. Sättigung leicht senken, Helligkeitsabstände vergrößern, Schatten durch Ränder ersetzen. Wenn es die Zeit nicht hergibt, lieber bewusst nur eine Fassung bauen und `color-scheme` korrekt setzen als eine halbe Dunkelfassung.

## Raum

Eine Einheit, alles ein Vielfaches: 4 px als Basis, Sprünge 4/8/12/16/24/32/48/64/96/160.

| Was | Desktop | Mobil |
|---|---|---|
| Abschnittsabstand | 8–12 rem | 4–5 rem |
| Überschrift zu Text | 0.5–1 rem | gleich |
| Text zu nächster Überschrift | 3–5 rem | 2–3 rem |
| Außenrand | ≥ 4 rem oder randlos | 1.25–1.5 rem |

**Nähe schlägt Linie.** Zusammengehöriges eng, Getrenntes weit — dann braucht es keine Trennlinien und keine Kästen. Die meisten Karten auf Websites existieren nur, weil die Abstände nicht stimmen.

**Asymmetrie ist erlaubt.** Nicht alles muss in einer zentrierten 1200-px-Spalte liegen. Ein Textblock bei 55 % Breite, links angeschlagen, mit einer Marginalspalte, wirkt gebaut statt generiert.

## Tiefe

Reihenfolge der Mittel: **Größe → Kontrast → Farbe → Rand → Schatten.** Schatten ist das letzte, nicht das erste.

Wenn Schatten, dann eine Sprache mit zwei Ebenen und getönter Farbe:

```css
--schatten-1: 0 1px 2px oklch(20% 0.02 60 / .06), 0 2px 6px oklch(20% 0.02 60 / .05);
--schatten-2: 0 8px 24px oklch(20% 0.02 60 / .10), 0 2px 6px oklch(20% 0.02 60 / .06);
```

Nie `rgba(0,0,0,.25)` als Einzelschatten — das ist der Bootstrap-Klotz.

**Radien:** eine Entscheidung für die ganze Seite. 0 (streng), 2–4 px (technisch), 12–20 px (weich), oder ein Element bewusst rund gegen den Rest. Verschachtelte Radien: außen = innen + Abstand.

## Textur

Korn kostet nichts und nimmt jeder Fläche das Digitale:

```css
body::after{
  content:""; position:fixed; inset:0; pointer-events:none; z-index:9999; opacity:.035;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='r'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23r)'/%3E%3C/svg%3E");
}
```

Weitere billige Mittel: 1-px-Linienraster als `repeating-linear-gradient`, Papierton statt Weiß, `mix-blend-mode: multiply` über einer Fläche, ein einzelner scharfer Versatz statt Schatten.

## Reihenfolge beim Bauen

1. HTML mit echtem Inhalt, semantisch, ohne Klassen.
2. Typo-Skala und Farbtoken setzen.
3. Rhythmus im Fluss (Abstände), noch einspaltig.
4. Erst dann Layout in die Breite.
5. Zuletzt Zustände: Hover, Fokus, aktiv, leer, Fehler, lang.

Punkt 5 wird am häufigsten vergessen und ist der Hauptgrund für „sieht fertig aus, ist es nicht". **Sichtbarer Fokusring ist Pflicht** (`:focus-visible`, 2 px Kontur mit 2 px Abstand). Kein `outline: none` ohne Ersatz.
