/* seo-rank.me — Stichwort-Prüfer.

   Beantwortet eine einzige Frage: Steht mein Stichwort dort, wo es zählt?
   Zehn tragende Stellen werden abgeklopft, die Dichte gerechnet und mit dem
   verglichen, wovon die Seite nach ihrem eigenen Text tatsächlich handelt.

   Rechnet mit denselben Messroutinen wie der Regelkatalog (SEORANK_MESSEN),
   damit dieselbe Seite hier und im Seiten-Prüfer dieselben Zahlen ergibt.
   Nichts verlässt den Browser. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("stichwort");
  if (!werkzeug) return;

  var M = (typeof SEORANK_MESSEN !== "undefined") ? SEORANK_MESSEN : null;
  var ANALYSE = (typeof SEORANK_ANALYSE !== "undefined") ? SEORANK_ANALYSE : null;
  var BEWEGUNG = window.SEORANK || null;
  if (!M) return;

  var feldWort = document.getElementById("st-wort");
  var feldText = document.getElementById("st-eingabe");
  var starten = document.getElementById("st-starten");
  var beispiel = document.getElementById("st-beispiel");
  var leeren = document.getElementById("st-leeren");
  var ergebnis = document.getElementById("st-ergebnis");
  var hinweis = document.getElementById("st-hinweis");
  var stellenZiel = document.getElementById("st-stellen");
  var befundZiel = document.getElementById("st-befunde");
  var begriffZiel = document.getElementById("st-begriffe");

  function melden(text, warnung) {
    hinweis.textContent = text;
    hinweis.classList.toggle("formhinweis--warn", !!warnung);
  }

  /* ---------- Vergleichen ----------
     Klein geschrieben, ohne Satzzeichen, Mehrwortfolgen mit einfachem
     Abstand. So findet „Industriewaage kaufen" auch „Industriewaagen
     kaufen?" nicht — Wortformen werden bewusst NICHT geraten. */

  function normal(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-zäöüß0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function enthaelt(wo, wort) {
    return normal(wo).indexOf(wort) !== -1;
  }

  function zaehlen(wo, wort) {
    var text = normal(wo);
    if (!wort) return 0;
    var n = 0, i = text.indexOf(wort);
    while (i !== -1) { n++; i = text.indexOf(wort, i + wort.length); }
    return n;
  }

  /* ---------- Die zehn Stellen ---------- */

  function stellenPruefen(d, wort) {
    var titel = M.seitentitel ? (M.seitentitel(d)[0] || null) : d.querySelector("title");
    var m = d.querySelector('meta[name="description" i]');
    var h1 = d.querySelector("h1");
    var h2 = M.alle(d, "h2, h3, h4, h5, h6").map(function (h) { return h.textContent; }).join(" ");
    var adresse = M.eigeneAdresse ? M.eigeneAdresse(d) : null;
    var text = M.sichtbarerText(d);
    var ersteWorte = text.split(/\s+/).slice(0, 100).join(" ");
    var alts = M.alle(d, "img[alt]").map(function (b) { return b.getAttribute("alt"); }).join(" ");
    var verweise = M.alle(d, "a[href]").map(function (a) { return a.textContent; }).join(" ");
    var betont = M.alle(d, "strong, b, em").map(function (e) { return e.textContent; }).join(" ");
    var ld = M.alle(d, 'script[type="application/ld+json"]').map(function (s) { return s.textContent; }).join(" ");

    return [
      { name: "Titel", gewicht: 5, wert: titel ? titel.textContent : "", fehlt: "kein title-Element" },
      { name: "Beschreibung", gewicht: 3, wert: m ? (m.getAttribute("content") || "") : "", fehlt: "keine description" },
      { name: "Erste Überschrift (h1)", gewicht: 5, wert: h1 ? h1.textContent : "", fehlt: "keine h1" },
      { name: "Weitere Überschriften", gewicht: 2, wert: h2, fehlt: "keine weiteren Überschriften" },
      { name: "Adresse", gewicht: 3, wert: adresse ? decodeURIComponent(adresse.pathname).replace(/[-_/]/g, " ") : "", fehlt: "keine absolute Adresse" },
      { name: "Erste 100 Wörter", gewicht: 4, wert: ersteWorte, fehlt: "kein Text" },
      { name: "Alternativtexte", gewicht: 1, wert: alts, fehlt: "keine Bilder mit alt" },
      { name: "Verweistexte", gewicht: 1, wert: verweise, fehlt: "keine Verweise" },
      { name: "Hervorhebungen", gewicht: 1, wert: betont, fehlt: "nichts hervorgehoben" },
      { name: "Strukturierte Daten", gewicht: 2, wert: ld, fehlt: "kein JSON-LD" }
    ].map(function (st) {
      st.leer = !String(st.wert).trim();
      st.treffer = !st.leer && enthaelt(st.wert, wort);
      return st;
    });
  }

  /* ---------- Zeichnen ---------- */

  function el(name, klasse, text) {
    var k = document.createElement(name);
    if (klasse) k.className = klasse;
    if (text !== undefined && text !== null) k.textContent = String(text);
    return k;
  }

  function stellenZeichnen(stellen, wort) {
    stellenZiel.textContent = "";
    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");

    var kopf = el("thead");
    var kz = el("tr");
    ["Stelle", "Gewicht", "Steht das Stichwort da?", "Was dort steht"].forEach(function (n) {
      kz.appendChild(el("th", null, n));
    });
    kopf.appendChild(kz);
    t.appendChild(kopf);

    var koerper = el("tbody");
    stellen.forEach(function (st) {
      var tr = el("tr");
      tr.appendChild(el("td", null, st.name));
      tr.appendChild(el("td", "tabelle__zahl", st.gewicht));

      var td = el("td");
      if (st.leer) {
        td.appendChild(el("span", "haken", "—"));
      } else if (st.treffer) {
        td.appendChild(el("span", "haken haken--ja", "ja"));
      } else {
        var nein = el("span", "haken haken--nein", "nein");
        td.appendChild(nein);
      }
      tr.appendChild(td);

      var wo = el("td", "still");
      wo.textContent = st.leer ? st.fehlt : ANALYSE.kurz(st.wert, 90);
      tr.appendChild(wo);

      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    stellenZiel.appendChild(rolle);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Verglichen wird kleingeschrieben und ohne Satzzeichen. Wortformen werden nicht "
      + "geraten: „Waage“ findet nicht „Waagen“. Wenn Sie beide Formen abdecken wollen, prüfen Sie beide.";
    stellenZiel.appendChild(fuss);
  }

  function befundZeichnen(befunde) {
    befundZiel.textContent = "";
    if (!befunde.length) {
      befundZiel.appendChild(el("p", "leerstand", "Nichts zu beanstanden: das Stichwort steht an allen tragenden Stellen und die Dichte ist unauffällig."));
      return;
    }
    var rang = { kritisch: 0, wichtig: 1, hinweis: 2 };
    befunde.slice().sort(function (a, b) { return rang[a.stufe] - rang[b.stufe]; }).forEach(function (b) {
      var zeile = el("div", "befund");
      zeile.setAttribute("data-stufe", b.stufe);

      var marker = el("span", "befund__marker marker--" + b.stufe);
      var mitte = el("div");
      mitte.appendChild(el("div", "befund__name", b.name));
      mitte.appendChild(el("p", "befund__wie", b.wie));

      var punkt = el("dl", "befund__detail");
      var d = el("div", "befund__punkt");
      d.appendChild(el("dt", null, "Was zu tun ist"));
      d.appendChild(el("dd", null, b.beheben));
      punkt.appendChild(d);
      mitte.appendChild(punkt);

      zeile.appendChild(marker);
      zeile.appendChild(mitte);
      zeile.appendChild(el("span", "befund__stufe befund__stufe--" + b.stufe, b.stufe === "gut" ? "bestanden" : b.stufe));
      befundZiel.appendChild(zeile);
    });
    if (BEWEGUNG) BEWEGUNG.staffeln(befundZiel.querySelectorAll(".befund"));
  }

  function begriffeZeichnen(liste, wort) {
    begriffZiel.textContent = "";
    if (!liste.length) {
      begriffZiel.appendChild(el("p", "leerstand", "Zu wenig Text für eine Auswertung."));
      return;
    }
    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead"), kz = el("tr");
    ["Rang", "Begriff", "Anzahl", "Anteil", "Ihr Stichwort?"].forEach(function (n) { kz.appendChild(el("th", null, n)); });
    kopf.appendChild(kz); t.appendChild(kopf);

    var koerper = el("tbody");
    liste.forEach(function (w, i) {
      var tr = el("tr");
      tr.appendChild(el("td", "tabelle__zahl", i + 1));
      tr.appendChild(el("td", null, w.wort));
      tr.appendChild(el("td", "tabelle__zahl", w.anzahl));
      tr.appendChild(el("td", "tabelle__zahl", w.dichte.toFixed(2).replace(".", ",") + " %"));
      var td = el("td");
      td.appendChild(el("span", w.wort === wort ? "haken haken--ja" : "haken", w.wort === wort ? "ja" : "—"));
      tr.appendChild(td);
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    begriffZiel.appendChild(rolle);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Wovon die Seite nach ihrem eigenen Text handelt. Steht Ihr Stichwort hier weit unten "
      + "oder gar nicht, behandelt die Seite ein anderes Thema als geplant — das ist der wichtigere Befund "
      + "als jede Dichtezahl. Der Anteil rechnet gegen die gezählten Begriffe (ohne Füllwörter), die Dichte "
      + "oben gegen alle sichtbaren Wörter. Deshalb weichen die beiden Zahlen voneinander ab.";
    begriffZiel.appendChild(fuss);
  }

  function setzen(id, wert) {
    var k = document.getElementById(id);
    if (!k) return;
    k.textContent = String(wert);
  }

  /* ---------- Lauf ---------- */

  function laufen() {
    var wort = normal(feldWort.value);
    var roh = feldText.value.trim();

    if (!wort) { melden("Bitte ein Stichwort eingeben.", true); feldWort.focus(); return; }
    if (!roh) { melden("Bitte den Quelltext der Seite einfügen.", true); feldText.focus(); return; }

    var d = new DOMParser().parseFromString(roh, "text/html");
    var stellen = stellenPruefen(d, wort);

    var text = M.sichtbarerText(d);
    var woerter = text.split(/\s+/).filter(Boolean).length;
    var wortAnzahl = wort.split(" ").length;
    var vorkommen = zaehlen(text, wort);
    var dichte = woerter ? (vorkommen * wortAnzahl / woerter) * 100 : 0;

    var getroffen = stellen.filter(function (s) { return s.treffer; });
    var moeglich = stellen.reduce(function (s, x) { return s + x.gewicht; }, 0);
    var erreicht = getroffen.reduce(function (s, x) { return s + x.gewicht; }, 0);
    var deckung = moeglich ? Math.round((erreicht / moeglich) * 100) : 0;

    /* ---------- Befunde ---------- */
    var befunde = [];
    function befund(stufe, name, wie, beheben) { befunde.push({ stufe: stufe, name: name, wie: wie, beheben: beheben }); }

    if (vorkommen === 0) {
      befund("kritisch", "Stichwort kommt im Text nicht vor",
        "Im sichtbaren Text der Seite steht „" + wort + "“ kein einziges Mal.",
        "Entweder das Stichwort ändern — oder die Seite so schreiben, dass sie die Frage dahinter wirklich beantwortet. Ein Stichwort nachträglich einzustreuen hilft nicht.");
    }

    function fehlt(name, stufe, wie, beheben) {
      var st = stellen.filter(function (x) { return x.name === name; })[0];
      if (st && !st.treffer && !st.leer) befund(stufe, name + " ohne Stichwort", wie, beheben);
      if (st && st.leer) befund(stufe === "kritisch" ? "wichtig" : stufe, name + " fehlt ganz",
        "Diese Stelle gibt es auf der Seite nicht: " + st.fehlt + ".",
        "Erst anlegen, dann das Stichwort unterbringen.");
    }

    fehlt("Titel", "wichtig",
      "Der Titel nennt das Stichwort nicht. Er ist die eine Zeile, die in der Trefferliste fett steht.",
      "Das Stichwort nach vorn in den Titel setzen, ohne den Satz zu zerstören.");
    fehlt("Erste Überschrift (h1)", "wichtig",
      "Die Hauptüberschrift nennt das Stichwort nicht. Wer über die Trefferliste kommt, sucht es oben auf der Seite.",
      "Die h1 so formulieren, dass sie das Stichwort natürlich enthält.");
    fehlt("Erste 100 Wörter", "wichtig",
      "In den ersten hundert Wörtern kommt das Stichwort nicht vor.",
      "Den ersten Absatz so schreiben, dass er die Frage direkt beantwortet — dabei fällt das Stichwort von selbst.");
    fehlt("Beschreibung", "hinweis",
      "Die Beschreibung nennt das Stichwort nicht.",
      "Die description umformulieren: zwei Sätze, die das Stichwort enthalten und sagen, was die Seite liefert.");
    fehlt("Adresse", "hinweis",
      "Die Adresse enthält das Stichwort nicht.",
      "Beim nächsten Umbau den Pfad sprechend machen und die alte Adresse mit 301 umleiten. Eine bestehende Adresse nur dafür zu ändern lohnt selten.");

    if (dichte > 4) {
      befund("hinweis", "Sehr hohe Dichte",
        "Das Stichwort macht " + dichte.toFixed(1).replace(".", ",") + " % des Textes aus.",
        "Wiederholungen durch Umschreibungen ersetzen. Häufigkeit war nie ein Rangfaktor, liest sich aber sofort unnatürlich.");
    } else if (woerter > 300 && dichte > 0 && dichte < 0.3) {
      befund("hinweis", "Sehr niedrige Dichte",
        "Bei " + woerter + " Wörtern kommt das Stichwort nur " + vorkommen + "-mal vor.",
        "Kein Grund zum Stopfen — aber prüfen, ob die Seite das Thema wirklich behandelt oder nur streift.");
    }

    var feld = ANALYSE ? ANALYSE.wortfeld(d, wortAnzahl, 10) : [];
    if (feld.length && feld[0].wort !== wort && vorkommen > 0) {
      befund("hinweis", "Ein anderer Begriff führt",
        "Häufigster Begriff der Seite ist „" + feld[0].wort + "“, nicht Ihr Stichwort.",
        "Das ist nicht zwingend falsch — aber wenn die Seite für Ihr Stichwort gefunden werden soll, sollte es auch ihr Hauptthema sein.");
    }

    /* ---------- Anzeigen ---------- */
    if (BEWEGUNG) {
      BEWEGUNG.zaehlen(document.getElementById("st-deckung"), deckung, function (n) { return n + " %"; });
      BEWEGUNG.zaehlen(document.getElementById("st-vorkommen"), vorkommen);
      BEWEGUNG.zaehlen(document.getElementById("st-stellenzahl"), getroffen.length, function (n) { return n + " / 10"; });
    } else {
      setzen("st-deckung", deckung + " %");
      setzen("st-vorkommen", vorkommen);
      setzen("st-stellenzahl", getroffen.length + " / 10");
    }
    setzen("st-dichte", dichte.toFixed(2).replace(".", ",") + " %");

    stellenZeichnen(stellen, wort);
    befundZeichnen(befunde);
    begriffeZeichnen(feld, wort);

    ergebnis.hidden = false;
    melden("Geprüft im Browser: " + woerter.toLocaleString("de-DE") + " Wörter Text. Nichts hat dieses Fenster verlassen.", false);
  }

  starten.addEventListener("click", laufen);
  [feldWort, feldText].forEach(function (f) {
    f.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") laufen();
    });
  });

  if (leeren) {
    leeren.addEventListener("click", function () {
      feldWort.value = "";
      feldText.value = "";
      ergebnis.hidden = true;
      melden("", false);
      feldWort.focus();
    });
  }

  if (beispiel) {
    beispiel.addEventListener("click", function () {
      feldWort.value = "industriewaage";
      feldText.value = (typeof SEORANK_BEISPIEL !== "undefined") ? SEORANK_BEISPIEL : "";
      laufen();
    });
  }

  if (BEWEGUNG) {
    BEWEGUNG.eingabeMerken(feldWort, "seorank-stichwort-wort");
    BEWEGUNG.eingabeMerken(feldText, "seorank-stichwort-text");
  }
})();
