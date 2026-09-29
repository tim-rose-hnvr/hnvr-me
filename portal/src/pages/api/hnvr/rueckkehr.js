/* Anmelden mit dem hnvr.me-Konto — der Weg zurück.

   Wix schickt hierher, entweder mit einem Code (angemeldet) oder mit einem
   Fehler (niemand angemeldet, oder abgebrochen). Was dann geschieht,
   entscheidet `entscheideRueckkehr` in hnvr-regeln.js — dort steht es
   getrennt, damit es sich ohne Server prüfen lässt. */

import { hnvrClient } from '../../../hnvr.js';
import {
  SITZUNG, VORGANG, SITZUNG_SEKUNDEN, keks, keksLoeschen, liesKeks, entscheideRueckkehr, istOertlich,
  sichererRuecksprung,
} from '../../../hnvr-regeln.js';

export const prerender = false;

export async function GET({ url, request }) {
  const sicher = !istOertlich(url);
  const vorgangRoh = liesKeks(request.headers.get('cookie'), VORGANG);
  let vorgang = null;
  try { vorgang = vorgangRoh ? JSON.parse(vorgangRoh) : null; } catch { vorgang = null; }

  const entscheidung = entscheideRueckkehr({
    fehler: url.searchParams.get('error'),
    code: url.searchParams.get('code'),
    zustand: url.searchParams.get('state'),
    vorgang,
  });

  const weiter = (ziel, kekse = []) => {
    const kopf = new Headers({ Location: ziel, 'Cache-Control': 'no-store' });
    kopf.append('Set-Cookie', keksLoeschen(VORGANG, sicher));
    for (const k of kekse) kopf.append('Set-Cookie', k);
    return new Response(null, { status: 302, headers: kopf });
  };

  if (entscheidung.art === 'mit-formular') {
    return weiter(`/api/hnvr/anmelden?prompt=login&returnToUrl=${encodeURIComponent(entscheidung.ruecksprung)}`);
  }
  if (entscheidung.art === 'fehlschlag') {
    return weiter(`/portal?anmeldung=abgebrochen&grund=${encodeURIComponent(entscheidung.grund)}`);
  }

  try {
    const client = hnvrClient();
    const tokens = await client.auth.getMemberTokens(
      url.searchParams.get('code'), url.searchParams.get('state'), vorgang.oauthData);
    /* Der Keks ist unser eigener und HttpOnly — geprüft wird das Ziel trotzdem.
       Ein Umleiter, der nur „meistens" sicher ist, ist keiner. */
    const ziel = sichererRuecksprung(vorgang.oauthData.originalUri, '/portal');
    return weiter(ziel, [
      keks(SITZUNG, JSON.stringify(tokens.refreshToken), { sekunden: SITZUNG_SEKUNDEN, sicher }),
    ]);
  } catch {
    return weiter('/portal?anmeldung=abgebrochen&grund=tokens');
  }
}
