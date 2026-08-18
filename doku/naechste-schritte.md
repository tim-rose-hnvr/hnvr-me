# Nächste Schritte

Der Stand ist gebaut, ausgeliefert und geprüft. Was fehlt, steht hier — nicht
als Wunschliste, sondern mit den Entscheidungen, die schon gefallen sind, damit
niemand sie ein zweites Mal herleiten muss.

Reihenfolge ist die des Design-Handoffs (`doku/handoff/README.md`), mit einer
Abweichung: der Eingang steht vor der Buchung, weil der Nachricht-Baustein
sonst nur eine halbe Kehrseite hat.

---

## Was steht

| | |
|---|---|
| Live | https://get-in-tou-35a520f5-hnvrme.wix-site-host.com |
| Branch | `claude/new-session-htlw7a` (Vorgabezweig) |
| Marke | `getintouch/src/kern/marke.ts` — Name, Zeichen, Farben, Postfach |
| Vorlagen | `getintouch/src/kern/gestaltung.ts` — elf, davon neun aus dem Handoff |
| Prüfregeln Formular | `getintouch/src/kern/nachricht.ts` |
| Ausliefern | `getintouch/VEROEFFENTLICHEN.md` |

Öffentliche Profilseite, Erreichbarkeit aus Öffnungszeiten, vCard, QR-Code,
Nachricht-Baustein, Werkstatt, 404 — dazu die sechs Marketingseiten des
Handoffs. Elf Vorlagen in drei Anordnungen, nach Fach filterbar. 103 Tests.

---

## 1. Der Eingang — gebaut, noch nicht scharf

**Der Code steht** (`/eingang/<schluessel>`, `kern/eingang.ts`,
`kern/speicher/eingang.ts`, 5 Tests). Er fällt zu, nicht auf: ohne passenden
Schlüssel gibt es 404 — und zwar dieselbe 404 für „gibt es nicht" wie für
„falsch", denn schon die Unterscheidung wäre eine Auskunft.

**Was fehlt, braucht CMS-Zugang** und damit einen gültigen API-Schlüssel:

1. In der Collection `GetInTouchProfile` ein Textfeld **`eingangSchluessel`**
   anlegen.
2. Für ein Profil einen Wert eintragen — 32 Zeichen aus `[A-Za-z0-9]`. Erzeugen
   lässt er sich mit `neuerSchluessel()` aus `kern/eingang.ts` oder im Browser
   mit:
   `Array.from(crypto.getRandomValues(new Uint8Array(32)), b => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62]).join('')`
3. Aufrufen: `https://<adresse>/eingang/<dieser-wert>`

**Nicht geprüft gegen die echte Datenbank.** Die Schlüssellogik ist es
(gleichbleibende Zeit, Formprüfung, fällt zu) — die Abfrage selbst nicht, weil
beim Bauen kein CMS-Zugang mehr bestand. Vor dem ersten echten Einsatz einmal
mit einem Wegwerf-Profil durchspielen.

**Was noch fehlt:** „erledigt"-Schalter (Feld ist da, Bedienung fehlt) und die
Antwort im Produkt statt per `mailto:`.

## 1b. Was vom Eingang noch aussteht

**Warum zuerst.** Nachrichten landen heute in der Collection
`GetInTouchNachricht` und werden im Wix-Dashboard gelesen. Das trägt für die
ersten Wochen, aber nicht für einen Kunden.

**Der Zugang ist die ganze Schwierigkeit.** Ein Konto-System gibt es nicht, und
eines nebenbei zu bauen ist der falsche Weg. Vorschlag:

- Ein Geheimlink je Profil: `/eingang/<schluessel>`, Schlüssel 32 Zeichen aus
  `[A-Za-z0-9]`, erzeugt mit `crypto.getRandomValues`.
- Der Schlüssel steht **nur im CMS**, als Feld `eingangSchluessel` an der
  Collection `GetInTouchProfile` — niemals in `daten/profile/*.json`, weil das
  Repository öffentlich ist. Für dateibasierte Profile gibt es also keinen
  Eingang; das ist richtig so, sie gehören uns.
- Die Seite trägt `noindex`, `cache-control: no-store` und
  `referrer-policy: no-referrer` — ein Geheimlink, der im Referrer eines
  angeklickten Links auftaucht, ist keiner mehr.
- Auf der Seite steht in einem Satz, dass der Link ein Schlüssel ist.

**Was die Seite kann:** Liste der Nachrichten (neueste zuerst), Absicht, Text,
Name, Antwortweg, Datum. Ein Knopf „erledigt" setzt `erledigt: true` — per
POST, JSON, mit Rechteerhöhung, genau wie in
`src/pages/t/[slug]/nachricht.ts`. Ein `mailto:`-Knopf mit vorbereitetem
Betreff ist die Antwortfunktion der ersten Fassung; ein eigener Versand
gehört nicht hierher.

**Fallstrick, schon bezahlt:** Die Auslieferung von Wix weist
formularkodierte POSTs pauschal ab. Alles, was schreibt, muss JSON schicken —
siehe den Kopf von `src/komponenten/Nachrichtblock.astro`.

---

## 2. Terminbuchung

Aus dem Handoff, Screen `6b`: drei Schritte — Absicht, Kalender, Bestätigung.

- **Nur echte freie Zeiten.** Der Handoff verlangt eine Kalenderanbindung. Bis
  die steht, ist die ehrliche Zwischenstufe: der Betreiber pflegt Zeitfenster
  im Profil (die Struktur dafür gibt es schon — `erreichbarkeit.fenster`), und
  gebuchte Termine blocken daraus. Erfundene Verfügbarkeit ist schlimmer als
  keine, dieselbe Regel wie bei der Statuszeile.
- 30-Minuten-Raster, Bestätigung per Mail mit `.ics` im Anhang.
- Neue Collection `GetInTouchTermin`: `slug`, `beginn`, `dauer`, `absicht`,
  `name`, `antwortweg`, `zustand`.
- Die Zeitrechnung gehört in `kern/zeit.ts` — dort steht schon alles, was mit
  Zeitzonen umgeht, und es ist getestet. Kein zweiter Weg.

---

## 3. Bewertungen

Aus dem Handoff, Screen `6d`. Die beiden Regeln, die das Ganze tragen:

- **Nur nach abgeschlossener Buchung**, über ein Einmal-Token je Termin. Ohne
  das ist es ein Gästebuch, und Gästebücher sind wertlos.
- **Drei Sterne oder weniger gehen zuerst in den privaten Kanal.** Öffentlich
  erst nach Freigabe. Das ist kein Filter für gute Bewertungen, sondern die
  Gelegenheit, einen Fehler zu beheben, bevor er öffentlich steht — und es
  muss auf der Seite auch so erklärt werden.

---

## 4. NFC, vCard-Abo, Social

- **NFC:** Der Tag trägt eine feste Adresse, das Ziel ist serverseitig
  umstellbar. Das ist der ganze Witz — ein Tag, den man neu schreiben müsste,
  wäre wertlos. Zählung je Tag.
- **vCard-Abo:** Wer gespeichert hat, bekommt bei geänderter Nummer eine
  Nachricht. Beachte: die Karte ist bewusst vCard **3.0**, nicht 4.0 — die
  Begründung steht in `src/kern/vcard.ts` und gilt weiter.
- **Social:** OAuth je Kanal, Feed stündlich mit Zwischenspeicher. Vorsicht:
  ein eingebetteter Feed lädt von fremden Servern nach und bricht damit die
  Zusage auf der Startseite. Entweder serverseitig spiegeln oder die Zusage
  ändern — nicht beides laufen lassen.

---

## 5. Whitelabel, Analytics

Screens `6f` und `6e`. Analytics als Ereignisse (`view`, `intent_click`,
`link_click`, `contact_sent`, `booking_created`, `nfc_tap`, `vcf_download`),
ohne Personenbezug — sonst fällt die Aussage „meldet niemandem, wer sie
geöffnet hat" auf der Startseite.

---

## 6. Editor

Die sechs Marketingseiten des Handoffs stehen (Start, Vorlagen, Karte & NFC,
Für Teams, Preise, Marke) — mit sichtbarem „geplant" überall dort, wo eine
Funktion beschrieben, aber nicht gebaut ist. Kopf, Navigation und Fuß liegen
in `komponenten/Marketingrahmen.astro`; sie standen vorher fünfmal einzeln da
und waren dadurch schon einmal auseinandergelaufen.

Offen bleibt der Editor mit ziehbaren Bausteinen und Kontextregeln (`6a`) —
der größte Einzelposten; die Werkstatt hat heute Formulare statt Blöcke.

---

## Zwei Dinge, die nur der Kontoinhaber kann

1. **Ein Feld `eingangSchluessel`** in der Collection `GetInTouchProfile`
   anlegen (siehe Abschnitt 1). Ohne das bleibt der Eingang zu — der Code
   dafür steht.
2. **Sprache, Währung, Zeitzone** im Wix-Dashboard auf Deutsch, EUR und
   `Europe/Berlin` stellen. Über die API geht es nachweislich nicht — die
   geprüften Wege stehen in `getintouch/VEROEFFENTLICHEN.md`.

---

## Regeln, die beim Weiterbauen gelten

Sie stehen verstreut in den Dateiköpfen; hier zusammen, weil sie teuer
erarbeitet sind:

- **Nichts behaupten, was die Seite nicht einlöst.** Der Abschnitt „was heute
  fehlt" auf der Startseite und die Vermerke „geplant" auf der Preisseite
  werden mitgepflegt, wenn etwas fertig wird.
- **Ein Renderer.** Öffentliche Seite, Galerie und Editorvorschau benutzen
  `Profilansicht.astro`. Eine Vorschau, die einen eigenen Renderer hat, ist
  keine.
- **Kein Fremdaufruf im Browser.** Schriften und Bilder liegen im eigenen
  Verzeichnis. Was Wix von sich aus einspritzt, steht auf der Startseite
  offen — vier Skripte, nicht schöngerechnet.
- **Der Kontrastwächter ist verbindlich.** `pruefeLesbarkeit` bricht den Bau
  ab, wenn eine Vorlage nicht mehr lesbar ist.
- **Deutsch, auch im Code.** Bezeichner und Kommentare in der Domänensprache.
