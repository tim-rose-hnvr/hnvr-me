/* seo-rank.me — Die Adresse des Relais einstellen.

   Ein Werkzeug, das etwas abruft, muss sagen wohin. Und wer ein eigenes
   Relais betreibt, muss es eintragen koennen, ohne im Quelltext zu
   suchen. Beides passiert hier, an einer Stelle, sichtbar.

   Gemerkt wird im sessionStorage — wie alles auf dieser Website. Das
   Versprechen lautet, dass mit dem Reiter alles verschwindet. */

(function () {
  "use strict";

  var abschnitt = document.getElementById("relais");
  if (!abschnitt) return;

  var A = (typeof SEORANK_ABRUF !== "undefined") ? SEORANK_ABRUF : null;
  if (!A) return;

  var feld = document.getElementById("rl-adresse");
  var merken = document.getElementById("rl-merken");
  var pruefen = document.getElementById("rl-pruefen");
  var zurueck = document.getElementById("rl-zuruecksetzen");
  var hinweis = document.getElementById("rl-hinweis");
  var stand = document.getElementById("rl-stand");

  function melden(text, warnung) {
    hinweis.textContent = text;
    hinweis.classList.toggle("formhinweis--warn", !!warnung);
  }

  function anzeigen() {
    stand.textContent = A.adresse() + (A.istStandard() ? " (Voreinstellung)" : " (selbst eingetragen)");
    if (!A.istStandard()) feld.value = A.adresse();
  }

  anzeigen();

  merken.addEventListener("click", function () {
    A.merken(feld.value);
    anzeigen();
    melden(feld.value.trim()
      ? "Übernommen. Gilt für diesen Reiter."
      : "Zurückgesetzt auf die Voreinstellung.", false);
  });

  zurueck.addEventListener("click", function () {
    A.merken("");
    feld.value = "";
    anzeigen();
    melden("Zurückgesetzt auf die Voreinstellung.", false);
  });

  feld.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); merken.click(); }
  });

  /* Erreichbarkeit messen, statt sie zu behaupten. Geprueft wird mit
     einer Adresse, die es sicher gibt und die niemandem gehoert. */
  pruefen.addEventListener("click", function () {
    var wohin = A.adresse();
    pruefen.disabled = true;
    melden("Frage " + wohin + " …", false);
    var beginn = Date.now();
    A.holen("https://example.com/", { nurKopf: true }).then(function (d) {
      pruefen.disabled = false;
      var dauer = Date.now() - beginn;
      if (!d.ok) {
        melden(wohin + " antwortet nicht wie erwartet: " + d.fehler, true);
        return;
      }
      melden(wohin + " antwortet — Probeabruf von example.com lieferte Status "
        + d.status + " in " + dauer + " ms.", false);
    });
  });
})();
