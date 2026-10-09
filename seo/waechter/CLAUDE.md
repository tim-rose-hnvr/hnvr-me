# SEO Wächter · Arbeitsanweisung

Kostenlose SEO-Werkzeuge als eigene Anwendung (Node, ohne Fremdpakete).
Ab 04.10.2026 löst sie die Produktoberfläche von seo-rank.me (`../site/app*.html`) ab.
Jedes Werkzeug ist ohne Anmeldung nutzbar. Mit Konto werden alle Ergebnisse
gespeichert, im Dashboard gesammelt, überwacht und als Bericht ausgegeben.
Die Gestaltung stammt aus Figma: Datei `JkiPNR4yuZr9VdL50YPnkg`, Seite 690:1748
„SEO Wächter · Liquid Glass“. Die Analyse dazu steht in `admin/seo-waechter/STAND.md`.

## Die eine Regel

**Es gibt nur einen Regelkatalog.** Der Wächter liest `../site/assets/js/regelkatalog.js`,
`domainregeln.js`, `robotsregeln.js` und `pruefwerk.js` über `lib/werk.mjs`, genau wie
Kommandozeile und Browser von seo-rank.me. Regeln werden dort geändert, nie hier
nachgebaut. Nach einer Änderung am Katalog laufen beide Selbsttests:
`node ../bauen/selbsttest.mjs` und `node test/selbsttest.mjs`.

## Aufbau

| Pfad | Zweck |
|---|---|
| `server.mjs` | HTTP-Server, Schnittstelle `/api/*` und Seiten; setzt Kopf, Fuß und Texte je Werkzeug serverseitig ein (für Suchmaschinen) |
| `lib/werk.mjs` | Anbindung an das Prüfwerk von seo-rank.me |
| `lib/schutz.mjs` | Sperre gegen Abrufe ins interne Netz (jeder Sprung einer Weiterleitung), Tagesgrenzen, Eingabeprüfung |
| `lib/module/*.mjs` | die neun Werkzeuge; `extern.mjs` bindet Fremddaten an, `rdap.mjs` holt Registrierungsdaten |
| `lib/ausfuehren.mjs` | Aufträge mit Fortschritt, Grenzen ohne und mit Konto |
| `lib/konto.mjs` | Anmeldung per Link (15 Minuten, einmal nutzbar), Sitzung 30 Tage; gespeichert werden nur Prüfsummen |
| `lib/pruefungen.mjs` | gespeicherte Prüfungen, Verlauf, Hinweise, CSV-Ausfuhr |
| `lib/ueberwachung.mjs` | prüft überwachte Prüfungen im Takt, meldet als Hinweis und per Mail; Uptime erst nach 2 Fehlversuchen |
| `lib/mailversand.mjs` | SMTP ohne Fremdpaket (TLS sofort oder STARTTLS) |
| `lib/speicher.mjs` | JSON-Ablage in `daten/` (atomar ersetzt, Schreibzugriffe nacheinander) |
| `public/` | Oberfläche: `basis.js` (Bausteine), `module.js` (Formular und Ergebnis je Werkzeug, für Website und Dashboard gemeinsam), `werkzeug.js`, `app.js` (Dashboard), `waechter.css` (Liquid Glass) |
| `test/selbsttest.mjs` | Ende-zu-Ende-Test gegen einen echten Serverlauf mit lokalem Prüf-SMTP-Server |

## Was ehrlich gesagt werden muss

- Rankings, Backlinks, die KI-Übersicht und KI-Fragen brauchen Fremddaten (siehe LIESMICH).
  Ohne Zugangsdaten sagen die Werkzeuge „Datenquelle nicht eingerichtet“ und schätzen nichts.
  Die Anbindungen in `lib/module/extern.mjs` sind ohne Zugang **nicht geprüft**.
- Google (seit 04.10.2026, `lib/module/google.mjs`, `lib/googlekonto.mjs`, `lib/tresor.mjs`):
  - PageSpeed im Audit, Search Console als kostenlose Ranking-Quelle für eigene Websites,
    Gemini mit dem kostenlosen Modell.
  - Programmable Search ist für neue Kunden geschlossen und endet am 01.01.2027; dafür gibt es
    keine Anbindung.
  - Backlinks liefert die Search-Console-Schnittstelle nicht.
  - Gegen echtes Google ist das nicht geprüft, weil keine Schlüssel vorliegen. Geprüft wird gegen
    einen nachgebauten Google-Server im Selbsttest.
- Uptime misst von einem Standort, dem Server des Wächters. Mehrere Standorte gibt es nicht.
- DKIM wird nicht kryptografisch nachgerechnet. Maßgeblich ist die Kopfzeile
  Authentication-Results des Empfängers; fehlt sie, prüft der Wächter Signatur und Schlüssel.
  SPF dagegen wertet er selbst aus.
- Eingefügte Mails werden nie gespeichert, auch mit Konto nicht (`eingabeBereinigen`).
- Grenzen in `lib/ausfuehren.mjs` und `lib/schutz.mjs` sind vorläufig.

## Prüfen vor jeder Auslieferung

1. `node test/selbsttest.mjs` muss mit 0 Fehlschlägen enden (Stand 04.10.2026: 82 Prüfungen).
2. `node ../bauen/selbsttest.mjs` (seo-rank.me, Stand 182 Prüfungen).
3. Im Browser: Vorschau `seo-waechter` (Port 4380, `admin/.claude/launch.json`).
   Startseite, ein Werkzeug ohne Anmeldung, Anmeldung über den Link im Entwicklungsmodus,
   Übernahme-Dialog, „Alles prüfen“, Prüfung im Detail, Bericht, iPhone-Breite.
4. Keine Fremdaufrufe: Der Selbsttest sucht in `public/` nach Adressen in src, href
   und url(). Inhaltsrichtlinie: `default-src 'self'`. Inline-Stile in HTML sind deshalb
   verboten; Stile werden nur per CSSOM in JS gesetzt.

## Qualität der Ergebnisse (04.10.2026)

- **Gesamtcheck** (`lib/module/gesamt.mjs`): Audit mit Ladezeit, Domain, Uptime, Mail-Schutz und
  KI-Sichtbarkeit gleichzeitig, dazu eine gemeinsame Maßnahmenliste. Auf der Startseite ist er
  voreingestellt.
- **Eigene Ladezeit-Messung** (`ladezeit.mjs`), ohne Google:
  - misst Gewicht, Anfragen, Kompression, Zwischenspeicher, blockierende Skripte, große Bilder,
    Fremdanbieter und kaputte Dateien;
  - höchstens 50 Dateien je Seite, je 4 gleichzeitig, um die geprüfte Website nicht zu belasten.
- **`lib/abruf.mjs`**:
  - Fehlermeldungen auf Deutsch.
  - Bei ungültigem Zertifikat wird die Seite trotzdem gelesen; der Mangel steht als kritischer
    Befund oben.
  - Status 429 heißt „Website bremst Abrufe“. Bei Uptime gilt die Website dann als erreichbar,
    nicht als Ausfall.
- **WHOIS** als Rückfall für Endungen ohne RDAP (`rdap.mjs`, etwa .me).
- **KI-Sichtbarkeit** bewertet 11 Signale; eine unerreichbare Website ergibt eine Fehlermeldung
  statt „alle dürfen lesen“.
- **Mail-Schutz**: DMARC einer Subdomain wird über die Hauptdomain ermittelt (sp=).
- Belastungsprobe über 15 sehr unterschiedliche Websites: Ablauf siehe Abschlussbericht vom 04.10.
- **Achtung, Drossel**: hnvr.me (Wix) antwortet nach vielen Prüfläufen kurz mit 429. Prüfläufe
  nicht unnötig gegen dieselbe Kunden-Website wiederholen. Der Domain-Check derselben Domain kann
  unter Drossel abweichen (gemessen 84 und 77 Punkte im Abstand weniger Minuten).

## Fallen

- `.haupt` ist die Klasse des Hauptknopfs. Die Dashboard-Fläche heißt `.app-haupt`
  (eine Verwechslung hat den Knopf am 04.10. auf 56 px aufgebläht).
- Im Entwicklungsmodus (`WAECHTER_DEV=1`) liefert der Server CSS und JS ohne Zwischenspeicher aus.
  Sonst gelten 5 Minuten, und der Browser zeigt nach Änderungen alte Stände.
- Patches nicht per `node -e` mit Regex in Bash-Anführungszeichen: Backslashes gehen verloren
  (am 04.10. im Selbsttest passiert, Prüfung schlug fälschlich fehl).
