/* Kontaktformular — Nachrichten, ohne eine Adresse zu veröffentlichen.

   Eine E-Mail-Adresse im Quelltext wird binnen Tagen von Sammlern gefunden.
   Deshalb steht hier ein Formular: die Nachricht landet in der Sammlung
   „Kontaktanfragen" und zusätzlich als Kontakt im Wix-Adressbuch, damit sie
   auch dort auftaucht, wo Wix Nachrichten sonst zeigt.

   Was der Server dabei nicht tut: antworten, weiterleiten, oder die Adresse
   irgendwohin sonst tragen. */

import { items } from '@wix/data';
import { contacts } from '@wix/crm';
import { auth } from '@wix/essentials';
import { sorgeFuerSammlung, antwort } from '../../lager.js';

export const prerender = false;

const SAUBER = (text, hoechstens) => String(text ?? '').trim().slice(0, hoechstens);

export async function POST({ request }) {
  let daten;
  try { daten = await request.json(); } catch { return antwort({ fehler: 'Kein lesbares JSON.' }, 400); }

  const name = SAUBER(daten.name, 120);
  const absender = SAUBER(daten.absender, 200);
  const nachricht = SAUBER(daten.nachricht, 4000);

  if (!nachricht) return antwort({ fehler: 'Ohne Nachricht gibt es nichts zu senden.' }, 400);
  /* Eine Adresse ist nicht Pflicht — wer keine Antwort will, soll trotzdem
     schreiben dürfen. Steht eine da, muss sie wenigstens wie eine aussehen. */
  if (absender && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(absender)) {
    return antwort({ fehler: 'Diese Adresse sieht nicht aus wie eine E-Mail-Adresse.' }, 400);
  }

  try {
    await sorgeFuerSammlung('Kontaktanfragen');
    const einfuegen = auth.elevate(items.insert);
    await einfuegen('Kontaktanfragen', {
      name: name || '(ohne Namen)',
      absender: absender || '(ohne Adresse)',
      nachricht,
      eingegangen: new Date(),
    });

    /* Zusätzlich ins Adressbuch, damit die Anfrage dort auftaucht, wo der
       Betreiber ohnehin nachsieht. Scheitert das, ist die Nachricht trotzdem
       angekommen — deshalb steht es in seinem eigenen try. */
    if (absender) {
      try {
        const anlegen = auth.elevate(contacts.createContact);
        await anlegen({
          info: {
            name: { first: name || 'Anfrage', last: 'über pdf-studio.me' },
            emails: { items: [{ email: absender, primary: true }] },
          },
        }, { allowDuplicates: true });
      } catch { /* schon vorhanden oder nicht erlaubt — die Nachricht liegt */ }
    }
    return antwort({ angekommen: true });
  } catch (fehler) {
    return antwort({ fehler: `Die Nachricht ließ sich nicht ablegen: ${fehler.message}` }, 500);
  }
}
