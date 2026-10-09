#!/usr/bin/env node
/* SEO Waechter · Selbsttest gegen einen echten Serverlauf.
   Startet den Server mit leerer Datenablage und einem lokalen Pruef-SMTP-Server,
   ruft jedes Werkzeug gegen echte Websites auf und spielt den Kontoablauf durch:
   Anmeldelink per Mail, Projekt, Speichern, Uebernahme, Ueberwachung, Export, Loeschen.
   node test/selbsttest.mjs   (braucht Netz) */

import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = path.resolve(hier, "..");
let ok = 0, fehl = 0;
const pruefe = (name, bedingung, info = "") => { if (bedingung) { ok++; console.log("  ok    " + name); } else { fehl++; console.log("  FEHL  " + name + (info ? "  · " + info : "")); } };

/* Pruef-SMTP-Server: nimmt eine Mail an und merkt sie sich. */
const mails = [];
const smtp = net.createServer((s) => {
  let daten = false, puffer = "", text = "";
  s.write("220 test ESMTP\r\n");
  s.on("data", (d) => {
    puffer += d.toString();
    let i;
    while ((i = puffer.indexOf("\r\n")) >= 0) {
      const z = puffer.slice(0, i); puffer = puffer.slice(i + 2);
      if (daten) { if (z === ".") { daten = false; mails.push(text); text = ""; s.write("250 ok\r\n"); } else text += z + "\n"; continue; }
      if (/^EHLO/i.test(z)) s.write("250-test\r\n250 OK\r\n");
      else if (/^DATA/i.test(z)) { daten = true; s.write("354 los\r\n"); }
      else if (/^QUIT/i.test(z)) { s.write("221 bye\r\n"); s.end(); }
      else s.write("250 ok\r\n");
    }
  });
});
await new Promise((ok) => smtp.listen(0, "127.0.0.1", ok));
const smtpPort = smtp.address().port;

/* Nachgebauter Google-Server: PageSpeed, OAuth, Search Console.
   Prueft unseren Code gegen die dokumentierten Formate, nicht Google selbst. */
const google = { schluessel: [], grants: [], bearer: [] };
const http = await import("node:http");
const gServer = http.createServer(async (req, res) => {
  let koerper = ""; for await (const c of req) koerper += c;
  const u = new URL(req.url, "http://x");
  const j = (s, d) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(d)); };
  if (u.pathname === "/pagespeedonline/v5/runPagespeed") {
    google.schluessel.push(u.searchParams.get("key"));
    return j(200, { lighthouseResult: { categories: { performance: { score: 0.63 } }, audits: {
      "largest-contentful-paint": { title: "Largest Contentful Paint", displayValue: "4,1 s", numericValue: 4100, score: 0.2 },
      "total-blocking-time": { title: "Total Blocking Time", displayValue: "320 ms", numericValue: 320, score: 0.6 },
      "render-blocking-resources": { title: "Ressourcen blockieren das Rendering", score: 0.3, details: { type: "opportunity", overallSavingsMs: 850 } } } },
      loadingExperience: { overall_category: "AVERAGE", metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2900, category: "AVERAGE" }, INTERACTION_TO_NEXT_PAINT: { percentile: 180, category: "FAST" }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 5, category: "FAST" } } } });
  }
  if (u.pathname === "/token") {
    const f = new URLSearchParams(koerper);
    google.grants.push(f.get("grant_type"));
    if (f.get("client_secret") !== "pruef-geheim") return j(401, { error: "invalid_client" });
    if (f.get("grant_type") === "authorization_code" && f.get("code") === "gut") return j(200, { access_token: "zugang-1", expires_in: 3600, refresh_token: "erneuer-1" });
    if (f.get("grant_type") === "refresh_token" && f.get("refresh_token") === "erneuer-1") return j(200, { access_token: "zugang-2", expires_in: 3600 });
    return j(400, { error: "invalid_grant" });
  }
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  google.bearer.push(auth);
  if (!/^zugang-/.test(auth)) return j(401, { error: { message: "unauthorized" } });
  if (u.pathname === "/webmasters/v3/sites") return j(200, { siteEntry: [{ siteUrl: "sc-domain:hnvr.me", permissionLevel: "siteOwner" }, { siteUrl: "https://fremd.example/", permissionLevel: "siteUnverifiedUser" }] });
  if (u.pathname === "/webmasters/v3/sites/" + encodeURIComponent("sc-domain:hnvr.me") + "/searchAnalytics/query") {
    const b = JSON.parse(koerper);
    if (b.dimensions[0] === "query") return j(200, { rows: [{ keys: ["digitale erlebnisse"], clicks: 12, impressions: 340, ctr: 0.035, position: 6.4 }, { keys: ["agentur hannover"], clicks: 3, impressions: 900, ctr: 0.003, position: 18.2 }] });
    if (b.dimensions[0] === "page") return j(200, { rows: [{ keys: ["https://www.hnvr.me/"], clicks: 15, impressions: 1240, ctr: 0.012, position: 14.1 }] });
    return j(200, { rows: [{ keys: ["2026-10-01"], clicks: 4, impressions: 400, ctr: 0.01, position: 14 }, { keys: ["2026-10-02"], clicks: 6, impressions: 420, ctr: 0.014, position: 13.8 }] });
  }
  j(404, { error: { message: "unbekannt " + u.pathname } });
});
await new Promise((ok) => gServer.listen(0, "127.0.0.1", ok));
const GB = "http://127.0.0.1:" + gServer.address().port;

const daten = fs.mkdtempSync(path.join(os.tmpdir(), "waechter-test-"));
const port = 4390 + Math.floor(Math.random() * 500);
const kind = spawn(process.execPath, [path.join(WURZEL, "server.mjs"), "--port", String(port)], {
  env: { ...process.env, WAECHTER_DATEN: daten, WAECHTER_DEV: "1", WAECHTER_UEBERWACHUNG: "0",
    SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtpPort), SMTP_SICHER: "0", SMTP_ABSENDER: "waechter@test.local",
    DATAFORSEO_LOGIN: "", DATAFORSEO_PASSWORT: "", OPENAI_API_KEY: "", GEMINI_API_KEY: "", PERPLEXITY_API_KEY: "",
    GOOGLE_API_BASIS: GB, GOOGLE_OAUTH_BASIS: GB, GOOGLE_AUTH_BASIS: GB, GOOGLE_API_KEY: "pruefschluessel", GOOGLE_CLIENT_ID: "pruef-id", GOOGLE_CLIENT_SECRET: "pruef-geheim" },
  stdio: ["ignore", "pipe", "pipe"]
});
let protokoll = "";
kind.stdout.on("data", (d) => { protokoll += d; });
kind.stderr.on("data", (d) => { protokoll += d; });
const B = "http://localhost:" + port;
for (let i = 0; i < 50; i++) { try { await fetch(B + "/api/ich"); break; } catch (e) { await new Promise((r) => setTimeout(r, 150)); } }

let keks = "";
async function anfrage(pfad, opt = {}) {
  const a = await fetch(B + pfad, { method: opt.methode || (opt.daten ? "POST" : "GET"), redirect: "manual",
    headers: { ...(opt.daten ? { "content-type": "application/json" } : {}), ...(keks ? { cookie: keks } : {}), origin: B },
    body: opt.daten ? JSON.stringify(opt.daten) : undefined });
  const typ = a.headers.get("content-type") || "";
  return { status: a.status, kopf: a.headers, inhalt: typ.includes("json") ? await a.json() : await a.text() };
}
async function laufen(modul, eingabe) {
  const s = await anfrage("/api/pruefen/" + modul, { daten: eingabe });
  if (s.status !== 202) return { status: "fehler", fehler: JSON.stringify(s.inhalt) };
  for (let i = 0; i < 400; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const a = await anfrage("/api/auftrag/" + s.inhalt.auftrag);
    if (a.inhalt.status !== "laeuft") return a.inhalt;
  }
  return { status: "zeitueberschreitung" };
}

try {
  console.log("\nSeiten");
  const start = await anfrage("/");
  pruefe("Startseite 200 mit Ueberschrift", start.status === 200 && start.inhalt.includes("<h1>Ihre Website im Blick."));
  pruefe("keine offenen Platzhalter", !/\{\{[A-Z]+\}\}/.test(start.inhalt));
  pruefe("Inhaltsrichtlinie gesetzt", (start.kopf.get("content-security-policy") || "").includes("default-src 'self'"));
  for (const m of ["gesamt", "audit", "rankings", "ki", "backlinks", "konkurrenz", "content", "uptime", "domain", "mail"]) {
    const w = await anfrage("/werkzeug/" + m);
    pruefe("Werkzeugseite " + m + " mit eigenem Titel und kanonischer Adresse", w.status === 200 && /<title>[^·]+· kostenlos/.test(w.inhalt) && w.inhalt.includes('rel="canonical" href="' + B + "/werkzeug/" + m + '"'));
  }
  const sm = await anfrage("/sitemap.xml");
  pruefe("Sitemap mit 11 Adressen", (sm.inhalt.match(/<loc>/g) || []).length === 11);
  pruefe("unbekannte Seite 404", (await anfrage("/gibt-es-nicht")).status === 404);
  pruefe("Dashboard ohne Konto leitet auf Anmeldung", (await anfrage("/app")).status === 302);
  const fremd = [];
  for (const d of ["", "js", "css", "teile"]) for (const f of fs.readdirSync(path.join(WURZEL, "public", d)).filter((x) => /\.(html|js|css)$/.test(x))) {
    const t = fs.readFileSync(path.join(WURZEL, "public", d, f), "utf8");
    for (const m of t.matchAll(/(?:src|href|url)\s*[=(]\s*["']?(https?:\/\/[^"')\s]+)/g)) if (!m[1].includes("w3.org/2000/svg")) fremd.push(f + ": " + m[1]);
  }
  pruefe("keine Fremdaufrufe in Seiten, Skripten, Stilen", fremd.length === 0, fremd.join(", "));

  console.log("\nWerkzeuge ohne Konto");
  const roh = fs.readFileSync(path.join(hier, "probe-betrug.eml"), "utf8");
  const faelle = [
    ["audit", { url: "https://www.hnvr.me/" }, (r) => typeof r.punkte === "number" && r.befunde.length > 0 && r.tempo && r.tempo.punkte === 63 && r.tempo.feld.length === 3 && r.tempo.chancen[0].ersparnisMs === 850],
    ["audit", { url: "https://www.hnvr.me/", umfang: "website", max: 8 }, (r) => r.seiten === 8 && r.seitenListe.length === 8],
    ["domain", { domain: "hnvr.me", idee: "atelier nord hannover", endungen: ["de"] }, (r) => typeof r.punkte === "number" && r.vorschlaege.length > 0 && r.tippfehler.length > 0],
    ["uptime", { url: "hnvr.me" }, (r) => r.erreichbar === true && r.zeiten.antwort >= 0 && r.zertifikat && r.zertifikat.tage > 0],
    ["mail", { art: "nachricht", roh }, (r) => r.risiko >= 70 && r.phishing === true && r.signale.length >= 5],
    ["mail", { art: "domain", domain: "hnvr.me" }, (r) => typeof r.punkte === "number" && r.spf && r.dmarc],
    ["content", { url: "https://www.hnvr.me/", keyword: "digitale erlebnisse", vergleich: ["https://www.w3.org/", "https://www.wikipedia.org/"] }, (r) => r.stellen.length === 8 && r.begriffe && r.snippet.titelPx > 0],
    ["ki", { url: "https://www.hnvr.me/", frage: "Wer baut Websites in Hannover?", marke: "hnvr.me" }, (r) => r.zugang && r.zugang.crawler.length > 5 && Array.isArray(r.antworten)],
    ["konkurrenz", { eigene: "hnvr.me", mitbewerber: ["w3.org"] }, (r) => r.reihen.length === 11 && r.domains.length === 2 && typeof r.reihen.find((x) => x.schluessel === "gewicht").werte[0] === "number"],
    ["gesamt", { url: "https://www.hnvr.me/" }, (r) => typeof r.punkte === "number" && r.bereiche.length === 5 && r.bereiche.every((b) => !b.fehler) && r.massnahmen.length > 5 && r.teile.audit.ladezeit && r.teile.audit.ladezeit.anfragen > 1],
    ["audit", { url: "https://expired.badssl.com/" }, (r) => r.zertifikatFehler && r.befunde[0].id === "zertifikat-ungueltig"],
    ["uptime", { url: "https://www.w3.org/gibt-es-nicht-4711" }, (r) => r.erreichbar === false && /Fehler 404/.test(r.kurz)],
    ["mail", { art: "domain", domain: "de.wikipedia.org" }, (r) => r.dmarc && r.dmarc.geerbt === "wikipedia.org"],
    ["domain", { domain: "hnvr.me" }, (r) => r.registrierung.ok && /WHOIS/.test(r.registrierung.quelle) && !!r.fristen.domainBis],
    ["rankings", { domain: "hnvr.me", keywords: "digitale erlebnisse" }, (r) => r.verfuegbar === false && /DATAFORSEO/.test(r.fehlt) && /Search Console/.test(r.fehlt)],
    ["backlinks", { domain: "hnvr.me" }, (r) => r.verfuegbar === false]
  ];
  for (const [m, e, test] of faelle) {
    const t0 = Date.now();
    const a = await laufen(m, e);
    const r = a.ergebnis;
    pruefe(m + (e.umfang ? " (website)" : e.art ? " (" + e.art + ")" : "") + " · " + (r ? r.kurz : a.fehler) + " · " + ((Date.now() - t0) / 1000).toFixed(1) + " s", a.status === "fertig" && r && test(r), a.fehler || "");
    pruefe(m + " ohne Konto nicht auf dem Server gespeichert", a.pruefungId == null);
  }
  const ssrf = await laufen("audit", { url: "http://127.0.0.1:" + port + "/" });
  pruefe("Abruf ins interne Netz abgewiesen", ssrf.status === "fehler" && /intern/i.test(ssrf.fehler), ssrf.fehler);
  const ssrf2 = await laufen("uptime", { url: "http://localtest.me/" });
  pruefe("Domain mit interner Adresse abgewiesen", ssrf2.status === "fehler" && /intern/i.test(ssrf2.fehler), ssrf2.fehler);
  const kiWeg = await laufen("ki", { url: "https://gibt-es-wirklich-nicht-4711.de/" });
  pruefe("KI-Sichtbarkeit meldet nicht erreichbare Website statt „alle dürfen lesen“", kiWeg.status === "fehler" && /auflösen/.test(kiWeg.fehler), kiWeg.fehler || kiWeg.ergebnis?.kurz);
  const bild = await laufen("content", { url: "https://www.w3.org/Icons/w3c_home.png", keyword: "w3c" });
  pruefe("Content lehnt Datei statt Seite ab", bild.status === "fehler" && /keine HTML-Seite/.test(bild.fehler), bild.fehler || bild.ergebnis?.kurz);
  const zert = await laufen("ki", { url: "https://self-signed.badssl.com/" });
  pruefe("Zertifikatsfehler bei KI als Signal, kein Absturz", zert.status === "fertig" && zert.ergebnis.zugang.signale.find((s) => s.name === "Startseite ohne Fehler").erfuellt === false, zert.fehler);
  const leer = await laufen("mail", { art: "nachricht", roh: "kein Mailtext" });
  pruefe("Mail ohne Kopfzeilen sauber abgelehnt", leer.status === "fehler" && /Kopfzeilen|vollständige/.test(leer.fehler), leer.fehler);

  console.log("\nKonto");
  pruefe("ohne Konto 401 auf Kontodaten", (await anfrage("/api/pruefungen")).status === 401);
  const anm = await anfrage("/api/anmelden", { daten: { email: "test@beispiel-firma.de" } });
  pruefe("Anmeldelink angefordert und versandt", anm.status === 200 && anm.inhalt.versandt === true);
  await new Promise((r) => setTimeout(r, 300));
  const mail = mails[mails.length - 1] || "";
  const koerper = Buffer.from(mail.split("\n\n").slice(1).join("").replace(/\s+/g, ""), "base64").toString("utf8");
  const link = (/https?:\/\/\S+bestaetigen\?t=[\w-]+/.exec(koerper) || [])[0];
  pruefe("Mail mit Anmeldelink kam am SMTP-Server an", !!link, mail.slice(0, 120));
  const fremderLink = await anfrage("/anmelden/bestaetigen?t=falsch");
  pruefe("falscher Link wird abgewiesen", fremderLink.status === 302 && /fehler=/.test(fremderLink.kopf.get("location")));
  const best = await anfrage(new URL(link).pathname + new URL(link).search);
  keks = (best.kopf.get("set-cookie") || "").split(";")[0];
  pruefe("Link meldet an und setzt HttpOnly-Sitzung", best.status === 302 && keks.startsWith("waechter_sitzung=") && /HttpOnly/.test(best.kopf.get("set-cookie")));
  pruefe("Link nur einmal nutzbar", (await (async () => { const k = keks; keks = ""; const r = await anfrage(new URL(link).pathname + new URL(link).search); keks = k; return /fehler=/.test(r.kopf.get("location") || ""); })()));
  const ichAn = await anfrage("/api/ich");
  pruefe("Konto angelegt", ichAn.inhalt.konto && ichAn.inhalt.konto.email === "test@beispiel-firma.de" && ichAn.inhalt.grenzen.maxSeiten === 10000);
  pruefe("Dashboard erreichbar", (await anfrage("/app")).status === 200);
  const fremdHerkunft = await fetch(B + "/api/projekte", { method: "POST", headers: { cookie: keks, origin: "https://boese.example", "content-type": "application/json" }, body: JSON.stringify({ domain: "hnvr.me" }) });
  pruefe("Anfrage fremder Herkunft abgewiesen", fremdHerkunft.status === 403);
  const pr = await anfrage("/api/projekte", { daten: { domain: "hnvr.me" } });
  pruefe("Projekt angelegt", pr.status === 201 && pr.inhalt.domain === "hnvr.me");
  pruefe("PageSpeed mit Server-Schlüssel abgefragt", google.schluessel.includes("pruefschluessel"));

  console.log("\nGoogle Search Console");
  const zuGoogle = async (pfad, zustand) => { const a = await fetch(B + pfad, { redirect: "manual", headers: { cookie: keks + (zustand ? "; waechter_google=" + zustand : "") } }); return { status: a.status, ort: a.headers.get("location") || "", keks: a.headers.get("set-cookie") || "" }; };
  const v1 = await zuGoogle("/google/verbinden");
  const zustand1 = (/waechter_google=([\w-]+)/.exec(v1.keks) || [])[1];
  pruefe("Verbinden leitet zu Google mit Bereich webmasters.readonly", v1.status === 302 && v1.ort.startsWith(GB + "/o/oauth2/v2/auth") && v1.ort.includes("client_id=pruef-id") && decodeURIComponent(v1.ort).includes("webmasters.readonly") && decodeURIComponent(v1.ort).includes("/google/rueckruf"));
  pruefe("fremder Zustand wird abgewiesen", (await zuGoogle("/google/rueckruf?code=gut&state=falsch", zustand1)).ort.includes("google=abgebrochen"));
  const v2 = await zuGoogle("/google/verbinden");
  const zustand2 = (/waechter_google=([\w-]+)/.exec(v2.keks) || [])[1];
  pruefe("abgelehnter Code wird gemeldet", (await zuGoogle("/google/rueckruf?code=schlecht&state=" + zustand2, zustand2)).ort.includes("google=fehler"));
  const v3 = await zuGoogle("/google/verbinden");
  const zustand3 = (/waechter_google=([\w-]+)/.exec(v3.keks) || [])[1];
  pruefe("gültiger Code verbindet", (await zuGoogle("/google/rueckruf?code=gut&state=" + zustand3, zustand3)).ort.includes("google=verbunden"));
  const ichG = await anfrage("/api/ich");
  pruefe("bestätigte Property übernommen, unbestätigte nicht", JSON.stringify(ichG.inhalt.konto.google?.properties) === '["sc-domain:hnvr.me"]');
  const kontenRoh = fs.readFileSync(path.join(daten, "konten.json"), "utf8");
  pruefe("Google-Token nur verschlüsselt gespeichert", !kontenRoh.includes("zugang-1") && !kontenRoh.includes("erneuer-1") && kontenRoh.includes('"erneuerung"'));
  const rg = await laufen("rankings", { domain: "hnvr.me" });
  pruefe("Rankings aus der Search Console: " + (rg.ergebnis?.kurz || rg.fehler), rg.status === "fertig" && rg.ergebnis.quelle === "Google Search Console" && rg.ergebnis.kennzahlen.klicks === 15 && rg.ergebnis.kennzahlen.impressionen === 1240 && rg.ergebnis.zeilen.length === 2 && rg.ergebnis.verlauf.length === 2);
  const rk = await laufen("rankings", { domain: "hnvr.me", keywords: "digitale erlebnisse\nkommt nicht vor" });
  pruefe("gewählte Keywords mit und ohne Impressionen", rk.ergebnis?.zeilen?.[0]?.platz === 6.4 && rk.ergebnis?.zeilen?.[1]?.platz === null);
  const kg = JSON.parse(fs.readFileSync(path.join(daten, "konten.json"), "utf8"));
  for (const kk of Object.values(kg.konten)) if (kk.google) kk.google.bis = 0;
  fs.writeFileSync(path.join(daten, "konten.json"), JSON.stringify(kg));
  await laufen("rankings", { domain: "hnvr.me" });
  pruefe("abgelaufener Zugang wird erneuert", google.grants.includes("refresh_token") && google.bearer.includes("zugang-2"));
  const rf = await laufen("rankings", { domain: "w3.org" });
  pruefe("fremde Domain ohne Property: klarer Hinweis", rf.ergebnis?.verfuegbar === false && /keine Property/.test(rf.ergebnis.fehlt));
  await anfrage("/api/google/trennen", { daten: {} });
  pruefe("Google trennen", (await anfrage("/api/ich")).inhalt.konto.google === null);
  const rl = (await anfrage("/api/pruefungen?projekt=alle")).inhalt.filter((x) => x.modul === "rankings");
  pruefe("Rankings mit Konto gespeichert, Wiederholung schreibt Verlauf fort (2 Einträge für 4 Abrufe)", rl.length === 2, String(rl.length));
  for (const x of rl) await anfrage("/api/pruefungen/" + x.id, { methode: "DELETE" });

  console.log("\nKonto, weiter");
  const up = await laufen("uptime", { url: "https://www.hnvr.me/" });
  pruefe("Prüfung mit Konto automatisch gespeichert", up.status === "fertig" && !!up.pruefungId);
  const ue = await anfrage("/api/pruefungen/uebernehmen", { daten: { liste: [{ modul: "audit", eingabe: { url: "https://www.hnvr.me/" }, ergebnis: (await laufen("mail", { art: "domain", domain: "hnvr.me" })) && { modul: "audit", umfang: "seite", ziel: "https://www.hnvr.me/kontakt", punkte: 71, kurz: "71 von 100", befunde: [] }, zeit: new Date().toISOString() }, { modul: "mail", eingabe: { art: "nachricht" }, ergebnis: { modul: "mail", art: "nachricht", ziel: "Test", risiko: 90, kurz: "90 % Risiko" }, zeit: new Date().toISOString() }] } });
  pruefe("Übernahme aus dem Browser", ue.status === 201 && ue.inhalt.ids.length === 2);
  const liste = await anfrage("/api/pruefungen?projekt=alle");
  pruefe("Liste enthält 4 Prüfungen (2 übernommen, 2 eigene)", liste.inhalt.length === 4, String(liste.inhalt.length));
  pruefe("Herkunft „ohne Anmeldung“ vermerkt", liste.inhalt.filter((x) => x.herkunft === "ohne Anmeldung").length === 2);
  const mailP = liste.inhalt.find((x) => x.modul === "mail");
  pruefe("einzelne Mail lässt sich nicht überwachen", (await anfrage("/api/pruefungen/" + mailP.id, { methode: "PATCH", daten: { ueberwacht: { an: true } } })).status === 400);
  pruefe("gespeicherte Mail enthält keinen Rohtext", !JSON.stringify(await anfrage("/api/pruefungen/" + mailP.id).then((r) => r.inhalt)).includes("Return-Path"));
  const upP = liste.inhalt.find((x) => x.modul === "uptime");
  const an = await anfrage("/api/pruefungen/" + upP.id, { methode: "PATCH", daten: { ueberwacht: { an: true, takt: 1 } } });
  pruefe("Überwachung eingeschaltet (jede Minute)", an.status === 200 && an.inhalt.ueberwacht.an === true && an.inhalt.ueberwacht.takt === 1);
  await new Promise((r) => setTimeout(r, 5200));
  const runde = await anfrage("/api/ueberwachung/jetzt", { daten: {} });
  pruefe("Überwachung prüft fällige Prüfung erneut", runde.inhalt.geprueft >= 1, JSON.stringify(runde.inhalt));
  const voll = await anfrage("/api/pruefungen/" + upP.id);
  pruefe("Verlauf fortgeschrieben (2 Messungen)", voll.inhalt.verlauf.length === 2);
  /* Ausfall simulieren: Ziel auf nicht aufloesbare Domain umbiegen, zwei Runden */
  const ausfallDomain = "gibt-es-nicht-" + Date.now() + ".de";
  const st = JSON.parse(fs.readFileSync(path.join(daten, "konten.json"), "utf8"));
  const kid = Object.keys(st.konten)[0];
  const pf = path.join(daten, "pruefungen", kid + ".json");
  const pj = JSON.parse(fs.readFileSync(pf, "utf8"));
  const eintrag = pj.pruefungen.find((x) => x.id === upP.id);
  eintrag.eingabe.url = "https://" + ausfallDomain + "/"; eintrag.ueberwacht.naechste = 0;
  fs.writeFileSync(pf, JSON.stringify(pj));
  const vorher = mails.length;
  await anfrage("/api/ueberwachung/jetzt", { daten: {} });
  const pj2 = JSON.parse(fs.readFileSync(pf, "utf8")); pj2.pruefungen.find((x) => x.id === upP.id).ueberwacht.naechste = 0; fs.writeFileSync(pf, JSON.stringify(pj2));
  await anfrage("/api/ueberwachung/jetzt", { daten: {} });
  await new Promise((r) => setTimeout(r, 400));
  const hinweise = await anfrage("/api/hinweise");
  pruefe("Ausfall nach zwei Fehlversuchen als Hinweis gemeldet", hinweise.inhalt.some((x) => /Nicht erreichbar/.test(x.text)), JSON.stringify(hinweise.inhalt).slice(0, 200));
  const betreff = (/^Subject: =\?UTF-8\?B\?([^?]+)\?=/m.exec(mails[mails.length - 1] || "") || [])[1];
  const betreffText = betreff ? Buffer.from(betreff, "base64").toString("utf8") : "";
  pruefe("Alarm-Mail verschickt", mails.length > vorher && /Nicht erreichbar/.test(betreffText), betreffText || ("Mails vorher " + vorher + ", nachher " + mails.length));
  const csv = await anfrage("/api/pruefungen.csv");
  pruefe("CSV-Ausfuhr", csv.status === 200 && csv.inhalt.includes('"Werkzeug";"Ziel"') && csv.inhalt.split("\r\n").length === 5);
  const ex = await anfrage("/api/export.json");
  pruefe("Datenausfuhr JSON", ex.status === 200 && (typeof ex.inhalt === "string" ? JSON.parse(ex.inhalt) : ex.inhalt).pruefungen.length === 4);
  pruefe("Prüfung löschen", (await anfrage("/api/pruefungen/" + mailP.id, { methode: "DELETE" })).status === 200 && (await anfrage("/api/pruefungen?projekt=alle")).inhalt.length === 3);
  pruefe("viertes Projekt abgewiesen nach drei", await (async () => { await anfrage("/api/projekte", { daten: { domain: "w3.org" } }); await anfrage("/api/projekte", { daten: { domain: "wikipedia.org" } }); return (await anfrage("/api/projekte", { daten: { domain: "example.org" } })).status === 400; })());
  const dateienKonto = fs.readFileSync(path.join(daten, "konten.json"), "utf8");
  pruefe("Anmeldelink und Sitzung nur als Prüfsumme gespeichert", !dateienKonto.includes(keks.split("=")[1]) && !dateienKonto.includes(new URL(link).searchParams.get("t")));
  pruefe("Konto löschen", (await anfrage("/api/konto", { methode: "DELETE" })).status === 200 && !fs.existsSync(pf));
  pruefe("danach abgemeldet", (await anfrage("/api/ich")).inhalt.konto === null);
} catch (e) {
  fehl++; console.log("  FEHL  Abbruch: " + e.stack);
} finally {
  kind.kill(); smtp.close(); gServer.close();
  fs.rmSync(daten, { recursive: true, force: true });
  if (/\[Server\]|\[Auftrag\]/.test(protokoll)) console.log("\nServerprotokoll mit Fehlern:\n" + protokoll.split("\n").filter((z) => /Server|Auftrag|Error/.test(z)).slice(0, 20).join("\n"));
  console.log("\n" + (ok + fehl) + " Prüfungen, " + fehl + " gescheitert");
  process.exit(fehl ? 1 : 0);
}
