/* Zur Unterschrift versenden — Auftrag anlegen.

   **Hier verlässt die Datei das Gerät.** Das ist der Bruch mit dem Versprechen,
   auf dem der Rest von PDF Studio steht, und deshalb steht er in einer eigenen
   Datei, hinter einem eigenen Weg, mit einer eigenen Warnung im Dialog. Ein
   Ablauf, bei dem ein anderer Mensch unterschreiben soll, braucht zwingend
   eine Stelle, die beide erreichen — anders geht es nicht.

   Was der Server aufhebt: das PDF, die Adresse des Empfängers, einen
   zufälligen Schlüssel für den Link, den Stand und einen Verlauf. Was er
   nicht tut: die Datei ansehen, durchsuchen, weitergeben.

   Anlegen darf nur, wer angemeldet ist. Bei einer Beweiskette ist „wer hat
   das losgeschickt" die erste Frage. */

import { items } from '@wix/data';
import { members } from '@wix/members';
import { auth } from '@wix/essentials';
import { sorgeFuerSammlung, neuerSchluessel, antwort } from '../../../lager.js';

export const prerender = false;

/* 12 MB — ein PDF, das größer ist, gehört nicht durch ein Formular geschickt.
   Base64 bläht um ein Drittel auf, also liegt die Grenze roh bei etwa 9 MB. */
const HOECHSTGROESSE = 9 * 1024 * 1024;

export async function POST({ request }) {
  let anmelder;
  try {
    const { member } = await members.getCurrentMember();
    anmelder = member;
  } catch { anmelder = null; }
  if (!anmelder) {
    return antwort({ fehler: 'Zum Versenden ist eine Anmeldung nötig — bei einer Unterschrift muss feststehen, wer sie angefordert hat.' }, 401);
  }

  let daten;
  try { daten = await request.json(); } catch { return antwort({ fehler: 'Kein lesbares JSON.' }, 400); }

  const titel = String(daten.titel ?? '').trim().slice(0, 200) || 'Ohne Titel';
  const dateiname = String(daten.dateiname ?? 'dokument.pdf').trim().slice(0, 200);
  const empfaenger = String(daten.empfaenger ?? '').trim().slice(0, 200);
  const datei = String(daten.datei ?? '');

  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(empfaenger)) {
    return antwort({ fehler: 'Ohne gültige Empfängeradresse gibt es niemanden zum Unterschreiben.' }, 400);
  }
  if (!datei) return antwort({ fehler: 'Es kam keine Datei an.' }, 400);
  if (datei.length > HOECHSTGROESSE * 1.4) {
    return antwort({ fehler: 'Die Datei ist zu groß für diesen Weg (über 9 MB).' }, 413);
  }

  const absender = anmelder.loginEmail
    || [anmelder.contact?.firstName, anmelder.contact?.lastName].filter(Boolean).join(' ')
    || 'angemeldet';

  try {
    await sorgeFuerSammlung('Signaturauftraege');
    const schluessel = neuerSchluessel();
    const einfuegen = auth.elevate(items.insert);
    const angelegt = await einfuegen('Signaturauftraege', {
      titel, dateiname, datei, absender, empfaenger, schluessel,
      stand: 'offen',
      unterschrift: '',
      verlauf: JSON.stringify([{ was: 'angelegt', von: absender, wann: new Date().toISOString() }]),
      angelegt: new Date(),
    });
    return antwort({
      angelegt: true,
      id: angelegt._id,
      schluessel,
      /* Den Link baut der Aufrufer aus seinem eigenen Ursprung — der Server
         weiß nicht, unter welcher Adresse er erreichbar ist. */
      weg: `/unterschreiben?a=${schluessel}`,
    });
  } catch (fehler) {
    return antwort({ fehler: `Der Auftrag ließ sich nicht anlegen: ${fehler.message}` }, 500);
  }
}
