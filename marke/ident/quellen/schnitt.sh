#!/usr/bin/env bash
# Setzt die vier Higgsfield-Shots zum Master zusammen und legt den Ton drunter.
# Erwartet shot1.mp4 .. shot4.mp4 (je 5 s, 1920x1080) im selben Ordner.
#
# Uebergaenge: 1->2 ist eine Blende (Shot 2 startet in einer 3D-Perspektive,
# ein harter Schnitt waere ein Sprung). 2->3 und 3->4 sind harte Schnitte —
# sie sind unsichtbar, weil das Endbild des einen Shots das Startbild des
# naechsten ist. Genau dafuer sind die Plates als end_image gesetzt.
set -euo pipefail
FF=${FF:-ffmpeg}
cd "$(dirname "$0")"

$FF -y -v error -i shot1.mp4 -i shot2.mp4 -i shot3.mp4 -i shot4.mp4 -filter_complex "\
[0:v]trim=0:5,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v1];\
[1:v]trim=0:5,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v2];\
[2:v]trim=0:5,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v3];\
[3:v]trim=0:5,setpts=PTS-STARTPTS,fps=24,format=yuv420p[v4];\
[v1][v2]xfade=transition=fade:duration=0.4:offset=4.6[x12];\
[x12][v3]concat=n=2:v=1:a=0[x123];\
[x123][v4]concat=n=2:v=1:a=0,fade=t=in:st=0:d=0.5[vout]" \
 -map "[vout]" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart .bild.mp4

$FF -y -v error -i .bild.mp4 -i ton.wav -map 0:v -map 1:a \
  -c:v copy -c:a aac -b:a 256k -movflags +faststart ../hnvr-me_ident_1080p.mp4

M=../hnvr-me_ident_1080p.mp4
$FF -y -v error -i $M -vf "scale=1080:608,pad=1080:1080:0:236:color=0x050506" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy -movflags +faststart ../hnvr-me_ident_1x1.mp4
$FF -y -v error -i $M -vf "scale=1080:608,pad=1080:1920:0:656:color=0x050506" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy -movflags +faststart ../hnvr-me_ident_9x16.mp4
$FF -y -v error -i $M -an -c:v libvpx-vp9 -crf 34 -b:v 0 -row-mt 1 -pix_fmt yuv420p ../hnvr-me_ident_web.webm
$FF -y -v error -sseof -0.3 -i $M -frames:v 1 ../hnvr-me_endcard.png
rm -f .bild.mp4
echo "fertig"
