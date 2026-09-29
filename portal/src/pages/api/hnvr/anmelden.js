/* Anmelden mit dem hnvr.me-Konto — der Weg hin.

   GET /api/hnvr/anmelden?returnToUrl=/studio/index.html[&prompt=login]

   Ohne `prompt` beginnt es still: wer bei hnvr.me schon angemeldet ist, sieht
   kein Formular, sondern ist nach einem Umweg über Wix einfach da. Kommt Wix
   ohne Anmeldung zurück, schickt /api/hnvr/rueckkehr ein zweites Mal hierher,
   dann mit `prompt=login` — und erst jetzt erscheint die Anmeldeseite.

   Der Vorgang (PKCE-Daten und ob still gefragt wurde) liegt eine halbe Stunde
   in einem HttpOnly-Keks, bis Wix zurückkommt. */

import { hnvrClient } from '../../../hnvr.js';
import {
  VORGANG, VORGANG_SEKUNDEN, keks, sichererRuecksprung, rueckkehrAdresse, istOertlich,
} from '../../../hnvr-regeln.js';

export const prerender = false;

export async function GET({ url }) {
  const ruecksprung = sichererRuecksprung(url.searchParams.get('returnToUrl'), '/portal');
  const prompt = url.searchParams.get('prompt') === 'login' ? 'login' : 'none';

  try {
    const client = hnvrClient();
    const oauthData = client.auth.generateOAuthData(rueckkehrAdresse(url), ruecksprung);
    const { authUrl } = await client.auth.getAuthUrl(oauthData, { prompt, responseMode: 'query' });
    return new Response(null, {
      status: 302,
      headers: {
        Location: authUrl,
        'Set-Cookie': keks(VORGANG, JSON.stringify({ oauthData, prompt }),
          { sekunden: VORGANG_SEKUNDEN, sicher: !istOertlich(url) }),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    /* hnvr.me nicht erreichbar oder der Zugang nicht eingerichtet. Nicht mit
       einer leeren Seite stehen lassen — zurück, mit einem Wort dazu. */
    return new Response(null, {
      status: 302,
      headers: { Location: '/portal?anmeldung=unerreichbar', 'Cache-Control': 'no-store' },
    });
  }
}
