/**
 * Die Visitenkarte als Datei.
 *
 * Bewusst eine echte Adresse und kein Blob, den ein Skript im Browser baut:
 * ältere iOS-Versionen brechen bei blob-Downloads ab, und ohne JavaScript
 * gäbe es gar keine Karte. Eine Adresse, die `text/vcard` ausliefert, versteht
 * jedes Gerät — sie lässt sich außerdem verlinken, im QR-Code unterbringen und
 * per Mail verschicken.
 */

import type { APIRoute } from 'astro';
import { alsDatenadresse } from '../../../kern/bild.ts';
import { ablage } from '../../../kern/speicher/index.ts';
import { baueVcard, vcardDateiname } from '../../../kern/vcard.ts';

export const prerender = false;

export const GET: APIRoute = async ({ params, site, url }) => {
  const slug = params.slug;
  const profil = slug ? await ablage().hole(slug) : null;

  if (!profil?.visitenkarte) {
    return new Response('Für diese Seite gibt es keine Visitenkarte.', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const seite = new URL(`/t/${profil.slug}`, site ?? url).toString();
  // Das Foto wird eingebettet, nicht verlinkt — siehe `bild.ts`. Der Abruf
  // geht gegen die eigene Adresse, damit relative Pfade aufgehen.
  const bild = await alsDatenadresse(profil.kopf.bild, url);

  const vcard = baueVcard(profil.visitenkarte, {
    bild,
    seite,
    stand: new Date(),
  });

  return new Response(vcard, {
    headers: {
      // charset gehört dazu: ohne sie landen Umlaute in manchen Adressbüchern
      // als Fragezeichen.
      'content-type': 'text/vcard; charset=utf-8',
      'content-disposition': `attachment; filename="${vcardDateiname(profil.visitenkarte)}"`,
      'cache-control': 'public, max-age=0, s-maxage=300',
    },
  });
};
