/**
 * Prüfung einer Aussage beim Laden.
 *
 * Die Aussage ist das Produkt — sie überlebt jeden einzelnen Entwurf und wird
 * über Jahre gepflegt. Genau deshalb braucht sie dieselbe Strenge beim Laden
 * wie der Entwurf: was aus dem Speicher kommt, ist unbekanntes Gelände.
 *
 * ## Zwei Regeln, die hier fachlich sind, nicht technisch
 *
 * 1. **`lang` ist Pflicht, `mittel` und `kurz` sind Angebote.** Ohne die lange
 *    Fassung gäbe es nichts auszuspielen. Ein Feld ohne `lang` ist kein
 *    knappes Feld, sondern ein kaputtes.
 * 2. **Kürzere Stufen müssen kürzer sein.** Ein `kurz`, das länger ist als
 *    `lang`, macht die Stufenwahl unsinnig: die Auflösung nimmt die erste
 *    passende von oben und käme nie zur längeren unteren. Das wird gemeldet,
 *    aber nicht repariert — welche der beiden Fassungen gemeint war, weiß nur
 *    der Mensch.
 */

import { Pruefer, SchemaFehler } from '../modell/pruefer.js';
import { type Aussage, FELDSCHLUESSEL, type Feldschluessel, type Feldwert } from './aussage.js';

export const AUSSAGE_SCHEMA_VERSION = 1;

function pruefeFeldwert(p: Pruefer, roh: unknown, pfad: string): Feldwert {
  const o = p.objekt(roh, pfad);

  const lang = p.text(o['lang'], `${pfad}.lang`, { nichtLeer: true });
  const mittel =
    o['mittel'] === undefined || o['mittel'] === null
      ? null
      : p.text(o['mittel'], `${pfad}.mittel`, { nichtLeer: true });
  const kurz =
    o['kurz'] === undefined || o['kurz'] === null
      ? null
      : p.text(o['kurz'], `${pfad}.kurz`, { nichtLeer: true });

  // Reihenfolge prüfen: eine „kürzere" Stufe, die länger ist, hebelt die
  // Stufenwahl aus — sie wird dann nie erreicht.
  if (mittel !== null && lang !== '' && mittel.length > lang.length) {
    p.melde(
      `${pfad}.mittel`,
      `ist länger als „lang" (${mittel.length} statt ${lang.length} Zeichen)`,
    );
  }
  if (kurz !== null && mittel !== null && kurz.length > mittel.length) {
    p.melde(
      `${pfad}.kurz`,
      `ist länger als „mittel" (${kurz.length} statt ${mittel.length} Zeichen)`,
    );
  }
  if (kurz !== null && mittel === null && lang !== '' && kurz.length > lang.length) {
    p.melde(`${pfad}.kurz`, `ist länger als „lang" (${kurz.length} statt ${lang.length} Zeichen)`);
  }

  return { lang, mittel, kurz };
}

/**
 * Prüft eine rohe Aussage und gibt sie normalisiert zurück.
 * Wirft `SchemaFehler` mit allen Verstößen auf einmal.
 */
export function pruefeAussage(roh: unknown): Aussage {
  const p = new Pruefer();
  const o = p.objekt(roh, 'aussage');

  const felder: Partial<Record<Feldschluessel, Feldwert>> = {};
  const rohFelder = p.objekt(o['felder'], 'aussage.felder');
  for (const [schluessel, wert] of Object.entries(rohFelder)) {
    if (!(FELDSCHLUESSEL as readonly string[]).includes(schluessel)) {
      // Unbekannte Felder werden gemeldet und verworfen, nicht durchgereicht.
      // Die Feldliste ist bewusst geschlossen: ein Freitextzoo nimmt der
      // Ausspielung jede Chance, den Inhalt zu verstehen.
      p.melde(
        `aussage.felder.${schluessel}`,
        `ist kein bekanntes Feld — erlaubt sind [${FELDSCHLUESSEL.join(', ')}]`,
      );
      continue;
    }
    felder[schluessel as Feldschluessel] = pruefeFeldwert(p, wert, `aussage.felder.${schluessel}`);
  }

  const rohTermin = o['termin'];
  const termin =
    rohTermin === undefined || rohTermin === null ? null : p.zeitpunkt(rohTermin, 'aussage.termin');

  const aussage: Aussage = {
    id: p.text(o['id'], 'aussage.id', { nichtLeer: true }),
    organisationId: p.text(o['organisationId'], 'aussage.organisationId', { nichtLeer: true }),
    name: p.text(o['name'], 'aussage.name', { nichtLeer: true }),
    felder,
    termin,
    erstelltAm: p.zeitpunkt(o['erstelltAm'], 'aussage.erstelltAm'),
    geaendertAm: p.zeitpunkt(o['geaendertAm'], 'aussage.geaendertAm'),
  };

  if (Object.keys(felder).length === 0 && termin === null) {
    p.melde('aussage', 'hat weder ein Feld noch einen Termin — es gibt nichts auszuspielen');
  }

  if (p.verstoesse.length > 0) throw new SchemaFehler(p.verstoesse, 'Aussage');
  return aussage;
}

/**
 * Hebt eine ältere Fassung auf den heutigen Stand.
 *
 * Noch gibt es nur Fassung 1 — die Funktion steht trotzdem, weil eine
 * Migration, die erst beim ersten Bruch erfunden wird, immer zu spät kommt:
 * dann liegen die alten Daten schon beim Kunden.
 */
export function migriereAussage(roh: unknown): unknown {
  if (typeof roh !== 'object' || roh === null) return roh;
  const o = { ...(roh as Record<string, unknown>) };
  const fassung =
    typeof o['schemaVersion'] === 'number' ? o['schemaVersion'] : AUSSAGE_SCHEMA_VERSION;
  if (fassung > AUSSAGE_SCHEMA_VERSION) {
    throw new SchemaFehler(
      [
        {
          pfad: 'aussage.schemaVersion',
          meldung: `stammt aus Fassung ${fassung}, dieses Programm kennt nur ${AUSSAGE_SCHEMA_VERSION}`,
        },
      ],
      'Aussage',
    );
  }
  return o;
}

export function ladeAussage(roh: unknown): Aussage {
  return pruefeAussage(migriereAussage(roh));
}
