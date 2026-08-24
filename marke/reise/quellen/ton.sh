#!/usr/bin/env bash
# Sounddesign des Films, vollstaendig synthetisch aus ffmpeg-Generatoren.
# Kein Sample, keine Bibliothek, kein Netz. Laenge 94 s.
#
# Aufbau:
#   0-20   Stadt: Wind, weite Flaeche, leichte Wuschs an den Schnitten
#   20-45  Agentur: Puls ab 24 s, Hut ab 30 s, Einschlag beim Fensterdurchflug (25 s)
#   45-80  Digitale Welten: dichter Puls, Einschlaege bei 45 s und 75 s
#   80-94  Titel: Riser bis 84 s, Einschlaege 84 / 87,5 / 89 s, Ausklang
set -euo pipefail
FF=${FF:-ffmpeg}
cd "$(dirname "$0")"
D=94

$FF -y -v error -f lavfi -i "anoisesrc=color=brown:d=$D:a=0.4:r=48000" \
  -af "lowpass=f=120,volume='0.35+0.35*min(1,t/40)':eval=frame" .rumpeln.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.075*(sin(2*PI*55*t)+0.85*sin(2*PI*82.4*t)+0.6*sin(2*PI*110*t)+0.35*sin(2*PI*164.8*t))*(0.82+0.18*sin(2*PI*0.07*t))':s=48000:d=$D" \
  -af "afade=t=in:st=0:d=3,afade=t=out:st=44:d=7" .padA.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.055*(sin(2*PI*110*t)+0.8*sin(2*PI*164.8*t)+0.65*sin(2*PI*220*t)+0.45*sin(2*PI*329.6*t)+0.25*sin(2*PI*415.3*t))*(0.8+0.2*sin(2*PI*0.11*t))':s=48000:d=$D" \
  -af "afade=t=in:st=42:d=8,afade=t=out:st=79:d=1.4" .padB.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=pink:d=26:a=0.6:r=48000" \
  -af "bandpass=f=760:width_type=o:w=2.2,volume='0.5*(0.4+0.6*sin(2*PI*0.055*t)^2)':eval=frame,afade=t=in:st=0:d=2,afade=t=out:st=21:d=5" .wind.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=1.7:a=0.9:r=48000" \
  -af "highpass=f=500,lowpass=f=7000,volume='pow(min(1,t/0.85),2.5)*exp(-3.4*max(0,t-0.85))':eval=frame" .wusch.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.95*sin(2*PI*(78*t-13*t*t))*exp(-2.3*t)':s=48000:d=2.6" .sub.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=1.0:a=0.9:r=48000" \
  -af "highpass=f=2200,volume='exp(-13*t)':eval=frame" .knall.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.30*sin(2*PI*74*t)*exp(-24*mod(t,0.75))':s=48000:d=56" \
  -af "afade=t=in:st=0:d=4,afade=t=out:st=51:d=5" .puls.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=52:a=0.5:r=48000" \
  -af "highpass=f=6500,volume='0.10*exp(-45*mod(t,0.375))':eval=frame,afade=t=in:st=0:d=6,afade=t=out:st=46:d=6" .hat.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=4.2:a=0.7:r=48000" \
  -af "highpass=f=700,lowpass=f=11000,volume='0.7*pow(t/4.2,3.2)':eval=frame" .riser.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.30*sin(2*PI*(160*t+130*t*t))*pow(t/4.2,2.8)':s=48000:d=4.2" .riserton.wav
$FF -y -v error -f lavfi -i "anoisesrc=color=white:d=1.1:a=0.8:r=48000" \
  -af "bandpass=f=1800:width_type=o:w=2.5,volume='0.8*sin(PI*min(1,t/1.1))^1.5':eval=frame" .umbau.wav
$FF -y -v error -f lavfi -i "aevalsrc='0.16*(sin(2*PI*110*t)+0.7*sin(2*PI*165*t)+0.5*sin(2*PI*220*t)+0.3*sin(2*PI*277*t))':s=48000:d=5.4" \
  -af "afade=t=in:st=0:d=1.4,afade=t=out:st=2.6:d=2.8" .schluss.wav

$FF -y -v error \
 -i .rumpeln.wav -i .padA.wav -i .padB.wav -i .wind.wav -i .wusch.wav -i .sub.wav -i .knall.wav \
 -i .puls.wav -i .hat.wav -i .riser.wav -i .riserton.wav -i .umbau.wav -i .schluss.wav \
 -filter_complex "\
[4]asplit=15[w0][w1][w2][w3][w4][w5][w6][w7][w8][w9][w10][w11][w12][w13][w14];\
[w0]volume=0.50[W0];\
[w1]adelay=4150:all=1,volume=0.22[W1];[w2]adelay=9150:all=1,volume=0.22[W2];\
[w3]adelay=14150:all=1,volume=0.22[W3];[w4]adelay=19150:all=1,volume=0.22[W4];\
[w5]adelay=29150:all=1,volume=0.22[W5];[w6]adelay=34150:all=1,volume=0.22[W6];\
[w7]adelay=49150:all=1,volume=0.22[W7];[w8]adelay=54150:all=1,volume=0.22[W8];\
[w9]adelay=59150:all=1,volume=0.22[W9];[w10]adelay=64150:all=1,volume=0.22[W10];\
[w11]adelay=69150:all=1,volume=0.22[W11];\
[w12]adelay=24150:all=1,volume=0.75[W12];[w13]adelay=44150:all=1,volume=0.75[W13];\
[w14]adelay=74150:all=1,volume=0.80[W14];\
[5]asplit=7[s0][s1][s2][s3][s4][s5][s6];\
[s0]adelay=25000:all=1,volume=0.45[S0];[s1]adelay=40000:all=1,volume=0.35[S1];\
[s2]adelay=45000:all=1,volume=0.70[S2];[s3]adelay=75000:all=1,volume=0.80[S3];\
[s4]adelay=84000:all=1,volume=0.90[S4];[s5]adelay=87500:all=1,volume=0.55[S5];\
[s6]adelay=89000:all=1,volume=1.00[S6];\
[6]asplit=6[k0][k1][k2][k3][k4][k5];\
[k0]adelay=25000:all=1,volume=0.30[K0];[k1]adelay=45000:all=1,volume=0.45[K1];\
[k2]adelay=75000:all=1,volume=0.50[K2];[k3]adelay=84000:all=1,volume=0.50[K3];\
[k4]adelay=87500:all=1,volume=0.35[K4];[k5]adelay=89000:all=1,volume=0.60[K5];\
[7]adelay=24000:all=1[P];[8]adelay=30000:all=1[H];\
[9]adelay=79800:all=1[R];[10]adelay=79800:all=1[RT];\
[11]adelay=85600:all=1,volume=0.7[U];[12]adelay=88600:all=1[SC];\
[0][1][2][3][W0][W1][W2][W3][W4][W5][W6][W7][W8][W9][W10][W11][W12][W13][W14]\
[S0][S1][S2][S3][S4][S5][S6][K0][K1][K2][K3][K4][K5][P][H][R][RT][U][SC]\
amix=inputs=38:normalize=0:duration=longest[mx];\
[mx]aecho=0.8:0.5:210|470:0.22|0.12,alimiter=limit=0.93,\
afade=t=in:st=0:d=1.5,afade=t=out:st=92.6:d=1.4,atrim=0:$D,\
aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[out]" \
 -map "[out]" -c:a pcm_s16le ton_reise.wav
rm -f .rumpeln.wav .padA.wav .padB.wav .wind.wav .wusch.wav .sub.wav .knall.wav .puls.wav .hat.wav .riser.wav .riserton.wav .umbau.wav .schluss.wav
echo "ton_reise.wav"
