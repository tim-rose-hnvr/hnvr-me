/**
 * Was läuft schon, was noch nicht — eine Quelle für die ganze Seite.
 *
 * Die Modulseiten beschreiben den vollen Umfang; das ist richtig so, denn
 * danach wird gekauft und geplant. Falsch wäre nur, den Unterschied zu
 * verschweigen. Ein Betreiber, der ein Modul bucht und es nicht vorfindet,
 * ruft am Freitagabend an — und dann steht die Aussage dieser Seite gegen
 * seinen Abend.
 *
 * Drei Stufen, mehr braucht es nicht:
 *
 *   `laeuft`   — auf der Box installiert und bedienbar
 *   `arbeit`   — die Box kann es schon, die Oberfläche dazu fehlt noch
 *   `geplant`  — beschrieben, noch nicht gebaut
 *
 * Die mittlere Stufe ist keine Ausrede, sondern der ehrliche Stand nach der
 * Zusammenführung: Der Server bringt Buchungen, Event-Seiten, Gästebuch und
 * Hashtag-Druck mit, die Bedienoberflächen dazu bauen wir nach.
 */

import { alleModule } from './module';

export type Stand = 'laeuft' | 'arbeit' | 'geplant';

export const STANDNAMEN: Record<Stand, string> = {
  laeuft: 'Läuft',
  arbeit: 'In Arbeit',
  geplant: 'Geplant',
};

/** Was die Marke bedeutet — als Titel am Chip und in der Legende. */
export const STANDTEXTE: Record<Stand, string> = {
  laeuft: 'Auf der Box installiert und bedienbar.',
  arbeit: 'Die Box kann es bereits, die Bedienoberfläche dazu entsteht gerade.',
  geplant: 'Beschrieben und eingeplant, noch nicht gebaut.',
};

type Eintrag = { stand: Stand; offen?: string };

/* Je Modul-Kennung aus `module.ts`. Fehlt ein Eintrag, gilt „geplant" —
   lieber zu vorsichtig als zu großzügig. */
export const MODULSTAND: Record<string, Eintrag> = {
  fotobox: {
    stand: 'laeuft',
    offen: 'Der Bildschirm-Designer fehlt noch; gestaltet wird zurzeit nur der Druck.',
  },
  'foto-wall': {
    stand: 'laeuft',
    offen: 'Moderation vor der Anzeige kommt mit dem Dienst zwischen den Geräten.',
  },
  galerie: { stand: 'laeuft', offen: 'Passwort je Event und eigene Adresse folgen.' },
  gaestebuch: { stand: 'arbeit', offen: 'Die Box nimmt Einträge entgegen, die Zettelwand fehlt.' },
  'event-seiten': {
    stand: 'laeuft',
    offen: 'Ein Logo lässt sich noch nicht hochladen; Farbe, Kennwort und Frist schon.',
  },
  vermietung: {
    stand: 'laeuft',
    offen: 'Vertrag und Zahlungsstand fehlen noch — Anfrage, Kalender, Pakete und Tickets laufen.',
  },
  'effekt-studio': { stand: 'arbeit', offen: 'Der Anschluss steht, die Auswahl am Screen fehlt.' },
  'web-kamera': { stand: 'arbeit', offen: 'Aufnahmen von fremden Geräten kommen an, die Gastseite fehlt.' },
  'foto-finder': { stand: 'geplant' },
  slideshow: { stand: 'geplant' },
  einwegkamera: { stand: 'geplant' },
  'audio-gaestebuch': { stand: 'geplant' },
  'slow-motion': { stand: 'geplant' },
  '360-booth': { stand: 'geplant', offen: 'Braucht Hardware, die wir noch nicht ausliefern.' },
};

export function standVon(id: string): Eintrag {
  return MODULSTAND[id] ?? { stand: 'geplant' };
}

/**
 * Manche Seiten nennen Module beim Namen statt bei der Kennung — die
 * Anlass-Seiten etwa, weil dort der Satz zählt und nicht die Technik. Hier
 * wird der Name auf die Kennung zurückgeführt, statt eine zweite Liste zu
 * pflegen, die auseinanderläuft.
 */
export function standNachTitel(titel: string): Eintrag | null {
  const modul = alleModule.find((m) => m.titel === titel);
  return modul ? standVon(modul.id) : null;
}
