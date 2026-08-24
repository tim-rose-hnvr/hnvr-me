# hnvr.me — Logo-Ident

19,58 s, 24 B/s, 1920×1080, Ton in Stereo. Vier Shots aus Higgsfield
(`seedance_2_0`), zusammengeschnitten und vertont mit ffmpeg.

## Wo die fertigen Dateien liegen

Im Repo liegt nur die Quelle. Die Renderings sind Bauartefakte und
folgen der Regel aus der `.gitignore` im Wurzelverzeichnis — ausserdem
liessen sie sich aus der Sitzung heraus nicht ueber die GitHub-API
schieben, die traegt keine Binaerdateien. Sie wurden direkt uebergeben:

| Datei | Groesse | Wofuer |
|---|---|---|
| `hnvr-me_ident_1080p.mp4` | 14 MB | Master, 16:9, mit Ton |
| `hnvr-me_ident_1x1.mp4` | 3,6 MB | quadratisch, Logo mit Rand |
| `hnvr-me_ident_9x16.mp4` | 3,6 MB | hochkant, gleiche Logik |
| `hnvr-me_ident_web.webm` | 2,0 MB | stumm, fuer Autoplay auf der Seite |
| `hnvr-me_endcard.png` | 0,6 MB | letztes Vollbild als Standbild |

Wer sie wieder braucht, baut sie mit den Skripten unten neu.

## Ablauf

| Zeit | Bild | Ton |
|---|---|---|
| 0,0–4,85 | Funken fliegen aus der Tiefe ein und verdichten sich | Riser |
| 4,85 | Signet rastet ein | Einschlag |
| 4,6–9,6 | 3D-Beautypass, Kamera umfaehrt das Signet (Blende bei 4,6) | Flaeche |
| 9,6–14,55 | Schriftzug baut sich auf, `.me` zuletzt | Riser + vier Ticks |
| 14,55 | Logo steht | Haupteinschlag |
| 14,6–19,58 | Endkarte, Lichtsweep ueber die Buchstaben | Ausklang |

## Offener Punkt — Hausschrift

Der Schriftzug steht in **Liberation Sans Bold**, nicht in der echten
hnvr.me-Hausschrift. Im Repo lag keine Logodatei, und ein Chat-Anhang ist
fuer Higgsfield nicht lesbar. Das Signet ist aus der Vorlage nachgebaut und
trifft sie; die Wortmarke ist eine Ersatzschrift und weicht in der
Zeichnung ab.

**Zum Beheben:** die echte Logodatei (SVG oder PNG mit Transparenz) nach
`quellen/` legen, `logo-lockup.svg` ersetzen und die drei Skripte erneut
laufen lassen. Die Prompts bleiben unveraendert — die Plates tragen das
Logo, nicht der Prompt.

## Neu bauen

Die Skripte kamen ueber die GitHub-API ins Repo und haben kein
Ausfuehrbit — deshalb `bash` davor (oder einmalig `chmod +x quellen/*.sh`).

```sh
cd quellen
bash plates.sh                    # Keyframes aus den SVG rendern
# plate-*.png bei Higgsfield hochladen, die vier Shots nach shots.md
# erzeugen und als shot1.mp4 .. shot4.mp4 hier ablegen
FF=ffmpeg bash ton.sh             # Sounddesign
FF=ffmpeg bash schnitt.sh         # Schnitt, Vertonung, Formatvarianten
```

`plates.sh` erwartet Chromium; der Pfad laesst sich ueber `CHROME=` setzen.
Der Ton entsteht vollstaendig aus ffmpeg-Generatoren — kein Sample, keine
externe Bibliothek, kein Netz noetig.
