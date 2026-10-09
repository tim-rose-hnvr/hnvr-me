# SEO Wächter · Auslieferung auf hnvr.me

Stand 09.10.2026. Noch **nicht** live.

## Warum nicht bei Wix

hnvr.me läuft bei Wix. Der Wächter ist ein dauerhaft laufender Node-Server:
er braucht `node:dns`, `node:net`, `node:tls` (Domain-Check, Uptime, SMTP,
Sperrlisten), eine beschreibbare Ablage (`WAECHTER_DATEN`) und einen Takt
für die Überwachung alle 30 s. Die Wix-Laufzeit (Worker) bietet nichts davon.
Er braucht deshalb einen eigenen Rechner, erreichbar als Subdomain,
vorgesehen `seo.hnvr.me` (so steht es schon in `LIESMICH.md`).

## Schritte

Entschieden am 09.10.2026: eine kleine VM (Ubuntu 24.04). Kurzweg:
`bash waechter/betrieb/einrichten.sh` aus `seo/` auf der VM. Das Skript
installiert Podman und Caddy, baut den Container und richtet beide als
Dienst ein (`betrieb/seo-waechter.container`, `betrieb/Caddyfile`).
Die Schritte im Einzelnen:


1. Rechner mit Node 22 oder Podman/Docker (kleine VM reicht).
2. Bauen und starten aus `seo/`, siehe Kopf von `Containerfile`.
   Die Ablage `/daten` liegt auf einem Volume, sonst sind Konten nach jedem
   Neustart weg.
3. Davor ein Proxy mit TLS (Caddy, nginx). Er muss
   `x-forwarded-proto: https` setzen und `x-forwarded-for` **überschreiben**,
   nicht anhängen: Der Server nimmt den ersten Eintrag als Adresse für die
   Tagesgrenzen, ein mitgeschickter Kopf würde sie sonst aushebeln.
4. DNS bei Wix: `seo.hnvr.me` als A- oder CNAME-Eintrag auf diesen Rechner.
5. Umgebung (`waechter.env`, nie ins Repo):
   - Pflicht: `WAECHTER_BASIS=https://seo.hnvr.me`
   - Für Anmeldung per Mail: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
     `SMTP_PASS`, `SMTP_ABSENDER`. Ohne SMTP kann sich niemand anmelden.
   - Empfohlen: `GOOGLE_API_KEY` (PageSpeed), `WAECHTER_GEHEIMNIS`.
   - Optional: Search Console, Gemini, DataForSEO, OpenAI, Perplexity
     (Tabelle in `LIESMICH.md`).
6. Abnahme nach dem Start, auf dem Server selbst (braucht Netz):
   `node waechter/test/selbsttest.mjs` muss 0 Fehlschläge melden, danach
   der Rundgang aus `CLAUDE.md`, Abschnitt „Prüfen vor jeder Auslieferung“.
