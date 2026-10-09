/* Gesamtcheck: Audit (mit Ladezeit), Domain, Erreichbarkeit, Mail-Schutz und
   KI-Sichtbarkeit fuer eine Adresse, gleichzeitig. Ergebnis: Teilergebnisse
   plus eine gemeinsame Liste, was zuerst zu tun ist. */

import { adresseLesen, NutzerFehler } from "../schutz.mjs";
import * as audit from "./audit.mjs";
import * as domain from "./domain.mjs";
import * as uptime from "./uptime.mjs";
import * as mail from "./mail.mjs";
import * as ki from "./ki.mjs";
import { orgDomain } from "./mail.mjs";

const RANG = { kritisch: 0, wichtig: 1, hinweis: 2 };
const NAMEN = { audit: "Website-Audit", domain: "Domain-Check", uptime: "Uptime", mail: "Mail-Schutz", ki: "KI-Sichtbarkeit" };
const GEWICHT = { audit: 3, domain: 2, mail: 1, ki: 1.5 };

export async function pruefen(eingabe, ctx) {
  const url = adresseLesen(eingabe.url);
  const host = new URL(url).hostname.replace(/^www\./, "");
  const meld = (t) => ctx.melden && ctx.melden(t);
  const auftraege = {
    audit: () => audit.seite(url, eingabe.tempo !== false),
    domain: () => domain.pruefen({ domain: host }),
    uptime: () => uptime.pruefen({ url }),
    mail: () => mail.pruefen({ art: "domain", domain: orgDomain(host) }),
    ki: () => ki.pruefen({ url })
  };
  const teile = {}, fehler = {};
  await Promise.all(Object.entries(auftraege).map(async ([k, f]) => {
    try { teile[k] = await f(); meld(NAMEN[k] + " fertig: " + (teile[k].kurz || "")); }
    catch (e) { fehler[k] = e.message; meld(NAMEN[k] + ": " + e.message); }
  }));
  if (!teile.audit && !teile.uptime) throw new NutzerFehler(fehler.audit || fehler.uptime || "Die Website ist nicht erreichbar.");
  if (!teile.audit && /keine HTML-Seite/.test(fehler.audit || "")) throw new NutzerFehler(fehler.audit + " Der Gesamtcheck braucht die Adresse einer Seite.");
  const massnahmen = [];
  for (const [k, r] of Object.entries(teile)) {
    for (const b of r.befunde || []) massnahmen.push({ ...b, modul: k, modulName: NAMEN[k], gewicht: (b.gewicht || (b.stufe === "kritisch" ? 10 : b.stufe === "wichtig" ? 5 : 1)) });
  }
  massnahmen.sort((a, b) => RANG[a.stufe] - RANG[b.stufe] || b.gewicht * (b.seiten || 1) - a.gewicht * (a.seiten || 1));
  const werte = Object.entries(GEWICHT).filter(([k]) => typeof teile[k]?.punkte === "number");
  let punkte = werte.length ? Math.round(werte.reduce((a, [k, g]) => a + teile[k].punkte * g, 0) / werte.reduce((a, [, g]) => a + g, 0)) : null;
  if (teile.uptime && !teile.uptime.erreichbar && punkte != null) punkte = Math.min(punkte, 40);
  const z = (st) => massnahmen.filter((m) => m.stufe === st).length;
  return {
    modul: "gesamt", ziel: url, punkte,
    bereiche: Object.keys(NAMEN).map((k) => ({ modul: k, name: NAMEN[k], punkte: teile[k]?.punkte ?? null, kurz: teile[k]?.kurz || null, fehler: fehler[k] || null })),
    teile, massnahmen: massnahmen.slice(0, 40),
    befunde: massnahmen.slice(0, 40),
    kurz: (punkte ?? "–") + " von 100 · " + z("kritisch") + " kritisch, " + z("wichtig") + " wichtig, " + z("hinweis") + " Hinweise über 5 Bereiche"
  };
}
