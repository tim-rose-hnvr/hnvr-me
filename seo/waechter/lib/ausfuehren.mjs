/* SEO Waechter · Pruefungen ausfuehren: Auftraege mit Fortschritt,
   Grenzen ohne und mit Konto, hoechstens zwei grosse Laeufe gleichzeitig. */

import crypto from "node:crypto";
import * as audit from "./module/audit.mjs";
import * as domain from "./module/domain.mjs";
import * as uptime from "./module/uptime.mjs";
import * as mail from "./module/mail.mjs";
import * as content from "./module/content.mjs";
import * as ki from "./module/ki.mjs";
import * as konkurrenz from "./module/konkurrenz.mjs";
import { rankings, backlinks } from "./module/rankings.mjs";
import * as gesamt from "./module/gesamt.mjs";
import { NutzerFehler } from "./schutz.mjs";
import { zugang as googleZugang } from "./googlekonto.mjs";

export const MODULE = {
  audit: audit.pruefen, domain: domain.pruefen, uptime: uptime.pruefen, mail: mail.pruefen,
  content: content.pruefen, ki: ki.pruefen, konkurrenz: konkurrenz.pruefen, rankings, backlinks,
  gesamt: gesamt.pruefen
};

/* Grenzen (vorlaeufig). */
export function grenzen(konto) {
  return konto
    ? { maxSeiten: 10000, maxKeywords: 100, maxMitbewerber: 3 }
    : { maxSeiten: 500, maxKeywords: 5, maxMitbewerber: 1 };
}

let laufend = 0;
const warte = [];
async function platz() {
  if (laufend < 2) { laufend++; return; }
  await new Promise((ok) => warte.push(ok));
  laufend++;
}
function frei() { laufend--; const n = warte.shift(); if (n) n(); }

export async function ausfuehren(modul, eingabe, { konto = null, melden = () => {} } = {}) {
  const fn = MODULE[modul];
  if (!fn) throw new NutzerFehler("Unbekanntes Werkzeug.", 404);
  const ctx = { ...grenzen(konto), konto, melden, eigeneDomains: konto ? konto.projekte.map((p) => p.domain) : [],
    google: konto && konto.google ? { properties: konto.google.properties || [], zugang: () => googleZugang(konto) } : null };
  const gross = modul === "audit" && eingabe.umfang === "website" || modul === "konkurrenz" || modul === "gesamt";
  if (gross) await platz();
  try {
    const r = await fn(eingabe || {}, ctx);
    r.zeit = new Date().toISOString();
    return r;
  } finally { if (gross) frei(); }
}

const AUFTRAEGE = new Map();
export function auftragStarten(modul, eingabe, opt, fertig) {
  const id = crypto.randomBytes(18).toString("base64url");
  const a = { id, modul, status: "laeuft", start: Date.now(), meldungen: [], ergebnis: null, fehler: null, pruefungId: null };
  AUFTRAEGE.set(id, a);
  ausfuehren(modul, eingabe, { ...opt, melden: (t) => { a.meldungen.push(t); if (a.meldungen.length > 30) a.meldungen.shift(); } })
    .then(async (r) => { a.ergebnis = r; if (fertig) { try { a.pruefungId = await fertig(r); } catch (e) { a.speicherFehler = e.message; } } a.status = "fertig"; })
    .catch((e) => { a.status = "fehler"; a.fehler = e instanceof NutzerFehler ? e.message : "Die Prüfung ist fehlgeschlagen: " + e.message; a.code = e.status || 500; if (!(e instanceof NutzerFehler)) console.error("[Auftrag]", modul, e); });
  for (const [k, v] of AUFTRAEGE) if (Date.now() - v.start > 3600e3) AUFTRAEGE.delete(k);
  return a;
}
export function auftrag(id) { return AUFTRAEGE.get(id) || null; }
