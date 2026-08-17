/* Anmeldeschranke — kostenlos, aber nicht anonym.

   Die Werkbank kostet nichts. Wer sie benutzt, meldet sich an. Beides ist eine
   Entscheidung, kein technischer Zwang, und deshalb steht die Schranke hier und
   nicht tief im Programm: sie lässt sich mit einer Zeile im `index.html`
   ein- und ausschalten.

     <meta name="werkbank-anmeldung" content="/api/mitglied.json">

   **Ohne diese Zeile gibt es keine Schranke.** Das ist keine Nachlässigkeit,
   sondern Leitprinzip 2: die Werkbank muss in einem abgeschotteten Netz
   vollständig starten. Wer sie auf einen eigenen Server legt, an dem es keine
   Mitgliederverwaltung gibt, bekommt sie ohne Anmeldung — und soll das auch.

   Ebenso, wenn die Auskunft nicht zu erreichen ist: dann läuft die Werkbank.
   Eine Anwendung, die den Dienst verweigert, weil ein Server nicht antwortet,
   wäre das Gegenteil dessen, wofür sie gebaut ist.

   Was das heißt, unmissverständlich: **Das ist eine Anmeldeschranke, keine
   Zugriffssperre.** Die Dateien der Werkbank liegen offen; wer ihre Adressen
   kennt, kann sie laden. Der Zweck ist die Anmeldung, nicht das Aussperren. */

import { el, $ } from './kern.js';

/** Liest die Adresse der Auskunft aus dem Kopf der Seite. */
function auskunftsWeg() {
  const eigene = document.querySelector('meta[name="werkbank-anmeldung"]')?.content?.trim();
  return eigene || null;
}

/**
 * Fragt nach, ob jemand angemeldet ist.
 * @returns {Promise<{noetig: boolean, angemeldet: boolean, name?: string}>}
 *   noetig: false heißt „hier wird nicht nach Anmeldung gefragt".
 */
export async function frageAnmeldung() {
  const weg = auskunftsWeg();
  if (!weg) return { noetig: false, angemeldet: true };

  try {
    const antwort = await fetch(weg, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!antwort.ok) return { noetig: false, angemeldet: true };
    const daten = await antwort.json();
    return { noetig: true, angemeldet: !!daten.angemeldet, name: daten.name };
  } catch {
    /* Kein Netz, kein Server, falsche Antwort — die Werkbank läuft trotzdem. */
    return { noetig: false, angemeldet: true };
  }
}

/**
 * Legt die Schranke über die Anwendung.
 * @param {{ anmeldeWeg?: string }} optionen
 */
export function zeigeSchranke({ anmeldeWeg = '/api/auth/login' } = {}) {
  if ($('#anmeldeschranke')) return;

  const ziel = encodeURIComponent(`${location.pathname}${location.search}`);
  const schirm = el('div', { klasse: 'anmeldeschranke', id: 'anmeldeschranke', role: 'dialog', 'aria-modal': 'true' },
    el('div', { klasse: 'anmeldekarte' },
      el('span', { klasse: 'wortmarke-zeichen', 'aria-hidden': 'true' }),
      el('h1', { text: 'Kostenlos — mit Anmeldung' }),
      el('p', { klasse: 'leise' },
        'Die Werkbank kostet nichts. Wir möchten nur wissen, wer sie benutzt: eine Anmeldung, ',
        'ein Konto, keine Zahlungsdaten.'),
      el('p', { klasse: 'leise klein' },
        'Ihre Dateien bleiben davon unberührt. Sie werden auch nach der Anmeldung nicht ',
        'hochgeladen — die Anmeldung sagt uns, dass Sie da sind, nicht, was Sie tun.'),
      el('a', { klasse: 'knopf knopf-voll knopf-gross', href: `${anmeldeWeg}?returnToUrl=${ziel}` },
        'Anmelden oder Konto anlegen'),
      el('p', { klasse: 'leise klein' },
        'Schon angemeldet und es steht trotzdem hier? Dann ist die Sitzung abgelaufen — ',
        'derselbe Knopf hilft.')));

  document.body.append(schirm);
}

export function entferneSchranke() {
  $('#anmeldeschranke')?.remove();
}
