# Einbaupaket: PDF Studio als App von hnvr.me

PDF Studio erscheint auf www.hnvr.me wie jeder andere Bereich der Konsole —
nach denselben Regeln wie in Figma „Atelier OS“. Dieses Verzeichnis enthält,
was der Code von hnvr.me dafür braucht. Der Code selbst liegt nicht in diesem
Repository; eingebaut wird dort.

**Einstieg: <https://www.hnvr.me/pdf-studio>.** Alle Links auf hnvr.me —
Kachel, Menüpunkt, Schnellaktionen — zeigen dorthin und auf nichts anderes.

## Wie `/pdf-studio` auf hnvr.me entsteht

**hnvr.me liefert das Studio selbst aus** (seit 4. Oktober 2026). Die Dateien
liegen im Code von hnvr.me unter `site/public/pdf-studio/`, abgelegt mit

```sh
node portal/skripte/app-einbetten.mjs --fuer hnvr --ziel <hnvr.me>/site/public/pdf-studio
```

Das Skript kopiert `studio/` unverändert (ohne `werkzeuge/`) und setzt im
`index.html` die Kopfzeilen für hnvr.me: Auskunft `/api/hub/me` (dieselbe
Route wie die Konsole), Anmeldung über `/konsole/anmelden?ziel=…`, Rückweg in
die Konsole. Ein eigener OAuth-Zugang ist dort nicht nötig, und es gibt keinen
Domainwechsel. Wer das Studio ändert, legt es so neu ab und veröffentlicht
hnvr.me.

**`/pdf-studio` selbst ist eine SEO-Umleitung** der Site (Wix SEO Redirects
API) auf `/pdf-studio/index.html?von=hnvr`. Das Wix-Hosting liefert für
Verzeichnisse kein Register aus. Die Umleitung greift nur genau bei
`/pdf-studio` und `/pdf-studio/` und hat dort Vorrang vor jeder Seite; die
Dateien darunter erreicht sie nicht. Gemessen:

- 301, auch für `hnvr.me/…` ohne `www`.
- Mitgebrachte Suchparameter bleiben: `/pdf-studio?werkzeug=zusammenfuegen`
  → `/pdf-studio/index.html?werkzeug=zusammenfuegen&von=hnvr`.
- Nach einer Änderung braucht der Zwischenspeicher vor `www.hnvr.me` etwa
  zwei Minuten.
- Wix behandelt den Kennzeichner „HeadlessChrome“ wie einen
  Suchmaschinen-Abrufer und antwortet für `/pdf-studio/index.html` mit 404.
  Echte Browser bekommen 200; Prüfungen fragen deshalb mit dem Kennzeichner
  eines echten Chrome (`studio/werkzeuge/live-pruefen.mjs`).

Die frühere Adresse des Studios (`werkbank-b2ce6ab2-hnvrme.wix-site-host.com`)
bleibt bestehen: dort läuft es eigenständig, angemeldet über den OAuth-Zugang
„PDF Studio“ (`doku/anmeldung-hnvr.md`). Von hnvr.me führt nichts mehr dorthin.

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

**Stand 4. Oktober 2026: eingebaut und live** (Code von hnvr.me, zuletzt
Release aus `9dd827a`). Von außen nachgemessen:

- www.hnvr.me/tools zeigt `kachel.html` unverändert (dunkel) neben Drop-it und
  PSD-Studio, mit genau einem Link `/pdf-studio`.
- www.hnvr.me/apps/pdf-studio steht im App-Store (kostenlos, für jede Person
  mit Konto).
- `/pdf-studio` führt auf `/pdf-studio/index.html` auf hnvr.me, auch mit
  `?werkzeug=…` und `?tun=…`; dort liegt das Studio und zeigt ohne Sitzung
  die Anmeldeschranke mit „Mit hnvr.me anmelden“ → `/konsole/anmelden`.

Laut der Sitzung, die eingebaut hat, außerdem: **kein eigener Menüpunkt** —
PDF Studio steht als App unter „hnvr.me Apps“ (Seitenleiste, Meine Apps,
Store), sichtbar mit Bereich `pdfstudio`; Bereich im Rechtekern mit nur
*Ändern*/*Keine*, Schalter je Website unter „Bereiche für Kunden“, die beiden
Schnellaktionen. Kein Link auf `/pdf-studio` öffnet ein neues Fenster.

**Abweichung von Schritt 5:** In „hnvr.me Apps“ und im App-Store erscheint
PDF Studio als Katalogeintrag im Kartenformat des Stores, nicht als helle
`kachel.html` — ein Format für alle Apps statt einer Sonderkachel.

**Noch nicht geprüft:** der Eintrag unter „hnvr.me Apps“, die
Schnellaktionen, der Knopf auf `/apps/pdf-studio` und die Anmeldung im Studio
mit einem echten Konto — dafür braucht es eine Anmeldung.

**1. Konsole — unter „hnvr.me Apps“ (P1, P5).** Kein eigener Menüpunkt in
der Menüleiste (so entschieden am 4. Oktober 2026), sondern ein Eintrag bei den
Apps mit `bereichssymbol.svg`, sichtbar, wenn der Bereich
für den Kunden an ist und die Rolle die Stufe *Ändern* hat. Er führt auf
`einstieg` (`https://www.hnvr.me/pdf-studio`, oder einfach `/pdf-studio`)
**im selben Tab, im ganzen Fenster** — wie Headless Studio. Die Weiterleitung
setzt `?von=hnvr`: damit steht oben „Konsole / PDF Studio“ mit dem Weg zurück
nach `https://www.hnvr.me/konsole`. Das Studio bleibt dabei im Atelier-Design
des Entwurfs (Figma „PDF Studio — Vorgang“), nicht in der Hand der Konsole.

Nicht im `<iframe>`: ein Studio im Rahmen hätte zu wenig Platz für Seiten,
Bühne und Inspektor, und Ganzes Fenster ist das Muster der Konsole — Headless
Studio öffnet genauso.

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
