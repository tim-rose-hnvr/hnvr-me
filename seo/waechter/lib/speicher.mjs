/* SEO Waechter · Ablage als JSON-Dateien.
   Kein Datenbankserver: jede Datei wird ganz gelesen und atomar ersetzt
   (temporaere Datei, dann rename). Schreibzugriffe auf dieselbe Datei
   laufen nacheinander. */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
export const DATEN = process.env.WAECHTER_DATEN || path.resolve(hier, "..", "daten");

const ketten = new Map();

async function lesen(datei, leer) {
  try { return JSON.parse(await fs.readFile(datei, "utf8")); }
  catch (e) { if (e.code === "ENOENT") return structuredClone(leer); throw e; }
}

export async function holen(name, leer = {}) {
  return lesen(path.join(DATEN, name), leer);
}

/* aendern(name, leer, fn): fn bekommt den Stand, aendert ihn und gibt einen
   Rueckgabewert. Gespeichert wird der geaenderte Stand. */
export function aendern(name, leer, fn) {
  const datei = path.join(DATEN, name);
  const vorher = ketten.get(datei) || Promise.resolve();
  const lauf = vorher.then(async () => {
    const stand = await lesen(datei, leer);
    const wert = await fn(stand);
    await fs.mkdir(path.dirname(datei), { recursive: true });
    const tmp = datei + "." + process.pid + "." + Date.now() + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(stand));
    await fs.rename(tmp, datei);
    return wert;
  });
  ketten.set(datei, lauf.catch(() => {}));
  return lauf;
}

export async function loeschen(name) {
  try { await fs.unlink(path.join(DATEN, name)); } catch (e) { if (e.code !== "ENOENT") throw e; }
}
