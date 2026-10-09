/* seo-rank.me — eine Pruefung aus dem Protokoll ablegen.

   Diese Datei haengt sich an ein fertiges Protokoll, statt es zu
   aendern. `protokoll.js` hat 43 KB und eine Aufgabe; ein Konto ist
   nicht seine. Alles, was hier gebraucht wird, steht schon da:

   - Wert und die vier Zahlen im gezeichneten Kopf,
   - das Ziel in `p-ziel`,
   - die Regelkennungen in `sessionStorage` unter
     `seorank-protokoll-vorher` — dort legt `protokoll.js` sie nach
     jedem Lauf ab, damit „erneut pruefen" vergleichen kann.
     GEMESSEN an der Beispielseite: 56 Kennungen, Ziel
     `quelltext:/waagen/industrie`.

   Der Knopf steht im Ergebniskopf und ist damit genau dann da, wenn es
   etwas abzulegen gibt — der Kopf selbst erscheint erst nach einem
   Lauf. Wer nicht angemeldet ist, wird nicht angeschwindelt: der Knopf
   sagt dann, dass es ein Konto braucht, und fuehrt dorthin. */

(function () {
  "use strict";

  var knopf = document.getElementById("p-ablegen");
  if (!knopf || typeof SEORANK_KONTO === "undefined") return;

  var K = SEORANK_KONTO;
  var meldung = document.getElementById("p-ablegen-meldung");

  function sagen(text, warnt) {
    if (!meldung) return;
    meldung.textContent = text || "";
    meldung.hidden = !text;
    meldung.classList.toggle("formhinweis--warn", !!warnt);
  }

  function zahl(id) {
    var e = document.getElementById(id);
    var n = e ? parseInt(e.textContent, 10) : 0;
    return isNaN(n) ? 0 : n;
  }

  function beschriften() {
    knopf.textContent = K.angemeldet() ? "prüfung ablegen" : "ablegen braucht ein konto";
  }

  /* Was abgelegt wird. Nicht der Quelltext — siehe `ausBefund` in
     konto.js; hier wird nur eingesammelt, was schon auf dem Schirm
     steht. */
  function befundSammeln() {
    var vorher = null;
    try { vorher = JSON.parse(sessionStorage.getItem("seorank-protokoll-vorher") || "null"); }
    catch (e) { vorher = null; }

    var zielFeld = document.getElementById("p-ziel");
    var domainWahl = document.getElementById("p-umfang-domain");

    return {
      adresse: (vorher && vorher.ziel) || (zielFeld ? zielFeld.textContent.trim() : ""),
      titel: zielFeld ? zielFeld.textContent.trim() : "",
      umfang: domainWahl && domainWahl.checked ? "domain" : "seite",
      wert: zahl("p-wert"),
      kritisch: zahl("p-kritisch"),
      wichtig: zahl("p-wichtig"),
      hinweise: zahl("p-hinweise"),
      regeln: (vorher && vorher.ids) || []
    };
  }

  knopf.addEventListener("click", function () {
    if (!K.angemeldet()) {
      sagen("Für die Ablage braucht es ein Konto. Die Prüfung selbst läuft ohne.", false);
      location.href = "konto.html#anmelden";
      return;
    }
    var b = befundSammeln();
    if (!b.regeln.length && !b.wert) {
      sagen("Erst prüfen, dann ablegen.", true);
      return;
    }
    knopf.disabled = true;
    sagen("Wird abgelegt …");
    K.pruefungSpeichern(b).then(function (e) {
      knopf.disabled = false;
      if (!e.ok) { sagen(e.fehler || "Ablegen ging nicht.", true); return; }
      sagen("Abgelegt. Im Konto steht sie in der Liste.", false);
    });
  });

  beschriften();
  K.beiWechsel(beschriften);
})();
