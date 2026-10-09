/* Modul Content: tragende Stellen fuer ein Keyword, Dichte, Lesbarkeit,
   Snippet in Pixeln (Arial-Breitentabelle des Pruefwerks) und WDF·IDF gegen
   Vergleichsseiten. Vergleichsseiten gibt man selbst an; mit eingerichteter
   Suchdaten-Anbindung werden die zehn besten Treffer automatisch geholt. */

import { parseHTML } from "../../../cli/dom.mjs";
import { messenLaden, KENNUNG } from "../werk.mjs";
import { adresseLesen, NutzerFehler } from "../schutz.mjs";
import { dfsBereit, serp } from "./extern.mjs";
import { seiteHolen, istHtml } from "../abruf.mjs";

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zäöüß0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
const schutz = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function trifft(text, kw) {
  const t = " " + norm(text) + " ";
  return norm(kw).split(" ").filter(Boolean).every((w) => new RegExp("\\s" + schutz(w.length > 5 ? w.slice(0, w.length - 2) : w)).test(t));
}

async function holen(url) {
  const s = await seiteHolen(url);
  if (!istHtml(s)) throw new NutzerFehler("Unter " + url + " liegt keine HTML-Seite, sondern " + (s.typ.split(";")[0] || "eine Datei") + ".");
  return { url: s.url, status: s.status, roh: s.text, d: parseHTML(s.text) };
}

function woerterVon(text, M) {
  return M.wortfeld(text, 1).reduce((m, e) => { m[e.wort || e[0]] = e.anzahl || e[1]; return m; }, {});
}

function zaehlen(text) {
  const f = {};
  const STOPP = /^(und|oder|der|die|das|den|dem|des|ein|eine|einen|einem|einer|für|mit|von|bei|auf|aus|ist|sind|wir|sie|ihr|ihre|ihren|unsere|unser|nicht|auch|wie|was|wer|dass|sich|noch|nur|zum|zur|im|in|an|am|es|zu|so|als|bis|nach|über|unter|vor|kann|können|wird|werden|hat|haben|sein|this|the|and|for|with|you|your)$/;
  for (const w of norm(text).split(" ")) if (w.length > 2 && !/^\d+$/.test(w) && !STOPP.test(w)) f[w] = (f[w] || 0) + 1;
  return f;
}

function wdfidf(eigen, vergleich) {
  const docs = [eigen, ...vergleich];
  const N = docs.length;
  const df = {};
  for (const d of docs) for (const w of Object.keys(d.f)) df[w] = (df[w] || 0) + 1;
  const wert = (d, w) => {
    const f = d.f[w] || 0;
    if (!f) return 0;
    return (Math.log2(f + 1) / Math.log2(d.L + 1)) * Math.log10(1 + N / df[w]);
  };
  const kandidaten = Object.keys(df).filter((w) => vergleich.filter((d) => d.f[w]).length >= Math.max(2, Math.ceil(vergleich.length * 0.4)));
  return kandidaten.map((w) => {
    const mittel = vergleich.reduce((a, d) => a + wert(d, w), 0) / vergleich.length;
    const own = wert(eigen, w);
    const status = own === 0 ? "fehlt" : own < mittel * 0.5 ? "zu selten" : own > mittel * 2.2 ? "zu oft" : "passt";
    return { wort: w, eigen: +own.toFixed(4), mittel: +mittel.toFixed(4), seiten: vergleich.filter((d) => d.f[w]).length, status };
  }).sort((a, b) => b.mittel - a.mittel).slice(0, 25);
}

export async function pruefen(eingabe) {
  const M = messenLaden();
  const kw = String(eingabe.keyword || "").trim();
  if (!kw) throw new NutzerFehler("Bitte ein Keyword angeben.");
  let d, url = null, roh = "";
  if (eingabe.text && !eingabe.url) {
    roh = "<html><body>" + String(eingabe.text).replace(/</g, "&lt;").split(/\n{2,}/).map((p) => "<p>" + p + "</p>").join("") + "</body></html>";
    d = parseHTML(roh);
  } else {
    url = adresseLesen(eingabe.url);
    const s = await holen(url);
    url = s.url; d = s.d; roh = s.roh;
  }
  const q = (sel) => [...d.querySelectorAll(sel)];
  const text = M.sichtbarerText(d);
  const woerter = text.split(/\s+/).filter(Boolean);
  const titel = (d.querySelector("title")?.textContent || "").trim();
  const beschreibung = (d.querySelector('meta[name="description" i]')?.getAttribute("content") || "").trim();
  const stellen = [
    ["Seitentitel", titel], ["Beschreibung", beschreibung],
    ["Hauptüberschrift (H1)", q("h1").map((h) => h.textContent).join(" ")],
    ["Adresse", url ? decodeURIComponent(new URL(url).pathname).replace(/[-_/.]/g, " ") : ""],
    ["Erste 100 Wörter", woerter.slice(0, 100).join(" ")],
    ["Zwischenüberschriften", q("h2, h3").map((h) => h.textContent).join(" ")],
    ["Bild-Alternativtexte", q("img[alt]").map((i) => i.getAttribute("alt")).join(" ")],
    ["Hervorhebungen", q("strong, b").map((x) => x.textContent).join(" ")]
  ].map(([stelle, t]) => ({ stelle, vorhanden: !!String(t).trim(), getroffen: !!String(t).trim() && trifft(t, kw) }));
  const nk = norm(kw);
  const vorkommen = (" " + norm(text) + " ").split(" " + nk + " ").length - 1;
  const dichte = woerter.length ? +(vorkommen * nk.split(" ").length / woerter.length * 100).toFixed(2) : 0;
  const lesbarkeit = M.lesbarkeit(text);
  const snippet = {
    titel, beschreibung, url,
    titelPx: M.px(titel, "20px Arial"), titelMax: M.GRENZE_TITEL,
    beschreibungPx: M.px(beschreibung, "14px Arial"), beschreibungMax: M.GRENZE_TEXT
  };

  let vergleichUrls = (eingabe.vergleich || []).map((x) => String(x).trim()).filter(Boolean).slice(0, 10);
  let quelleVergleich = "selbst angegeben";
  if (!vergleichUrls.length && dfsBereit() && eingabe.top10 !== false) {
    try {
      const s = await serp(kw, {});
      vergleichUrls = s.organisch.filter((o) => !url || new URL(o.url).hostname !== new URL(url).hostname).slice(0, 10).map((o) => o.url);
      quelleVergleich = "die zehn besten Treffer bei Google";
    } catch (e) { quelleVergleich = "Suchdaten nicht erreichbar: " + e.message; }
  }
  let begriffe = null;
  const vergleichGeholt = [];
  if (vergleichUrls.length) {
    const docs = [];
    await Promise.all(vergleichUrls.map(async (v) => {
      try {
        const s = await holen(adresseLesen(v));
        const t = M.sichtbarerText(s.d);
        const f = zaehlen(t);
        docs.push({ f, L: t.split(/\s+/).length });
        vergleichGeholt.push({ url: s.url, woerter: t.split(/\s+/).filter(Boolean).length, ok: true });
      } catch (e) { vergleichGeholt.push({ url: v, ok: false, fehler: e.message }); }
    }));
    if (docs.length >= 2) begriffe = wdfidf({ f: zaehlen(text), L: woerter.length }, docs);
  }

  const befunde = [];
  const b = (stufe, name, wie) => befunde.push({ stufe, name, wie });
  const st = Object.fromEntries(stellen.map((s) => [s.stelle, s]));
  if (!st["Seitentitel"].getroffen) b("wichtig", "Keyword fehlt im Seitentitel", "Der Titel ist die wichtigste Stelle für die Zuordnung.");
  if (url && !st["Hauptüberschrift (H1)"].getroffen) b("wichtig", "Keyword fehlt in der H1", "Die Hauptüberschrift sagt, worum es geht.");
  if (!st["Erste 100 Wörter"].getroffen) b("hinweis", "Keyword fehlt am Textanfang", "In den ersten 100 Wörtern kommt das Keyword nicht vor.");
  if (url && !beschreibung) b("wichtig", "Keine Beschreibung", "Ohne meta description wählt die Suchmaschine selbst einen Ausschnitt.");
  if (snippet.titelPx > M.GRENZE_TITEL) b("hinweis", "Titel wird gekürzt", snippet.titelPx + " von " + M.GRENZE_TITEL + " Pixeln.");
  if (snippet.beschreibungPx > M.GRENZE_TEXT) b("hinweis", "Beschreibung wird gekürzt", snippet.beschreibungPx + " von " + M.GRENZE_TEXT + " Pixeln.");
  if (url && woerter.length < 30) b("wichtig", "Kaum Text im HTML", "Nur " + woerter.length + " Wörter. Vermutlich kommt der Inhalt per JavaScript; dann sehen Suchmaschinen ihn verzögert und die Auswertung hier ist nicht aussagekräftig.");
  else if (woerter.length < 300) b("hinweis", "Wenig Text", woerter.length + " Wörter. Für ein umkämpftes Keyword ist das meist zu wenig.");
  if (dichte > 4) b("hinweis", "Keyword sehr häufig", "Dichte " + dichte + " %. Das liest sich wie Wiederholung.");
  if (begriffe) { const f = begriffe.filter((x) => x.status === "fehlt").length; if (f) b("wichtig", f + " Begriffe der Vergleichsseiten fehlen", "Siehe Begriffsliste."); }
  const getroffen = stellen.filter((s) => s.getroffen).length;
  return {
    modul: "content", ziel: url || "eingefügter Text", keyword: kw,
    woerter: woerter.length, vorkommen, dichte, lesbarkeit, stellen, snippet,
    begriffe, vergleich: { quelle: vergleichUrls.length ? quelleVergleich : null, seiten: vergleichGeholt },
    gliederung: q("h1, h2, h3").slice(0, 40).map((h) => ({ ebene: Number(h.localName[1]), text: h.textContent.trim().slice(0, 120) })),
    befunde, punkte: Math.round(getroffen / stellen.length * 100),
    kurz: getroffen + " von " + stellen.length + " Stellen · " + woerter.length + " Wörter" + (begriffe ? " · " + begriffe.filter((x) => x.status === "fehlt").length + " Begriffe fehlen" : "")
  };
}
