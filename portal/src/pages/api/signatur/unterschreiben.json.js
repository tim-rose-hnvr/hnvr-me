/* Unterschreiben — die Rückgabe des Empfängers.

   Was ankommt, ist ein Bild der Unterschrift und das fertige PDF, in das die
   Unterschriftsseite es hineingezeichnet hat. Gerechnet wird also im Browser
   des Empfängers, nicht hier — der Server hebt nur auf.

   **Das ist keine qualifizierte elektronische Signatur.** Es ist eine
   sichtbare Unterschrift mit Protokoll: wer, wann, von welcher Adresse aus.
   Für eine Signatur nach eIDAS braucht es ein Zertifikat und eine
   Signaturkarte — das steht auf der Seite und im Dialog, weil der Unterschied
   im Streitfall der ganze Unterschied ist. */

import { items } from '@wix/data';
import { auth } from '@wix/essentials';
import { sorgeFuerSammlung, antwort } from '../../../lager.js';

export const prerender = false;

export async function POST({ request, clientAddress }) {
  let daten;
  try { daten = await request.json(); } catch { return antwort({ fehler: 'Kein lesbares JSON.' }, 400); }

  const schluessel = String(daten.schluessel ?? '');
  const unterschrieben = String(daten.datei ?? '');
  const name = String(daten.name ?? '').trim().slice(0, 200);
  if (schluessel.length !== 48) return antwort({ fehler: 'Kein gültiger Zugang.' }, 400);
  if (!unterschrieben) return antwort({ fehler: 'Es kam keine unterschriebene Datei an.' }, 400);
  if (!name) return antwort({ fehler: 'Ohne Namen keine Unterschrift.' }, 400);

  try {
    await sorgeFuerSammlung('Signaturauftraege');
    const fragen = auth.elevate(items.query);
    const { items: gefunden } = await fragen('Signaturauftraege')
      .eq('schluessel', schluessel).limit(1).find();
    const auftrag = gefunden[0];
    if (!auftrag) return antwort({ fehler: 'Diesen Auftrag gibt es nicht mehr.' }, 404);
    if (auftrag.stand === 'unterschrieben') {
      return antwort({ fehler: 'Dieser Auftrag ist bereits unterschrieben.' }, 409);
    }

    const verlauf = JSON.parse(auftrag.verlauf || '[]');
    verlauf.push({
      was: 'unterschrieben',
      von: name,
      /* Die Adresse gehört zur Beweiskette. Sie steht im Auftrag und wird
         nirgends sonst hingetragen. */
      herkunft: clientAddress || 'unbekannt',
      wann: new Date().toISOString(),
    });

    const aendern = auth.elevate(items.update);
    await aendern('Signaturauftraege', {
      ...auftrag,
      datei: unterschrieben,
      stand: 'unterschrieben',
      unterschrift: name,
      verlauf: JSON.stringify(verlauf),
    });
    return antwort({ angekommen: true, verlauf });
  } catch (fehler) {
    return antwort({ fehler: `Die Unterschrift ließ sich nicht ablegen: ${fehler.message}` }, 500);
  }
}
