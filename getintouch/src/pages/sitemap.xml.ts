/**
 * Die Sitemap.
 *
 * Enthält, was jemand suchen soll: die Verkaufsseite, die Galerie und jedes
 * veröffentlichte Profil. Nicht enthalten sind Werkstatt, Vorschau und die
 * einzelnen Vorlagen-Vorführungen — Werkzeug und Dopplung gehören nicht in
 * einen Index.
 */

import type { APIRoute } from 'astro';
import { ablage } from '../kern/speicher/index.ts';

export const prerender = false;

function eintrag(adresse: string, gewicht: string): string {
  return `  <url><loc>${adresse}</loc><priority>${gewicht}</priority></url>`;
}

export const GET: APIRoute = async ({ site, url }) => {
  const basis = site ?? new URL('/', url);
  const slugs = await ablage().liste();

  const zeilen = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    eintrag(new URL('/', basis).toString(), '1.0'),
    eintrag(new URL('/designs', basis).toString(), '0.6'),
    ...slugs.map((slug) => eintrag(new URL(`/t/${slug}`, basis).toString(), '0.9')),
    '</urlset>',
    '',
  ];

  return new Response(zeilen.join('\n'), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  });
};
