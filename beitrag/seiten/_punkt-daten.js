/* Der einzige Ort, an dem die beiden neuen Seiten eure Datenhaltung
 * anfassen. Wenn etwas anzupassen ist, dann hier — die Seiten selbst
 * bleiben unberührt.
 *
 * Geschrieben gegen `@wix/data`, wie es ein Wix-Headless-Projekt
 * serverseitig benutzt. Falls euer Studio einen anderen Weg nimmt
 * (eigener Datenzugriff, Velo `wix-data`), ist es genau eine Zeile je
 * Funktion.
 */

import { items } from '@wix/data';

const SAMMLUNG = 'PK_Codes';

/**
 * Der Code zu einer GTIN. Genau einer — steht die GTIN mehrfach, gewinnt
 * der zuletzt geänderte, denn das ist der, den jemand zuletzt gemeint hat.
 *
 * Gesucht wird über beide Schreibweisen: eine GTIN steht mal mit 13, mal
 * mit 14 Stellen in der Zeile, je nachdem, wer sie eingetragen hat. Wer
 * nur nach einer sucht, findet die Hälfte nicht.
 */
export async function codeNachGTIN(gtin14) {
  const schreibweisen = [gtin14, gtin14.replace(/^0+/, '')];

  const { items: zeilen } = await items
    .query(SAMMLUNG)
    .hasSome('gtin', schreibweisen)
    .descending('geaendert')
    .limit(5)
    .find();

  return (zeilen || []).find((z) => z && z.geloescht !== true) || null;
}

/**
 * Alle Pässe zu einer GTIN, als Objekte. In `PK_Codes` liegt der Pass als
 * Text im Feld `passJson` — hier wird er einmal gelesen, damit die Seiten
 * sich nicht darum kümmern müssen.
 *
 * Eine kaputte Zeile bringt nicht die ganze Seite zu Fall: sie wird
 * übersprungen. Der Scan steht vor einem Regal, nicht vor einer Konsole.
 */
export async function paesseNachGTIN(gtin14) {
  const schreibweisen = [gtin14, gtin14.replace(/^0+/, '')];

  const { items: zeilen } = await items
    .query(SAMMLUNG)
    .hasSome('gtin', schreibweisen)
    .limit(50)
    .find();

  const aus = [];
  for (const z of zeilen || []) {
    if (!z?.passJson || z.geloescht === true) continue;
    try {
      const pass = JSON.parse(z.passJson);
      aus.push({ gtin: z.gtin, ...pass });
    } catch {
      // stillschweigend weiter — siehe oben
    }
  }
  return aus;
}

/** Das Erscheinungsbild zum aufgerufenen Hostnamen, für das White-Label. */
export async function markeNachHost(host) {
  try {
    const { items: zeilen } = await items
      .query('PK_Domains')
      .eq('host', String(host || '').toLowerCase().split(':')[0])
      .limit(1)
      .find();
    if (zeilen?.[0]) return zeilen[0];
  } catch {
    // Ohne Sammlung oder ohne Treffer gilt das Haus-Erscheinungsbild.
  }
  return { name: 'PUNKT', primaer: '#d1006f', grund: '#EBEEEE', tinte: '#141018' };
}
