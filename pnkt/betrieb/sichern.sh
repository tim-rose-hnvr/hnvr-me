#!/bin/sh
# Sichern heisst hier: das Datenverzeichnis kopieren. Mehr ist es nicht.
#
#   ./sichern.sh /var/lib/pnkt/daten /var/backups/pnkt
#
# Die Dateien werden nur angehaengt. Eine Kopie waehrend des Betriebs
# kann deshalb hoechstens eine halb geschriebene letzte Zeile erwischen —
# und die ueberspringt pnkt beim Laden. Anhalten muss man dafuer nichts.
set -eu

QUELLE="${1:-/var/lib/pnkt/daten}"
ZIEL="${2:-/var/backups/pnkt}"
STAND="$(date -u +%Y-%m-%dT%H%M%SZ)"

[ -d "$QUELLE" ] || { echo "kein Datenverzeichnis: $QUELLE" >&2; exit 1; }
mkdir -p "$ZIEL"

tar -czf "$ZIEL/pnkt-$STAND.tar.gz" -C "$(dirname "$QUELLE")" "$(basename "$QUELLE")"
echo "gesichert: $ZIEL/pnkt-$STAND.tar.gz"

# Eine Sicherung, die nie geprueft wurde, ist keine. Der Selbsttest:
# auspacken und zaehlen, ob die Codes noch da sind.
PRUEF="$(mktemp -d)"
trap 'rm -rf "$PRUEF"' EXIT
tar -xzf "$ZIEL/pnkt-$STAND.tar.gz" -C "$PRUEF"
ZEILEN="$(wc -l < "$PRUEF/$(basename "$QUELLE")/codes.jsonl" 2>/dev/null || echo 0)"
echo "geprueft: $ZEILEN Fassungen in codes.jsonl"
[ "$ZEILEN" -gt 0 ] || echo "WARNUNG: die Sicherung enthaelt keine Codes" >&2

# Aeltere als 30 Tage weg. Wer laenger aufheben will, aendert die Zahl —
# die Dateien sind klein, Text und gzip.
find "$ZIEL" -name 'pnkt-*.tar.gz' -mtime +30 -delete
