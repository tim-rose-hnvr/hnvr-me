/**
 * Der QR-Code als SVG.
 *
 * Vom Server erzeugt statt im Browser gemalt: so ist er ohne JavaScript da,
 * druckt scharf in jeder Größe und kann als Datei in eine Druckvorlage
 * gezogen werden.
 *
 * Fehlerkorrektur „M" ist der brauchbare Mittelweg — rund 15 % der Fläche
 * dürfen zerstört sein. „H" verträgt zwar 30 %, macht das Muster aber so dicht,
 * dass kleine Aufkleber schlechter gelesen werden statt besser.
 */

import type { APIRoute } from 'astro';
import QRCode from 'qrcode';
import { ablage } from '../../../kern/speicher/index.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, site, url }) => {
  const slug = params.slug;
  const profil = slug ? await ablage().hole(slug) : null;

  if (!profil) {
    return new Response('Diese Seite gibt es nicht.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const ziel = new URL(`/t/${profil.slug}`, site ?? url).toString();

  const svg = await QRCode.toString(ziel, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    // Vier Module Ruhezone verlangt die Norm. Ohne sie finden viele Scanner
    // das Muster nicht, sobald es auf farbigem Grund sitzt.
    margin: 4,
    color: { dark: '#000000', light: '#FFFFFF' },
  });

  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      // Die Adresse ändert sich nie, solange die Seite existiert.
      'cache-control': 'public, max-age=86400, s-maxage=604800',
    },
  });
};
