import { describe, expect, it } from 'vitest';
import {
  DPI_DRUCK,
  erzeugeBild,
  mmZuPx,
  nurDruckfehler,
  pruefeDruck,
  ptZuPx,
  wirksameDpi,
  type AssetReferenz,
  type Entwurf,
} from '../src/index.js';
import { druckEntwurf, erzeugeForm, erzeugeText, mitElementen, socialEntwurf, testWerkzeuge } from './hilfen.js';

const anschnittPx = mmZuPx(3, DPI_DRUCK);

function foto(breite: number, hoehe: number): AssetReferenz {
  return { id: 'asset-1', url: '/foto.jpg', breite, hoehe, mimeTyp: 'image/jpeg' };
}

function regeln(entwurf: Entwurf): string[] {
  return pruefeDruck(entwurf).map((b) => b.regel);
}

describe('Anschnitt', () => {
  it('meldet einen Fehler, wenn ein Element übersteht, aber den Anschnittrand nicht erreicht', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    // Ragt 10 px über den linken Rand — der Anschnitt verlangt gut 35 px.
    const entwurf = mitElementen(
      basis,
      erzeugeForm({ x: -10, y: 100, breite: 400, hoehe: 200 }, 'rechteck', { name: 'Balken' }, w),
    );

    const befund = pruefeDruck(entwurf).find((b) => b.regel === 'anschnitt-zu-kurz');
    expect(befund?.schwere).toBe('fehler');
    expect(befund?.meldung).toMatch(/weiße Kante/);
  });

  it('ist zufrieden, wenn das Element bis in den Anschnitt reicht', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const entwurf = mitElementen(
      basis,
      erzeugeForm(
        { x: -anschnittPx, y: -anschnittPx, breite: basis.masse.breite + 2 * anschnittPx, hoehe: 400 },
        'rechteck',
        { name: 'Kopfbalken' },
        w,
      ),
    );

    expect(regeln(entwurf)).not.toContain('anschnitt-zu-kurz');
  });

  it('lässt Elemente innerhalb des Endformats in Ruhe', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const entwurf = mitElementen(
      basis,
      erzeugeForm({ x: 500, y: 500, breite: 400, hoehe: 200 }, 'rechteck', {}, w),
    );

    expect(regeln(entwurf)).not.toContain('anschnitt-zu-kurz');
  });

  it('prüft gar nicht erst, wenn es keinen Anschnitt gibt', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      socialEntwurf(w),
      erzeugeForm({ x: -5, y: -5, breite: 100, hoehe: 100 }, 'rechteck', {}, w),
    );

    expect(regeln(entwurf)).not.toContain('anschnitt-zu-kurz');
  });
});

describe('Sicherheitsabstand', () => {
  it('warnt bei Inhalt dicht am Schnitt', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const entwurf = mitElementen(
      basis,
      erzeugeText({ x: 5, y: 500, breite: 600, hoehe: 100 }, 'Zu weit außen', {}, w),
    );

    const befund = pruefeDruck(entwurf).find((b) => b.regel === 'sicherheitsabstand');
    expect(befund?.schwere).toBe('warnung');
  });

  it('schweigt bei Inhalt innerhalb des Sicherheitskastens', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const entwurf = mitElementen(
      basis,
      erzeugeText({ x: 300, y: 500, breite: 600, hoehe: 100 }, 'Brav', {}, w),
    );

    expect(regeln(entwurf)).not.toContain('sicherheitsabstand');
  });

  it('berücksichtigt die Drehung — ein gekippter Titel wächst über seinen Rahmen hinaus', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    // Ein flach liegender Rahmen (600 x 100) wächst beim Kippen vor allem in der
    // Höhe: die Hülle wird an beiden Achsen 495 px groß. Deshalb muss der
    // Prüffall an der Oberkante liegen, nicht an der Seite.
    const rahmen = { x: 300, y: 250, breite: 600, hoehe: 100 };
    const gerade = mitElementen(basis, erzeugeText(rahmen, 'gerade', {}, w));
    const gekippt = mitElementen(basis, erzeugeText(rahmen, 'gekippt', { drehung: 45 }, w));

    expect(regeln(gerade)).not.toContain('sicherheitsabstand');
    expect(regeln(gekippt)).toContain('sicherheitsabstand');
  });
});

describe('Bildauflösung', () => {
  it('rechnet die wirksame dpi aus Quellgröße, Zuschnitt und Platzierung', () => {
    const w = testWerkzeuge();
    // 1200 px Quelle auf 4 Zoll (1200 px bei 300 dpi) platziert -> 300 dpi.
    const bild = erzeugeBild({ x: 0, y: 0, breite: 1200, hoehe: 1200 }, foto(1200, 1200), {}, w);
    expect(wirksameDpi(bild, DPI_DRUCK)).toBeCloseTo(300, 6);

    // Halber Zuschnitt heißt halb so viele nutzbare Quellpixel.
    const halb = { ...bild, zuschnitt: { x: 0, y: 0, breite: 0.5, hoehe: 0.5 } };
    expect(wirksameDpi(halb, DPI_DRUCK)).toBeCloseTo(150, 6);
  });

  it('meldet einen Fehler unter 100 dpi und eine Warnung unter 150 dpi', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);

    const zuKlein = mitElementen(
      basis,
      erzeugeBild({ x: 200, y: 200, breite: 1200, hoehe: 1200 }, foto(300, 300), {}, w),
    );
    expect(nurDruckfehler(pruefeDruck(zuKlein)).some((b) => b.regel === 'aufloesung')).toBe(true);

    const grenzwertig = mitElementen(
      basis,
      erzeugeBild({ x: 200, y: 200, breite: 1200, hoehe: 1200 }, foto(500, 500), {}, w),
    );
    const befund = pruefeDruck(grenzwertig).find((b) => b.regel === 'aufloesung');
    expect(befund?.schwere).toBe('warnung');
  });

  it('lässt sich für Bildschirmausgaben abschalten', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeBild({ x: 200, y: 200, breite: 1200, hoehe: 1200 }, foto(200, 200), {}, w),
    );

    expect(pruefeDruck(entwurf, { pruefeAufloesung: false }).map((b) => b.regel)).not.toContain('aufloesung');
  });
});

describe('Haarlinien', () => {
  it('meldet eine Kontur unter 0,25 pt als Fehler', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeForm({ x: 300, y: 300, breite: 400, hoehe: 200 }, 'rechteck', {
        kontur: { farbe: '#003366', staerke: ptZuPx(0.1, DPI_DRUCK) },
      }, w),
    );

    const befund = pruefeDruck(entwurf).find((b) => b.regel === 'haarlinie');
    expect(befund?.schwere).toBe('fehler');
  });

  it('lässt eine ausreichend starke Kontur durch', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeForm({ x: 300, y: 300, breite: 400, hoehe: 200 }, 'rechteck', {
        kontur: { farbe: '#003366', staerke: ptZuPx(1, DPI_DRUCK) },
      }, w),
    );

    expect(regeln(entwurf)).not.toContain('haarlinie');
  });
});

describe('Sonstiges', () => {
  it('warnt vor fehlendem Hintergrund bei randabfallendem Druck', () => {
    const w = testWerkzeuge();
    const basis = druckEntwurf(w);
    const ohne: Entwurf = {
      ...basis,
      seiten: basis.seiten.map((s) => ({ ...s, hintergrund: null })),
    };

    expect(regeln(ohne)).toContain('hintergrund-fehlt');
  });

  it('übergeht unsichtbare Elemente', () => {
    const w = testWerkzeuge();
    const entwurf = mitElementen(
      druckEntwurf(w),
      erzeugeForm({ x: -10, y: 100, breite: 400, hoehe: 200 }, 'rechteck', { sichtbar: false }, w),
    );

    expect(regeln(entwurf)).not.toContain('anschnitt-zu-kurz');
  });
});
