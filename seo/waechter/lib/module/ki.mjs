/* Modul KI-Sichtbarkeit.
   Zugang (immer verfuegbar): duerfen die KI-Crawler lesen (robots.txt nach
   dem Regelwerk des Pruefwerks), gibt es eine llms.txt, strukturierte Daten.
   Fragen (nur mit Zugangsdaten): dieselbe Frage an die eingerichteten
   KI-Dienste, Nennung der Marke und zitierte Quellen. */

import { PRUEFWERK, pruefeQuelltext, messenLaden, KENNUNG } from "../werk.mjs";
import { parseHTML } from "../../../cli/dom.mjs";
import { adresseLesen, domainLesen, NutzerFehler } from "../schutz.mjs";
import { seiteHolen, istHtml } from "../abruf.mjs";
import { kiAnbieter, kiFragen } from "./extern.mjs";

/* Zugang und Zitierfaehigkeit. Die Website muss erreichbar sein; sonst gibt es
   kein Ergebnis (frueher meldete der Waechter dann faelschlich „alle duerfen lesen“). */
export async function zugang(eingabe) {
  const s = await seiteHolen(adresseLesen(eingabe));
  if (!istHtml(s)) throw new NutzerFehler("Unter dieser Adresse liegt keine HTML-Seite.");
  const start = s.url;
  const basis = new URL(start).origin;
  const R = PRUEFWERK.robots;
  const M = messenLaden();
  const roh = s.text;
  const d = parseHTML(roh);
  const e = pruefeQuelltext(roh);
  let robotsText = null, robotsStatus = 0;
  try { const a = await fetch(basis + "/robots.txt", { headers: { "user-agent": KENNUNG } }); robotsStatus = a.status; if (a.ok) robotsText = await a.text(); } catch (x) { robotsStatus = 0; }
  const robotsUnklar = robotsStatus === 0 || robotsStatus >= 500;
  const gelesen = robotsText ? R.lesen(robotsText) : { gruppen: [], sitemaps: [] };
  const crawler = PRUEFWERK.werk.KI_CRAWLER.map(([agent, wer]) => {
    if (robotsUnklar) return { agent, wer, erlaubt: false, grund: "robots.txt nicht abrufbar (" + (robotsStatus || "keine Antwort") + ")" };
    const g = R.gruppeFuer(gelesen.gruppen, agent);
    const u = g ? R.entscheiden(g, "/") : { erlaubt: true, grund: "keine Regel" };
    return { agent, wer, erlaubt: u.erlaubt, grund: u.grund || null };
  });
  let llms = { status: 0, vorhanden: false };
  try { const a = await fetch(basis + "/llms.txt", { headers: { "user-agent": KENNUNG } }); llms = { status: a.status, vorhanden: a.ok && !/<html/i.test((await a.text()).slice(0, 500)) }; } catch (x) { /* bleibt */ }
  let sitemap = gelesen.sitemaps.length > 0;
  if (!sitemap) { try { const a = await fetch(basis + "/sitemap.xml", { headers: { "user-agent": KENNUNG } }); sitemap = a.ok; } catch (x) { /* bleibt */ } }
  const objekte = M.ldObjekte(d) || [];
  const typen = [...new Set(objekte.map((o) => [].concat(o["@type"] || []).join("/")).filter(Boolean))];
  const org = objekte.find((o) => /Organization|LocalBusiness|Store|Corporation|Restaurant|ProfessionalService/i.test([].concat(o["@type"] || []).join(" ")));
  const q = (sel) => [...d.querySelectorAll(sel)];
  const woerter = M.sichtbarerText(d).split(/\s+/).filter(Boolean).length;
  const fragen = q("h2, h3").filter((h) => /\?\s*$/.test(h.textContent.trim())).length;
  const datum = objekte.some((o) => o.dateModified || o.datePublished) || q("time[datetime]").length > 0 || !!d.querySelector('meta[property="article:modified_time" i]');
  const autor = objekte.some((o) => o.author) || !!d.querySelector('meta[name="author" i], [rel="author"]');
  const kiGruppe = e.punkte.gruppen.find((g) => /KI/i.test(g.name)) || null;
  const erlaubt = crawler.filter((c) => c.erlaubt).length;
  const SIGNALE = [
    ["KI-Crawler dürfen lesen", erlaubt === crawler.length, 30, erlaubt + " von " + crawler.length],
    ["Startseite ohne Fehler", s.status < 400 && !s.zertifikatFehler, 10, s.zertifikatFehler || ("Status " + s.status)],
    ["Organisation oder Betrieb ausgezeichnet", !!org, 12, org ? [].concat(org["@type"]).join(", ") : "kein Organization- oder LocalBusiness-Objekt"],
    ["Verknüpfte Profile (sameAs)", !!(org && org.sameAs), 4, org && org.sameAs ? [].concat(org.sameAs).length + " Verweise" : "fehlt"],
    ["Strukturierte Daten vorhanden", typen.length > 0, 8, typen.join(", ") || "keine"],
    ["Genug Text zum Zitieren", woerter >= 300, 10, woerter + " Wörter"],
    ["Fragen als Zwischenüberschriften", fragen > 0 || objekte.some((o) => /FAQPage/.test([].concat(o["@type"]).join(" "))), 8, fragen + " Fragen"],
    ["Datum angegeben", datum, 6, datum ? "vorhanden" : "fehlt"],
    ["Autor angegeben", autor, 4, autor ? "vorhanden" : "fehlt"],
    ["Sitemap", sitemap, 4, sitemap ? "vorhanden" : "fehlt"],
    ["llms.txt", llms.vorhanden, 4, llms.vorhanden ? "vorhanden" : "fehlt (freiwillig)"]
  ].map(([name, erfuellt, gewicht, wert]) => ({ name, erfuellt, gewicht, wert }));
  const punkte = Math.round(SIGNALE.reduce((a, x) => a + (x.erfuellt ? x.gewicht : 0), 0) / SIGNALE.reduce((a, x) => a + x.gewicht, 0) * 100);
  const befunde = [];
  const gesperrt = crawler.filter((c) => !c.erlaubt);
  if (robotsUnklar) befunde.push({ stufe: "kritisch", name: "robots.txt nicht abrufbar", wie: "Antwort " + (robotsStatus || "keine") + ". Viele Crawler werten einen Serverfehler bei robots.txt als „alles gesperrt“." });
  else if (gesperrt.length) befunde.push({ stufe: "wichtig", name: gesperrt.length + " KI-Crawler ausgesperrt", wie: gesperrt.map((c) => c.agent).join(", ") + " dürfen die Startseite nicht lesen. Diese Dienste können Sie dann nicht zitieren. Das kann gewollt sein." });
  if (!org) befunde.push({ stufe: "wichtig", name: "Organisation nicht ausgezeichnet", wie: "Ohne Organization- oder LocalBusiness-Objekt (JSON-LD) ordnen KI-Dienste Name, Angebot, Ort und Kontakt unsicherer zu.", beheben: "JSON-LD mit @type Organization oder LocalBusiness, Name, Adresse, Telefon, Logo und sameAs-Verweisen auf die Profile einbauen." });
  if (woerter < 300) befunde.push({ stufe: "wichtig", name: "Wenig zitierbarer Text", wie: woerter + " Wörter auf der Startseite. KI-Antworten zitieren konkrete Sätze: Leistungen, Orte, Preise, Abläufe." });
  if (!fragen) befunde.push({ stufe: "hinweis", name: "Keine Fragen als Überschriften", wie: "Überschriften in Frageform („Was kostet …?“) mit kurzer Antwort darunter werden von KI-Diensten gern übernommen." });
  if (!datum) befunde.push({ stufe: "hinweis", name: "Kein Datum", wie: "Ein sichtbares Änderungsdatum zeigt, dass der Inhalt aktuell ist." });
  if (!llms.vorhanden) befunde.push({ stufe: "hinweis", name: "Keine llms.txt", wie: "Freiwillige Datei, die KI-Diensten die wichtigsten Seiten nennt. Noch kein Standard, schadet aber nicht." });
  return {
    ziel: start, robotsStatus, crawler, llms, strukturierteDaten: typen, signale: SIGNALE,
    kiLesbarkeit: kiGruppe ? { wert: kiGruppe.wert, befunde: kiGruppe.befunde } : null,
    befunde, punkte, startStatus: s.status
  };
}

function nennung(text, marke, domain) {
  const t = String(text || "").toLowerCase();
  const kandidaten = [marke, domain, domain ? domain.split(".")[0].replace(/-/g, " ") : null].filter(Boolean).map((x) => x.toLowerCase());
  const i = Math.min(...kandidaten.map((k) => t.indexOf(k)).filter((x) => x >= 0));
  if (!isFinite(i)) return { genannt: false };
  const vorher = t.slice(0, i);
  const saetze = vorher.split(/[.!?]\s/).length;
  return { genannt: true, satz: saetze, auszug: String(text).slice(Math.max(0, i - 120), i + 160).replace(/\s+/g, " ") };
}

export async function pruefen(eingabe) {
  const aus = { modul: "ki" };
  const ziel = eingabe.url || eingabe.domain;
  if (!ziel && !eingabe.frage) throw new NutzerFehler("Bitte eine Website oder eine Frage angeben.");
  if (ziel) { aus.zugang = await zugang(ziel); aus.ziel = aus.zugang.ziel; }
  const anbieter = kiAnbieter();
  aus.anbieter = anbieter.map((a) => ({ name: a.name, bereit: a.bereit, fehlt: a.bereit ? null : a.fehlt }));
  if (eingabe.frage) {
    const frage = String(eingabe.frage).trim().slice(0, 500);
    const marke = String(eingabe.marke || "").trim();
    const domain = ziel ? domainLesen(ziel) : null;
    aus.frage = frage; aus.marke = marke;
    aus.antworten = await Promise.all(anbieter.filter((a) => a.bereit).map(async (a) => {
      try {
        const r = await kiFragen(a.name, frage);
        const n = nennung(r.text, marke, domain);
        const quellen = [...new Set(r.quellen)].slice(0, 12);
        const quelleEigen = domain ? quellen.findIndex((q) => { try { return new URL(q).hostname.replace(/^www\./, "").endsWith(domain); } catch (e) { return false; } }) : -1;
        return { name: a.name, ok: true, ...n, quellen, alsQuelle: quelleEigen >= 0 ? quelleEigen + 1 : null, keineUebersicht: !!r.keineUebersicht };
      } catch (e) { return { name: a.name, ok: false, fehler: e.message }; }
    }));
    const ok = aus.antworten.filter((x) => x.ok && !x.keineUebersicht);
    aus.genannt = ok.filter((x) => x.genannt).length;
    aus.gefragt = ok.length;
  }
  const z = aus.zugang;
  aus.punkte = z ? z.punkte : null;
  aus.befunde = z ? z.befunde : [];
  aus.kurz = (aus.gefragt ? "in " + aus.genannt + " von " + aus.gefragt + " Antworten genannt · " : "") +
    (z ? (z.punkte + " von 100 · " + z.crawler.filter((c) => c.erlaubt).length + " von " + z.crawler.length + " KI-Crawlern dürfen lesen") : "");
  return aus;
}
