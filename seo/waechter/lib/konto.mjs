/* SEO Waechter · Konto.
   Anmeldung ohne Passwort: Anmeldelink per Mail, 15 Minuten gueltig, einmal
   nutzbar. Ist die Adresse neu, entsteht dabei das Konto. Gespeichert werden
   nur Hashes von Link und Sitzung, nie die Kennungen selbst. */

import crypto from "node:crypto";
import { aendern, holen, loeschen } from "./speicher.mjs";
import { mailSenden, mailBereit } from "./mailversand.mjs";
import { NutzerFehler } from "./schutz.mjs";

export const SITZUNG = "waechter_sitzung";
const LEER = { konten: {}, email: {}, links: {}, sitzungen: {} };
const hash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
export const neueId = () => crypto.randomBytes(9).toString("base64url");
const TAG = 86400e3;

export function emailLesen(e) {
  const email = String(e || "").trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(email)) throw new NutzerFehler("Bitte eine gültige E-Mail-Adresse eingeben.");
  return email;
}

export async function linkAnfordern(eingabe, basis) {
  const email = emailLesen(eingabe);
  const token = crypto.randomBytes(32).toString("base64url");
  await aendern("konten.json", LEER, (s) => {
    const jetzt = Date.now();
    for (const [k, v] of Object.entries(s.links)) if (v.bis < jetzt) delete s.links[k];
    const offen = Object.values(s.links).filter((v) => v.email === email).length;
    if (offen >= 5) throw new NutzerFehler("Es sind schon fünf Anmeldelinks unterwegs. Bitte den neuesten benutzen.", 429);
    s.links[hash(token)] = { email, bis: jetzt + 15 * 60e3 };
  });
  const link = basis + "/anmelden/bestaetigen?t=" + token;
  let versandt = false;
  if (mailBereit()) {
    await mailSenden({
      an: email,
      betreff: "Ihr Anmeldelink für den SEO Wächter",
      text: "Guten Tag,\n\nmit diesem Link melden Sie sich beim SEO Wächter an. Er gilt 15 Minuten und nur einmal:\n\n" +
        link + "\n\nWenn Sie keinen Link angefordert haben, können Sie diese Mail löschen.\n\nSEO Wächter · eine App von hnvr.me"
    });
    versandt = true;
  } else {
    console.log("[Anmeldelink] " + email + " " + link);
  }
  return { versandt, devLink: process.env.WAECHTER_DEV === "1" ? link : null };
}

export async function bestaetigen(token) {
  const sitzung = crypto.randomBytes(32).toString("base64url");
  const konto = await aendern("konten.json", LEER, (s) => {
    const eintrag = s.links[hash(token)];
    if (!eintrag) throw new NutzerFehler("Dieser Anmeldelink ist ungültig oder wurde schon benutzt.");
    delete s.links[hash(token)];
    if (eintrag.bis < Date.now()) throw new NutzerFehler("Dieser Anmeldelink ist abgelaufen. Bitte einen neuen anfordern.");
    let id = s.email[eintrag.email];
    if (!id) {
      id = neueId();
      s.email[eintrag.email] = id;
      s.konten[id] = {
        id, email: eintrag.email, angelegt: new Date().toISOString(),
        projekte: [], aktivesProjekt: null, alarmMail: eintrag.email
      };
    }
    for (const [k, v] of Object.entries(s.sitzungen)) if (v.bis < Date.now()) delete s.sitzungen[k];
    s.sitzungen[hash(sitzung)] = { konto: id, bis: Date.now() + 30 * TAG };
    return s.konten[id];
  });
  return { sitzung, konto };
}

export function cookieLesen(req) {
  const aus = {};
  for (const teil of String(req.headers.cookie || "").split(";")) {
    const i = teil.indexOf("=");
    if (i > 0) aus[teil.slice(0, i).trim()] = decodeURIComponent(teil.slice(i + 1).trim());
  }
  return aus;
}

export async function kontoAus(req) {
  const t = cookieLesen(req)[SITZUNG];
  if (!t) return null;
  const s = await holen("konten.json", LEER);
  const e = s.sitzungen[hash(t)];
  if (!e || e.bis < Date.now()) return null;
  return s.konten[e.konto] || null;
}

export async function abmelden(req) {
  const t = cookieLesen(req)[SITZUNG];
  if (!t) return;
  await aendern("konten.json", LEER, (s) => { delete s.sitzungen[hash(t)]; });
}

export async function kontoAendern(id, fn) {
  return aendern("konten.json", LEER, (s) => {
    const k = s.konten[id];
    if (!k) throw new NutzerFehler("Konto nicht gefunden.", 404);
    return fn(k, s);
  });
}

export async function alleKonten() {
  return Object.values((await holen("konten.json", LEER)).konten);
}

export async function kontoLoeschen(id) {
  await aendern("konten.json", LEER, (s) => {
    const k = s.konten[id];
    if (!k) return;
    delete s.email[k.email];
    delete s.konten[id];
    for (const [h, v] of Object.entries(s.sitzungen)) if (v.konto === id) delete s.sitzungen[h];
  });
  await loeschen("pruefungen/" + id + ".json");
}

export function sitzungsCookie(wert, sicher, maxAlter) {
  return SITZUNG + "=" + encodeURIComponent(wert) + "; Path=/; HttpOnly; SameSite=Lax" +
    (sicher ? "; Secure" : "") + "; Max-Age=" + (maxAlter == null ? 30 * 86400 : maxAlter);
}
