/* Anbindungen an Fremddienste. Sie laufen nur, wenn die Zugangsdaten in der
   Umgebung stehen. Ohne Zugang liefern die Module einen klaren Zustand
   "nicht eingerichtet" statt erfundener Zahlen.

   DATAFORSEO_LOGIN, DATAFORSEO_PASSWORT  Rankings, KI-Übersicht, Backlinks
   OPENAI_API_KEY (OPENAI_MODELL)          KI-Frage an ChatGPT (mit Websuche)
   GEMINI_API_KEY (GEMINI_MODELL)          KI-Frage an Gemini (mit Google-Suche)
   PERPLEXITY_API_KEY                      KI-Frage an Perplexity */

export const dfsBereit = () => !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORT);

async function dfs(pfad, auftrag) {
  const auth = Buffer.from(process.env.DATAFORSEO_LOGIN + ":" + process.env.DATAFORSEO_PASSWORT).toString("base64");
  const a = await fetch("https://api.dataforseo.com/v3/" + pfad, {
    method: "POST", headers: { authorization: "Basic " + auth, "content-type": "application/json" },
    body: JSON.stringify([auftrag]), signal: AbortSignal.timeout(60000)
  });
  const j = await a.json();
  const t = j.tasks?.[0];
  if (!a.ok || !t || t.status_code >= 40000) throw new Error("DataForSEO: " + (t?.status_message || j.status_message || a.status));
  return t.result?.[0] || null;
}

export async function serp(keyword, { ort, geraet } = {}) {
  const r = await dfs("serp/google/organic/live/advanced", {
    keyword, language_code: "de", depth: 100,
    location_name: ort && ort.includes(",") ? ort : "Germany",
    device: geraet === "mobil" ? "mobile" : "desktop"
  });
  const items = r?.items || [];
  return {
    organisch: items.filter((i) => i.type === "organic").map((i) => ({ platz: i.rank_group, url: i.url, domain: i.domain, titel: i.title })),
    merkmale: [...new Set(items.map((i) => i.type).filter((t) => t !== "organic"))],
    kiUebersicht: items.find((i) => i.type === "ai_overview") || null,
    volumen: null
  };
}

export async function backlinks(domain) {
  const [zusammen, liste, anker] = await Promise.all([
    dfs("backlinks/summary/live", { target: domain, include_subdomains: true }),
    dfs("backlinks/backlinks/live", { target: domain, mode: "as_is", limit: 50, order_by: ["rank,desc"] }),
    dfs("backlinks/anchors/live", { target: domain, limit: 10, order_by: ["backlinks,desc"] })
  ]);
  return {
    backlinks: zusammen?.backlinks ?? null, domains: zusammen?.referring_domains ?? null,
    nofollow: zusammen?.referring_links_attributes?.nofollow ?? null,
    liste: (liste?.items || []).map((i) => ({ quelle: i.url_from, ziel: i.url_to, anker: i.anchor, follow: !i.dofollow ? "nofollow" : "follow", wert: i.rank, gefunden: i.first_seen, verloren: i.is_lost })),
    anker: (anker?.items || []).map((i) => ({ text: i.anchor, anzahl: i.backlinks }))
  };
}

export function kiAnbieter() {
  return [
    { name: "ChatGPT", bereit: !!process.env.OPENAI_API_KEY, fehlt: "OPENAI_API_KEY" },
    { name: "Gemini", bereit: !!process.env.GEMINI_API_KEY, fehlt: "GEMINI_API_KEY (kostenlos in Google AI Studio; mit Google-Suche bis 1.500 Abfragen am Tag frei)" },
    { name: "Perplexity", bereit: !!process.env.PERPLEXITY_API_KEY, fehlt: "PERPLEXITY_API_KEY" },
    { name: "KI-Übersicht", bereit: dfsBereit(), fehlt: "DATAFORSEO_LOGIN und DATAFORSEO_PASSWORT" },
    { name: "Copilot", bereit: false, fehlt: "Microsoft bietet dafür keine öffentliche Schnittstelle" }
  ];
}

async function json(url, init) {
  const a = await fetch(url, { ...init, signal: AbortSignal.timeout(90000) });
  const j = await a.json().catch(() => ({}));
  if (!a.ok) throw new Error((j.error && (j.error.message || j.error)) || ("Status " + a.status));
  return j;
}

export async function kiFragen(name, frage) {
  if (name === "ChatGPT") {
    const j = await json("https://api.openai.com/v1/responses", {
      method: "POST", headers: { authorization: "Bearer " + process.env.OPENAI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODELL || "gpt-4.1-mini", input: frage, tools: [{ type: "web_search_preview" }] })
    });
    const teile = (j.output || []).filter((o) => o.type === "message").flatMap((o) => o.content || []);
    return {
      text: teile.map((c) => c.text || "").join("\n"),
      quellen: teile.flatMap((c) => (c.annotations || []).filter((x) => x.url).map((x) => x.url))
    };
  }
  if (name === "Gemini") {
    const modell = process.env.GEMINI_MODELL || "gemini-2.5-flash";
    const j = await json("https://generativelanguage.googleapis.com/v1beta/models/" + modell + ":generateContent?key=" + encodeURIComponent(process.env.GEMINI_API_KEY), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: frage }] }], tools: [{ google_search: {} }] })
    });
    const k = j.candidates?.[0];
    return {
      text: (k?.content?.parts || []).map((p) => p.text || "").join("\n"),
      quellen: (k?.groundingMetadata?.groundingChunks || []).map((c) => c.web?.uri).filter(Boolean)
    };
  }
  if (name === "Perplexity") {
    const j = await json("https://api.perplexity.ai/chat/completions", {
      method: "POST", headers: { authorization: "Bearer " + process.env.PERPLEXITY_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.PERPLEXITY_MODELL || "sonar", messages: [{ role: "user", content: frage }] })
    });
    return {
      text: j.choices?.[0]?.message?.content || "",
      quellen: j.citations || (j.search_results || []).map((s) => s.url)
    };
  }
  if (name === "KI-Übersicht") {
    const s = await serp(frage, {});
    const ao = s.kiUebersicht;
    if (!ao) return { text: "", quellen: [], keineUebersicht: true };
    const text = (ao.items || []).map((i) => i.text || i.title || "").join("\n") || ao.text || "";
    const quellen = (ao.references || []).map((r) => r.url).filter(Boolean);
    return { text, quellen };
  }
  throw new Error("Für " + name + " gibt es keine Anbindung.");
}
