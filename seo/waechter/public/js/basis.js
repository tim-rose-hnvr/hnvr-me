/* SEO Waechter · Grundbausteine der Oberflaeche. Ohne Fremdpakete. */
"use strict";

const IC = {
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><path d="m16 16-1.9-1.9"/>',
  trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/><path d="M12 12h.01"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  chart: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chevD: '<path d="m6 9 6 6 6-6"/>', chevR: '<path d="m9 18 6-6-6-6"/>', chevL: '<path d="m15 18-6-6 6-6"/>',
  radar: '<path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>', check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'
};

function ic(name, groesse) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true");
  if (groesse) { s.setAttribute("width", groesse); s.setAttribute("height", groesse); s.style.width = groesse + "px"; s.style.height = groesse + "px"; }
  s.innerHTML = IC[name] || IC.info;
  return s;
}

/* h("div.klasse#id", {attribute}, ...kinder) */
function h(sel, attr, ...kinder) {
  const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel || "div");
  const el = document.createElement(m[1] || "div");
  (m[2].match(/[.#][\w-]+/g) || []).forEach((t) => t[0] === "." ? el.classList.add(t.slice(1)) : (el.id = t.slice(1)));
  if (attr && (typeof attr !== "object" || attr instanceof Node || Array.isArray(attr))) { kinder.unshift(attr); attr = null; }
  for (const [k, v] of Object.entries(attr || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else if (k === "klasse") el.className += " " + v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  einhaengen(el, kinder);
  return el;
}
function einhaengen(el, kinder) {
  for (const k of kinder.flat(3)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
function leeren(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

/* Text mit <code>…</code> aus dem Regelkatalog sicher darstellen. */
function mitCode(text) {
  const f = document.createDocumentFragment();
  String(text || "").replace(/<(?!\/?code>)[^>]+>/g, "").split(/(<code>[\s\S]*?<\/code>)/).forEach((t) => {
    const m = /^<code>([\s\S]*)<\/code>$/.exec(t);
    const ent = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    f.appendChild(m ? h("code", { text: ent(m[1]) }) : document.createTextNode(ent(t)));
  });
  return f;
}

const zahl = (n, st) => n == null || n === "" ? "–" : Number(n).toLocaleString("de-DE", { maximumFractionDigits: st ?? 1 });
const datum = (d, mitZeit = true) => { if (!d) return "–"; const x = new Date(d); return x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) + (mitZeit ? ", " + x.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : ""); };
const STUFE = { kritisch: "schlecht", wichtig: "warn", hinweis: "info", ok: "ok" };
const STUFE_NAME = { kritisch: "kritisch", wichtig: "wichtig", hinweis: "Hinweis" };
function pille(text, ton, mit) { const p = h("span.pille" + (ton ? "." + ton : "")); if (mit === "punkt") p.appendChild(h("span.punkt")); else if (mit) p.appendChild(ic(mit, 12)); p.appendChild(document.createTextNode(text)); return p; }
function tonFuerWert(w) { return w == null ? "" : w >= 90 ? "ok" : w >= 70 ? "warn" : "schlecht"; }
const FARBE = { ok: "#248a3d", warn: "#d58a00", schlecht: "#ff3b30", "": "#8e8e96", marke: "#ee5e0b", lila: "#af52de", info: "#0a84ff" };

function ring(wert, groesse, oben, unten, farbe) {
  const g = groesse || 112, d = g * 0.085, r = (g - d) / 2, u = 2 * Math.PI * r;
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg"); s.setAttribute("width", g); s.setAttribute("height", g); s.setAttribute("aria-hidden", "true");
  const k = (stroke, len) => { const c = document.createElementNS(ns, "circle"); c.setAttribute("cx", g / 2); c.setAttribute("cy", g / 2); c.setAttribute("r", r); c.setAttribute("fill", "none"); c.setAttribute("stroke", stroke); c.setAttribute("stroke-width", d); c.setAttribute("stroke-linecap", "round"); if (len != null) c.setAttribute("stroke-dasharray", len + " " + u); return c; };
  s.appendChild(k("rgba(29,29,31,.08)"));
  if (wert != null) s.appendChild(k(farbe || FARBE[tonFuerWert(wert)], Math.max(0.01, Math.min(100, wert)) / 100 * u));
  const box = h("div.ring", { role: "img", "aria-label": (oben ?? wert) + " " + (unten || "") }, s, h("div.mitte", h("b", { text: oben ?? (wert == null ? "–" : wert) }), unten ? h("small", { text: unten }) : null));
  box.style.width = g + "px"; box.style.height = g + "px";
  if (g < 90) box.querySelector("b").style.fontSize = Math.round(g * 0.27) + "px";
  return box;
}
function balken(wert, farbe, breite) { const b = h("div.balken"); b.style.width = (breite || 100) + "px"; const s = h("span"); s.style.width = Math.max(1, Math.min(100, wert || 0)) + "%"; s.style.background = farbe || FARBE.marke; b.appendChild(s); return b; }
function stapel(teile) { const s = h("div.stapel"); const sum = teile.reduce((a, t) => a + (t[0] || 0), 0) || 1; for (const [v, f, n] of teile) { if (!v) continue; const x = h("span", { title: n || "" }); x.style.width = (v / sum * 100) + "%"; x.style.background = f; s.appendChild(x); } return s; }
function linie(werte, breite = 600, hoehe = 120, farbe = "#ee5e0b", umgedreht = false) {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg"); s.setAttribute("viewBox", "0 0 " + breite + " " + hoehe); s.setAttribute("preserveAspectRatio", "none"); s.setAttribute("aria-hidden", "true");
  const v = werte.filter((x) => typeof x === "number");
  if (v.length < 2) return s;
  let mn = Math.min(...v), mx = Math.max(...v); if (mn === mx) { mn -= 1; mx += 1; }
  const pkt = v.map((x, i) => [i / (v.length - 1) * (breite - 8) + 4, (umgedreht ? (x - mn) / (mx - mn) : 1 - (x - mn) / (mx - mn)) * (hoehe - 16) + 8]);
  const p = document.createElementNS(ns, "polyline"); p.setAttribute("points", pkt.map((q) => q.join(",")).join(" ")); p.setAttribute("fill", "none"); p.setAttribute("stroke", farbe); p.setAttribute("stroke-width", "2.5"); p.setAttribute("stroke-linejoin", "round"); p.setAttribute("vector-effect", "non-scaling-stroke");
  s.appendChild(p);
  return s;
}

async function api(pfad, opt = {}) {
  const a = await fetch(pfad, { method: opt.methode || (opt.daten ? "POST" : "GET"), headers: opt.daten ? { "content-type": "application/json" } : {}, body: opt.daten ? JSON.stringify(opt.daten) : undefined, credentials: "same-origin" });
  const j = await a.json().catch(() => ({}));
  if (!a.ok) { const e = new Error(j.fehler || ("Fehler " + a.status)); e.status = a.status; throw e; }
  return j;
}
/* Pruefung als Auftrag starten und abwarten. */
async function pruefungLaufen(modul, eingabe, beiMeldung) {
  const { auftrag } = await api("/api/pruefen/" + modul, { daten: eingabe });
  for (;;) {
    await new Promise((ok) => setTimeout(ok, 700));
    const s = await api("/api/auftrag/" + auftrag);
    if (beiMeldung) beiMeldung(s);
    if (s.status === "fertig") return s;
    if (s.status === "fehler") throw new Error(s.fehler);
  }
}
let ichCache = null;
async function ich(neu) { if (!ichCache || neu) ichCache = await api("/api/ich").catch(() => ({ konto: null, grenzen: {}, dienste: {} })); return ichCache; }

/* Ergebnisse ohne Konto: nur in diesem Browser. */
const OHNE = "waechter.ohneKonto";
const ohneKonto = {
  lesen() { try { return JSON.parse(localStorage.getItem(OHNE) || "[]"); } catch (e) { return []; } },
  dazu(e) { try { const l = this.lesen(); l.unshift(e); localStorage.setItem(OHNE, JSON.stringify(l.slice(0, 30))); return true; } catch (x) { return false; } },
  leeren() { try { localStorage.removeItem(OHNE); } catch (e) { /* egal */ } }
};

function meldung(text, ton) {
  const m = h("div.meldungsleiste.glas", { role: "status", text });
  if (ton === "fehler") m.style.color = "#b02318";
  document.body.appendChild(m);
  setTimeout(() => m.remove(), 3800);
}
function dialog(inhalt) {
  const grund = h("div.dialog-grund", { role: "dialog", "aria-modal": "true" });
  const d = h("div.dialog", inhalt);
  grund.appendChild(d);
  const zu = () => grund.remove();
  grund.addEventListener("click", (e) => { if (e.target === grund) zu(); });
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { zu(); document.removeEventListener("keydown", esc); } });
  document.body.appendChild(grund);
  const f = d.querySelector("button, input, select, textarea"); if (f) f.focus();
  return { zu, d };
}

function logo() {
  return h("a.logo", { href: "/", "aria-label": "SEO Wächter, Startseite" }, h("span.logo-zeichen", ic("radar", 20)), h("span", h("b", { text: "SEO Wächter" }), h("small", { text: "eine App von hnvr.me" })));
}
/* Die Navigation kommt fertig vom Server; hier nur Menue und Anmeldezustand. */
async function kopfAnpassen() {
  const nav = document.querySelector(".navigation");
  const i = await ich();
  if (!nav) return i;
  const m = nav.querySelector(".menue");
  if (m) m.addEventListener("click", () => { const o = nav.classList.toggle("offen"); m.setAttribute("aria-expanded", String(o)); });
  if (i.konto) { const k = nav.querySelector(".nav-konto"); if (k) leeren(k).appendChild(h("a.knopf.haupt", { href: "/app" }, ic("gauge", 16), "Dashboard")); }
  return i;
}
