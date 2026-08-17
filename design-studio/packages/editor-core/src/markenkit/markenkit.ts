/**
 * Markenkit — die verbindliche Gestaltungsvorgabe einer Organisation.
 *
 * Im strikten Modus ist das keine Empfehlung: Kommandos, die eine Farbe oder
 * Schrift außerhalb des Kits einführen, werden abgelehnt. Genau dafür kaufen
 * Kunden das Produkt, und genau das kann Canva nicht.
 */

import type { AssetReferenz, Entwurf, Farbe } from '../modell/entwurf.js';
import { alleElemente } from '../modell/navigation.js';

export interface Cmyk {
  /** Jeweils 0..100 Prozent. */
  c: number;
  m: number;
  y: number;
  k: number;
}

export interface MarkenFarbe {
  id: string;
  name: string;
  hex: Farbe;
  /** Für den Druck verbindlich, wenn gesetzt — sonst wird aus RGB gewandelt. */
  cmyk: Cmyk | null;
  /** Sonderfarbenname, etwa "PANTONE 286 C". */
  sonderfarbe: string | null;
}

export type Schriftlizenz = 'ofl' | 'kommerziell' | 'unbekannt';

export interface MarkenSchrift {
  id: string;
  name: string;
  /** CSS-Familienname, muss zur ausgelieferten Schriftdatei passen. */
  familie: string;
  /** Verfügbare Schnitte als CSS-Gewichte. */
  staerken: readonly number[];
  kursivVerfuegbar: boolean;
  quelleUrl: string;
  /**
   * Nur `ofl` darf ohne Weiteres ins PDF eingebettet werden. Alles andere
   * braucht einen Embedding-Vertrag, sonst ist die Druckdatei ein Rechtsproblem.
   */
  lizenz: Schriftlizenz;
}

export interface MarkenLogo {
  id: string;
  name: string;
  asset: AssetReferenz;
  /** Schutzgröße in px bei 300 dpi. Darunter wird das Logo unleserlich. */
  mindestbreiteDruckPx: number;
}

export interface Markenkit {
  id: string;
  organisationId: string;
  name: string;
  farben: readonly MarkenFarbe[];
  schriften: readonly MarkenSchrift[];
  logos: readonly MarkenLogo[];
  /** `true` heißt: Verstöße werden abgelehnt, nicht nur angezeigt. */
  strikt: boolean;
}

export type Schwere = 'fehler' | 'warnung';

export interface Markenverstoss {
  regel: string;
  meldung: string;
  schwere: Schwere;
  seiteId: string | null;
  elementId: string | null;
}

/** Vergleicht nur RGB, Alpha bleibt außen vor — Transparenz ist kein Markenbruch. */
function grundfarbe(farbe: Farbe): string {
  return farbe.slice(0, 7).toLowerCase();
}

function kennt(kit: Markenkit, farbe: Farbe): boolean {
  const gesucht = grundfarbe(farbe);
  return kit.farben.some((f) => grundfarbe(f.hex) === gesucht);
}

/**
 * Prüft einen Entwurf gegen ein Markenkit. Gibt alle Verstöße zurück, auch bei
 * nicht striktem Kit — dort sind sie Hinweise für die Oberfläche.
 */
export function pruefeMarkenkonform(entwurf: Entwurf, kit: Markenkit): Markenverstoss[] {
  const verstoesse: Markenverstoss[] = [];
  const schwere: Schwere = kit.strikt ? 'fehler' : 'warnung';

  if (entwurf.organisationId !== kit.organisationId) {
    verstoesse.push({
      regel: 'mandant',
      meldung: `Entwurf gehört zu Organisation "${entwurf.organisationId}", das Markenkit zu "${kit.organisationId}"`,
      schwere: 'fehler',
      seiteId: null,
      elementId: null,
    });
  }

  for (const seite of entwurf.seiten) {
    if (seite.hintergrund !== null && !kennt(kit, seite.hintergrund)) {
      verstoesse.push({
        regel: 'farbe',
        meldung: `Seitenhintergrund ${seite.hintergrund} ist nicht im Markenkit`,
        schwere,
        seiteId: seite.id,
        elementId: null,
      });
    }
  }

  for (const { element, seiteId } of alleElemente(entwurf)) {
    switch (element.typ) {
      case 'text': {
        if (!kennt(kit, element.farbe)) {
          verstoesse.push({
            regel: 'farbe',
            meldung: `Textfarbe ${element.farbe} ist nicht im Markenkit`,
            schwere,
            seiteId,
            elementId: element.id,
          });
        }
        const schrift = kit.schriften.find((s) => s.familie === element.schriftFamilie);
        if (schrift === undefined) {
          verstoesse.push({
            regel: 'schrift',
            meldung: `Schrift "${element.schriftFamilie}" ist nicht im Markenkit`,
            schwere,
            seiteId,
            elementId: element.id,
          });
        } else {
          if (!schrift.staerken.includes(element.schriftStaerke)) {
            verstoesse.push({
              regel: 'schriftstaerke',
              meldung: `Schnitt ${element.schriftStaerke} gibt es für "${schrift.familie}" nicht (verfügbar: ${schrift.staerken.join(', ')})`,
              schwere,
              seiteId,
              elementId: element.id,
            });
          }
          if (element.kursiv && !schrift.kursivVerfuegbar) {
            verstoesse.push({
              regel: 'schriftschnitt',
              meldung: `"${schrift.familie}" hat keinen Kursivschnitt — der Browser würde ihn künstlich neigen`,
              schwere,
              seiteId,
              elementId: element.id,
            });
          }
          if (schrift.lizenz !== 'ofl') {
            verstoesse.push({
              regel: 'schriftlizenz',
              meldung: `"${schrift.familie}" hat die Lizenz "${schrift.lizenz}" — Einbettung ins PDF vor dem Druck klären`,
              schwere: 'warnung',
              seiteId,
              elementId: element.id,
            });
          }
        }
        break;
      }

      case 'form': {
        if (element.fuellung !== null && !kennt(kit, element.fuellung)) {
          verstoesse.push({
            regel: 'farbe',
            meldung: `Füllfarbe ${element.fuellung} ist nicht im Markenkit`,
            schwere,
            seiteId,
            elementId: element.id,
          });
        }
        if (element.kontur !== null && !kennt(kit, element.kontur.farbe)) {
          verstoesse.push({
            regel: 'farbe',
            meldung: `Konturfarbe ${element.kontur.farbe} ist nicht im Markenkit`,
            schwere,
            seiteId,
            elementId: element.id,
          });
        }
        break;
      }

      case 'bild': {
        const logo = kit.logos.find((l) => l.asset.id === element.quelle.id);
        if (logo !== undefined) {
          const mindestbreite = (logo.mindestbreiteDruckPx * entwurf.masse.dpi) / 300;
          if (element.breite < mindestbreite) {
            verstoesse.push({
              regel: 'logo-schutzgroesse',
              meldung: `Logo "${logo.name}" ist ${element.breite.toFixed(0)} px breit, die Schutzgröße verlangt ${mindestbreite.toFixed(0)} px`,
              schwere,
              seiteId,
              elementId: element.id,
            });
          }
        }
        break;
      }

      case 'gruppe':
        break;
    }
  }

  return verstoesse;
}

export function nurFehler(verstoesse: readonly Markenverstoss[]): Markenverstoss[] {
  return verstoesse.filter((v) => v.schwere === 'fehler');
}
