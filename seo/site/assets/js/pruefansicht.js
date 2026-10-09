/* seo-rank.me — Analyseblaetter des Seiten-Pruefers.
   Rechnet nichts: alle Zahlen kommen aus SEORANK_ANALYSE, damit Befund und
   Messwert dieselbe Quelle haben. Hier wird nur gezeichnet.

   Der Ruhezustand ist der sichtbare Zustand: jedes Blatt steht fertig im
   Dokument, bevor irgendeine Bewegung laeuft. */

var SEORANK_ANSICHT = (function () {
  "use strict";

  function el(name, klasse, text) {
    var k = document.createElement(name);
    if (klasse) k.className = klasse;
    if (text !== undefined && text !== null) k.textContent = String(text);
    return k;
  }

  function zahl(n) {
    return Number(n).toLocaleString("de-DE");
  }

  function leer(ziel) {
    while (ziel.firstChild) ziel.removeChild(ziel.firstChild);
  }

  function leerstand(ziel, text) {
    var p = el("p", "leerstand", text);
    ziel.appendChild(p);
  }

  /* ---------- Punktzahl ---------- */

  function punkteZeichnen(ziel, punkte) {
    leer(ziel);

    var kopf = el("div", "punktstand");
    var links = el("div", "punktstand__wert");
    var z = el("span", "punktstand__zahl", punkte.gesamt);
    z.setAttribute("data-zaehler", String(punkte.gesamt));
    links.appendChild(z);
    links.appendChild(el("span", "punktstand__von", "von 100"));
    kopf.appendChild(links);

    var erklaerung = el("p", "punktstand__text");
    erklaerung.textContent = "Jede geprüfte Regel bringt ihr Gewicht ein, eine angeschlagene Regel "
      + "verliert es ganz. " + zahl(punkte.verloren) + " von " + zahl(punkte.moeglich)
      + " Gewichtspunkten sind verloren. Keine Kurve, kein Bonus.";
    kopf.appendChild(erklaerung);
    ziel.appendChild(kopf);

    var balken = el("div", "wertbalken");
    punkte.gruppen.slice().sort(function (a, b) { return a.wert - b.wert; }).forEach(function (g) {
      var zeile = el("div", "wertbalken__zeile");
      zeile.appendChild(el("span", "wertbalken__name", g.name));

      var spur = el("span", "wertbalken__spur");
      var fuellung = el("span", "wertbalken__fuellung");
      if (g.wert < 70) fuellung.className += " wertbalken__fuellung--knapp";
      fuellung.style.width = g.wert + "%";
      spur.appendChild(fuellung);
      zeile.appendChild(spur);

      /* Die Zahl ist der Gruppenwert von 100. Ohne Einheit liest sie
         sich wie eine Anzahl. */
      var wert = el("span", "wertbalken__wert", g.wert);
      wert.title = g.name + ": " + g.wert + " von 100";
      zeile.appendChild(wert);

      /* "5 von 5" hat sich wie BESTANDEN gelesen, gemeint waren BEFUNDE.
         Zwei Woerter kosten nichts und nehmen die Verwechslung heraus. */
      var zusatz = el("span", "wertbalken__zusatz",
        g.befunde
          ? g.befunde + " Befund" + (g.befunde === 1 ? "" : "e") + " in " + g.regeln + " Regeln"
          : g.regeln + " Regeln, ohne Befund");
      zeile.appendChild(zusatz);
      balken.appendChild(zeile);
    });
    ziel.appendChild(balken);
  }

  /* ---------- Profil ---------- */

  function kennzahl(gruppe, name, wert, zusatz, warnen) {
    var k = el("div", "kennzahl");
    k.appendChild(el("span", "label", name));
    var z = el("span", "kennzahl__zahl" + (warnen ? " kennzahl__zahl--warn" : ""));
    z.appendChild(document.createTextNode(String(wert)));
    if (zusatz) z.appendChild(el("span", "kennzahl__zusatz", zusatz));
    k.appendChild(z);
    gruppe.appendChild(k);
  }

  function block(ziel, ueberschrift) {
    var h = el("h3", "blattkopf", ueberschrift);
    ziel.appendChild(h);
    var g = el("div", "kennzahlen");
    ziel.appendChild(g);
    return g;
  }

  function profilZeichnen(ziel, p) {
    leer(ziel);

    var a = block(ziel, "Umfang");
    kennzahl(a, "Wörter im Text", zahl(p.woerter), p.lesezeit + " min Lesezeit", p.woerter < 300);
    kennzahl(a, "Quelltext", zahl(Math.round(p.bytes / 1024)) + " KB", zahl(p.bytes) + " Zeichen", p.bytes > 150000);
    kennzahl(a, "Textanteil", p.textanteil + " %", "sichtbarer Text am Quelltext", p.textanteil < 10);
    kennzahl(a, "Elemente", zahl(p.elemente), "tiefste Schachtelung " + p.tiefe, p.elemente > 1500);

    var b = block(ziel, "Sprache");
    /* Ohne genug Text gibt es keine belastbare Satzlaenge. Dann steht dort
       ein Strich und nicht eine Null, die wie ein Messwert aussieht. */
    kennzahl(b, "Sätze", p.lesbarkeit === null ? "—" : zahl(p.saetze),
      p.lesbarkeit === null ? "zu wenig Text" : p.satzlaenge + " Wörter je Satz",
      p.lesbarkeit !== null && p.satzlaenge > 25);
    kennzahl(b, "Lesbarkeit", p.lesbarkeit === null ? "—" : p.lesbarkeit,
      p.lesbarkeit === null ? "zu wenig Text" : lesestufe(p.lesbarkeit), p.lesbarkeit !== null && p.lesbarkeit < 30);
    kennzahl(b, "Sprachangabe", p.sprache || "fehlt", p.sprache ? "am html-Element" : "lang nicht gesetzt", !p.sprache);

    var c = block(ziel, "Trefferliste");
    kennzahl(c, "Titel", p.titelPixel + " px", p.titelZeichen + " Zeichen", p.titelPixel > 600);
    kennzahl(c, "Beschreibung", p.beschreibungPixel + " px", p.beschreibungZeichen + " Zeichen", p.beschreibungPixel > 960);
    kennzahl(c, "Adresse", p.adresse ? String(p.adresse.length) + " Zeichen" : "—",
      p.adresse ? "aus canonical / og:url" : "keine absolute Adresse", p.adresse && p.adresse.length > 115);

    var d = block(ziel, "Bausteine");
    kennzahl(d, "Überschriften", zahl(p.ueberschriften), p.absaetze + " Absätze");
    kennzahl(d, "Listen", zahl(p.listen), p.tabellen + " Tabellen");
    kennzahl(d, "Formulare", zahl(p.formulare), p.felder + " Felder");
    kennzahl(d, "Rahmen", zahl(p.rahmen), "iframe-Einbettungen");

    var e = block(ziel, "Bilder");
    kennzahl(e, "Bilder", zahl(p.bilder), p.bilderVerzoegert + " verzögert geladen");
    kennzahl(e, "Ohne Alternativtext", zahl(p.bilderOhneAlt), "alt-Attribut fehlt", p.bilderOhneAlt > 0);
    kennzahl(e, "Ohne Maße", zahl(p.bilderOhneMasse), "width/height fehlt", p.bilderOhneMasse > 0);

    var f = block(ziel, "Verweise");
    kennzahl(f, "Verweise", zahl(p.verweise), "insgesamt");
    kennzahl(f, "Intern", zahl(p.verweiseIntern), "auf dieselbe Website");
    kennzahl(f, "Extern", zahl(p.verweiseExtern), "nach außen");
    kennzahl(f, "Sprungmarken", zahl(p.verweiseAnker), p.verweiseSonstige + " sonstige");

    var g = block(ziel, "Gerüst und Fremdes");
    kennzahl(g, "Skripte", zahl(p.skripte), p.skripteExtern + " aus Dateien");
    kennzahl(g, "Stilblätter", zahl(p.stilblaetter), p.stilbloecke + " style-Blöcke");
    kennzahl(g, "style-Attribute", zahl(p.stilattribute), "direkt im HTML");
    kennzahl(g, "Fremde Hosts", zahl(p.fremdhosts),
      p.fremdhosts ? p.fremdhostliste.slice(0, 2).join(", ") : "keine", p.fremdhosts > 0);

    var hinweis = el("p", "blatthinweis");
    hinweis.textContent = "Alle Zahlen stammen aus dem eingefügten Quelltext. Was erst ein Skript "
      + "einträgt, ist nicht darin enthalten. Die Lesbarkeit zählt Silben näherungsweise über "
      + "Vokalgruppen und ist ein Anhaltspunkt, kein Urteil.";
    ziel.appendChild(hinweis);
  }

  function lesestufe(wert) {
    if (wert >= 80) return "sehr leicht";
    if (wert >= 60) return "leicht";
    if (wert >= 50) return "mittel";
    if (wert >= 30) return "schwer";
    return "sehr schwer";
  }

  /* ---------- Gliederung ---------- */

  function gliederungZeichnen(ziel, liste) {
    leer(ziel);
    if (!liste.length) { leerstand(ziel, "Keine Überschrift im Dokument."); return; }

    var behaelter = el("div", "gliederung");
    liste.forEach(function (h) {
      var zeile = el("div", "gliederung__zeile");
      zeile.setAttribute("data-ebene", String(h.ebene));
      zeile.style.paddingLeft = (h.ebene - 1) * 22 + "px";

      zeile.appendChild(el("span", "gliederung__marke", "h" + h.ebene));
      var text = el("span", "gliederung__text", h.leer ? "(leer)" : h.text);
      if (h.leer) text.className += " gliederung__text--leer";
      zeile.appendChild(text);

      if (h.id) zeile.appendChild(el("span", "gliederung__id", "#" + h.id));
      if (h.sprung) {
        zeile.appendChild(el("span", "gliederung__sprung", "Ebene " + (h.von + 1) + " übersprungen"));
      }
      behaelter.appendChild(zeile);
    });
    ziel.appendChild(behaelter);

    var hinweis = el("p", "blatthinweis");
    hinweis.textContent = "Die Reihenfolge ist die des Quelltextes, nicht die der Darstellung. "
      + "Eine übersprungene Ebene ist kein Fehler, aber fast immer ein Zeichen dafür, dass die "
      + "Ebene nach der Schriftgröße gewählt wurde.";
    ziel.appendChild(hinweis);
  }

  /* ---------- Wortfeld ---------- */

  function ja(wert) {
    var s = el("span", wert ? "haken haken--ja" : "haken", wert ? "ja" : "—");
    return s;
  }

  function wortfeldZeichnen(ziel, analyse, dokument) {
    leer(ziel);

    var laengen = [[1, "Einzelne Wörter"], [2, "Zweierfolgen"], [3, "Dreierfolgen"]];
    var etwas = false;

    laengen.forEach(function (paar) {
      var liste = analyse.wortfeld(dokument, paar[0], 15);
      if (!liste.length) return;
      etwas = true;

      ziel.appendChild(el("h3", "blattkopf", paar[1]));

      var rolle = el("div", "rolle");
      var t = el("table", "tabelle");
      var kopf = el("thead");
      var kz = el("tr");
      ["Begriff", "Anzahl", "Dichte", "Titel", "Beschr.", "H1", "H2/H3", "Adresse"].forEach(function (n) {
        kz.appendChild(el("th", null, n));
      });
      kopf.appendChild(kz);
      t.appendChild(kopf);

      var koerper = el("tbody");
      liste.forEach(function (w) {
        var tr = el("tr");
        tr.appendChild(el("td", null, w.wort));
        tr.appendChild(el("td", "tabelle__zahl", w.anzahl));
        tr.appendChild(el("td", "tabelle__zahl", w.dichte.toFixed(2).replace(".", ",") + " %"));
        [w.imTitel, w.inBeschreibung, w.inH1, w.inH2, w.inAdresse].forEach(function (v) {
          var td = el("td");
          td.appendChild(ja(v));
          tr.appendChild(td);
        });
        koerper.appendChild(tr);
      });
      t.appendChild(koerper);
      rolle.appendChild(t);
      ziel.appendChild(rolle);
    });

    if (!etwas) { leerstand(ziel, "Zu wenig Text für eine Wortauswertung."); return; }

    var hinweis = el("p", "blatthinweis");
    hinweis.textContent = "Häufigkeit ist kein Rangfaktor. Diese Tabelle beantwortet eine andere "
      + "Frage: wovon handelt die Seite nach ihrem eigenen Text — und steht dasselbe auch an den "
      + "Stellen, die in der Trefferliste erscheinen. Wörter ohne eigene Bedeutung sind ausgelassen.";
    ziel.appendChild(hinweis);
  }

  /* ---------- Verweise ---------- */

  function verweiseZeichnen(ziel, liste) {
    leer(ziel);
    if (!liste.length) { leerstand(ziel, "Kein Verweis im Dokument."); return; }

    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead");
    var kz = el("tr");
    ["Text", "Ziel", "Art", "rel", "Fenster"].forEach(function (n) { kz.appendChild(el("th", null, n)); });
    kopf.appendChild(kz);
    t.appendChild(kopf);

    var koerper = el("tbody");
    liste.forEach(function (v) {
      var tr = el("tr");
      var text = v.text || v.beschriftung || "";
      var td1 = el("td", null, text || "(ohne Text)");
      if (!text) td1.className = "tabelle__befund";
      tr.appendChild(td1);
      tr.appendChild(el("td", "mono", v.ziel));
      tr.appendChild(el("td", null, v.art));
      tr.appendChild(el("td", "mono", v.rel || "—"));
      tr.appendChild(el("td", null, v.ziel_fenster || "—"));
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);

    var hinweis = el("p", "blatthinweis");
    hinweis.textContent = "Ob ein Ziel erreichbar ist, steht hier nicht — dafür müsste jede Adresse "
      + "abgerufen werden, und das tut dieses Werkzeug nicht. Die Kommandozeile prüft das beim Crawl.";
    ziel.appendChild(hinweis);
  }

  /* ---------- Bilder ---------- */

  function bilderZeichnen(ziel, liste) {
    leer(ziel);
    if (!liste.length) { leerstand(ziel, "Kein Bild im Dokument."); return; }

    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead");
    var kz = el("tr");
    ["Quelle", "Alternativtext", "Maße", "Laden", "Größen", "Format"].forEach(function (n) {
      kz.appendChild(el("th", null, n));
    });
    kopf.appendChild(kz);
    t.appendChild(kopf);

    var koerper = el("tbody");
    liste.forEach(function (b) {
      var tr = el("tr");
      tr.appendChild(el("td", "mono", b.quelle || "(ohne src)"));

      var tdAlt = el("td");
      if (b.alt === null) { tdAlt.className = "tabelle__befund"; tdAlt.textContent = "fehlt"; }
      else if (b.alt === "") tdAlt.textContent = "(leer — schmückend)";
      else tdAlt.textContent = b.alt;
      tr.appendChild(tdAlt);

      var masse = (b.breite && b.hoehe) ? b.breite + " × " + b.hoehe : "—";
      var tdM = el("td", (b.breite && b.hoehe) ? null : "tabelle__befund", masse);
      tr.appendChild(tdM);

      tr.appendChild(el("td", null, b.laden || "sofort"));
      tr.appendChild(el("td", null, b.groessen ? "srcset" : "—"));
      tr.appendChild(el("td", null, b.format));
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);
  }

  /* ---------- Wirkung ---------- */

  function wirkungZeichnen(ziel, wirkungen) {
    leer(ziel);
    if (!wirkungen.length) {
      leerstand(ziel, "Keine Regel hat angeschlagen — es gibt nichts zu verteilen.");
      return;
    }

    var groesste = wirkungen[0].gewicht || 1;
    var balken = el("div", "wertbalken");
    wirkungen.forEach(function (w) {
      var zeile = el("div", "wertbalken__zeile");
      zeile.appendChild(el("span", "wertbalken__name", w.name));
      var spur = el("span", "wertbalken__spur");
      var f = el("span", "wertbalken__fuellung wertbalken__fuellung--knapp");
      f.style.width = Math.round((w.gewicht / groesste) * 100) + "%";
      spur.appendChild(f);
      zeile.appendChild(spur);
      zeile.appendChild(el("span", "wertbalken__wert", w.anzahl));
      zeile.appendChild(el("span", "wertbalken__zusatz", "Gewicht " + w.gewicht));
      balken.appendChild(zeile);
    });
    ziel.appendChild(balken);

    var hinweis = el("p", "blatthinweis");
    hinweis.textContent = "Dieselben Befunde, anders sortiert: nicht danach, welches Bauteil betroffen "
      + "ist, sondern worauf es sich auswirkt. Die Zahl ist die Anzahl der Befunde, das Gewicht ihre "
      + "Summe in der Punktzahl.";
    ziel.appendChild(hinweis);
  }

  /* ---------- Register ----------
     Die Blaetter liegen alle im Dokument. Umgeschaltet wird ueber hidden,
     nicht ueber Neuaufbau: der Zustand einer Tabelle bleibt so erhalten. */

  function registerAnschliessen(leiste, blaetter, beiWechsel) {
    var knoepfe = Array.prototype.slice.call(leiste.querySelectorAll(".reiter"));

    function waehlen(name) {
      knoepfe.forEach(function (k) {
        var an = k.getAttribute("data-blatt") === name;
        k.setAttribute("aria-selected", String(an));
      });
      Array.prototype.forEach.call(blaetter.children, function (b) {
        b.hidden = b.getAttribute("data-blatt") !== name;
      });
      if (beiWechsel) beiWechsel(name);
    }

    knoepfe.forEach(function (k) {
      k.addEventListener("click", function () { waehlen(k.getAttribute("data-blatt")); });
      k.addEventListener("keydown", function (e) {
        var i = knoepfe.indexOf(k);
        var neu = null;
        if (e.key === "ArrowRight") neu = knoepfe[(i + 1) % knoepfe.length];
        if (e.key === "ArrowLeft") neu = knoepfe[(i - 1 + knoepfe.length) % knoepfe.length];
        if (!neu) return;
        e.preventDefault();
        neu.focus();
        waehlen(neu.getAttribute("data-blatt"));
      });
    });

    return waehlen;
  }

  return {
    punkteZeichnen: punkteZeichnen,
    profilZeichnen: profilZeichnen,
    gliederungZeichnen: gliederungZeichnen,
    wortfeldZeichnen: wortfeldZeichnen,
    verweiseZeichnen: verweiseZeichnen,
    bilderZeichnen: bilderZeichnen,
    wirkungZeichnen: wirkungZeichnen,
    registerAnschliessen: registerAnschliessen
  };
})();
