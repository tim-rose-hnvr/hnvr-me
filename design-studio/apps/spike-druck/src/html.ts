/**
 * Entwurf → HTML.
 *
 * Das ist Weg B in einer Datei: statt einen eigenen Textsatz zu bauen, wird der
 * Entwurf als gewöhnliches HTML aufgebaut und der Browser macht Zeilenumbruch,
 * Unterschneidung und Silbentrennung. Anschließend wird nur noch **abgelesen**,
 * wo die Glyphen gelandet sind.
 *
 * Deshalb ist diese Datei bewusst dumm: keine Maße rechnen, keine Umbrüche
 * raten. Jede Zeile Logik hier wäre eine Zeile, die dem Browser widerspricht.
 *
 * Koordinaten: der Ursprung des Entwurfs ist die linke obere Ecke des
 * Endformats, der Anschnitt liegt im Negativen. Im HTML wird alles um den
 * Anschnitt nach rechts unten verschoben, damit nichts negativ wird.
 */

import type { Entwurf, Entwurfselement, Seite } from '@studio/editor-core';

export interface Schriftdatei {
  /** CSS-Familienname, muss zu `schriftFamilie` der Textelemente passen. */
  familie: string;
  gewicht: number;
  kursiv: boolean;
  /** Vollständige Schriftdatei als data:-URI oder file:-URL. */
  quelle: string;
}

export interface HtmlOptionen {
  schriften: readonly Schriftdatei[];
}

/**
 * CSS-Zeichenkette für die Verwendung **innerhalb eines style-Attributs**.
 *
 * Hier lauert eine hässliche Falle: `JSON.stringify` liefert doppelte
 * Anführungszeichen, und die beenden das umgebende `style="…"` vorzeitig. Die
 * Folge ist kein Fehler, sondern stiller Ersatzschriftgebrauch — der erst im
 * Druck auffällt. Deshalb einfache Anführungszeichen.
 */
function cssZeichenkette(wert: string): string {
  return `'${wert.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Maße der Seite einschließlich Anschnitt, in Dokumentpixeln. */
export function blattmasse(entwurf: Entwurf): { breite: number; hoehe: number } {
  return {
    breite: entwurf.masse.breite + entwurf.anschnitt.links + entwurf.anschnitt.rechts,
    hoehe: entwurf.masse.hoehe + entwurf.anschnitt.oben + entwurf.anschnitt.unten,
  };
}

function schriftRegeln(schriften: readonly Schriftdatei[]): string {
  return schriften
    .map(
      (s) => `@font-face{
  font-family:${JSON.stringify(s.familie)};
  font-weight:${s.gewicht};
  font-style:${s.kursiv ? 'italic' : 'normal'};
  src:url(${JSON.stringify(s.quelle)});
  font-display:block;
}`,
    )
    .join('\n');
}

/**
 * Daten, die aus dem berechneten Stil nicht verlustfrei zurückzulesen sind:
 * Farben kämen als `rgb(...)` zurück, die Drehung als Transformationsmatrix.
 * Beides brauchen wir im Original, also wandert es in data-Attribute.
 */
function kennzeichen(element: Entwurfselement): string {
  const teile = [`data-element-id="${esc(element.id)}"`, `data-drehung="${element.drehung}"`];
  if (element.typ === 'text') teile.push(`data-farbe="${esc(element.farbe)}"`);
  if (element.typ === 'form') {
    if (element.fuellung !== null) teile.push(`data-fuellung="${esc(element.fuellung)}"`);
    if (element.kontur !== null) {
      teile.push(
        `data-kontur-farbe="${esc(element.kontur.farbe)}"`,
        `data-kontur-staerke="${element.kontur.staerke}"`,
      );
    }
  }
  return teile.join(' ');
}

function rahmenStil(element: Entwurfselement, versatzX: number, versatzY: number): string {
  const teile = [
    `position:absolute`,
    `left:${element.x + versatzX}px`,
    `top:${element.y + versatzY}px`,
    `width:${element.breite}px`,
    `height:${element.hoehe}px`,
    `opacity:${element.deckkraft}`,
  ];
  if (element.drehung !== 0) {
    teile.push(`transform:rotate(${element.drehung}deg)`, 'transform-origin:50% 50%');
  }
  return teile.join(';');
}

function elementHtml(element: Entwurfselement, versatzX: number, versatzY: number): string {
  if (!element.sichtbar) return '';
  const basis = rahmenStil(element, versatzX, versatzY);
  const kennung = kennzeichen(element);

  switch (element.typ) {
    case 'text': {
      const ausrichtung =
        element.ausrichtung === 'blocksatz'
          ? 'justify'
          : element.ausrichtung === 'mitte'
            ? 'center'
            : element.ausrichtung === 'rechts'
              ? 'right'
              : 'left';
      const stil = [
        basis,
        `font-family:${cssZeichenkette(element.schriftFamilie)}`,
        `font-size:${element.schriftGroesse}px`,
        `font-weight:${element.schriftStaerke}`,
        `font-style:${element.kursiv ? 'italic' : 'normal'}`,
        `line-height:${element.zeilenabstand}`,
        `letter-spacing:${element.laufweite}px`,
        `text-align:${ausrichtung}`,
        // Die Farbe steht im PDF, nicht hier — aber ohne sie sieht die
        // Sichtprüfung im Browser falsch aus.
        `color:${element.farbe}`,
        // Silbentrennung ist der Grund für diesen ganzen Weg: der Browser
        // trennt deutsch korrekt, ein Eigenbau tut das erst nach Monaten.
        'hyphens:auto',
        'overflow-wrap:break-word',
        'margin:0',
        'white-space:pre-wrap',
      ].join(';');
      return `<div class="text" ${kennung} data-typ="text" style="${stil}">${esc(element.inhalt)}</div>`;
    }

    case 'form': {
      const stil = [
        basis,
        element.fuellung === null ? '' : `background:${element.fuellung}`,
        element.kontur === null
          ? ''
          : `border:${element.kontur.staerke}px solid ${element.kontur.farbe};box-sizing:border-box`,
        element.eckenradius > 0 ? `border-radius:${element.eckenradius}px` : '',
      ]
        .filter((t) => t !== '')
        .join(';');
      return `<div ${kennung} data-typ="form" style="${stil}"></div>`;
    }

    case 'bild': {
      const stil = [
        basis,
        `background-image:url(${cssZeichenkette(element.quelle.url)})`,
        `background-size:${element.passform === 'einpassen' ? 'contain' : element.passform === 'strecken' ? '100% 100%' : 'cover'}`,
        'background-position:center',
        'background-repeat:no-repeat',
      ].join(';');
      return `<div ${kennung} data-typ="bild" style="${stil}"></div>`;
    }

    case 'gruppe':
      // Gruppen sind reine Ordnung, kein eigenes Aussehen. Die Kinder liegen
      // im selben Koordinatensystem wie die Gruppe, deshalb kein Versatz.
      return element.kinder.map((kind) => elementHtml(kind, versatzX, versatzY)).join('\n');
  }
}

function seiteHtml(seite: Seite, entwurf: Entwurf): string {
  const blatt = blattmasse(entwurf);
  const versatzX = entwurf.anschnitt.links;
  const versatzY = entwurf.anschnitt.oben;

  const hintergrund =
    seite.hintergrund === null
      ? ''
      : `<div data-typ="hintergrund" data-element-id="${esc(seite.id)}" data-drehung="0" data-fuellung="${esc(seite.hintergrund)}" style="position:absolute;left:0;top:0;width:${blatt.breite}px;height:${blatt.hoehe}px;background:${seite.hintergrund}"></div>`;

  const elemente = seite.elemente.map((e) => elementHtml(e, versatzX, versatzY)).join('\n');

  return `<div class="seite" data-seite-id="${esc(seite.id)}" style="position:relative;width:${blatt.breite}px;height:${blatt.hoehe}px;overflow:hidden">
${hintergrund}
${elemente}
</div>`;
}

export function entwurfZuHtml(entwurf: Entwurf, optionen: HtmlOptionen): string {
  const blatt = blattmasse(entwurf);

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${esc(entwurf.name)}</title>
<style>
${schriftRegeln(optionen.schriften)}
*{margin:0;padding:0;box-sizing:content-box}
html,body{background:#ffffff}
body{width:${blatt.breite}px}
.seite{page-break-after:always}
</style>
</head>
<body>
${entwurf.seiten.map((s) => seiteHtml(s, entwurf)).join('\n')}
</body>
</html>`;
}
