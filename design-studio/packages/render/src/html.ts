/**
 * Entwurf → HTML.
 *
 * **Ein Renderer für Bildschirm und Druck.** Der Editor zeigt genau das an, was
 * später ins PDF geht, weil beides durch diese Datei läuft. Das ist der
 * eigentliche Grund für den Weg über HTML: kein zweiter Renderer, der
 * irgendwann auseinanderläuft, und keine Vorschau, die lügt.
 *
 * Die Datei ist bewusst dumm: keine Maße rechnen, keine Umbrüche raten. Der
 * Browser bricht um, unterschneidet und setzt Blocksatz. Jede Zeile Logik hier
 * wäre eine Zeile, die dem Browser widerspricht.
 *
 * Koordinaten: Ursprung des Entwurfs ist die linke obere Ecke des Endformats,
 * der Anschnitt liegt im Negativen. Im HTML wird alles um den Anschnitt nach
 * rechts unten verschoben, damit nichts negativ wird.
 */

import type { Entwurf, Entwurfselement, Seite, TextElement } from '@studio/editor-core';
import { type Sprache, setzeTrennstriche } from './trennung.js';

export interface Schriftquelle {
  /** CSS-Familienname, muss zu `schriftFamilie` der Textelemente passen. */
  familie: string;
  gewicht: number;
  kursiv: boolean;
  /** `data:`- oder `blob:`-URI. Kein `file://` — das lädt in gesetzten Seiten nicht. */
  quelle: string;
}

export interface RenderOptionen {
  schriften: readonly Schriftquelle[];
  /** Sprache für die Silbentrennung. `keine` schaltet sie ab. */
  sprache?: Sprache;
  /** Nur diese Seite ausgeben. Ohne Angabe alle. */
  nurSeite?: string;
}

/**
 * CSS-Zeichenkette für die Verwendung **innerhalb eines style-Attributs**.
 *
 * Hier lauert eine hässliche Falle: `JSON.stringify` liefert doppelte
 * Anführungszeichen, und die beenden das umgebende `style="…"` vorzeitig. Die
 * Folge ist kein Fehler, sondern stiller Ersatzschriftgebrauch — der erst im
 * Druck auffällt.
 */
function cssZeichenkette(wert: string): string {
  return `'${wert.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

export function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Maße einer Seite einschließlich Anschnitt, in Dokumentpixeln. */
export function blattmasse(entwurf: Entwurf): { breite: number; hoehe: number } {
  return {
    breite: entwurf.masse.breite + entwurf.anschnitt.links + entwurf.anschnitt.rechts,
    hoehe: entwurf.masse.hoehe + entwurf.anschnitt.oben + entwurf.anschnitt.unten,
  };
}

export function schriftRegeln(schriften: readonly Schriftquelle[]): string {
  return schriften
    .map(
      (s) =>
        `@font-face{font-family:${cssZeichenkette(s.familie)};font-weight:${s.gewicht};` +
        `font-style:${s.kursiv ? 'italic' : 'normal'};src:url(${cssZeichenkette(s.quelle)});font-display:block}`,
    )
    .join('\n');
}

/**
 * Daten, die aus dem berechneten Stil nicht verlustfrei zurückzulesen sind:
 * Farben kämen als `rgb(...)`, die Drehung als Transformationsmatrix.
 */
function kennzeichen(element: Entwurfselement): string {
  const teile = [
    `data-element-id="${esc(element.id)}"`,
    `data-drehung="${element.drehung}"`,
    `data-name="${esc(element.name)}"`,
  ];
  if (element.platzhalter !== null) {
    teile.push(
      `data-platzhalter="${esc(element.platzhalter.schluessel)}"`,
      `data-bearbeitbar="${element.platzhalter.bearbeitbar.join(',')}"`,
    );
  }
  if (element.gesperrt) teile.push('data-gesperrt="1"');
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

/**
 * Die typografischen Eigenschaften eines Textelements als CSS.
 *
 * Getrennt von `rahmenStil`, weil der Textmesser genau diese Eigenschaften
 * braucht — aber mit freier Höhe. Würde er sie nachbauen, liefe die Messung
 * irgendwann von der Darstellung weg, und das Werkzeug würde wieder lügen.
 */
export function schriftStil(element: TextElement): string {
  return [
    `font-family:${cssZeichenkette(element.schriftFamilie)}`,
    `font-size:${element.schriftGroesse}px`,
    `font-weight:${element.schriftStaerke}`,
    `font-style:${element.kursiv ? 'italic' : 'normal'}`,
    `line-height:${element.zeilenabstand}`,
    `letter-spacing:${element.laufweite}px`,
    `text-align:${AUSRICHTUNG[element.ausrichtung]}`,
    `color:${element.farbe}`,
    'overflow-wrap:break-word',
    'white-space:pre-wrap',
    'margin:0',
  ].join(';');
}

function rahmenStil(element: Entwurfselement, versatzX: number, versatzY: number): string {
  const teile = [
    'position:absolute',
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

const AUSRICHTUNG = {
  links: 'left',
  mitte: 'center',
  rechts: 'right',
  blocksatz: 'justify',
} as const;

const PASSFORM = {
  fuellen: 'cover',
  einpassen: 'contain',
  strecken: '100% 100%',
} as const;

function elementHtml(
  element: Entwurfselement,
  versatzX: number,
  versatzY: number,
  optionen: RenderOptionen,
): string {
  if (!element.sichtbar) return '';
  const basis = rahmenStil(element, versatzX, versatzY);
  const kennung = kennzeichen(element);

  switch (element.typ) {
    case 'text': {
      const stil = [basis, schriftStil(element)].join(';');

      // Trennstriche vor dem Maskieren einsetzen: U+00AD ist ein Zeichen, kein
      // Markup, und muss durch die Maskierung unverändert durchkommen.
      const inhalt = esc(
        setzeTrennstriche(
          element.inhalt,
          optionen.sprache === undefined ? {} : { sprache: optionen.sprache },
        ),
      );
      return `<div ${kennung} data-typ="text" style="${stil}">${inhalt}</div>`;
    }

    case 'form': {
      const stil = [
        basis,
        element.fuellung === null ? '' : `background:${element.fuellung}`,
        element.kontur === null
          ? ''
          : `border:${element.kontur.staerke}px solid ${element.kontur.farbe};box-sizing:border-box`,
        element.eckenradius > 0 ? `border-radius:${element.eckenradius}px` : '',
        element.form === 'ellipse' ? 'border-radius:50%' : '',
      ]
        .filter((t) => t !== '')
        .join(';');
      return `<div ${kennung} data-typ="form" style="${stil}"></div>`;
    }

    case 'bild': {
      const z = element.zuschnitt;
      // Ein Zuschnitt wird über Vergrößerung plus Verschiebung nachgebildet:
      // background-size skaliert den sichtbaren Ausschnitt auf den Rahmen.
      const zugeschnitten = z.breite < 1 || z.hoehe < 1 || z.x > 0 || z.y > 0;
      const hintergrund = zugeschnitten
        ? [
            `background-size:${(100 / z.breite).toFixed(4)}% ${(100 / z.hoehe).toFixed(4)}%`,
            `background-position:${((z.x / (1 - z.breite || 1)) * 100).toFixed(4)}% ${((z.y / (1 - z.hoehe || 1)) * 100).toFixed(4)}%`,
          ]
        : [`background-size:${PASSFORM[element.passform]}`, 'background-position:center'];

      const stil = [
        basis,
        `background-image:url(${cssZeichenkette(element.quelle.url)})`,
        ...hintergrund,
        'background-repeat:no-repeat',
      ].join(';');
      return `<div ${kennung} data-typ="bild" data-asset-id="${esc(element.quelle.id)}" style="${stil}"></div>`;
    }

    case 'gruppe':
      return element.kinder
        .map((kind) => elementHtml(kind, versatzX, versatzY, optionen))
        .join('\n');
  }
}

export function seiteHtml(seite: Seite, entwurf: Entwurf, optionen: RenderOptionen): string {
  const blatt = blattmasse(entwurf);
  const versatzX = entwurf.anschnitt.links;
  const versatzY = entwurf.anschnitt.oben;

  const hintergrund =
    seite.hintergrund === null
      ? ''
      : `<div data-typ="hintergrund" data-element-id="${esc(seite.id)}" data-drehung="0" ` +
        `data-fuellung="${esc(seite.hintergrund)}" style="position:absolute;left:0;top:0;` +
        `width:${blatt.breite}px;height:${blatt.hoehe}px;background:${seite.hintergrund}"></div>`;

  const elemente = seite.elemente
    .map((e) => elementHtml(e, versatzX, versatzY, optionen))
    .join('\n');

  return (
    `<div class="seite" data-seite-id="${esc(seite.id)}" style="position:relative;` +
    `width:${blatt.breite}px;height:${blatt.hoehe}px;overflow:hidden;background:#fff">\n${hintergrund}\n${elemente}\n</div>`
  );
}

/** Nur die Seiten, ohne Dokumenthülle — für den Einbau in eine bestehende Seite. */
export function seitenHtml(entwurf: Entwurf, optionen: RenderOptionen): string {
  const seiten =
    optionen.nurSeite === undefined
      ? entwurf.seiten
      : entwurf.seiten.filter((s) => s.id === optionen.nurSeite);
  return seiten.map((s) => seiteHtml(s, entwurf, optionen)).join('\n');
}

/** Vollständiges Dokument — für den Satz im headless Browser. */
export function entwurfZuHtml(entwurf: Entwurf, optionen: RenderOptionen): string {
  const blatt = blattmasse(entwurf);
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${esc(entwurf.name)}</title>
<style>
${schriftRegeln(optionen.schriften)}
*{margin:0;padding:0;box-sizing:content-box}
html,body{background:#fff}
body{width:${blatt.breite}px}
.seite{page-break-after:always}
</style>
</head>
<body>
${seitenHtml(entwurf, optionen)}
</body>
</html>`;
}
