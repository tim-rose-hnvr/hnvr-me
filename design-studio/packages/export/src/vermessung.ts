/**
 * Ablesen, wo der Browser die Glyphen hingesetzt hat — und die Bilder in der
 * Auflösung holen, in der sie gedruckt werden.
 *
 * Der Browser hat umgebrochen, unterschnitten, getrennt und die Bilder
 * dekodiert. Hier wird das Ergebnis nur eingesammelt.
 *
 * ## Zwei Feinheiten, die man kennen muss
 *
 * **Gedrehter Text wird ungedreht vermessen.** `getClientRects` liefert bei
 * gedrehtem Text die achsenparallele Hülle, nicht die Glyphenposition — die
 * Messung wäre unbrauchbar. Deshalb wird die Drehung vor dem Messen entfernt
 * und im PDF als Transformation wieder aufgesetzt.
 *
 * **Bilder kommen als rohe Bildpunkte zurück.** Node hat keinen Bilddecoder,
 * der Browser hat das Bild aber ohnehin schon geladen. Also zeichnet er es in
 * der Zielauflösung auf eine Leinwand und gibt die Punkte heraus. Damit lässt
 * sich serverseitig nach CMYK umrechnen, ohne eine Codec-Bibliothek.
 */

/** Eine gesetzte Glyphe. Koordinaten in CSS-Pixeln, Ursprung linke obere Blattecke. */
export interface Glyphe {
  zeichen: string;
  x: number;
  /** Grundlinie, nicht Oberkante. */
  y: number;
  breite: number;
}

export interface Textlauf {
  elementId: string;
  seiteId: string;
  schriftFamilie: string;
  schriftGroesse: number;
  schriftStaerke: number;
  kursiv: boolean;
  farbe: string;
  /** Grad im Uhrzeigersinn, um den Mittelpunkt des Elementrahmens. */
  drehung: number;
  /** Mittelpunkt des Elementrahmens — Drehpunkt für das PDF. */
  drehpunkt: { x: number; y: number };
  /** Ob der Browser die angeforderte Schrift wirklich hat. */
  schriftVerfuegbar: boolean;
  glyphen: Glyphe[];
}

export interface Flaeche {
  elementId: string;
  seiteId: string;
  typ: 'hintergrund' | 'form' | 'bild';
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  drehung: number;
  fuellung: string | null;
  kontur: { farbe: string; staerke: number } | null;
  eckenradius: number;
  ellipse: boolean;
  /** Nur bei Bildern: Schlüssel in `Messung.bilder`. */
  bildId: string | null;
}

export interface Bilddaten {
  id: string;
  breite: number;
  hoehe: number;
  /** RGBA, 4 Bytes je Bildpunkt, zeilenweise. */
  punkte: number[];
  /** Auflösung, mit der das Bild an seiner Platzierung ankommt. */
  wirksameDpi: number;
}

export interface Seitenmessung {
  seiteId: string;
  breite: number;
  hoehe: number;
}

export interface Messung {
  seiten: Seitenmessung[];
  texte: Textlauf[];
  flaechen: Flaeche[];
  bilder: Bilddaten[];
}

export interface MessOptionen {
  /** Zielauflösung für Bilder in dpi. Darüber wird heruntergerechnet. */
  bildDpi: number;
  /** dpi des Entwurfs, für die Auflösungsrechnung. */
  entwurfDpi: number;
}

/**
 * Wird im Browser ausgeführt. Bewusst eine einzelne, abhängigkeitsfreie
 * Funktion, damit sie sich unverändert an `page.evaluate` übergeben lässt.
 */
export async function messeImBrowser(optionen: MessOptionen): Promise<Messung> {
  const leinwand = document.createElement('canvas');
  const rohStift = leinwand.getContext('2d');
  if (rohStift === null) throw new Error('kein 2d-Kontext für die Schriftvermessung');
  const stift = rohStift;

  function schriftmasse(stil: CSSStyleDeclaration): { aufstieg: number; abstieg: number } {
    stift.font = `${stil.fontStyle} ${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
    const masse = stift.measureText('Hxg');
    return { aufstieg: masse.fontBoundingBoxAscent, abstieg: masse.fontBoundingBoxDescent };
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

  const seiten: Seitenmessung[] = [];
  const texte: Textlauf[] = [];
  const flaechen: Flaeche[] = [];
  const bilder: Bilddaten[] = [];

  for (const blatt of Array.from(document.querySelectorAll<HTMLElement>('.seite'))) {
    const seiteId = blatt.dataset['seiteId'] ?? '';
    const blattKasten = blatt.getBoundingClientRect();
    seiten.push({ seiteId, breite: blattKasten.width, hoehe: blattKasten.height });

    // --- Text ---------------------------------------------------------------
    for (const element of Array.from(blatt.querySelectorAll<HTMLElement>('[data-typ="text"]'))) {
      const drehung = Number.parseFloat(element.dataset['drehung'] ?? '0');
      const vorher = element.style.transform;
      // Ungedreht messen — sonst liefert getClientRects die Hülle statt der
      // Glyphenposition. Die Drehung setzt das PDF wieder auf.
      if (drehung !== 0) element.style.transform = 'none';

      const stil = getComputedStyle(element);
      const { aufstieg, abstieg } = schriftmasse(stil);
      const zeilenhoehe = Number.parseFloat(stil.lineHeight);
      const schriftbox = aufstieg + abstieg;
      const durchschussHalb = Number.isFinite(zeilenhoehe)
        ? Math.max(0, (zeilenhoehe - schriftbox) / 2)
        : 0;

      const rahmen = element.getBoundingClientRect();
      const glyphen: Glyphe[] = [];
      const bereich = document.createRange();

      const grundlinieAus = (r: DOMRect): number => {
        const nachZeilenbox = Math.abs(r.height - zeilenhoehe) < Math.abs(r.height - schriftbox);
        const y = nachZeilenbox ? r.top + durchschussHalb + aufstieg : r.top + aufstieg;
        return y - blattKasten.top;
      };

      // Trennstelle offen, seit der letzte weiche Trennstrich übersprungen
      // wurde. Wird zur Trennung, sobald das nächste Zeichen eine Zeile tiefer
      // beginnt.
      let trennstelleOffen = false;

      for (const knoten of textknoten(element)) {
        const text = knoten.data;
        for (let i = 0; i < text.length; i += 1) {
          const zeichen = text[i] as string;
          bereich.setStart(knoten, i);
          bereich.setEnd(knoten, i + 1);
          const rechtecke = Array.from(bereich.getClientRects());
          if (rechtecke.length === 0) continue;

          // An einem Umbruch liefert der Bereich zwei Rechtecke: eines am Ende
          // der alten und eines am Anfang der neuen Zeile. Das breitere ist das
          // echte — das andere ist die Einfügemarke und hat kaum Breite.
          const r = rechtecke.reduce((a, b) => (b.width > a.width ? b : a)) as DOMRect;

          // Weicher Trennstrich (U+00AD): Chromium gibt ihm auch mitten im Wort
          // eine Restbreite von etwa 0,02 px — er ist also **nicht** an der
          // Breite zu erkennen. Er wird darum immer übersprungen und die
          // Trennstelle nur vorgemerkt.
          if (zeichen === '­') {
            trennstelleOffen = true;
            continue;
          }

          if (r.width === 0 && zeichen.trim() === '') {
            trennstelleOffen = false;
            continue;
          }

          const x = r.left - blattKasten.left;
          const y = grundlinieAus(r);

          // Der sichtbare Trennstrich am Zeilenende ist kein Zeichen im Text,
          // sondern wird vom Umbruch erzeugt — über Bereiche ist er nicht zu
          // messen. Er wird deshalb hier gesetzt: dort, wo die vorige Zeile
          // aufhört, sobald das nächste Zeichen eine Zeile tiefer anfängt.
          const vorige = glyphen[glyphen.length - 1];
          if (trennstelleOffen && vorige !== undefined && y > vorige.y + 1) {
            glyphen.push({
              zeichen: '-',
              x: vorige.x + vorige.breite,
              y: vorige.y,
              breite: 0,
            });
          }
          trennstelleOffen = false;

          glyphen.push({ zeichen, x, y, breite: r.width });
        }
      }

      texte.push({
        elementId: element.dataset['elementId'] ?? '',
        seiteId,
        schriftFamilie: stil.fontFamily.split(',')[0]?.replace(/["']/g, '').trim() ?? '',
        schriftGroesse: Number.parseFloat(stil.fontSize),
        schriftStaerke: Number.parseInt(stil.fontWeight, 10),
        kursiv: stil.fontStyle === 'italic',
        farbe: element.dataset['farbe'] ?? '#000000',
        drehung,
        drehpunkt: {
          x: rahmen.left - blattKasten.left + rahmen.width / 2,
          y: rahmen.top - blattKasten.top + rahmen.height / 2,
        },
        // Fragt, ob die Schrift wirklich geladen ist. Der berechnete Stil gibt
        // nur den Wunsch wieder und sieht deshalb immer zufrieden aus.
        schriftVerfuegbar: document.fonts.check(
          `${stil.fontStyle} ${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`,
        ),
        glyphen,
      });

      if (drehung !== 0) element.style.transform = vorher;
    }

    // --- Flächen und Bilder -------------------------------------------------
    const auswahl = '[data-typ="hintergrund"],[data-typ="form"],[data-typ="bild"]';
    for (const element of Array.from(blatt.querySelectorAll<HTMLElement>(auswahl))) {
      const stil = getComputedStyle(element);
      const typ = element.dataset['typ'] as Flaeche['typ'];
      const drehung = Number.parseFloat(element.dataset['drehung'] ?? '0');
      const breite = Number.parseFloat(stil.width);
      const hoehe = Number.parseFloat(stil.height);

      let bildId: string | null = null;
      if (typ === 'bild') {
        bildId = element.dataset['assetId'] ?? element.dataset['elementId'] ?? '';
        if (!bilder.some((b) => b.id === bildId)) {
          const gezeichnet = await zeichneBild(element, breite, hoehe, optionen);
          if (gezeichnet !== null) bilder.push({ ...gezeichnet, id: bildId });
        }
      }

      flaechen.push({
        elementId: element.dataset['elementId'] ?? '',
        seiteId,
        typ,
        x: Number.parseFloat(stil.left),
        y: Number.parseFloat(stil.top),
        breite,
        hoehe,
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
        ellipse: stil.borderRadius.includes('50%'),
        bildId,
      });
    }
  }

  return { seiten, texte, flaechen, bilder };

  /**
   * Zeichnet das Hintergrundbild eines Elements in Zielauflösung auf eine
   * Leinwand und gibt die Bildpunkte heraus. Der Zuschnitt ist über
   * background-size und -position bereits eingerechnet, deshalb wird schlicht
   * das dargestellte Ergebnis abgegriffen.
   */
  async function zeichneBild(
    element: HTMLElement,
    breite: number,
    hoehe: number,
    o: MessOptionen,
  ): Promise<Omit<Bilddaten, 'id'> | null> {
    const stil = getComputedStyle(element);
    const treffer = /url\("?([^")]+)"?\)/.exec(stil.backgroundImage);
    if (treffer === null || treffer[1] === undefined) return null;

    const bild = new Image();
    bild.crossOrigin = 'anonymous';
    bild.src = treffer[1];
    try {
      await bild.decode();
    } catch {
      return null;
    }

    // Zielgröße: die Platzierung in Zoll mal der gewünschten Auflösung, aber
    // nie mehr Punkte, als die Quelle hergibt — Hochrechnen bringt nichts.
    const zollBreit = breite / o.entwurfDpi;
    const zollHoch = hoehe / o.entwurfDpi;
    const zielBreite = Math.max(1, Math.round(Math.min(zollBreit * o.bildDpi, bild.naturalWidth)));
    const zielHoehe = Math.max(1, Math.round(Math.min(zollHoch * o.bildDpi, bild.naturalHeight)));

    const l = document.createElement('canvas');
    l.width = zielBreite;
    l.height = zielHoehe;
    const s = l.getContext('2d');
    if (s === null) return null;

    // Weiß hinterlegen: Druck kennt keine Transparenz gegen nichts.
    s.fillStyle = '#ffffff';
    s.fillRect(0, 0, zielBreite, zielHoehe);
    s.drawImage(bild, 0, 0, zielBreite, zielHoehe);

    const daten = s.getImageData(0, 0, zielBreite, zielHoehe).data;
    return {
      breite: zielBreite,
      hoehe: zielHoehe,
      punkte: Array.from(daten),
      wirksameDpi: zollBreit > 0 ? zielBreite / zollBreit : 0,
    };
  }
}
