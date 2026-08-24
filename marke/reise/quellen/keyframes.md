# Keyframes

Modell `cinematic_studio_2_5`, jeweils `aspect_ratio: 16:9`, `resolution: 2k`.
Kosten 2 Credits je Bild.

Jedes Standbild ist zugleich Endbild eines Shots und Startbild des naechsten.
K00 ist kein generiertes Bild, sondern die Logo-Plate aus
`marke/ident/quellen/` (`plates.sh`, `plate-lockup.png`).

Allen Prompts gemeinsam ist der Stilzusatz: *Cinematic film still, anamorphic
35mm, shallow depth of field, volumetric haze, warm orange practical light
accents, deep teal-black shadows, fine film grain, ultra detailed,
photorealistic. No text, no letters, no signage, no logos, no watermarks.*

| Nr | Inhalt |
|---|---|
| K01 | Tiefflug ueber nasses Kopfsteinpflaster in einer Strasse in Hannover zur blauen Stunde, Altbaufassaden, Strassenbahn, Lindenlaub, Kirchturm in der Ferne |
| K02 | Aufstieg aus der Strassenschlucht ueber Schieferdaecher und Schornsteine, die Stadt darunter |
| K03 | Luftaufnahme des Neuen Rathauses Hannover: Sandsteinbau mit gruener Kupferkuppel, gespiegelt im Maschteich, Maschsee dahinter, Daemmerung |
| K04 | Drohne dreht von der Kuppel weg zu einem modernen Glas-Ziegel-Buerogebaeude mit warm erleuchteten Etagen |
| K05 | Direkt vor einem grossen erleuchteten Buerofenster bei Nacht, Regentropfen auf dem Glas, dahinter das Agenturloft |
| K06 | Agenturloft: links eine Moodboardwand mit Markenstudien und Farbkarten, rechts eine Wand aus Zetteln |
| K07 | Grafikarbeitsplatz: aufgefaecherte Farbkarten, Andrucke, Materialproben, offenes Skizzenbuch |
| K08 | Dunkler Raum mit einer Wand aus Monitoren: abstrakte Dashboards, steigende Kurven, Layout-Entwuerfe |
| K09 | Eichenschreibtisch, silberner All-in-one-Rechner, Tastatur, Notizbuch, Pflanze, Tasse — und ein leuchtendes oranges Asterisk-Objekt davor |
| K10 | Im Rechner: unendlicher dunkler Raum, durchscheinende Glastafeln mit Layouts, Rastern und Wireframes |
| K11 | Schichten aus leuchtenden Code-Tafeln und Klammerformen, in die Tiefe gestaffelt |
| K12 | Riesige glaeserne Diagramme: steil steigende Kurven, Balken, Rangleitern, eine Linse im Licht |
| K13 | Schwebende Anzeigenflaechen, leere Plakattafeln, farbige Kampagnenkacheln, Kreisdiagramme |
| K14 | Fotoabzuege und Kontaktboegen ziehen vorbei, dahinter eine durchscheinende Schnittleiste mit Farbkorrekturraedern |
| K15 | Leuchtende 3D-Module fliegen zusammen und fuegen sich zu einer Struktur, Explosionsdarstellung |
| K16 | Sturz in den Bildschirm eines Smartphones: App-Flaechen bauen sich, dahinter ein wachsendes neuronales Netz |

## Anmerkung zu Balken

`cinematic_studio_2_5` liefert gelegentlich Bilder mit eingebrannten
Cinemascope-Balken oder einem Rahmen mit runden Ecken. Ein Standbild mit
Balken erzeugt einen Shot mit Balken — also vor dem Weiterverwenden pruefen.
Der Zusatz *Full bleed 16:9 frame, image fills the entire frame edge to edge.
No letterbox, no black bars, no borders, no rounded corners* raeumt das aus;
K04, K10, K11 und K15 mussten damit neu erzeugt werden.

Zur Pruefung: die obersten und untersten Zeilen auf Helligkeit messen.
`cropdetect` ist bei so dunklem Material unbrauchbar — es schneidet dunklen
Bildinhalt mit weg.
