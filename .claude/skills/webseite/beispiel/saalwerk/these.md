# Designthese — Saalwerk

Geschrieben in Phase 1, vor der ersten Zeile HTML.

## 1. Die These

**Bauzeichnung.** Die Seite ist der Plan des Saals, nicht die Broschüre dazu. Papierton, Tinte, ein Rostrot. Sichtbares Millimeterraster, Maßketten, Positionsnummern in Monospace an jedem Abschnitt, ein Schriftfeld oben rechts wie auf einer technischen Zeichnung. Alles ist vermaßt und beschriftet.

Begründung am Publikum: Geschäftsführung und IT-Leitung von Stadtwerken, Sparkassen und Kreistagen schreiben selbst Leistungsverzeichnisse und Ausschreibungen. Eine Seite in dieser Formsprache spricht ihre Sprache statt die der Consumer-Software — und ein konservativer Käufer glaubt einem Datenblatt mehr als einem Prospekt.

## 2. Der Signature Moment

**Der Saalgrundriss als vermaßte Draufsicht.** Vierzehn nummerierte Plätze, ein Sitzungstisch, die PTZ-Kamera oben. Ein Platz hat das Mikrofon offen, der Kamerakegel liegt darauf; alle vier Sekunden wandert beides auf einen anderen Platz.

Er zeigt die Leitidee, statt sie zu behaupten: Der Platz trägt die Identität, nicht die Person und nicht das Gerät. Ohne Bewegung bleibt er als Zeichnung vollständig lesbar — bei `prefers-reduced-motion` steht die Aktivierung still auf Platz 07.

## 3. Die Ausschlussliste

Diese Seite verwendet ausdrücklich **nicht**:

- Karten mit Schatten
- einen zentrierten Kopfbereich
- eine Reihe generischer Symbole
- irgendeinen Farbverlauf
- runde Ecken
- eine Vertrauensleiste aus Branchenwörtern oder ein anonymes Zitat

## 4. Die Bausteine

| | |
|---|---|
| Papier | `#f2ede3` |
| Tinte | `#14110f` |
| Gedimmt | `#554c3e` |
| Rostrot (Akzent) | `#9a3b1b` |
| Linie / Raster | `#cfc6b5` / `#e3dccd` |
| Display | Georgia, `clamp(3.2rem, 8.4vw, 6.6rem)`, Zeilenhöhe .94, Laufweite −.035em |
| Fließtext | Georgia 19 px, Zeilenhöhe 1.6, max. 64 Zeichen |
| Beschriftung | Monospace 12 px, Laufweite +.14em, Versalien |
| Raster | 64-px-Millimeterraster als Hintergrund, Marginalspalte 88 px, Satzbreite max. 1160 px |
| Textur | Korn über `feTurbulence`, 5 % Deckkraft |

## Anmerkung zur Schrift

Die These verlangt eine eigene Displayschrift. In der Bauumgebung stand keine lizenzierte Schriftdatei zur Verfügung, deshalb läuft die Seite auf einem Georgia-Stack. Das ist die bewusst offengelassene Lücke A8 im Auftragsregister — der stärkste Einzelhebel für Eigenständigkeit fehlt dieser Fassung.
