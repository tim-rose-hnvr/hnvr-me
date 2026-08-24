#!/usr/bin/env bash
# Rendert ein Einzelbild der Titelsequenz nach bilder/fNNNN.png.
# Der Pfad muss absolut sein — file://. ist keine gueltige URL, Chromium
# liefert dann seine Fehlerseite statt der Seite.
#
#   mkdir -p bilder
#   seq 0 335 | xargs -P 6 -I{} ./titel-bild.sh {}
#
CH=${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
d=$(cd "$(dirname "$0")" && pwd)
printf -v n "%04d" "$1"
"$CH" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1920,1080 \
  --screenshot="$d/bilder/f$n.png" --virtual-time-budget=900 "file://$d/titel.html?f=$1" 2>/dev/null
