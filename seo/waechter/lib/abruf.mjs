/* SEO Waechter · Abruf einer Seite mit verstaendlichen Fehlern.
   Bei ungueltigem Zertifikat wird die Seite trotzdem gelesen (ohne Pruefung
   des Zertifikats), damit Audit und Content ein Ergebnis liefern; der Mangel
   steht dann als kritischer Befund oben. Schutz gegen interne Adressen gilt
   auch hier. */

import https from "node:https";
import dns from "node:dns";
import { NutzerFehler, privat, hostErlaubt } from "./schutz.mjs";
import { KENNUNG } from "./werk.mjs";

const ZERTIFIKAT = {
  CERT_HAS_EXPIRED: "Das Zertifikat ist abgelaufen.",
  DEPTH_ZERO_SELF_SIGNED_CERT: "Das Zertifikat ist selbst ausgestellt.",
  SELF_SIGNED_CERT_IN_CHAIN: "Die Zertifikatskette enthält ein selbst ausgestelltes Zertifikat.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Die Zertifikatskette ist unvollständig.",
  UNABLE_TO_GET_ISSUER_CERT_LOCALLY: "Der Aussteller des Zertifikats ist unbekannt.",
  ERR_TLS_CERT_ALTNAME_INVALID: "Das Zertifikat gilt nicht für diesen Namen.",
  CERT_NOT_YET_VALID: "Das Zertifikat ist noch nicht gültig."
};

export function fehlerText(e) {
  const c = e?.cause?.code || e?.code || "";
  if (e instanceof NutzerFehler) return e.message;
  if (ZERTIFIKAT[c]) return "Zertifikat ungültig: " + ZERTIFIKAT[c];
  if (c === "ENOTFOUND" || c === "EAI_AGAIN") return "Die Domain lässt sich nicht auflösen.";
  if (c === "ECONNREFUSED") return "Der Server nimmt keine Verbindung an.";
  if (c === "ECONNRESET" || c === "UND_ERR_SOCKET") return "Der Server hat die Verbindung abgebrochen.";
  if (e?.name === "TimeoutError" || e?.name === "AbortError" || c === "UND_ERR_CONNECT_TIMEOUT") return "Keine Antwort binnen 15 Sekunden.";
  return "Die Seite ist nicht abrufbar (" + (c || e?.message || "unbekannt") + ").";
}

function ohneZertifikat(url, rest = 5) {
  return new Promise((ok, fehl) => {
    const req = https.get(url, {
      rejectUnauthorized: false, agent: false,
      headers: { "user-agent": KENNUNG, accept: "text/html,*/*" },
      lookup: (h, o, cb) => dns.lookup(h, o, (err, adr, fam) => {
        const l = Array.isArray(adr) ? adr : [{ address: adr }];
        if (!err && process.env.WAECHTER_LOKAL_ERLAUBT !== "1" && l.some((a) => privat(a.address))) return cb(new Error("intern"));
        cb(err, adr, fam);
      })
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && rest > 0) {
        res.resume();
        const ziel = new URL(res.headers.location, url).href;
        return hostErlaubt(new URL(ziel).hostname).then(() => ohneZertifikat(ziel, rest - 1)).then(ok, fehl);
      }
      const teile = []; let n = 0;
      res.on("data", (c) => { n += c.length; if (n < 8e6) teile.push(c); });
      res.on("end", () => ok({ url, status: res.statusCode, kopf: res.headers, text: Buffer.concat(teile).toString("utf8") }));
    });
    req.setTimeout(15000, () => req.destroy(new Error("Zeit")));
    req.on("error", fehl);
  });
}

/* Liefert { url, status, typ, kodierung, text, ms, zertifikatFehler } */
export async function seiteHolen(url) {
  const t0 = Date.now();
  try {
    const a = await fetch(url, { headers: { "user-agent": KENNUNG, accept: "text/html,*/*" } });
    if (a.status === 429) throw new NutzerFehler("Die Website bremst gerade Abrufe (Status 429). Bitte in einigen Minuten erneut prüfen.", 503);
    const text = await a.text();
    return { url: a.url || url, status: a.status, typ: a.headers.get("content-type") || "", kodierung: a.headers.get("content-encoding"), text, ms: Date.now() - t0, zertifikatFehler: null };
  } catch (e) {
    const c = e?.cause?.code || "";
    if (ZERTIFIKAT[c] && url.startsWith("https:")) {
      const r = await ohneZertifikat(url).catch((x) => { throw new NutzerFehler(fehlerText(x)); });
      return { url: r.url, status: r.status, typ: r.kopf["content-type"] || "", kodierung: r.kopf["content-encoding"] || null, text: r.text, ms: Date.now() - t0, zertifikatFehler: ZERTIFIKAT[c] };
    }
    throw new NutzerFehler(fehlerText(e));
  }
}

export const istHtml = (s) => /html|xml/i.test(s.typ) || (!s.typ && /<html|<!doctype html/i.test(s.text.slice(0, 2000)));
