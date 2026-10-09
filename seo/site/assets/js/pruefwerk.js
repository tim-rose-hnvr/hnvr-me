/* seo-rank.me — Pruefwerk.

   Die Urteile der kleinen Pruefer, OHNE Oberflaeche. Bis zum 22.09.2026
   standen sie verwoben mit dem Zeichnen in werkzeuge.js und domain.js.
   Seit es das Protokoll gibt, braucht sie ein zweiter Ort — und zwei
   Fassungen derselben Bewertung laufen auseinander. Deshalb stehen sie
   hier, und beide Stellen rufen dieselbe Funktion:

   - robotsUrteil(roh, pfad, agent)   robots.txt → Urteil und Befunde
   - sitemapUrteil(roh)               sitemap.xml → Befunde und Zeilen
   - dnsHolen(domain)                 DNS ueber DNS-over-HTTPS
   - rdapHolen(domain)                Registrierung ueber rdap.org
   - relaisHolen(domain, optionen)    vier Schreibweisen und Standarddateien
                                      ueber das Abrufrelais

   Die drei letzten rufen fremde Dienste. Sie laufen NUR auf
   ausdruecklichen Klick; aufrufende Seiten sagen vorher, was wohin geht. */

var SEORANK_PRUEFWERK = (function () {
  "use strict";

  function kuerzeln(text, laenge) {
    text = String(text || "");
    return text.length > laenge ? text.slice(0, laenge - 1) + "…" : text;
  }

  function istW3CDatum(wert) {
    return /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?)?)?$/.test(wert);
  }

  /* =========================================================
     robots.txt
     ========================================================= */

  var R = (typeof SEORANK_ROBOTS !== "undefined") ? SEORANK_ROBOTS : null;

  /* Welche Antwortmaschinen duerfen hier lesen? */
  var KI_CRAWLER = [
    ["GPTBot", "ChatGPT von OpenAI"],
    ["OAI-SearchBot", "die Suche von OpenAI"],
    ["ChatGPT-User", "Abrufe aus ChatGPT heraus"],
    ["ClaudeBot", "Claude von Anthropic"],
    ["anthropic-ai", "Anthropic, aeltere Kennung"],
    ["PerplexityBot", "Perplexity"],
    ["Google-Extended", "die KI-Antworten von Google"],
    ["Applebot-Extended", "Apple Intelligence"],
    ["CCBot", "Common Crawl, Grundlage vieler Modelle"],
    ["Bytespider", "ByteDance"],
    ["meta-externalagent", "Meta"]
  ];

  /* Wer darf hier rein? Bewusst kurz und benannt — Suche und die grossen
     KI-Crawler. Dieselbe Entscheidung wie das Urteil, einmal je Agent. */
  var CRAWLER = [
    ["Googlebot", "Google-Suche"],
    ["Googlebot-Image", "Google-Bildersuche"],
    ["Bingbot", "Bing-Suche"],
    ["DuckDuckBot", "DuckDuckGo"],
    ["Applebot", "Apple (Siri, Spotlight)"],
    ["GPTBot", "OpenAI, Training"],
    ["OAI-SearchBot", "OpenAI, Suche"],
    ["ChatGPT-User", "ChatGPT, Abruf auf Zuruf"],
    ["ClaudeBot", "Anthropic, Training"],
    ["Claude-User", "Claude, Abruf auf Zuruf"],
    ["PerplexityBot", "Perplexity"],
    ["Google-Extended", "Google Gemini, Training"],
    ["Applebot-Extended", "Apple KI, Training"],
    ["CCBot", "Common Crawl"],
    ["Bytespider", "ByteDance"]
  ];

  function robotsUrteil(roh, pfad, agent) {
    if (!R) return null;
    pfad = pfad || "/";
    agent = agent || "Googlebot";

    var gelesen = R.lesen(roh);
    var gruppe = R.gruppeFuer(gelesen.gruppen, agent);
    var urteil = R.entscheiden(gruppe, pfad);
    var befunde = gelesen.meldungen.slice();

    var alleGesperrt = gelesen.gruppen.some(function (g) {
      return g.agenten.indexOf("*") !== -1 && g.regeln.some(function (r) { return r.art === "disallow" && r.pfad === "/"; });
    });
    if (alleGesperrt) {
      befunde.push({ name: "Die gesamte Website ist gesperrt", stufe: "kritisch", wie: "Disallow: / für alle Zugriffe schließt jede Adresse aus. Auf einer Live-Website ist das fast immer ein Versehen aus der Entwicklungszeit.", fund: "User-agent: *\nDisallow: /" });
    }

    var gesperrteKI = [];
    var erlaubteKI = [];
    KI_CRAWLER.forEach(function (paar) {
      var g = R.gruppeFuer(gelesen.gruppen, paar[0]);
      var u = R.entscheiden(g, "/");
      (u.erlaubt ? erlaubteKI : gesperrteKI).push(paar[0] + " (" + paar[1] + ")");
    });

    if (gesperrteKI.length) {
      befunde.push({
        name: "Antwortmaschinen ausgesperrt", stufe: "hinweis",
        wie: gesperrteKI.length + " von " + KI_CRAWLER.length + " KI-Crawlern dürfen die Startseite nicht lesen. Das ist eine legitime Entscheidung; sie bedeutet aber, dass diese Dienste die Website nicht zitieren können.",
        fund: gesperrteKI.join("\n")
      });
    } else {
      befunde.push({
        name: "Antwortmaschinen dürfen lesen", stufe: "gut",
        wie: "Alle " + KI_CRAWLER.length + " geprüften KI-Crawler dürfen die Startseite abrufen. Wer das nicht will, sperrt sie hier gezielt.",
        fund: null
      });
    }

    if (!gelesen.sitemaps.length) {
      befunde.push({ name: "Keine Sitemap eingetragen", stufe: "hinweis", wie: "Eine Zeile Sitemap: https://… erspart den Suchmaschinen das Suchen." });
    }
    if (!gelesen.gruppen.length) {
      befunde.push({ name: "Keine Gruppe gefunden", stufe: "wichtig", wie: "Ohne User-agent-Zeile gilt keine einzige Regel." });
    }

    return { gelesen: gelesen, gruppe: gruppe, urteil: urteil, pfad: pfad, agent: agent, befunde: befunde };
  }

  /* Die Entscheidung fuer jeden benannten Crawler, fuer die Matrix. */
  function crawlerEntscheiden(gelesen, pfad) {
    return CRAWLER.map(function (c) {
      var gruppe = R ? R.gruppeFuer(gelesen.gruppen, c[0]) : null;
      var wahl = gruppe
        ? R.entscheiden(gruppe, pfad)
        : { erlaubt: true, grund: "Keine Gruppe passt. Was nicht verboten ist, ist erlaubt." };
      return { name: c[0], wer: c[1], erlaubt: wahl.erlaubt, grund: wahl.grund };
    });
  }

  /* =========================================================
     sitemap.xml
     ========================================================= */

  var FREQUENZEN = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"];

  function sitemapUrteil(roh) {
    roh = String(roh || "").trim();
    var befunde = [];
    var doc = new DOMParser().parseFromString(roh, "application/xml");
    var fehler = doc.querySelector("parsererror");

    if (fehler) {
      befunde.push({ name: "Die Datei ist kein gültiges XML", stufe: "kritisch", wie: "Solange das XML nicht aufgeht, liest keine Suchmaschine eine einzige Adresse daraus.", fund: kuerzeln(fehler.textContent, 300) });
      return { gueltig: false, befunde: befunde, zeilen: [], locs: [], doppelt: [], istIndex: false, groesse: null, daten: [] };
    }

    var wurzel = doc.documentElement;
    var istIndex = wurzel.localName === "sitemapindex";
    var eintraege = wurzel.getElementsByTagName("*");
    var locs = [];

    /* Je Eintrag alle Felder, fuer die Adresstabelle. */
    var zeilen = [];
    Array.prototype.forEach.call(wurzel.children, function (eintrag) {
      if (eintrag.localName !== "url" && eintrag.localName !== "sitemap") return;
      var z = { loc: "", lastmod: "", changefreq: "", priority: "", anmerkungen: [] };
      Array.prototype.forEach.call(eintrag.children, function (feld) {
        if (z.hasOwnProperty(feld.localName)) z[feld.localName] = feld.textContent.trim();
      });
      zeilen.push(z);
    });

    Array.prototype.forEach.call(eintraege, function (el) {
      if (el.localName === "loc") locs.push(el.textContent.trim());
    });

    if (wurzel.localName !== "urlset" && !istIndex) {
      befunde.push({ name: "Unerwartetes Wurzelelement", stufe: "kritisch", wie: "Erwartet wird urlset oder sitemapindex.", fund: "<" + wurzel.nodeName + ">" });
    }

    var raum = wurzel.namespaceURI;
    if (raum !== "http://www.sitemaps.org/schemas/sitemap/0.9") {
      befunde.push({ name: "Falscher Namensraum", stufe: "wichtig", wie: "Ohne den Namensraum der Sitemaps-Spezifikation wird die Datei verworfen.", fund: raum || "(keiner angegeben)" });
    }

    var groesse = new Blob([roh]).size;
    if (groesse > 52428800) {
      befunde.push({ name: "Datei über 50 MB", stufe: "kritisch", wie: "Ungepackt sind 50 MB die Obergrenze. Diese Datei hat " + (groesse / 1048576).toFixed(1) + " MB." });
    }
    if (locs.length > 50000) {
      befunde.push({ name: "Mehr als 50.000 Adressen", stufe: "kritisch", wie: locs.length.toLocaleString("de-DE") + " Adressen in einer Datei. Ab 50.000 muss auf mehrere Sitemaps mit einem Index aufgeteilt werden." });
    }
    if (locs.length === 0) {
      befunde.push({ name: "Keine Adresse gefunden", stufe: "kritisch", wie: "Die Datei enthält kein einziges loc-Element." });
    }

    var gesehen = {}, doppelt = [];
    var ohneSchema = [], mitLeerzeichen = [], hosts = {};
    locs.forEach(function (l) {
      if (gesehen[l]) { if (doppelt.indexOf(l) === -1) doppelt.push(l); }
      gesehen[l] = true;
      if (!/^https?:\/\//i.test(l)) {
        ohneSchema.push(l);
      } else {
        try { hosts[new URL(l).host] = true; } catch (e) { /* faellt unten auf */ }
      }
      if (/\s/.test(l)) mitLeerzeichen.push(l);
    });

    if (doppelt.length) {
      befunde.push({ name: "Doppelte Adressen", stufe: "wichtig", wie: doppelt.length + " Adresse(n) stehen mehrfach in der Datei.", fund: doppelt.slice(0, 5).join("\n") });
    }
    if (ohneSchema.length) {
      befunde.push({ name: "Adressen ohne Schema und Domain", stufe: "kritisch", wie: ohneSchema.length + " Adresse(n) sind relativ. In einer Sitemap muss jede Adresse vollständig sein.", fund: ohneSchema.slice(0, 5).join("\n") });
    }
    if (mitLeerzeichen.length) {
      befunde.push({ name: "Adressen mit Leerzeichen", stufe: "wichtig", wie: "Leerzeichen müssen als %20 kodiert sein.", fund: mitLeerzeichen.slice(0, 5).join("\n") });
    }
    if (Object.keys(hosts).length > 1) {
      befunde.push({ name: "Mehrere Domains in einer Sitemap", stufe: "wichtig", wie: "Eine Sitemap darf nur Adressen der eigenen Domain führen.", fund: Object.keys(hosts).join("\n") });
    }

    var schlechteDaten = [], schlechtePrio = [], schlechteFrequenz = [];
    Array.prototype.forEach.call(eintraege, function (el) {
      var wert = el.textContent.trim();
      if (el.localName === "lastmod" && !istW3CDatum(wert)) schlechteDaten.push(wert);
      if (el.localName === "priority") {
        var p = parseFloat(wert);
        if (isNaN(p) || p < 0 || p > 1) schlechtePrio.push(wert);
      }
      if (el.localName === "changefreq" && FREQUENZEN.indexOf(wert.toLowerCase()) === -1) schlechteFrequenz.push(wert);
    });

    if (schlechteDaten.length) {
      befunde.push({ name: "Ungültiges lastmod", stufe: "wichtig", wie: schlechteDaten.length + " Datumsangabe(n) folgen nicht dem W3C-Format, etwa 2026-08-24 oder 2026-08-24T09:30:00+02:00.", fund: schlechteDaten.slice(0, 5).join("\n") });
    }
    if (schlechtePrio.length) {
      befunde.push({ name: "priority außerhalb von 0.0 bis 1.0", stufe: "hinweis", wie: schlechtePrio.length + " Wert(e) liegen außerhalb des zulässigen Bereichs. Google wertet priority ohnehin nicht aus.", fund: schlechtePrio.slice(0, 5).join(", ") });
    }
    if (schlechteFrequenz.length) {
      befunde.push({ name: "Unbekanntes changefreq", stufe: "hinweis", wie: "Erlaubt sind: " + FREQUENZEN.join(", ") + ".", fund: schlechteFrequenz.slice(0, 5).join(", ") });
    }

    /* Anmerkungen je Zeile: dieselben Pruefungen wie oben, aber an der
       Adresse festgemacht, nicht als Sammelmeldung. */
    var doppeltMenge = {};
    doppelt.forEach(function (l) { doppeltMenge[l] = true; });
    zeilen.forEach(function (z) {
      if (z.loc && !/^https?:\/\//i.test(z.loc)) z.anmerkungen.push("relativ");
      if (doppeltMenge[z.loc]) z.anmerkungen.push("doppelt");
      if (/\s/.test(z.loc)) z.anmerkungen.push("Leerzeichen");
      if (z.lastmod && !istW3CDatum(z.lastmod)) z.anmerkungen.push("lastmod ungültig");
      if (z.priority) {
        var p = parseFloat(z.priority);
        if (isNaN(p) || p < 0 || p > 1) z.anmerkungen.push("priority außerhalb 0–1");
      }
      if (z.changefreq && FREQUENZEN.indexOf(z.changefreq.toLowerCase()) === -1) z.anmerkungen.push("changefreq unbekannt");
    });

    var daten = zeilen.map(function (z) { return z.lastmod; })
      .filter(function (w) { return w && istW3CDatum(w); })
      .map(function (w) { return Date.parse(w); })
      .filter(function (t) { return !isNaN(t); });

    return { gueltig: true, befunde: befunde, zeilen: zeilen, locs: locs, doppelt: doppelt, istIndex: istIndex, groesse: groesse, daten: daten };
  }

  /* =========================================================
     Domain-Sammler

     Der Browser darf kein DNS aufloesen — er kann aber einen Aufloeser
     ueber HTTPS fragen, der CORS erlaubt. Gemessen: cloudflare-dns.com
     und dns.google antworten beide mit 200 und offenem CORS, rdap.org
     ebenso. rdap.denic.de dagegen blockiert CORS.

     Das ist ein FREMDAUFRUF. Er passiert nur auf ausdruecklichen Klick.
     ========================================================= */

  var DOH = "https://cloudflare-dns.com/dns-query";
  var TYPEN = { A: 1, AAAA: 28, NS: 2, MX: 15, TXT: 16, CAA: 257 };

  function dohFragen(name, typ) {
    return fetch(DOH + "?name=" + encodeURIComponent(name) + "&type=" + TYPEN[typ],
      { headers: { Accept: "application/dns-json" } })
      .then(function (a) { return a.ok ? a.json() : null; })
      .then(function (j) { return (j && j.Answer) ? j.Answer : []; })
      .catch(function () { return null; });
  }

  /* TXT kommt in Anfuehrungszeichen und bei langen Eintraegen in
     Stuecken. Sie gehoeren ohne Trennzeichen zusammen. */
  function txtSaeubern(wert) {
    return String(wert).replace(/"\s+"/g, "").replace(/^"|"$/g, "");
  }

  function dnsHolen(domain) {
    var arten = ["A", "AAAA", "NS", "MX", "TXT", "CAA"];
    var aufgaben = arten.map(function (t) { return dohFragen(domain, t); });
    aufgaben.push(dohFragen("_dmarc." + domain, "TXT"));

    return Promise.all(aufgaben).then(function (antworten) {
      /* Ein null bedeutet: der Aufloeser war nicht erreichbar. Das ist
         etwas anderes als eine leere Antwort, und es darf nicht als
         „nachgesehen und nichts gefunden" durchgehen. */
      if (antworten.some(function (a) { return a === null; })) return null;

      var roh = {};
      arten.forEach(function (t, i) { roh[t] = antworten[i]; });
      var dmarcAntwort = antworten[antworten.length - 1];
      var txt = (roh.TXT || []).map(function (e) { return txtSaeubern(e.data); });

      return {
        a: (roh.A || []).map(function (e) { return e.data; }),
        aTtl: (roh.A || []).length ? roh.A[0].TTL : null,
        aaaa: (roh.AAAA || []).map(function (e) { return e.data; }),
        ns: (roh.NS || []).map(function (e) { return String(e.data).replace(/\.$/, ""); }),
        mx: (roh.MX || []).map(function (e) { return e.data; }),
        txt: txt,
        spf: txt.filter(function (t) { return /^v=spf1\b/i.test(t); }),
        dmarc: (dmarcAntwort || []).map(function (e) { return txtSaeubern(e.data); })
          .filter(function (t) { return /^v=DMARC1\b/i.test(t); }),
        caa: (roh.CAA || []).map(function (e) { return e.data; }),
        ptr: []
      };
    });
  }

  /* Gemessen: rdap.org antwortet fuer .com und .net mit 200, fuer .de und
     .me mit 404. Der Unterschied zwischen „gibt es dort nicht" und „kam
     nicht hin" steht im Feld grund. */
  function rdapHolen(domain) {
    var grund = null;
    return fetch("https://rdap.org/domain/" + encodeURIComponent(domain),
      { headers: { Accept: "application/rdap+json" } })
      .then(function (a) {
        if (a.status === 404) { grund = "keine Angaben für diese Endung"; return null; }
        if (!a.ok) { grund = "rdap.org antwortet mit " + a.status; return null; }
        return a.json();
      })
      .then(function (j) {
        if (!j) return { daten: null, grund: grund };
        function ereignis(name) {
          var e = (j.events || []).filter(function (x) { return x.eventAction === name; })[0];
          return e ? e.eventDate : null;
        }
        var laeuftAb = ereignis("expiration");
        var tage = null;
        if (laeuftAb) {
          var ziel = new Date(laeuftAb).getTime();
          if (isFinite(ziel)) tage = Math.floor((ziel - Date.now()) / 86400000);
        }
        var registrar = (j.entities || [])
          .filter(function (e) { return (e.roles || []).indexOf("registrar") >= 0; })
          .map(function (e) {
            var v = (e.vcardArray && e.vcardArray[1]) || [];
            var fn = v.filter(function (z) { return z[0] === "fn"; })[0];
            return fn ? fn[3] : e.handle;
          })[0] || null;
        return { daten: { registrar: registrar, erstellt: ereignis("registration"),
                 laeuftAb: laeuftAb, tageRest: tage, status: j.status || [] }, grund: null };
      })
      .catch(function () {
        return { daten: null, grund: grund || "rdap.org war nicht erreichbar" };
      });
  }

  /* Antwortkopfzeilen, Weiterleitungen und Standarddateien gehen nur ueber
     ein Relais. Das Zertifikat bleibt der Kommandozeile vorbehalten: dafuer
     muesste man die TLS-Verbindung selbst aufbauen.

     optionen.mitText: die Sitemap VOLLSTAENDIG holen (das Protokoll
     beurteilt sie), statt nur ihre Kopfzeilen. */
  function relaisHolen(domain, optionen) {
    var A = (typeof SEORANK_ABRUF !== "undefined") ? SEORANK_ABRUF : null;
    if (!A) return Promise.resolve(null);
    optionen = optionen || {};

    var blank = domain.replace(/^www\./, "");
    var varianten = [
      { kennung: "http", url: "http://" + blank + "/" },
      { kennung: "http-www", url: "http://www." + blank + "/" },
      { kennung: "https", url: "https://" + blank + "/" },
      { kennung: "https-www", url: "https://www." + blank + "/" }
    ];

    return Promise.all(varianten.map(function (v) {
      return A.holen(v.url, { nurKopf: true }).then(function (d) {
        return { kennung: v.kennung, url: v.url,
                 status: d.ok ? d.status : null,
                 ziel: d.ok ? d.ziel : null,
                 kette: d.ok ? d.kette : [],
                 fehler: d.ok ? null : d.fehler,
                 kopf: d.ok ? d.kopf : null,
                 cookies: d.ok ? d.cookies : [],
                 ttfb: d.ok ? d.ttfb : null };
      });
    })).then(function (gemessen) {
      /* Der massgebliche Host ist der, auf dem die sichere Fassung
         landet. Alles Weitere wird von dort aus geholt. */
      var sicher = gemessen.filter(function (v) {
        return v.kennung.indexOf("https") === 0 && v.status && !v.fehler;
      });
      if (!sicher.length) {
        return { varianten: gemessen, fehler: "Keine der beiden https-Schreibweisen antwortet." };
      }
      var beste = sicher.filter(function (v) { return v.status === 200; })[0] || sicher[0];
      var startseite = beste.ziel || beste.url;
      var wurzel;
      try { wurzel = new URL(startseite).origin; } catch (e) { wurzel = "https://" + blank; }

      var zufall = "/seo-rank-pruefpfad-" + Math.random().toString(36).slice(2, 10);
      var dateien = [
        ["robots", wurzel + "/robots.txt", false],
        ["favicon", wurzel + "/favicon.ico", true],
        ["securitytxt", wurzel + "/.well-known/security.txt", true],
        ["zufallspfad", wurzel + zufall, true]
      ];

      return Promise.all(dateien.map(function (d) {
        return A.holen(d[1], { nurKopf: d[2] }).then(function (r) {
          return { name: d[0], url: d[1], status: r.ok ? r.status : null, text: r.ok ? r.html : null };
        });
      })).then(function (geholt) {
        var nach = {};
        geholt.forEach(function (g) { nach[g.name] = { url: g.url, status: g.status, text: g.text }; });

        /* Die Sitemap steht dort, wo die robots.txt sie nennt. Wer nur
           /sitemap.xml prueft, meldet eine fehlende Sitemap, die es gibt. */
        var sitemapAdresse = wurzel + "/sitemap.xml";
        if (nach.robots && nach.robots.status === 200 && nach.robots.text) {
          var m = nach.robots.text.match(/^\s*sitemap\s*:\s*(\S+)/im);
          if (m) sitemapAdresse = m[1];
        }

        return A.holen(sitemapAdresse, { nurKopf: !optionen.mitText }).then(function (s) {
          nach.sitemap = { url: sitemapAdresse, status: s.ok ? s.status : null, text: (s.ok && optionen.mitText) ? s.html : null };
          return {
            varianten: gemessen,
            host: (function () { try { return new URL(startseite).host; } catch (e) { return blank; } })(),
            startseite: startseite,
            kopf: beste.kopf,
            cookies: beste.cookies,
            ttfb: beste.ttfb,
            dateien: nach
          };
        });
      });
    });
  }

  return {
    kuerzeln: kuerzeln,
    istW3CDatum: istW3CDatum,
    KI_CRAWLER: KI_CRAWLER,
    CRAWLER: CRAWLER,
    robotsUrteil: robotsUrteil,
    crawlerEntscheiden: crawlerEntscheiden,
    sitemapUrteil: sitemapUrteil,
    dnsHolen: dnsHolen,
    rdapHolen: rdapHolen,
    relaisHolen: relaisHolen
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_PRUEFWERK;
