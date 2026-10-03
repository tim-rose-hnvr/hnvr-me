# Einbaupaket: PDF Studio als App von hnvr.me

PDF Studio erscheint auf www.hnvr.me wie jeder andere Bereich der Konsole —
nach denselben Regeln wie in Figma „Atelier OS“. Dieses Verzeichnis enthält,
was der Code von hnvr.me dafür braucht. Der Code selbst liegt nicht in diesem
Repository; eingebaut wird dort.

Entwürfe: Figma-Datei *hnvr.me*, Seite **„PDF Studio · App von hnvr.me“**
(Bildschirme P1–P5, Komponente *App-Kachel*). Die bestehenden Seiten sind
unverändert; P1 und P3 sind Kopien von *Startseite* und *X5 Menü und
Bereiche*.

| Datei | Wofür |
|---|---|
| `manifest.json` | Die eine Quelle: Name, Text, Einstieg, Bereich, Rechte, Schnellaktionen |
| `bereichssymbol.svg` | Symbol für die Seitenleiste, 18 px, Strich in `currentColor` |
| `kachel.html` | Kachel für `/tools` (dunkel) und „hnvr.me Apps“ (hell) — HTML und CSS, nichts aus dem Netz |
| `pruefe-app.mjs` | Prüft, dass alles zusammenpasst: `node hnvr-app/pruefe-app.mjs` (16 Prüfungen) |

## Einbauen

**1. Konsole — Seitenleiste (P1, P5).** Unter **WEITERE BEREICHE** ein
Menüpunkt „PDF Studio“ mit `bereichssymbol.svg`, sichtbar, wenn der Bereich
für den Kunden an ist und die Rolle die Stufe *Ändern* hat. Er führt auf
`einstieg` **im selben Tab, im ganzen Fenster** — wie Headless Studio. Oben im
Studio steht dann „KONSOLE / PDF STUDIO“ und führt zurück nach
`https://www.hnvr.me/konsole`.

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
`schnellaktionen`: Ziel ist `einstieg` + `ziel`, also
`…/studio/index.html?werkzeug=zusammenfuegen` und `…?tun=oeffnen`.

**Kein Tagesfokus, keine Kennzahl.** „Was braucht dich heute?“ bekommt vom
Studio nichts: die Dateien verlassen das Gerät nicht, der Server weiß nichts
über sie. `tagesfokus` und `kennzahlen` bleiben leer, und die Prüfung hält
sie leer.

**4. Hauptseite www.hnvr.me/tools (P4).** `kachel.html` einsetzen, so wie sie
ist (dunkel). Die Seite ist heute leer bis auf die Überschrift „Tools“.

**5. Konsole „hnvr.me Apps“ (P5).** Dieselbe Kachel ohne die Klasse
`hnvr-app-kachel--dunkel`.

## Was du vorher erledigen musst

- **Anmeldung über hnvr.me einrichten** — der OAuth-Zugang „PDF Studio“ im
  Projekt *Digitale Erlebnisse*, `HNVR_CLIENT_ID`, Veröffentlichen. Schritte in
  `doku/anmeldung-hnvr.md`. Ohne das führt der Menüpunkt auf eine Anmeldung,
  die mit 400 abbricht.
- **Domain.** `einstieg` zeigt auf die Wix-Adresse
  `werkbank-b2ce6ab2-hnvrme.wix-site-host.com`. Kommt `pdf-studio.me` (oder
  eine Adresse unter hnvr.me) dazu, ändern sich `einstieg`, der Link in
  `kachel.html` und die Rücksprungadressen in einem Zug; die Prüfung merkt,
  wenn einer davon fehlt.

## Rechte, ehrlich

Die Konsole entscheidet, **wer den Menüpunkt sieht**. Das Studio selbst
fragt nur: *ist jemand mit einem hnvr.me-Konto angemeldet?* Wer die Adresse
kennt, kommt also auch ohne freigeschalteten Bereich hinein. Das ist heute
richtig, weil das Studio für jedes hnvr.me-Konto kostenlos ist.

Soll es einmal an den Bereich gebunden sein (etwa als Teil eines Pakets),
muss `/api/mitglied.json` den Bereich beim Kern von hnvr.me abfragen — Rechte
werden im Kern geprüft, nicht in der Oberfläche. Das braucht eine
Schnittstelle der Konsole, die es noch nicht gibt; offen, nicht vergessen.
