#!/usr/bin/env bash
# Setzt die 16 Shots, das Titelfinale, die Bereichs-Einblendungen und den Ton
# zum Film zusammen. Alle Schnitte sind hart: das Endbild eines Shots ist das
# Startbild des naechsten, deshalb sieht man sie nicht.
#
# Erwartet:
#   shots/s01.mp4 .. shots/s16.mp4   je 5 s, 1920x1080 (siehe shots.md)
#   titel.mp4                        14 s (siehe titel.html / titel-bild.sh)
#   marken/m01.png .. m12.png        (marken.sh)
#   ton_reise.wav                    (ton.sh)
set -euo pipefail
FF=${FF:-ffmpeg}
cd "$(dirname "$0")"

# --- Bild: 16 x 5 s + 14 s Titel = 94 s ------------------------------------
KETTE=""
for i in $(seq -w 1 16); do KETTE="$KETTE[$((10#$i-1)):v]trim=0:5,setpts=PTS-STARTPTS,fps=24,scale=1920:1080,format=yuv420p[v$i];"; done
VERB=""
for i in $(seq -w 1 16); do VERB="$VERB[v$i]"; done
VERB="$VERB[t]concat=n=17:v=1:a=0[roh];"

$FF -y -v error \
 -i shots/s01.mp4 -i shots/s02.mp4 -i shots/s03.mp4 -i shots/s04.mp4 \
 -i shots/s05.mp4 -i shots/s06.mp4 -i shots/s07.mp4 -i shots/s08.mp4 \
 -i shots/s09.mp4 -i shots/s10.mp4 -i shots/s11.mp4 -i shots/s12.mp4 \
 -i shots/s13.mp4 -i shots/s14.mp4 -i shots/s15.mp4 -i shots/s16.mp4 \
 -i titel.mp4 \
 -filter_complex "$KETTE[16:v]fps=24,scale=1920:1080,format=yuv420p[t];$VERB\
[roh]noise=alls=5:allf=t+u,fade=t=in:st=0:d=0.6[vout]" \
 -map "[vout]" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart .bild.mp4

# --- Bereichs-Einblendungen -------------------------------------------------
# Jede Marke: Nummer, Startzeit und Standzeit in Sekunden.
MARKEN=( "01 25.6 2.0" "02 27.9 2.0" "03 30.8 3.4" "04 35.6 2.0" "05 37.9 2.0"
         "06 45.8 3.4" "07 50.8 3.4" "08 55.8 3.4" "09 60.8 3.4" "10 65.8 3.4"
         "11 70.8 3.4" "12 75.8 3.4" )
EIN=""; FIL=""; UEB="[0:v]"; n=0
for m in "${MARKEN[@]}"; do
  set -- $m; nr=$1; st=$2; du=$3; n=$((n+1))
  EIN="$EIN -loop 1 -t $du -i marken/m$nr.png"
  aus=$(python3 -c "print(max(0,$du-0.45))")
  FIL="$FIL[$n:v]crop=1200:200:0:60,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=$aus:d=0.45:alpha=1,setpts=PTS-STARTPTS+$st/TB[m$nr];"
  bis=$(python3 -c "print($st+$du)")
  FIL="$FIL${UEB}[m$nr]overlay=140:840:enable='between(t,$st,$bis)'[o$nr];"
  UEB="[o$nr]"
done
FIL="$FIL${UEB}null[vout]"

$FF -y -v error -i .bild.mp4 $EIN -filter_complex "$FIL" \
  -map "[vout]" -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -movflags +faststart .bild_marken.mp4

# --- Ton drunter ------------------------------------------------------------
$FF -y -v error -i .bild_marken.mp4 -i ton_reise.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 256k -movflags +faststart .master_gross.mp4

# --- Auslieferung -----------------------------------------------------------
# Der eingerechnete Korn frisst Bitrate: der Zwischenstand liegt bei rund
# 20 Mbit/s. Deshalb ein Master mit gedeckelter Rate und eine entrauschte
# Versandfassung, die unter 30 MB bleibt.
$FF -y -v error -i .master_gross.mp4 -c:v libx264 -preset slow -crf 22 -tune grain \
  -maxrate 9M -bufsize 18M -pix_fmt yuv420p -c:a copy -movflags +faststart hnvr-me_reise_1080p.mp4

$FF -y -v error -i hnvr-me_reise_1080p.mp4 -vf "hqdn3d=2:2:7:7" -c:v libx264 -preset slow \
  -b:v 2150k -maxrate 3000k -bufsize 5000k -pass 1 -an -f mp4 /dev/null
$FF -y -v error -i hnvr-me_reise_1080p.mp4 -vf "hqdn3d=2:2:7:7" -c:v libx264 -preset slow \
  -b:v 2150k -maxrate 3000k -bufsize 5000k -pass 2 -pix_fmt yuv420p -c:a aac -b:a 128k \
  -movflags +faststart hnvr-me_reise_1080p_versand.mp4
rm -f ffmpeg2pass*

M=hnvr-me_reise_1080p.mp4
$FF -y -v error -i $M -vf "scale=1080:608,pad=1080:1920:0:656:color=0x050506" \
  -c:v libx264 -preset slow -crf 23 -tune grain -pix_fmt yuv420p -c:a copy -movflags +faststart hnvr-me_reise_9x16.mp4
$FF -y -v error -i $M -vf "scale=1080:608,pad=1080:1080:0:236:color=0x050506" \
  -c:v libx264 -preset slow -crf 23 -tune grain -pix_fmt yuv420p -c:a copy -movflags +faststart hnvr-me_reise_1x1.mp4
$FF -y -v error -i $M -vf "scale=1280:720" -c:v libx264 -preset slow -crf 26 -tune grain \
  -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart hnvr-me_reise_720p_web.mp4
$FF -y -v error -sseof -3.4 -i $M -frames:v 1 hnvr-me_reise_endcard.png

rm -f .bild.mp4 .bild_marken.mp4 .master_gross.mp4
echo "fertig: hnvr-me_reise_1080p.mp4"
