/* RDAP: Registrierungsdaten ueber den zustaendigen Server laut IANA-Verzeichnis.
   Antwortet der Server mit 404, ist die Domain nicht registriert. */

import dns from "node:dns/promises";

let verzeichnis = null;
let geholt = 0;

async function server(tld) {
  if (!verzeichnis || Date.now() - geholt > 86400e3) {
    const a = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(10000) });
    if (!a.ok) throw new Error("IANA-Verzeichnis nicht erreichbar");
    verzeichnis = await a.json(); geholt = Date.now();
  }
  for (const [tlds, urls] of verzeichnis.services) if (tlds.includes(tld)) return urls[0];
  if (tld === "de") return "https://rdap.denic.de/";
  return null;
}

export async function rdap(domain) {
  const tld = domain.split(".").pop();
  let basis;
  try { basis = await server(tld); } catch (e) { return { ok: false, grund: e.message }; }
  if (!basis) return { ok: false, grund: "Für ." + tld + " gibt es keinen RDAP-Server." };
  const url = basis.replace(/\/?$/, "/") + "domain/" + encodeURIComponent(domain);
  let a;
  try { a = await fetch(url, { headers: { accept: "application/rdap+json" }, signal: AbortSignal.timeout(10000) }); }
  catch (e) { return { ok: false, grund: "RDAP nicht erreichbar" }; }
  if (a.status === 404) return { ok: true, registriert: false, quelle: url };
  if (!a.ok) return { ok: false, grund: "RDAP antwortet mit " + a.status };
  const j = await a.json();
  const ereignis = (art) => (j.events || []).find((e) => e.eventAction === art)?.eventDate || null;
  const registrar = (j.entities || []).find((e) => (e.roles || []).includes("registrar"));
  const name = registrar?.vcardArray?.[1]?.find((v) => v[0] === "fn")?.[3] || null;
  return {
    ok: true, registriert: true, quelle: url,
    registriertSeit: ereignis("registration"), laeuftBis: ereignis("expiration"),
    geaendert: ereignis("last changed"), registrar: name,
    status: j.status || [], dnssec: j.secureDNS?.delegationSigned ?? null
  };
}

/* WHOIS (Port 43) als Rueckfall fuer Endungen ohne RDAP, etwa .me.
   Der zustaendige Server kommt von whois.iana.org. */
import net from "node:net";
function whoisFrage(server, frage) {
  return new Promise((ok, fehl) => {
    let text = "";
    const s = net.connect(43, server, () => s.write(frage + "\r\n"));
    s.setTimeout(8000, () => { s.destroy(); fehl(new Error("WHOIS antwortet nicht")); });
    s.on("data", (d) => { text += d.toString("utf8"); if (text.length > 200000) s.destroy(); });
    s.on("end", () => ok(text));
    s.on("close", () => ok(text));
    s.on("error", fehl);
  });
}
const whoisServer = new Map();
export async function whois(domain) {
  const tld = domain.split(".").pop();
  try {
    if (!whoisServer.has(tld)) whoisServer.set(tld, (/^(?:whois|refer):\s*(\S+)/im.exec(await whoisFrage("whois.iana.org", tld)) || [])[1] || null);
    const server = whoisServer.get(tld);
    if (!server) return { ok: false, grund: "Kein WHOIS-Server für ." + tld };
    const t = await whoisFrage(server, server === "whois.denic.de" ? "-T dn " + domain : domain);
    if (/no match|not found|no data found|status:\s*free|no entries found|is available/i.test(t)) return { ok: true, registriert: false, quelle: "WHOIS " + server };
    const feld = (re) => { const m = re.exec(t); return m ? m[1].trim() : null; };
    const datumLesen = (s) => { if (!s) return null; const d = new Date(s.replace(/^(\d{2})\.(\d{2})\.(\d{4})/, "$3-$2-$1")); return isNaN(d) ? null : d.toISOString(); };
    return {
      ok: true, registriert: true, quelle: "WHOIS " + server,
      laeuftBis: datumLesen(feld(/(?:Registry Expiry Date|Expiration Date|Expiry Date|expires|paid-till|Expiry date|Renewal date):\s*(.+)/i)),
      registriertSeit: datumLesen(feld(/(?:Creation Date|created|Registered on|Registration Time):\s*(.+)/i)),
      registrar: feld(/^\s*Registrar(?: Name)?:\s*(.+)$/im),
      status: [...t.matchAll(/^\s*(?:Domain )?Status:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 6),
      dnssec: /DNSSEC:\s*signed/i.test(t) ? true : /DNSSEC:\s*unsigned/i.test(t) ? false : null
    };
  } catch (e) { return { ok: false, grund: e.message }; }
}

/* Schnelle Vorpruefung ohne RDAP: gibt es Nameserver? */
export async function hatNameserver(domain) {
  try { const ns = await dns.resolveNs(domain); return ns.length > 0; }
  catch (e) { return e.code === "ENOTFOUND" || e.code === "ENODATA" ? false : null; }
}

export async function verfuegbar(domain) {
  const r = await rdap(domain);
  if (r.ok) return { domain, frei: !r.registriert, sicher: true, quelle: "RDAP", laeuftBis: r.laeuftBis || null };
  const w = await whois(domain);
  if (w.ok) return { domain, frei: !w.registriert, sicher: true, quelle: "WHOIS", laeuftBis: w.laeuftBis || null };
  const ns = await hatNameserver(domain);
  if (ns === true) return { domain, frei: false, sicher: true, quelle: "DNS" };
  if (ns === false) return { domain, frei: true, sicher: false, quelle: "DNS", hinweis: "keine Nameserver gefunden, Registrierung nicht bestätigt" };
  return { domain, frei: null, sicher: false, quelle: "unbekannt" };
}
