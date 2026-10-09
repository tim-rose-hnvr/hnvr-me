/* seo-rank.me — Pruefstand fuer den Browser.

   Laedt jede Seite in einem Rahmen fester Breite und misst dort, was der
   Katalog nicht sehen kann, weil er eine Seite nur als Text kennt:
   Klassen ohne Regel, Kontrast gegen die naechste DECKENDE Flaeche,
   waagerechten Ueberlauf, dauerhaft verminderte Deckkraft, und ob der
   Titel „seo-rank.me" nennt (sonst antwortet auf dem Port ein anderer).

   Aufruf in einer Seite des Vorschauservers (Konsole oder DevTools):
     await seorankPruefstand({ welten: ["dunkel","hell"], breiten: [390,1440], ueberlauf: [320,360,390,430] })
   Die Welt wird VOR dem Laden ueber sessionStorage gesetzt, wie beim
   Besucher. Keine Datei wird veraendert, nichts wird gesendet. */

window.seorankPruefstand = async function (optionen) {
  "use strict";
  optionen = optionen || {};
  var SEITEN = optionen.seiten || ["app-audit.html","app-backlinks.html","app-rankings.html","app.html","datenschutz.html","domain.html","hreflang.html","impressum.html","index.html","kommandozeile.html","konto.html","kostenlos.html","pruefer.html","regelsatz.html","robots.html","sitemap.html","snippet.html","stichwort.html","strukturdaten.html","tempo.html","wdf.html","weiterleitung.html","werkbank.html","werkzeuge.html"];
  var WELTEN = optionen.welten || ["dunkel", "hell"];
  var BREITEN = optionen.breiten || [390, 1440];
  var UEBERLAUF = optionen.ueberlauf || [320, 360, 390, 430];
  var WARTEN = optionen.warten || 1800;

  function farbe(s) {
    var m = s.match(/rgba?\(([^)]+)\)/);
    if (m) { var t = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return { r: t[0], g: t[1], b: t[2], a: t.length > 3 ? t[3] : 1 }; }
    m = s.match(/color\(srgb\s+([^)]+)\)/);
    if (m) { var u = m[1].split(/[\s\/]+/).filter(Boolean).map(parseFloat); return { r: u[0] * 255, g: u[1] * 255, b: u[2] * 255, a: u.length > 3 ? u[3] : 1 }; }
    return null;
  }
  function mischen(oben, unten) {
    var a = oben.a;
    return { r: oben.r * a + unten.r * (1 - a), g: oben.g * a + unten.g * (1 - a), b: oben.b * a + unten.b * (1 - a), a: 1 };
  }
  function hell(c) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function kontrast(a, b) { var x = hell(a), y = hell(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

  function laden(seite, breite, welt) {
    return new Promise(function (fertig) {
      try { if (welt === "hell") sessionStorage.setItem("seorank-welt", "hell"); else sessionStorage.removeItem("seorank-welt"); } catch (e) {}
      var f = document.createElement("iframe");
      f.style.cssText = "position:fixed;left:-20000px;top:0;border:0;width:" + breite + "px;height:900px";
      f.src = seite + "?pruefstand=" + Math.random().toString(36).slice(2);
      f.onload = function () { setTimeout(function () { fertig(f); }, WARTEN); };
      document.body.appendChild(f);
    });
  }

  function selektorText(doc) {
    var teile = [];
    function durch(regeln) {
      for (var i = 0; i < regeln.length; i++) {
        var r = regeln[i];
        if (r.selectorText) teile.push(r.selectorText);
        if (r.cssRules) durch(r.cssRules);
      }
    }
    for (var i = 0; i < doc.styleSheets.length; i++) { try { durch(doc.styleSheets[i].cssRules); } catch (e) {} }
    return teile.join(" ");
  }

  function messen(f, welt) {
    var w = f.contentWindow, d = f.contentDocument;
    var e = { klassen: 0, ohneRegel: [], texte: 0, unterAA: [], getruebt: [], weltStimmt: true, titel: d.title };
    e.weltStimmt = (welt === "hell") === (d.documentElement.getAttribute("data-welt") === "hell");
    var sel = selektorText(d);
    var gesehen = {};
    d.querySelectorAll("[class]").forEach(function (k) {
      k.classList.forEach(function (c) {
        e.klassen++;
        if (gesehen[c] !== undefined) { if (!gesehen[c]) e.ohneRegel.push(c); return; }
        var da = new RegExp("\\." + c.replace(/[^\w-]/g, "\\$&") + "(?![\\w-])").test(sel);
        gesehen[c] = da;
        if (!da) e.ohneRegel.push(c);
      });
    });
    e.ohneRegel = Array.from(new Set(e.ohneRegel));

    var laeufer = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
    var n, geprueft = new Set();
    while ((n = laeufer.nextNode())) {
      if (!n.textContent.trim()) continue;
      var el = n.parentElement;
      if (!el || geprueft.has(el)) continue;
      geprueft.add(el);
      var cs = w.getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden],script,style,noscript,.nur-vorlesen,.springmarke,svg")) continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var vorne = farbe(cs.color);
      if (!vorne) continue;
      /* Hintergrund: von innen nach aussen alle Schichten einsammeln,
         bis eine DECKENDE kommt, dann von aussen nach innen mischen. */
      var schichten = [], p = el, grund = null;
      while (p && p.nodeType === 1) {
        var bg = farbe(w.getComputedStyle(p).backgroundColor);
        if (bg && bg.a > 0) { if (bg.a >= 0.999) { grund = bg; break; } schichten.push(bg); }
        p = p.parentElement;
      }
      if (!grund) grund = { r: 255, g: 255, b: 255, a: 1 };
      for (var i = schichten.length - 1; i >= 0; i--) grund = mischen(schichten[i], grund);
      if (vorne.a < 1) vorne = mischen(vorne, grund);
      var gross = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
      var k = kontrast(vorne, grund);
      e.texte++;
      if (k < (gross ? 3 : 4.5)) e.unterAA.push(el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ")[0] + " " + k.toFixed(2) + " „" + n.textContent.trim().slice(0, 30) + "“");
    }

    d.querySelectorAll("body *").forEach(function (k) {
      if (k.closest("[hidden],[disabled]") || k.disabled) return;
      var o = parseFloat(w.getComputedStyle(k).opacity);
      if (o < 1 && k.getBoundingClientRect().width) e.getruebt.push(k.tagName.toLowerCase() + "." + (k.className || "").toString().split(" ")[0] + " " + o);
    });
    return e;
  }

  var ergebnis = { laeufe: 0, fremd: [], welten: 0, klassen: 0, ohneRegel: {}, texte: 0, unterAA: [], getruebt: [], ueberlauf: [] };

  for (var wi = 0; wi < WELTEN.length; wi++) {
    for (var bi = 0; bi < BREITEN.length; bi++) {
      for (var si = 0; si < SEITEN.length; si++) {
        var f = await laden(SEITEN[si], BREITEN[bi], WELTEN[wi]);
        var m = messen(f, WELTEN[wi]);
        ergebnis.laeufe++;
        if (m.titel.indexOf("seo-rank.me") === -1) ergebnis.fremd.push(SEITEN[si]);
        if (m.weltStimmt) ergebnis.welten++;
        ergebnis.klassen += m.klassen;
        m.ohneRegel.forEach(function (c) { (ergebnis.ohneRegel[c] = ergebnis.ohneRegel[c] || []).push(SEITEN[si]); });
        ergebnis.texte += m.texte;
        m.unterAA.forEach(function (x) { ergebnis.unterAA.push(SEITEN[si] + " " + WELTEN[wi] + " " + BREITEN[bi] + ": " + x); });
        m.getruebt.forEach(function (x) { ergebnis.getruebt.push(SEITEN[si] + " " + WELTEN[wi] + " " + BREITEN[bi] + ": " + x); });
        f.remove();
      }
    }
  }

  for (var ui = 0; ui < UEBERLAUF.length; ui++) {
    for (var sj = 0; sj < SEITEN.length; sj++) {
      var g = await laden(SEITEN[sj], UEBERLAUF[ui], "hell");
      var dd = g.contentDocument;
      var zuviel = dd.documentElement.scrollWidth - dd.documentElement.clientWidth;
      ergebnis.laeufe++;
      if (zuviel > 0) ergebnis.ueberlauf.push(SEITEN[sj] + " @" + UEBERLAUF[ui] + ": +" + zuviel + "px");
      g.remove();
    }
  }
  try { sessionStorage.removeItem("seorank-welt"); } catch (e) {}
  ergebnis.ohneRegelZahl = Object.keys(ergebnis.ohneRegel).length;
  ergebnis.unterAAZahl = ergebnis.unterAA.length;
  ergebnis.unterAA = ergebnis.unterAA.slice(0, 40);
  ergebnis.getruebtZahl = ergebnis.getruebt.length;
  ergebnis.getruebt = ergebnis.getruebt.slice(0, 20);
  return ergebnis;
};
