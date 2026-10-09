/* SEO Waechter · Startseite: Schnellpruefung leitet auf das gewaehlte Werkzeug. */
"use strict";
(async function () {
  await kopfAnpassen();
  const f = document.getElementById("schnell");
  if (!f) return;
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = f.url.value.trim();
    if (!url) { f.url.focus(); return; }
    const modul = f.modul.value;
    const p = new URLSearchParams({ los: "1" });
    if (modul === "domain") p.set("domain", url); else p.set("url", url);
    location.href = "/werkzeug/" + modul + "?" + p.toString();
  });
})();
