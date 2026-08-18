/**
 * Die Aufnahmearten — eine Liste für alle Seiten.
 *
 * Sie stand nur in `/system`, während die Startseite die Zahl 4 als Text
 * führte. Beides war richtig und trotzdem uneinheitlich: Die eine Seite
 * zählte, was läuft, die andere nannte fünf und markierte eine als geplant.
 * Wer beide Seiten nacheinander liest, hält das für einen Fehler.
 *
 * Jetzt zählt jede Seite dieselbe Liste — und was geplant ist, bleibt
 * sichtbar geplant.
 */

export type Aufnahmeart = {
  icon: string;
  titel: string;
  text: string;
  stand: 'laeuft' | 'arbeit' | 'geplant';
};

export const aufnahmearten: Aufnahmeart[] = [
  { icon: 'foto', titel: 'Foto', text: 'Ein Bild, Countdown wählbar, direkt druckbar', stand: 'laeuft' },
  { icon: 'streifen', titel: 'Streifen', text: 'Drei Bilder, Doppelstreifen mit Schnittlinie', stand: 'laeuft' },
  { icon: 'boomerang', titel: 'Boomerang', text: 'Kurze Sequenz vor und zurück', stand: 'laeuft' },
  { icon: 'gif', titel: 'GIF', text: 'Bilderzahl, Tempo und Pingpong einstellbar', stand: 'laeuft' },
  { icon: 'video', titel: 'Video', text: 'Bis 30 Sekunden mit Ton, für Grüße', stand: 'geplant' },
];

/** Wie viele heute wirklich laufen. */
export const laufendeArten = aufnahmearten.filter((a) => a.stand === 'laeuft').length;
