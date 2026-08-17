# Get in Touch

Eine Seite, die Menschen erreichbar macht: alle Kontaktwege, die digitale
Visitenkarte und ein QR-Code unter einer kurzen Adresse — `hnvr.me/t/<name>`.

Wix-Headless-Projekt auf Basis von Astro 5. Wix hostet, liefert später die
Daten (CMS) und die Anmeldung (Members).

**Stand:** Stufe 1 ist fertig — Verkaufsseite und öffentliche Profilseite samt
Kern (Datenmodell, Gestaltung, Erreichbarkeit, vCard, QR). Das Wix-Projekt ist
angelegt und die Collection gefüllt; hochgeladen ist das Frontend noch nicht.
Stufe 2, der Editor für Besucher, kommt darauf.

| Adresse | Was |
|---|---|
| `/` | Verkaufsseite (statisch vorgebaut) |
| `/t/<name>` | die öffentliche Profilseite |
| `/t/<name>/karte.vcf` | die Visitenkarte als Datei |
| `/t/<name>/qr.svg` | der QR-Code |

---

## Was hier anders ist als im Vorgänger

Der Vorgänger liegt auf `hnvr.me Digital` unter `/get-in-touch/app/`. Vier
Punkte waren der Anlass, neu anzusetzen:

**1. Der Link funktionierte nur für den Ersteller.**
Alle Profile lagen im `localStorage` des Browsers. Wer `hnvr.me/t/tim` öffnete,
bekam „Die Adresse tim ist noch nicht vergeben" — auch dann, wenn die Seite
gepflegt war. Ein gedruckter QR-Code zeigte damit ins Leere, und Vorschaukarten
in WhatsApp, LinkedIn oder iMessage blieben leer.
→ Jetzt kommt die Seite fertig vom Server. Ohne JavaScript ist sie vollständig.

**2. Die Seite versprach Datenschutz und lud Google Fonts.**
Die Profilseite band `fonts.googleapis.com` ein und schrieb im selben Text, es
gehe „nichts an einen Server". Beides zusammen geht nicht.
→ Schriften liegen unter `public/schriften`. Die Seite lädt von keinem fremden
Host, setzt kein Cookie und bindet kein Analyse-Werkzeug ein.

**3. Achtzehn Vorlagen, zwölf Schriften, sechs Regler — und kein Wächter.**
Jede Kombination war erlaubt, keine geprüft. Zwei der übernommenen Vorlagen
waren messbar unlesbar (weiße Schrift auf Orange kommt auf 2,8:1, nötig sind
4,5:1).
→ Neun Vorlagen, jede geprüft. `pruefeLesbarkeit` sagt in Worten, was nicht
mehr geht, und der Test lässt keine unlesbare Vorlage durch.

**4. Eine Linkliste hat keine Rangfolge.**
Vierzehn gleich aussehende Schaltflächen sind keine Antwort auf die Frage
„Wie erreiche ich die?".

## Was die Konkurrenz macht — und was daraus folgt

Gemessen an der ausgelieferten Seite von `linktr.ee/linktree` (abgerufen
August 2026), nicht an Werbeversprechen:

| | Linktree | Get in Touch |
|---|---:|---:|
| HTML einer Profilseite | 190 KB | 20 KB |
| Skripte | 52 | 1 |
| Nachgeladen von fremden Hosts | 3 | 0 |
| Links auf **fremde** Profile | 60 | 0 |
| Cookie-Einwilligung nötig | ja | nein |
| Eigene Links im Beispielprofil | 1 | — |

Die 60 Fremdlinks sind kein Schreibfehler: unter dem Profil hängen ein
Karussell „Explore other Linktrees", ein Raster „Discover more" mit weiteren
Konten, die Preisliste des Anbieters und Affiliate-Verweise auf Werbekunden.
Wer den QR-Code eines Handwerkers scannt, bekommt dessen Wettbewerb
mitgeliefert. Nachgeladen wird unter anderem von `fonts.googleapis.com` und
einem Einwilligungsdienst — beides Dinge, die eine deutsche Datenschutz­erklärung
erklären muss.

Aus der Sparte digitale Visitenkarten (Blinq, HiHello, Popl) kommt der zweite
Befund: dort steht die Karte im Mittelpunkt und die Linkliste am Rand — das ist
die richtige Gewichtung. Verschickt werden dafür auf den Gratis-Tarifen
teilweise Werbemails an jeden, der die Karte ansieht.

**Was daraus folgt, steht auf jeder Seite:**

- Kein fremdes Profil, keine Werbung, kein Karussell. Ein Absender im Fuß.
- Die Karte gehört nach oben, gleich neben die Hauptaktion.
- Wer die Karte ansieht, wird nicht erfasst. Sie ist eine Datei, kein Formular.
- Die Fußzeile behauptet „Keine Cookies · kein Tracking · keine fremde Werbung"
  — und das ist an der ausgelieferten Seite nachprüfbar.

## Der Aufbau: drei Ränge statt einer Knopfreihe

Der meistgenannte Vorwurf an Link-in-Bio-Seiten ist, dass vierzehn gleich
aussehende Knöpfe niemandem sagen, welchen er drücken soll. Deshalb ordnet
diese Seite nach Dringlichkeit statt nach Listenposition:

```
   Wer ist das, und ist da gerade jemand?      Name groß, linksbündig, Statuszeile
 ┌──────────────────────────────────────┐
 │ Rang 1   Jetzt anrufen               │      gefüllt, Akzentfarbe
 │          Kontakt speichern           │      gleichrangig daneben
 ├──────────────────────────────────────┤
 │ Rang 2   [WhatsApp] [Termin]         │      Kachelgitter, kurze Wege
 │          [E-Mail]   [Anfahrt]        │
 ├──────────────────────────────────────┤
 │ Rang 3   // was wir machen           │      ruhige Zeilen mit Haarlinie
 │          hnvr.me — Digitalagentur  → │
 │          Technik mieten            → │
 └──────────────────────────────────────┘
   Kanäle · QR-Code · Absender
```

Welchen Rang ein Block bekommt, folgt aus seinem Kanal: Anruf, Nachricht,
Route und Termin verlassen den Browser sofort und werden Kacheln; alles, was
auf eine Seite zum Lesen führt, wird eine Zeile. Übersteuern geht mit
`"form": "kachel"` oder `"zeile"`. Aufeinanderfolgende Kacheln bilden ein
Gitter, eine einzelne wird wieder zur Zeile — ein Gitter aus einem Element ist
ein verlorener Knopf am linken Rand.

Linksbündig statt mittig ist Absicht: mittige Sätze lesen sich langsamer, große
Schrift braucht eine Kante, und **alle** Wettbewerber zentrieren.

### Die neue Idee: die Seite kennt die Uhrzeit

Wer sonntags um 23 Uhr den QR-Code am Fahrzeug scannt und auf „Jetzt anrufen"
tippt, landet im Nichts und ist weg. Deshalb kennt die Seite die Öffnungszeiten
des Betriebs und stellt **genau eine** Aktion nach vorn — die, die gerade trägt:

| Lage | Statuszeile | Hauptaktion |
|---|---|---|
| Mi 14:00 | „Jetzt erreichbar · bis 18:00" | Jetzt anrufen |
| Sa 14:00 | „Gerade geschlossen · Montag ab 9:00" | WhatsApp schreiben |
| 24.12. | „Geschlossen · Heiligabend · Montag ab 9:00" | WhatsApp schreiben |

Alles gilt in der Zeitzone des Betriebs, nicht in der des Besuchers. Ohne
gepflegte Zeiten gibt es keine Statuszeile — eine erfundene Verfügbarkeit ist
schlimmer als keine Angabe.

---

## Aufbau

```
daten/profile/*.json     Profile, die mitgebaut werden (u. a. das eigene)
public/schriften/        DM Sans, Clash Display — selbst ausgeliefert
public/bilder/
src/kern/                Die Fachlogik, ohne Astro und ohne Browser
  zeit.ts                Wanduhr in der Zeitzone des Betriebs
  erreichbarkeit.ts      Öffnungszeiten → Lage → Statuszeile
  profil.ts              Datenmodell, Prüfung, Wahl der Hauptaktion
  gestaltung.ts          Neun Vorlagen, Ableitungen, Kontrastwächter
  zeichen.ts             Strichalphabet als SVG
  ziele.ts               Rohwert → sichere Adresse (tel:, wa.me, mailto: …)
  vcard.ts               vCard 3.0 nach RFC 2426
  bild.ts                Foto für die Visitenkarte einbetten
  speicher/              Ablage: Wix-CMS mit Rückfall auf die Dateien
src/komponenten/         Astro-Bausteine der Seite
src/pages/index.astro    Die Verkaufsseite
src/pages/t/[slug].astro Die öffentliche Seite
src/pages/t/[slug]/      karte.vcf und qr.svg
test/                    59 Tests auf die Regeln oben
```

Der Kern kennt weder Astro noch das DOM. Der Editor aus Stufe 2 benutzt
denselben Kern und bekommt damit eine Vorschau, die nicht bloß ähnlich
aussieht, sondern dieselbe Rechnung anstellt.

---

## Entwickeln

```bash
npm install
npm run dev        # http://localhost:4321 — Verkaufsseite, Profile unter /t/<name>
npm test           # 59 Tests, ohne zusätzliche Abhängigkeiten
npm run pruefen    # astro check
npm run build
```

Zwei Schalter, die es **nur** in der Entwicklung gibt und die im gebauten
Stand wirkungslos sind:

```
/t/hnvr?jetzt=2026-01-14T13:00:00Z   Uhr stellen — zeigt die Seite zu dieser Zeit
/t/hnvr?vorlage=creme                Vorlage durchprobieren, an echtem Inhalt
```

---

## Ein Profil pflegen

Eine JSON-Datei je Profil in `daten/profile/`. Der Dateiname ist beliebig, die
Adresse steht in `slug`. Vollständig geprüft beim Bauen — was die Prüfung nicht
besteht, wird nicht ausgeliefert und steht mit Grund im Log.

Das Wesentliche:

```jsonc
{
  "slug": "hnvr",
  "kopf": { "name": "…", "rolle": "…", "beschreibung": "…", "bild": "/bilder/…" },

  "erreichbarkeit": {
    "zeitzone": "Europe/Berlin",
    "fenster": [{ "tag": 1, "von": "09:00", "bis": "18:00" }],   // tag: 1 = Montag
    "ausnahmen": [{ "datum": "2026-12-24", "grund": "Heiligabend" }],
    "zusage": "Antwort am nächsten Werktag"
  },

  // Verweise auf Block-Kennungen: welche Aktion wann oben steht
  "hauptaktion": { "offen": "anruf", "zu": "whatsapp" },

  "bloecke": [
    { "id": "anruf", "art": "aktion", "kanal": "telefon",
      "beschriftung": "Jetzt anrufen", "ziel": "+4951112282286", "aktiv": true }
  ],

  "kanaele": [{ "netzwerk": "instagram", "ziel": "hnvr.me" }],
  "visitenkarte": { "vorname": "…", "nachname": "…", "telefon": "…" },
  "gestaltung": { "vorlage": "hnvr" }
}
```

Kanäle: `link`, `telefon`, `mobil`, `whatsapp`, `mail`, `termin`, `route`,
`shop`, `datei`, `video`.
Blockarten: `aktion`, `ueberschrift`, `text`, `trenner`.
Darstellung: `form` mit `kachel` oder `zeile` — ohne Angabe entscheidet der Kanal.
Vorlagen: `hnvr`, `creme`, `tinte`, `ozean`, `wald`, `papier`, `sand`, `abend`,
`stein`.

Zeitfenster über Mitternacht (`"von": "20:00", "bis": "03:00"`) gehören zum
Starttag. Aneinandergrenzende Fenster werden zusammengezogen, eine Mittagspause
bleibt eine Pause.

---

## Mit Wix verbinden

**Im Wix-Account steht schon:**

| | |
|---|---|
| Headless-Projekt | `Get in Touch` |
| Dashboard | https://manage.wix.com/dashboard/ed8e16cf-182d-4cbb-8b7d-1f97fe28d62b |
| metaSiteId | `ed8e16cf-182d-4cbb-8b7d-1f97fe28d62b` |
| siteId | `5022c686-884e-4ca2-ad10-55e97ec56b56` |
| Collection | `GetInTouchProfile` — `slug` (Text), `daten` (Objekt), `veroeffentlicht` (Ja/Nein), Leserecht `ANYONE` |
| Inhalt | Profil `hnvr`, veröffentlicht |

**Was noch fehlt: das Frontend hochladen.** Dafür braucht die Wix-CLI eine
Anmeldung, und die geht nur im Browser oder mit einem API-Schlüssel. Im
Projektverzeichnis, einmalig:

```bash
npx wix login                       # oder: npx wix login --api-key <TOKEN>
npm create @wix/new@latest -- headless link --business-name "Get in Touch"
```

Beim Verbinden das oben genannte Projekt wählen, statt ein neues anzulegen.
Der Befehl trägt die Wix-Anbindung in `astro.config.mjs` ein und übernimmt
Adapter und Authentifizierung. Danach:

1. Den Node-Adapter aus `astro.config.mjs` entfernen — Wix bringt seinen
   eigenen mit.
2. `npm i @wix/data` und `GETINTOUCH_WIX_COLLECTION=GetInTouchProfile` setzen.
   Danach kann `src/typen/wix-data.d.ts` weg.
3. Bauen und veröffentlichen: `npm run build && npx wix release`.

**Noch von Hand zu erledigen:** das Projekt wurde mit den Wix-Vorgaben angelegt
und steht auf Englisch, USD und `America/New_York`. Für einen Betrieb in
Hannover gehört das im Dashboard auf Deutsch, EUR und `Europe/Berlin` gestellt.
Auf die Seiten selbst wirkt sich das nicht aus — die Erreichbarkeit rechnet mit
der Zeitzone aus dem Profil, nicht mit der des Wix-Projekts —, wohl aber auf
Rechnungen und andere Wix-Funktionen. Einen dokumentierten Schreib-Endpunkt
dafür gibt es nicht.

Solange `GETINTOUCH_WIX_COLLECTION` fehlt, bleibt die Wix-Quelle stumm und es
gelten allein die Dateien. Beide Quellen liegen übereinander — Wix wird zuerst
gefragt, die Dateien fangen auf. Eine gepflegte Hausseite kann damit nie von
einem leeren Datensatz überschrieben werden.

**Astro 5 ist Pflicht.** Astro 6 unterstützt die Wix-Anbindung nicht.

---

## Was Stufe 2 braucht

Der Editor. Der Kern liegt schon so, dass er ihn tragen kann:

- **Anmeldung** über die eingebauten Login-Routen der Astro-Anbindung.
- **Schreiben** in dieselbe Collection, `slug` gegen `pruefeSlug` und gegen
  bereits vergebene Adressen prüfen.
- **Vorschau** über `/t/<slug>?vorschau=…` — dieselbe Seite, dieselbe Rechnung,
  kein zweiter Renderer.
- **Kontrastwächter** sichtbar machen: `pruefeLesbarkeit` liefert die Sätze
  schon fertig.
- **Bilder** beim Hochladen verkleinern und als Datenadresse ablegen, damit die
  vCard sie ohne Nachladen mitführt.

Bewusst noch nicht gebaut, weil es ohne Editor niemandem nützt: Aufrufzählung,
Klickstatistik, eigene Domains, mehrere Profile je Konto.
