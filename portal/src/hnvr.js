/* Anmeldung über hnvr.me.

   Die Kunden von hnvr.me haben ihr Konto im Wix-Projekt von www.hnvr.me
   („Digitale Erlebnisse"). Das PDF Studio ist eine eigene Site mit eigenem
   Hosting — und damit bisher auch mit eigener, getrennter Mitgliederbasis.
   Wer bei hnvr.me Kunde war, war hier ein Fremder.

   Jetzt meldet das Studio mit dem hnvr.me-Konto an. Dafür trägt das
   hnvr.me-Projekt einen zweiten Zugang (Headless-Client) nur für das Studio;
   seine Kennung steht in HNVR_CLIENT_ID. Wix empfiehlt genau das: je
   Oberfläche, die ein Projekt benutzt, ein eigener Client.

   Getrennt bleibt, was getrennt bleiben muss: Hosting und die Serverrouten mit
   erhöhten Rechten (Kontaktanfragen, Unterschriften) laufen weiter über das
   eigene Projekt. Nur wer angemeldet ist, kommt von hnvr.me.

   Im Keks steht nur der Refresh-Token des Mitglieds. Bei jeder Abfrage macht
   das SDK daraus frische Zugangs-Tokens; ist er abgelaufen oder widerrufen,
   liefert es einen anonymen Besucher — und das heißt hier: abgemeldet. */

import { createClient, OAuthStrategy } from '@wix/sdk';
import { members } from '@wix/members';
import { HNVR_CLIENT_ID } from 'astro:env/server';
import {
  SITZUNG, SITZUNG_SEKUNDEN, liesKeks, keks, keksLoeschen, istOertlich, anzeigename,
} from './hnvr-regeln.js';

/** Ein frischer Client je Anfrage — nie einer, der zwischen Menschen geteilt wird. */
export function hnvrClient() {
  return createClient({
    modules: { members },
    auth: OAuthStrategy({ clientId: HNVR_CLIENT_ID }),
  });
}

/**
 * Wer ist angemeldet — gefragt bei hnvr.me.
 * @param {Request} anfrage
 * @returns {Promise<{ mitglied: any | null, name: string | null, kekse: string[],
 *   unerreichbar?: boolean }>}
 *   kekse: Set-Cookie-Werte, die die Antwort mitnehmen muss (erneuerter oder
 *   gelöschter Sitzungskeks). unerreichbar: hnvr.me hat nicht geantwortet —
 *   das ist etwas anderes als „nicht angemeldet".
 */
export async function hnvrMitglied(anfrage) {
  const sicher = !istOertlich(new URL(anfrage.url));
  const roh = liesKeks(anfrage.headers.get('cookie'), SITZUNG);
  if (!roh) return { mitglied: null, name: null, kekse: [] };

  let refreshToken;
  try { refreshToken = JSON.parse(roh); } catch { refreshToken = null; }
  if (!refreshToken?.value) return { mitglied: null, name: null, kekse: [keksLoeschen(SITZUNG, sicher)] };

  try {
    const client = hnvrClient();
    const tokens = await client.auth.generateVisitorTokens({ refreshToken });
    client.auth.setTokens(tokens);
    if (!client.auth.loggedIn()) {
      /* Abgelaufen oder bei hnvr.me abgemeldet: der Keks ist nichts mehr wert. */
      return { mitglied: null, name: null, kekse: [keksLoeschen(SITZUNG, sicher)] };
    }
    const { member } = await client.members.getCurrentMember();
    const kekse = [];
    if (tokens.refreshToken.value !== refreshToken.value) {
      kekse.push(keks(SITZUNG, JSON.stringify(tokens.refreshToken), { sekunden: SITZUNG_SEKUNDEN, sicher }));
    }
    return { mitglied: member ?? null, name: anzeigename(member), kekse };
  } catch {
    /* hnvr.me antwortet nicht. Den Keks nicht löschen — die Sitzung kann
       noch gültig sein, nur jetzt nicht zu prüfen. */
    return { mitglied: null, name: null, kekse: [], unerreichbar: true };
  }
}
