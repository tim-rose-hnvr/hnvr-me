/* Anbindung an kostenlose Google-Dienste.
   - PageSpeed Insights: Ladezeit und Core Web Vitals (Labor und echte Nutzer).
     Braucht GOOGLE_API_KEY; ohne Schluessel ist Googles gemeinsames Kontingent
     in der Praxis erschoepft (gemessen 04.10.2026: 429).
   - Search Console: echte Positionen, Klicks und Impressionen der EIGENEN,
     bestaetigten Websites. Je Konto per Google-Anmeldung verbunden
     (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, Bereich webmasters.readonly).
   Die Google-Adressen sind fest und kommen nie aus Nutzereingaben; deshalb
   laufen diese Abrufe ueber das urspruengliche fetch. Fuer den Selbsttest
   lassen sie sich ueber GOOGLE_*_BASIS auf einen Pruefserver umlenken. */

const holen = (...a) => (globalThis.__waechterFetch || fetch)(...a);
const API = () => process.env.GOOGLE_API_BASIS || "https://www.googleapis.com";
const OAUTH = () => process.env.GOOGLE_OAUTH_BASIS || "https://oauth2.googleapis.com";
const AUTH = () => process.env.GOOGLE_AUTH_BASIS || "https://accounts.google.com";
export const BEREICH = "https://www.googleapis.com/auth/webmasters.readonly";

export const psiBereit = () => !!process.env.GOOGLE_API_KEY;
export const gscBereit = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/* ---------- PageSpeed Insights ---------- */

const FELD = {
  LARGEST_CONTENTFUL_PAINT_MS: ["Größter Inhalt (LCP)", (v) => (v / 1000).toFixed(1).replace(".", ",") + " s"],
  INTERACTION_TO_NEXT_PAINT: ["Reaktion auf Eingaben (INP)", (v) => v + " ms"],
  CUMULATIVE_LAYOUT_SHIFT_SCORE: ["Layoutverschiebung (CLS)", (v) => (v / 100).toFixed(2).replace(".", ",")],
  FIRST_CONTENTFUL_PAINT_MS: ["Erster Inhalt (FCP)", (v) => (v / 1000).toFixed(1).replace(".", ",") + " s"],
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: ["Erste Antwort (TTFB)", (v) => v + " ms"]
};
const KATEGORIE = { FAST: "gut", AVERAGE: "verbesserungswürdig", SLOW: "schlecht" };

export async function pagespeed(url, strategie = "mobile") {
  if (!psiBereit()) return { verfuegbar: false, fehlt: "GOOGLE_API_KEY (kostenlos in der Google Cloud Console)" };
  const q = new URLSearchParams({ url, strategy: strategie, category: "performance", locale: "de", key: process.env.GOOGLE_API_KEY });
  let a;
  try { a = await holen(API() + "/pagespeedonline/v5/runPagespeed?" + q, { signal: AbortSignal.timeout(90000) }); }
  catch (e) { return { verfuegbar: true, fehler: "PageSpeed nicht erreichbar: " + e.message }; }
  const j = await a.json().catch(() => ({}));
  if (!a.ok) return { verfuegbar: true, fehler: a.status === 429 ? "Tageskontingent des Schlüssels erschöpft (429)." : "PageSpeed: " + (j.error?.message || a.status) };
  const L = j.lighthouseResult || {};
  const au = L.audits || {};
  const labor = ["largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "first-contentful-paint", "speed-index"]
    .filter((k) => au[k]).map((k) => ({ id: k, name: au[k].title, wert: au[k].displayValue, zahl: au[k].numericValue, score: au[k].score }));
  const feld = Object.entries(j.loadingExperience?.metrics || {}).filter(([k]) => FELD[k])
    .map(([k, m]) => ({ id: k, name: FELD[k][0], wert: FELD[k][1](m.percentile), urteil: KATEGORIE[m.category] || m.category }));
  const chancen = Object.values(au).filter((x) => x.score !== null && x.score < 0.9 && x.details && (x.details.overallSavingsMs > 0 || x.details.overallSavingsBytes > 0 || x.metricSavings))
    .map((x) => ({ name: x.title, ersparnisMs: Math.round(x.details.overallSavingsMs || x.metricSavings?.LCP || 0), ersparnisKB: Math.round((x.details.overallSavingsBytes || 0) / 1024) }))
    .sort((p, q2) => q2.ersparnisMs - p.ersparnisMs || q2.ersparnisKB - p.ersparnisKB).slice(0, 8);
  return {
    verfuegbar: true, strategie, quelle: "Google PageSpeed Insights",
    punkte: L.categories?.performance?.score != null ? Math.round(L.categories.performance.score * 100) : null,
    feldUrteil: j.loadingExperience?.overall_category ? KATEGORIE[j.loadingExperience.overall_category] : null,
    feldQuelle: j.loadingExperience?.origin_fallback ? "ganze Domain" : "diese Seite",
    feld, labor, chancen
  };
}

/* ---------- Search Console ---------- */

export function anmeldeAdresse(zustand, rueckruf) {
  return AUTH() + "/o/oauth2/v2/auth?" + new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: rueckruf, response_type: "code",
    scope: BEREICH, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state: zustand
  });
}

async function token(felder) {
  const a = await holen(OAUTH() + "/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...felder }),
    signal: AbortSignal.timeout(20000)
  });
  const j = await a.json().catch(() => ({}));
  if (!a.ok || !j.access_token) throw new Error("Google lehnt die Anmeldung ab: " + (j.error_description || j.error || a.status));
  return j;
}
export const codeEinloesen = (code, rueckruf) => token({ code, redirect_uri: rueckruf, grant_type: "authorization_code" });
export const erneuern = (refresh) => token({ refresh_token: refresh, grant_type: "refresh_token" });

async function gsc(zugang, pfad, koerper) {
  const a = await holen(API() + "/webmasters/v3" + pfad, {
    method: koerper ? "POST" : "GET",
    headers: { authorization: "Bearer " + zugang, ...(koerper ? { "content-type": "application/json" } : {}) },
    body: koerper ? JSON.stringify(koerper) : undefined, signal: AbortSignal.timeout(30000)
  });
  const j = await a.json().catch(() => ({}));
  if (!a.ok) throw new Error("Search Console: " + (j.error?.message || a.status));
  return j;
}
export async function properties(zugang) {
  return ((await gsc(zugang, "/sites")).siteEntry || []).filter((s) => s.permissionLevel !== "siteUnverifiedUser").map((s) => s.siteUrl);
}
export function passendeProperty(liste, domain) {
  const d = domain.replace(/^www\./, "");
  return liste.find((s) => s === "sc-domain:" + d) ||
    liste.find((s) => { try { return new URL(s).hostname.replace(/^www\./, "") === d; } catch (e) { return false; } }) || null;
}
const tag = (n) => new Date(Date.now() - n * 86400e3).toISOString().slice(0, 10);

export async function suchanalyse(zugang, site, { tage = 28 } = {}) {
  const basis = { startDate: tag(tage + 2), endDate: tag(1), dataState: "all", type: "web" };
  const pfad = "/sites/" + encodeURIComponent(site) + "/searchAnalytics/query";
  const [anfragen, seiten, verlauf] = await Promise.all([
    gsc(zugang, pfad, { ...basis, dimensions: ["query"], rowLimit: 1000 }),
    gsc(zugang, pfad, { ...basis, dimensions: ["page"], rowLimit: 25 }),
    gsc(zugang, pfad, { ...basis, dimensions: ["date"], rowLimit: 100 })
  ]);
  const zeile = (r) => ({ schluessel: r.keys[0], klicks: r.clicks, impressionen: r.impressions, ctr: r.ctr, position: Math.round(r.position * 10) / 10 });
  return {
    zeitraum: basis.startDate + " bis " + basis.endDate,
    anfragen: (anfragen.rows || []).map(zeile),
    seiten: (seiten.rows || []).map(zeile),
    verlauf: (verlauf.rows || []).map(zeile)
  };
}
