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
  gaestebuch: {
    stand: 'laeuft',
    offen: 'Der Ausdruck als Buch für das Paar kommt noch; die Einträge liegen auf der Box.',
  },
  'event-seiten': {
    stand: 'laeuft',
    offen: 'Ein Logo lässt sich noch nicht hochladen; Farbe, Kennwort und Frist schon.',
  },
  vermietung: {
    stand: 'laeuft',
    offen: 'Vertrag und Zahlungsstand fehlen noch — Anfrage, Kalender, Pakete und Tickets laufen.',
  },
  'effekt-studio': {
    stand: 'laeuft',
    offen:
      'Sechs Stile und die Freistellung vor dem Tuch laufen. Freistellung OHNE Tuch, ' +
      'die Motivbibliothek und die Live-Vorschau vor dem Auslösen fehlen noch.',
  },
  'web-kamera': {
    stand: 'laeuft',
    offen: 'Gesichtsfilter und Sticker kommen noch; aufnehmen und senden geht.',
  },
  'foto-finder': { stand: 'geplant' },
  slideshow: {
    stand: 'laeuft',
    offen:
      'Mehrere Ausgaben mit eigenem Inhalt, die Moderation vor der Anzeige und ' +
      'der Wechsel mit der Foto-Wall auf demselben Beamer fehlen noch.',
  },
  einwegkamera: {
    stand: 'laeuft',
    offen:
      'Filmlänge, Entwicklungszeitpunkt, Look und Nachladen laufen. ' +
      'Die Moderation vor der Freigabe und eigene Codes je Standort fehlen noch.',
  },
  'audio-gaestebuch': {
    stand: 'laeuft',
    offen:
      'Aufnehmen, anhören, verwerfen und die Ausgabe in die Galerie laufen — ' +
      'Bild und Stimme entstehen in einer Datei. Der Zusammenschnitt als EINE ' +
      'Datei zum Herunterladen, das Transkript und die Moderation fehlen noch; ' +
      'nacheinander anhören lassen sich alle Grüße schon in der Galerie.',
  },
  'slow-motion': {
    stand: 'laeuft',
    offen:
      'Aufnehmen, verlangsamen, Rahmen und Ausgabe laufen — die Zeitlupe steckt in der Datei, ' +
      'nicht nur im Abspieler. Wie stark sie ausfällt, hängt an der Kamera; die Seite misst und ' +
      'sagt es. Windmaschine und Konfettikanone zu triggern fehlt noch.',
  },
  '360-booth': { stand: 'geplant', offen: 'Braucht Hardware, die wir noch nicht ausliefern.' },
};

export function standVon(id: string): Eintrag {
  return MODULSTAND[id] ?? { stand: 'geplant' };
}

/**
 * Die Stufen, die auf einer Seite wirklich vorkommen — in der Reihenfolge
 * von fertig nach geplant.
 *
 * Eine Legende, die eine Marke erklärt, die auf der Seite nirgends steht,
 * ist keine Hilfe, sondern eine Frage: „Wo ist denn das Gelbe?" Also wird
 * sie aus den gezeigten Modulen abgeleitet und nicht auf jeder Seite von
 * Hand aufgezählt — drei Aufzählungen derselben Sache laufen auseinander,
 * sobald ein Modul die Stufe wechselt.
 *
 * Ohne Angabe zählen alle Module; `nur` grenzt auf die Kennungen ein, die
 * eine Seite tatsächlich zeigt.
 */
export function verwendeteStufen(nur?: readonly string[]): Stand[] {
  const kennungen = nur ?? alleModule.map((m) => m.id);
  const vorhanden = new Set(kennungen.map((id) => standVon(id).stand));
  return (['laeuft', 'arbeit', 'geplant'] as const).filter((st) => vorhanden.has(st));
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
