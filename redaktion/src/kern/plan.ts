/**
 * Der Redaktionsplan.
 *
 * Ein Kalender ist der leichte Teil. Der schwere Teil sind die vier Regeln,
 * die verhindern, dass ein Plan zu einem Stapel wird:
 *
 * - **Abstand.** Zwei Beiträge auf demselben Kanal binnen einer halben Stunde
 *   erreichen zusammen weniger Menschen als einer. Das ist kein Geschmack,
 *   das ist die Art, wie Zeitleisten sortieren.
 * - **Ruhezeiten.** Was nachts um drei erscheint, hat am Morgen keine Frische
 *   mehr. Ruhezeiten sind je Organisation eingestellt, nicht je Kanal geraten.
 * - **Vorlauf.** Ein Beitrag, der in zwei Minuten hinaus soll, hat keine
 *   Gelegenheit mehr, angehalten zu werden. Der Vorlauf ist die Notbremse.
 * - **Ruhemodus.** Wenn etwas passiert ist, wird **alles** angehalten, mit
 *   einem Schalter, und zwar auch die Newsletter. Ein Werkzeug, in dem der
 *   Krisenschalter nur die sozialen Kanäle erreicht, hat den Zweck verfehlt.
 */

import type { Befund } from './befund.ts';
import { tokenbefund, type Kanal } from './kanal.ts';
import type { Beitrag } from './beitrag.ts';
import { minutenAmTag, rasterAuf, wochentag, ZONE } from './zeit.ts';

/**
 * Eine Ruhezeit.
 *
 * `von` und `bis` sind Minuten seit Mitternacht. Ist `von` größer als `bis`,
 * läuft die Zeit über Mitternacht — das ist der Normalfall (22:00 bis 07:00)
 * und keine Ausnahme, die man vergessen dürfte.
 */
export interface Ruhezeit {
  /** ISO: 1 = Montag … 7 = Sonntag. Leer heißt: an allen Tagen. */
  wochentage: number[];
  vonMinute: number;
  bisMinute: number;
}

export interface Planregeln {
  organisation: string;
  zone: string;
  /** Rastermaß in Minuten. 15 ist fein genug und grob genug. */
  raster: number;
  /** Kleinster Abstand zweier Beiträge auf demselben Kanal, in Minuten. */
  mindestabstandMin: number;
  /** Wie weit ein Termin mindestens in der Zukunft liegen muss, in Minuten. */
  vorlaufMin: number;
  ruhezeiten: Ruhezeit[];
  ruhemodus: Ruhemodus;
}

export interface Ruhemodus {
  an: boolean;
  /** Warum. Steht in jedem angehaltenen Beitrag, damit niemand raten muss. */
  grund?: string;
  seit?: number;
  von?: string;
}

export const GRUNDREGELN: Omit<Planregeln, 'organisation'> = {
  zone: ZONE,
  raster: 15,
  mindestabstandMin: 30,
  vorlaufMin: 5,
  ruhezeiten: [{ wochentage: [], vonMinute: 22 * 60, bisMinute: 7 * 60 }],
  ruhemodus: { an: false },
};

/** Liegt der Zeitpunkt in einer Ruhezeit? */
export function inRuhezeit(zeitpunkt: number, regeln: Planregeln): boolean {
  const tag = wochentag(zeitpunkt, regeln.zone);
  const minute = minutenAmTag(zeitpunkt, regeln.zone);
  return regeln.ruhezeiten.some((r) => {
    if (r.wochentage.length > 0 && !r.wochentage.includes(tag)) return false;
    // Über Mitternacht: 22:00–07:00 heißt „ab 22:00 **oder** vor 07:00".
    return r.vonMinute > r.bisMinute
      ? minute >= r.vonMinute || minute < r.bisMinute
      : minute >= r.vonMinute && minute < r.bisMinute;
  });
}

/** Die Termine, die auf einem Kanal schon belegt sind. */
export interface Belegung {
  beitrag: string;
  kanal: string;
  zeitpunkt: number;
}

export function belegungenAus(beitraege: readonly Beitrag[]): Belegung[] {
  const heraus: Belegung[] = [];
  for (const b of beitraege) {
    if (b.geplantFuer === null) continue;
    if (b.zustand !== 'geplant' && b.zustand !== 'veroeffentlicht' && b.zustand !== 'freigegeben') continue;
    for (const f of b.fassungen) heraus.push({ beitrag: b.kennung, kanal: f.kanal, zeitpunkt: b.geplantFuer });
  }
  return heraus;
}

/**
 * Einen Termin prüfen.
 *
 * `belegungen` sind alle bereits belegten Termine der Organisation —
 * einschließlich derer des Beitrags selbst, die hier über `eigeneKennung`
 * herausgerechnet werden. Ohne das meldet jeder Beitrag beim Verschieben
 * einen Konflikt mit sich selbst.
 */
export function pruefeTermin(
  beitrag: Beitrag,
  zeitpunkt: number,
  belegungen: readonly Belegung[],
  kanaele: readonly Kanal[],
  regeln: Planregeln,
  jetzt: number,
): Befund[] {
  const befunde: Befund[] = [];

  if (regeln.ruhemodus.an) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'plan.ruhemodus',
      text: regeln.ruhemodus.grund
        ? `Der Ruhemodus ist an: ${regeln.ruhemodus.grund}. Bis er endet, geht nichts hinaus — auch kein Newsletter.`
        : 'Der Ruhemodus ist an. Bis er endet, geht nichts hinaus — auch kein Newsletter.',
    });
  }

  if (zeitpunkt <= jetzt) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'plan.vergangenheit',
      text: 'Der Termin liegt in der Vergangenheit.',
    });
  } else if (zeitpunkt - jetzt < regeln.vorlaufMin * 60_000) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'plan.kein.vorlauf',
      text: `Weniger als ${regeln.vorlaufMin} Minuten Vorlauf. Bis dahin lässt sich der Beitrag kaum noch anhalten.`,
    });
  }

  if (inRuhezeit(zeitpunkt, regeln)) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'plan.ruhezeit',
      text: 'Der Termin liegt in einer Ruhezeit. Dort erscheint der Beitrag, wenn kaum jemand hinsieht.',
    });
  }

  if (zeitpunkt % (regeln.raster * 60_000) !== 0 && rasterAuf(zeitpunkt, regeln.raster, regeln.zone) !== zeitpunkt) {
    befunde.push({
      schwere: 'hinweis',
      kennung: 'plan.neben.raster',
      text: `Der Termin liegt nicht auf dem ${regeln.raster}-Minuten-Raster.`,
    });
  }

  const eigeneKanaele = new Set(beitrag.fassungen.map((f) => f.kanal));
  const abstandMs = regeln.mindestabstandMin * 60_000;
  const nachKennung = new Map(kanaele.map((k) => [k.kennung, k]));

  for (const belegt of belegungen) {
    if (belegt.beitrag === beitrag.kennung) continue;
    if (!eigeneKanaele.has(belegt.kanal)) continue;
    const abstand = Math.abs(belegt.zeitpunkt - zeitpunkt);
    if (abstand >= abstandMs) continue;
    const name = nachKennung.get(belegt.kanal)?.anzeigename ?? belegt.kanal;
    befunde.push({
      schwere: abstand === 0 ? 'fehler' : 'warnung',
      kennung: abstand === 0 ? 'plan.gleicher.termin' : 'plan.zu.dicht',
      text:
        abstand === 0
          ? `Auf ${name} steht zur selben Minute bereits ein Beitrag.`
          : `Auf ${name} steht ${Math.round(abstand / 60_000)} Minuten daneben schon ein Beitrag. Empfohlen sind ${regeln.mindestabstandMin}.`,
      stelle: belegt.kanal,
    });
  }

  for (const fassung of beitrag.fassungen) {
    const kanal = nachKennung.get(fassung.kanal);
    if (!kanal) continue;
    // Der Zugang muss **zum Termin** gelten, nicht jetzt. Ein Token, das in
    // drei Tagen abläuft, trägt einen Beitrag in vier Wochen nicht mehr.
    const befund = tokenbefund(kanal, zeitpunkt);
    if (befund) befunde.push(befund);
  }

  return befunde;
}

/**
 * Der nächste freie Termin auf dem Raster.
 *
 * Sucht ab `ab` vorwärts den ersten Zeitpunkt, der auf dem Raster liegt, außerhalb
 * jeder Ruhezeit und weit genug von allem entfernt, was auf denselben Kanälen
 * schon steht. Gibt `null`, wenn innerhalb von `tage` nichts frei ist — das
 * passiert bei Ruhezeiten, die fast den ganzen Tag abdecken, und ist dann eine
 * Auskunft über die Einstellung und kein Fehler.
 */
export function naechsterFreierTermin(
  ab: number,
  kanaele: readonly string[],
  belegungen: readonly Belegung[],
  regeln: Planregeln,
  tage = 14,
): number | null {
  const abstandMs = regeln.mindestabstandMin * 60_000;
  const betroffen = belegungen.filter((b) => kanaele.includes(b.kanal)).map((b) => b.zeitpunkt);
  const ende = ab + tage * 86_400_000;

  let kandidat = rasterAuf(ab, regeln.raster, regeln.zone);
  while (kandidat < ende) {
    if (!inRuhezeit(kandidat, regeln) && !betroffen.some((z) => Math.abs(z - kandidat) < abstandMs)) {
      return kandidat;
    }
    kandidat = rasterAuf(kandidat + 1, regeln.raster, regeln.zone);
  }
  return null;
}

/**
 * Was der Ruhemodus anhält.
 *
 * Gibt die Kennungen aller Beiträge zurück, die durch den Ruhemodus liegen
 * bleiben. Die Liste ist der Grund, warum das ein Schalter und keine
 * Massenbearbeitung ist: wer in einer Krise dreißig Beiträge einzeln
 * verschieben muss, verschiebt sie nicht.
 */
export function vomRuhemodusBetroffen(beitraege: readonly Beitrag[], jetzt: number): string[] {
  return beitraege
    .filter((b) => b.zustand === 'geplant' && b.geplantFuer !== null && b.geplantFuer > jetzt)
    .map((b) => b.kennung);
}

export function ruhemodusBefund(regeln: Planregeln, betroffen: number): Befund | null {
  if (!regeln.ruhemodus.an) return null;
  return {
    schwere: 'warnung',
    kennung: 'plan.ruhemodus.aktiv',
    text:
      betroffen === 0
        ? `Ruhemodus an${regeln.ruhemodus.grund ? `: ${regeln.ruhemodus.grund}` : ''}. Derzeit wartet nichts.`
        : `Ruhemodus an${regeln.ruhemodus.grund ? `: ${regeln.ruhemodus.grund}` : ''}. ${betroffen} ${betroffen === 1 ? 'Beitrag wartet' : 'Beiträge warten'}.`,
  };
}
