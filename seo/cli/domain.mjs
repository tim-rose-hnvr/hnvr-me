/* seo-rank.me — Domain-Check.

   Sammelt, was eine Domain ueber sich preisgibt: DNS, Zertifikat,
   Weiterleitungen der vier Schreibweisen, Antwortkoepfe, Standarddateien
   und die Registrierung. Geurteilt wird nicht hier, sondern in
   `site/assets/js/domainregeln.js` — derselbe Regelsatz, den auch der
   Browser benutzt.

   Ohne Fremdpakete: node:dns, node:tls, fetch. Mehr braucht es nicht.

   Dieses Werkzeug RUFT AB. Das ist sein Zweck und es ist der Unterschied
   zu den Werkzeugen im Browser. Kontaktiert werden: die gepruefte Domain
   selbst, die eingestellten DNS-Aufloeser dieses Rechners und — nur fuer
   die Registrierungsdaten — rdap.org. */

import dns from "node:dns/promises";
import tls from "node:tls";

const ZEITGRENZE = 12000;

/* ---------------------------------------------------------------
   Kleine Hilfen
   --------------------------------------------------------------- */

function tageBis(datum) {
  if (!datum) return null;
  const ziel = new Date(datum).getTime();
  if (!isFinite(ziel)) return null;
  return Math.floor((ziel - Date.now()) / 86400000);
}

async function stillHalten(versprechen, ersatz = null) {
  try { return await versprechen; } catch (e) { return ersatz; }
}

/* ---------------------------------------------------------------
   DNS
   --------------------------------------------------------------- */

async function dnsSammeln(domain) {
  const [a4, a6, ns, mx, txt, caa] = await Promise.all([
    stillHalten(dns.resolve4(domain, { ttl: true }), []),
    stillHalten(dns.resolve6(domain), []),
    stillHalten(dns.resolveNs(domain), []),
    stillHalten(dns.resolveMx(domain), []),
    stillHalten(dns.resolveTxt(domain), []),
    stillHalten(dns.resolveCaa(domain), [])
  ]);

  const dmarcRoh = await stillHalten(dns.resolveTxt("_dmarc." + domain), []);

  /* resolveTxt gibt Bruchstuecke zurueck, weil ein TXT-Eintrag ueber 255
     Zeichen aufgeteilt wird. Sie gehoeren ohne Trennzeichen zusammen. */
  const txtGanz = (txt || []).map((teile) => teile.join(""));
  const dmarcGanz = (dmarcRoh || []).map((teile) => teile.join(""));

  const adressen = (a4 || []).map((e) => (typeof e === "string" ? e : e.address));
  const ttl = (a4 || []).length && typeof a4[0] === "object" ? a4[0].ttl : null;

  const ptr = adressen.length ? await stillHalten(dns.reverse(adressen[0]), []) : [];

  return {
    a: adressen,
    aTtl: ttl,
    aaaa: a6 || [],
    ns: (ns || []).map((n) => String(n).replace(/\.$/, "")),
    mx: (mx || []).map((m) => `${m.priority} ${m.exchange}`),
    txt: txtGanz,
    spf: txtGanz.filter((t) => /^v=spf1\b/i.test(t)),
    dmarc: dmarcGanz.filter((t) => /^v=DMARC1\b/i.test(t)),
    caa: (caa || []).map((c) => {
      const schluessel = Object.keys(c).filter((k) => k !== "critical")[0];
      return schluessel ? `${schluessel} ${c[schluessel]}` : JSON.stringify(c);
    }),
    ptr: ptr || []
  };
}

/* ---------------------------------------------------------------
   Zertifikat
   --------------------------------------------------------------- */

function tlsSammeln(host) {
  return new Promise((fertig) => {
    let erledigt = false;
    const schluss = (wert) => { if (!erledigt) { erledigt = true; fertig(wert); } };

    let dose;
    try {
      dose = tls.connect({
        host,
        port: 443,
        servername: host,
        /* Ein ungueltiges Zertifikat soll GEMESSEN werden, nicht die
           Verbindung abbrechen. Geprueft wird danach selbst. */
        rejectUnauthorized: false,
        timeout: ZEITGRENZE
      });
    } catch (e) {
      return schluss({ fehler: String(e.message || e) });
    }

    dose.on("secureConnect", () => {
      const zert = dose.getPeerCertificate(true);
      const protokoll = dose.getProtocol();
      const bestaetigt = dose.authorized;
      const grund = dose.authorizationError ? String(dose.authorizationError) : null;

      let kettenlaenge = 0;
      let lauf = zert;
      const gesehen = new Set();
      while (lauf && lauf.fingerprint && !gesehen.has(lauf.fingerprint)) {
        gesehen.add(lauf.fingerprint);
        kettenlaenge++;
        lauf = lauf.issuerCertificate;
      }

      const san = String(zert.subjectaltname || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^DNS:/i.test(s))
        .map((s) => s.slice(4).trim());

      const selbstsigniert = !!(zert.issuer && zert.subject
        && JSON.stringify(zert.issuer) === JSON.stringify(zert.subject));

      dose.end();
      schluss({
        protokoll,
        bestaetigt,
        fehlerGrund: grund,
        aussteller: zert.issuer ? (zert.issuer.O || zert.issuer.CN || "") : "",
        inhaber: zert.subject ? (zert.subject.CN || "") : "",
        san,
        gueltigVon: zert.valid_from || null,
        gueltigBis: zert.valid_to || null,
        tageRest: tageBis(zert.valid_to),
        selbstsigniert,
        kettenlaenge
      });
    });

    dose.on("timeout", () => { dose.destroy(); schluss({ fehler: "Zeitüberschreitung" }); });
    dose.on("error", (e) => { schluss({ fehler: String(e.message || e) }); });
  });
}

/* ---------------------------------------------------------------
   Abrufe
   --------------------------------------------------------------- */

async function holen(adresse, methode = "GET") {
  const beginn = Date.now();
  try {
    const antwort = await fetch(adresse, {
      method: methode,
      redirect: "manual",
      headers: {
        "User-Agent": "seo-rank.me Domain-Check",
        "Accept-Encoding": "gzip, deflate, br",
        Accept: "text/html,application/xhtml+xml,*/*"
      },
      signal: AbortSignal.timeout(ZEITGRENZE)
    });
    return { antwort, dauer: Date.now() - beginn };
  } catch (e) {
    return { fehler: String(e.message || e), dauer: Date.now() - beginn };
  }
}

/* Folgt Weiterleitungen von Hand, damit die KETTE sichtbar wird und nicht
   nur das Ziel. Genau darin liegt der haeufigste Fehler. */
async function kette(start, hoechstens = 10) {
  const glieder = [];
  let jetzt = start;
  let letzteAntwort = null;
  let ttfb = null;

  for (let i = 0; i < hoechstens; i++) {
    const { antwort, fehler, dauer } = await holen(jetzt);
    if (fehler) return { kette: glieder, fehler, ziel: jetzt, status: null, ttfb };
    if (ttfb === null) ttfb = dauer;

    letzteAntwort = antwort;
    glieder.push({ url: jetzt, status: antwort.status });

    const ort = antwort.headers.get("location");
    if (antwort.status >= 300 && antwort.status < 400 && ort) {
      let naechste;
      try { naechste = new URL(ort, jetzt).href; } catch (e) { break; }
      if (naechste === jetzt) break;
      jetzt = naechste;
      continue;
    }
    break;
  }

  return {
    kette: glieder,
    ziel: jetzt,
    status: letzteAntwort ? letzteAntwort.status : null,
    antwort: letzteAntwort,
    ttfb
  };
}

async function statusVon(adresse) {
  const { antwort, fehler } = await holen(adresse, "GET");
  if (fehler) return { url: adresse, status: null, fehler };
  let text = null;
  const typ = antwort.headers.get("content-type") || "";
  if (/text|xml|json/i.test(typ)) {
    try { text = (await antwort.text()).slice(0, 60000); } catch (e) { /* egal */ }
  }
  return { url: adresse, status: antwort.status, text };
}

/* ---------------------------------------------------------------
   Registrierung ueber RDAP
   --------------------------------------------------------------- */

async function rdapSammeln(domain) {
  try {
    const antwort = await fetch("https://rdap.org/domain/" + encodeURIComponent(domain), {
      headers: { Accept: "application/rdap+json", "User-Agent": "seo-rank.me Domain-Check" },
      redirect: "follow",
      signal: AbortSignal.timeout(ZEITGRENZE)
    });
    if (!antwort.ok) return { fehler: "RDAP antwortet mit " + antwort.status };
    const daten = await antwort.json();

    const ereignis = (name) => {
      const e = (daten.events || []).find((x) => x.eventAction === name);
      return e ? e.eventDate : null;
    };
    const registrar = (daten.entities || [])
      .filter((e) => (e.roles || []).includes("registrar"))
      .map((e) => {
        const v = (e.vcardArray && e.vcardArray[1]) || [];
        const fn = v.find((z) => z[0] === "fn");
        return fn ? fn[3] : e.handle;
      })[0] || null;

    const laeuftAb = ereignis("expiration");
    return {
      registrar,
      erstellt: ereignis("registration"),
      geaendert: ereignis("last changed"),
      laeuftAb,
      tageRest: tageBis(laeuftAb),
      status: daten.status || []
    };
  } catch (e) {
    return { fehler: String(e.message || e) };
  }
}

/* ---------------------------------------------------------------
   Alles zusammen
   --------------------------------------------------------------- */

export async function domainSammeln(eingabe, einstellungen = {}) {
  /* Eingabe darf eine Adresse oder ein blosser Name sein. */
  let domain = String(eingabe).trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
  const blank = domain.replace(/^www\./, "");

  const varianten = [
    { kennung: "http", url: "http://" + blank + "/" },
    { kennung: "http-www", url: "http://www." + blank + "/" },
    { kennung: "https", url: "https://" + blank + "/" },
    { kennung: "https-www", url: "https://www." + blank + "/" }
  ];

  const gemessen = [];
  for (const v of varianten) {
    const e = await kette(v.url);
    gemessen.push({
      kennung: v.kennung, url: v.url,
      status: e.status, ziel: e.ziel, kette: e.kette,
      fehler: e.fehler || null, ttfb: e.ttfb
    });
  }

  /* Der massgebliche Host ist der, auf dem die sichere Variante landet. */
  const sicher = gemessen.filter((v) => v.kennung.indexOf("https") === 0 && v.status && !v.fehler);
  let host = blank;
  let startseite = "https://" + blank + "/";
  if (sicher.length) {
    const beste = sicher.find((v) => v.status === 200) || sicher[0];
    startseite = beste.ziel || beste.url;
    try { host = new URL(startseite).host; } catch (e) { /* dann bleibt blank */ }
  }

  const [dnsDaten, tlsDaten] = await Promise.all([
    dnsSammeln(blank),
    tlsSammeln(host)
  ]);

  /* Kopfzeilen der Startseite, jetzt mit Folgen der Weiterleitungen. */
  let kopf = {};
  let cookies = [];
  let ttfb = null;
  const { antwort, fehler, dauer } = await holen(startseite);
  if (!fehler && antwort) {
    ttfb = dauer;
    antwort.headers.forEach((wert, name) => { kopf[name.toLowerCase()] = wert; });
    if (typeof antwort.headers.getSetCookie === "function") cookies = antwort.headers.getSetCookie();
    else if (kopf["set-cookie"]) cookies = [kopf["set-cookie"]];
    try { await antwort.text(); } catch (e) { /* Koerper wird nicht gebraucht */ }
  }

  const wurzel = new URL(startseite).origin;
  const zufall = "/seo-rank-pruefpfad-" + Math.random().toString(36).slice(2, 10);

  const robots = await statusVon(wurzel + "/robots.txt");

  /* Die Sitemap steht dort, wo die robots.txt sie nennt — sonst am
     ueblichen Ort. Die Reihenfolge ist wichtig: wer nur /sitemap.xml
     prueft, meldet eine fehlende Sitemap, die es gibt. */
  let sitemapAdresse = wurzel + "/sitemap.xml";
  if (robots.status === 200 && robots.text) {
    const m = robots.text.match(/^\s*sitemap\s*:\s*(\S+)/im);
    if (m) sitemapAdresse = m[1];
  }

  const [sitemap, favicon, securitytxt, zufallspfad] = await Promise.all([
    statusVon(sitemapAdresse),
    statusVon(wurzel + "/favicon.ico"),
    statusVon(wurzel + "/.well-known/security.txt"),
    statusVon(wurzel + zufall)
  ]);

  const rdap = einstellungen.ohneRdap ? null : await rdapSammeln(blank);

  return {
    domain: blank,
    host,
    startseite,
    varianten: gemessen,
    tls: tlsDaten,
    kopf,
    cookies,
    ttfb,
    dns: dnsDaten,
    dateien: {
      robots: { url: robots.url, status: robots.status, text: robots.text },
      sitemap: { url: sitemap.url, status: sitemap.status },
      favicon: { url: favicon.url, status: favicon.status },
      securitytxt: { url: securitytxt.url, status: securitytxt.status },
      zufallspfad: { url: zufallspfad.url, status: zufallspfad.status }
    },
    rdap: rdap && !rdap.fehler ? rdap : null,
    rdapFehler: rdap && rdap.fehler ? rdap.fehler : null
  };
}
