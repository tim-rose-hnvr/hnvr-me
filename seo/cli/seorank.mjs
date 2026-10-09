#!/usr/bin/env node
/* seo-rank.me — Kommandozeile.
   Prueft Quelltext gegen denselben Regelkatalog wie die Website und
   crawlt auf Wunsch eine ganze Domain. Ohne Fremdpakete.

   Rueckgabewert: 0 sauber, 1 Befunde ab der gesetzten Stufe, 2 Fehler. */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  katalogLaden, analyseLaden, pruefeQuelltext, alsText, alsJSON, alsJUnit,
  bilanz, farbig, ohneMarkup, RANG, WURZEL
} from "./kern.mjs";
import { crawlen, crawlBefunde } from "./crawler.mjs";

const HILFE = `seo-rank.me — SEO-Pruefung fuer die Kommandozeile

  seo-rank pruefen <datei|adresse> ...   Seiten gegen den Regelkatalog pruefen
  seo-rank crawl <adresse>               Eine Domain crawlen und alles pruefen
  seo-rank domain <domain> ...           Die Domain selbst pruefen: DNS,
                                         Zertifikat, Weiterleitungen,
                                         Kopfzeilen, Standarddateien
  seo-rank regeln [suchwort]             Den Regelkatalog auflisten
  seo-rank analyse <datei|adresse>       Dokumentprofil, Gliederung, Wortfeld
  seo-rank hilfe                         Diese Uebersicht

Gemeinsame Schalter
  --format text|json|junit   Ausgabeform, Standard text
  --stufe <stufe>            Ab welcher Stufe der Rueckgabewert 1 wird:
                             kritisch, wichtig (Standard) oder hinweis
  --nur <id,id>              Nur diese Regeln pruefen
  --ohne <id,id>             Diese Regeln auslassen
  --ausfuehrlich             Die gefundenen Stellen mit ausgeben
  --ohne-farbe               Keine Steuerzeichen in der Ausgabe
  --aus <datei>              Ausgabe in eine Datei schreiben

Nur beim Crawl
  --max <zahl>               Hoechstzahl der Seiten, Standard 200
  --tiefe <zahl>             Hoechste Klicktiefe, Standard 5
  --verzoegerung <ms>        Pause zwischen den Abrufen, Standard 250
  --ohne-robots              robots.txt nicht beachten (nur fuer eigene Server)

Nur beim Domain-Check
  --ohne-rdap                Die Registrierungsdaten nicht abrufen

Beispiele
  seo-rank pruefen site/index.html
  seo-rank pruefen "site/*.html" --stufe kritisch
  seo-rank pruefen https://beispiel-domain.de/ --ausfuehrlich
  seo-rank crawl https://beispiel-domain.de/ --max 500 --format json --aus bericht.json
  seo-rank analyse site/index.html
  seo-rank domain beispiel-domain.de --ausfuehrlich
  seo-rank domain beispiel-domain.de --format json --aus domain.json
`;

/* ---------- Schalter lesen ---------- */

let domainWerkzeug = null;

/* Der Domain-Check wird erst geladen, wenn er gebraucht wird: er zieht
   node:dns und node:tls nach, und wer nur eine Datei prueft, braucht das
   nicht. Geurteilt wird mit demselben Regelsatz wie im Browser. */
async function domainWerkzeugeLaden() {
  if (domainWerkzeug) return domainWerkzeug;
  const { domainSammeln } = await import("./domain.mjs");
  const quelle = fs.readFileSync(
    path.join(WURZEL, "site", "assets", "js", "domainregeln.js"), "utf8");
  const regeln = new Function(quelle + "\nreturn SEORANK_DOMAIN;")();
  domainWerkzeug = { sammeln: domainSammeln, regeln };
  return domainWerkzeug;
}

function argumenteLesen(argv) {
  const werte = {
    format: "text", stufe: "wichtig", nur: null, ohne: null,
    ausfuehrlich: false, farbe: true, aus: null,
    max: 200, tiefe: 5, verzoegerung: 250, robots: true
  };
  const frei = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--format": werte.format = argv[++i]; break;
      case "--stufe": werte.stufe = argv[++i]; break;
      case "--nur": werte.nur = new Set(String(argv[++i]).split(",").map((s) => s.trim()).filter(Boolean)); break;
      case "--ohne": werte.ohne = new Set(String(argv[++i]).split(",").map((s) => s.trim()).filter(Boolean)); break;
      case "--ausfuehrlich": werte.ausfuehrlich = true; break;
      case "--ohne-farbe": werte.farbe = false; break;
      case "--aus": werte.aus = argv[++i]; break;
      case "--max": werte.max = parseInt(argv[++i], 10); break;
      case "--tiefe": werte.tiefe = parseInt(argv[++i], 10); break;
      case "--verzoegerung": werte.verzoegerung = parseInt(argv[++i], 10); break;
      case "--ohne-robots": werte.robots = false; break;
      case "--ohne-rdap": werte.ohneRdap = true; break;
      default:
        if (a.startsWith("--")) { console.error("Unbekannter Schalter: " + a); process.exit(2); }
        frei.push(a);
    }
  }

  if (!["text", "json", "junit"].includes(werte.format)) {
    console.error("Unbekannte Ausgabeform: " + werte.format);
    process.exit(2);
  }
  if (!(werte.stufe in RANG)) {
    console.error("Unbekannte Stufe: " + werte.stufe);
    process.exit(2);
  }

  return { werte, frei };
}

/* ---------- Quellen einsammeln ---------- */

function musterAufloesen(muster) {
  // Sehr einfache Auswertung von * innerhalb eines Ordners, damit die
  // Kommandozeile unter Windows ohne Shell-Erweiterung funktioniert.
  if (!muster.includes("*")) return [muster];
  const ordner = path.dirname(muster);
  const teil = path.basename(muster);
  const regel = new RegExp("^" + teil.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
  if (!fs.existsSync(ordner)) return [];
  return fs.readdirSync(ordner).filter((d) => regel.test(d)).map((d) => path.join(ordner, d)).sort();
}

async function quelleLaden(quelle) {
  if (/^https?:\/\//i.test(quelle)) {
    const antwort = await fetch(quelle, {
      redirect: "follow",
      headers: { "user-agent": "seo-rank.me/1.0 (+Pruefwerkzeug; ein Abruf je Adresse)" }
    });
    if (!antwort.ok) throw new Error("HTTP " + antwort.status + " " + antwort.statusText);
    return await antwort.text();
  }
  return fs.readFileSync(quelle, "utf8");
}

/* ---------- Befehle ---------- */

async function befehlPruefen(frei, werte) {
  const quellen = [];
  for (const eintrag of frei) {
    if (/^https?:\/\//i.test(eintrag)) quellen.push(eintrag);
    else quellen.push(...musterAufloesen(eintrag));
  }

  if (!quellen.length) {
    console.error("Keine Datei und keine Adresse angegeben.");
    process.exit(2);
  }

  const ergebnisse = [];
  for (const quelle of quellen) {
    try {
      const roh = await quelleLaden(quelle);
      const e = pruefeQuelltext(roh, { nur: werte.nur, ohne: werte.ohne });
      delete e.dokument;
      ergebnisse.push({ quelle, ...e });
    } catch (fehler) {
      ergebnisse.push({ quelle, fehler: fehler.message, befunde: [] });
    }
  }

  return ergebnisse;
}

/* Das Dokumentprofil im Klartext. Keine Bewertung, nur Messwerte:
   wer wissen will, warum eine Punktzahl so ausfaellt, sieht hier die Zahlen,
   auf denen sie steht. */
async function befehlAnalyse(frei, werte) {
  if (!frei.length) {
    console.error("Keine Datei und keine Adresse angegeben.");
    process.exit(2);
  }

  const A = analyseLaden();
  const f = farbig(werte.farbe !== false);
  const zeilen = [];

  const quellen = [];
  for (const eintrag of frei) {
    if (/^https?:\/\//i.test(eintrag)) quellen.push(eintrag);
    else quellen.push(...musterAufloesen(eintrag));
  }

  for (const quelle of quellen) {
    let roh;
    try { roh = await quelleLaden(quelle); }
    catch (fehler) {
      zeilen.push("");
      zeilen.push(f.fett + quelle + f.aus);
      zeilen.push("  " + f.rot + "nicht lesbar: " + fehler.message + f.aus);
      continue;
    }

    const e = pruefeQuelltext(roh);
    const d = e.dokument;
    const p = A.profil(d, roh);

    zeilen.push("");
    zeilen.push(f.fett + quelle + f.aus);

    const wert = e.punkte.gesamt;
    const farbe = wert >= 90 ? f.gruen : (wert >= 70 ? f.gelb : f.rot);
    zeilen.push("  " + farbe + wert + " von 100" + f.aus + f.matt +
      "   " + e.kritisch + " kritisch, " + e.wichtig + " wichtig, " + e.hinweise + " Hinweise" + f.aus);

    function zeile(name, wert, zusatz) {
      zeilen.push("    " + f.matt + String(name).padEnd(22) + f.aus +
        String(wert).padStart(9) + (zusatz ? f.matt + "  " + zusatz + f.aus : ""));
    }

    zeilen.push("  " + f.blau + "Umfang" + f.aus);
    zeile("Wörter", p.woerter, p.lesezeit + " min Lesezeit");
    zeile("Quelltext", Math.round(p.bytes / 1024) + " KB", p.bytes + " Zeichen");
    zeile("Textanteil", p.textanteil + " %", "sichtbarer Text am Quelltext");
    zeile("Elemente", p.elemente, "tiefste Schachtelung " + p.tiefe);

    zeilen.push("  " + f.blau + "Sprache" + f.aus);
    zeile("Sätze", p.saetze, p.satzlaenge + " Wörter je Satz");
    zeile("Lesbarkeit", p.lesbarkeit === null ? "—" : p.lesbarkeit, "Amstad, 100 = sehr leicht");
    zeile("Sprachangabe", p.sprache || "fehlt", "lang am html-Element");

    zeilen.push("  " + f.blau + "Trefferliste" + f.aus);
    zeile("Titel", p.titelPixel + " px", p.titelZeichen + " Zeichen");
    zeile("Beschreibung", p.beschreibungPixel + " px", p.beschreibungZeichen + " Zeichen");
    zeile("Adresse", p.adresse ? p.adresse.length + " Zeichen" : "—", p.adresse || "keine absolute Adresse");

    zeilen.push("  " + f.blau + "Bausteine" + f.aus);
    zeile("Überschriften", p.ueberschriften, p.absaetze + " Absätze, " + p.listen + " Listen");
    zeile("Bilder", p.bilder, p.bilderOhneAlt + " ohne Alternativtext");
    zeile("Verweise", p.verweise, p.verweiseIntern + " intern, " + p.verweiseExtern + " extern");
    zeile("Skripte", p.skripte, p.stilblaetter + " Stilblätter");
    zeile("Fremde Hosts", p.fremdhosts, p.fremdhostliste.join(", ") || "keine");

    const gl = A.gliederung(d);
    if (gl.length) {
      zeilen.push("  " + f.blau + "Gliederung" + f.aus);
      for (const h of gl) {
        zeilen.push("    " + f.matt + ("h" + h.ebene).padEnd(4) + f.aus +
          "  ".repeat(h.ebene - 1) + (h.leer ? "(leer)" : h.text) +
          (h.sprung ? f.gelb + "   Ebene " + (h.von + 1) + " übersprungen" + f.aus : ""));
      }
    }

    for (const [laenge, name] of [[1, "Einzelne Wörter"], [2, "Zweierfolgen"], [3, "Dreierfolgen"]]) {
      const feld = A.wortfeld(d, laenge, werte.ausfuehrlich ? 15 : 8);
      if (!feld.length) continue;
      zeilen.push("  " + f.blau + name + f.aus);
      for (const w of feld) {
        const stellen = [
          w.imTitel ? "Titel" : null, w.inBeschreibung ? "Beschr." : null,
          w.inH1 ? "H1" : null, w.inH2 ? "H2" : null, w.inAdresse ? "Adresse" : null
        ].filter(Boolean);
        zeilen.push("    " + w.wort.padEnd(30).slice(0, 30) +
          String(w.anzahl).padStart(4) + "×" +
          String(w.dichte.toFixed(2)).padStart(7) + " %" +
          (stellen.length ? f.matt + "   " + stellen.join(", ") + f.aus : ""));
      }
    }

    zeilen.push("  " + f.blau + "Punktzahl je Gruppe" + f.aus);
    for (const g of e.punkte.gruppen.slice().sort((a, b) => a.wert - b.wert)) {
      const voll = Math.round(g.wert / 5);
      zeilen.push("    " + String(g.wert).padStart(3) + "  " +
        f.matt + "#".repeat(voll) + ".".repeat(20 - voll) + f.aus + "  " +
        g.name + f.matt + "  (" + g.befunde + " von " + g.regeln + ")" + f.aus);
    }
  }

  return zeilen.join("\n");
}

async function befehlCrawl(frei, werte) {
  if (!frei.length) {
    console.error("Keine Startadresse angegeben.");
    process.exit(2);
  }

  const f = farbig(werte.farbe);
  const lauf = await crawlen(frei[0], {
    max: werte.max, tiefe: werte.tiefe, verzoegerung: werte.verzoegerung,
    robots: werte.robots, nur: werte.nur, ohne: werte.ohne,
    melden: (nachricht) => process.stderr.write(f.matt + nachricht + f.aus + "\n")
  });

  const ergebnisse = lauf.seiten;
  const uebergreifend = crawlBefunde(lauf);

  if (uebergreifend.length) {
    ergebnisse.push({
      quelle: "Ueber alle Seiten hinweg",
      geprueft: uebergreifend.length,
      uebersprungen: 0,
      bestanden: 0,
      kritisch: uebergreifend.filter((b) => b.stufe === "kritisch").length,
      wichtig: uebergreifend.filter((b) => b.stufe === "wichtig").length,
      hinweise: uebergreifend.filter((b) => b.stufe === "hinweis").length,
      befunde: uebergreifend
    });
  }

  return ergebnisse;
}

function befehlRegeln(frei, werte) {
  const katalog = katalogLaden();
  const suche = (frei[0] || "").toLowerCase();
  const f = farbig(werte.farbe);
  const gefiltert = suche
    ? katalog.filter((r) => (r.id + " " + r.name + " " + r.gruppe).toLowerCase().includes(suche))
    : katalog;

  if (werte.format === "json") {
    return JSON.stringify(gefiltert.map((r) => ({
      id: r.id, gruppe: r.gruppe, name: r.name, stufe: r.stufe,
      brauchtVollstaendigesDokument: Boolean(r.braucht),
      wozu: String(r.wozu).replace(/<\/?code>/g, "")
    })), null, 2);
  }

  const zeilen = [];
  let gruppe = null;
  const farbeStufe = { kritisch: f.rot, wichtig: f.gelb, hinweis: f.matt };

  for (const r of gefiltert) {
    if (r.gruppe !== gruppe) { gruppe = r.gruppe; zeilen.push("", f.blau + gruppe + f.aus); }
    zeilen.push("  " + farbeStufe[r.stufe] + r.stufe.padEnd(10) + f.aus +
      r.id.padEnd(28) + f.matt + r.name + (r.braucht ? "  [ganzes Dokument]" : "") + f.aus);
  }

  zeilen.push("", f.matt + gefiltert.length + " von " + katalog.length + " Regeln" + f.aus);
  return zeilen.join("\n");
}

/* ---------- Hauptlauf ---------- */

async function befehlDomain(frei, werte) {
  if (!frei.length) {
    console.error("Keine Domain angegeben. Beispiel: seo-rank domain beispiel-domain.de");
    process.exit(2);
  }

  const { sammeln, regeln } = await domainWerkzeugeLaden();
  const f = farbig(werte.farbe !== false);
  const alles = [];

  for (const eingabe of frei) {
    const befund = await sammeln(eingabe, { ohneRdap: werte.ohneRdap });
    const urteil = regeln.pruefen(befund);
    alles.push({ befund, urteil });
  }

  if (werte.format === "json") {
    return { alles, text: JSON.stringify(alles.map((e) => ({
      domain: e.befund.domain,
      host: e.befund.host,
      startseite: e.befund.startseite,
      punkte: e.urteil.punkte,
      zahl: e.urteil.zahl,
      gruppen: e.urteil.gruppen,
      befunde: e.urteil.befunde,
      uebersprungen: e.urteil.uebersprungen.map((u) => u.id),
      gemessen: {
        varianten: e.befund.varianten,
        tls: e.befund.tls,
        dns: e.befund.dns,
        kopf: e.befund.kopf,
        cookies: e.befund.cookies,
        ttfb: e.befund.ttfb,
        dateien: e.befund.dateien,
        rdap: e.befund.rdap
      }
    })), null, 2) };
  }

  const z = [];
  for (const { befund: b, urteil: e } of alles) {
    z.push("");
    z.push(f.fett + b.domain + f.aus + f.matt + "   massgeblich: " + b.startseite + f.aus);

    const wert = e.punkte === null ? 0 : e.punkte;
    const farbe = wert >= 90 ? f.gruen : (wert >= 70 ? f.gelb : f.rot);
    z.push("  " + farbe + wert + " von 100" + f.aus + f.matt +
      "   " + e.zahl.kritisch + " kritisch, " + e.zahl.wichtig + " wichtig, " +
      e.zahl.hinweis + " Hinweise" + f.aus + f.matt +
      "   (" + (e.befunde.length + e.bestanden.length) + " von " + regeln.anzahl +
      " Regeln geprueft, " + e.uebersprungen.length + " uebersprungen)" + f.aus);

    /* Messwerte zuerst: der Befund ohne die Zahl dahinter ist eine
       Behauptung. */
    const zeile = (name, wert2, zusatz) => {
      z.push("    " + f.matt + String(name).padEnd(20) + f.aus +
        String(wert2).padStart(26) + (zusatz ? f.matt + "  " + zusatz + f.aus : ""));
    };

    z.push("  " + f.blau + "Erreichbarkeit" + f.aus);
    b.varianten.forEach((v) => {
      const spr = v.kette.length - 1;
      zeile(v.kennung, v.fehler ? "Fehler" : v.status,
        (v.fehler ? v.fehler : (spr > 0 ? spr + " Sprung(e) bis " + v.ziel : "direkt")));
    });
    zeile("Zeit bis 1. Byte", b.ttfb === null ? "—" : b.ttfb + " ms", "gut bis 800 ms");

    z.push("  " + f.blau + "Zertifikat" + f.aus);
    if (b.tls && !b.tls.fehler) {
      zeile("Protokoll", b.tls.protokoll || "—", b.tls.bestaetigt ? "bestaetigt" : ("nicht bestaetigt: " + (b.tls.fehlerGrund || "")));
      zeile("Aussteller", (b.tls.aussteller || "—").slice(0, 26), "");
      zeile("Gueltig bis", b.tls.gueltigBis || "—", b.tls.tageRest === null ? "" : b.tls.tageRest + " Tage");
      zeile("Namen im Zertifikat", (b.tls.san || []).length, (b.tls.san || []).slice(0, 3).join(", "));
      zeile("Kettenlaenge", b.tls.kettenlaenge, "mit Zwischenzertifikaten");
    } else {
      zeile("Zertifikat", "—", b.tls ? b.tls.fehler : "nicht gelesen");
    }

    z.push("  " + f.blau + "DNS" + f.aus);
    zeile("A / AAAA", b.dns.a.length + " / " + b.dns.aaaa.length, b.dns.a.slice(0, 2).join(", "));
    zeile("Gueltigkeitsdauer", b.dns.aTtl === null ? "—" : b.dns.aTtl + " s", "TTL des A-Eintrags");
    zeile("Nameserver", b.dns.ns.length, b.dns.ns.slice(0, 2).join(", "));
    /* RFC 7505: ein MX mit leerem Ziel heisst „diese Domain empfaengt
       keine Post". Ohne diesen Fall steht in der Ausgabe nur „0 ". */
    const nullMx = b.dns.mx.length === 1 && /^\d+\s*\.?$/.test(b.dns.mx[0].trim());
    zeile("MX", nullMx ? "Null-MX" : b.dns.mx.length,
      nullMx ? "kein Postempfang (RFC 7505)" : b.dns.mx.slice(0, 1).join(""));
    zeile("SPF / DMARC / CAA", b.dns.spf.length + " / " + b.dns.dmarc.length + " / " + b.dns.caa.length, "");
    if (b.dns.ptr.length) zeile("Rueckwaerts", b.dns.ptr[0].slice(0, 26), "");

    z.push("  " + f.blau + "Kopfzeilen und Dateien" + f.aus);
    zeile("Kopfzeilen", Object.keys(b.kopf).length, "in der Antwort der Startseite");
    zeile("Cookies", b.cookies.length, "beim ersten Abruf gesetzt");
    Object.keys(b.dateien).forEach((k) => {
      zeile(k, b.dateien[k].status === null ? "Fehler" : b.dateien[k].status, b.dateien[k].url);
    });

    if (b.rdap) {
      z.push("  " + f.blau + "Registrierung" + f.aus);
      zeile("Registrar", String(b.rdap.registrar || "—").slice(0, 26), "");
      zeile("Registriert", (b.rdap.erstellt || "—").slice(0, 10), "");
      zeile("Laeuft ab", (b.rdap.laeuftAb || "—").slice(0, 10), b.rdap.tageRest === null ? "" : b.rdap.tageRest + " Tage");
      zeile("Status", (b.rdap.status || []).length, (b.rdap.status || []).slice(0, 2).join(", "));
    } else if (b.rdapFehler) {
      z.push("  " + f.blau + "Registrierung" + f.aus);
      z.push("    " + f.matt + "nicht abrufbar: " + b.rdapFehler + f.aus);
    }

    if (!e.befunde.length) {
      z.push("");
      z.push("  " + f.gruen + "Keine Befunde." + f.aus);
    } else {
      z.push("");
      z.push("  " + f.blau + "Befunde" + f.aus + f.matt + "   nach Stufe, dann nach Gewicht" + f.aus);
      e.befunde.forEach((bf) => {
        const stufenfarbe = bf.stufe === "kritisch" ? f.rot : (bf.stufe === "wichtig" ? f.gelb : f.matt);
        z.push("    " + stufenfarbe + bf.stufe.padEnd(9) + f.aus + bf.name
          + f.matt + "   " + bf.gruppe + " · " + bf.id + f.aus);
        z.push("      " + f.matt + bf.fund + f.aus);
        if (werte.ausfuehrlich) {
          z.push("      " + f.matt + "Warum:   " + bf.wozu + f.aus);
          z.push("      " + f.matt + "Beheben: " + bf.beheben + f.aus);
        }
      });
    }
  }

  return { text: z.join("\n"), alles };
}

function domainAusloeser(alles, stufe) {
  const rang = RANG[stufe || "wichtig"] ?? 1;
  return alles.some((e) => e.urteil.befunde.some((b) => RANG[b.stufe] <= rang));
}

async function haupt() {
  const argv = process.argv.slice(2);
  const befehl = argv[0];

  if (!befehl || befehl === "hilfe" || befehl === "--hilfe" || befehl === "-h" || befehl === "--help") {
    process.stdout.write(HILFE);
    process.exit(0);
  }

  const { werte, frei } = argumenteLesen(argv.slice(1));

  if (befehl === "analyse") {
    const aus = await befehlAnalyse(frei, werte);
    if (werte.aus) fs.writeFileSync(werte.aus, aus, "utf8");
    else process.stdout.write(aus + "\n");
    process.exit(0);
  }

  if (befehl === "domain") {
    /* Einmal abrufen, einmal urteilen. Die Domain gehoert jemand anderem;
       ein zweiter Durchgang nur fuer den Rueckgabewert waere unhoeflich
       und ergaebe womoeglich ein anderes Ergebnis. */
    const { text, alles } = await befehlDomain(frei, werte);
    schreiben(text + "\n", werte);
    process.exit(domainAusloeser(alles, werte.stufe) ? 1 : 0);
  }

  if (befehl === "regeln") {
    const aus = befehlRegeln(frei, werte);
    schreiben(aus + "\n", werte);
    process.exit(0);
  }

  let ergebnisse;
  if (befehl === "pruefen") ergebnisse = await befehlPruefen(frei, werte);
  else if (befehl === "crawl") ergebnisse = await befehlCrawl(frei, werte);
  else { console.error("Unbekannter Befehl: " + befehl + "\n"); process.stdout.write(HILFE); process.exit(2); }

  let ausgabe;
  if (werte.format === "json") ausgabe = alsJSON(ergebnisse);
  else if (werte.format === "junit") ausgabe = alsJUnit(ergebnisse, werte.stufe);
  else ausgabe = alsText(ergebnisse, { farbe: werte.farbe, ausfuehrlich: werte.ausfuehrlich });

  const summe = bilanz(ergebnisse, werte.stufe);

  if (werte.format === "text") {
    const f = farbig(werte.farbe);
    ausgabe += "\n\n" + f.fett + summe.seiten + " Seite(n) geprüft" + f.aus + f.matt + " · " + f.aus +
      (summe.kritisch ? f.rot : f.matt) + summe.kritisch + " kritisch" + f.aus + f.matt + " · " + f.aus +
      (summe.wichtig ? f.gelb : f.matt) + summe.wichtig + " wichtig" + f.aus + f.matt + " · " + f.aus +
      f.matt + summe.hinweise + " Hinweise" + f.aus +
      (summe.fehler ? f.matt + " · " + f.aus + f.rot + summe.fehler + " nicht ladbar" + f.aus : "") + "\n";
  }

  schreiben(ausgabe + (werte.format === "text" ? "" : "\n"), werte);

  process.exit(summe.ausloeser > 0 || summe.fehler > 0 ? 1 : 0);
}

function schreiben(text, werte) {
  if (werte.aus) fs.writeFileSync(werte.aus, text, "utf8");
  else process.stdout.write(text);
}

haupt().catch((fehler) => {
  console.error("Abbruch: " + (fehler && fehler.stack ? fehler.stack : fehler));
  process.exit(2);
});
