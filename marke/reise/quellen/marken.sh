#!/usr/bin/env bash
# Rendert die zwoelf Bereichs-Einblendungen als transparente PNGs.
set -euo pipefail
CH=${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
d=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$d/marken"
i=0
for s in "Copywriting" "Branding" "Grafikdesign" "Digital Marketing" "Websites" \
         "Webdesign" "Programmierung" "SEO" "Werbung & Kampagnen" \
         "Fotografie & Videoproduktion" "Software" "Apps & KI"; do
  i=$((i+1)); printf -v n "%02d" $i
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$s")
  "$CH" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size=1200,300 --screenshot="$d/marken/m$n.png" --virtual-time-budget=900 \
    "file://$d/marke.html?s=$enc" 2>/dev/null
  echo "m$n = $s"
done
