/* seo-rank.me — Werkzeuge, die im Browser rechnen.
   Kein Server, kein Konto, nichts verlaesst dieses Fenster.
   Enthaelt zwei Maschinen: robots.txt-Pruefer und Sitemap-Pruefer.
   Ihre Urteile kommen aus pruefwerk.js; hier wird nur gezeichnet. */

(function () {
  "use strict";

  /* =========================================================
     Gemeinsames
     ========================================================= */

  var messflaeche = document.createElement("canvas").getContext("2d");

  function pixelbreite(text, schrift) {
    messflaeche.font = schrift;
    return Math.round(messflaeche.measureText(text).width);
  }

  function kuerzeln(text, laenge) {
    text = String(text).replace(/\s+/g, " ").trim();
    return text.length > laenge ? text.slice(0, laenge) + "…" : text;
  }

  var RANG = { kritisch: 0, wichtig: 1, hinweis: 2, gut: 3 };

  function befundKnoten(b) {
    var zeile = document.createElement("div");
    zeile.className = "befund";
    zeile.setAttribute("data-stufe", b.stufe);

    var marker = document.createElement("span");
    marker.className = "befund__marker marker--" + (b.stufe === "gut" ? "hinweis" : b.stufe);
    if (b.stufe === "gut") marker.style.background = "var(--gut)";
    if (b.stufe === "gut") marker.style.border = "none";

    var mitte = document.createElement("div");
    var name = document.createElement("div");
    name.className = "befund__name";
    name.textContent = b.name;
    mitte.appendChild(name);

    var wie = document.createElement("p");
    wie.className = "befund__wie";
    wie.textContent = b.wie;
    mitte.appendChild(wie);

    if (b.fund) {
      var fund = document.createElement("code");
      fund.className = "befund__fund";
      fund.textContent = b.fund;
      mitte.appendChild(fund);
    }

    /* Jede Zeile bekommt eine Leiste fuer ihre Handlungen. Der Fundzeiger
       wird spaeter hier eingehaengt, damit beide nebeneinander stehen. */
    var aktionen = document.createElement("div");
    aktionen.className = "befund__aktionen";
    mitte.appendChild(aktionen);

    /* Aufklappung nur, wenn die Regel etwas zu sagen hat. Der robots- und
       der Sitemap-Pruefer liefern Befunde ohne Katalogangaben. */
    if (b.wozu || b.beheben) {
      var detail = document.createElement("dl");
      detail.className = "befund__detail";
      detail.hidden = true;

      if (b.wozu) detail.appendChild(detailPunkt("Warum das zählt", b.wozu));
      if (b.beheben) detail.appendChild(detailPunkt("Was zu tun ist", b.beheben));

      var marken = document.createElement("div");
      marken.className = "befund__marken";
      if (b.wirkung) marken.appendChild(marke("wirkt auf: " + b.wirkung, true));
      if (b.gewicht) marken.appendChild(marke("Gewicht " + b.gewicht + " von 5"));
      marken.appendChild(marke(b.id));
      if (b.braucht) marken.appendChild(marke("braucht vollständiges Dokument"));
      detail.appendChild(marken);

      var schalter = document.createElement("button");
      schalter.type = "button";
      schalter.className = "fundzeiger";
      schalter.textContent = "was das heißt";
      schalter.setAttribute("aria-expanded", "false");
      schalter.addEventListener("click", function () {
        aufklappen(zeile, detail.hidden);
      });
      aktionen.appendChild(schalter);

      mitte.appendChild(detail);
    }

    var stufe = document.createElement("span");
    stufe.className = "befund__stufe befund__stufe--" + b.stufe;
    stufe.textContent = b.stufe === "gut" ? "bestanden" : b.stufe;

    zeile.appendChild(marker);
    zeile.appendChild(mitte);
    zeile.appendChild(stufe);
    return zeile;
  }

  function detailPunkt(name, inhaltHtml) {
    var punkt = document.createElement("div");
    punkt.className = "befund__punkt";
    var dt = document.createElement("dt");
    dt.textContent = name;
    var dd = document.createElement("dd");
    /* Die Texte stammen aus dem eigenen Regelkatalog und enthalten <code>. */
    dd.innerHTML = inhaltHtml;
    punkt.appendChild(dt);
    punkt.appendChild(dd);
    return punkt;
  }

  function marke(text, betont) {
    var s = document.createElement("span");
    s.className = "befund__marke" + (betont ? " befund__marke--wirkung" : "");
    s.textContent = text;
    return s;
  }

  /* Auf- und Zuklappen an einer Stelle, damit Schalter und Inhalt nie
     auseinanderlaufen. Der sichtbare Zustand ist die Wahrheit. */
  function aufklappen(zeile, offen) {
    var detail = zeile.querySelector(".befund__detail");
    var schalter = zeile.querySelector(".befund__aktionen .fundzeiger");
    if (!detail || !schalter) return;
    detail.hidden = !offen;
    schalter.setAttribute("aria-expanded", String(offen));
    schalter.textContent = offen ? "wieder zuklappen" : "was das heißt";
  }

  function befundeZeichnen(ziel, befunde, leertext) {
    ziel.textContent = "";

    if (!befunde.length) {
      var leer = document.createElement("p");
      leer.className = "leerstand";
      leer.textContent = leertext;
      ziel.appendChild(leer);
      return;
    }

    befunde
      .slice()
      .sort(function (a, b) { return RANG[a.stufe] - RANG[b.stufe]; })
      .forEach(function (b) { ziel.appendChild(befundKnoten(b)); });
  }

  function zaehlen(befunde, stufe) {
    return befunde.filter(function (b) { return b.stufe === stufe; }).length;
  }

  function setzeText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function filterAnschliessen(leisteId, zielId, standId) {
    var leiste = document.getElementById(leisteId);
    var ziel = document.getElementById(zielId);
    if (!leiste || !ziel) return function () {};

    function anwenden(stufe) {
      var sichtbar = 0;
      var alle = ziel.querySelectorAll(".befund");
      Array.prototype.forEach.call(alle, function (b) {
        var passt = stufe === "alle" || b.getAttribute("data-stufe") === stufe;
        b.hidden = !passt;
        if (passt) sichtbar++;
      });
      Array.prototype.forEach.call(leiste.querySelectorAll(".filter[data-stufe]"), function (k) {
        k.setAttribute("aria-pressed", String(k.getAttribute("data-stufe") === stufe));
      });
      setzeText(standId, sichtbar + " von " + alle.length + " Befunden");
    }

    Array.prototype.forEach.call(leiste.querySelectorAll(".filter[data-stufe]"), function (k) {
      k.addEventListener("click", function () { anwenden(k.getAttribute("data-stufe")); });
    });

    return function () { anwenden("alle"); };
  }

  /* Der Seiten-Pruefer steht seit dem 22.09.2026 in protokoll.js. */

  /* =========================================================
     2. robots.txt-Pruefer
     ========================================================= */

  (function robotsPruefer() {
    var werkzeug = document.getElementById("robots");
    if (!werkzeug) return;

    /* Die robots-Regeln liegen in einer eigenen Datei, die nur robots.html
       laedt. Erst nachsehen, dann zugreifen: sonst reisst ein Zugriff auf
       eine fehlende Datei alles mit, was in dieser Datei danach steht. */
    if (typeof SEORANK_ROBOTS === "undefined") return;
    var robotsLesen = SEORANK_ROBOTS.lesen;
    var gruppeFuer = SEORANK_ROBOTS.gruppeFuer;
    var robotsEntscheiden = SEORANK_ROBOTS.entscheiden;

    var feld = document.getElementById("r-eingabe");
    var urlFeld = document.getElementById("r-url");
    var agentFeld = document.getElementById("r-agent");
    var starten = document.getElementById("r-starten");
    var beispiel = document.getElementById("r-beispiel");
    var ergebnis = document.getElementById("r-ergebnis");
    var urteil = document.getElementById("r-urteil");
    var urteilWort = document.getElementById("r-urteil-wort");
    var urteilGrund = document.getElementById("r-urteil-grund");
    var liste = document.getElementById("r-befunde");
    var hinweis = document.getElementById("r-hinweis");

    function pfadAus(eingabe) {
      var wert = eingabe.trim();
      if (!wert) return "/";
      if (/^https?:\/\//i.test(wert)) {
        try {
          var u = new URL(wert);
          return u.pathname + u.search;
        } catch (e) { return wert; }
      }
      return wert.charAt(0) === "/" ? wert : "/" + wert;
    }

    function laufen() {
      var roh = feld.value;
      if (!roh.trim()) {
        hinweis.textContent = "Bitte den Inhalt der robots.txt einfügen.";
        hinweis.classList.add("formhinweis--warn");
        return;
      }
      hinweis.classList.remove("formhinweis--warn");

      var pfad = pfadAus(urlFeld.value);
      var agent = (agentFeld.value || "Googlebot").trim();
      /* Das Urteil kommt aus dem Pruefwerk — dieselbe Rechnung wie im Protokoll. */
      var lauf = SEORANK_PRUEFWERK.robotsUrteil(roh, pfad, agent);
      var gelesen = lauf.gelesen;
      var gruppe = lauf.gruppe;
      var urteilWert = lauf.urteil;

      urteilWort.textContent = urteilWert.erlaubt ? "Erlaubt" : "Gesperrt";
      urteilGrund.textContent = agent + " · " + pfad + " · " + urteilWert.grund + " · " + gruppe.quelle;
      urteil.classList.toggle("urteil__zeichen--gesperrt", !urteilWert.erlaubt);
      var zeichen = document.getElementById("r-urteil-zeichen");
      zeichen.classList.toggle("urteil__zeichen--gesperrt", !urteilWert.erlaubt);
      zeichen.textContent = urteilWert.erlaubt ? "✓" : "✕";

      var befunde = lauf.befunde;

      if (window.SEORANK) {
        window.SEORANK.zaehlen(document.getElementById("r-gruppen"), gelesen.gruppen.length);
        window.SEORANK.zaehlen(document.getElementById("r-regeln"), gelesen.gruppen.reduce(function (s, g) { return s + g.regeln.length; }, 0));
        window.SEORANK.zaehlen(document.getElementById("r-sitemaps"), gelesen.sitemaps.length);
        window.SEORANK.zaehlen(document.getElementById("r-meldungen"), befunde.length);
      } else {
        setzeText("r-gruppen", String(gelesen.gruppen.length));
        setzeText("r-regeln", String(gelesen.gruppen.reduce(function (s, g) { return s + g.regeln.length; }, 0)));
        setzeText("r-sitemaps", String(gelesen.sitemaps.length));
        setzeText("r-meldungen", String(befunde.length));
      }

      befundeZeichnen(liste, befunde, "Keine Auffälligkeit in dieser robots.txt.");
      crawlerMatrix(gelesen, urlFeld.value.trim() || "/");
      gruppenTafel(gelesen);
      if (window.SEORANK) window.SEORANK.staffeln(liste.querySelectorAll(".befund"));
      hinweis.textContent = "Geprüft im Browser. Es wurde nichts abgerufen und nichts gesendet.";
      ergebnis.hidden = false;
    }

    /* Wer darf hier rein? Dieselbe Entscheidung wie oben, einmal je
       bekanntem Crawler. Die Liste ist bewusst kurz und benannt — sie
       deckt Suche und die grossen KI-Crawler ab. */
    /* Die Liste der benannten Crawler steht im Pruefwerk. */

    function crawlerMatrix(gelesen, pfad) {
      var ziel = document.getElementById("r-crawler");
      if (!ziel) return;
      ziel.textContent = "";

      var rolle = document.createElement("div");
      rolle.className = "rolle";
      var t = document.createElement("table");
      t.className = "tabelle";

      var kopf = document.createElement("thead");
      var kz = document.createElement("tr");
      ["Crawler", "Wer das ist", "Entscheidung für " + pfad, "Greifende Regel"].forEach(function (n) {
        var th = document.createElement("th");
        th.textContent = n;
        kz.appendChild(th);
      });
      kopf.appendChild(kz);
      t.appendChild(kopf);

      var koerper = document.createElement("tbody");
      SEORANK_PRUEFWERK.crawlerEntscheiden(gelesen, pfad).forEach(function (w) {
        var c = [w.name, w.wer];
        var wahl = w;

        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.textContent = c[0];
        tr.appendChild(td1);

        var td2 = document.createElement("td");
        td2.className = "still";
        td2.textContent = c[1];
        tr.appendChild(td2);

        var td3 = document.createElement("td");
        var wort = document.createElement("span");
        wort.className = wahl.erlaubt ? "haken haken--ja" : "haken haken--nein";
        wort.textContent = wahl.erlaubt ? "erlaubt" : "gesperrt";
        td3.appendChild(wort);
        tr.appendChild(td3);

        var td4 = document.createElement("td");
        td4.className = "still";
        td4.textContent = wahl.grund;
        tr.appendChild(td4);

        koerper.appendChild(tr);
      });
      t.appendChild(koerper);
      rolle.appendChild(t);
      ziel.appendChild(rolle);

      var fuss = document.createElement("p");
      fuss.className = "blatthinweis";
      fuss.textContent = "Jede Zeile ist dieselbe Rechnung wie das Urteil oben, nur für einen anderen "
        + "Crawler: passende Gruppe zuerst, dann längster passender Pfad, bei Gleichstand gewinnt Allow. "
        + "Ob sich ein Crawler an die Datei hält, kann keine Datei erzwingen.";
      ziel.appendChild(fuss);
    }

    function gruppenTafel(gelesen) {
      var ziel = document.getElementById("r-gruppentafel");
      if (!ziel) return;
      ziel.textContent = "";
      if (!gelesen.gruppen.length) return;

      var rolle = document.createElement("div");
      rolle.className = "rolle";
      var t = document.createElement("table");
      t.className = "tabelle";

      var kopf = document.createElement("thead");
      var kz = document.createElement("tr");
      ["Gruppe gilt für", "Allow", "Disallow", "Ganz gesperrt?"].forEach(function (n) {
        var th = document.createElement("th");
        th.textContent = n;
        kz.appendChild(th);
      });
      kopf.appendChild(kz);
      t.appendChild(kopf);

      var koerper = document.createElement("tbody");
      gelesen.gruppen.forEach(function (g) {
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.textContent = g.agenten.join(", ");
        tr.appendChild(td1);

        var allow = g.regeln.filter(function (r) { return r.art === "allow"; }).length;
        var disallow = g.regeln.filter(function (r) { return r.art === "disallow"; }).length;
        var alles = g.regeln.some(function (r) { return r.art === "disallow" && r.pfad === "/"; });

        var td2 = document.createElement("td");
        td2.className = "tabelle__zahl";
        td2.textContent = allow;
        tr.appendChild(td2);

        var td3 = document.createElement("td");
        td3.className = "tabelle__zahl";
        td3.textContent = disallow;
        tr.appendChild(td3);

        var td4 = document.createElement("td");
        var wort = document.createElement("span");
        wort.className = alles ? "haken haken--nein" : "haken";
        wort.textContent = alles ? "Disallow: /" : "—";
        td4.appendChild(wort);
        tr.appendChild(td4);

        koerper.appendChild(tr);
      });
      t.appendChild(koerper);
      rolle.appendChild(t);
      ziel.appendChild(rolle);
    }

    starten.addEventListener("click", laufen);
    if (window.SEORANK) window.SEORANK.eingabeMerken(feld, "seorank-robots");

    if (beispiel) {
      beispiel.addEventListener("click", function () {
        feld.value = [
          "# Beispiel mit den drei Fällen, die am häufigsten falsch gelesen werden.",
          "User-agent: *",
          "Disallow: /intern/",
          "Disallow: /*.pdf$",
          "Allow: /intern/handbuch/",
          "Crawl-delay: 10",
          "",
          "User-agent: AhrefsBot",
          "Disallow: /",
          "",
          "Sitemap: https://beispiel-domain.de/sitemap.xml"
        ].join("\n");
        urlFeld.value = "/intern/handbuch/kapitel-1";
        agentFeld.value = "Googlebot";
        laufen();
      });
    }
  })();

  /* =========================================================
     3. Sitemap-Pruefer
     ========================================================= */

  function istW3CDatum(wert) {
    return /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/.test(wert);
  }

  (function sitemapPruefer() {
    var werkzeug = document.getElementById("sitemap");
    if (!werkzeug) return;

    var feld = document.getElementById("m-eingabe");
    var starten = document.getElementById("m-starten");
    var beispiel = document.getElementById("m-beispiel");
    var ergebnis = document.getElementById("m-ergebnis");
    var liste = document.getElementById("m-befunde");
    var hinweis = document.getElementById("m-hinweis");

    var HOECHSTE_ZEILEN = 200;

    function adressTabelle(zeilen, istIndex) {
      var ziel = document.getElementById("m-tabelle");
      if (!ziel) return;
      ziel.textContent = "";
      if (!zeilen.length) return;

      var rolle = document.createElement("div");
      rolle.className = "rolle";
      var t = document.createElement("table");
      t.className = "tabelle";

      var kopf = document.createElement("thead");
      var kz = document.createElement("tr");
      [istIndex ? "Sitemap" : "Adresse", "lastmod", "changefreq", "priority", "Anmerkung"].forEach(function (n) {
        var th = document.createElement("th");
        th.textContent = n;
        kz.appendChild(th);
      });
      kopf.appendChild(kz);
      t.appendChild(kopf);

      var koerper = document.createElement("tbody");
      zeilen.slice(0, HOECHSTE_ZEILEN).forEach(function (z) {
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.className = "mono";
        td1.textContent = kuerzeln(z.loc || "(ohne loc)", 70);
        tr.appendChild(td1);
        [z.lastmod || "—", z.changefreq || "—", z.priority || "—"].forEach(function (w) {
          var td = document.createElement("td");
          td.className = "tabelle__zahl";
          td.textContent = w;
          tr.appendChild(td);
        });
        var td5 = document.createElement("td");
        td5.className = z.anmerkungen.length ? "tabelle__befund" : "still";
        td5.textContent = z.anmerkungen.length ? z.anmerkungen.join(", ") : "—";
        tr.appendChild(td5);
        koerper.appendChild(tr);
      });
      t.appendChild(koerper);
      rolle.appendChild(t);
      ziel.appendChild(rolle);

      if (zeilen.length > HOECHSTE_ZEILEN) {
        var mehr = document.createElement("p");
        mehr.className = "blatthinweis";
        mehr.textContent = "Die ersten " + HOECHSTE_ZEILEN + " von " + zeilen.length.toLocaleString("de-DE")
          + " Einträgen. Die Befunde oben zählen immer über alle.";
        ziel.appendChild(mehr);
      }
    }

    function laufen() {
      var roh = feld.value.trim();
      if (!roh) {
        hinweis.textContent = "Bitte den Inhalt einer sitemap.xml einfügen.";
        hinweis.classList.add("formhinweis--warn");
        return;
      }
      hinweis.classList.remove("formhinweis--warn");

      /* Das Urteil kommt aus dem Pruefwerk — dieselbe Rechnung wie im Protokoll. */
      var lauf = SEORANK_PRUEFWERK.sitemapUrteil(roh);
      var befunde = lauf.befunde;

      if (!lauf.gueltig) {
        setzeText("m-adressen", "0");
        setzeText("m-doppelt", "0");
        setzeText("m-groesse", "—");
        setzeText("m-meldungen", String(befunde.length));
        var tab = document.getElementById("m-tabelle");
        if (tab) tab.textContent = "";
        var sp = document.getElementById("m-spanne");
        if (sp) sp.textContent = "";
        befundeZeichnen(liste, befunde, "");
        ergebnis.hidden = false;
        return;
      }

      var istIndex = lauf.istIndex;
      var locs = lauf.locs;
      var zeilen = lauf.zeilen;
      var doppelt = lauf.doppelt;
      var groesse = lauf.groesse;

      if (window.SEORANK) {
        window.SEORANK.zaehlen(document.getElementById("m-adressen"), locs.length, function (n) {
          return n.toLocaleString("de-DE");
        });
        window.SEORANK.zaehlen(document.getElementById("m-doppelt"), doppelt.length);
        window.SEORANK.zaehlen(document.getElementById("m-meldungen"), befunde.length);
      } else {
        setzeText("m-adressen", locs.length.toLocaleString("de-DE"));
        setzeText("m-doppelt", String(doppelt.length));
        setzeText("m-meldungen", String(befunde.length));
      }
      setzeText("m-groesse", (groesse / 1024).toFixed(1) + " KB");

      adressTabelle(zeilen, istIndex);

      /* Die lastmod-Spanne sagt mehr als jede Einzelangabe: eine Sitemap,
         deren juengstes Datum zwei Jahre alt ist, pflegt niemand. */
      var daten = lauf.daten;
      var spanne = document.getElementById("m-spanne");
      if (spanne) {
        if (daten.length) {
          var f = function (t) { return new Date(t).toISOString().slice(0, 10); };
          spanne.textContent = daten.length + " von " + zeilen.length + " Einträgen tragen ein gültiges lastmod, von "
            + f(Math.min.apply(null, daten)) + " bis " + f(Math.max.apply(null, daten)) + ".";
        } else {
          spanne.textContent = "Kein Eintrag trägt ein gültiges lastmod.";
        }
      }

      befundeZeichnen(liste, befunde, "Diese " + (istIndex ? "Sitemap-Übersicht" : "Sitemap") + " ist in Ordnung: " + locs.length + " Adressen, keine Auffälligkeit.");
      hinweis.textContent = "Geprüft im Browser. Es wurde keine Adresse abgerufen.";
      if (window.SEORANK) window.SEORANK.staffeln(liste.querySelectorAll(".befund"));
      ergebnis.hidden = false;
    }

    starten.addEventListener("click", laufen);
    if (window.SEORANK) window.SEORANK.eingabeMerken(feld, "seorank-sitemap");

    if (beispiel) {
      beispiel.addEventListener("click", function () {
        feld.value = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '  <url>',
          '    <loc>https://beispiel-domain.de/</loc>',
          '    <lastmod>2026-08-24</lastmod>',
          '    <changefreq>weekly</changefreq>',
          '  </url>',
          '  <url>',
          '    <loc>https://beispiel-domain.de/waagen/industrie</loc>',
          '    <lastmod>24.08.2026</lastmod>',
          '    <priority>1.5</priority>',
          '  </url>',
          '  <url>',
          '    <loc>/waagen/labor</loc>',
          '  </url>',
          '  <url>',
          '    <loc>https://beispiel-domain.de/</loc>',
          '  </url>',
          '</urlset>'
        ].join("\n");
        laufen();
      });
    }
  })();
})();
