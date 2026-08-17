/**
 * Ablesen, wo der Browser die Glyphen hingesetzt hat.
 *
 * Der Kern von Weg B. Der Browser hat umgebrochen, unterschnitten und getrennt;
 * hier wird das Ergebnis nur noch eingesammelt — Zeichen für Zeichen mit seiner
 * Grundlinienposition.
 *
 * ## Warum zeichenweise und nicht zeilenweise
 *
 * Zeilenweise wäre kleiner, aber dann müsste das PDF die Unterschneidung selbst
 * nachbauen — und genau die wollten wir vom Browser. Zeichenweise Positionen
 * übernehmen die Browser-Unterschneidung exakt. Der Preis ist ein größeres PDF;
 * das ist für Marketingmaterial nebensächlich.
 *
 * ## Bekannte Grenze
 *
 * Ligaturen und zusammengesetzte Schriftsysteme brechen diese Annahme: dort
 * entspricht ein Zeichen im Text nicht einer Glyphe im Satz. Für lateinische
 * Marketingtexte trägt es. Für Arabisch oder Devanagari müsste man die
 * Glyphenebene über HarfBuzz ansprechen statt die Zeichenebene über Ranges.
 */

/** Eine gesetzte Glyphe. Koordinaten in CSS-Pixeln, Ursprung linke obere Blattecke. */
export interface Glyphe {
  zeichen: string;
  /** Linke Kante der Glyphe. */
  x: number;
  /** Grundlinie, nicht Oberkante. */
  y: number;
  breite: number;
}

export interface Textlauf {
  elementId: string;
  schriftFamilie: string;
  schriftGroesse: number;
  schriftStaerke: number;
  kursiv: boolean;
  /** Farbe des Entwurfs als #RRGGBB, nicht die CSS-Rückgabe. */
  farbe: string;
  /**
   * Ob der Browser die angeforderte Schrift wirklich hat. `false` heißt: es
   * wurde in der Ersatzschrift gesetzt, und das Ergebnis ist wertlos.
   */
  schriftVerfuegbar: boolean;
  glyphen: Glyphe[];
  /** Umschließendes Rechteck aller Glyphen — für die Selbstprüfung. */
  huelle: { x: number; y: number; breite: number; hoehe: number } | null;
}

export interface Flaeche {
  elementId: string;
  typ: 'hintergrund' | 'form' | 'bild';
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  drehung: number;
  fuellung: string | null;
  kontur: { farbe: string; staerke: number } | null;
  eckenradius: number;
}

export interface Messung {
  blattBreite: number;
  blattHoehe: number;
  texte: Textlauf[];
  flaechen: Flaeche[];
  /** Schriften, die der Browser tatsächlich geladen hat. Leer heißt Ersatzschrift. */
  geladeneSchriften: string[];
}

/**
 * Wird im Browser ausgeführt. Bewusst eine einzelne, abhängigkeitsfreie
 * Funktion, damit sie sich unverändert an `page.evaluate` übergeben lässt.
 */
export function messeImBrowser(): Messung {
  const blatt = document.querySelector<HTMLElement>('.seite');
  if (blatt === null) throw new Error('keine Seite im Dokument gefunden');

  const leinwand = document.createElement('canvas');
  const rohStift = leinwand.getContext('2d');
  if (rohStift === null) throw new Error('kein 2d-Kontext für die Schriftvermessung');
  const stift = rohStift;

  const blattKasten = blatt.getBoundingClientRect();

  /** Aufstieg und Abstieg der Schrift in px, aus der Schrift selbst. */
  function schriftmasse(stil: CSSStyleDeclaration): { aufstieg: number; abstieg: number } {
    stift.font = `${stil.fontStyle} ${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
    const masse = stift.measureText('Hxg');
    return {
      aufstieg: masse.fontBoundingBoxAscent,
      abstieg: masse.fontBoundingBoxDescent,
    };
  }

  function textknoten(wurzel: Element): Text[] {
    const knoten: Text[] = [];
    const laeufer = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    let aktuell = laeufer.nextNode();
    while (aktuell !== null) {
      knoten.push(aktuell as Text);
      aktuell = laeufer.nextNode();
    }
    return knoten;
  }

  const texte: Textlauf[] = [];
  for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-typ="text"]'))) {
    const stil = getComputedStyle(element);
    const { aufstieg, abstieg } = schriftmasse(stil);
    const zeilenhoehe = Number.parseFloat(stil.lineHeight);
    const schriftbox = aufstieg + abstieg;
    // Chromium liefert für Text-Ranges mal die Schriftbox, mal die Zeilenbox.
    // Beides kommt vor, deshalb wird der Fall am gemessenen Rechteck entschieden.
    const durchschussHalb = Number.isFinite(zeilenhoehe)
      ? Math.max(0, (zeilenhoehe - schriftbox) / 2)
      : 0;

    const glyphen: Glyphe[] = [];
    const bereich = document.createRange();

    for (const knoten of textknoten(element)) {
      const text = knoten.data;
      for (let i = 0; i < text.length; i += 1) {
        const zeichen = text[i] as string;
        bereich.setStart(knoten, i);
        bereich.setEnd(knoten, i + 1);
        const rechtecke = Array.from(bereich.getClientRects());
        if (rechtecke.length === 0) continue;
        const r = rechtecke[0] as DOMRect;
        // Umbruchstellen liefern Rechtecke ohne Breite — die stehen für nichts
        // Gesetztes und würden im PDF als Leerzeichen an falscher Stelle landen.
        if (r.width === 0 && zeichen.trim() === '') continue;

        // Weicher Trennstrich (U+00AD): unsichtbar, solange nicht getrennt wird,
        // und am Zeilenende ein sichtbarer Bindestrich. Nur im zweiten Fall darf
        // er ins PDF, und dann als gewöhnlicher Bindestrich — U+00AD selbst ist
        // in vielen Schriften nicht belegt und käme als leeres Kästchen heraus.
        if (zeichen === '­') {
          if (r.width === 0) continue;
          glyphen.push({
            zeichen: '-',
            x: r.left - blattKasten.left,
            y:
              (Math.abs(r.height - zeilenhoehe) < Math.abs(r.height - schriftbox)
                ? r.top + durchschussHalb + aufstieg
                : r.top + aufstieg) - blattKasten.top,
            breite: r.width,
          });
          continue;
        }

        const nachZeilenbox = Math.abs(r.height - zeilenhoehe) < Math.abs(r.height - schriftbox);
        const grundlinie = nachZeilenbox ? r.top + durchschussHalb + aufstieg : r.top + aufstieg;

        glyphen.push({
          zeichen,
          x: r.left - blattKasten.left,
          y: grundlinie - blattKasten.top,
          breite: r.width,
        });
      }
    }

    let huelle: Textlauf['huelle'] = null;
    if (glyphen.length > 0) {
      const links = Math.min(...glyphen.map((g) => g.x));
      const rechts = Math.max(...glyphen.map((g) => g.x + g.breite));
      const oben = Math.min(...glyphen.map((g) => g.y - aufstieg));
      const unten = Math.max(...glyphen.map((g) => g.y + abstieg));
      huelle = { x: links, y: oben, breite: rechts - links, hoehe: unten - oben };
    }

    texte.push({
      elementId: element.dataset['elementId'] ?? '',
      schriftFamilie: stil.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() ?? '',
      schriftGroesse: Number.parseFloat(stil.fontSize),
      schriftStaerke: Number.parseInt(stil.fontWeight, 10),
      kursiv: stil.fontStyle === 'italic',
      farbe: element.dataset['farbe'] ?? '',
      // `document.fonts.check` sagt, ob für diese Angabe eine geladene Schrift
      // vorliegt — im Gegensatz zum berechneten Stil, der nur den Wunsch
      // wiedergibt und deshalb immer zufrieden aussieht.
      schriftVerfuegbar: document.fonts.check(
        `${stil.fontStyle} ${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`,
      ),
      glyphen,
      huelle,
    });
  }

  const flaechen: Flaeche[] = [];
  for (const element of Array.from(
    document.querySelectorAll<HTMLElement>(
      '[data-typ="hintergrund"],[data-typ="form"],[data-typ="bild"]',
    ),
  )) {
    const stil = getComputedStyle(element);
    const typ = element.dataset['typ'] as Flaeche['typ'];
    const drehung = Number.parseFloat(element.dataset['drehung'] ?? '0');

    flaechen.push({
      elementId: element.dataset['elementId'] ?? '',
      typ,
      // Nicht getClientRects: bei Drehung liefert das die gedrehte Hülle, wir
      // wollen aber den ungedrehten Rahmen plus den Winkel getrennt.
      x: Number.parseFloat(stil.left),
      y: Number.parseFloat(stil.top),
      breite: Number.parseFloat(stil.width),
      hoehe: Number.parseFloat(stil.height),
      drehung,
      fuellung: element.dataset['fuellung'] ?? null,
      kontur:
        element.dataset['konturFarbe'] === undefined
          ? null
          : {
              farbe: element.dataset['konturFarbe'],
              staerke: Number.parseFloat(element.dataset['konturStaerke'] ?? '0'),
            },
      eckenradius: Number.parseFloat(stil.borderTopLeftRadius) || 0,
    });
  }

  return {
    blattBreite: blattKasten.width,
    blattHoehe: blattKasten.height,
    texte,
    flaechen,
    // FontFaceSet ist iterierbar, aber die Typdefinition sagt es nicht.
    geladeneSchriften: [...(document.fonts as unknown as Iterable<FontFace>)].map(
      (f) => `${f.family} ${f.weight} ${f.style}`,
    ),
  };
}
