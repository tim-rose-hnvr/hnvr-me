/**
 * Der QR-Code der veröffentlichten Seite. Regeln siehe `kern/ausgabe.ts`.
 */

import type { APIRoute } from 'astro';
import { fehlt, qrAntwort } from '../../../kern/ausgabe.ts';
import { ablage } from '../../../kern/speicher/index.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, site, url }) => {
  const profil = params.slug ? await ablage().hole(params.slug) : null;
  if (!profil) return fehlt('Diese Seite gibt es nicht.');

  // Die Adresse ändert sich nie, solange die Seite existiert.
  return qrAntwort(new URL(`/t/${profil.slug}`, site ?? url).toString(), 'public, max-age=86400, s-maxage=604800');
};
