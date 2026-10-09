/* seo-rank.me — Die Startseite.

   Zwei Aufgaben:
   1. Das Feld nimmt Adresse oder Quelltext und gibt beides an das
      Protokoll weiter — ueber sessionStorage, NIE ueber die Adresse.
      Eingaben gehoeren nicht in eine URL.
      Es gibt absichtlich kein form-Element: ohne Absenden kann auch
      ohne Skript nichts in der Adresszeile landen.
   2. Die Protokollprobe: der Regelkatalog laeuft beim Laden ueber die
      Beispielseite. Keine Demozahl, eine echte Messung. Faellt das Skript
      aus, steht dort ein Strich und der Satz, dass gemessen wird. */

(function () {
  "use strict";

  var A = (typeof SEORANK_ABRUF !== "undefined") ? SEORANK_ABRUF : null;
  var K = (typeof SEORANK_KATALOG !== "undefined") ? SEORANK_KATALOG : null;
  var ANALYSE = (typeof SEORANK_ANALYSE !== "undefined") ? SEORANK_ANALYSE : null;
  var BEISPIEL = (typeof SEORANK_BEISPIEL !== "undefined") ? SEORANK_BEISPIEL : "";
  var BEW = window.SEORANK || null;

  function $(id) { return document.getElementById(id); }
  function merken(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ohne Speicher */ } }

  /* ---------- 1. Eingabe und Uebergabe ---------- */

  var formular = $("startformular");
  var feld = $("s-eingabe");
  if (formular && feld) {
    var erkannt = $("s-erkannt");
    var zusage = $("s-zusage");
    var domain = $("s-umfang-domain");

    var erkennen = function (t) {
      if (A) return A.erkennen(t);
      t = String(t || "").trim();
      return t ? (/[<>]/.test(t) ? { art: "quelltext", zeichen: t.length } : { art: "unklar" }) : { art: "leer" };
    };

    var umfang = function () {
      var r = formular.querySelector('input[name="s-umfang"]:checked');
      return r ? r.value : "seite";
    };

    var aktualisieren = function () {
      var e = erkennen(feld.value);
      feld.classList.toggle("hauptfeld__eingabe--quelltext", e.art === "quelltext");
      domain.disabled = e.art !== "adresse";
      if (domain.disabled && domain.checked) formular.querySelector('input[name="s-umfang"][value="seite"]').checked = true;
      erkannt.classList.remove("hauptfeld__erkannt--warn");
      if (e.art === "leer") erkannt.textContent = "Eine Adresse wird über das Relais geholt, eingefügter Quelltext bleibt hier.";
      else if (e.art === "quelltext") erkannt.textContent = "Erkannt: Quelltext, " + e.zeichen.toLocaleString("de-DE") + " Zeichen.";
      else if (e.art === "adresse") erkannt.textContent = "Erkannt: Adresse " + e.url;
      else { erkannt.textContent = "Weder eine Adresse noch HTML erkannt."; erkannt.classList.add("hauptfeld__erkannt--warn"); }

      var relais = A ? A.adresse() : "—";
      zusage.textContent = e.art === "adresse"
        ? (umfang() === "domain"
          ? "Beim Prüfen gehen Adresse und Domain an das Relais " + relais + ", DNS-Anfragen an cloudflare-dns.com, die Registrierung an rdap.org."
          : "Beim Prüfen geht die Adresse an das Relais " + relais + ". Geurteilt wird im Browser.")
        : "Eingefügter Quelltext verlässt diesen Browser nicht.";

      feld.style.height = "auto";
      feld.style.height = Math.min(feld.scrollHeight, 260) + "px";
    };

    feld.addEventListener("input", aktualisieren);
    Array.prototype.forEach.call(formular.querySelectorAll('input[name="s-umfang"]'), function (r) {
      r.addEventListener("change", aktualisieren);
    });

    feld.addEventListener("keydown", function (e) {
      var art = erkennen(feld.value).art;
      if (e.key === "Enter" && !e.shiftKey && (art === "adresse" || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        uebergeben();
      }
    });

    var uebergeben = function () {
      var art = erkennen(feld.value).art;
      if (art === "leer" || art === "unklar") {
        erkannt.textContent = art === "leer" ? "Bitte eine Adresse oder einen Quelltext eingeben." : "Das ist weder eine Adresse noch HTML.";
        erkannt.classList.add("hauptfeld__erkannt--warn");
        feld.focus();
        return;
      }
      /* Dieselben Schluessel, die das Protokoll selbst benutzt. */
      merken("seorank-pruefer", feld.value.trim());
      merken("seorank-umfang", umfang());
      merken("seorank-sofort", "1");
      window.location.href = "pruefer.html";
    };
    $("s-starten").addEventListener("click", uebergeben);

    aktualisieren();
  }

  /* ---------- 2. Die Protokollprobe ---------- */

  var liste = $("probe-liste");
  if (!liste || !K || !ANALYSE || !BEISPIEL) return;

  var RANG = { kritisch: 0, wichtig: 1, hinweis: 2 };
  var d = new DOMParser().parseFromString(BEISPIEL, "text/html");
  var befunde = [];
  K.forEach(function (regel) {
    var treffer;
    try { treffer = regel.pruefe(d, BEISPIEL); } catch (e) { treffer = null; }
    if (treffer) befunde.push({ id: regel.id, name: regel.name, stufe: regel.stufe, wie: treffer.wie, gruppe: regel.gruppe, gewicht: regel.gewicht });
  });
  var punkte = ANALYSE.punktzahl(K, befunde, {});

  var zahl = function (id, n) {
    var k = $(id);
    if (BEW && BEW.zaehlen) BEW.zaehlen(k, n); else k.textContent = String(n);
  };
  zahl("probe-wert", punkte.gesamt);
  $("probe-skala").style.width = punkte.gesamt + "%";
  $("probe-verloren").textContent = punkte.verloren + " von " + punkte.moeglich + " Gewichtspunkten verloren. Keine Kurve, kein Bonus.";
  zahl("probe-kritisch", befunde.filter(function (b) { return b.stufe === "kritisch"; }).length);
  zahl("probe-wichtig", befunde.filter(function (b) { return b.stufe === "wichtig"; }).length);
  zahl("probe-hinweise", befunde.filter(function (b) { return b.stufe === "hinweis"; }).length);

  befunde.sort(function (a, b) { return RANG[a.stufe] - RANG[b.stufe] || b.gewicht - a.gewicht; });
  befunde.slice(0, 3).forEach(function (b) {
    var li = document.createElement("li");
    li.className = "bzeile bzeile--zuerst";
    li.setAttribute("data-stufe", b.stufe);
    var a = document.createElement("a");
    a.className = "bzeile__knopf";
    a.href = "pruefer.html#beispiel";
    var st = document.createElement("span");
    st.className = "befund__stufe befund__stufe--" + b.stufe;
    st.textContent = b.stufe;
    var inhalt = document.createElement("span");
    inhalt.className = "bzeile__inhalt";
    var n = document.createElement("span");
    n.className = "bzeile__name";
    n.textContent = b.name;
    var w = document.createElement("span");
    w.className = "bzeile__wie";
    w.textContent = b.wie;
    inhalt.appendChild(n);
    inhalt.appendChild(w);
    var ber = document.createElement("span");
    ber.className = "bzeile__bereich";
    ber.textContent = b.gruppe;
    var g = document.createElement("span");
    g.className = "bzeile__gewicht";
    g.textContent = String(b.gewicht);
    var pf = document.createElement("span");
    pf.className = "bzeile__pfeil";
    pf.setAttribute("aria-hidden", "true");
    pf.textContent = "→";
    [st, inhalt, ber, g, pf].forEach(function (x) { a.appendChild(x); });
    li.appendChild(a);
    liste.appendChild(li);
  });
})();
