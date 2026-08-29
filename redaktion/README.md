# Redaktion

Ein Plan für soziale Kanäle **und** E-Mail. Selbst betrieben.

> **Stand:** Kern gebaut und geprüft (192 Prüfungen), neun Oberflächen laufen
> im Browser. Was noch fehlt, steht unter „Was heute fehlt" — und nirgends
> sonst als fertig.

## Warum überhaupt

swat.io macht soziale Kanäle gut und E-Mail gar nicht. Wer beides betreibt,
führt zwei Redaktionspläne, zwei Freigabeläufe und zwei Auswertungen — und
erklärt einmal im Quartal, warum der Newsletter und der LinkedIn-Beitrag am
selben Tag dasselbe angekündigt haben, nur mit anderen Zahlen.

Der Unterschied ist deshalb keine weitere Funktion, sondern eine
Zusammenlegung. Alles Übrige folgt daraus.

| | swat.io | hier |
|---|---|---|
| Redaktionsplan | soziale Kanäle | soziale Kanäle und Newsletter in einer Woche |
| Freigabe | für Beiträge | derselbe Lauf für Beiträge und Newsletter |
| Freigabe nach Textänderung | bleibt bestehen | verfällt — sie gilt einem Stand |
| Posteingang | Kommentare, Nachrichten | dazu Antworten auf den Newsletter |
| E-Mail-Marketing | — | Verteiler, Segmente, A/B, Strecken, Zustellbarkeit |
| Alternativtext | empfohlen | Bedingung fürs Veröffentlichen |
| Öffnungsrate | als Zahl | als Schätzung, mit dem Vorbehalt im Ergebnis |
| Krisenschalter | hält Beiträge an | hält auch den Newsletter an |
| Betrieb | als Dienst | als Dienst **oder** auf eigenem Server |

## Aufbau

```
src/kern/       die Regeln — ohne Server, ohne Datenbank, ohne Netz prüfbar
src/pages/      neun Seiten
src/komponenten/ Befundliste, Kanalmarke
src/stile/      eine Datei, keine Bibliothek
test/           node --test, keine Testbibliothek
```

Der Kern kennt weder Astro noch die Datenbank. Das ist der Grund, warum jede
Regel eine Prüfung hat: sie braucht dafür nichts weiter als Node. Und es ist
der Grund, warum der Zeichenzähler in der Werkstatt im Browser dasselbe Modul
lädt wie der Server — ein zweiter Zähler in der Oberfläche wäre der sichere Weg
zu zwei verschiedenen Zahlen für denselben Text.

### Die Module

| Datei | wofür |
|---|---|
| `kennung.ts` | sortierbare Kennungen, Zufall ohne Schieflage, signierte Token |
| `zeit.ts` | Zeitzonen, Sommerzeit, Raster — die Lücke und die doppelte Stunde |
| `zeichen.ts` | vier Netze, vier Zählweisen |
| `rollen.ts` | Rollen und Rechte, aufsteigend vererbt |
| `ereignis.ts` | Ereignisprotokoll als Hash-Kette mit Tagesabschluss |
| `befund.ts` | Fehler, Warnung, Hinweis — was anhält und was nicht |
| `kanal.ts` | Kanalgrenzen mit Stand, je Zugang überschreibbar |
| `beitrag.ts` | Beitrag mit Fassungen, Zustandskette, Prüfung |
| `freigabe.ts` | ein Lauf für Beiträge und Newsletter, vier Augen, Stand |
| `plan.ts` | Abstand, Ruhezeiten, Vorlauf, Ruhemodus |
| `empfaenger.ts` | Adressen, Einwilligung, doppelte Bestätigung, Löschung |
| `verteiler.ts` | Verteiler und Segmentregeln |
| `newsletter.ts` | Bausteine, Personalisierung, A/B, HTML und Text |
| `versand.ts` | Drosselung, Doppelversandschutz, Rückläufer, Abbruch |
| `zustellung.ts` | Kopfzeilen, SPF/DKIM/DMARC, Aufwärmplan |
| `strecke.ts` | Automationen mit Abbruch bei Abmeldung |
| `posteingang.ts` | ein Eingang, Sperre statt Beschriftung, Dienstzeiten |
| `auswertung.ts` | ehrliche Nenner, Öffnungsvorbehalt, keine erfundene Reichweite |
| `bestand.ts` | der Bestand zum Ansehen — verlässt die Seiten, sobald es Speicher gibt |

## Was heute fehlt

Diese Liste wird mitgepflegt, wenn etwas fertig wird. Sie ist der Grund, aus
dem man der Tabelle oben glauben kann.

- **Speicher.** Es gibt keine Datenbank. Alle Seiten rechnen mit `bestand.ts`
  — durch dieselben Kernfunktionen, die später der Betrieb benutzt.
- **Anmeldung.** Wer am Bildschirm sitzt, steht fest im Code. Rollen und Rechte
  sind gebaut und geprüft, die Anmeldung dahinter nicht.
- **Die Netze selbst.** Kein OAuth, keine Schnittstelle zu Mastodon, LinkedIn
  oder Instagram. Die Grenzen und Regeln sind da, das Verbinden nicht.
- **Der Mailserver.** Der Kern baut Kopfzeilen und Mails und beurteilt die
  Einrichtung. Er verschickt nichts.
- **Der Editor.** Beiträge und Newsletter lassen sich ansehen, nicht ändern.
- **Bilder.** Kein Hochladen, keine Ablage, keine Umrechnung in die Maße der
  Netze.

## Laufen lassen

```
npm install
npm test          # 192 Prüfungen, ohne Netz
npm run pruefen   # astro check
npm run dev       # http://localhost:4321
```

Zum Ausliefern `npm run build`, dann `node dist/server/entry.mjs`. Der
Node-Adapter ist eine Entscheidung: das Versprechen ist, dass ein Kunde das
Programm selbst betreiben kann, auf einem Server in der EU, in einem Container,
ohne dass beim Versand einer Kampagne ein fremder Dienst mitliest.

## Regeln beim Weiterbauen

- **Deutsch, auch im Code.** Die Domäne heißt Beitrag, Freigabe, Empfänger.
  Umlaute werden in Bezeichnern umschrieben (`zaehlart`, `ruecklaeufer`).
- **Nichts behaupten, was nicht eingelöst ist.** Was geplant ist, steht als
  geplant da — auf jeder Seite, an jedem Knopf.
- **Geprüft wird im Kern.** Ein Knopf, der nicht angezeigt wird, ist keine
  Absicherung: die Adresse dahinter lässt sich eintippen.
- **Kein Fremdaufruf im Browser.** Keine Schrift, kein Symbolsatz, keine
  Zählung von außen. Ein Programm, das Einwilligungen verwaltet und dabei
  selbst Daten an ein CDN gibt, widerlegt sich beim Laden.
- **Ein Ausfall darf Komfort kosten, niemals Daten.** Für einen Newsletter
  heißt das: keine Mail geht zweimal hinaus, auch nicht nach einem Neustart
  mitten im Versand.
- **Jede Zahl, die veraltet, trägt einen Stand.** Die Kanalgrenzen ändern sich
  ohne Ankündigung; eine Tabelle, die das verschweigt, wird still falsch.
