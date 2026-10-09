/* Modul Mail-Pruefer.
   1. Nachricht pruefen: Kopfzeilen und Inhalt einer eingefuegten Mail werden
      zerlegt (MIME), Absender und Links geprueft, SPF selbst ausgewertet,
      Sperrlisten fuer die einliefernde IP abgefragt. Die Nachricht wird nur
      fuer die Pruefung verarbeitet und nicht gespeichert.
   2. Eigene Domain: SPF, DKIM, DMARC, MX, MTA-STS, TLS-RPT, BIMI, PTR, Sperrlisten. */

import dns from "node:dns/promises";
import net from "node:net";
import { domainLesen, NutzerFehler, privat } from "../schutz.mjs";

/* ---------- MIME ---------- */

function trennen(roh) {
  const i = roh.search(/\n\n/);
  return i < 0 ? { kopf: roh, rumpf: "" } : { kopf: roh.slice(0, i), rumpf: roh.slice(i + 2) };
}
function kopfLesen(kopf) {
  const aus = [];
  for (const z of kopf.split("\n")) {
    if (/^[ \t]/.test(z) && aus.length) aus[aus.length - 1].wert += " " + z.trim();
    else { const i = z.indexOf(":"); if (i > 0) aus.push({ name: z.slice(0, i).trim().toLowerCase(), wert: z.slice(i + 1).trim() }); }
  }
  return aus;
}
const eins = (k, n) => k.find((e) => e.name === n)?.wert || "";
const alle = (k, n) => k.filter((e) => e.name === n).map((e) => e.wert);
function dekodieren(buf, cs) {
  try { return new TextDecoder((cs || "utf-8").toLowerCase().replace(/^"|"$/g, "")).decode(buf); }
  catch (e) { return buf.toString("utf8"); }
}
function rfc2047(s) {
  return String(s || "").replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (m, cs, art, t) => {
    try {
      const buf = art.toUpperCase() === "B" ? Buffer.from(t, "base64")
        : Buffer.from(t.replace(/_/g, " ").replace(/=([0-9a-f]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
      return dekodieren(buf, cs);
    } catch (e) { return m; }
  }).replace(/\?=\s+=\?/g, "?==?");
}
function param(wert, n) {
  const m = new RegExp("(?:^|;)\\s*" + n + "\\*?=\\s*\"?([^\";]+)\"?", "i").exec(wert || "");
  return m ? m[1].trim() : null;
}
function zipNamen(buf) {
  const namen = [];
  for (let i = 0; i < buf.length - 46 && namen.length < 50; i++) {
    if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x01 && buf[i + 3] === 0x02) {
      const l = buf.readUInt16LE(i + 28);
      namen.push(buf.slice(i + 46, i + 46 + l).toString("utf8"));
      i += 45 + l;
    }
  }
  return namen;
}
function teilLesen(roh, tiefe, aus) {
  const { kopf, rumpf } = trennen(roh);
  const k = kopfLesen(kopf);
  const ct = eins(k, "content-type") || "text/plain";
  const cte = eins(k, "content-transfer-encoding").toLowerCase();
  const cd = eins(k, "content-disposition");
  if (/^multipart\//i.test(ct) && tiefe < 6) {
    const b = param(ct, "boundary");
    if (b) {
      for (const st of rumpf.split("--" + b).slice(1)) {
        if (st.startsWith("--")) break;
        teilLesen(st.replace(/^\n/, ""), tiefe + 1, aus);
      }
      return;
    }
  }
  let buf;
  if (cte === "base64") buf = Buffer.from(rumpf.replace(/\s+/g, ""), "base64");
  else if (cte === "quoted-printable") buf = Buffer.from(rumpf.replace(/=\n/g, "").replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
  else buf = Buffer.from(rumpf, "utf8");
  const name = rfc2047(param(cd, "filename") || param(ct, "name") || "");
  if (name || /attachment/i.test(cd)) {
    aus.anhaenge.push({ name: name || "(ohne Namen)", typ: ct.split(";")[0].trim(), groesse: buf.length, enthaelt: /zip/i.test(ct) || /\.zip$/i.test(name) ? zipNamen(buf) : [] });
    return;
  }
  const text = dekodieren(buf, param(ct, "charset"));
  if (/text\/html/i.test(ct)) aus.html.push(text); else if (/text\/plain/i.test(ct) || tiefe === 0) aus.text.push(text);
}

export function nachrichtZerlegen(roh) {
  roh = String(roh || "").replace(/\r\n/g, "\n");
  if (roh.length > 3e6) throw new NutzerFehler("Die Nachricht ist größer als 3 MB.");
  const { kopf } = trennen(roh);
  const k = kopfLesen(kopf);
  if (!k.length || !eins(k, "from")) throw new NutzerFehler("Keine Kopfzeilen gefunden. Bitte im Mailprogramm „Original anzeigen“ wählen und alles einfügen.");
  const aus = { kopf: k, text: [], html: [], anhaenge: [] };
  teilLesen(roh, 0, aus);
  return aus;
}

/* ---------- Hilfen ---------- */

function adresseAus(wert) {
  wert = rfc2047(wert);
  const m = /<([^>]+)>/.exec(wert);
  const adr = (m ? m[1] : wert).trim().toLowerCase();
  const name = m ? wert.slice(0, m.index).replace(/"/g, "").trim() : "";
  const domain = adr.includes("@") ? adr.split("@").pop().replace(/[>\s]/g, "") : "";
  return { adr, name, domain };
}
const ZWEISTUFIG = /\.(co|com|org|net|gv|ac)\.(uk|au|at|nz|za|jp|br|tr)$/;
export function orgDomain(d) {
  const t = String(d || "").toLowerCase().split(".");
  return ZWEISTUFIG.test(d) ? t.slice(-3).join(".") : t.slice(-2).join(".");
}
function abstand(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const nameTeil = (d) => orgDomain(d).split(".")[0];
async function txt(name) {
  try { return (await dns.resolveTxt(name)).map((t) => t.join("")); } catch (e) { return []; }
}

/* ---------- SPF ---------- */

function ip4Zahl(ip) { return ip.split(".").reduce((a, x) => a * 256 + Number(x), 0); }
function ip6Zahl(ip) {
  if (ip.includes(".")) { const i = ip.lastIndexOf(":"); const v4 = ip4Zahl(ip.slice(i + 1)); ip = ip.slice(0, i + 1) + (v4 >>> 16).toString(16) + ":" + (v4 & 65535).toString(16); }
  const [l, r] = ip.split("::");
  const a = l ? l.split(":") : [], b = r !== undefined ? (r ? r.split(":") : []) : [];
  const teile = r !== undefined ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
  return teile.reduce((s, x) => (s << 16n) + BigInt(parseInt(x || "0", 16)), 0n);
}
function imNetz(ip, netz, laenge) {
  if (net.isIPv4(ip) && net.isIPv4(netz)) {
    const l = laenge == null ? 32 : Number(laenge);
    if (l === 0) return true;
    const maske = l === 32 ? 0xffffffff : (~((1 << (32 - l)) - 1)) >>> 0;
    return ((ip4Zahl(ip) & maske) >>> 0) === ((ip4Zahl(netz) & maske) >>> 0);
  }
  if (net.isIPv6(ip) && net.isIPv6(netz)) {
    const l = BigInt(laenge == null ? 128 : Number(laenge));
    if (l === 0n) return true;
    const maske = ((1n << 128n) - 1n) ^ ((1n << (128n - l)) - 1n);
    return (ip6Zahl(ip) & maske) === (ip6Zahl(netz) & maske);
  }
  return false;
}

export async function spfAuswerten(ip, domain, z = { lookups: 0 }, tiefe = 0) {
  if (tiefe > 10) return { ergebnis: "permerror", grund: "zu tief verschachtelt" };
  const recs = (await txt(domain)).filter((t) => /^v=spf1(\s|$)/i.test(t));
  if (!recs.length) return { ergebnis: "none", grund: "kein SPF-Eintrag bei " + domain };
  if (recs.length > 1) return { ergebnis: "permerror", grund: "mehrere SPF-Einträge bei " + domain };
  const terme = recs[0].split(/\s+/).slice(1);
  let redirect = null;
  for (const term of terme) {
    if (/^redirect=/i.test(term)) { redirect = term.slice(9); continue; }
    if (/^[a-z]+=/i.test(term)) continue;
    const q = "+-~?".includes(term[0]) ? term[0] : "+";
    const m = q === term[0] ? term.slice(1) : term;
    const [mech, rest] = m.split(/:(.*)/s);
    const [ziel, cidr] = (rest || "").split("/");
    const art = mech.toLowerCase().split("/")[0];
    const len = m.includes("/") ? m.split("/")[1] : null;
    let trifft = false;
    if (art === "all") trifft = true;
    else if (art === "ip4" || art === "ip6") trifft = imNetz(ip, ziel, cidr);
    else if (art === "a" || art === "mx") {
      if (++z.lookups > 10) return { ergebnis: "permerror", grund: "mehr als 10 DNS-Abfragen" };
      const d = ziel || domain;
      let ips = [];
      try {
        if (art === "a") ips = [...await dns.resolve4(d).catch(() => []), ...await dns.resolve6(d).catch(() => [])];
        else for (const mx of (await dns.resolveMx(d)).slice(0, 10)) ips.push(...await dns.resolve4(mx.exchange).catch(() => []), ...await dns.resolve6(mx.exchange).catch(() => []));
      } catch (e) { ips = []; }
      trifft = ips.some((x) => imNetz(ip, x, net.isIPv4(x) ? (cidr ? cidr : len) : cidr));
    } else if (art === "include") {
      if (++z.lookups > 10) return { ergebnis: "permerror", grund: "mehr als 10 DNS-Abfragen" };
      const r = await spfAuswerten(ip, ziel, z, tiefe + 1);
      if (r.ergebnis === "permerror" || r.ergebnis === "temperror") return r;
      trifft = r.ergebnis === "pass";
    } else if (art === "exists" || art === "ptr") { if (++z.lookups > 10) return { ergebnis: "permerror", grund: "mehr als 10 DNS-Abfragen" }; continue; }
    if (trifft) return { ergebnis: { "+": "pass", "-": "fail", "~": "softfail", "?": "neutral" }[q], grund: term + " bei " + domain, lookups: z.lookups };
  }
  if (redirect) {
    if (++z.lookups > 10) return { ergebnis: "permerror", grund: "mehr als 10 DNS-Abfragen" };
    return spfAuswerten(ip, redirect, z, tiefe + 1);
  }
  return { ergebnis: "neutral", grund: "kein Mechanismus trifft", lookups: z.lookups };
}

/* ---------- Sperrlisten ---------- */

const LISTEN = ["zen.spamhaus.org", "bl.spamcop.net", "psbl.surriel.com"];
export async function sperrlisten(ip) {
  if (!net.isIPv4(ip)) return LISTEN.map((l) => ({ liste: l, gelistet: null, grund: "nur IPv4" }));
  const rev = ip.split(".").reverse().join(".");
  return Promise.all(LISTEN.map(async (l) => {
    try {
      const a = await dns.resolve4(rev + "." + l);
      if (a.some((x) => x.startsWith("127.255.255."))) return { liste: l, gelistet: null, grund: "Liste verweigert die Abfrage über diesen Resolver" };
      return { liste: l, gelistet: true, antwort: a.join(", ") };
    } catch (e) {
      return e.code === "ENOTFOUND" || e.code === "ENODATA" ? { liste: l, gelistet: false } : { liste: l, gelistet: null, grund: e.code };
    }
  }));
}

/* ---------- Nachricht ---------- */

const MARKEN = ["paypal", "dhl", "amazon", "sparkasse", "volksbank", "commerzbank", "deutsche bank", "postbank", "ing", "dkb", "microsoft", "outlook", "apple", "icloud", "telekom", "vodafone", "netflix", "ebay", "hermes", "dpd", "ups", "fedex", "elster", "finanzamt", "polizei"];
const AUSFUEHRBAR = /\.(exe|scr|com|bat|cmd|js|jse|vbs|vbe|wsf|msi|jar|lnk|hta|ps1|iso|img|docm|xlsm|pptm|apk)$/i;
const ARCHIV = /\.(zip|rar|7z|gz|tar|ace|cab)$/i;
const KUERZER = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at)$/i;
const DRUCK = /\b(sofort|umgehend|unverzüglich|innerhalb von \d+ (stunden|tagen)|letzte mahnung|gesperrt|sperrung|konto wird|account (will be )?suspended|verify your account|bestätigen sie ihr|passwort (läuft|ist) ab|zahlung überfällig|inkasso)\b/gi;
const ANREDE = /\b(sehr geehrte[r]? (kunde|kundin|nutzer|benutzer)|liebe[r]? (kunde|kundin)|dear (customer|user|client))\b/i;
const WERBUNG = /\b(gewinn(er)?|gratis|kostenlos testen|viagra|bitcoin|krypto|kredit ohne schufa|100 ?% sicher|nur heute)\b/gi;

function textAusHtml(h) { return h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " "); }
function linksSammeln(teile) {
  const aus = [];
  for (const h of teile.html) {
    const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m; while ((m = re.exec(h)) && aus.length < 200) aus.push({ ziel: m[1].trim(), text: textAusHtml(m[2]).trim() });
  }
  for (const t of teile.text) {
    const re = /https?:\/\/[^\s<>"')]+/gi;
    let m; while ((m = re.exec(t)) && aus.length < 200) aus.push({ ziel: m[0], text: m[0] });
  }
  return aus;
}
function hostVon(u) { try { return new URL(u).hostname.toLowerCase(); } catch (e) { return null; } }

export async function nachrichtPruefen(roh, eigene = []) {
  const teile = nachrichtZerlegen(roh);
  const k = teile.kopf;
  const von = adresseAus(eins(k, "from"));
  const an = adresseAus(eins(k, "to"));
  const antwortAn = adresseAus(eins(k, "reply-to"));
  const rueck = adresseAus(eins(k, "return-path"));
  const betreff = rfc2047(eins(k, "subject"));
  const signale = [];
  const s = (gewicht, text, art) => signale.push({ gewicht, text, art });

  const eigenListe = [...new Set([...eigene.map((d) => orgDomain(d)), an.domain ? orgDomain(an.domain) : null].filter(Boolean))];

  // Anhaenge
  for (const a of teile.anhaenge) {
    const doppelt = /\.(pdf|docx?|xlsx?|jpg|png|txt)\.[a-z0-9]{2,4}$/i.test(a.name);
    if (AUSFUEHRBAR.test(a.name)) s(30, "Anhang „" + a.name + "“ ist ausführbar", "anhang");
    else if (a.enthaelt.some((n) => AUSFUEHRBAR.test(n))) s(30, "Anhang „" + a.name + "“ enthält " + a.enthaelt.filter((n) => AUSFUEHRBAR.test(n)).join(", "), "anhang");
    else if (ARCHIV.test(a.name)) s(8, "Archiv als Anhang: " + a.name, "anhang");
    if (doppelt) s(10, "Doppelte Dateiendung: " + a.name, "anhang");
  }

  // Absender
  const vonOrg = orgDomain(von.domain);
  for (const e of eigenListe) {
    if (vonOrg === e) continue;
    const a = nameTeil(von.domain), b = e.split(".")[0];
    if ((b.length >= 4 && a.includes(b)) || (b.length >= 5 && abstand(a, b) <= 2)) {
      s(22, "Absender-Domain " + von.domain + " ähnelt " + e, "absender"); break;
    }
  }
  const nameKlein = (von.name || "").toLowerCase();
  const marke = MARKEN.find((m) => new RegExp("\\b" + m + "\\b").test(nameKlein));
  if (marke && !von.domain.includes(marke.replace(/\s/g, ""))) s(15, "Anzeigename nennt „" + marke + "“, die Adresse gehört zu " + von.domain, "absender");
  const dnInName = /[a-z0-9-]+\.[a-z]{2,}/i.exec(von.name || "");
  if (dnInName && orgDomain(dnInName[0].toLowerCase()) !== vonOrg) s(10, "Anzeigename zeigt " + dnInName[0] + ", gesendet von " + von.domain, "absender");
  if (antwortAn.domain && orgDomain(antwortAn.domain) !== vonOrg) s(8, "Antworten gehen an eine andere Domain: " + antwortAn.domain, "absender");
  if (rueck.domain && orgDomain(rueck.domain) !== vonOrg) s(4, "Rücklaufadresse liegt bei " + rueck.domain, "absender");
  if (!eins(k, "message-id")) s(3, "Keine Message-ID", "kopf");
  if (!eins(k, "date")) s(3, "Kein Datum", "kopf");

  // Echtheit
  const ar = alle(k, "authentication-results").join(" ; ").toLowerCase();
  const echt = { quelle: ar ? "Kopfzeile Authentication-Results des Empfängers" : "eigene Prüfung", spf: null, dkim: null, dmarc: null };
  const aus = (n) => { const m = new RegExp("\\b" + n + "=([a-z]+)").exec(ar); return m ? m[1] : null; };
  echt.spf = aus("spf"); echt.dkim = aus("dkim"); echt.dmarc = aus("dmarc");

  let ip = null;
  for (const r of alle(k, "received")) {
    const m = /\[(?:ipv6:)?([0-9a-f:.]+)\]/i.exec(r) || /\(([0-9]{1,3}(?:\.[0-9]{1,3}){3})\)/.exec(r);
    if (m && net.isIP(m[1]) && !privat(m[1])) { ip = m[1]; break; }
  }
  const spfDomain = rueck.domain || von.domain;
  if (!echt.spf && ip && spfDomain) { const r = await spfAuswerten(ip, spfDomain); echt.spf = r.ergebnis; echt.spfGrund = r.grund; }
  const dkimSig = eins(k, "dkim-signature");
  const dkimD = /\bd=([^;\s]+)/i.exec(dkimSig)?.[1]?.toLowerCase() || null;
  const dkimS = /\bs=([^;\s]+)/i.exec(dkimSig)?.[1] || null;
  if (!echt.dkim) {
    if (!dkimSig) echt.dkim = "none";
    else {
      const key = (await txt(dkimS + "._domainkey." + dkimD)).join("");
      echt.dkim = /p=[A-Za-z0-9+/]/.test(key) ? "signiert (Schlüssel gefunden, nicht kryptografisch geprüft)" : "Schlüssel fehlt";
    }
  }
  const dm = (await txt("_dmarc." + vonOrg)).find((t) => /^v=DMARC1/i.test(t)) || null;
  echt.dmarcEintrag = dm;
  if (!echt.dmarc) {
    const spfAligned = echt.spf === "pass" && orgDomain(spfDomain) === vonOrg;
    const dkimAligned = dkimD && orgDomain(dkimD) === vonOrg && /signiert/.test(echt.dkim);
    echt.dmarc = !dm ? "none" : (spfAligned || dkimAligned ? "pass" : "fail");
  }
  if (echt.spf === "fail") s(10, "SPF fehlgeschlagen", "echtheit"); else if (echt.spf === "softfail") s(5, "SPF nur weich bestanden (softfail)", "echtheit");
  if (echt.dkim === "fail") s(10, "DKIM-Signatur ungültig", "echtheit"); else if (echt.dkim === "none") s(6, "Keine DKIM-Signatur", "echtheit");
  if (echt.dmarc === "fail") s(12, "DMARC fehlgeschlagen", "echtheit");
  echt.ip = ip;
  echt.sperrlisten = ip ? await sperrlisten(ip) : [];
  const gelistet = echt.sperrlisten.filter((x) => x.gelistet);
  if (gelistet.length) s(15, "Einliefernde IP " + ip + " steht auf " + gelistet.map((x) => x.liste).join(", "), "echtheit");

  // Links
  const links = linksSammeln(teile);
  let linkPunkte = 0;
  const linkBefunde = [];
  for (const l of links) {
    const h = hostVon(l.ziel);
    if (!h) continue;
    const textHost = /([a-z0-9-]+\.)+[a-z]{2,}/i.exec(l.text || "")?.[0]?.toLowerCase();
    if (textHost && orgDomain(textHost) !== orgDomain(h)) { linkBefunde.push("Linktext zeigt " + textHost + ", das Ziel ist " + h); linkPunkte = Math.max(linkPunkte, 12); }
    if (net.isIP(h)) { linkBefunde.push("Link auf eine nackte IP-Adresse: " + h); linkPunkte = Math.max(linkPunkte, 10); }
    if (KUERZER.test(h)) { linkBefunde.push("Link über einen Kürzer: " + h); linkPunkte = Math.max(linkPunkte, 5); }
    if (h.includes("xn--")) { linkBefunde.push("Link mit Sonderzeichen-Domain (Punycode): " + h); linkPunkte = Math.max(linkPunkte, 8); }
  }
  if (linkPunkte) s(linkPunkte, [...new Set(linkBefunde)].slice(0, 3).join(" · "), "links");

  // Text
  const voll = (betreff + " " + teile.text.join(" ") + " " + teile.html.map(textAusHtml).join(" ")).replace(/\s+/g, " ");
  const druck = [...new Set((voll.match(DRUCK) || []).map((x) => x.toLowerCase()))];
  if (druck.length) s(Math.min(12, 4 + druck.length * 3), "Druck und Frist im Text: „" + druck.slice(0, 3).join("“, „") + "“", "text");
  if (ANREDE.test(voll)) s(4, "Allgemeine Anrede statt Name", "text");
  const werbung = [...new Set((voll.match(WERBUNG) || []).map((x) => x.toLowerCase()))];
  if (werbung.length) s(Math.min(9, werbung.length * 3), "Typische Werbewörter: " + werbung.slice(0, 4).join(", "), "text");
  if (/passwort|kennwort|password|pin\b|tan\b|iban/i.test(voll) && links.length) s(8, "Fragt nach Zugangs- oder Kontodaten und enthält Links", "text");

  signale.sort((a, b) => b.gewicht - a.gewicht);
  const risiko = Math.min(99, signale.reduce((a, x) => a + x.gewicht, 0));
  const phishing = signale.some((x) => x.art === "absender" && x.gewicht >= 15) || signale.some((x) => x.art === "links" && x.gewicht >= 10) || signale.some((x) => x.art === "anhang" && x.gewicht >= 30);
  const urteil = risiko >= 70 ? (phishing ? "Sehr wahrscheinlich Betrug" : "Sehr wahrscheinlich Spam")
    : risiko >= 40 ? "Verdächtig" : risiko >= 15 ? "Eher unbedenklich, mit Auffälligkeiten" : "Unauffällig";
  const empfehlung = risiko >= 70
    ? "Nicht antworten, keinen Link öffnen, keinen Anhang öffnen. Die Nachricht löschen oder an die IT weitergeben."
    : risiko >= 40 ? "Vorsicht: Absender auf anderem Weg prüfen, bevor Sie Links oder Anhänge öffnen."
    : "Keine deutlichen Warnzeichen. Bei Zweifeln den Absender auf anderem Weg fragen.";
  return {
    modul: "mail", art: "nachricht", ziel: betreff || von.adr,
    risiko, urteil, phishing, empfehlung, signale,
    kopf: { von: von.adr, vonName: von.name, an: an.adr, betreff, antwortAn: antwortAn.adr || null, ruecklauf: rueck.adr || null, datum: eins(k, "date") || null },
    anhaenge: teile.anhaenge, links: links.slice(0, 30), echtheit: echt,
    punkte: null,
    kurz: risiko + " % Risiko · " + urteil
  };
}

/* ---------- Eigene Domain ---------- */

const SELEKTOREN = ["default", "google", "selector1", "selector2", "s1", "s2", "k1", "k2", "mail", "dkim", "key1", "smtp", "mxvault", "zoho", "protonmail", "fm1", "fm2", "mandrill", "mailjet", "sendgrid", "everlytickey1", "ionos", "strato", "hostinger"];

export async function domainPruefen(eingabe) {
  const d = domainLesen(eingabe);
  const befunde = [];
  const b = (stufe, gewicht, name, wie, beheben) => befunde.push({ stufe, gewicht, name, wie, beheben: beheben || null, gruppe: "Mail" });
  const ns = await dns.resolveNs(orgDomain(d)).catch((e) => (e.code === "ENOTFOUND" || e.code === "ENODATA" ? [] : null));
  if (Array.isArray(ns) && !ns.length) throw new NutzerFehler("Die Domain " + orgDomain(d) + " gibt es nicht (keine Nameserver).");
  const sub = d !== orgDomain(d);
  const mxVorab = await dns.resolveMx(d).catch(() => []);
  const t = await txt(d);
  const spf = t.filter((x) => /^v=spf1(\s|$)/i.test(x));
  let spfInfo = null;
  if (!spf.length && sub && !mxVorab.length) b("hinweis", 2, "Subdomain ohne SPF", d + " empfängt keine Mails und hat kein SPF. Verschickt sie auch keine, verhindert „v=spf1 -all“, dass Fälscher sie benutzen.", "TXT-Eintrag v=spf1 -all anlegen.");
  else if (!spf.length) b("kritisch", 10, "Kein SPF-Eintrag", "Empfänger können nicht prüfen, welche Server für " + d + " senden dürfen.", "Einen TXT-Eintrag v=spf1 mit den genutzten Absendern und -all oder ~all anlegen.");
  else if (spf.length > 1) b("kritisch", 10, "Mehrere SPF-Einträge", "Mehrere v=spf1-Einträge machen SPF ungültig.", "Zu einem Eintrag zusammenführen.");
  else {
    const z = { lookups: 0 };
    await spfAuswerten("192.0.2.1", d, z);
    const ende = /([~?+-])all\b/.exec(spf[0]);
    spfInfo = { eintrag: spf[0], abfragen: z.lookups, ende: ende ? ende[1] + "all" : "fehlt" };
    if (z.lookups > 10) b("kritisch", 8, "SPF braucht mehr als 10 DNS-Abfragen", "Dann ist SPF ungültig (permerror).", "Includes zusammenfassen oder auf IP-Bereiche umstellen.");
    if (!ende) b("wichtig", 5, "SPF ohne Abschluss", "Der Eintrag endet ohne all-Mechanismus.", "~all oder -all anhängen.");
    else if (ende[1] === "+" || ende[1] === "?") b("wichtig", 6, "SPF erlaubt allen das Senden", "Der Eintrag endet mit " + ende[0] + ".", "Mit -all oder ~all abschließen.");
  }
  let dmarcT = (await txt("_dmarc." + d)).find((x) => /^v=DMARC1/i.test(x)) || null;
  let geerbt = false;
  if (!dmarcT && sub) { dmarcT = (await txt("_dmarc." + orgDomain(d))).find((x) => /^v=DMARC1/i.test(x)) || null; geerbt = !!dmarcT; }
  if (geerbt) { const spRegel = /\bsp=([a-z]+)/i.exec(dmarcT)?.[1]; if (spRegel) dmarcT = dmarcT.replace(/\bp=[a-z]+/i, "p=" + spRegel); }
  let dmarc = null;
  if (!dmarcT) b("kritisch", 10, "Kein DMARC-Eintrag", "Ohne DMARC können andere in Ihrem Namen Mails versenden, ohne dass Empfänger sie abweisen.", "TXT-Eintrag _dmarc." + d + " mit v=DMARC1; p=quarantine; rua=mailto:… anlegen.");
  else {
    const p = /\bp=([a-z]+)/i.exec(dmarcT)?.[1]?.toLowerCase();
    dmarc = { eintrag: dmarcT, regel: p, berichte: /\brua=/i.test(dmarcT), anteil: /\bpct=(\d+)/i.exec(dmarcT)?.[1] || "100", geerbt: geerbt ? orgDomain(d) : null };
    if (p === "none") b("wichtig", 6, "DMARC schützt nicht (p=none)", "Gefälschte Mails werden nur gemeldet, nicht abgewiesen.", "Nach Auswertung der Berichte auf p=quarantine, später p=reject umstellen.");
    if (!dmarc.berichte) b("hinweis", 2, "DMARC ohne Berichte", "Ohne rua erfahren Sie nicht, wer in Ihrem Namen sendet.", "rua=mailto:… ergänzen.");
  }
  const dkim = [];
  await Promise.all(SELEKTOREN.map(async (s) => { const k = (await txt(s + "._domainkey." + d)).join(""); if (/p=/.test(k)) dkim.push({ selektor: s, schluessel: /p=([A-Za-z0-9+/=]*)/.exec(k)?.[1]?.length > 300 ? "2048 Bit oder mehr" : "kurz" }); }));
  if (!dkim.length) b("hinweis", 3, "Kein DKIM-Schlüssel unter üblichen Namen", "Unter " + SELEKTOREN.length + " üblichen Selektoren wurde kein Schlüssel gefunden. Er kann unter einem anderen Namen liegen.", "Den Selektor beim Mailanbieter nachsehen.");
  const mx = mxVorab.slice().sort((a, c) => a.priority - c.priority);
  const mxInfo = [];
  for (const m of mx.slice(0, 4)) {
    const ips = await dns.resolve4(m.exchange).catch(() => []);
    const ptr = ips[0] ? await dns.reverse(ips[0]).catch(() => []) : [];
    const liste = ips[0] ? await sperrlisten(ips[0]) : [];
    mxInfo.push({ server: m.exchange, prioritaet: m.priority, ip: ips[0] || null, ptr: ptr[0] || null, sperrlisten: liste });
    if (liste.some((l) => l.gelistet)) b("kritisch", 8, "Mailserver auf Sperrliste", m.exchange + " (" + ips[0] + ") steht auf " + liste.filter((l) => l.gelistet).map((l) => l.liste).join(", "), "Beim Anbieter melden; Ursache (offenes Relais, gekapertes Konto) klären.");
  }
  if (!mx.length && !sub) b("wichtig", 5, "Keine MX-Einträge", d + " kann keine Mails empfangen.", "MX-Einträge des Mailanbieters setzen.");
  const sts = (await txt("_mta-sts." + d)).find((x) => /^v=STSv1/i.test(x)) || null;
  if (!sts && mx.length) b("hinweis", 2, "Kein MTA-STS", "Mails an Sie können unverschlüsselt umgeleitet werden.", "MTA-STS-Eintrag und Richtliniendatei anlegen.");
  const tlsrpt = (await txt("_smtp._tls." + d)).find((x) => /^v=TLSRPTv1/i.test(x)) || null;
  const bimi = (await txt("default._bimi." + d)).find((x) => /^v=BIMI1/i.test(x)) || null;
  const abzug = befunde.reduce((a, x) => a + x.gewicht * (x.stufe === "kritisch" ? 3 : x.stufe === "wichtig" ? 2 : 1), 0);
  const punkte = Math.max(0, 100 - abzug);
  const z = (s) => befunde.filter((x) => x.stufe === s).length;
  return {
    modul: "mail", art: "domain", ziel: d, punkte,
    spf: spfInfo, dmarc, dkim, mx: mxInfo, mtaSts: sts, tlsRpt: tlsrpt, bimi,
    befunde,
    kurz: punkte + " von 100 · " + z("kritisch") + " kritisch, " + z("wichtig") + " wichtig, " + z("hinweis") + " Hinweise"
  };
}

export async function pruefen(eingabe, ctx = {}) {
  if (eingabe.art === "domain") return domainPruefen(eingabe.domain);
  if (!eingabe.roh || String(eingabe.roh).trim().length < 20) throw new NutzerFehler("Bitte die vollständige Nachricht mit Kopfzeilen einfügen.");
  const eigene = String(eingabe.eigene || "").split(/[\s,;]+/).filter(Boolean).concat(ctx.eigeneDomains || []);
  return nachrichtPruefen(eingabe.roh, eigene);
}
