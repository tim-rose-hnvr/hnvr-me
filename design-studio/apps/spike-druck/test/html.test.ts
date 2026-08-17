import { erzeugeForm, erzeugeText, festeUhr, type Werkzeuge, zaehlerId } from '@studio/editor-core';
import { describe, expect, it } from 'vitest';
import { PRUEF_SCHRIFT, pruefentwurf } from '../src/beispiel.js';
import { blattmasse, entwurfZuHtml } from '../src/html.js';

function w(): Werkzeuge {
  return { neueId: zaehlerId('h'), jetzt: festeUhr() };
}

const schriften = [
  { familie: PRUEF_SCHRIFT, gewicht: 400, kursiv: false, quelle: 'file:///tmp/a.ttf' },
];

describe('blattmasse', () => {
  it('schlägt den Anschnitt auf beiden Achsen auf', () => {
    const e = pruefentwurf(w());
    const blatt = blattmasse(e);
    expect(blatt.breite).toBeCloseTo(e.masse.breite + e.anschnitt.links + e.anschnitt.rechts, 9);
    expect(blatt.hoehe).toBeCloseTo(e.masse.hoehe + e.anschnitt.oben + e.anschnitt.unten, 9);
  });
});

describe('entwurfZuHtml', () => {
  it('verschiebt alles um den Anschnitt, damit nichts negativ wird', () => {
    const e = pruefentwurf(w());
    const html = entwurfZuHtml(e, { schriften });
    // Der Kopfbalken liegt im Entwurf bei -anschnitt und muss im HTML bei 0 landen.
    expect(html).toContain('left:0px;top:0px');
  });

  it('setzt die Schrift in einfache Anführungszeichen', () => {
    // Der Fehler, der diesen Test verursacht hat: JSON.stringify liefert
    // doppelte Anführungszeichen, die das umgebende style="…" beenden. Die
    // Folge war kein Fehler, sondern stiller Ersatzschriftgebrauch.
    const e = pruefentwurf(w());
    const html = entwurfZuHtml(e, { schriften });

    // Nur die style-Attribute prüfen: im <style>-Block sind doppelte
    // Anführungszeichen richtig, dort beenden sie kein Attribut.
    const stilAttribute = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1] ?? '');
    const mitSchrift = stilAttribute.filter((s) => s.includes('font-family'));

    expect(mitSchrift.length).toBeGreaterThan(0);
    for (const stil of mitSchrift) {
      expect(stil).toContain(`font-family:'${PRUEF_SCHRIFT}'`);
    }
  });

  it('bricht ein style-Attribut auch bei Anführungszeichen im Namen nicht auf', () => {
    const entwurf = pruefentwurf(w());
    const boesartig = {
      ...entwurf,
      seiten: entwurf.seiten.map((s) => ({
        ...s,
        elemente: [
          erzeugeText(
            { x: 0, y: 0, breite: 100, hoehe: 20 },
            'x',
            { schriftFamilie: `Bö"se'r Name` },
            w(),
          ),
        ],
      })),
    };

    const html = entwurfZuHtml(boesartig, { schriften });
    const stil = /style="([^"]*)"/.exec(html.slice(html.indexOf('data-typ="text"')));
    expect(stil?.[1]).toContain('font-family:');
  });

  it('schreibt Farben und Drehung als data-Attribute, nicht nur als Stil', () => {
    const entwurf = pruefentwurf(w());
    const html = entwurfZuHtml(entwurf, { schriften });

    // Aus dem berechneten Stil kämen rgb(...) und eine Matrix zurück.
    expect(html).toContain('data-farbe="#000000"');
    expect(html).toContain('data-fuellung="#0a5c8a"');
    expect(html).toContain('data-kontur-farbe=');
  });

  it('maskiert Textinhalt, statt ihn als Auszeichnung durchzulassen', () => {
    const entwurf = pruefentwurf(w());
    const mitTags = {
      ...entwurf,
      seiten: entwurf.seiten.map((s) => ({
        ...s,
        elemente: [
          erzeugeText({ x: 0, y: 0, breite: 100, hoehe: 20 }, '<script>böse()</script>', {}, w()),
        ],
      })),
    };

    const html = entwurfZuHtml(mitTags, { schriften });
    expect(html).not.toContain('<script>böse');
    expect(html).toContain('&lt;script&gt;');
  });

  it('lässt unsichtbare Elemente weg', () => {
    const entwurf = pruefentwurf(w());
    const versteckt = {
      ...entwurf,
      seiten: entwurf.seiten.map((s) => ({
        ...s,
        elemente: [
          erzeugeForm({ x: 0, y: 0, breite: 10, hoehe: 10 }, 'rechteck', { sichtbar: false }, w()),
        ],
      })),
    };

    expect(entwurfZuHtml(versteckt, { schriften })).not.toContain('data-typ="form"');
  });

  it('erzeugt für jede Schrift eine @font-face-Regel', () => {
    const e = pruefentwurf(w());
    const html = entwurfZuHtml(e, {
      schriften: [
        { familie: 'A', gewicht: 400, kursiv: false, quelle: 'file:///a.ttf' },
        { familie: 'A', gewicht: 700, kursiv: true, quelle: 'file:///b.ttf' },
      ],
    });

    expect((html.match(/@font-face/g) ?? []).length).toBe(2);
    expect(html).toContain('font-style:italic');
    expect(html).toContain('font-weight:700');
  });
});
