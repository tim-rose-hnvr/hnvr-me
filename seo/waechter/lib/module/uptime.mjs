/* Modul Uptime: ein Abruf mit Zeitmessung je Abschnitt, Zertifikat,
   Weiterleitungen und HTTP/2-Faehigkeit. Gemessen wird vom Server des
   Waechters aus (ein Standort, Name ueber WAECHTER_STANDORT). */

import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import dns from "node:dns";
import { adresseLesen, hostErlaubt, privat, NutzerFehler } from "../schutz.mjs";
import { KENNUNG } from "../werk.mjs";
import { fehlerText } from "../abruf.mjs";

function sichererLookup(host, opt, cb) {
  dns.lookup(host, opt, (err, adr, fam) => {
    if (!err && process.env.WAECHTER_LOKAL_ERLAUBT !== "1") {
      const liste = Array.isArray(adr) ? adr : [{ address: adr }];
      if (liste.some((a) => privat(a.address))) return cb(new Error("Adresse zeigt ins interne Netz"));
    }
    cb(err, adr, fam);
  });
}

function einAbruf(url) {
  return new Promise((ok, fehl) => {
    const u = new URL(url);
    const modul = u.protocol === "https:" ? https : http;
    const t = { start: performance.now() };
    let zert = null, protokoll = null;
    const req = modul.request(u, {
      method: "GET", agent: false, lookup: sichererLookup, servername: u.hostname,
      headers: { "user-agent": KENNUNG, accept: "text/html,*/*", "accept-encoding": "identity" }
    }, (res) => {
      t.erstes = performance.now();
      let bytes = 0;
      res.on("data", (c) => { bytes += c.length; if (bytes > 8e6) req.destroy(); });
      res.on("end", () => {
        t.ende = performance.now();
        const d0 = t.dns ?? t.start, c0 = t.connect ?? d0, s0 = t.tls ?? c0;
        ok({
          status: res.statusCode, headers: res.headers, bytes,
          zeiten: {
            dns: Math.round(d0 - t.start), verbindung: Math.round(c0 - d0),
            tls: Math.round(s0 - c0), antwort: Math.round(t.erstes - s0),
            uebertragung: Math.round(t.ende - t.erstes)
          },
          gesamt: Math.round(t.ende - t.start), zert, protokoll
        });
      });
      res.on("error", fehl);
    });
    req.on("socket", (s) => {
      s.on("lookup", () => { t.dns = performance.now(); });
      s.on("connect", () => { t.connect = performance.now(); });
      s.on("secureConnect", () => {
        t.tls = performance.now();
        try { zert = s.getPeerCertificate(); protokoll = s.getProtocol(); } catch (e) { /* bleibt leer */ }
      });
    });
    req.setTimeout(15000, () => req.destroy(new Error("Keine Antwort binnen 15 Sekunden")));
    req.on("error", fehl);
    req.end();
  });
}

function h2Pruefen(host) {
  return new Promise((ok) => {
    const s = tls.connect({ host, port: 443, servername: host, ALPNProtocols: ["h2", "http/1.1"], lookup: sichererLookup }, () => {
      const p = s.alpnProtocol; s.end(); ok(p === "h2" ? "HTTP/2" : "HTTP/1.1");
    });
    s.on("error", () => ok(null));
    s.setTimeout(8000, () => { s.destroy(); ok(null); });
  });
}

export async function messen(eingabeUrl) {
  let url = adresseLesen(eingabeUrl);
  const kette = [];
  let letzte;
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) {
    const u = new URL(url);
    await hostErlaubt(u.hostname);
    try { letzte = await einAbruf(url); }
    catch (e) {
      return { erreichbar: false, fehler: fehlerText(e), ziel: url, kette, gesamt: Date.now() - t0 };
    }
    if (letzte.status >= 300 && letzte.status < 400 && letzte.headers.location) {
      kette.push({ von: url, status: letzte.status, nach: new URL(letzte.headers.location, url).href, ms: letzte.gesamt });
      url = new URL(letzte.headers.location, url).href;
      continue;
    }
    break;
  }
  const z = letzte.zert && letzte.zert.valid_to ? letzte.zert : null;
  const host = new URL(url).hostname;
  const protokoll = url.startsWith("https:") ? await h2Pruefen(host) : "HTTP/1.1";
  return {
    erreichbar: letzte.status < 400 || letzte.status === 429, gebremst: letzte.status === 429, status: letzte.status, ziel: url, kette,
    zeiten: letzte.zeiten, gesamt: letzte.gesamt, bytes: letzte.bytes,
    protokoll, tls: letzte.protokoll,
    zertifikat: z ? {
      bis: new Date(z.valid_to).toISOString(),
      tage: Math.floor((new Date(z.valid_to) - Date.now()) / 86400e3),
      aussteller: z.issuer?.O || z.issuer?.CN || null, fuer: z.subject?.CN || null
    } : null,
    server: letzte.headers.server || null,
    zwischenspeicher: letzte.headers["cache-control"] || null
  };
}

export async function pruefen(eingabe) {
  const m = await messen(eingabe.url);
  const standort = process.env.WAECHTER_STANDORT || "Server des Wächters";
  const befunde = [];
  if (!m.erreichbar) befunde.push({ id: "nicht-erreichbar", name: m.status ? "Seite antwortet mit Fehler " + m.status : "Nicht erreichbar", stufe: "kritisch", wie: m.fehler || "Der Server ist erreichbar, liefert unter dieser Adresse aber einen Fehler." });
  if (m.gebremst) befunde.push({ id: "gebremst", name: "Server bremst Abrufe (429)", stufe: "hinweis", wie: "Der Server ist erreichbar, lehnt aber gerade zu viele Abrufe ab. Für Besucher ist das meist unsichtbar; wenn es dauerhaft auftritt, auch Suchmaschinen-Crawler prüfen." });
  if (m.kette.length > 1) befunde.push({ id: "kette", name: "Weiterleitungskette", stufe: "wichtig", wie: m.kette.length + " Weiterleitungen bis zur Seite." });
  if (m.zertifikat && m.zertifikat.tage < 14) befunde.push({ id: "zert", name: "Zertifikat läuft bald ab", stufe: m.zertifikat.tage < 3 ? "kritisch" : "wichtig", wie: "Noch " + m.zertifikat.tage + " Tage." });
  if (m.zeiten && m.zeiten.antwort > 800) befunde.push({ id: "langsam", name: "Server antwortet langsam", stufe: "wichtig", wie: "Bis zur ersten Antwort vergehen " + m.zeiten.antwort + " ms." });
  else if (m.zeiten && m.zeiten.antwort > 300 && !m.zwischenspeicher) befunde.push({ id: "cache", name: "Kein Zwischenspeicher angegeben", stufe: "hinweis", wie: "Die erste Antwort braucht " + m.zeiten.antwort + " ms, und es gibt keine Cache-Control-Angabe." });
  return {
    modul: "uptime", ziel: m.ziel, standort, ...m, befunde,
    punkte: null,
    kurz: m.gebremst ? "erreichbar, bremst Abrufe (429)" : m.erreichbar ? "erreichbar · " + m.gesamt + " ms · Status " + m.status : m.status ? "Seite antwortet mit Fehler " + m.status : "nicht erreichbar · " + m.fehler
  };
}

export { NutzerFehler };
