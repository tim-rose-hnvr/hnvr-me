#!/usr/bin/env bash
# Sounddesign, vollstaendig synthetisch aus ffmpeg-Quellen erzeugt.
# Kein Sample, keine Bibliothek, kein Netz. Laenge 19,58 s.
#
# Zeitachse (folgt dem Schnitt):
#   0,00-4,85  Riser, waehrend die Funken einfliegen
#   4,85       Einschlag, Signet rastet ein
#   9,60-14,55 zweiter Riser, dazu vier Ticks als Buchstabenmechanik
#   14,55      Haupteinschlag, Schriftzug steht
#   17,30-19,58 Ausklang
set -euo pipefail
FF=${FF:-ffmpeg}
cd "$(dirname "$0")"
D=19.58

$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=5:a=0.6:r=48000" \
  -af "highpass=f=900,lowpass=f=9000,volume='pow(t/5,3.0)':eval=frame" .riser.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.22*sin(2*PI*(180*t+70*t*t))*pow(t/5,2.6)':s=48000:d=5" .tone.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.95*sin(2*PI*(85*t-15*t*t))*exp(-2.4*t)':s=48000:d=2.4" .sub.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=0.9:a=0.9:r=48000" \
  -af "highpass=f=2500,volume='exp(-14*t)':eval=frame" .click.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.45*sin(2*PI*1850*t)*exp(-38*t)+0.28*sin(2*PI*3120*t)*exp(-52*t)':s=48000:d=0.35" .tick.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=brown:d=$D:a=0.35:r=48000" -af "lowpass=f=140,volume=0.5" .rumble.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.055*(sin(2*PI*110*t)+0.8*sin(2*PI*164.8*t)+0.5*sin(2*PI*220.4*t)+0.3*sin(2*PI*329.2*t))*(0.8+0.2*sin(2*PI*0.13*t))':s=48000:d=$D" .pad.wav

$FF -y -v error \
 -i .rumble.wav -i .pad.wav -i .riser.wav -i .tone.wav -i .sub.wav -i .click.wav -i .tick.wav \
 -filter_complex "\
[2]asplit=2[rA][rB0];[rB0]adelay=9600:all=1[rB];\
[3]asplit=2[tA][tB0];[tB0]adelay=9600:all=1[tB];\
[4]asplit=2[s0][s1];[s0]adelay=4850:all=1,volume=0.55[sA];[s1]adelay=14550:all=1,volume=1.0[sB];\
[5]asplit=2[c0][c1];[c0]adelay=4850:all=1,volume=0.30[cA];[c1]adelay=14550:all=1,volume=0.55[cB];\
[6]asplit=4[k0][k1][k2][k3];\
[k0]adelay=10900:all=1[kA];[k1]adelay=11900:all=1[kB];[k2]adelay=12900:all=1[kC];[k3]adelay=13700:all=1[kD];\
[0][1][rA][rB][tA][tB][sA][sB][cA][cB][kA][kB][kC][kD]amix=inputs=14:normalize=0:duration=longest[mx];\
[mx]aecho=0.75:0.55:190|430:0.26|0.14,alimiter=limit=0.94,\
afade=t=in:st=0:d=1.2,afade=t=out:st=17.3:d=2.28,atrim=0:$D,\
aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[out]" \
 -map "[out]" -c:a pcm_s16le ton.wav
rm -f .riser.wav .tone.wav .sub.wav .click.wav .tick.wav .rumble.wav .pad.wav
echo "ton.wav"
