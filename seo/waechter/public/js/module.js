/* SEO Waechter · die neun Werkzeuge: Formular und Ergebnisansicht.
   Dieselben Bausteine laufen auf den oeffentlichen Werkzeugseiten und im Konto. */
"use strict";

/* ---------- Bausteine ---------- */
let feldNr = 0;
function feld(name, beschriftung, opt = {}) {
  const id = "f-" + name + "-" + (++feldNr);
  const el = h(opt.mehrzeilig ? "textarea.textfeld" : "input.feld", { id, name, placeholder: opt.ph || "", type: opt.mehrzeilig ? null : (opt.typ || "text"), autocomplete: "off", spellcheck: "false", inputmode: opt.inputmode || null, min: opt.min || null, max: opt.max || null });
  if (opt.wert != null) el.value = opt.wert;
  if (opt.zeilen) el.rows = opt.zeilen;
  return { wrap: h("div.feldgruppe" + (opt.schmal ? ".schmal" : ""), h("label.beschriftung", { for: id, text: beschriftung }), el), el };
}
function umschalter(optionen, wert, beiWechsel, name) {
  const u = h("div.umschalter.glas", { role: "group", "aria-label": name || "Auswahl" });
  let akt = wert;
  for (const [k, t] of optionen) {
    const b = h("button", { type: "button", "aria-pressed": String(k === wert), text: t });
    b.addEventListener("click", () => { akt = k; for (const x of u.children) x.setAttribute("aria-pressed", String(x === b)); if (beiWechsel) beiWechsel(k); });
    u.appendChild(b);
  }
  u.wert = () => akt;
  return u;
}
function karte(titel, unter, icon, ...inhalt) {
  return h("section.karte", (titel || icon) ? h("div.karte-kopf", icon ? h("span.symbolfeld", ic(icon, 16)) : null, h("div.wachsen", titel ? h("h2", { text: titel }) : null, unter ? h("div.unter", { text: unter }) : null)) : null, ...inhalt);
}
function kv(paare) {
  return h("div.zeilen", paare.filter(Boolean).map(([k, v]) => h("div.z", h("span.wachsen.schluessel", { text: k }), v instanceof Node ? v : h("span.wert", { text: v == null || v === "" ? "–" : String(v) }))));
}
function tabelle(spalten, zeilen) {
  return h("div.tabelle-wrap", h("table.tabelle", h("thead", h("tr", spalten.map((s) => h("th" + (s.zahl ? ".zahl" : ""), { text: s.t || s, scope: "col" })))),
    h("tbody", zeilen.map((z) => h("tr", z.map((c, i) => h("td" + (spalten[i].zahl ? ".zahl" : "") + (spalten[i].umbruch ? ".umbruch" : ""), c instanceof Node || Array.isArray(c) ? c : document.createTextNode(c == null ? "–" : String(c)))))))));
}
function befundListe(befunde) {
  if (!befunde || !befunde.length) return h("p.leer", { text: "Keine Befunde. Alles in Ordnung." });
  return h("div", befunde.map((b) => {
    const d = h("details.befund");
    const unter = [b.seiten > 1 ? b.seiten + " Seiten" : null, b.gruppe].filter(Boolean).join(" · ");
    d.appendChild(h("summary", pille(STUFE_NAME[b.stufe] || b.stufe, STUFE[b.stufe] || ""), h("span.wachsen", b.name, unter ? h("small", { text: unter }) : null), ic("chevD", 16)));
    const i = h("div.inhalt");
    if (b.wie) i.appendChild(h("p", mitCode(b.wie)));
    if (b.fund) i.appendChild(h("pre", { text: String(b.fund) }));
    if (b.beispiele && b.beispiele.length > 1) i.appendChild(h("p.leise.klein", { text: "Zum Beispiel: " + b.beispiele.slice(0, 4).join(", ") }));
    if (b.beheben) i.appendChild(h("div.beheben", h("strong", { text: "So beheben: " }), mitCode(b.beheben)));
    d.appendChild(i);
    return d;
  }));
}
function befundKarte(befunde, titel) {
  const liste = befunde || [];
  const ziel = h("div");
  const zeigen = (st) => { leeren(ziel).appendChild(befundListe(st === "alle" ? liste : liste.filter((b) => b.stufe === st))); };
  const z = (st) => liste.filter((b) => b.stufe === st).length;
  const u = umschalter([["alle", "Alle " + liste.length], ["kritisch", "kritisch " + z("kritisch")], ["wichtig", "wichtig " + z("wichtig")], ["hinweis", "Hinweise " + z("hinweis")]], "alle", zeigen, "Befunde filtern");
  u.classList.add("nicht-drucken");
  zeigen("alle");
  const k = karte(titel || "Befunde", "sortiert nach Stufe und Wirkung", "alert", ziel);
  if (liste.length) k.querySelector(".karte-kopf").appendChild(u);
  return k;
}
function gruppenBalken(gruppen) {
  return kv((gruppen || []).map((g) => [g.name, h("span.knopfreihe", balken(g.wert, FARBE[tonFuerWert(g.wert)], 110), h("b", { text: String(g.wert) }))]));
}
function fehltKarte(r) {
  return karte("Datenquelle nicht eingerichtet", null, "info",
    h("div.hinweisfeld.info", ic("info", 18), h("div", h("p", { text: r.warum || "" }), h("p.klein", { text: "Benötigt: " + r.fehlt }))),
    h("p.leise.klein", { text: "Der Wächter zeigt hier keine geschätzten oder erfundenen Werte. Sobald die Zugangsdaten auf dem Server hinterlegt sind, läuft dieses Werkzeug ohne Änderung." }));
}
function ladezeitKarte(l, tempo) {
  const v = l.verteilung;
  const teile = [[v.bilder, FARBE.info, "Bilder"], [v.skripte, FARBE.marke, "Skripte"], [v.stile, FARBE.lila, "Stile"], [v.schriften, "#1a8ba0", "Schriften"], [v.html, FARBE.ok, "HTML"], [v.andere, FARBE[""], "andere"]];
  return karte("Ladezeit und Gewicht", "eigene Messung · ohne ausgeführtes JavaScript", "zap",
    h("div.knopfreihe", ring(l.punkte, 96, null, "Tempo"), h("div.wachsen", kv([["Gewicht mit allen Dateien", zahl(l.gesamtKB / 1024, 2) + " MB"], ["Anfragen", String(l.anfragen) + (l.begrenzt ? " (erste 50 gemessen)" : "")], ["Fremde Server", String(l.fremdHosts.length)]]))),
    stapel(teile.map(([w, f, n]) => [w, f, n])),
    h("div.knopfreihe.klein", teile.filter(([w]) => w > 0).map(([w, f, n]) => { const p = h("span.knopfreihe", h("span"), n + " " + zahl(w, 0) + " KB"); const pk = p.firstChild; pk.style.width = "8px"; pk.style.height = "8px"; pk.style.borderRadius = "50%"; pk.style.background = f; return p; })),
    l.schwerste.length ? h("details", h("summary.klein", { text: "Die schwersten Dateien" }), kv(l.schwerste.map((s) => [s.url.replace(/^https?:\/\//, "").slice(0, 70), zahl(s.kb, 0) + " KB"]))) : null,
    tempo && !tempo.verfuegbar ? h("p.klein.leise", { text: "Werte echter Besucher (Core Web Vitals) kommen dazu, sobald der kostenlose Google-Schlüssel eingerichtet ist." }) : null);
}
function tempoKarte(t) {
  if (!t.verfuegbar) return karte("Ladezeit (Google PageSpeed)", "nicht gemessen", "zap", h("div.hinweisfeld.info", ic("info"), h("span", { text: "Auf diesem Server fehlt der kostenlose Google-Schlüssel: " + t.fehlt })));
  if (t.fehler) return karte("Ladezeit (Google PageSpeed)", null, "zap", h("div.hinweisfeld", ic("alert"), h("span", { text: t.fehler })));
  const ton = (u) => u === "gut" ? "ok" : u === "schlecht" ? "schlecht" : "warn";
  return karte("Ladezeit (Google PageSpeed, Mobil)", t.feld.length ? "echte Nutzer der letzten 28 Tage (" + t.feldQuelle + ") und Labormessung" : "Labormessung; für echte Nutzerdaten hat die Seite zu wenig Besuche", "zap",
    h("div.knopfreihe", ring(t.punkte, 96, null, "Leistung"),
      h("div.wachsen", t.feld.length ? kv(t.feld.map((f) => [f.name, h("span.knopfreihe", h("b", { text: f.wert }), pille(f.urteil, ton(f.urteil)))])) : kv(t.labor.map((l) => [l.name, l.wert])))),
    t.feld.length ? h("details", h("summary.klein.leise", { text: "Labormessung" }), kv(t.labor.map((l) => [l.name, l.wert]))) : null,
    t.chancen.length ? [h("b.klein", { text: "Was am meisten bringt" }), kv(t.chancen.map((c) => [c.name, c.ersparnisMs ? "bis " + zahl(c.ersparnisMs / 1000) + " s" : zahl(c.ersparnisKB) + " KB"]))] : null);
}
const tonPass =(v) => v === "pass" ? "ok" : /fail|none|fehlt/.test(v || "") ? "schlecht" : v === "softfail" || v === "neutral" ? "warn" : /signiert/.test(v || "") ? "ok" : "";

/* ---------- die Werkzeuge ---------- */
const MODULE = {
  gesamt: {
    name: "Gesamtcheck", ic: "gauge",
    titel: "Gesamtcheck",
    sub: "Eine Adresse, fünf Prüfungen gleichzeitig: Website, Ladezeit, Domain, Erreichbarkeit, Mail-Schutz und KI-Sichtbarkeit. Am Ende steht, was zuerst zu tun ist.",
    plus: ["Wöchentlich automatisch neu geprüft", "Meldung bei neuen kritischen Befunden", "Verlauf aller Bereiche"],
    formular(z, w) {
      const u = feld("url", "Adresse Ihrer Website", { wert: w.url || "", ph: "https://ihre-website.de" });
      const tempo = h("label.haken", h("input", { type: "checkbox", checked: w.tempo === "false" ? null : true }), "Ladezeit auch von Google messen");
      einhaengen(z, [u.wrap, h("div.feldgruppe", h("span.beschriftung", { text: "Tempo" }), tempo)]);
      return () => ({ url: u.el.value, tempo: tempo.querySelector("input").checked });
    },
    zeigen(r, z) {
      z.appendChild(h("div.reihe.zwei",
        karte("Gesamtergebnis", r.ziel, "gauge", h("div.knopfreihe", ring(r.punkte, 120, null, "von 100"), h("div.wachsen", kv(r.bereiche.map((b) => [b.name, b.fehler ? pille(b.fehler.slice(0, 50), "schlecht") : b.punkte != null ? h("span.knopfreihe", balken(b.punkte, FARBE[tonFuerWert(b.punkte)], 80), h("b", { text: String(b.punkte) })) : h("span.klein", { text: (b.kurz || "–").split(" · ")[0] })]))))),
        karte("Was zuerst zu tun ist", "über alle Bereiche, nach Stufe und Wirkung", "alert", befundListe(r.massnahmen.slice(0, 12).map((b) => ({ ...b, gruppe: b.modulName + (b.gruppe ? " · " + b.gruppe : "") }))))));
      z.lastChild.querySelector(".knopfreihe > .wachsen").style.flex = "1";
      const reihenfolge = ["audit", "uptime", "domain", "mail", "ki"];
      for (const k of reihenfolge) {
        const t = r.teile[k];
        if (!t) continue;
        const inhalt = h("div.spalte");
        const d = h("details.karte.teilbereich", h("summary", h("span.knopfreihe", h("span.symbolfeld.marke", ic(MODULE[k].ic, 15)), h("b", { text: MODULE[k].name + (k === "mail" ? " · Schutz der Domain" : "") }), h("span.klein.leise", { text: t.kurz || "" }))), inhalt);
        MODULE[k].zeigen(t, inhalt);
        z.appendChild(d);
      }
    }
  },
  audit: {
    name: "Website-Audit", ic: "scan",
    titel: "Website-Audit",
    sub: "Prüft eine Seite oder die ganze Website gegen 158 Regeln: Technik, Struktur, Inhalt, KI-Lesbarkeit und Leistung. Sortiert danach, was zuerst zu tun ist.",
    plus: ["Bis 10.000 Seiten je Prüfung", "Wöchentlich automatisch, Mail bei neuen kritischen Befunden", "Verlauf der Punktzahl"],
    formular(z, w, g) {
      const u = feld("url", "Adresse", { wert: w.url || "", ph: "https://ihre-website.de" });
      const max = feld("max", "Höchstens Seiten", { typ: "number", wert: w.max || Math.min(200, g.maxSeiten || 500), schmal: true, min: 1, max: g.maxSeiten || 500 });
      max.wrap.classList.toggle("versteckt", w.umfang !== "website");
      const tempo = h("label.haken", h("input", { type: "checkbox", checked: w.tempo === "false" ? null : true }), "Ladezeit von Google messen (ca. 20 s)");
      const s = umschalter([["seite", "Nur diese Seite"], ["website", "Ganze Website, bis " + zahl(g.maxSeiten || 500) + " Seiten"]], w.umfang || "seite", (k) => { max.wrap.classList.toggle("versteckt", k !== "website"); tempo.classList.toggle("versteckt", k === "website"); }, "Umfang");
      tempo.classList.toggle("versteckt", w.umfang === "website");
      einhaengen(z, [u.wrap, h("div.feldgruppe", h("span.beschriftung", { text: "Umfang" }), s), max.wrap, h("div.feldgruppe", h("span.beschriftung", { text: "Tempo" }), tempo)]);
      return () => ({ url: u.el.value, umfang: s.wert(), max: Number(max.el.value) || 200, tempo: tempo.querySelector("input").checked });
    },
    zeigen(r, z) {
      const kopf = karte("Ergebnis", r.umfang === "website" ? r.seiten + " von " + r.gefunden + " gefundenen Seiten" : r.titel || r.ziel, "scan",
        h("div.knopfreihe", ring(r.punkte, 112, null, "von 100"),
          h("div.wachsen", kv([
            ["Seiten geprüft", zahl(r.seiten)],
            r.umfang === "website" ? ["Ø Antwortzeit", r.antwortzeit != null ? r.antwortzeit + " ms" : "–"] : ["Status", r.status],
            ["Dauer", (r.dauer / 1000).toFixed(1).replace(".", ",") + " s"],
            ["Befunde", h("span.knopfreihe", pille(r.kritisch + " kritisch", "schlecht"), pille(r.wichtig + " wichtig", "warn"), pille(r.hinweise + " Hinweise", "info"))]
          ]))));
      kopf.querySelector(".knopfreihe > .wachsen").style.flex = "1";
      const reihe = h("div.reihe.zwei", kopf, karte("Bereiche", "Punkte je Regelgruppe", "chart", gruppenBalken(r.gruppen)));
      einhaengen(z, [reihe]);
      if (r.grenzeErreicht) z.appendChild(h("div.hinweisfeld.info", ic("info"), h("span", { text: "Die Grenze von " + r.seiten + " Seiten wurde erreicht; " + (r.gefunden - r.seiten) + " weitere Adressen sind nicht geprüft." })));
      if (r.statuscodes) {
        const farbe = (k) => k.startsWith("2") ? FARBE.ok : k.startsWith("3") ? FARBE.info : k.startsWith("4") || k.startsWith("5") || k === "Fehler" ? FARBE.schlecht : FARBE[""];
        const e = Object.entries(r.statuscodes).sort();
        z.appendChild(karte("Statuscodes", "alle abgerufenen Adressen", "activity", stapel(e.map(([k, v]) => [v, farbe(k), k])), kv(e.map(([k, v]) => [k, zahl(v)]))));
      }
      if (r.ladezeit) z.appendChild(ladezeitKarte(r.ladezeit, r.tempo));
      if (r.tempo && r.tempo.verfuegbar) z.appendChild(tempoKarte(r.tempo));
      z.appendChild(befundKarte(r.befunde));
      if (r.seitenListe) {
        const l = r.seitenListe.slice().sort((a, b) => (a.punkte ?? -1) - (b.punkte ?? -1)).slice(0, 100);
        z.appendChild(karte("Seiten", "die schwächsten zuerst, bis 100", "list", tabelle([{ t: "ADRESSE", umbruch: true }, { t: "STATUS", zahl: true }, { t: "PUNKTE", zahl: true }, { t: "KRITISCH", zahl: true }, { t: "WICHTIG", zahl: true }],
          l.map((s) => [s.url, s.status || (s.fehler ? "Fehler" : "–"), s.punkte ?? "–", s.kritisch, s.wichtig]))));
      }
      if (r.gliederung && r.gliederung.length) {
        z.appendChild(karte("Gliederung", "Überschriften in Reihenfolge", "list", h("div.zeilen", r.gliederung.slice(0, 40).map((g) => { const e = h("div.z", pille("H" + (g.ebene || "?"), g.sprung ? "warn" : ""), h("span.wachsen", { text: g.text || g.inhalt || "" })); e.style.paddingLeft = ((g.ebene || 1) - 1) * 14 + "px"; return e; }))));
      }
    }
  },

  rankings: {
    name: "Rankings", ic: "trend",
    titel: "Rankings",
    sub: "Auf welcher Position stehen Ihre Seiten bei Google? Bis zu fünf Keywords ohne Konto, für Desktop oder Telefon.",
    plus: ["100 Keywords, täglich abgefragt", "Verlauf je Keyword", "Meldung bei Sprüngen"],
    formular(z, w, g) {
      const d = feld("domain", "Ihre Domain", { wert: w.domain || "", ph: "ihre-website.de" });
      const k = feld("keywords", "Keywords, eines je Zeile (bis " + (g.maxKeywords || 5) + "; mit Search Console optional)", { mehrzeilig: true, wert: w.keywords || "", ph: "tischlerei hannover\nküche nach maß" });
      k.el.style.minHeight = "90px"; k.el.style.fontFamily = "var(--schrift)";
      const o = feld("ort", "Ort (optional)", { wert: w.ort || "", ph: "Hanover,Lower Saxony,Germany", schmal: true });
      const s = umschalter([["desktop", "Desktop"], ["mobil", "Mobil"]], w.geraet || "desktop", null, "Gerät");
      einhaengen(z, [d.wrap, o.wrap, h("div.feldgruppe", h("span.beschriftung", { text: "Gerät" }), s), k.wrap]);
      k.wrap.style.flexBasis = "100%";
      return () => ({ domain: d.el.value, keywords: k.el.value, ort: o.el.value, geraet: s.wert() });
    },
    zeigen(r, z) {
      if (!r.verfuegbar) return z.appendChild(fehltKarte(r));
      if (r.quelle === "Google Search Console") {
        const k = r.kennzahlen;
        z.appendChild(h("div.reihe", [["Klicks", zahl(k.klicks, 0)], ["Impressionen", zahl(k.impressionen, 0)], ["Ø Position", zahl(k.position)], ["Suchanfragen", zahl(k.anfragen, 0)]].map(([n, v]) => karte(null, null, null, h("div.kennzahl", h("span.name", { text: n }), h("span.wert", { text: v }))))));
        z.appendChild(karte("Suchanfragen", "Google Search Console · " + r.property + " · " + r.zeitraum, "trend",
          h("p.klein.leise", { text: "Die Position ist Googles Durchschnitt über alle Ausspielungen, kein fester Platz." }),
          tabelle([{ t: "SUCHANFRAGE" }, { t: "Ø POSITION", zahl: true }, { t: "KLICKS", zahl: true }, { t: "IMPRESSIONEN", zahl: true }, { t: "CTR", zahl: true }],
            r.zeilen.map((x) => [x.keyword, x.platz != null ? h("b", { text: zahl(x.platz) }) : "keine Impressionen", zahl(x.klicks, 0), zahl(x.impressionen, 0), zahl(x.ctr * 100) + " %"]))));
        if (r.verlauf && r.verlauf.length > 1) z.appendChild(karte("Klicks je Tag", null, "chart", h("div.verlauf", linie(r.verlauf.map((v) => v.klicks)))));
        if (r.seiten && r.seiten.length) z.appendChild(karte("Seiten mit den meisten Klicks", null, "file", tabelle([{ t: "SEITE", umbruch: true }, { t: "KLICKS", zahl: true }, { t: "IMPRESSIONEN", zahl: true }, { t: "Ø POSITION", zahl: true }], r.seiten.map((x) => [x.schluessel, zahl(x.klicks, 0), zahl(x.impressionen, 0), zahl(x.position)]))));
        return;
      }
      z.appendChild(karte("Positionen", r.ort + " · " + r.geraet, "trend", tabelle([{ t: "KEYWORD" }, { t: "PLATZ", zahl: true }, { t: "SEITE", umbruch: true }, { t: "MERKMALE" }, { t: "KI-ÜBERSICHT" }],
        r.zeilen.map((x) => x.fehler ? [x.keyword, "–", x.fehler, "", ""] : [x.keyword, x.platz ? h("b", { text: String(x.platz) }) : "nicht in Top 100", x.url || "–", h("span.knopfreihe", (x.merkmale || []).slice(0, 4).map((m) => pille(m, ""))), x.kiUebersicht ? pille(x.kiZitiert ? "zitiert" : "nicht zitiert", x.kiZitiert ? "ok" : "warn") : "–"]))));
      for (const x of r.zeilen.filter((y) => y.vorIhnen && y.vorIhnen.length).slice(0, 3)) {
        z.appendChild(karte("Wer vor Ihnen steht", "„" + x.keyword + "“", "target", kv(x.vorIhnen.map((v) => [v.platz + ". " + v.domain, v.titel || ""]))));
      }
    }
  },

  ki: {
    name: "KI-Sichtbarkeit", ic: "sparkles",
    titel: "KI-Sichtbarkeit",
    sub: "Dürfen ChatGPT, Claude, Perplexity und Co. Ihre Website lesen? Und werden Sie genannt, wenn man ihnen eine Frage stellt?",
    plus: ["30 Fragen, täglich abgefragt", "Anteil der Nennungen gegen Mitbewerber", "Meldung, wenn ein KI-Crawler ausgesperrt wird"],
    formular(z, w) {
      const u = feld("url", "Ihre Website", { wert: w.url || "", ph: "https://ihre-website.de" });
      const f = feld("frage", "Frage an die KI-Dienste (optional)", { wert: w.frage || "", ph: "Welche Tischlerei in Hannover baut Einbauschränke?" });
      const m = feld("marke", "Ihr Name (optional)", { wert: w.marke || "", ph: "Atelier Nord", schmal: true });
      einhaengen(z, [u.wrap, f.wrap, m.wrap]);
      return () => ({ url: u.el.value, frage: f.el.value, marke: m.el.value });
    },
    zeigen(r, z) {
      const zg = r.zugang;
      if (zg) {
        const erlaubt = zg.crawler.filter((c) => c.erlaubt).length;
        z.appendChild(h("div.reihe.zwei",
          karte("Zugang für KI-Dienste", zg.ziel, "sparkles", h("div.knopfreihe", ring(zg.punkte, 104, null, "von 100", FARBE.lila),
            h("div.wachsen", kv((zg.signale || []).map((s) => [s.name, h("span.knopfreihe", h("span.klein.leise", { text: s.wert }), pille(s.erfuellt ? "ja" : "nein", s.erfuellt ? "ok" : "warn"))]))))),
          karte("KI-Crawler", "robots.txt, Pfad /", "bot", kv(zg.crawler.map((c) => [c.agent + " · " + c.wer, pille(c.erlaubt ? "darf lesen" : "gesperrt", c.erlaubt ? "ok" : "schlecht")])))));
        z.appendChild(befundKarte(zg.befunde));
      }
      if (r.antworten) {
        if (!r.antworten.length) z.appendChild(h("div.hinweisfeld.info", ic("info"), h("span", { text: "Für die Frage ist noch kein KI-Dienst eingerichtet. Unten steht, was dafür fehlt." })));
        else {
          z.appendChild(h("div.hinweisfeld" + (r.genannt ? ".ok" : ".info"), ic("sparkles"), h("span", { text: "„" + r.frage + "“ · in " + r.genannt + " von " + r.gefragt + " Antworten genannt" })));
          z.appendChild(h("div.reihe.zwei", r.antworten.map((a) => karte(a.name, a.ok ? (a.alsQuelle ? "als Quelle Nr. " + a.alsQuelle : "nicht als Quelle verlinkt") : "Fehler", "bot",
            a.ok ? [a.keineUebersicht ? h("p.leise", { text: "Zu dieser Frage zeigt Google keine KI-Übersicht." }) : pille(a.genannt ? "genannt" : "nicht genannt", a.genannt ? "ok" : "", "punkt"),
              a.auszug ? h("p.leise.klein", { text: "… " + a.auszug + " …" }) : null,
              a.quellen && a.quellen.length ? h("div.zeilen", a.quellen.slice(0, 6).map((q, i) => h("div.z", h("span.klein.leise", { text: (i + 1) + "." }), h("span.wachsen.klein", { text: q })))) : null]
              : h("p.leise", { text: a.fehler })))));
        }
      }
      if (r.anbieter) z.appendChild(karte("KI-Dienste für Fragen", "eingerichtet auf diesem Server", "bot", kv(r.anbieter.map((a) => [a.name, a.bereit ? pille("eingerichtet", "ok") : h("span.klein.leise", { text: "fehlt: " + a.fehlt })]))));
    }
  },

  backlinks: {
    name: "Backlinks", ic: "link",
    titel: "Backlinks",
    sub: "Wer verweist auf Ihre Website, mit welchem Ankertext und wie stark? Ohne Konto die 50 stärksten Verweise.",
    plus: ["Alle Verweise, wöchentlicher Abgleich", "Meldung bei verlorenen Links", "Linkideen aus Mitbewerbern"],
    formular(z, w) { const d = feld("domain", "Domain", { wert: w.domain || "", ph: "ihre-website.de" }); z.appendChild(d.wrap); return () => ({ domain: d.el.value }); },
    zeigen(r, z) {
      if (!r.verfuegbar) return z.appendChild(fehltKarte(r));
      z.appendChild(h("div.reihe", [["Verweise", r.backlinks], ["Verweisende Domains", r.domains], ["Nofollow", r.nofollow]].map(([n, v]) => karte(null, null, null, h("div.kennzahl", h("span.name", { text: n }), h("span.wert", { text: zahl(v, 0) }))))));
      z.appendChild(karte("Die stärksten Verweise", r.liste.length + " Einträge", "link", tabelle([{ t: "QUELLE", umbruch: true }, { t: "ZIEL", umbruch: true }, { t: "ANKER" }, { t: "ART" }, { t: "WERT", zahl: true }],
        r.liste.map((x) => [x.quelle, x.ziel, x.anker || "–", pille(x.follow, x.follow === "follow" ? "" : "warn"), x.wert]))));
      z.appendChild(karte("Ankertexte", null, "list", kv(r.anker.map((a) => [a.text || "(leer)", zahl(a.anzahl, 0)]))));
    }
  },

  konkurrenz: {
    name: "Konkurrenz", ic: "target",
    titel: "Konkurrenz",
    sub: "Ihre Website neben Mitbewerbern: Punktzahl, Tempo, Größe, Sitemap, KI-Zugang und strukturierte Daten. Alles selbst gemessen.",
    plus: ["Bis zu drei Mitbewerber", "Wöchentlich neu verglichen", "Meldung, wenn ein Mitbewerber Sie überholt"],
    formular(z, w, g) {
      const e = feld("eigene", "Ihre Domain", { wert: w.eigene || "", ph: "ihre-website.de" });
      z.appendChild(e.wrap);
      const felder = [];
      for (let i = 0; i < (g.maxMitbewerber || 1); i++) { const f = feld("mb" + i, "Mitbewerber " + (i + 1), { wert: (w.mitbewerber || [])[i] || "", ph: "mitbewerber.de" }); felder.push(f); z.appendChild(f.wrap); }
      return () => ({ eigene: e.el.value, mitbewerber: felder.map((f) => f.el.value).filter(Boolean) });
    },
    zeigen(r, z) {
      const kopf = [{ t: "KENNZAHL" }, ...r.domains.map((d, i) => ({ t: (i === 0 ? "SIE · " : "") + d.toUpperCase(), zahl: true }))];
      z.appendChild(karte("Im Vergleich", "grün: der bessere Wert", "target", tabelle(kopf, r.reihen.map((x) => [x.name, ...x.werte.map((v) => v == null ? "–" : (v === x.beste && x.werte.filter((y) => y === x.beste).length < x.werte.length ? pille(zahl(v, 0), "ok") : zahl(v, 0)))]))));
      z.appendChild(karte("Wer wo vorn liegt", null, "chart", kv(r.domains.map((d, i) => [d + (r.fehler[i] ? " (nicht lesbar: " + r.fehler[i] + ")" : ""), r.siege[i] + " von " + r.reihen.length]))));
    }
  },

  content: {
    name: "Content", ic: "file",
    titel: "Content",
    sub: "Steht Ihr Keyword dort, wo es zählt? Mit Lesbarkeit, Snippet in Pixeln und den Begriffen, die Vergleichsseiten verwenden.",
    plus: ["Ohne Tagesgrenze, mit Verlauf", "Vergleich nach jeder Änderung", "Top-10-Vergleich automatisch, sobald Suchdaten eingerichtet sind"],
    formular(z, w) {
      const u = feld("url", "Seite", { wert: w.url || "", ph: "https://ihre-website.de/seite" });
      const k = feld("keyword", "Keyword", { wert: w.keyword || "", ph: "küche nach maß hannover", schmal: true });
      const t = feld("text", "Text (statt Adresse)", { mehrzeilig: true, wert: w.text || "" });
      const v = feld("vergleich", "Vergleichsseiten, eine Adresse je Zeile (optional)", { mehrzeilig: true, wert: (w.vergleich || []).join("\n"), ph: "https://mitbewerber.de/seite" });
      v.el.style.minHeight = "80px";
      t.wrap.classList.toggle("versteckt", !w.text);
      const mitText = h("label.haken", h("input", { type: "checkbox", checked: w.text ? true : null }), "Text einfügen statt Adresse");
      mitText.querySelector("input").addEventListener("change", (e) => { t.wrap.classList.toggle("versteckt", !e.target.checked); u.wrap.classList.toggle("versteckt", e.target.checked); });
      einhaengen(z, [u.wrap, k.wrap, h("div.feldgruppe", h("span.beschriftung", { text: "Quelle" }), mitText), t.wrap, v.wrap]);
      t.wrap.style.flexBasis = "100%"; v.wrap.style.flexBasis = "100%";
      return () => { const text = mitText.querySelector("input").checked; return { url: text ? "" : u.el.value, text: text ? t.el.value : "", keyword: k.el.value, vergleich: v.el.value.split(/\s+/).filter(Boolean) }; };
    },
    zeigen(r, z) {
      z.appendChild(h("div.reihe", [["Wörter", zahl(r.woerter, 0)], ["Vorkommen des Keywords", zahl(r.vorkommen, 0)], ["Dichte", zahl(r.dichte) + " %"], ["Lesbarkeit", r.lesbarkeit ? r.lesbarkeit.wert + " · Ø " + zahl(r.lesbarkeit.satzlaenge) + " Wörter je Satz" : "zu wenig Text"]].map(([n, v]) => karte(null, null, null, h("div.kennzahl", h("span.name", { text: n }), h("span.wert", { text: v }))))));
      z.appendChild(karte("Keyword an den tragenden Stellen", "„" + r.keyword + "“ · " + r.stellen.filter((s) => s.getroffen).length + " von " + r.stellen.length, "target",
        h("div.zweispaltig", r.stellen.map((s) => h("div.knopfreihe", h("span.symbolfeld", ic(s.getroffen ? "check" : "x", 14)), h("span", { text: s.stelle }), !s.vorhanden ? pille("fehlt auf der Seite", "") : null)))));
      if (r.snippet && (r.snippet.titel || r.snippet.beschreibung)) {
        const sn = r.snippet;
        z.appendChild(karte("Vorschau im Suchergebnis", "gemessen in Pixeln (Arial), nicht in Zeichen", "eye",
          h("div.snippet", h("span.s-url", { text: sn.url || "" }), h("span.s-titel", { text: sn.titel || "(kein Titel)" }), h("span.s-text", { text: sn.beschreibung || "(keine Beschreibung)" })),
          h("div.zweispaltig", [["Titel", sn.titelPx, sn.titelMax], ["Beschreibung", sn.beschreibungPx, sn.beschreibungMax]].map(([n, v, m]) => h("div", h("div.knopfreihe", h("b.wachsen", { text: n }), h("span.klein.leise", { text: v + " von " + m + " px" })), balken(v / m * 100, v > m ? FARBE.schlecht : FARBE.ok, 300))))));
      }
      if (r.begriffe) {
        z.appendChild(karte("Begriffe der Vergleichsseiten", "WDF·IDF · Quelle: " + r.vergleich.quelle, "list", tabelle([{ t: "BEGRIFF" }, { t: "STATUS" }, { t: "SIE" }, { t: "VERGLEICH" }, { t: "SEITEN", zahl: true }],
          r.begriffe.map((b) => { const mx = Math.max(...r.begriffe.map((x) => Math.max(x.eigen, x.mittel))) || 1; return [b.wort, pille(b.status, b.status === "passt" ? "ok" : b.status === "fehlt" ? "schlecht" : "warn"), balken(b.eigen / mx * 100, FARBE.marke, 90), balken(b.mittel / mx * 100, FARBE.info, 90), b.seiten]; }))));
      } else {
        z.appendChild(h("div.hinweisfeld.info", ic("info"), h("span", { text: "Für die Begriffsliste (WDF·IDF) bitte mindestens zwei Vergleichsseiten angeben, etwa die Treffer, die bei Google vor Ihnen stehen." })));
      }
      if (r.vergleich && r.vergleich.seiten && r.vergleich.seiten.some((s) => !s.ok)) z.appendChild(h("div.hinweisfeld", ic("alert"), h("span", { text: "Nicht lesbar: " + r.vergleich.seiten.filter((s) => !s.ok).map((s) => s.url).join(", ") })));
      z.appendChild(befundKarte(r.befunde));
    }
  },

  uptime: {
    name: "Uptime", ic: "activity",
    titel: "Uptime",
    sub: "Ruft Ihre Website jetzt ab und zeigt Antwortzeit je Abschnitt, Weiterleitungen, Protokoll und Zertifikat.",
    plus: ["Prüfung bis jede Minute", "Alarm per Mail nach zwei Fehlversuchen", "Verlauf der Antwortzeit"],
    formular(z, w) { const u = feld("url", "Adresse", { wert: w.url || "", ph: "https://ihre-website.de" }); z.appendChild(u.wrap); return () => ({ url: u.el.value }); },
    zeigen(r, z) {
      const teile = r.zeiten ? [[r.zeiten.dns, FARBE.info, "DNS"], [r.zeiten.verbindung, "#1a8ba0", "Verbindung"], [r.zeiten.tls, FARBE.lila, "Verschlüsselung"], [r.zeiten.antwort, FARBE.marke, "Antwort des Servers"], [r.zeiten.uebertragung, FARBE.ok, "Übertragung"]] : [];
      z.appendChild(karte(r.erreichbar ? "Erreichbar" : "Nicht erreichbar", "gemessen vom " + r.standort + " · " + datum(r.zeit), "activity",
        h("div.knopfreihe", h("div.kennzahl", h("span.name", { text: "Abruf gesamt" }), h("span.wert", r.gesamt != null ? String(r.gesamt) : "–", h("small", { text: "ms" }))), pille(r.erreichbar ? "Status " + r.status : (r.fehler || "Status " + r.status), r.erreichbar ? "ok" : "schlecht", "punkt")),
        teile.length ? [stapel(teile.map(([v, f, n]) => [Math.max(v, 1), f, n])), h("div.knopfreihe", teile.map(([v, f, n]) => { const p = h("span.knopfreihe.klein", h("span.punkt"), n + " ", h("b", { text: v + " ms" })); p.firstChild.style.cssText = ""; p.firstChild.style.width = "8px"; p.firstChild.style.height = "8px"; p.firstChild.style.borderRadius = "50%"; p.firstChild.style.background = f; return p; }))] : null));
      z.appendChild(h("div.reihe.zwei",
        karte("Abruf", null, "globe", kv([["Ziel", r.ziel], ["Protokoll", r.protokoll], ["Verschlüsselung", r.tls], ["Größe", r.bytes != null ? zahl(r.bytes / 1024) + " KB" : "–"], ["Server", r.server], ["Zwischenspeicher", r.zwischenspeicher || "keine Angabe"]])),
        karte("Zertifikat und Weiterleitungen", null, "lock", kv([
          ["Zertifikat gültig bis", r.zertifikat ? datum(r.zertifikat.bis, false) : "–"],
          ["Tage übrig", r.zertifikat ? pille(r.zertifikat.tage + " Tage", r.zertifikat.tage < 14 ? "schlecht" : r.zertifikat.tage < 30 ? "warn" : "ok") : "–"],
          ["Aussteller", r.zertifikat?.aussteller], ["Weiterleitungen", String((r.kette || []).length)],
          ...(r.kette || []).map((k) => [k.status + " ", k.von + " → " + k.nach])]))));
      if (r.befunde && r.befunde.length) z.appendChild(befundKarte(r.befunde));
    }
  },

  domain: {
    name: "Domain-Check", ic: "globe",
    titel: "Domain-Check",
    sub: "48 Regeln zu Erreichbarkeit, Zertifikat, Kopfzeilen, Cookies, DNS und Standarddateien. Dazu freie Namen für eine neue Domain und Tippfehler, die Fälscher nutzen könnten.",
    plus: ["Erinnerung 30 und 7 Tage vor Ablauf", "Meldung, wenn sich die Punktzahl verschlechtert", "Täglich neu geprüft"],
    formular(z, w) {
      const d = feld("domain", "Domain", { wert: w.domain || "", ph: "ihre-website.de" });
      const i = feld("idee", "Namensidee für neue Domains (optional)", { wert: w.idee || "", ph: "atelier nord tischlerei hannover" });
      const ends = ["de", "com", "shop", "net", "eu", "org", "online", "info"];
      const gewaehlt = new Set(w.endungen || ["de", "com"]);
      const boxen = ends.map((e) => h("label.haken", h("input", { type: "checkbox", value: e, checked: gewaehlt.has(e) ? true : null }), "." + e));
      einhaengen(z, [d.wrap, i.wrap, h("div.feldgruppe", h("span.beschriftung", { text: "Endungen für Vorschläge" }), h("div.knopfreihe", boxen))]);
      return () => ({ domain: d.el.value, idee: i.el.value, endungen: boxen.map((b) => b.querySelector("input")).filter((x) => x.checked).map((x) => x.value) });
    },
    zeigen(r, z) {
      const dns = r.gemessen?.dns || {};
      const reg = r.registrierung || {};
      if (r.punkte != null) {
        z.appendChild(h("div.reihe.zwei",
          karte("Ergebnis", (r.host || r.ziel) + " · " + (r.startseite || ""), "globe", h("div.knopfreihe", ring(r.punkte, 112, null, "von 100"), h("div.wachsen", kv([["kritisch", String(r.zahl.kritisch)], ["wichtig", String(r.zahl.wichtig)], ["Hinweise", String(r.zahl.hinweis)]])))),
          karte("Bereiche", null, "chart", gruppenBalken(r.gruppen))));
        z.lastChild.querySelector(".knopfreihe > .wachsen").style.flex = "1";
        z.appendChild(h("div.reihe.zwei",
          karte("Fristen", null, "clock", kv([
            ["Zertifikat", r.fristen?.zertifikatBis ? h("span.knopfreihe", datum(r.fristen.zertifikatBis, false), pille(r.fristen.zertifikatTage + " Tage", r.fristen.zertifikatTage < 14 ? "schlecht" : r.fristen.zertifikatTage < 30 ? "warn" : "ok")) : "–"],
            ["Domain", r.fristen?.domainBis ? h("span.knopfreihe", datum(r.fristen.domainBis, false), pille(r.fristen.domainTage + " Tage", r.fristen.domainTage < 30 ? "warn" : "ok")) : h("span.klein.leise", { text: reg.ok === false ? reg.grund : "Ablaufdatum nicht veröffentlicht" })],
            ["Registriert seit", reg.registriertSeit ? datum(reg.registriertSeit, false) : "–"], ["Registrar", reg.registrar], ["DNSSEC", reg.dnssec == null ? "–" : reg.dnssec ? "signiert" : "nicht signiert"]])),
          karte("DNS", null, "server", kv([["A", (dns.a || []).join(", ")], ["AAAA", (dns.aaaa || []).join(", ") || "keine"], ["Nameserver", (dns.ns || []).join(", ")], ["MX", (dns.mx || []).slice(0, 3).join(", ")], ["SPF", (dns.spf || [])[0]], ["DMARC", (dns.dmarc || [])[0]], ["CAA", (dns.caa || []).join(", ") || "keine"]]))));
        z.appendChild(befundKarte(r.befunde));
      } else {
        z.appendChild(h("div.hinweisfeld.info", ic("info"), h("span", { text: r.ziel + " ist " + (r.kurz || "nicht erreichbar") + ". Prüfbar sind Vorschläge und Tippfehler." })));
      }
      const status = (v) => v.frei === true ? pille(v.sicher ? "frei" : "wahrscheinlich frei", v.sicher ? "ok" : "warn", "punkt") : v.frei === false ? pille("vergeben", "", "punkt") : pille("unbekannt", "");
      if (r.vorschlaege) z.appendChild(karte("Domain-Vorschläge", "Verfügbarkeit über RDAP der jeweiligen Registry abgefragt", "sparkles", tabelle([{ t: "VORSCHLAG" }, { t: "LÄNGE", zahl: true }, { t: "MERKMALE" }, { t: "STATUS" }],
        r.vorschlaege.map((v) => [h("b", { text: v.domain }), v.laenge, h("span.knopfreihe", v.merkmale.map((m) => pille(m, m === "kurz" || m === "ohne Bindestrich" ? "ok" : ""))), status(v)]))));
      if (r.tippfehler && r.tippfehler.length) z.appendChild(karte("Tippfehler-Domains", "vergebene Varianten können für Betrugsmails genutzt werden", "shield", tabelle([{ t: "VARIANTE" }, { t: "STATUS" }, { t: "QUELLE" }],
        r.tippfehler.map((v) => [v.domain, v.frei === false ? pille("vergeben – prüfen, wem sie gehört", "warn") : status(v), v.quelle]))));
    }
  },

  mail: {
    name: "Mail-Prüfer", ic: "mail",
    titel: "Mail-Prüfer",
    sub: "Ist diese Mail echt, Spam oder Betrug? Oder: Ist Ihre eigene Domain gegen Fälschung geschützt?",
    plus: ["Ihre Domain täglich geprüft: SPF, DKIM, DMARC, Sperrlisten", "Meldung, wenn sich etwas verschlechtert", "Alle Prüfungen im Verlauf"],
    formular(z, w) {
      const roh = feld("roh", "Nachricht mit Kopfzeilen", { mehrzeilig: true, wert: "", ph: "Return-Path: …\nReceived: …\nFrom: …\nSubject: …\n\nText der Nachricht" });
      roh.el.style.minHeight = "180px";
      const eig = feld("eigene", "Ihre Domains (optional, für Fälschungen)", { wert: w.eigene || "", ph: "ihre-firma.de" });
      const dom = feld("domain", "Ihre Domain", { wert: w.domain || "", ph: "ihre-firma.de" });
      const hinweis = h("p.leise.klein", { text: "Im Mailprogramm „Original anzeigen“ oder „Quelltext anzeigen“ wählen und alles kopieren. Die Nachricht wird nur für diese Prüfung verarbeitet und nicht gespeichert." });
      const setze = (k) => { roh.wrap.classList.toggle("versteckt", k !== "nachricht"); eig.wrap.classList.toggle("versteckt", k !== "nachricht"); hinweis.classList.toggle("versteckt", k !== "nachricht"); dom.wrap.classList.toggle("versteckt", k !== "domain"); };
      const s = umschalter([["nachricht", "Nachricht prüfen"], ["domain", "Eigene Domain"]], w.art || "nachricht", setze, "Art der Prüfung");
      einhaengen(z, [h("div.feldgruppe", h("span.beschriftung", { text: "Art" }), s), eig.wrap, dom.wrap, roh.wrap, hinweis]);
      roh.wrap.style.flexBasis = "100%"; hinweis.style.flexBasis = "100%";
      setze(w.art || "nachricht");
      return () => s.wert() === "domain" ? { art: "domain", domain: dom.el.value } : { art: "nachricht", roh: roh.el.value, eigene: eig.el.value };
    },
    zeigen(r, z) {
      if (r.art === "domain") {
        z.appendChild(h("div.reihe.zwei",
          karte("Schutz der Domain", r.ziel, "shield", h("div.knopfreihe", ring(r.punkte, 112, null, "von 100"), h("div.wachsen", kv([["SPF", r.spf ? pille(r.spf.ende, r.spf.ende === "-all" ? "ok" : r.spf.ende === "~all" ? "warn" : "schlecht") : pille("fehlt", "schlecht")], ["DMARC", r.dmarc ? pille("p=" + r.dmarc.regel, r.dmarc.regel === "reject" ? "ok" : r.dmarc.regel === "quarantine" ? "ok" : "warn") : pille("fehlt", "schlecht")], ["DKIM", r.dkim.length ? pille(r.dkim.map((d) => d.selektor).join(", "), "ok") : pille("nicht gefunden", "warn")], ["MTA-STS", r.mtaSts ? pille("vorhanden", "ok") : pille("fehlt", "")], ["TLS-Berichte", r.tlsRpt ? pille("vorhanden", "ok") : pille("fehlt", "")], ["BIMI", r.bimi ? pille("vorhanden", "ok") : pille("fehlt", "")]])))),
          karte("Einträge", null, "file", r.spf ? h("div", h("p.klein.leise", { text: "SPF · " + r.spf.abfragen + " von 10 DNS-Abfragen" }), h("pre.code", { text: r.spf.eintrag })) : null, r.dmarc ? h("div", h("p.klein.leise", { text: "DMARC" }), h("pre.code", { text: r.dmarc.eintrag })) : null)));
        z.lastChild.querySelector(".knopfreihe > .wachsen").style.flex = "1";
        if (r.mx.length) z.appendChild(karte("Mailserver", null, "server", tabelle([{ t: "SERVER" }, { t: "IP" }, { t: "RÜCKWÄRTS" }, { t: "SPERRLISTEN" }], r.mx.map((m) => [m.server, m.ip || "–", m.ptr || "–", h("span.knopfreihe", m.sperrlisten.map((l) => pille(l.liste.split(".")[0] + ": " + (l.gelistet ? "gelistet" : l.gelistet === false ? "frei" : "unklar"), l.gelistet ? "schlecht" : l.gelistet === false ? "ok" : "")))]))));
        return z.appendChild(befundKarte(r.befunde));
      }
      const ton = r.risiko >= 70 ? "schlecht" : r.risiko >= 40 ? "warn" : "ok";
      z.appendChild(h("div.reihe.zwei",
        karte("Bewertung", r.kopf.betreff, "shield", h("div.knopfreihe", ring(r.risiko, 112, r.risiko + " %", "Risiko", FARBE[ton]), h("div.wachsen", h("h2", { text: r.urteil }), h("p.leise.klein", { text: r.empfehlung }), r.phishing ? pille("Phishing", "schlecht", "alert") : null))),
        karte("Warum", r.signale.length + " Signale, nach Gewicht", "alert", r.signale.length ? h("div.zeilen", r.signale.map((s) => h("div.z", h("span.wachsen", { text: s.text }), balken(s.gewicht * 3, FARBE.schlecht, 60), h("b", { text: "+" + s.gewicht })))) : h("p.leer", { text: "Keine Warnzeichen gefunden." }))));
      z.lastChild.querySelector(".knopfreihe > .wachsen").style.flex = "1";
      const e = r.echtheit;
      z.appendChild(karte("Echtheit des Absenders", "Quelle: " + e.quelle, "lock",
        h("div.knopfreihe", pille("SPF: " + (e.spf || "–"), tonPass(e.spf)), pille("DKIM: " + (e.dkim || "–"), tonPass(e.dkim)), pille("DMARC: " + (e.dmarc || "–"), tonPass(e.dmarc)), e.ip ? pille("IP " + e.ip, "") : null,
          (e.sperrlisten || []).map((l) => pille(l.liste.split(".")[0] + ": " + (l.gelistet ? "gelistet" : l.gelistet === false ? "frei" : "unklar"), l.gelistet ? "schlecht" : l.gelistet === false ? "ok" : ""))),
        e.spfGrund ? h("p.klein.leise", { text: "SPF selbst ausgewertet: " + e.spfGrund }) : null));
      z.appendChild(h("div.reihe.zwei",
        karte("Kopfzeilen", null, "mail", kv([["Von", (r.kopf.vonName ? r.kopf.vonName + " " : "") + "<" + r.kopf.von + ">"], ["An", r.kopf.an], ["Betreff", r.kopf.betreff], ["Antwort an", r.kopf.antwortAn], ["Rücklauf", r.kopf.ruecklauf], ["Datum", r.kopf.datum]])),
        karte("Anhänge und Links", r.anhaenge.length + " Anhänge · " + r.links.length + " Links", "link", kv([...r.anhaenge.map((a) => [a.name, a.enthaelt && a.enthaelt.length ? "enthält " + a.enthaelt.join(", ") : zahl(a.groesse / 1024) + " KB"]), ...r.links.slice(0, 8).map((l) => [l.text || "(ohne Text)", l.ziel])]))));
    }
  }
};
