/* seo-rank.me — Kern der Kommandozeile.
   Laedt den Regelkatalog der Website und wendet ihn auf Quelltext an.
   Derselbe Katalog, dieselben Regeln, dieselben Ergebnisse wie im Browser. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "./dom.mjs";

const hier = path.dirname(fileURLToPath(import.meta.url));
export const WURZEL = path.resolve(hier, "..");

let werkzeugZwischenspeicher = null;

/* Katalog und Analyse werden in EINEM Geltungsbereich ausgewertet, damit die
   Analyse dieselben Messroutinen benutzt wie die Regeln. Zwei Fassungen
   derselben Rechnung waeren zwei Wahrheiten. */
export function werkzeugeLaden() {
  if (werkzeugZwischenspeicher) return werkzeugZwischenspeicher;
  const js = (name) => fs.readFileSync(path.join(WURZEL, "site", "assets", "js", name), "utf8");
  werkzeugZwischenspeicher = new Function(
    js("regelkatalog.js") + "\n" + js("analyse.js") +
    "\nreturn { katalog: SEORANK_KATALOG, messen: SEORANK_MESSEN, analyse: SEORANK_ANALYSE };"
  )();
  return werkzeugZwischenspeicher;
}

export function katalogLaden() { return werkzeugeLaden().katalog; }
export function analyseLaden() { return werkzeugeLaden().analyse; }
export function messenLaden() { return werkzeugeLaden().messen; }

export const RANG = { kritisch: 0, wichtig: 1, hinweis: 2 };

/* Wendet den Katalog auf einen Quelltext an.
   auswahl: { nur: Set|null, ohne: Set|null } */
export function pruefeQuelltext(roh, auswahl = {}) {
  const katalog = katalogLaden();
  const vollstaendig = /<html[\s>]/i.test(roh);
  const dokument = parseHTML(roh);

  const befunde = [];
  const bestanden = [];
  let uebersprungen = 0;
  let geprueft = 0;

  for (const regel of katalog) {
    if (auswahl.nur && !auswahl.nur.has(regel.id)) continue;
    if (auswahl.ohne && auswahl.ohne.has(regel.id)) continue;
    if (regel.braucht && !vollstaendig) { uebersprungen++; continue; }

    geprueft++;
    let treffer;
    try {
      treffer = regel.pruefe(dokument, roh);
    } catch (fehler) {
      treffer = { wie: "Diese Regel konnte nicht ausgeführt werden: " + fehler.message };
    }

    if (treffer) {
      befunde.push({
        id: regel.id, gruppe: regel.gruppe, name: regel.name,
        stufe: regel.stufe, wie: treffer.wie, fund: treffer.fund || null,
        beheben: regel.beheben || null, wirkung: regel.wirkung || null,
        gewicht: regel.gewicht || 1
      });
    } else {
      bestanden.push(regel.id);
    }
  }

  const rangGruppe = new Map();
  katalog.forEach((r, i) => { if (!rangGruppe.has(r.gruppe)) rangGruppe.set(r.gruppe, i); });
  befunde.sort((a, b) =>
    a.gruppe !== b.gruppe
      ? rangGruppe.get(a.gruppe) - rangGruppe.get(b.gruppe)
      : RANG[a.stufe] - RANG[b.stufe]);

  /* Regeln, die nur mit vollstaendigem Dokument laufen, duerfen die
     Punktzahl nicht druecken, wenn nur ein Ausschnitt vorlag. */
  const uebersprungeneIds = {};
  for (const regel of katalog) {
    if (auswahl.nur && !auswahl.nur.has(regel.id)) uebersprungeneIds[regel.id] = true;
    else if (auswahl.ohne && auswahl.ohne.has(regel.id)) uebersprungeneIds[regel.id] = true;
    else if (regel.braucht && !vollstaendig) uebersprungeneIds[regel.id] = true;
  }
  const punkte = analyseLaden().punktzahl(katalog, befunde, uebersprungeneIds);

  return {
    vollstaendig, geprueft, uebersprungen,
    punkte,
    bestanden: bestanden.length,
    kritisch: befunde.filter((b) => b.stufe === "kritisch").length,
    wichtig: befunde.filter((b) => b.stufe === "wichtig").length,
    hinweise: befunde.filter((b) => b.stufe === "hinweis").length,
    befunde,
    dokument
  };
}

/* ---------- Ausgabe ---------- */

/* Die Behebungstexte enthalten <code> fuer die Website. Auf der
   Kommandozeile stoert das nur. */
export function ohneMarkup(text) {
  return String(text)
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

const FARBEN = {
  aus: "[0m", fett: "[1m", matt: "[2m",
  rot: "[31m", gruen: "[32m", gelb: "[33m", blau: "[36m"
};

export function farbig(an) {
  if (an) return FARBEN;
  const leer = {};
  for (const k of Object.keys(FARBEN)) leer[k] = "";
  return leer;
}

export function alsText(ergebnisse, einstellungen = {}) {
  const f = farbig(einstellungen.farbe !== false);
  const zeilen = [];
  const stufenfarbe = { kritisch: f.rot, wichtig: f.gelb, hinweis: f.matt };

  for (const e of ergebnisse) {
    zeilen.push("");
    zeilen.push(f.fett + e.quelle + f.aus);

    if (e.fehler) {
      zeilen.push("  " + f.rot + "nicht prüfbar: " + e.fehler + f.aus);
      continue;
    }

    const kopf = [
      (e.kritisch ? f.rot : f.matt) + e.kritisch + " kritisch" + f.aus,
      (e.wichtig ? f.gelb : f.matt) + e.wichtig + " wichtig" + f.aus,
      f.matt + e.hinweise + " Hinweise" + f.aus,
      f.gruen + e.bestanden + " bestanden" + f.aus
    ].join(f.matt + " · " + f.aus);
    zeilen.push("  " + kopf + f.matt + "   (" + e.geprueft + " Regeln" +
      (e.uebersprungen ? ", " + e.uebersprungen + " übersprungen" : "") + ")" + f.aus);

    if (e.punkte) {
      const wert = e.punkte.gesamt;
      const farbe = wert >= 90 ? f.gruen : (wert >= 70 ? f.gelb : f.rot);
      zeilen.push("  " + farbe + wert + " von 100" + f.aus + f.matt +
        "   (" + e.punkte.verloren + " von " + e.punkte.moeglich + " Gewichtspunkten verloren)" + f.aus);

      if (einstellungen.ausfuehrlich) {
        const schwach = e.punkte.gruppen.slice().sort((a, b) => a.wert - b.wert).filter((g) => g.wert < 100);
        for (const g of schwach) {
          zeilen.push("    " + f.matt + String(g.wert).padStart(3) + "  " + g.name +
            "  (" + g.befunde + " von " + g.regeln + " Regeln)" + f.aus);
        }
      }
    }

    let gruppe = null;
    for (const b of e.befunde) {
      if (b.gruppe !== gruppe) {
        gruppe = b.gruppe;
        zeilen.push("  " + f.blau + gruppe + f.aus);
      }
      zeilen.push("    " + stufenfarbe[b.stufe] + b.stufe.padEnd(10) + f.aus +
        b.name + f.matt + "  " + b.id + f.aus);
      zeilen.push("      " + f.matt + b.wie + f.aus);
      if (b.fund && einstellungen.ausfuehrlich) {
        for (const z of String(b.fund).split("\n")) zeilen.push("        " + f.matt + z + f.aus);
      }
      if (b.beheben && einstellungen.ausfuehrlich) {
        zeilen.push("      " + f.blau + "zu tun: " + f.aus + f.matt + ohneMarkup(b.beheben) + f.aus);
      }
    }
  }

  return zeilen.join("\n");
}

export function alsJSON(ergebnisse) {
  return JSON.stringify({
    werkzeug: "seo-rank.me",
    regelnGesamt: katalogLaden().length,
    seiten: ergebnisse.map((e) => ({
      quelle: e.quelle,
      fehler: e.fehler || null,
      geprueft: e.geprueft || 0,
      uebersprungen: e.uebersprungen || 0,
      bestanden: e.bestanden || 0,
      kritisch: e.kritisch || 0,
      wichtig: e.wichtig || 0,
      hinweise: e.hinweise || 0,
      punkte: e.punkte || null,
      profil: e.profil || null,
      befunde: e.befunde || []
    }))
  }, null, 2);
}

function xmlSchutz(text) {
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/* JUnit-XML, damit CI-Systeme die Befunde als Testfaelle anzeigen. */
export function alsJUnit(ergebnisse, schwelle) {
  const grenze = RANG[schwelle] ?? RANG.wichtig;
  const zeilen = ['<?xml version="1.0" encoding="UTF-8"?>', "<testsuites>"];

  for (const e of ergebnisse) {
    const befunde = e.befunde || [];
    const fehlgeschlagen = befunde.filter((b) => RANG[b.stufe] <= grenze);
    zeilen.push('  <testsuite name="' + xmlSchutz(e.quelle) + '" tests="' +
      ((e.geprueft || 0)) + '" failures="' + fehlgeschlagen.length + '">');

    if (e.fehler) {
      zeilen.push('    <testcase name="laden"><failure message="' + xmlSchutz(e.fehler) + '"/></testcase>');
    }

    for (const b of befunde) {
      const name = xmlSchutz(b.id + ": " + b.name);
      if (RANG[b.stufe] <= grenze) {
        zeilen.push('    <testcase classname="' + xmlSchutz(b.gruppe) + '" name="' + name + '">');
        zeilen.push('      <failure type="' + b.stufe + '" message="' + xmlSchutz(b.wie) + '">' +
          xmlSchutz(b.fund || "") + "</failure>");
        zeilen.push("    </testcase>");
      } else {
        zeilen.push('    <testcase classname="' + xmlSchutz(b.gruppe) + '" name="' + name + '">');
        zeilen.push('      <skipped message="' + xmlSchutz(b.wie) + '"/>');
        zeilen.push("    </testcase>");
      }
    }

    zeilen.push("  </testsuite>");
  }

  zeilen.push("</testsuites>");
  return zeilen.join("\n");
}

/* Zusammenfassung fuer die letzte Zeile und den Rueckgabewert. */
export function bilanz(ergebnisse, schwelle) {
  const grenze = RANG[schwelle] ?? RANG.wichtig;
  let kritisch = 0, wichtig = 0, hinweise = 0, ausloeser = 0, fehler = 0;

  for (const e of ergebnisse) {
    if (e.fehler) { fehler++; continue; }
    kritisch += e.kritisch;
    wichtig += e.wichtig;
    hinweise += e.hinweise;
    ausloeser += e.befunde.filter((b) => RANG[b.stufe] <= grenze).length;
  }

  return { seiten: ergebnisse.length, kritisch, wichtig, hinweise, ausloeser, fehler };
}
