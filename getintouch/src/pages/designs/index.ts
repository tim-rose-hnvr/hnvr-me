/**
 * Umleitung von `/designs` auf `/vorlagen`.
 *
 * Die Galerie hieß bis zum Nachbau des Handoffs „Designs". Der Handoff nennt
 * sie „Vorlagen", und die Navigation folgt ihm. Die alte Adresse steht zwar
 * in keinem gedruckten QR-Code, aber im zuvor ausgelieferten Verzeichnis und
 * womöglich in fremden Lesezeichen — deshalb 301 statt 404.
 *
 * **Warum `.ts` und nicht `.astro`.** In einer `.astro`-Datei wird ein
 * exportiertes `GET` nicht als Endpunkt genommen; Astro rendert die
 * Komponente und antwortet mit 200 und leerem Rumpf. Erst live aufgefallen,
 * dann lokal nachgestellt.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 301,
    headers: {
      location: '/vorlagen',
      'cache-control': 'public, max-age=0, s-maxage=86400',
    },
  });
