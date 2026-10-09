/* seo-rank.me — Selbsttest.
   Sichert den handgeschriebenen Parser, den Regelkatalog und die
   robots-Auswertung gegen Rueckschritte ab.

   Die Sollwerte stammen aus dem Browser: dieselben Dateien wurden dort
   durch den Seiten-Pruefer geschickt. Weicht die Kommandozeile ab, ist
   entweder der Parser kaputt oder der Katalog wurde geaendert, ohne die
   Zahlen hier nachzuziehen.

   Aufruf:  node bauen/selbsttest.mjs */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseHTML, parseXML } from "../cli/dom.mjs";
import { pruefeQuelltext, katalogLaden, analyseLaden } from "../cli/kern.mjs";

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let geprueft = 0;
let gescheitert = 0;

function pruefe(name, ist, soll) {
  geprueft++;
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (!gleich) {
    gescheitert++;
    console.log("  FEHLER  " + name);
    console.log("          erwartet: " + JSON.stringify(soll));
    console.log("          bekommen: " + JSON.stringify(ist));
  } else {
    console.log("  ok      " + name);
  }
}

function abschnitt(titel) {
  console.log("\n" + titel);
}

/* ---------- Parser ---------- */

abschnitt("Parser und Selektoren");

const probe = parseHTML(`<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Titel &amp; mehr</title>
  <meta name="description" content="Beschreibung">
  <link rel="canonical" href="https://a.de/">
  <link rel="icon" href="i.svg">
  <script src="a.js"></script>
</head>
<body>
  <h1>Erste</h1>
  <p>Ein Absatz
  <p>Noch einer
  <ul><li>eins<li>zwei</ul>
  <table><tr><td>A<td>B</tr></table>
  <a href="/x" target="_blank">x</a>
  <img src="b.jpg" alt="">
  <script>var a = "<p>kein Element</p>";</script>
</body>
</html>`);

pruefe("Sprachangabe gelesen", probe.documentElement.getAttribute("lang"), "de");
pruefe("Titel mit Zeichenverweis", probe.querySelector("title").textContent, "Titel & mehr");
pruefe("Kennzeichen i im Selektor", Boolean(probe.querySelector('meta[name="DESCRIPTION" i]')), true);
pruefe("Kennzeichen i mit ~=", Boolean(probe.querySelector('link[rel~="ICON" i]')), true);
pruefe("Nachfahrenverkettung", probe.querySelectorAll("head script[src]").length, 1);
pruefe("Attributwert genau", probe.querySelectorAll('a[target="_blank"]').length, 1);
pruefe("Kommaliste", probe.querySelectorAll("h1, title").length, 2);
pruefe("Entfallende Endmarke bei p", probe.querySelectorAll("p").length, 2);
pruefe("Entfallende Endmarke bei li", probe.querySelectorAll("li").length, 2);
pruefe("Entfallende Endmarke bei td", probe.querySelectorAll("td").length, 2);
pruefe("Rohtext im Skript nicht geparst", probe.querySelectorAll("p").length, 2);
pruefe("Leeres alt gilt als gesetzt", probe.querySelector("img").hasAttribute("alt"), true);
pruefe("Kopf und Koerper getrennt", [probe.head.children.length > 0, probe.body.children.length > 0], [true, true]);
pruefe("closest findet den Vorfahren", probe.querySelector("td").closest("table").localName, "table");
pruefe("Alle Elemente gezaehlt", probe.getElementsByTagName("*").length > 15, true);

const ohneKopf = parseHTML("<h1>Nur ein Ausschnitt</h1><p>Text</p>");
pruefe("Ausschnitt ohne html-Element", ohneKopf.querySelectorAll("h1").length, 1);

const xml = parseXML(`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://a.de/</loc></url></urlset>`);
pruefe("XML: Wurzel erkannt", xml.documentElement.localName, "urlset");
pruefe("XML: kein Parserfehler", xml.parserfehler, null);
const xmlKaputt = parseXML("<urlset><url><loc>a</url></urlset>");
pruefe("XML: Fehler erkannt", typeof xmlKaputt.parserfehler === "string", true);

/* ---------- Regelkatalog ---------- */

abschnitt("Regelkatalog");

const katalog = katalogLaden();
const stufen = { kritisch: 0, wichtig: 0, hinweis: 0 };
katalog.forEach((r) => stufen[r.stufe]++);

pruefe("Kennungen eindeutig", new Set(katalog.map((r) => r.id)).size, katalog.length);
pruefe("Jede Regel hat eine Gruppe", katalog.every((r) => Boolean(r.gruppe)), true);
pruefe("Jede Regel hat eine Erklaerung", katalog.every((r) => Boolean(r.wozu)), true);
pruefe("Jede Regel hat eine Pruefung", katalog.every((r) => typeof r.pruefe === "function"), true);
pruefe("Nur bekannte Stufen", katalog.every((r) => r.stufe in stufen), true);

// Der Regelsatz auf der Website muss dieselbe Zahl nennen.
const regelsatz = fs.readFileSync(path.join(WURZEL, "site", "regelsatz.html"), "utf8");
const imRegelsatz = (regelsatz.match(/class="regel"/g) || []).length;
pruefe("Regelsatz und Katalog gleich gross", imRegelsatz, katalog.length);

/* Das Gewichtsbild auf der Startseite wird erzeugt, nicht getippt. Ein
   Quadrat je Gewichtspunkt: die Summe MUSS dem Katalog entsprechen,
   sonst behauptet die Startseite eine Zahl, die niemand gemessen hat. */
const startseite = fs.readFileSync(path.join(WURZEL, "site", "index.html"), "utf8");
const punkteGesamt = (startseite.match(/class="gewichtsbild__punkt/g) || []).length;
const punkteVerloren = (startseite.match(/gewichtsbild__punkt--verloren/g) || []).length;
const punktePlan = (startseite.match(/gewichtsbild__punkt--plan/g) || []).length;
const gewichtKatalog = katalog.reduce((s, r) => s + (r.gewicht || 1), 0);
pruefe("Gewichtsbild so gross wie der Katalog", punkteGesamt, gewichtKatalog);
pruefe("Gewichtsbild: Legende nennt dieselben Zahlen", [
  startseite.includes(">" + (punkteGesamt - punkteVerloren - punktePlan) + "</span> gehalten"),
  startseite.includes(">" + punkteVerloren + "</span> verloren"),
  startseite.includes(">" + punktePlan + "</span> im Plan")
], [true, true, true]);

/* ---------- Pixelmessung ohne Canvas ---------- */

abschnitt("Pixelmessung aus der Breitentabelle");

// Sollwerte im Browser gemessen (20 px Arial beziehungsweise 14 px Arial).
const messproben = [
  ["seo-rank.me – kostenloses SEO-Werkzeug", 390, "titel-breit"],
  ["Seiten-Prüfer: 76 SEO-Regeln sofort – seo-rank.me", 465, "titel-breit"]
];

for (const [text, sollBreite] of messproben) {
  const ergebnis = pruefeQuelltext("<title>" + text + "</title>");
  // Die Regel meldet die gemessene Breite im Text mit; bei diesen Titeln
  // liegt sie unter der Grenze, also darf sie nicht anschlagen.
  const angeschlagen = ergebnis.befunde.some((b) => b.id === "titel-breit");
  pruefe("Titel unter der Grenze: " + text.slice(0, 26), angeschlagen, false);
}

const breitEins = pruefeQuelltext("<title>" + "W".repeat(60) + "</title>");
pruefe("Sehr breiter Titel schlaegt an", breitEins.befunde.some((b) => b.id === "titel-breit"), true);

/* ---------- Beispielseite: Sollwerte aus dem Browser ---------- */

abschnitt("Beispielseite gegen die Browser-Werte");

const beispielQuelle = fs.readFileSync(path.join(WURZEL, "site", "assets", "js", "beispielseite.js"), "utf8");
const beispiel = new Function(beispielQuelle + "\nreturn SEORANK_BEISPIEL;")();
const lauf = pruefeQuelltext(beispiel);

pruefe("Beispielseite: kritisch", lauf.kritisch, 2);
pruefe("Beispielseite: wichtig", lauf.wichtig, 18);
pruefe("Beispielseite: Hinweise", lauf.hinweise, 36);
pruefe("Beispielseite: bestanden", lauf.bestanden, 102);
pruefe("Beispielseite: Punktzahl", lauf.punkte.gesamt, 63);
pruefe("Beispielseite: Summe stimmt", lauf.befunde.length + lauf.bestanden, katalog.length);

/* ---------- Eigene Seiten ---------- */

abschnitt("Eigene Seiten");

/* Die Website besteht ihre eigenen Regeln — ALLE 23 Seiten, ALLE Stufen.

   Das ist der Waechter: jeder Befund, der hier nicht ausdruecklich
   zugelassen ist, laesst den Test scheitern. Jede Zulassung nennt den
   Grund und die Seiten, auf denen sie gilt. Taucht ein zugelassener
   Befund auf einer anderen Seite auf, scheitert der Test ebenfalls —
   sonst wuerde eine Ausnahme fuer den Datenschutztext stillschweigend
   fuer die Startseite mitgelten.

   Was hier steht, ist nicht behebbar, ohne etwas zu ERFINDEN oder eine
   Entscheidung zurueckzunehmen:
     gesperrt          beabsichtigtes noindex auf Rechtsseiten und
                       Produktoberflaeche
     platzhaltertext   [Anschrift ergaenzen] bleibt, bis die Anschrift da
                       ist — ein Platzhalter ist ehrlicher als eine Luege
     autor-fehlt       ein Verfasser fuer den Datenschutztext waere erfunden
     dom-gross         158 Regeln im Klartext SIND ein grosses Dokument
     wenig-text, satz-zu-lang, schwer-lesbar, text-code-anteil,
     stichwort-gestopft
                       Oberflaechenentwurf mit Demodaten, noindex.
                       Bedienbeschriftungen sind keine Prosa, und „2026"
                       steht in einer Datumsspalte, nicht im Fliesstext. */
const ENTWURF = ["app.html", "app-audit.html", "app-backlinks.html", "app-rankings.html"];
const RECHT = ["impressum.html", "datenschutz.html"];
const MIT_FUSSZEILE = (datei) => !ENTWURF.includes(datei);

const ZUGELASSEN = {
  "gesperrt":            (datei) => ENTWURF.includes(datei) || RECHT.includes(datei),
  "platzhaltertext":     MIT_FUSSZEILE,
  "autor-fehlt":         (datei) => datei === "datenschutz.html",
  "dom-gross":           (datei) => datei === "regelsatz.html",
  "wenig-text":          (datei) => ENTWURF.includes(datei),
  "satz-zu-lang":        (datei) => ENTWURF.includes(datei),
  "schwer-lesbar":       (datei) => ENTWURF.includes(datei),
  "text-code-anteil":    (datei) => ENTWURF.includes(datei),
  "stichwort-gestopft":  (datei) => ENTWURF.includes(datei)
};

const alleSeiten = fs.readdirSync(path.join(WURZEL, "site"))
  .filter((n) => n.endsWith(".html")).sort();
pruefe("Eigene Seiten: alle 24 werden geprueft", alleSeiten.length, 24);

let summe = { kritisch: 0, wichtig: 0, hinweise: 0 };
for (const datei of alleSeiten) {
  const roh = fs.readFileSync(path.join(WURZEL, "site", datei), "utf8");
  const e = pruefeQuelltext(roh);
  summe.kritisch += e.kritisch; summe.wichtig += e.wichtig; summe.hinweise += e.hinweise;
  const offen = e.befunde.filter((b) => {
    const regel = ZUGELASSEN[b.id];
    return !(regel && regel(datei));
  });
  pruefe(datei + " ohne unzugelassenen Befund", offen.map((b) => b.id), []);
}

/* Die Summe steht auch in CLAUDE.md. Weicht sie ab, ist entweder eine
   Seite dazugekommen (+1 wichtig durch die Fusszeile) oder etwas ist
   kaputtgegangen — beides soll auffallen, nicht durchrutschen. */
pruefe("Eigene Seiten: Gesamtbilanz kritisch/wichtig/Hinweise",
  [summe.kritisch, summe.wichtig, summe.hinweise], [6, 20, 17]);

/* ---------- Was auf JEDER Seite gleich sein muss ----------

   Diese fuenf Proben standen bis zum 12.09.2026 nur im Messskript im
   Browser, nicht hier. Genau deshalb blieb eine Regression unbemerkt:
   beim Beheben von `titel-ohne-bezug-h1` verlor `kostenlos.html` den
   Markennamen aus dem Titel. Der Regelkatalog kann das nicht finden — er
   prueft eine Seite fuer sich, nicht die Reihe. Was ueber alle Seiten
   gleich sein muss, gehoert deshalb hierher. */

const BASIS = (() => {
  const merker = path.join(WURZEL, "bauen", "adresse.txt");
  return fs.existsSync(merker) ? fs.readFileSync(merker, "utf8").trim().replace(/\/$/, "") : "https://seo-rank.me";
})();

const kopfFehler = { marke: [], kanonisch: [], kanonischZuviel: [], ogAdresse: [], pfad: [], richtlinie: [] };

for (const datei of alleSeiten) {
  const roh = fs.readFileSync(path.join(WURZEL, "site", datei), "utf8");
  const titel = (roh.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const kanonisch = (roh.match(/<link rel="canonical" href="([^"]*)"/) || [])[1] || "";
  const ogAdresse = (roh.match(/<meta property="og:url" content="([^"]*)"/) || [])[1] || "";
  const gesperrt = /name="robots" content="[^"]*noindex/.test(roh);
  /* Die Basisadresse steht nicht mehr fest: bauen/adresse-setzen.mjs
     schreibt sie um, wenn die Seiten woanders liegen. Der Test liest
     denselben Merker und prueft weiter, dass jede Seite auf SICH zeigt. */
  const erwartet = BASIS + "/" + (datei === "index.html" ? "" : datei);

  if (!titel.includes("seo-rank.me")) kopfFehler.marke.push(datei);

  /* Auf einer gesperrten Seite gehoert KEINE canonical: sie widerspricht
     dem noindex, und Google kann das noindex dann auf das Ziel
     uebertragen. Geprueft wird beides — die Anwesenheit dort, wo sie
     hingehoert, und die Abwesenheit dort, wo sie schadet. */
  if (gesperrt) {
    if (kanonisch) kopfFehler.kanonischZuviel.push(datei + ": " + kanonisch);
  } else if (kanonisch !== erwartet) {
    kopfFehler.kanonisch.push(datei + ": " + (kanonisch || "(keine)"));
  }

  if (ogAdresse !== erwartet) kopfFehler.ogAdresse.push(datei + ": " + ogAdresse);
  if (!roh.includes('"@type": "BreadcrumbList"')) kopfFehler.pfad.push(datei);
  if (!roh.includes('http-equiv="Content-Security-Policy"')) kopfFehler.richtlinie.push(datei);
}

pruefe("Jede Seite nennt seo-rank.me im Titel", kopfFehler.marke, []);
pruefe("Jede offene Seite hat eine canonical auf sich selbst", kopfFehler.kanonisch, []);
pruefe("Keine gesperrte Seite hat eine canonical", kopfFehler.kanonischZuviel, []);
pruefe("Jede og:url zeigt auf die eigene Datei", kopfFehler.ogAdresse, []);
pruefe("Jede Seite traegt eine BreadcrumbList", kopfFehler.pfad, []);
pruefe("Jede Seite traegt eine Inhaltsrichtlinie", kopfFehler.richtlinie, []);

/* Die Sitemap wird erzeugt (bauen/sitemap-erzeugen.mjs). Geprueft wird die
   MENGE, nicht das Datum: lastmod kommt aus dem Aenderungsdatum der Datei
   und waere nach jedem Kopieren anders. Die Menge dagegen ist eine
   Wahrheitsfrage — eine gesperrte Seite in der Sitemap meldet Google als
   Fehler, eine fehlende offene Seite wird schlechter gefunden. */
{
  const karte = fs.readFileSync(path.join(WURZEL, "site", "sitemap-seiten.xml"), "utf8");
  const inKarte = [...karte.matchAll(/<loc>([^<]*)<\/loc>/g)]
    .map((m) => m[1].replace(BASIS + "/", "") || "index.html").sort();
  const offene = fs.readdirSync(path.join(WURZEL, "site"))
    .filter((n) => n.endsWith(".html") && !n.startsWith("_"))
    .filter((n) => !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(
      fs.readFileSync(path.join(WURZEL, "site", n), "utf8")))
    .sort();
  pruefe("Sitemap enthaelt genau die offenen Seiten", inKarte, offene);
  pruefe("Sitemap zeigt auf die gesetzte Basisadresse",
    [...karte.matchAll(/<loc>([^<]*)<\/loc>/g)].every((m) => m[1].startsWith(BASIS + "/")), true);
}

/* Das Welt-Skript steht inline und ist per Hash erlaubt. Wer es aendert,
   ohne den Hash mitzuziehen, bekommt eine Seite, die beim Laden hell
   aufblitzt — und niemand sieht, woran es liegt. */
{
  const inhalt = 'try{if(sessionStorage.getItem("seorank-welt")==="hell")'
    + 'document.documentElement.setAttribute("data-welt","hell");}catch(e){}';
  const hash = "sha256-" + createHash("sha256").update(inhalt, "utf8").digest("base64");
  const schief = [];
  for (const datei of alleSeiten) {
    const roh = fs.readFileSync(path.join(WURZEL, "site", datei), "utf8");
    const hatSkript = roh.includes("<script>" + inhalt + "</script>");
    const hatHash = roh.includes(hash);
    if (!hatSkript || !hatHash) {
      schief.push(datei + (hatSkript ? "" : " (Skript weicht ab)") + (hatHash ? "" : " (Hash fehlt)"));
    }
  }
  pruefe("Welt-Skript und sein Hash passen auf allen Seiten zusammen", schief, []);
}

/* Die Punktzahl muss rechnen, nicht nur existieren. */
{
  const roh = fs.readFileSync(path.join(WURZEL, "site", "index.html"), "utf8");
  const e = pruefeQuelltext(roh);
  const summe = e.punkte.gruppen.reduce((s, g) => s + g.moeglich, 0);
  pruefe("Punktzahl: Gruppengewichte ergeben das Gesamtgewicht", summe, e.punkte.moeglich);
  pruefe("Punktzahl: Wert liegt zwischen 0 und 100",
    e.punkte.gesamt >= 0 && e.punkte.gesamt <= 100, true);
  const ohneBefund = e.punkte.gruppen.filter((g) => g.befunde === 0).every((g) => g.wert === 100);
  pruefe("Punktzahl: Gruppe ohne Befund hat 100", ohneBefund, true);
}

/* Analyse: die Messwerte muessen zum Dokument passen. */
{
  const A = analyseLaden();
  const roh = fs.readFileSync(path.join(WURZEL, "site", "index.html"), "utf8");
  const e = pruefeQuelltext(roh);
  const p = A.profil(e.dokument, roh);
  pruefe("Analyse: Verweise summieren sich",
    p.verweiseIntern + p.verweiseExtern + p.verweiseAnker + p.verweiseSonstige, p.verweise);
  pruefe("Analyse: Gliederung so lang wie die Zahl der Ueberschriften",
    A.gliederung(e.dokument).length, p.ueberschriften);
  pruefe("Analyse: Bildtabelle so lang wie die Zahl der Bilder",
    A.bilder(e.dokument).length, p.bilder);
  pruefe("Analyse: Verweistabelle so lang wie die Zahl der Verweise",
    A.verweise(e.dokument).length, p.verweise);
  pruefe("Analyse: Textanteil zwischen 0 und 100",
    p.textanteil >= 0 && p.textanteil <= 100, true);
}

/* Jede Regel muss sagen koennen, was zu tun ist. */
{
  const katalog = katalogLaden();
  pruefe("Jede Regel hat einen Behebungsweg",
    katalog.filter((r) => !r.beheben).map((r) => r.id), []);
  pruefe("Jede Regel hat einen Wirkungsbereich",
    katalog.filter((r) => !r.wirkung || r.wirkung === "unbestimmt").map((r) => r.id), []);
  pruefe("Jedes Gewicht liegt zwischen 1 und 5",
    katalog.filter((r) => !(r.gewicht >= 1 && r.gewicht <= 5)).map((r) => r.id), []);
}

/* ---------- robots.txt ---------- */

abschnitt("robots.txt");

const robotsQuelle = fs.readFileSync(path.join(WURZEL, "site", "assets", "js", "robotsregeln.js"), "utf8");
const robots = new Function(robotsQuelle + "\nreturn SEORANK_ROBOTS;")();

const beispielRobots = [
  "User-agent: *",
  "Disallow: /intern/",
  "Disallow: /*.pdf$",
  "Allow: /intern/handbuch/",
  "",
  "User-agent: AhrefsBot",
  "Disallow: /",
  "",
  "Sitemap: https://a.de/sitemap.xml"
].join("\n");

const gelesen = robots.lesen(beispielRobots);
pruefe("Gruppen erkannt", gelesen.gruppen.length, 2);
pruefe("Sitemap erkannt", gelesen.sitemaps.length, 1);

const google = robots.gruppeFuer(gelesen.gruppen, "Googlebot");
const faelle = [
  ["/intern/handbuch/kapitel-1", true, "laengster Pfad gewinnt"],
  ["/intern/geheim.html", false, "Disallow greift"],
  ["/anleitung.pdf", false, "Dollarzeichen am Ende"],
  ["/anleitung.pdf.html", true, "Dollarzeichen greift nicht mitten im Pfad"],
  ["/", true, "nicht verboten heisst erlaubt"]
];
for (const [pfad, soll, warum] of faelle) {
  pruefe("robots: " + pfad + " (" + warum + ")", robots.entscheiden(google, pfad).erlaubt, soll);
}

const ahrefs = robots.gruppeFuer(gelesen.gruppen, "AhrefsBot");
pruefe("robots: eigene Gruppe gewinnt", robots.entscheiden(ahrefs, "/").erlaubt, false);

/* ---------- Domain-Regeln ---------- */

const domainQuelle = fs.readFileSync(path.join(WURZEL, "site", "assets", "js", "domainregeln.js"), "utf8");
const dom = new Function(domainQuelle + "return SEORANK_DOMAIN;")();

/* Die wichtigste Zusage des Regelsatzes: was nicht gemessen wurde, wird
   nicht bemaengelt. Ein leerer Befund darf NICHTS ergeben. */
const leerDom = dom.pruefen({});
pruefe("domain: leerer Befund ergibt keine Befunde", leerDom.befunde.length, 0);
pruefe("domain: leerer Befund ueberspringt alles", leerDom.uebersprungen.length, dom.anzahl);
pruefe("domain: leerer Befund hat keine Punktzahl", leerDom.punkte, null);

/* Ein LEERES Objekt ist unbekannt, ein leeres Array ist gemessen.
   Diese Unterscheidung hat einmal dreizehn erfundene Befunde erzeugt. */
pruefe("domain: leere Kopfzeilen ergeben keine Befunde",
  dom.pruefen({ kopf: {} }).befunde.length, 0);
pruefe("domain: leere DNS-Liste wird geurteilt",
  dom.pruefen({ dns: { a: [], aaaa: [], ns: [], mx: [], spf: [], dmarc: [], caa: [] } })
    .befunde.some((b) => b.id === "dns-kein-a"), true);

/* Kopfzeilen lesen */
const gelesenKopf = dom.kopfzeilenLesen([
  "HTTP/2 200",
  "Content-Type: text/html",
  "strict-transport-security: max-age=63072000; includeSubDomains",
  "Set-Cookie: a=1; Path=/; Secure",
  "Set-Cookie: b=2; Path=/"
].join("\n"));
pruefe("domain: Statuszeile erkannt", gelesenKopf.status, 200);
pruefe("domain: Kopfzeilen klein geschrieben", Object.keys(gelesenKopf.kopf).sort(),
  ["content-type", "strict-transport-security"]);
pruefe("domain: beide Cookies getrennt", gelesenKopf.cookies.length, 2);

/* HSTS-Dauer */
pruefe("domain: HSTS lang genug",
  dom.pruefen({ kopf: { "strict-transport-security": "max-age=63072000; includeSubDomains" } })
    .befunde.some((b) => b.id === "kopf-hsts-kurz"), false);
pruefe("domain: HSTS zu kurz",
  dom.pruefen({ kopf: { "strict-transport-security": "max-age=300" } })
    .befunde.some((b) => b.id === "kopf-hsts-kurz"), true);

/* Zertifikatsnamen: ein Sternchen deckt genau eine Ebene */
pruefe("domain: *.a.de deckt www.a.de", dom.nameDeckt("*.a.de", "www.a.de"), true);
pruefe("domain: *.a.de deckt a.de nicht", dom.nameDeckt("*.a.de", "a.de"), false);
pruefe("domain: *.a.de deckt x.y.a.de nicht", dom.nameDeckt("*.a.de", "x.y.a.de"), false);
pruefe("domain: gleicher Name deckt", dom.nameDeckt("a.de", "a.de"), true);

/* Der Klassiker: www und ohne www liefern beide 200 */
pruefe("domain: zwei erreichbare Hosts werden gemeldet",
  dom.pruefen({
    varianten: [
      { kennung: "https", url: "https://a.de/", status: 200, ziel: "https://a.de/", kette: [{}] },
      { kennung: "https-www", url: "https://www.a.de/", status: 200, ziel: "https://www.a.de/", kette: [{}] }
    ]
  }).befunde.some((b) => b.id === "dom-beide-hosts-erreichbar"), true);

pruefe("domain: ein gemeinsames Ziel wird nicht gemeldet",
  dom.pruefen({
    varianten: [
      { kennung: "https", url: "https://a.de/", status: 200, ziel: "https://www.a.de/", kette: [{}, {}] },
      { kennung: "https-www", url: "https://www.a.de/", status: 200, ziel: "https://www.a.de/", kette: [{}] }
    ]
  }).befunde.some((b) => b.id === "dom-beide-hosts-erreichbar"), false);

/* http mit 200 statt Weiterleitung */
pruefe("domain: http ohne Weiterleitung wird gemeldet",
  dom.pruefen({
    varianten: [
      { kennung: "http", url: "http://a.de/", status: 200, ziel: "http://a.de/", kette: [{}] }
    ]
  }).befunde.some((b) => b.id === "dom-http-ohne-weiterleitung"), true);

pruefe("domain: http mit Weiterleitung auf https ist in Ordnung",
  dom.pruefen({
    varianten: [
      { kennung: "http", url: "http://a.de/", status: 200, ziel: "https://a.de/", kette: [{}, {}] }
    ]
  }).befunde.some((b) => b.id === "dom-http-ohne-weiterleitung"), false);

/* SPF: +all ist schlimmer als kein SPF */
pruefe("domain: SPF mit -all ist in Ordnung",
  dom.pruefen({ dns: { spf: ["v=spf1 include:x.de -all"], mx: ["10 m.de"], a: ["1.2.3.4"], aaaa: [], ns: ["a", "b"], dmarc: ["v=DMARC1; p=reject"], caa: ["issue x"] } })
    .befunde.some((b) => b.id === "dns-spf-offen"), false);
pruefe("domain: SPF mit +all wird gemeldet",
  dom.pruefen({ dns: { spf: ["v=spf1 include:x.de +all"], mx: ["10 m.de"], a: ["1.2.3.4"], aaaa: [], ns: ["a", "b"], dmarc: [], caa: [] } })
    .befunde.some((b) => b.id === "dns-spf-offen"), true);

/* SPF und DMARC werden nur verlangt, wo es ueberhaupt Postempfang gibt */
pruefe("domain: ohne MX kein SPF-Befund",
  dom.pruefen({ dns: { spf: [], mx: [], a: ["1.2.3.4"], aaaa: [], ns: ["a", "b"], dmarc: [], caa: [] } })
    .befunde.some((b) => b.id === "dns-kein-spf"), false);
pruefe("domain: mit MX aber ohne SPF gibt es einen Befund",
  dom.pruefen({ dns: { spf: [], mx: ["10 m.de"], a: ["1.2.3.4"], aaaa: [], ns: ["a", "b"], dmarc: [], caa: [] } })
    .befunde.some((b) => b.id === "dns-kein-spf"), true);

/* dig-Ausgabe lesen — die Trennung ist ein echter Tabulator */
const digZeilen = [
  "beispiel.de.\t3600\tIN\tA\t203.0.113.1",
  "beispiel.de.\t3600\tIN\tNS\tns1.hoster.de.",
  "beispiel.de.\t3600\tIN\tTXT\t\"v=spf1 -all\""
].join("\n");
const digDns = dom.dnsLesen(digZeilen);
pruefe("domain: dig A gelesen", digDns.a, ["203.0.113.1"]);
pruefe("domain: dig TTL gelesen", digDns.aTtl, 3600);
pruefe("domain: dig SPF erkannt", digDns.spf, ["v=spf1 -all"]);
pruefe("domain: dig NS ohne Schlusspunkt", digDns.ns, ["ns1.hoster.de"]);

/* nslookup-Ausgabe lesen */
const nsDns = dom.dnsLesen([
  "Server:  fritz.box",
  "Address:  192.168.178.1",
  "",
  "Nicht autorisierende Antwort:",
  "Name:    beispiel.de",
  "Address: 203.0.113.9"
].join("\n"));
pruefe("domain: nslookup-Adresse gelesen", nsDns.a.includes("203.0.113.9"), true);

/* Cookies: die drei Merkmale werden einzeln beurteilt */
const cookieBefund = dom.pruefen({
  kopf: { "content-type": "text/html" },
  cookies: ["sitzung=1; Path=/; Secure; HttpOnly; SameSite=Lax", "zaehler=2; Path=/"]
});
pruefe("domain: Cookie ohne Secure wird gemeldet",
  cookieBefund.befunde.some((b) => b.id === "cookie-ohne-secure"), true);
pruefe("domain: Cookie ohne SameSite wird gemeldet",
  cookieBefund.befunde.some((b) => b.id === "cookie-ohne-samesite"), true);

/* Punktzahl: uebersprungene Regeln zaehlen weder positiv noch negativ */
const nurEineRegel = dom.pruefen({ kopf: { "x-robots-tag": "noindex" } });
pruefe("domain: noindex im Kopf ist kritisch",
  nurEineRegel.befunde.some((b) => b.id === "kopf-x-robots-noindex" && b.stufe === "kritisch"), true);
pruefe("domain: Punktzahl rechnet nur ueber Geprueftes",
  nurEineRegel.moeglich === nurEineRegel.gruppen.Kopfzeilen.moeglich, true);

/* Jede Regel traegt alles, was die Ausgabe braucht */
pruefe("domain: keine Regel ohne Pflichtangabe",
  dom.REGELN.filter((r) => !r.id || !r.gruppe || !r.name || !r.stufe || !r.gewicht
    || !r.wozu || !r.beheben || !r.braucht || !r.pruefe).length, 0);
pruefe("domain: keine doppelte Kennung",
  dom.REGELN.length - new Set(dom.REGELN.map((r) => r.id)).size, 0);
pruefe("domain: nur bekannte Stufen",
  dom.REGELN.filter((r) => !["kritisch", "wichtig", "hinweis"].includes(r.stufe)).length, 0);
pruefe("domain: Regelzahl stimmt mit der Auskunft ueberein", dom.REGELN.length, dom.anzahl);

/* Kennungen stehen in der JSON-Ausgabe und in --nur/--ohne. Ein Umlaut
   darin ist nicht nur haesslich, er macht den Schalter unbenutzbar. Genau
   das ist beim Setzen der Umlaute passiert: aus "reg-laeuft-ab" wurde
   "reg-läuft-ab", und kein Test hat es gemerkt. */
pruefe("domain: Kennungen nur aus a-z, 0-9 und Bindestrich",
  dom.REGELN.filter((r) => !/^[a-z0-9-]+$/.test(r.id)).map((r) => r.id), []);

/* ---------- Kennungen: JS gegen HTML ---------- */

/* Diesen Test gab es nicht, und deshalb blieb unbemerkt, dass beim Setzen
   von Umlauten aus der Kennung "l-laengste" ein "l-längste" wurde. Die
   Datei war syntaktisch heil, der Selbsttest gruen — und das Werkzeug fand
   sein Bilanzfeld trotzdem nicht mehr. Eine Kennung, die es im HTML nicht
   gibt, ist ein Fehler, auch wenn nichts abstuerzt. */

const seitenDateien = fs.readdirSync(path.join(WURZEL, "site"))
  .filter((n) => n.endsWith(".html"));

const skriptZuSeiten = new Map();
for (const seite of seitenDateien) {
  const html = fs.readFileSync(path.join(WURZEL, "site", seite), "utf8");
  for (const m of html.matchAll(/<script src="assets\/js\/([^"]+)"/g)) {
    if (!skriptZuSeiten.has(m[1])) skriptZuSeiten.set(m[1], []);
    skriptZuSeiten.get(m[1]).push(seite);
  }
}

const htmlZwischenspeicher = new Map();
function htmlVon(seite) {
  if (!htmlZwischenspeicher.has(seite)) {
    htmlZwischenspeicher.set(seite, fs.readFileSync(path.join(WURZEL, "site", seite), "utf8"));
  }
  return htmlZwischenspeicher.get(seite);
}

const fehlendeKennungen = [];
const fehlendeBlaetter = [];
let kennungenGeprueft = 0;
let blaetterGeprueft = 0;

for (const [skript, seiten] of skriptZuSeiten) {
  const voll = path.join(WURZEL, "site", "assets", "js", skript);
  if (!fs.existsSync(voll)) continue;
  const quelle = fs.readFileSync(voll, "utf8");

  for (const m of new Set([...quelle.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)].map((x) => x[1]))) {
    kennungenGeprueft++;
    if (!seiten.some((s) => htmlVon(s).includes('id="' + m + '"'))) {
      fehlendeKennungen.push(skript + " -> " + m);
    }
  }

  const blaetter = new Set([
    ...[...quelle.matchAll(/\bblatt\(\s*"([^"]+)"\s*\)/g)].map((x) => x[1]),
    ...[...quelle.matchAll(/\bwaehlen\(\s*"([^"]+)"\s*\)/g)].map((x) => x[1])
  ]);
  for (const b of blaetter) {
    blaetterGeprueft++;
    if (!seiten.some((s) => htmlVon(s).includes('data-blatt="' + b + '"'))) {
      fehlendeBlaetter.push(skript + " -> " + b);
    }
  }
}

pruefe("kennungen: jede getElementById-Kennung steht im HTML", fehlendeKennungen, []);
pruefe("kennungen: jeder Blattname steht im HTML", fehlendeBlaetter, []);
pruefe("kennungen: es wurde ueberhaupt etwas geprueft", kennungenGeprueft > 100, true);

/* Bezeichner mit Umlaut sind in diesem Projekt nicht vorgesehen. Sie
   entstehen praktisch nur durch ein verrutschtes Suchen-und-Ersetzen. */
const umlautBezeichner = [];
for (const datei of fs.readdirSync(path.join(WURZEL, "site", "assets", "js"))) {
  if (!datei.endsWith(".js")) continue;
  const quelle = fs.readFileSync(path.join(WURZEL, "site", "assets", "js", datei), "utf8");
  /* Blockkommentare gehen ueber Zeilen hinweg. Ohne diesen Zustand meldet
     die Probe jeden deutschen Kommentar als Bezeichner. */
  let imKommentar = false;
  /* Mit split("\n") bliebe bei CRLF ein \r am Zeilenende stehen — und in
     JavaScript passt der Punkt NICHT auf \r. Dann greift /\/\/.*$/ nicht
     mehr, jeder Zeilenkommentar bleibt stehen und wird als Bezeichner
     gemeldet. */
  for (let zeile of quelle.split(/\r?\n/)) {
    if (imKommentar) {
      const schluss = zeile.indexOf("*/");
      if (schluss === -1) continue;
      imKommentar = false;
      zeile = zeile.slice(schluss + 2);
    }
    const anfang = zeile.lastIndexOf("/*");
    if (anfang !== -1 && zeile.indexOf("*/", anfang) === -1) {
      imKommentar = true;
      zeile = zeile.slice(0, anfang);
    }
    /* Zeichenketten, Kommentare und Zeichenklassen ausblenden */
    const blank = zeile
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''")
      .replace(/`(?:[^`\\]|\\.)*`/g, "``")
      .replace(/\/\*.*?\*\//g, "")
      .replace(/\/\/.*$/, "")
      .replace(/\/(?:[^/\\\n]|\\.)+\/[gimsuy]*/g, "//");
    const treffer = blank.match(/[A-Za-z_][A-Za-z0-9_]*[äöüßÄÖÜ][A-Za-z0-9_äöüßÄÖÜ]*/g);
    if (treffer) umlautBezeichner.push(datei + ": " + treffer.join(", "));
  }
}
pruefe("kennungen: keine Bezeichner mit Umlaut", umlautBezeichner, []);

/* ---------- Abrufrelais: ein Vertrag, zwei Fassungen ---------- */

/* Das Relais gibt es zweimal: als Node-Dienst und als Wix-Velo-Datei.
   Sie muessen dasselbe Antwortformat liefern, sonst funktioniert die
   Browserseite nur mit einer von beiden — und man merkt es erst, wenn
   jemand die andere einsetzt. Getestet wird ohne Netz: beide Quellen
   werden gelesen und auf dieselben Felder geprueft. */

const relaisNode = fs.readFileSync(path.join(WURZEL, "cli", "relais.mjs"), "utf8");
const relaisVelo = fs.readFileSync(path.join(WURZEL, "backend", "http-functions.js"), "utf8");

const VERTRAG = ["ok", "angefragt", "ziel", "status", "kette", "spruenge",
  "kopf", "cookies", "html", "bytes", "abgeschnitten", "ttfb"];

/* Node schreibt `kette,` (Kurzschreibweise), Velo `kette: kette`. Beides
   ist derselbe Vertrag — das Muster muss beides zulassen, sonst prueft
   es einen Stilunterschied statt einer Zusage. */
function nenntFeld(quelle, feld) {
  return new RegExp("(^|[\\s{,])" + feld + "\\s*[,:}\\n]").test(quelle);
}
for (const feld of VERTRAG) {
  pruefe("relais: Node kennt das Feld " + feld, nenntFeld(relaisNode, feld), true);
  pruefe("relais: Velo kennt das Feld " + feld, nenntFeld(relaisVelo, feld), true);
}

/* Beide muessen dieselben Ziele abweisen. Eine Fassung, die localhost
   durchlaesst, ist ein offenes Tor in das Netz, in dem sie steht.

   Im Quelltext stehen die Bereiche als maskierte Ausdruecke (192\.168).
   Zum Suchen werden die Maskierungen entfernt — sonst prueft man die
   Schreibweise des Ausdrucks statt seines Inhalts. */
const ohneMaske = (t) => t.replace(/\\/g, "");
/* Ohne Punkt: die eine Fassung schreibt `127\.`, die andere
   `(10|127|0)\.` — dasselbe Verbot, andere Schreibweise. Geprueft wird,
   dass die Zahl ueberhaupt vorkommt; wer den Schutz entfernt, entfernt
   sie mit. Dass er wirklich greift, ist am laufenden Dienst gemessen. */
const SPERREN = ["localhost", "127", "192.168", "169.254", "172", ".internal", ".local"];
for (const wort of SPERREN) {
  pruefe("relais: Node sperrt " + wort, ohneMaske(relaisNode).includes(wort), true);
  pruefe("relais: Velo sperrt " + wort, ohneMaske(relaisVelo).includes(wort), true);
}

/* Beide antworten mit CORS, sonst kann der Browser sie nicht lesen. */
pruefe("relais: Node erlaubt CORS", /Access-Control-Allow-Origin/.test(relaisNode), true);
pruefe("relais: Velo erlaubt CORS", /Access-Control-Allow-Origin/.test(relaisVelo), true);

/* Und beide folgen Weiterleitungen VON HAND — sonst geht die Kette
   verloren, und die ist der haeufigste Fund bei einem Umzug. */
pruefe("relais: Node folgt von Hand", /redirect:\s*["']manual["']/.test(relaisNode), true);
pruefe("relais: Velo folgt von Hand", /redirect:\s*["']manual["']/.test(relaisVelo), true);

/* Auf einer Wix-Site gibt es nur EINE http-functions.js. Wo schon eine
   liegt (hnvr.me: seocheck), wird unser Relais darunter gesetzt. Ein
   Import ohne eigenen Namen kollidiert dann mit den vorhandenen, und die
   ganze Datei faellt aus. Jeder Import muss deshalb ueber `as` laufen. */
{
  const importe = relaisVelo.split(/\r?\n/).filter((z) => /^\s*import\s/.test(z));
  const ohneAlias = importe.filter((z) => {
    const namen = ((z.match(/\{([^}]*)\}/) || [])[1] || "")
      .split(",").map((t) => t.trim()).filter(Boolean);
    return !namen.length || namen.some((t) => !/^\w+\s+as\s+\w+$/.test(t));
  });
  pruefe("relais: Velo laesst sich unter vorhandenen Code setzen", ohneAlias, []);
}

/* Die Browserseite darf keine zweite Fassung der Regeln enthalten.
   Wenn dort ein Regelsatz auftaucht, ist die Trennung aufgegeben. */
const abrufQuelle = fs.readFileSync(path.join(WURZEL, "site", "assets", "js", "abruf.js"), "utf8");
pruefe("relais: die Browserseite urteilt nicht",
  /SEORANK_KATALOG|SEORANK_DOMAIN\.pruefen|stufe:\s*["'](kritisch|wichtig)/.test(abrufQuelle), false);

/* Jede Werkzeugleiste, die sich beim Relais anmeldet, muss auf
   vorhandene Kennungen zeigen. Ein Tippfehler waere sonst unsichtbar:
   der Knopf erscheint, tut aber nichts. */
const abrufFehler = [];
for (const datei of seitenDateien) {
  const html = htmlVon(datei);
  for (const m of html.matchAll(/<div class="werkzeugleiste"([^>]*)>/g)) {
    const attr = m[1];
    if (!/data-abruf-art/.test(attr)) continue;
    const art = (attr.match(/data-abruf-art="([^"]*)"/) || [])[1];
    const feld = (attr.match(/data-abruf-feld="([^"]*)"/) || [])[1];
    const start = (attr.match(/data-abruf-start="([^"]*)"/) || [])[1];
    if (!["seite", "robots", "sitemap", "mehrere", "snippet"].includes(art)) {
      abrufFehler.push(datei + ": unbekannte Art " + art);
    }
    if (feld && !html.includes('id="' + feld + '"')) abrufFehler.push(datei + ": Feld " + feld + " gibt es nicht");
    if (start && !html.includes('id="' + start + '"')) abrufFehler.push(datei + ": Knopf " + start + " gibt es nicht");
    if (!html.includes("assets/js/abruf.js")) abrufFehler.push(datei + ": abruf.js nicht eingebunden");
  }
}
pruefe("relais: jede Anmeldung zeigt auf vorhandene Kennungen", abrufFehler, []);

/* ---------- Pruefwerk ----------
   Seit dem 22.09.2026 stehen die Urteile von robots- und Sitemap-Pruefer
   und der Domain-Sammler in pruefwerk.js, weil auch das Protokoll sie
   braucht. Diese Proben halten fest, dass es dabei bei EINER Fassung
   bleibt und dass das Urteil stimmt. */

abschnitt("Pruefwerk");

const pwQuelle = fs.readFileSync(path.join(WURZEL, "site", "assets", "js", "pruefwerk.js"), "utf8");
const pw = new Function(robotsQuelle + "\n" + pwQuelle + "\nreturn SEORANK_PRUEFWERK;")();

const gesperrt = pw.robotsUrteil("User-agent: *\nDisallow: /", "/", "Googlebot");
pruefe("pruefwerk: Disallow: / sperrt Googlebot", gesperrt.urteil.erlaubt, false);
pruefe("pruefwerk: Disallow: / ist kritisch", gesperrt.befunde.filter(b => b.stufe === "kritisch").map(b => b.name), ["Die gesamte Website ist gesperrt"]);
pruefe("pruefwerk: Allow schlaegt kuerzeres Disallow", pw.robotsUrteil(beispielRobots, "/intern/handbuch/x", "Googlebot").urteil.erlaubt, true);
pruefe("pruefwerk: fuenfzehn benannte Crawler", pw.crawlerEntscheiden(gelesen, "/").length, 15);
pruefe("pruefwerk: KI-Crawler duerfen im Beispiel lesen", pw.robotsUrteil(beispielRobots, "/", "Googlebot").befunde.filter(b => b.name === "Antwortmaschinen dürfen lesen").length, 1);

const jsDatei = n => fs.readFileSync(path.join(WURZEL, "site", "assets", "js", n), "utf8");
const zweiteFassung = [];
if (/KI_CRAWLER\s*=\s*\[/.test(jsDatei("werkzeuge.js"))) zweiteFassung.push("werkzeuge.js fuehrt eigene KI-Crawler");
if (/parseFromString\(roh, "application\/xml"\)/.test(jsDatei("werkzeuge.js"))) zweiteFassung.push("werkzeuge.js liest Sitemaps selbst");
if (/cloudflare-dns\.com\/dns-query/.test(jsDatei("domain.js"))) zweiteFassung.push("domain.js fragt DNS selbst");
if (/function relaisHolen/.test(jsDatei("domain.js"))) zweiteFassung.push("domain.js holt selbst ueber das Relais");
pruefe("pruefwerk: keine zweite Fassung der Urteile", zweiteFassung, []);

const pwFehlt = [];
for (const [datei, nach] of [["robots.html", "werkzeuge.js"], ["sitemap.html", "werkzeuge.js"], ["domain.html", "domain.js"], ["pruefer.html", "protokoll.js"]]) {
  const html = fs.readFileSync(path.join(WURZEL, "site", datei), "utf8");
  const a = html.indexOf("assets/js/pruefwerk.js"), b = html.indexOf("assets/js/" + nach);
  if (a < 0) pwFehlt.push(datei + ": pruefwerk.js fehlt");
  else if (b < 0 || a > b) pwFehlt.push(datei + ": pruefwerk.js steht nicht vor " + nach);
}
pruefe("pruefwerk: vor seinen Nutzern eingebunden", pwFehlt, []);

/* ---------- Ergebnis ---------- */

console.log("\n" + geprueft + " Prüfungen, " + gescheitert + " gescheitert");
process.exit(gescheitert ? 1 : 0);
