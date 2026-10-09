# SEO Wächter

Neun kostenlose SEO-Werkzeuge, jedes ohne Anmeldung nutzbar. Mit einem kostenlosen
Konto werden alle Ergebnisse gespeichert, überwacht und als Bericht ausgegeben.
Node 18 oder neuer, keine Fremdpakete.

## Starten

```bash
node server.mjs --port 4380
```

Der Wächter liegt im Ordner `SEO/` und nutzt dessen Prüfwerk (`../cli`, `../site/assets/js`).
Er muss deshalb zusammen mit diesem Ordner ausgeliefert werden.

## Umgebung

| Variable | Zweck | ohne |
|---|---|---|
| `PORT` | Port | 4380 |
| `WAECHTER_BASIS` | öffentliche Adresse für kanonische Links und Sitemap, z. B. `https://seo.hnvr.me` | Adresse aus der Anfrage |
| `WAECHTER_DATEN` | Ordner für Konten und Prüfungen | `daten/` |
| `WAECHTER_STANDORT` | Name des Messorts bei Uptime | „Server des Wächters“ |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ABSENDER` | Anmeldelinks und Alarme per Mail (Port 465 TLS, 587 STARTTLS) | Links und Alarme nur im Serverprotokoll; anmelden geht dann nur mit Zugriff aufs Protokoll |
| `GOOGLE_API_KEY` | PageSpeed Insights im Audit (Ladezeit, Core Web Vitals echter Nutzer); kostenlos | Karte „nicht gemessen“; ohne Schlüssel ist Googles gemeinsames Kontingent erschöpft (gemessen 04.10.2026: 429) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Search Console je Konto verbinden: echte Positionen, Klicks, Impressionen der eigenen Websites; kostenlos. Weiterleitungsadresse in der Google Cloud: `<WAECHTER_BASIS>/google/rueckruf`, Bereich `webmasters.readonly` | Rankings nur mit DataForSEO |
| `WAECHTER_GEHEIMNIS` | Schlüssel für die Verschlüsselung der Google-Token | Datei `daten/geheimnis.key`, beim ersten Start erzeugt |
| `GEMINI_API_KEY` (`GEMINI_MODELL`, Standard `gemini-2.5-flash`) | KI-Frage an Gemini mit Google-Suche; laut Preisseite 04.10.2026 bis 1.500 Abfragen am Tag frei | Gemini fehlt bei den KI-Fragen |
| `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORT` | Rankings, Backlinks, KI-Übersicht, Top-10-Vergleich im Content | Werkzeug meldet „Datenquelle nicht eingerichtet“ |
| `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY` (+ `_MODELL`) | KI-Fragen an ChatGPT, Gemini, Perplexity | nur der Zugangs-Teil der KI-Sichtbarkeit läuft |
| `WAECHTER_DEV=1` | Entwicklungsmodus: Anmeldelink direkt auf der Seite, kein Zwischenspeicher | aus |
| `WAECHTER_UEBERWACHUNG=0` | Überwachung abschalten | an, alle 30 s |

Hinter einem Proxy muss `x-forwarded-proto: https` gesetzt werden. Erst dann bekommt
das Sitzungs-Cookie `Secure`.

## Prüfen

```bash
node test/selbsttest.mjs
```

Startet einen eigenen Serverlauf mit leerer Datenablage und einem lokalen Prüf-Mailserver
und braucht Netz. Stand 04.10.2026: 82 Prüfungen, 0 gescheitert.

## Werkzeuge und Datenquellen

| Werkzeug | gemessen von | braucht Fremddaten |
|---|---|---|
| Website-Audit | Regelkatalog von seo-rank.me (158 Regeln), eigener Crawler | nein |
| Domain-Check | 48 Domain-Regeln, DNS, TLS, RDAP der Registry | nein |
| Uptime | Abruf mit Zeit je Abschnitt, ALPN für HTTP/2, Zertifikat | nein |
| Mail-Prüfer | MIME-Zerlegung, eigene SPF-Auswertung, DNS, Sperrlisten (Spamhaus, SpamCop, PSBL) | nein |
| Content | Stellen, Dichte, Lesbarkeit, Snippet in Pixeln, WDF·IDF gegen angegebene Seiten | nur für den automatischen Top-10-Vergleich |
| KI-Sichtbarkeit | robots.txt für 11 KI-Crawler, llms.txt, strukturierte Daten | für Fragen an die KI-Dienste |
| Konkurrenz | Audit, Abruf und KI-Zugang je Domain nebeneinander | nein |
| Rankings | eigene Websites: Google Search Console (kostenlos, mit Konto) | für fremde Websites und genaue Plätze ja (DataForSEO) |
| Backlinks | | ja (DataForSEO) |
