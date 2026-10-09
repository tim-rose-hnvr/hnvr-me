/* seo-rank.me — das Gewichtsbild auf der Startseite erzeugen.

   Ein Quadrat je Gewichtspunkt des Katalogs. Die drei Gruppen kommen
   NICHT von Hand: das Gesamtgewicht steht im Regelkatalog, das
   verlorene Gewicht wird an der Beispielseite gemessen, und der Plan
   ist die Summe der fuenf schwersten Befunde. Wer den Katalog aendert
   oder die Beispielseite, laesst dieses Skript neu laufen.

   Aufruf:  node bauen/gewichtsbild-erzeugen.mjs
            node bauen/gewichtsbild-erzeugen.mjs --pruefen   (nur melden) */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { pruefeQuelltext } from "../cli/kern.mjs";

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.resolve(hier, "..");
const SEITE = path.join(wurzel, "site", "index.html");
const ANFANG = "<!-- GEWICHTSBILD:ANFANG -->";
const ENDE_MARKE = "<!-- GEWICHTSBILD:ENDE -->";
const nurPruefen = process.argv.includes("--pruefen");

/* Die Beispielseite liegt als Skript vor, damit Browser und
   Kommandozeile dieselbe Probe sehen. */
function beispielseite() {
  const quelle = fs.readFileSync(path.join(wurzel, "site", "assets", "js", "beispielseite.js"), "utf8");
  const kasten = { module: { exports: {} } };
  vm.createContext(kasten);
  vm.runInContext(quelle, kasten);
  return kasten.SEORANK_BEISPIEL;
}

const messung = pruefeQuelltext(beispielseite());
const moeglich = messung.punkte.moeglich;
const verloren = messung.punkte.verloren;

/* Der Plan: die fuenf schwersten Befunde. Genau diese Auswahl nennt
   die Startseite im Text. */
const gewichte = messung.befunde.map(b => b.gewicht || 0).sort((a, b) => b - a);
const plan = gewichte.slice(0, 5).reduce((s, g) => s + g, 0);
const gehalten = moeglich - verloren;
const verlorenOhnePlan = verloren - plan;

const punkt = art => '<span class="gewichtsbild__punkt' + (art ? " gewichtsbild__punkt--" + art : "") + '"></span>';
const teile = [];
for (let i = 0; i < gehalten; i++) teile.push(punkt(""));
for (let i = 0; i < verlorenOhnePlan; i++) teile.push(punkt("verloren"));
for (let i = 0; i < plan; i++) teile.push(punkt("plan"));

/* Zwoelf Quadrate je Zeile im Quelltext: sonst steht eine Zeile mit
   351 Elementen in der Datei und niemand kann sie mehr lesen. */
const zeilen = [];
for (let i = 0; i < teile.length; i += 12) zeilen.push(teile.slice(i, i + 12).join(""));
const html = fs.readFileSync(SEITE, "utf8");

/* Die Zeilenenden der Seite uebernehmen. Sie war erst gemischt, dann hat
   ein anderes Werkzeug sie auf CRLF gestellt, und der Erzeuger meldete eine
   Abweichung, die nur aus Zeilenenden bestand — wer daraufhin neu schrieb,
   haette eine Datei erzeugt, die nicht mehr mit der ausgelieferten
   uebereinstimmt. */
const umbruch = html.includes("\r\n") ? "\r\n" : "\n";
const block = ANFANG + umbruch + zeilen.join(umbruch) + umbruch + ENDE_MARKE;
const a = html.indexOf(ANFANG);
const b = html.indexOf(ENDE_MARKE);
if (a < 0 || b < 0) {
  console.error("Die Marken " + ANFANG + " und " + ENDE_MARKE + " fehlen in site/index.html.");
  process.exit(1);
}
const neu = html.slice(0, a) + block + html.slice(b + ENDE_MARKE.length);

console.log("Gesamtgewicht " + moeglich + " · verloren " + verloren + " · davon im Plan " + plan);
console.log("Punkte: " + gehalten + " gehalten, " + verlorenOhnePlan + " verloren, " + plan + " im Plan = " + teile.length);
console.log("Wert jetzt " + Math.round((1 - verloren / moeglich) * 100) + ", mit Plan " + Math.round((1 - (verloren - plan) / moeglich) * 100));

if (nurPruefen) {
  const gleich = neu === html;
  console.log(gleich ? "Das Gewichtsbild ist auf dem Stand." : "Das Gewichtsbild weicht ab — ohne --pruefen neu schreiben.");
  process.exit(gleich ? 0 : 1);
}
if (neu === html) {
  console.log("Unveraendert.");
} else {
  fs.writeFileSync(SEITE, neu);
  console.log("site/index.html neu geschrieben.");
}
