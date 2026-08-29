/**
 * Die Kanäle und ihre Grenzen.
 *
 * **Diese Zahlen veralten.** Netze ändern ihre Grenzen ohne Ankündigung, und
 * eine Tabelle im Code, die das verschweigt, wird irgendwann still falsch.
 * Deshalb steht an jeder Zeile ein Stand, und deshalb kann jeder verbundene
 * Kanal seine Grenze überschreiben: bei Mastodon ist sie ohnehin je Instanz
 * eingestellt und wird beim Verbinden aus `/api/v1/instance` gelesen, nicht
 * geraten.
 *
 * Stand der Tabelle: August 2026. Wer eine Abweichung bemerkt, ändert hier
 * eine Zeile — nicht an fünf Stellen im Formular.
 */

import type { Befund } from './befund.ts';
import type { Zaehlart } from './zeichen.ts';

export const KANALARTEN = ['mastodon', 'bluesky', 'x', 'linkedin', 'instagram', 'facebook', 'mail'] as const;
export type Kanalart = (typeof KANALARTEN)[number];

export interface Kanalregeln {
  name: string;
  zaehlart: Zaehlart;
  /** Zeichengrenze in der Zählweise des Netzes. */
  grenze: number;
  /** Wie viele Bilder ein Beitrag tragen darf. */
  bilder: number;
  /** Wie viele Videos. Bisher überall höchstens eines. */
  videos: number;
  /** Höchstzahl Hashtags, `null` wenn das Netz keine nennt. */
  hashtags: number | null;
  /** Ohne Bild oder Video geht hier gar nichts. */
  brauchtMedium: boolean;
  /** Ist ein Link im Text anklickbar? Bei Instagram nicht. */
  linkWirkt: boolean;
  /** Kann das Netz Alternativtexte tragen? Wo nicht, fordern wir keine. */
  kanntAlternativtext: boolean;
  /** Ab wann ein Text abgeschnitten angezeigt wird — für die Vorschau. */
  umbruchBei: number | null;
}

export const REGELN: Record<Kanalart, Kanalregeln> = {
  mastodon: {
    name: 'Mastodon',
    // Mastodon zählt Codepunkte und rechnet jede Adresse pauschal mit 23.
    zaehlart: 'kurzadresse',
    // Grundeinstellung. Viele Instanzen stellen höher; siehe `grenzeVon`.
    grenze: 500,
    bilder: 4,
    videos: 1,
    hashtags: null,
    brauchtMedium: false,
    linkWirkt: true,
    kanntAlternativtext: true,
    umbruchBei: 500,
  },
  bluesky: {
    name: 'Bluesky',
    // Bluesky zählt Graphemgruppen — das Netz mit der ehrlichsten Zählweise.
    zaehlart: 'graphem',
    grenze: 300,
    bilder: 4,
    videos: 1,
    hashtags: null,
    brauchtMedium: false,
    linkWirkt: true,
    kanntAlternativtext: true,
    umbruchBei: 300,
  },
  x: {
    name: 'X',
    zaehlart: 'gewichtet',
    // 280 gewichtet. Zahlende Konten dürfen mehr; wir planen auf die Grenze,
    // die für alle gilt, weil ein Beitrag, der nur mit Abo durchgeht, beim
    // ersten Kanalwechsel abbricht.
    grenze: 280,
    bilder: 4,
    videos: 1,
    hashtags: null,
    brauchtMedium: false,
    linkWirkt: true,
    kanntAlternativtext: true,
    umbruchBei: 280,
  },
  linkedin: {
    name: 'LinkedIn',
    zaehlart: 'codepunkt',
    grenze: 3000,
    bilder: 20,
    videos: 1,
    hashtags: null,
    brauchtMedium: false,
    linkWirkt: true,
    kanntAlternativtext: true,
    // Nach rund 210 Zeichen klappt LinkedIn den Text zu. Was danach kommt,
    // liest, wer geklickt hat — also gehört die Aussage davor.
    umbruchBei: 210,
  },
  instagram: {
    name: 'Instagram',
    zaehlart: 'codepunkt',
    grenze: 2200,
    bilder: 20,
    videos: 1,
    hashtags: 30,
    // Ohne Bild oder Video gibt es keinen Beitrag. Das ist keine Empfehlung,
    // das ist die Schnittstelle.
    brauchtMedium: true,
    // Ein Link in der Bildunterschrift ist Text und sonst nichts.
    linkWirkt: false,
    kanntAlternativtext: true,
    umbruchBei: 125,
  },
  facebook: {
    name: 'Facebook',
    zaehlart: 'codepunkt',
    grenze: 63206,
    bilder: 10,
    videos: 1,
    hashtags: null,
    brauchtMedium: false,
    linkWirkt: true,
    kanntAlternativtext: true,
    umbruchBei: 480,
  },
  mail: {
    name: 'E-Mail',
    zaehlart: 'codepunkt',
    // Keine echte Grenze — der Wert steht für „so lang, dass niemand mehr
    // liest". Die Grenze, die zählt, ist der Betreff, und die steht im
    // Newsletter.
    grenze: 200_000,
    bilder: 50,
    videos: 0,
    hashtags: null,
    brauchtMedium: false,
    linkWirkt: true,
    kanntAlternativtext: true,
    umbruchBei: null,
  },
};

/** Ein verbundener Zugang — ein wirkliches Konto bei einem Netz. */
export interface Kanal {
  kennung: string;
  organisation: string;
  art: Kanalart;
  /** Wie er im Plan heißt: „HNVR auf LinkedIn". */
  anzeigename: string;
  /** Beim Verbinden gelesen, nicht geraten. Nur Mastodon nutzt das bisher. */
  grenzeUeberschrieben?: number;
  aktiv: boolean;
  /** Wann das Zugangstoken abläuft. Der häufigste Ausfallgrund überhaupt. */
  tokenLaeuftAb?: number;
}

/** Die Grenze, die für **diesen** Zugang gilt. */
export function grenzeVon(kanal: Kanal): number {
  return kanal.grenzeUeberschrieben ?? REGELN[kanal.art].grenze;
}

export function regelnVon(kanal: Kanal): Kanalregeln {
  const grund = REGELN[kanal.art];
  return kanal.grenzeUeberschrieben ? { ...grund, grenze: kanal.grenzeUeberschrieben } : grund;
}

/**
 * Läuft der Zugang bald ab?
 *
 * Der mit Abstand häufigste Grund dafür, dass ein geplanter Beitrag nicht
 * erscheint, ist ein abgelaufenes Token — und der ärgerlichste, weil er sich
 * Wochen vorher ankündigt und niemand hinsieht. Deshalb ist es ein Befund im
 * Plan und keine Zeile in den Einstellungen.
 */
export function tokenbefund(kanal: Kanal, jetzt: number): Befund | null {
  if (!kanal.tokenLaeuftAb) return null;
  const tage = Math.floor((kanal.tokenLaeuftAb - jetzt) / 86_400_000);
  if (tage < 0) {
    return {
      schwere: 'fehler',
      kennung: 'kanal.token.abgelaufen',
      text: `Der Zugang zu ${kanal.anzeigename} ist abgelaufen. Bis er erneuert ist, erscheint dort nichts.`,
      stelle: kanal.kennung,
    };
  }
  if (tage <= 14) {
    return {
      schwere: 'warnung',
      kennung: 'kanal.token.laeuft.ab',
      text: `Der Zugang zu ${kanal.anzeigename} läuft in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} ab.`,
      stelle: kanal.kennung,
    };
  }
  return null;
}
