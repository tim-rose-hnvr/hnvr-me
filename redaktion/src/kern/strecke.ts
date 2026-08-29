/**
 * Automationsstrecken.
 *
 * Eine Strecke ist eine Kette aus Warten, Senden und Verzweigen, die von
 * selbst abläuft: Willkommensfolge, Erinnerung, Reaktivierung.
 *
 * Zwei Regeln, ohne die so etwas gefährlich ist:
 *
 * 1. **Eine Abmeldung beendet jede Strecke sofort.** Nicht am nächsten
 *    Schritt, nicht nach dem Warten — sofort und in allen Strecken zugleich.
 *    Ein Werkzeug, in dem eine Willkommensfolge nach der Abmeldung noch drei
 *    Mails schickt, hat den Kunden verloren, bevor der Anwalt schreibt.
 * 2. **Ein Kreis ohne Warteschritt wird nicht angelegt.** Er würde in einer
 *    Schleife senden, bis jemand es merkt. Die Prüfung findet das vor dem
 *    Speichern; die Schrittgrenze im Lauf fängt den Rest.
 *
 * Der Ablauf ist ausdrücklich **nicht** nebenläufig gedacht: `naechsterSchritt`
 * ist eine reine Funktion über Strecke, Lauf und Zeit. Was daraus folgt, tut
 * der Betrieb — und weil die Funktion rein ist, lässt sich eine Willkommensfolge
 * über sechs Wochen in sechs Millisekunden durchprüfen.
 */

import type { Befund } from './befund.ts';
import { empfaengtPost, type Empfaenger } from './empfaenger.ts';
import { passt, type Kennzahlen, type Regelwerk, LEERE_KENNZAHLEN } from './verteiler.ts';

export type Schritt =
  | { art: 'warten'; kennung: string; dauerMs: number; weiter: string }
  | { art: 'senden'; kennung: string; newsletter: string; weiter: string }
  | { art: 'merkmal'; kennung: string; feld: string; wert: string; weiter: string }
  | { art: 'bedingung'; kennung: string; regelwerk: Regelwerk; dann: string; sonst: string }
  | { art: 'ende'; kennung: string };

export type Ausloeser =
  | { art: 'bestaetigt' }
  | { art: 'in_verteiler'; verteiler: string }
  | { art: 'merkmal_gesetzt'; feld: string };

export interface Strecke {
  kennung: string;
  organisation: string;
  name: string;
  ausloeser: Ausloeser;
  schritte: Schritt[];
  /** Kennung des ersten Schritts. */
  erster: string;
  aktiv: boolean;
}

export interface Streckenlauf {
  kennung: string;
  strecke: string;
  empfaenger: string;
  /** Wo der Lauf gerade steht. */
  beiSchritt: string;
  /** Wann der Schritt an der Reihe ist. */
  faelligAm: number;
  zustand: 'laeuft' | 'fertig' | 'abgebrochen';
  /** Wie viele Schritte schon gegangen wurden — die Notbremse gegen Kreise. */
  schrittzahl: number;
  abbruchgrund?: string;
}

/**
 * Nach so vielen Schritten wird ein Lauf abgebrochen.
 *
 * Nicht als Regel, sondern als Notbremse: eine echte Strecke hat zehn bis
 * zwanzig Schritte. Wer 200 erreicht, läuft im Kreis, und der Kreis ist der
 * Prüfung entgangen.
 */
export const SCHRITTGRENZE = 200;

export type Anweisung =
  | { art: 'warten'; bis: number; lauf: Streckenlauf }
  | { art: 'senden'; newsletter: string; lauf: Streckenlauf }
  | { art: 'merkmal'; feld: string; wert: string; lauf: Streckenlauf }
  | { art: 'fertig'; lauf: Streckenlauf }
  | { art: 'abgebrochen'; grund: string; lauf: Streckenlauf };

function schrittVon(strecke: Strecke, kennung: string): Schritt | undefined {
  return strecke.schritte.find((s) => s.kennung === kennung);
}

/**
 * Was als Nächstes zu tun ist.
 *
 * Der Lauf wird mitgegeben und zurückgegeben — die Funktion ändert nichts,
 * sie beschreibt nur den Nachfolgezustand. Der Betrieb speichert ihn, wenn
 * die Handlung wirklich getan wurde, und niemals vorher: sonst ist eine Mail
 * als gesendet vermerkt, die der Mailserver nie bekommen hat.
 */
export function naechsterSchritt(
  strecke: Strecke,
  lauf: Streckenlauf,
  empfaenger: Empfaenger,
  kennzahlen: Kennzahlen = LEERE_KENNZAHLEN,
  jetzt: number = Date.now(),
): Anweisung {
  if (lauf.zustand === 'fertig') return { art: 'fertig', lauf };
  if (lauf.zustand === 'abgebrochen') {
    return { art: 'abgebrochen', grund: lauf.abbruchgrund ?? 'Ohne Angabe.', lauf };
  }

  /* Die erste Regel aus dem Kopf dieser Datei. Sie steht vor allem anderen,
     auch vor der Fälligkeit: ein Lauf, der auf seinen Termin wartet, wird
     durch die Abmeldung sofort beendet und nicht erst dann. */
  if (!empfaengtPost(empfaenger)) {
    return {
      art: 'abgebrochen',
      grund: `Empfänger ist ${empfaenger.zustand}.`,
      lauf: { ...lauf, zustand: 'abgebrochen', abbruchgrund: `Empfänger ist ${empfaenger.zustand}.` },
    };
  }

  if (!strecke.aktiv) {
    return {
      art: 'abgebrochen',
      grund: 'Die Strecke ist stillgelegt.',
      lauf: { ...lauf, zustand: 'abgebrochen', abbruchgrund: 'Die Strecke ist stillgelegt.' },
    };
  }

  if (lauf.schrittzahl >= SCHRITTGRENZE) {
    return {
      art: 'abgebrochen',
      grund: `Mehr als ${SCHRITTGRENZE} Schritte. Die Strecke läuft im Kreis.`,
      lauf: { ...lauf, zustand: 'abgebrochen', abbruchgrund: 'Schrittgrenze erreicht.' },
    };
  }

  if (lauf.faelligAm > jetzt) return { art: 'warten', bis: lauf.faelligAm, lauf };

  const schritt = schrittVon(strecke, lauf.beiSchritt);
  if (!schritt) {
    return {
      art: 'abgebrochen',
      grund: `Den Schritt „${lauf.beiSchritt}" gibt es nicht mehr.`,
      lauf: { ...lauf, zustand: 'abgebrochen', abbruchgrund: `Schritt „${lauf.beiSchritt}" fehlt.` },
    };
  }

  const weiterMit = (ziel: string, faelligAm: number): Streckenlauf => ({
    ...lauf,
    beiSchritt: ziel,
    faelligAm,
    schrittzahl: lauf.schrittzahl + 1,
  });

  switch (schritt.art) {
    case 'ende':
      return { art: 'fertig', lauf: { ...lauf, zustand: 'fertig' } };

    case 'warten':
      // Das Warten wird beim Betreten gesetzt, nicht beim Verlassen: sonst
      // wartete ein Lauf, der nach einem Neustart wieder hier ankommt, von
      // vorn.
      return { art: 'warten', bis: jetzt + schritt.dauerMs, lauf: weiterMit(schritt.weiter, jetzt + schritt.dauerMs) };

    case 'senden':
      return { art: 'senden', newsletter: schritt.newsletter, lauf: weiterMit(schritt.weiter, jetzt) };

    case 'merkmal':
      return { art: 'merkmal', feld: schritt.feld, wert: schritt.wert, lauf: weiterMit(schritt.weiter, jetzt) };

    case 'bedingung': {
      const ziel = passt(empfaenger, kennzahlen, schritt.regelwerk) ? schritt.dann : schritt.sonst;
      // Eine Bedingung ist kein Schritt in der Zeit: sie wird sofort
      // ausgewertet und der Lauf steht gleich beim nächsten wirklichen
      // Schritt. Deshalb hier keine neue Fälligkeit.
      return naechsterSchritt(strecke, weiterMit(ziel, jetzt), empfaenger, kennzahlen, jetzt);
    }
  }
}

/** Einen Lauf beginnen. */
export function starteLauf(kennung: string, strecke: Strecke, empfaenger: string, jetzt: number): Streckenlauf {
  return {
    kennung,
    strecke: strecke.kennung,
    empfaenger,
    beiSchritt: strecke.erster,
    faelligAm: jetzt,
    zustand: 'laeuft',
    schrittzahl: 0,
  };
}

/** Löst dieses Ereignis diese Strecke aus? */
export function loestAus(strecke: Strecke, empfaenger: Empfaenger, ereignis: Ausloeser): boolean {
  if (!strecke.aktiv) return false;
  if (strecke.organisation !== empfaenger.organisation) return false;
  const a = strecke.ausloeser;
  if (a.art !== ereignis.art) return false;
  if (a.art === 'in_verteiler' && ereignis.art === 'in_verteiler') return a.verteiler === ereignis.verteiler;
  if (a.art === 'merkmal_gesetzt' && ereignis.art === 'merkmal_gesetzt') return a.feld === ereignis.feld;
  return true;
}

/* ---------------------------------------------------------------- Prüfung */

function zieleVon(s: Schritt): string[] {
  return s.art === 'bedingung' ? [s.dann, s.sonst] : s.art === 'ende' ? [] : [s.weiter];
}

/**
 * Eine Strecke prüfen, bevor sie scharfgeschaltet wird.
 *
 * Der wichtigste Befund ist der Kreis ohne Warteschritt. Er ist die einzige
 * Art, auf die eine Strecke Schaden anrichtet, ohne dass jemand einen Fehler
 * macht: zwei Bedingungen, die aufeinander zeigen, und die Folge sendet, bis
 * jemand den Stecker zieht.
 */
export function pruefeStrecke(strecke: Strecke): Befund[] {
  const befunde: Befund[] = [];
  const nachKennung = new Map(strecke.schritte.map((s) => [s.kennung, s]));

  if (strecke.schritte.length === 0) {
    befunde.push({ schwere: 'fehler', kennung: 'strecke.leer', text: 'Die Strecke hat keine Schritte.' });
    return befunde;
  }
  if (!nachKennung.has(strecke.erster)) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'strecke.ohne.anfang',
      text: `Der erste Schritt „${strecke.erster}" fehlt.`,
    });
    return befunde;
  }
  if (nachKennung.size !== strecke.schritte.length) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'strecke.doppelte.kennung',
      text: 'Zwei Schritte tragen dieselbe Kennung.',
    });
  }

  for (const s of strecke.schritte) {
    for (const ziel of zieleVon(s)) {
      if (!nachKennung.has(ziel)) {
        befunde.push({
          schwere: 'fehler',
          kennung: 'strecke.ziel.fehlt',
          text: `Schritt „${s.kennung}" zeigt auf „${ziel}", den es nicht gibt.`,
          stelle: s.kennung,
        });
      }
    }
    if (s.art === 'warten' && s.dauerMs <= 0) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'strecke.warten.null',
        text: `Der Warteschritt „${s.kennung}" wartet null. Damit ist er keiner.`,
        stelle: s.kennung,
      });
    }
  }

  /* Erreichbarkeit: ein Schritt, den nichts anspringt, ist entweder Rest
     einer früheren Fassung oder ein Vertipper. Beides gehört gesagt. */
  const erreicht = new Set<string>([strecke.erster]);
  const zuBesuchen = [strecke.erster];
  while (zuBesuchen.length > 0) {
    const jetzt = nachKennung.get(zuBesuchen.pop()!);
    if (!jetzt) continue;
    for (const ziel of zieleVon(jetzt)) {
      if (!erreicht.has(ziel) && nachKennung.has(ziel)) {
        erreicht.add(ziel);
        zuBesuchen.push(ziel);
      }
    }
  }
  for (const s of strecke.schritte) {
    if (!erreicht.has(s.kennung)) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'strecke.unerreichbar',
        text: `Schritt „${s.kennung}" wird von nichts angesprungen.`,
        stelle: s.kennung,
      });
    }
  }

  if (!strecke.schritte.some((s) => s.art === 'ende') && erreicht.size === strecke.schritte.length) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'strecke.ohne.ende',
      text: 'Die Strecke hat keinen Endschritt. Läufe bleiben dann an ihrem letzten Schritt stehen.',
    });
  }

  befunde.push(...kreisbefunde(strecke, nachKennung));
  return befunde;
}

/**
 * Kreise finden, die ohne Warten auskommen.
 *
 * Tiefensuche mit drei Farben. Ein Rückwärtsbogen schließt einen Kreis; ob
 * darin gewartet wird, verrät der Pfad im Stapel.
 */
function kreisbefunde(strecke: Strecke, nachKennung: Map<string, Schritt>): Befund[] {
  const befunde: Befund[] = [];
  const farbe = new Map<string, 'weiss' | 'grau' | 'schwarz'>();
  const pfad: string[] = [];
  const gemeldet = new Set<string>();

  const gehe = (kennung: string): void => {
    const s = nachKennung.get(kennung);
    if (!s) return;
    farbe.set(kennung, 'grau');
    pfad.push(kennung);

    for (const ziel of zieleVon(s)) {
      const zustand = farbe.get(ziel) ?? 'weiss';
      if (zustand === 'weiss') {
        gehe(ziel);
      } else if (zustand === 'grau') {
        // Kreis gefunden: von `ziel` bis zum Ende des Pfades.
        const ab = pfad.indexOf(ziel);
        const kreis = pfad.slice(ab);
        const wartet = kreis.some((k) => nachKennung.get(k)?.art === 'warten');
        const marke = [...kreis].sort().join('>');
        if (!wartet && !gemeldet.has(marke)) {
          gemeldet.add(marke);
          befunde.push({
            schwere: 'fehler',
            kennung: 'strecke.kreis.ohne.warten',
            text: `${kreis.join(' → ')} → ${ziel} ist ein Kreis ohne Warteschritt. Er würde ohne Unterbrechung senden.`,
            stelle: kreis[0],
          });
        }
      }
    }

    pfad.pop();
    farbe.set(kennung, 'schwarz');
  };

  gehe(strecke.erster);
  return befunde;
}

export const SCHRITTNAMEN: Record<Schritt['art'], string> = {
  warten: 'Warten',
  senden: 'Senden',
  merkmal: 'Merkmal setzen',
  bedingung: 'Wenn',
  ende: 'Ende',
};
