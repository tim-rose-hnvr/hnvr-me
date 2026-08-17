/**
 * Muster — womit eine neue Seite anfängt.
 *
 * Ein leeres Formular ist die schlechteste Art, ein Werkzeug zu eröffnen:
 * niemand weiß, was hineingehört, und das Ergebnis sieht nach nichts aus.
 * Deshalb startet die Werkstatt mit einer vollständigen, plausiblen Seite, die
 * nur noch überschrieben werden muss.
 *
 * Bewusst ein Handwerksbetrieb und keine Agentur: das ist der Fall, für den die
 * Erreichbarkeitsregel gebaut ist — jemand, der auf dem Dach steht und abends
 * nicht ans Telefon geht.
 */

import type { Profil } from './profil.ts';
import { GESTALTUNG_VORGABE } from './gestaltung.ts';

/** Kennung für einen neuen Block. Kurz, damit die Adresse kurz bleibt. */
export function neueKennung(vorhandene: Iterable<string> = []): string {
  const vergeben = new Set(vorhandene);
  for (let i = 1; i < 10_000; i++) {
    const kennung = `b${i}`;
    if (!vergeben.has(kennung)) return kennung;
  }
  throw new Error('Keine freie Blockkennung mehr.');
}

export function musterprofil(): Profil {
  return {
    version: 1,
    slug: 'muster',
    kopf: {
      name: 'Dein Name',
      rolle: 'Was du machst · Ort',
      beschreibung: 'Zwei Zeilen, die sagen, worum es geht.\nMehr braucht hier niemand.',
    },
    erreichbarkeit: {
      zeitzone: 'Europe/Berlin',
      fenster: [
        { tag: 1, von: '08:00', bis: '17:00' },
        { tag: 2, von: '08:00', bis: '17:00' },
        { tag: 3, von: '08:00', bis: '17:00' },
        { tag: 4, von: '08:00', bis: '17:00' },
        { tag: 5, von: '08:00', bis: '14:00' },
      ],
      ausnahmen: [],
      zusage: 'Antwort am nächsten Werktag',
    },
    hauptaktion: { offen: 'b1', zu: 'b2' },
    bloecke: [
      { id: 'b1', art: 'aktion', kanal: 'telefon', beschriftung: 'Jetzt anrufen', unterzeile: '', ziel: '+49 511 000000', aktiv: true },
      { id: 'b2', art: 'aktion', kanal: 'whatsapp', beschriftung: 'WhatsApp schreiben', unterzeile: 'Auch außerhalb der Zeiten', ziel: '+49 170 0000000', aktiv: true },
      { id: 'b3', art: 'aktion', kanal: 'mail', beschriftung: 'E-Mail schreiben', unterzeile: '', ziel: 'post@beispiel.de', aktiv: true },
      { id: 'b4', art: 'aktion', kanal: 'route', beschriftung: 'Anfahrt', unterzeile: '', ziel: 'Musterstraße 1, 30159 Hannover', aktiv: true },
      { id: 'b5', art: 'ueberschrift', beschriftung: 'Mehr von uns', aktiv: true },
      { id: 'b6', art: 'aktion', kanal: 'link', beschriftung: 'Website', unterzeile: 'Leistungen und Referenzen', ziel: 'https://beispiel.de', aktiv: true },
    ],
    kanaele: [{ netzwerk: 'instagram', ziel: 'beispiel' }],
    visitenkarte: {
      vorname: 'Vorname',
      nachname: 'Nachname',
      firma: 'Betrieb GmbH',
      funktion: '',
      telefon: '+49 511 000000',
      mobil: '',
      mail: 'post@beispiel.de',
      web: 'https://beispiel.de',
      strasse: 'Musterstraße 1',
      plz: '30159',
      ort: 'Hannover',
      land: 'Deutschland',
      notiz: '',
    },
    gestaltung: { ...GESTALTUNG_VORGABE },
    rechtliches: {},
  };
}
