#!/usr/bin/env node
/* SEO Waechter · Server. Ohne Fremdpakete.
   node server.mjs [--port 4380]
   Umgebung: siehe LIESMICH.md (SMTP_*, DATAFORSEO_*, OPENAI_API_KEY, …). */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAbsichern, grenzePruefen, NutzerFehler } from "./lib/schutz.mjs";
import * as K from "./lib/konto.mjs";
import * as P from "./lib/pruefungen.mjs";
import { auftragStarten, auftrag, grenzen, MODULE } from "./lib/ausfuehren.mjs";
import { kiAnbieter, dfsBereit } from "./lib/module/extern.mjs";
import { mailBereit } from "./lib/mailversand.mjs";
import * as U from "./lib/ueberwachung.mjs";
import * as G from "./lib/googlekonto.mjs";
import { psiBereit, gscBereit, anmeldeAdresse } from "./lib/module/google.mjs";
import crypto from "node:crypto";

fetchAbsichern();
const hier = path.dirname(fileURLToPath(import.meta.url));
const OEFFENTLICH = path.join(hier, "public");
const argPort = process.argv.indexOf("--port");
const PORT = Number(argPort > 0 ? process.argv[argPort + 1] : process.env.PORT || 4380);

const TYPEN = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png", ".ico": "image/x-icon", ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json" };
const SICHERHEIT = {
  "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
};

function senden(res, status, koerper, kopf = {}) {
  res.writeHead(status, { ...SICHERHEIT, ...kopf });
  res.end(koerper);
}
function json(res, status, daten, kopf = {}) {
  senden(res, status, JSON.stringify(daten), { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...kopf });
}
async function koerper(req, max = 4e6) {
  let n = 0; const teile = [];
  for await (const c of req) { n += c.length; if (n > max) throw new NutzerFehler("Anfrage zu groß.", 413); teile.push(c); }
  const t = Buffer.concat(teile).toString("utf8");
  if (!t) return {};
  try { return JSON.parse(t); } catch (e) { throw new NutzerFehler("Ungültige Anfrage."); }
}
/* HTML-Seiten bekommen Kopf, Fuss und Angaben je Werkzeug vom Server,
   damit Suchmaschinen Titel, Beschreibung und Verweise ohne Skript sehen. */
const TEILE = {};
function teil(name) {
  if (!TEILE[name] || process.env.WAECHTER_DEV === "1") TEILE[name] = fs.readFileSync(path.join(OEFFENTLICH, "teile", name + ".html"), "utf8");
  return TEILE[name];
}
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
export const WERKZEUG_TEXT = {
  gesamt: ["Gesamtcheck", "Eine Adresse, fünf Prüfungen gleichzeitig: Website, Ladezeit, Domain, Erreichbarkeit, Mail-Schutz und KI-Sichtbarkeit, mit einer Liste, was zuerst zu tun ist."],
  audit: ["Website-Audit", "Prüft eine Seite oder die ganze Website gegen 158 Regeln: Technik, Struktur, Inhalt, KI-Lesbarkeit und Leistung, sortiert nach dem, was zuerst zu tun ist."],
  rankings: ["Rankings", "Auf welcher Position stehen Ihre Seiten bei Google? Bis zu fünf Keywords ohne Konto, für Desktop oder Telefon."],
  ki: ["KI-Sichtbarkeit", "Dürfen ChatGPT, Claude, Perplexity und andere KI-Dienste Ihre Website lesen, und werden Sie genannt, wenn man ihnen eine Frage stellt?"],
  backlinks: ["Backlinks", "Wer verweist auf Ihre Website, mit welchem Ankertext und wie stark? Ohne Konto die 50 stärksten Verweise."],
  konkurrenz: ["Konkurrenz", "Ihre Website neben Mitbewerbern: Punktzahl, Tempo, Größe, Sitemap, KI-Zugang und strukturierte Daten, alles selbst gemessen."],
  content: ["Content", "Steht Ihr Keyword dort, wo es zählt? Mit Lesbarkeit, Snippet in Pixeln und den Begriffen, die Vergleichsseiten verwenden."],
  uptime: ["Uptime", "Ruft Ihre Website ab und zeigt Antwortzeit je Abschnitt, Weiterleitungen, Protokoll und Zertifikat."],
  domain: ["Domain-Check", "48 Regeln zu Erreichbarkeit, Zertifikat, Kopfzeilen, Cookies, DNS und Standarddateien, dazu freie Domain-Namen und Tippfehler-Domains."],
  mail: ["Mail-Prüfer", "Ist diese Mail echt, Spam oder Betrug? Oder: Ist Ihre eigene Domain mit SPF, DKIM und DMARC gegen Fälschung geschützt?"]
};
function datei(res, rel, status = 200, req = null, extra = {}) {
  const ziel = path.join(OEFFENTLICH, rel);
  if (!ziel.startsWith(OEFFENTLICH)) return senden(res, 403, "verboten");
  fs.readFile(ziel, (err, inhalt) => {
    if (err) return datei(res, "404.html", 404, req);
    const typ = TYPEN[path.extname(ziel)] || "application/octet-stream";
    if (typ.startsWith("text/html")) {
      const b = process.env.WAECHTER_BASIS || (req ? basis(req) : "");
      const werte = { KOPF: teil("kopf"), FUSS: teil("fuss"), BASIS: b, ...extra };
      inhalt = inhalt.toString("utf8").replace(/\{\{([A-Z]+)\}\}/g, (m, k) => werte[k] != null ? (k === "KOPF" || k === "FUSS" ? werte[k] : attr(werte[k])) : m);
    }
    senden(res, status, inhalt, { "content-type": typ, "cache-control": typ.startsWith("text/html") || process.env.WAECHTER_DEV === "1" ? "no-cache" : "public, max-age=300" });
  });
}
const basis = (req) => (req.headers["x-forwarded-proto"] || "http") + "://" + req.headers.host;
const istSicher = (req) => req.headers["x-forwarded-proto"] === "https";
const ip = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
function brauchtKonto(k) { if (!k) throw new NutzerFehler("Bitte anmelden.", 401); return k; }
function gleicheHerkunft(req) {
  const o = req.headers.origin;
  if (o && o !== basis(req) && o !== basis(req).replace("http:", "https:")) throw new NutzerFehler("Fremde Herkunft.", 403);
}

async function api(req, res, url, konto) {
  const m = req.method;
  const p = url.pathname;
  if (m !== "GET") gleicheHerkunft(req);

  if (p === "/api/ich" && m === "GET") {
    return json(res, 200, {
      konto: konto ? { email: konto.email, projekte: konto.projekte, aktivesProjekt: konto.aktivesProjekt, alarmMail: konto.alarmMail, google: G.oeffentlich(konto) } : null,
      grenzen: grenzen(konto), dienste: { mail: mailBereit(), suchdaten: dfsBereit(), ki: kiAnbieter().map((a) => ({ name: a.name, bereit: a.bereit })),
        google: { pagespeed: psiBereit(), searchConsole: gscBereit(), gemini: !!process.env.GEMINI_API_KEY } }
    });
  }
  let r;
  if ((r = /^\/api\/pruefen\/([a-z]+)$/.exec(p)) && m === "POST") {
    const modul = r[1];
    if (!MODULE[modul]) throw new NutzerFehler("Unbekanntes Werkzeug.", 404);
    grenzePruefen((konto ? "k:" + konto.id : "ip:" + ip(req)) + "|" + modul, !!konto);
    const eingabe = await koerper(req);
    const projektId = konto ? (eingabe.projektId || konto.aktivesProjekt) : null;
    const a = auftragStarten(modul, eingabe, { konto }, konto ? async (ergebnis) => {
      const vorhanden = await P.gleiche(konto.id, modul, ergebnis, eingabe, projektId);
      if (vorhanden) { await P.neuerLauf(konto.id, vorhanden.id, ergebnis); return vorhanden.id; }
      return (await P.anlegen(konto.id, { modul, eingabe, ergebnis, herkunft: "von Hand", projektId })).id;
    } : null);
    return json(res, 202, { auftrag: a.id });
  }
  if ((r = /^\/api\/auftrag\/([\w-]+)$/.exec(p)) && m === "GET") {
    const a = auftrag(r[1]);
    if (!a) throw new NutzerFehler("Auftrag nicht gefunden oder abgelaufen.", 404);
    return json(res, 200, { status: a.status, meldungen: a.meldungen.slice(-5), dauer: Date.now() - a.start, ergebnis: a.status === "fertig" ? a.ergebnis : null, fehler: a.fehler, pruefungId: a.pruefungId });
  }
  if (p === "/api/anmelden" && m === "POST") {
    const b = await koerper(req);
    grenzePruefen("anmelden|" + ip(req), false);
    const e = await K.linkAnfordern(b.email, basis(req));
    return json(res, 200, { ok: true, versandt: e.versandt, devLink: e.devLink });
  }
  if (p === "/api/abmelden" && m === "POST") {
    await K.abmelden(req);
    return json(res, 200, { ok: true }, { "set-cookie": K.sitzungsCookie("", istSicher(req), 0) });
  }

  /* ab hier mit Konto */
  const k = brauchtKonto(konto);
  if (p === "/api/konto" && m === "PATCH") {
    const b = await koerper(req);
    const neu = await K.kontoAendern(k.id, (x) => { if (b.alarmMail !== undefined) x.alarmMail = b.alarmMail ? K.emailLesen(b.alarmMail) : null; return x; });
    return json(res, 200, { ok: true, alarmMail: neu.alarmMail });
  }
  if (p === "/api/konto" && m === "DELETE") {
    await K.kontoLoeschen(k.id);
    return json(res, 200, { ok: true }, { "set-cookie": K.sitzungsCookie("", istSicher(req), 0) });
  }
  if (p === "/api/projekte" && m === "POST") {
    const b = await koerper(req);
    const { domainLesen } = await import("./lib/schutz.mjs");
    const domain = domainLesen(b.domain);
    const x = await K.kontoAendern(k.id, (kk) => {
      if (kk.projekte.length >= 3) throw new NutzerFehler("Höchstens drei Projekte.");
      if (kk.projekte.some((pp) => pp.domain === domain)) throw new NutzerFehler("Dieses Projekt gibt es schon.");
      const pr = { id: K.neueId(), domain, name: String(b.name || domain).slice(0, 80), angelegt: new Date().toISOString() };
      kk.projekte.push(pr); kk.aktivesProjekt = pr.id;
      return pr;
    });
    /* Pruefungen ohne Projekt, die zu dieser Domain gehoeren, wandern mit. */
    const liste = await P.liste(k.id);
    for (const pp of liste) if (!pp.projektId && (pp.ziel || "").replace(/^https?:\/\//, "").replace(/^www\./, "").startsWith(domain)) await P.aendernEine(k.id, pp.id, (q) => { q.projektId = x.id; });
    return json(res, 201, x);
  }
  if ((r = /^\/api\/projekte\/([\w-]+)$/.exec(p)) && m === "DELETE") {
    await K.kontoAendern(k.id, (kk) => { kk.projekte = kk.projekte.filter((x) => x.id !== r[1]); if (kk.aktivesProjekt === r[1]) kk.aktivesProjekt = kk.projekte[0]?.id || null; });
    return json(res, 200, { ok: true });
  }
  if ((r = /^\/api\/projekte\/([\w-]+)\/aktiv$/.exec(p)) && m === "POST") {
    await K.kontoAendern(k.id, (kk) => { if (!kk.projekte.some((x) => x.id === r[1])) throw new NutzerFehler("Projekt nicht gefunden.", 404); kk.aktivesProjekt = r[1]; });
    return json(res, 200, { ok: true });
  }
  if (p === "/api/pruefungen" && m === "GET") {
    const projekt = url.searchParams.get("projekt");
    const l = (await P.liste(k.id)).filter((x) => !projekt || projekt === "alle" || x.projektId === projekt || (!x.projektId && projekt === "ohne"));
    return json(res, 200, l.map(P.zusammenfassung));
  }
  if (p === "/api/pruefungen.csv" && m === "GET") {
    return senden(res, 200, P.csv(await P.liste(k.id)), { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="seo-waechter-pruefungen.csv"' });
  }
  if (p === "/api/export.json" && m === "GET") {
    const s = await P.stand(k.id);
    return senden(res, 200, JSON.stringify({ konto: { email: k.email, projekte: k.projekte }, ...s }, null, 2), { "content-type": "application/json; charset=utf-8", "content-disposition": 'attachment; filename="seo-waechter-daten.json"' });
  }
  if (p === "/api/pruefungen" && m === "POST") {
    const b = await koerper(req);
    const x = await P.anlegen(k.id, { modul: b.modul, eingabe: b.eingabe, ergebnis: b.ergebnis, herkunft: b.herkunft === "ohne Anmeldung" ? "ohne Anmeldung" : "von Hand", projektId: b.projektId || k.aktivesProjekt, zeit: b.zeit });
    return json(res, 201, P.zusammenfassung(x));
  }
  if (p === "/api/pruefungen/uebernehmen" && m === "POST") {
    const b = await koerper(req, 2e7);
    const liste = (b.liste || []).slice(0, 50);
    const ids = [];
    for (const e of liste) ids.push((await P.anlegen(k.id, { modul: e.modul, eingabe: e.eingabe, ergebnis: e.ergebnis, herkunft: "ohne Anmeldung", projektId: b.projektId || k.aktivesProjekt, zeit: e.zeit })).id);
    return json(res, 201, { ids });
  }
  if ((r = /^\/api\/pruefungen\/([\w-]+)$/.exec(p))) {
    if (m === "GET") return json(res, 200, await P.holenEine(k.id, r[1]));
    if (m === "DELETE") { await P.loeschenEine(k.id, r[1]); return json(res, 200, { ok: true }); }
    if (m === "PATCH") {
      const b = await koerper(req);
      const x = await P.aendernEine(k.id, r[1], (pp) => {
        if (b.ueberwacht) {
          if (pp.modul === "mail" && pp.eingabe.art !== "domain") throw new NutzerFehler("Eine einzelne Nachricht lässt sich nicht überwachen.");
          pp.ueberwacht.an = !!b.ueberwacht.an;
          if (b.ueberwacht.takt) pp.ueberwacht.takt = Math.max(pp.modul === "uptime" ? 1 : 60, Math.min(43200, Number(b.ueberwacht.takt) || pp.ueberwacht.takt));
          pp.ueberwacht.naechste = pp.ueberwacht.an ? Date.now() + 5000 : null;
        }
        if (b.projektId !== undefined) pp.projektId = b.projektId;
        return pp;
      });
      return json(res, 200, P.zusammenfassung(x));
    }
  }
  if ((r = /^\/api\/pruefungen\/([\w-]+)\/erneut$/.exec(p)) && m === "POST") {
    const x = await P.holenEine(k.id, r[1]);
    if (x.modul === "mail" && x.eingabe.art !== "domain") throw new NutzerFehler("Nachrichten werden nicht gespeichert und lassen sich deshalb nicht erneut prüfen.");
    grenzePruefen("k:" + k.id + "|" + x.modul, true);
    const a = auftragStarten(x.modul, x.eingabe, { konto: k }, async (ergebnis) => { await P.neuerLauf(k.id, x.id, ergebnis); return x.id; });
    return json(res, 202, { auftrag: a.id });
  }
  if (p === "/api/google/trennen" && m === "POST") { await G.trennen(k.id); return json(res, 200, { ok: true }); }
  if (p === "/api/hinweise" && m === "GET") return json(res, 200, (await P.stand(k.id)).hinweise);
  if (p === "/api/hinweise/gelesen" && m === "POST") { await P.hinweiseGelesen(k.id); return json(res, 200, { ok: true }); }
  if (p === "/api/ueberwachung/jetzt" && m === "POST" && process.env.WAECHTER_DEV === "1") return json(res, 200, { geprueft: await U.runde() });
  throw new NutzerFehler("Unbekannte Schnittstelle.", 404);
}

const SEITEN = { "/": "index.html", "/anmelden": "anmelden.html", "/impressum": "impressum.html", "/datenschutz": "datenschutz.html" };
const WERKZEUGE = new Set(Object.keys(MODULE));

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    const konto = await K.kontoAus(req);
    if (url.pathname.startsWith("/api/")) return await api(req, res, url, konto);
    if (url.pathname === "/anmelden/bestaetigen") {
      try {
        const { sitzung } = await K.bestaetigen(url.searchParams.get("t") || "");
        return senden(res, 302, "", { location: "/app?angemeldet=1", "set-cookie": K.sitzungsCookie(sitzung, istSicher(req)) });
      } catch (e) {
        return senden(res, 302, "", { location: "/anmelden?fehler=" + encodeURIComponent(e.message) });
      }
    }
    /* Google Search Console verbinden: Zustand im Cookie gegen fremde Rueckrufe. */
    if (url.pathname === "/google/verbinden") {
      if (!konto) return senden(res, 302, "", { location: "/anmelden?weiter=/app" });
      if (!gscBereit()) return senden(res, 302, "", { location: "/app#einstellungen" });
      const zustand = crypto.randomBytes(18).toString("base64url");
      return senden(res, 302, "", { location: anmeldeAdresse(zustand, (process.env.WAECHTER_BASIS || basis(req)) + "/google/rueckruf"),
        "set-cookie": "waechter_google=" + zustand + "; Path=/google; HttpOnly; SameSite=Lax; Max-Age=600" + (istSicher(req) ? "; Secure" : "") });
    }
    if (url.pathname === "/google/rueckruf") {
      if (!konto) return senden(res, 302, "", { location: "/anmelden?weiter=/app" });
      const erwartet = K.cookieLesen(req).waechter_google;
      const weg = "waechter_google=; Path=/google; HttpOnly; SameSite=Lax; Max-Age=0";
      if (url.searchParams.get("error") || !erwartet || erwartet !== url.searchParams.get("state")) {
        return senden(res, 302, "", { location: "/app?google=abgebrochen#einstellungen", "set-cookie": weg });
      }
      try {
        await G.verbinden(konto.id, url.searchParams.get("code") || "", (process.env.WAECHTER_BASIS || basis(req)) + "/google/rueckruf");
        return senden(res, 302, "", { location: "/app?google=verbunden#einstellungen", "set-cookie": weg });
      } catch (e) {
        console.error("[Google]", e.message);
        return senden(res, 302, "", { location: "/app?google=fehler#einstellungen", "set-cookie": weg });
      }
    }
    if (url.pathname === "/app" || url.pathname.startsWith("/app/")) {
      if (!konto) return senden(res, 302, "", { location: "/anmelden?weiter=" + encodeURIComponent(url.pathname + url.search) });
      return datei(res, "app.html");
    }
    let r;
    if ((r = /^\/werkzeug\/([a-z]+)\/?$/.exec(url.pathname)) && WERKZEUGE.has(r[1])) {
      const [titel, beschreibung] = WERKZEUG_TEXT[r[1]];
      return datei(res, "werkzeug.html", 200, req, { TITEL: titel, BESCHREIBUNG: beschreibung, MODUL: r[1], KANONISCH: (process.env.WAECHTER_BASIS || basis(req)) + "/werkzeug/" + r[1] });
    }
    if (SEITEN[url.pathname]) return datei(res, SEITEN[url.pathname], 200, req);
    if (/^\/(css|js|fonts|bilder)\/[\w./-]+$/.test(url.pathname) && !url.pathname.includes("..")) return datei(res, url.pathname.slice(1));
    if (url.pathname === "/favicon.svg" || url.pathname === "/robots.txt") return datei(res, url.pathname.slice(1));
    if (url.pathname === "/sitemap.xml") {
      const b = process.env.WAECHTER_BASIS || basis(req);
      return senden(res, 200, '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        ["/", ...[...WERKZEUGE].map((w) => "/werkzeug/" + w)].map((p) => "<url><loc>" + b + p + "</loc></url>").join("") + "</urlset>", { "content-type": "application/xml; charset=utf-8" });
    }
    return datei(res, "404.html", 404, req);
  } catch (e) {
    const status = e instanceof NutzerFehler ? e.status : 500;
    if (status === 500) console.error("[Server]", e);
    if (url.pathname.startsWith("/api/")) return json(res, status, { fehler: status === 500 ? "Interner Fehler." : e.message });
    senden(res, status, "Fehler: " + (status === 500 ? "intern" : e.message), { "content-type": "text/plain; charset=utf-8" });
  }
});

server.listen(PORT, () => {
  console.log("SEO Wächter läuft auf http://localhost:" + PORT +
    " · Mail " + (mailBereit() ? "eingerichtet" : "NICHT eingerichtet (Links im Protokoll)") +
    " · Suchdaten " + (dfsBereit() ? "eingerichtet" : "nicht eingerichtet"));
  if (process.env.WAECHTER_UEBERWACHUNG !== "0") U.starten();
});
