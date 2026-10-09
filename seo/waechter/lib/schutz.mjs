/* SEO Waechter · Schutz.
   Der Waechter ruft im Auftrag Fremder beliebige Adressen ab. Ohne Sperre
   koennte jemand ihn auf das interne Netz des Servers richten. Jeder Abruf
   geht deshalb durch hostErlaubt(), auch jeder Sprung einer Weiterleitung. */

import dns from "node:dns/promises";
import net from "node:net";

export class NutzerFehler extends Error {
  constructor(text, status = 400) { super(text); this.status = status; }
}

export function privat(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("::ffff:")) return privat(x.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
  }
  return true;
}

const lokalErlaubt = () => process.env.WAECHTER_LOKAL_ERLAUBT === "1";

export async function hostErlaubt(host) {
  host = String(host || "").replace(/^\[|\]$/g, "").toLowerCase();
  if (!host) throw new NutzerFehler("Keine Adresse angegeben.");
  if (lokalErlaubt()) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new NutzerFehler("Interne Adressen prüft der Wächter nicht.");
  }
  if (net.isIP(host)) {
    if (privat(host)) throw new NutzerFehler("Interne Adressen prüft der Wächter nicht.");
    return true;
  }
  let liste;
  try { liste = await dns.lookup(host, { all: true }); }
  catch (e) { throw new NutzerFehler("Die Domain " + host + " lässt sich nicht auflösen."); }
  if (!liste.length) throw new NutzerFehler("Die Domain " + host + " lässt sich nicht auflösen.");
  for (const e of liste) {
    if (privat(e.address)) throw new NutzerFehler("Die Domain " + host + " zeigt ins interne Netz.");
  }
  return true;
}

/* Ersetzt das globale fetch: jede Weiterleitung wird einzeln gefolgt und
   geprueft. Das Pruefwerk (Crawler) nutzt fetch und ist damit mit geschuetzt. */
export function fetchAbsichern() {
  if (globalThis.__waechterFetch) return;
  const original = globalThis.fetch;
  globalThis.__waechterFetch = original;
  globalThis.fetch = async function geschuetzt(eingabe, init = {}) {
    let url = typeof eingabe === "string" ? eingabe : (eingabe instanceof URL ? eingabe.href : eingabe.url);
    const selbst = init.redirect === "manual";
    let einst = { ...init };
    let spruenge = 0;
    for (;;) {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new NutzerFehler("Nur http und https.");
      await hostErlaubt(u.hostname);
      const antwort = await original(url, {
        ...einst, redirect: "manual",
        signal: einst.signal || AbortSignal.timeout(Number(process.env.WAECHTER_ZEITLIMIT || 15000))
      });
      const ort = antwort.headers.get("location");
      if (selbst || !(antwort.status >= 300 && antwort.status < 400 && ort)) {
        if (spruenge) {
          Object.defineProperty(antwort, "url", { value: url });
          Object.defineProperty(antwort, "redirected", { value: true });
        }
        return antwort;
      }
      if (++spruenge > 10) throw new NutzerFehler("Mehr als zehn Weiterleitungen.");
      url = new URL(ort, url).href;
      if (antwort.status === 303 || ((antwort.status === 301 || antwort.status === 302) && einst.method && einst.method !== "GET")) {
        einst = { ...einst, method: "GET", body: undefined };
      }
    }
  };
}

/* Adresse aus Nutzereingabe: ohne Schema wird https angenommen. */
export function adresseLesen(eingabe) {
  let s = String(eingabe || "").trim();
  if (!s) throw new NutzerFehler("Bitte eine Adresse eingeben.");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u;
  try { u = new URL(s); } catch (e) { throw new NutzerFehler("Das ist keine gültige Adresse."); }
  if (!u.hostname.includes(".") && !lokalErlaubt()) throw new NutzerFehler("Das ist keine gültige Adresse.");
  return u.href;
}

export function domainLesen(eingabe) {
  const d = String(eingabe || "").trim().toLowerCase()
    .replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/^www\./, "");
  if (!/^[a-z0-9äöüß.-]+\.[a-z]{2,}$/i.test(d)) throw new NutzerFehler("Das ist keine gültige Domain.");
  return d;
}

/* Tagesgrenzen je Werkzeug. Ohne Konto je IP, mit Konto je Konto.
   Werte vorlaeufig, siehe LIESMICH. */
const GRENZE = { ohne: 30, mit: 300 };
const zaehler = new Map();
export function grenzePruefen(schluessel, mitKonto) {
  const tag = new Date().toISOString().slice(0, 10);
  const k = tag + "|" + schluessel;
  const n = (zaehler.get(k) || 0) + 1;
  const max = mitKonto ? GRENZE.mit : GRENZE.ohne;
  if (n > max) throw new NutzerFehler("Für heute sind die " + max + " Prüfungen dieses Werkzeugs aufgebraucht.", 429);
  zaehler.set(k, n);
  if (zaehler.size > 50000) for (const key of zaehler.keys()) if (!key.startsWith(tag)) zaehler.delete(key);
}
