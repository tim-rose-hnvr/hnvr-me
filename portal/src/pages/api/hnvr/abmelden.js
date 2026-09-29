/* Abmelden — hier und bei hnvr.me.

   POST /api/hnvr/abmelden?returnToUrl=/

   Es gibt nur eine Anmeldung, also gibt es auch nur eine Abmeldung: wer sich
   im Studio abmeldet, ist danach auch bei hnvr.me abgemeldet. Sonst meldete
   das stille Anmelden ihn beim nächsten Klick sofort wieder an — ein
   Abmeldeknopf, der nichts tut.

   POST und nicht GET, damit kein eingebettetes Bild und kein vorgeladener
   Link jemanden abmeldet. */

import { hnvrClient } from '../../../hnvr.js';
import { SITZUNG, keksLoeschen, sichererRuecksprung, istOertlich } from '../../../hnvr-regeln.js';

export const prerender = false;

export async function POST({ url }) {
  const ruecksprung = sichererRuecksprung(url.searchParams.get('returnToUrl'), '/');
  const kopf = new Headers({ 'Cache-Control': 'no-store' });
  kopf.append('Set-Cookie', keksLoeschen(SITZUNG, !istOertlich(url)));

  let ziel = ruecksprung;
  try {
    const { logoutUrl } = await hnvrClient().auth.logout(new URL(ruecksprung, url).toString());
    if (logoutUrl) ziel = logoutUrl;
  } catch {
    /* hnvr.me nicht erreichbar: hier ist trotzdem abgemeldet. */
  }
  kopf.set('Location', ziel);
  return new Response(null, { status: 303, headers: kopf });
}
