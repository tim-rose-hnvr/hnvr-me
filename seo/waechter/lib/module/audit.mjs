/* Modul Website-Audit: eine Seite oder ein Crawl, Regeln aus dem Katalog. */

import { pruefeQuelltext, analyseLaden, crawlen, crawlBefunde, KENNUNG } from "../werk.mjs";
import { adresseLesen, NutzerFehler } from "../schutz.mjs";
import { pagespeed } from "./google.mjs";
import { analysieren } from "./ladezeit.mjs";
import { seiteHolen, istHtml } from "../abruf.mjs";

const RANG = { kritisch: 0, wichtig: 1, hinweis: 2 };

function sortieren(liste) {
  return liste.sort((a, b) => RANG[a.stufe] - RANG[b.stufe] ||
    (b.gewicht || 1) * (b.seiten || 1) - (a.gewicht || 1) * (a.seiten || 1));
}

function knapp(b) {
  return {
    id: b.id, gruppe: b.gruppe, name: b.name, stufe: b.stufe, wie: b.wie,
    fund: b.fund ? String(b.fund).slice(0, 1200) : null,
    beheben: b.beheben || null, wirkung: b.wirkung || null, gewicht: b.gewicht || 1
  };
}

export async function seite(url, mitTempo, mitLadezeit = true) {
  const t0 = Date.now();
  const tempo = mitTempo ? pagespeed(url, "mobile") : null;
  const s = await seiteHolen(url);
  const roh = s.text;
  const dauer = Date.now() - t0;
  if (!istHtml(s)) throw new NutzerFehler("Unter dieser Adresse liegt keine HTML-Seite, sondern " + (s.typ.split(";")[0] || "eine Datei") + " (Status " + s.status + ").");
  const e = pruefeQuelltext(roh);
  const A = analyseLaden();
  let profil = null, gliederung = [];
  try { profil = A.profil(e.dokument, roh); } catch (x) { profil = null; }
  try { gliederung = A.gliederung(e.dokument).slice(0, 80); } catch (x) { gliederung = []; }
  const titel = (e.dokument.querySelector("title")?.textContent || "").trim();
  const ladezeit = mitLadezeit ? await analysieren(s.url, e.dokument, Buffer.byteLength(roh), s.kodierung).catch(() => null) : null;
  const eigene = [];
  if (s.zertifikatFehler) eigene.push({ id: "zertifikat-ungueltig", gruppe: "Sicherheit", name: "Zertifikat ungültig", stufe: "kritisch", gewicht: 20, wie: s.zertifikatFehler + " Browser zeigen eine Warnung statt der Seite; Suchmaschinen und Besucher kommen nicht an. Die Seite wurde trotzdem gelesen, damit die übrigen Befunde vorliegen.", beheben: "Ein gültiges Zertifikat einrichten, etwa kostenlos über Let's Encrypt, und die automatische Verlängerung prüfen." });
  if (s.status >= 400) eigene.push({ id: "status-fehler", gruppe: "Abruf", name: "Seite antwortet mit Fehler " + s.status, stufe: "kritisch", gewicht: 20, wie: "Unter dieser Adresse liefert der Server einen Fehler. Suchmaschinen nehmen die Seite nicht in den Index.", beheben: "Seite wiederherstellen oder mit 301 auf die passende Seite weiterleiten." });
  const woerter = profil?.woerter ?? profil?.text?.woerter;
  if (typeof woerter === "number" && woerter < 30 && s.status < 400) eigene.push({ id: "kaum-text", gruppe: "Inhalt", name: "Kaum Text im HTML", stufe: "wichtig", gewicht: 8, wie: "Die Seite liefert nur " + woerter + " Wörter im HTML. Vermutlich kommt der Inhalt erst per JavaScript; Suchmaschinen und KI-Dienste sehen ihn dann verzögert oder gar nicht.", beheben: "Wichtige Inhalte serverseitig ausliefern (Server-Side Rendering oder statisch erzeugte Seiten)." });
  const alle = sortieren([...eigene, ...e.befunde.map((b) => ({ ...knapp(b), seiten: 1, beispiele: [s.url] })), ...(ladezeit ? ladezeit.befunde.map((b) => ({ ...b, seiten: 1, gewicht: b.stufe === "wichtig" ? 6 : 2 })) : [])]);
  const z = (st) => alle.filter((b) => b.stufe === st).length;
  const punkte = Math.max(0, e.punkte.gesamt - (s.zertifikatFehler ? 25 : 0) - (s.status >= 400 ? 25 : 0));
  return {
    modul: "audit", umfang: "seite", ziel: s.url, status: s.status, dauer, zertifikatFehler: s.zertifikatFehler,
    punkte,
    gruppen: e.punkte.gruppen.map((g) => ({ name: g.name, wert: g.wert, befunde: g.befunde, regeln: g.regeln })),
    geprueft: e.geprueft, uebersprungen: e.uebersprungen, bestanden: e.bestanden,
    kritisch: z("kritisch"), wichtig: z("wichtig"), hinweise: z("hinweis"),
    seiten: 1, titel,
    befunde: alle,
    profil: profil ? JSON.parse(JSON.stringify(profil)) : null,
    gliederung, ladezeit: ladezeit ? { ...ladezeit, befunde: undefined } : null,
    tempo: tempo ? await tempo : null,
    kurz: punkte + " von 100 · " + z("kritisch") + " kritisch, " + z("wichtig") + " wichtig, " + z("hinweis") + " Hinweise"
  };
}

export async function website(url, max, melden) {
  const t0 = Date.now();
  const lauf = await crawlen(url, { max, tiefe: 6, verzoegerung: 250, melden: melden || (() => {}) });
  const quer = crawlBefunde(lauf);
  const seiten = lauf.seiten;
  const gezaehlt = new Map();
  for (const s of seiten) {
    for (const b of s.befunde || []) {
      if (!gezaehlt.has(b.id)) gezaehlt.set(b.id, { ...knapp(b), seiten: 0, beispiele: [] });
      const g = gezaehlt.get(b.id);
      g.seiten++;
      if (g.beispiele.length < 8) g.beispiele.push(s.quelle);
    }
  }
  for (const b of quer) gezaehlt.set("quer:" + b.id, { ...knapp(b), seiten: 0, beispiele: [], quer: true });
  const mitPunkten = seiten.filter((s) => s.punkte && typeof s.punkte.gesamt === "number");
  const punkte = mitPunkten.length ? Math.round(mitPunkten.reduce((a, s) => a + s.punkte.gesamt, 0) / mitPunkten.length) : 0;
  const statuscodes = {};
  for (const [, a] of lauf.antworten) {
    const k = a.fehler ? "Fehler" : String(a.status);
    statuscodes[k] = (statuscodes[k] || 0) + 1;
  }
  const gruppenSumme = new Map();
  for (const s of mitPunkten) for (const g of s.punkte.gruppen) {
    if (!gruppenSumme.has(g.name)) gruppenSumme.set(g.name, { name: g.name, summe: 0, n: 0, befunde: 0 });
    const x = gruppenSumme.get(g.name); x.summe += g.wert; x.n++; x.befunde += g.befunde;
  }
  const befunde = sortieren([...gezaehlt.values()]);
  const zahl = (st) => befunde.filter((b) => b.stufe === st).length;
  const dauern = seiten.map((s) => s.abruf?.dauer).filter((d) => typeof d === "number");
  return {
    modul: "audit", umfang: "website", ziel: lauf.start, dauer: Date.now() - t0,
    punkte, seiten: seiten.length, gefunden: lauf.gesehen.size,
    grenzeErreicht: lauf.gesehen.size > seiten.length,
    gruppen: [...gruppenSumme.values()].map((g) => ({ name: g.name, wert: Math.round(g.summe / g.n), befunde: g.befunde })),
    kritisch: zahl("kritisch"), wichtig: zahl("wichtig"), hinweise: zahl("hinweis"),
    statuscodes,
    antwortzeit: dauern.length ? Math.round(dauern.reduce((a, b) => a + b, 0) / dauern.length) : null,
    befunde,
    seitenListe: seiten.map((s) => ({
      url: s.quelle, status: s.abruf?.status || 0, fehler: s.fehler || null,
      punkte: s.punkte?.gesamt ?? null, titel: s.titel || "",
      kritisch: s.kritisch || 0, wichtig: s.wichtig || 0, hinweise: s.hinweise || 0
    })),
    kurz: punkte + " von 100 · " + seiten.length + " Seiten · " + zahl("kritisch") + " kritische Befundarten"
  };
}

export async function pruefen(eingabe, ctx) {
  const url = adresseLesen(eingabe.url);
  if (eingabe.umfang === "website") {
    const max = Math.max(1, Math.min(Number(eingabe.max) || ctx.maxSeiten, ctx.maxSeiten));
    return website(url, max, ctx.melden);
  }
  return seite(url, eingabe.tempo !== false);
}
