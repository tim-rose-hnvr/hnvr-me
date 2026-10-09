/* SEO Waechter · Anmeldung mit Link per Mail. */
"use strict";
(async function () {
  const i = await kopfAnpassen();
  const q = new URLSearchParams(location.search);
  if (i.konto) { location.replace(q.get("weiter") && q.get("weiter").startsWith("/app") ? q.get("weiter") : "/app"); return; }
  const status = document.getElementById("anmelde-status");
  if (q.get("fehler")) status.appendChild(h("div.hinweisfeld.schlecht", { role: "alert" }, ic("alert"), h("span", { text: q.get("fehler") })));
  const n = ohneKonto.lesen().length;
  if (n) document.getElementById("ohne-hinweis").appendChild(h("div.hinweisfeld.info", ic("download"), h("span", { text: "In diesem Browser liegen " + n + (n === 1 ? " Prüfung" : " Prüfungen") + " ohne Konto. Nach dem Anmelden können Sie sie übernehmen." })));
  const f = document.getElementById("anmelden");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const b = f.querySelector("button");
    b.disabled = true;
    leeren(status);
    try {
      const r = await api("/api/anmelden", { daten: { email: f.email.value } });
      status.appendChild(h("div.hinweisfeld.ok", { role: "status" }, ic("send"), h("span", { text: r.versandt ? "Der Link ist unterwegs an " + f.email.value + ". Bitte im Postfach nachsehen." : "Mailversand ist auf diesem Server nicht eingerichtet. Der Link steht im Serverprotokoll." })));
      if (r.devLink) status.appendChild(h("p.klein", h("a", { href: r.devLink, text: "Entwicklungsmodus: Link direkt öffnen" })));
    } catch (err) {
      status.appendChild(h("div.hinweisfeld.schlecht", { role: "alert" }, ic("alert"), h("span", { text: err.message })));
    } finally { b.disabled = false; }
  });
})();
