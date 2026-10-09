/* Modul Konkurrenz: dieselben Messungen fuer die eigene Website und die
   Mitbewerber, nebeneinander. Alles hier ist selbst gemessen; Sichtbarkeit
   und Keywords kommen nur mit Suchdaten-Anbindung dazu. */

import { domainLesen, NutzerFehler } from "../schutz.mjs";
import { seite } from "./audit.mjs";
import { messen } from "./uptime.mjs";
import { zugang } from "./ki.mjs";
import { KENNUNG } from "../werk.mjs";

async function sitemapZahl(basis) {
  try {
    const a = await fetch(basis + "/sitemap.xml", { headers: { "user-agent": KENNUNG } });
    if (!a.ok) return null;
    const t = await a.text();
    return (t.match(/<loc>/gi) || []).length;
  } catch (e) { return null; }
}

async function vermessen(domain) {
  const url = "https://" + domain + "/";
  const [s, u, k] = await Promise.allSettled([seite(url, false), messen(url), zugang(url)]);
  const a = s.status === "fulfilled" ? s.value : null;
  const m = u.status === "fulfilled" ? u.value : null;
  const z = k.status === "fulfilled" ? k.value : null;
  const basis = a ? new URL(a.ziel).origin : "https://" + domain;
  return {
    domain,
    fehler: !a ? (s.reason?.message || "nicht lesbar") : null,
    werte: {
      punkte: a?.punkte ?? null,
      kritisch: a?.kritisch ?? null,
      antwort: m?.zeiten ? m.zeiten.antwort : null,
      gesamt: m?.gesamt ?? null,
      groesse: m?.bytes ? Math.round(m.bytes / 1024) : null,
      gewicht: a?.ladezeit?.gesamtKB ?? null,
      anfragen: a?.ladezeit?.anfragen ?? null,
      kiPunkte: z ? z.punkte : null,
      woerter: a?.profil?.woerter ?? a?.profil?.text?.woerter ?? null,
      sitemap: await sitemapZahl(basis),
      ki: z ? z.crawler.filter((c) => c.erlaubt).length : null,
      kiVon: z ? z.crawler.length : null,
      daten: z ? z.strukturierteDaten.length : null,
      http2: m?.protokoll === "HTTP/2"
    }
  };
}

export async function pruefen(eingabe, ctx) {
  const eigen = domainLesen(eingabe.eigene);
  const mit = [].concat(eingabe.mitbewerber || []).map((x) => String(x).trim()).filter(Boolean).map(domainLesen);
  if (!mit.length) throw new NutzerFehler("Bitte mindestens einen Mitbewerber angeben.");
  const max = ctx.maxMitbewerber || 1;
  if (mit.length > max) throw new NutzerFehler("Ohne Konto ist " + max + " Mitbewerber möglich" + (ctx.konto ? "" : ", mit Konto 3") + ".");
  const alle = await Promise.all([eigen, ...mit].map(vermessen));
  const REIHEN = [
    ["punkte", "Punktzahl der Startseite", "hoch"], ["kritisch", "Kritische Befunde", "niedrig"],
    ["antwort", "Erste Antwort des Servers (ms)", "niedrig"], ["gesamt", "Abruf gesamt (ms)", "niedrig"],
    ["groesse", "HTML der Startseite (KB)", "niedrig"], ["gewicht", "Startseite mit allen Dateien (KB)", "niedrig"], ["anfragen", "Anfragen beim Laden", "niedrig"],
    ["sitemap", "Adressen in der Sitemap", "hoch"], ["ki", "KI-Crawler, die lesen dürfen", "hoch"], ["kiPunkte", "Zitierfähigkeit für KI (von 100)", "hoch"], ["daten", "Arten strukturierter Daten", "hoch"]
  ];
  const reihen = REIHEN.map(([k, name, besser]) => {
    const werte = alle.map((a) => a.werte[k]);
    const gueltig = werte.filter((v) => typeof v === "number");
    const best = gueltig.length ? (besser === "hoch" ? Math.max(...gueltig) : Math.min(...gueltig)) : null;
    return { schluessel: k, name, werte, beste: best };
  });
  const siege = alle.map((_, i) => reihen.filter((r) => r.beste != null && r.werte[i] === r.beste).length);
  return {
    modul: "konkurrenz", ziel: eigen, domains: alle.map((a) => a.domain), fehler: alle.map((a) => a.fehler),
    reihen, siege, punkte: null,
    kurz: "vorn in " + siege[0] + " von " + reihen.length + " Werten gegen " + mit.join(", ")
  };
}
