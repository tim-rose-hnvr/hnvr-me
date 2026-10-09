/* SEO Waechter · Dashboard mit Konto: Uebersicht, Gespeichert, Werkzeuge,
   einzelne Pruefung mit Verlauf und Ueberwachung, Berichte, Einstellungen. */
"use strict";

const Z = { ich: null, haupt: null, leiste: null };
const TAKTE = [[1, "jede Minute"], [5, "alle 5 Minuten"], [15, "alle 15 Minuten"], [60, "stündlich"], [1440, "täglich"], [10080, "wöchentlich"]];
const HERKUNFT_TON = { "ohne Anmeldung": "info", automatisch: "", "von Hand": "" };

function projekt() { const k = Z.ich.konto; return k.projekte.find((p) => p.id === k.aktivesProjekt) || null; }
function kopf(titel, unter, ...werkzeuge) { return h("header.seitenkopf", h("div.wachsen", h("h1", { text: titel }), unter ? h("p", { text: unter }) : null), h("div.knopfreihe.nicht-drucken", werkzeuge)); }
function seite(...inhalt) { leeren(Z.haupt); einhaengen(Z.haupt, inhalt); Z.haupt.focus({ preventScroll: true }); window.scrollTo(0, 0); }
function fehlerAnzeigen(e) { Z.haupt.appendChild(h("div.hinweisfeld.schlecht", { role: "alert" }, ic("alert"), h("span", { text: e.message }))); }
function vorbelegung(modul) {
  const p = projekt(); if (!p) return {};
  const d = p.domain;
  return { audit: { url: "https://" + d + "/" }, uptime: { url: "https://" + d + "/" }, ki: { url: "https://" + d + "/" }, content: { url: "https://" + d + "/" },
    domain: { domain: d }, backlinks: { domain: d }, rankings: { domain: d }, konkurrenz: { eigene: d }, mail: { art: "domain", domain: d } }[modul] || {};
}

/* ---------- Geruest ---------- */
function geruest() {
  const k = Z.ich.konto;
  const wahl = h("select.feld", { "aria-label": "Projekt wählen" },
    k.projekte.map((p) => h("option", { value: p.id, selected: p.id === k.aktivesProjekt ? true : null, text: p.domain })),
    h("option", { value: "", selected: k.projekte.length ? null : true, text: k.projekte.length ? "+ Projekt anlegen" : "Noch kein Projekt" }));
  wahl.addEventListener("change", async () => {
    if (!wahl.value) { projektDialog(); return; }
    await api("/api/projekte/" + wahl.value + "/aktiv", { daten: {} });
    Z.ich = await ich(true); zeigen();
  });
  const punkt = (pfad, name, icon, zaehler) => h("a.punkt", { href: "#" + pfad, "data-pfad": pfad }, ic(icon, 17), name, zaehler ? h("span.zaehler", { text: zaehler }) : null);
  Z.leiste = h("aside.leiste.glas", { "aria-label": "Navigation" },
    logo(), h("div.projektwahl", wahl),
    punkt("uebersicht", "Übersicht", "gauge"), punkt("gespeichert", "Gespeichert", "inbox"),
    h("div.gruppe", { text: "Werkzeuge" }),
    Object.entries(MODULE).map(([c, m]) => punkt("modul/" + c, m.name, m.ic)),
    h("div.gruppe", { text: "Konto" }),
    punkt("berichte", "Berichte", "chart"), punkt("einstellungen", "Einstellungen", "sliders"),
    h("div.abstand"),
    h("a.punkt", { href: "#", onclick: async (e) => { e.preventDefault(); await api("/api/abmelden", { daten: {} }); location.href = "/"; } }, ic("logout", 17), "Abmelden"),
    h("div.branding", { text: "Bereitgestellt von hnvr.me" }));
  Z.haupt = h("main.app-haupt", { id: "inhalt", tabindex: "-1" });
  const tabs = h("nav.tabs-unten.glas", { "aria-label": "Navigation" },
    [["uebersicht", "Übersicht", "gauge"], ["gespeichert", "Gespeichert", "inbox"], ["werkzeuge", "Prüfen", "search"], ["berichte", "Berichte", "chart"], ["einstellungen", "Konto", "user"]]
      .map(([p, n, i]) => h("a", { href: "#" + p, "data-pfad": p }, ic(i, 20), n)));
  leeren(document.getElementById("app")).appendChild(h("div.app", Z.leiste, Z.haupt));
  document.body.appendChild(tabs);
}

function projektDialog() {
  const f = feld("domain", "Domain der Website", { ph: "ihre-website.de" });
  const status = h("div");
  const d = dialog([h("h2", { text: "Projekt anlegen" }), h("p.leise.klein", { text: "Bis zu drei Websites. Alle Prüfungen zu dieser Domain landen im Projekt." }), f.wrap, status,
    h("div.knopfreihe", h("button.knopf", { type: "button", onclick: () => d.zu() }, "Abbrechen"), h("button.knopf.haupt", { type: "button", onclick: async () => {
      try { await api("/api/projekte", { daten: { domain: f.el.value } }); d.zu(); Z.ich = await ich(true); geruest(); zeigen(); meldung("Projekt angelegt"); }
      catch (e) { leeren(status).appendChild(h("div.hinweisfeld.schlecht", h("span", { text: e.message }))); }
    } }, "Anlegen"))]);
}

/* ---------- Uebernahme aus dem Browser ---------- */
function uebernahmeAnbieten() {
  const l = ohneKonto.lesen();
  if (!l.length) return;
  const boxen = l.map((e, i) => { const b = h("input", { type: "checkbox", checked: true, value: String(i) }); return { b, e }; });
  const k = Z.ich.konto;
  const wahl = h("select.feld", k.projekte.map((p) => h("option", { value: p.id, selected: p.id === k.aktivesProjekt ? true : null, text: p.domain })), h("option", { value: "", text: "ohne Projekt" }));
  const d = dialog([
    h("div.knopfreihe", h("span.symbolfeld.marke", ic("download", 18)), h("div.wachsen", h("h2", { text: l.length + (l.length === 1 ? " Prüfung" : " Prüfungen") + " aus diesem Browser" }), h("p.leise.klein", { text: "Sie haben ohne Anmeldung geprüft. Sollen die Ergebnisse in Ihr Konto?" }))),
    h("div.zeilen.karte", boxen.map(({ b, e }) => h("label.z", b, h("span.symbolfeld.marke", ic(MODULE[e.modul]?.ic || "info", 14)), h("span.wachsen", h("b", { text: MODULE[e.modul]?.name || e.modul }), h("small.leise", { text: " " + (e.ergebnis?.ziel || "") + " · " + datum(e.zeit) })), h("span.klein", { text: e.ergebnis?.kurz?.split(" · ")[0] || "" })))),
    h("div.feldgruppe", h("label.beschriftung", { text: "Ablegen im Projekt" }), wahl),
    h("p.leise.klein", { text: "Nach dem Übernehmen werden sie aus diesem Browser gelöscht." }),
    h("div.knopfreihe", h("button.knopf", { type: "button", onclick: () => { ohneKonto.leeren(); d.zu(); } }, "Nicht übernehmen"),
      h("button.knopf.haupt", { type: "button", onclick: async () => {
        const auswahl = boxen.filter((x) => x.b.checked).map((x) => x.e);
        try { await api("/api/pruefungen/uebernehmen", { daten: { liste: auswahl, projektId: wahl.value || null } }); ohneKonto.leeren(); d.zu(); meldung(auswahl.length + " übernommen"); zeigen(); }
        catch (e) { meldung(e.message, "fehler"); }
      } }, ic("check", 16), "Übernehmen"))]);
}

/* ---------- Seiten ---------- */
async function seiteUebersicht() {
  const p = projekt();
  if (!p) {
    const f = feld("domain", "Domain Ihrer Website", { ph: "ihre-website.de" });
    const st = h("div");
    return seite(kopf("Willkommen", Z.ich.konto.email), karte("Erstes Projekt anlegen", "Damit das Dashboard weiß, welche Website es beobachtet.", "globe",
      h("div.eingaben", f.wrap, h("button.knopf.haupt", { type: "button", onclick: async () => { try { await api("/api/projekte", { daten: { domain: f.el.value } }); Z.ich = await ich(true); geruest(); zeigen(); } catch (e) { leeren(st).appendChild(h("div.hinweisfeld.schlecht", h("span", { text: e.message }))); } } }, "Anlegen")), st));
  }
  const [liste, hinweise] = await Promise.all([api("/api/pruefungen?projekt=" + p.id), api("/api/hinweise")]);
  const neueste = {};
  for (const x of liste) if (!neueste[x.modul] || x.geprueft > neueste[x.modul].geprueft) neueste[x.modul] = x;
  const ungelesen = hinweise.filter((x) => !x.gelesen);
  const alles = h("button.knopf.haupt", { type: "button", onclick: () => allesPruefen(p) }, ic("refresh", 16), "Alles prüfen");
  const kacheln = h("div.reihe", Object.entries(MODULE).map(([c, m]) => {
    const x = neueste[c];
    return h("a.karte.werkzeugkarte", { href: x ? "#pruefung/" + x.id : "#modul/" + c },
      h("div.knopfreihe", h("span.symbolfeld.marke", ic(m.ic, 15)), h("b.wachsen", { text: m.name }), x && x.ueberwacht?.an ? pille("überwacht", "ok", "punkt") : null),
      x ? [x.punkte != null ? h("div.knopfreihe", ring(x.punkte, 56), h("span.klein", { text: x.kurz.split(" · ").slice(1).join(" · ") })) : h("p", { text: x.kurz }), h("span.klein.leise", { text: "geprüft " + datum(x.geprueft) })]
        : h("p.leise", { text: c === "rankings" && Z.ich.konto.google ? "über Search Console · jetzt abrufen" : (c === "rankings" || c === "backlinks") && !Z.ich.dienste.suchdaten ? (c === "rankings" && Z.ich.dienste.google?.searchConsole ? "Google Search Console verbinden (Einstellungen)" : "Datenquelle nicht eingerichtet") : "Noch nicht geprüft · jetzt prüfen" }));
  }));
  const befunde = [];
  for (const c of ["audit", "domain", "mail", "ki", "uptime", "content"]) {
    const x = neueste[c]; if (!x) continue;
    const voll = await api("/api/pruefungen/" + x.id).catch(() => null);
    const bf = voll?.ergebnis?.befunde || voll?.ergebnis?.zugang?.befunde || [];
    for (const b of bf) befunde.push({ ...b, modul: c, pid: x.id });
  }
  const R = { kritisch: 0, wichtig: 1, hinweis: 2 };
  befunde.sort((a, b) => R[a.stufe] - R[b.stufe] || (b.gewicht || 1) * (b.seiten || 1) - (a.gewicht || 1) * (a.seiten || 1));
  const audit = neueste.audit ? await api("/api/pruefungen/" + neueste.audit.id).catch(() => null) : null;
  seite(
    kopf("Übersicht", p.domain + " · " + liste.length + " gespeicherte Prüfungen", alles),
    ungelesen.length ? karte("Hinweise", ungelesen.length + " neu", "bell", h("div.zeilen", ungelesen.slice(0, 6).map((x) => h("a.z", { href: x.pruefungId ? "#pruefung/" + x.pruefungId : "#gespeichert" }, pille(x.stufe === "ok" ? "erledigt" : STUFE_NAME[x.stufe] || x.stufe, STUFE[x.stufe] || "ok"), h("span.wachsen", { text: x.text }), h("small.leise", { text: datum(x.zeit) })))),
      h("button.knopf.klein", { type: "button", onclick: async () => { await api("/api/hinweise/gelesen", { daten: {} }); zeigen(); } }, ic("check", 14), "Als gelesen markieren")) : null,
    kacheln,
    h("div.reihe.zwei",
      karte("Zuerst beheben", "aus den neuesten Prüfungen, nach Stufe und Wirkung", "alert", befunde.length ? h("div.zeilen", befunde.slice(0, 8).map((b) => h("a.z", { href: "#pruefung/" + b.pid }, pille(STUFE_NAME[b.stufe] || b.stufe, STUFE[b.stufe]), h("span.wachsen", h("span", { text: b.name }), h("small.leise", { text: " · " + MODULE[b.modul].name + (b.seiten > 1 ? " · " + b.seiten + " Seiten" : "") })), ic("chevR", 14)))) : h("p.leer", { text: "Noch keine Befunde. „Alles prüfen“ startet Audit, Domain, Uptime, Mail und KI." })),
      karte("Verlauf der Punktzahl", "Website-Audit", "chart", audit && audit.verlauf.length > 1 ? [h("div.verlauf", linie(audit.verlauf.map((v) => v.punkte))), h("p.klein.leise", { text: audit.verlauf.length + " Messungen seit " + datum(audit.verlauf[0].zeit, false) })] : h("p.leer", { text: "Ab der zweiten Messung steht hier der Verlauf. Mit „Überwachen“ prüft der Wächter selbst." }))));
}

async function allesPruefen(p) {
  const url = "https://" + p.domain + "/";
  const auftraege = [["audit", { url, umfang: "seite" }], ["domain", { domain: p.domain }], ["uptime", { url }], ["mail", { art: "domain", domain: p.domain }], ["ki", { url }]];
  const zeilen = auftraege.map(([c]) => h("div.z", h("span.symbolfeld.marke", ic(MODULE[c].ic, 14)), h("span.wachsen", { text: MODULE[c].name }), h("span.klein.leise", { text: "wartet" })));
  const d = dialog([h("h2", { text: "Alles prüfen · " + p.domain }), h("div.zeilen", zeilen), h("p.klein.leise", { text: "Jedes Ergebnis wird gespeichert." })]);
  for (let i = 0; i < auftraege.length; i++) {
    const st = zeilen[i].lastChild;
    st.textContent = "läuft …";
    try { const s = await pruefungLaufen(auftraege[i][0], auftraege[i][1]); leeren(st).appendChild(pille(s.ergebnis.kurz.split(" · ")[0], "ok")); }
    catch (e) { leeren(st).appendChild(pille(e.message.slice(0, 40), "schlecht")); }
  }
  d.d.appendChild(h("button.knopf.haupt", { type: "button", onclick: () => { d.zu(); zeigen(); } }, "Fertig"));
}

async function seiteGespeichert() {
  const liste = await api("/api/pruefungen?projekt=alle");
  const k = Z.ich.konto;
  const ziel = h("div");
  let filter = "alle";
  const zeichnen = () => {
    const l = filter === "alle" ? liste : liste.filter((x) => x.modul === filter);
    leeren(ziel).appendChild(l.length ? tabelle([{ t: "WERKZEUG" }, { t: "ZIEL", umbruch: true }, { t: "ERGEBNIS" }, { t: "GEPRÜFT" }, { t: "HERKUNFT" }, { t: "ÜBERWACHT" }, { t: "" }], l.map((x) => {
      const m = MODULE[x.modul];
      const schalter = h("input", { type: "checkbox", "aria-label": "Überwachen", checked: x.ueberwacht?.an ? true : null, disabled: x.modul === "mail" && x.eingabe?.art !== "domain" ? true : null });
      schalter.addEventListener("change", async () => { try { await api("/api/pruefungen/" + x.id, { methode: "PATCH", daten: { ueberwacht: { an: schalter.checked } } }); meldung(schalter.checked ? "Wird überwacht" : "Überwachung aus"); } catch (e) { schalter.checked = !schalter.checked; meldung(e.message, "fehler"); } });
      return [h("span.knopfreihe", h("span.symbolfeld.marke", ic(m.ic, 14)), m.name), x.ziel, x.kurz, datum(x.geprueft), pille(x.herkunft, HERKUNFT_TON[x.herkunft] || ""), h("label.haken", schalter, "an"), h("a.knopf.klein", { href: "#pruefung/" + x.id }, "Öffnen")];
    })) : h("p.leer", { text: "Noch keine gespeicherten Prüfungen." }));
  };
  const u = umschalter([["alle", "Alle " + liste.length], ...Object.entries(MODULE).map(([c, m]) => [c, m.name + " " + liste.filter((x) => x.modul === c).length])], "alle", (w) => { filter = w; zeichnen(); }, "Werkzeug filtern");
  u.classList.add("knopfreihe");
  zeichnen();
  seite(kopf("Gespeicherte Prüfungen", liste.length + " Prüfungen · " + liste.filter((x) => x.ueberwacht?.an).length + " überwacht · " + liste.filter((x) => x.herkunft === "ohne Anmeldung").length + " ohne Anmeldung übernommen",
    h("a.knopf", { href: "/api/pruefungen.csv" }, ic("download", 16), "CSV"), h("a.knopf", { href: "/api/export.json" }, ic("download", 16), "Alle Daten")),
    h("div.tabelle-wrap", u), karte("Verlauf", "neueste zuerst", "inbox", ziel));
}

function seiteWerkzeuge() {
  seite(kopf("Prüfen", "Werkzeug wählen"), h("div.reihe", Object.entries(MODULE).map(([c, m]) => h("a.karte.werkzeugkarte", { href: "#modul/" + c }, h("span.symbolfeld.marke", ic(m.ic, 16)), h("h3", { text: m.name }), h("p", { text: m.sub })))));
}

async function seiteModul(c) {
  const M = MODULE[c];
  if (!M) return seite(h("p.leer", { text: "Unbekanntes Werkzeug." }));
  const form = h("form.karte", { novalidate: true });
  const eingaben = h("div.eingaben");
  const lesen = M.formular(eingaben, vorbelegung(c), Z.ich.grenzen);
  const los = h("button.knopf.haupt", { type: "submit" }, ic("search", 16), "Prüfen");
  eingaben.appendChild(h("div.feldgruppe.schmal", h("span.beschriftung", { "aria-hidden": "true", text: " " }), los));
  form.appendChild(eingaben);
  const erg = h("div.spalte", { "aria-live": "polite" });
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); los.disabled = true;
    const fort = h("section.karte", h("div.fortschritt", h("div.kreisel"), h("div.wachsen", h("b", { text: "Prüfung läuft …" }), h("div.meldung", { text: "" }))));
    leeren(erg).appendChild(fort);
    try {
      const s = await pruefungLaufen(c, lesen(), (st) => { const m = st.meldungen?.[st.meldungen.length - 1]; fort.querySelector(".meldung").textContent = m || ("läuft seit " + Math.round(st.dauer / 1000) + " s"); });
      leeren(erg);
      erg.appendChild(h("div.hinweisfeld.ok", ic("check"), h("span", { text: "Gespeichert · " + s.ergebnis.kurz + " " }), s.pruefungId ? h("a", { href: "#pruefung/" + s.pruefungId, text: "Öffnen und überwachen" }) : null));
      M.zeigen(s.ergebnis, erg);
    } catch (err) { leeren(erg).appendChild(h("div.hinweisfeld.schlecht", ic("alert"), h("span", { text: err.message }))); }
    finally { los.disabled = false; }
  });
  seite(kopf(M.name, M.sub), form, erg);
}

async function seitePruefung(id) {
  const p = await api("/api/pruefungen/" + id);
  const M = MODULE[p.modul];
  const ueberwachbar = !(p.modul === "mail" && p.eingabe?.art !== "domain");
  const takt = h("select.feld", { "aria-label": "Takt" }, TAKTE.filter(([m]) => p.modul === "uptime" || m >= 60).map(([m, n]) => h("option", { value: String(m), selected: p.ueberwacht.takt === m ? true : null, text: n })));
  takt.style.width = "auto"; takt.style.height = "40px";
  const an = h("input", { type: "checkbox", checked: p.ueberwacht.an ? true : null });
  const speichern = async () => { try { await api("/api/pruefungen/" + id, { methode: "PATCH", daten: { ueberwacht: { an: an.checked, takt: Number(takt.value) } } }); meldung(an.checked ? "Überwachung an: " + takt.selectedOptions[0].text : "Überwachung aus"); } catch (e) { meldung(e.message, "fehler"); } };
  an.addEventListener("change", speichern); takt.addEventListener("change", speichern);
  const erneut = h("button.knopf.haupt", { type: "button", disabled: ueberwachbar ? null : true, onclick: async () => {
    erneut.disabled = true; erneut.lastChild.textContent = "läuft …";
    try { const { auftrag } = await api("/api/pruefungen/" + id + "/erneut", { daten: {} }); for (;;) { await new Promise((ok) => setTimeout(ok, 800)); const s = await api("/api/auftrag/" + auftrag); if (s.status === "fertig") break; if (s.status === "fehler") throw new Error(s.fehler); } zeigen(); }
    catch (e) { meldung(e.message, "fehler"); erneut.disabled = false; erneut.lastChild.textContent = "Erneut prüfen"; }
  } }, ic("refresh", 16), "Erneut prüfen");
  const loeschen = h("button.knopf.gefahr", { type: "button", onclick: () => {
    const d = dialog([h("h2", { text: "Prüfung löschen?" }), h("p.leise", { text: "Ergebnis und Verlauf werden entfernt." }), h("div.knopfreihe", h("button.knopf", { type: "button", onclick: () => d.zu() }, "Abbrechen"), h("button.knopf.gefahr", { type: "button", onclick: async () => { await api("/api/pruefungen/" + id, { methode: "DELETE" }); d.zu(); location.hash = "#gespeichert"; } }, "Löschen"))]);
  } }, ic("trash", 16), "Löschen");
  const verlauf = p.verlauf || [];
  const erg = h("div.spalte");
  seite(
    kopf(M.name + " · " + p.ziel, "geprüft " + datum(p.geprueft) + " · " + p.herkunft + (p.ueberwacht.an ? " · nächste Prüfung " + datum(p.ueberwacht.naechste) : ""), erneut, h("button.knopf", { type: "button", onclick: () => window.print() }, ic("print", 16), "Als PDF"), loeschen),
    h("div.reihe.zwei.nicht-drucken",
      karte("Überwachen", ueberwachbar ? "prüft selbst und meldet Änderungen" : "eine einzelne Nachricht wird nicht gespeichert und lässt sich nicht erneut prüfen", "refresh",
        ueberwachbar ? h("div.knopfreihe", h("label.haken", an, "an"), takt, h("span.klein.leise", { text: Z.ich.dienste.mail ? "Alarm an " + (Z.ich.konto.alarmMail || "–") : "Alarme stehen unter Hinweise (Mailversand nicht eingerichtet)" })) : null),
      karte("Verlauf", verlauf.length + " Messungen", "chart", verlauf.length > 1 && verlauf.some((v) => typeof v.wert === "number")
        ? [h("div.verlauf", linie(verlauf.map((v) => v.wert), 600, 120, "#ee5e0b", p.modul === "uptime")), h("div.zeilen", verlauf.slice(-5).reverse().map((v) => h("div.z", h("span.schluessel.wachsen", { text: datum(v.zeit) }), h("span.klein", { text: v.kurz }))))]
        : h("p.leise.klein", { text: "Ab der zweiten Messung steht hier der Verlauf." }))),
    erg);
  M.zeigen(p.ergebnis, erg);
}

async function seiteBerichte() {
  const k = Z.ich.konto;
  const wahl = h("select.feld", k.projekte.map((p) => h("option", { value: p.id, selected: p.id === k.aktivesProjekt ? true : null, text: p.domain })));
  const boxen = Object.entries(MODULE).map(([c, m]) => h("label.haken", h("input", { type: "checkbox", value: c, checked: ["audit", "domain", "uptime", "mail", "ki", "content"].includes(c) ? true : null }), m.name));
  seite(kopf("Berichte", "aus den neuesten Prüfungen eines Projekts"),
    k.projekte.length ? karte("Bericht zusammenstellen", "als Seite zum Drucken oder Speichern als PDF", "chart",
      h("div.eingaben", h("div.feldgruppe", h("label.beschriftung", { text: "Projekt" }), wahl)),
      h("p.beschriftung", { text: "Abschnitte" }), h("div.knopfreihe", boxen),
      h("div.knopfreihe", h("button.knopf.haupt", { type: "button", onclick: () => { location.hash = "#bericht/" + wahl.value + "/" + boxen.map((b) => b.querySelector("input")).filter((x) => x.checked).map((x) => x.value).join(","); } }, ic("eye", 16), "Bericht ansehen"))) : karte("Noch kein Projekt", null, "info", h("p", { text: "Berichte entstehen je Projekt. Bitte zuerst ein Projekt anlegen." })),
    karte("Ausfuhr", null, "download", h("div.knopfreihe", h("a.knopf", { href: "/api/pruefungen.csv" }, ic("download", 16), "Alle Prüfungen als CSV"), h("a.knopf", { href: "/api/export.json" }, ic("download", 16), "Alle Daten als JSON"))));
}

async function seiteBericht(pid, teile) {
  const p = Z.ich.konto.projekte.find((x) => x.id === pid);
  if (!p) return seite(h("p.leer", { text: "Projekt nicht gefunden." }));
  const liste = await api("/api/pruefungen?projekt=" + pid);
  const neueste = {};
  for (const x of liste) if (!neueste[x.modul] || x.geprueft > neueste[x.modul].geprueft) neueste[x.modul] = x;
  const wahl = (teile || "").split(",").filter((c) => MODULE[c]);
  const b = h("article.bericht",
    h("div.knopfreihe", logo(), h("span.wachsen"), h("span.leise.klein", { text: "Stand " + datum(new Date().toISOString()) })),
    h("div", h("h1", { text: "SEO-Bericht · " + p.domain }), h("p.leise", { text: "Zusammenfassung der neuesten Prüfungen" })),
    tabelle([{ t: "WERKZEUG" }, { t: "ERGEBNIS" }, { t: "GEPRÜFT" }], wahl.map((c) => [MODULE[c].name, neueste[c] ? neueste[c].kurz : "noch nicht geprüft", neueste[c] ? datum(neueste[c].geprueft) : "–"])));
  for (const c of wahl) {
    if (!neueste[c]) continue;
    const voll = await api("/api/pruefungen/" + neueste[c].id);
    const z = h("div.spalte");
    MODULE[c].zeigen(voll.ergebnis, z);
    b.appendChild(h("section", h("h2", { text: MODULE[c].name + " · " + voll.ziel }), z));
  }
  b.appendChild(h("p.leise.klein", { text: "Bereitgestellt von hnvr.me · erstellt mit dem SEO Wächter" }));
  seite(kopf("Bericht", p.domain, h("button.knopf.haupt", { type: "button", onclick: () => window.print() }, ic("print", 16), "Als PDF drucken"), h("a.knopf", { href: "#berichte" }, "Zurück")), b);
}

async function seiteEinstellungen() {
  const k = Z.ich.konto, dn = Z.ich.dienste;
  const alarm = feld("alarm", "Alarme gehen an", { typ: "email", wert: k.alarmMail || "" });
  const st = h("div");
  seite(kopf("Einstellungen", k.email),
    h("div.reihe.zwei",
      karte("Alarme", dn.mail ? "Mailversand eingerichtet" : "Mailversand auf diesem Server nicht eingerichtet; Alarme erscheinen nur unter Hinweise", "bell",
        h("div.eingaben", alarm.wrap, h("button.knopf.haupt", { type: "button", onclick: async () => { try { await api("/api/konto", { methode: "PATCH", daten: { alarmMail: alarm.el.value } }); Z.ich = await ich(true); meldung("Gespeichert"); } catch (e) { leeren(st).appendChild(h("div.hinweisfeld.schlecht", h("span", { text: e.message }))); } } }, "Speichern")), st),
      karte("Projekte", k.projekte.length + " von 3", "globe", h("div.zeilen", k.projekte.map((p) => h("div.z", h("span.wachsen", { text: p.domain }), p.id === k.aktivesProjekt ? pille("aktiv", "ok") : h("button.knopf.klein", { type: "button", onclick: async () => { await api("/api/projekte/" + p.id + "/aktiv", { daten: {} }); Z.ich = await ich(true); geruest(); zeigen(); } }, "Aktiv setzen"),
        h("button.knopf.klein.gefahr", { type: "button", onclick: async () => { await api("/api/projekte/" + p.id, { methode: "DELETE" }); Z.ich = await ich(true); geruest(); zeigen(); } }, "Entfernen")))),
        k.projekte.length < 3 ? h("button.knopf", { type: "button", onclick: projektDialog }, ic("plus", 16), "Projekt anlegen") : null)),
    karte("Google Search Console", "kostenlose Positionen, Klicks und Impressionen Ihrer eigenen Websites", "trend",
      !dn.google?.searchConsole ? h("div.hinweisfeld.info", ic("info"), h("span", { text: "Auf diesem Server nicht eingerichtet: Es fehlen GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET." }))
        : k.google ? [kv([["Verbunden seit", datum(k.google.verbunden)], ["Properties", k.google.properties.length ? k.google.properties.join(", ") : "keine bestätigten Websites"]]),
          h("div.knopfreihe", h("a.knopf", { href: "/google/verbinden" }, ic("refresh", 16), "Neu verbinden"), h("button.knopf.gefahr", { type: "button", onclick: async () => { await api("/api/google/trennen", { daten: {} }); Z.ich = await ich(true); zeigen(); meldung("Google-Verbindung getrennt"); } }, "Trennen"))]
          : [h("p.klein", { text: "Rankings für Ihre Projekte kommen dann direkt von Google. Der Wächter liest nur (Bereich webmasters.readonly)." }), h("a.knopf.haupt", { href: "/google/verbinden" }, "Mit Google verbinden")]),
    karte("Datenquellen auf diesem Server", "was eingerichtet ist", "server", kv([
      ["Google PageSpeed (Ladezeit im Audit)", pille(dn.google?.pagespeed ? "eingerichtet" : "nicht eingerichtet", dn.google?.pagespeed ? "ok" : "warn")],
      ["Google Search Console (Rankings)", pille(dn.google?.searchConsole ? "eingerichtet" : "nicht eingerichtet", dn.google?.searchConsole ? "ok" : "warn")],["Mailversand (Anmeldelinks, Alarme)", pille(dn.mail ? "eingerichtet" : "nicht eingerichtet", dn.mail ? "ok" : "warn")], ["Suchdaten (Rankings, Backlinks, KI-Übersicht)", pille(dn.suchdaten ? "eingerichtet" : "nicht eingerichtet", dn.suchdaten ? "ok" : "warn")], ...(dn.ki || []).map((a) => ["KI-Dienst " + a.name, pille(a.bereit ? "eingerichtet" : "nicht eingerichtet", a.bereit ? "ok" : "")])])),
    karte("Ihre Daten", null, "lock", h("div.knopfreihe", h("a.knopf", { href: "/api/export.json" }, ic("download", 16), "Alles herunterladen"),
      h("button.knopf.gefahr", { type: "button", onclick: () => {
        const d = dialog([h("h2", { text: "Konto löschen?" }), h("p.leise", { text: "Konto, Projekte und alle gespeicherten Prüfungen werden sofort und endgültig gelöscht." }), h("div.knopfreihe", h("button.knopf", { type: "button", onclick: () => d.zu() }, "Abbrechen"), h("button.knopf.gefahr", { type: "button", onclick: async () => { await api("/api/konto", { methode: "DELETE" }); location.href = "/"; } }, "Endgültig löschen"))]);
      } }, ic("trash", 16), "Konto löschen"))));
}

/* ---------- Weiche ---------- */
async function zeigen() {
  const pfad = (location.hash || "#uebersicht").slice(1);
  for (const a of document.querySelectorAll("[data-pfad]")) a.setAttribute("aria-current", pfad === a.dataset.pfad || pfad.startsWith(a.dataset.pfad + "/") ? "page" : "false");
  try {
    let r;
    if (pfad === "uebersicht" || pfad === "") await seiteUebersicht();
    else if (pfad === "gespeichert") await seiteGespeichert();
    else if (pfad === "werkzeuge") seiteWerkzeuge();
    else if ((r = /^modul\/(\w+)$/.exec(pfad))) await seiteModul(r[1]);
    else if ((r = /^pruefung\/([\w-]+)$/.exec(pfad))) await seitePruefung(r[1]);
    else if (pfad === "berichte") await seiteBerichte();
    else if ((r = /^bericht\/([\w-]+)\/?([\w,]*)$/.exec(pfad))) await seiteBericht(r[1], r[2]);
    else if (pfad === "einstellungen") await seiteEinstellungen();
    else await seiteUebersicht();
  } catch (e) { seite(kopf("Fehler")); fehlerAnzeigen(e); }
}

(async function () {
  Z.ich = await ich(true);
  if (!Z.ich.konto) { location.href = "/anmelden?weiter=/app"; return; }
  const gq = new URLSearchParams(location.search).get("google");
  if (location.search) history.replaceState(null, "", "/app" + location.hash);
  geruest();
  window.addEventListener("hashchange", zeigen);
  await zeigen();
  if (gq) meldung({ verbunden: "Google Search Console verbunden", abgebrochen: "Google-Verbindung abgebrochen", fehler: "Google hat die Verbindung abgelehnt" }[gq] || gq, gq === "verbunden" ? null : "fehler");
  uebernahmeAnbieten();
})();
