/* seo-rank.me — Abrufrelais fuer Wix Velo.

   Dieselbe Aufgabe und dasselbe Antwortformat wie `cli/relais.mjs`:
   holen, nicht urteilen. Geurteilt wird im Browser, mit demselben
   Regelkatalog wie ueberall.

   EINBAU auf einer Wix-Website:
     1. Im Editor: Entwicklermodus (Velo) einschalten.
     2. Backend -> `http-functions.js` oeffnen.
        GIBT ES DIE DATEI SCHON (auf hnvr.me ja, dort liegt seocheck):
        den ganzen Inhalt dieser Datei UNTER den vorhandenen Code setzen,
        nichts davon loeschen. Alle Namen hier tragen das Praefix
        `relais`, die Importe laufen ueber eigene Namen — deshalb kollidiert
        nichts. Die fruehere Fassung importierte `ok` und `fetch` unter
        ihrem gewoehnlichen Namen; unter vorhandenen Code gesetzt ergab das
        „Identifier 'ok' has already been declared", und die ganze Datei
        waere ausgefallen, seocheck eingeschlossen (nachgestellt und mit
        node --check gemessen am 25.09.2026).
        Gibt es die Datei noch nicht: neu anlegen, exakt so nennen.
     3. Veroeffentlichen.
     4. Erreichbar unter  https://IHRE-DOMAIN/_functions/holen?url=…
        Vor dem Veroeffentlichen zum Testen unter  /_functions-dev/holen
        Selbstauskunft unter  /_functions/relais

   Wichtig zu wissen:
   - Velo kennt kein `node:dns`. Die Namenspruefung faellt deshalb
     schmaler aus als in der Node-Fassung: sie prueft den NAMEN, nicht,
     wohin er zeigt. Ein oeffentlicher Name, der auf eine interne
     Adresse verweist, wird hier nicht erkannt. In der Wix-Cloud gibt es
     kein internes Netz zu erreichen, deshalb ist das dort vertretbar —
     auf einem eigenen Server ist es das nicht, dort gehoert die
     Node-Fassung hin.
   - Wix begrenzt die Laufzeit einer Funktion. Grosse Seiten koennen
     deshalb abbrechen; die Antwort sagt dann, woran es lag.
*/

import { ok as relaisOk } from "wix-http-functions";
import { fetch as relaisFetch } from "wix-fetch";

const RELAIS_ZEITGRENZE = 12000;
const RELAIS_HOECHSTENS = 2 * 1024 * 1024;
const RELAIS_SPRUENGE = 10;

const RELAIS_KOPFZEILEN = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

function relaisAntwort(koerper) {
  return relaisOk({ headers: RELAIS_KOPFZEILEN, body: koerper });
}

/* Nur oeffentliche Adressen. Siehe Hinweis oben: hier wird der Name
   geprueft, nicht seine Aufloesung. */
function relaisErlaubt(adresse) {
  let u;
  try { u = new URL(adresse); } catch (e) { return "Das ist keine gültige Adresse."; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Nur http und https.";
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h === "[::1]") return "Kein Zugriff auf localhost.";
  if (/^(10|127|0)\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (/^192\.168\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (/^169\.254\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return "Kein Zugriff auf private Adressen.";
  if (h.endsWith(".internal") || h.endsWith(".local")) return "Kein Zugriff auf interne Namen.";
  if (h.indexOf(".") < 0) return "Der Name hat keinen Punkt — das ist kein öffentlicher Host.";
  return null;
}

function relaisMitZeitgrenze(versprechen, ms) {
  return Promise.race([
    versprechen,
    new Promise((_, ab) => setTimeout(() => ab(new Error("Zeitüberschreitung nach " + ms + " ms")), ms))
  ]);
}

async function relaisHolen(adresse, nurKopf) {
  const kette = [];
  let jetzt = adresse;
  let letzte = null;
  let ttfb = null;

  for (let i = 0; i <= RELAIS_SPRUENGE; i++) {
    const grund = relaisErlaubt(jetzt);
    if (grund) return { ok: false, fehler: grund, kette, angefragt: adresse };

    const beginn = Date.now();
    let antw;
    try {
      antw = await relaisMitZeitgrenze(relaisFetch(jetzt, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "seo-rank.me Abrufrelais (+https://seo-rank.me)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "de,en;q=0.8"
        }
      }), RELAIS_ZEITGRENZE);
    } catch (fehler) {
      return { ok: false, fehler: String(fehler.message || fehler), kette, angefragt: adresse };
    }

    if (ttfb === null) ttfb = Date.now() - beginn;
    letzte = antw;
    kette.push({ url: jetzt, status: antw.status });

    const ort = antw.headers.get("location");
    if (antw.status >= 300 && antw.status < 400 && ort) {
      let naechste;
      try { naechste = new URL(ort, jetzt).href; } catch (x) { break; }
      if (naechste === jetzt) break;
      if (i === RELAIS_SPRUENGE) {
        return { ok: false, fehler: "Mehr als " + RELAIS_SPRUENGE + " Weiterleitungen.", kette, angefragt: adresse };
      }
      jetzt = naechste;
      continue;
    }
    break;
  }

  const kopf = {};
  letzte.headers.forEach((wert, name) => { kopf[String(name).toLowerCase()] = wert; });
  const cookies = kopf["set-cookie"] ? [kopf["set-cookie"]] : [];

  let html = null;
  let bytes = 0;
  let abgeschnitten = false;
  if (!nurKopf) {
    let text;
    try { text = await relaisMitZeitgrenze(letzte.text(), RELAIS_ZEITGRENZE); }
    catch (fehler) { return { ok: false, fehler: String(fehler.message || fehler), kette, angefragt: adresse }; }
    bytes = text.length;
    if (bytes > RELAIS_HOECHSTENS) { abgeschnitten = true; text = text.slice(0, RELAIS_HOECHSTENS); }
    html = text;
  }

  return {
    ok: true,
    angefragt: adresse,
    ziel: kette.length ? kette[kette.length - 1].url : adresse,
    status: letzte.status,
    kette: kette,
    spruenge: kette.length - 1,
    kopf: kopf,
    cookies: cookies,
    html: html,
    bytes: bytes,
    abgeschnitten: abgeschnitten,
    ttfb: ttfb
  };
}

export function get_holen(anfrage) {
  const adresse = anfrage.query && anfrage.query.url;
  if (!adresse) return relaisAntwort({ ok: false, fehler: "Kein url-Parameter." });
  const grund = relaisErlaubt(adresse);
  if (grund) return relaisAntwort({ ok: false, fehler: grund });
  return relaisHolen(adresse, anfrage.query.nurkopf === "1")
    .then(relaisAntwort)
    .catch((e) => relaisAntwort({ ok: false, fehler: String(e.message || e) }));
}

export function options_holen() {
  return relaisOk({ headers: RELAIS_KOPFZEILEN, body: "" });
}

/* Selbstauskunft: was dieser Dienst tut und was nicht. */
export function get_relais(anfrage) {
  return relaisAntwort({
    dienst: "seo-rank.me Abrufrelais",
    zweck: "Holt eine oeffentliche Adresse und gibt Kopfzeilen, Weiterleitungskette und Quelltext zurueck. Urteilt nicht.",
    aufruf: "/_functions/holen?url=<adresse>[&nurkopf=1]",
    grenzen: { zeit: RELAIS_ZEITGRENZE + " ms", groesse: RELAIS_HOECHSTENS + " Zeichen", spruenge: RELAIS_SPRUENGE },
    hinweis: "Prueft den Hostnamen, nicht seine Aufloesung. Fuer einen eigenen Server die Node-Fassung cli/relais.mjs verwenden."
  });
}
