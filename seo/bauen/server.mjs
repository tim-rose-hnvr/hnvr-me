/* seo-rank.me — kleiner Server fuer die Vorschau und zum Testen des Crawlers.
   Liefert den Ordner site/ aus. Gehoert nicht zur Auslieferung: die Website
   selbst braucht keinen Server, sie laeuft aus dem Dateisystem.

   Aufruf:  node bauen/server.mjs [port] */

import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const hier = path.dirname(fileURLToPath(import.meta.url));
const ORDNER = path.resolve(hier, "..", "site");
const PORT = parseInt(process.argv[2], 10) || 8099;

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer((anfrage, antwort) => {
  let pfad;
  try {
    pfad = decodeURIComponent(new URL(anfrage.url, "http://localhost").pathname);
  } catch {
    antwort.writeHead(400).end("Unbrauchbare Adresse");
    return;
  }

  if (pfad.endsWith("/")) pfad += "index.html";

  const ziel = path.join(ORDNER, pfad);
  if (!ziel.startsWith(ORDNER)) {
    antwort.writeHead(403).end("Ausserhalb des Ordners");
    return;
  }

  fs.readFile(ziel, (fehler, inhalt) => {
    if (fehler) {
      antwort.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      antwort.end("<!doctype html><html lang=de><head><meta charset=utf-8><title>404</title></head><body><h1>Nicht gefunden</h1></body></html>");
      return;
    }
    const typ = TYPEN[path.extname(ziel).toLowerCase()] || "application/octet-stream";
    const kopf = { "content-type": typ, "cache-control": "no-store" };

    /* Die Auslieferung komprimiert (Wix schickt brotli: das Stilblatt geht
       von 120 auf 24 KB). Ohne das hier misst man Dateien gegeneinander,
       die es so nie gibt — eine Messreihe zum Vorabladen kam genau deshalb
       zum falschen Schluss. Schon komprimierte Formate (woff2, png) bleiben
       unangetastet. */
    const komprimierbar = /^(text\/|application\/(json|xml|javascript))/.test(typ);
    const erlaubt = String(anfrage.headers["accept-encoding"] || "");
    if (komprimierbar && /\bbr\b/.test(erlaubt)) {
      kopf["content-encoding"] = "br";
      antwort.writeHead(200, kopf);
      antwort.end(zlib.brotliCompressSync(inhalt));
      return;
    }
    if (komprimierbar && /\bgzip\b/.test(erlaubt)) {
      kopf["content-encoding"] = "gzip";
      antwort.writeHead(200, kopf);
      antwort.end(zlib.gzipSync(inhalt));
      return;
    }
    antwort.writeHead(200, kopf);
    antwort.end(inhalt);
  });
});

server.listen(PORT, () => {
  console.log("seo-rank.me-Vorschau auf http://localhost:" + PORT + "/  (Ordner " + ORDNER + ")");
});
