/* Module Rankings und Backlinks.
   Rankings: fuer eigene Websites kostenlos aus der Google Search Console
   (mit Konto und verbundenem Google-Zugang); fuer fremde Websites und genaue
   Plaetze ueber die Suchdaten-Anbindung. Ohne beides: klarer Zustand statt
   erfundener Zahlen. Backlinks: nur mit Linkverzeichnis. */

import { domainLesen, NutzerFehler } from "../schutz.mjs";
import { dfsBereit, serp, backlinks as blHolen } from "./extern.mjs";
import { gscBereit, passendeProperty, suchanalyse } from "./google.mjs";

function fehlt(ctx, domain) {
  const wege = [];
  if (gscBereit()) wege.push(ctx.konto ? (ctx.google ? "Ihre Search Console hat keine Property für " + domain + "." : "Unter Einstellungen die Google Search Console verbinden (kostenlos).") : "Für Ihre eigene Website: kostenloses Konto anlegen und die Google Search Console verbinden.");
  else wege.push("Google Search Console ist auf diesem Server nicht eingerichtet (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).");
  wege.push("Für fremde Websites und genaue Plätze: Suchdaten-Anbindung (DATAFORSEO_LOGIN, DATAFORSEO_PASSWORT).");
  return {
    verfuegbar: false, fehlt: wege.join(" "),
    warum: "Google gibt Positionen kostenlos nur dem Inhaber einer Website, über die Search Console. Eigene Abfragen bei Google verstoßen gegen deren Nutzungsbedingungen und werden gesperrt."
  };
}

async function ausSearchConsole(domain, keywords, ctx, site) {
  const token = await ctx.google.zugang();
  const d = await suchanalyse(token, site);
  const k = keywords.map((x) => x.toLowerCase());
  const zeilen = k.length
    ? k.map((kw) => { const r = d.anfragen.find((a) => a.schluessel.toLowerCase() === kw); return r ? { keyword: kw, platz: r.position, klicks: r.klicks, impressionen: r.impressionen, ctr: r.ctr } : { keyword: kw, platz: null, klicks: 0, impressionen: 0, ctr: 0 }; })
    : d.anfragen.slice().sort((a, b) => b.impressionen - a.impressionen).slice(0, 30).map((r) => ({ keyword: r.schluessel, platz: r.position, klicks: r.klicks, impressionen: r.impressionen, ctr: r.ctr }));
  const summe = (f) => d.anfragen.reduce((a, r) => a + r[f], 0);
  const imp = summe("impressionen");
  const mittel = imp ? Math.round(d.anfragen.reduce((a, r) => a + r.position * r.impressionen, 0) / imp * 10) / 10 : null;
  return {
    modul: "rankings", ziel: domain, verfuegbar: true, quelle: "Google Search Console", property: site, zeitraum: d.zeitraum,
    kennzahlen: { klicks: summe("klicks"), impressionen: imp, position: mittel, anfragen: d.anfragen.length },
    zeilen, seiten: d.seiten.slice(0, 15), verlauf: d.verlauf, punkte: null,
    kurz: "Ø Position " + (mittel ?? "–") + " · " + summe("klicks") + " Klicks · " + imp + " Impressionen (28 Tage)"
  };
}

export async function rankings(eingabe, ctx) {
  const domain = domainLesen(eingabe.domain);
  const keywords = String(eingabe.keywords || "").split(/[,\n]/).map((k) => k.trim()).filter(Boolean);
  const max = ctx.maxKeywords || 5;
  if (keywords.length > max) throw new NutzerFehler("Höchstens " + max + " Keywords je Abfrage" + (ctx.konto ? "." : " ohne Konto."));
  if (ctx.google && gscBereit()) {
    const site = passendeProperty(ctx.google.properties || [], domain);
    if (site) return ausSearchConsole(domain, keywords, ctx, site);
  }
  if (!dfsBereit()) return { modul: "rankings", ziel: domain, keywords, ...fehlt(ctx, domain), kurz: "Datenquelle nicht eingerichtet" };
  if (!keywords.length) throw new NutzerFehler("Bitte mindestens ein Keyword angeben.");
  const zeilen = [];
  for (const kw of keywords) {
    try {
      const s = await serp(kw, { ort: eingabe.ort, geraet: eingabe.geraet });
      const eigen = s.organisch.find((o) => (o.domain || "").replace(/^www\./, "").endsWith(domain));
      zeilen.push({
        keyword: kw, platz: eigen ? eigen.platz : null, url: eigen ? eigen.url : null,
        merkmale: s.merkmale, vorIhnen: s.organisch.filter((o) => !eigen || o.platz < eigen.platz).slice(0, 5),
        kiUebersicht: !!s.kiUebersicht,
        kiZitiert: s.kiUebersicht ? (s.kiUebersicht.references || []).some((r) => (r.domain || "").endsWith(domain)) : null
      });
    } catch (e) { zeilen.push({ keyword: kw, fehler: e.message }); }
  }
  const mit = zeilen.filter((z) => z.platz);
  return {
    modul: "rankings", ziel: domain, verfuegbar: true, quelle: "Suchdaten", ort: eingabe.ort || "Deutschland", geraet: eingabe.geraet || "desktop",
    zeilen, punkte: null,
    kurz: mit.length + " von " + zeilen.length + " Keywords in den Top 100" + (mit.length ? " · bester Platz " + Math.min(...mit.map((z) => z.platz)) : "")
  };
}

export async function backlinks(eingabe) {
  const domain = domainLesen(eingabe.domain);
  if (!dfsBereit()) return {
    modul: "backlinks", ziel: domain, verfuegbar: false,
    fehlt: "Linkverzeichnis (DATAFORSEO_LOGIN und DATAFORSEO_PASSWORT). Die Search Console zeigt Links nur in ihrer eigenen Oberfläche; die Schnittstelle gibt sie nicht heraus.",
    warum: "Wer auf eine Website verweist, steht nur in einem Linkverzeichnis, das das ganze Netz durchsucht. Das kann ein einzelner Server nicht selbst aufbauen.",
    kurz: "Datenquelle nicht eingerichtet"
  };
  const r = await blHolen(domain);
  return { modul: "backlinks", ziel: domain, verfuegbar: true, ...r, punkte: null, kurz: (r.backlinks ?? "?") + " Verweise von " + (r.domains ?? "?") + " Domains" };
}
