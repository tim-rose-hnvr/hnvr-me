/**
 * Die Visitenkarte der veröffentlichten Seite. Regeln siehe `kern/ausgabe.ts`.
 */

import type { APIRoute } from 'astro';
import { fehlt, herkunft, vcardAntwort } from '../../../kern/ausgabe.ts';
import { ablage } from '../../../kern/speicher/index.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, site, url }) => {
  const profil = params.slug ? await ablage().hole(params.slug) : null;
  if (!profil) return fehlt('Diese Seite gibt es nicht.');

  return vcardAntwort(profil, {
    seite: new URL(`/t/${profil.slug}`, site ?? url).toString(),
    hier: herkunft(request, url),
    zwischenspeicher: 'public, max-age=0, s-maxage=300',
  });
};
