/* SEO Waechter · oeffentliche Werkzeugseite: ohne Anmeldung nutzbar. */
"use strict";

(async function () {
  const code = document.body.dataset.modul;
  const M = MODULE[code];
  const ziel = document.getElementById("werkzeug");
  if (!M || !ziel) return;
  const i = await kopfAnpassen();
  const g = i.grenzen || {};
  const q = Object.fromEntries(new URLSearchParams(location.search));
  if (q.vergleich) q.vergleich = q.vergleich.split(",");
  if (q.mitbewerber) q.mitbewerber = q.mitbewerber.split(",");
  if (q.endungen) q.endungen = q.endungen.split(",");
  if (i.konto) { const p = document.getElementById("status-pille"); p.textContent = "mit Konto · wird gespeichert"; }

  const form = h("form.karte", { novalidate: true, "aria-label": M.name + " starten" });
  const eingaben = h("div.eingaben");
  const lesen = M.formular(eingaben, q, g);
  const los = h("button.knopf.haupt", { type: "submit" }, ic("search", 16), "Prüfen");
  eingaben.appendChild(h("div.feldgruppe.schmal", h("span.beschriftung", { "aria-hidden": "true", text: " " }), los));
  form.appendChild(eingaben);

  const links = h("div.spalte", { id: "ergebnis", "aria-live": "polite" });
  const rechts = h("aside.spalte.nicht-drucken", { "aria-label": "Speichern und weitere Werkzeuge" });
  einhaengen(ziel, [form, h("div.raster-ergebnis", links, rechts)]);

  function randspalte(pruefungId) {
    leeren(rechts);
    if (i.konto) {
      rechts.appendChild(karte("Im Konto", i.konto.email, "inbox",
        h("p.klein", { text: pruefungId ? "Diese Prüfung ist gespeichert. Im Dashboard können Sie sie überwachen lassen." : "Jede Prüfung landet automatisch unter „Gespeichert“." }),
        h("div.knopfreihe", pruefungId ? h("a.knopf.haupt", { href: "/app#pruefung/" + pruefungId }, ic("gauge", 16), "Im Dashboard öffnen") : h("a.knopf.haupt", { href: "/app" }, "Zum Dashboard"),
          h("button.knopf.klein", { type: "button", onclick: () => window.print() }, ic("print", 14), "Als PDF"))));
    } else {
      const n = ohneKonto.lesen().length;
      rechts.appendChild(karte("Ohne Anmeldung", null, "lock",
        h("p.klein", { text: "Das Ergebnis bleibt nur in diesem Browser. Kein Konto, kein Cookie zur Wiedererkennung." }),
        h("a.knopf.haupt.breit", { href: "/anmelden?weiter=" + encodeURIComponent("/app") }, ic("download", 16), "Im Konto speichern"),
        h("div.knopfreihe", h("button.knopf.klein", { type: "button", onclick: () => window.print() }, ic("print", 14), "Als PDF"), h("button.knopf.klein", { type: "button", onclick: () => form.requestSubmit() }, ic("refresh", 14), "Erneut prüfen")),
        h("p.klein.leise", { text: "Mit Konto zusätzlich:" }),
        h("ul.liste-haken.klein", M.plus.map((p) => h("li", { text: " " + p }))),
        n ? h("p.klein.leise", { text: n + (n === 1 ? " Prüfung liegt" : " Prüfungen liegen") + " in diesem Browser und werden beim Anmelden angeboten." }) : null));
    }
    rechts.appendChild(karte("Weitere Werkzeuge", null, null, h("div.zeilen", Object.entries(MODULE).filter(([k]) => k !== code).slice(0, 6).map(([k, m]) =>
      h("a.z", { href: "/werkzeug/" + k }, h("span.symbolfeld.marke", ic(m.ic, 15)), h("span.wachsen", { text: m.name }), ic("chevR", 14))))));
  }
  randspalte(null);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const eingabe = lesen();
    los.disabled = true;
    leeren(links);
    const fort = h("section.karte", h("div.fortschritt", h("div.kreisel", { role: "progressbar", "aria-label": "Prüfung läuft" }), h("div.wachsen", h("b", { text: "Prüfung läuft …" }), h("div.meldung", { text: "wird gestartet" }))));
    links.appendChild(fort);
    try {
      const s = await pruefungLaufen(code, eingabe, (st) => {
        const m = st.meldungen && st.meldungen[st.meldungen.length - 1];
        fort.querySelector(".meldung").textContent = m || ("läuft seit " + Math.round(st.dauer / 1000) + " s");
      });
      leeren(links);
      const r = s.ergebnis;
      links.appendChild(h("div.seitenkopf", h("div.wachsen", h("h2", { text: "Ergebnis für " + r.ziel }), h("p", { text: "geprüft am " + datum(r.zeit) + (r.kurz ? " · " + r.kurz : "") }))));
      M.zeigen(r, links);
      if (!i.konto) {
        const gespeichert = ohneKonto.dazu({ modul: code, eingabe: code === "mail" ? { art: eingabe.art, domain: eingabe.domain } : eingabe, ergebnis: r, zeit: r.zeit });
        if (!gespeichert) meldung("Der Browser erlaubt kein Ablegen. Das Ergebnis geht beim Schließen verloren.");
      }
      randspalte(s.pruefungId);
      if (code !== "mail") {
        const p = new URLSearchParams();
        for (const [k, v] of Object.entries(eingabe)) if (v && typeof v !== "object" && k !== "text") p.set(k, v); else if (Array.isArray(v) && v.length) p.set(k, v.join(","));
        history.replaceState(null, "", location.pathname + "?" + p.toString());
      }
      links.querySelector("h2").focus?.();
    } catch (err) {
      leeren(links).appendChild(h("div.hinweisfeld.schlecht", { role: "alert" }, ic("alert"), h("span", { text: err.message })));
    } finally { los.disabled = false; }
  });
  if (q.los === "1") form.requestSubmit();
})();
