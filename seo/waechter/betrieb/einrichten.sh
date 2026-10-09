#!/usr/bin/env bash
# Richtet den SEO Wächter auf einer frischen Ubuntu-VM (24.04) ein.
# Aufruf als root aus seo/ heraus:  bash waechter/betrieb/einrichten.sh
# Danach fehlt nur noch /etc/seo-waechter/waechter.env (Vorlage: waechter.env.beispiel).
set -euo pipefail
cd "$(dirname "$0")/../.."

apt-get update
apt-get install -y podman caddy

podman build -f waechter/Containerfile -t seo-waechter .

install -d -m 700 /etc/seo-waechter
if [ ! -f /etc/seo-waechter/waechter.env ]; then
  install -m 600 waechter/betrieb/waechter.env.beispiel /etc/seo-waechter/waechter.env
  echo "Bitte /etc/seo-waechter/waechter.env ausfüllen und das Skript erneut starten."
  exit 1
fi

install -m 644 waechter/betrieb/seo-waechter.container /etc/containers/systemd/
install -m 644 waechter/betrieb/Caddyfile /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl restart seo-waechter caddy
systemctl --no-pager status seo-waechter | head -5

# Abnahme: muss 0 Fehlschläge melden.
podman run --rm seo-waechter node waechter/test/selbsttest.mjs
