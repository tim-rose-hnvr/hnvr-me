/* SEO Waechter · gespeicherte Pruefungen je Konto, Verlauf, Hinweise. */

import { aendern, holen } from "./speicher.mjs";
import { neueId } from "./konto.mjs";
import { NutzerFehler } from "./schutz.mjs";

const LEER = { pruefungen: [], hinweise: [] };
const datei = (konto) => "pruefungen/" + konto + ".json";

/* Standardtakt der Ueberwachung in Minuten je Modul. */
export const TAKT = { gesamt: 10080, uptime: 5, domain: 1440, mail: 1440, ki: 1440, audit: 10080, content: 10080, konkurrenz: 10080, rankings: 1440, backlinks: 10080 };
export const NAMEN = { gesamt: "Gesamtcheck", audit: "Website-Audit", rankings: "Rankings", ki: "KI-Sichtbarkeit", backlinks: "Backlinks", konkurrenz: "Konkurrenz", content: "Content", uptime: "Uptime", domain: "Domain-Check", mail: "Mail-Prüfer" };

/* Mails werden nie gespeichert: aus der Eingabe faellt der Rohtext heraus. */
export function eingabeBereinigen(modul, e) {
  const x = { ...(e || {}) };
  if (modul === "mail") delete x.roh;
  return x;
}
function ergebnisKuerzen(r) {
  const x = { ...(r || {}) };
  if (Array.isArray(x.seitenListe) && x.seitenListe.length > 2000) x.seitenListe = x.seitenListe.slice(0, 2000);
  if (x.modul === "mail" && x.art === "nachricht") { x.links = (x.links || []).slice(0, 10); }
  return x;
}
export function zusammenfassung(p) {
  const { ergebnis, ...rest } = p;
  return { ...rest, kurz: ergebnis?.kurz || "", punkte: ergebnis?.punkte ?? null, risiko: ergebnis?.risiko ?? null,
    erreichbar: ergebnis?.erreichbar ?? null, verfuegbar: ergebnis?.verfuegbar ?? null };
}

export async function liste(konto) { return (await holen(datei(konto), LEER)).pruefungen; }
export async function stand(konto) { return holen(datei(konto), LEER); }

export async function anlegen(konto, { modul, eingabe, ergebnis, herkunft, projektId, zeit }) {
  if (!NAMEN[modul]) throw new NutzerFehler("Unbekanntes Werkzeug.");
  if (!ergebnis || typeof ergebnis !== "object") throw new NutzerFehler("Kein Ergebnis.");
  const json = JSON.stringify(ergebnis);
  if (json.length > 5e6) throw new NutzerFehler("Ergebnis zu groß.");
  return aendern(datei(konto), LEER, (s) => {
    if (s.pruefungen.length >= 2000) throw new NutzerFehler("Mehr als 2.000 gespeicherte Prüfungen. Bitte alte löschen.");
    const p = {
      id: neueId(), modul, ziel: String(ergebnis.ziel || "").slice(0, 300),
      eingabe: eingabeBereinigen(modul, eingabe), herkunft: herkunft || "von Hand", projektId: projektId || null,
      angelegt: zeit || new Date().toISOString(), geprueft: zeit || new Date().toISOString(),
      ueberwacht: { an: false, takt: TAKT[modul] || 1440, naechste: null, fehlversuche: 0 },
      verlauf: [{ zeit: zeit || new Date().toISOString(), punkte: ergebnis.punkte ?? null, kurz: ergebnis.kurz || "", wert: kennwert(ergebnis) }],
      ergebnis: ergebnisKuerzen(ergebnis)
    };
    s.pruefungen.unshift(p);
    return p;
  });
}

export function kennwert(r) {
  if (!r) return null;
  if (r.modul === "uptime") return r.erreichbar ? r.gesamt : -1;
  if (r.modul === "mail" && r.art === "nachricht") return r.risiko;
  return r.punkte ?? null;
}

/* Dieselbe Pruefung (Werkzeug, Ziel, Umfang, Projekt) schreibt den Verlauf
   fort, statt einen neuen Eintrag anzulegen. Einzelne Mails nie. */
const zielNorm = (z) => String(z || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
export async function gleiche(konto, modul, ergebnis, eingabe, projektId) {
  if (modul === "mail" && ergebnis?.art !== "domain") return null;
  const l = await liste(konto);
  return l.find((p) => p.modul === modul && (p.projektId || null) === (projektId || null) &&
    zielNorm(p.ziel) === zielNorm(ergebnis?.ziel) && (p.eingabe?.umfang || "seite") === (eingabe?.umfang || "seite") &&
    (modul !== "mail" || p.eingabe?.art === eingabe?.art)) || null;
}

export async function holenEine(konto, id) {
  const p = (await liste(konto)).find((x) => x.id === id);
  if (!p) throw new NutzerFehler("Prüfung nicht gefunden.", 404);
  return p;
}

export async function aendernEine(konto, id, fn) {
  return aendern(datei(konto), LEER, (s) => {
    const p = s.pruefungen.find((x) => x.id === id);
    if (!p) throw new NutzerFehler("Prüfung nicht gefunden.", 404);
    return fn(p, s);
  });
}

export async function loeschenEine(konto, id) {
  return aendern(datei(konto), LEER, (s) => { s.pruefungen = s.pruefungen.filter((x) => x.id !== id); });
}

export async function hinweisAnlegen(konto, h) {
  return aendern(datei(konto), LEER, (s) => {
    s.hinweise.unshift({ id: neueId(), zeit: new Date().toISOString(), gelesen: false, ...h });
    s.hinweise = s.hinweise.slice(0, 200);
  });
}

export async function hinweiseGelesen(konto) {
  return aendern(datei(konto), LEER, (s) => { for (const h of s.hinweise) h.gelesen = true; });
}

/* Nach einem neuen Lauf: Ergebnis ersetzen, Verlauf fortschreiben, Aenderung melden. */
export async function neuerLauf(konto, id, ergebnis) {
  return aendernEine(konto, id, (p) => {
    const alt = p.ergebnis;
    const jetzt = new Date().toISOString();
    p.ergebnis = ergebnisKuerzen(ergebnis);
    p.geprueft = jetzt;
    p.verlauf.push({ zeit: jetzt, punkte: ergebnis.punkte ?? null, kurz: ergebnis.kurz || "", wert: kennwert(ergebnis) });
    if (p.verlauf.length > 500) p.verlauf = p.verlauf.slice(-500);
    return { alt, neu: ergebnis, pruefung: p };
  });
}

export function csv(liste) {
  const z = [["Werkzeug", "Ziel", "Ergebnis", "Punkte", "Geprüft", "Herkunft", "Überwacht"]];
  for (const p of liste) z.push([NAMEN[p.modul] || p.modul, p.ziel, p.ergebnis?.kurz || "", p.ergebnis?.punkte ?? "", p.geprueft, p.herkunft, p.ueberwacht?.an ? "ja" : "nein"]);
  return "﻿" + z.map((r) => r.map((v) => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(";")).join("\r\n");
}
