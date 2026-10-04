# Einbaupaket: PDF Studio als App von hnvr.me

PDF Studio erscheint auf www.hnvr.me wie jeder andere Bereich der Konsole —
nach denselben Regeln wie in Figma „Atelier OS“. Dieses Verzeichnis enthält,
was der Code von hnvr.me dafür braucht. Der Code selbst liegt nicht in diesem
Repository; eingebaut wird dort.

**Einstieg: <https://www.hnvr.me/pdf-studio>.** Alle Links auf hnvr.me —
Kachel, Menüpunkt, Schnellaktionen — zeigen dorthin und auf nichts anderes.

## Wie `/pdf-studio` auf hnvr.me entsteht

hnvr.me ist ein Astro-Projekt auf Wix-Headless-Hosting (Site „Digitale
Erlebnisse“, `e8492887-…`). Dessen Code liegt nicht in diesem Repository und
war beim Einrichten auch sonst nicht erreichbar. Das Studio unter `/pdf-studio`
selbst auszuliefern hieße, es in jenen Bau zu legen und jene Site neu zu
veröffentlichen — von hier aus ginge das nur, indem man die ganze Site durch
diesen Bau ersetzt. Deshalb:

**Eine Weiterleitung, kein iframe.** `/pdf-studio` →
`https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com/studio/index.html?von=hnvr`,
angelegt am 4. Oktober 2026 als SEO-Umleitung der Site (Wix SEO Redirects
API, `seo-redirects-service/v1`). Eigenschaften, nachgemessen:

- 301, gilt sofort, ohne die Site zu veröffentlichen; auch für `hnvr.me/…`
  ohne `www` und für `/pdf-studio/`.
- Mitgebrachte Suchparameter bleiben: `/pdf-studio?werkzeug=zusammenfuegen`
  → `…/studio/index.html?werkzeug=zusammenfuegen&von=hnvr`.
- Die Umleitung geht vor eine Seite gleichen Namens. Bekommt hnvr.me einmal
  eine echte Seite `/pdf-studio`, erst die Umleitung löschen (Dashboard →
  SEO → URL-Weiterleitungen, oder `DELETE /redirects/{id}`).
- 301 heißt: Browser merken sich das Ziel. Wer später umzieht, sollte die
  neue Adresse auch am alten Ziel erreichbar halten.

Zieht das Studio auf eine eigene Domain, ändert sich nur das Ziel dieser
Umleitung (und die Rücksprungadressen in `doku/anmeldung-hnvr.md`) — kein Link
auf hnvr.me. `manifest.json` hält beides getrennt: `einstieg` ist die
öffentliche Adresse, `weiterleitung.nach` das Ziel.

Entwürfe: Figma-Datei *hnvr.me*, Seite **„PDF Studio · App von hnvr.me“**
(Bildschirme P1–P5, Komponente *App-Kachel*). Die bestehenden Seiten sind
unverändert; P1 und P3 sind Kopien von *Startseite* und *X5 Menü und
Bereiche*.

| Datei | Wofür |
|---|---|
| `manifest.json` | Die eine Quelle: Name, Text, Einstieg, Bereich, Rechte, Schnellaktionen |
| `bereichssymbol.svg` | Symbol für die Seitenleiste, 18 px, Strich in `currentColor` |
| `kachel.html` | Kachel für `/tools` (dunkel) und „hnvr.me Apps“ (hell) — HTML und CSS, nichts aus dem Netz |
| `pruefe-app.mjs` | Prüft, dass alles zusammenpasst: `node hnvr-app/pruefe-app.mjs` (17 Prüfungen) |

## Einbauen

**Stand 4. Oktober 2026: eingebaut und live** (Code von hnvr.me, Release aus
`bau-apps-rahmen` `636ab60`). Von außen nachgemessen:

- www.hnvr.me/tools zeigt `kachel.html` unverändert (dunkel) neben Drop-it und
  PSD-Studio, mit genau einem Link `/pdf-studio`.
- www.hnvr.me/apps/pdf-studio steht im App-Store (kostenlos, für jede Person
  mit Konto).
- `/pdf-studio` leitet weiter, auch mit `?werkzeug=…` und `?tun=…`.

Laut der Sitzung, die eingebaut hat, außerdem: Menüpunkt „PDF Studio“ in der
Seitenleiste der Konsole (selber Tab), Bereich `pdfstudio` im Rechtekern mit
nur *Ändern*/*Keine*, Schalter je Website unter „Bereiche für Kunden“, die
beiden Schnellaktionen. Für den Weg `pdf-studio` ist im Editor von hnvr.me
keine eigene Seite möglich, damit nichts die Umleitung verdeckt.

**Abweichung von Schritt 5:** In „hnvr.me Apps“ und im App-Store erscheint
PDF Studio als Katalogeintrag im Kartenformat des Stores, nicht als helle
`kachel.html` — ein Format für alle Apps statt einer Sonderkachel.

**Noch nicht geprüft:** Menüpunkt, Schnellaktionen und der Knopf auf
`/apps/pdf-studio` in der angemeldeten Konsole — dafür braucht es eine
Anmeldung.

**1. Konsole — Seitenleiste (P1, P5).** Unter **WEITERE BEREICHE** ein
Menüpunkt „PDF Studio“ mit `bereichssymbol.svg`, sichtbar, wenn der Bereich
für den Kunden an ist und die Rolle die Stufe *Ändern* hat. Er führt auf
`einstieg` (`https://www.hnvr.me/pdf-studio`, oder einfach `/pdf-studio`)
**im selben Tab, im ganzen Fenster** — wie Headless Studio. Die Weiterleitung
setzt `?von=hnvr`: damit zeigt sich das Studio in der Hand der
Konsole (statt im eigenen Atelier-Look) und oben steht „KONSOLE / PDF STUDIO“
mit dem Weg zurück nach `https://www.hnvr.me/konsole`.

Nicht im `<iframe>`: das Studio liegt auf einer anderen Domain. Im Rahmen
wären seine Anmeldekekse Drittanbieter-Kekse — Safari sperrt sie, Firefox
schottet sie ab, und die Anmeldung liefe im Kreis. Ganzes Fenster ist auch
das Muster der Konsole: Headless Studio öffnet genauso.

**2. Konsole — Superadmin „Menü und Bereiche“ (P3).** Eine Zeile „PDF Studio“
mit Schalter je Kunde. Stufen: **Ändern** oder **Keine**. Voreinstellung für
Inhaber, Bearbeitung und Nur lesen: *Ändern*.

Eine Stufe *Lesen* gibt es mit Absicht nicht. Das Studio hat keinen
Nur-Lese-Modus, und die Dateien liegen ohnehin beim Nutzer — „Lesen“ wäre ein
Versprechen, das niemand durchsetzt. `pruefe-app.mjs` schlägt an, wenn sie
jemand ins Manifest schreibt.

**3. Konsole — Startseite (P1).** Unter **SCHNELL ANLEGEN** die
`schnellaktionen`: ihr `ziel` ergänzt die Suchparameter des Einstiegs
(`new URL(einstieg)` und dann jeden Parameter aus `ziel` dazusetzen), also
`/pdf-studio?werkzeug=zusammenfuegen` und `/pdf-studio?tun=oeffnen`. Die
Weiterleitung nimmt sie mit und hängt `von=hnvr` an.

**Kein Tagesfokus, keine Kennzahl.** „Was braucht dich heute?“ bekommt vom
Studio nichts: die Dateien verlassen das Gerät nicht, der Server weiß nichts
über sie. `tagesfokus` und `kennzahlen` bleiben leer, und die Prüfung hält
sie leer.

**4. Hauptseite www.hnvr.me/tools (P4).** `kachel.html` einsetzen, so wie sie
ist (dunkel), neben die Kacheln, die dort schon stehen (Drop-it, PSD-Studio).

**5. Konsole „hnvr.me Apps“ (P5).** Dieselbe Kachel ohne die Klasse
`hnvr-app-kachel--dunkel`.

## Was du vorher erledigen musst

- **Anmeldung über hnvr.me** — der OAuth-Zugang „PDF Studio“ im Projekt
  *Digitale Erlebnisse* ist angelegt; `HNVR_CLIENT_ID` und Veröffentlichen
  stehen in `doku/anmeldung-hnvr.md`.
- **Domain.** Die Weiterleitung zeigt auf die Wix-Adresse
  `werkbank-b2ce6ab2-hnvrme.wix-site-host.com`. Kommt `pdf-studio.me` dazu,
  ändern sich `weiterleitung.nach`, die Umleitung auf hnvr.me und die
  Rücksprungadressen in einem Zug; die Prüfung merkt, wenn Weiterleitung und
  Rücksprung auseinanderlaufen.

## Rechte, ehrlich

Die Konsole entscheidet, **wer den Menüpunkt sieht**. Das Studio selbst
fragt nur: *ist jemand mit einem hnvr.me-Konto angemeldet?* Wer die Adresse
kennt, kommt also auch ohne freigeschalteten Bereich hinein. Das ist heute
richtig, weil das Studio für jedes hnvr.me-Konto kostenlos ist.

Soll es einmal an den Bereich gebunden sein (etwa als Teil eines Pakets),
muss `/api/mitglied.json` den Bereich beim Kern von hnvr.me abfragen — Rechte
werden im Kern geprüft, nicht in der Oberfläche. Das braucht eine
Schnittstelle der Konsole, die es noch nicht gibt; offen, nicht vergessen.
