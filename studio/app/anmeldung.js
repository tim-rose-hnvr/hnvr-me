/* Anmeldeschranke — kostenlos, aber nicht anonym.

   Das Studio kostet nichts. Wer es benutzt, meldet sich an. Beides ist eine
   Entscheidung, kein technischer Zwang, und deshalb steht die Schranke hier und
   nicht tief im Programm: sie lässt sich mit einer Zeile im `index.html`
   ein- und ausschalten.

     <meta name="studio-anmeldung" content="/api/mitglied.json">

   **Ohne diese Zeile gibt es keine Schranke.** Das ist keine Nachlässigkeit,
   sondern Leitprinzip 2: das Studio muss in einem abgeschotteten Netz
   vollständig starten. Wer es auf einen eigenen Server legt, an dem es keine
   Mitgliederverwaltung gibt, bekommt es ohne Anmeldung — und soll das auch.

   Ist die Auskunft **nicht zu erreichen**, entscheidet der Merkzettel: Wer
   sich schon einmal angemeldet hat, arbeitet weiter — für eine begrenzte Zeit,
   voreingestellt 30 Tage. Wer sich noch nie angemeldet hat, sieht die
   Schranke.

   Diese Regel ist eine Abwägung, keine Selbstverständlichkeit. Das Studio
   lässt sich installieren und läuft ohne Netz; wäre die Anmeldung ein harter
   Riegel, wäre die installierte Fassung beim ersten Funkloch wertlos. Wäre sie
   gar keiner, hätte die Anmeldung keinen Sinn. Der Merkzettel ist die Mitte:
   die Anmeldung geht vor, aber sie hält vor.

   Der Merkzettel steht in `localStorage` und trägt einen Zeitstempel, sonst
   nichts. Er ist ausdrücklich **keine Sicherung** — wer ihn fälscht, kommt
   hinein. Das ist in Ordnung, denn unmissverständlich gilt: **Das ist eine
   Anmeldeschranke, keine Zugriffssperre.** Die Dateien des Studios liegen
   offen; wer ihre Adressen kennt, kann sie laden. Der Zweck ist die Anmeldung,
   nicht das Aussperren. */

import { el, $ } from './kern.js';

const MERKZETTEL = 'studio:anmeldung';
const TAG = 24 * 60 * 60 * 1000;

/** Liest die Adresse der Auskunft aus dem Kopf der Seite. */
function auskunftsWeg() {
  const eigene = document.querySelector('meta[name="studio-anmeldung"]')?.content?.trim();
  return eigene || null;
}

/** Wie lange eine bestätigte Anmeldung ohne Netz vorhält, in Tagen. */
function frist() {
  const angabe = document.querySelector('meta[name="studio-anmeldung-frist"]')?.content?.trim();
  const tage = Number(angabe);
  return Number.isFinite(tage) && tage > 0 ? tage : 30;
}

/* Der Merkzettel. Jeder Zugriff in try/catch: im privaten Fenster wirft schon
   das Lesen, und daran soll der Start nicht scheitern. */
function lieszettel() {
  try {
    const roh = localStorage.getItem(MERKZETTEL);
    if (!roh) return null;
    const zettel = JSON.parse(roh);
    return typeof zettel?.zeit === 'number' ? zettel : null;
  } catch { return null; }
}

function schreibeZettel(zettel) {
  try { localStorage.setItem(MERKZETTEL, JSON.stringify(zettel)); } catch { /* dann eben nicht */ }
}

function vergissZettel() {
  try { localStorage.removeItem(MERKZETTEL); } catch { /* dann eben nicht */ }
}

/** Tage, die eine gemerkte Anmeldung noch vorhält. 0 = abgelaufen oder keine. */
export function verbleibendeTage() {
  const zettel = lieszettel();
  if (!zettel) return 0;
  const alter = Date.now() - zettel.zeit;
  return Math.max(0, Math.ceil((frist() * TAG - alter) / TAG));
}

/**
 * Fragt nach, ob jemand angemeldet ist.
 * @returns {Promise<{noetig: boolean, angemeldet: boolean, name?: string,
 *   ausDemGedaechtnis?: boolean, tage?: number}>}
 *   noetig: false heißt „hier wird nicht nach Anmeldung gefragt".
 *   ausDemGedaechtnis: die Auskunft war nicht zu erreichen, es gilt der Merkzettel.
 */
export async function frageAnmeldung() {
  const weg = auskunftsWeg();
  if (!weg) return { noetig: false, angemeldet: true };

  try {
    const antwort = await fetch(weg, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!antwort.ok) throw new Error(`Auskunft antwortet ${antwort.status}`);
    const daten = await antwort.json();
    if (daten.angemeldet) schreibeZettel({ zeit: Date.now(), name: daten.name || '' });
    else vergissZettel();
    return { noetig: true, angemeldet: !!daten.angemeldet, name: daten.name };
  } catch {
    /* Kein Netz, kein Server, falsche Antwort. Jetzt zählt der Merkzettel. */
    const tage = verbleibendeTage();
    if (tage > 0) {
      return { noetig: true, angemeldet: true, name: lieszettel()?.name, ausDemGedaechtnis: true, tage };
    }
    return { noetig: true, angemeldet: false, ausDemGedaechtnis: true, tage: 0 };
  }
}

/**
 * Legt die Schranke über die Anwendung.
 * @param {{ anmeldeWeg?: string, ohneNetz?: boolean }} optionen
 *   ohneNetz: die Auskunft war nicht zu erreichen und der Merkzettel ist leer
 *   oder abgelaufen. Dann hilft der Anmeldeknopf nicht — es fehlt das Netz,
 *   nicht der Wille. Das muss dastehen, sonst drückt jemand fünfmal darauf.
 */
export function zeigeSchranke({ anmeldeWeg = '/api/auth/login', ohneNetz = false } = {}) {
  if ($('#anmeldeschranke')) return;

  const ziel = encodeURIComponent(`${location.pathname}${location.search}`);
  const karte = ohneNetz
    ? [
      el('h1', { text: 'Ohne Netz, ohne Anmeldung' }),
      el('p', { klasse: 'leise' },
        `Die Anmeldung ließ sich nicht prüfen, und die letzte bestätigte Anmeldung liegt `,
        `länger als ${frist()} Tage zurück oder es gab noch keine.`),
      el('p', { klasse: 'leise klein' },
        'Einmal mit Netz anmelden — danach arbeitet das Studio wieder offline weiter, ',
        `${frist()} Tage lang, auch als installierte Anwendung.`),
      el('a', { klasse: 'knopf knopf-voll knopf-gross', href: `${anmeldeWeg}?returnToUrl=${ziel}` },
        'Erneut versuchen'),
    ]
    : [
      el('h1', { text: 'Kostenlos — mit Anmeldung' }),
      el('p', { klasse: 'leise' },
        'Das Studio kostet nichts. Wir möchten nur wissen, wer es benutzt: eine Anmeldung, ',
        'ein Konto, keine Zahlungsdaten.'),
      el('p', { klasse: 'leise klein' },
        'Ihre Dateien bleiben davon unberührt. Sie werden auch nach der Anmeldung nicht ',
        'hochgeladen — die Anmeldung sagt uns, dass Sie da sind, nicht, was Sie tun.'),
      el('a', { klasse: 'knopf knopf-voll knopf-gross', href: `${anmeldeWeg}?returnToUrl=${ziel}` },
        'Anmelden oder Konto anlegen'),
      el('p', { klasse: 'leise klein' },
        'Schon angemeldet und es steht trotzdem hier? Dann ist die Sitzung abgelaufen — ',
        'derselbe Knopf hilft.'),
    ];

  const schirm = el('div', { klasse: 'anmeldeschranke', id: 'anmeldeschranke', role: 'dialog', 'aria-modal': 'true' },
    el('div', { klasse: 'anmeldekarte' },
      el('span', { klasse: 'wortmarke-zeichen', 'aria-hidden': 'true' }),
      ...karte));

  document.body.append(schirm);
}

export function entferneSchranke() {
  $('#anmeldeschranke')?.remove();
}
