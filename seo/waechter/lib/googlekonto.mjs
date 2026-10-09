/* SEO Waechter · Google-Verbindung je Konto: Token verschluesselt ablegen,
   bei Ablauf erneuern, Properties der Search Console merken. */

import { kontoAendern } from "./konto.mjs";
import { verschluesseln, entschluesseln } from "./tresor.mjs";
import { codeEinloesen, erneuern, properties } from "./module/google.mjs";

export async function verbinden(kontoId, code, rueckruf) {
  const t = await codeEinloesen(code, rueckruf);
  const liste = await properties(t.access_token);
  await kontoAendern(kontoId, (k) => {
    const alt = k.google || {};
    k.google = {
      verbunden: new Date().toISOString(),
      zugang: verschluesseln(t.access_token),
      bis: Date.now() + (Number(t.expires_in) || 3600) * 1000,
      erneuerung: t.refresh_token ? verschluesseln(t.refresh_token) : alt.erneuerung || null,
      properties: liste
    };
  });
  return liste;
}

export async function trennen(kontoId) {
  await kontoAendern(kontoId, (k) => { delete k.google; });
}

export async function zugang(konto) {
  const g = konto.google;
  if (!g) return null;
  if (g.bis > Date.now() + 60000) return entschluesseln(g.zugang);
  if (!g.erneuerung) throw new Error("Google-Verbindung abgelaufen. Bitte unter Einstellungen neu verbinden.");
  const t = await erneuern(entschluesseln(g.erneuerung));
  await kontoAendern(konto.id, (k) => {
    if (!k.google) return;
    k.google.zugang = verschluesseln(t.access_token);
    k.google.bis = Date.now() + (Number(t.expires_in) || 3600) * 1000;
  });
  return t.access_token;
}

export function oeffentlich(konto) {
  return konto.google ? { verbunden: konto.google.verbunden, properties: konto.google.properties || [] } : null;
}
