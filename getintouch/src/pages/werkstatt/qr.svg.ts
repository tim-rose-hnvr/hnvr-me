/**
 * Der QR-Code eines Entwurfs.
 *
 * Er zeigt schon auf die künftige Adresse `/t/<name>` — so lässt sich vorher
 * prüfen, ob der gewünschte Name auf einem Aufkleber noch lesbar ist. Gedruckt
 * wird natürlich erst, wenn die Seite steht.
 */

import type { APIRoute } from 'astro';
import { fehlt, qrAntwort } from '../../kern/ausgabe.ts';
import { entwurfAus } from './entwurf.ts';

export const prerender = false;

export const GET: APIRoute = async ({ url, site }) => {
  const profil = await entwurfAus(url.searchParams);
  if (!profil) return fehlt('Kein lesbarer Entwurf in der Adresse.');

  return qrAntwort(new URL(`/t/${profil.slug}`, site ?? url).toString(), 'no-store');
};
