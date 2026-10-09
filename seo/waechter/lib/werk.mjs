/* SEO Waechter · Anbindung an das Pruefwerk von seo-rank.me.
   Es gibt EINEN Regelkatalog (site/assets/js/regelkatalog.js). Der Waechter
   liest ihn ueber dieselben Wege wie Kommandozeile und Browser, statt eine
   eigene Fassung zu fuehren. */

import fs from "node:fs";
import path from "node:path";
import {
  pruefeQuelltext, analyseLaden, katalogLaden, messenLaden, WURZEL
} from "../../cli/kern.mjs";
import { crawlen, crawlBefunde } from "../../cli/crawler.mjs";
import { domainSammeln } from "../../cli/domain.mjs";

const js = (name) => fs.readFileSync(path.join(WURZEL, "site", "assets", "js", name), "utf8");

export const DOMAINREGELN = new Function(js("domainregeln.js") + "\nreturn SEORANK_DOMAIN;")();

export const PRUEFWERK = new Function(
  js("robotsregeln.js") + "\n" + js("pruefwerk.js") +
  "\nreturn { robots: SEORANK_ROBOTS, werk: SEORANK_PRUEFWERK };"
)();

export const KENNUNG = "Mozilla/5.0 (compatible; SEO-Waechter/1.0; +https://hnvr.me)";

export {
  pruefeQuelltext, analyseLaden, katalogLaden, messenLaden,
  crawlen, crawlBefunde, domainSammeln
};
