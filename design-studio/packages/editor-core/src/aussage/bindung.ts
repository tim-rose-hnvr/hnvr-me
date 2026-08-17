/**
 * Bindung — der Unterschied zwischen einer Kopie und einer Sicht.
 *
 * Ein Platzhalter mit Bindung enthält keinen Text, sondern einen **Verweis** auf
 * ein Feld der Aussage. Beim Anzeigen wird aufgelöst, nie kopiert. Genau darin
 * unterscheidet sich das hier von jedem Werkzeug, das „Magic Resize" kann: dort
 * entsteht beim Umformatieren eine neue, unabhängige Datei, und ab dem Moment
 * laufen die Fassungen auseinander.
 *
 * Die Auflösung wählt je Rahmen die längste Kürzungsstufe, die hineinpasst.
 * Dieselbe Aussage wird auf dem Plakat also anders geschrieben als in der
 * Story — ohne dass jemand zweimal tippt.
 */

import type { Entwurf, Entwurfselement, TextElement } from '../modell/entwurf.js';
import { ersetzeElement } from '../modell/navigation.js';
import {
  type Aussage,
  FELDSCHLUESSEL,
  type Feldschluessel,
  type Kuerzungsstufe,
  kapazitaetInZeichen,
  schreibeTermin,
  stufen,
} from './aussage.js';

/** Was beim Auflösen eines gebundenen Platzhalters herauskam. */
export interface Bindungsbefund {
  elementId: string;
  feld: Feldschluessel;
  stufe: Kuerzungsstufe;
  text: string;
  /** Geschätzte Zeichenkapazität des Rahmens. */
  kapazitaet: number;
  /** `false`, wenn nicht einmal die kürzeste Fassung hineinpasst. */
  passt: boolean;
  /** `true`, wenn ein Textmesser entschieden hat, `false` bei Schätzung. */
  gemessen: boolean;
}

/**
 * Misst, wie hoch ein Text in einem Rahmen tatsächlich wird — in Pixeln bei der
 * dpi des Entwurfs.
 *
 * Warum das gebraucht wird: `kapazitaetInZeichen` schätzt über eine mittlere
 * Zeichenbreite von 0,5 em. Für eine fette Schlagzeile ist das zu großzügig.
 * Ein Titel mit genau der geschätzten Zeichenzahl brach in drei statt zwei
 * Zeilen um und lief über den Untertitel — die Prüfung meldete „passt".
 *
 * Die Schätzung bleibt trotzdem: sie ist der Vorfilter für Umgebungen ohne
 * Satz (Server, Tests). Wo gesetzt werden kann, hat die Messung das letzte
 * Wort — und genau das steht in `gemessen`.
 */
export type Textmesser = (text: string, element: TextElement) => number;

export interface Aufloesung {
  entwurf: Entwurf;
  befunde: Bindungsbefund[];
  /** Felder, auf die gebunden wird, die es in der Aussage aber nicht gibt. */
  fehlendeFelder: Feldschluessel[];
}

/** Prüft, ob eine Bindung auf ein bekanntes Feld zeigt. `modell` kennt die
 * Feldschlüssel bewusst nicht, deshalb wird hier geprüft statt dort. */
export function istFeldschluessel(wert: string): wert is Feldschluessel {
  return (FELDSCHLUESSEL as readonly string[]).includes(wert);
}

function istGebundenerText(element: Entwurfselement): element is TextElement {
  const bindung = element.platzhalter?.bindung;
  return element.typ === 'text' && typeof bindung === 'string' && istFeldschluessel(bindung);
}

/**
 * Setzt in alle gebundenen Platzhalter den aufgelösten Text der Aussage.
 *
 * Gibt einen neuen Entwurf zurück — der gespeicherte behält die Bindung, nicht
 * das Ergebnis. Nur so wirkt eine spätere Änderung an der Aussage überhaupt.
 */
export function loeseBindungen(
  entwurf: Entwurf,
  aussage: Aussage,
  messer?: Textmesser,
): Aufloesung {
  const befunde: Bindungsbefund[] = [];
  const fehlend = new Set<Feldschluessel>();
  let ergebnis = entwurf;

  const gebundene: TextElement[] = [];
  const sammle = (elemente: readonly Entwurfselement[]): void => {
    for (const element of elemente) {
      if (istGebundenerText(element)) gebundene.push(element);
      if (element.typ === 'gruppe') sammle(element.kinder);
    }
  };
  for (const seite of entwurf.seiten) sammle(seite.elemente);

  for (const element of gebundene) {
    const roh = element.platzhalter?.bindung;
    if (typeof roh !== 'string' || !istFeldschluessel(roh)) continue;
    const feld: Feldschluessel = roh;

    const kapazitaet = kapazitaetInZeichen(
      element.breite,
      element.hoehe,
      element.schriftGroesse,
      element.zeilenabstand,
    );

    // Der Termin ist kein Text, sondern ein Zeitpunkt — er wird je Stufe anders
    // geschrieben statt gekürzt. Das ist der Gewinn getippter Felder, und
    // deshalb reicht der Zeitpunkt allein: ein Textfeld `termin` braucht es
    // dafür nicht. Nur ohne Zeitpunkt zählt, was jemand getippt hat („nach
    // Vereinbarung").
    const wert = aussage.felder[feld];
    const kandidaten: { stufe: Kuerzungsstufe; text: string }[] =
      feld === 'termin' && aussage.termin !== null
        ? terminfassungen(aussage.termin)
        : wert === undefined
          ? []
          : stufen(wert);

    if (kandidaten.length === 0) {
      fehlend.add(feld);
      continue;
    }

    const gewaehlt =
      messer === undefined
        ? waehleGeschaetzt(kandidaten, kapazitaet)
        : waehleGemessen(kandidaten, element, messer);

    befunde.push({
      elementId: element.id,
      feld,
      stufe: gewaehlt.stufe,
      text: gewaehlt.text,
      kapazitaet,
      passt: gewaehlt.passt,
      gemessen: messer !== undefined,
    });

    const naechster = ersetzeElement(ergebnis, element.id, (vorhanden) => ({
      ...(vorhanden as TextElement),
      inhalt: gewaehlt.text,
    }));
    if (naechster !== null) ergebnis = naechster;
  }

  return { entwurf: ergebnis, befunde, fehlendeFelder: [...fehlend] };
}

/** Ein Zeitpunkt in allen drei Schreibweisen, von lang nach kurz. */
function terminfassungen(iso: string): { stufe: Kuerzungsstufe; text: string }[] {
  const alle: Kuerzungsstufe[] = ['lang', 'mittel', 'kurz'];
  return alle.map((stufe) => ({ stufe, text: schreibeTermin(iso, stufe) }));
}

type Wahl = { stufe: Kuerzungsstufe; text: string; passt: boolean };

/** Ohne Satz: die Schätzung über Zeichenzahl. */
function waehleGeschaetzt(
  kandidaten: readonly { stufe: Kuerzungsstufe; text: string }[],
  kapazitaet: number,
): Wahl {
  const passend = kandidaten.find((k) => k.text.length <= kapazitaet);
  if (passend !== undefined) return { ...passend, passt: true };
  const kuerzeste = kandidaten[kandidaten.length - 1];
  if (kuerzeste === undefined) throw new Error('waehleGeschaetzt ohne Kandidaten');
  return { ...kuerzeste, passt: false };
}

/**
 * Mit Satz: die längste Fassung, die **gemessen** in den Rahmen passt.
 *
 * Toleranz von einem halben Pixel, weil Rahmenhöhen aus Schriftgröße mal
 * Zeilenabstand entstehen und der Browser auf Geräte-Pixel rundet. Ohne sie
 * fiele eine Fassung wegen 0,3 px Rundungsdifferenz eine Stufe zurück.
 */
function waehleGemessen(
  kandidaten: readonly { stufe: Kuerzungsstufe; text: string }[],
  element: TextElement,
  messer: Textmesser,
): Wahl {
  for (const kandidat of kandidaten) {
    if (messer(kandidat.text, element) <= element.hoehe + 0.5) return { ...kandidat, passt: true };
  }
  const kuerzeste = kandidaten[kandidaten.length - 1];
  if (kuerzeste === undefined) throw new Error('waehleGemessen ohne Kandidaten');
  return { ...kuerzeste, passt: false };
}

/**
 * Ein Entwurf mit Bindungen, aber ohne `aussageId`, ist eine Ausspielung ohne
 * Quelle: die Platzhalter bleiben leer, und zwar erst sichtbar beim nächsten
 * Öffnen. Entsteht, wenn eine Aussage gelöscht oder ein Entwurf von Hand kopiert
 * wurde. Ein frei getippter Entwurf ohne Bindungen ist dagegen in Ordnung.
 */
export function bindetOhneQuelle(entwurf: Entwurf): boolean {
  return entwurf.aussageId === null && gebundeneFelder(entwurf).length > 0;
}

/** Alle Felder, auf die ein Entwurf sich stützt. Für die Vollständigkeitsprüfung. */
export function gebundeneFelder(entwurf: Entwurf): Feldschluessel[] {
  const felder = new Set<Feldschluessel>();
  const sammle = (elemente: readonly Entwurfselement[]): void => {
    for (const element of elemente) {
      const roh = element.platzhalter?.bindung;
      if (typeof roh === 'string' && istFeldschluessel(roh)) felder.add(roh);
      if (element.typ === 'gruppe') sammle(element.kinder);
    }
  };
  for (const seite of entwurf.seiten) sammle(seite.elemente);
  return [...felder];
}
