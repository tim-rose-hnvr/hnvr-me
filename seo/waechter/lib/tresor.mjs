/* SEO Waechter · Verschluesselung fuer Zugangsdaten Dritter (Google-Token).
   AES-256-GCM. Schluessel aus WAECHTER_GEHEIMNIS oder, falls nicht gesetzt,
   aus einer beim ersten Start erzeugten Datei daten/geheimnis.key. */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATEN } from "./speicher.mjs";

let k = null;
function schluessel() {
  if (k) return k;
  if (process.env.WAECHTER_GEHEIMNIS) return (k = crypto.createHash("sha256").update(process.env.WAECHTER_GEHEIMNIS).digest());
  const datei = path.join(DATEN, "geheimnis.key");
  try { k = Buffer.from(fs.readFileSync(datei, "utf8").trim(), "base64"); }
  catch (e) {
    fs.mkdirSync(DATEN, { recursive: true });
    k = crypto.randomBytes(32);
    fs.writeFileSync(datei, k.toString("base64"), { mode: 0o600 });
  }
  return k;
}
export function verschluesseln(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", schluessel(), iv);
  const daten = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), daten]).toString("base64");
}
export function entschluesseln(b64) {
  const b = Buffer.from(String(b64), "base64");
  const d = crypto.createDecipheriv("aes-256-gcm", schluessel(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
