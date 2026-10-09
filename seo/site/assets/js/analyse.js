/* seo-rank.me — Analyse.
   Der Regelkatalog urteilt; diese Datei misst. Sie rechnet mit denselben
   Routinen (SEORANK_MESSEN), damit Zahl und Befund nicht auseinanderlaufen.

   Alles hier ist reine Rechnung auf einem Dokument: keine Netzabfrage,
   keine Schaetzung, die nicht als solche benannt waere. */

var SEORANK_ANALYSE = (function () {
  "use strict";

  var M = (typeof SEORANK_MESSEN !== "undefined") ? SEORANK_MESSEN : {};

  function alle(d, wahl) {
    return Array.prototype.slice.call(d.querySelectorAll(wahl));
  }

  function kurz(text, laenge) {
    text = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    return text.length > laenge ? text.slice(0, laenge) + "…" : text;
  }

  /* ---------- Dokumentprofil ----------
     Die Zahlen, nach denen man zuerst greift: wie viel Text, wie viel
     Geruest, wie tief verschachtelt, wie viele Verweise wohin. */

  function elementeZaehlen(wurzel) {
    var anzahl = 0, tiefste = 0;
    var stapel = [[wurzel, 0]];
    while (stapel.length) {
      var paar = stapel.pop();
      var el = paar[0], tiefe = paar[1];
      anzahl++;
      if (tiefe > tiefste) tiefste = tiefe;
      var kinder = el.children || [];
      for (var i = 0; i < kinder.length; i++) stapel.push([kinder[i], tiefe + 1]);
    }
    return { anzahl: anzahl - 1, tiefe: tiefste };
  }

  function adresseArt(ziel, eigenerHost) {
    var z = String(ziel || "").trim();
    if (!z) return "leer";
    if (z.charAt(0) === "#") return "sprungmarke";
    if (/^mailto:/i.test(z)) return "e-post";
    if (/^tel:/i.test(z)) return "telefon";
    if (/^javascript:/i.test(z)) return "skript";
    if (/^(https?:)?\/\//i.test(z)) {
      var host = M.hostVon ? M.hostVon(z) : null;
      return (eigenerHost && host === eigenerHost) ? "intern" : "extern";
    }
    return "intern";
  }

  function profil(d, roh) {
    var text = M.sichtbarerText ? M.sichtbarerText(d) : (d.body ? d.body.textContent : "");
    var woerter = text.split(/\s+/).filter(Boolean);
    var lese = M.lesbarkeit ? M.lesbarkeit(text) : null;
    var adresse = M.eigeneAdresse ? M.eigeneAdresse(d) : null;
    var eigenerHost = adresse ? adresse.host.toLowerCase() : null;

    var baum = d.body ? elementeZaehlen(d.body) : { anzahl: 0, tiefe: 0 };
    var bilder = alle(d, "img");
    var verweise = alle(d, "a[href]");
    var arten = { intern: 0, extern: 0, sprungmarke: 0, "e-post": 0, telefon: 0, skript: 0, leer: 0 };
    verweise.forEach(function (a) {
      var art = adresseArt(a.getAttribute("href"), eigenerHost);
      arten[art] = (arten[art] || 0) + 1;
    });

    var hosts = {};
    (M.fremdadressen ? M.fremdadressen(d) : []).forEach(function (q) {
      var h = M.hostVon ? M.hostVon(q) : null;
      if (h && h !== eigenerHost) hosts[h] = (hosts[h] || 0) + 1;
    });

    var titel = d.querySelector("title");
    var beschreibung = d.querySelector('meta[name="description" i]');
    var titelText = titel ? titel.textContent.trim() : "";
    var beschreibungText = beschreibung ? (beschreibung.getAttribute("content") || "").trim() : "";

    var bytes = String(roh || "").length;

    return {
      /* Umfang */
      bytes: bytes,
      woerter: woerter.length,
      zeichenText: text.length,
      textanteil: bytes ? Math.round((text.length / bytes) * 1000) / 10 : 0,
      lesezeit: Math.max(1, Math.round(woerter.length / 200)),

      /* Sprache */
      saetze: lese ? lese.saetze : 0,
      satzlaenge: lese ? lese.satzlaenge : 0,
      lesbarkeit: lese ? lese.wert : null,

      /* Geruest */
      elemente: baum.anzahl,
      tiefe: baum.tiefe,
      skripte: alle(d, "script").length,
      skripteExtern: alle(d, "script[src]").length,
      stilblaetter: alle(d, 'link[rel="stylesheet" i]').length,
      stilbloecke: alle(d, "style").length,
      stilattribute: alle(d, "[style]").length,

      /* Bausteine */
      ueberschriften: alle(d, "h1, h2, h3, h4, h5, h6").length,
      absaetze: alle(d, "p").length,
      listen: alle(d, "ul, ol").length,
      tabellen: alle(d, "table").length,
      formulare: alle(d, "form").length,
      felder: alle(d, "input, select, textarea").length,
      rahmen: alle(d, "iframe").length,

      /* Bilder */
      bilder: bilder.length,
      bilderOhneAlt: bilder.filter(function (b) { return !b.hasAttribute("alt"); }).length,
      bilderOhneMasse: bilder.filter(function (b) { return !b.getAttribute("width") || !b.getAttribute("height"); }).length,
      bilderVerzoegert: bilder.filter(function (b) { return (b.getAttribute("loading") || "").toLowerCase() === "lazy"; }).length,

      /* Verweise */
      verweise: verweise.length,
      verweiseIntern: arten.intern,
      verweiseExtern: arten.extern,
      verweiseAnker: arten.sprungmarke,
      verweiseSonstige: arten["e-post"] + arten.telefon + arten.skript + arten.leer,

      /* Aussen */
      fremdhosts: Object.keys(hosts).length,
      fremdhostliste: Object.keys(hosts).sort(),

      /* Trefferliste */
      titel: titelText,
      titelZeichen: titelText.length,
      titelPixel: M.px ? M.px(titelText, "20px Arial, sans-serif") : 0,
      beschreibung: beschreibungText,
      beschreibungZeichen: beschreibungText.length,
      beschreibungPixel: M.px ? M.px(beschreibungText, "14px Arial, sans-serif") : 0,
      adresse: adresse ? adresse.href : null,
      sprache: d.documentElement ? (d.documentElement.getAttribute("lang") || null) : null
    };
  }

  /* ---------- Gliederung ----------
     Die Überschriften in der Reihenfolge des Dokuments, mit der Angabe,
     wo eine Ebene übersprungen wurde. */

  /* textContent klebt Woerter zusammen, wo ein <br> steht: aus
     "Ihre Website,<br>durchgemessen." wuerde ein Wort. Fuer eine Gliederung,
     die jemand lesen soll, ist das falsch. */
  function textMitUmbruch(el) {
    var aus = "";
    for (var i = 0; i < el.childNodes.length; i++) {
      var k = el.childNodes[i];
      if (k.nodeType === 3) aus += k.textContent;
      else if (k.nodeType === 1) aus += (k.localName === "br" ? " " : textMitUmbruch(k));
    }
    return aus;
  }

  function gliederung(d) {
    var aus = [];
    var vorige = 0;
    alle(d, "h1, h2, h3, h4, h5, h6").forEach(function (h) {
      var ebene = Number(h.localName.charAt(1));
      var sprung = vorige > 0 && ebene > vorige + 1;
      aus.push({
        ebene: ebene,
        text: textMitUmbruch(h).replace(/\s+/g, " ").trim(),
        id: h.getAttribute("id") || null,
        leer: !h.textContent.trim(),
        sprung: sprung,
        von: sprung ? vorige : null
      });
      vorige = ebene;
    });
    return aus;
  }

  /* ---------- Wortfeld ----------
     Häufigkeit einzelner Wörter und von Zwei- und Dreierfolgen, dazu die
     Angabe, an welchen tragenden Stellen sie sonst noch vorkommen. */

  function wortfeld(d, laenge, anzahl) {
    if (!M.wortfeld) return [];
    var text = M.sichtbarerText(d);
    var feld = M.wortfeld(text, laenge || 1);

    var titel = (d.querySelector("title") || { textContent: "" }).textContent.toLowerCase();
    var m = d.querySelector('meta[name="description" i]');
    var beschreibung = m ? (m.getAttribute("content") || "").toLowerCase() : "";
    var h1 = alle(d, "h1").map(function (h) { return h.textContent; }).join(" ").toLowerCase();
    var h2 = alle(d, "h2, h3").map(function (h) { return h.textContent; }).join(" ").toLowerCase();
    var adr = M.eigeneAdresse ? M.eigeneAdresse(d) : null;
    var pfad = adr ? decodeURIComponent(adr.pathname).toLowerCase().replace(/[-_/]/g, " ") : "";

    return feld.liste.slice(0, anzahl || 20).map(function (e) {
      return {
        wort: e.wort,
        anzahl: e.anzahl,
        dichte: Math.round((e.anzahl / feld.gesamt) * 10000) / 100,
        imTitel: titel.indexOf(e.wort) !== -1,
        inBeschreibung: beschreibung.indexOf(e.wort) !== -1,
        inH1: h1.indexOf(e.wort) !== -1,
        inH2: h2.indexOf(e.wort) !== -1,
        inAdresse: pfad.indexOf(e.wort) !== -1
      };
    });
  }

  /* ---------- Verweistabelle ---------- */

  function verweise(d) {
    var adresse = M.eigeneAdresse ? M.eigeneAdresse(d) : null;
    var eigenerHost = adresse ? adresse.host.toLowerCase() : null;
    return alle(d, "a[href]").map(function (a) {
      var ziel = a.getAttribute("href") || "";
      var text = a.textContent.replace(/\s+/g, " ").trim();
      var bild = a.querySelector("img");
      return {
        text: text || (bild ? "[Bild: " + (bild.getAttribute("alt") || "ohne Alternativtext") + "]" : ""),
        ziel: ziel,
        art: adresseArt(ziel, eigenerHost),
        rel: (a.getAttribute("rel") || "").trim(),
        ziel_fenster: (a.getAttribute("target") || "").trim(),
        titel: (a.getAttribute("title") || "").trim(),
        beschriftung: (a.getAttribute("aria-label") || "").trim(),
        ohneText: !text && !bild
      };
    });
  }

  /* ---------- Bildtabelle ---------- */

  function bilder(d) {
    return alle(d, "img").map(function (b) {
      var quelle = b.getAttribute("src") || "";
      var endung = (quelle.split("?")[0].match(/\.([a-z0-9]{2,5})$/i) || [null, ""])[1].toLowerCase();
      return {
        quelle: quelle,
        alt: b.hasAttribute("alt") ? (b.getAttribute("alt") || "") : null,
        breite: b.getAttribute("width") || null,
        hoehe: b.getAttribute("height") || null,
        laden: (b.getAttribute("loading") || "").toLowerCase() || null,
        vorrang: (b.getAttribute("fetchpriority") || "").toLowerCase() || null,
        groessen: b.hasAttribute("srcset"),
        format: endung || "unbekannt"
      };
    });
  }

  /* ---------- Punktzahl ----------
     Offen gerechnet, damit sie nachvollziehbar bleibt: jede geprüfte Regel
     bringt ihr Gewicht ein; eine angeschlagene Regel verliert es ganz.
     Es gibt keine Kurve, keine Gewichtung nach Beliebtheit, keinen Bonus.
       Gruppenwert = 1 − (verlorenes Gewicht / mögliches Gewicht)
       Gesamtwert  = über alle geprüften Regeln gerechnet, nicht als
                     Mittelwert der Gruppen — sonst zählte eine Gruppe mit
                     zwei Regeln so viel wie eine mit zwanzig. */

  function punktzahl(katalog, befunde, uebersprungeneIds) {
    var uebersprungen = uebersprungeneIds || {};
    var getroffen = {};
    befunde.forEach(function (b) { getroffen[b.id] = true; });

    var gruppen = {}, reihe = [];
    var moeglichGesamt = 0, verlorenGesamt = 0;

    katalog.forEach(function (r) {
      if (uebersprungen[r.id]) return;
      if (!gruppen[r.gruppe]) {
        gruppen[r.gruppe] = { name: r.gruppe, moeglich: 0, verloren: 0, regeln: 0, befunde: 0 };
        reihe.push(gruppen[r.gruppe]);
      }
      var g = gruppen[r.gruppe];
      var gewicht = r.gewicht || 1;
      g.moeglich += gewicht;
      g.regeln++;
      moeglichGesamt += gewicht;
      if (getroffen[r.id]) {
        g.verloren += gewicht;
        g.befunde++;
        verlorenGesamt += gewicht;
      }
    });

    reihe.forEach(function (g) {
      g.wert = g.moeglich ? Math.round((1 - g.verloren / g.moeglich) * 100) : 100;
    });

    return {
      gesamt: moeglichGesamt ? Math.round((1 - verlorenGesamt / moeglichGesamt) * 100) : 100,
      moeglich: moeglichGesamt,
      verloren: verlorenGesamt,
      gruppen: reihe
    };
  }

  /* ---------- Wirkungsbereiche ----------
     Dieselben Befunde, anders sortiert: nicht nach Bauteil, sondern
     danach, worauf sie sich auswirken. */

  function wirkungen(katalog, befunde) {
    var nach = {};
    var katalogNach = {};
    katalog.forEach(function (r) { katalogNach[r.id] = r; });
    befunde.forEach(function (b) {
      var r = katalogNach[b.id];
      var w = (r && r.wirkung) || "unbestimmt";
      if (!nach[w]) nach[w] = { name: w, anzahl: 0, gewicht: 0, ids: [] };
      nach[w].anzahl++;
      nach[w].gewicht += (r && r.gewicht) || 1;
      nach[w].ids.push(b.id);
    });
    return Object.keys(nach).map(function (k) { return nach[k]; })
      .sort(function (a, b) { return b.gewicht - a.gewicht || a.name.localeCompare(b.name); });
  }

  return {
    profil: profil,
    gliederung: gliederung,
    wortfeld: wortfeld,
    verweise: verweise,
    bilder: bilder,
    punktzahl: punktzahl,
    wirkungen: wirkungen,
    kurz: kurz
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_ANALYSE;
