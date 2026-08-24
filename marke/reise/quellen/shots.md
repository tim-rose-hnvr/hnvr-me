# Shots

Modell `seedance_2_0`, jeweils `mode: std`, `resolution: 1080p`,
`bitrate_mode: high`, `aspect_ratio: 16:9`, `duration: 5`,
`generate_audio: false`. Kosten 45 Credits je Shot.

Jeder Shot bekommt `start_image` **und** `end_image`. Daher endet Shot n exakt
auf dem Startbild von Shot n+1, und alle Schnitte sind hart und unsichtbar.

| Shot | start | end | Bewegung |
|---|---|---|---|
| 1 | Logo-Plate | K01 | Kamera stuerzt ins Logo, die Schrift loest sich in Lichtstreifen auf, daraus wird die Strasse |
| 2 | K01 | K02 | Tiefflug die Strasse hinunter, dann steiler Aufstieg aus der Schlucht |
| 3 | K02 | K03 | Ueber die Daecher, Drehung nach unten auf das Rathaus am Teich |
| 4 | K03 | K04 | Umflug um die Kuppel, Ausbruch Richtung Buerogebaeude |
| 5 | K04 | K05 | Geradliniger Anflug, bis ein Fenster das Bild fuellt |
| 6 | K05 | K06 | Durch das Glas, Flug den Mittelgang hinunter |
| 7 | K06 | K07 | Weiter durchs Studio, Tiefflug ueber den Grafikarbeitsplatz |
| 8 | K07 | K08 | Abheben vom Tisch, Flug auf die Monitorwand zu |
| 9 | K08 | K09 | Abwendung, Sinkflug auf den Schreibtisch, Kamera kommt zur Ruhe |
| 10 | K09 | K10 | Vorbei am Signet in den Bildschirm, der sich wie ein Tor oeffnet |
| 11 | K10 | K11 | Tiefer zwischen den Tafeln hindurch, Layouts werden zu Code |
| 12 | K11 | K12 | Weiter in die glaesernen Diagramme |
| 13 | K12 | K13 | Diagramme weichen den Anzeigenflaechen |
| 14 | K13 | K14 | Durch Fotoabzuege zur Schnittleiste |
| 15 | K14 | K15 | Die Leiste zerfaellt, Module fuegen sich, Kamera bricht heraus |
| 16 | K15 | K16 | Ausbruch und Sturz in den Smartphone-Bildschirm |

## Zwei Fallstricke

**Presets.** Higgsfield faengt Auftraege gelegentlich ab und empfiehlt
stattdessen ein Preset (hier zweimal „IN THE DARK“). Der Auftrag kommt dann
gar nicht erst zustande. Mit `declined_preset_id` wiederholen, sonst bekommt
man statt der Keyframe-Fuehrung eine Vorlage.

**Haenger.** Ein Shot blieb ueber zwanzig Minuten in `in_progress`, waehrend
die uebrigen nach fuenf bis acht Minuten fertig waren. Ein zweiter Auftrag mit
demselben Keyframe-Paar lief in acht Minuten durch. Bei einem Ausreisser also
parallel nachschicken statt weiter zu warten — 45 Credits sind billiger als
die Wartezeit.
