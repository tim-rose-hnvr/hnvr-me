/**
 * Die Sitemap.
 *
 * Enthält, was jemand suchen soll: die Verkaufsseite, die Galerie und jedes
 * veröffentlichte Profil. Nicht enthalten sind Werkstatt, Vorschau und die
 * einzelnen Vorlagen-Vorführungen — Werkzeug und Dopplung gehören nicht in
 * einen Index.
 *
 * **Warum nicht `/sitemap.xml`.** Dort kommt die Anfrage nie an: Wix beantwortet
 * den Pfad selbst und liefert für dieses Headless-Projekt eine 404 aus, bevor
 * überhaupt etwas von hier läuft — dieselbe Übernahme wie bei `robots.txt`.
 * Nachgemessen am 18. August 2026 mit `curl`.
 *
 * Damit Suchmaschinen das Verzeichnis finden, muss die Zeile `Sitemap:` in der
 * von Wix erzeugten `robots.txt` auf diesen Pfad zeigen. Das geht nur im
 * Dashboard unter SEO-Tools, nicht von hier aus; es steht in
 * `doku/naechste-schritte.md` bei den Dingen, die nur der Kontoinhaber kann.
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
    eintrag(new URL('/vorlagen', basis).toString(), '0.6'),
    eintrag(new URL('/preise', basis).toString(), '0.7'),
    eintrag(new URL('/marke', basis).toString(), '0.4'),
    eintrag(new URL('/karte', basis).toString(), '0.6'),
    eintrag(new URL('/teams', basis).toString(), '0.5'),
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
