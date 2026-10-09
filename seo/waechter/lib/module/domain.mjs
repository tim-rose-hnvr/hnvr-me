/* Modul Domain-Check: 48 Regeln aus domainregeln.js, Registrierung per RDAP,
   Namensvorschlaege mit Verfuegbarkeit und Tippfehler-Domains. */

import { domainSammeln, DOMAINREGELN } from "../werk.mjs";
import { domainLesen, hostErlaubt, NutzerFehler } from "../schutz.mjs";
import { rdap, verfuegbar, whois } from "./rdap.mjs";

const TASTEN = ["qwertzuiopü", "asdfghjklöä", "yxcvbnm"];
function nachbarn(z) {
  for (let r = 0; r < TASTEN.length; r++) {
    const i = TASTEN[r].indexOf(z);
    if (i >= 0) return [TASTEN[r][i - 1], TASTEN[r][i + 1]].filter((x) => x && /[a-z]/.test(x));
  }
  return [];
}

export function tippfehlerListe(domain, max = 12) {
  const teile = domain.split(".");
  const tld = teile.pop();
  const name = teile.join(".");
  const aus = new Set();
  for (let i = 0; i < name.length; i++) {
    if (name[i] === "." || name[i] === "-") continue;
    aus.add(name.slice(0, i) + name.slice(i + 1));                         // ausgelassen
    aus.add(name.slice(0, i) + name[i] + name[i] + name.slice(i + 1));      // verdoppelt
    if (i < name.length - 1) aus.add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2)); // vertauscht
    for (const n of nachbarn(name[i])) aus.add(name.slice(0, i) + n + name.slice(i + 1)); // Nachbartaste
  }
  if (name.includes("-")) aus.add(name.replace(/-/g, ""));
  return [...aus].filter((x) => x && x !== name && /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(x) && !x.startsWith("-") && !x.endsWith("-"))
    .slice(0, 400).map((x) => x + "." + tld)
    .sort((a, b) => Math.abs(a.length - domain.length) - Math.abs(b.length - domain.length))
    .slice(0, max);
}

const ORTE = /^(hannover|berlin|hamburg|muenchen|koeln|frankfurt|stuttgart|duesseldorf|leipzig|bremen|dresden|nuernberg)$/;
export function namensVorschlaege(idee, endungen) {
  const woerter = String(idee || "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9 -]/g, " ").split(/\s+/).filter((w) => w.length > 1).slice(0, 5);
  if (!woerter.length) return [];
  const kern = woerter.filter((w) => !ORTE.test(w));
  const ort = woerter.find((w) => ORTE.test(w));
  const basen = new Set();
  const k = kern.length ? kern : woerter;
  basen.add(k.join(""));
  basen.add(k.join("-"));
  if (k.length >= 2) { basen.add(k.slice(0, 2).join("")); basen.add(k.slice(0, 2).join("-")); basen.add(k[1] + k[0]); }
  if (ort) { basen.add(k[0] + "-" + ort); basen.add(k.slice(0, 2).join("") + "-" + ort); }
  const aus = [];
  for (const b of basen) {
    if (b.length < 3 || b.length > 40) continue;
    for (const e of endungen) aus.push(b + "." + e);
  }
  return [...new Set(aus)].slice(0, 24);
}

function bewerten(d) {
  const name = d.split(".")[0];
  const m = [];
  if (name.length <= 12) m.push("kurz"); else if (name.length > 20) m.push("lang");
  const striche = (name.match(/-/g) || []).length;
  m.push(striche ? striche + " Bindestrich" + (striche > 1 ? "e" : "") : "ohne Bindestrich");
  if (/\d/.test(name)) m.push("mit Ziffern");
  return m;
}

export async function pruefen(eingabe) {
  const domain = domainLesen(eingabe.domain);
  const aus = { modul: "domain", ziel: domain };

  let erreichbar = true;
  try { await hostErlaubt(domain); } catch (e) {
    if (e.status === 400 && /auflösen/.test(e.message)) erreichbar = false; else throw e;
  }

  const [reg, typo] = await Promise.all([
    rdap(domain),
    Promise.all(tippfehlerListe(domain, Number(eingabe.tippfehler) || 10).map(verfuegbar))
  ]);
  aus.registrierung = reg.ok ? reg : await whois(domain).then((w) => (w.ok ? w : reg));
  aus.tippfehler = typo;

  if (eingabe.idee) {
    const endungen = (eingabe.endungen && eingabe.endungen.length ? eingabe.endungen : ["de", "com", "shop"])
      .map((e) => String(e).replace(/^\./, "").toLowerCase()).filter((e) => /^[a-z]{2,12}$/.test(e)).slice(0, 6);
    const liste = namensVorschlaege(eingabe.idee, endungen);
    const geprueft = [];
    for (let i = 0; i < liste.length; i += 6) {
      geprueft.push(...await Promise.all(liste.slice(i, i + 6).map(verfuegbar)));
    }
    aus.vorschlaege = geprueft.map((v) => ({ ...v, laenge: v.domain.split(".")[0].length, merkmale: bewerten(v.domain) }))
      .sort((a, b) => (b.frei === true) - (a.frei === true) || a.laenge - b.laenge);
  }

  if (!erreichbar) {
    aus.punkte = null;
    aus.kurz = reg.ok && !reg.registriert ? "nicht registriert" : "nicht erreichbar";
    aus.befunde = [];
    return aus;
  }

  const befund = await domainSammeln(domain, { ohneRdap: true });
  const urteil = DOMAINREGELN.pruefen(befund);
  aus.host = befund.host;
  aus.startseite = befund.startseite;
  aus.punkte = urteil.punkte;
  aus.zahl = urteil.zahl;
  aus.gruppen = Object.entries(urteil.gruppen).map(([name, g]) => ({ name, wert: g.wert, befunde: g.befunde, geprueft: g.geprueft }));
  aus.befunde = urteil.befunde.map((b) => ({ id: b.id, gruppe: b.gruppe, name: b.name, stufe: b.stufe, gewicht: b.gewicht, wie: b.wozu, beheben: b.beheben, fund: b.fund }));
  aus.regeln = { gesamt: urteil.befunde.length + 0, uebersprungen: urteil.uebersprungen.length };
  aus.gemessen = { tls: befund.tls, dns: befund.dns, varianten: befund.varianten, ttfb: befund.ttfb };
  aus.fristen = {
    zertifikatBis: befund.tls?.gueltigBis ? new Date(befund.tls.gueltigBis).toISOString() : null,
    zertifikatTage: befund.tls?.tageRest ?? null,
    domainBis: aus.registrierung.laeuftBis || null,
    domainTage: aus.registrierung.laeuftBis ? Math.floor((new Date(aus.registrierung.laeuftBis) - Date.now()) / 86400e3) : null
  };
  const z = urteil.zahl;
  aus.kurz = urteil.punkte + " von 100 · " + z.kritisch + " kritisch, " + z.wichtig + " wichtig, " + z.hinweis + " Hinweise";
  return aus;
}

export function geaendert(alt, neu) { return alt?.punkte !== neu?.punkte; }
export { NutzerFehler };
