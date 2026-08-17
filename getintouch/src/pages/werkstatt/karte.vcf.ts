/**
 * Die Visitenkarte eines Entwurfs.
 *
 * Ohne sie zeigte „Kontakt speichern" in der Vorschau ins Leere — die Seite
 * unter `/t/<name>` gibt es ja noch nicht. Dieselben Regeln wie live, nur die
 * Quelle ist eine andere.
 */

import type { APIRoute } from 'astro';
import { fehlt, herkunft, vcardAntwort } from '../../kern/ausgabe.ts';
import { entwurfAus } from './entwurf.ts';

export const prerender = false;

export const GET: APIRoute = async ({ request, url, site }) => {
  const profil = await entwurfAus(url.searchParams);
  if (!profil) return fehlt('Kein lesbarer Entwurf in der Adresse.');

  return vcardAntwort(profil, {
    seite: new URL(`/t/${profil.slug}`, site ?? url).toString(),
    hier: herkunft(request, url),
    // Ein Entwurf ändert sich bei jedem Tastendruck.
    zwischenspeicher: 'no-store',
  });
};
