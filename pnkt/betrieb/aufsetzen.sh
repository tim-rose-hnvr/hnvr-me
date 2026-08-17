#!/bin/sh
# Von einem leeren Ubuntu zum laufenden Dienst, in einem Befehl.
#
#   sudo ./aufsetzen.sh --domain pnkt.me --mail technik@hnvr.me
#
# Was geschieht: Benutzer und Verzeichnis anlegen, Binaer ablegen,
# systemd-Unit einrichten, Caddy davorsetzen, starten, pruefen.
#
# Der Lauf ist wiederholbar. Beim zweiten Mal wird das Binaer getauscht
# und neu gestartet; Daten bleiben unangetastet. Nichts wird geloescht.
#
# Optionen:
#   --domain NAME     Hostname, unter dem der Dienst erreichbar ist (Pflicht)
#   --mail ADRESSE    Adresse fuer die Zertifikatsstelle
#   --binaer PFAD     ein bereits gebautes Binaer statt des Downloads
#   --landkopf NAME   Kopf mit der Laenderkennung; leer schaltet die Regel ab
#   --ohne-caddy      nur den Dienst, keinen vorgelagerten Server
#   --probe           nur zeigen, was geschehen wuerde
set -eu

DOMAIN=""
MAIL=""
BINAER=""
LANDKOPF=""
OHNE_CADDY=0
PROBE=0
REPO="tim-rose-hnvr/hnvr-me"

while [ $# -gt 0 ]; do
	case "$1" in
	--domain) DOMAIN="$2"; shift 2 ;;
	--mail) MAIL="$2"; shift 2 ;;
	--binaer) BINAER="$2"; shift 2 ;;
	--landkopf) LANDKOPF="$2"; shift 2 ;;
	--ohne-caddy) OHNE_CADDY=1; shift ;;
	--probe) PROBE=1; shift ;;
	-h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
	*) echo "unbekannte Option: $1" >&2; exit 2 ;;
	esac
done

sage() { printf '  %s\n' "$*"; }
schritt() { printf '\n%s\n' "$*"; }
tu() {
	if [ "$PROBE" -eq 1 ]; then printf '  [probe] %s\n' "$*"; else eval "$@"; fi
}

[ -n "$DOMAIN" ] || { echo "--domain fehlt. Ohne Hostnamen gibt es kein Zertifikat." >&2; exit 2; }
if [ "$PROBE" -eq 0 ] && [ "$(id -u)" -ne 0 ]; then
	echo "Bitte mit sudo starten." >&2; exit 2
fi

# Der Hostname steht spaeter im GS1 Digital Link und damit auf gedruckten
# Etiketten. Ein Tippfehler hier kostet eine Auflage, deshalb einmal laut.
schritt "pnkt aufsetzen"
sage "Domain     $DOMAIN"
sage "Host       https://$DOMAIN   (steht im Digital Link, auf Etiketten)"
sage "Landkopf   ${LANDKOPF:-<keiner, Landregel aus>}"
sage "Caddy      $([ "$OHNE_CADDY" -eq 1 ] && echo nein || echo ja)"

# --- Architektur ----------------------------------------------------------
case "$(uname -m)" in
x86_64) ARCH=amd64 ;;
aarch64|arm64) ARCH=arm64 ;;
*) echo "nicht unterstuetzte Architektur: $(uname -m)" >&2; exit 1 ;;
esac

# --- Binaer besorgen ------------------------------------------------------
schritt "1 · Binaer"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ -n "$BINAER" ]; then
	[ -f "$BINAER" ] || { echo "kein Binaer unter $BINAER" >&2; exit 1; }
	sage "aus $BINAER"
	tu "cp '$BINAER' '$TMP/pnkt'"
else
	URL="https://github.com/$REPO/releases/latest/download/pnkt-linux-$ARCH"
	sage "lade $URL"
	if [ "$PROBE" -eq 0 ] && ! curl -fsSL "$URL" -o "$TMP/pnkt"; then
		cat >&2 <<'ENDE'

Es gibt noch keine Freigabe zum Herunterladen. Zwei Wege:

  1. Selbst bauen und uebergeben:
       cd pnkt && go build -o pnkt . && sudo betrieb/aufsetzen.sh --binaer ./pnkt --domain …

  2. Eine Freigabe anlegen — danach passt die Adresse von selbst:
       git tag pnkt-v1.0.0 && git push origin pnkt-v1.0.0

Das gebaute Binaer liegt auch bei jedem Werkstattlauf als Anhang:
https://github.com/tim-rose-hnvr/hnvr-me/actions/workflows/pnkt.yml
ENDE
		exit 1
	fi
	# Die Pruefsumme liegt neben dem Binaer. Fehlt sie, wird nicht
	# geraten — dann bricht der Lauf lieber ab.
	tu "curl -fsSL '$URL.sha256' -o '$TMP/pnkt.sha256'"
	if [ "$PROBE" -eq 0 ]; then
		( cd "$TMP" && sed "s#pnkt-linux-$ARCH#pnkt#" pnkt.sha256 | sha256sum -c - ) \
			|| { echo "Pruefsumme stimmt nicht — Abbruch." >&2; exit 1; }
		sage "Pruefsumme stimmt"
	fi
fi
tu "chmod 0755 '$TMP/pnkt'"

# --- Benutzer und Verzeichnisse -------------------------------------------
schritt "2 · Benutzer und Ablage"
if id pnkt >/dev/null 2>&1; then
	sage "Benutzer pnkt gibt es schon"
else
	tu "useradd --system --home-dir /var/lib/pnkt --shell /usr/sbin/nologin pnkt"
	sage "Benutzer pnkt angelegt"
fi
tu "install -d -o pnkt -g pnkt -m 0750 /var/lib/pnkt /var/lib/pnkt/daten"
tu "install -d -m 0755 /opt/pnkt"

# --- Dienst ---------------------------------------------------------------
schritt "3 · Dienst"
# Erst anhalten, dann tauschen: ein laufendes Binaer laesst sich unter
# Linux zwar ersetzen, aber der alte Stand liefe bis zum Neustart weiter.
if systemctl is-active --quiet pnkt 2>/dev/null; then
	tu "systemctl stop pnkt"
	sage "laufenden Dienst angehalten"
fi
tu "install -o root -g root -m 0755 '$TMP/pnkt' /opt/pnkt/pnkt"

HIER="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$HIER/pnkt.service" ]; then
	tu "install -m 0644 '$HIER/pnkt.service' /etc/systemd/system/pnkt.service"
else
	echo "pnkt.service liegt nicht neben diesem Skript" >&2; exit 1
fi

# Die Unit traegt Platzhalterwerte; hier kommen die echten hinein.
tu "sed -i 's#-host https://pnkt.me#-host https://$DOMAIN#' /etc/systemd/system/pnkt.service"
if [ -z "$LANDKOPF" ]; then
	tu "sed -i 's#-landkopf CF-IPCountry#-landkopf \"\"#' /etc/systemd/system/pnkt.service"
else
	tu "sed -i 's#-landkopf CF-IPCountry#-landkopf $LANDKOPF#' /etc/systemd/system/pnkt.service"
fi

tu "systemctl daemon-reload"
tu "systemctl enable --now pnkt"
sage "Dienst laeuft auf 127.0.0.1:8080"

# --- Vorgelagerter Server -------------------------------------------------
if [ "$OHNE_CADDY" -eq 0 ]; then
	schritt "4 · Caddy"
	if command -v caddy >/dev/null 2>&1; then
		sage "Caddy ist schon da"
	else
		tu "apt-get update -qq"
		tu "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg"
		tu "curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg"
		tu "curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null"
		tu "apt-get update -qq"
		tu "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq caddy"
		sage "Caddy eingerichtet"
	fi

	if [ "$PROBE" -eq 0 ]; then
		# Kein Ueberschreiben einer bestehenden Datei ohne Sicherung.
		if [ -f /etc/caddy/Caddyfile ] && ! grep -q "# von pnkt/betrieb/aufsetzen.sh" /etc/caddy/Caddyfile; then
			cp /etc/caddy/Caddyfile "/etc/caddy/Caddyfile.vorher-$(date -u +%Y%m%dT%H%M%SZ)"
			sage "bestehende Caddyfile gesichert"
		fi
		cat > /etc/caddy/Caddyfile <<CADDY
# von pnkt/betrieb/aufsetzen.sh
$( [ -n "$MAIL" ] && printf '{\n\temail %s\n}\n' "$MAIL" )
$DOMAIN {
	encode zstd gzip
	reverse_proxy 127.0.0.1:8080 {
		transport http {
			dial_timeout 2s
			response_header_timeout 5s
		}
	}
	# Die Weiterleitung darf nirgends zwischengespeichert werden: das
	# Ziel eines gedruckten Codes kann sich morgen aendern.
	@kurz path_regexp ^/[0-9a-z]{4,12}\$
	header @kurz Cache-Control "no-store"
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "no-referrer"
		-Server
	}
}
CADDY
		caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null \
			|| { echo "Caddyfile fehlerhaft — Abbruch." >&2; exit 1; }
		systemctl reload caddy 2>/dev/null || systemctl restart caddy
		sage "Caddy neu geladen"
	fi
fi

# --- Sicherung ------------------------------------------------------------
schritt "5 · Taegliche Sicherung"
if [ -f "$HIER/sichern.sh" ]; then
	tu "install -m 0755 '$HIER/sichern.sh' /usr/local/bin/pnkt-sichern"
	tu "systemd-run --on-calendar=daily --unit=pnkt-sicherung --collect /usr/local/bin/pnkt-sichern >/dev/null 2>&1 || true"
	sage "pnkt-sichern taeglich"
fi

# --- Pruefen --------------------------------------------------------------
schritt "6 · Pruefen"
if [ "$PROBE" -eq 1 ]; then
	sage "Probe beendet — es wurde nichts geaendert."
	exit 0
fi

erreicht=0
for i in $(seq 1 40); do
	if curl -fsS "http://127.0.0.1:8080/gesundheit" >/dev/null 2>&1; then erreicht=1; break; fi
	sleep 0.5
done
[ "$erreicht" -eq 1 ] || { echo "Der Dienst antwortet nicht. journalctl -u pnkt -n 50" >&2; exit 1; }
sage "oertlich: $(curl -fsS http://127.0.0.1:8080/gesundheit)"

if [ "$OHNE_CADDY" -eq 0 ]; then
	# Von aussen kann es dauern, bis das Zertifikat da ist. Ein Fehlschlag
	# hier ist kein Grund, den Lauf abzubrechen — aber er wird gesagt.
	if curl -fsS --max-time 20 "https://$DOMAIN/gesundheit" >/dev/null 2>&1; then
		sage "von aussen: https://$DOMAIN/gesundheit antwortet"
	else
		sage "von aussen noch nicht erreichbar — zeigt der A-Eintrag von $DOMAIN hierher?"
		sage "Caddy holt das Zertifikat erst, wenn er ueber Port 80 erreichbar ist."
	fi
fi

schritt "Fertig"
sage "Studio      https://$DOMAIN/"
sage "Zentrale    https://$DOMAIN/zentrale"
sage "Zustand     systemctl status pnkt"
sage "Protokoll   journalctl -u pnkt -f"
printf '\n'
sage "Erstes Konto anlegen:"
sage "  curl -X POST https://$DOMAIN/api/v1/konten \\"
sage "    -d '{\"name\":\"…\",\"mail\":\"…\",\"passwort\":\"mindestens zehn Zeichen\"}'"
