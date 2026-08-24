# Higgsfield-Shots

Modell `seedance_2_0`, jeweils `mode: std`, `resolution: 1080p`,
`bitrate_mode: high`, `aspect_ratio: 16:9`, `duration: 5`,
`generate_audio: false` (der Ton entsteht in `ton.sh`).

Der Trick liegt nicht im Prompt, sondern in den Keyframes: jeder Shot
bekommt `start_image` **und** `end_image`. Dadurch endet Shot 1 exakt auf
dem Startbild von Shot 2 und so weiter — der Schnitt ist unsichtbar, und
das Logo am Ende ist die echte Datei, nicht eine Erfindung des Modells.

| Shot | start_image | end_image | Inhalt |
|---|---|---|---|
| 1 | `plate-leere.png` | `plate-signet.png` | Funken fliegen ein, verdichten sich zum Signet |
| 2 | `plate-signet.png` | `plate-signet.png` | 3D-Beautypass, Kamera umfaehrt die Kante, zurueck auf frontal |
| 3 | `plate-signet.png` | `plate-lockup.png` | Schriftzug baut sich auf, `.me` rastet zuletzt ein |
| 4 | `plate-lockup.png` | `plate-lockup.png` | Standbild mit Lichtsweep, Endkarte |

## Prompts

**Shot 1**
> Premium brand ident, dark studio void. Thousands of tiny incandescent orange embers and fine metallic filings streak in from deep space toward the centre of frame, decelerate, and lock together to assemble one sharp geometric orange asterisk symbol. Volumetric haze, shallow depth of field, slow push-in, the symbol snapping into perfect focus and stillness at the end. Motion graphics, cinematic rim lighting, matte black background. No text, no letters, no words.

**Shot 2**
> Macro beauty shot of a single orange geometric asterisk symbol rendered in brushed anodized metal with a molten glowing core. A hard specular highlight sweeps across its bevelled edges while the camera arcs slowly around it and returns to a perfectly frontal, centred position. Fine dust motes drift through volumetric light, subtle heat shimmer. Ultra sharp, premium product ident, matte black background. No text, no letters, no words.

**Shot 3**
> The camera pulls back from the orange asterisk symbol and the wordmark builds beside it: white lowercase letterforms extrude out of the glowing symbol and slide precisely into place to its right, the final orange characters snapping in last with a soft light burst. Precise mechanical kinetic typography, dark studio, orange rim light, volumetric haze. The layout settles into a perfectly centred, static horizontal logo lock-up.

**Shot 4**
> Closing brand card. The finished horizontal logo lock-up holds perfectly still and centred. One soft anamorphic light sweep travels slowly left to right across the letterforms, a faint orange bloom breathes once, fine dust drifts through the frame. Almost no camera movement, elegant, restrained, matte black background, premium end card. Do not change, add or remove any letters.

## Anmerkung

Shot 1 wurde beim ersten Versuch von einem Higgsfield-Preset abgefangen
(„IN THE DARK"). Der Auftrag muss mit `declined_preset_id` wiederholt
werden, sonst kommt statt der Keyframe-Animation eine Vorlage zurueck.
