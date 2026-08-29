/**
 * Rollen und Rechte.
 *
 * Zwei Regeln, die alles andere tragen:
 *
 * 1. **Geprüft wird im Kern, nie in der Oberfläche.** Ein Knopf, der nicht
 *    angezeigt wird, ist keine Absicherung — die Adresse dahinter lässt sich
 *    eintippen. Die Oberfläche fragt dieselbe Funktion, aber sie ist nicht
 *    die Stelle, an der entschieden wird.
 * 2. **Rechte hängen an Rollen, nicht an Gerätetypen oder Bildschirmen.** Wer
 *    freigeben darf, darf es am Telefon genauso.
 *
 * Die Rollen erben aufsteigend. Das ist kürzer als fünf Listen und lässt sich
 * nicht auseinanderlaufen: ein neues Recht, das die Leitung haben soll, wird
 * einmal eingetragen.
 */

export const ROLLEN = ['betrachter', 'redakteur', 'freigeber', 'leitung', 'verwaltung'] as const;
export type Rolle = (typeof ROLLEN)[number];

export const RECHTE = [
  'beitrag.lesen',
  'beitrag.schreiben',
  'beitrag.einreichen',
  'beitrag.freigeben',
  'beitrag.veroeffentlichen',
  'beitrag.loeschen',
  'plan.lesen',
  'plan.aendern',
  'plan.ruhemodus',
  'eingang.lesen',
  'eingang.antworten',
  'eingang.zuweisen',
  'newsletter.lesen',
  'newsletter.schreiben',
  'newsletter.probesenden',
  'newsletter.senden',
  'empfaenger.lesen',
  'empfaenger.pflegen',
  'empfaenger.ausleiten',
  'empfaenger.loeschen',
  'auswertung.lesen',
  'kanal.verbinden',
  'mitglied.verwalten',
] as const;
export type Recht = (typeof RECHTE)[number];

/** Was jede Rolle **zusätzlich** zur darunterliegenden darf. */
const ZUSAETZLICH: Record<Rolle, readonly Recht[]> = {
  betrachter: ['beitrag.lesen', 'plan.lesen', 'newsletter.lesen', 'auswertung.lesen', 'eingang.lesen'],
  redakteur: [
    'beitrag.schreiben',
    'beitrag.einreichen',
    'plan.aendern',
    'eingang.antworten',
    'newsletter.schreiben',
    'newsletter.probesenden',
    'empfaenger.lesen',
  ],
  /* Der Freigeber darf freigeben und zuweisen — aber **nicht senden**. Das ist
     Absicht: Freigabe und Auslösung sind zwei Handgriffe, und wer beide in
     einem hat, kann sich nicht vertippen, sondern nur irren. */
  freigeber: ['beitrag.freigeben', 'eingang.zuweisen'],
  leitung: [
    'beitrag.veroeffentlichen',
    'beitrag.loeschen',
    'newsletter.senden',
    'plan.ruhemodus',
    'empfaenger.pflegen',
    'empfaenger.ausleiten',
  ],
  /* Löschen von Personendaten und das Verbinden von Kanälen sind die beiden
     Handlungen, die nicht rückholbar sind. Sie liegen ganz oben. */
  verwaltung: ['empfaenger.loeschen', 'kanal.verbinden', 'mitglied.verwalten'],
};

function baueTabelle(): Record<Rolle, ReadonlySet<Recht>> {
  const tabelle = {} as Record<Rolle, ReadonlySet<Recht>>;
  const gesammelt = new Set<Recht>();
  for (const rolle of ROLLEN) {
    for (const recht of ZUSAETZLICH[rolle]) gesammelt.add(recht);
    tabelle[rolle] = new Set(gesammelt);
  }
  return tabelle;
}

const TABELLE = baueTabelle();

export interface Sitzung {
  /** Wer. */
  person: string;
  /** Welche Rolle diese Person in **dieser** Organisation hat. */
  rolle: Rolle;
  /** Für welche Organisation. Ohne das ist Mandantenfähigkeit eine Absicht. */
  organisation: string;
}

/** Darf diese Rolle das? */
export function darf(rolle: Rolle, recht: Recht): boolean {
  return TABELLE[rolle].has(recht);
}

/**
 * Darf diese Sitzung das an diesem Gegenstand?
 *
 * Der zweite Teil ist der wichtigere: ein Recht gilt immer nur innerhalb der
 * eigenen Organisation. Ein Freigeber bei Kunde A ist bei Kunde B nicht
 * einmal Betrachter.
 */
export function darfHier(sitzung: Sitzung, recht: Recht, organisation: string): boolean {
  if (sitzung.organisation !== organisation) return false;
  return darf(sitzung.rolle, recht);
}

/** Alle Rechte einer Rolle — für die Anzeige in der Mitgliederverwaltung. */
export function rechteVon(rolle: Rolle): Recht[] {
  return RECHTE.filter((r) => TABELLE[rolle].has(r));
}

export const ROLLENNAMEN: Record<Rolle, string> = {
  betrachter: 'Betrachter',
  redakteur: 'Redakteur',
  freigeber: 'Freigeber',
  leitung: 'Leitung',
  verwaltung: 'Verwaltung',
};

export const ROLLENBESCHREIBUNG: Record<Rolle, string> = {
  betrachter: 'Sieht Plan, Beiträge und Zahlen. Ändert nichts.',
  redakteur: 'Schreibt, plant und reicht ein. Gibt nicht frei.',
  freigeber: 'Gibt frei und weist im Eingang zu. Sendet nicht.',
  leitung: 'Veröffentlicht, sendet Newsletter, schaltet den Ruhemodus.',
  verwaltung: 'Verbindet Kanäle, verwaltet Mitglieder, löscht Personendaten.',
};
