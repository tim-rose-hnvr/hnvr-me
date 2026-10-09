/* seo-rank.me — Crawler.
   Geht eine Domain durch, prueft jede Seite gegen den Regelkatalog und
   ergaenzt die Befunde, die man nur beim Abruf sieht: Statuscodes,
   Weiterleitungsketten, Antwortzeiten, tote interne Verweise und
   Doppelungen ueber Seiten hinweg.

   Haelt sich an robots.txt, laeuft mit Pause zwischen den Abrufen und
   nur auf einem Host. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pruefeQuelltext, WURZEL } from "./kern.mjs";

const KENNUNG = "seo-rank.me/1.0 (+eigenes Pruefwerkzeug)";
const LANGSAM_MS = 2500;

let robotsregeln = null;
function robotsWerkzeug() {
  if (robotsregeln) return robotsregeln;
  const datei = path.join(WURZEL, "site", "assets", "js", "robotsregeln.js");
  const quelle = fs.readFileSync(datei, "utf8");
  robotsregeln = new Function(quelle + "\nreturn SEORANK_ROBOTS;")();
  return robotsregeln;
}

function schlafen(ms) {
  return new Promise((weiter) => setTimeout(weiter, ms));
}

function normalisieren(adresse, basis) {
  try {
    const u = new URL(adresse, basis);
    u.hash = "";
    // Ein abschliessender Schraegstrich ist dieselbe Seite wie ohne,
    // solange kein Pfad dahinter kommt. Wir vereinheitlichen auf "mit".
    if (u.pathname === "") u.pathname = "/";
    return u.href;
  } catch {
    return null;
  }
}

function istHTML(antwort) {
  const typ = (antwort.headers.get("content-type") || "").toLowerCase();
  return typ.includes("text/html") || typ.includes("application/xhtml");
}

/* ---------- Ein Abruf mit Verfolgung der Weiterleitungen ---------- */

async function abrufen(adresse) {
  const kette = [];
  let jetzt = adresse;
  const beginn = Date.now();

  for (let sprung = 0; sprung < 10; sprung++) {
    const antwort = await fetch(jetzt, {
      redirect: "manual",
      headers: { "user-agent": KENNUNG, accept: "text/html,application/xhtml+xml" }
    });

    const ort = antwort.headers.get("location");
    if (antwort.status >= 300 && antwort.status < 400 && ort) {
      const ziel = normalisieren(ort, jetzt);
      kette.push({ von: jetzt, status: antwort.status, nach: ziel });
      if (!ziel || kette.length >= 10) break;
      jetzt = ziel;
      continue;
    }

    const dauer = Date.now() - beginn;
    const text = istHTML(antwort) ? await antwort.text() : "";
    return { adresse: jetzt, status: antwort.status, dauer, kette, text, html: istHTML(antwort) };
  }

  return { adresse: jetzt, status: 310, dauer: Date.now() - beginn, kette, text: "", html: false };
}

/* ---------- Verweise einsammeln ---------- */

function verweiseSammeln(dokument, basis) {
  const intern = new Set();
  const alleZiele = [];
  const heimat = new URL(basis).host;

  for (const a of dokument.querySelectorAll("a[href]")) {
    const roh = (a.getAttribute("href") || "").trim();
    if (!roh || /^(mailto|tel|javascript|data):/i.test(roh) || roh.startsWith("#")) continue;
    const ziel = normalisieren(roh, basis);
    if (!ziel) continue;
    alleZiele.push({ ziel, text: a.textContent.trim().slice(0, 60) });
    try {
      if (new URL(ziel).host === heimat) intern.add(ziel);
    } catch { /* unbrauchbare Adresse */ }
  }

  return { intern: [...intern], alleZiele };
}

/* ---------- Der Lauf ---------- */

export async function crawlen(start, einstellungen = {}) {
  const {
    max = 200, tiefe = 5, verzoegerung = 250, robots = true,
    nur = null, ohne = null, melden = () => {}
  } = einstellungen;

  const startAdresse = normalisieren(start, start);
  if (!startAdresse) throw new Error("Unbrauchbare Startadresse: " + start);

  const heimat = new URL(startAdresse);
  let robotsGruppe = null;

  if (robots) {
    try {
      const antwort = await fetch(new URL("/robots.txt", heimat).href, {
        headers: { "user-agent": KENNUNG }
      });
      if (antwort.ok) {
        const werkzeug = robotsWerkzeug();
        const gelesen = werkzeug.lesen(await antwort.text());
        robotsGruppe = werkzeug.gruppeFuer(gelesen.gruppen, "seo-rank.me");
        melden("robots.txt gelesen: " + gelesen.gruppen.length + " Gruppe(n), " +
          gelesen.sitemaps.length + " Sitemap-Eintrag/Eintraege");
      } else {
        melden("Keine robots.txt (HTTP " + antwort.status + "), es gilt alles als erlaubt");
      }
    } catch (fehler) {
      melden("robots.txt nicht abrufbar: " + fehler.message);
    }
  }

  const werkzeug = robotsWerkzeug();
  const gesehen = new Set([startAdresse]);
  const warteschlange = [{ adresse: startAdresse, tiefe: 0, herkunft: null }];
  const seiten = [];
  const antworten = new Map();     // Adresse → { status, kette, dauer }
  const verweiseAuf = new Map();   // Ziel → [Herkunft]

  while (warteschlange.length && seiten.length < max) {
    const auftrag = warteschlange.shift();

    if (robotsGruppe) {
      const pfad = new URL(auftrag.adresse).pathname + new URL(auftrag.adresse).search;
      const urteil = werkzeug.entscheiden(robotsGruppe, pfad);
      if (!urteil.erlaubt) {
        melden("robots.txt sperrt " + auftrag.adresse + " (" + urteil.grund + ")");
        continue;
      }
    }

    let abruf;
    try {
      abruf = await abrufen(auftrag.adresse);
    } catch (fehler) {
      seiten.push({ quelle: auftrag.adresse, fehler: fehler.message, befunde: [] });
      antworten.set(auftrag.adresse, { status: 0, kette: [], dauer: 0, fehler: fehler.message });
      continue;
    }

    antworten.set(auftrag.adresse, { status: abruf.status, kette: abruf.kette, dauer: abruf.dauer });
    melden("[" + (seiten.length + 1) + "/" + max + "] " + abruf.status + " " +
      abruf.dauer + " ms  " + auftrag.adresse);

    if (!abruf.html || abruf.status >= 400) {
      seiten.push({
        quelle: auftrag.adresse, geprueft: 0, uebersprungen: 0, bestanden: 0,
        kritisch: 0, wichtig: 0, hinweise: 0, befunde: [],
        abruf: { status: abruf.status, dauer: abruf.dauer, kette: abruf.kette }
      });
      continue;
    }

    const ergebnis = pruefeQuelltext(abruf.text, { nur, ohne });
    const abrufBefunde = befundeAusAbruf(abruf);

    const alleBefunde = abrufBefunde.concat(ergebnis.befunde);
    const dokument = ergebnis.dokument;
    delete ergebnis.dokument;

    seiten.push({
      quelle: auftrag.adresse,
      ...ergebnis,
      befunde: alleBefunde,
      kritisch: alleBefunde.filter((b) => b.stufe === "kritisch").length,
      wichtig: alleBefunde.filter((b) => b.stufe === "wichtig").length,
      hinweise: alleBefunde.filter((b) => b.stufe === "hinweis").length,
      titel: (dokument.querySelector("title")?.textContent || "").trim(),
      beschreibung: (dokument.querySelector('meta[name="description" i]')?.getAttribute("content") || "").trim(),
      kanonisch: normalisieren(
        (dokument.querySelector('link[rel="canonical" i]')?.getAttribute("href") || "").trim() || auftrag.adresse,
        auftrag.adresse
      ),
      abruf: { status: abruf.status, dauer: abruf.dauer, kette: abruf.kette }
    });

    const { intern, alleZiele } = verweiseSammeln(dokument, abruf.adresse);
    for (const z of alleZiele) {
      if (!verweiseAuf.has(z.ziel)) verweiseAuf.set(z.ziel, []);
      verweiseAuf.get(z.ziel).push(auftrag.adresse);
    }

    if (auftrag.tiefe < tiefe) {
      for (const ziel of intern) {
        if (gesehen.has(ziel)) continue;
        gesehen.add(ziel);
        warteschlange.push({ adresse: ziel, tiefe: auftrag.tiefe + 1, herkunft: auftrag.adresse });
      }
    }

    if (verzoegerung > 0 && warteschlange.length) await schlafen(verzoegerung);
  }

  if (warteschlange.length) {
    melden("Grenze von " + max + " Seiten erreicht, " + warteschlange.length + " Adressen nicht geprüft");
  }

  return { start: startAdresse, seiten, antworten, verweiseAuf, gesehen };
}

/* ---------- Befunde, die nur der Abruf zeigt ---------- */

function befundeAusAbruf(abruf) {
  const aus = [];

  if (abruf.kette.length === 1) {
    aus.push({
      id: "weiterleitung", gruppe: "Abruf", name: "Weiterleitung",
      stufe: "hinweis",
      wie: "Die Adresse leitet einmal weiter (HTTP " + abruf.kette[0].status + "). Verweise sollten gleich auf das Ziel zeigen.",
      fund: abruf.kette.map((k) => k.von + " → " + k.nach).join("\n")
    });
  } else if (abruf.kette.length > 1) {
    aus.push({
      id: "weiterleitungskette", gruppe: "Abruf", name: "Weiterleitungskette",
      stufe: "wichtig",
      wie: abruf.kette.length + " Weiterleitungen hintereinander. Jeder Sprung kostet Zeit, und ab dem fünften bricht Google ab.",
      fund: abruf.kette.map((k) => k.status + "  " + k.von + " → " + k.nach).join("\n")
    });
  }

  if (abruf.dauer > LANGSAM_MS) {
    aus.push({
      id: "langsame-antwort", gruppe: "Abruf", name: "Langsame Antwort",
      stufe: "wichtig",
      wie: "Der Server hat " + abruf.dauer + " ms gebraucht. Ab etwa " + LANGSAM_MS + " ms zählt das als schlechte Erfahrung.",
      fund: null
    });
  }

  if (!abruf.html && abruf.status < 400) {
    aus.push({
      id: "kein-html", gruppe: "Abruf", name: "Keine HTML-Antwort",
      stufe: "hinweis",
      wie: "Die Adresse liefert kein HTML und wurde nicht gegen den Regelsatz geprüft.",
      fund: null
    });
  }

  return aus;
}

/* ---------- Befunde ueber alle Seiten hinweg ---------- */

export function crawlBefunde(lauf) {
  const aus = [];
  const seiten = lauf.seiten.filter((s) => !s.fehler);

  // Tote interne Verweise
  const tot = [];
  for (const [ziel, herkunft] of lauf.verweiseAuf) {
    const antwort = lauf.antworten.get(ziel);
    if (!antwort) continue;
    if (antwort.fehler || antwort.status >= 400) {
      tot.push((antwort.status || "Fehler") + "  " + ziel + "\n      verlinkt von: " + herkunft.slice(0, 3).join(", "));
    }
  }
  if (tot.length) {
    aus.push({
      id: "verweis-tot", gruppe: "Abruf", name: "Interner Verweis zeigt ins Leere",
      stufe: "kritisch",
      wie: tot.length + " intern verlinkte Adresse(n) antworten mit einem Fehler.",
      fund: tot.slice(0, 8).join("\n")
    });
  }

  /* Zwei Adressen mit derselben kanonischen Angabe sind dieselbe Seite.
     Sie duerfen nicht als Doppelung gezaehlt werden. */
  const jeKanonisch = new Map();
  for (const s of seiten) {
    const schluessel = s.kanonisch || s.quelle;
    if (!jeKanonisch.has(schluessel)) jeKanonisch.set(schluessel, s);
  }
  const eigenstaendige = [...jeKanonisch.values()];

  // Doppelte Titel
  const nachTitel = new Map();
  for (const s of eigenstaendige) {
    if (!s.titel) continue;
    if (!nachTitel.has(s.titel)) nachTitel.set(s.titel, []);
    nachTitel.get(s.titel).push(s.quelle);
  }
  const doppelteTitel = [...nachTitel].filter(([, liste]) => liste.length > 1);
  if (doppelteTitel.length) {
    aus.push({
      id: "titel-ueber-seiten-doppelt", gruppe: "Abruf", name: "Derselbe Titel auf mehreren Seiten",
      stufe: "wichtig",
      wie: doppelteTitel.length + " Titel kommen mehrfach vor. In der Trefferliste sind die Seiten dann nicht zu unterscheiden.",
      fund: doppelteTitel.slice(0, 5).map(([t, liste]) => "„" + t + "“ auf " + liste.length + " Seiten:\n      " + liste.slice(0, 3).join("\n      ")).join("\n")
    });
  }

  // Doppelte Beschreibungen
  const nachText = new Map();
  for (const s of eigenstaendige) {
    if (!s.beschreibung) continue;
    if (!nachText.has(s.beschreibung)) nachText.set(s.beschreibung, []);
    nachText.get(s.beschreibung).push(s.quelle);
  }
  const doppelteTexte = [...nachText].filter(([, liste]) => liste.length > 1);
  if (doppelteTexte.length) {
    aus.push({
      id: "beschreibung-ueber-seiten-doppelt", gruppe: "Abruf", name: "Dieselbe Beschreibung auf mehreren Seiten",
      stufe: "hinweis",
      wie: doppelteTexte.length + " Beschreibung(en) kommen mehrfach vor.",
      fund: doppelteTexte.slice(0, 5).map(([t, liste]) => "„" + t.slice(0, 60) + "…“ auf " + liste.length + " Seiten").join("\n")
    });
  }

  // Adressen, die kanonisch auf eine andere Seite zeigen
  const zusammengelegt = seiten
    .filter((s) => s.kanonisch && s.kanonisch !== s.quelle)
    .map((s) => s.quelle + "\n      kanonisch: " + s.kanonisch);
  if (zusammengelegt.length) {
    aus.push({
      id: "kanonisch-zeigt-woanders", gruppe: "Abruf", name: "Adresse zeigt kanonisch auf eine andere Seite",
      stufe: "hinweis",
      wie: zusammengelegt.length + " abgerufene Adresse(n) benennen eine andere Seite als die maßgebliche. Interne Verweise sollten gleich dorthin zeigen.",
      fund: zusammengelegt.slice(0, 8).join("\n")
    });
  }

  // Seiten ohne eingehenden internen Verweis
  const verwaist = seiten
    .filter((s) => s.quelle !== lauf.start && !(lauf.verweiseAuf.get(s.quelle) || []).length)
    .map((s) => s.quelle);
  if (verwaist.length) {
    aus.push({
      id: "seite-verwaist", gruppe: "Abruf", name: "Seite ohne eingehenden Verweis",
      stufe: "hinweis",
      wie: verwaist.length + " Seite(n) wurden erreicht, aber von keiner anderen geprüften Seite verlinkt.",
      fund: verwaist.slice(0, 8).join("\n")
    });
  }

  return aus;
}
