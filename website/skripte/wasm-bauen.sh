#!/bin/sh
# Baut den pnkt-Kern nach WebAssembly und legt ihn in public/wasm.
#
# Warum: einen Code zu bauen braucht keinen Server — kodieren, formen,
# beurteilen, ausgeben ist eine Rechnung ohne Zustand. Sie lief bisher
# auf dem Server, weil einer da war. Es ist keiner da. Also läuft
# derselbe Go-Code im Browser, statt ihn ein zweites Mal in JavaScript
# zu schreiben.
#
# Zwei Dateien entstehen:
#   pnkt.wasm      der Kern, rund 3,4 MB (etwa 0,9 MB über die Leitung)
#   wasm_exec.js   das Laufzeitgeruest, kommt unverändert aus der
#                  Go-Installation und gehört zu genau dieser Go-Version
#
# Beide liegen unter public/wasm und damit außerhalb von Git — sie
# entstehen aus dem Quelltext und würden bei jedem Bau neu auftauchen.
set -e
cd "$(dirname "$0")/.."

ziel=public/wasm
mkdir -p "$ziel"

goroot=$(go env GOROOT)
geruest="$goroot/lib/wasm/wasm_exec.js"
[ -f "$geruest" ] || geruest="$goroot/misc/wasm/wasm_exec.js"
if [ ! -f "$geruest" ]; then
  echo "wasm_exec.js nicht gefunden in $goroot — welche Go-Version ist das?" >&2
  exit 1
fi

echo "Kern übersetzen …"
(cd ../pnkt && GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o "$OLDPWD/$ziel/pnkt.wasm" ./cmd/wasm)
cp "$geruest" "$ziel/wasm_exec.js"

groesse=$(wc -c < "$ziel/pnkt.wasm")
printf '%s  %.1f MB\n' "$ziel/pnkt.wasm" "$(echo "$groesse" | awk '{print $1/1048576}')"
printf '%s  (aus %s)\n' "$ziel/wasm_exec.js" "$goroot"
