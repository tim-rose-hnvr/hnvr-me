/**
 * Der Beitrag — ein Gedanke, mehrere Kanäle.
 *
 * Der Zuschnitt ist die eigentliche Entscheidung: **ein** Beitrag trägt **je
 * Kanal eine Fassung**. Nicht fünf getrennte Beiträge (dann laufen sie
 * auseinander und niemand weiß, welcher der richtige war) und nicht ein Text
 * für alle (dann steht der LinkedIn-Absatz in einem 300-Zeichen-Netz und wird
 * abgeschnitten).
 *
 * Die Zustandskette ist absichtlich kurz und ohne Abkürzungen:
 *
 *   entwurf → eingereicht → freigegeben → geplant → veroeffentlicht
 *                  ↓             ↓            ↓
 *              abgelehnt   (zurück in    fehlgeschlagen
 *                  ↓         entwurf)         ↓
 *              entwurf                    geplant (neuer Versuch)
 *
 * `zurueckgezogen` ist von überall erreichbar außer von `veroeffentlicht`:
 * was draußen ist, ist draußen — das Zurücknehmen im Netz ist eine andere
 * Handlung als das Zurückziehen im Plan, und die beiden zu vermischen wäre
 * eine Lüge über das, was das Werkzeug kann.
 */

import type { Befund } from './befund.ts';
import { grenzeVon, regelnVon, type Kanal, type Kanalart } from './kanal.ts';
import { findeAdressen, hashtags, zaehle } from './zeichen.ts';

export const ZUSTAENDE = [
  'entwurf',
  'eingereicht',
  'freigegeben',
  'geplant',
  'veroeffentlicht',
  'abgelehnt',
  'fehlgeschlagen',
  'zurueckgezogen',
] as const;
export type Beitragszustand = (typeof ZUSTAENDE)[number];

const UEBERGAENGE: Record<Beitragszustand, readonly Beitragszustand[]> = {
  entwurf: ['eingereicht', 'zurueckgezogen'],
  // Freigeben heißt noch nicht planen: der Termin ist eine eigene Entscheidung.
  eingereicht: ['freigegeben', 'abgelehnt', 'entwurf', 'zurueckgezogen'],
  freigegeben: ['geplant', 'entwurf', 'zurueckgezogen'],
  // Ein geplanter Beitrag darf zurück in den Entwurf — dann verliert er die
  // Freigabe. Das ist Absicht: wer nach der Freigabe den Text ändert, hat
  // keinen freigegebenen Text mehr.
  geplant: ['veroeffentlicht', 'fehlgeschlagen', 'entwurf', 'zurueckgezogen'],
  fehlgeschlagen: ['geplant', 'entwurf', 'zurueckgezogen'],
  abgelehnt: ['entwurf', 'zurueckgezogen'],
  veroeffentlicht: [],
  zurueckgezogen: ['entwurf'],
};

export function darfUebergehen(von: Beitragszustand, nach: Beitragszustand): boolean {
  return UEBERGAENGE[von].includes(nach);
}

export function naechsteZustaende(von: Beitragszustand): readonly Beitragszustand[] {
  return UEBERGAENGE[von];
}

export interface Medium {
  art: 'bild' | 'video';
  datei: string;
  /**
   * Alternativtext. Leer heißt: fehlt.
   *
   * Hier steht die eine Regel, die dieses Werkzeug strenger macht als die
   * üblichen: **ohne Alternativtext wird nicht veröffentlicht.** Das ist keine
   * Bevormundung, sondern die einzige Stelle, an der sie wirkt — eine
   * Erinnerung, die man wegklicken kann, wird weggeklickt. Wer wirklich keinen
   * braucht (ein rein schmückendes Bild), setzt `schmueckend` und begründet es
   * damit selbst.
   */
  alt: string;
  schmueckend?: boolean;
}

export interface Fassung {
  /** Kennung des verbundenen Kanals. */
  kanal: string;
  art: Kanalart;
  text: string;
  medien: Medium[];
  /**
   * Der erste Kommentar. Bei Instagram wandern die Hashtags dorthin, damit die
   * Bildunterschrift lesbar bleibt; das Netz zählt sie dann nicht mit.
   */
  ersterKommentar?: string;
}

export interface Beitrag {
  kennung: string;
  organisation: string;
  /** Arbeitstitel, nur intern. Steht nie in einem Netz. */
  titel: string;
  zustand: Beitragszustand;
  fassungen: Fassung[];
  /** Wann er hinaus soll. `null`, solange das nicht entschieden ist. */
  geplantFuer: number | null;
  verfasser: string;
  angelegtAm: number;
  geaendertAm: number;
  /** Beim Scheitern: was das Netz gesagt hat. Wörtlich, nicht zusammengefasst. */
  fehlermeldung?: string;
}

/* ------------------------------------------------------------------ Prüfung */

/**
 * Eine Fassung gegen die Regeln ihres Kanals prüfen.
 *
 * Gibt alle Befunde zurück, nicht nur den ersten. Wer drei Dinge zu ändern
 * hat, soll sie in einem Durchgang sehen und nicht dreimal auf „prüfen"
 * drücken.
 */
export function pruefeFassung(fassung: Fassung, kanal: Kanal): Befund[] {
  const befunde: Befund[] = [];
  const regeln = regelnVon(kanal);
  const wo = kanal.anzeigename;

  const text = fassung.text.trim();
  const hatMedien = fassung.medien.length > 0;

  if (text.length === 0 && !hatMedien) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'fassung.leer',
      text: `Für ${wo} steht weder Text noch Bild.`,
      stelle: fassung.kanal,
    });
  }

  const zahl = zaehle(fassung.text, regeln.zaehlart);
  const grenze = grenzeVon(kanal);
  if (zahl > grenze) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'fassung.zu.lang',
      text: `${wo}: ${zahl} von ${grenze} Zeichen — ${zahl - grenze} zu viel.`,
      stelle: fassung.kanal,
    });
  } else if (regeln.umbruchBei !== null && zahl > regeln.umbruchBei && grenze > regeln.umbruchBei) {
    befunde.push({
      schwere: 'hinweis',
      kennung: 'fassung.umbruch',
      text: `${wo} klappt nach etwa ${regeln.umbruchBei} Zeichen zu. Was danach steht, liest nur, wer aufklappt.`,
      stelle: fassung.kanal,
    });
  }

  const bilder = fassung.medien.filter((m) => m.art === 'bild');
  const videos = fassung.medien.filter((m) => m.art === 'video');

  if (bilder.length > regeln.bilder) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'fassung.zu.viele.bilder',
      text: `${wo} nimmt höchstens ${regeln.bilder} Bilder, hier sind es ${bilder.length}.`,
      stelle: fassung.kanal,
    });
  }
  if (videos.length > regeln.videos) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'fassung.zu.viele.videos',
      text:
        regeln.videos === 0
          ? `${wo} nimmt kein Video.`
          : `${wo} nimmt höchstens ${regeln.videos} Video, hier sind es ${videos.length}.`,
      stelle: fassung.kanal,
    });
  }
  if (regeln.brauchtMedium && !hatMedien) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'fassung.medium.fehlt',
      text: `${wo} braucht ein Bild oder ein Video. Ohne geht dort gar nichts.`,
      stelle: fassung.kanal,
    });
  }

  /* Die strenge Regel. Sie steht als Fehler und nicht als Warnung, weil eine
     Warnung dieselbe Wirkung hat wie gar nichts. */
  if (regeln.kanntAlternativtext) {
    const ohne = fassung.medien.filter((m) => !m.schmueckend && m.alt.trim().length === 0);
    if (ohne.length > 0) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'fassung.alt.fehlt',
        text:
          ohne.length === 1
            ? `${wo}: einem Bild fehlt der Alternativtext. Ohne ihn ist der Beitrag für blinde Leser leer.`
            : `${wo}: ${ohne.length} Bildern fehlt der Alternativtext.`,
        stelle: fassung.kanal,
      });
    }
    const duerftig = fassung.medien.filter(
      (m) => !m.schmueckend && m.alt.trim().length > 0 && m.alt.trim().length < 8,
    );
    if (duerftig.length > 0) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'fassung.alt.duerftig',
        text: `${wo}: ein Alternativtext ist kürzer als acht Zeichen. „Bild" beschreibt nichts.`,
        stelle: fassung.kanal,
      });
    }
  }

  const tags = hashtags(fassung.text + ' ' + (fassung.ersterKommentar ?? ''));
  if (regeln.hashtags !== null && tags.length > regeln.hashtags) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'fassung.zu.viele.hashtags',
      text: `${wo} nimmt höchstens ${regeln.hashtags} Hashtags, hier sind es ${tags.length}.`,
      stelle: fassung.kanal,
    });
  }

  if (!regeln.linkWirkt && findeAdressen(fassung.text).length > 0) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'fassung.link.wirkt.nicht',
      text: `${wo} macht Links in der Bildunterschrift nicht anklickbar. Der Text steht da, führt aber nirgendwohin.`,
      stelle: fassung.kanal,
    });
  }

  if (kanal.art === 'linkedin' && tags.length > 5) {
    befunde.push({
      schwere: 'hinweis',
      kennung: 'fassung.viele.hashtags',
      text: `${wo}: ${tags.length} Hashtags. Mehr als drei bis fünf lesen sich dort wie ein Inserat.`,
      stelle: fassung.kanal,
    });
  }

  if (!kanal.aktiv) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'kanal.stillgelegt',
      text: `${wo} ist stillgelegt. Dorthin geht nichts hinaus.`,
      stelle: fassung.kanal,
    });
  }

  return befunde;
}

/**
 * Den ganzen Beitrag prüfen.
 *
 * `kanaele` ist die Liste der verbundenen Zugänge; eine Fassung ohne
 * dazugehörigen Zugang ist ein Fehler und keine leere Prüfung — genau so
 * verschwinden Beiträge, wenn jemand einen Kanal trennt.
 */
export function pruefeBeitrag(beitrag: Beitrag, kanaele: readonly Kanal[]): Befund[] {
  const befunde: Befund[] = [];

  if (beitrag.fassungen.length === 0) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'beitrag.ohne.kanal',
      text: 'Der Beitrag hat keinen Kanal. Er ginge nirgendwohin.',
    });
    return befunde;
  }

  const nachKennung = new Map(kanaele.map((k) => [k.kennung, k]));
  for (const fassung of beitrag.fassungen) {
    const kanal = nachKennung.get(fassung.kanal);
    if (!kanal) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'fassung.kanal.fehlt',
        text: 'Zu einer Fassung gibt es keinen verbundenen Kanal mehr. Sie muss entfernt oder neu zugeordnet werden.',
        stelle: fassung.kanal,
      });
      continue;
    }
    if (kanal.organisation !== beitrag.organisation) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'fassung.fremde.organisation',
        text: 'Eine Fassung zeigt auf einen Kanal einer anderen Organisation.',
        stelle: fassung.kanal,
      });
      continue;
    }
    befunde.push(...pruefeFassung(fassung, kanal));
  }

  /* Wortgleich auf allen Kanälen: technisch in Ordnung, handwerklich fast nie.
     Ein Hinweis, keine Warnung — es gibt Ankündigungen, bei denen es richtig
     ist. */
  if (beitrag.fassungen.length > 1) {
    const texte = new Set(beitrag.fassungen.map((f) => f.text.trim()));
    if (texte.size === 1) {
      befunde.push({
        schwere: 'hinweis',
        kennung: 'beitrag.wortgleich',
        text: 'Alle Kanäle bekommen denselben Text. Das liest sich auf mindestens einem von ihnen fremd.',
      });
    }
  }

  return befunde;
}

/**
 * Darf dieser Beitrag jetzt hinaus?
 *
 * Die Fassung, die vor dem Absenden gilt: nur `geplant`, nur ohne Fehler,
 * und nur wenn der Termin erreicht ist. Die Prüfung läuft **noch einmal**
 * unmittelbar vor dem Versand und nicht nur bei der Freigabe — zwischen
 * beidem kann ein Token abgelaufen und ein Kanal getrennt worden sein.
 */
export function bereitZumSenden(
  beitrag: Beitrag,
  kanaele: readonly Kanal[],
  jetzt: number,
): { ok: true } | { ok: false; befunde: Befund[] } {
  const befunde: Befund[] = [];
  if (beitrag.zustand !== 'geplant') {
    befunde.push({
      schwere: 'fehler',
      kennung: 'beitrag.zustand',
      text: `Der Beitrag steht auf „${beitrag.zustand}" und nicht auf „geplant".`,
    });
  }
  if (beitrag.geplantFuer === null) {
    befunde.push({ schwere: 'fehler', kennung: 'beitrag.ohne.termin', text: 'Der Beitrag hat keinen Termin.' });
  } else if (beitrag.geplantFuer > jetzt) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'beitrag.zu.frueh',
      text: 'Der Termin ist noch nicht erreicht.',
    });
  }
  befunde.push(...pruefeBeitrag(beitrag, kanaele).filter((b) => b.schwere === 'fehler'));
  return befunde.length === 0 ? { ok: true } : { ok: false, befunde };
}

export const ZUSTANDSNAMEN: Record<Beitragszustand, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  freigegeben: 'Freigegeben',
  geplant: 'Geplant',
  veroeffentlicht: 'Veröffentlicht',
  abgelehnt: 'Abgelehnt',
  fehlgeschlagen: 'Fehlgeschlagen',
  zurueckgezogen: 'Zurückgezogen',
};
