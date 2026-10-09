/* seo-rank.me — Abrufrelais.

   Der Browser darf fremde Adressen nicht abrufen. Ein Server darf es.
   Mehr macht dieses Relais nicht: es HOLT und gibt zurueck, was es
   bekommen hat. Geurteilt wird weiter im Browser, mit demselben
   Regelkatalog wie ueberall.

   Das ist eine bewusste Entscheidung gegen die naheliegende Bauweise.
   Wer die Regeln in den Server legt, hat sie zweimal: einmal dort,
   einmal im Browser. Zwei Fassungen derselben Bewertung laufen
   auseinander, und dann stimmt eine von beiden nicht mehr. Hier gibt es
   sie weiterhin genau einmal.

   Die Antwort ist immer HTTP 200, auch wenn der Abruf misslungen ist —
   der Grund steht dann im Feld `fehler`. Sonst sieht der Browser nur
   „Failed to fetch" und kann nicht sagen, woran es lag.

   Aufruf:  node cli/relais.mjs [port]
   Probe:   http://localhost:8124/holen?url=https%3A%2F%2Fexample.com
*/

import http from "node:http";
import dns from "node:dns/promises";

const PORT = parseInt(process.argv[2], 10) || 8124;
const ZEITGRENZE = 15000;
const HOECHSTENS = 3 * 1024 * 1024;   /* 3 MB reichen fuer jede HTML-Seite */
const SPRUENGE = 10;

/* Jede Antwort darf von ueberall gelesen werden. Das Relais gibt nur
   weiter, was ohnehin oeffentlich abrufbar ist, und traegt keine
   Anmeldung — es gibt hier nichts zu schuetzen. */
const KOPFZEILEN = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

function antworten(res, koerper, status = 200) {
  const text = JSON.stringify(koerper);
  res.writeHead(status, { ...KOPFZEILEN, "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

/* Nur oeffentliche Adressen. Ein Relais, das auch 127.0.0.1 oder
   192.168.x.x abruft, ist ein offenes Tor in das Netz, in dem es
   steht. */
function erlaubt(adresse) {
  let u;
  try { u = new URL(adresse); } catch (e) { return "Das ist keine gültige Adresse."; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Nur http und https.";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "[::1]") return "Kein Zugriff auf localhost.";
  if (/^(10|127)\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (/^192\.168\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (/^169\.254\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (h.endsWith(".internal") || h.endsWith(".local")) return "Kein Zugriff auf interne Namen.";
  if (!h.includes(".")) return "Der Name hat keinen Punkt — das ist kein öffentlicher Host.";
  return null;
}

/* Ein oeffentlicher Name kann auf eine private Adresse zeigen. Deshalb
   wird nicht nur der Name geprueft, sondern auch, wohin er auflöst.

   Das schliesst die Luecke nicht vollstaendig: zwischen dieser Auflösung
   und dem Abruf loest der Rechner ein zweites Mal auf, und dazwischen
   kann sich die Antwort aendern (DNS-Rebinding). Wer das Relais oeffentlich
   betreibt, gehoert in ein Netz, in dem es nichts zu holen gibt. */
function privateIp(ip) {
  if (/^127\./.test(ip) || ip === "::1") return true;
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^0\./.test(ip)) return true;
  const k = ip.toLowerCase();
  if (k.startsWith("fe80:") || k.startsWith("fc") || k.startsWith("fd")) return true;
  return false;
}

async function zeigtInsPrivate(hostname) {
  let adressen;
  try { adressen = await dns.lookup(hostname, { all: true }); }
  catch (e) { return "Der Name lässt sich nicht auflösen."; }
  const schlecht = adressen.filter((a) => privateIp(a.address));
  if (schlecht.length) {
    return "Der Name zeigt auf eine private Adresse (" + schlecht[0].address + ").";
  }
  return null;
}

async function einAbruf(adresse) {
  const beginn = Date.now();
  const antwort = await fetch(adresse, {
    redirect: "manual",
    headers: {
      "User-Agent": "seo-rank.me Abrufrelais (+https://seo-rank.me)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "de,en;q=0.8"
    },
    signal: AbortSignal.timeout(ZEITGRENZE)
  });
  return { antwort, ms: Date.now() - beginn };
}

/* Folgt Weiterleitungen von Hand, damit die KETTE sichtbar wird. Genau
   sie ist der haeufigste Fund bei einem Umzug, und sie geht verloren,
   wenn man dem fetch das Folgen ueberlaesst. */
async function holen(adresse, nurKopf) {
  const kette = [];
  let jetzt = adresse;
  let letzte = null;
  let ttfb = null;

  for (let i = 0; i <= SPRUENGE; i++) {
    const grund = erlaubt(jetzt);
    if (grund) return { ok: false, fehler: grund, kette };

    /* Auch nach jeder Weiterleitung. Ein Server kann auf eine interne
       Adresse weiterleiten, und dann waere die Namenspruefung von vorhin
       wertlos. */
    const zeigt = await zeigtInsPrivate(new URL(jetzt).hostname);
    if (zeigt) return { ok: false, fehler: zeigt, kette, angefragt: adresse };

    let e;
    try { e = await einAbruf(jetzt); }
    catch (fehler) {
      return { ok: false, fehler: String(fehler.message || fehler), kette, angefragt: adresse };
    }
    if (ttfb === null) ttfb = e.ms;
    letzte = e.antwort;
    kette.push({ url: jetzt, status: e.antwort.status });

    const ort = e.antwort.headers.get("location");
    if (e.antwort.status >= 300 && e.antwort.status < 400 && ort) {
      let naechste;
      try { naechste = new URL(ort, jetzt).href; } catch (x) { break; }
      if (naechste === jetzt) break;
      if (i === SPRUENGE) {
        return { ok: false, fehler: "Mehr als " + SPRUENGE + " Weiterleitungen.", kette, angefragt: adresse };
      }
      jetzt = naechste;
      continue;
    }
    break;
  }

  const kopf = {};
  letzte.headers.forEach((wert, name) => { kopf[name.toLowerCase()] = wert; });
  const cookies = typeof letzte.headers.getSetCookie === "function"
    ? letzte.headers.getSetCookie() : (kopf["set-cookie"] ? [kopf["set-cookie"]] : []);

  let html = null;
  let bytes = 0;
  let abgeschnitten = false;
  if (!nurKopf) {
    const puffer = await letzte.arrayBuffer();
    bytes = puffer.byteLength;
    if (bytes > HOECHSTENS) abgeschnitten = true;
    /* Zeichensatz aus der Kopfzeile, sonst UTF-8. Wer hier raet, liest
       Umlaute falsch und meldet dann falsche Wortzahlen. */
    let satz = "utf-8";
    const typ = kopf["content-type"] || "";
    const m = typ.match(/charset=([\w-]+)/i);
    if (m) satz = m[1].toLowerCase();
    try {
      html = new TextDecoder(satz, { fatal: false })
        .decode(puffer.slice(0, HOECHSTENS));
    } catch (e) {
      html = new TextDecoder("utf-8", { fatal: false }).decode(puffer.slice(0, HOECHSTENS));
    }
  } else {
    try { await letzte.arrayBuffer(); } catch (e) { /* Koerper wird verworfen */ }
  }

  return {
    ok: true,
    angefragt: adresse,
    ziel: kette.length ? kette[kette.length - 1].url : adresse,
    status: letzte.status,
    kette,
    spruenge: kette.length - 1,
    kopf,
    cookies,
    html,
    bytes,
    abgeschnitten,
    ttfb
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, KOPFZEILEN); res.end(); return; }

  let u;
  try { u = new URL(req.url, "http://x"); } catch (e) { antworten(res, { ok: false, fehler: "Unlesbare Anfrage." }); return; }

  if (u.pathname === "/" || u.pathname === "/hilfe") {
    antworten(res, {
      dienst: "seo-rank.me Abrufrelais",
      zweck: "Holt eine oeffentliche Adresse und gibt Kopfzeilen, Weiterleitungskette und Quelltext zurueck. Urteilt nicht.",
      aufruf: "/holen?url=<adresse>[&nurkopf=1]",
      grenzen: { zeit: ZEITGRENZE + " ms", groesse: HOECHSTENS + " Bytes", spruenge: SPRUENGE }
    });
    return;
  }

  if (u.pathname !== "/holen") { antworten(res, { ok: false, fehler: "Unbekannter Pfad." }, 404); return; }

  const adresse = u.searchParams.get("url");
  if (!adresse) { antworten(res, { ok: false, fehler: "Kein url-Parameter." }); return; }

  const grund = erlaubt(adresse);
  if (grund) { antworten(res, { ok: false, fehler: grund }); return; }

  try {
    antworten(res, await holen(adresse, u.searchParams.get("nurkopf") === "1"));
  } catch (e) {
    antworten(res, { ok: false, fehler: String(e.message || e) });
  }
});

server.listen(PORT, () => {
  process.stdout.write("Abrufrelais auf http://localhost:" + PORT + "/holen?url=…\n");
});
