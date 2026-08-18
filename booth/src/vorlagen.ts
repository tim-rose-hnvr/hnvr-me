/**
 * Ablage der Vorlagen.
 *
 * Zwei Töpfe:
 *   · der mitgelieferte Katalog (`vorlagen-katalog.json`, 55 Blätter — vier
 *     eigene und 51 übernommene). Dieselbe Datei liest der Server, wenn er
 *     eine frische Box einrichtet: eine Quelle, kein Abgleich zweier Listen.
 *   · die Vorlagen des Betreibers (lokal gesichert)
 *
 * Der Katalog ist unveränderlich — er kommt aus dem Programm und bleibt, wie
 * er ist. Wer eine davon bearbeitet, bekommt eine Kopie. So ist der Weg zurück
 * immer offen, auch nach einer verunglückten Nacht am Editor.
 */

import katalogRoh from '../vorlagen-katalog.json';
import { pruefeVorlage, type Formatschluessel, type Vorlage } from './vorlage';

const SCHLUESSEL = 'youbooth.vorlagen';

/**
 * Der Katalog geht durch dieselbe Prüfung wie eine eingelesene Datei. Er wird
 * von einem Werkzeug erzeugt; eine kaputte Zeile darf nicht als kaputtes Blatt
 * im Drucker enden.
 */
const KATALOG: Vorlage[] = (katalogRoh as unknown[]).flatMap((roh) => {
  const geprueft = pruefeVorlage(roh);
  return 'vorlage' in geprueft ? [geprueft.vorlage] : [];
});

const MITGELIEFERT: Vorlage[] = KATALOG;
const MITGELIEFERT_IDS = new Set(MITGELIEFERT.map((v) => v.id));

export function mitgelieferteVorlagen(): Vorlage[] {
  return MITGELIEFERT;
}

export function eigeneVorlagen(): Vorlage[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return [];
    const liste = JSON.parse(roh) as unknown[];
    if (!Array.isArray(liste)) return [];
    // Auch die eigenen werden geprüft: Sie können aus einer älteren Fassung
    // stammen, in der ein Blatt noch `foto`/`streifen` hieß.
    return liste.flatMap((roheres) => {
      const geprueft = pruefeVorlage(roheres);
      return 'vorlage' in geprueft ? [geprueft.vorlage] : [];
    });
  } catch {
    return [];
  }
}

export function sichereEigene(liste: Vorlage[]): { ok: true } | { fehler: string } {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
    return { ok: true };
  } catch {
    // Meist die Speichergrenze des Browsers — fast immer ein zu großes Logo.
    return {
      fehler:
        'Die Vorlagen passen nicht in den Speicher. Meist liegt es an einem zu großen Logo — nimm ein kleineres PNG.',
    };
  }
}

export function alleVorlagen(): Vorlage[] {
  return [...MITGELIEFERT, ...eigeneVorlagen()];
}

export function istMitgeliefert(id: string): boolean {
  return MITGELIEFERT_IDS.has(id);
}

/**
 * Die Vorlage zu einer Kennung. Gibt es sie nicht mehr, wird die erste des
 * passenden Blattes genommen — die Box druckt weiter, auch wenn eine Vorlage
 * gelöscht wurde, während sie eingestellt war.
 */
export function findeVorlage(id: string, art: 'foto' | 'streifen'): Vorlage {
  const alle = alleVorlagen();
  return (
    alle.find((v) => v.id === id) ??
    alle.find((v) => v.art === art) ??
    MITGELIEFERT[0]!
  );
}

export function vorlagenNachFormat(format: Formatschluessel): Vorlage[] {
  return alleVorlagen().filter((v) => v.format === format);
}

export function neueVorlagenKennung(): string {
  return 'v' + Math.random().toString(36).slice(2, 9);
}

/** Kopiert eine Vorlage samt Feldern; den Namen bekommt der Aufrufer. */
export function kopiere(v: Vorlage, name: string): Vorlage {
  return {
    ...v,
    id: neueVorlagenKennung(),
    name,
    felder: v.felder.map((f) => ({ ...f })),
  };
}
