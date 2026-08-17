/* Auskunft für die Anwendung: Ist gerade jemand angemeldet?

   Die Werkbank liegt als unveränderte Dateien unter /werkbank/ und wird vom
   Hosting direkt ausgeliefert — an Astro vorbei. Sie lässt sich deshalb nicht
   serverseitig abriegeln. Sie fragt stattdessen hier nach und legt sich selbst
   eine Schranke vor, wenn niemand angemeldet ist.

   Das ist ausdrücklich eine **Anmeldeschranke, keine Zugriffssperre**: wer die
   Adressen der Dateien kennt, kann sie weiterhin laden. Für eine echte Sperre
   müssten die 235 Dateien durch eine serverseitige Prüfung laufen — und damit
   wäre die Werkbank nicht mehr die Anwendung, die auch ohne Server startet.
   Da der Zweck die Anmeldung ist und nicht das Aussperren, ist das die
   richtige Abwägung. Sie steht hier, damit sie niemand später für ein
   Sicherheitsversprechen hält. */

import { members } from '@wix/members';

export const prerender = false;

export async function GET() {
  const antwort = (koerper) => new Response(JSON.stringify(koerper), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      /* Nie zwischenspeichern: sonst zeigt der Browser einem Abgemeldeten die
         Auskunft des vorigen Menschen. */
      'cache-control': 'no-store',
    },
  });

  try {
    const { member } = await members.getCurrentMember();
    if (!member) return antwort({ angemeldet: false });
    return antwort({
      angemeldet: true,
      name: member.profile?.nickname
        || [member.contact?.firstName, member.contact?.lastName].filter(Boolean).join(' ')
        || member.loginEmail
        || 'Angemeldet',
    });
  } catch {
    /* Kein Mitglied, keine Sitzung, oder die Anmeldung ist nicht eingerichtet.
       Alles drei heißt für die Anwendung dasselbe: nicht angemeldet. */
    return antwort({ angemeldet: false });
  }
}
