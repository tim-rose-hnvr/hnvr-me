/* Auskunft für die Anwendung: Ist gerade jemand angemeldet?

   Das Studio liegt als unveränderte Dateien unter /studio/ und wird vom
   Hosting direkt ausgeliefert — an Astro vorbei. Sie lässt sich deshalb nicht
   serverseitig abriegeln. Sie fragt stattdessen hier nach und legt sich selbst
   eine Schranke vor, wenn niemand angemeldet ist.

   Das ist ausdrücklich eine **Anmeldeschranke, keine Zugriffssperre**: wer die
   Adressen der Dateien kennt, kann sie weiterhin laden. Für eine echte Sperre
   müssten die 235 Dateien durch eine serverseitige Prüfung laufen — und damit
   wäre das Studio nicht mehr die Anwendung, die auch ohne Server startet.
   Da der Zweck die Anmeldung ist und nicht das Aussperren, ist das die
   richtige Abwägung. Sie steht hier, damit sie niemand später für ein
   Sicherheitsversprechen hält. */

import { hnvrMitglied } from '../../hnvr.js';

export const prerender = false;

/* Die Auskunft kommt seit der Verbindung mit hnvr.me von dort: angemeldet ist,
   wer ein hnvr.me-Konto hat und sich damit angemeldet hat. Die Antwort hat
   dieselbe Form wie vorher, damit das Studio nichts davon wissen muss.

   Antwortet hnvr.me nicht, ist das 503 und nicht „abgemeldet": dann greift im
   Studio der Merkzettel, und wer sich in den letzten 30 Tagen angemeldet hat,
   arbeitet weiter, statt wegen eines Aussetzers ausgesperrt zu werden. */
export async function GET({ request }) {
  const { name, mitglied, kekse, unerreichbar } = await hnvrMitglied(request);
  const kopf = new Headers({
    'content-type': 'application/json; charset=utf-8',
    /* Nie zwischenspeichern: sonst zeigt der Browser einem Abgemeldeten die
       Auskunft des vorigen Menschen. */
    'cache-control': 'no-store',
  });
  for (const k of kekse) kopf.append('Set-Cookie', k);
  if (unerreichbar) {
    return new Response(JSON.stringify({ angemeldet: false, unerreichbar: true }), { status: 503, headers: kopf });
  }
  const koerper = mitglied ? { angemeldet: true, name, ueber: 'hnvr.me' } : { angemeldet: false };
  return new Response(JSON.stringify(koerper), { status: 200, headers: kopf });
}
