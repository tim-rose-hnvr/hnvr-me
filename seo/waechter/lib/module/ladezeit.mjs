/* Eigene Ladezeit-Analyse, ohne Google: laedt die Seite und ihre Ressourcen
   (Skripte, Stile, Bilder, Schriften, eingebettete Rahmen) und misst Gewicht,
   Anzahl der Anfragen, Kompression, Zwischenspeicher, blockierende Skripte,
   grosse Bilder und Fremdanbieter. Keine Ausfuehrung von JavaScript; was ein
   Skript nachlaedt, sieht diese Messung nicht. */

import { KENNUNG } from "../werk.mjs";

const MAX_RES = 50;
const art = (typ, url) => {
  const t = (typ || "").toLowerCase(), u = url.toLowerCase().split("?")[0];
  if (t.includes("image") || /\.(png|jpe?g|gif|webp|avif|svg|ico)$/.test(u)) return "bilder";
  if (t.includes("javascript") || /\.m?js$/.test(u)) return "skripte";
  if (t.includes("css") || /\.css$/.test(u)) return "stile";
  if (t.includes("font") || /\.(woff2?|ttf|otf|eot)$/.test(u)) return "schriften";
  return "andere";
};

async function einzeln(url) {
  const t0 = Date.now();
  try {
    const a = await fetch(url, { headers: { "user-agent": KENNUNG, accept: "*/*", "accept-encoding": "gzip, br" }, signal: AbortSignal.timeout(15000) });
    const roh = Buffer.from(await a.arrayBuffer());
    const laenge = Number(a.headers.get("content-length")) || null;
    return {
      url, status: a.status, typ: a.headers.get("content-type") || "", ms: Date.now() - t0,
      bytes: laenge || roh.length, geschaetzt: !laenge && !!a.headers.get("content-encoding"),
      kodierung: a.headers.get("content-encoding") || null, cache: a.headers.get("cache-control") || null
    };
  } catch (e) { return { url, status: 0, fehler: e.message, bytes: 0 }; }
}

export async function analysieren(url, dokument, htmlBytes, kodierung) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const q = (s) => [...dokument.querySelectorAll(s)];
  const absolut = (h) => { try { return new URL(h, url).href; } catch (e) { return null; } };
  const quellen = new Map();
  const dazu = (h, wo) => { const a = absolut(h); if (a && /^https?:/.test(a) && !quellen.has(a)) quellen.set(a, wo); };
  const blockierend = [];
  for (const s of q("script[src]")) dazu(s.getAttribute("src"), "skript");
  for (const s of q("head script[src]")) {
    if (!s.hasAttribute("async") && !s.hasAttribute("defer") && s.getAttribute("type") !== "module") blockierend.push(absolut(s.getAttribute("src")));
  }
  for (const l of q('link[rel~="stylesheet" i]')) dazu(l.getAttribute("href"), "stil");
  for (const l of q('link[rel="preload" i], link[rel="icon" i]')) dazu(l.getAttribute("href"), "vorab");
  const bilder = q("img");
  for (const i of bilder) dazu(i.getAttribute("src") || (i.getAttribute("srcset") || "").split(/\s/)[0], "bild");
  for (const f of q("iframe[src]")) dazu(f.getAttribute("src"), "rahmen");
  const liste = [...quellen.keys()].filter(Boolean).slice(0, MAX_RES);
  const ergebnisse = [];
  for (let i = 0; i < liste.length; i += 4) ergebnisse.push(...await Promise.all(liste.slice(i, i + 4).map(einzeln)));

  const verteilung = { html: htmlBytes, bilder: 0, skripte: 0, stile: 0, schriften: 0, andere: 0 };
  for (const r of ergebnisse) verteilung[art(r.typ, r.url)] += r.bytes || 0;
  const gesamt = Object.values(verteilung).reduce((a, b) => a + b, 0);
  const fremd = ergebnisse.filter((r) => { try { return !new URL(r.url).hostname.replace(/^www\./, "").endsWith(host); } catch (e) { return false; } });
  const fremdHosts = [...new Set(fremd.map((r) => new URL(r.url).hostname))];
  const textArt = (r) => /text|javascript|json|xml|svg|css/.test(r.typ);
  const ohneKompression = ergebnisse.filter((r) => r.status === 200 && textArt(r) && !r.kodierung && r.bytes > 2048);
  const ohneCache = ergebnisse.filter((r) => r.status === 200 && !/max-age=(\d{5,}|[89]\d{4})|immutable/.test(r.cache || "") && art(r.typ, r.url) !== "andere");
  const grosseBilder = ergebnisse.filter((r) => art(r.typ, r.url) === "bilder" && r.bytes > 200 * 1024).sort((a, b) => b.bytes - a.bytes);
  const altesFormat = ergebnisse.filter((r) => /image\/(jpeg|png)/.test(r.typ) && r.bytes > 100 * 1024);
  const kaputt = ergebnisse.filter((r) => r.status >= 400 || r.status === 0);

  const befunde = [];
  const b = (stufe, name, wie, fund) => befunde.push({ id: "lz-" + befunde.length, gruppe: "Ladezeit", stufe, name, wie, fund: fund || null });
  if (gesamt > 3 * 1024 * 1024) b("wichtig", "Seite sehr schwer", "Die Seite lädt " + kb(gesamt) + ". Über Mobilfunk dauert das spürbar.");
  else if (gesamt > 1.5 * 1024 * 1024) b("hinweis", "Seite schwer", "Die Seite lädt " + kb(gesamt) + ".");
  if (!kodierung && htmlBytes > 10 * 1024) b("wichtig", "HTML ohne Kompression", "Der Server liefert das HTML ohne gzip oder Brotli aus.");
  if (ohneKompression.length) b("wichtig", anz(ohneKompression.length, "Textdatei", "Textdateien") + " ohne Kompression", "Skripte und Stile ließen sich mit gzip oder Brotli auf etwa ein Drittel verkleinern.", ohneKompression.slice(0, 6).map((r) => kb(r.bytes) + "  " + r.url).join("\n"));
  if (blockierend.length) b("wichtig", (blockierend.length === 1 ? "1 Skript blockiert" : blockierend.length + " Skripte blockieren") + " den Aufbau", "Im Kopf geladen, ohne async oder defer: Der Browser wartet, bevor er etwas zeigt.", blockierend.slice(0, 6).join("\n"));
  if (grosseBilder.length) b("wichtig", anz(grosseBilder.length, "Bild", "Bilder") + " über 200 KB", "Große Bilder sind meist der größte Hebel für die Ladezeit.", grosseBilder.slice(0, 6).map((r) => kb(r.bytes) + "  " + r.url).join("\n"));
  if (altesFormat.length) b("hinweis", anz(altesFormat.length, "Bild", "Bilder") + " als JPEG oder PNG über 100 KB", "Als WebP oder AVIF wären sie meist deutlich kleiner.", altesFormat.slice(0, 6).map((r) => kb(r.bytes) + "  " + r.url).join("\n"));
  if (ohneCache.length > 3) b("hinweis", ohneCache.length + " Dateien ohne langen Zwischenspeicher", "Bei wiederholtem Besuch werden sie erneut geladen. Für Dateien mit Versionsnummer passt max-age=31536000.", ohneCache.slice(0, 6).map((r) => (r.cache || "keine Angabe") + "  " + r.url).join("\n"));
  if (fremdHosts.length > 4) b("hinweis", "Ressourcen von " + fremdHosts.length + " fremden Servern", "Jeder fremde Server kostet eine eigene Verbindung und gibt Besucherdaten weiter.", fremdHosts.slice(0, 10).join("\n"));
  if (kaputt.length) b("wichtig", anz(kaputt.length, "Datei", "Dateien") + " nicht erreichbar", "Diese Dateien bindet die Seite ein, sie liefern aber einen Fehler.", kaputt.slice(0, 6).map((r) => (r.status || r.fehler) + "  " + r.url).join("\n"));

  const punkte = Math.max(0, Math.min(100, Math.round(100
    - Math.max(0, (gesamt / 1024 / 1024 - 1) * 12)
    - blockierend.length * 4 - ohneKompression.length * 3 - grosseBilder.length * 4 - kaputt.length * 5
    - (!kodierung && htmlBytes > 10240 ? 8 : 0))));
  return {
    quelle: "eigene Messung", punkte,
    gesamtKB: Math.round(gesamt / 1024), anfragen: ergebnisse.length + 1, begrenzt: quellen.size > MAX_RES,
    verteilung: Object.fromEntries(Object.entries(verteilung).map(([k, v]) => [k, Math.round(v / 1024)])),
    schwerste: ergebnisse.slice().sort((a, c) => c.bytes - a.bytes).slice(0, 8).map((r) => ({ url: r.url, kb: Math.round(r.bytes / 1024), art: art(r.typ, r.url), ms: r.ms })),
    fremdHosts, befunde
  };
}
function anz(n, eins, mehr) { return n + " " + (n === 1 ? eins : mehr); }
function kb(b) { return b > 1024 * 1024 ? (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB" : Math.round(b / 1024) + " KB"; }
