import { describe, expect, it } from 'vitest';
import {
  type Aussage,
  feldwert,
  gebundeneFelder,
  kapazitaetInZeichen,
  loeseBindungen,
  schreibeTermin,
  stufen,
  tageBisTermin,
  waehleStufe,
} from '../src/index.js';
import { druckEntwurf, erzeugeText, mitElementen, testWerkzeuge } from './hilfen.js';

const AUSSAGE: Aussage = {
  id: 'a-1',
  organisationId: 'org-1',
  name: 'Sommerfest',
  felder: {
    titel: feldwert('Sommerfest der Hauptverwaltung 2026', 'Sommerfest 2026', 'Sommerfest'),
    ort: feldwert('Hauptverwaltung, Gebäude C'),
  },
  termin: '2026-09-12T00:00:00.000Z',
  erstelltAm: '2026-01-01T00:00:00.000Z',
  geaendertAm: '2026-01-01T00:00:00.000Z',
};

describe('Kürzungsstufen', () => {
  it('nimmt die längste Fassung, die hineinpasst', () => {
    const wert = feldwert('Sommerfest der Hauptverwaltung 2026', 'Sommerfest 2026', 'Sommerfest');
    expect(waehleStufe(wert, 100).stufe).toBe('lang');
    expect(waehleStufe(wert, 20).stufe).toBe('mittel');
    expect(waehleStufe(wert, 12).stufe).toBe('kurz');
  });

  it('lässt lieber überlaufen als abzuschneiden', () => {
    // Ein abgeschnittener Satz ist falsch, ein überlaufender nur eng. Die
    // Prüfung meldet den Überlauf — die Aussage bleibt wahr.
    const wert = feldwert('Sommerfest', undefined, undefined);
    const gewaehlt = waehleStufe(wert, 3);
    expect(gewaehlt.text).toBe('Sommerfest');
    expect(gewaehlt.passt).toBe(false);
  });

  it('kommt mit nur einer Fassung aus', () => {
    expect(stufen(feldwert('Nur lang'))).toHaveLength(1);
  });

  it('schätzt die Kapazität aus Rahmen und Schriftgröße', () => {
    // 400 px breit, 100 px hoch, 20 px Schrift, Zeilenabstand 1,25:
    // 40 Zeichen je Zeile mal 4 Zeilen.
    expect(kapazitaetInZeichen(400, 100, 20, 1.25)).toBe(160);
    expect(kapazitaetInZeichen(0, 100, 20, 1.25)).toBe(0);
    expect(kapazitaetInZeichen(400, 100, 0, 1.25)).toBe(0);
  });
});

describe('Termin als Zeitpunkt, nicht als Text', () => {
  it('schreibt ihn je Stufe anders, statt ihn zu kürzen', () => {
    expect(schreibeTermin('2026-09-12T00:00:00.000Z', 'lang')).toBe('12. September 2026');
    expect(schreibeTermin('2026-09-12T00:00:00.000Z', 'mittel')).toBe('12. Sep. 2026');
    expect(schreibeTermin('2026-09-12T00:00:00.000Z', 'kurz')).toBe('12.9.26');
  });

  it('lässt unlesbare Angaben unverändert durch', () => {
    expect(schreibeTermin('kein datum', 'lang')).toBe('kein datum');
  });

  it('rechnet Tage bis zum Termin', () => {
    expect(tageBisTermin(AUSSAGE, new Date('2026-09-09T12:00:00Z'))).toBe(3);
    expect(tageBisTermin(AUSSAGE, new Date('2026-09-12T23:00:00Z'))).toBe(0);
    expect(tageBisTermin(AUSSAGE, new Date('2026-09-20T00:00:00Z'))).toBe(-8);
    expect(tageBisTermin({ ...AUSSAGE, termin: null }, new Date())).toBeNull();
  });
});

describe('Bindung statt Kopie', () => {
  function entwurfMitBindung(breite: number, schriftGroesse: number) {
    const w = testWerkzeuge();
    return mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 0, y: 0, breite, hoehe: 200 },
        'wird ersetzt',
        {
          name: 'Schlagzeile',
          schriftGroesse,
          zeilenabstand: 1.2,
          platzhalter: {
            schluessel: 'schlagzeile',
            bearbeitbar: ['text'],
            beschriftung: null,
            bindung: 'titel',
          },
        },
        w,
      ),
    );
  }

  it('setzt den Feldinhalt ein, statt ihn zu kopieren', () => {
    const { entwurf, befunde } = loeseBindungen(entwurfMitBindung(3000, 60), AUSSAGE);
    const text = entwurf.seiten[0]?.elemente[0];
    if (text?.typ !== 'text') throw new Error('Textelement erwartet');

    expect(text.inhalt).toBe('Sommerfest der Hauptverwaltung 2026');
    expect(befunde[0]?.feld).toBe('titel');
    expect(befunde[0]?.stufe).toBe('lang');
  });

  it('wählt bei engem Rahmen eine kürzere Fassung — ohne zweites Tippen', () => {
    // Derselbe Titel, kleinerer Rahmen: das ist der Kern des Ganzen.
    const { entwurf, befunde } = loeseBindungen(entwurfMitBindung(300, 60), AUSSAGE);
    const text = entwurf.seiten[0]?.elemente[0];
    if (text?.typ !== 'text') throw new Error('Textelement erwartet');

    expect(befunde[0]?.stufe).not.toBe('lang');
    expect(text.inhalt.length).toBeLessThan('Sommerfest der Hauptverwaltung 2026'.length);
  });

  it('zieht bei geänderter Aussage überall nach', () => {
    const basis = entwurfMitBindung(3000, 60);
    const geaendert: Aussage = {
      ...AUSSAGE,
      felder: { ...AUSSAGE.felder, titel: feldwert('Winterfest 2027') },
    };

    const vorher = loeseBindungen(basis, AUSSAGE).entwurf.seiten[0]?.elemente[0];
    const nachher = loeseBindungen(basis, geaendert).entwurf.seiten[0]?.elemente[0];
    if (vorher?.typ !== 'text' || nachher?.typ !== 'text') throw new Error('Text erwartet');

    expect(vorher.inhalt).toContain('Sommerfest');
    expect(nachher.inhalt).toBe('Winterfest 2027');
  });

  it('meldet ein Feld, das die Aussage nicht hat', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 0, y: 0, breite: 500, hoehe: 100 },
        'x',
        {
          platzhalter: {
            schluessel: 'k',
            bearbeitbar: ['text'],
            beschriftung: null,
            bindung: 'kontakt',
          },
        },
        w,
      ),
    );

    expect(loeseBindungen(entwurf, AUSSAGE).fehlendeFelder).toEqual(['kontakt']);
  });

  it('ignoriert eine Bindung auf einen unbekannten Schlüssel', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 0, y: 0, breite: 500, hoehe: 100 },
        'bleibt',
        {
          platzhalter: {
            schluessel: 'k',
            bearbeitbar: ['text'],
            beschriftung: null,
            bindung: 'gibt-es-nicht',
          },
        },
        w,
      ),
    );

    const { entwurf: danach, befunde } = loeseBindungen(entwurf, AUSSAGE);
    const text = danach.seiten[0]?.elemente[0];
    if (text?.typ !== 'text') throw new Error('Text erwartet');
    expect(text.inhalt).toBe('bleibt');
    expect(befunde).toEqual([]);
  });

  it('listet die Felder, auf die ein Entwurf sich stützt', () => {
    expect(gebundeneFelder(entwurfMitBindung(500, 40))).toEqual(['titel']);
  });
});

describe('Gebundener Termin', () => {
  function terminEntwurf(breite: number, schriftGroesse: number) {
    const w = testWerkzeuge();
    return mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 0, y: 0, breite, hoehe: schriftGroesse * 1.2 },
        '',
        {
          name: 'Termin',
          schriftGroesse,
          zeilenabstand: 1.2,
          platzhalter: {
            schluessel: 'termin',
            bearbeitbar: ['text'],
            beschriftung: null,
            bindung: 'termin',
          },
        },
        w,
      ),
    );
  }

  it('schreibt ihn je nach Platz aus oder kurz — er wird nie abgeschnitten', () => {
    const weit = loeseBindungen(terminEntwurf(2000, 60), AUSSAGE).befunde[0];
    expect(weit?.stufe).toBe('lang');
    expect(weit?.text).toBe('12. September 2026');

    const eng = loeseBindungen(terminEntwurf(500, 60), AUSSAGE).befunde[0];
    expect(eng?.stufe).toBe('mittel');
    expect(eng?.text).toBe('12. Sep. 2026');

    const sehrEng = loeseBindungen(terminEntwurf(260, 60), AUSSAGE).befunde[0];
    expect(sehrEng?.stufe).toBe('kurz');
    expect(sehrEng?.text).toBe('12.9.26');
  });

  it('läuft lieber über, als ein Datum zu verstümmeln', () => {
    const befund = loeseBindungen(terminEntwurf(60, 60), AUSSAGE).befunde[0];
    expect(befund?.passt).toBe(false);
    expect(befund?.text).toBe('12.9.26');
  });

  it('fällt ohne Termin auf die Textfassungen des Feldes zurück', () => {
    // Ohne Zeitpunkt gibt es nichts zu rechnen — dann zählt nur, was getippt wurde.
    const ohne: Aussage = {
      ...AUSSAGE,
      termin: null,
      felder: { ...AUSSAGE.felder, termin: feldwert('nach Vereinbarung') },
    };
    const befund = loeseBindungen(terminEntwurf(2000, 60), ohne).befunde[0];
    expect(befund?.text).toBe('nach Vereinbarung');
  });

  it('rechnet nicht mit einem unlesbaren Zeitpunkt', () => {
    expect(tageBisTermin({ ...AUSSAGE, termin: 'übermorgen' }, new Date())).toBeNull();
  });
});

describe('Gemessen statt geschätzt', () => {
  function schlagzeile(breite: number, hoehe: number, schriftGroesse: number) {
    const w = testWerkzeuge();
    return mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 0, y: 0, breite, hoehe },
        '',
        {
          name: 'Schlagzeile',
          schriftGroesse,
          zeilenabstand: 1.15,
          platzhalter: {
            schluessel: 'titel',
            bearbeitbar: ['text'],
            beschriftung: null,
            bindung: 'titel',
          },
        },
        w,
      ),
    );
  }

  /** Satzsimulation: feste Zeichenbreite, harter Umbruch, Höhe aus Zeilenzahl. */
  function messerMitZeichenbreite(anteilEm: number) {
    return (
      text: string,
      element: { breite: number; schriftGroesse: number; zeilenabstand: number },
    ) => {
      const zeichenJeZeile = Math.max(
        1,
        Math.floor(element.breite / (element.schriftGroesse * anteilEm)),
      );
      const zeilen = Math.ceil(text.length / zeichenJeZeile);
      return zeilen * element.schriftGroesse * element.zeilenabstand;
    };
  }

  it('widerspricht der Schätzung, wenn der Satz breiter baut', () => {
    // Genau der Fall aus dem Probemodell: die Schätzung mit 0,5 em sagt „passt",
    // eine fette Grotesk baut mit 0,62 em aber eine Zeile mehr und läuft über
    // den Untertitel. Die Messung hat das letzte Wort.
    const entwurf = schlagzeile(1200, 130 * 1.15 * 2, 130);

    const geschaetzt = loeseBindungen(entwurf, AUSSAGE).befunde[0];
    expect(geschaetzt?.stufe).toBe('lang');
    expect(geschaetzt?.gemessen).toBe(false);

    const gemessen = loeseBindungen(entwurf, AUSSAGE, messerMitZeichenbreite(0.62)).befunde[0];
    expect(gemessen?.gemessen).toBe(true);
    expect(gemessen?.stufe).toBe('mittel');
    expect(gemessen?.passt).toBe(true);
  });

  it('nimmt die lange Fassung, sobald der Rahmen sie wirklich trägt', () => {
    const entwurf = schlagzeile(1200, 130 * 1.15 * 3, 130);
    const gemessen = loeseBindungen(entwurf, AUSSAGE, messerMitZeichenbreite(0.62)).befunde[0];
    expect(gemessen?.stufe).toBe('lang');
  });

  it('meldet Überlauf, wenn auch die kürzeste Fassung nicht hineinmisst', () => {
    const entwurf = schlagzeile(200, 40, 130);
    const gemessen = loeseBindungen(entwurf, AUSSAGE, messerMitZeichenbreite(0.62)).befunde[0];
    expect(gemessen?.passt).toBe(false);
    expect(gemessen?.stufe).toBe('kurz');
  });

  it('misst auch den Termin, statt seine Zeichen zu zählen', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeText(
        { x: 0, y: 0, breite: 400, hoehe: 60 * 1.15 },
        '',
        {
          schriftGroesse: 60,
          zeilenabstand: 1.15,
          platzhalter: {
            schluessel: 'termin',
            bearbeitbar: ['text'],
            beschriftung: null,
            bindung: 'termin',
          },
        },
        w,
      ),
    );
    // 400 px bei 60 px Schrift und 0,62 em: gut zehn Zeichen je Zeile.
    // „12. September 2026" bräuchte zwei, „12.9.26" passt in eine.
    const gemessen = loeseBindungen(entwurf, AUSSAGE, messerMitZeichenbreite(0.62)).befunde[0];
    expect(gemessen?.text).toBe('12.9.26');
  });
});
