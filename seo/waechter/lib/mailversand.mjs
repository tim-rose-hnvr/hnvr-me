/* SEO Waechter · Mailversand ueber SMTP, ohne Fremdpaket.
   Umgebung: SMTP_HOST, SMTP_PORT (465 = TLS sofort, 587/25 = STARTTLS),
   SMTP_USER, SMTP_PASS, SMTP_ABSENDER. SMTP_SICHER=0 nur fuer den Selbsttest
   gegen einen lokalen Pruefserver (Klartext). Ohne SMTP_HOST wird nichts
   verschickt; Anmeldelinks und Alarme stehen dann im Serverprotokoll. */

import net from "node:net";
import tls from "node:tls";
import os from "node:os";

export function mailBereit() { return !!process.env.SMTP_HOST; }

function zeilenLeser(sock) {
  let puffer = "";
  const warter = [];
  const antworten = [];
  const verarbeiten = () => {
    for (;;) {
      const i = puffer.indexOf("\r\n");
      if (i < 0) return;
      const zeile = puffer.slice(0, i); puffer = puffer.slice(i + 2);
      antworten.push(zeile);
      if (/^\d{3} /.test(zeile)) {
        const block = antworten.splice(0);
        const w = warter.shift();
        if (w) w(block);
      }
    }
  };
  const an = (d) => { puffer += d.toString("utf8"); verarbeiten(); };
  sock.on("data", an);
  return {
    naechste: () => new Promise((ok) => warter.push(ok)),
    ab: () => sock.off("data", an)
  };
}

function b64(s) { return Buffer.from(s, "utf8").toString("base64"); }
function kopfWort(s) { return /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + b64(s) + "?="; }

export async function mailSenden({ an, betreff, text }) {
  if (!mailBereit()) throw new Error("SMTP ist nicht eingerichtet.");
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const sicher = process.env.SMTP_SICHER !== "0";
  const absender = process.env.SMTP_ABSENDER || process.env.SMTP_USER;
  const zeit = Number(process.env.SMTP_ZEITLIMIT || 20000);

  let sock = await new Promise((ok, fehl) => {
    const s = (sicher && port === 465)
      ? tls.connect({ host, port, servername: host }, () => ok(s))
      : net.connect({ host, port }, () => ok(s));
    s.once("error", fehl);
    s.setTimeout(zeit, () => { s.destroy(new Error("SMTP antwortet nicht.")); });
  });
  let leser = zeilenLeser(sock);
  const erwarte = async (code) => {
    const block = await leser.naechste();
    const letzte = block[block.length - 1];
    if (!letzte.startsWith(String(code))) throw new Error("SMTP: " + letzte);
    return block;
  };
  const sende = (z) => sock.write(z + "\r\n");

  try {
    await erwarte(220);
    sende("EHLO " + (os.hostname() || "waechter"));
    let ehlo = await erwarte(250);
    if (sicher && port !== 465 && ehlo.some((z) => /STARTTLS/i.test(z))) {
      sende("STARTTLS"); await erwarte(220);
      leser.ab();
      sock = await new Promise((ok, fehl) => {
        const s = tls.connect({ socket: sock, servername: host }, () => ok(s));
        s.once("error", fehl);
      });
      leser = zeilenLeser(sock);
      sende("EHLO " + (os.hostname() || "waechter"));
      ehlo = await erwarte(250);
    }
    if (process.env.SMTP_USER) {
      sende("AUTH LOGIN"); await erwarte(334);
      sende(b64(process.env.SMTP_USER)); await erwarte(334);
      sende(b64(process.env.SMTP_PASS || "")); await erwarte(235);
    }
    sende("MAIL FROM:<" + absender.replace(/.*<|>.*/g, "") + ">"); await erwarte(250);
    sende("RCPT TO:<" + an + ">"); await erwarte(250);
    sende("DATA"); await erwarte(354);
    const nachricht = [
      "From: " + kopfWort("SEO Wächter") + " <" + absender.replace(/.*<|>.*/g, "") + ">",
      "To: <" + an + ">",
      "Subject: " + kopfWort(betreff),
      "Date: " + new Date().toUTCString(),
      "Message-ID: <" + Date.now() + "." + Math.random().toString(36).slice(2) + "@seo-waechter>",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      b64(text).replace(/.{76}/g, "$&\r\n"),
      "."
    ].join("\r\n");
    sock.write(nachricht + "\r\n");
    await erwarte(250);
    sende("QUIT");
  } finally {
    setTimeout(() => sock.destroy(), 200);
  }
  return true;
}
