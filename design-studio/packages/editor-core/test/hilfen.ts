import {
  type Entwurf,
  type Entwurfselement,
  erzeugeEntwurf,
  erzeugeForm,
  erzeugeText,
  type Format,
  festeUhr,
  formatNachSchluessel,
  type Markenkit,
  type Werkzeuge,
  zaehlerId,
} from '../src/index.js';

export function testWerkzeuge(praefix = 'id'): Werkzeuge {
  return { neueId: zaehlerId(praefix), jetzt: festeUhr() };
}

export function format(schluessel: string): Format {
  const gefunden = formatNachSchluessel(schluessel);
  if (gefunden === null) throw new Error(`Testformat "${schluessel}" gibt es nicht`);
  return gefunden;
}

/** A4 hoch bei 300 dpi mit 3 mm Anschnitt — der Druckfall. */
export function druckEntwurf(werkzeuge = testWerkzeuge()): Entwurf {
  return erzeugeEntwurf(
    { organisationId: 'org-1', name: 'Testentwurf', format: format('a4-hoch') },
    werkzeuge,
  );
}

/** Instagram-Beitrag bei 72 dpi ohne Anschnitt — der Bildschirmfall. */
export function socialEntwurf(werkzeuge = testWerkzeuge()): Entwurf {
  return erzeugeEntwurf(
    { organisationId: 'org-1', name: 'Testbeitrag', format: format('instagram-post') },
    werkzeuge,
  );
}

export function mitElementen(entwurf: Entwurf, ...elemente: Entwurfselement[]): Entwurf {
  const erste = entwurf.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');
  return {
    ...entwurf,
    seiten: [{ ...erste, elemente: [...erste.elemente, ...elemente] }, ...entwurf.seiten.slice(1)],
  };
}

export function ersteSeiteId(entwurf: Entwurf): string {
  const erste = entwurf.seiten[0];
  if (erste === undefined) throw new Error('Entwurf ohne Seite');
  return erste.id;
}

export const testMarkenkit: Markenkit = {
  id: 'kit-1',
  organisationId: 'org-1',
  name: 'Testmarke',
  farben: [
    { id: 'f1', name: 'Primär', hex: '#003366', cmyk: null, sonderfarbe: null },
    { id: 'f2', name: 'Weiß', hex: '#ffffff', cmyk: null, sonderfarbe: null },
  ],
  schriften: [
    {
      id: 's1',
      name: 'Inter',
      familie: 'Inter',
      staerken: [400, 700],
      kursivVerfuegbar: false,
      quelleUrl: '/schriften/inter.woff2',
      lizenz: 'ofl',
    },
  ],
  logos: [],
  strikt: true,
};

export { erzeugeForm, erzeugeText };
