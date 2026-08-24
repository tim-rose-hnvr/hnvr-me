#!/usr/bin/env bash
# Erzeugt die drei Keyframe-Plates (1920x1080), die Higgsfield als
# start_image/end_image bekommt. Ohne Netz: Chromium rendert das SVG.
set -euo pipefail
CHROME=${CHROME:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
cd "$(dirname "$0")"

rahmen () { # $1 Name  $2 Breite des Logos in px  $3 SVG (leer = kein Logo)
  cat > ".f_$1.html" <<HTML
<html><head><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1920px;height:1080px;overflow:hidden;background:#050506}
.bg{position:fixed;inset:0;background:radial-gradient(ellipse 90% 70% at 50% 50%,#17161a 0%,#0a0a0c 62%,#050506 100%)}
.g{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:1500px;height:700px;
   background:radial-gradient(ellipse at center,rgba(250,106,40,.13),transparent 66%)}
.w{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
img{width:${2}px;height:auto;filter:drop-shadow(0 0 90px rgba(250,106,40,.22))}
</style></head><body><div class="bg"></div><div class="g"></div>
${3:+<div class="w"><img src="$3"></div>}</body></html>
HTML
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
    --window-size=1920,1080 --screenshot="plate-$1.png" --virtual-time-budget=3000 ".f_$1.html" 2>/dev/null
  rm -f ".f_$1.html"
}

rahmen lockup 1150 logo-lockup.svg   # Endstand: vollstaendiges Logo
rahmen signet  250 signet.svg        # Zwischenstand: nur Signet
rahmen leere     0 ""                # Startbild: leerer Raum
echo "plate-lockup.png plate-signet.png plate-leere.png"
