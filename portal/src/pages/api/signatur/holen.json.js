/* Einen Signaturauftrag holen — für die Unterschriftsseite.

   Der Schlüssel im Link ist der Zugang. Das ist bewusst so: der Empfänger hat
   kein Konto und soll keines anlegen müssen, um einmal zu unterschreiben. Der
   Schlüssel hat 24 zufällige Bytes; wer ihn hat, hat den Auftrag.

   Was das heißt, unmissverständlich: **ein weitergeleiteter Link gibt den
   Auftrag weiter.** Das steht so auf der Seite. */

import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { sorgeFuerSammlung, antwort } from '../../../lager.js';

export const prerender = false;

export async function GET({ url }) {
  const schluessel = url.searchParams.get('a') || '';
  if (schluessel.length !== 48) return antwort({ fehler: 'Kein gültiger Zugang.' }, 400);

  try {
    /* Auch der Leser sorgt für die Sammlung. Sonst wirft die Abfrage, solange
       noch niemand einen Auftrag angelegt hat — und ein unbekannter Schlüssel
       ergäbe einen Serverfehler statt einer Antwort. Genau das hat der
       Live-Prüflauf gefunden. */
    await sorgeFuerSammlung('Signaturauftraege');
    const fragen = auth.elevate(items.query);
    const { items: gefunden } = await fragen('Signaturauftraege')
      .eq('schluessel', schluessel).limit(1).find();
    const auftrag = gefunden[0];
    if (!auftrag) return antwort({ fehler: 'Diesen Auftrag gibt es nicht mehr.' }, 404);
    return antwort({
      titel: auftrag.titel,
      dateiname: auftrag.dateiname,
      datei: auftrag.datei,
      absender: auftrag.absender,
      empfaenger: auftrag.empfaenger,
      stand: auftrag.stand,
      angelegt: auftrag.angelegt,
    });
  } catch (fehler) {
    return antwort({ fehler: `Der Auftrag ließ sich nicht lesen: ${fehler.message}` }, 500);
  }
}
