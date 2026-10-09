/* seo-rank.me — ein auslieferungsfertiges Paket aus site/ schnueren.

   Die Website ist rein statisch: HTML, CSS, JS, Schriften, ein Bild.
   Sie braucht keinen Server und keinen Build. Dieses Skript legt eine
   Kopie ohne Werkzeugreste an und packt sie.

   Was NICHT mitgeht: alles, was mit einem Punkt beginnt (Cache von
   Werkzeugen), und alles, was mit einem Unterstrich beginnt
   (Hilfsdateien beim Messen).

   Aufruf:  node bauen/paket-schnueren.mjs [zielordner] */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(hier, "..");
const QUELLE = path.join(WURZEL, "site");
const ZIEL = path.resolve(process.argv[2] || path.join(WURZEL, "paket"));

function kopiere(von, nach) {
  let dateien = 0, bytes = 0;
  fs.mkdirSync(nach, { recursive: true });
  for (const name of fs.readdirSync(von)) {
    if (name.startsWith(".") || name.startsWith("_")) continue;
    const q = path.join(von, name), z = path.join(nach, name);
    const art = fs.statSync(q);
    if (art.isDirectory()) {
      const r = kopiere(q, z);
      dateien += r.dateien; bytes += r.bytes;
    } else {
      fs.copyFileSync(q, z);
      dateien++; bytes += art.size;
    }
  }
  return { dateien, bytes };
}

/* Vor dem Schnueren die Sitemap neu erzeugen: adresse-setzen.mjs schreibt
   alle Seiten neu, und lastmod kommt aus dem Aenderungsdatum. Ohne diesen
   Schritt wuerde eine veraltete Karte ausgeliefert. */
await import("./sitemap-erzeugen.mjs");

if (fs.existsSync(ZIEL)) fs.rmSync(ZIEL, { recursive: true });
const bilanz = kopiere(QUELLE, ZIEL);

const seiten = fs.readdirSync(ZIEL).filter((n) => n.endsWith(".html")).length;
console.log("Paket in " + ZIEL);
console.log(bilanz.dateien + " Dateien, " + (bilanz.bytes / 1024).toFixed(0) + " KB, davon " + seiten + " Seiten.");

const merker = path.join(hier, "adresse.txt");
const basis = fs.existsSync(merker) ? fs.readFileSync(merker, "utf8").trim() : "https://seo-rank.me";
console.log("Basisadresse im Paket: " + basis);
if (basis === "https://seo-rank.me") {
  console.log("ACHTUNG: das ist der Platzhalter. Vor dem Ausliefern setzen:");
  console.log("  node bauen/adresse-setzen.mjs https://ihre-adresse.example");
}
