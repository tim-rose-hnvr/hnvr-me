/* Legt die Werkbank in public/werkbank, damit sie mit der Seite ausgeliefert
   wird — auf demselben Wix-Hosting wie die Marketingseite.

   Warum kopiert und nicht doppelt im Repository: die Anwendung hat genau eine
   Quelle (../werkbank). Hier entsteht nur eine Arbeitskopie für den Bau;
   public/werkbank steht deshalb in .gitignore.

   Aufruf geschieht selbsttätig über "npm run build" (prebuild). */

import { cp, rm, mkdir, stat, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, '..', '..', 'werkbank');
const ZIEL = resolve(HIER, '..', 'public', 'werkbank');

/* Was nicht mit ausgeliefert wird: Prüfläufe und Hilfsskripte gehören zur
   Entwicklung, nicht auf den Server. */
const AUSSEN = new Set(['werkzeuge', 'node_modules', '.git']);

async function groesse(pfad) {
  let summe = 0;
  for (const eintrag of await readdir(pfad, { withFileTypes: true })) {
    const voll = join(pfad, eintrag.name);
    if (eintrag.isDirectory()) summe += await groesse(voll);
    else summe += (await stat(voll)).size;
  }
  return summe;
}

try {
  await stat(QUELLE);
} catch {
  console.error(`Die Werkbank liegt nicht unter ${QUELLE}. Ohne sie fehlt der Seite die Anwendung.`);
  process.exit(1);
}

await rm(ZIEL, { recursive: true, force: true });
await mkdir(dirname(ZIEL), { recursive: true });
await cp(QUELLE, ZIEL, {
  recursive: true,
  filter: (pfad) => !AUSSEN.has(pfad.split('/').pop()),
});

const bytes = await groesse(ZIEL);
console.log(`Werkbank eingebettet: ${(bytes / 1024 / 1024).toFixed(1)} MB nach public/werkbank`);
