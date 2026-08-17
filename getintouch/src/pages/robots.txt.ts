/**
 * robots.txt
 *
 * Profile und Verkaufsseite gehören in den Index — sie sollen gefunden werden.
 * Werkstatt und Vorschau nicht: das eine ist ein Werkzeug, das andere zeigt
 * ungespeicherte Entwürfe, die niemandem gehören. Die Vorlagen-Vorführung ist
 * derselbe Inhalt in zwölf Anstrichen und wäre für eine Suchmaschine nur
 * Dopplung.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = ({ site, url }) => {
  const sitemap = new URL('/sitemap.xml', site ?? url).toString();

  const text = [
    'User-agent: *',
    'Disallow: /werkstatt',
    'Disallow: /designs/',
    'Allow: /designs',
    'Allow: /',
    '',
    `Sitemap: ${sitemap}`,
    '',
  ].join('\n');

  return new Response(text, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
