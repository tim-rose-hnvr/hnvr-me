/* SEO Waechter · Ueberwachung. Prueft ueberwachte Pruefungen im eingestellten
   Takt erneut, schreibt den Verlauf fort und meldet Aenderungen: als Hinweis
   im Konto und, wenn SMTP eingerichtet ist, per Mail an die Alarmadresse.
   Uptime meldet erst nach zwei Fehlversuchen in Folge. */

import { alleKonten } from "./konto.mjs";
import { stand, neuerLauf, aendernEine, hinweisAnlegen, NAMEN } from "./pruefungen.mjs";
import { ausfuehren } from "./ausfuehren.mjs";
import { mailBereit, mailSenden } from "./mailversand.mjs";

let laeuft = false;
let zeitgeber = null;

function vergleichen(modul, alt, neu, p) {
  const meld = [];
  if (modul === "uptime") {
    if (neu.erreichbar === false && p.ueberwacht.fehlversuche >= 2 && p.ueberwacht.gemeldet !== "aus") meld.push({ stufe: "kritisch", text: "Nicht erreichbar: " + (neu.fehler || "Status " + neu.status), zustand: "aus" });
    if (neu.erreichbar && p.ueberwacht.gemeldet === "aus") meld.push({ stufe: "ok", text: "Wieder erreichbar (" + neu.gesamt + " ms)", zustand: "an" });
    if (neu.zertifikat && neu.zertifikat.tage <= 14 && !(alt?.zertifikat && alt.zertifikat.tage <= 14)) meld.push({ stufe: "wichtig", text: "Zertifikat läuft in " + neu.zertifikat.tage + " Tagen ab" });
    return meld;
  }
  if (typeof alt?.punkte === "number" && typeof neu.punkte === "number" && neu.punkte <= alt.punkte - 5) meld.push({ stufe: "wichtig", text: "Punktzahl von " + alt.punkte + " auf " + neu.punkte + " gefallen" });
  const krit = (r) => (r?.befunde || []).filter((b) => b.stufe === "kritisch").map((b) => b.id || b.name);
  const neuKrit = krit(neu).filter((x) => !krit(alt).includes(x));
  if (neuKrit.length) meld.push({ stufe: "kritisch", text: neuKrit.length + " neue kritische Befunde: " + (neu.befunde || []).filter((b) => neuKrit.includes(b.id || b.name)).map((b) => b.name).slice(0, 3).join(", ") });
  if (modul === "domain" && neu.fristen) {
    for (const [k, n] of [["zertifikatTage", "Zertifikat"], ["domainTage", "Domain"]]) {
      const t = neu.fristen[k], v = alt?.fristen?.[k];
      if (typeof t === "number" && [30, 7].some((g) => t <= g && !(typeof v === "number" && v <= g))) meld.push({ stufe: "wichtig", text: n + " läuft in " + t + " Tagen ab" });
    }
  }
  return meld;
}

async function einePruefung(konto, p) {
  let neu;
  try { neu = await ausfuehren(p.modul, p.eingabe, { konto }); }
  catch (e) { neu = p.modul === "uptime" ? { modul: "uptime", ziel: p.ziel, erreichbar: false, fehler: e.message, kurz: "nicht erreichbar · " + e.message } : null; if (!neu) { await aendernEine(konto.id, p.id, (x) => { x.ueberwacht.naechste = Date.now() + x.ueberwacht.takt * 60e3; x.ueberwacht.letzterFehler = e.message; }); return; } }
  const { alt, pruefung } = await neuerLauf(konto.id, p.id, neu);
  const meldungen = await aendernEine(konto.id, p.id, (x) => {
    x.ueberwacht.naechste = Date.now() + x.ueberwacht.takt * 60e3;
    x.ueberwacht.fehlversuche = neu.erreichbar === false ? (x.ueberwacht.fehlversuche || 0) + 1 : 0;
    const m = vergleichen(p.modul, alt, neu, x);
    for (const e of m) if (e.zustand) x.ueberwacht.gemeldet = e.zustand;
    return m;
  });
  for (const m of meldungen) {
    const text = (NAMEN[p.modul] || p.modul) + " · " + p.ziel + ": " + m.text;
    await hinweisAnlegen(konto.id, { stufe: m.stufe, text, pruefungId: p.id });
    if (mailBereit() && konto.alarmMail && m.stufe !== "hinweis") {
      try { await mailSenden({ an: konto.alarmMail, betreff: "SEO Wächter: " + m.text, text: text + "\n\nDetails: im Dashboard unter Gespeichert.\n\nSEO Wächter · eine App von hnvr.me" }); }
      catch (e) { console.error("[Alarm-Mail]", e.message); }
    } else if (!mailBereit()) console.log("[Alarm] " + konto.email + " " + text);
  }
}

export async function runde() {
  if (laeuft) return 0;
  laeuft = true;
  let n = 0;
  try {
    for (const konto of await alleKonten()) {
      const s = await stand(konto.id);
      const faellig = s.pruefungen.filter((p) => p.ueberwacht?.an && (!p.ueberwacht.naechste || p.ueberwacht.naechste <= Date.now()));
      for (const p of faellig) { await einePruefung(konto, p); n++; }
    }
  } catch (e) { console.error("[Überwachung]", e); }
  finally { laeuft = false; }
  return n;
}

export function starten(takt = 30000) {
  if (zeitgeber) return;
  zeitgeber = setInterval(runde, takt);
  zeitgeber.unref?.();
}
