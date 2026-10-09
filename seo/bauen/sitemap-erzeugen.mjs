/* seo-rank.me — die Sitemap aus den tatsaechlichen Seiten erzeugen.

   Bis zum 25.09.2026 war sie von Hand gepflegt, und das ging zweimal
   schief: zwei Seiten mit noindex (Impressum, Datenschutz) standen darin
   — Google meldet so etwas als „uebermittelte URL als noindex
   gekennzeichnet" —, und jedes lastmod stand noch im August, obwohl alle
   Seiten im September geaendert wurden.

   Jetzt gilt: in die Sitemap kommt jede Seite ohne noindex, und lastmod
   ist das Aenderungsdatum der Datei. Reihenfolge, changefreq und priority
   stehen unten in einer Tabelle; eine neue Seite ohne Eintrag landet
   hinten mit monthly / 0.5.

   Die Basisadresse kommt aus bauen/adresse.txt (siehe adresse-setzen.mjs).
   Die Datei heisst sitemap-seiten.xml, weil Wix den Namen sitemap.xml
   sperrt.

   Aufruf:  node bauen/sitemap-erzeugen.mjs
            node bauen/sitemap-erzeugen.mjs --zeigen   (nur ausgeben) */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const ORDNER = path.join(path.resolve(hier, ".."), "site");
const ZIEL = path.join(ORDNER, "sitemap-seiten.xml");
const MERKER = path.join(hier, "adresse.txt");
const BASIS = (fs.existsSync(MERKER) ? fs.readFileSync(MERKER, "utf8").trim() : "https://seo-rank.me").replace(/\/$/, "");

const ORDNUNG = [
  ["index.html", "weekly", "1.0"],
  ["pruefer.html", "monthly", "0.9"],
  ["werkbank.html", "monthly", "0.9"],
  ["snippet.html", "monthly", "0.8"],
  ["robots.html", "monthly", "0.8"],
  ["sitemap.html", "monthly", "0.8"],
  ["strukturdaten.html", "monthly", "0.8"],
  ["hreflang.html", "monthly", "0.8"],
  ["stichwort.html", "monthly", "0.8"],
  ["wdf.html", "monthly", "0.8"],
  ["tempo.html", "monthly", "0.8"],
  ["weiterleitung.html", "monthly", "0.8"],
  ["domain.html", "monthly", "0.8"],
  ["kommandozeile.html", "monthly", "0.8"],
  ["werkzeuge.html", "monthly", "0.7"],
  ["regelsatz.html", "monthly", "0.7"],
  ["kostenlos.html", "monthly", "0.6"],
];

export function gesperrt(html) {
  const m = html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i);
  return !!(m && /noindex/i.test(m[1]));
}

const seiten = fs.readdirSync(ORDNER).filter((n) => n.endsWith(".html") && !n.startsWith("_"));
const offen = seiten.filter((n) => !gesperrt(fs.readFileSync(path.join(ORDNER, n), "utf8")));
const ausgelassen = seiten.filter((n) => !offen.includes(n));

const rang = new Map(ORDNUNG.map((z, i) => [z[0], i]));
offen.sort((a, b) => (rang.has(a) ? rang.get(a) : 999) - (rang.has(b) ? rang.get(b) : 999) || a.localeCompare(b));

const datum = (n) => fs.statSync(path.join(ORDNER, n)).mtime.toISOString().slice(0, 10);
const eintrag = (n) => {
  const z = ORDNUNG.find((o) => o[0] === n) || [n, "monthly", "0.5"];
  const adresse = BASIS + "/" + (n === "index.html" ? "" : n);
  return "  <url>\n    <loc>" + adresse + "</loc>\n    <lastmod>" + datum(n) + "</lastmod>\n"
    + "    <changefreq>" + z[1] + "</changefreq>\n    <priority>" + z[2] + "</priority>\n  </url>";
};

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + offen.map(eintrag).join("\n") + "\n</urlset>\n";

if (process.argv.includes("--zeigen")) {
  process.stdout.write(xml);
  process.exit(0);
}
fs.writeFileSync(ZIEL, xml);
console.log("sitemap-seiten.xml: " + offen.length + " Seiten, ausgelassen wegen noindex: " + (ausgelassen.join(", ") || "keine"));
