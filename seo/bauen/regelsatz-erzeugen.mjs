/* Erzeugt den Regelsatz-Abschnitt von site/regelsatz.html aus dem Regelkatalog.
   Aufruf aus dem Projektordner:  node bauen/regelsatz-erzeugen.mjs

   Der Katalog ist die einzige Quelle. Wer eine Regel ergaenzt, aendert
   site/assets/js/regelkatalog.js und laesst danach dieses Skript laufen. */

import fs from "node:fs";
import path from "node:path";

const wurzel = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const katalogDatei = path.join(wurzel, "site", "assets", "js", "regelkatalog.js");
const zielDatei = path.join(wurzel, "site", "regelsatz.html");

// Der Katalog laeuft im Browser. Fuer das Auslesen der Metadaten genuegt
// ein Stummel von document; die pruefe-Funktionen werden nie aufgerufen.
globalThis.document = { createElement: () => ({ getContext: () => null }) };

const quelle = fs.readFileSync(katalogDatei, "utf8");
const katalog = new Function(quelle + "\nreturn SEORANK_KATALOG;")();

const STUFENKLASSE = { kritisch: "hoch", wichtig: "mittel", hinweis: "niedrig" };

// Reihenfolge der Gruppen ist die Reihenfolge im Katalog.
const gruppen = [];
for (const regel of katalog) {
  let g = gruppen.find((x) => x.name === regel.gruppe);
  if (!g) { g = { name: regel.gruppe, regeln: [] }; gruppen.push(g); }
  g.regeln.push(regel);
}

function pruefeText(text, wo) {
  const bareAmp = /&(?!(?:[a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)/.exec(text);
  if (bareAmp) console.warn("WARNUNG: einzelnes & in " + wo + " — bitte als &amp; schreiben.");
  return text;
}

const teile = [];
for (const g of gruppen) {
  teile.push('    <section class="regelgruppe">');
  teile.push('      <div class="regelgruppe__kopf">');
  teile.push('        <h2 class="regelgruppe__name">' + pruefeText(g.name, "Gruppenname") + "</h2>");
  teile.push('        <span class="label" data-gruppenzahl>' + g.regeln.length + " Regeln</span>");
  teile.push("      </div>");
  teile.push('      <ul class="regelliste">');

  for (const r of g.regeln) {
    pruefeText(r.name, r.id);
    pruefeText(r.wozu, r.id);
    teile.push('        <li class="regel" id="regel-' + r.id + '" data-stufe="' + r.stufe + '">');
    teile.push('          <span class="regel__name"><span class="marker marker--' + r.stufe + '"></span>' + r.name + "</span>");
    pruefeText(r.beheben || "", r.id + " (beheben)");
    teile.push('          <span class="regel__pruefung">' + r.wozu + (r.braucht ? ' <em class="regel__bedarf">Braucht ein vollständiges Dokument.</em>' : "") +
      (r.beheben ? '<span class="regel__beheben"><span class="regel__marke">Zu tun:</span> ' + r.beheben + "</span>" : "") + "</span>");
    teile.push('          <span class="regel__stufe stufe--' + STUFENKLASSE[r.stufe] + '">' + r.stufe + '<br><code>' + r.id + "</code>" +
      '<span class="regel__gewicht">' + (r.wirkung || "unbestimmt") + " · Gewicht " + (r.gewicht || 1) + "</span></span>");
    teile.push("        </li>");
  }

  teile.push("      </ul>");
  teile.push("    </section>");
}

const html = fs.readFileSync(zielDatei, "utf8");
const anfang = "<!-- REGELN:ANFANG -->";
const ende = "<!-- REGELN:ENDE -->";

if (!html.includes(anfang) || !html.includes(ende)) {
  console.error("FEHLER: Die Marken " + anfang + " und " + ende + " fehlen in regelsatz.html.");
  process.exit(1);
}

const vorn = html.slice(0, html.indexOf(anfang) + anfang.length);
const hinten = html.slice(html.indexOf(ende));
fs.writeFileSync(zielDatei, vorn + "\n" + teile.join("\n") + "\n    " + hinten, "utf8");

const stufen = { kritisch: 0, wichtig: 0, hinweis: 0 };
katalog.forEach((r) => stufen[r.stufe]++);

console.log("regelsatz.html neu erzeugt");
console.log("  Regeln:  " + katalog.length);
console.log("  Gruppen: " + gruppen.length);
console.log("  Stufen:  " + stufen.kritisch + " kritisch, " + stufen.wichtig + " wichtig, " + stufen.hinweis + " Hinweise");
console.log("  Braucht vollständiges Dokument: " + katalog.filter((r) => r.braucht).length);

const ohneBehebung = katalog.filter((r) => !r.beheben).map((r) => r.id);
if (ohneBehebung.length) {
  console.warn("WARNUNG: ohne Behebungsweg: " + ohneBehebung.join(", "));
}
const gewicht = katalog.reduce((s, r) => s + (r.gewicht || 1), 0);
console.log("  Gewicht insgesamt: " + gewicht + " Punkte");
const wirkungen = new Map();
katalog.forEach((r) => wirkungen.set(r.wirkung, (wirkungen.get(r.wirkung) || 0) + 1));
console.log("  Wirkungsbereiche: " + [...wirkungen.entries()].sort((a, b) => b[1] - a[1]).map(([n, z]) => n + " " + z).join(", "));
