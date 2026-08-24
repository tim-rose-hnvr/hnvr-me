# hnvr.me — Die Reise

Ein durchgehender Kameraflug: 94 s, 24 B/s, 1920×1080, Ton in Stereo.
Sechzehn Shots aus Higgsfield (`seedance_2_0`) plus ein lokal gerendertes
Titelfinale, geschnitten und vertont mit ffmpeg.

## Ablauf

| Zeit | Bild | Einblendung |
|---|---|---|
| 0–5 | Das Logo, die Kamera stuerzt hinein, das Licht wird Strasse | |
| 5–10 | Tiefflug durch eine Strasse in Hannover, Aufstieg aus der Schlucht | |
| 10–15 | Ueber die Daecher, Zuwendung zum Neuen Rathaus | |
| 15–20 | Umflug um die Kuppel, dann zu einem Buerogebaeude | |
| 20–25 | Anflug auf das erleuchtete Agenturfenster | |
| 25–30 | Durch das Glas ins Buero, Moodboardwand und Zettelwand | Copywriting, Branding |
| 30–35 | Tiefflug ueber den Grafikarbeitsplatz | Grafikdesign |
| 35–40 | Zur Monitorwand mit Dashboards und Layouts | Digital Marketing, Websites |
| 40–45 | Landung auf dem Schreibtisch, iMac, Signet steht darauf | |
| 45–50 | Sprung in den Bildschirm, Welt aus Layouts und Rastern | Webdesign |
| 50–55 | Weiter in die Code-Welt | Programmierung |
| 55–60 | Glaeserne Diagramme, steigende Kurven, Lupe | SEO |
| 60–65 | Anzeigenflaechen und Kampagnenkacheln | Werbung & Kampagnen |
| 65–70 | Fotoabzuege und Schnittfenster mit Farbkorrektur | Fotografie & Videoproduktion |
| 70–75 | Module fuegen sich zu einer Struktur, Kamera bricht heraus | Software |
| 75–80 | Sturz in den iPhone-Bildschirm, App-Flaechen und KI-Netz | Apps & KI |
| 80–94 | Titelfinale: „Hannover Me“ baut sich zu hnvr.me um, Signet, Logo | |

## Der Kniff

Die Shots sind nicht einzeln erdacht, sondern durch **Keyframes verkettet**:
zuerst entstehen 16 Standbilder (`cinematic_studio_2_5`), dann bekommt jeder
Shot das eine als `start_image` und das naechste als `end_image`. Dadurch ist
das Endbild eines Shots das Startbild des naechsten — alle Schnitte sind hart
und trotzdem unsichtbar, und der Film liest sich als ein einziger Flug.

Das Titelfinale ist bewusst **nicht** generiert. Modelle verhauen Buchstaben
zuverlaessig, und der Umbau muss zeichengenau sitzen: aus „Hannover“ bleiben
h, n, v, r stehen, a, n, o und e fallen weg, aus „Me“ wird „.me“. Das rechnet
`titel.html` pro Einzelbild aus und Chromium greift es Bild fuer Bild ab.

Die Bereichsnamen sind aus demselben Grund lokal gesetzt und als transparente
PNGs ueber das Material gelegt.

## Wo die fertigen Dateien liegen

Im Repo liegt nur die Quelle. Die Renderings sind Bauartefakte und folgen der
Regel aus der `.gitignore` im Wurzelverzeichnis; ausserdem traegt die
GitHub-API keine Binaerdateien. Sie wurden direkt uebergeben:

| Datei | Groesse |
|---|---|
| `hnvr-me_reise_1080p.mp4` | 84 MB, Master 7,5 Mbit/s |
| `hnvr-me_reise_1080p_versand.mp4` | 25 MB, entrauscht, 2,2 Mbit/s |
| `hnvr-me_reise_9x16.mp4` | 27 MB |
| `hnvr-me_reise_1x1.mp4` | 27 MB |
| `hnvr-me_reise_720p_web.mp4` | 17 MB |
| `hnvr-me_reise_endcard.png` | Schlussbild |

## Offener Punkt — Hausschrift

Wie beim Ident steht der Schriftzug in **Liberation Sans Bold**, nicht in der
echten Hausschrift. Das betrifft den Anfang (Logo) und das ganze Titelfinale.
Zum Beheben `marke/ident/quellen/logo-lockup.svg` ersetzen und `titel.html`
neu rendern — die Masse darin (`FB`, `LB`, `BASE`, `SIG`) stammen aus dem
Logo-SVG und muessen dann mitgezogen werden.

## Neu bauen

```sh
cd quellen
cp ../../ident/quellen/signet.svg .
bash marken.sh                         # zwoelf Bereichs-Einblendungen
mkdir -p bilder && seq 0 335 | xargs -P 6 -I{} bash titel-bild.sh {}
ffmpeg -framerate 24 -i bilder/f%04d.png -vf format=yuv420p \
  -c:v libx264 -preset slow -crf 16 titel.mp4
# Keyframes und Shots nach keyframes.md / shots.md erzeugen,
# die Shots als shots/s01.mp4 .. s16.mp4 ablegen
FF=ffmpeg bash ton.sh
FF=ffmpeg bash schnitt.sh
```

Die Skripte kamen ueber die GitHub-API ins Repo und haben kein Ausfuehrbit —
deshalb `bash` davor, oder einmalig `chmod +x quellen/*.sh`.
