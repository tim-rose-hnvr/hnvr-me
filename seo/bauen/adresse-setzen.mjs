/* seo-rank.me — die Basisadresse der Website setzen.

   `seo-rank.me` ist ein Platzhalter. Er steht in canonical, den
   og-Angaben, im JSON-LD, in robots.txt und in sitemap-seiten.xml — an 162
   Stellen. Wer die Seiten woanders ausliefert, muss ALLE mitziehen,
   sonst zeigen die kanonischen Adressen auf eine fremde Domain und der
   eigene Katalog meldet es zu Recht.

   Aufruf:  node bauen/adresse-setzen.mjs https://beispiel.example
            node bauen/adresse-setzen.mjs --zeigen        (nur nachsehen) */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const ORDNER = path.join(path.resolve(hier, ".."), "site");
const MERKER = path.join(hier, "adresse.txt");

function dateien() {
  const raus = [];
  for (const name of fs.readdirSync(ORDNER)) {
    if (/\.(html|xml|txt)$/.test(name)) raus.push(path.join(ORDNER, name));
  }
  return raus;
}

const jetzt = fs.existsSync(MERKER) ? fs.readFileSync(MERKER, "utf8").trim() : "https://seo-rank.me";
const ziel = process.argv[2];

if (!ziel || ziel === "--zeigen") {
  let treffer = 0;
  for (const d of dateien()) treffer += (fs.readFileSync(d, "utf8").split(jetzt).length - 1);
  console.log("Basisadresse: " + jetzt);
  console.log("Vorkommen in site/: " + treffer);
  if (!ziel) console.log("\nZum Ändern:  node bauen/adresse-setzen.mjs https://neue-adresse.example");
  process.exit(0);
}

if (!/^https?:\/\/[^\/\s]+$/.test(ziel)) {
  console.error("Die Adresse muss mit http:// oder https:// beginnen und ohne Schrägstrich enden.");
  process.exit(1);
}

let geaendert = 0, stellen = 0;
for (const d of dateien()) {
  const alt = fs.readFileSync(d, "utf8");
  const zahl = alt.split(jetzt).length - 1;
  if (!zahl) continue;
  fs.writeFileSync(d, alt.split(jetzt).join(ziel));
  geaendert++; stellen += zahl;
}
fs.writeFileSync(MERKER, ziel + "\n");
console.log(jetzt + "  →  " + ziel);
console.log(geaendert + " Datei(en), " + stellen + " Stellen.");
console.log("Jetzt nachmessen:  node cli/seorank.mjs pruefen \"site/*.html\"");
