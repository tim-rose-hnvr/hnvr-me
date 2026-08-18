/**
 * Wie viele Druckvorlagen mitkommen — gezählt, nicht behauptet.
 *
 * Die Zahl stand an neun Stellen der Website als „55" im Text. Im Katalog
 * lagen zu dem Zeitpunkt schon 77. Eine Zahl, die man einmal tippt, stimmt
 * genau bis zur nächsten Änderung — und dann steht sie falsch auf einer
 * Verkaufsseite.
 *
 * Gelesen wird derselbe Katalog, den auch die Box beim Einrichten bekommt.
 */

import katalog from '../../../booth/vorlagen-katalog.json';

type Eintrag = { art?: string; format?: string };

const alle = katalog as Eintrag[];

export const vorlagenzahlen = {
  /** Alle mitgelieferten Vorlagen. */
  gesamt: alle.length,
  /** Serien: mehrere Aufnahmen auf einem Blatt. */
  streifen: alle.filter((v) => v.art === 'streifen').length,
  /** Einzelbild. */
  foto: alle.filter((v) => v.art === 'foto').length,
  /** Wie viele der sieben Papierformate wirklich belegt sind. */
  formate: new Set(alle.map((v) => v.format).filter(Boolean)).size,
};
