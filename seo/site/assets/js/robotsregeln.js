/* seo-rank.me — robots.txt lesen und auswerten.
   Eine Quelle fuer den Pruefer im Browser und den Crawler auf der
   Kommandozeile. Bildet nach, was Google dokumentiert hat: passende
   Gruppe zuerst, dann laengster passender Pfad, bei Gleichstand Allow. */

var SEORANK_ROBOTS = (function () {
  "use strict";

  function robotsLesen(text) {
    var zeilen = text.split(/\r?\n/);
    var gruppen = [];
    var aktuelle = null;
    var offenFuerAgenten = false;
    var sitemaps = [];
    var meldungen = [];

    zeilen.forEach(function (rohzeile, nr) {
      var zeile = rohzeile.replace(/#.*$/, "").trim();
      if (!zeile) return;

      var teiler = zeile.indexOf(":");
      if (teiler === -1) {
        meldungen.push({ name: "Zeile ohne Doppelpunkt", stufe: "wichtig", wie: "Zeile " + (nr + 1) + " folgt nicht dem Muster Feld: Wert und wird übergangen.", fund: rohzeile.trim() });
        return;
      }

      var feld = zeile.slice(0, teiler).trim().toLowerCase();
      var wert = zeile.slice(teiler + 1).trim();

      if (feld === "user-agent") {
        if (!offenFuerAgenten || !aktuelle) {
          aktuelle = { agenten: [], regeln: [] };
          gruppen.push(aktuelle);
          offenFuerAgenten = true;
        }
        aktuelle.agenten.push(wert.toLowerCase());
        return;
      }

      if (feld === "allow" || feld === "disallow") {
        offenFuerAgenten = false;
        if (!aktuelle) {
          meldungen.push({ name: "Regel ohne User-agent", stufe: "kritisch", wie: "Zeile " + (nr + 1) + " steht vor jeder User-agent-Zeile und gilt für niemanden.", fund: rohzeile.trim() });
          return;
        }
        if (wert && wert.charAt(0) !== "/" && wert.charAt(0) !== "*") {
          meldungen.push({ name: "Pfad ohne führenden Schrägstrich", stufe: "wichtig", wie: "Zeile " + (nr + 1) + ": Pfade beginnen mit / oder *.", fund: rohzeile.trim() });
        }
        aktuelle.regeln.push({ art: feld, pfad: wert, zeile: nr + 1 });
        return;
      }

      offenFuerAgenten = false;

      if (feld === "sitemap") {
        sitemaps.push(wert);
        if (!/^https?:\/\//i.test(wert)) {
          meldungen.push({ name: "Sitemap nicht vollständig angegeben", stufe: "wichtig", wie: "Zeile " + (nr + 1) + ": Die Sitemap-Adresse muss mit Schema und Domain stehen.", fund: rohzeile.trim() });
        }
        return;
      }

      if (feld === "crawl-delay") {
        meldungen.push({ name: "Crawl-delay wird von Google übergangen", stufe: "hinweis", wie: "Zeile " + (nr + 1) + ": Andere Suchmaschinen beachten es, Google nicht. Die Crawl-Geschwindigkeit wird dort in der Search Console geregelt.", fund: rohzeile.trim() });
        return;
      }

      if (feld === "host" || feld === "clean-param" || feld === "noindex") {
        meldungen.push({ name: "Feld wird nicht allgemein unterstützt", stufe: "hinweis", wie: "Zeile " + (nr + 1) + ": „" + feld + "“ kennen nur einzelne Suchmaschinen.", fund: rohzeile.trim() });
        return;
      }

      meldungen.push({ name: "Unbekanntes Feld", stufe: "hinweis", wie: "Zeile " + (nr + 1) + ": „" + feld + "“ gehört nicht zum robots.txt-Standard und wird übergangen.", fund: rohzeile.trim() });
    });

    return { gruppen: gruppen, sitemaps: sitemaps, meldungen: meldungen };
  }

  function gruppeFuer(gruppen, agent) {
    var klein = agent.toLowerCase();
    var genau = null, stern = null;

    gruppen.forEach(function (g) {
      g.agenten.forEach(function (a) {
        if (a === "*") { stern = stern || { agenten: [], regeln: [] }; stern.regeln = stern.regeln.concat(g.regeln); }
        else if (klein.indexOf(a) === 0 || a === klein) { genau = genau || { agenten: [a], regeln: [] }; genau.regeln = genau.regeln.concat(g.regeln); }
      });
    });

    if (genau) return { regeln: genau.regeln, quelle: "Gruppe für " + agent };
    if (stern) return { regeln: stern.regeln, quelle: "Gruppe für *" };
    return { regeln: [], quelle: "keine passende Gruppe" };
  }

  function pfadPasst(muster, pfad) {
    if (muster === "") return false;
    var endeFest = muster.charAt(muster.length - 1) === "$";
    var kern = endeFest ? muster.slice(0, -1) : muster;
    var teile = kern.split("*").map(function (t) {
      return t.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    });
    var quelle = "^" + teile.join(".*") + (endeFest ? "$" : "");
    try { return new RegExp(quelle).test(pfad); } catch (e) { return false; }
  }

  function robotsEntscheiden(gruppe, pfad) {
    var beste = null;
    gruppe.regeln.forEach(function (r) {
      if (r.art === "disallow" && r.pfad === "") return; // leeres Disallow erlaubt alles
      if (!pfadPasst(r.pfad, pfad)) return;
      var laenge = r.pfad.length;
      if (!beste || laenge > beste.laenge || (laenge === beste.laenge && r.art === "allow")) {
        beste = { regel: r, laenge: laenge };
      }
    });

    if (!beste) return { erlaubt: true, grund: "Keine Regel greift. Was nicht verboten ist, ist erlaubt." };
    return {
      erlaubt: beste.regel.art === "allow",
      grund: "Zeile " + beste.regel.zeile + ": " + (beste.regel.art === "allow" ? "Allow" : "Disallow") + ": " + beste.regel.pfad
    };
  }

  return {
    lesen: robotsLesen,
    gruppeFuer: gruppeFuer,
    pfadPasst: pfadPasst,
    entscheiden: robotsEntscheiden
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_ROBOTS;
